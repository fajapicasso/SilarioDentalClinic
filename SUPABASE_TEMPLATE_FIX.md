# Supabase Email Template - Corrected Version

## 📧 **Copy This Into Your Supabase Dashboard**

Go to: **Supabase Dashboard → Authentication → Email Templates → Reset password**

### Subject:
```
Reset Your Password - Silario Dental Clinic
```

### Body (HTML) - Corrected:
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

## 🔑 **Key Fix:**

Changed the hardcoded URL:
- ❌ **Before**: `https://silario-dental-clinic.vercel.app/reset-password`
- ✅ **After**: `{{ .ConfirmationURL }}`

This makes the link dynamic and work for both development and production!

## ⚠️ **Important Note:**

Your template uses `{{ .Token }}` which suggests you want OTP codes. However, Supabase's `resetPasswordForEmail()` sends **magic links** by default, not OTP codes.

**If you want OTP codes**, we need to use a different Supabase method. The current code uses `resetPasswordForEmail()` which sends magic links.

**Options:**
1. **Keep magic links** - Update template to use `{{ .ConfirmationURL }}` (link above)
2. **Use OTP codes** - I can update the code to use `signInWithOtp()` with recovery type

Let me know which you prefer!

