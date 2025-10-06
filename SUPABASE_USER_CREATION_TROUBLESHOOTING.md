# 🔧 Supabase User Creation Troubleshooting Guide

## 🚨 **Current Issue**
"Failed to create user: Database error saving new user" - This is likely due to **RLS (Row Level Security) policies** or **database schema issues** in Supabase.

## 🔍 **Step-by-Step Diagnosis**

### **Step 1: Run Diagnostic Script**
First, run the `debug_user_creation.sql` script in your Supabase SQL Editor to identify the exact issue:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `debug_user_creation.sql`
4. Run the script
5. Check the results for any errors

### **Step 2: Check for Duplicate Columns**
Look for any duplicate column names in the results. If you see duplicates, run the `fix_duplicate_emergency_c.sql` script.

### **Step 3: Fix RLS Policies**
The most common cause is **RLS policies blocking inserts**. Run the `fix_rls_policies.sql` script:

1. Copy the contents of `fix_rls_policies.sql`
2. Run it in your Supabase SQL Editor
3. This will create proper policies for user creation

## 🎯 **Common Issues & Solutions**

### **Issue 1: RLS Policies Blocking Inserts**
**Symptoms:** Database error with no specific details
**Solution:** Run `fix_rls_policies.sql`

### **Issue 2: Duplicate Column Names**
**Symptoms:** "column does not exist" or "duplicate column" errors
**Solution:** Run `fix_duplicate_emergency_c.sql`

### **Issue 3: Missing Required Fields**
**Symptoms:** "null value in column" errors
**Solution:** ✅ **Already fixed** - Updated form data structure

### **Issue 4: Permission Issues**
**Symptoms:** "permission denied" errors
**Solution:** Run the RLS policy fix script

## 🚀 **Updated User Creation Process**

I've updated the user creation code to:

1. **Generate UUID directly** instead of using `auth.signUp()`
2. **Insert profile directly** into the database
3. **Better error logging** to identify specific issues
4. **Simplified process** that doesn't require auth setup

## 📋 **Testing the Fix**

After running the scripts:

1. **Try creating a new user** in your admin panel
2. **Check browser console** for detailed error messages
3. **Check Supabase logs** in the dashboard
4. **Verify user appears** in the user list

## 🔧 **Manual Database Check**

If you want to manually check your database:

```sql
-- Check table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- Check RLS policies
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles';

-- Test insert manually
INSERT INTO profiles (id, email, first_name, last_name, role) 
VALUES (gen_random_uuid(), 'test@test.com', 'Test', 'User', 'patient');
```

## 🆘 **If Still Not Working**

1. **Check Supabase Logs:**
   - Go to Supabase Dashboard → Logs
   - Look for recent errors

2. **Check Browser Console:**
   - Open Developer Tools (F12)
   - Look for network errors or JavaScript errors

3. **Verify Database Connection:**
   - Check if your Supabase URL and API key are correct
   - Test connection in the dashboard

4. **Check RLS Status:**
   - Go to Authentication → Policies
   - Ensure profiles table has proper policies

## 📞 **Next Steps**

1. **Run the diagnostic script** first
2. **Apply the RLS fix** if needed
3. **Test user creation** again
4. **Share any specific error messages** you see

---

**Status:** 🔧 **IN PROGRESS** - Diagnostic and fix scripts created
