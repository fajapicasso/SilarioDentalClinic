// src/services/notificationService.js - Fixed to match new function parameters
import supabase from '../config/supabaseClient';
import logger from '../utils/logger';

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
      logger.log('NotificationService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize NotificationService:', error);
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

      logger.log('Notification created:', data.id);
      return { success: true, data };
    } catch (error) {
      logger.error('Error creating notification:', error);
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
        logger.warn(`No active users found with role: ${role}`);
        return { success: true, count: 0 };
      }

      // STRONG duplicate check: For appointment notifications, check if ANY notification exists
      // for this appointmentId + action (regardless of recipient or role)
      // This prevents duplicates even if function is called multiple times simultaneously
      if (metadata && metadata.appointmentId && metadata.action) {
        // First, check if ANY notification exists for this appointment (most strict check)
        // This prevents race conditions where multiple calls happen simultaneously
        const { data: anyExistingNotification } = await supabase
          .from('notifications')
          .select('id, recipient_id')
          .eq('title', title)
          .eq('category', category)
          .eq('metadata->>appointmentId', metadata.appointmentId.toString())
          .eq('metadata->>action', metadata.action)
          .limit(1);
        
        // If ANY notification exists for this appointment, skip creating ALL new ones
        if (anyExistingNotification && anyExistingNotification.length > 0) {
          logger.log(`Notification for appointment ${metadata.appointmentId} already exists - skipping all duplicates for role ${role}`);
          return { success: true, count: 0, skipped: true };
        }
        
        // Get all users of this role
        const roleUserIds = users.map(u => u.id);
        
        if (roleUserIds.length === 0) {
          logger.log(`No users found for role ${role} - skipping notification creation`);
          return { success: true, count: 0, skipped: true };
        }
        
        // Double-check: Check if ANY user of this role already has a notification for this appointment
        const { data: existingAppointmentNotifications } = await supabase
          .from('notifications')
          .select('id, recipient_id, metadata')
          .eq('title', title)
          .eq('category', category)
          .eq('metadata->>appointmentId', metadata.appointmentId.toString())
          .eq('metadata->>action', metadata.action)
          .in('recipient_id', roleUserIds);
        
        if (existingAppointmentNotifications && existingAppointmentNotifications.length > 0) {
          // Filter to only check notifications for users with this role
          const existingRecipientIds = new Set(existingAppointmentNotifications.map(n => n.recipient_id));
          const usersToNotify = users.filter(user => !existingRecipientIds.has(user.id));
          
          if (usersToNotify.length === 0) {
            logger.log(`All ${role} users already have notification for appointment ${metadata.appointmentId} - skipping all duplicates`);
            return { success: true, count: 0, skipped: true };
          }
          
          // Only create for users who don't have it yet
          const notifications = usersToNotify.map(user => ({
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

          logger.log(`Created ${data.length} notifications for role: ${role} (${users.length - usersToNotify.length} duplicates skipped)`);
          return { success: true, count: data.length, data };
        }
      }
      
      // For non-appointment notifications or fallback: Check per recipient
      let duplicateQuery = supabase
        .from('notifications')
        .select('id, recipient_id, metadata')
        .eq('title', title)
        .eq('category', category)
        .in('recipient_id', users.map(u => u.id));
      
      // If metadata contains appointmentId, check for that to prevent duplicates for same appointment
      if (metadata && metadata.appointmentId) {
        duplicateQuery = duplicateQuery.eq('metadata->>appointmentId', metadata.appointmentId.toString());
        if (metadata.action) {
          duplicateQuery = duplicateQuery.eq('metadata->>action', metadata.action);
        }
      } else {
        // For non-appointment notifications, use 5-minute window
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        duplicateQuery = duplicateQuery.gte('created_at', fiveMinutesAgo);
      }
      
      const { data: existingNotifications } = await duplicateQuery;
      
      // Additional filtering for appointment notifications to ensure exact match
      let filteredExisting = existingNotifications || [];
      if (metadata && metadata.appointmentId) {
        filteredExisting = filteredExisting.filter(n => {
          const metaAppointmentId = n.metadata?.appointmentId || n.metadata?.['appointmentId'];
          const metaAction = n.metadata?.action || n.metadata?.['action'];
          const matchesAppointmentId = metaAppointmentId?.toString() === metadata.appointmentId.toString();
          const matchesAction = !metadata.action || metaAction === metadata.action;
          return matchesAppointmentId && matchesAction;
        });
      }

      const existingRecipientIds = new Set(filteredExisting.map(n => n.recipient_id));

      // Filter out users who already have this notification
      const usersToNotify = users.filter(user => !existingRecipientIds.has(user.id));

      if (usersToNotify.length === 0) {
        logger.log(`All users with role ${role} already have this notification - skipping duplicate`);
        return { success: true, count: 0, skipped: true };
      }

      // Create notifications for users who don't already have it
      const notifications = usersToNotify.map(user => ({
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

      logger.log(`Created ${data.length} notifications for role: ${role} (${users.length - usersToNotify.length} duplicates skipped)`);
      return { success: true, count: data.length, data };
    } catch (error) {
      logger.error(`Error creating notifications for role ${role}:`, error);
      return { success: false, error };
    }
  }

  // Appointment-related notifications
  async notifyAppointmentCreated(appointmentData, patientData) {
    try {
      const { patientId, appointmentId, date, time, branch, doctorId } = appointmentData;
      
      if (!appointmentId) {
        logger.error('Cannot create notifications: appointmentId is missing');
        return { success: false, error: 'appointmentId is required' };
      }
      
      // STRONG duplicate check: Check if notifications for this appointment already exist
      // Check for ANY notification with this appointmentId and action (regardless of recipient)
      // This prevents duplicates even if function is called multiple times simultaneously
      // We check for ANY notification first, then check per role
      
      // First, check if ANY notification exists for this appointment (most strict check)
      const { data: anyExistingNotification } = await supabase
        .from('notifications')
        .select('id, recipient_id')
        .eq('title', 'New Appointment Request')
        .eq('category', 'appointment')
        .eq('metadata->>appointmentId', appointmentId.toString())
        .eq('metadata->>action', 'new_request')
        .limit(1);
      
      // If ANY notification exists for this appointment, skip creating ALL new ones
      if (anyExistingNotification && anyExistingNotification.length > 0) {
        logger.log('Notifications for this appointment already exist - skipping all duplicates', { 
          appointmentId, 
          existingNotificationId: anyExistingNotification[0].id
        });
        return { success: true, skipped: true, reason: 'duplicate_exists' };
      }
      
      // Additional check: Get all staff, admin, and doctor user IDs to check per role
      const { data: staffUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'staff')
        .eq('disabled', false);
      
      const { data: adminUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('disabled', false);
      
      const { data: doctorUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'doctor')
        .eq('disabled', false);
      
      // Combine all role user IDs
      const allRoleUserIds = [
        ...(staffUsers || []).map(u => u.id),
        ...(adminUsers || []).map(u => u.id),
        ...(doctorUsers || []).map(u => u.id)
      ];
      
      // Double-check: If we have role users, check if any of them already have notifications
      if (allRoleUserIds.length > 0) {
        const { data: existingRoleNotifications } = await supabase
          .from('notifications')
          .select('id, recipient_id')
          .eq('title', 'New Appointment Request')
          .eq('category', 'appointment')
          .eq('metadata->>appointmentId', appointmentId.toString())
          .eq('metadata->>action', 'new_request')
          .in('recipient_id', allRoleUserIds)
          .limit(1);
        
        // If notifications exist for any role user, skip creating ALL new ones
        if (existingRoleNotifications && existingRoleNotifications.length > 0) {
          logger.log('Role notifications for this appointment already exist - skipping all duplicates', { 
            appointmentId, 
            existingCount: existingRoleNotifications.length
          });
          return { success: true, skipped: true, reason: 'duplicate_exists' };
        }
      }
      
      // Also check patient notification
      const { data: existingPatientNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('recipient_id', patientId)
        .eq('title', 'Appointment Request Submitted')
        .eq('category', 'appointment')
        .eq('metadata->>appointmentId', appointmentId.toString())
        .limit(1);
      
      if (existingPatientNotification && existingPatientNotification.length > 0) {
        logger.log('Patient notification for this appointment already exists - skipping duplicate', { appointmentId });
        return { success: true, skipped: true, reason: 'patient_notification_exists' };
      }
      
      logger.log('Creating appointment notifications for:', { appointmentId, patientId, doctorId });
      
      // Get doctor information if doctor is assigned
      let doctorName = null;
      if (doctorId) {
        const { data: doctorData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', doctorId)
          .single();
        doctorName = doctorData?.full_name;
      }

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

      // Build message with doctor name if assigned - make it prominent
      const doctorInfo = doctorName ? ` Assigned Doctor: Dr. ${doctorName}` : '';
      const appointmentMessage = `${patientData.full_name} has requested an appointment for ${date} at ${time} (${branch} branch).${doctorInfo}`;

      // Notify admins
      await this.createRoleNotifications({
        role: 'admin',
        title: 'New Appointment Request',
        message: appointmentMessage,
        type: 'info',
        category: 'appointment',
        priority: 'high',
        actionUrl: '/admin/appointments',
        actionLabel: 'Review Request',
        metadata: { appointmentId, patientId, doctorId, doctorName, action: 'new_request' }
      });

      // Notify doctors
      // If a doctor is assigned, only notify that specific doctor
      // If no doctor is assigned, notify all doctors
      if (doctorId && doctorName) {
        // Only notify the assigned doctor
        const doctorMessage = `${patientData.full_name} | Admin has assigned you to be the doctor for the appointment on ${date} at ${time} (${branch} branch).`;
        
        await this.createNotification({
          recipientId: doctorId,
          title: 'New Appointment Request',
          message: doctorMessage,
          type: 'info',
          category: 'appointment',
          priority: 'high',
          actionUrl: '/doctor/appointments',
          actionLabel: 'Review Request',
          metadata: { appointmentId, patientId, doctorId, doctorName, action: 'new_request' }
        });
      } else {
        // No doctor assigned yet - notify all doctors
        const doctorMessage = `${patientData.full_name} has requested an appointment for ${date} at ${time} (${branch} branch).`;
        
        await this.createRoleNotifications({
          role: 'doctor',
          title: 'New Appointment Request',
          message: doctorMessage,
          type: 'info',
          category: 'appointment',
          priority: 'high',
          actionUrl: '/doctor/appointments',
          actionLabel: 'Review Request',
          metadata: { appointmentId, patientId, doctorId: null, doctorName: null, action: 'new_request' }
        });
      }

      // Notify staff - use the same message as admin
      await this.createRoleNotifications({
        role: 'staff',
        title: 'New Appointment Request',
        message: appointmentMessage,
        type: 'info',
        category: 'appointment',
        priority: 'high',
        actionUrl: '/staff/appointments',
        actionLabel: 'Review Request',
        metadata: { appointmentId, patientId, doctorId, doctorName, action: 'new_request' }
      });

      return { success: true };
    } catch (error) {
      logger.error('Error in notifyAppointmentCreated:', error);
      return { success: false, error };
    }
  }

  async notifyAppointmentStatusChange(appointmentData, oldStatus, newStatus, doctorData = null) {
    try {
      const { patientId, appointmentId, date, time, branch } = appointmentData;
      
      logger.log('Creating appointment status change notification:', { appointmentId, oldStatus, newStatus });

      let title, message, type, priority;

      switch (newStatus) {
        case 'confirmed':
          title = 'Appointment Confirmed';
          const doctorInfoText = doctorData ? ` Assigned Doctor: Dr. ${doctorData.full_name}` : '';
          message = `Your appointment on ${date} at ${time} (${branch} branch) has been confirmed.${doctorInfoText}`;
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
      logger.error('Error in notifyAppointmentStatusChange:', error);
      return { success: false, error };
    }
  }

  // Notify when appointment is rescheduled
  async notifyAppointmentRescheduled(appointmentData, oldDate, oldTime, oldBranch, rescheduledBy = null) {
    try {
      const { patientId, appointmentId, date, time, branch, doctorId } = appointmentData;
      
      if (!appointmentId) {
        logger.error('Cannot create reschedule notifications: appointmentId is missing');
        return { success: false, error: 'appointmentId is required' };
      }
      
      logger.log('Creating appointment reschedule notifications:', { 
        appointmentId, 
        oldDate, 
        oldTime, 
        oldBranch,
        newDate: date,
        newTime: time,
        newBranch: branch
      });

      // Get patient data
      const { data: patientData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', patientId)
        .single();

      if (!patientData) {
        logger.error('Patient not found for appointment reschedule notification');
        return { success: false, error: 'Patient not found' };
      }

      // Get doctor information if doctor is assigned
      let doctorName = null;
      if (doctorId) {
        const { data: doctorData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', doctorId)
          .single();
        doctorName = doctorData?.full_name;
      }

      // Format dates for display
      const formatDate = (dateStr) => {
        try {
          const date = new Date(dateStr);
          return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        } catch (e) {
          return dateStr;
        }
      };

      const formattedOldDate = formatDate(oldDate);
      const formattedNewDate = formatDate(date);

      // Notify the patient - include doctor name prominently
      const patientDoctorInfo = doctorName ? ` Assigned Doctor: Dr. ${doctorName}` : '';
      const patientMessage = `Your appointment has been rescheduled from ${formattedOldDate} at ${oldTime} (${oldBranch} branch) to ${formattedNewDate} at ${time} (${branch} branch).${patientDoctorInfo}`;
      
      await this.createNotification({
        recipientId: patientId,
        title: 'Appointment Rescheduled',
        message: patientMessage,
        type: 'info',
        category: 'appointment',
        priority: 'high',
        actionUrl: '/patient/appointments',
        actionLabel: 'View Appointment',
        metadata: { appointmentId, action: 'rescheduled', oldDate, oldTime, oldBranch, newDate: date, newTime: time, newBranch: branch }
      });

      // Build message for staff/admin/doctor - make doctor name prominent
      const doctorInfoText = doctorName ? ` Assigned Doctor: Dr. ${doctorName}` : '';
      const rescheduleMessage = `${patientData.full_name}'s appointment has been rescheduled from ${formattedOldDate} at ${oldTime} (${oldBranch} branch) to ${formattedNewDate} at ${time} (${branch} branch).${doctorInfoText}`;
      const rescheduledByText = rescheduledBy ? ` Rescheduled by: ${rescheduledBy}` : '';

      // Notify admins
      await this.createRoleNotifications({
        role: 'admin',
        title: 'Appointment Rescheduled',
        message: rescheduleMessage + rescheduledByText,
        type: 'info',
        category: 'appointment',
        priority: 'high',
        actionUrl: '/admin/appointments',
        actionLabel: 'View Appointment',
        metadata: { appointmentId, patientId, doctorId, doctorName, action: 'rescheduled', oldDate, oldTime, oldBranch, newDate: date, newTime: time, newBranch: branch }
      });

      // Notify staff - use the same message as admin
      await this.createRoleNotifications({
        role: 'staff',
        title: 'Appointment Rescheduled',
        message: rescheduleMessage + rescheduledByText,
        type: 'info',
        category: 'appointment',
        priority: 'high',
        actionUrl: '/staff/appointments',
        actionLabel: 'View Appointment',
        metadata: { appointmentId, patientId, doctorId, doctorName, action: 'rescheduled', oldDate, oldTime, oldBranch, newDate: date, newTime: time, newBranch: branch }
      });

      // Notify the assigned doctor (if any)
      if (doctorId && doctorName) {
        const doctorMessage = `${patientData.full_name}'s appointment has been rescheduled from ${formattedOldDate} at ${oldTime} (${oldBranch} branch) to ${formattedNewDate} at ${time} (${branch} branch).${rescheduledByText}`;
        
        await this.createNotification({
          recipientId: doctorId,
          title: 'Appointment Rescheduled',
          message: doctorMessage,
          type: 'info',
          category: 'appointment',
          priority: 'high',
          actionUrl: '/doctor/appointments',
          actionLabel: 'View Appointment',
          metadata: { appointmentId, patientId, action: 'rescheduled', oldDate, oldTime, oldBranch, newDate: date, newTime: time, newBranch: branch }
        });
      }

      return { success: true };
    } catch (error) {
      logger.error('Error in notifyAppointmentRescheduled:', error);
      return { success: false, error };
    }
  }

  // Payment-related notifications
  async notifyPaymentReceived(paymentData, patientData) {
    try {
      const { patientId, paymentId, invoiceId, amount, method } = paymentData;
      
      logger.log('Creating payment received notifications for:', { paymentId, patientId });

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
      logger.error('Error in notifyPaymentReceived:', error);
      return { success: false, error };
    }
  }

  async notifyPaymentStatusChange(paymentData, oldStatus, newStatus, approverData = null) {
    try {
      const { patientId, paymentId, invoiceId, amount } = paymentData;
      
      logger.log('Creating payment status change notification:', { paymentId, oldStatus, newStatus });

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
      logger.error('Error in notifyPaymentStatusChange:', error);
      return { success: false, error };
    }
  }

  // System notifications
  async notifyWelcomeNewUser(userData) {
    try {
      const { userId, fullName, role } = userData;
      
      logger.log('Creating welcome notification for:', { userId, role });

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
      logger.error('Error in notifyWelcomeNewUser:', error);
      return { success: false, error };
    }
  }

  // Utility methods
  async sendTestNotification(userId, userRole) {
    try {
      logger.log('Sending test notification to:', { userId, userRole });

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
      logger.error('Error sending test notification:', error);
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
      logger.error('Error marking notification as read:', error);
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
      logger.error('Error deleting notification:', error);
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
      logger.error('Error getting unread count:', error);
      return { success: false, error, count: 0 };
    }
  }

  // Braces checkup reminder notifications
  async checkAndNotifyBracesCheckups() {
    try {
      await this.initialize();

      // Calculate tomorrow's date (1 day in advance)
      // Use local date to avoid timezone issues
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Format as YYYY-MM-DD for date comparison (using local date, not UTC)
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const tomorrowDateStr = `${year}-${month}-${day}`;

      logger.log('[BracesCheckupReminder] Checking for braces checkups on:', tomorrowDateStr);
      logger.log('[BracesCheckupReminder] Today is:', new Date().toISOString().split('T')[0]);

      // Get all braces checkups scheduled for tomorrow that haven't been attended
      // Since appointment_date is stored as a date (not datetime), we can use eq for exact match
      const { data: upcomingCheckups, error: checkupError } = await supabase
        .from('braces_checkups')
        .select(`
          id,
          patient_id,
          appointment_date,
          doctor_id,
          patients:profiles!patient_id(id, full_name, disabled),
          doctor:profiles!doctor_id(id, full_name)
        `)
        .eq('attended', false)
        .eq('appointment_date', tomorrowDateStr)
        .not('appointment_date', 'is', null); // Ensure appointment_date is not null

      if (checkupError) {
        logger.error('[BracesCheckupReminder] Error fetching checkups:', checkupError);
        throw checkupError;
      }

      logger.log('[BracesCheckupReminder] Found', upcomingCheckups?.length || 0, 'checkups for tomorrow');

      if (!upcomingCheckups || upcomingCheckups.length === 0) {
        logger.log('[BracesCheckupReminder] No braces checkups scheduled for tomorrow');
        return { success: true, count: 0 };
      }

      // Filter out disabled patients
      const activeCheckups = upcomingCheckups.filter(
        checkup => !checkup.patients?.disabled
      );

      if (activeCheckups.length === 0) {
        logger.log('No active patients with braces checkups tomorrow');
        return { success: true, count: 0 };
      }

      // Check for existing notifications to avoid duplicates
      const today = new Date().toISOString().split('T')[0];
      const { data: existingNotifications, error: notifError } = await supabase
        .from('notifications')
        .select('metadata')
        .eq('category', 'braces_checkup')
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lte('created_at', `${today}T23:59:59.999Z`);

      if (notifError) {
        logger.warn('Error checking existing notifications:', notifError);
      }

      const existingCheckupIds = new Set(
        (existingNotifications || [])
          .map(n => n.metadata?.checkupId)
          .filter(Boolean)
      );

      let notificationsCreated = 0;

      // Create notifications for each patient
      for (const checkup of activeCheckups) {
        // Skip if notification already exists for this checkup today
        if (existingCheckupIds.has(checkup.id)) {
          logger.log(`Notification already exists for checkup ${checkup.id}`);
          continue;
        }

        if (!checkup.patient_id || !checkup.patients) {
          logger.warn('Skipping checkup with missing patient data:', checkup.id);
          continue;
        }

        const appointmentDate = new Date(checkup.appointment_date);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        // Get doctor's name
        const doctorName = checkup.doctor?.full_name || 'your doctor';
        const doctorTitle = doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`;

        // Set expiration to end of appointment day
        const expirationDate = new Date(appointmentDate);
        expirationDate.setHours(23, 59, 59, 999);

        const result = await this.createNotification({
          recipientId: checkup.patient_id,
          senderId: checkup.doctor_id,
          title: 'Braces Checkup Reminder',
          message: `You have a braces checkup scheduled for tomorrow (${formattedDate}) with ${doctorTitle}. Please make sure to attend your appointment.`,
          type: 'appointment',
          category: 'braces_checkup',
          priority: 'high',
          actionUrl: '/patient/appointments',
          actionLabel: 'View Appointments',
          metadata: {
            checkupId: checkup.id,
            appointmentDate: checkup.appointment_date,
            doctorId: checkup.doctor_id,
            doctorName: doctorName,
            action: 'checkup_reminder'
          },
          expiresAt: expirationDate.toISOString() // Expire at end of appointment day
        });

        if (result.success) {
          notificationsCreated++;
          logger.log(`[BracesCheckupReminder] Created reminder notification for patient ${checkup.patients.full_name} (checkup ID: ${checkup.id})`);
        } else {
          logger.error(`[BracesCheckupReminder] Failed to create notification for checkup ${checkup.id}:`, result.error);
        }
      }

      logger.log(`[BracesCheckupReminder] Successfully created ${notificationsCreated} reminder notification(s)`);
      return { success: true, count: notificationsCreated };
    } catch (error) {
      logger.error('[BracesCheckupReminder] Error checking and notifying braces checkups:', error);
      return { success: false, error: error.message || error };
    }
  }
}

// Create and export singleton instance
const notificationService = new NotificationService();

// Auto-initialize on import
notificationService.initialize().catch(logger.error);

export default notificationService;

// Export individual methods for convenience
export const {
  createNotification,
  createRoleNotifications,
  notifyAppointmentCreated,
  notifyAppointmentStatusChange,
  notifyAppointmentRescheduled,
  notifyPaymentReceived,
  notifyPaymentStatusChange,
  notifyWelcomeNewUser,
  sendTestNotification,
  markNotificationAsRead,
  deleteNotification,
  getUnreadCount,
  checkAndNotifyBracesCheckups
} = notificationService;