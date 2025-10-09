// src/pages/auth/ResetPassword.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { FiLock, FiEye, FiEyeOff, FiArrowLeft, FiMail, FiKey } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

const passwordRegExp = /^(?=.*[!@#$%^&*])(?=.*[a-zA-Z0-9]).{8,}$/;

const ResetPasswordSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  token: Yup.string()
    .matches(/^\d{6}$/, 'Reset code must be exactly 6 digits')
    .required('Reset code is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      passwordRegExp,
      'Password must contain at least 8 characters and one special character'
    )
    .required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Please confirm your new password'),
});

const ResetPassword = () => {
  const { resetPasswordWithToken } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameFromEmail, setCameFromEmail] = useState(false);

  // Check if user came from email link and extract token if present
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromEmail = urlParams.get('from') === 'email';
    const token = urlParams.get('token');
    const referrer = document.referrer;
    const hasEmailReferrer = referrer.includes('gmail.com') || 
                            referrer.includes('outlook.com') || 
                            referrer.includes('mail.') ||
                            fromEmail;
    
    console.log('URL params:', window.location.search);
    console.log('From email param:', fromEmail);
    console.log('Token from URL:', token);
    console.log('Referrer:', referrer);
    console.log('Came from email:', hasEmailReferrer);
    
    if (hasEmailReferrer) {
      setCameFromEmail(true);
    }
    
    // If token is in URL, we can pre-fill it or handle it differently
    if (token) {
      console.log('Token found in URL:', token);
      // You could pre-fill the token field or handle it automatically
    }
  }, []);

  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    setIsLoading(true);
    try {
      console.log("Reset password attempt:", {
        email: values.email,
        token: values.token,
        tokenLength: values.token.length
      });
      
      const { success, error, role, message, autoLoginFailed } = await resetPasswordWithToken(
        values.email,
        values.token,
        values.password
      );
      
      if (success) {
        resetForm();
        toast.success(message || 'Password reset successfully!');
        
        if (autoLoginFailed) {
          // Password was reset but auto-login failed, redirect to login
          navigate('/login');
        } else {
          // User is now logged in, redirect to appropriate dashboard
          switch (role) {
            case 'admin':
              navigate('/admin/dashboard');
              break;
            case 'doctor':
              navigate('/doctor/dashboard');
              break;
            case 'staff':
              navigate('/staff/dashboard');
              break;
            case 'patient':
              navigate('/patient/dashboard');
              break;
            default:
              navigate('/');
          }
        }
      } else {
        toast.error(error || 'Failed to reset password. Please try again.');
      }
    } catch (error) {
      toast.error('An unexpected error occurred. Please try again.');
      console.error('Reset password error:', error);
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
          <h2 className="mt-6 text-2xl font-bold text-gray-900">Reset Your Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email, the 6-digit reset code you received, and choose a new password.
          </p>
          
          {/* Show helpful message if user came from email */}
          {cameFromEmail && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    <strong>📧 Coming from your email?</strong> Enter the same email address you used to request the reset, along with the 6-digit code from your email.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <Formik
          initialValues={{ email: '', token: '', password: '', confirmPassword: '' }}
          validationSchema={ResetPasswordSchema}
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
                <label htmlFor="token" className="block text-sm font-medium text-gray-700">
                  Reset Code
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiKey className="h-5 w-5 text-gray-400" />
                  </div>
                  <Field
                    id="token"
                    name="token"
                    type="text"
                    maxLength="6"
                    className={`block w-full pl-10 pr-3 py-2 border ${
                      errors.token && touched.token
                        ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500'
                    } rounded-md shadow-sm text-center text-lg tracking-widest font-mono`}
                    placeholder="123456"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Enter the 6-digit code sent to your email
                </p>
                <ErrorMessage
                  name="token"
                  component="p"
                  className="mt-1 text-sm text-red-600"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiLock className="h-5 w-5 text-gray-400" />
                  </div>
                  <Field
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className={`block w-full pl-10 pr-10 py-2 border ${
                      errors.password && touched.password
                        ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500'
                    } rounded-md shadow-sm`}
                    placeholder="********"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                      {showPassword ? (
                        <FiEyeOff className="h-5 w-5" />
                      ) : (
                        <FiEye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Password must be at least 8 characters and include at least one special character.
                </p>
                <ErrorMessage
                  name="password"
                  component="p"
                  className="mt-1 text-sm text-red-600"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiLock className="h-5 w-5 text-gray-400" />
                  </div>
                  <Field
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className={`block w-full pl-10 pr-10 py-2 border ${
                      errors.confirmPassword && touched.confirmPassword
                        ? 'border-red-300 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500'
                    } rounded-md shadow-sm`}
                    placeholder="********"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                      {showConfirmPassword ? (
                        <FiEyeOff className="h-5 w-5" />
                      ) : (
                        <FiEye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                <ErrorMessage
                  name="confirmPassword"
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
                      'Reset Password'
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <Link
                    to="/forgot-password"
                    className="font-medium text-primary-600 hover:text-primary-500"
                  >
                    <div className="flex items-center">
                      <FiArrowLeft className="mr-1" />
                      Get new code
                    </div>
                  </Link>
                  <Link
                    to="/login"
                    className="font-medium text-primary-600 hover:text-primary-500"
                  >
                    Back to login
                  </Link>
                </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default ResetPassword;