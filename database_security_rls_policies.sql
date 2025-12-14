-- =====================================================
-- COMPREHENSIVE ROW LEVEL SECURITY (RLS) POLICIES
-- For Data Protection and Privacy
-- =====================================================
-- Run this SQL in your Supabase SQL Editor to secure all data
-- This ensures users can only see their own data
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dental_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS treatment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS patient_files ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES TABLE - Users can only see their own profile
-- =====================================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- Admins, doctors, and staff can view all profiles (for system operations)
DROP POLICY IF EXISTS "Staff can view all profiles" ON profiles;
CREATE POLICY "Staff can view all profiles"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- =====================================================
-- APPOINTMENTS TABLE - Patients see only their own appointments
-- =====================================================
DROP POLICY IF EXISTS "Patients can view own appointments" ON appointments;
CREATE POLICY "Patients can view own appointments"
ON appointments FOR SELECT
USING (
  patient_id = auth.uid() 
  OR guardian_id = auth.uid()
);

DROP POLICY IF EXISTS "Patients can create own appointments" ON appointments;
CREATE POLICY "Patients can create own appointments"
ON appointments FOR INSERT
WITH CHECK (patient_id = auth.uid());

DROP POLICY IF EXISTS "Patients can update own appointments" ON appointments;
CREATE POLICY "Patients can update own appointments"
ON appointments FOR UPDATE
USING (patient_id = auth.uid() OR guardian_id = auth.uid())
WITH CHECK (patient_id = auth.uid() OR guardian_id = auth.uid());

-- Staff, doctors, and admins can view all appointments
DROP POLICY IF EXISTS "Staff can view all appointments" ON appointments;
CREATE POLICY "Staff can view all appointments"
ON appointments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- Staff, doctors, and admins can manage appointments
DROP POLICY IF EXISTS "Staff can manage appointments" ON appointments;
CREATE POLICY "Staff can manage appointments"
ON appointments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- =====================================================
-- SERVICES TABLE - Public read, admin write
-- =====================================================
-- Services are public (patients need to see them to book)
-- But only admins can modify them
DROP POLICY IF EXISTS "Anyone can view services" ON services;
CREATE POLICY "Anyone can view services"
ON services FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Only admins can modify services" ON services;
CREATE POLICY "Only admins can modify services"
ON services FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- =====================================================
-- APPOINTMENT_SERVICES TABLE - Patients see only their appointment services
-- =====================================================
DROP POLICY IF EXISTS "Patients can view own appointment services" ON appointment_services;
CREATE POLICY "Patients can view own appointment services"
ON appointment_services FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM appointments
    WHERE appointments.id = appointment_services.appointment_id
    AND (appointments.patient_id = auth.uid() OR appointments.guardian_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Patients can create own appointment services" ON appointment_services;
CREATE POLICY "Patients can create own appointment services"
ON appointment_services FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM appointments
    WHERE appointments.id = appointment_services.appointment_id
    AND appointments.patient_id = auth.uid()
  )
);

-- Staff can view all appointment services
DROP POLICY IF EXISTS "Staff can view all appointment services" ON appointment_services;
CREATE POLICY "Staff can view all appointment services"
ON appointment_services FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- Staff can manage appointment services
DROP POLICY IF EXISTS "Staff can manage appointment services" ON appointment_services;
CREATE POLICY "Staff can manage appointment services"
ON appointment_services FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- =====================================================
-- INVOICES TABLE - Patients see only their own invoices
-- =====================================================
DROP POLICY IF EXISTS "Patients can view own invoices" ON invoices;
CREATE POLICY "Patients can view own invoices"
ON invoices FOR SELECT
USING (
  patient_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM appointments
    WHERE appointments.id = invoices.appointment_id
    AND appointments.guardian_id = auth.uid()
  )
);

-- Staff can view all invoices
DROP POLICY IF EXISTS "Staff can view all invoices" ON invoices;
CREATE POLICY "Staff can view all invoices"
ON invoices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- Staff can manage invoices
DROP POLICY IF EXISTS "Staff can manage invoices" ON invoices;
CREATE POLICY "Staff can manage invoices"
ON invoices FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- =====================================================
-- PAYMENTS TABLE - Patients see only their own payments
-- =====================================================
DROP POLICY IF EXISTS "Patients can view own payments" ON payments;
CREATE POLICY "Patients can view own payments"
ON payments FOR SELECT
USING (
  patient_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = payments.invoice_id
    AND (
      invoices.patient_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM appointments
        WHERE appointments.id = invoices.appointment_id
        AND appointments.guardian_id = auth.uid()
      )
    )
  )
);

-- Staff can view all payments
DROP POLICY IF EXISTS "Staff can view all payments" ON payments;
CREATE POLICY "Staff can view all payments"
ON payments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- Staff can manage payments
DROP POLICY IF EXISTS "Staff can manage payments" ON payments;
CREATE POLICY "Staff can manage payments"
ON payments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- =====================================================
-- QUEUE TABLE - Patients see only their own queue entries
-- =====================================================
DROP POLICY IF EXISTS "Patients can view own queue entries" ON queue;
CREATE POLICY "Patients can view own queue entries"
ON queue FOR SELECT
USING (patient_id = auth.uid());

