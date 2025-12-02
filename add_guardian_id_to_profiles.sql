-- Add guardian_id column to profiles table for linking children to guardians
-- This allows minors to be stored in the profiles table like regular patients

-- Add guardian_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'guardian_id'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN guardian_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_profiles_guardian_id ON profiles(guardian_id);
        
        -- Add comment to explain the column
        COMMENT ON COLUMN profiles.guardian_id IS 'References the guardian/parent profile. NULL for adults, set for minors.';
    END IF;
END $$;

-- Add guardian_id and child_id columns to appointments table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'guardian_id'
    ) THEN
        ALTER TABLE appointments 
        ADD COLUMN guardian_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_appointments_guardian_id ON appointments(guardian_id);
    END IF;
END $$;

-- Note: child_id is not needed since we use patient_id which will be the child's profile id
-- The guardian_id in appointments tracks who booked the appointment

-- Update RLS policies to allow guardians to view their children's profiles
-- (This assumes you already have RLS policies on profiles)
-- Guardians should be able to view profiles where they are the guardian

-- Ensure id column has a default value (if it doesn't already)
DO $$
BEGIN
    -- Check if id column exists and doesn't have a default
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'id'
        AND column_default IS NULL
    ) THEN
        -- Set default for id column
        ALTER TABLE profiles 
        ALTER COLUMN id SET DEFAULT gen_random_uuid();
    END IF;
END $$;

-- Create RPC function to generate UUID (for use in client code if needed)
CREATE OR REPLACE FUNCTION generate_uuid()
RETURNS UUID AS $$
BEGIN
    RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION generate_uuid() TO authenticated;

-- Note: Children will use their guardian's email address
-- The email column remains NOT NULL, and children inherit their guardian's email

-- Fix foreign key constraint issue for children
-- The profiles.id column may have a foreign key to auth.users(id)
-- Children don't have auth accounts, so we need to remove this constraint
-- This allows profiles to exist independently of auth.users

-- Drop the foreign key constraint if it exists (common constraint names)
DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    -- Find the constraint name
    SELECT tc.constraint_name INTO constraint_name_var
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.table_name = 'profiles'
    AND tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'id'
    AND ccu.table_schema = 'auth'
    AND ccu.table_name = 'users'
    LIMIT 1;
    
    -- Drop the constraint if found
    IF constraint_name_var IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        RAISE NOTICE 'Dropped foreign key constraint: %', constraint_name_var;
    ELSE
        -- Try common constraint names as fallback
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fk;
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS fk_profiles_id;
        RAISE NOTICE 'Attempted to drop common foreign key constraint names';
    END IF;
END $$;

-- Update RLS policies to allow guardians to insert child profiles
-- Guardians should be able to create profiles for their children
DO $$
BEGIN
    -- Check if there's an INSERT policy that might block child profile creation
    -- We'll create a policy that allows guardians to insert profiles with guardian_id set to their own id
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Guardians can insert child profiles'
    ) THEN
        -- Create policy for guardians to insert child profiles
        CREATE POLICY "Guardians can insert child profiles" ON profiles
        FOR INSERT
        TO authenticated
        WITH CHECK (
            -- Allow if guardian_id is set and matches the authenticated user
            (guardian_id IS NOT NULL AND guardian_id = auth.uid())
            OR
            -- Allow if creating own profile (for regular users)
            (id = auth.uid())
        );
        
        RAISE NOTICE 'Created RLS policy: Guardians can insert child profiles';
    END IF;
    
    -- Also ensure guardians can view their children's profiles
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Guardians can view child profiles'
    ) THEN
        CREATE POLICY "Guardians can view child profiles" ON profiles
        FOR SELECT
        TO authenticated
        USING (
            -- Allow viewing own profile
            id = auth.uid()
            OR
            -- Allow viewing profiles where user is the guardian
            (guardian_id IS NOT NULL AND guardian_id = auth.uid())
        );
        
        RAISE NOTICE 'Created RLS policy: Guardians can view child profiles';
    END IF;
END $$;

-- Fix RLS policy for notification_preferences table
-- When a child profile is created, a notification_preferences row might be created via trigger
-- We need to allow guardians to create notification preferences for their children
DO $$
BEGIN
    -- Check if notification_preferences table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notification_preferences'
    ) THEN
        -- Create or update policy to allow guardians to insert notification preferences for children
        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Guardians can insert child notification preferences" ON notification_preferences;
        
        -- Create policy for guardians to insert notification preferences
        -- This allows the trigger to create preferences when a child profile is created
        CREATE POLICY "Guardians can insert child notification preferences" ON notification_preferences
        FOR INSERT
        TO authenticated
        WITH CHECK (
            -- Allow if the user_id matches a child profile where the user is the guardian
            EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = notification_preferences.user_id
                AND profiles.guardian_id = auth.uid()
            )
            OR
            -- Allow if creating own notification preferences
            (user_id = auth.uid())
        );
        
        -- Also allow guardians to view their children's notification preferences
        DROP POLICY IF EXISTS "Guardians can view child notification preferences" ON notification_preferences;
        
        CREATE POLICY "Guardians can view child notification preferences" ON notification_preferences
        FOR SELECT
        TO authenticated
        USING (
            -- Allow viewing own preferences
            user_id = auth.uid()
            OR
            -- Allow viewing preferences for children
            EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = notification_preferences.user_id
                AND profiles.guardian_id = auth.uid()
            )
        );
        
        RAISE NOTICE 'Created RLS policies for notification_preferences table';
    END IF;
END $$;

