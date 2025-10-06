// src/templates/passwordResetEmailTemplate.js

export const getPasswordResetEmailTemplate = (token, clinicName = 'Silario Dental Clinic') => {
  return {
    subject: `Reset Your Password - ${clinicName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .token-box { background-color: #1f2937; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; margin: 20px 0; border-radius: 8px; letter-spacing: 8px; }
          .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${clinicName}</h1>
            <h2>Password Reset Request</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You requested to reset your password for your ${clinicName} account.</p>
            <p>Your 6-digit reset code is:</p>
            <div class="token-box">${token}</div>
            <div class="warning">
              <strong>Important:</strong> This code will expire in 15 minutes for security reasons.
            </div>
            <p>To reset your password:</p>
            <ol>
              <li>Go to the password reset page</li>
              <li>Enter your email address</li>
              <li>Enter the 6-digit code above</li>
              <li>Create your new password</li>
            </ol>
            <p>If you didn't request this password reset, please ignore this email. Your account remains secure.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from ${clinicName}.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hello,

You requested to reset your password for your ${clinicName} account.

Your 6-digit reset code is: ${token}

This code will expire in 15 minutes for security reasons.

To reset your password:
1. Go to the password reset page
2. Enter your email address
3. Enter the 6-digit code above
4. Create your new password

If you didn't request this password reset, please ignore this email. Your account remains secure.

Best regards,
${clinicName} Team
    `
  };
};

export default getPasswordResetEmailTemplate;
