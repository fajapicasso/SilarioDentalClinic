-- RESTORE ORIGINAL POLICIES
-- Use this to restore your original policies if something goes wrong

-- 1. First, drop any certificate-related policies we might have added
DROP POLICY IF EXISTS "Users can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Public access to certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can update certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete certificates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update certificates" ON storage.objects;

-- 2. Restore original profiles table policies (based on your screenshots)

-- Drop any policies we might have added
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;

-- Restore the original policies (these are the ones from your screenshots)

-- INSERT: "Admins can create any profile"
CREATE POLICY "Admins can create any profile" ON profiles
FOR INSERT TO public
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- UPDATE: "Admins can update any profile"
CREATE POLICY "Admins can update any profile" ON profiles
FOR UPDATE TO public
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- UPDATE: "Allow all updates" (this was in your screenshot)
CREATE POLICY "Allow all updates" ON profiles
FOR UPDATE TO public
USING (true)
WITH CHECK (true);

-- INSERT: "Allow profile creation during registration"
CREATE POLICY "Allow profile creation during registration" ON profiles
FOR INSERT TO public
WITH CHECK (true);

-- SELECT: "Disabled users can only access their own profiles"
CREATE POLICY "Disabled users can only access their own profiles" ON profiles
FOR SELECT TO public
USING (
    auth.uid() = id OR
    NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND disabled = true
    )
);

-- SELECT: "Profiles are viewable by everyone"
CREATE POLICY "Profiles are viewable by everyone" ON profiles
FOR SELECT TO public
USING (true);

-- INSERT: "Users can create their own profile"
CREATE POLICY "Users can create their own profile" ON profiles
FOR INSERT TO public
WITH CHECK (auth.uid() = id);

-- UPDATE: "Users can update their own profile"
CREATE POLICY "Users can update their own profile" ON profiles
FOR UPDATE TO public
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. Restore original storage policies for certificates (based on your screenshots)

-- INSERT: "Authenticated users can upload certificates"
CREATE POLICY "Authenticated users can upload certificates" ON storage.objects
FOR INSERT TO public
WITH CHECK (
    bucket_id = 'certificates' AND
    auth.role() = 'authenticated'
);

-- UPDATE: "Authenticated users can update certificates"
CREATE POLICY "Authenticated users can update certificates" ON storage.objects
FOR UPDATE TO public
USING (
    bucket_id = 'certificates' AND
    auth.role() = 'authenticated'
);

-- INSERT: "Authenticated users can upload certificates 6j30sc_0" (this was in your screenshot)
CREATE POLICY "Authenticated users can upload certificates 6j30sc_0" ON storage.objects
FOR INSERT TO public
WITH CHECK (
    bucket_id = 'certificates' AND
    auth.role() = 'authenticated'
);

-- 4. Verify the restore
SELECT 
    'RESTORED PROFILES POLICIES' as status,
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY cmd, policyname;

SELECT 
    'RESTORED STORAGE POLICIES' as status,
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage' 
AND policyname LIKE '%certificate%'
ORDER BY policyname; 