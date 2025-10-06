-- Enhanced Calendar-Based Schedule System Setup
-- This script supports both weekly recurring schedules and specific date overrides

BEGIN;

-- Ensure the schedule columns exist with enhanced structure
DO $$ 
BEGIN
    -- Add schedule column for storing working hours (supports both weekly and specific dates)
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

-- Create enhanced staff_schedules table
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
        
        -- Enable RLS
        ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE 'Created staff_schedules table';
    ELSE
        RAISE NOTICE 'staff_schedules table already exists';
    END IF;
END $$;

-- Update Dr. Ellaine Mae Silario Saplor with enhanced schedule structure
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

-- Update Dr. Gian Paul Valoria Vivit
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
            "friday": {"enabled": true, "start": "13:00", "end": "17:00"},
            "saturday": {"enabled": false, "start": "08:00", "end": "17:00"},
            "sunday": {"enabled": true, "start": "08:00", "end": "17:00"}
        }
    }'::jsonb,
    unavailable_dates = '[]'::jsonb,
    updated_at = NOW()
WHERE id = '29376ea4-c381-4147-bbb0-b78c4cb812d4'
AND role = 'doctor';

-- Update Staff schedules with San Juan Friday coverage
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
WHERE id IN ('231bff52-729d-43f3-8526-89ba28c969e2', '8ae7fc23-8cb6-4f93-89a6-9fef6c6fae30')
AND role = 'staff';

-- Add some example specific date schedules (calendar-based overrides)
-- Example: Dr. Ellaine working extended hours on a specific Friday at San Juan
UPDATE profiles 
SET 
    schedule = schedule || '{
        "2025-09-12_sanjuan": {
            "date": "2025-09-12",
            "branch": "sanjuan", 
            "timeSlots": [
                {
                    "id": "custom_1",
                    "startTime": "13:00",
                    "endTime": "17:00",
                    "isAvailable": true
                },
                {
                    "id": "custom_2", 
                    "startTime": "18:00",
                    "endTime": "20:00",
                    "isAvailable": true
                }
            ]
        }
    }'::jsonb
WHERE id = '7d3453cf-f431-4a15-81f9-433ddbce7554'
AND role = 'doctor';

-- Add extended Friday coverage for Dr. Gian Paul at San Juan
UPDATE profiles 
SET 
    schedule = schedule || '{
        "2025-09-12_sanjuan": {
            "date": "2025-09-12",
            "branch": "sanjuan",
            "timeSlots": [
                {
                    "id": "custom_3",
                    "startTime": "09:00", 
                    "endTime": "13:00",
                    "isAvailable": true
                }
            ]
        }
    }'::jsonb
WHERE id = '29376ea4-c381-4147-bbb0-b78c4cb812d4'
AND role = 'doctor';

-- Sync staff schedules to staff_schedules table
INSERT INTO staff_schedules (staff_id, schedule, unavailable_dates, created_at, updated_at)
SELECT 
    id,
    schedule,
    COALESCE(unavailable_dates, '[]'::jsonb),
    NOW(),
    NOW()
FROM profiles 
WHERE role = 'staff' 
AND schedule IS NOT NULL
ON CONFLICT (staff_id) DO UPDATE SET
    schedule = EXCLUDED.schedule,
    unavailable_dates = EXCLUDED.unavailable_dates,
    updated_at = NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_schedule_gin ON profiles USING GIN(schedule) WHERE schedule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_unavailable_dates_gin ON profiles USING GIN(unavailable_dates) WHERE unavailable_dates IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_id ON staff_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_schedule_gin ON staff_schedules USING GIN(schedule) WHERE schedule IS NOT NULL;

-- Add helpful functions for calendar-based scheduling
CREATE OR REPLACE FUNCTION get_provider_availability_for_date(
    provider_id UUID,
    check_date DATE,
    branch_name TEXT
) RETURNS TABLE (
    time_slot_start TIME,
    time_slot_end TIME,
    is_available BOOLEAN
) AS $$
DECLARE
    schedule_data JSONB;
    day_of_week TEXT;
    branch_key TEXT;
    specific_date_key TEXT;
