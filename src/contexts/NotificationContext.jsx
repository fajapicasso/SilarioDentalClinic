// src/contexts/NotificationContext.jsx - Improved with better error handling
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import supabase from '../config/supabaseClient';
import { toast } from 'react-toastify';

const NotificationContext = createContext();

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }) {
  const { user, userRole } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState(null);
  const [realtimeChannel, setRealtimeChannel] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastError, setLastError] = useState(null);

  // Debug logging
  const debugLog = useCallback((message, data = {}) => {
    console.log(`[NotificationContext] ${message}`, data);
  }, []);

  // Clear error after some time
  useEffect(() => {
    if (lastError) {
      const timer = setTimeout(() => {
        setLastError(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [lastError]);

  // Fetch notifications for the current user with role-based filtering
  const fetchNotifications = useCallback(async (limit = 50, showToast = false) => {
    if (!user) {
      debugLog('fetchNotifications: No user available');
      return;
    }
    
    debugLog('fetchNotifications: Starting fetch', { userId: user.id, userRole: userRole, limit });
    setIsLoading(true);
    setLastError(null);
    
    try {
      // Base query for notifications
      let query = supabase
        .from('notifications')
        .select(`
          *,
          sender:profiles!sender_id(id, full_name, role)
        `)
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      // Apply role-based filtering
      const { data, error } = await query;

      if (error) {
        debugLog('fetchNotifications: Supabase error', error);
        throw error;
      }

      // Filter notifications based on user role and notification rules
      const filteredNotifications = filterNotificationsByRole(data || [], userRole);

      debugLog('fetchNotifications: Success', { 
        totalCount: data?.length || 0,
        filteredCount: filteredNotifications.length,
        userRole: userRole,
        sample: filteredNotifications?.[0] ? { id: filteredNotifications[0].id, title: filteredNotifications[0].title, category: filteredNotifications[0].category } : null
      });

      setNotifications(filteredNotifications);
      
      // Calculate unread count from filtered notifications
      const unread = filteredNotifications.filter(n => !n.is_read).length;
      setUnreadCount(unread);
      
      if (showToast) {
        toast.success(`Loaded ${filteredNotifications.length} notifications`);
      }
      
    } catch (error) {
      debugLog('fetchNotifications: Error', error);
      console.error('Error fetching notifications:', error);
      setLastError(error.message || 'Failed to load notifications');
      if (showToast) {
        toast.error('Failed to load notifications');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, userRole, debugLog]);

  // Filter notifications based on user role
  const filterNotificationsByRole = useCallback((notifications, role) => {
    if (!role) return notifications;

    const roleBasedRules = {
      patient: {
        allowedCategories: ['appointment', 'payment', 'dental_chart', 'system', 'personal', 'health', 'prescription'],
        allowedTypes: ['appointment_status', 'payment_update', 'dental_chart_update', 'welcome', 'dental_checkup_due', 'prescription_ready', 'birthday_greeting'],
        description: 'Patients see: appointment status, payment updates, dental chart updates'
      },
      doctor: {
        allowedCategories: ['appointment', 'queue', 'payment', 'patient_record', 'system'],
        allowedTypes: ['appointment_request', 'appointment_reminder', 'patient_arrived', 'emergency_case', 'treatment_followup', 'payment_linked', 'patient_record_update'],
        description: 'Doctors see: their appointments, patient arrivals, payments linked to treatments, patient record updates'
      },
      staff: {
        allowedCategories: ['appointment', 'queue', 'payment', 'billing', 'inventory', 'schedule', 'system', 'training'],
        allowedTypes: ['new_appointment', 'cancelled_appointment', 'patient_checkin', 'next_in_line', 'payment_confirmation', 'appointment_preparation', 'billing_task', 'inventory_alert', 'shift_reminder'],
        description: 'Staff see: appointment updates, queue updates, payment confirmations'
      },
      admin: {
        allowedCategories: ['system', 'user_management', 'appointment', 'billing', 'service', 'queue', 'payment', 'general'],
        allowedTypes: ['all'], // Admins see everything
        description: 'Admins see: all notifications for full system monitoring'
      }
    };

    const rules = roleBasedRules[role];
    if (!rules) {
      console.warn(`No notification rules defined for role: ${role}`);
      return notifications;
    }

    // Admins see everything
    if (role === 'admin') {
      return notifications;
    }

    // Filter notifications based on role rules
    const filtered = notifications.filter(notification => {
      // Check if category is allowed
      if (rules.allowedCategories.includes(notification.category)) {
        return true;
      }

      // Check if type is specifically allowed
      if (rules.allowedTypes.includes('all') || rules.allowedTypes.includes(notification.type)) {
        return true;
      }

      // Check metadata for specific notification types
      if (notification.metadata?.eventType && rules.allowedTypes.includes(notification.metadata.eventType)) {
        return true;
      }

      return false;
    });

    debugLog('filterNotificationsByRole', {
      role,
      originalCount: notifications.length,
      filteredCount: filtered.length,
      rules: rules.description
    });

    return filtered;
  }, [debugLog]);

  // Fetch user notification preferences
  const fetchPreferences = useCallback(async () => {
    if (!user) {
      debugLog('fetchPreferences: No user available');
      return;
    }
    
    debugLog('fetchPreferences: Starting fetch', { userId: user.id });
    
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        debugLog('fetchPreferences: Supabase error', error);
        throw error;
      }

      if (data) {
        debugLog('fetchPreferences: Found existing preferences', data);
        setPreferences(data);
      } else {
        debugLog('fetchPreferences: Creating default preferences');
        // Create default preferences if none exist
        const defaultPrefs = {
          user_id: user.id,
          email_notifications: true,
          push_notifications: true,
          appointment_reminders: true,
          payment_notifications: true,
          queue_updates: true,
          system_notifications: true,
          reminder_hours: 24
        };

        const { data: newPrefs, error: createError } = await supabase
          .from('notification_preferences')
          .insert(defaultPrefs)
          .select()
          .single();

        if (createError) {
          debugLog('fetchPreferences: Error creating defaults', createError);
          throw createError;
        }
        
        debugLog('fetchPreferences: Created default preferences', newPrefs);
        setPreferences(newPrefs);
      }
    } catch (error) {
      debugLog('fetchPreferences: Error', error);
      console.error('Error fetching notification preferences:', error);
      setLastError(error.message || 'Failed to load preferences');
    }
  }, [user, debugLog]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    if (!user) return;
    
    debugLog('markAsRead: Starting', { notificationId });
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('recipient_id', user.id);

      if (error) throw error;

      debugLog('markAsRead: Success', { notificationId });

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true }
            : n
        )
      );

      setUnreadCount(prev => Math.max(0, prev - 1));
      
    } catch (error) {
      debugLog('markAsRead: Error', { notificationId, error });
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user) return;
    
    debugLog('markAllAsRead: Starting');
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      debugLog('markAllAsRead: Success');

      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );

      setUnreadCount(0);
      toast.success('All notifications marked as read');
      
    } catch (error) {
      debugLog('markAllAsRead: Error', error);
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    if (!user) return;
    
    debugLog('deleteNotification: Starting', { notificationId });
    
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('recipient_id', user.id);

      if (error) throw error;

      const deletedNotification = notifications.find(n => n.id === notificationId);
      
      debugLog('deleteNotification: Success', { notificationId, wasUnread: !deletedNotification?.is_read });

      setNotifications(prev => 
        prev.filter(n => n.id !== notificationId)
      );

      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
    } catch (error) {
      debugLog('deleteNotification: Error', { notificationId, error });
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    if (!user) return;
    
    debugLog('clearAllNotifications: Starting');
    
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('recipient_id', user.id);

      if (error) throw error;

      debugLog('clearAllNotifications: Success');

      setNotifications([]);
      setUnreadCount(0);
      toast.success('All notifications cleared');
      
    } catch (error) {
      debugLog('clearAllNotifications: Error', error);
      console.error('Error clearing notifications:', error);
      toast.error('Failed to clear notifications');
    }
  };

  // Create a new notification
  const createNotification = async (notificationData) => {
    debugLog('createNotification: Starting', { 
      recipientId: notificationData.recipientId,
      title: notificationData.title
    });
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          recipient_id: notificationData.recipientId,
          sender_id: notificationData.senderId || user?.id,
          title: notificationData.title,
          message: notificationData.message,
          type: notificationData.type || 'info',
          category: notificationData.category || 'general',
          priority: notificationData.priority || 'normal',
          action_url: notificationData.actionUrl,
          action_label: notificationData.actionLabel,
          metadata: notificationData.metadata,
          expires_at: notificationData.expiresAt,
          created_at: new Date().toISOString()
        })
        .select(`
          *,
          sender:profiles!sender_id(id, full_name, role)
        `)
        .single();

      if (error) throw error;

      debugLog('createNotification: Success', { notificationId: data?.id });

      return { success: true, data };
    } catch (error) {
      debugLog('createNotification: Error', error);
      console.error('Error creating notification:', error);
      return { success: false, error };
    }
  };

  // Bulk create notifications
  const createBulkNotifications = async (recipients, notificationData) => {
    debugLog('createBulkNotifications: Starting', { 
      recipientCount: recipients.length,
      title: notificationData.title
    });
    
    try {
      const notifications = recipients.map(recipientId => ({
        recipient_id: recipientId,
        sender_id: notificationData.senderId || user?.id,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type || 'info',
        category: notificationData.category || 'general',
        priority: notificationData.priority || 'normal',
        action_url: notificationData.actionUrl,
        action_label: notificationData.actionLabel,
        metadata: notificationData.metadata,
        expires_at: notificationData.expiresAt,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('notifications')
        .insert(notifications)
        .select();

      if (error) throw error;

      debugLog('createBulkNotifications: Success', { count: data?.length });

      return { success: true, data };
    } catch (error) {
      debugLog('createBulkNotifications: Error', error);
      console.error('Error creating bulk notifications:', error);
      return { success: false, error };
    }
  };

  // Update notification preferences
  const updatePreferences = async (newPreferences) => {
    if (!user) return { success: false, error: 'No user available' };
    
    debugLog('updatePreferences: Starting', newPreferences);
    
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .update({
          ...newPreferences,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      debugLog('updatePreferences: Success', data);

      setPreferences(data);
      toast.success('Notification preferences updated');
      
      return { success: true, data };
    } catch (error) {
      debugLog('updatePreferences: Error', error);
      console.error('Error updating notification preferences:', error);
      toast.error('Failed to update preferences');
      return { success: false, error };
    }
  };

  // Auto-notification helpers for common actions
  const notifyAppointmentUpdate = async (appointmentData, action) => {
    const titles = {
      confirmed: 'Appointment Confirmed',
      cancelled: 'Appointment Cancelled',
      rescheduled: 'Appointment Rescheduled',
      reminder: 'Appointment Reminder',
      completed: 'Appointment Completed'
    };

    const messages = {
      confirmed: `Your appointment on ${appointmentData.date} at ${appointmentData.time} has been confirmed.`,
      cancelled: `Your appointment on ${appointmentData.date} at ${appointmentData.time} has been cancelled.`,
      rescheduled: `Your appointment has been rescheduled to ${appointmentData.date} at ${appointmentData.time}.`,
      reminder: `You have an upcoming appointment tomorrow at ${appointmentData.time}.`,
      completed: `Your appointment on ${appointmentData.date} has been completed.`
    };

    return await createNotification({
      recipientId: appointmentData.patientId,
      title: titles[action],
      message: messages[action],
      type: action === 'cancelled' ? 'warning' : 'info',
      category: 'appointment',
      priority: action === 'reminder' ? 'high' : 'normal',
      actionUrl: '/patient/appointments',
      actionLabel: 'View Appointments',
      metadata: {
        appointmentId: appointmentData.appointmentId,
        action,
        branch: appointmentData.branch
      }
    });
  };

  const notifyPaymentUpdate = async (paymentData, action) => {
    const titles = {
      received: 'Payment Received',
      approved: 'Payment Approved',
      rejected: 'Payment Rejected',
      pending: 'Payment Pending Review'
    };

    const messages = {
      received: `We have received your payment of ₱${paymentData.amount}.`,
      approved: `Your payment of ₱${paymentData.amount} has been approved.`,
      rejected: `Your payment of ₱${paymentData.amount} has been rejected. Please contact us for more information.`,
      pending: `Your payment of ₱${paymentData.amount} is pending review.`
    };

    return await createNotification({
      recipientId: paymentData.patientId,
      title: titles[action],
      message: messages[action],
      type: action === 'rejected' ? 'error' : action === 'approved' ? 'success' : 'info',
      category: 'payment',
      priority: action === 'rejected' ? 'high' : 'normal',
      actionUrl: '/patient/payments',
      actionLabel: 'View Payments',
      metadata: {
        paymentId: paymentData.paymentId,
        invoiceId: paymentData.invoiceId,
        amount: paymentData.amount,
        action
      }
    });
  };

  const notifyQueueUpdate = async (queueData, action) => {
    const titles = {
      joined: 'Added to Queue',
      next: 'You\'re Next!',
      serving: 'Your Turn',
      completed: 'Queue Completed',
      cancelled: 'Removed from Queue'
    };

    const messages = {
      joined: `You've been added to the queue. Your number is ${queueData.queueNumber}.`,
      next: `You're next in line! Please prepare to be served.`,
      serving: `It's your turn! Please proceed to the counter.`,
      completed: `Thank you! Your queue service has been completed.`,
      cancelled: `You've been removed from the queue.`
    };

    return await createNotification({
      recipientId: queueData.patientId,
      title: titles[action],
      message: messages[action],
      type: action === 'serving' ? 'success' : action === 'cancelled' ? 'warning' : 'info',
      category: 'queue',
      priority: action === 'serving' || action === 'next' ? 'urgent' : 'normal',
      actionUrl: '/patient/dashboard',
      actionLabel: 'View Queue Status',
      metadata: {
        queueId: queueData.queueId,
        queueNumber: queueData.queueNumber,
        action
      }
    });
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!user) {
      debugLog('Real-time setup: No user available');
      setConnectionStatus('disconnected');
      return;
    }

    debugLog('Real-time setup: Setting up subscription', { userId: user.id });
    setConnectionStatus('connecting');

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`
        },
        async (payload) => {
          debugLog('Real-time: New notification received', { 
            notificationId: payload.new.id,
            title: payload.new.title
          });
          
          try {
            // Fetch the complete notification with sender details
            const { data, error } = await supabase
              .from('notifications')
              .select(`
                *,
                sender:profiles!sender_id(id, full_name, role)
              `)
              .eq('id', payload.new.id)
              .single();

            if (!error && data) {
              debugLog('Real-time: Successfully fetched complete notification', {
                notificationId: data.id
              });
              
              setNotifications(prev => [data, ...prev]);
              setUnreadCount(prev => prev + 1);
              
              // Show toast notification if preferences allow
              if (preferences?.push_notifications !== false) {
                toast.info(data.title, {
                  onClick: () => markAsRead(data.id)
                });
              }
            } else {
              debugLog('Real-time: Error fetching complete notification', error);
            }
          } catch (err) {
            debugLog('Real-time: Exception handling new notification', err);
          }
        }
      )
      .subscribe((status) => {
        debugLog('Real-time: Subscription status changed', { status });
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : 
                          status === 'CHANNEL_ERROR' ? 'error' : 'connecting');
      });

    setRealtimeChannel(channel);

    return () => {
      debugLog('Real-time setup: Cleaning up subscription');
      if (channel) {
        supabase.removeChannel(channel);
      }
      setConnectionStatus('disconnected');
    };
  }, [user, preferences?.push_notifications, debugLog]);

  // Initial data fetch
  useEffect(() => {
    if (user) {
      debugLog('Initial setup: User available, fetching data', { userId: user.id });
      fetchNotifications();
      fetchPreferences();
    } else {
      debugLog('Initial setup: No user, clearing data');
      setNotifications([]);
      setUnreadCount(0);
      setPreferences(null);
      setConnectionStatus('disconnected');
    }
  }, [user, fetchNotifications, fetchPreferences, debugLog]);

  // Clean up expired notifications
  useEffect(() => {
    const cleanupExpiredNotifications = async () => {
      try {
        debugLog('Cleanup: Removing expired notifications');
        await supabase
          .from('notifications')
          .delete()
          .lt('expires_at', new Date().toISOString());
      } catch (error) {
        debugLog('Cleanup: Error removing expired notifications', error);
        console.error('Error cleaning up expired notifications:', error);
      }
    };

    // Run cleanup every hour
    const interval = setInterval(cleanupExpiredNotifications, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [debugLog]);

  const value = {
    notifications,
    unreadCount,
    isLoading,
    preferences,
    connectionStatus,
    lastError,
    
    // Core functions
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    createNotification,
    createBulkNotifications,
    updatePreferences,
    
    // Helper functions for common notifications
    notifyAppointmentUpdate,
    notifyPaymentUpdate,
    notifyQueueUpdate
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}