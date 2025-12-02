# Corrected Supabase Password Reset Email Template

## 📧 **Corrected Template for Supabase Dashboard**

Copy this template into your Supabase Dashboard → Authentication → Email Templates → Reset password

### Subject:
```
Reset Your Password - Silario Dental Clinic
```

### Body (HTML):
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

## 🔑 **Key Corrections:**

1. **`{{ .Token }}`** ✅ - This is correct for Supabase (Go template syntax with dot notation)
2. **`{{ .ConfirmationURL }}`** ✅ - Changed from hardcoded URL to Supabase's dynamic variable
   - This automatically includes the correct reset link with tokens
   - Works for both development and production

## 📋 **Available Supabase Template Variables:**

- `{{ .Token }}` - The 6-digit OTP code (if using OTP flow)
- `{{ .TokenHash }}` - Hashed version of the token
- `{{ .ConfirmationURL }}` - **Use this for the reset link** (includes all necessary tokens)
- `{{ .SiteURL }}` - Your site URL
- `{{ .Email }}` - User's email address
- `{{ .RedirectTo }}` - Redirect URL after reset
- `{{ .Data }}` - Additional data

## ⚠️ **Important Notes:**

1. **For OTP Codes**: If you want 6-digit codes, you need to configure Supabase to use OTP instead of magic links. This requires:
   - Using `signInWithOtp()` with `type: 'recovery'` 
   - OR configuring Supabase Auth to send OTP codes

2. **For Magic Links**: If using `resetPasswordForEmail()`, Supabase sends magic links by default. The template would use:
   - `{{ .ConfirmationURL }}` - The clickable reset link

3. **Current Implementation**: The code now uses `resetPasswordForEmail()` which sends magic links. If you want OTP codes, we need to change the implementation.

## 🔄 **If You Want OTP Codes Instead of Magic Links:**

If you want 6-digit OTP codes (not magic links), we need to update the code to use a different Supabase method. Let me know and I can update it!

---

**Current Status**: The code now uses Supabase's `resetPasswordForEmail()` which sends magic links. The template above uses `{{ .ConfirmationURL }}` which is the correct variable for magic link reset flows.

