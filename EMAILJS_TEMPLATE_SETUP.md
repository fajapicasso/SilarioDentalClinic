# EmailJS Template Setup Guide

## 🚨 **Fix for "Recipients address is empty" Error**

The error you're seeing means the EmailJS template is not configured to receive the email address properly.

## 📧 **EmailJS Template Setup**

### Step 1: Go to EmailJS Dashboard
1. Login to [EmailJS.com](https://www.emailjs.com/)
2. Go to "Email Templates"
3. Find your template or create a new one

### Step 2: Configure Template Settings
**Template Settings:**
- **Template Name**: Password Reset - Silario Dental Clinic
- **Subject**: Reset Your Password - {{clinic_name}}
- **From Name**: {{from_name}}
- **From Email**: Your configured email (e.g., your-email@gmail.com)
- **To Email**: {{to_email}}  ⚠️ **CRITICAL - This must be exactly {{to_email}}**

### Step 3: Email Template Content
```html
Subject: Reset Your Password - {{clinic_name}}

Hello {{to_name}},

You requested to reset your password for your {{clinic_name}} account.

Your 6-digit reset code is: {{reset_token}}

This code will expire in {{expires_in}}.

To reset your password:
1. Go to the password reset page
2. Enter your email address  
3. Enter the code: {{reset_token}}
4. Create your new password

If you didn't request this reset, please ignore this email.

Best regards,
{{clinic_name}} Team

---
This is an automated message. Please do not reply to this email.
Support: {{support_email}}
```

### Step 4: Template Variables Used
Make sure your template uses these exact variable names:
- `{{to_email}}` - Recipient email address ⚠️ **MUST BE EXACT**
- `{{to_name}}` - Recipient name (extracted from email)
- `{{from_name}}` - Sender name
- `{{reset_token}}` - 6-digit reset code
- `{{expires_in}}` - Expiration time
- `{{clinic_name}}` - Clinic name
- `{{support_email}}` - Support email

### Step 5: Test Template
1. Save your template
2. Use the "Test" button in EmailJS
3. Fill in sample values to make sure it works

## 🔧 **Quick Fix Steps**

### Option 1: Update Your Template
1. Go to your EmailJS template
2. Make sure "To Email" field is set to: `{{to_email}}`
3. Save the template
4. Test the forgot password flow again

### Option 2: Check Template Variables
In your EmailJS template, make sure you're using these variables:
- To Email: `{{to_email}}` (not `{{email}}` or `{{recipient}}`)
- Subject: `Reset Your Password - {{clinic_name}}`
- Message body includes: `{{reset_token}}`

### Option 3: Verify Service Configuration
1. Check that your email service (Gmail/Outlook) is properly connected
2. Verify the service is active and not suspended
3. Make sure you're not hitting rate limits

## 🧪 **Test the Fix**

After updating your template:
1. Go to `/forgot-password`
2. Enter your email
3. Check browser console for:
   ```
   EmailJS Template Parameters: {to_email: "your@email.com", reset_token: "123456", ...}
   Service ID: service_xxx
   Template ID: template_xxx
   EmailJS result: OK
   ```
4. Check your email inbox (and spam folder)

## 🔍 **Debugging**

### Check Console Output
You should see:
```
EmailJS Template Parameters: {
  to_name: "username",
  to_email: "username@gmail.com", 
  from_name: "Silario Dental Clinic",
  reset_token: "123456",
  expires_in: "15 minutes",
  clinic_name: "Silario Dental Clinic",
  support_email: "support@silariodental.com",
  reply_to: "noreply@silariodental.com"
}
```

### Common Issues
1. **"Recipients address is empty"** - Template "To Email" not set to `{{to_email}}`
2. **"Template not found"** - Wrong template ID in .env file
3. **"Service not found"** - Wrong service ID in .env file
4. **"Unauthorized"** - Wrong public key in .env file

## 📋 **Environment Variables Check**
Make sure your `.env` file has:
```env
VITE_EMAILJS_PUBLIC_KEY=your_actual_public_key
VITE_EMAILJS_SERVICE_ID=service_xxxxxxxxx
VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxxxx
```

## 🎯 **Expected Result**
After fixing the template, you should:
1. See "EmailJS result: OK" in console
2. Receive email within 1-2 minutes
3. Email contains the 6-digit reset code
4. No more "recipients address is empty" error
