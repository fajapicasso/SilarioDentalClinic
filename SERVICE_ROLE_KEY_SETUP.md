# Fix "Password reset is not properly configured" Error

## 🚨 **The Problem**
This error means the **service role key** is missing from your environment variables. Password reset requires admin privileges to update passwords in Supabase Auth.

## 🔑 **Solution: Add Service Role Key**

### Step 1: Get Your Service Role Key
1. **Go to Supabase Dashboard**: [supabase.com](https://supabase.com)
2. **Login** and select your project
3. **Go to Settings** → **API**
4. **Find "service_role" key** (the long one, not anon key)
5. **Copy the service_role key**

⚠️ **Important**: This is different from your anon key - it's much longer and more powerful!

### Step 2: Add to Environment Variables
Create or update your `.env` file in your project root:

```env
# Basic Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Required for Password Reset (ADD THIS!)
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Email Configuration (Optional)
VITE_EMAILJS_PUBLIC_KEY=your_emailjs_public_key
VITE_EMAILJS_SERVICE_ID=service_lhrdm8m
VITE_EMAILJS_TEMPLATE_ID=template_lqc2mer
```

### Step 3: Restart Your Development Server
```bash
# Stop your current server (Ctrl+C)
# Then restart:
npm run dev
```

## 🧪 **Test the Fix**

1. **Restart your dev server** after adding the service role key
2. **Go to** `/forgot-password` → Request reset code
3. **Go to** `/reset-password` → Enter email + token + new password
4. **Should work now** instead of showing the configuration error

## 🔍 **Check Your Environment Variables**

You can verify your environment variables are loaded by checking the browser console. The app should show:
- ✅ `supabase_url: true`
- ✅ `supabase_anon_key: true`
- ✅ `supabase_service_key: true` ← This should be true now

## 🛡️ **Security Notes**

The service role key:
- ✅ **Is required** for password reset functionality
- ⚠️ **Has admin privileges** - can bypass all security rules
- ⚠️ **Should be kept secure** - don't commit to version control
- ⚠️ **Should only be used** for admin operations like password reset

## 📋 **Complete .env File Example**

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://hkawrlwkehgrluhsxhyr.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYXdybHdrZWgZ...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYXdybHdrZWgZ...

# EmailJS Configuration
VITE_EMAILJS_PUBLIC_KEY=your_public_key
VITE_EMAILJS_SERVICE_ID=service_lhrdm8m
VITE_EMAILJS_TEMPLATE_ID=template_lqc2mer
```

## ✅ **Expected Result**

After adding the service role key:
- ✅ **Password reset works** - No configuration error
- ✅ **Console shows**: "Using admin client to update password"
- ✅ **Success message**: "Password reset successfully! You are now logged in."
- ✅ **User is redirected** to their dashboard

## 🔧 **If Still Not Working**

1. **Double-check** the service role key is correct
2. **Make sure** you restarted the dev server
3. **Verify** the `.env` file is in the project root
4. **Check** there are no extra spaces in the environment variables

**The service role key is the missing piece for password updates!** 🔑
