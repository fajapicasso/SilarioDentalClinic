-- =====================================================
-- CLEANUP DUPLICATE NOTIFICATIONS
-- =====================================================
-- This script removes duplicate "New Appointment Request" 
-- notifications for the same appointment
-- =====================================================

-- Delete duplicate notifications, keeping only the oldest one for each appointment
-- This removes duplicates where the same appointment has multiple notifications
WITH duplicates AS (
  SELECT 
    id,
    recipient_id,
    metadata->>'appointmentId' as appointment_id,
    ROW_NUMBER() OVER (
      PARTITION BY 
        recipient_id, 
        metadata->>'appointmentId',
        title,
        category
      ORDER BY created_at ASC
    ) as row_num
  FROM notifications
  WHERE title = 'New Appointment Request'
    AND category = 'appointment'
    AND metadata->>'action' = 'new_request'
    AND metadata->>'appointmentId' IS NOT NULL
)
DELETE FROM notifications
WHERE id IN (
  SELECT id FROM duplicates WHERE row_num > 1
);

-- Show count of remaining notifications
SELECT 
  COUNT(*) as total_notifications,
  COUNT(DISTINCT metadata->>'appointmentId') as unique_appointments
FROM notifications
WHERE title = 'New Appointment Request'
  AND category = 'appointment'
  AND metadata->>'action' = 'new_request';

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Check for any remaining duplicates:
-- SELECT 
--   recipient_id,
--   metadata->>'appointmentId' as appointment_id,
--   COUNT(*) as duplicate_count
-- FROM notifications
-- WHERE title = 'New Appointment Request'
--   AND category = 'appointment'
--   AND metadata->>'action' = 'new_request'
-- GROUP BY recipient_id, metadata->>'appointmentId'
-- HAVING COUNT(*) > 1;
-- =====================================================

