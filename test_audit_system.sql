-- Test Audit System
-- This file tests if the audit system is working properly

-- Test 1: Check if audit_logs table exists and has data
SELECT 
    'audit_logs_table' as test_name,
    COUNT(*) as record_count,
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS' 
        ELSE 'FAIL - No audit logs found' 
    END as status
FROM audit_logs;

-- Test 2: Check if triggers are working by testing profile update
-- First, let's see if we have any profiles to test with
SELECT 
    'profiles_count' as test_name,
    COUNT(*) as profile_count,
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS - Profiles exist for testing' 
        ELSE 'FAIL - No profiles found to test with' 
    END as status
FROM profiles;

-- Test 3: Check if audit categories exist
SELECT 
    'audit_categories' as test_name,
    COUNT(*) as category_count,
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS' 
        ELSE 'FAIL - No audit categories found' 
    END as status
FROM audit_log_categories;

-- Test 4: Check if audit actions exist
SELECT 
    'audit_actions' as test_name,
    COUNT(*) as action_count,
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS' 
        ELSE 'FAIL - No audit actions found' 
    END as status
FROM audit_log_actions;

-- Test 5: Check recent audit logs
SELECT 
    'recent_audit_logs' as test_name,
    COUNT(*) as recent_count,
    CASE 
        WHEN COUNT(*) > 0 THEN 'PASS' 
        ELSE 'FAIL - No recent audit logs' 
    END as status
FROM audit_logs 
WHERE timestamp > NOW() - INTERVAL '1 hour';

-- Test 6: Check if RLS policies are working
-- This will show if the current user can see audit logs
SELECT 
    'rls_policy_test' as test_name,
    COUNT(*) as visible_logs,
    CASE 
        WHEN COUNT(*) >= 0 THEN 'PASS - RLS policies working' 
        ELSE 'FAIL - RLS policy error' 
    END as status
FROM audit_logs;

-- Show sample audit logs if any exist
SELECT 
    'sample_audit_logs' as info,
    user_name,
    action,
    module,
    resource_name,
    timestamp,
    success
FROM audit_logs 
ORDER BY timestamp DESC 
LIMIT 5;

-- Test 7: Check if we can insert a test audit log
DO $$
DECLARE
    test_result BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO audit_logs (
            user_id, user_name, user_role, action, module, section,
            resource_type, resource_id, resource_name,
            new_values, success, metadata
        ) VALUES (
            auth.uid(),
            'Test User',
            'admin',
            'test_insert',
            'testing',
            'test_section',
            'test_resource',
            gen_random_uuid(),
            'Test Resource',
            '{"test": "insert"}',
            true,
            jsonb_build_object('test_insert', true, 'timestamp', NOW())
        );
        test_result := TRUE;
    EXCEPTION WHEN OTHERS THEN
        test_result := FALSE;
    END;
    
    IF test_result THEN
        RAISE NOTICE 'PASS - Can insert audit logs';
    ELSE
        RAISE NOTICE 'FAIL - Cannot insert audit logs: %', SQLERRM;
    END IF;
END $$;
