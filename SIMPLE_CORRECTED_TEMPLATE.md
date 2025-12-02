# Simple Corrected Password Reset Template

## 🔧 **Quick Fix for Your Template**

If you want a simpler version that matches your original template structure, use this:

### Simple HTML Template:

```html
<h2>Password Reset Code</h2>

<p>Your 6-digit code is:</p>

<h3>{{reset_token}}</h3>

<p>Enter this code in the app to reset your password.</p>

<p>Or click here to go directly:</p>

<a href="{{reset_link}}">Reset Password</a>

<p style="margin-top: 20px; color: #666; font-size: 12px;">
  This code will expire in {{expires_in}} (until {{time}}).
</p>

<p style="margin-top: 20px; color: #666; font-size: 12px;">
  If you didn't request this reset, please ignore this email.
</p>
```

## 🔑 **Key Changes:**

1. **`{{ .Token }}` → `{{reset_token}}`** ✅
2. **Hardcoded URL → `{{reset_link}}`** ✅
3. **Added expiration info** ✅

## 📋 **Template Variables Used:**

- `{{reset_token}}` - The 6-digit code
- `{{reset_link}}` - Link to reset password page
- `{{expires_in}}` - "15 minutes"
- `{{time}}` - "2:30 PM"

These variables are automatically provided by your `emailService.js` file!

