-- Debug script to check profiles table structure and identify issues
-- Run this in your Supabase SQL Editor

-- 1. Check current table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- 2. Check for duplicate column names
SELECT 
    column_name,
    COUNT(*) as count
FROM information_schema.columns 
WHERE table_name = 'profiles' 
GROUP BY column_name
HAVING COUNT(*) > 1;

-- 3. Check if the table exists and has data
SELECT COUNT(*) as total_rows FROM profiles;

-- 4. Check RLS policies
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

-- 5. Check table permissions
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'profiles';

-- 6. Try a simple insert to see the exact error
-- This will help identify the specific issue
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
    'test@example.com',
    'Test',
    'User',
    'Test User',
    'patient',
    '1234567890',
    'Test Street',
    'Test Barangay',
    'Test City',
    'Test Province',
    'Test Street, Test Barangay, Test City, Test Province',
    false,
    true
);
