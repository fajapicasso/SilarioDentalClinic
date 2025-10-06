-- COMPREHENSIVE DATABASE SCHEMA VERIFICATION AND FIX
-- Run this in Supabase SQL Editor to verify and fix the database schema

-- =============================================================================
-- STEP 1: Check if schedule and unavailable_dates columns exist
-- =============================================================================

DO $$ 
BEGIN
    -- Check if schedule column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'schedule'
    ) THEN
        ALTER TABLE profiles ADD COLUMN schedule JSONB DEFAULT NULL;
        RAISE NOTICE '✅ Added schedule column to profiles table';
    ELSE
        RAISE NOTICE '✅ Schedule column already exists in profiles table';
    END IF;

    -- Check if unavailable_dates column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'unavailable_dates'
    ) THEN
        ALTER TABLE profiles ADD COLUMN unavailable_dates JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE '✅ Added unavailable_dates column to profiles table';
    ELSE
        RAISE NOTICE '✅ Unavailable_dates column already exists in profiles table';
    END IF;
END $$;

-- =============================================================================
-- STEP 2: Create staff_schedules table if it doesn't exist
-- =============================================================================

DO $$ 
BEGIN
    -- Check if staff_schedules table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'staff_schedules'
    ) THEN
        CREATE TABLE staff_schedules (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            schedule JSONB DEFAULT NULL,
            unavailable_dates JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(staff_id)
        );
        RAISE NOTICE '✅ Created staff_schedules table';
    ELSE
        RAISE NOTICE '✅ Staff_schedules table already exists';
    END IF;
END $$;

-- =============================================================================
-- STEP 3: Add comments and indexes
-- =============================================================================

-- Add helpful comments
COMMENT ON COLUMN profiles.schedule IS 'Working schedule configuration per branch and day (JSONB format)';
COMMENT ON COLUMN profiles.unavailable_dates IS 'Array of unavailable dates and times (JSONB format)';
COMMENT ON TABLE staff_schedules IS 'Separate schedule table for staff members';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_schedule ON profiles USING GIN (schedule);
CREATE INDEX IF NOT EXISTS idx_profiles_unavailable_dates ON profiles USING GIN (unavailable_dates);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_id ON staff_schedules (staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_schedule ON staff_schedules USING GIN (schedule);

-- =============================================================================
-- STEP 4: Verify the setup by checking current data
-- =============================================================================

-- Check how many doctors exist
SELECT 
    'Total Doctors' as metric,
    COUNT(*) as count
FROM profiles 
WHERE role = 'doctor'

UNION ALL

-- Check how many doctors have schedules
SELECT 
    'Doctors with Schedules' as metric,
    COUNT(*) as count
FROM profiles 
WHERE role = 'doctor' AND schedule IS NOT NULL

UNION ALL

-- Check how many staff exist  
SELECT 
    'Total Staff' as metric,
    COUNT(*) as count
FROM profiles 
WHERE role = 'staff'

UNION ALL

-- Check staff_schedules table
SELECT 
    'Staff Schedule Records' as metric,
    COUNT(*) as count
FROM staff_schedules;

-- =============================================================================
-- STEP 5: Show sample doctor schedules (for debugging)
-- =============================================================================

SELECT 
    full_name,
    role,
    CASE 
        WHEN schedule IS NOT NULL THEN 'Has Schedule'
        ELSE 'No Schedule'
    END as schedule_status,
    CASE 
        WHEN unavailable_dates IS NOT NULL THEN jsonb_array_length(unavailable_dates)
        ELSE 0
    END as unavailable_dates_count
FROM profiles 
WHERE role IN ('doctor', 'staff')
ORDER BY role, full_name;

-- =============================================================================
-- STEP 6: Emergency schedule setup (if needed)
-- =============================================================================

-- Uncomment and modify this section if you need to set up emergency schedules
-- for testing purposes

/*
-- EMERGENCY: Set up default schedule for all doctors who don't have one
UPDATE profiles 
SET schedule = '{
    "cabugao": {
        "monday": {"enabled": true, "start": "08:00", "end": "12:00"},
        "tuesday": {"enabled": true, "start": "08:00", "end": "12:00"},
        "wednesday": {"enabled": true, "start": "08:00", "end": "12:00"},
        "thursday": {"enabled": true, "start": "08:00", "end": "12:00"},
        "friday": {"enabled": true, "start": "08:00", "end": "12:00"},
        "saturday": {"enabled": true, "start": "08:00", "end": "17:00"},
        "sunday": {"enabled": false, "start": "08:00", "end": "17:00"}
    },
    "sanjuan": {
        "monday": {"enabled": true, "start": "13:00", "end": "17:00"},
        "tuesday": {"enabled": true, "start": "13:00", "end": "17:00"},
        "wednesday": {"enabled": true, "start": "13:00", "end": "17:00"},
        "thursday": {"enabled": true, "start": "13:00", "end": "17:00"},
        "friday": {"enabled": true, "start": "13:00", "end": "17:00"},
        "saturday": {"enabled": false, "start": "08:00", "end": "17:00"},
        "sunday": {"enabled": true, "start": "08:00", "end": "17:00"}
    }
}'::jsonb,
updated_at = NOW()
WHERE role = 'doctor' AND schedule IS NULL;
*/

-- Show completion message
SELECT '🎉 Database schema verification and setup completed!' as status;

