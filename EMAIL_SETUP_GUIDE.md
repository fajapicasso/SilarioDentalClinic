# Email Setup Guide for Password Reset

## Quick Setup with EmailJS (Recommended)

EmailJS is the easiest way to get email functionality working quickly without a backend server.

### Step 1: Create EmailJS Account
1. Go to [EmailJS.com](https://www.emailjs.com/)
2. Sign up for a free account
3. Create a new email service (Gmail, Outlook, etc.)

### Step 2: Create Email Template
1. Go to "Email Templates" in your EmailJS dashboard
2. Create a new template with these variables:
   ```
   Subject: Reset Your Password - {{clinic_name}}
   
   Hello,
   
   You requested to reset your password for your {{clinic_name}} account.
   
   Your 6-digit reset code is: {{reset_token}}
   
   This code will expire in {{expires_in}}.
   
   If you didn't request this reset, please ignore this email.
   
   Best regards,
   {{clinic_name}} Team
   ```

### Step 3: Get Your Credentials
- **Public Key**: Found in "Account" > "General"
- **Service ID**: Found in "Email Services" 
- **Template ID**: Found in "Email Templates"

### Step 4: Add Environment Variables
Create a `.env` file in your project root:
```env
VITE_EMAILJS_PUBLIC_KEY=your_public_key_here
VITE_EMAILJS_SERVICE_ID=your_service_id_here
VITE_EMAILJS_TEMPLATE_ID=your_template_id_here
```

### Step 5: Test the Setup
1. Run your application: `npm run dev`
2. Go to `/forgot-password`
3. Enter your email address
4. Check your email for the 6-digit code

## Alternative Setup Options

### Option 1: Using Supabase Edge Functions
If you want server-side email sending:

1. Create a Supabase Edge Function
2. Use a service like SendGrid or Nodemailer
3. Update `emailService.js` to use the 'supabase' provider

### Option 2: Custom API Endpoint
If you have your own backend:

1. Create an API endpoint that accepts email requests
2. Use any email service (SendGrid, Mailgun, etc.)
3. Update `emailService.js` to use the 'api' provider

### Option 3: SMTP Server
For enterprise setups:

1. Configure your SMTP server details
2. Create a backend service to send emails
3. Update the email service accordingly

## Email Template Variables

The email service uses these template variables:

- `{{to_email}}` - Recipient email
- `{{reset_token}}` - 6-digit reset code
- `{{expires_in}}` - Expiration time (15 minutes)
- `{{clinic_name}}` - Silario Dental Clinic
- `{{support_email}}` - Support email address

## Testing Email Functionality

### Development Mode
- Reset tokens are displayed in the UI for testing
- Console logs show email sending status
- Fallback to displaying token if email fails

### Production Mode
1. Remove token display from UI
2. Remove console logs
3. Set up proper error handling
4. Configure email service credentials

## Troubleshooting

### EmailJS Issues
1. **"User ID not found"**: Check your public key
2. **"Service not found"**: Verify service ID
3. **"Template not found"**: Check template ID
4. **Emails not sending**: Check spam folder, verify email service setup

### General Issues
1. **Environment variables not loading**: Restart development server
2. **CORS errors**: Check EmailJS service configuration
3. **Rate limiting**: EmailJS has monthly limits on free plan

## Security Notes

1. **Never expose service role keys** in client-side code
2. **Use environment variables** for all credentials
3. **Validate email addresses** before sending
4. **Implement rate limiting** to prevent abuse
5. **Monitor email usage** to avoid quota limits

## Cost Considerations

### EmailJS Pricing
- Free: 200 emails/month
- Personal: $15/month for 10,000 emails
- Business: $35/month for 50,000 emails

### Alternative Services
- SendGrid: Free tier (100 emails/day)
- Mailgun: Free tier (5,000 emails/month)
- AWS SES: $0.10 per 1,000 emails

## Production Checklist

- [ ] Environment variables configured
- [ ] Email service tested
- [ ] Template customized with clinic branding
- [ ] Rate limiting implemented
- [ ] Error handling in place
- [ ] Monitoring set up
- [ ] Remove development features (token display)
- [ ] Set up email analytics (optional)
