-- SIMPLE CERTIFICATE UPLOAD FIX
-- Run this in your Supabase SQL Editor

-- 1. Ensure certificate_url column exists
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS certificate_url TEXT DEFAULT NULL;

-- 2. Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create simple storage policies for certificates (drop existing ones first)
DROP POLICY IF EXISTS "Users can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Public access to certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can update certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete certificates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update certificates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload certificates 6j30sc_0" ON storage.objects;

-- 4. Create simple, permissive storage policies
CREATE POLICY "Users can upload certificates" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'certificates');

CREATE POLICY "Public access to certificates" ON storage.objects
FOR SELECT USING (bucket_id = 'certificates');

CREATE POLICY "Users can update certificates" ON storage.objects
FOR UPDATE USING (bucket_id = 'certificates');

CREATE POLICY "Users can delete certificates" ON storage.objects
FOR DELETE USING (bucket_id = 'certificates');

-- 5. Create helper functions
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

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION update_certificate_url(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_certificate_url(UUID) TO authenticated;

-- 7. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Verify setup
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
    END as result;

-- 9. Show current storage policies
SELECT 
    'CURRENT STORAGE POLICIES' as info,
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage' 
AND policyname LIKE '%certificate%'
ORDER BY policyname; 