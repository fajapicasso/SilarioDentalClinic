-- Add auto_assigned column to appointments table for tracking automatic doctor assignments
-- Run this in Supabase SQL Editor

BEGIN;

-- Add auto_assigned column to appointments table
DO $$ 
BEGIN
    -- Add auto_assigned column for tracking automatic doctor assignments
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'auto_assigned'
    ) THEN
        ALTER TABLE appointments ADD COLUMN auto_assigned BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added auto_assigned column to appointments table';
    ELSE
        RAISE NOTICE 'auto_assigned column already exists in appointments table';
    END IF;
END $$;

-- Update existing appointments to have auto_assigned = false (manual assignments)
UPDATE appointments 
SET auto_assigned = FALSE 
WHERE auto_assigned IS NULL;

COMMIT;
