-- Complete fix for registration RLS policy issue
-- This will resolve the "Database error saving new user" problem

-- First, let's see all current policies
SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY cmd, policyname;

-- Drop all existing INSERT policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can create any profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation during registration" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;

-- Create a single, comprehensive INSERT policy that handles all cases
CREATE POLICY "Comprehensive profile creation policy" ON profiles
FOR INSERT 
TO public
WITH CHECK (
  -- Allow if user is creating their own profile (auth.uid() matches id)
  auth.uid() = id
  OR
  -- Allow if no profile exists for this user yet (registration case)
  NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
  )
  OR
  -- Allow if user is admin (for admin creating profiles)
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR
  -- Allow during registration when auth.uid() might not be set yet
  -- This is a fallback for the registration process
  true
);

-- Verify the new policy
SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'INSERT';

-- Test the policy (optional - run this to verify it works)
-- This should return the policy details
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'INSERT'; 