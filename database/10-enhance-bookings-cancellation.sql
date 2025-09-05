-- Enhance bookings table with advanced cancellation fields

-- Add new cancellation-related columns to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS cancellation_policy_id UUID REFERENCES public.cancellation_policies(id),
ADD COLUMN IF NOT EXISTS cancellation_explanation TEXT,
ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS provider_earnings DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2);

-- Update the cancelled_by field to store user IDs instead of role names for better traceability
-- Note: We'll keep the existing structure but document that it can store user IDs

-- Add index for the new cancellation_policy_id field
CREATE INDEX IF NOT EXISTS bookings_cancellation_policy_id_idx ON public.bookings(cancellation_policy_id);

-- Add constraint to ensure refund amounts are non-negative
ALTER TABLE public.bookings 
ADD CONSTRAINT IF NOT EXISTS refund_amount_non_negative CHECK (refund_amount >= 0),
ADD CONSTRAINT IF NOT EXISTS provider_earnings_non_negative CHECK (provider_earnings >= 0),
ADD CONSTRAINT IF NOT EXISTS platform_fee_non_negative CHECK (platform_fee >= 0);

-- Add comment to document the enhanced cancellation system
COMMENT ON COLUMN public.bookings.cancellation_policy_id IS 'References the cancellation policy used for this cancellation';
COMMENT ON COLUMN public.bookings.cancellation_explanation IS 'Optional explanation provided by the user who cancelled';
COMMENT ON COLUMN public.bookings.refund_amount IS 'Amount refunded to the customer';
COMMENT ON COLUMN public.bookings.provider_earnings IS 'Amount paid to the provider after cancellation';
COMMENT ON COLUMN public.bookings.platform_fee IS 'Platform fee retained after cancellation';