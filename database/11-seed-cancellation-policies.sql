-- Seed initial cancellation policies

-- Insert default cancellation policies
INSERT INTO public.cancellation_policies (reason_key, reason_title, reason_description, customer_refund_percentage, provider_earnings_percentage, platform_fee_percentage, requires_explanation) 
VALUES 
-- Customer No Show (ongoing orders only)
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
SELECT id, 'booking_status', 'ongoing' 
FROM public.cancellation_policies 
WHERE reason_key = 'customer_no_show'
ON CONFLICT DO NOTHING;

-- Insert conditions for Customer Early Cancel
INSERT INTO public.cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'booking_status', 'confirmed' 
FROM public.cancellation_policies 
WHERE reason_key = 'customer_early_cancel'
ON CONFLICT DO NOTHING;

INSERT INTO public.cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'min_time_before_start', '720' 
FROM public.cancellation_policies 
WHERE reason_key = 'customer_early_cancel'
ON CONFLICT DO NOTHING;

-- Insert conditions for Customer Late Cancel
INSERT INTO public.cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'booking_status', 'confirmed' 
FROM public.cancellation_policies 
WHERE reason_key = 'customer_late_cancel'
ON CONFLICT DO NOTHING;

INSERT INTO public.cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'max_time_before_start', '720' 
FROM public.cancellation_policies 
WHERE reason_key = 'customer_late_cancel'
ON CONFLICT DO NOTHING;

-- Insert conditions for Provider Cancel (can cancel at any time before start)
INSERT INTO public.cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'booking_status', 'confirmed' 
FROM public.cancellation_policies 
WHERE reason_key = 'provider_cancel'
ON CONFLICT DO NOTHING;

INSERT INTO public.cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'booking_status', 'ongoing' 
FROM public.cancellation_policies 
WHERE reason_key = 'provider_cancel'
ON CONFLICT DO NOTHING;

-- Note: The 'ongoing' status for provider cancel covers the case where provider cancels during the session
-- The 'confirmed' status covers cancellation before the appointment starts