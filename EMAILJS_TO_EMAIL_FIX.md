# Fix EmailJS "Recipients address is empty" Error

## 🎯 **The Exact Problem**
Your EmailJS template's "To Email" field is empty or not set to `{{to_email}}`.

## 🔧 **Step-by-Step Fix**

### Step 1: Go to EmailJS Dashboard
1. Open [emailjs.com](https://www.emailjs.com/)
2. Login to your account
3. Click "Email Templates" in the sidebar

### Step 2: Find Your Template
1. Look for template with ID: `template_lqc2mer`
2. Click on it to edit

### Step 3: Configure Template Settings
In the template editor, you'll see several fields at the top:

**CRITICAL - Template Settings (not the HTML content):**
```
Template Name: [Any name you want]
Subject: Reset Your Password - {{clinic_name}}
From Name: {{from_name}}
From Email: [your-email@gmail.com]  <- Your actual email
To Email: {{to_email}}  <- THIS MUST BE EXACTLY {{to_email}}
```

### Step 4: The "To Email" Field
The "To Email" field is likely one of these incorrect values:
- ❌ Empty (blank)
- ❌ Your actual email address
- ❌ `{{email}}` (wrong variable name)
- ❌ `{to_email}` (missing one set of braces)

**It MUST be exactly:** `{{to_email}}`

### Step 5: Visual Guide
```
┌─────────────────────────────────────┐
│ EmailJS Template Settings          │
├─────────────────────────────────────┤
│ Template Name: Password Reset       │
│ Subject: Reset Your Password - ...  │
│ From Name: {{from_name}}           │
│ From Email: your-email@gmail.com   │
│ To Email: {{to_email}}  ← FIX THIS │
│ Reply To: {{reply_to}}             │
└─────────────────────────────────────┘
```

### Step 6: Save and Test
1. **Type exactly**: `{{to_email}}` in the "To Email" field
2. **Save the template**
3. **Go back to your app**
4. **Test forgot password again**

## 🧪 **Test Steps**
1. Go to `/forgot-password`
2. Enter: `dv2dsr@gmail.com`
3. Click "Send Reset Code"
4. Should work now!

## ✅ **Expected Success Message**
After fixing, you should see:
```
EmailJS result: OK
Password reset email sent successfully
```

## 🔍 **If Still Not Working**

### Double-Check Template Settings
Make sure the template settings look exactly like this:
- **To Email**: `{{to_email}}` (with double curly braces)
- **From Email**: Your actual Gmail/Outlook address
- **Service**: Connected to your Gmail/Outlook

### Verify Email Service
1. Go to "Email Services" in EmailJS
2. Make sure your service (`service_lhrdm8m`) is:
   - ✅ Connected
   - ✅ Active
   - ✅ Not showing any errors

## 🎯 **The Fix is Simple**
Just change the "To Email" field from whatever it currently is to exactly:
```
{{to_email}}
```

That's it! This tells EmailJS to use the recipient email address that your code sends.

## 📧 **Why This Happens**
EmailJS templates have two parts:
1. **Template Settings** (recipient, subject, etc.)
2. **Template Content** (the HTML/text)

The error is in the **settings**, not the content. The "To Email" setting tells EmailJS where to send the email, and it needs to be a variable (`{{to_email}}`) so it can be dynamic.

**Fix this one field and your emails will work!** 🚀
