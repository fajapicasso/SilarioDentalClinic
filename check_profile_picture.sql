-- Check Profile Picture Status in Database
-- Run these queries in your Supabase SQL Editor

-- 1. Check if profile_picture_url column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'profile_picture_url';

-- 2. Check current profile picture URLs for all users
SELECT id, email, profile_picture_url, updated_at
FROM profiles 
WHERE profile_picture_url IS NOT NULL
ORDER BY updated_at DESC;

-- 3. Check specific user's profile (replace with actual user ID)
-- SELECT id, email, profile_picture_url, updated_at
-- FROM profiles 
-- WHERE id = 'your-user-id-here';

-- 4. Check if there are any profiles without profile_picture_url
SELECT COUNT(*) as profiles_without_picture
FROM profiles 
WHERE profile_picture_url IS NULL;

-- 5. Check total number of profiles
SELECT COUNT(*) as total_profiles
FROM profiles;

-- 6. Update a test profile picture URL (replace with actual user ID)
-- UPDATE profiles 
-- SET profile_picture_url = 'https://example.com/test-image.jpg'
-- WHERE id = 'your-user-id-here';

-- 7. Clear all profile picture URLs (if needed for testing)
-- UPDATE profiles 
-- SET profile_picture_url = NULL; 