-- Check what's stored in your meeting integrations
-- Run this in Supabase SQL editor to see if refresh_token is stored

SELECT 
  id,
  user_id,
  platform,
  platform_user_email,
  refresh_token IS NOT NULL as has_refresh_token,
  expires_at,
  created_at,
  CASE 
    WHEN refresh_token IS NOT NULL THEN 'Should never expire'
    WHEN expires_at IS NULL THEN 'No expiration set'
    WHEN expires_at < NOW() THEN 'Expired'
    ELSE 'Active until ' || expires_at::text
  END as status
FROM user_meeting_integrations
WHERE is_active = true
ORDER BY created_at DESC;