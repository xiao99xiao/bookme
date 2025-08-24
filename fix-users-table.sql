-- Fix users table to handle Privy DID format
-- This script will alter the existing users table or recreate it if needed

-- First, let's check if we can alter the existing table
-- If the table has data, we need to be careful about the migration

-- Option 1: Try to alter the column type (this will work if there's no data or if all existing IDs are compatible)
BEGIN;

-- Temporarily disable RLS during migration
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Drop existing constraints that might reference the id column
DROP INDEX IF EXISTS users_email_idx;
DROP INDEX IF EXISTS users_verifier_idx; 
DROP INDEX IF EXISTS users_provider_idx;

-- Alter the column type from UUID to TEXT
ALTER TABLE public.users ALTER COLUMN id TYPE TEXT;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_verifier_idx ON public.users(verifier, verifier_id);
CREATE INDEX IF NOT EXISTS users_provider_idx ON public.users(is_provider) WHERE is_provider = TRUE;

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

COMMIT;

-- If the above fails, we might need to recreate the table
-- Uncomment the following if the ALTER fails:

/*
-- Option 2: Recreate the table (only if Option 1 fails)
BEGIN;

-- Backup existing data if any
CREATE TABLE users_backup AS SELECT * FROM public.users;

-- Drop the existing table
DROP TABLE IF EXISTS public.users CASCADE;

-- Create new table with correct schema
CREATE TABLE public.users (
  -- Privy user ID (primary key) - now explicitly TEXT
  id TEXT PRIMARY KEY,
  
  -- Basic user information
  email TEXT,
  name TEXT,
  profile_image TEXT,
  
  -- Auth provider information  
  verifier TEXT,
  verifier_id TEXT,
  
  -- Application-specific fields
  display_name TEXT,
  bio TEXT,
  location TEXT,
  avatar TEXT,
  phone TEXT,
  
  -- Service provider fields
  is_provider BOOLEAN DEFAULT FALSE,
  provider_verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Stats and metrics
  is_verified BOOLEAN DEFAULT FALSE,
  rating DECIMAL(3,2) DEFAULT 0.00,
  review_count INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  total_spent DECIMAL(10,2) DEFAULT 0.00,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON public.users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_verifier_idx ON public.users(verifier, verifier_id);
CREATE INDEX IF NOT EXISTS users_provider_idx ON public.users(is_provider) WHERE is_provider = TRUE;

-- Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies - simplified for Privy integration
-- Allow public read access for profile viewing
CREATE POLICY "users_public_read" ON public.users
  FOR SELECT USING (TRUE);

-- Allow all operations for service role (our admin client will use this)
-- In production, you might want more restrictive policies

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

COMMIT;
*/