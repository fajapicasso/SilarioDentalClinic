-- Clean Certificate Upload and Storage Policies for Supabase
-- This script handles existing policies and avoids conflicts

-- 1. First, ensure the certificate_url column exists in profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS certificate_url TEXT DEFAULT NULL;

-- 2. Enable RLS on profiles table if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Check and drop ONLY the specific policies we need to recreate (if they exist)
-- We'll be more careful here to avoid conflicts

-- Drop storage policies for certificates (if they exist)
DROP POLICY IF EXISTS "Users can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Public access to certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can update certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete certificates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update certificates" ON storage.objects;

-- 4. Set up storage policies for certificates bucket (only if they don't exist)

-- Policy 1: Allow authenticated users to upload certificates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Users can upload certificates'
    ) THEN
        CREATE POLICY "Users can upload certificates" ON storage.objects
        FOR INSERT WITH CHECK (
            bucket_id = 'certificates' AND
            auth.role() = 'authenticated'
        );
    END IF;
END $$;

-- Policy 2: Allow public access to certificates (for viewing)
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

-- Policy 3: Allow users to update their own certificates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Users can update certificates'
    ) THEN
        CREATE POLICY "Users can update certificates" ON storage.objects
        FOR UPDATE USING (
            bucket_id = 'certificates' AND
            auth.role() = 'authenticated'
        );
    END IF;
END $$;

-- Policy 4: Allow users to delete their own certificates
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

-- 5. For profiles table, we'll check existing policies and only add what's missing
-- We won't drop existing policies to avoid breaking your current setup

-- Check if the basic profile policies exist, if not create them
DO $$
BEGIN
    -- Check if users can view their own profile policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can view their own profile'
    ) THEN
        CREATE POLICY "Users can view their own profile" ON profiles
        FOR SELECT USING (auth.uid() = id);
    END IF;
    
    -- Check if users can update their own profile policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can update their own profile'
    ) THEN
        CREATE POLICY "Users can update their own profile" ON profiles
        FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
    END IF;
    
    -- Check if users can create their own profile policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can create their own profile'
    ) THEN
        CREATE POLICY "Users can create their own profile" ON profiles
        FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
END $$;

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
-- Check if certificate_url column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'certificate_url';

-- Check storage policies for certificates bucket
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname LIKE '%certificate%'
ORDER BY policyname;

-- Check profiles table policies
SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY cmd, policyname; 