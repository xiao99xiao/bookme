-- Seed initial cancellation policies

-- Insert default cancellation policies
INSERT INTO public.cancellation_policies (reason_key, reason_title, reason_description, customer_refund_percentage, provider_earnings_percentage, platform_fee_percentage, requires_explanation) 
VALUES 
-- Customer No Show (in_progress orders only)
('customer_no_show', 'Customer No Show', 'Customer failed to attend the scheduled appointment', 0, 100, 0, true),

-- Customer Early Cancellation (more than 12 hours before start)
('customer_early_cancel', 'Customer Early Cancellation', 'Customer requested cancellation with advance notice', 100, 0, 0, false),

-- Customer Late Cancellation (less than 12 hours but before start)
('customer_late_cancel', 'Customer Late Cancellation', 'Customer requested cancellation with short notice', 50, 0, 50, false),

-- Provider Cancellation
('provider_cancel', 'Provider Cancellation', 'Provider cancelled the appointment', 100, 0, 0, true)

ON CONFLICT (reason_key) DO NOTHING;

-- Insert conditions for Customer No Show
INSERT INTO public.cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'booking_status', 'in_progress' 
FROM public.cancellation_policies 
WHERE reason_key = 'customer_no_show'
AND NOT EXISTS (
    SELECT 1 FROM public.cancellation_policy_conditions cpc
    WHERE cpc.policy_id = public.cancellation_policies.id 
    AND cpc.condition_type = 'booking_status' 
    AND cpc.condition_value = 'in_progress'
);

-- Insert conditions for Customer Early Cancel
INSERT INTO public.cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'booking_status', 'confirmed' 
FROM public.cancellation_policies 
WHERE reason_key = 'customer_early_cancel'
AND NOT EXISTS (
    SELECT 1 FROM public.cancellation_policy_conditions cpc
    WHERE cpc.policy_id = public.cancellation_policies.id 
    AND cpc.condition_type = 'booking_status' 
    AND cpc.condition_value = 'confirmed'
);

INSERT INTO public.cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'min_time_before_start', '720' 
FROM public.cancellation_policies 
WHERE reason_key = 'customer_early_cancel'
AND NOT EXISTS (
    SELECT 1 FROM public.cancellation_policy_conditions cpc
    WHERE cpc.policy_id = public.cancellation_policies.id 
    AND cpc.condition_type = 'min_time_before_start' 
    AND cpc.condition_value = '720'
);

-- Insert conditions for Customer Late Cancel
INSERT INTO public.cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'booking_status', 'confirmed' 
FROM public.cancellation_policies 
WHERE reason_key = 'customer_late_cancel'
AND NOT EXISTS (
    SELECT 1 FROM public.cancellation_policy_conditions cpc
    WHERE cpc.policy_id = public.cancellation_policies.id 
    AND cpc.condition_type = 'booking_status' 
    AND cpc.condition_value = 'confirmed'
);

INSERT INTO public.cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'max_time_before_start', '720' 
FROM public.cancellation_policies 
WHERE reason_key = 'customer_late_cancel'
AND NOT EXISTS (
    SELECT 1 FROM public.cancellation_policy_conditions cpc
    WHERE cpc.policy_id = public.cancellation_policies.id 
    AND cpc.condition_type = 'max_time_before_start' 
    AND cpc.condition_value = '720'
);

-- Insert conditions for Provider Cancel (can cancel at any time before start)
INSERT INTO public.cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'booking_status', 'confirmed' 
FROM public.cancellation_policies 
WHERE reason_key = 'provider_cancel'
AND NOT EXISTS (
    SELECT 1 FROM public.cancellation_policy_conditions cpc
    WHERE cpc.policy_id = public.cancellation_policies.id 
    AND cpc.condition_type = 'booking_status' 
    AND cpc.condition_value = 'confirmed'
);

INSERT INTO public.cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'booking_status', 'in_progress' 
FROM public.cancellation_policies 
WHERE reason_key = 'provider_cancel'
AND NOT EXISTS (
    SELECT 1 FROM public.cancellation_policy_conditions cpc
    WHERE cpc.policy_id = public.cancellation_policies.id 
    AND cpc.condition_type = 'booking_status' 
    AND cpc.condition_value = 'in_progress'
);

-- Add minimum time condition for provider cancel (must be at least 60 minutes before start)
INSERT INTO public.cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'min_time_before_start', '60' 
FROM public.cancellation_policies 
WHERE reason_key = 'provider_cancel'
AND NOT EXISTS (
    SELECT 1 FROM public.cancellation_policy_conditions cpc
    WHERE cpc.policy_id = public.cancellation_policies.id 
    AND cpc.condition_type = 'min_time_before_start' 
    AND cpc.condition_value = '60'
);

-- Note: The 'in_progress' status for provider cancel covers the case where provider cancels during the session
-- The 'confirmed' status covers cancellation before the appointment starts  
-- The 60-minute minimum gives customers reasonable notice when providers cancel