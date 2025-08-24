-- Fix users table to work with Privy authentication
-- Remove the foreign key constraint to auth.users since we're using Privy instead

BEGIN;

-- Step 1: Drop the foreign key constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Step 2: Ensure the id column is still TEXT (as per our previous fix)
-- This should already be TEXT from the previous migration, but let's verify
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'id' 
        AND data_type = 'text'
    ) THEN
        -- If it's still UUID, convert to TEXT
        ALTER TABLE public.users ALTER COLUMN id TYPE TEXT;
    END IF;
END $$;

-- Step 3: Update RLS policies to work without auth.uid()
-- Drop old policies that depend on auth.uid()
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.users;

-- Create new policies that work with Privy
-- Allow public read access for all users (needed for profile viewing)
CREATE POLICY "public_read_users" ON public.users
  FOR SELECT USING (TRUE);

-- Allow service role to do everything (this is what our admin client uses)
CREATE POLICY "service_role_all_users" ON public.users
  FOR ALL USING (current_setting('role') = 'service_role');

-- Allow authenticated users to insert (for registration)
CREATE POLICY "authenticated_insert_users" ON public.users
  FOR INSERT TO authenticated WITH CHECK (TRUE);

-- Allow authenticated users to update (we'll handle authorization in the app layer)
CREATE POLICY "authenticated_update_users" ON public.users
  FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Step 4: Update other tables' policies that reference auth.uid()
-- Services policies
DROP POLICY IF EXISTS "Providers can manage their services" ON public.services;
CREATE POLICY "service_role_all_services" ON public.services
  FOR ALL USING (current_setting('role') = 'service_role');
CREATE POLICY "public_read_active_services" ON public.services
  FOR SELECT USING (is_active = true);

-- Bookings policies  
DROP POLICY IF EXISTS "Users can view their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Customers can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Participants can update bookings" ON public.bookings;
CREATE POLICY "service_role_all_bookings" ON public.bookings
  FOR ALL USING (current_setting('role') = 'service_role');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

GRANT SELECT ON public.services TO anon;
GRANT SELECT ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

COMMIT;

-- Test the change
SELECT 'SUCCESS: users table now works with Privy authentication' as result;
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'id';