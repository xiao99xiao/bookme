-- Create improved transactions table for flexible income tracking
-- This table stores all income records for providers from various sources

-- Drop existing table if needed to recreate with new schema
-- DROP TABLE IF EXISTS transactions CASCADE;

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Transaction type and amount
    type VARCHAR(50) NOT NULL CHECK (type IN ('booking_payment', 'inviter_fee', 'bonus', 'refund')),
    amount NUMERIC(10,2) NOT NULL, -- Net amount received by provider
    
    -- Optional related records (nullable for flexibility)
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    source_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Customer for booking_payment, referee for inviter_fee
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    
    -- Description for transaction (required for display)
    description TEXT NOT NULL, -- e.g. "Service: Web Development", "Inviter fee from John's booking"
    
    -- Optional blockchain reference (only for on-chain transactions)
    transaction_hash VARCHAR(66), -- Ethereum transaction hash
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_provider ON transactions (provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_booking ON transactions (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_source_user ON transactions (source_user_id) WHERE source_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions (transaction_hash) WHERE transaction_hash IS NOT NULL;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_transactions_updated_at();

-- RLS Policies
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Providers can only see their own income transactions
CREATE POLICY "Providers can view own income" ON transactions
    FOR SELECT USING (auth.uid()::text = provider_id::text);

-- Only backend service role can insert/update transactions
CREATE POLICY "Service role can manage transactions" ON transactions
    FOR ALL USING (auth.role() = 'service_role');

-- Add constraints for data integrity
ALTER TABLE transactions ADD CONSTRAINT check_positive_amount CHECK (amount > 0);
ALTER TABLE transactions ADD CONSTRAINT check_description_not_empty CHECK (TRIM(description) != '');

-- Example usage comments:
/*
Examples of different transaction types:

1. Booking Payment:
   - type: 'booking_payment'
   - amount: 45.00 (net after platform fee)
   - booking_id: uuid
   - source_user_id: customer_id
   - service_id: service_id
   - description: 'Web Development Consultation'
   - transaction_hash: '0x...'

2. Inviter Fee:
   - type: 'inviter_fee'
   - amount: 5.00 (10% of platform fee)
   - booking_id: original_booking_id (optional)
   - source_user_id: referee_who_made_booking
   - service_id: null
   - description: 'Inviter fee from Sarah's booking'
   - transaction_hash: '0x...' (if paid on-chain)

3. Bonus/Promotion:
   - type: 'bonus'
   - amount: 10.00
   - booking_id: null
   - source_user_id: null
   - service_id: null
   - description: 'New provider welcome bonus'
   - transaction_hash: null (if off-chain credit)
*/