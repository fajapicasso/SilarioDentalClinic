# Password Reset Link Troubleshooting Guide

## Issue: "Invalid Reset Link" Error

If you're seeing the "Invalid Reset Link" error, follow these steps to diagnose and fix the issue.

## Step 1: Check Browser Console

1. Open your browser's Developer Tools (F12)
2. Go to the Console tab
3. Look for these debug messages:
   - `Current URL: ...`
   - `Hash: ...`
   - `Query: ...`
   - `Has token: true/false`
   - `Session check result: ...`

## Step 2: Verify URL Configuration

### Check Supabase Dashboard Settings:

1. **Go to Supabase Dashboard** → **Authentication** → **URL Configuration**
2. **Verify these settings:**

#### Site URL:
- Development: `http://localhost:5173`
- Production: `https://yourdomain.com`

#### Redirect URLs (add ALL of these):
```
http://localhost:5173/reset-password
http://localhost:5174/reset-password
http://localhost:5175/reset-password
https://yourdomain.com/reset-password
```

## Step 3: Test Email Link Format

When you receive the password reset email, the link should look like this:

```
https://yourdomain.com/reset-password#access_token=eyJ...&refresh_token=eyJ...&expires_in=3600&token_type=bearer&type=recovery
```

**OR**

```
https://yourdomain.com/reset-password?access_token=eyJ...&refresh_token=eyJ...&expires_in=3600&token_type=bearer&type=recovery
```

## Step 4: Common Issues and Solutions

### Issue 1: Wrong Redirect URL
**Problem:** The redirect URL in Supabase doesn't match your app's URL.

**Solution:**
1. Check your current URL in the browser
2. Add the exact URL to Supabase redirect URLs
3. Make sure there's no trailing slash

### Issue 2: Token Expired
**Problem:** The reset token has expired (usually after 1 hour).

**Solution:**
1. Request a new password reset email
2. Use the new link immediately
3. Don't wait too long before clicking the link

### Issue 3: Email Service Not Configured
**Problem:** SMTP is not set up, so emails aren't being sent.

**Solution:**
1. Go to Supabase → Authentication → Settings → SMTP Settings
2. Enable "Enable custom SMTP"
3. Configure with your email service (Gmail, etc.)

### Issue 4: Browser Cache Issues
**Problem:** Old cached data is interfering.

**Solution:**
1. Clear browser cache and cookies
2. Try in incognito/private mode
3. Try a different browser

### Issue 5: Development vs Production URLs
**Problem:** Using production URLs in development or vice versa.

**Solution:**
1. Make sure you're using the correct URLs for your environment
2. Add both development and production URLs to redirect URLs

## Step 5: Manual Testing

### Test 1: Check if Email is Sent
1. Go to forgot password page
2. Enter your email
3. Check if you receive the email
4. Check spam folder

### Test 2: Check Link Format
1. Copy the link from the email
2. Paste it in a text editor
3. Verify it contains `access_token` and `type=recovery`
4. Check if the domain matches your app

### Test 3: Test Direct Access
1. Try accessing the reset password page directly: `http://localhost:5173/reset-password`
2. You should see the "Invalid Reset Link" message
3. This confirms the page is accessible

## Step 6: Debug Mode

Add this to your browser console to debug:

```javascript
// Debug current URL
console.log('Current URL:', window.location.href);
console.log('Hash:', window.location.hash);
console.log('Search:', window.location.search);

// Check for tokens
const hasAccessToken = window.location.hash.includes('access_token') || 
                      window.location.search.includes('access_token');
const hasRecoveryType = window.location.hash.includes('type=recovery') || 
                       window.location.search.includes('type=recovery');

console.log('Has access token:', hasAccessToken);
console.log('Has recovery type:', hasRecoveryType);
```

## Step 7: Alternative Solutions

### Solution 1: Use Different Email Service
If Gmail isn't working, try:
- Outlook/Hotmail SMTP
- Custom domain email
- Email service providers (SendGrid, Mailgun)

### Solution 2: Manual Token Handling
If automatic token detection isn't working, you can manually handle it:

```javascript
// In ResetPassword.jsx, add this to useEffect
const urlParams = new URLSearchParams(window.location.search);
const hashParams = new URLSearchParams(window.location.hash.substring(1));

const accessToken = urlParams.get('access_token') || hashParams.get('access_token');
const refreshToken = urlParams.get('refresh_token') || hashParams.get('refresh_token');

if (accessToken && refreshToken) {
  // Manually set the session
  supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
}
```

## Step 8: Contact Support

If none of the above solutions work:

1. **Check Supabase Logs:**
   - Go to Supabase Dashboard → Logs
   - Look for authentication errors
   - Check email sending logs

2. **Verify Environment Variables:**
   ```env
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. **Test with Simple Email:**
   - Try with a different email address
   - Use a different email service
   - Test in a different environment

## Quick Fix Checklist

- [ ] SMTP is configured in Supabase
- [ ] Redirect URLs include your app's URL
- [ ] Site URL is set correctly
- [ ] Email is being sent (check inbox/spam)
- [ ] Link contains access_token and type=recovery
- [ ] Browser cache is cleared
- [ ] Environment variables are correct
- [ ] App is running on the correct port

## Still Having Issues?

If you're still experiencing problems:

1. **Share the debug console output**
2. **Share the exact URL from the email**
3. **Share your Supabase URL configuration**
4. **Test with a fresh email address**

The most common cause is incorrect URL configuration in Supabase settings. Double-check that your redirect URLs exactly match your application's URL.
