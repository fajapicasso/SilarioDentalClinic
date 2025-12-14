// src/contexts/NotificationContext.jsx - Improved with better error handling
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import supabase from '../config/supabaseClient';
import { toast } from 'react-toastify';
import logger from '../utils/logger';

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
    logger.log(`[NotificationContext] ${message}`, data);
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
      // Staff and Admin can see ALL notifications (not just their own)
      let query = supabase
        .from('notifications')
        .select(`
          *,
          sender:profiles!sender_id(id, full_name, role),
          recipient:profiles!recipient_id(id, full_name, role)
        `);
      
      // Only filter by recipient_id for non-admin/non-staff users
      if (userRole !== 'admin' && userRole !== 'staff') {
        query = query.eq('recipient_id', user.id);
      }
      
      query = query.order('created_at', { ascending: false }).limit(limit);

      // Apply role-based filtering
      const { data, error } = await query;

      if (error) {
        debugLog('fetchNotifications: Supabase error', error);
        throw error;
      }

      // For doctors: Pre-fetch appointment assignments to check against notifications
      let appointmentAssignments = {};
      if (userRole === 'doctor' && data && data.length > 0) {
        // Extract appointmentIds from notifications
        const appointmentIds = data
          .filter(n => n.category === 'appointment' && n.metadata)
          .map(n => {
            const meta = n.metadata;
            if (typeof meta === 'object') {
              return meta.appointmentId || meta['appointmentId'];
            } else if (typeof meta === 'string') {
              try {
                const parsed = JSON.parse(meta);
                return parsed?.appointmentId || parsed?.['appointmentId'];
              } catch {
                return null;
              }
            }
            return null;
          })
          .filter(Boolean);
        
        // Fetch appointment doctor assignments
        if (appointmentIds.length > 0) {
          try {
            const { data: appointments } = await supabase
              .from('appointments')
              .select('id, doctor_id')
              .in('id', appointmentIds);
            
            if (appointments) {
              appointments.forEach(apt => {
                appointmentAssignments[apt.id] = apt.doctor_id;
              });
            }
          } catch (error) {
            console.warn('Error fetching appointment assignments:', error);
          }
        }
      }
      
      // Filter notifications based on user role and notification rules
      const filteredNotifications = filterNotificationsByRole(data || [], userRole, user?.id, appointmentAssignments);

      debugLog('fetchNotifications: Success', { 
        totalCount: data?.length || 0,
        filteredCount: filteredNotifications.length,
        userRole: userRole,
        sample: filteredNotifications?.[0] ? { id: filteredNotifications[0].id, title: filteredNotifications[0].title, category: filteredNotifications[0].category } : null
      });

      // Deduplicate notifications by id first
      let uniqueNotifications = filteredNotifications.filter((notification, index, self) =>
        index === self.findIndex(n => n.id === notification.id)
      );
      
      // For staff/admin: Also deduplicate by appointmentId + title + category
      // This prevents seeing the same appointment notification multiple times
      // (e.g., if separate notifications were created for admin, doctor, and staff roles)
      if (userRole === 'staff' || userRole === 'admin') {
        uniqueNotifications = uniqueNotifications.filter((notification, index, self) => {
          // For appointment notifications, check if another notification with same appointmentId exists
          if (notification.category === 'appointment' && 
              notification.metadata?.appointmentId && 
              notification.title === 'New Appointment Request') {
            // Find the first notification with this appointmentId
            const firstIndex = self.findIndex(n => 
              n.category === 'appointment' &&
              n.metadata?.appointmentId === notification.metadata.appointmentId &&
              n.title === 'New Appointment Request'
            );
            // Keep only the first one (oldest)
            return index === firstIndex;
          }
          // For other notifications, keep all
          return true;
        });
      }
      
      setNotifications(uniqueNotifications);
      
      // Calculate unread count from unique notifications
      const unread = uniqueNotifications.filter(n => !n.is_read).length;
      setUnreadCount(unread);
      
      if (showToast) {
        toast.success(`Loaded ${filteredNotifications.length} notifications`);
      }
      
    } catch (error) {
      debugLog('fetchNotifications: Error', error);
      logger.error('Error fetching notifications:', error);
      setLastError(error.message || 'Failed to load notifications');
      if (showToast) {
        toast.error('Failed to load notifications');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, userRole, debugLog]);

  // Filter notifications based on user role
  const filterNotificationsByRole = useCallback((notifications, role, currentUserId = null, appointmentAssignments = {}) => {
    if (!role) return notifications;

    const roleBasedRules = {
      patient: {
        allowedCategories: ['appointment', 'braces_checkup', 'payment', 'dental_chart', 'system', 'personal', 'health', 'prescription'],
        allowedTypes: ['appointment', 'appointment_status', 'payment_update', 'dental_chart_update', 'welcome', 'dental_checkup_due', 'prescription_ready', 'birthday_greeting'],
        description: 'Patients see: appointment status, braces checkup reminders, payment updates, dental chart updates'
      },
      doctor: {
        allowedCategories: ['appointment', 'queue', 'payment', 'patient_record', 'system'],
        allowedTypes: ['appointment_request', 'appointment_reminder', 'patient_arrived', 'emergency_case', 'treatment_followup', 'payment_linked', 'patient_record_update'],
        description: 'Doctors see: their appointments, patient arrivals, payments linked to treatments, patient record updates'
      },
      staff: {
        allowedCategories: ['all'], // Staff see everything (same as admin)
        allowedTypes: ['all'], // Staff see everything (same as admin)
        description: 'Staff see: all notifications for full system monitoring (same as admin)'
      },
      admin: {
        allowedCategories: ['system', 'user_management', 'appointment', 'billing', 'service', 'queue', 'payment', 'general'],
        allowedTypes: ['all'], // Admins see everything
        description: 'Admins see: all notifications for full system monitoring'
      }
    };

    const rules = roleBasedRules[role];
    if (!rules) {
      logger.warn(`No notification rules defined for role: ${role}`);
      return notifications;
    }

    // Admins see everything
    if (role === 'admin') {
      return notifications;
    }

    // Staff see everything EXCEPT notifications sent TO patients (except billing/payment)
    // Staff CAN see "New Appointment Request" notifications (like doctors) but NOT patient-facing appointment notifications
    if (role === 'staff') {
      return notifications.filter(notification => {
        // Check if notification is sent TO a patient (recipient is a patient)
        const recipientIsPatient = notification.recipient && notification.recipient.role === 'patient';
        
        // Always allow payment/billing notifications (even if sent to patients)
        if (notification.category === 'billing' || 
            notification.category === 'payment' ||
            notification.type === 'payment_confirmation' ||
            notification.type === 'payment_update' ||
            notification.type === 'payment_received' ||
            notification.title?.includes('Payment Received') ||
            notification.title?.includes('New Payment') ||
            notification.title?.includes('Payment') ||
            notification.metadata?.eventType === 'payment_confirmation' ||
            notification.metadata?.eventType === 'payment_update' ||
            notification.metadata?.eventType === 'payment_received') {
          return true; // Keep all payment/billing notifications
        }
        
        // Allow "New Appointment Request" notifications (same as doctors) - these are sent to admin/doctor/staff
        if (notification.title === 'New Appointment Request' && 
            notification.category === 'appointment' &&
            !recipientIsPatient) {
          return true; // Staff can see appointment request notifications (like doctors)
        }
        
        // Allow "Appointment Rescheduled" notifications - these are sent to admin/doctor/staff
        if (notification.title === 'Appointment Rescheduled' && 
            notification.category === 'appointment' &&
            !recipientIsPatient) {
          return true; // Staff can see appointment reschedule notifications
        }
        
        // Exclude appointment notifications sent TO patients (patient-facing notifications)
        if (notification.category === 'appointment' && recipientIsPatient) {
          return false; // Exclude patient appointment notifications like "Appointment Request Submitted"
        }
        
        // Exclude all other notifications sent TO patients (except payments already handled)
        if (recipientIsPatient) {
          return false; // Exclude all patient notifications except payments
        }
        
        // Allow all notifications sent to non-patients (admin, doctor, staff, system)
        return true;
      });
    }

    // Filter notifications based on role rules
    let filtered = notifications.filter(notification => {
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

    // For doctors: Only show notifications where they are the assigned doctor
    // Doctors should NOT see notifications for appointments/billing assigned to other doctors
    // IMPORTANT: Doctors should ONLY see notifications sent TO doctors, not to staff or other roles
    if (role === 'doctor' && currentUserId) {
      console.log('🔍 Filtering notifications for doctor:', {
        doctorId: currentUserId,
        totalNotifications: filtered.length,
        role: role
      });
      
      filtered = filtered.filter(notification => {
        // CRITICAL: Only show notifications sent TO this doctor (recipient_id must match)
        // Also check that recipient is a doctor (not staff or other role)
        const recipientIsDoctor = notification.recipient?.role === 'doctor' || 
                                   !notification.recipient || // If recipient not loaded, trust recipient_id match
                                   notification.recipient_id === currentUserId; // If recipient_id matches, it's for this doctor
        
        // First check: Must be sent to this doctor
        if (notification.recipient_id !== currentUserId) {
          console.log('🚫 Notification not sent to this doctor - filtering out:', {
            notificationId: notification.id,
            recipientId: notification.recipient_id,
            currentDoctorId: currentUserId,
            recipientRole: notification.recipient?.role
          });
          return false;
        }
        
        // Second check: Recipient must be a doctor (not staff)
        if (notification.recipient && notification.recipient.role !== 'doctor') {
          console.log('🚫 Notification sent to non-doctor - filtering out:', {
            notificationId: notification.id,
            recipientId: notification.recipient_id,
            recipientRole: notification.recipient.role,
            title: notification.title
          });
          return false;
        }
        
        // If notification is sent directly to this doctor (recipient_id matches), check if it's assigned to them
        if (notification.recipient_id === currentUserId) {
          // For appointment notifications: Only show if doctorId in metadata matches current doctor OR no doctor assigned
          if (notification.category === 'appointment') {
            // Try multiple ways to access metadata.doctorId
            let notificationDoctorId = null;
            
            console.log('📋 Checking appointment notification:', {
              notificationId: notification.id,
              title: notification.title,
              recipientId: notification.recipient_id,
              metadataType: typeof notification.metadata,
              metadata: notification.metadata
            });
            
            if (notification.metadata) {
              if (typeof notification.metadata === 'object') {
                notificationDoctorId = notification.metadata.doctorId || notification.metadata['doctorId'];
              } else if (typeof notification.metadata === 'string') {
                try {
                  const parsed = JSON.parse(notification.metadata);
                  notificationDoctorId = parsed?.doctorId || parsed?.['doctorId'];
                } catch (e) {
                  // Not valid JSON, try as-is
                  notificationDoctorId = null;
                }
              }
            }
            
            console.log('👨‍⚕️ Doctor ID check:', {
              notificationId: notification.id,
              notificationDoctorId: notificationDoctorId,
              currentDoctorId: currentUserId,
              hasDoctorId: !!notificationDoctorId
            });
            
            // IMPORTANT: If no doctorId in metadata, check appointmentAssignments map
            // (pre-fetched from appointments table) or check message for assignment
            if (!notificationDoctorId) {
              const appointmentId = notification.metadata?.appointmentId || 
                                   notification.metadata?.['appointmentId'] ||
                                   (typeof notification.metadata === 'string' ? 
                                     (() => {
                                       try {
                                         const parsed = JSON.parse(notification.metadata);
                                         return parsed?.appointmentId || parsed?.['appointmentId'];
                                       } catch { return null; }
                                     })() : null);
              
              // If we have an appointmentId, check the pre-fetched appointmentAssignments
              if (appointmentId && appointmentAssignments[appointmentId]) {
                const assignedDoctorId = String(appointmentAssignments[appointmentId]).trim();
                const currentDoctorIdStr = String(currentUserId).trim();
                const matches = assignedDoctorId === currentDoctorIdStr;
                
                if (!matches) {
                  console.log('🔴 Notification filtered - appointment assigned to different doctor (from appointments table):', {
                    notificationId: notification.id,
                    appointmentId: appointmentId,
                    assignedDoctorId: assignedDoctorId,
                    currentDoctorId: currentDoctorIdStr
                  });
                }
                
                return matches;
              }
              
              // Check if the message mentions a doctor assignment
              const message = notification.message || '';
              const hasDoctorAssignment = message.includes('assigned') || message.includes('Assigned Doctor');
              
              if (hasDoctorAssignment) {
                // This is likely an old notification that should have doctorId but doesn't
                // Filter it out to be safe - only show truly unassigned appointments
                console.log('⚠️ Notification has no doctorId but mentions assignment - filtering out:', {
                  notificationId: notification.id,
                  message: message.substring(0, 100)
                });
                return false;
              }
              
              // Truly unassigned - show to all doctors
              return true;
            }
            
            // Compare doctorId (handle both string and UUID formats)
            const doctorIdStr = String(notificationDoctorId).trim();
            const currentUserIdStr = String(currentUserId).trim();
            
            // Only show if the doctorId matches the current doctor
            const matches = doctorIdStr === currentUserIdStr;
            
            if (!matches) {
              console.log('🔴 Doctor notification FILTERED OUT - not assigned to this doctor', {
                notificationId: notification.id,
                notificationDoctorId: doctorIdStr,
                currentDoctorId: currentUserIdStr,
                title: notification.title,
                metadata: notification.metadata
              });
              debugLog('Doctor notification filtered out - not assigned to this doctor', {
                notificationId: notification.id,
                notificationDoctorId: doctorIdStr,
                currentDoctorId: currentUserIdStr,
                title: notification.title
              });
            } else {
              console.log('✅ Doctor notification ALLOWED - assigned to this doctor', {
                notificationId: notification.id,
                doctorId: doctorIdStr,
                title: notification.title
              });
            }
            
            return matches;
          }

          // For payment/billing notifications: Only show if doctorId in metadata matches current doctor
          // If no doctorId, don't show to doctors (only staff/admin should see unassigned payments)
          if (notification.category === 'payment' || notification.category === 'billing') {
            // Try multiple ways to access metadata.doctorId
            let notificationDoctorId = null;
            
            if (notification.metadata) {
              if (typeof notification.metadata === 'object') {
                notificationDoctorId = notification.metadata.doctorId || notification.metadata['doctorId'];
              } else if (typeof notification.metadata === 'string') {
                try {
                  const parsed = JSON.parse(notification.metadata);
                  notificationDoctorId = parsed?.doctorId || parsed?.['doctorId'];
                } catch (e) {
                  notificationDoctorId = null;
                }
              }
            }
            
            // If no doctorId in metadata, don't show to doctors
            if (!notificationDoctorId) {
              return false;
            }
            
            // Compare doctorId (handle both string and UUID formats)
            const doctorIdStr = String(notificationDoctorId).trim();
            const currentUserIdStr = String(currentUserId).trim();
            // Only show if the doctorId matches the current doctor
            return doctorIdStr === currentUserIdStr;
          }

          // For other notification types (queue, system, etc.), show if sent to this doctor
          return true;
        }

        // If notification is not sent to this doctor, don't show it
        return false;
      });
    }

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
      logger.error('Error fetching notification preferences:', error);
      setLastError(error.message || 'Failed to load preferences');
    }
  }, [user, debugLog]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    if (!user) return;
    
    debugLog('markAsRead: Starting', { notificationId, userRole });
    
    try {
      // Staff and admin can mark any notification as read (they see all notifications)
      // Regular users can only mark their own notifications as read
      let updateQuery = supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', notificationId);
      
      // Only filter by recipient_id for non-staff/non-admin users
      if (userRole !== 'admin' && userRole !== 'staff') {
        updateQuery = updateQuery.eq('recipient_id', user.id);
      }

      const { error } = await updateQuery;

      if (error) throw error;

      debugLog('markAsRead: Success', { notificationId, userRole });

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true }
            : n
        )
      );

      setUnreadCount(prev => Math.max(0, prev - 1));
      
    } catch (error) {
      debugLog('markAsRead: Error', { notificationId, userRole, error });
      logger.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user) return;
    
    debugLog('markAllAsRead: Starting', { userRole });
    
    try {
      // Staff and admin can mark ALL notifications as read (they see all notifications)
      // Regular users can only mark their own notifications as read
      let updateQuery = supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('is_read', false);
      
      // Only filter by recipient_id for non-staff/non-admin users
      if (userRole !== 'admin' && userRole !== 'staff') {
        updateQuery = updateQuery.eq('recipient_id', user.id);
      }
      
      const { error } = await updateQuery;

      if (error) throw error;

      debugLog('markAllAsRead: Success', { userRole });

      setNotifications(prev => {
        // Deduplicate while updating
        const unique = prev.filter((n, index, self) => 
          index === self.findIndex(notif => notif.id === n.id)
        );
        // For staff/admin, mark all as read. For others, only mark their own.
        if (userRole === 'admin' || userRole === 'staff') {
          return unique.map(n => ({ ...n, is_read: true }));
        } else {
          return unique.map(n => 
            n.recipient_id === user.id ? { ...n, is_read: true } : n
          );
        }
      });

      // Update unread count - all visible notifications are now marked as read
      setUnreadCount(0);
      
      toast.success('All notifications marked as read');
      
    } catch (error) {
      debugLog('markAllAsRead: Error', { userRole, error });
      logger.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    if (!user) return;
    
    debugLog('deleteNotification: Starting', { notificationId, userRole });
    
    try {
      // Staff and Admin can delete any notification, others can only delete their own
      let deleteQuery = supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      
      // Only filter by recipient_id for non-admin/non-staff users
      if (userRole !== 'admin' && userRole !== 'staff') {
        deleteQuery = deleteQuery.eq('recipient_id', user.id);
      }
      
      const { error } = await deleteQuery;

      if (error) throw error;

      const deletedNotification = notifications.find(n => n.id === notificationId);
      
      debugLog('deleteNotification: Success', { notificationId, wasUnread: !deletedNotification?.is_read });

      setNotifications(prev => {
        // Deduplicate while removing
        const unique = prev.filter((n, index, self) => 
          index === self.findIndex(notif => notif.id === n.id)
        );
        return unique.filter(n => n.id !== notificationId);
      });

      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
    } catch (error) {
      debugLog('deleteNotification: Error', { notificationId, error });
      logger.error('Error deleting notification:', error);
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
      logger.error('Error clearing notifications:', error);
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
      logger.error('Error creating notification:', error);
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
      logger.error('Error creating bulk notifications:', error);
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
      logger.error('Error updating notification preferences:', error);
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

    debugLog('Real-time setup: Setting up subscription', { userId: user.id, userRole: userRole });
    setConnectionStatus('connecting');

    // Staff and Admin should receive ALL notifications, not just their own
    // For other roles, filter by recipient_id
    const subscriptionConfig = {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications'
    };

    // Only add filter for non-admin/non-staff users
    if (userRole !== 'admin' && userRole !== 'staff') {
      subscriptionConfig.filter = `recipient_id=eq.${user.id}`;
    }

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        subscriptionConfig,
        async (payload) => {
          debugLog('Real-time: New notification received', { 
            notificationId: payload.new.id,
            title: payload.new.title
          });
          
          try {
            // Fetch the complete notification with sender and recipient details
            const { data, error } = await supabase
              .from('notifications')
              .select(`
                *,
                sender:profiles!sender_id(id, full_name, role),
                recipient:profiles!recipient_id(id, full_name, role)
              `)
              .eq('id', payload.new.id)
              .single();

            if (!error && data) {
              debugLog('Real-time: Successfully fetched complete notification', {
                notificationId: data.id,
                category: data.category
              });
              
              // For doctors: Fetch appointment assignment if needed
              let appointmentAssignments = {};
              if (userRole === 'doctor' && data.category === 'appointment' && data.metadata) {
                const meta = data.metadata;
                const appointmentId = (typeof meta === 'object' ? (meta.appointmentId || meta['appointmentId']) : null) ||
                                     (typeof meta === 'string' ? (() => {
                                       try {
                                         const parsed = JSON.parse(meta);
                                         return parsed?.appointmentId || parsed?.['appointmentId'];
                                       } catch { return null; }
                                     })() : null);
                
                if (appointmentId) {
                  try {
                    const { data: appointmentData } = await supabase
                      .from('appointments')
                      .select('id, doctor_id')
                      .eq('id', appointmentId)
                      .single();
                    
                    if (appointmentData) {
                      appointmentAssignments[appointmentData.id] = appointmentData.doctor_id;
                    }
                  } catch (error) {
                    console.warn('Error fetching appointment assignment in real-time:', error);
                  }
                }
              }
              
              // Filter the notification to ensure it's allowed for this role
              const filtered = filterNotificationsByRole([data], userRole, user?.id, appointmentAssignments);
              
              if (filtered.length > 0) {
                const notification = filtered[0];
                // Deduplicate: only add if notification doesn't already exist
                setNotifications(prev => {
                  // Deduplicate by id first
                  const existsById = prev.some(n => n.id === notification.id);
                  if (existsById) {
                    debugLog('Real-time: Notification already exists by id, skipping duplicate', { notificationId: notification.id });
                    return prev;
                  }
                  
                  // For staff/admin: Also deduplicate by appointmentId + title + category
                  if ((userRole === 'staff' || userRole === 'admin') &&
                      notification.category === 'appointment' &&
                      notification.metadata?.appointmentId &&
                      notification.title === 'New Appointment Request') {
                    // Check if another notification with same appointmentId already exists
                    const existsByAppointment = prev.find(n =>
                      n.category === 'appointment' &&
                      n.metadata?.appointmentId === notification.metadata.appointmentId &&
                      n.title === 'New Appointment Request'
                    );
                    if (existsByAppointment) {
                      debugLog('Real-time: Duplicate appointment notification already exists, skipping', {
                        existingId: existsByAppointment.id,
                        newId: notification.id,
                        appointmentId: notification.metadata.appointmentId
                      });
                      return prev;
                    }
                  }
                  
                  return [notification, ...prev];
                });
                setUnreadCount(prev => prev + 1);
                
                // Show toast notification if preferences allow
                if (preferences?.push_notifications !== false) {
                  toast.info(notification.title, {
                    onClick: () => markAsRead(notification.id)
                  });
                }
              } else {
                debugLog('Real-time: Notification filtered out by role rules', {
                  notificationId: data.id,
                  category: data.category,
                  userRole: userRole
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
  }, [user, userRole, preferences?.push_notifications, debugLog, filterNotificationsByRole]);

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
        logger.error('Error cleaning up expired notifications:', error);
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