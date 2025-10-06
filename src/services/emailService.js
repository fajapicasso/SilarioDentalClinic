// src/services/emailService.js
class EmailService {
  constructor() {
    // Auto-detect available email provider
    this.emailProvider = this.detectProvider();
    this.initialized = false;
  }

  detectProvider() {
    // Check for EmailJS configuration
    if (import.meta.env.VITE_EMAILJS_PUBLIC_KEY && 
        import.meta.env.VITE_EMAILJS_SERVICE_ID && 
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID) {
      return 'emailjs';
    }
    
    // Check for API configuration
    if (import.meta.env.VITE_API_KEY) {
      return 'api';
    }
    
    // Fallback to console/development mode
    return 'console';
  }

  async initialize() {
    try {
      console.log('Initializing email service with provider:', this.emailProvider);
      
      if (this.emailProvider === 'emailjs') {
        // Load EmailJS dynamically
        if (typeof window !== 'undefined' && !window.emailjs) {
          await this.loadEmailJS();
        }
      } else if (this.emailProvider === 'console') {
        console.log('Email service running in development mode - no actual emails will be sent');
      }
      
      this.initialized = true;
      console.log('Email service initialized successfully with provider:', this.emailProvider);
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      // For console provider, don't throw error - just log it
      if (this.emailProvider === 'console') {
        this.initialized = true;
        console.log('Email service falling back to console mode');
      } else {
        throw error;
      }
    }
  }

