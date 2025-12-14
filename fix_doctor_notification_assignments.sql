-- =====================================================
-- FIX DOCTOR NOTIFICATION ASSIGNMENTS
-- =====================================================
-- This script removes appointment notifications from doctors
-- where the appointment is assigned to a different doctor
-- =====================================================

-- =====================================================
-- STEP 1: Find notifications that need to be removed
-- =====================================================
-- Find "New Appointment Request" notifications sent to doctors
-- where the metadata.doctorId doesn't match the recipient_id
-- (meaning the appointment is assigned to a different doctor)

-- First, let's see what we're dealing with:
-- UNCOMMENT THIS TO SEE WHAT WILL BE DELETED:
/*
SELECT 
  n.id,
  n.recipient_id,
  n.title,
  n.metadata->>'doctorId' as assigned_doctor_id,
  n.metadata->>'appointmentId' as appointment_id,
  p.full_name as recipient_name,
  p.role as recipient_role,
  CASE 
    WHEN TRIM(n.metadata->>'doctorId') = TRIM(n.recipient_id::text) THEN 'CORRECT - Will keep'
    WHEN TRIM(n.metadata->>'doctorId') = TRIM(n.recipient_id::uuid::text) THEN 'CORRECT - Will keep'
    WHEN n.metadata->>'doctorId' IS NULL OR n.metadata->>'doctorId' = '' THEN 'UNASSIGNED - Will keep'
    ELSE 'INCORRECT - Will DELETE'
  END as status
FROM notifications n
JOIN profiles p ON p.id = n.recipient_id
WHERE n.title = 'New Appointment Request'
  AND n.category = 'appointment'
  AND p.role = 'doctor'
ORDER BY n.created_at DESC;
*/

-- =====================================================
-- STEP 2: Delete incorrect doctor notifications
-- =====================================================
-- Remove notifications sent to doctors where the appointment
-- is assigned to a different doctor
-- This handles both UUID and text comparisons
-- Also checks the appointments table directly to catch any mismatches

-- Method 1: Delete based on metadata.doctorId mismatch
DELETE FROM "public"."notifications"
WHERE id IN (
  SELECT n.id
  FROM "public"."notifications" n
  INNER JOIN "public"."profiles" p ON p.id = n.recipient_id
  WHERE n.title = 'New Appointment Request'
    AND n.category = 'appointment'
    AND p.role = 'doctor'
    AND n.metadata->>'doctorId' IS NOT NULL
    AND n.metadata->>'doctorId' != ''
    AND TRIM(n.metadata->>'doctorId') != TRIM(n.recipient_id::text)
    AND TRIM(n.metadata->>'doctorId') != TRIM(n.recipient_id::uuid::text)
);

-- Method 2: Delete based on actual appointment assignment from appointments table
-- This catches notifications where metadata might be missing or incorrect
-- This is the MOST IMPORTANT query - it checks the actual appointments table
DELETE FROM "public"."notifications"
WHERE id IN (
  SELECT n.id
  FROM "public"."notifications" n
  INNER JOIN "public"."profiles" p ON p.id = n.recipient_id
  INNER JOIN "public"."appointments" a ON (
    -- Try to match appointmentId from metadata (handle different formats)
    a.id::text = TRIM(n.metadata->>'appointmentId') OR
    a.id::uuid::text = TRIM(n.metadata->>'appointmentId') OR
    -- Also try to match by parsing the message for appointment date/time/branch
    (n.message LIKE '%' || TO_CHAR(a.appointment_date, 'Mon DD, YYYY') || '%' AND
     n.message LIKE '%' || TO_CHAR(a.appointment_time, 'HH:MI AM') || '%' AND
     n.message LIKE '%' || a.branch || '%')
  )
  WHERE n.title = 'New Appointment Request'
    AND n.category = 'appointment'
    AND p.role = 'doctor'
    AND a.doctor_id IS NOT NULL
    AND TRIM(a.doctor_id::text) != TRIM(n.recipient_id::text)
    AND TRIM(a.doctor_id::text) != TRIM(n.recipient_id::uuid::text)
);

-- =====================================================
-- STEP 3: Also fix "Appointment Rescheduled" notifications
-- =====================================================
-- Remove reschedule notifications sent to doctors where
-- the appointment is assigned to a different doctor
DELETE FROM "public"."notifications"
WHERE id IN (
  SELECT n.id
  FROM "public"."notifications" n
  INNER JOIN "public"."profiles" p ON p.id = n.recipient_id
  WHERE n.title = 'Appointment Rescheduled'
    AND n.category = 'appointment'
    AND p.role = 'doctor'
    AND n.metadata->>'doctorId' IS NOT NULL
    AND n.metadata->>'doctorId' != ''
    AND TRIM(n.metadata->>'doctorId') != TRIM(n.recipient_id::text)
    AND TRIM(n.metadata->>'doctorId') != TRIM(n.recipient_id::uuid::text)
);

