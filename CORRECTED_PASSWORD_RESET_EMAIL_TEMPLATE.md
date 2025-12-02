# Corrected Password Reset Email Template for Vercel/EmailJS

## 📧 **Corrected Email Template**

The template you showed uses `{{ .Token }}` (Go template syntax), but EmailJS uses `{{variable}}` format. Here's the corrected version:

### Template Settings:
```
Template Name: Password Reset - Silario Dental Clinic
Subject: Reset Your Password - {{clinic_name}}
From Name: {{from_name}}
From Email: your-email@gmail.com (or your configured email)
To Email: {{to_email}}
```

### Corrected HTML Template Content:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 24px;">{{clinic_name}}</h1>
      <h2 style="margin: 10px 0 0 0; font-size: 18px; font-weight: normal;">Password Reset Request</h2>
    </div>
    
    <!-- Content -->
    <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
      <p style="color: #333; margin: 0 0 20px 0;">Hello {{to_name}},</p>
      
      <p style="color: #333; margin: 0 0 20px 0;">
        You requested to reset your password for your {{clinic_name}} account.
      </p>
      
      <p style="color: #333; margin: 0 0 10px 0;">Your 6-digit code is:</p>
      
      <!-- Token Display -->
      <div style="background-color: #1f2937; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; margin: 20px 0; border-radius: 8px; letter-spacing: 8px;">
        {{reset_token}}
      </div>
      
      <!-- Reset Link Button -->
      <div style="text-align: center; margin: 30px 0;">
        <p style="color: #333; margin: 0 0 15px 0;">Or click here to go directly:</p>
        <a href="{{reset_link}}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
          Reset Password
        </a>
      </div>
      
      <!-- Expiration Notice -->
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
          <strong>Important:</strong> This code will expire in {{expires_in}} (until <strong>{{time}}</strong>). 
          Please use it promptly to reset your password.
        </p>
      </div>
      
      <!-- Instructions -->
      <div style="margin: 20px 0;">
        <p style="color: #333; margin: 0 0 10px 0; font-weight: bold;">To reset your password:</p>
        <ol style="color: #333; margin: 0; padding-left: 20px;">
          <li>Go to the password reset page (or click the button above)</li>
          <li>Enter your email address: <strong>{{to_email}}</strong></li>
          <li>Enter the 6-digit code: <strong>{{reset_token}}</strong></li>
          <li>Create your new password</li>
        </ol>
      </div>
      
      <!-- Security Warning -->
      <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
        <p style="color: #991b1b; margin: 0; font-size: 13px; line-height: 1.5;">
          <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. 
          Your account remains secure. Never share this code with anyone.
        </p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280;">
      <p style="margin: 5px 0;">
        This is an automated message from {{clinic_name}}.
      </p>
      <p style="margin: 5px 0;">
        Please do not reply to this email.
      </p>
      <p style="margin: 5px 0;">
        For support, contact: {{support_email}}
      </p>
    </div>
  </div>
</body>
</html>
```

## 🔑 **Key Corrections Made:**

1. **Changed `{{ .Token }}` → `{{reset_token}}`** ✅
   - EmailJS uses `{{variable}}` format, not Go template syntax

2. **Changed hardcoded link → `{{reset_link}}`** ✅
   - Uses the dynamic variable that's set in your emailService.js

3. **Added proper HTML structure** ✅
   - Complete DOCTYPE, head, and body tags

4. **Improved styling** ✅
   - Better visual hierarchy and spacing
   - Professional clinic branding colors

5. **Added all EmailJS variables** ✅
   - `{{to_name}}` - Recipient name
   - `{{to_email}}` - Recipient email
   - `{{reset_token}}` - 6-digit code
   - `{{reset_link}}` - Reset password URL
   - `{{clinic_name}}` - Clinic name
   - `{{expires_in}}` - Expiration time (e.g., "15 minutes")
   - `{{time}}` - Expiration time (e.g., "2:30 PM")
   - `{{support_email}}` - Support email address

## 📝 **How to Use:**

1. **Go to your EmailJS Dashboard** → Email Templates
2. **Find your password reset template** (or create a new one)
3. **Copy the HTML above** and paste it into the template content
4. **Make sure your template settings match** the settings shown above
5. **Save the template**

## ✅ **What This Template Provides:**

- ✅ Professional, branded email design
- ✅ Large, easy-to-read 6-digit code
- ✅ Clickable "Reset Password" button
- ✅ Clear instructions
- ✅ Security warnings
- ✅ Expiration time display
- ✅ Mobile-responsive design

## 🧪 **Testing:**

After updating your template, test it by:
1. Requesting a password reset from your app
2. Checking the email you receive
3. Verifying:
   - Code displays correctly
   - Button link works
   - All variables are replaced properly

---

**Note:** Make sure your `emailService.js` is sending all the required variables:
- `reset_token`
- `reset_link`
- `to_name`
- `to_email`
- `clinic_name`
- `expires_in`
- `time`
- `support_email`

These are already configured in your `src/services/emailService.js` file! ✅

