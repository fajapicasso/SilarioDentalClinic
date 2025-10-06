-- Fix duplicate emergency_c column in profiles table
-- This script removes the duplicate emergency_c column

-- First, let's check which emergency_c column has data (if any)
-- Run this to see which column has data:
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'emergency_c'
ORDER BY ordinal_position;

-- If you need to preserve data from one of the emergency_c columns,
-- you can copy it to a temporary column first:

-- Step 1: Add a temporary column to preserve data (if needed)
-- ALTER TABLE profiles ADD COLUMN emergency_contact_temp VARCHAR;

-- Step 2: Copy data from one of the emergency_c columns (if it has data)
-- UPDATE profiles SET emergency_contact_temp = emergency_c WHERE emergency_c IS NOT NULL;

-- Step 3: Drop the duplicate columns
-- Note: You'll need to drop them one by one since they have the same name
-- This might require using the column position or recreating the table

-- Alternative approach: Recreate the table without the duplicate
-- This is safer if you don't have much data:

-- Step 1: Create a backup of your data
CREATE TABLE profiles_backup AS SELECT * FROM profiles;

-- Step 2: Drop the current profiles table
DROP TABLE profiles;

-- Step 3: Recreate the profiles table without the duplicate column
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    full_name TEXT,
    phone TEXT,
    address TEXT,
    birthday DATE,
    age INTEGER,
    gender TEXT,
    role TEXT,
    allergies TEXT,
    medical_con TEXT,
    medications TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    emergency_c VARCHAR, -- Keep only one emergency_c column
    disabled BOOLEAN DEFAULT FALSE,
    certificate_ui TEXT,
    nickname TEXT,
    nationality TEXT,
    office_no TEXT,
    occupation TEXT,
    first_name TEXT,
    middle_name TEXT,
    last_name TEXT,
    street TEXT,
    barangay TEXT,
    city TEXT,
    province TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- Step 4: Restore data from backup
INSERT INTO profiles 
SELECT 
    id, email, full_name, phone, address, birthday, age, gender, role,
    allergies, medical_con, medications, notes, created_at, updated_at,
    emergency_c, disabled, certificate_ui, nickname, nationality, office_no,
    occupation, first_name, middle_name, last_name, street, barangay, city,
    province, is_active
FROM profiles_backup;

-- Step 5: Verify the fix
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- Step 6: Clean up (optional - keep backup for safety)
-- DROP TABLE profiles_backup;
