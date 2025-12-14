-- =====================================================
-- STAFF NOTIFICATIONS - SAME AS ADMIN
-- =====================================================
-- This script adds RLS policies so staff can view
-- and manage all notifications, just like admin
-- =====================================================
-- Note: This script does NOT drop existing policies
-- It only adds the staff policies to match admin access
-- =====================================================

-- Enable RLS on notifications table if not already enabled
ALTER TABLE IF EXISTS "public"."notifications" ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ADD STAFF POLICIES (Same as Admin)
-- =====================================================

-- Staff can view ALL notifications (same as "Admins can view all notifications")
DROP POLICY IF EXISTS "Staff can view all notifications" ON "public"."notifications";
CREATE POLICY "Staff can view all notifications"
ON "public"."notifications"
TO public
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'staff'::text))
  )
);

-- Staff can update ALL notifications (same access as admin would have)
DROP POLICY IF EXISTS "Staff can update all notifications" ON "public"."notifications";
CREATE POLICY "Staff can update all notifications"
ON "public"."notifications"
TO public
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'staff'::text))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'staff'::text))
  )
);

-- Staff can delete ALL notifications (same access as admin would have)
DROP POLICY IF EXISTS "Staff can delete all notifications" ON "public"."notifications";
CREATE POLICY "Staff can delete all notifications"
ON "public"."notifications"
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'staff'::text))
  )
);

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Run these queries to verify the policies are working:

-- Check if policies are created:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename = 'notifications'
-- ORDER BY policyname;

-- Test: Check if staff can see all notifications
-- (Run this as a staff user)
-- SELECT COUNT(*) FROM notifications;

-- =====================================================
-- IMPORTANT NOTES:
-- =====================================================
-- 1. Staff now have the SAME notification access as admin
-- 2. Staff can view, update, and delete ALL notifications
-- 3. Staff can create notifications for any user
-- 4. Regular users can still only see their own notifications
-- 5. Guardians can see notifications for their children
-- =====================================================

