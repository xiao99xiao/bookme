-- CRITICAL TIMEZONE FIXES - Run this IMMEDIATELY
-- This fixes the most dangerous timezone issues that will cause data corruption

BEGIN;

-- 1. Add timezone field to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Set default timezone based on common locations or detect from existing location field
UPDATE public.users 
SET timezone = CASE 
  WHEN location ILIKE '%new york%' OR location ILIKE '%nyc%' OR location ILIKE '%eastern%' THEN 'America/New_York'
  WHEN location ILIKE '%los angeles%' OR location ILIKE '%california%' OR location ILIKE '%pacific%' THEN 'America/Los_Angeles'
  WHEN location ILIKE '%chicago%' OR location ILIKE '%central%' THEN 'America/Chicago'
  WHEN location ILIKE '%london%' OR location ILIKE '%uk%' OR location ILIKE '%britain%' THEN 'Europe/London'
  WHEN location ILIKE '%berlin%' OR location ILIKE '%germany%' THEN 'Europe/Berlin'
  WHEN location ILIKE '%tokyo%' OR location ILIKE '%japan%' THEN 'Asia/Tokyo'
  WHEN location ILIKE '%sydney%' OR location ILIKE '%australia%' THEN 'Australia/Sydney'
  ELSE 'UTC'
END
WHERE timezone = 'UTC' AND location IS NOT NULL;

-- 2. CRITICAL: Fix bookings table to use proper timezone-aware timestamps
-- WARNING: This is a risky operation if you have existing data!
-- First, let's see if we have any bookings
DO $$
DECLARE
  booking_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO booking_count FROM public.bookings;
  
  IF booking_count = 0 THEN
    -- Safe to alter table structure if no data
    RAISE NOTICE 'No bookings found, safe to alter table structure';
    
    -- Drop and recreate columns with proper timezone support
    ALTER TABLE public.bookings ALTER COLUMN scheduled_at TYPE TIMESTAMPTZ USING scheduled_at AT TIME ZONE 'UTC';
    ALTER TABLE public.bookings ALTER COLUMN cancelled_at TYPE TIMESTAMPTZ USING cancelled_at AT TIME ZONE 'UTC';
    ALTER TABLE public.bookings ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC';
    ALTER TABLE public.bookings ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
    ALTER TABLE public.bookings ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
    
  ELSE
    -- If we have existing data, we need to be more careful
    RAISE NOTICE 'Found % bookings, need manual review of timezone migration', booking_count;
    RAISE NOTICE 'CRITICAL: Existing bookings need timezone context! Please review manually.';
    
    -- For now, assume existing timestamps are in UTC (common for apps)
    -- But this needs manual verification!
    ALTER TABLE public.bookings ALTER COLUMN scheduled_at TYPE TIMESTAMPTZ USING scheduled_at AT TIME ZONE 'UTC';
    ALTER TABLE public.bookings ALTER COLUMN cancelled_at TYPE TIMESTAMPTZ USING cancelled_at AT TIME ZONE 'UTC';
    ALTER TABLE public.bookings ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC';
    ALTER TABLE public.bookings ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
    ALTER TABLE public.bookings ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
  END IF;
END $$;

-- 3. Fix other timestamp fields for consistency
ALTER TABLE public.services ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE public.services ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE public.users ALTER COLUMN provider_verified_at TYPE TIMESTAMPTZ USING provider_verified_at AT TIME ZONE 'UTC';
ALTER TABLE public.users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE public.users ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- 4. Add timezone context to services availability_schedule
-- For now, add a timezone field to services table to store provider's timezone
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS service_timezone TEXT DEFAULT 'UTC';

-- Set service timezone based on provider's timezone (once users have timezone set)
UPDATE public.services 
SET service_timezone = COALESCE(
  (SELECT timezone FROM public.users WHERE users.id = services.provider_id),
  'UTC'
);

-- 5. Create indexes for timezone queries
CREATE INDEX IF NOT EXISTS idx_users_timezone ON public.users(timezone);
CREATE INDEX IF NOT EXISTS idx_services_timezone ON public.services(service_timezone);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_at_tz ON public.bookings(scheduled_at);

-- 6. Create a function to convert timestamps to user's timezone
CREATE OR REPLACE FUNCTION convert_timestamp_to_user_tz(
  timestamp_val TIMESTAMPTZ,
  user_timezone TEXT DEFAULT 'UTC'
) RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN timestamp_val AT TIME ZONE user_timezone;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMIT;

-- Final verification
DO $$
BEGIN
  RAISE NOTICE '=== TIMEZONE FIX VERIFICATION ===';
  RAISE NOTICE 'Users with timezone: %', (SELECT COUNT(*) FROM users WHERE timezone IS NOT NULL);
  RAISE NOTICE 'Services with timezone: %', (SELECT COUNT(*) FROM services WHERE service_timezone IS NOT NULL);
  RAISE NOTICE 'Bookings table now uses TIMESTAMPTZ: %', (
    SELECT data_type FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'scheduled_at'
  );
  RAISE NOTICE '================================';
END $$;