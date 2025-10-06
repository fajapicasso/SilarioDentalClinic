# EmailJS Template Settings - Visual Guide

## 🎯 **Your HTML Template is Perfect!**

The HTML content you showed is correct and uses the right variables:
- ✅ `{{reset_token}}` - Will show the 6-digit code
- ✅ `{{time}}` - Will show expiry time

## 🚨 **The Problem is in Template SETTINGS**

The issue is NOT in your HTML content. It's in the form fields ABOVE your HTML content in the EmailJS template editor.

## 📋 **Visual Guide - Where to Look**

When you edit your template in EmailJS, you'll see something like this:

```
┌─────────────────────────────────────────────────────┐
│ EmailJS Template Editor                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Template Settings (THIS IS WHERE THE PROBLEM IS)   │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Template Name: [Your Template Name]             │ │
│ │ Subject: [Reset Your Password - {{clinic_name}}]│ │
│ │ From Name: [{{from_name}}]                      │ │
│ │ From Email: [your-email@gmail.com]              │ │
│ │ To Email: [THIS IS EMPTY OR WRONG!] ← FIX THIS │ │
│ │ Reply To: [{{reply_to}}]                        │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Template Content (YOUR HTML - THIS IS FINE!)       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ <div style="font-family: system-ui...">         │ │
│ │   <p>To authenticate, please use the following  │ │
│ │   One Time Password (OTP):</p>                  │ │
│ │   <p><strong>{{reset_token}}</strong></p>       │ │
│ │   <p>This OTP will be valid for 15 minutes...   │ │
│ │ </div>                                           │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## 🔧 **Exact Steps to Fix**

### Step 1: Go to EmailJS Template Editor
1. Login to EmailJS.com
2. Go to "Email Templates"
3. Click on your template (`template_lqc2mer`)

### Step 2: Look at the TOP of the Editor
**IGNORE** the HTML content area (that's fine!)
**FOCUS** on the form fields at the top

### Step 3: Find the "To Email" Field
Look for a field labeled "To Email" or "Recipient" or similar.

### Step 4: Check What's Currently There
The "To Email" field probably contains:
- ❌ Nothing (empty)
- ❌ Your actual email address
- ❌ `{{email}}` (wrong variable)

### Step 5: Change It
**Clear the field** and type exactly:
```
{{to_email}}
```

### Step 6: Save
Click "Save" or "Update Template"

## 🎯 **The Field Names Might Be Different**

Depending on your EmailJS version, the field might be called:
- "To Email"
- "Recipient"
- "Send To"
- "Destination Email"

**Whatever it's called, it needs to contain**: `{{to_email}}`

## ✅ **After the Fix**

Your template settings should look like:
```
Template Name: Password Reset
Subject: Reset Your Password - {{clinic_name}}
From Name: {{from_name}}
From Email: your-email@gmail.com
To Email: {{to_email}}  ← FIXED!
Reply To: {{reply_to}}
```

## 🧪 **Test Immediately**

After saving:
1. Go to `/forgot-password`
2. Enter `dv2dsr@gmail.com`
3. Click "Send Reset Code"
4. Should work instantly!

## 📸 **Screenshot Locations**

If you can't find the "To Email" field, look for:
1. **Above the HTML editor** - Form fields for template configuration
2. **Template Settings tab** - Separate tab from template content
3. **Email Configuration section** - Grouped with other email settings

**The key is that it's NOT in your HTML content - it's in the template configuration fields!** 🎯
