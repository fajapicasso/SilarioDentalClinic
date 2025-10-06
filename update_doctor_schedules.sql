-- Update doctor schedules based on traditional clinic hours and set proper working schedules
-- This script will update all existing doctors with realistic working schedules

BEGIN;

-- First, ensure the schedule columns exist
DO $$ 
BEGIN
    -- Add schedule column for storing working hours
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'schedule'
    ) THEN
        ALTER TABLE profiles ADD COLUMN schedule JSONB DEFAULT NULL;
        RAISE NOTICE 'Added schedule column to profiles table';
    ELSE
        RAISE NOTICE 'Schedule column already exists in profiles table';
    END IF;
    
    -- Add unavailable_dates column for storing blocked dates/times
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'unavailable_dates'
    ) THEN
        ALTER TABLE profiles ADD COLUMN unavailable_dates JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added unavailable_dates column to profiles table';
    ELSE
        RAISE NOTICE 'Unavailable_dates column already exists in profiles table';
    END IF;
END $$;

-- Update Dr. Ellaine Mae Silario Saplor (already has proper schedule, just ensure it's current)
UPDATE profiles 
SET 
    schedule = '{
        "cabugao": {
            "monday": {"enabled": true, "start": "08:00", "end": "12:00"},
            "tuesday": {"enabled": true, "start": "08:00", "end": "12:00"},
            "wednesday": {"enabled": false, "start": "08:00", "end": "12:00"},
            "thursday": {"enabled": false, "start": "08:00", "end": "12:00"},
            "friday": {"enabled": true, "start": "08:00", "end": "12:00"},
            "saturday": {"enabled": false, "start": "08:00", "end": "17:00"},
            "sunday": {"enabled": true, "start": "08:00", "end": "17:00"}
        },
        "sanjuan": {
            "monday": {"enabled": true, "start": "13:00", "end": "17:00"},
            "tuesday": {"enabled": true, "start": "13:00", "end": "17:00"},
            "wednesday": {"enabled": false, "start": "13:00", "end": "17:00"},
            "thursday": {"enabled": false, "start": "13:00", "end": "17:00"},
            "friday": {"enabled": true, "start": "13:00", "end": "17:00"},
            "saturday": {"enabled": false, "start": "08:00", "end": "17:00"},
            "sunday": {"enabled": true, "start": "08:00", "end": "17:00"}
        }
    }'::jsonb,
    unavailable_dates = '[]'::jsonb,
    updated_at = NOW()
WHERE id = '7d3453cf-f431-4a15-81f9-433ddbce7554'
AND role = 'doctor';

-- Update Dr. Gian Paul Valoria Vivit (currently has no schedule)
UPDATE profiles 
SET 
    schedule = '{
        "cabugao": {
            "monday": {"enabled": false, "start": "08:00", "end": "12:00"},
            "tuesday": {"enabled": false, "start": "08:00", "end": "12:00"},
            "wednesday": {"enabled": true, "start": "08:00", "end": "12:00"},
            "thursday": {"enabled": true, "start": "08:00", "end": "12:00"},
            "friday": {"enabled": false, "start": "08:00", "end": "12:00"},
            "saturday": {"enabled": true, "start": "08:00", "end": "17:00"},
            "sunday": {"enabled": false, "start": "08:00", "end": "17:00"}
        },
        "sanjuan": {
            "monday": {"enabled": false, "start": "13:00", "end": "17:00"},
            "tuesday": {"enabled": false, "start": "13:00", "end": "17:00"},
            "wednesday": {"enabled": false, "start": "13:00", "end": "17:00"},
            "thursday": {"enabled": false, "start": "13:00", "end": "17:00"},
            "friday": {"enabled": false, "start": "13:00", "end": "17:00"},
            "saturday": {"enabled": false, "start": "08:00", "end": "17:00"},
            "sunday": {"enabled": true, "start": "08:00", "end": "17:00"}
        }
    }'::jsonb,
    unavailable_dates = '[]'::jsonb,
    updated_at = NOW()
