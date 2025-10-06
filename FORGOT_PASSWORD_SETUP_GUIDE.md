# Forgot Password Setup Guide

## Overview
This guide will help you set up the forgot password functionality so that users can receive password reset emails in their Gmail accounts.

## Prerequisites
- Supabase project set up
- SMTP email service configured

## Step 1: Configure Supabase Email Settings

### 1.1 Go to Supabase Dashboard
1. Navigate to your Supabase project dashboard
2. Go to **Authentication** → **Settings**
3. Scroll down to **Email Templates**

### 1.2 Configure Password Reset Email Template
1. Click on **Reset Password** template
2. Update the template with your clinic branding:

```html
<h2>Reset Your Password - Silario Dental Clinic</h2>
<p>Hello,</p>
<p>You requested to reset your password for your Silario Dental Clinic account.</p>
<p>Click the button below to reset your password:</p>
<a href="{{ .ConfirmationURL }}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
<p>If you didn't request this password reset, please ignore this email.</p>
<p>Best regards,<br>Silario Dental Clinic Team</p>
```

### 1.3 Configure SMTP Settings
1. Go to **Authentication** → **Settings** → **SMTP Settings**
2. Enable **Enable custom SMTP**
3. Configure with your email service:

**For Gmail SMTP:**
- **Host**: smtp.gmail.com
- **Port**: 587
- **Username**: your-gmail@gmail.com
- **Password**: Your Gmail app password (not your regular password)
- **Sender email**: your-gmail@gmail.com
- **Sender name**: Silario Dental Clinic

**For other email services:**
- **Host**: smtp.your-provider.com
- **Port**: 587 (or 465 for SSL)
- **Username**: your-email@yourdomain.com
- **Password**: your-email-password
- **Sender email**: your-email@yourdomain.com
- **Sender name**: Silario Dental Clinic

## Step 2: Set Up Gmail App Password (if using Gmail)

### 2.1 Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Navigate to **Security**
3. Enable **2-Step Verification**

### 2.2 Generate App Password
1. In **Security** settings, find **App passwords**
2. Click **Generate app password**
3. Select **Mail** and **Other (custom name)**
4. Enter "Supabase" as the custom name
5. Copy the generated 16-character password
6. Use this password in your Supabase SMTP settings

## Step 3: Configure Redirect URLs

### 3.1 Add Redirect URLs
1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Add these URLs to **Redirect URLs**:
   - `http://localhost:5173/reset-password` (for development)
   - `http://localhost:5174/reset-password` (for development)
   - `http://localhost:5175/reset-password` (for development)
   - `https://yourdomain.com/reset-password` (for production)

### 3.2 Add Site URL
1. Set **Site URL** to your main domain:
   - Development: `http://localhost:5173`
   - Production: `https://yourdomain.com`

## Step 4: Test the Functionality

### 4.1 Test Email Sending
1. Go to your application's forgot password page
2. Enter a valid email address
3. Check if the email is sent successfully
4. Check your email inbox (including spam folder)

### 4.2 Test Password Reset Flow
1. Click the reset link in the email
2. Verify you're redirected to the reset password page
3. Enter a new password
4. Test logging in with the new password

## Step 5: Troubleshooting

### Common Issues:

#### 5.1 Email Not Received
- Check spam/junk folder
- Verify SMTP settings are correct
- Ensure Gmail app password is used (not regular password)
- Check Supabase logs for errors

#### 5.2 Reset Link Not Working
- Verify redirect URLs are configured correctly
- Check if the token is being passed correctly
- Ensure the reset-password route exists in your app

#### 5.3 SMTP Authentication Failed
- Double-check email credentials
- Ensure 2FA is enabled for Gmail
- Use app password instead of regular password
- Verify SMTP server settings

## Step 6: Production Considerations

### 6.1 Environment Variables
Make sure these are set in production:
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 6.2 Custom Domain
- Update redirect URLs to use your production domain
- Configure custom SMTP with your domain email
- Update email templates with your branding

## Step 7: Security Best Practices

### 7.1 Email Security
- Use strong, unique passwords for email accounts
- Enable 2FA on all email accounts
- Regularly rotate app passwords
- Monitor email sending logs

### 7.2 Application Security
- Implement rate limiting for password reset requests
- Add CAPTCHA for forgot password form
- Log all password reset attempts
- Set expiration time for reset tokens

## Support

If you encounter issues:
1. Check Supabase logs in the dashboard
2. Verify all configuration steps
3. Test with a simple email first
4. Contact Supabase support if needed

## Code Implementation

The forgot password functionality is already implemented in your codebase:

- **ForgotPassword.jsx**: UI for requesting password reset
- **ResetPassword.jsx**: UI for setting new password
- **AuthContext.jsx**: Backend logic for password reset

The implementation includes:
- Email validation
- Disabled account checking
- Proper error handling
- Success notifications
- Token validation
- Password strength requirements
