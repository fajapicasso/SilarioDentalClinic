# Token-Based Password Reset System

## Overview

This system implements a secure two-phase password reset flow using 6-digit tokens instead of Supabase's default email link system.

## How It Works

### Phase 1: Request Reset Token
1. User enters their email on the "Forgot Password" page
2. System generates a 6-digit numeric token (expires in 15 minutes)
3. Token is stored in the database and sent to user's email
4. User receives the token and clicks "Continue to Reset Password"

### Phase 2: Submit New Password
1. User enters:
   - Email address
   - 6-digit reset token (from email)
   - New password
   - Confirm password
2. System validates the token and updates the password
3. User is automatically logged in and redirected to their dashboard

## Database Setup

Run the following SQL to set up the token system:

```sql
-- Execute the contents of password_reset_tokens_schema.sql
```

This creates:
- `password_reset_tokens` table
- Database functions for token generation and validation
- Proper security policies and indexes

## Files Modified

### 1. AuthContext (`src/contexts/AuthContext.jsx`)
- **Added**: `requestPasswordResetToken()` - Generates and stores reset tokens
- **Added**: `resetPasswordWithToken()` - Validates token and resets password
- **Removed**: Old `forgotPassword()` and `resetPassword()` functions
- **Enhanced**: Auth state management to prevent auto-login during reset flow

### 2. ForgotPassword Component (`src/pages/auth/ForgotPassword.jsx`)
- **Updated**: Uses token-based system instead of email links
- **Added**: Success state shows token (in development mode)
- **Added**: "Continue to Reset Password" button
- **Changed**: Button text from "Send Reset Link" to "Send Reset Code"

### 3. ResetPassword Component (`src/pages/auth/ResetPassword.jsx`)
- **Completely rewritten** for token-based flow
- **Added**: Email and token input fields
- **Added**: Form validation for 6-digit numeric tokens
- **Removed**: Supabase URL-based token detection
- **Enhanced**: Better user experience with clear field labels

## Security Features

✅ **Token Expiration**: Tokens expire after 15 minutes
✅ **Single Use**: Tokens are invalidated after use
✅ **User Validation**: Checks if user exists and account is not disabled
✅ **Secure Storage**: Tokens stored with proper RLS policies
✅ **Auto Cleanup**: Expired tokens are automatically cleaned up

## Development vs Production

### Development Mode
- Reset tokens are displayed in the UI for testing
- Tokens are logged to console
- Remove these features in production

### Production Setup
1. **Remove development features**:
   ```javascript
   // Remove these lines from ForgotPassword.jsx
   setResetToken(token); // Line 30
   {resetToken && ( // Lines 70-76
   ```

2. **Integrate email service**:
   ```javascript
   // In AuthContext.jsx, replace the TODO with actual email service
   await sendResetTokenEmail(email, tokenData.token);
   ```

3. **Set up automated cleanup**:
   ```sql
   -- Enable pg_cron extension and schedule cleanup
   SELECT cron.schedule('cleanup-expired-reset-tokens', '0 * * * *', 'SELECT cleanup_expired_reset_tokens();');
   ```

## Email Template Example

Subject: "Reset Your Password - Silario Dental Clinic"

```
Hello,

You requested to reset your password for your Silario Dental Clinic account.

Your reset code is: **123456**

This code will expire in 15 minutes.

If you didn't request this reset, please ignore this email.

Best regards,
Silario Dental Clinic Team
```

## Testing the System

1. **Request Token**:
   - Go to `/forgot-password`
   - Enter a valid email
   - Check console/UI for the generated token

2. **Reset Password**:
   - Go to `/reset-password`
   - Enter email, token, and new password
   - Verify successful login and redirect

## Error Handling

The system handles various error cases:
- Invalid email addresses
- Disabled user accounts
- Expired tokens
- Already used tokens
- Invalid token format
- Database connection issues

## Database Functions

### `generate_password_reset_token(user_email text)`
- Validates user exists and is not disabled
- Generates 6-digit token
- Stores token with 15-minute expiration
- Returns token and expiry time

### `validate_password_reset_token(user_email text, reset_token text)`
- Validates token exists and matches email
- Checks token hasn't expired or been used
- Marks token as used upon validation
- Returns user ID and validation status

### `cleanup_expired_reset_tokens()`
- Removes expired and used tokens
- Should be run periodically for maintenance

## Advantages Over Email Links

1. **Better UX**: Users don't need to switch between email and browser
2. **Mobile Friendly**: Easier to copy/paste 6-digit codes
3. **More Secure**: Shorter expiration time (15 min vs 24 hours)
4. **Auditable**: Better tracking of reset attempts
5. **Customizable**: Full control over the reset flow
