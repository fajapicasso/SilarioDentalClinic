-- =============================================================================
-- SIMPLE VERSION: Fix Braces Calendar for Multiple Doctors
-- =============================================================================
-- Run this in your Supabase SQL Editor to allow multiple doctors
-- to add the same patient to their braces calendars.
-- =============================================================================

-- Step 1: Drop any unique constraints that don't include doctor_id
-- (This allows multiple doctors to have the same patient)

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find and drop constraints that don't include doctor_id
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'braces_checkups'::regclass
        AND contype = 'u'
        AND pg_get_constraintdef(oid) NOT ILIKE '%doctor_id%'
    LOOP
        EXECUTE format('ALTER TABLE braces_checkups DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Step 2: Create the correct unique constraint WITH doctor_id
-- This ensures each doctor can have their own calendar entries

ALTER TABLE braces_checkups 
DROP CONSTRAINT IF EXISTS braces_checkups_patient_month_year_doctor_unique;

ALTER TABLE braces_checkups 
ADD CONSTRAINT braces_checkups_patient_month_year_doctor_unique 
UNIQUE (patient_id, month, year, doctor_id);

-- Step 3: Add indexes for better performance (optional but recommended)

CREATE INDEX IF NOT EXISTS idx_braces_checkups_doctor_id ON braces_checkups(doctor_id);
CREATE INDEX IF NOT EXISTS idx_braces_checkups_doctor_month_year ON braces_checkups(doctor_id, month, year);

-- Done! Now multiple doctors can add the same patient.
-- Test: Have two different doctors try to add "Francis Jey R. Valoria"
