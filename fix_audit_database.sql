-- Fix Audit Database Issues
-- This file fixes the existing policy conflicts and ensures audit logs work properly

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins can update audit logs" ON audit_logs;

DROP POLICY IF EXISTS "Everyone can view audit categories" ON audit_log_categories;
DROP POLICY IF EXISTS "Admins can manage audit categories" ON audit_log_categories;

DROP POLICY IF EXISTS "Everyone can view audit actions" ON audit_log_actions;
DROP POLICY IF EXISTS "Admins can manage audit actions" ON audit_log_actions;

DROP POLICY IF EXISTS "Admins can view all reports" ON audit_log_reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON audit_log_reports;
DROP POLICY IF EXISTS "Admins can manage reports" ON audit_log_reports;

DROP POLICY IF EXISTS "Admins can manage audit settings" ON audit_log_settings;

-- Recreate the policies with proper names
CREATE POLICY "audit_logs_admin_view" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "audit_logs_user_view" ON audit_logs
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "audit_logs_system_insert" ON audit_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "audit_logs_admin_update" ON audit_logs
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Categories policies
CREATE POLICY "audit_categories_view" ON audit_log_categories
    FOR SELECT USING (true);

CREATE POLICY "audit_categories_admin_manage" ON audit_log_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Actions policies
CREATE POLICY "audit_actions_view" ON audit_log_actions
    FOR SELECT USING (true);

CREATE POLICY "audit_actions_admin_manage" ON audit_log_actions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Reports policies
CREATE POLICY "audit_reports_admin_view" ON audit_log_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "audit_reports_user_view" ON audit_log_reports
    FOR SELECT USING (
        generated_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "audit_reports_admin_manage" ON audit_log_reports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Settings policies
CREATE POLICY "audit_settings_admin_manage" ON audit_log_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Fix the audit trigger function to handle user context properly
CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER AS $$
DECLARE
    table_name TEXT := TG_TABLE_NAME;
    operation TEXT := TG_OP;
    old_data JSONB;
    new_data JSONB;
    resource_name TEXT;
    module_name TEXT;
    section_name TEXT;
    current_user_id UUID;
    current_user_name TEXT;
    current_user_role TEXT;
BEGIN
    -- Get current user information
    current_user_id := auth.uid();
    
    -- Get user profile information
    IF current_user_id IS NOT NULL THEN
        SELECT full_name, role INTO current_user_name, current_user_role
        FROM profiles 
        WHERE id = current_user_id;
    END IF;
    
    -- Set defaults if user info not found
    current_user_name := COALESCE(current_user_name, 'System');
    current_user_role := COALESCE(current_user_role, 'system');

    -- Convert OLD and NEW to JSONB
    IF TG_OP = 'DELETE' THEN
        old_data := to_jsonb(OLD);
        new_data := NULL;
        resource_name := COALESCE(OLD.full_name, OLD.name, OLD.title, OLD.email, OLD.id::TEXT);
    ELSIF TG_OP = 'INSERT' THEN
        old_data := NULL;
        new_data := to_jsonb(NEW);
        resource_name := COALESCE(NEW.full_name, NEW.name, NEW.title, NEW.email, NEW.id::TEXT);
    ELSE -- UPDATE
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
        resource_name := COALESCE(NEW.full_name, NEW.name, NEW.title, NEW.email, NEW.id::TEXT);
    END IF;

    -- Determine module and section based on table name
    CASE table_name
        WHEN 'profiles' THEN
            module_name := 'user_management';
            section_name := 'users';
        WHEN 'appointments' THEN
            module_name := 'appointments';
            section_name := 'scheduling';
        WHEN 'payments' THEN
            module_name := 'payments';
            section_name := 'billing';
        WHEN 'services' THEN
            module_name := 'services';
            section_name := 'management';
        WHEN 'queue' THEN
            module_name := 'queue';
            section_name := 'management';
        WHEN 'treatments' THEN
            module_name := 'medical_records';
            section_name := 'treatments';
        WHEN 'medical_records' THEN
            module_name := 'medical_records';
            section_name := 'records';
        WHEN 'notifications' THEN
            module_name := 'notifications';
            section_name := 'management';
        WHEN 'schedules' THEN
            module_name := 'schedules';
            section_name := 'management';
        WHEN 'invoices' THEN
            module_name := 'payments';
            section_name := 'invoicing';
        WHEN 'prescriptions' THEN
            module_name := 'medical_records';
            section_name := 'prescriptions';
        WHEN 'dental_charts' THEN
            module_name := 'medical_records';
            section_name := 'charts';
        WHEN 'lab_results' THEN
            module_name := 'medical_records';
            section_name := 'lab_results';
        WHEN 'inventory' THEN
            module_name := 'inventory';
            section_name := 'management';
        WHEN 'supplies' THEN
            module_name := 'inventory';
            section_name := 'supplies';
        ELSE
            module_name := 'system';
            section_name := 'data';
    END CASE;

    -- Log the change
    INSERT INTO audit_logs (
        user_id, user_name, user_role, action, module, section,
        resource_type, resource_id, resource_name,
        old_values, new_values, success, metadata
    ) VALUES (
        current_user_id,
        current_user_name,
        current_user_role,
        CASE 
            WHEN TG_OP = 'INSERT' THEN table_name || '_create'
            WHEN TG_OP = 'UPDATE' THEN table_name || '_update'
            WHEN TG_OP = 'DELETE' THEN table_name || '_delete'
        END,
        module_name,
        section_name,
        table_name,
        COALESCE(NEW.id, OLD.id),
        resource_name,
        old_data,
        new_data,
        true,
        jsonb_build_object(
            'operation', TG_OP, 
            'table', table_name,
            'timestamp', NOW(),
            'trigger_source', 'database_trigger',
            'user_context', current_user_id
        )
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a test function to manually insert audit logs
CREATE OR REPLACE FUNCTION test_audit_log_insert()
RETURNS void AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id, user_name, user_role, action, module, section,
        resource_type, resource_id, resource_name,
        new_values, success, metadata
    ) VALUES (
        auth.uid(),
        'Test User',
        'admin',
        'test_action',
        'testing',
        'test_section',
        'test_resource',
        gen_random_uuid(),
        'Test Resource',
        '{"test": "data"}',
        true,
        jsonb_build_object('test', true, 'timestamp', NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION test_audit_log_insert() TO authenticated;
GRANT EXECUTE ON FUNCTION audit_table_changes() TO authenticated;

-- Test the audit system by inserting a test log
SELECT test_audit_log_insert();

-- Check if audit logs are being created
SELECT COUNT(*) as total_audit_logs FROM audit_logs;

-- Show recent audit logs
SELECT 
    user_name,
    action,
    module,
    resource_name,
    timestamp,
    success
FROM audit_logs 
ORDER BY timestamp DESC 
LIMIT 10;
