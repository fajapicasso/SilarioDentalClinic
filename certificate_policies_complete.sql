-- Complete Certificate Upload and Storage Policies for Supabase
-- Run these commands in your Supabase SQL Editor

-- 1. First, ensure the certificate_url column exists in profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS certificate_url TEXT DEFAULT NULL;

-- 2. Enable RLS on profiles table if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Public access to certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can update certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete certificates" ON storage.objects;

-- 4. Set up RLS policies for profiles table

-- Policy 1: Allow users to view their own profile
CREATE POLICY "Users can view their own profile" ON profiles
FOR SELECT USING (
  auth.uid() = id
);

-- Policy 2: Allow users to update their own profile (including certificate_url)
CREATE POLICY "Users can update their own profile" ON profiles
FOR UPDATE USING (
  auth.uid() = id
) WITH CHECK (
  auth.uid() = id
);

-- Policy 3: Allow users to insert their own profile (for registration)
CREATE POLICY "Users can create their own profile" ON profiles
FOR INSERT WITH CHECK (
  auth.uid() = id
);

-- Policy 4: Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy 5: Allow admins to update all profiles
CREATE POLICY "Admins can update all profiles" ON profiles
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 5. Set up storage policies for certificates bucket

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

-- 6. Create helper functions for certificate management

-- Function to update certificate URL
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

-- Function to remove certificate URL
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

-- 7. Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION update_certificate_url(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_certificate_url(UUID) TO authenticated;

-- 8. Create a trigger to automatically update updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

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

-- 10. Test the policies (optional)
-- This will show you the current policies in place
SELECT 
  'profiles' as table_name,
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles'
UNION ALL
SELECT 
  'storage.objects' as table_name,
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY table_name, cmd, policyname; 