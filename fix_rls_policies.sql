-- Fix RLS policies for profiles table
-- This script ensures proper permissions for user creation

-- 1. First, let's see what RLS policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- 2. Enable RLS on profiles table (if not already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies that might be blocking inserts
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON profiles;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON profiles;

-- 4. Create proper RLS policies for profiles table

-- Policy for users to view their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Policy for users to update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Policy for users to insert their own profile (for registration)
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy for service role to manage all profiles (for admin operations)
CREATE POLICY "Service role can manage all profiles" ON profiles
    FOR ALL USING (auth.role() = 'service_role');

-- Policy for authenticated users to read all profiles (for admin panel)
CREATE POLICY "Authenticated users can read all profiles" ON profiles
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for authenticated users to insert profiles (for admin user creation)
CREATE POLICY "Authenticated users can insert profiles" ON profiles
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy for authenticated users to update profiles (for admin user editing)
CREATE POLICY "Authenticated users can update profiles" ON profiles
    FOR UPDATE USING (auth.role() = 'authenticated');

-- 5. Grant necessary permissions
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- 6. Test the policies
-- This should work now
INSERT INTO profiles (
    id,
    email,
    first_name,
    last_name,
    full_name,
    role,
    phone,
    street,
    barangay,
    city,
    province,
    address,
    disabled,
    is_active
) VALUES (
    gen_random_uuid(),
    'test2@example.com',
    'Test2',
    'User2',
    'Test2 User2',
    'patient',
    '1234567891',
    'Test Street 2',
    'Test Barangay 2',
    'Test City 2',
    'Test Province 2',
    'Test Street 2, Test Barangay 2, Test City 2, Test Province 2',
    false,
    true
);