-- =====================================================
-- STEP 4: Also delete any appointment notifications for doctors
-- where metadata.doctorId exists but doesn't match recipient
-- (catch-all for any other appointment notification types)
-- =====================================================
DELETE FROM "public"."notifications"
WHERE id IN (
  SELECT n.id
  FROM "public"."notifications" n
  INNER JOIN "public"."profiles" p ON p.id = n.recipient_id
  WHERE n.category = 'appointment'
    AND p.role = 'doctor'
    AND n.metadata->>'doctorId' IS NOT NULL
    AND n.metadata->>'doctorId' != ''
    AND TRIM(n.metadata->>'doctorId') != TRIM(n.recipient_id::text)
    AND TRIM(n.metadata->>'doctorId') != TRIM(n.recipient_id::uuid::text)
);

-- =====================================================
-- STEP 5: Delete notifications where appointment is assigned
-- to a different doctor (checking appointments table)
-- This is a catch-all for any notification type
-- =====================================================
DELETE FROM "public"."notifications"
WHERE id IN (
  SELECT n.id
  FROM "public"."notifications" n
  INNER JOIN "public"."profiles" p ON p.id = n.recipient_id
  INNER JOIN "public"."appointments" a ON a.id::text = TRIM(n.metadata->>'appointmentId')
  WHERE n.category = 'appointment'
    AND p.role = 'doctor'
    AND n.metadata->>'appointmentId' IS NOT NULL
    AND a.doctor_id IS NOT NULL
    AND TRIM(a.doctor_id::text) != TRIM(n.recipient_id::text)
    AND TRIM(a.doctor_id::text) != TRIM(n.recipient_id::uuid::text)
);

-- =====================================================
-- STEP 6: This step is handled by the frontend filter
-- which checks recipient.role === 'doctor'
-- No SQL cleanup needed here as the query already filters
-- by recipient_id = doctor.id, so staff notifications
-- won't be fetched in the first place
-- =====================================================

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- After running, verify that doctors only see their assigned appointments:

-- Check remaining doctor notifications with assignments:
-- SELECT 
--   n.id,
--   n.recipient_id,
--   n.title,
--   n.metadata->>'doctorId' as assigned_doctor_id,
--   n.metadata->>'appointmentId' as appointment_id,
--   p.full_name as recipient_name,
--   CASE 
--     WHEN n.metadata->>'doctorId' = n.recipient_id::text THEN 'CORRECT'
--     WHEN n.metadata->>'doctorId' IS NULL OR n.metadata->>'doctorId' = '' THEN 'UNASSIGNED (OK)'
--     ELSE 'INCORRECT'
--   END as status
-- FROM notifications n
-- JOIN profiles p ON p.id = n.recipient_id
-- WHERE n.title IN ('New Appointment Request', 'Appointment Rescheduled')
--   AND n.category = 'appointment'
--   AND p.role = 'doctor'
-- ORDER BY n.created_at DESC;

-- Count notifications by status:
-- SELECT 
--   CASE 
--     WHEN n.metadata->>'doctorId' = n.recipient_id::text THEN 'Assigned to recipient'
--     WHEN n.metadata->>'doctorId' IS NULL OR n.metadata->>'doctorId' = '' THEN 'Unassigned'
--     ELSE 'Assigned to different doctor'
--   END as status,
--   COUNT(*) as count
-- FROM notifications n
-- JOIN profiles p ON p.id = n.recipient_id
-- WHERE n.title IN ('New Appointment Request', 'Appointment Rescheduled')
--   AND n.category = 'appointment'
--   AND p.role = 'doctor'
-- GROUP BY status;

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. This script removes notifications sent to doctors
--    where the appointment is assigned to a different doctor
-- 2. Unassigned appointments (no doctorId) are kept for all doctors
-- 3. The code has been updated to prevent future incorrect notifications
-- 4. After running this, doctors will only see notifications for
--    appointments assigned to them
-- 5. IMPORTANT: After running this script, users should refresh their
--    browser or wait for the notifications to refresh automatically
-- 6. Check the browser console for filter logs showing which notifications
--    are being filtered out (look for "🔴 Doctor notification FILTERED OUT")
-- =====================================================

-- =====================================================
-- QUICK FIX: Run this to see and delete all incorrect notifications
-- =====================================================
-- This will show you exactly what will be deleted before you delete it:
/*
-- Preview what will be deleted:
SELECT 
  n.id,
  n.recipient_id as sent_to_doctor_id,
  recipient_profile.full_name as sent_to_doctor_name,
  n.metadata->>'doctorId' as assigned_doctor_id,
  assigned_profile.full_name as assigned_doctor_name,
  n.title,
  n.message,
  n.created_at
FROM notifications n
JOIN profiles recipient_profile ON recipient_profile.id = n.recipient_id
LEFT JOIN profiles assigned_profile ON assigned_profile.id::text = TRIM(n.metadata->>'doctorId')
WHERE n.category = 'appointment'
  AND recipient_profile.role = 'doctor'
  AND n.metadata->>'doctorId' IS NOT NULL
  AND n.metadata->>'doctorId' != ''
  AND TRIM(n.metadata->>'doctorId') != TRIM(n.recipient_id::text)
  AND TRIM(n.metadata->>'doctorId') != TRIM(n.recipient_id::uuid::text)
ORDER BY n.created_at DESC;
*/

