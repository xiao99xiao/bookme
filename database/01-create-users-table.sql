-- Create users table for Web3Auth integration
-- This replaces the auth.users dependency with a custom users table

CREATE TABLE IF NOT EXISTS public.users (
  -- Web3Auth user ID (primary key)
  id TEXT PRIMARY KEY,
  
  -- Basic user information from Web3Auth
  email TEXT,
  name TEXT,
  profile_image TEXT,
  
  -- Auth provider information
  verifier TEXT, -- 'google', 'github', 'email_passwordless', etc.
  verifier_id TEXT, -- The ID from the auth provider
  
  -- Application-specific fields
  display_name TEXT,
  bio TEXT,
  location TEXT,
  avatar TEXT, -- Custom avatar (overrides profile_image)
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

-- RLS Policies
-- Users can read their own data
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (id = current_setting('app.current_user_id', TRUE));

-- Users can update their own data  
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = current_setting('app.current_user_id', TRUE));

-- Users can insert their own data (for registration)
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (id = current_setting('app.current_user_id', TRUE));

-- Public read access for profile viewing (providers, etc.)
CREATE POLICY "users_public_read" ON public.users
  FOR SELECT USING (TRUE);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;