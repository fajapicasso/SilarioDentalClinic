-- Fix Queue Race Condition and Reset Today's Queue Numbers
-- This script addresses the issue where all appointments get queue number 1
-- due to race conditions when multiple appointments are added simultaneously

-- Step 1: Check current queue entries for today
SELECT 
    id,
    patient_id,
    appointment_id,
    queue_number,
    status,
    created_at,
    branch
FROM queue 
WHERE created_at >= CURRENT_DATE 
    AND created_at < CURRENT_DATE + INTERVAL '1 day'
    AND status IN ('waiting', 'serving')
ORDER BY created_at ASC;

-- Step 2: Reset queue numbers to be sequential based on creation time
-- This will fix the current issue where all entries have queue_number = 1
WITH today_queue AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (ORDER BY created_at ASC) as new_queue_number
    FROM queue 
    WHERE created_at >= CURRENT_DATE 
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
        AND status IN ('waiting', 'serving')
)
UPDATE queue 
SET queue_number = today_queue.new_queue_number,
    updated_at = NOW()
FROM today_queue
WHERE queue.id = today_queue.id;

-- Step 3: Verify the fix
SELECT 
    id,
    patient_id,
    appointment_id,
    queue_number,
    status,
    created_at,
    branch
FROM queue 
WHERE created_at >= CURRENT_DATE 
    AND created_at < CURRENT_DATE + INTERVAL '1 day'
    AND status IN ('waiting', 'serving')
ORDER BY queue_number ASC;

-- Step 4: Add a unique constraint to prevent duplicate queue numbers for the same date
-- This will help prevent race conditions at the database level
-- Note: This constraint uses a partial index to only apply to active queue entries

-- First, check if the constraint already exists
SELECT conname 
FROM pg_constraint 
WHERE conname = 'unique_daily_queue_number';

-- Create the unique constraint if it doesn't exist
-- This prevents two queue entries from having the same queue number on the same date
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_daily_queue_number'
    ) THEN
        -- Add unique constraint on queue_number for the same date (only for active entries)
        ALTER TABLE queue 
        ADD CONSTRAINT unique_daily_queue_number 
        UNIQUE (queue_number, DATE(created_at))
        WHERE status IN ('waiting', 'serving');
        
        RAISE NOTICE 'Added unique constraint for daily queue numbers';
    ELSE
        RAISE NOTICE 'Unique constraint for daily queue numbers already exists';
    END IF;
END $$;

-- Step 5: Create a function to get the next queue number atomically
-- This function will be used instead of the application-level logic to prevent race conditions
CREATE OR REPLACE FUNCTION get_next_queue_number_for_today()
RETURNS INTEGER AS $$
DECLARE
    next_number INTEGER;
BEGIN
    -- Lock the table to prevent race conditions
    LOCK TABLE queue IN SHARE ROW EXCLUSIVE MODE;
    
    -- Get the maximum queue number for today
    SELECT COALESCE(MAX(queue_number), 0) + 1 
    INTO next_number
    FROM queue 
    WHERE created_at >= CURRENT_DATE 
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
        AND status IN ('waiting', 'serving', 'completed', 'cancelled');
    
    RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT get_next_queue_number_for_today() as next_queue_number;
