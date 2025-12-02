-- Add guardian access to invoices table for guardians to view their children's invoices
-- This allows guardians/patients to fetch invoices for both themselves and their children

-- First, ensure guardian_id column exists in profiles table (from the provided script)
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
    END IF;
END $$;

-- Add RLS policies for invoices table to allow guardians to view their children's invoices
DO $$
BEGIN
    -- Check if invoices table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'invoices'
    ) THEN
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Guardians can view child invoices" ON invoices;
        DROP POLICY IF EXISTS "Patients can view own invoices" ON invoices;
        DROP POLICY IF EXISTS "Guardians can view invoices for children" ON invoices;
        
        -- Create policy for guardians to view invoices for their children
        -- This allows guardians to see invoices where the patient_id is a child's profile
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
        
        -- Also ensure patients can view their own invoices (if not already covered)
        -- This is a fallback in case the above policy doesn't cover all cases
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
    END IF;
END $$;

-- Add RLS policies for invoice_items table to allow guardians to view invoice items for their children's invoices
DO $$
BEGIN
    -- Check if invoice_items table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'invoice_items'
    ) THEN
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
    END IF;
END $$;

-- Add RLS policies for payments table to allow guardians to view and create payments for their children's invoices
DO $$
BEGIN
    -- Check if payments table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payments'
    ) THEN
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
    END IF;
END $$;

-- Grant necessary permissions
GRANT SELECT ON invoices TO authenticated;
GRANT SELECT ON invoice_items TO authenticated;
GRANT SELECT, INSERT ON payments TO authenticated;

-- Add comment explaining the setup
COMMENT ON TABLE invoices IS 'Invoices table. Guardians can view invoices for their children via RLS policies.';
COMMENT ON TABLE invoice_items IS 'Invoice items table. Guardians can view items for their children''s invoices via RLS policies.';
COMMENT ON TABLE payments IS 'Payments table. Guardians can view and create payments for their children''s invoices via RLS policies.';