WHERE id = '29376ea4-c381-4147-bbb0-b78c4cb812d4'
AND role = 'doctor';

-- Update Staff - Jerome T. Eva
UPDATE profiles 
SET 
    schedule = '{
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
    unavailable_dates = '[]'::jsonb,
    updated_at = NOW()
WHERE id = '231bff52-729d-43f3-8526-89ba28c969e2'
AND role = 'staff';

-- Update additional staff - Jerome T. Eva (second entry)
UPDATE profiles 
SET 
    schedule = '{
        "cabugao": {
            "monday": {"enabled": false, "start": "08:00", "end": "12:00"},
            "tuesday": {"enabled": false, "start": "08:00", "end": "12:00"},
            "wednesday": {"enabled": true, "start": "08:00", "end": "12:00"},
            "thursday": {"enabled": true, "start": "08:00", "end": "12:00"},
            "friday": {"enabled": false, "start": "08:00", "end": "12:00"},
            "saturday": {"enabled": false, "start": "08:00", "end": "17:00"},
            "sunday": {"enabled": false, "start": "08:00", "end": "17:00"}
        },
        "sanjuan": {
            "monday": {"enabled": true, "start": "13:00", "end": "17:00"},
            "tuesday": {"enabled": true, "start": "13:00", "end": "17:00"},
            "wednesday": {"enabled": false, "start": "13:00", "end": "17:00"},
            "thursday": {"enabled": false, "start": "13:00", "end": "17:00"},
            "friday": {"enabled": true, "start": "13:00", "end": "17:00"},
            "saturday": {"enabled": false, "start": "08:00", "end": "17:00"},
            "sunday": {"enabled": false, "start": "08:00", "end": "17:00"}
        }
    }'::jsonb,
    unavailable_dates = '[]'::jsonb,
    updated_at = NOW()
WHERE id = '8ae7fc23-8cb6-4f93-89a6-9fef6c6fae30'
AND role = 'staff';

-- Create staff_schedules table if it doesn't exist
DO $$
BEGIN
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
        
        -- Enable RLS on staff_schedules table
        ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE 'Created staff_schedules table';
    ELSE
        RAISE NOTICE 'staff_schedules table already exists';
    END IF;
END $$;

-- Insert staff schedules into staff_schedules table
INSERT INTO staff_schedules (staff_id, schedule, unavailable_dates, created_at, updated_at)
SELECT 
    id,
    schedule,
    unavailable_dates,
    NOW(),
    NOW()
FROM profiles 
WHERE role = 'staff' 
AND schedule IS NOT NULL
ON CONFLICT (staff_id) DO UPDATE SET
    schedule = EXCLUDED.schedule,
    unavailable_dates = EXCLUDED.unavailable_dates,
    updated_at = NOW();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_id ON staff_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_profiles_schedule ON profiles USING GIN(schedule) WHERE schedule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_unavailable_dates ON profiles USING GIN(unavailable_dates) WHERE unavailable_dates IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_schedules_schedule ON staff_schedules USING GIN(schedule) WHERE schedule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_schedules_unavailable_dates ON staff_schedules USING GIN(unavailable_dates) WHERE unavailable_dates IS NOT NULL;

-- Verify the updates
DO $$
DECLARE
    doctor_count INTEGER;
    staff_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO doctor_count FROM profiles WHERE role = 'doctor' AND schedule IS NOT NULL;
    SELECT COUNT(*) INTO staff_count FROM profiles WHERE role = 'staff' AND schedule IS NOT NULL;
    
    RAISE NOTICE '=== SCHEDULE UPDATE COMPLETE ===';
    RAISE NOTICE 'Updated % doctors with schedules', doctor_count;
    RAISE NOTICE 'Updated % staff with schedules', staff_count;
    RAISE NOTICE 'Doctors and staff can now customize their schedules in Settings';
    RAISE NOTICE 'Appointment booking will now only show available time slots based on actual working hours';
END $$;

COMMIT;
