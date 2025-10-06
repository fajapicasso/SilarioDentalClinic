-- Drop/Delete Reset Queue Numbers Entries
-- This script removes queue entries that were reset today

-- Step 1: Check current queue entries for today
SELECT 
    'CURRENT QUEUE ENTRIES' as step,
    id,
    patient_id,
    queue_number,
    status as queue_status,
    created_at,
    branch
FROM queue 
WHERE created_at >= CURRENT_DATE 
    AND created_at < CURRENT_DATE + INTERVAL '1 day'
    AND status IN ('waiting', 'serving')
ORDER BY queue_number ASC;

-- Step 2: Delete all queue entries for today
DELETE FROM queue 
WHERE created_at >= CURRENT_DATE 
    AND created_at < CURRENT_DATE + INTERVAL '1 day'
    AND status IN ('waiting', 'serving');

-- Step 3: Verify the deletion
SELECT 
    'VERIFICATION - REMAINING ENTRIES' as step,
    id,
    patient_id,
    queue_number,
    status as queue_status,
    created_at,
    branch
FROM queue 
WHERE created_at >= CURRENT_DATE 
    AND created_at < CURRENT_DATE + INTERVAL '1 day'
    AND status IN ('waiting', 'serving')
ORDER BY queue_number ASC;
