// src/pages/patient/Settings.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FiKey, FiBell, FiShield, FiLogOut, FiEye, FiEyeOff } from 'react-icons/fi';
import supabase from '../../config/supabaseClient';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const Settings = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { logSettingsView, logSettingsUpdate, logPasswordChange } = useUniversalAudit();
  const [activeTab, setActiveTab] = useState('password');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    email_appointment_reminders: true,
    email_treatment_reminders: true,
    email_payment_reminders: true,
    sms_appointment_reminders: false,
    sms_emergency_updates: false,
  });
  
  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState({
    share_data_with_healthcare_providers: true,
    share_data_for_research: false,
    allow_anonymous_data_collection: false,
  });
  
  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // Password change errors
  const [passwordErrors, setPasswordErrors] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // Password strength indicator
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: '',
  });

  // Add state for password visibility
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Success message state
  const [successMessage, setSuccessMessage] = useState('');

  // Function to check password strength
  const checkPasswordStrength = (password) => {
    // Simple password strength check for demonstration
    let score = 0;
    let feedback = '';

    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score === 0) feedback = 'Very weak';
    else if (score === 1) feedback = 'Weak';
    else if (score === 2) feedback = 'Fair';
    else if (score === 3) feedback = 'Good';
    else if (score === 4) feedback = 'Strong';
    else feedback = 'Very strong';

    return { score, feedback };
  };

  useEffect(() => {
    if (user) {
      // Log page view
      logSettingsView('patient');
      
      fetchNotificationSettings();
      fetchPrivacySettings();
    }
  }, [user, logSettingsView]);

  // Clear success message when changing tabs
  useEffect(() => {
    setSuccessMessage('');
  }, [activeTab]);

  const fetchNotificationSettings = async () => {
    try {
      // For demo purposes: check if the table exists
      const { error: tableError } = await supabase
        .from('notification_settings')
        .select('count')
        .limit(1);

      // If table doesn't exist or error occurs, use the default settings
      if (tableError) {
        console.log('Using default notification settings (table may not exist)');
        return;
      }

      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching notification settings:', error.message);
        return;
      }
      
      if (data) {
        setNotificationSettings(data);
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    }
  };

  const fetchPrivacySettings = async () => {
    try {
      // For demo purposes: check if the table exists
      const { error: tableError } = await supabase
        .from('privacy_settings')
        .select('count')
        .limit(1);

      // If table doesn't exist or error occurs, use the default settings
      if (tableError) {
        console.log('Using default privacy settings (table may not exist)');
        return;
      }

      const { data, error } = await supabase
        .from('privacy_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching privacy settings:', error.message);
        return;
      }
      
      if (data) {
        setPrivacySettings(data);
      }
    } catch (error) {
      console.error('Error fetching privacy settings:', error);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm({
      ...passwordForm,
      [name]: value,
    });
    
    // Clear the specific error when user types
    if (passwordErrors[name]) {
      setPasswordErrors({
        ...passwordErrors,
        [name]: '',
      });
    }

    // Update password strength indicator when newPassword changes
    if (name === 'newPassword') {
      setPasswordStrength(checkPasswordStrength(value));
    }
  };

  // Function to calculate password similarity
  const calculatePasswordSimilarity = (password1, password2) => {
    if (!password1 || !password2) return 0;
    
    const longer = password1.length > password2.length ? password1 : password2;
    const shorter = password1.length > password2.length ? password2 : password1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  // Levenshtein distance calculation for password similarity
  const levenshteinDistance = (str1, str2) => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  const validatePasswordForm = () => {
    const errors = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    };
    
    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }
    
    if (!passwordForm.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (passwordForm.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(passwordForm.newPassword)) {
      errors.newPassword = 'Password must include at least one special character';
    }
    
    // Check if new password is too similar to current password
    if (passwordForm.currentPassword && passwordForm.newPassword) {
      const similarity = calculatePasswordSimilarity(passwordForm.currentPassword, passwordForm.newPassword);
      if (similarity > 0.7) {
        errors.newPassword = 'New password is too similar to current password. Please choose a more different password.';
      }
    }
    
    if (!passwordForm.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setPasswordErrors(errors);
    
    // Return true if no errors (all error messages are empty)
    return !Object.values(errors).some(error => error);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (!validatePasswordForm()) {
      return;
    }
    
    setIsPasswordLoading(true);
    
    try {
      // Update password using Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });
      
      if (error) throw error;
      
      // Reset loading state immediately
      setIsPasswordLoading(false);
      
      // Show success notification
      toast.success('Password updated successfully! You will be logged out in 2 seconds.');
      
      // Wait 2 seconds then logout
      setTimeout(async () => {
        try {
          await logout();
          navigate('/login');
        } catch (logoutError) {
          console.error('Error during logout:', logoutError);
          // Force redirect anyway
          window.location.href = '/login';
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error updating password:', error.message);
      toast.error(`Password update failed: ${error.message || 'Unknown error'}`);
      setIsPasswordLoading(false);
    }
  };

  const handleNotificationChange = (e) => {
    const { name, checked } = e.target;
    setNotificationSettings({
      ...notificationSettings,
      [name]: checked,
    });
  };

  const handlePrivacyChange = (e) => {
    const { name, checked } = e.target;
    setPrivacySettings({
      ...privacySettings,
      [name]: checked,
    });
  };

  const saveNotificationSettings = async () => {
    setIsLoading(true);
    try {
      // For demo purposes: check if the table exists
      const { error: tableError } = await supabase
        .from('notification_settings')
        .select('count')
        .limit(1);

      if (tableError) {
        // In a real app, you would create the table here if needed
        console.log('Table may not exist. In a real app, we would create it here.');
        // Simulate success for demo
        await new Promise(resolve => setTimeout(resolve, 800));
        toast.success('Notification settings saved (simulation)');
        setIsLoading(false);
        return;
      }

      const { data: existingSettings, error: queryError } = await supabase
        .from('notification_settings')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (queryError && queryError.code !== 'PGRST116') {
        throw new Error(`Query error: ${queryError.message}`);
      }
      
      let result;
      
      if (existingSettings) {
        // Update existing settings
        result = await supabase
          .from('notification_settings')
          .update({
            ...notificationSettings,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSettings.id);
      } else {
        // Insert new settings
        result = await supabase
          .from('notification_settings')
          .insert([
            {
              user_id: user.id,
              ...notificationSettings,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);
      }
      
      if (result.error) throw new Error(result.error.message);
      
      toast.success('Notification settings saved');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error(`Failed to save notification settings: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const savePrivacySettings = async () => {
    setIsLoading(true);
    try {
      // For demo purposes: check if the table exists
      const { error: tableError } = await supabase
        .from('privacy_settings')
        .select('count')
        .limit(1);

      if (tableError) {
        // In a real app, you would create the table here if needed
        console.log('Table may not exist. In a real app, we would create it here.');
        // Simulate success for demo
        await new Promise(resolve => setTimeout(resolve, 800));
        toast.success('Privacy settings saved (simulation)');
        setIsLoading(false);
        return;
      }

      const { data: existingSettings, error: queryError } = await supabase
        .from('privacy_settings')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (queryError && queryError.code !== 'PGRST116') {
        throw new Error(`Query error: ${queryError.message}`);
      }
      
      let result;
      
      if (existingSettings) {
        // Update existing settings
        result = await supabase
          .from('privacy_settings')
          .update({
            ...privacySettings,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSettings.id);
      } else {
        // Insert new settings
        result = await supabase
          .from('privacy_settings')
          .insert([
            {
              user_id: user.id,
              ...privacySettings,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);
      }
      
      if (result.error) throw new Error(result.error.message);
      
      toast.success('Privacy settings saved');
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      toast.error(`Failed to save privacy settings: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out');
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
          <button
            onClick={handleLogout}
            className="flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
            aria-label="Log out"
          >
            <FiLogOut className="mr-2" />
            Logout
          </button>
        </div>

        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`px-4 py-2 mr-4 font-medium text-sm ${
              activeTab === 'password'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('password')}
          >
            <div className="flex items-center">
              <FiKey className="mr-2" />
              <span>Password</span>
            </div>
          </button>
          <button
            className={`px-4 py-2 mr-4 font-medium text-sm ${
              activeTab === 'notifications'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('notifications')}
          >
            <div className="flex items-center">
              <FiBell className="mr-2" />
              <span>Notifications</span>
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
                     {/* Password Tab */}
           {activeTab === 'password' && (
             <div>
               {successMessage && (
                 <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                   <div className="flex">
                     <div className="flex-shrink-0">
                       <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                         <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                       </svg>
                     </div>
                     <div className="ml-3">
                       <p className="text-sm font-medium text-green-800">
                         {successMessage}
                       </p>
                     </div>
                   </div>
                 </div>
               )}
               
               <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    id="currentPassword"
                    name="currentPassword"
                    className={`w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${passwordErrors.currentPassword ? 'border-red-500' : 'border-gray-300'}`}
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showCurrentPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="mt-1 text-xs text-red-500">{passwordErrors.currentPassword}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    id="newPassword"
                    name="newPassword"
                    className={`w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${passwordErrors.newPassword ? 'border-red-500' : 'border-gray-300'}`}
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
                {passwordForm.newPassword && (
                  <div className="mt-2">
                    <div className="flex items-center">
                      <div className="flex-1 h-2 bg-gray-200 rounded">
                        <div 
                          className={`h-2 rounded ${
                            passwordStrength.score <= 1 ? 'bg-red-500' : 
                            passwordStrength.score <= 3 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${passwordStrength.score * 20}%` }}
                        ></div>
                      </div>
                      <span className="ml-2 text-xs text-gray-500">{passwordStrength.feedback}</span>
                    </div>
                  </div>
                )}
                {passwordErrors.newPassword && (
                  <p className="mt-1 text-xs text-red-500">{passwordErrors.newPassword}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    className={`w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${passwordErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
                {passwordErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">{passwordErrors.confirmPassword}</p>
                )}
              </div>
              
                             <div>
                                                     <button
                    type="submit"
                    disabled={isPasswordLoading}
                    className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
                  >
                    {isPasswordLoading ? 'Updating Password...' : 'Update Password'}
                  </button>
                  
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-blue-800">
                          <strong>Note:</strong> After changing your password, you need to restart the page to apply changes. When you log out and log back in, use your new password.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
          </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Email Notifications</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Appointment Reminders</p>
                      <p className="text-xs text-gray-500">Receive email reminders about upcoming appointments</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="email_appointment_reminders"
                        className="sr-only peer"
                        checked={notificationSettings.email_appointment_reminders}
                        onChange={handleNotificationChange}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Treatment Reminders</p>
                      <p className="text-xs text-gray-500">Receive email reminders about your treatments</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="email_treatment_reminders"
                        className="sr-only peer"
                        checked={notificationSettings.email_treatment_reminders}
                        onChange={handleNotificationChange}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Payment Reminders</p>
                      <p className="text-xs text-gray-500">Receive email reminders about upcoming payments</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="email_payment_reminders"
                        className="sr-only peer"
                        checked={notificationSettings.email_payment_reminders}
                        onChange={handleNotificationChange}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                  </div>
                </div>
              </div>
              
              {/* SMS Notifications */}
              
              
              <div>
                <button
                  onClick={saveNotificationSettings}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
                >
                  Save Notification Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;