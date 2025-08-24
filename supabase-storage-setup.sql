-- Supabase Storage Setup for BookMe Application

-- IMPORTANT: First create the storage bucket via Supabase Dashboard
-- Go to Storage > Create bucket > Name: "uploads" > Public: true

-- Storage policies for the uploads bucket
-- These use the CREATE POLICY syntax, not INSERT INTO storage.policies

-- Policy to allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload to own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy to allow users to view their own files
CREATE POLICY "Users can view own files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy to allow users to update their own files
CREATE POLICY "Users can update own files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy to allow users to delete their own files
CREATE POLICY "Users can delete own files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'uploads' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy to allow public read access to all files in uploads bucket
CREATE POLICY "Public can view uploaded files" ON storage.objects
FOR SELECT USING (bucket_id = 'uploads');