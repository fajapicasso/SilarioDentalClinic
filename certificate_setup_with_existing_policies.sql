-- CERTIFICATE SETUP WITH EXISTING POLICIES
-- This script works with your current policies and only adds what's missing

-- 1. First, backup current state (run this first to see what you have)
-- SELECT * FROM pg_policies WHERE tablename = 'profiles' ORDER BY cmd, policyname;
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' ORDER BY policyname;

-- 2. Ensure certificate_url column exists
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS certificate_url TEXT DEFAULT NULL;

-- 3. Enable RLS on profiles table if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Add missing storage policies for certificates (only if they don't exist)

-- Policy 1: Allow public access to certificates (for viewing) - ONLY if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public access to certificates'
    ) THEN
        CREATE POLICY "Public access to certificates" ON storage.objects
        FOR SELECT USING (bucket_id = 'certificates');
    END IF;
END $$;

-- Policy 2: Allow users to delete their own certificates - ONLY if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Users can delete certificates'
    ) THEN
        CREATE POLICY "Users can delete certificates" ON storage.objects
        FOR DELETE USING (
            bucket_id = 'certificates' AND
            auth.role() = 'authenticated'
        );
    END IF;
END $$;

-- 5. Check if we need to add any missing profiles policies
-- Based on your screenshots, you already have:
-- - "Users can update their own profile" ✅
-- - "Admins can update any profile" ✅
-- - "Allow all updates" ✅
-- - "Profiles are viewable by everyone" ✅

-- 6. Create helper functions for certificate management (if they don't exist)

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
SELECT 
    'CERTIFICATE SETUP COMPLETE' as status,
    'certificate_url column' as check_item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'profiles' AND column_name = 'certificate_url'
        ) THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as result
UNION ALL
SELECT 
    'CERTIFICATE SETUP COMPLETE' as status,
    'Storage policies for certificates' as check_item,
    CASE 
        WHEN COUNT(*) >= 3 THEN '✅ COMPLETE (' || COUNT(*) || ' policies)' 
        ELSE '⚠️ INCOMPLETE (' || COUNT(*) || ' policies)' 
    END as result
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage' 
AND policyname LIKE '%certificate%'
UNION ALL
SELECT 
    'CERTIFICATE SETUP COMPLETE' as status,
    'Helper functions' as check_item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'update_certificate_url'
        ) AND EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'remove_certificate_url'
        ) THEN '✅ BOTH EXIST' 
        ELSE '⚠️ MISSING FUNCTIONS' 
    END as result;

-- 10. Show current certificate-related storage policies
SELECT 
    'CURRENT CERTIFICATE STORAGE POLICIES' as info,
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage' 
AND policyname LIKE '%certificate%'
ORDER BY policyname; 