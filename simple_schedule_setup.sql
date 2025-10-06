-- Simple Schedule System Setup (PostgreSQL/Supabase Compatible)
-- This is a minimal version that avoids complex policy syntax

-- Add schedule columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS unavailable_dates JSONB DEFAULT '[]'::jsonb;

-- Create staff schedules table
CREATE TABLE IF NOT EXISTS staff_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    schedule JSONB DEFAULT NULL,
    unavailable_dates JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint
ALTER TABLE staff_schedules ADD CONSTRAINT IF NOT EXISTS staff_schedules_staff_id_unique UNIQUE (staff_id);

-- Add basic indexes
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_id ON staff_schedules(staff_id);

-- Enable RLS (if needed)
-- ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;

-- Verification queries (run these to check if setup worked)
/*
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('schedule', 'unavailable_dates');

SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'staff_schedules';
*/
