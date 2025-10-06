-- Fix for registration RLS policy issue
-- This allows users to create their profile during registration

-- First, let's check the current policies
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Drop the existing INSERT policy that's causing issues
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;

-- Create a new INSERT policy that allows profile creation during registration
CREATE POLICY "Users can create their own profile" ON profiles
FOR INSERT 
TO public
WITH CHECK (
  -- Allow if the user is creating their own profile (auth.uid() matches the id)
  auth.uid() = id
  OR
  -- Allow if the profile doesn't exist yet (for registration)
  NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
  )
);

-- Alternative approach: Create a more permissive policy for registration
-- This allows profile creation for any user during the registration process
CREATE POLICY "Allow profile creation during registration" ON profiles
FOR INSERT 
TO public
WITH CHECK (true);

-- If you want to be more restrictive, you can use this instead:
-- CREATE POLICY "Allow profile creation during registration" ON profiles
-- FOR INSERT 
-- TO public
-- WITH CHECK (
--   -- Allow if the user is creating their own profile
--   auth.uid() = id
--   OR
--   -- Allow if the email matches and profile doesn't exist
--   (email = auth.jwt() ->> 'email' AND NOT EXISTS (
--     SELECT 1 FROM profiles WHERE email = auth.jwt() ->> 'email'
--   ))
-- );

-- Verify the policies
SELECT * FROM pg_policies WHERE tablename = 'profiles'; 