// src/services/notificationService.js - Fixed to match new function parameters
import supabase from '../config/supabaseClient';

class NotificationService {
  constructor() {
    this.initialized = false;
  }

  // Initialize the service
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Test connection
      await supabase.from('notifications').select('count', { count: 'exact' }).limit(1);
      this.initialized = true;
      console.log('NotificationService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NotificationService:', error);
    }
  }

  // Create a single notification - Updated parameter order
  async createNotification({
    recipientId,
    title,
    message,
    senderId = null,
    type = 'info',
    category = 'general',
    priority = 'normal',
    actionUrl = null,
    actionLabel = null,
    metadata = null,
    expiresAt = null
  }) {
    try {
      await this.initialize();

      const { data, error } = await supabase
        .from('notifications')
        .insert({
          recipient_id: recipientId,
          sender_id: senderId,
          title,
          message,
          type,
          category,
          priority,
          action_url: actionUrl,
          action_label: actionLabel,
          metadata,
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      console.log('Notification created:', data.id);
      return { success: true, data };
    } catch (error) {
      console.error('Error creating notification:', error);
      return { success: false, error };
    }
  }

  // Create bulk notifications for users with specific role - Updated parameter order
  async createRoleNotifications({
    role,
    title,
    message,
    senderId = null,
    type = 'info',
    category = 'general',
    priority = 'normal',
    actionUrl = null,
    actionLabel = null,
    metadata = null,
    expiresAt = null
  }) {
    try {
      await this.initialize();

      // Get all users with the specified role
      const { data: users, error: userError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', role)
        .eq('disabled', false);

      if (userError) throw userError;

      if (!users || users.length === 0) {
        console.warn(`No active users found with role: ${role}`);
        return { success: true, count: 0 };
      }

      // Create notifications for all users
      const notifications = users.map(user => ({
        recipient_id: user.id,
        sender_id: senderId,
        title,
        message,
        type,
        category,
        priority,
        action_url: actionUrl,
        action_label: actionLabel,
        metadata,
        expires_at: expiresAt,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('notifications')
        .insert(notifications)
        .select();

      if (error) throw error;

      console.log(`Created ${data.length} notifications for role: ${role}`);
      return { success: true, count: data.length, data };
    } catch (error) {
      console.error(`Error creating notifications for role ${role}:`, error);
      return { success: false, error };
    }
  }

  // Appointment-related notifications
  async notifyAppointmentCreated(appointmentData, patientData) {
    try {
      const { patientId, appointmentId, date, time, branch } = appointmentData;
      
      console.log('Creating appointment notifications for:', { appointmentId, patientId });

      // Notify the patient
      await this.createNotification({
        recipientId: patientId,
        title: 'Appointment Request Submitted',
        message: `Your appointment request for ${date} at ${time} has been submitted and is pending approval.`,
        type: 'info',
        category: 'appointment',
        priority: 'normal',
        actionUrl: '/patient/appointments',
        actionLabel: 'View Appointments',
        metadata: { appointmentId, action: 'created' }
      });

      // Notify admins
      await this.createRoleNotifications({
        role: 'admin',
        title: 'New Appointment',
        message: `${patientData.full_name} has requested an appointment for ${date} at ${time} (${branch} branch).`,
        type: 'info',
        category: 'appointment',
        priority: 'high',
        actionUrl: '/admin/appointments',
        actionLabel: 'Review Request',
        metadata: { appointmentId, patientId, action: 'new_request' }
      });

      // Notify doctors
      await this.createRoleNotifications({
        role: 'doctor',
        title: 'New Appointment',
        message: `${patientData.full_name} | Admin has assigned you to be the doctor for the appointment on ${date} at ${time} (${branch} branch).`,
        type: 'info',
        category: 'appointment',
        priority: 'high',
        actionUrl: '/doctor/appointments',
        actionLabel: 'Review Request',
        metadata: { appointmentId, patientId, action: 'new_request' }
      });

      return { success: true };
    } catch (error) {
      console.error('Error in notifyAppointmentCreated:', error);
      return { success: false, error };
    }
  }

  async notifyAppointmentStatusChange(appointmentData, oldStatus, newStatus, doctorData = null) {
    try {
      const { patientId, appointmentId, date, time, branch } = appointmentData;
      
      console.log('Creating appointment status change notification:', { appointmentId, oldStatus, newStatus });

      let title, message, type, priority;

      switch (newStatus) {
        case 'confirmed':
          title = 'Appointment Confirmed';
          message = `Your appointment on ${date} at ${time} (${branch} branch) has been confirmed.${doctorData ? ` Assigned to Dr. ${doctorData.full_name}.` : ''}`;
          type = 'success';
          priority = 'high';
          break;

        case 'cancelled':
          title = 'Appointment Cancelled';
          message = `Your appointment on ${date} at ${time} (${branch} branch) has been cancelled.`;
          type = 'warning';
          priority = 'high';
          break;

        case 'rejected':
          title = 'Appointment Rejected';
          message = `Your appointment request for ${date} at ${time} has been rejected. Please try a different time slot.`;
          type = 'error';
          priority = 'high';
          break;

        case 'completed':
          title = 'Appointment Completed';
          message = `Your appointment on ${date} has been completed. Thank you for visiting us!`;
          type = 'success';
          priority = 'normal';
          break;
        case 'serving':
          title = "It's Your Turn Now";
          message = `Please proceed to the dental clinic. Your queue number is now being served.`;
          type = 'success';
          priority = 'high';
          break;

        default:
          return { success: true }; // No notification needed for other statuses
      }

      await this.createNotification({
        recipientId: patientId,
        title,
        message,
        senderId: doctorData?.id,
        type,
        category: 'appointment',
        priority,
        actionUrl: '/patient/appointments',
        actionLabel: newStatus === 'cancelled' || newStatus === 'rejected' ? 'Book New Appointment' : 'View Details',
        metadata: { appointmentId, action: newStatus, oldStatus }
      });

      return { success: true };
    } catch (error) {
      console.error('Error in notifyAppointmentStatusChange:', error);
      return { success: false, error };
    }
  }

  // Payment-related notifications
  async notifyPaymentReceived(paymentData, patientData) {
    try {
      const { patientId, paymentId, invoiceId, amount, method } = paymentData;
      
      console.log('Creating payment received notifications for:', { paymentId, patientId });

      // Notify the patient
      await this.createNotification({
        recipientId: patientId,
        title: 'Payment Received',
        message: `We have received your payment of ₱${amount.toLocaleString()} via ${method}. Your payment is now under review.`,
        type: 'success',
        category: 'payment',
        priority: 'normal',
        actionUrl: '/patient/payments',
        actionLabel: 'View Payment',
        metadata: { paymentId, invoiceId, amount, action: 'received' }
      });

      // Notify admins
      await this.createRoleNotifications({
        role: 'admin',
        title: 'New Payment Received',
        message: `A payment of ₱${amount.toLocaleString()} from ${patientData.full_name} has been received and requires review.`,
        type: 'info',
        category: 'payment',
        priority: 'high',
        actionUrl: '/admin/billing',
        actionLabel: 'Review Payment',
        metadata: { paymentId, invoiceId, patientId, amount, action: 'new_payment' }
      });

      // Notify doctors
      await this.createRoleNotifications({
        role: 'doctor',
        title: 'New Payment Received',
        message: `A payment of ₱${amount.toLocaleString()} from ${patientData.full_name} requires your review.`,
        type: 'info',
        category: 'payment',
        priority: 'normal',
        actionUrl: '/doctor/billing',
        actionLabel: 'Review Payment',
        metadata: { paymentId, invoiceId, patientId, amount, action: 'new_payment' }
      });

      return { success: true };
    } catch (error) {
      console.error('Error in notifyPaymentReceived:', error);
      return { success: false, error };
    }
  }

  async notifyPaymentStatusChange(paymentData, oldStatus, newStatus, approverData = null) {
    try {
      const { patientId, paymentId, invoiceId, amount } = paymentData;
      
      console.log('Creating payment status change notification:', { paymentId, oldStatus, newStatus });

      let title, message, type, priority;

      switch (newStatus) {
        case 'approved':
          title = 'Payment Approved';
          message = `Your payment of ₱${amount.toLocaleString()} has been approved and processed. Thank you!`;
          type = 'success';
          priority = 'normal';
          break;

        case 'rejected':
          title = 'Payment Rejected';
          message = `Your payment of ₱${amount.toLocaleString()} has been rejected. Please contact us for more information or submit a new payment.`;
          type = 'error';
          priority = 'high';
          break;

        default:
          return { success: true }; // No notification needed for other statuses
      }

      await this.createNotification({
        recipientId: patientId,
        title,
        message,
        senderId: approverData?.id,
        type,
        category: 'payment',
        priority,
        actionUrl: '/patient/payments',
        actionLabel: newStatus === 'rejected' ? 'Contact Support' : 'View Payment',
        metadata: { paymentId, invoiceId, amount, action: newStatus, oldStatus }
      });

      return { success: true };
    } catch (error) {
      console.error('Error in notifyPaymentStatusChange:', error);
      return { success: false, error };
    }
  }

  // System notifications
  async notifyWelcomeNewUser(userData) {
    try {
      const { userId, fullName, role } = userData;
      
      console.log('Creating welcome notification for:', { userId, role });

      const roleMessages = {
        patient: 'Welcome to Silario Dental Clinic! You can now book appointments, view your dental records, and manage your payments.',
        doctor: 'Welcome to the clinic system! You can now manage appointments, patient records, and billing.',
        staff: 'Welcome to the clinic system! You can now assist with appointments, queue management, and patient services.',
        admin: 'Welcome to the clinic system! You have full administrative access to manage the clinic operations.'
      };

      await this.createNotification({
        recipientId: userId,
        title: `Welcome to Silario Dental Clinic, ${fullName}!`,
        message: roleMessages[role] || 'Welcome to our system!',
        type: 'success',
        category: 'system',
        priority: 'normal',
        actionUrl: `/${role}/dashboard`,
        actionLabel: 'Get Started',
        metadata: { action: 'welcome', role }
      });

      return { success: true };
    } catch (error) {
      console.error('Error in notifyWelcomeNewUser:', error);
      return { success: false, error };
    }
  }

  // Utility methods
  async sendTestNotification(userId, userRole) {
    try {
      console.log('Sending test notification to:', { userId, userRole });

      const testMessages = {
        admin: 'This is a test notification for administrators.',
        doctor: 'This is a test notification for doctors.',
        staff: 'This is a test notification for staff members.',
        patient: 'This is a test notification for patients.'
      };

      await this.createNotification({
        recipientId: userId,
        title: 'Test Notification',
        message: testMessages[userRole] || 'This is a test notification.',
        type: 'info',
        category: 'system',
        priority: 'low',
        actionUrl: `/${userRole}/dashboard`,
        actionLabel: 'Go to Dashboard',
        metadata: { action: 'test', role: userRole }
      });

      return { success: true };
    } catch (error) {
      console.error('Error sending test notification:', error);
      return { success: false, error };
    }
  }

  async markNotificationAsRead(notificationId, userId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', notificationId)
        .eq('recipient_id', userId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error };
    }
  }

  async deleteNotification(notificationId, userId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('recipient_id', userId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error deleting notification:', error);
      return { success: false, error };
    }
  }

  async getUnreadCount(userId) {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      return { success: true, count: count || 0 };
    } catch (error) {
      console.error('Error getting unread count:', error);
      return { success: false, error, count: 0 };
    }
  }
}

// Create and export singleton instance
const notificationService = new NotificationService();

// Auto-initialize on import
notificationService.initialize().catch(console.error);

export default notificationService;

// Export individual methods for convenience
export const {
  createNotification,
  createRoleNotifications,
  notifyAppointmentCreated,
  notifyAppointmentStatusChange,
  notifyPaymentReceived,
  notifyPaymentStatusChange,
  notifyWelcomeNewUser,
  sendTestNotification,
  markNotificationAsRead,
  deleteNotification,
  getUnreadCount
} = notificationService;