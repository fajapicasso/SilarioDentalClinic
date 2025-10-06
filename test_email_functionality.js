// Test script to verify email functionality
// Run this in your browser console on your application

async function testForgotPassword(email) {
  console.log('Testing forgot password functionality...');
  
  try {
    // Import supabase client (you'll need to adjust the path)
    const { createClient } = await import('https://cdn.skypack.dev/@supabase/supabase-js@2');
    
    // Initialize Supabase client
    const supabaseUrl = 'YOUR_SUPABASE_URL'; // Replace with your actual URL
    const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your actual key
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('Sending password reset email to:', email);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      emailRedirectOptions: {
        subject: 'Test - Reset your password - Silario Dental Clinic',
        body: 'This is a test email. Click the link below to reset your password:',
      }
    });
    
    if (error) {
      console.error('Error sending email:', error);
      return false;
    }
    
    console.log('✅ Password reset email sent successfully!');
    console.log('Check your email inbox (including spam folder)');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Usage:
// testForgotPassword('your-email@gmail.com');

console.log('Email test function loaded. Use: testForgotPassword("your-email@gmail.com")');
