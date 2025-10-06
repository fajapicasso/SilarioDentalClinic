-- Test script to verify certificates bucket access
-- Run this in your Supabase SQL Editor

-- 1. Check if certificates bucket exists and is public
SELECT 
    'CERTIFICATES BUCKET STATUS' as test_name,
    name as bucket_name,
    public,
    file_size_limit,
    allowed_mime_types,
    CASE 
        WHEN name = 'certificates' THEN '✅ EXISTS' 
        ELSE '❌ NOT FOUND' 
    END as status
FROM storage.buckets 
WHERE name = 'certificates';

-- 2. Check storage policies for certificates
SELECT 
    'CERTIFICATES STORAGE POLICIES' as test_name,
    policyname,
    cmd,
    permissive,
    roles,
    CASE 
        WHEN policyname LIKE '%certificate%' THEN '✅ CERTIFICATE POLICY' 
        ELSE '⚠️ OTHER POLICY' 
    END as policy_type
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage' 
AND policyname LIKE '%certificate%'
ORDER BY policyname;

-- 3. Check if storage.objects table has RLS enabled
SELECT 
    'STORAGE.OBJECTS RLS STATUS' as test_name,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ ENABLED' 
        ELSE '❌ DISABLED' 
    END as status
FROM pg_tables 
WHERE tablename = 'objects' 
AND schemaname = 'storage';

-- 4. Test if we can access the certificates bucket (this will show any permission issues)
SELECT 
    'STORAGE ACCESS TEST' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM storage.buckets WHERE name = 'certificates'
        ) THEN '✅ BUCKET ACCESSIBLE' 
        ELSE '❌ BUCKET NOT ACCESSIBLE' 
    END as bucket_access,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM storage.objects WHERE bucket_id = 'certificates' LIMIT 1
        ) THEN '✅ OBJECTS ACCESSIBLE' 
        ELSE '⚠️ NO OBJECTS OR ACCESS DENIED' 
    END as objects_access;

-- 5. Check if there are any existing objects in the certificates bucket
SELECT 
    'EXISTING CERTIFICATE OBJECTS' as test_name,
    COUNT(*) as object_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ OBJECTS EXIST' 
        ELSE '⚠️ NO OBJECTS YET' 
    END as status
FROM storage.objects 
WHERE bucket_id = 'certificates'; 