-- FINAL CERTIFICATE UPLOAD SQL - COMPLETE SOLUTION
-- Run this in your Supabase SQL Editor to fix all certificate upload issues

-- 1. Ensure certificate_url column exists in profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS certificate_url TEXT DEFAULT NULL;

-- 2. Enable RLS on profiles table if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Drop conflicting storage policies (we'll recreate them properly)
DROP POLICY IF EXISTS "Users can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Public access to certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can update certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete certificates" ON storage.objects;

-- 4. Create comprehensive storage policies for certificates

-- Policy 1: Allow authenticated users to upload certificates
CREATE POLICY "Users can upload certificates" ON storage.objects
FOR INSERT TO public
WITH CHECK (
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

-- 5. Ensure all necessary profiles table policies exist (without conflicts)

-- Policy: Users can view their own profile (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can view their own profile'
    ) THEN
        CREATE POLICY "Users can view their own profile" ON profiles
        FOR SELECT USING (auth.uid() = id);
    END IF;
END $$;

-- Policy: Users can update their own profile (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can update their own profile'
    ) THEN
        CREATE POLICY "Users can update their own profile" ON profiles
        FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
    END IF;
END $$;

-- Policy: Users can create their own profile (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can create their own profile'
    ) THEN
        CREATE POLICY "Users can create their own profile" ON profiles
        FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
END $$;

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

-- 9. Verify the complete setup
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
        WHEN COUNT(*) >= 4 THEN '✅ COMPLETE (' || COUNT(*) || ' policies)' 
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
    END as result
UNION ALL
SELECT 
    'CERTIFICATE SETUP COMPLETE' as status,
    'RLS on profiles table' as check_item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = 'profiles' 
            AND rowsecurity = true
        ) THEN '✅ ENABLED' 
        ELSE '❌ DISABLED' 
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

-- 11. Show current profiles table policies
SELECT 
    'CURRENT PROFILES TABLE POLICIES' as info,
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY cmd, policyname; 