-- Simple test to verify certificate upload setup
-- Run this to check if everything is configured correctly

-- 1. Check if certificates bucket exists and is public
SELECT 
    'CERTIFICATES BUCKET' as test_name,
    name as bucket_name,
    public,
    CASE 
        WHEN name = 'certificates' AND public = true THEN '✅ READY FOR UPLOADS' 
        WHEN name = 'certificates' AND public = false THEN '⚠️ EXISTS BUT NOT PUBLIC' 
        ELSE '❌ NOT FOUND' 
    END as status
FROM storage.buckets 
WHERE name = 'certificates';

-- 2. Check storage policies for certificates
SELECT 
    'STORAGE POLICIES' as test_name,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) >= 4 THEN '✅ ALL POLICIES PRESENT' 
        ELSE '⚠️ MISSING POLICIES' 
    END as status
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage' 
AND policyname LIKE '%certificate%';

-- 3. Check certificate_url column in profiles table
SELECT 
    'PROFILES TABLE' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'profiles' AND column_name = 'certificate_url'
        ) THEN '✅ CERTIFICATE_URL COLUMN EXISTS' 
        ELSE '❌ CERTIFICATE_URL COLUMN MISSING' 
    END as status;

-- 4. Check if we can access storage.objects (this tests permissions)
SELECT 
    'STORAGE ACCESS' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM storage.objects LIMIT 1
        ) THEN '✅ CAN ACCESS STORAGE' 
        ELSE '❌ CANNOT ACCESS STORAGE' 
    END as status;

-- 5. Summary
SELECT 
    'UPLOAD READINESS' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM storage.buckets WHERE name = 'certificates' AND public = true
        ) 
        AND EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'objects' 
            AND schemaname = 'storage' 
            AND policyname LIKE '%certificate%'
        )
        AND EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'profiles' AND column_name = 'certificate_url'
        )
        THEN '✅ READY FOR CERTIFICATE UPLOADS' 
        ELSE '⚠️ NOT FULLY CONFIGURED' 
    END as status; 