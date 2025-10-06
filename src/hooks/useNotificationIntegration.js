// src/hooks/useNotificationIntegration.js - Hooks to integrate notifications with business logic
import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import notificationService from '../services/notificationService';
import supabase from '../config/supabaseClient';

// Hook for appointment-related notifications
export const useAppointmentNotifications = () => {
  const { user } = useAuth();

  const createAppointment = useCallback(async (appointmentData) => {
    try {
      console.log('Creating appointment with notifications:', appointmentData);

      // Create the appointment first
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          patient_id: appointmentData.patientId,
          appointment_date: appointmentData.date,
          appointment_time: appointmentData.time,
          branch: appointmentData.branch,
          teeth_involved: appointmentData.teethInvolved || '',
          notes: appointmentData.notes || '',
          status: 'pending',
          is_emergency: appointmentData.isEmergency || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Get patient data for notifications
      const { data: patientData, error: patientError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', appointmentData.patientId)
        .single();

      if (patientError) throw patientError;

      // Send notifications (this will be handled by database triggers, but we can also do it here as backup)
      await notificationService.notifyAppointmentCreated(
        {
          patientId: appointment.patient_id,
          appointmentId: appointment.id,
          date: appointment.appointment_date,
          time: appointment.appointment_time,
          branch: appointment.branch
        },
        patientData
      );

      console.log('Appointment created successfully with notifications');
      return { success: true, data: appointment };
    } catch (error) {
      console.error('Error creating appointment:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const updateAppointmentStatus = useCallback(async (appointmentId, newStatus, doctorId = null) => {
    try {
      console.log('Updating appointment status with notifications:', { appointmentId, newStatus, doctorId });

      // Get current appointment data
      const { data: currentAppointment, error: fetchError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (fetchError) throw fetchError;

      const oldStatus = currentAppointment.status;

      // Update the appointment
      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (doctorId) {
        updateData.doctor_id = doctorId;
      }

      const { data: appointment, error: updateError } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointmentId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Get doctor data if available
      let doctorData = null;
      if (appointment.doctor_id) {
        const { data: doctor } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', appointment.doctor_id)
          .single();
        doctorData = doctor;
      }

      // Send status change notification (backup to database triggers)
      await notificationService.notifyAppointmentStatusChange(
        {
          patientId: appointment.patient_id,
          appointmentId: appointment.id,
          date: appointment.appointment_date,
          time: appointment.appointment_time,
          branch: appointment.branch
        },
        oldStatus,
        newStatus,
        doctorData
      );

      console.log('Appointment status updated successfully with notifications');
      return { success: true, data: appointment };
    } catch (error) {
      console.error('Error updating appointment status:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const confirmAppointment = useCallback(async (appointmentId, doctorId) => {
    return await updateAppointmentStatus(appointmentId, 'confirmed', doctorId);
  }, [updateAppointmentStatus]);

  const cancelAppointment = useCallback(async (appointmentId, reason = '') => {
    return await updateAppointmentStatus(appointmentId, 'cancelled');
  }, [updateAppointmentStatus]);

  const rejectAppointment = useCallback(async (appointmentId, reason = '') => {
    return await updateAppointmentStatus(appointmentId, 'rejected');
  }, [updateAppointmentStatus]);

  const completeAppointment = useCallback(async (appointmentId) => {
    return await updateAppointmentStatus(appointmentId, 'completed');
  }, [updateAppointmentStatus]);

  return {
    createAppointment,
    updateAppointmentStatus,
    confirmAppointment,
    cancelAppointment,
    rejectAppointment,
    completeAppointment
  };
};

// Hook for payment-related notifications
export const usePaymentNotifications = () => {
  const { user } = useAuth();

  const createPayment = useCallback(async (paymentData) => {
    try {
      console.log('Creating payment with notifications:', paymentData);

      // Create the payment first
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          invoice_id: paymentData.invoiceId,
          amount: paymentData.amount,
          payment_date: new Date().toISOString(),
          payment_method: paymentData.method,
          reference_number: paymentData.referenceNumber,
          notes: paymentData.notes || '',
          created_by: paymentData.createdBy || user.id,
          approval_status: 'pending',
          doctor_approval_status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Get patient data from invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          patient:profiles!patient_id(id, full_name, email)
        `)
        .eq('id', paymentData.invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      // Send notifications (backup to database triggers)
      await notificationService.notifyPaymentReceived(
        {
          patientId: invoiceData.patient_id,
          paymentId: payment.id,
          invoiceId: payment.invoice_id,
          amount: parseFloat(payment.amount),
          method: payment.payment_method
        },
        invoiceData.patient
      );

      console.log('Payment created successfully with notifications');
      return { success: true, data: payment };
    } catch (error) {
      console.error('Error creating payment:', error);
      return { success: false, error: error.message };
    }
  }, [user]);

  const updatePaymentStatus = useCallback(async (paymentId, newStatus, approverId = null) => {
    try {
      console.log('Updating payment status with notifications:', { paymentId, newStatus, approverId });

      // Get current payment data
      const { data: currentPayment, error: fetchError } = await supabase
        .from('payments')
        .select(`
          *,
          invoice:invoices!invoice_id(
            *,
            patient:profiles!patient_id(id, full_name, email)
          )
        `)
        .eq('id', paymentId)
        .single();

      if (fetchError) throw fetchError;

      const oldStatus = currentPayment.approval_status;

      // Update the payment
      const { data: payment, error: updateError } = await supabase
        .from('payments')
        .update({
          approval_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Get approver data if available
      let approverData = null;
      if (approverId) {
        const { data: approver } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', approverId)
          .single();
        approverData = approver;
      }

      // Send status change notification (backup to database triggers)
      await notificationService.notifyPaymentStatusChange(
        {
          patientId: currentPayment.invoice.patient_id,
          paymentId: payment.id,
          invoiceId: payment.invoice_id,
          amount: parseFloat(payment.amount)
        },
        oldStatus,
        newStatus,
        approverData
      );

      console.log('Payment status updated successfully with notifications');
      return { success: true, data: payment };
    } catch (error) {
      console.error('Error updating payment status:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const approvePayment = useCallback(async (paymentId, approverId) => {
    return await updatePaymentStatus(paymentId, 'approved', approverId);
  }, [updatePaymentStatus]);

  const rejectPayment = useCallback(async (paymentId, approverId, reason = '') => {
    return await updatePaymentStatus(paymentId, 'rejected', approverId);
  }, [updatePaymentStatus]);

  return {
    createPayment,
    updatePaymentStatus,
    approvePayment,
    rejectPayment
  };
};

// Hook for system notifications
export const useSystemNotifications = () => {
  const sendWelcomeNotification = useCallback(async (userData) => {
    try {
      await notificationService.notifyWelcomeNewUser(userData);
      return { success: true };
    } catch (error) {
      console.error('Error sending welcome notification:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const sendTestNotification = useCallback(async (userId, userRole) => {
    try {
      await notificationService.sendTestNotification(userId, userRole);
      return { success: true };
    } catch (error) {
      console.error('Error sending test notification:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const sendAnnouncementToRole = useCallback(async (role, title, message, actionUrl = null) => {
    try {
      await notificationService.createRoleNotifications({
        role,
        title: `📢 ${title}`,
        message,
        type: 'info',
        category: 'system',
        priority: 'normal',
        actionUrl,
        actionLabel: actionUrl ? 'View Details' : null,
        metadata: { action: 'announcement' }
      });
      return { success: true };
    } catch (error) {
      console.error('Error sending announcement:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const sendEmergencyAlert = useCallback(async (title, message, actionUrl = null) => {
    try {
      // Send to all staff, doctors, and admins
      const roles = ['admin', 'doctor', 'staff'];
      
      for (const role of roles) {
        await notificationService.createRoleNotifications({
          role,
          title: `🚨 EMERGENCY: ${title}`,
          message,
          type: 'error',
          category: 'system',
          priority: 'urgent',
          actionUrl,
          actionLabel: 'Respond',
          metadata: { action: 'emergency' }
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error sending emergency alert:', error);
      return { success: false, error: error.message };
    }
  }, []);

  return {
    sendWelcomeNotification,
    sendTestNotification,
    sendAnnouncementToRole,
    sendEmergencyAlert
  };
};

// Hook for notification management
export const useNotificationActions = () => {
  const { user } = useAuth();

  const markAsRead = useCallback(async (notificationId) => {
    try {
      const result = await notificationService.markNotificationAsRead(notificationId, user.id);
      return result;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: error.message };
    }
  }, [user]);

  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const result = await notificationService.deleteNotification(notificationId, user.id);
      return result;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return { success: false, error: error.message };
    }
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          updated_at: new Date().toISOString() 
        })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return { success: false, error: error.message };
    }
  }, [user]);

  const getUnreadCount = useCallback(async () => {
    try {
      const result = await notificationService.getUnreadCount(user.id);
      return result;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return { success: false, error: error.message, count: 0 };
    }
  }, [user]);

  return {
    markAsRead,
    deleteNotification,
    markAllAsRead,
    getUnreadCount
  };
};

// Main hook that combines all notification functionality
export const useNotifications = () => {
  const appointmentNotifications = useAppointmentNotifications();
  const paymentNotifications = usePaymentNotifications();
  const systemNotifications = useSystemNotifications();
  const notificationActions = useNotificationActions();

  return {
    ...appointmentNotifications,
    ...paymentNotifications,
    ...systemNotifications,
    ...notificationActions
  };
};