-- Verification script for certificate setup
-- Run this to check the current state of your certificate policies

-- 1. Check if certificate_url column exists
SELECT 
    'certificate_url column' as check_item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'profiles' AND column_name = 'certificate_url'
        ) THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as status;

-- 2. Check RLS status on profiles table
SELECT 
    'RLS on profiles table' as check_item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = 'profiles' AND rowsecurity = true
        ) THEN '✅ ENABLED' 
        ELSE '❌ DISABLED' 
    END as status;

-- 3. Check storage policies for certificates
SELECT 
    'Storage policies for certificates' as check_item,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) >= 4 THEN '✅ COMPLETE' 
        ELSE '⚠️ INCOMPLETE' 
    END as status
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage' 
AND policyname LIKE '%certificate%';

-- 4. List all certificate-related storage policies
SELECT 
    'Certificate storage policies:' as info,
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage' 
AND policyname LIKE '%certificate%'
ORDER BY policyname;

-- 5. Check profiles table policies
SELECT 
    'Profiles table policies:' as info,
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY cmd, policyname;

-- 6. Check if certificates bucket exists (if you have access)
-- Note: This might not work if you don't have storage access
SELECT 
    'Certificates bucket check' as check_item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM storage.buckets WHERE name = 'certificates'
        ) THEN '✅ EXISTS' 
        ELSE '❌ MISSING - Create manually in Supabase Dashboard' 
    END as status;

-- 7. Check helper functions
SELECT 
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
    END as status;

-- 8. Summary
SELECT 
    'SETUP SUMMARY' as summary,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'profiles' AND column_name = 'certificate_url'
        ) 
        AND EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = 'profiles' AND rowsecurity = true
        )
        AND EXISTS (
            SELECT 1 FROM storage.buckets WHERE name = 'certificates'
        )
        THEN '✅ READY FOR USE' 
        ELSE '⚠️ NEEDS SETUP' 
    END as overall_status; 