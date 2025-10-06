-- Drop/Delete Manual Queue Fix for Francis Jey R. Valoria
-- This script removes the manually added queue entries

-- First, let's see what queue entries exist for this patient
SELECT 
    'CURRENT QUEUE ENTRIES' as step,
    q.id,
    q.patient_id,
    q.appointment_id,
    q.queue_number,
    q.status,
    p.full_name as patient_name,
    q.created_at
FROM queue q
JOIN profiles p ON p.id = q.patient_id
WHERE p.full_name ILIKE '%Francis Jey R. Valoria%'
AND q.created_at >= CURRENT_DATE 
AND q.created_at < CURRENT_DATE + INTERVAL '1 day';

-- Delete the queue entries for Francis Jey R. Valoria created today
DELETE FROM queue 
WHERE patient_id = (
    SELECT id FROM profiles 
    WHERE full_name ILIKE '%Francis Jey R. Valoria%' 
    LIMIT 1
)
AND created_at >= CURRENT_DATE 
AND created_at < CURRENT_DATE + INTERVAL '1 day';

-- Verify the deletion
SELECT 
    'VERIFICATION - REMAINING ENTRIES' as step,
    q.id,
    q.patient_id,
    q.appointment_id,
    q.queue_number,
    q.status,
    p.full_name as patient_name,
    q.created_at
FROM queue q
JOIN profiles p ON p.id = q.patient_id
WHERE p.full_name ILIKE '%Francis Jey R. Valoria%'
AND q.created_at >= CURRENT_DATE 
AND q.created_at < CURRENT_DATE + INTERVAL '1 day';
