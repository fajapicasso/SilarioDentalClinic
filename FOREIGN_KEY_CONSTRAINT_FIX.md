# 🔧 Foreign Key Constraint Fix Guide

## 🚨 **Issue Identified**

**Error:** `insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"`

**Root Cause:** Your `profiles` table has a foreign key constraint that requires the `id` to exist in the `auth.users` table first. This is a common Supabase setup for user management.

## ✅ **Solution Applied**

### **Step 1: Database Trigger (CRITICAL)**

Run the `fix_foreign_key_constraint.sql` script in your Supabase SQL Editor:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `fix_foreign_key_constraint.sql`
4. Run the script

This script will:
- ✅ Create a trigger that automatically creates a profile when an auth user is created
- ✅ Handle the foreign key constraint properly
- ✅ Allow the user creation process to work seamlessly

### **Step 2: Code Updates (COMPLETED)**

✅ **Updated user creation process:**
- Uses `supabase.auth.signUp()` to create the auth user first
- The trigger automatically creates the basic profile
- Then updates the profile with additional details (address, phone, etc.)

## 🎯 **How It Works Now**

```javascript
// 1. Create auth user (trigger creates basic profile)
const { data: authData } = await supabase.auth.signUp({
  email: formData.email,
  password: formData.password,
  options: {
    data: { full_name: fullName, role: formData.role }
  }
});

// 2. Update profile with additional details
const { error } = await supabase
  .from('profiles')
  .update({
    first_name: formData.first_name,
    street: formData.street,
    // ... other fields
  })
  .eq('id', authData.user.id);
```

## 🚀 **Testing the Fix**

After running the SQL script:

1. **Try creating a new user** in your admin panel
2. **Check that the user appears** in both auth.users and profiles tables
3. **Verify all fields are populated** correctly
4. **Test the confirmation email** functionality

## 🔍 **What the Trigger Does**

The database trigger automatically:
- Creates a profile record when an auth user is created
- Sets basic fields (id, email, full_name, role)
- Handles conflicts if the profile already exists
- Maintains referential integrity

## 📋 **Benefits of This Approach**

1. **✅ Maintains Data Integrity** - Foreign key constraints are respected
2. **✅ Automatic Profile Creation** - No manual profile creation needed
3. **✅ Handles Conflicts** - Uses `ON CONFLICT` to handle edge cases
4. **✅ Secure** - Uses `SECURITY DEFINER` for proper permissions
5. **✅ Scalable** - Works for all user creation methods

## 🆘 **If Issues Persist**

1. **Check Supabase Logs:**
   - Go to Supabase Dashboard → Logs
   - Look for trigger execution errors

2. **Verify Trigger Creation:**
   ```sql
   SELECT * FROM information_schema.triggers 
   WHERE trigger_name = 'on_auth_user_created';
   ```

3. **Test Trigger Manually:**
   ```sql
   -- This should create both auth user and profile
   INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
   VALUES (gen_random_uuid(), 'test@test.com', crypt('password', gen_salt('bf')), NOW());
   ```

## 📞 **Next Steps**

1. **Run the SQL script** `fix_foreign_key_constraint.sql`
2. **Test user creation** in your admin panel
3. **Verify the trigger is working** by checking both tables
4. **Let me know if you see any errors**

---

**Status:** 🔧 **READY TO FIX** - SQL script and code updates prepared
