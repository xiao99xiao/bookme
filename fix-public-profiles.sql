-- Fix Public Profile Access
-- This ensures profiles can be viewed publicly without authentication

-- First, let's see what policies exist
-- You can run this in your Supabase SQL Editor to check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'users';

-- Drop any restrictive policies that might be blocking access
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON users;
DROP POLICY IF EXISTS "Public profiles are viewable" ON users;
DROP POLICY IF EXISTS "Anyone can view user profiles" ON users;

-- Create a simple, unrestricted SELECT policy for profiles
CREATE POLICY "Public profile access" ON users 
  FOR SELECT 
  USING (true);

-- Also ensure services are publicly viewable
DROP POLICY IF EXISTS "Anyone can view active services" ON services;
CREATE POLICY "Public service access" ON services 
  FOR SELECT 
  USING (is_active = true);

-- Make sure RLS is enabled but not blocking public reads
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;