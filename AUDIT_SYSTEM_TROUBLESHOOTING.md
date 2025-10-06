# Audit System Troubleshooting Guide

## Issue: Audit Logs Not Showing

### Problem Analysis
The audit logs aren't displaying because:
1. **Policy conflicts**: The error "policy already exists" indicates duplicate policies
2. **RLS policies blocking access**: The Row Level Security might be preventing data access
3. **Triggers not working**: Database triggers might not be firing properly
4. **No data being logged**: The system might not be creating audit entries

### Step-by-Step Fix

#### Step 1: Fix Database Policies
Run the `fix_audit_database.sql` file in your Supabase SQL Editor:

```sql
-- This will:
-- 1. Drop existing conflicting policies
-- 2. Recreate policies with proper names
-- 3. Fix the audit trigger function
-- 4. Test the system with a sample log entry
```

#### Step 2: Test the System
Run the `test_audit_system.sql` file to verify everything is working:

```sql
-- This will test:
-- 1. If audit_logs table exists and has data
-- 2. If triggers are working
-- 3. If RLS policies allow access
-- 4. If new audit logs can be inserted
```

#### Step 3: Manual Test
If the automatic tests don't work, try this manual test:

```sql
-- Insert a test audit log manually
INSERT INTO audit_logs (
    user_id, user_name, user_role, action, module, section,
    resource_type, resource_id, resource_name,
    new_values, success, metadata
) VALUES (
    auth.uid(),
    'Test User',
    'admin',
    'manual_test',
    'testing',
    'manual',
    'test',
    gen_random_uuid(),
    'Manual Test Entry',
    '{"test": "manual"}',
    true,
    '{"manual": true}'::jsonb
);

-- Check if it was inserted
SELECT * FROM audit_logs WHERE action = 'manual_test';
```

#### Step 4: Check User Permissions
Make sure your current user has admin role:

```sql
-- Check your current user role
SELECT 
    p.id,
    p.full_name,
    p.role,
    p.email
FROM profiles p
WHERE p.id = auth.uid();
```

#### Step 5: Verify RLS Policies
Check if RLS policies are working:

```sql
-- Check if you can see audit logs
SELECT COUNT(*) FROM audit_logs;

-- If this returns 0 but you know there should be data,
-- the RLS policies might be blocking access
```

### Common Issues and Solutions

#### Issue 1: "Policy already exists" Error
**Solution**: Run the `fix_audit_database.sql` file which drops and recreates all policies with unique names.

#### Issue 2: No Audit Logs Showing
**Possible Causes**:
- RLS policies blocking access
- User doesn't have admin role
- Triggers not firing
- No activities being performed

**Solutions**:
1. Check user role: `SELECT role FROM profiles WHERE id = auth.uid();`
2. Test manual insert: Try the manual test above
3. Check triggers: Verify triggers exist on tables
4. Perform test activities: Create/update some data to trigger logs

#### Issue 3: Triggers Not Working
**Check if triggers exist**:
```sql
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers 
WHERE trigger_name LIKE '%audit%';
```

**Recreate triggers if missing**:
```sql
-- Recreate the main audit trigger
CREATE TRIGGER audit_profiles_trigger
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_table_changes();
```

#### Issue 4: RLS Policies Too Restrictive
**Temporary fix** (for testing only):
```sql
-- Temporarily disable RLS for testing
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- Test if you can see data now
SELECT COUNT(*) FROM audit_logs;

-- Re-enable RLS after testing
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

### Testing the Complete System

#### Test 1: Create Test Data
```sql
-- Create a test profile update to trigger audit log
UPDATE profiles 
SET updated_at = NOW() 
WHERE id = auth.uid();
```

#### Test 2: Check Audit Logs
```sql
-- Check if the update was logged
SELECT 
    user_name,
    action,
    module,
    resource_name,
    timestamp
FROM audit_logs 
WHERE user_id = auth.uid()
ORDER BY timestamp DESC 
LIMIT 5;
```

#### Test 3: Test Different User Roles
```sql
-- Check if different roles can see audit logs
SELECT 
    p.role,
    COUNT(al.id) as audit_log_count
FROM profiles p
LEFT JOIN audit_logs al ON p.id = al.user_id
GROUP BY p.role;
```

### Expected Results

After fixing the issues, you should see:

1. **Audit logs in the admin interface**
2. **Automatic logging of all activities**:
   - User profile updates
   - Appointment changes
   - Payment processing
   - Treatment additions
   - Queue management
   - Service updates

3. **Real-time updates** in the audit logs page

### If Still Not Working

1. **Check browser console** for JavaScript errors
2. **Check Supabase logs** for database errors
3. **Verify user authentication** and role
4. **Test with a fresh browser session**
5. **Check network requests** in browser dev tools

### Success Indicators

✅ **Database**: `SELECT COUNT(*) FROM audit_logs;` returns > 0
✅ **Policies**: No policy conflicts when running setup
✅ **Triggers**: Test activities create audit logs
✅ **Frontend**: Audit logs page shows data
✅ **Real-time**: New activities appear immediately

The audit system should now be working and capturing all activities automatically! 🎉
