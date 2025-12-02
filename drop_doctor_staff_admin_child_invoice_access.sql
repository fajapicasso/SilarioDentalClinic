-- ============================================================================
-- DROP DOCTOR, STAFF, AND ADMIN CHILD INVOICE ACCESS POLICIES
-- ============================================================================
-- This script removes the RLS policies created for doctors, staff, and admin
-- to access child invoices. Use this to revert the changes.
-- ============================================================================

-- ============================================================================
-- PART 1: Drop RLS Policies for Invoices Table
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'invoices'
    ) THEN
        -- Drop all policies created by the doctor_staff_admin_child_invoice_access script
        DROP POLICY IF EXISTS "Doctors can view all invoices" ON invoices;
        DROP POLICY IF EXISTS "Staff can view all invoices" ON invoices;
        DROP POLICY IF EXISTS "Admin can view all invoices" ON invoices;
        DROP POLICY IF EXISTS "Doctors staff admin can view child invoices" ON invoices;
        DROP POLICY IF EXISTS "Doctors staff admin can create invoices" ON invoices;
        DROP POLICY IF EXISTS "Doctors staff admin can update invoices" ON invoices;
        
        RAISE NOTICE 'Dropped RLS policies for invoices table';
    ELSE
        RAISE NOTICE 'invoices table does not exist - skipping';
    END IF;
END $$;

-- ============================================================================
-- PART 2: Drop RLS Policies for Invoice Items Table
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'invoice_items'
    ) THEN
        -- Drop all policies created by the doctor_staff_admin_child_invoice_access script
        DROP POLICY IF EXISTS "Doctors staff admin can view invoice items" ON invoice_items;
        DROP POLICY IF EXISTS "Doctors staff admin can manage invoice items" ON invoice_items;
        
        RAISE NOTICE 'Dropped RLS policies for invoice_items table';
    ELSE
        RAISE NOTICE 'invoice_items table does not exist - skipping';
    END IF;
END $$;

-- ============================================================================
-- PART 3: Drop RLS Policies for Payments Table
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payments'
    ) THEN
        -- Drop all policies created by the doctor_staff_admin_child_invoice_access script
        DROP POLICY IF EXISTS "Doctors staff admin can view all payments" ON payments;
        DROP POLICY IF EXISTS "Doctors staff admin can manage payments" ON payments;
        
        RAISE NOTICE 'Dropped RLS policies for payments table';
    ELSE
        RAISE NOTICE 'payments table does not exist - skipping';
    END IF;
END $$;

-- ============================================================================
-- PART 4: Drop RLS Policies for Profiles Table
-- ============================================================================

DO $$
BEGIN
    -- Drop policy created by the doctor_staff_admin_child_invoice_access script
    DROP POLICY IF EXISTS "Doctors staff admin can view all profiles" ON profiles;
    
    RAISE NOTICE 'Dropped RLS policy for profiles table';
END $$;

-- ============================================================================
-- PART 5: Revoke Permissions (Optional - only if you want to remove grants)
-- ============================================================================
-- Uncomment the following lines if you want to revoke the granted permissions
-- 
-- REVOKE SELECT, INSERT, UPDATE ON invoices FROM authenticated;
-- REVOKE SELECT, INSERT, UPDATE, DELETE ON invoice_items FROM authenticated;
-- REVOKE SELECT, INSERT, UPDATE ON payments FROM authenticated;
-- REVOKE SELECT ON profiles FROM authenticated;

-- ============================================================================
-- Final notification
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'DOCTOR, STAFF, AND ADMIN CHILD INVOICE ACCESS POLICIES DROPPED';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'All RLS policies created by doctor_staff_admin_child_invoice_access.sql have been removed.';
    RAISE NOTICE 'Note: The guardian_id column in profiles table is NOT removed by this script.';
    RAISE NOTICE 'If you want to remove it, you need to do it manually.';
    RAISE NOTICE '============================================================================';
END $$;

