-- Add blockchain integration columns to bookings table

-- Add blockchain-specific columns to the existing bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS blockchain_booking_id VARCHAR(66), -- bytes32 hash of booking UUID
ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(66),    -- Transaction hash for payment
ADD COLUMN IF NOT EXISTS blockchain_confirmed_at TIMESTAMP WITH TIME ZONE, -- When blockchain payment confirmed
ADD COLUMN IF NOT EXISTS completion_tx_hash VARCHAR(66),    -- Transaction hash for service completion
ADD COLUMN IF NOT EXISTS cancellation_tx_hash VARCHAR(66),  -- Transaction hash for cancellation
ADD COLUMN IF NOT EXISTS blockchain_data JSONB;            -- Store additional blockchain event data

-- Create blockchain events tracking table
CREATE TABLE IF NOT EXISTS public.blockchain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,              -- 'BookingCreatedAndPaid', 'ServiceCompleted', etc.
  transaction_hash VARCHAR(66) NOT NULL,        -- Blockchain transaction hash
  block_number BIGINT NOT NULL,                 -- Block number when event occurred
  booking_id VARCHAR(66),                       -- Blockchain booking ID (bytes32)
  event_data JSONB NOT NULL,                    -- Full event data from blockchain
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processing_status VARCHAR(20) DEFAULT 'PROCESSED' CHECK (processing_status IN ('PROCESSED', 'FAILED', 'RETRY')),
  error_message TEXT,                           -- Error message if processing failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint to prevent duplicate event processing
-- Use COALESCE for nullable booking_id to handle NULL values properly
CREATE UNIQUE INDEX IF NOT EXISTS blockchain_events_unique_idx 
ON public.blockchain_events(transaction_hash, event_type, COALESCE(booking_id, ''));

-- Create signature nonces table for replay protection
CREATE TABLE IF NOT EXISTS public.signature_nonces (
  id SERIAL PRIMARY KEY,
  nonce BIGINT UNIQUE NOT NULL,                 -- EIP-712 signature nonce
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  booking_id UUID REFERENCES public.bookings(id), -- Associated booking if applicable
  signature_type VARCHAR(50) NOT NULL          -- 'booking_authorization', 'cancellation_authorization'
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS bookings_blockchain_booking_id_idx ON public.bookings(blockchain_booking_id);
CREATE INDEX IF NOT EXISTS bookings_blockchain_tx_hash_idx ON public.bookings(blockchain_tx_hash);
CREATE INDEX IF NOT EXISTS bookings_blockchain_confirmed_at_idx ON public.bookings(blockchain_confirmed_at);

CREATE INDEX IF NOT EXISTS blockchain_events_event_type_idx ON public.blockchain_events(event_type);
CREATE INDEX IF NOT EXISTS blockchain_events_transaction_hash_idx ON public.blockchain_events(transaction_hash);
CREATE INDEX IF NOT EXISTS blockchain_events_booking_id_idx ON public.blockchain_events(booking_id);
CREATE INDEX IF NOT EXISTS blockchain_events_created_at_idx ON public.blockchain_events(created_at);

CREATE INDEX IF NOT EXISTS signature_nonces_nonce_idx ON public.signature_nonces(nonce);
CREATE INDEX IF NOT EXISTS signature_nonces_used_at_idx ON public.signature_nonces(used_at);

-- Add constraints
-- Note: PostgreSQL doesn't support IF NOT EXISTS for CHECK constraints
-- We'll handle this by checking if constraint exists first
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'blockchain_booking_id_format'
  ) THEN
    ALTER TABLE public.bookings 
    ADD CONSTRAINT blockchain_booking_id_format 
    CHECK (blockchain_booking_id IS NULL OR blockchain_booking_id ~ '^0x[a-fA-F0-9]{64}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'blockchain_tx_hash_format'
  ) THEN
    ALTER TABLE public.bookings 
    ADD CONSTRAINT blockchain_tx_hash_format 
    CHECK (blockchain_tx_hash IS NULL OR blockchain_tx_hash ~ '^0x[a-fA-F0-9]{64}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'completion_tx_hash_format'
  ) THEN
    ALTER TABLE public.bookings 
    ADD CONSTRAINT completion_tx_hash_format 
    CHECK (completion_tx_hash IS NULL OR completion_tx_hash ~ '^0x[a-fA-F0-9]{64}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cancellation_tx_hash_format'
  ) THEN
    ALTER TABLE public.bookings 
    ADD CONSTRAINT cancellation_tx_hash_format 
    CHECK (cancellation_tx_hash IS NULL OR cancellation_tx_hash ~ '^0x[a-fA-F0-9]{64}$');
  END IF;
