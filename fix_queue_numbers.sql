-- Fix Queue Numbers for Daily Reset
-- This script resets queue numbers for today's entries to start from 1

-- First, let's see what queue entries exist for today
-- (This is a comment - the actual query will be run in Supabase SQL Editor)

-- Get today's date in Philippine time (UTC+8)
-- Note: This should be run in Supabase SQL Editor where you can see the current date

-- Step 1: Check current queue entries for today
SELECT 
    id,
    patient_id,
    queue_number,
    status,
    created_at,
    branch
FROM queue 
WHERE created_at >= CURRENT_DATE 
    AND created_at < CURRENT_DATE + INTERVAL '1 day'
    AND status IN ('waiting', 'serving')
ORDER BY created_at ASC;

-- Step 2: Update queue numbers to start from 1 for today's entries
-- This will assign queue numbers 1, 2, 3, etc. based on creation time
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
SET queue_number = today_queue.new_queue_number
FROM today_queue
WHERE queue.id = today_queue.id;

-- Step 3: Verify the update
SELECT 
    id,
    patient_id,
    queue_number,
    status,
    created_at,
    branch
FROM queue 
WHERE created_at >= CURRENT_DATE 
    AND created_at < CURRENT_DATE + INTERVAL '1 day'
    AND status IN ('waiting', 'serving')
ORDER BY queue_number ASC;
