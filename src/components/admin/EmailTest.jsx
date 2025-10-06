// src/components/admin/EmailTest.jsx
import React, { useState } from 'react';
import { FiMail, FiSend, FiCheck, FiX, FiSettings } from 'react-icons/fi';
import emailService from '../../services/emailService';
import { toast } from 'react-toastify';

const EmailTest = () => {
  const [testEmail, setTestEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [configuration, setConfiguration] = useState(null);

  const checkConfiguration = async () => {
    try {
      const config = await emailService.validateConfiguration();
      setConfiguration(config);
    } catch (error) {
      console.error('Error checking configuration:', error);
      setConfiguration({
        valid: false,
        provider: 'unknown',
        message: error.message
      });
    }
  };

  const sendTestEmail = async (e) => {
    e.preventDefault();
    if (!testEmail) {
      toast.error('Please enter an email address');
      return;
    }

    setIsLoading(true);
    try {
      await emailService.sendTestEmail(testEmail);
      toast.success('Test email sent successfully! Check your inbox.');
    } catch (error) {
      console.error('Test email failed:', error);
      toast.error(`Failed to send test email: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    checkConfiguration();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-6">
        <FiMail className="h-6 w-6 text-primary-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-900">Email Service Test</h2>
      </div>

      {/* Configuration Status */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Configuration Status</h3>
          <button
            onClick={checkConfiguration}
            className="text-sm text-primary-600 hover:text-primary-500 flex items-center"
          >
            <FiSettings className="h-4 w-4 mr-1" />
            Refresh
          </button>
        </div>
        
        {configuration ? (
          <div className={`p-4 rounded-lg border-l-4 ${
            configuration.valid 
              ? 'bg-green-50 border-green-400' 
              : 'bg-red-50 border-red-400'
          }`}>
            <div className="flex items-center">
              {configuration.valid ? (
                <FiCheck className="h-5 w-5 text-green-400 mr-2" />
              ) : (
                <FiX className="h-5 w-5 text-red-400 mr-2" />
              )}
              <div>
                <p className={`text-sm font-medium ${
                  configuration.valid ? 'text-green-800' : 'text-red-800'
                }`}>
                  {configuration.valid ? 'Email service configured' : 'Email service not configured'}
                </p>
                <p className={`text-sm ${
                  configuration.valid ? 'text-green-700' : 'text-red-700'
                }`}>
                  Provider: {configuration.provider}
                </p>
                {!configuration.valid && (
                  <p className="text-sm text-red-700 mt-1">
                    {configuration.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Checking configuration...</p>
          </div>
        )}
      </div>

      {/* Test Email Form */}
      <form onSubmit={sendTestEmail} className="space-y-4">
        <div>
          <label htmlFor="testEmail" className="block text-sm font-medium text-gray-700 mb-2">
            Test Email Address
          </label>
          <input
            type="email"
            id="testEmail"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="your-email@gmail.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !configuration?.valid}
          className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
          ) : (
            <FiSend className="h-4 w-4 mr-2" />
          )}
          Send Test Email
        </button>
      </form>

      {/* Setup Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Quick Setup with EmailJS:</h4>
        <ol className="text-sm text-blue-800 space-y-1">
          <li>1. Create account at <a href="https://www.emailjs.com/" target="_blank" rel="noopener noreferrer" className="underline">EmailJS.com</a></li>
          <li>2. Set up email service (Gmail/Outlook)</li>
          <li>3. Create email template</li>
          <li>4. Add environment variables to .env file</li>
          <li>5. Test email functionality here</li>
        </ol>
        <p className="text-xs text-blue-700 mt-2">
          See EMAIL_SETUP_GUIDE.md for detailed instructions.
        </p>
      </div>
    </div>
  );
};

export default EmailTest;