BEGIN
    -- Get the provider's schedule
    SELECT schedule INTO schedule_data 
    FROM profiles 
    WHERE id = provider_id;
    
    -- Return empty if no schedule
    IF schedule_data IS NULL THEN
        RETURN;
    END IF;
    
    -- Prepare variables
    day_of_week := lower(to_char(check_date, 'Day'));
    day_of_week := trim(day_of_week);
    branch_key := lower(branch_name);
    specific_date_key := check_date::TEXT || '_' || branch_key;
    
    -- Check for specific date override first
    IF schedule_data ? specific_date_key THEN
        -- Return custom time slots for this specific date
        SELECT 
            (slot->>'startTime')::TIME,
            (slot->>'endTime')::TIME,
            (slot->>'isAvailable')::BOOLEAN
        FROM jsonb_array_elements(schedule_data->specific_date_key->'timeSlots') AS slot
        WHERE (slot->>'isAvailable')::BOOLEAN = true;
        
        RETURN QUERY
        SELECT 
            (slot->>'startTime')::TIME,
            (slot->>'endTime')::TIME,
            (slot->>'isAvailable')::BOOLEAN
        FROM jsonb_array_elements(schedule_data->specific_date_key->'timeSlots') AS slot
        WHERE (slot->>'isAvailable')::BOOLEAN = true;
    ELSE
        -- Fall back to regular weekly schedule
        IF schedule_data ? branch_key 
           AND schedule_data->branch_key ? day_of_week
           AND (schedule_data->branch_key->day_of_week->>'enabled')::BOOLEAN = true THEN
            
            RETURN QUERY
            SELECT 
                (schedule_data->branch_key->day_of_week->>'start')::TIME,
                (schedule_data->branch_key->day_of_week->>'end')::TIME,
                true;
        END IF;
    END IF;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Verification queries
DO $$
DECLARE
    provider_record RECORD;
    friday_providers INTEGER := 0;
BEGIN
    RAISE NOTICE '=== ENHANCED CALENDAR SCHEDULE SYSTEM SETUP COMPLETE ===';
    RAISE NOTICE '';
    RAISE NOTICE 'Checking San Juan Friday availability (including custom schedules):';
    RAISE NOTICE '';
    
    FOR provider_record IN 
        SELECT id, full_name, schedule, role 
        FROM profiles 
        WHERE role IN ('doctor', 'staff') 
        AND schedule IS NOT NULL
        ORDER BY role, full_name
    LOOP
        -- Check regular Friday schedule
        IF provider_record.schedule->'sanjuan'->'friday'->>'enabled' = 'true' THEN
            friday_providers := friday_providers + 1;
            RAISE NOTICE '✅ % (%) - Regular San Juan Friday: % to %', 
                provider_record.full_name, 
                provider_record.role,
                provider_record.schedule->'sanjuan'->'friday'->>'start',
                provider_record.schedule->'sanjuan'->'friday'->>'end';
        END IF;
        
        -- Check specific date schedules (example: 2025-09-12)
        IF provider_record.schedule ? '2025-09-12_sanjuan' THEN
            friday_providers := friday_providers + 1;
            RAISE NOTICE '✅ % (%) - Custom Friday (2025-09-12): Special schedule configured', 
                provider_record.full_name, 
                provider_record.role;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 SUMMARY:';
    RAISE NOTICE 'Total providers available for San Juan on Fridays: %', friday_providers;
    RAISE NOTICE '';
    
    IF friday_providers > 0 THEN
        RAISE NOTICE '✅ San Juan Friday scheduling is now ACTIVE!';
        RAISE NOTICE '✅ Calendar-based schedule management is ready!';
    ELSE
        RAISE NOTICE '❌ San Juan Friday still needs provider configuration!';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 NEW FEATURES AVAILABLE:';
    RAISE NOTICE '• Calendar-based date selection for schedules';
    RAISE NOTICE '• Specific date overrides (custom schedules for individual dates)';
    RAISE NOTICE '• Multiple time slots per day';
    RAISE NOTICE '• Visual calendar interface in doctor settings';
    RAISE NOTICE '• Enhanced appointment validation';
    RAISE NOTICE '';
    RAISE NOTICE '📋 NEXT STEPS:';
    RAISE NOTICE '1. Integrate CalendarScheduleManager component in doctor Settings';
    RAISE NOTICE '2. Test calendar-based appointment booking';
    RAISE NOTICE '3. Train doctors on new calendar interface';
END $$;

COMMIT;
