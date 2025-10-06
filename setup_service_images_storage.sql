-- Setup Service Images Storage Bucket
-- Run this in your Supabase SQL editor

-- Create the storage bucket for service images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-images',
  'service-images',
  true,
  2097152, -- 2MB limit
  ARRAY['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp']
);

-- Set up RLS policies for the service-images bucket
CREATE POLICY "Public Access to Service Images" ON storage.objects
  FOR SELECT USING (bucket_id = 'service-images');

CREATE POLICY "Authenticated Users Can Upload Service Images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'service-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated Users Can Update Service Images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'service-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated Users Can Delete Service Images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'service-images' 
    AND auth.role() = 'authenticated'
  );

-- Note: Make sure your services table has an image_url column
-- If not, you can add it with:
-- ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT;

