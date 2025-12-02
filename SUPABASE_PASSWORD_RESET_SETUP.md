# Supabase Password Reset Setup Guide

## 🔧 **Current Implementation**

The code has been updated to use Supabase's `resetPasswordForEmail()` which sends **magic links** (not OTP codes).

## ⚠️ **Important: Two Different Flows**

### Option 1: Magic Links (Current Implementation)
- Uses `resetPasswordForEmail()` 
- Sends a clickable link in email
- User clicks link → redirected to reset page with session tokens
- **Template uses**: `{{ .ConfirmationURL }}`

### Option 2: OTP Codes (Your Template Shows This)
- Uses custom token system + Supabase email
- Sends 6-digit code in email
- User enters code manually
- **Template uses**: `{{ .Token }}`

## 📧 **Supabase Email Template**

### For Magic Links (Current Setup):

**Subject:**
```
Reset Your Password - Silario Dental Clinic
```

**Body:**
```html
<h2>Reset Your Password</h2>

<p>Click the link below to reset your password:</p>

<a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
  Reset Password
</a>

<p style="margin-top: 20px; color: #666; font-size: 12px;">
  This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
</p>
```

### For OTP Codes (If You Want 6-Digit Codes):

**Subject:**
```
Reset Your Password - Silario Dental Clinic
```

**Body:**
```html
<h2>Password Reset Code</h2>

<p>Your 6-digit code is:</p>

<h3>{{ .Token }}</h3>

<p>Enter this code in the app to reset your password.</p>

<p>Or click here to go directly:</p>

<a href="{{ .ConfirmationURL }}">Reset Password</a>

<p style="margin-top: 20px; color: #666; font-size: 12px;">
  This code will expire in 1 hour. If you didn't request this reset, please ignore this email.
</p>
```

## 🔄 **Which Flow Do You Want?**

### If You Want Magic Links (Easier):
1. ✅ Code is already updated
2. Update Supabase template to use `{{ .ConfirmationURL }}`
3. Update ResetPassword component to handle magic link flow (extract tokens from URL hash)

### If You Want OTP Codes (6-Digit):
1. Keep custom token system
2. Use Supabase Edge Function or API to send emails
3. OR use Supabase's email template with `{{ .Token }}` (requires different API call)

## 🛠️ **Next Steps**

**Tell me which flow you prefer:**
- **A)** Magic Links (click link → auto-reset)
- **B)** OTP Codes (enter 6-digit code manually)

I'll update the code accordingly!

