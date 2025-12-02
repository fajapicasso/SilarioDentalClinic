-- ============================================================================
-- COMPLETE GUARDIAN AND INVOICE ACCESS SETUP
-- ============================================================================
-- This script sets up everything needed for guardians to manage invoices
-- for their children/minors in the patient/guardian side
-- ============================================================================

-- ============================================================================
-- PART 1: Add guardian_id to profiles and appointments tables
-- ============================================================================

-- Add guardian_id column to profiles table for linking children to guardians
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
        
        COMMENT ON COLUMN profiles.guardian_id IS 'References the guardian/parent profile. NULL for adults, set for minors.';
        
        RAISE NOTICE 'Added guardian_id column to profiles table';
    ELSE
        RAISE NOTICE 'guardian_id column already exists in profiles table';
    END IF;
END $$;

-- Add guardian_id column to appointments table
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
        
        RAISE NOTICE 'Added guardian_id column to appointments table';
    ELSE
        RAISE NOTICE 'guardian_id column already exists in appointments table';
    END IF;
END $$;

-- ============================================================================
-- PART 2: RLS Policies for Invoices Table
-- ============================================================================
-- This is the KEY part - allows guardians to view invoices for their children

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'invoices'
    ) THEN
        -- Enable RLS on invoices table if not already enabled
        ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Guardians can view invoices for children" ON invoices;
        DROP POLICY IF EXISTS "Patients can view own invoices" ON invoices;
        DROP POLICY IF EXISTS "Guardians can view child invoices" ON invoices;
        
        -- Create policy for guardians to view invoices for their children
        -- This is CRITICAL - allows guardians to see invoices where patient_id is a child's profile
        CREATE POLICY "Guardians can view invoices for children" ON invoices
        FOR SELECT
        TO authenticated
        USING (
            -- Allow viewing own invoices (where patient_id matches user's id)
            (patient_id = auth.uid())
            OR
            -- Allow viewing invoices for children (where patient_id is a child's profile and guardian_id matches)
            EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = invoices.patient_id
                AND profiles.guardian_id = auth.uid()
            )
        );
        
        RAISE NOTICE 'Created RLS policy: Guardians can view invoices for children';
        
        -- Also ensure patients can view their own invoices (backup policy)
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'invoices' 
            AND policyname = 'Patients can view own invoices'
        ) THEN
            CREATE POLICY "Patients can view own invoices" ON invoices
            FOR SELECT
            TO authenticated
            USING (patient_id = auth.uid());
            
            RAISE NOTICE 'Created RLS policy: Patients can view own invoices';
        END IF;
    ELSE
        RAISE NOTICE 'invoices table does not exist - skipping invoice policies';
    END IF;
END $$;

-- ============================================================================
-- PART 3: RLS Policies for Invoice Items Table
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'invoice_items'
    ) THEN
        -- Enable RLS on invoice_items table if not already enabled
        ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Guardians can view child invoice items" ON invoice_items;
        
        -- Create policy for guardians to view invoice items for their children's invoices
        CREATE POLICY "Guardians can view child invoice items" ON invoice_items
        FOR SELECT
        TO authenticated
        USING (
            -- Allow viewing invoice items for own invoices or children's invoices
            EXISTS (
                SELECT 1 FROM invoices
                JOIN profiles ON profiles.id = invoices.patient_id
                WHERE invoices.id = invoice_items.invoice_id
                AND (
                    invoices.patient_id = auth.uid()
                    OR profiles.guardian_id = auth.uid()
                )
            )
        );
        
        RAISE NOTICE 'Created RLS policy: Guardians can view child invoice items';
    ELSE
        RAISE NOTICE 'invoice_items table does not exist - skipping invoice_items policies';
    END IF;
END $$;