-- Staff can view all queue entries
DROP POLICY IF EXISTS "Staff can view all queue entries" ON queue;
CREATE POLICY "Staff can view all queue entries"
ON queue FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- Staff can manage queue
DROP POLICY IF EXISTS "Staff can manage queue" ON queue;
CREATE POLICY "Staff can manage queue"
ON queue FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- =====================================================
-- NOTIFICATIONS TABLE - Users see only their own notifications
-- =====================================================
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
ON notifications FOR DELETE
USING (user_id = auth.uid());

-- Staff can create notifications for any user
DROP POLICY IF EXISTS "Staff can create notifications" ON notifications;
CREATE POLICY "Staff can create notifications"
ON notifications FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- =====================================================
-- AUDIT_LOGS TABLE - Only admins can view audit logs
-- =====================================================
DROP POLICY IF EXISTS "Only admins can view audit logs" ON audit_logs;
CREATE POLICY "Only admins can view audit logs"
ON audit_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- System can insert audit logs (via service role)
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "System can insert audit logs"
ON audit_logs FOR INSERT
WITH CHECK (true);

-- =====================================================
-- DENTAL_CHARTS TABLE - Patients see only their own charts
-- =====================================================
DROP POLICY IF EXISTS "Patients can view own dental charts" ON dental_charts;
CREATE POLICY "Patients can view own dental charts"
ON dental_charts FOR SELECT
USING (
  patient_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM appointments
    WHERE appointments.patient_id = dental_charts.patient_id
    AND appointments.guardian_id = auth.uid()
  )
);

-- Staff can view all dental charts
DROP POLICY IF EXISTS "Staff can view all dental charts" ON dental_charts;
CREATE POLICY "Staff can view all dental charts"
ON dental_charts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- Staff can manage dental charts
DROP POLICY IF EXISTS "Staff can manage dental charts" ON dental_charts;
CREATE POLICY "Staff can manage dental charts"
ON dental_charts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- =====================================================
-- TREATMENT_HISTORY TABLE - Patients see only their own treatments
-- =====================================================
DROP POLICY IF EXISTS "Patients can view own treatment history" ON treatment_history;
CREATE POLICY "Patients can view own treatment history"
ON treatment_history FOR SELECT
USING (
  patient_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM appointments
    WHERE appointments.patient_id = treatment_history.patient_id
    AND appointments.guardian_id = auth.uid()
  )
);

-- Staff can view all treatment history
DROP POLICY IF EXISTS "Staff can view all treatment history" ON treatment_history;
CREATE POLICY "Staff can view all treatment history"
ON treatment_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- Staff can manage treatment history
DROP POLICY IF EXISTS "Staff can manage treatment history" ON treatment_history;
CREATE POLICY "Staff can manage treatment history"
ON treatment_history FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- =====================================================
-- PATIENT_FILES TABLE - Patients see only their own files
-- =====================================================
DROP POLICY IF EXISTS "Patients can view own files" ON patient_files;
CREATE POLICY "Patients can view own files"
ON patient_files FOR SELECT
USING (
  patient_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM appointments
    WHERE appointments.patient_id = patient_files.patient_id
    AND appointments.guardian_id = auth.uid()
  )
);

-- Staff can view all patient files
DROP POLICY IF EXISTS "Staff can view all patient files" ON patient_files;
CREATE POLICY "Staff can view all patient files"
ON patient_files FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- Staff can manage patient files
DROP POLICY IF EXISTS "Staff can manage patient files" ON patient_files;
CREATE POLICY "Staff can manage patient files"
ON patient_files FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'doctor', 'staff')
  )
);

-- =====================================================
-- ADDITIONAL SECURITY: Prevent data exposure in responses
-- =====================================================

-- Create a function to sanitize sensitive data (optional)
-- This can be used in views if needed
CREATE OR REPLACE FUNCTION sanitize_user_data(data jsonb)
RETURNS jsonb AS $$
BEGIN
  -- Remove sensitive fields if needed
  RETURN data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION QUERIES (Run these to test RLS)
-- =====================================================

-- Test 1: Check if RLS is enabled
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('profiles', 'appointments', 'services', 'appointment_services');

-- Test 2: Check existing policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- =====================================================
-- IMPORTANT NOTES:
-- =====================================================
-- 1. These policies ensure users can ONLY see their own data
-- 2. Network requests will still appear in browser Network tab (this is normal)
-- 3. But the actual data returned will be filtered by RLS policies
-- 4. Patients cannot see other patients' data
-- 5. Staff/Doctors/Admins can see all data (for system operations)
-- 6. Services are public (patients need to see them to book appointments)
-- =====================================================

