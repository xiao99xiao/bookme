-- Create transactions table to track provider income
-- This table stores income records for providers when bookings are completed

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Transaction details
    service_amount NUMERIC(10,2) NOT NULL, -- Service amount in USDC
    platform_fee NUMERIC(10,2) NOT NULL, -- Platform fee deducted
    net_amount NUMERIC(10,2) NOT NULL, -- Net amount received (service_amount - platform_fee)
    
    -- Related records
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    
    -- Service details (denormalized for history)
    service_title VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    
    -- Blockchain details
    transaction_hash VARCHAR(66), -- Ethereum transaction hash (0x + 64 chars)
    block_number BIGINT,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_provider ON transactions (provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_booking ON transactions (booking_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions (customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status, created_at DESC);
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