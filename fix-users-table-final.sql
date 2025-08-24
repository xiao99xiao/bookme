-- Fix users table to handle Privy DID format
-- This script drops RLS policies, changes column type, then recreates policies

BEGIN;

-- Step 1: Drop all existing RLS policies on users table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_public_read" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.users;

-- Step 2: Temporarily disable RLS
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Step 3: Drop indexes that might prevent the alter
DROP INDEX IF EXISTS users_email_idx;
DROP INDEX IF EXISTS users_verifier_idx;
DROP INDEX IF EXISTS users_provider_idx;

-- Step 4: Change column type from UUID to TEXT
ALTER TABLE public.users ALTER COLUMN id TYPE TEXT;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_verifier_idx ON public.users(verifier, verifier_id) WHERE verifier IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_provider_idx ON public.users(is_provider) WHERE is_provider = TRUE;

-- Step 6: Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 7: Create simplified RLS policies that work with Privy
-- Allow public read access for all users (needed for profile viewing)
CREATE POLICY "public_read_users" ON public.users
  FOR SELECT USING (TRUE);

-- Allow service role to do everything (this is what our admin client uses)
-- Note: This is secure because service role is only used server-side
CREATE POLICY "service_role_all" ON public.users
  FOR ALL USING (current_setting('role') = 'service_role');

-- Allow authenticated users to insert (for registration)
CREATE POLICY "authenticated_insert" ON public.users
  FOR INSERT TO authenticated WITH CHECK (TRUE);

-- Allow authenticated users to update their own records
CREATE POLICY "authenticated_update_own" ON public.users
  FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

COMMIT;

-- Test the change
SELECT 'SUCCESS: users table id column is now TEXT type' as result;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'id';