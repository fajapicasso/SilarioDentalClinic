# Fix "Failed to update password" Error

## 🚨 **The Problem**
The password reset system can generate tokens and validate them, but fails when trying to update the password in Supabase.

## 🔍 **Root Cause**
This happens because updating a user's password requires **admin privileges** (service role key), which might not be configured.

## 🔧 **Solution: Add Service Role Key**

### Step 1: Get Your Service Role Key
1. **Go to Supabase Dashboard**
2. **Select your project**
3. **Go to Settings → API**
4. **Copy the "service_role" key** (not the anon key!)

⚠️ **Warning**: The service role key is very powerful - keep it secure!

### Step 2: Add to Environment Variables
Add this to your `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Step 3: Restart Your App
```bash
# Stop your dev server (Ctrl+C)
npm run dev
```

## 🧪 **Test the Fix**

1. **Go to** `/forgot-password`
2. **Enter your email** and get the reset code
3. **Go to** `/reset-password`
4. **Enter**: Email + Token + New Password
5. **Should work now!**

## 🔍 **Check Console for Details**

The error message will now be more specific:
- ✅ **"Password updated successfully"** - Fixed!
- ❌ **"Service role key not available"** - Need to add service role key
- ❌ **"Failed to update password: [specific error]"** - Supabase error details

## 🛡️ **Security Note**

The service role key:
- ✅ **Is required** for password reset functionality
- ✅ **Should only be used** in server-side code (but we need it here for password reset)
- ⚠️ **Should be kept secure** - don't commit to version control
- ⚠️ **Has admin privileges** - can bypass all security rules

## 🎯 **Alternative: Edge Function (Advanced)**

For production, consider moving password reset to a Supabase Edge Function:
1. Create an Edge Function that uses the service role key
2. Call the Edge Function from your frontend
3. Keep the service role key server-side only

## 📋 **Environment Variables Checklist**

Your `.env` file should have:
```env
# Required for basic app functionality
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Required for password reset
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional for email sending
VITE_EMAILJS_PUBLIC_KEY=your_emailjs_public_key
VITE_EMAILJS_SERVICE_ID=service_lhrdm8m
VITE_EMAILJS_TEMPLATE_ID=template_lqc2mer
```

## ✅ **Expected Flow After Fix**

1. **Request reset code** → ✅ Email sent
2. **Enter reset details** → ✅ Token validated
3. **Update password** → ✅ Password updated successfully
4. **Auto-login** → ✅ Redirected to dashboard

**The service role key is the missing piece for password updates!** 🔑
