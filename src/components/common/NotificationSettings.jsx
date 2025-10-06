// src/pages/common/NotificationSettings.jsx
import React, { useState, useEffect } from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import { toast } from 'react-toastify';
import { 
  FiSettings, 
  FiBell, 
  FiMail, 
  FiSmartphone,
  FiClock,
  FiUser,
  FiCalendar,
  FiDollarSign,
  FiUsers,
  FiInfo,
  FiSave,
  FiArrowLeft
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const NotificationSettings = () => {
  const { preferences, updatePreferences, isLoading } = useNotification();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email_notifications: true,
    push_notifications: true,
    appointment_reminders: true,
    payment_notifications: true,
    queue_updates: true,
    system_notifications: true,
    reminder_hours: 24
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load preferences into form when available
  useEffect(() => {
    if (preferences) {
      setFormData({
        email_notifications: preferences.email_notifications ?? true,
        push_notifications: preferences.push_notifications ?? true,
        appointment_reminders: preferences.appointment_reminders ?? true,
        payment_notifications: preferences.payment_notifications ?? true,
        queue_updates: preferences.queue_updates ?? true,
        system_notifications: preferences.system_notifications ?? true,
        reminder_hours: preferences.reminder_hours ?? 24
      });
    }
  }, [preferences]);

  // Track changes
  useEffect(() => {
    if (preferences) {
      const hasChanges = Object.keys(formData).some(key => 
        formData[key] !== preferences[key]
      );
      setHasChanges(hasChanges);
    }
  }, [formData, preferences]);

  // Handle form field changes
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Save preferences
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updatePreferences(formData);
      if (result.success) {
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all notification settings to default?')) {
      const defaultSettings = {
        email_notifications: true,
        push_notifications: true,
        appointment_reminders: true,
        payment_notifications: true,
        queue_updates: true,
        system_notifications: true,
        reminder_hours: 24
      };
      setFormData(defaultSettings);
    }
  };

  if (isLoading && !preferences) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-md"
            >
              <FiArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <FiSettings className="mr-3 h-6 w-6" />
                Notification Settings
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Customize how and when you receive notifications
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* General Notification Settings */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <FiBell className="mr-2 h-5 w-5" />
              General Settings
            </h2>
            
            <div className="space-y-4">
              {/* Push Notifications */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <FiSmartphone className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Push Notifications
                    </h3>
                    <p className="text-sm text-gray-500">
                      Receive instant notifications in your browser
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.push_notifications}
                    onChange={(e) => handleChange('push_notifications', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {/* Email Notifications */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <FiMail className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Email Notifications
                    </h3>
                    <p className="text-sm text-gray-500">
                      Receive notifications via email
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.email_notifications}
                    onChange={(e) => handleChange('email_notifications', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {/* System Notifications */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <FiInfo className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      System Notifications
                    </h3>
                    <p className="text-sm text-gray-500">
                      Important system updates and announcements
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.system_notifications}
                    onChange={(e) => handleChange('system_notifications', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Category-Specific Settings */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">
              Notification Categories
            </h2>
            
            <div className="space-y-4">
              {/* Appointment Notifications */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <FiCalendar className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Appointment Notifications
                    </h3>
                    <p className="text-sm text-gray-500">
                      Confirmations, reminders, and appointment updates
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.appointment_reminders}
                    onChange={(e) => handleChange('appointment_reminders', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {/* Payment Notifications */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <FiDollarSign className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Payment Notifications
                    </h3>
                    <p className="text-sm text-gray-500">
                      Payment confirmations, invoices, and billing updates
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.payment_notifications}
                    onChange={(e) => handleChange('payment_notifications', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {/* Queue Updates */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <FiUsers className="h-5 w-5 text-purple-500 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Queue Updates
                    </h3>
                    <p className="text-sm text-gray-500">
                      Queue position changes and waiting time updates
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.queue_updates}
                    onChange={(e) => handleChange('queue_updates', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Timing Settings */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <FiClock className="mr-2 h-5 w-5" />
              Reminder Timing
            </h2>
            
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    Appointment Reminder Time
                  </h3>
                  <p className="text-sm text-gray-500">
                    How far in advance to send appointment reminders
                  </p>
                </div>
                <select
                  value={formData.reminder_hours}
                  onChange={(e) => handleChange('reminder_hours', parseInt(e.target.value))}
                  className="mt-1 block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value={1}>1 hour</option>
                  <option value={2}>2 hours</option>
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>72 hours</option>
                </select>
              </div>
            </div>
          </div>

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <FiInfo className="h-5 w-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm">
                <h3 className="font-medium text-blue-900 mb-1">
                  About Notifications
                </h3>
                <ul className="text-blue-800 space-y-1">
                  <li>• Push notifications work only when your browser is open</li>
                  <li>• Email notifications are sent to your registered email address</li>
                  <li>• You can always view all notifications in the notifications page</li>
                  <li>• Critical system messages will always be delivered regardless of settings</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Reset to Defaults
            </button>
            
            <div className="flex items-center space-x-3">
              {hasChanges && (
                <span className="text-sm text-amber-600 font-medium">
                  You have unsaved changes
                </span>
              )}
              
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <FiSave className="mr-2 h-4 w-4" />
                )}
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;