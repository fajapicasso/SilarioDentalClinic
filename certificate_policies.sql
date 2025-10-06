-- Certificate Upload and Storage Policies for Supabase
-- Run these commands in your Supabase SQL Editor

-- 1. First, ensure the certificate_url column exists in profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS certificate_url TEXT DEFAULT NULL;

-- 2. Create certificates bucket (if not exists)
-- Note: This is done through the Supabase dashboard Storage section
-- Go to Storage > Create bucket > Name: certificates > Public bucket: Yes

-- 3. Set up storage policies for certificates bucket

-- Policy 1: Allow authenticated users to upload certificates
CREATE POLICY "Users can upload certificates" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'certificates' AND
  auth.role() = 'authenticated'
);

-- Policy 2: Allow public access to certificates (for viewing)
CREATE POLICY "Public access to certificates" ON storage.objects
FOR SELECT USING (bucket_id = 'certificates');

-- Policy 3: Allow users to update their own certificates
CREATE POLICY "Users can update certificates" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'certificates' AND
  auth.role() = 'authenticated'
);

-- Policy 4: Allow users to delete their own certificates
CREATE POLICY "Users can delete certificates" ON storage.objects
FOR DELETE USING (
  bucket_id = 'certificates' AND
  auth.role() = 'authenticated'
);

-- 4. Set up RLS policies for profiles table (certificate_url updates)

-- Policy 1: Allow users to update their own profile (including certificate_url)
CREATE POLICY "Users can update their own profile" ON profiles
FOR UPDATE USING (
  auth.uid() = id
) WITH CHECK (
  auth.uid() = id
);

-- Policy 2: Allow users to select their own profile
CREATE POLICY "Users can view their own profile" ON profiles
FOR SELECT USING (
  auth.uid() = id
);

-- Policy 3: Allow users to insert their own profile (for registration)
CREATE POLICY "Users can create their own profile" ON profiles
FOR INSERT WITH CHECK (
  auth.uid() = id
);

-- 5. Create a function to update certificate URL
CREATE OR REPLACE FUNCTION update_certificate_url(
  user_id UUID,
  certificate_url TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles 
  SET 
    certificate_url = certificate_url,
    updated_at = NOW()
  WHERE id = user_id;
  
  RETURN FOUND;
END;
$$;

-- 6. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION update_certificate_url(UUID, TEXT) TO authenticated;

-- 7. Create a function to remove certificate URL
CREATE OR REPLACE FUNCTION remove_certificate_url(
  user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles 
  SET 
    certificate_url = NULL,
    updated_at = NOW()
  WHERE id = user_id;
  
  RETURN FOUND;
END;
$$;

-- 8. Grant execute permission on the remove function
GRANT EXECUTE ON FUNCTION remove_certificate_url(UUID) TO authenticated;

-- 9. Verify the setup
-- Check if certificate_url column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'certificate_url';

-- Check storage policies for certificates bucket
SELECT * FROM storage.policies WHERE bucket_id = 'certificates';

-- Check profiles table policies
SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY cmd, policyname; 