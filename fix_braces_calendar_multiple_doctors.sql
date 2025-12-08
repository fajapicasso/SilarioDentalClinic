-- =============================================================================
-- Fix Braces Calendar: Allow Multiple Doctors to Add Same Patient
-- =============================================================================
-- This script fixes the database constraint issue that prevents multiple
-- doctors from adding the same patient to their braces calendars.
--
-- Problem: If there's a unique constraint on (patient_id, month, year) without
--          doctor_id, only one doctor can add a patient per month/year.
--
-- Solution: Ensure the unique constraint includes doctor_id so each doctor
--           can have their own independent calendar entries.
-- =============================================================================

-- Step 1: Check existing constraints on braces_checkups table
-- Run this to see what constraints currently exist
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    RAISE NOTICE '=== Checking existing constraints on braces_checkups ===';
    
    FOR constraint_record IN
        SELECT 
            conname AS constraint_name,
            pg_get_constraintdef(oid) AS constraint_definition
        FROM pg_constraint
        WHERE conrelid = 'braces_checkups'::regclass
        AND contype = 'u'  -- 'u' = unique constraint
    LOOP
        RAISE NOTICE 'Found unique constraint: % - %', 
            constraint_record.constraint_name, 
            constraint_record.constraint_definition;
    END LOOP;
END $$;

-- Step 2: Drop any existing unique constraints that don't include doctor_id
-- This will remove constraints that prevent multiple doctors from adding the same patient

DO $$
DECLARE
    constraint_record RECORD;
    constraint_name TEXT;
    constraint_def TEXT;
BEGIN
    RAISE NOTICE '=== Removing problematic unique constraints ===';
    
    FOR constraint_record IN
        SELECT 
            conname AS constraint_name,
            pg_get_constraintdef(oid) AS constraint_definition
        FROM pg_constraint
        WHERE conrelid = 'braces_checkups'::regclass
        AND contype = 'u'  -- 'u' = unique constraint
    LOOP
        constraint_name := constraint_record.constraint_name;
        constraint_def := constraint_record.constraint_definition;
        
        -- Check if constraint doesn't include doctor_id
        -- This means it would prevent multiple doctors from having the same patient
        IF constraint_def NOT ILIKE '%doctor_id%' THEN
            RAISE NOTICE 'Dropping constraint: % (does not include doctor_id)', constraint_name;
            EXECUTE format('ALTER TABLE braces_checkups DROP CONSTRAINT IF EXISTS %I', constraint_name);
            RAISE NOTICE '✅ Dropped constraint: %', constraint_name;
        ELSE
            RAISE NOTICE 'Keeping constraint: % (includes doctor_id)', constraint_name;
        END IF;
    END LOOP;
END $$;

-- Step 3: Create the correct unique constraint that includes doctor_id
-- This ensures:
-- - Same patient, same month/year, different doctors = ALLOWED ✅
-- - Same patient, same month/year, same doctor = NOT ALLOWED (duplicate) ❌

DO $$
BEGIN
    -- Check if the correct constraint already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conrelid = 'braces_checkups'::regclass
        AND conname = 'braces_checkups_patient_month_year_doctor_unique'
        AND contype = 'u'
    ) THEN
        -- Create unique constraint that includes doctor_id
        ALTER TABLE braces_checkups 
        ADD CONSTRAINT braces_checkups_patient_month_year_doctor_unique 
        UNIQUE (patient_id, month, year, doctor_id);
        
        RAISE NOTICE '✅ Created unique constraint: braces_checkups_patient_month_year_doctor_unique';
        RAISE NOTICE '   This allows multiple doctors to have the same patient';
    ELSE
        RAISE NOTICE '✅ Constraint already exists: braces_checkups_patient_month_year_doctor_unique';
    END IF;
END $$;

-- Step 4: Create helpful indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_braces_checkups_doctor_id 
ON braces_checkups(doctor_id);

CREATE INDEX IF NOT EXISTS idx_braces_checkups_patient_id 
ON braces_checkups(patient_id);

CREATE INDEX IF NOT EXISTS idx_braces_checkups_month_year 
ON braces_checkups(month, year);

CREATE INDEX IF NOT EXISTS idx_braces_checkups_doctor_month_year 
ON braces_checkups(doctor_id, month, year);

CREATE INDEX IF NOT EXISTS idx_braces_checkups_appointment_date 
ON braces_checkups(appointment_date);

RAISE NOTICE '✅ Created indexes for better performance';

-- Step 5: Verify the fix
DO $$
DECLARE
    constraint_record RECORD;
    constraint_count INT := 0;
BEGIN
    RAISE NOTICE '=== Verification: Checking constraints after fix ===';
    
    FOR constraint_record IN
        SELECT 
            conname AS constraint_name,
            pg_get_constraintdef(oid) AS constraint_definition
        FROM pg_constraint
        WHERE conrelid = 'braces_checkups'::regclass
        AND contype = 'u'
    LOOP
        constraint_count := constraint_count + 1;
        RAISE NOTICE 'Constraint %: % - %', 
            constraint_count,
            constraint_record.constraint_name, 
            constraint_record.constraint_definition;
        
        -- Verify it includes doctor_id
        IF constraint_record.constraint_definition ILIKE '%doctor_id%' THEN
            RAISE NOTICE '  ✅ This constraint includes doctor_id - Multiple doctors can add same patient';
        ELSE
            RAISE NOTICE '  ⚠️  WARNING: This constraint does NOT include doctor_id!';
        END IF;
    END LOOP;
    
    IF constraint_count = 0 THEN
        RAISE NOTICE '⚠️  No unique constraints found on braces_checkups';
    END IF;
END $$;

-- =============================================================================
-- Summary
-- =============================================================================
-- After running this script:
-- 1. Multiple doctors can now add the same patient to their calendars
-- 2. Each doctor's calendar entries are independent
-- 3. The same doctor cannot add the same patient twice in the same month/year
-- 4. Performance indexes have been added for faster queries
--
-- Test it by:
-- 1. Doctor A adds "Francis Jey R. Valoria" to their calendar
-- 2. Doctor B should be able to add "Francis Jey R. Valoria" to their calendar
-- 3. Both calendars should show the patient independently
-- =============================================================================