  async loadEmailJS() {
    return new Promise((resolve, reject) => {
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
      
      if (!publicKey || publicKey === 'YOUR_EMAILJS_PUBLIC_KEY') {
        reject(new Error('EmailJS public key not configured'));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
      script.onload = () => {
        try {
          // Initialize EmailJS with your public key
          window.emailjs.init(publicKey);
          console.log('EmailJS initialized successfully');
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      script.onerror = () => reject(new Error('Failed to load EmailJS library'));
      document.head.appendChild(script);
    });
  }

  async sendPasswordResetToken(email, token, expiresAt) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      switch (this.emailProvider) {
        case 'emailjs':
          return await this.sendViaEmailJS(email, token, expiresAt);
        case 'supabase':
          return await this.sendViaSupabase(email, token, expiresAt);
        case 'api':
          return await this.sendViaAPI(email, token, expiresAt);
        case 'console':
          return await this.sendViaConsole(email, token, expiresAt);
        default:
          throw new Error(`Unsupported email provider: ${this.emailProvider}`);
      }
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw error;
    }
  }

  async sendViaEmailJS(email, token, expiresAt) {
    if (typeof window === 'undefined' || !window.emailjs) {
      throw new Error('EmailJS not available');
    }

    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;

    if (!serviceId || !templateId || serviceId === 'YOUR_SERVICE_ID' || templateId === 'YOUR_TEMPLATE_ID') {
      throw new Error('EmailJS service ID or template ID not configured');
    }

    // Calculate expiry time for the template
    const expiryTime = new Date(expiresAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const templateParams = {
      to_name: email.split('@')[0], // Extract name from email
      to_email: email,
      from_name: 'Silario Dental Clinic',
      reset_token: token,
      time: expiryTime, // Match your template's {{time}} variable
      expires_in: '15 minutes',
      clinic_name: 'Silario Dental Clinic',
      support_email: 'support@silariodental.com',
      reply_to: 'noreply@silariodental.com',
      reset_link: `${window.location.origin}/reset-password?from=email`, // Add reset link
      website_link: window.location.origin
    };

    console.log('EmailJS Template Parameters:', templateParams);
    console.log('Service ID:', serviceId);
    console.log('Template ID:', templateId);

    try {
      const result = await window.emailjs.send(serviceId, templateId, templateParams);
      console.log('EmailJS result:', result);
      return { success: true, messageId: result.text };
    } catch (emailError) {
      console.error('EmailJS detailed error:', emailError);
      console.error('Error status:', emailError.status);
      console.error('Error text:', emailError.text);
      
      // Handle specific EmailJS errors
      if (emailError.status === 422) {
        if (emailError.text.includes('recipients address is empty')) {
          throw new Error('Email template configuration error: recipient address not set. Check EmailJS template "To Email" field.');
        } else if (emailError.text.includes('template')) {
          throw new Error('Email template error: Check your EmailJS template configuration and variables.');
        } else {
          throw new Error(`EmailJS validation error: ${emailError.text}`);
        }
      } else if (emailError.status === 400) {
        throw new Error('EmailJS configuration error: Check your service ID and template ID.');
      } else {
        throw new Error(`EmailJS error (${emailError.status}): ${emailError.text}`);
      }
    }
  }

  async sendViaSupabase(email, token, expiresAt) {
    // Using Supabase Edge Functions for email sending
    const response = await fetch('/api/send-reset-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        token,
        expiresAt,
        template: 'password-reset'
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send email via Supabase');
    }

    const result = await response.json();
    return { success: true, messageId: result.messageId };
  }

  async sendViaAPI(email, token, expiresAt) {
    // Using your own API endpoint
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_API_KEY || ''}`
      },
      body: JSON.stringify({
        to: email,
        subject: 'Reset Your Password - Silario Dental Clinic',
        template: 'password-reset',
        data: {
          token,
          expiresAt,
          clinicName: 'Silario Dental Clinic'
        }
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send email via API');
    }

    const result = await response.json();
    return { success: true, messageId: result.messageId };
  }

  // Development/Console method (no actual email sent)
  async sendViaConsole(email, token, expiresAt) {
    console.log('=== PASSWORD RESET EMAIL (Development Mode) ===');
    console.log(`To: ${email}`);
    console.log(`Reset Token: ${token}`);
    console.log(`Expires At: ${expiresAt}`);
    console.log('=== Email would be sent in production ===');
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return { success: true, messageId: 'console-log', development: true };
  }

  // Fallback method using mailto (for development/testing)
  async sendViaMailto(email, token) {
    const subject = encodeURIComponent('Your Password Reset Code - Silario Dental Clinic');
    const body = encodeURIComponent(`
Hello,

Your password reset code is: ${token}

This code will expire in 15 minutes.

If you didn't request this reset, please ignore this email.

Best regards,
Silario Dental Clinic Team
    `);

    const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;
    
    if (typeof window !== 'undefined') {
      window.open(mailtoUrl);
    }
    
    return { success: true, messageId: 'mailto-opened' };
  }

  // Method to send test email
  async sendTestEmail(email) {
    return await this.sendPasswordResetToken(email, '123456', new Date(Date.now() + 15 * 60 * 1000));
  }

  // Method to validate email configuration
  async validateConfiguration() {
    try {
      switch (this.emailProvider) {
        case 'emailjs':
          return {
            valid: !!(import.meta.env.VITE_EMAILJS_PUBLIC_KEY && 
                     import.meta.env.VITE_EMAILJS_SERVICE_ID && 
                     import.meta.env.VITE_EMAILJS_TEMPLATE_ID),
            provider: 'EmailJS',
            message: 'Requires VITE_EMAILJS_PUBLIC_KEY, VITE_EMAILJS_SERVICE_ID, and VITE_EMAILJS_TEMPLATE_ID'
          };
        case 'api':
          return {
            valid: !!import.meta.env.VITE_API_KEY,
            provider: 'API',
            message: 'Requires VITE_API_KEY'
          };
        case 'console':
          return {
            valid: true,
            provider: 'Console (Development)',
            message: 'Development mode - tokens logged to console. No actual emails sent.'
          };
        default:
          return {
            valid: false,
            provider: this.emailProvider,
            message: 'Email provider not configured'
          };
      }
    } catch (error) {
      return {
        valid: false,
        provider: this.emailProvider,
        message: error.message
      };
    }
  }
}

// Create singleton instance
const emailService = new EmailService();

export default emailService;
