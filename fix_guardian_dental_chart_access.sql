-- =====================================================
-- GUARDIAN DENTAL CHART ACCESS POLICIES
-- =====================================================
-- This script creates RLS policies that allow guardians
-- to view and edit dental charts for their children
-- =====================================================

-- =====================================================
-- STEP 1: Drop existing guardian policies if they exist
-- =====================================================
DROP POLICY IF EXISTS "Guardians can view children's dental charts" ON dental_charts;
DROP POLICY IF EXISTS "Guardians can update children's dental charts" ON dental_charts;
DROP POLICY IF EXISTS "Guardians can create dental charts for children" ON dental_charts;

-- =====================================================
-- STEP 2: Policy for Guardians to VIEW (SELECT) their children's dental charts
-- =====================================================
-- Allows guardians to see dental charts where:
-- - The patient_id belongs to a child (profile with guardian_id = current user)
CREATE POLICY "Guardians can view children's dental charts"
ON dental_charts FOR SELECT
USING (
  -- Check if the patient_id belongs to a child where the current user is the guardian
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = dental_charts.patient_id
    AND profiles.guardian_id = auth.uid()
  )
  -- Also allow if the user is viewing their own chart
  OR patient_id = auth.uid()
);

-- =====================================================
-- STEP 3: Policy for Guardians to UPDATE their children's dental charts
-- =====================================================
-- Allows guardians to edit dental charts for their children
CREATE POLICY "Guardians can update children's dental charts"
ON dental_charts FOR UPDATE
USING (
  -- Check if the patient_id belongs to a child where the current user is the guardian
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = dental_charts.patient_id
    AND profiles.guardian_id = auth.uid()
  )
  -- Also allow if the user is updating their own chart
  OR patient_id = auth.uid()
)
WITH CHECK (
  -- Ensure the guardian can only update charts for their children
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = dental_charts.patient_id
    AND profiles.guardian_id = auth.uid()
  )
  -- Also allow if the user is updating their own chart
  OR patient_id = auth.uid()
);

-- =====================================================
-- STEP 4: Policy for Guardians to INSERT (create) dental charts for their children
-- =====================================================
-- Allows guardians to create new dental charts for their children
CREATE POLICY "Guardians can create dental charts for children"
ON dental_charts FOR INSERT
WITH CHECK (
  -- Check if the patient_id belongs to a child where the current user is the guardian
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = dental_charts.patient_id
    AND profiles.guardian_id = auth.uid()
  )
  -- Also allow if the user is creating their own chart
  OR patient_id = auth.uid()
);

-- =====================================================
-- STEP 5: Verify the policies were created
-- =====================================================
-- Run this query to verify the policies exist:
/*
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'dental_charts'
ORDER BY policyname;
*/

-- =====================================================
-- STEP 6: Test the policies (optional - for verification)
-- =====================================================
-- To test if a guardian can access their child's dental chart:
-- 1. Log in as a guardian user
-- 2. Run: SELECT * FROM dental_charts WHERE patient_id IN (
--    SELECT id FROM profiles WHERE guardian_id = auth.uid()
-- );
-- 
-- This should return all dental charts for the guardian's children

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. These policies work alongside existing policies for staff/doctors
-- 2. Guardians can only access charts for children where they are listed as guardian_id
-- 3. The policies also allow users to access their own charts (patient_id = auth.uid())
-- 4. The WITH CHECK clause ensures guardians can only create/update charts for their children
-- =====================================================

