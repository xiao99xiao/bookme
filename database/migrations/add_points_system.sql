-- =====================================================
-- Points System Migration
-- Date: 2026-01-11
-- Description: Add tables and columns for points system
-- =====================================================

-- =====================================================
-- 1. USER POINTS BALANCE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Balance tracking (100 points = $1 USD)
    balance INTEGER NOT NULL DEFAULT 0,
    lifetime_earned INTEGER NOT NULL DEFAULT 0,
    lifetime_spent INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT user_points_user_unique UNIQUE (user_id),
    CONSTRAINT user_points_balance_non_negative CHECK (balance >= 0)
);

CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);

-- Trigger for updated_at (drop if exists for idempotency)
DROP TRIGGER IF EXISTS trigger_user_points_updated_at ON user_points;
CREATE TRIGGER trigger_user_points_updated_at
  BEFORE UPDATE ON user_points
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. POINT TRANSACTIONS TABLE (AUDIT LOG)
-- =====================================================
CREATE TABLE IF NOT EXISTS point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Transaction details
    type TEXT NOT NULL CHECK (type IN (
        'funding_credit',      -- Points earned from funding (fee compensation)
        'booking_debit',       -- Points spent on booking
        'refund_credit',       -- Points returned from cancelled booking
        'admin_credit',        -- Manual adjustment (credit)
        'admin_debit',         -- Manual adjustment (debit)
        'expiry_debit'         -- Points expired (future use)
    )),

    amount INTEGER NOT NULL CHECK (amount > 0),
    balance_after INTEGER NOT NULL,

    -- References
    reference_type TEXT CHECK (reference_type IN ('funding', 'booking', 'admin')),
    reference_id TEXT,

    -- Metadata
    description TEXT,
    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_reference ON point_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created ON point_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(type);

-- =====================================================
-- 3. FUNDING RECORDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS funding_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Funding details
    requested_amount DECIMAL(10, 2) NOT NULL,    -- Amount user requested ($20)
    received_amount DECIMAL(10, 2) NOT NULL,     -- USDC actually received ($19.80)
    fee_amount DECIMAL(10, 2) NOT NULL,          -- Difference ($0.20)
    points_credited INTEGER NOT NULL DEFAULT 0,  -- Points given (20)

    -- Payment info
    payment_method TEXT DEFAULT 'credit_card',
    payment_provider TEXT,                       -- 'moonpay', 'privy', etc.
    transaction_hash TEXT,                       -- On-chain tx hash
    external_reference TEXT,                     -- Provider's reference ID

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Waiting for confirmation
        'completed',    -- USDC received, points credited
        'failed'        -- Transaction failed
    )),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_funding_records_user_id ON funding_records(user_id);
CREATE INDEX IF NOT EXISTS idx_funding_records_status ON funding_records(status);
CREATE INDEX IF NOT EXISTS idx_funding_records_tx_hash ON funding_records(transaction_hash);

-- =====================================================
-- 4. MODIFY BOOKINGS TABLE
-- Add columns for points tracking
-- =====================================================

-- Original amount (full service price before points discount)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10, 2);

-- Points used in this booking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS points_used INTEGER DEFAULT 0;

-- USD value of points used
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS points_value DECIMAL(10, 2) DEFAULT 0;

-- Actual USDC paid to smart contract
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS usdc_paid DECIMAL(10, 2);

-- Add comments for clarity
COMMENT ON COLUMN bookings.original_amount IS 'Original service price before points discount (includes service fee)';
COMMENT ON COLUMN bookings.points_used IS 'Number of points used (100 points = $1)';
COMMENT ON COLUMN bookings.points_value IS 'USD value of points used';
COMMENT ON COLUMN bookings.usdc_paid IS 'Actual USDC paid to smart contract';

-- =====================================================
-- 5. AUTO-CREATE USER_POINTS FOR NEW USERS
-- =====================================================

-- Function to create user_points record when user is created
CREATE OR REPLACE FUNCTION create_user_points_on_user_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_points (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_create_user_points ON users;

-- Create trigger
CREATE TRIGGER trigger_create_user_points
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_user_points_on_user_insert();

-- =====================================================
-- 6. BACKFILL USER_POINTS FOR EXISTING USERS
-- =====================================================
INSERT INTO user_points (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM user_points)
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- 7. UPDATE EXISTING BOOKINGS WITH DEFAULT VALUES
-- =====================================================

-- Set original_amount to total_price + service_fee for existing bookings
UPDATE bookings
SET
    original_amount = COALESCE(total_price, 0) + COALESCE(service_fee, 0),
    usdc_paid = COALESCE(total_price, 0) + COALESCE(service_fee, 0),
    points_used = 0,
    points_value = 0
WHERE original_amount IS NULL;

-- =====================================================
-- VERIFICATION QUERIES (for manual checking)
-- =====================================================
-- SELECT COUNT(*) FROM user_points;
-- SELECT COUNT(*) FROM users;
-- SELECT * FROM bookings WHERE original_amount IS NOT NULL LIMIT 5;
