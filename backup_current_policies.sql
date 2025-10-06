-- BACKUP CURRENT POLICIES
-- Run this FIRST to backup your existing policies before making any changes

-- 1. Backup current profiles table policies
SELECT 
    'PROFILES TABLE POLICIES - BACKUP' as backup_section,
    schemaname,
    tablename,
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY cmd, policyname;

-- 2. Backup current storage policies for certificates
SELECT 
    'STORAGE CERTIFICATE POLICIES - BACKUP' as backup_section,
    schemaname,
    tablename,
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage' 
AND policyname LIKE '%certificate%'
ORDER BY policyname;

-- 3. Backup all storage policies (in case we need to reference them)
SELECT 
    'ALL STORAGE POLICIES - BACKUP' as backup_section,
    schemaname,
    tablename,
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
ORDER BY policyname;

-- 4. Check current RLS status
SELECT 
    'RLS STATUS - BACKUP' as backup_section,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('profiles', 'objects')
AND schemaname IN ('public', 'storage');

-- 5. Check certificate_url column status
SELECT 
    'CERTIFICATE_URL COLUMN - BACKUP' as backup_section,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'certificate_url';

-- 6. Check if certificates bucket exists
SELECT 
    'CERTIFICATES BUCKET - BACKUP' as backup_section,
    name as bucket_name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets 
WHERE name = 'certificates';

-- 7. Generate restore script (for reference)
SELECT 
    'RESTORE SCRIPT REFERENCE' as backup_section,
    '-- To restore profiles policies, use:' as restore_note,
    '-- DROP POLICY IF EXISTS "' || policyname || '" ON ' || schemaname || '.' || tablename || ';' as drop_statement,
    '-- CREATE POLICY "' || policyname || '" ON ' || schemaname || '.' || tablename || ' FOR ' || cmd || ' USING (' || COALESCE(qual, 'true') || ')' || 
    CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END || ';' as create_statement
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY cmd, policyname; 