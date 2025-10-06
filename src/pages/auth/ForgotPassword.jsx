// src/pages/auth/ForgotPassword.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import emailService from '../../services/emailService';
import { runPasswordResetDiagnostic } from '../../utils/passwordResetDiagnostic';

const ForgotPasswordSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
});

const ForgotPassword = () => {
  const { requestPasswordResetToken } = useAuth();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState(''); // For development - remove in production
  const [emailServiceStatus, setEmailServiceStatus] = useState(null);

  // Check email service configuration on component mount
  useEffect(() => {
    const checkEmailService = async () => {
      try {
        const config = await emailService.validateConfiguration();
        setEmailServiceStatus(config);
        console.log('Email service configuration:', config);
      } catch (error) {
        console.error('Error checking email service:', error);
        setEmailServiceStatus({
          valid: false,
          provider: 'error',
          message: error.message
        });
      }
    };
    
    checkEmailService();
  }, []);

  // Add diagnostic button for troubleshooting
  const runDiagnostic = async () => {
    console.log('🔧 Running password reset diagnostic...');
    await runPasswordResetDiagnostic();
  };

  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    setIsLoading(true);
    try {
      const { success, error, token, emailError, developmentMode, message } = await requestPasswordResetToken(values.email);
      
      if (success) {
        resetForm();
        setIsSuccess(true);
        setResetToken(token); // For development - remove in production
        
        if (developmentMode) {
          toast.info(message || 'Development mode: Reset token generated. Check console for details.');
        } else if (emailError) {
          toast.warning(message || 'Reset code generated, but email delivery failed. Your code is displayed below.');
        } else {
          toast.success(message || 'A 6-digit reset code has been sent to your email');
        }
      } else {
        toast.error(error || 'Failed to send reset code. Please try again.');
      }
    } catch (error) {
      toast.error('An unexpected error occurred. Please try again.');
      console.error('Password reset token request error:', error);
    } finally {
      setSubmitting(false);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary-600">Silario Dental Clinic</h1>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">Forgot Your Password?</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email address and we'll send you a 6-digit reset code to reset your password.
          </p>
          
          {/* Debug: Email Service Status */}
          {emailServiceStatus && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              emailServiceStatus.valid 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-blue-50 border border-blue-200 text-blue-800'
            }`}>
              <div className="flex items-center">
                <span className="font-medium">Email Service:</span>
                <span className="ml-2">{emailServiceStatus.provider}</span>
              </div>
              <p className="mt-1 text-xs">{emailServiceStatus.message}</p>
            </div>
          )}
          
          {/* Development Diagnostic Button */}
          {import.meta.env.DEV && (
            <div className="mt-4">
              <button
                type="button"
                onClick={runDiagnostic}
                className="text-xs px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded border border-yellow-300"
              >
                🔧 Run Diagnostic (Check Console)
              </button>
            </div>
          )}
        </div>
        
        {isSuccess ? (
          <div className="mt-8">
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Reset Code Sent</h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>
                      We've sent a 6-digit reset code to your email address. Please check your inbox and use the code to reset your password.
                    </p>
                    {resetToken && (
                      <div className="mt-3 p-3 bg-blue-100 border border-blue-300 rounded">
                        <p className="text-blue-800 text-sm font-medium">
                          📧 Development Mode
                        </p>
                        <p className="text-blue-700 text-sm mt-1">
                          Your reset code is: <strong className="text-lg font-mono">{resetToken}</strong>
                        </p>
                        <p className="text-blue-600 text-xs mt-2">
                          In production, this would be sent to your email. Check console for more details.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex flex-col space-y-3">
              <Link
                to="/reset-password"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Continue to Reset Password
              </Link>
              <div className="flex items-center justify-between">
                <Link
                  to="/login"
                  className="text-sm font-medium text-primary-600 hover:text-primary-500"
                >
                  <div className="flex items-center">
                    <FiArrowLeft className="mr-1" />
                    Back to login
                  </div>
                </Link>
                <button
                  onClick={() => setIsSuccess(false)}
                  className="text-sm font-medium text-gray-600 hover:text-gray-500"
                >
                  Try another email
                </button>
              </div>
            </div>
          </div>
        ) : (
          <Formik
            initialValues={{ email: '' }}
            validationSchema={ForgotPasswordSchema}
            onSubmit={handleSubmit}
          >
            {({ isSubmitting, errors, touched }) => (
              <Form className="mt-8 space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiMail className="h-5 w-5 text-gray-400" />
                    </div>
                    <Field
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      className={`block w-full pl-10 pr-3 py-2 border ${
                        errors.email && touched.email
                          ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500'
                      } rounded-md shadow-sm`}
                      placeholder="you@example.com"
                    />
                  </div>
                  <ErrorMessage
                    name="email"
                    component="p"
                    className="mt-1 text-sm text-red-600"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoading}
                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300 disabled:cursor-not-allowed"
                  >
                    {isLoading || isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'Send Reset Code'
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <Link
                    to="/login"
                    className="text-sm font-medium text-primary-600 hover:text-primary-500"
                  >
                    <div className="flex items-center">
                      <FiArrowLeft className="mr-1" />
                      Back to login
                    </div>
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm font-medium text-primary-600 hover:text-primary-500"
                  >
                    Create an account
                  </Link>
                </div>
              </Form>
            )}
          </Formik>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;