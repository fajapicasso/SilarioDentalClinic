-- Comprehensive fix for certificate storage access issues
-- Run this in your Supabase SQL Editor

-- 1. First, ensure the certificates bucket exists and is public
-- (This should already be done manually in the dashboard)

-- 2. Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Drop any conflicting or duplicate policies
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
FOR SELECT TO public
USING (bucket_id = 'certificates');

-- Policy 3: Allow users to update their own certificates
CREATE POLICY "Users can update certificates" ON storage.objects
FOR UPDATE TO public
USING (
    bucket_id = 'certificates' AND
    auth.role() = 'authenticated'
);

-- Policy 4: Allow users to delete their own certificates
CREATE POLICY "Users can delete certificates" ON storage.objects
FOR DELETE TO public
USING (
    bucket_id = 'certificates' AND
    auth.role() = 'authenticated'
);

-- 5. Ensure the certificate_url column exists in profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS certificate_url TEXT DEFAULT NULL;

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

-- 8. Verify the setup
SELECT 
    'CERTIFICATE STORAGE SETUP COMPLETE' as status,
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
    'CERTIFICATE STORAGE SETUP COMPLETE' as status,
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
    'CERTIFICATE STORAGE SETUP COMPLETE' as status,
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

-- 9. Show current certificate-related storage policies
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