-- Fix RLS policies for notifications table
-- Allow guardians to create notifications for their children's appointments
DO $$
BEGIN
    -- Check if notifications table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
    ) THEN
        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Guardians can create notifications for children" ON notifications;
        
        -- Create policy for guardians to insert notifications for their children
        -- Also allow system notifications (appointment notifications for admins/doctors)
        CREATE POLICY "Guardians can create notifications for children" ON notifications
        FOR INSERT
        TO authenticated
        WITH CHECK (
            -- Allow if creating notification for own user_id
            (recipient_id = auth.uid())
            OR
            -- Allow if creating notification for a child (where recipient_id is a child's profile and guardian_id matches)
            EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = notifications.recipient_id
                AND profiles.guardian_id = auth.uid()
            )
            OR
            -- Allow if sender_id is the guardian and recipient is their child
            (sender_id = auth.uid() AND EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = notifications.recipient_id
                AND profiles.guardian_id = auth.uid()
            ))
            OR
            -- Allow system notifications (appointment notifications for admins/doctors/staff)
            -- This allows creating notifications for any user when it's a system notification
            (sender_id = auth.uid() AND EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = notifications.recipient_id
                AND profiles.role IN ('admin', 'doctor', 'staff')
            ))
            OR
            -- Allow if category is 'appointment' (appointment-related notifications)
            (notifications.category = 'appointment')
        );
        
        -- Also allow guardians to view notifications for their children
        DROP POLICY IF EXISTS "Guardians can view child notifications" ON notifications;
        
        CREATE POLICY "Guardians can view child notifications" ON notifications
        FOR SELECT
        TO authenticated
        USING (
            -- Allow viewing own notifications
            recipient_id = auth.uid()
            OR
            -- Allow viewing notifications for children
            EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = notifications.recipient_id
                AND profiles.guardian_id = auth.uid()
            )
        );
        
        RAISE NOTICE 'Created RLS policies for notifications table';
    END IF;
END $$;

-- Fix RLS policies for appointment_services table
-- Allow guardians to create appointment services for their children's appointments
DO $$
BEGIN
    -- Check if appointment_services table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'appointment_services'
    ) THEN
        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Guardians can create appointment services for children" ON appointment_services;
        
        -- Create policy for guardians to insert appointment services
        CREATE POLICY "Guardians can create appointment services for children" ON appointment_services
        FOR INSERT
        TO authenticated
        WITH CHECK (
            -- Allow if the appointment belongs to the guardian or their child
            EXISTS (
                SELECT 1 FROM appointments
                JOIN profiles ON profiles.id = appointments.patient_id
                WHERE appointments.id = appointment_services.appointment_id
                AND (
                    -- Appointment is for the guardian
                    appointments.patient_id = auth.uid()
                    OR
                    -- Appointment is for a child where guardian_id matches
                    (profiles.guardian_id = auth.uid())
                    OR
                    -- Appointment has guardian_id set and it matches
                    (appointments.guardian_id = auth.uid())
                )
            )
        );
        
        -- Also allow guardians to view appointment services for their children's appointments
        DROP POLICY IF EXISTS "Guardians can view child appointment services" ON appointment_services;
        
        CREATE POLICY "Guardians can view child appointment services" ON appointment_services
        FOR SELECT
        TO authenticated
        USING (
            -- Allow viewing appointment services for own appointments or children's appointments
            EXISTS (
                SELECT 1 FROM appointments
                JOIN profiles ON profiles.id = appointments.patient_id
                WHERE appointments.id = appointment_services.appointment_id
                AND (
                    appointments.patient_id = auth.uid()
                    OR profiles.guardian_id = auth.uid()
                    OR appointments.guardian_id = auth.uid()
                )
            )
        );
        
        RAISE NOTICE 'Created RLS policies for appointment_services table';
    END IF;
END $$;

-- Fix RLS policies for appointments table (if needed)
-- Ensure guardians can create appointments for their children
DO $$
BEGIN
    -- Check if appointments table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'appointments'
    ) THEN
        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Guardians can create appointments for children" ON appointments;
        
        -- Create policy for guardians to insert appointments for their children
        CREATE POLICY "Guardians can create appointments for children" ON appointments
        FOR INSERT
        TO authenticated
        WITH CHECK (
            -- Allow if creating appointment for self
            (patient_id = auth.uid())
            OR
            -- Allow if creating appointment for a child (patient_id is child's profile and guardian_id matches)
            EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = appointments.patient_id
                AND profiles.guardian_id = auth.uid()
            )
            OR
            -- Allow if guardian_id is set and matches (for child appointments)
            (guardian_id = auth.uid())
        );
        
        -- Also ensure guardians can view their children's appointments
        DROP POLICY IF EXISTS "Guardians can view child appointments" ON appointments;
        
        CREATE POLICY "Guardians can view child appointments" ON appointments
        FOR SELECT
        TO authenticated
        USING (
            -- Allow viewing own appointments
            patient_id = auth.uid()
            OR
            -- Allow viewing appointments for children
            EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = appointments.patient_id
                AND profiles.guardian_id = auth.uid()
            )
            OR
            -- Allow viewing appointments where guardian_id matches
            (guardian_id = auth.uid())
        );
        
        RAISE NOTICE 'Created RLS policies for appointments table';
    END IF;
END $$;

-- Grant necessary permissions (if not already granted)
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON appointments TO authenticated;
GRANT SELECT, INSERT ON appointment_services TO authenticated;
GRANT SELECT, INSERT ON notifications TO authenticated;

