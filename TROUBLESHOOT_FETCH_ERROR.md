# Fix "TypeError: Failed to fetch" Error

## 🚨 **The Problem**
"TypeError: Failed to fetch" when trying to reset password means the database functions are missing or not accessible.

## 🔧 **Quick Fix Steps**

### Step 1: Check Database Setup
**Most likely cause**: You haven't run the database setup script yet.

1. **Open Supabase Dashboard**: Go to your project
2. **Go to SQL Editor**: Click "SQL Editor" in sidebar
3. **Run the setup script**: Copy and paste the contents of `password_reset_tokens_schema.sql`
4. **Click "Run"** to execute the SQL

### Step 2: Verify Environment Variables
Make sure you have a `.env` file in your project root with:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 3: Use the Diagnostic Tool
1. **Go to** `/forgot-password`
2. **Click** "🔧 Run Diagnostic (Check Console)"
3. **Open browser console** (F12)
4. **Check the diagnostic results**

## 🔍 **Diagnostic Results Meaning**

### ✅ **All Good**
```
✅ All checks passed! The system should work.
```

### ❌ **Common Issues**

**Missing Environment Variables:**
```
❌ Missing VITE_SUPABASE_URL
❌ Missing VITE_SUPABASE_ANON_KEY
```
**Fix**: Create `.env` file with your Supabase credentials

**Database Functions Missing:**
```
❌ password_reset_tokens table missing
❌ generate_password_reset_token function missing
```
**Fix**: Run `password_reset_tokens_schema.sql` in Supabase SQL Editor

**Database Connection Failed:**
```
❌ Database connection failed
```
**Fix**: Check your Supabase URL and keys are correct

## 📋 **Step-by-Step Database Setup**

### 1. Open Supabase Dashboard
- Go to [supabase.com](https://supabase.com)
- Login and select your project

### 2. Open SQL Editor
- Click "SQL Editor" in the left sidebar
- Click "New query"

### 3. Copy Database Setup Script
Copy the entire contents of `password_reset_tokens_schema.sql` and paste it into the SQL editor.

### 4. Run the Script
- Click "Run" button
- Wait for "Success. No rows returned" message

### 5. Verify Setup
- Go back to your app
- Click the diagnostic button
- Check console for "✅ All checks passed!"

## 🧪 **Test the Fix**

After running the database setup:

1. **Refresh your browser**
2. **Go to** `/forgot-password`
3. **Run diagnostic** - should show all green checkmarks
4. **Enter your email** (make sure it exists in your profiles table)
5. **Click "Send Reset Code"**
6. **Should work without "Failed to fetch" error**

## 🚨 **If Still Not Working**

### Check These:

1. **Supabase Project Active**: Make sure your project isn't paused
2. **RLS Policies**: The functions should bypass RLS, but check if there are conflicts
3. **Network Issues**: Try from a different network/device
4. **Browser Cache**: Clear browser cache and try again

### Get More Details:

Open browser console and look for more specific error messages:
- Network tab: Check if requests are being made
- Console tab: Look for detailed error messages
- Application tab: Check if environment variables are loaded

## 📞 **Still Stuck?**

Run the diagnostic tool and share the console output. The diagnostic will tell us exactly what's missing or broken.

Most commonly, this error happens because:
1. **Database functions not created** (90% of cases)
2. **Environment variables missing** (8% of cases)  
3. **Network/connection issues** (2% of cases)

Fix #1 first by running the SQL setup script! 🎯
