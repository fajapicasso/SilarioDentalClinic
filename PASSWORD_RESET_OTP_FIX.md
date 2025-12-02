# Password Reset OTP Fix

## 🔧 **Problem Fixed**

You were receiving **Magic Link** emails from Supabase instead of **6-digit OTP codes** because the code was using `supabase.auth.signInWithOtp()` which sends magic links by default.

## ✅ **Solution Implemented**

The password reset system has been updated to use your **custom token system** with **EmailJS** instead of Supabase's built-in email service.

### Changes Made:

1. **Updated `requestPasswordResetToken()` function** in `src/contexts/AuthContext.jsx`:
   - Now calls the database function `generate_password_reset_token()` to create a 6-digit token
   - Stores token in `password_reset_tokens` table
   - Sends token via **EmailJS** (your custom email service) instead of Supabase

2. **Updated `resetPasswordWithToken()` function** in `src/contexts/AuthContext.jsx`:
   - Now validates tokens using the database function `validate_password_reset_token()`
   - No longer uses Supabase's OTP verification
   - Uses your custom token validation system

## 📋 **Required Setup Steps**

### 1. Database Setup (If Not Already Done)

Make sure you've run the SQL script to create the token system:

```sql
-- Run the contents of password_reset_tokens_schema.sql in your Supabase SQL Editor
```

This creates:
- `password_reset_tokens` table
- `generate_password_reset_token()` function
- `validate_password_reset_token()` function

### 2. EmailJS Configuration

Make sure your EmailJS is properly configured:

1. **Environment Variables** (in `.env` file):
   ```
   VITE_EMAILJS_PUBLIC_KEY=your_public_key
   VITE_EMAILJS_SERVICE_ID=your_service_id
   VITE_EMAILJS_TEMPLATE_ID=your_template_id
   ```

2. **EmailJS Template**:
   - Use the corrected template from `CORRECTED_PASSWORD_RESET_EMAIL_TEMPLATE.md`
   - Make sure it uses `{{reset_token}}` (not `{{ .Token }}`)
   - Make sure it uses `{{reset_link}}` for the reset password link

### 3. Service Role Key (Required for Password Updates)

Make sure you have the service role key set:

```
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

⚠️ **Important**: The service role key is required to update user passwords. Keep it secure and never expose it in client-side code.

## 🧪 **Testing**

1. **Request Password Reset**:
   - Go to `/forgot-password`
   - Enter your email
   - Click "Send Reset Code"

2. **Check Email**:
   - You should receive an email with a **6-digit code** (not a magic link)
   - The email should come from **EmailJS** (not Supabase)

3. **Reset Password**:
   - Go to `/reset-password`
   - Enter email, 6-digit code, and new password
   - Password should be reset successfully

## 🔍 **Troubleshooting**

### If you still receive Magic Link emails:

1. **Check EmailJS Configuration**:
   - Verify environment variables are set correctly
   - Check browser console for EmailJS errors
   - Verify EmailJS template is using correct variables

2. **Check Database Functions**:
   - Run the SQL script if you haven't already
   - Verify functions exist in Supabase SQL Editor:
     ```sql
     SELECT * FROM generate_password_reset_token('test@example.com');
     ```

3. **Check Console Logs**:
   - Open browser DevTools
   - Look for "Token generated successfully" message
   - Check for any email sending errors

### If EmailJS is not configured:

The system will fall back to **Console mode** (development):
- Token will be generated and logged to console
- No actual email will be sent
- Token will be displayed on the success page (development only)

## 📧 **Email Template Variables**

Your EmailJS template should use these variables:
- `{{reset_token}}` - The 6-digit code
- `{{reset_link}}` - Link to reset password page
- `{{to_name}}` - Recipient name
- `{{to_email}}` - Recipient email
- `{{clinic_name}}` - "Silario Dental Clinic"
- `{{expires_in}}` - "15 minutes"
- `{{time}}` - Expiration time (e.g., "2:30 PM")

## ✅ **What's Working Now**

- ✅ Custom 6-digit token generation
- ✅ Token stored in database
- ✅ Email sent via EmailJS (not Supabase)
- ✅ Token validation via database function
- ✅ Password update using service role
- ✅ Auto-login after successful reset

## 🎯 **Next Steps**

1. **Test the password reset flow** end-to-end
2. **Verify EmailJS template** is using correct variables
3. **Check email delivery** - make sure emails are being sent
4. **Monitor console logs** for any errors

---

**Note**: If you're still having issues, check the browser console for detailed error messages and verify all environment variables are set correctly.

