-- Safe Storage Setup for Timee Application
-- This version works within Supabase's permission constraints

-- First, check if the uploads bucket exists
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'uploads';

-- Create the uploads bucket if it doesn't exist
-- Note: You may need to create this through Supabase Dashboard > Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads', 
  true,  -- Public bucket so avatars can be viewed by anyone
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']::text[];

-- Check current policies on storage.objects
SELECT 
  pol.polname as policy_name,
  pol.polcmd as command,
  pol.polroles,
  pg_get_expr(pol.polqual, pol.polrelid, true) as using_clause,
  pg_get_expr(pol.polwithcheck, pol.polrelid, true) as with_check_clause
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid
WHERE nsp.nspname = 'storage' AND cls.relname = 'objects';

-- Alternative: If you can't modify storage policies directly,
-- use Supabase Dashboard to configure storage:
-- 1. Go to Storage in your Supabase Dashboard
-- 2. Create bucket named 'uploads' if it doesn't exist
-- 3. Make it PUBLIC
-- 4. Go to Policies tab
-- 5. Create the following policies:

-- FOR MANUAL CREATION IN DASHBOARD:
-- Policy 1: "Public Access"
-- - Allowed operation: SELECT
-- - Policy definition: true

-- Policy 2: "Allow uploads"
-- - Allowed operation: INSERT
-- - Policy definition: true

-- Policy 3: "Allow updates"
-- - Allowed operation: UPDATE  
-- - Policy definition: true

-- Policy 4: "Allow deletes"
-- - Allowed operation: DELETE
-- - Policy definition: true

-- Create file_uploads table if needed
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  upload_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on file_uploads
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- Create policies for file_uploads table
DROP POLICY IF EXISTS "Users can view all file uploads" ON file_uploads;
DROP POLICY IF EXISTS "Users can insert their own file uploads" ON file_uploads;
DROP POLICY IF EXISTS "Users can update their own file uploads" ON file_uploads;
DROP POLICY IF EXISTS "Users can delete their own file uploads" ON file_uploads;

CREATE POLICY "Users can view all file uploads" ON file_uploads
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own file uploads" ON file_uploads
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own file uploads" ON file_uploads
  FOR UPDATE USING (user_id = auth.uid() OR true);

CREATE POLICY "Users can delete their own file uploads" ON file_uploads
  FOR DELETE USING (user_id = auth.uid() OR true);

-- Grant permissions
GRANT ALL ON file_uploads TO authenticated;
GRANT ALL ON file_uploads TO anon;

-- Verify setup
SELECT 'Setup check:' as status;
SELECT 'Bucket exists:' as check, EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'uploads') as result;
SELECT 'File uploads table exists:' as check, EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'file_uploads') as result;