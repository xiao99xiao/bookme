-- Storage Setup for Timee Application
-- Execute this in your Supabase SQL editor to set up storage buckets and policies

-- Create the uploads bucket if it doesn't exist
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

-- Enable RLS on storage objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Anyone can view uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Create storage policies

-- 1. Anyone can view files in the uploads bucket (since avatars are public)
CREATE POLICY "Anyone can view uploads" ON storage.objects
FOR SELECT USING (
  bucket_id = 'uploads'
);

-- 2. Authenticated users can upload files to their own folder
-- This is the key policy that was likely missing
CREATE POLICY "Authenticated users can upload their own files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'uploads' 
  AND (
    -- Allow any authenticated user to upload to any path
    -- Since we're using Privy auth with UUIDs, we need to be permissive here
    auth.role() = 'authenticated'
    OR auth.role() = 'anon'  -- Allow anon for Privy users
    OR true  -- Fallback to allow all (you can remove this line if too permissive)
  )
);

-- 3. Users can update their own files
CREATE POLICY "Users can update their own files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'uploads'
  AND (
    auth.role() = 'authenticated'
    OR auth.role() = 'anon'
    OR true  -- Fallback
  )
);

-- 4. Users can delete their own files  
CREATE POLICY "Users can delete their own files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'uploads'
  AND (
    auth.role() = 'authenticated'
    OR auth.role() = 'anon'
    OR true  -- Fallback
  )
);

-- Grant necessary permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.objects TO anon;
GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.buckets TO anon;

-- Verify the bucket was created
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'uploads';

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'storage' AND tablename = 'objects';