END $$;

-- Update booking status to include blockchain states
-- Note: We're keeping the existing status values and just documenting that they now support blockchain flows
ALTER TABLE public.bookings 
DROP CONSTRAINT IF EXISTS bookings_status_check,
ADD CONSTRAINT bookings_status_check 
CHECK (status IN (
  'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded',
  -- New blockchain-specific statuses
  'pending_payment',      -- Waiting for blockchain payment
  'paid',                -- Payment confirmed on blockchain
  'pending_completion',   -- Service can be marked as completed
  'pending_cancellation', -- Cancellation in progress
  'failed'               -- Payment or transaction failed
));

-- Row Level Security for new tables
ALTER TABLE public.blockchain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_nonces ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blockchain_events (admin/backend only)
CREATE POLICY "blockchain_events_backend_only" ON public.blockchain_events
  FOR ALL USING (false); -- Only backend service role can access

-- RLS Policies for signature_nonces (admin/backend only)  
CREATE POLICY "signature_nonces_backend_only" ON public.signature_nonces
  FOR ALL USING (false); -- Only backend service role can access

-- Grant permissions to service role only (backend)
-- Note: These tables should only be accessed by the backend service
-- Supabase service_role already has full access, but we'll be explicit
DO $$
BEGIN
  -- Check if service_role exists (it should in Supabase)
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.blockchain_events TO service_role;
    GRANT ALL ON public.signature_nonces TO service_role;
    GRANT USAGE, SELECT ON SEQUENCE signature_nonces_id_seq TO service_role;
  END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN public.bookings.blockchain_booking_id IS 'bytes32 hash of booking UUID for blockchain identification';
COMMENT ON COLUMN public.bookings.blockchain_tx_hash IS 'Transaction hash when payment was made on blockchain';
COMMENT ON COLUMN public.bookings.blockchain_confirmed_at IS 'Timestamp when blockchain payment was confirmed';
COMMENT ON COLUMN public.bookings.completion_tx_hash IS 'Transaction hash when service was completed on blockchain';
COMMENT ON COLUMN public.bookings.cancellation_tx_hash IS 'Transaction hash when booking was cancelled on blockchain';
COMMENT ON COLUMN public.bookings.blockchain_data IS 'Additional blockchain event data (amounts, fees, etc.)';

COMMENT ON TABLE public.blockchain_events IS 'Tracks all blockchain events for audit and synchronization';
COMMENT ON TABLE public.signature_nonces IS 'Prevents EIP-712 signature replay attacks';

-- Create a function to generate blockchain booking ID from booking UUID
CREATE OR REPLACE FUNCTION public.generate_blockchain_booking_id(booking_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  booking_string TEXT;
  hash_result TEXT;
BEGIN
  -- Convert UUID to string and hash with keccak256 (simulated with sha256 for now)
  booking_string := booking_uuid::TEXT;
  -- Note: This is a placeholder - the actual hashing should be done in the backend
  -- using ethers.keccak256(ethers.toUtf8Bytes(booking_uuid))
  hash_result := '0x' || encode(digest(booking_string, 'sha256'), 'hex');
  
  RETURN hash_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.generate_blockchain_booking_id IS 'Generates blockchain booking ID from UUID (placeholder - actual hashing done in backend)';

-- Grant function execution to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_blockchain_booking_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_blockchain_booking_id TO anon;