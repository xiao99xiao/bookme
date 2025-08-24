-- Fix foreign key constraint issue step by step
-- This removes the auth.users foreign key constraint to work with Privy

-- Step 1: Remove the foreign key constraint only (keep column as UUID for now)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Test if we can now insert with a UUID that doesn't exist in auth.users
SELECT 'Foreign key constraint removed successfully' as result;