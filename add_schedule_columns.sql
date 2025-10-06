-- SQL script to add schedule and unavailable_dates columns to support the working schedule system
-- Run this script to fix the "Failed to save schedule" error
-- Compatible with PostgreSQL 12+ and Supabase

BEGIN;

-- Add schedule columns to profiles table for doctors
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

-- Create staff_schedules table for staff working schedules
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
        
        RAISE NOTICE 'Created staff_schedules table';
    ELSE
        RAISE NOTICE 'staff_schedules table already exists';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_id ON staff_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_profiles_schedule ON profiles USING GIN(schedule) WHERE schedule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_unavailable_dates ON profiles USING GIN(unavailable_dates) WHERE unavailable_dates IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_schedules_schedule ON staff_schedules USING GIN(schedule) WHERE schedule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_schedules_unavailable_dates ON staff_schedules USING GIN(unavailable_dates) WHERE unavailable_dates IS NOT NULL;

-- Example schedule structure (for reference, not executed)
/*
Doctor schedule structure:
{
  "cabugao": {
    "monday": { "enabled": true, "start": "08:00", "end": "12:00" },
    "tuesday": { "enabled": true, "start": "08:00", "end": "12:00" },
    "wednesday": { "enabled": false, "start": "08:00", "end": "12:00" },
    "thursday": { "enabled": true, "start": "08:00", "end": "12:00" },
    "friday": { "enabled": true, "start": "08:00", "end": "12:00" },
    "saturday": { "enabled": true, "start": "08:00", "end": "17:00" },
    "sunday": { "enabled": false, "start": "08:00", "end": "17:00" }
  },
  "sanjuan": {
    "monday": { "enabled": true, "start": "13:00", "end": "17:00" },
    "tuesday": { "enabled": true, "start": "13:00", "end": "17:00" },
    "wednesday": { "enabled": true, "start": "13:00", "end": "17:00" },
    "thursday": { "enabled": true, "start": "13:00", "end": "17:00" },
    "friday": { "enabled": true, "start": "13:00", "end": "17:00" },
    "saturday": { "enabled": false, "start": "08:00", "end": "17:00" },
    "sunday": { "enabled": true, "start": "08:00", "end": "17:00" }
  }
}

Unavailable dates structure:
[
  {
    "id": "1234567890",
    "date": "2025-09-15",
    "branch": "cabugao",
    "timeSlots": null // null = entire day, array = specific times
  },
  {
    "id": "1234567891", 
    "date": "2025-09-16",
    "branch": "sanjuan",
    "timeSlots": ["09:00", "09:30", "10:00"]
  }
]
*/

-- Add comments to tables and columns
DO $$
BEGIN
    -- Add comments to profiles columns
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'schedule'
    ) THEN
        COMMENT ON COLUMN profiles.schedule IS 'Doctor working schedule by branch and day';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'unavailable_dates'
    ) THEN
        COMMENT ON COLUMN profiles.unavailable_dates IS 'Doctor unavailable dates and times';
    END IF;
    
    -- Add comments to staff_schedules table
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'staff_schedules'
    ) THEN
        COMMENT ON TABLE staff_schedules IS 'Working schedules for staff members';
        COMMENT ON COLUMN staff_schedules.staff_id IS 'Reference to staff member in profiles table';
        COMMENT ON COLUMN staff_schedules.schedule IS 'Staff working schedule by branch and day';
        COMMENT ON COLUMN staff_schedules.unavailable_dates IS 'Staff unavailable dates and times';
    END IF;
END $$;

-- Enable RLS if not already enabled (safely)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'staff_schedules'
    ) THEN
        -- Enable RLS on staff_schedules table
        ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on staff_schedules table';
    END IF;
EXCEPTION 
    WHEN OTHERS THEN 
        RAISE NOTICE 'RLS may already be enabled or not applicable';
END $$;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE '=== SCHEDULE SYSTEM SETUP COMPLETE ===';
    RAISE NOTICE 'All schedule tables and columns have been created successfully!';
    RAISE NOTICE 'You can now save doctor and staff schedules to the database.';
END $$;

COMMIT;
