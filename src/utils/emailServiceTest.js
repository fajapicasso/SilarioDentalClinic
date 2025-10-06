// src/utils/emailServiceTest.js - Test email service functionality
import emailService from '../services/emailService';

export const testEmailService = async () => {
  console.log('=== EMAIL SERVICE TEST ===');
  
  try {
    // Test configuration validation
    const config = await emailService.validateConfiguration();
    console.log('Email service configuration:', config);
    
    if (!config.valid) {
      console.log('Email service not configured - will use development mode');
      console.log('Provider:', config.provider);
      console.log('Message:', config.message);
    }
    
    // Test sending a password reset token
    const testEmail = 'test@example.com';
    const testToken = '123456';
    const testExpiry = new Date(Date.now() + 15 * 60 * 1000);
    
    console.log('Testing password reset email sending...');
    const result = await emailService.sendPasswordResetToken(testEmail, testToken, testExpiry);
    
    console.log('Email service result:', result);
    
    if (result.development) {
      console.log('✅ Development mode working correctly');
      console.log('Token would be:', testToken);
      console.log('Check console for email details');
    } else {
      console.log('✅ Production email sent successfully');
      console.log('Message ID:', result.messageId);
    }
    
    return { success: true, result };
    
  } catch (error) {
    console.error('❌ Email service test failed:', error);
    return { success: false, error: error.message };
  }
};

// Auto-run test when imported (for debugging)
if (typeof window !== 'undefined') {
  // Run test after a short delay to ensure everything is loaded
  setTimeout(() => {
    console.log('Auto-running email service test...');
    testEmailService();
  }, 1000);
}

export default testEmailService;
