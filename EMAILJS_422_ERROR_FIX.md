# Fix EmailJS 422 Error - "Recipients address is empty"

## 🚨 **The Issue**
You're getting a 422 error from EmailJS API, which means there's a validation problem with your email template configuration.

## 🔧 **Quick Fix Steps**

### Step 1: Check EmailJS Template Settings
1. **Go to EmailJS Dashboard**: [emailjs.com](https://www.emailjs.com/)
2. **Login** and go to "Email Templates"
3. **Find your template**: `template_lqc2mer`
4. **Click Edit**

### Step 2: Critical Template Settings
In the **template settings** (not the HTML content), make sure you have:

**Template Settings:**
- **Template Name**: Any name you like
- **Subject**: `Reset Your Password - {{clinic_name}}`
- **From Name**: `{{from_name}}`
- **From Email**: Your configured email (e.g., your-email@gmail.com)
- **To Email**: `{{to_email}}` ⚠️ **THIS IS CRITICAL!**
- **Reply To**: `{{reply_to}}` (optional)

### Step 3: Verify Template Variables
Your template should use these exact variables that the code sends:

**Available Variables:**
- `{{to_name}}` - Recipient name
- `{{to_email}}` - Recipient email address
- `{{from_name}}` - Silario Dental Clinic
- `{{reset_token}}` - 6-digit code
- `{{time}}` - Expiry time (e.g., "2:30 PM")
- `{{expires_in}}` - "15 minutes"
- `{{clinic_name}}` - Silario Dental Clinic
- `{{support_email}}` - support@silariodental.com
- `{{reply_to}}` - noreply@silariodental.com

### Step 4: Template Content Example
Here's a working template that matches your current setup:

```html
<div style="font-family: system-ui, sans-serif, Arial; font-size: 14px; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #2563eb;">
    <h1 style="color: #2563eb; font-size: 24px; margin: 0;">{{clinic_name}}</h1>
    <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">Password Reset Request</p>
  </div>
  
  <div style="padding: 30px 0;">
    <p style="color: #333; line-height: 1.6; margin: 0 0 20px 0;">
      Hello {{to_name}},
    </p>
    <p style="color: #333; line-height: 1.6; margin: 0 0 20px 0;">
      You requested to reset your password for your {{clinic_name}} account.
    </p>
    <p style="color: #333; line-height: 1.6; margin: 0 0 10px 0;">
      To authenticate, please use the following One Time Password (OTP):
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <div style="display: inline-block; background-color: #1f2937; color: white; padding: 15px 30px; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 4px;">
        {{reset_token}}
      </div>
    </div>
    
    <p style="color: #333; line-height: 1.6; margin: 20px 0;">
      This OTP will be valid for {{expires_in}} till <strong>{{time}}</strong>.
    </p>
    
    <p style="color: #92400e; margin: 20px 0; font-size: 13px; line-height: 1.5; background-color: #fef3c7; padding: 15px; border-radius: 8px;">
      <strong>Security Notice:</strong> Do not share this OTP with anyone. If you didn't make this request, you can safely ignore this email.
    </p>
    
    <p style="color: #333; line-height: 1.6; margin: 20px 0 0 0;">
      Thanks for choosing {{clinic_name}}!
    </p>
  </div>
  
  <div style="border-top: 1px solid #eaeaea; padding-top: 20px; text-align: center;">
    <p style="color: #888; font-size: 12px; margin: 0;">
      This is an automated message from {{clinic_name}}<br>
      Please do not reply to this email.
    </p>
  </div>
</div>
```

## 🧪 **Test After Fixing**

1. **Save your template** in EmailJS
2. **Go back to your app**: `/forgot-password`
3. **Enter your email**: `dv2dsr@gmail.com`
4. **Click "Send Reset Code"**
5. **Check console** for detailed error message
6. **Check email inbox** (and spam folder)

## 🔍 **Debug Information**

The next time you test, the console will show:
- **EmailJS Template Parameters**: What's being sent
- **Service ID**: Your service ID
- **Template ID**: Your template ID
- **Detailed error**: Specific error message if it fails

## 🎯 **Most Common Fixes**

### Fix #1: Missing "To Email" Field
In EmailJS template settings, the "To Email" field MUST be: `{{to_email}}`

### Fix #2: Wrong Variable Names
Make sure your template uses `{{reset_token}}` not `{{token}}` or `{{code}}`

### Fix #3: Email Service Not Connected
Check that your email service (Gmail/Outlook) is properly connected in EmailJS

### Fix #4: Template Variables Mismatch
The template variables must exactly match what the code sends

## ✅ **Expected Success**

After fixing, you should see:
```
EmailJS result: OK
Password reset email sent successfully
```

And receive an email with your 6-digit reset code!

## 🚨 **If Still Not Working**

Try the updated error handling - it will now give you the exact error message from EmailJS instead of just showing `t`.

The 422 error is almost always a template configuration issue, not a code problem. Focus on the EmailJS template settings! 🎯
