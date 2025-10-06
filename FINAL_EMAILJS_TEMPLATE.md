# Final EmailJS Template - With OTP Code and Forgot Password Link

## 📧 **Updated EmailJS Template**

Replace your current EmailJS template content with this:

### Template Settings (Keep the same):
```
Template Name: Silario Password Reset
Subject: Reset Your Password - {{clinic_name}}
From Name: {{from_name}}
From Email: your-email@gmail.com
To Email: {{to_email}}
```

### Template Content (HTML) - Copy this exactly:
```html
<div style="font-family: system-ui, sans-serif, Arial; font-size: 14px; max-width: 600px; margin: 0 auto; padding: 20px;">
  <!-- Header -->
  <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #2563eb;">
    <img style="height: 32px; vertical-align: middle" height="32px" src="https://www.shutterstock.com/image-vector/simple-sparkling-tooth-illustration-dentistry-600nw-2544899111.jpg" alt="{{clinic_name}}" />
    <h1 style="color: #2563eb; font-size: 24px; margin: 10px 0 0 0;">{{clinic_name}}</h1>
    <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">Password Reset Request</p>
  </div>
  
  <!-- Main Content -->
  <div style="padding: 30px 0;">
    <p style="color: #333; line-height: 1.6; margin: 0 0 20px 0;">
      Hello {{to_name}},
    </p>
    <p style="color: #333; line-height: 1.6; margin: 0 0 20px 0;">
      You requested to reset your password for your {{clinic_name}} account.
    </p>
    
    <!-- Reset Button and OTP Code -->
    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <!-- Reset Button -->
      <div style="text-align: center; margin-bottom: 20px;">
        <a href="{{reset_link}}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Reset My Password
        </a>
      </div>
      
      <!-- OTP Code -->
      <div style="text-align: center;">
        <p style="color: #374151; margin: 0 0 10px 0; font-weight: bold;">Or use this 6-digit code:</p>
        <div style="display: inline-block; background-color: #1f2937; color: white; padding: 15px 25px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
          {{reset_token}}
        </div>
        <p style="color: #6b7280; font-size: 13px; margin: 10px 0 0 0;">
          Enter this code on the reset password page
        </p>
      </div>
    </div>
    
    <p style="color: #333; line-height: 1.6; margin: 20px 0;">
      This code will be valid for {{expires_in}} till <strong>{{time}}</strong>.
    </p>
    
    <!-- Security Warning -->
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
      <p style="color: #92400e; margin: 0; font-size: 13px; line-height: 1.5;">
        <strong>Security Notice:</strong> Do not share this code with anyone. If you didn't make this request, you can safely ignore this email. {{clinic_name}} will never contact you about this email or ask for any login codes or links. Beware of phishing scams.
      </p>
    </div>
    
    <p style="color: #333; line-height: 1.6; margin: 20px 0 0 0;">
      Thanks for choosing {{clinic_name}}!
    </p>
  </div>
  
  <!-- Footer -->
  <div style="border-top: 1px solid #eaeaea; padding-top: 20px; text-align: center;">
    <p style="color: #888; font-size: 12px; margin: 0;">
      This is an automated message from {{clinic_name}}<br>
      Please do not reply to this email.
    </p>
  </div>
</div>
```

## 🎯 **What This Template Does:**

1. **Shows "Reset My Password" button** → Links to `/reset-password`
2. **Shows 6-digit OTP code** → User can copy this
3. **Clear instructions** → "Or use this 6-digit code"
4. **Professional styling** → Matches your clinic branding

## 🔗 **Link Behavior:**

- **Button click** → Goes to `http://localhost:5174/reset-password?from=email`
- **User sees reset password page** → Can enter email + OTP code + new password

## 🧪 **Test Steps:**

1. **Update your EmailJS template** with the HTML above
2. **Save the template**
3. **Test forgot password** → Enter your email
4. **Check email** → Should see both button and OTP code
5. **Click "Reset My Password"** → Should go to `http://localhost:5174/reset-password?from=email`
6. **Copy OTP code** → Use on reset password page

## ✅ **User Flow:**

1. **User requests reset** → Gets email
2. **Email contains**:
   - 🔗 "Reset My Password" button (goes to reset password)
   - 🔢 6-digit OTP code (e.g., `123456`)
3. **User clicks button** → Goes directly to reset password page
4. **User enters details** → Email + OTP code + new password

Perfect! Now your email has both the OTP code and links directly to the reset password page as requested! 🎉
