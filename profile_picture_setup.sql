-- Profile Picture Setup SQL Commands for Supabase
-- Run these commands in your Supabase SQL Editor

-- 1. Add profile_picture_url column to profiles table (if not exists)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT DEFAULT NULL;

-- 2. Create profile-pictures bucket (if not exists)
-- Note: This is done through the Supabase dashboard Storage section
-- Go to Storage > Create bucket > Name: profile-pictures > Public bucket: Yes

-- 3. Set up storage policies for profile pictures bucket
-- Policy 1: Allow authenticated users to upload profile pictures
CREATE POLICY "Users can upload profile pictures" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profile-pictures' AND
  auth.role() = 'authenticated'
);

-- Policy 2: Allow public access to profile pictures (for viewing)
CREATE POLICY "Public access to profile pictures" ON storage.objects
FOR SELECT USING (bucket_id = 'profile-pictures');

-- Policy 3: Allow users to update their own profile pictures
CREATE POLICY "Users can update profile pictures" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profile-pictures' AND
  auth.role() = 'authenticated'
);

-- Policy 4: Allow users to delete their own profile pictures
CREATE POLICY "Users can delete profile pictures" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profile-pictures' AND
  auth.role() = 'authenticated'
);

-- 4. Update existing profiles to have a default profile picture URL (optional)
-- UPDATE profiles 
-- SET profile_picture_url = NULL 
-- WHERE profile_picture_url IS NULL;

-- 5. Create a function to update profile picture URL
CREATE OR REPLACE FUNCTION update_profile_picture_url(
  user_id UUID,
  picture_url TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles 
  SET 
    profile_picture_url = picture_url,
    updated_at = NOW()
  WHERE id = user_id;
  
  RETURN FOUND;
END;
$$;

-- 6. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION update_profile_picture_url(UUID, TEXT) TO authenticated;

-- 7. Create a trigger to automatically update updated_at timestamp
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

-- 8. Verify the setup
-- Check if profile_picture_url column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'profile_picture_url';

-- Check storage policies
SELECT * FROM storage.policies WHERE bucket_id = 'profile-pictures'; 