-- ============================================================================
-- PART 4: RLS Policies for Payments Table
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payments'
    ) THEN
        -- Enable RLS on payments table if not already enabled
        ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Guardians can view child payments" ON payments;
        DROP POLICY IF EXISTS "Guardians can create payments for children" ON payments;
        
        -- Create policy for guardians to view payments for their children's invoices
        CREATE POLICY "Guardians can view child payments" ON payments
        FOR SELECT
        TO authenticated
        USING (
            -- Allow viewing payments for own invoices or children's invoices
            EXISTS (
                SELECT 1 FROM invoices
                JOIN profiles ON profiles.id = invoices.patient_id
                WHERE invoices.id = payments.invoice_id
                AND (
                    invoices.patient_id = auth.uid()
                    OR profiles.guardian_id = auth.uid()
                )
            )
            OR
            -- Allow viewing payments created by the guardian
            (created_by = auth.uid())
        );
        
        -- Create policy for guardians to create payments for their children's invoices
        CREATE POLICY "Guardians can create payments for children" ON payments
        FOR INSERT
        TO authenticated
        WITH CHECK (
            -- Allow creating payments for own invoices
            EXISTS (
                SELECT 1 FROM invoices
                WHERE invoices.id = payments.invoice_id
                AND invoices.patient_id = auth.uid()
            )
            OR
            -- Allow creating payments for children's invoices
            EXISTS (
                SELECT 1 FROM invoices
                JOIN profiles ON profiles.id = invoices.patient_id
                WHERE invoices.id = payments.invoice_id
                AND profiles.guardian_id = auth.uid()
            )
            OR
            -- Allow if created_by matches the guardian
            (created_by = auth.uid())
        );
        
        RAISE NOTICE 'Created RLS policies for payments table';
    ELSE
        RAISE NOTICE 'payments table does not exist - skipping payments policies';
    END IF;
END $$;

-- ============================================================================
-- PART 5: RLS Policies for Profiles Table
-- ============================================================================

DO $$
BEGIN
    -- Enable RLS on profiles table if not already enabled
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Guardians can insert child profiles" ON profiles;
    DROP POLICY IF EXISTS "Guardians can view child profiles" ON profiles;
    
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
    
    -- Create policy for guardians to view their children's profiles
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
    
    RAISE NOTICE 'Created RLS policies for profiles table';
END $$;

-- ============================================================================
-- PART 6: RLS Policies for Appointments Table
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'appointments'
    ) THEN
        -- Enable RLS on appointments table if not already enabled
        ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Guardians can create appointments for children" ON appointments;
        DROP POLICY IF EXISTS "Guardians can view child appointments" ON appointments;
        
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
        
        -- Create policy for guardians to view their children's appointments
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
    ELSE
        RAISE NOTICE 'appointments table does not exist - skipping appointments policies';
    END IF;
END $$;

-- ============================================================================
-- PART 7: Grant Permissions
-- ============================================================================

-- Grant necessary permissions
GRANT SELECT ON invoices TO authenticated;
GRANT SELECT ON invoice_items TO authenticated;
GRANT SELECT, INSERT ON payments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON appointments TO authenticated;

-- ============================================================================
-- PART 8: Add Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN profiles.guardian_id IS 'References the guardian/parent profile. NULL for adults, set for minors. Children share the guardian''s email account.';
COMMENT ON COLUMN appointments.guardian_id IS 'References the guardian who booked the appointment. Set when booking for a child/minor.';

-- ============================================================================
-- VERIFICATION QUERIES (for testing - can be run separately)
-- ============================================================================

-- To verify the setup, you can run these queries:
-- 
-- 1. Check if guardian_id column exists:
--    SELECT column_name, data_type FROM information_schema.columns 
--    WHERE table_name = 'profiles' AND column_name = 'guardian_id';
--
-- 2. Check RLS policies on invoices:
--    SELECT * FROM pg_policies WHERE tablename = 'invoices';
--
-- 3. Check if you can see child invoices (run as guardian user):
--    SELECT i.*, p.full_name as patient_name, p.guardian_id 
--    FROM invoices i
--    JOIN profiles p ON p.id = i.patient_id
--    WHERE p.guardian_id = auth.uid();

RAISE NOTICE '============================================================================';
RAISE NOTICE 'GUARDIAN INVOICE ACCESS SETUP COMPLETE';
RAISE NOTICE '============================================================================';
RAISE NOTICE 'Guardians can now view and manage invoices for their children.';
RAISE NOTICE 'Make sure children profiles have guardian_id set to the guardian''s profile id.';
RAISE NOTICE '============================================================================';

