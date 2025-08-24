-- Fix missing INSERT policy for users table
-- This allows authenticated users to create their own profile

-- Add the missing INSERT policy for users
CREATE POLICY "Users can create their own profile" ON users 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);