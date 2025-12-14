-- =====================================================
-- FIX STAFF DELETE PERMISSIONS AND REMOVE DUPLICATES
-- =====================================================
-- This script:
-- 1. Ensures staff can delete all notifications (fixes delete policy)
-- 2. Removes duplicate notifications based on appointmentId
-- =====================================================

-- Enable RLS on notifications table if not already enabled
ALTER TABLE IF EXISTS "public"."notifications" ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- FIX STAFF DELETE POLICY
-- =====================================================
-- Drop and recreate the staff delete policy to ensure it works correctly
DROP POLICY IF EXISTS "Staff can delete all notifications" ON "public"."notifications";
CREATE POLICY "Staff can delete all notifications"
ON "public"."notifications"
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'staff'
  )
);

-- =====================================================
-- REMOVE DUPLICATE NOTIFICATIONS
-- =====================================================
-- Remove duplicate "New Appointment Request" notifications
-- Keep only the oldest one for each appointmentId + recipient combination
-- This handles duplicates for staff, admin, and doctor roles
DELETE FROM "public"."notifications"
WHERE id IN (
  SELECT n.id
  FROM "public"."notifications" n
  INNER JOIN (
    SELECT 
      recipient_id,
      (metadata->>'appointmentId') AS appointment_id,
      MIN(created_at) as min_created_at,
      COUNT(*) as dup_count
    FROM "public"."notifications"
    WHERE title = 'New Appointment Request'
      AND category = 'appointment'
      AND (metadata->>'appointmentId') IS NOT NULL
      AND (metadata->>'action') = 'new_request'
    GROUP BY recipient_id, (metadata->>'appointmentId')
    HAVING COUNT(*) > 1
  ) AS duplicates
  ON n.recipient_id = duplicates.recipient_id
  AND (n.metadata->>'appointmentId') = duplicates.appointment_id
  AND n.title = 'New Appointment Request'
  AND n.category = 'appointment'
  AND (n.metadata->>'action') = 'new_request'
  AND n.created_at > duplicates.min_created_at
);

-- Also remove duplicates where the same appointment notification exists multiple times
-- for the same recipient (even if created_at is the same, keep only one)
-- Use ROW_NUMBER() to identify duplicates and keep the first one
DELETE FROM "public"."notifications"
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY recipient_id, (metadata->>'appointmentId')
        ORDER BY created_at, id::text
      ) as row_num
    FROM "public"."notifications"
    WHERE title = 'New Appointment Request'
      AND category = 'appointment'
      AND (metadata->>'appointmentId') IS NOT NULL
      AND (metadata->>'action') = 'new_request'
  ) AS ranked
  WHERE row_num > 1
);

-- Remove duplicate "Appointment Request Submitted" notifications for patients
DELETE FROM "public"."notifications"
WHERE id IN (
  SELECT n.id
  FROM "public"."notifications" n
  INNER JOIN (
    SELECT 
      recipient_id,
      (metadata->>'appointmentId') AS appointment_id,
      MIN(created_at) as min_created_at,
      COUNT(*) as dup_count
    FROM "public"."notifications"
    WHERE title = 'Appointment Request Submitted'
      AND category = 'appointment'
      AND (metadata->>'appointmentId') IS NOT NULL
    GROUP BY recipient_id, (metadata->>'appointmentId')
    HAVING COUNT(*) > 1
  ) AS duplicates
  ON n.recipient_id = duplicates.recipient_id
  AND (n.metadata->>'appointmentId') = duplicates.appointment_id
  AND n.title = 'Appointment Request Submitted'
  AND n.category = 'appointment'
  AND n.created_at > duplicates.min_created_at
);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Check for remaining duplicates:
-- SELECT 
--   recipient_id,
--   title,
--   category,
--   (metadata->>'appointmentId') AS appointment_id,
--   COUNT(*) as count
-- FROM "public"."notifications"
-- WHERE (metadata->>'appointmentId') IS NOT NULL
-- GROUP BY recipient_id, title, category, (metadata->>'appointmentId')
-- HAVING COUNT(*) > 1;

-- Check staff delete policy:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename = 'notifications'
-- AND policyname = 'Staff can delete all notifications';

