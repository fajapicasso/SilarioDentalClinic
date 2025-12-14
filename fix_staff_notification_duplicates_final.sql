-- =====================================================
-- FIX STAFF NOTIFICATION DUPLICATES - FINAL SOLUTION
-- =====================================================
-- This script:
-- 1. Removes ALL duplicate "New Appointment Request" notifications
-- 2. Keeps only ONE notification per appointment per recipient
-- 3. Works for staff, admin, and doctor roles
-- =====================================================

-- =====================================================
-- STEP 1: Remove duplicates for "New Appointment Request"
-- Keep only the OLDEST notification for each appointment + recipient combination
-- =====================================================
DELETE FROM "public"."notifications"
WHERE id IN (
  SELECT n.id
  FROM "public"."notifications" n
  INNER JOIN (
    SELECT 
      recipient_id,
      (metadata->>'appointmentId')::text AS appointment_id,
      MIN(created_at) as min_created_at,
      COUNT(*) as dup_count
    FROM "public"."notifications"
    WHERE title = 'New Appointment Request'
      AND category = 'appointment'
      AND (metadata->>'appointmentId') IS NOT NULL
      AND (metadata->>'action') = 'new_request'
    GROUP BY recipient_id, (metadata->>'appointmentId')::text
    HAVING COUNT(*) > 1
  ) AS duplicates
  ON n.recipient_id = duplicates.recipient_id
  AND (n.metadata->>'appointmentId')::text = duplicates.appointment_id
  AND n.title = 'New Appointment Request'
  AND n.category = 'appointment'
  AND (n.metadata->>'action') = 'new_request'
  AND n.created_at > duplicates.min_created_at
);

-- =====================================================
-- STEP 2: Remove duplicates using ROW_NUMBER (handles edge cases)
-- This catches duplicates even if created_at is identical
-- =====================================================
DELETE FROM "public"."notifications"
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      recipient_id,
      (metadata->>'appointmentId')::text AS appointment_id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          recipient_id, 
          (metadata->>'appointmentId')::text,
          title,
          category
        ORDER BY created_at ASC, id ASC
      ) as row_num
    FROM "public"."notifications"
    WHERE title = 'New Appointment Request'
      AND category = 'appointment'
      AND (metadata->>'appointmentId') IS NOT NULL
      AND (metadata->>'action') = 'new_request'
  ) AS ranked
  WHERE row_num > 1
);

-- =====================================================
-- STEP 3: Remove duplicates for "Appointment Request Submitted" (patient notifications)
-- =====================================================
DELETE FROM "public"."notifications"
WHERE id IN (
  SELECT n.id
  FROM "public"."notifications" n
  INNER JOIN (
    SELECT 
      recipient_id,
      (metadata->>'appointmentId')::text AS appointment_id,
      MIN(created_at) as min_created_at,
      COUNT(*) as dup_count
    FROM "public"."notifications"
    WHERE title = 'Appointment Request Submitted'
      AND category = 'appointment'
      AND (metadata->>'appointmentId') IS NOT NULL
    GROUP BY recipient_id, (metadata->>'appointmentId')::text
    HAVING COUNT(*) > 1
  ) AS duplicates
  ON n.recipient_id = duplicates.recipient_id
  AND (n.metadata->>'appointmentId')::text = duplicates.appointment_id
  AND n.title = 'Appointment Request Submitted'
  AND n.category = 'appointment'
  AND n.created_at > duplicates.min_created_at
);

-- =====================================================
-- STEP 4: Aggressive cleanup - Remove ALL duplicates for same appointment
-- If a staff member has multiple notifications for the same appointment,
-- keep only the first one (by created_at, then by id)
-- =====================================================
WITH duplicate_notifications AS (
  SELECT 
    id,
    recipient_id,
    (metadata->>'appointmentId')::text AS appointment_id,
    title,
    category,
    ROW_NUMBER() OVER (
      PARTITION BY 
        recipient_id,
        (metadata->>'appointmentId')::text,
        title,
        category,
        COALESCE((metadata->>'action'), '')
      ORDER BY created_at ASC, id ASC
    ) as row_num
  FROM "public"."notifications"
  WHERE category = 'appointment'
    AND (metadata->>'appointmentId') IS NOT NULL
)
DELETE FROM "public"."notifications"
WHERE id IN (
  SELECT id FROM duplicate_notifications WHERE row_num > 1
);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify duplicates are removed:

-- Check for remaining duplicates for "New Appointment Request":
-- SELECT 
--   recipient_id,
--   (metadata->>'appointmentId')::text AS appointment_id,
--   COUNT(*) as duplicate_count
-- FROM "public"."notifications"
-- WHERE title = 'New Appointment Request'
--   AND category = 'appointment'
--   AND (metadata->>'appointmentId') IS NOT NULL
--   AND (metadata->>'action') = 'new_request'
-- GROUP BY recipient_id, (metadata->>'appointmentId')::text
-- HAVING COUNT(*) > 1;

-- Check for remaining duplicates for any appointment notification:
-- SELECT 
--   recipient_id,
--   title,
--   (metadata->>'appointmentId')::text AS appointment_id,
--   COUNT(*) as duplicate_count
-- FROM "public"."notifications"
-- WHERE category = 'appointment'
--   AND (metadata->>'appointmentId') IS NOT NULL
-- GROUP BY recipient_id, title, (metadata->>'appointmentId')::text
-- HAVING COUNT(*) > 1;

-- Count total notifications by type:
-- SELECT 
--   title,
--   category,
--   COUNT(*) as total_count,
--   COUNT(DISTINCT (metadata->>'appointmentId')) as unique_appointments
-- FROM "public"."notifications"
-- WHERE category = 'appointment'
--   AND (metadata->>'appointmentId') IS NOT NULL
-- GROUP BY title, category
-- ORDER BY title, category;

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. This script removes ALL duplicate notifications
-- 2. It keeps the OLDEST notification for each appointment + recipient combination
-- 3. The code has been updated to prevent future duplicates
-- 4. Run this script to clean up existing duplicates
-- 5. After running, new appointments should not create duplicates
-- =====================================================

