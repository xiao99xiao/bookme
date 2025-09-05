-- Create cancellation policies system

-- First, create the trigger function for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create cancellation policies table
CREATE TABLE IF NOT EXISTS public.cancellation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reason_key TEXT NOT NULL UNIQUE,
    reason_title TEXT NOT NULL,
    reason_description TEXT NOT NULL,
    customer_refund_percentage INTEGER NOT NULL CHECK (customer_refund_percentage >= 0 AND customer_refund_percentage <= 100),
    provider_earnings_percentage INTEGER NOT NULL CHECK (provider_earnings_percentage >= 0 AND provider_earnings_percentage <= 100),
    platform_fee_percentage INTEGER NOT NULL CHECK (platform_fee_percentage >= 0 AND platform_fee_percentage <= 100),
    requires_explanation BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint to ensure percentages add up to 100%
    CONSTRAINT valid_percentage_total CHECK (
        customer_refund_percentage + provider_earnings_percentage + platform_fee_percentage = 100
    )
);

-- Create cancellation policy conditions table
CREATE TABLE IF NOT EXISTS public.cancellation_policy_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES public.cancellation_policies(id) ON DELETE CASCADE,
    condition_type TEXT NOT NULL CHECK (condition_type IN ('booking_status', 'time_before_start', 'min_time_before_start', 'max_time_before_start')),
    condition_value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add updated_at trigger for cancellation_policies
CREATE OR REPLACE TRIGGER update_cancellation_policies_updated_at 
    BEFORE UPDATE ON public.cancellation_policies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS cancellation_policies_reason_key_idx ON public.cancellation_policies(reason_key);
CREATE INDEX IF NOT EXISTS cancellation_policies_is_active_idx ON public.cancellation_policies(is_active);
CREATE INDEX IF NOT EXISTS cancellation_policy_conditions_policy_id_idx ON public.cancellation_policy_conditions(policy_id);
CREATE INDEX IF NOT EXISTS cancellation_policy_conditions_type_idx ON public.cancellation_policy_conditions(condition_type);

-- Grant permissions
GRANT SELECT ON public.cancellation_policies TO anon;
GRANT SELECT ON public.cancellation_policies TO authenticated;
GRANT SELECT ON public.cancellation_policy_conditions TO anon;
GRANT SELECT ON public.cancellation_policy_conditions TO authenticated;