-- setup_audit_database.sql - Set up audit log database schema
-- Run this script in your Supabase SQL editor to create the audit log tables

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    module VARCHAR(100) NOT NULL,
    section VARCHAR(100),
    resource_type VARCHAR(100),
    resource_id UUID,
    resource_name VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_role ON audit_logs(user_role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module_timestamp ON audit_logs(module, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_timestamp ON audit_logs(action, timestamp);

-- Create audit_log_categories table for categorization
CREATE TABLE IF NOT EXISTS audit_log_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7), -- Hex color code
    icon VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO audit_log_categories (category_name, description, color, icon) VALUES
('user_management', 'User account operations', '#3B82F6', 'users'),
('appointments', 'Appointment management', '#10B981', 'calendar'),
('payments', 'Payment processing', '#F59E0B', 'credit-card'),
('services', 'Service management', '#8B5CF6', 'settings'),
('queue', 'Queue management', '#EF4444', 'users'),
('medical_records', 'Medical record operations', '#06B6D4', 'file-text'),
('system', 'System operations', '#6B7280', 'server'),
('security', 'Security events', '#DC2626', 'shield'),
('billing', 'Billing operations', '#059669', 'dollar-sign'),
('inventory', 'Inventory management', '#7C3AED', 'package')
ON CONFLICT (category_name) DO NOTHING;

-- Create audit_log_actions table for action definitions
CREATE TABLE IF NOT EXISTS audit_log_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category_id UUID REFERENCES audit_log_categories(id),
    severity VARCHAR(20) DEFAULT 'normal', -- low, normal, high, critical
    requires_approval BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default actions
INSERT INTO audit_log_actions (action_name, description, severity, requires_approval) VALUES
-- User Management Actions
('user_create', 'Create new user account', 'high', true),
('user_update', 'Update user information', 'normal', false),
('user_delete', 'Delete user account', 'critical', true),
('user_approve', 'Approve user account', 'high', false),
('user_disable', 'Disable user account', 'high', true),
('user_enable', 'Enable user account', 'normal', false),
('user_login', 'User login', 'normal', false),
('user_logout', 'User logout', 'low', false),
('password_change', 'Password change', 'high', false),
('password_reset', 'Password reset', 'high', false),

-- Appointment Actions
('appointment_create', 'Create appointment', 'normal', false),
('appointment_update', 'Update appointment', 'normal', false),
('appointment_cancel', 'Cancel appointment', 'normal', false),
('appointment_reschedule', 'Reschedule appointment', 'normal', false),
('appointment_approve', 'Approve appointment', 'normal', false),
('appointment_reject', 'Reject appointment', 'normal', false),
('appointment_status_change', 'Change appointment status', 'normal', false),
('appointment_confirm', 'Confirm appointment', 'normal', false),
('appointment_complete', 'Complete appointment', 'normal', false),

-- Payment Actions
('payment_create', 'Create payment', 'normal', false),
('payment_update', 'Update payment', 'high', false),
('payment_approve', 'Approve payment', 'high', false),
('payment_reject', 'Reject payment', 'high', false),
('payment_refund', 'Process refund', 'critical', true),

-- Service Actions
('service_create', 'Create service', 'normal', false),
('service_update', 'Update service', 'normal', false),
('service_delete', 'Delete service', 'high', true),
('service_pricing_update', 'Update service pricing', 'high', false),

-- Queue Actions
('queue_add', 'Add patient to queue', 'normal', false),
('queue_remove', 'Remove patient from queue', 'normal', false),
('queue_update_status', 'Update queue status', 'normal', false),

-- Medical Record Actions
('record_create', 'Create medical record', 'normal', false),
('record_update', 'Update medical record', 'high', false),
('record_delete', 'Delete medical record', 'critical', true),
('treatment_add', 'Add treatment', 'normal', false),
('treatment_update', 'Update treatment', 'normal', false),

-- System Actions
('system_backup', 'System backup', 'normal', false),
('system_restore', 'System restore', 'critical', true),
('system_config_update', 'Update system configuration', 'high', true),
('database_migration', 'Database migration', 'critical', true),

-- Security Actions
('security_login_failed', 'Failed login attempt', 'high', false),
('security_account_locked', 'Account locked', 'high', false),
('security_permission_denied', 'Permission denied', 'high', false),
('security_data_export', 'Data export', 'high', false),
('security_data_import', 'Data import', 'high', false)
ON CONFLICT (action_name) DO NOTHING;

-- Create audit_log_reports table for report generation
CREATE TABLE IF NOT EXISTS audit_log_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL, -- daily, weekly, monthly, custom
    generated_by UUID REFERENCES profiles(id),
    date_from TIMESTAMP WITH TIME ZONE,
    date_to TIMESTAMP WITH TIME ZONE,
    filters JSONB,
    total_records INTEGER DEFAULT 0,
    file_path VARCHAR(500),
    file_size BIGINT,
    status VARCHAR(20) DEFAULT 'generating', -- generating, completed, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create audit_log_settings table for configuration
CREATE TABLE IF NOT EXISTS audit_log_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO audit_log_settings (setting_key, setting_value, description) VALUES
('retention_days', '365', 'Number of days to retain audit logs'),
('log_failed_attempts', 'true', 'Whether to log failed login attempts'),
('log_sensitive_data', 'false', 'Whether to log sensitive data changes'),
('auto_cleanup', 'true', 'Whether to automatically clean up old logs'),
('notification_threshold', '10', 'Number of failed attempts before notification'),
('export_formats', '["pdf", "excel", "csv"]', 'Available export formats'),
('max_report_records', '10000', 'Maximum records per report')
ON CONFLICT (setting_key) DO NOTHING;

-- Create function to get audit log statistics
CREATE OR REPLACE FUNCTION get_audit_log_stats(
    p_date_from TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_date_to TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_module VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    total_logs BIGINT,
    successful_logs BIGINT,
    failed_logs BIGINT,
    unique_users BIGINT,
    top_actions JSONB,
    top_modules JSONB,
    top_users JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_logs,
        COUNT(*) FILTER (WHERE success = true) as successful_logs,
        COUNT(*) FILTER (WHERE success = false) as failed_logs,
        COUNT(DISTINCT user_id) as unique_users,
        (
            SELECT jsonb_agg(jsonb_build_object('action', action, 'count', action_count))
            FROM (
                SELECT action, COUNT(*) as action_count
                FROM audit_logs
                WHERE (p_date_from IS NULL OR timestamp >= p_date_from)
                  AND (p_date_to IS NULL OR timestamp <= p_date_to)
                  AND (p_user_id IS NULL OR user_id = p_user_id)
                  AND (p_module IS NULL OR module = p_module)
                GROUP BY action
                ORDER BY action_count DESC
                LIMIT 10
            ) top_actions_sub
        ) as top_actions,
        (
            SELECT jsonb_agg(jsonb_build_object('module', module, 'count', module_count))
            FROM (
                SELECT module, COUNT(*) as module_count
                FROM audit_logs
                WHERE (p_date_from IS NULL OR timestamp >= p_date_from)
                  AND (p_date_to IS NULL OR timestamp <= p_date_to)
                  AND (p_user_id IS NULL OR user_id = p_user_id)
                  AND (p_module IS NULL OR module = p_module)
                GROUP BY module
                ORDER BY module_count DESC
                LIMIT 10
            ) top_modules_sub
        ) as top_modules,
        (
            SELECT jsonb_agg(jsonb_build_object('user', user_name, 'count', user_count))
            FROM (
                SELECT user_name, COUNT(*) as user_count
                FROM audit_logs
                WHERE (p_date_from IS NULL OR timestamp >= p_date_from)
                  AND (p_date_to IS NULL OR timestamp <= p_date_to)
                  AND (p_user_id IS NULL OR user_id = p_user_id)
                  AND (p_module IS NULL OR module = p_module)
                GROUP BY user_name
                ORDER BY user_count DESC
                LIMIT 10
            ) top_users_sub
        ) as top_users
    FROM audit_logs
    WHERE (p_date_from IS NULL OR timestamp >= p_date_from)
      AND (p_date_to IS NULL OR timestamp <= p_date_to)
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND (p_module IS NULL OR module = p_module);
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies for audit logs (only admins can view)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;

CREATE POLICY "Admins can view all audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- Create RLS policies for other audit tables
ALTER TABLE audit_log_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage audit categories" ON audit_log_categories;
DROP POLICY IF EXISTS "Admins can manage audit actions" ON audit_log_actions;
DROP POLICY IF EXISTS "Admins can manage audit reports" ON audit_log_reports;
DROP POLICY IF EXISTS "Admins can manage audit settings" ON audit_log_settings;

CREATE POLICY "Admins can manage audit categories" ON audit_log_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage audit actions" ON audit_log_actions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage audit reports" ON audit_log_reports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage audit settings" ON audit_log_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Grant permissions
GRANT SELECT ON audit_logs TO authenticated;
GRANT INSERT ON audit_logs TO authenticated;
GRANT ALL ON audit_log_categories TO authenticated;
GRANT ALL ON audit_log_actions TO authenticated;
GRANT ALL ON audit_log_reports TO authenticated;
GRANT ALL ON audit_log_settings TO authenticated;

-- Create comment documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all system activities';
COMMENT ON TABLE audit_log_categories IS 'Categories for organizing audit log entries';
COMMENT ON TABLE audit_log_actions IS 'Predefined actions that can be logged';
COMMENT ON TABLE audit_log_reports IS 'Generated audit log reports';
COMMENT ON TABLE audit_log_settings IS 'Configuration settings for audit logging';

COMMENT ON COLUMN audit_logs.user_id IS 'ID of the user who performed the action';
COMMENT ON COLUMN audit_logs.user_name IS 'Name of the user who performed the action';
COMMENT ON COLUMN audit_logs.user_role IS 'Role of the user who performed the action';
COMMENT ON COLUMN audit_logs.action IS 'Action performed (create, update, delete, etc.)';
COMMENT ON COLUMN audit_logs.module IS 'Module where action was performed';
COMMENT ON COLUMN audit_logs.section IS 'Specific section within the module';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the resource affected';
COMMENT ON COLUMN audit_logs.resource_name IS 'Name of the resource affected';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous values (for updates)';
COMMENT ON COLUMN audit_logs.new_values IS 'New values (for creates/updates)';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the user';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string';
COMMENT ON COLUMN audit_logs.session_id IS 'Session ID';
COMMENT ON COLUMN audit_logs.success IS 'Whether the action was successful';
COMMENT ON COLUMN audit_logs.error_message IS 'Error message if action failed';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional metadata about the action';

-- Insert a test audit log entry to verify everything works
INSERT INTO audit_logs (
    user_id, user_name, user_role, action, module, section,
    resource_type, resource_id, resource_name, new_values,
    ip_address, user_agent, session_id, success, metadata
) VALUES (
    NULL, 'System Setup', 'system', 'audit_system_setup', 'system', 'setup',
    'audit_system', gen_random_uuid(), 'Audit System Setup',
    jsonb_build_object('setup_completed', true, 'timestamp', NOW()),
    '127.0.0.1', 'Database Setup Script', 'setup-session-' || extract(epoch from now()),
    true, jsonb_build_object('setup_type', 'initial', 'version', '1.0')
);

-- Verify the setup worked
SELECT 
    'Audit system setup completed successfully!' as message,
    COUNT(*) as total_audit_logs,
    COUNT(*) FILTER (WHERE action = 'audit_system_setup') as setup_logs
FROM audit_logs;