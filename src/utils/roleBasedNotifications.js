// src/utils/roleBasedNotifications.js - Extended notifications for all roles
import supabase from '../config/supabaseClient';
import { createNotification, createBulkNotifications } from './notificationHelpers';

/**
 * ADMIN NOTIFICATIONS
 * Admins see everything for monitoring:
 * - User management notifications
 * - Appointment notifications
 * - Billing notifications
 * - Service notifications
 * - Queue notifications
 */

// Notify admins about system events
export const notifyAdminsSystemEvent = async (eventType, eventData) => {
  try {
    // Get all admin users
    const { data: admins, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'admin')
      .neq('disabled', true);

    if (error) throw error;

    const adminIds = admins.map(admin => admin.id);
    
    const notifications = {
      // User Management Notifications
      new_user_registration: {
        title: 'New User Registration 👤',
        message: `${eventData.userName} has registered as a ${eventData.role}. Account requires approval.`,
        type: 'info',
        category: 'user_management',
        priority: 'normal',
        actionUrl: '/admin/users',
        actionLabel: 'Review User'
      },
      user_approved: {
        title: 'User Account Approved ✅',
        message: `${eventData.userName} (${eventData.role}) account has been approved and activated.`,
        type: 'success',
        category: 'user_management',
        priority: 'normal',
        actionUrl: '/admin/users',
        actionLabel: 'View User'
      },
      user_disabled: {
        title: 'User Account Disabled ❌',
        message: `${eventData.userName} (${eventData.role}) account has been disabled. Reason: ${eventData.reason}`,
        type: 'warning',
        category: 'user_management',
        priority: 'high',
        actionUrl: '/admin/users',
        actionLabel: 'View Details'
      },

      // Appointment Notifications
      appointment_high_volume: {
        title: 'High Appointment Volume 📈',
        message: `Today has ${eventData.appointmentCount} appointments scheduled. Consider adding more staff.`,
        type: 'info',
        category: 'appointment',
        priority: 'normal',
        actionUrl: '/admin/appointments',
        actionLabel: 'View Schedule'
      },
      appointment_conflict: {
        title: 'Appointment Conflict ⚠️',
        message: `Conflict detected: ${eventData.patientName} has overlapping appointments.`,
        type: 'warning',
        category: 'appointment',
        priority: 'high',
        actionUrl: '/admin/appointments',
        actionLabel: 'Resolve Conflict'
      },

      // Billing Notifications
      payment_needs_review: {
        title: 'Payment Requires Review 💰',
        message: `Payment of ₱${eventData.amount?.toLocaleString()} from ${eventData.patientName} needs admin approval.`,
        type: 'warning',
        category: 'billing',
        priority: 'high',
        actionUrl: '/admin/billing',
        actionLabel: 'Review Payment'
      },
      high_value_payment: {
        title: 'High Value Payment 💎',
        message: `Large payment of ₱${eventData.amount?.toLocaleString()} received from ${eventData.patientName}.`,
        type: 'info',
        category: 'billing',
        priority: 'normal',
        actionUrl: '/admin/billing',
        actionLabel: 'View Details'
      },
      billing_discrepancy: {
        title: 'Billing Discrepancy ⚠️',
        message: `Discrepancy found in billing for ${eventData.patientName}. Amount difference: ₱${eventData.difference?.toLocaleString()}.`,
        type: 'error',
        category: 'billing',
        priority: 'urgent',
        actionUrl: '/admin/billing',
        actionLabel: 'Investigate'
      },

      // Service Notifications
      service_updated: {
        title: 'Service Updated 🔧',
        message: `Service "${eventData.serviceName}" has been updated. Price: ₱${eventData.newPrice?.toLocaleString()}.`,
        type: 'info',
        category: 'service',
        priority: 'normal',
        actionUrl: '/admin/services',
        actionLabel: 'View Service'
      },
      service_discontinued: {
        title: 'Service Discontinued ❌',
        message: `Service "${eventData.serviceName}" has been discontinued. ${eventData.reason}`,
        type: 'warning',
        category: 'service',
        priority: 'normal',
        actionUrl: '/admin/services',
        actionLabel: 'View Details'
      },

      // Queue Notifications
      queue_overload: {
        title: 'Queue Overload 🚨',
        message: `Queue has ${eventData.queueLength} patients waiting. Average wait time: ${eventData.waitTime} minutes.`,
        type: 'error',
        category: 'queue',
        priority: 'urgent',
        actionUrl: '/admin/queue',
        actionLabel: 'Manage Queue'
      },
      queue_cleared: {
        title: 'Queue Cleared ✅',
        message: `All patients have been served. Queue cleared successfully.`,
        type: 'success',
        category: 'queue',
        priority: 'normal',
        actionUrl: '/admin/queue',
        actionLabel: 'View Status'
      },

      // System Notifications
      system_error: {
        title: 'System Error Detected 🚨',
        message: `${eventData.errorType}: ${eventData.errorMessage}`,
        type: 'error',
        category: 'system',
        priority: 'urgent',
        actionUrl: '/admin/settings',
        actionLabel: 'View Details'
      },
      daily_summary: {
        title: 'Daily Operations Summary 📊',
        message: `Today: ${eventData.appointments} appointments, ${eventData.payments} payments, ${eventData.newPatients} new patients, ₱${eventData.revenue?.toLocaleString()} revenue.`,
        type: 'info',
        category: 'system',
        priority: 'normal',
        actionUrl: '/admin/dashboard',
        actionLabel: 'View Dashboard'
      },
      backup_completed: {
        title: 'System Backup Completed 💾',
        message: `Daily backup completed successfully. ${eventData.backupSize} of data backed up.`,
        type: 'success',
        category: 'system',
        priority: 'low',
        actionUrl: '/admin/settings',
        actionLabel: 'View Backup'
      },
      security_alert: {
        title: 'Security Alert 🔒',
        message: `Security event detected: ${eventData.eventType}. Action: ${eventData.action}`,
        type: 'error',
        category: 'system',
        priority: 'urgent',
        actionUrl: '/admin/security',
        actionLabel: 'View Alert'
      }
    };

    const notification = notifications[eventType];
    if (!notification) {
      throw new Error(`Unknown admin notification type: ${eventType}`);
    }

    return await createBulkNotifications(adminIds, {
      ...notification,
      metadata: { eventType, ...eventData }
    });
  } catch (error) {
    console.error('Error sending admin notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * DOCTOR NOTIFICATIONS
 * Doctors only see their own notifications:
 * - Their own appointments
 * - Patient arrivals in the queue
 * - Payments linked to their treatments
 * - Patient record updates
 */

// Notify doctors about their appointments and patients
export const notifyDoctorAppointmentEvent = async (doctorId, eventType, eventData) => {
  try {
    const notifications = {
      // Appointment Notifications
      new_appointment_request: {
        title: 'New Appointment Request 📅',
        message: `${eventData.patientName} has requested an appointment for ${eventData.date} at ${eventData.time}.`,
        type: 'info',
        category: 'appointment',
        priority: 'high',
        actionUrl: '/doctor/appointments',
        actionLabel: 'Review Request'
      },
      appointment_reminder: {
        title: 'Upcoming Appointment ⏰',
        message: `Appointment with ${eventData.patientName} in 1 hour at ${eventData.time}.`,
        type: 'info',
        category: 'appointment',
        priority: 'urgent',
        actionUrl: '/doctor/appointments',
        actionLabel: 'View Details'
      },
      appointment_confirmed: {
        title: 'Appointment Confirmed ✅',
        message: `Your appointment with ${eventData.patientName} for ${eventData.date} at ${eventData.time} has been confirmed.`,
        type: 'success',
        category: 'appointment',
        priority: 'normal',
        actionUrl: '/doctor/appointments',
        actionLabel: 'View Details'
      },
      appointment_cancelled: {
        title: 'Appointment Cancelled ❌',
        message: `Appointment with ${eventData.patientName} for ${eventData.date} at ${eventData.time} has been cancelled.`,
        type: 'warning',
        category: 'appointment',
        priority: 'normal',
        actionUrl: '/doctor/appointments',
        actionLabel: 'View Details'
      },

      // Queue Notifications
      patient_arrived: {
        title: 'Patient Arrived 🏥',
        message: `${eventData.patientName} has arrived for their ${eventData.time} appointment.`,
        type: 'success',
        category: 'queue',
        priority: 'high',
        actionUrl: '/doctor/queue',
        actionLabel: 'See Patient'
      },
      patient_in_queue: {
        title: 'Patient in Queue 📋',
        message: `${eventData.patientName} is waiting in queue (Position: ${eventData.queuePosition}).`,
        type: 'info',
        category: 'queue',
        priority: 'normal',
        actionUrl: '/doctor/queue',
        actionLabel: 'View Queue'
      },
      emergency_case: {
        title: 'Emergency Case 🚨',
        message: `Emergency patient ${eventData.patientName} needs immediate attention.`,
        type: 'error',
        category: 'queue',
        priority: 'urgent',
        actionUrl: '/doctor/emergencies',
        actionLabel: 'Handle Emergency'
      },

      // Payment Notifications
      payment_linked: {
        title: 'Payment Linked to Treatment 💰',
        message: `Payment of ₱${eventData.amount?.toLocaleString()} from ${eventData.patientName} has been linked to your ${eventData.treatment} treatment.`,
        type: 'success',
        category: 'payment',
        priority: 'normal',
        actionUrl: '/doctor/billing',
        actionLabel: 'View Payment'
      },
      payment_pending: {
        title: 'Payment Pending ⏳',
        message: `Payment of ₱${eventData.amount?.toLocaleString()} from ${eventData.patientName} is pending verification.`,
        type: 'warning',
        category: 'payment',
        priority: 'normal',
        actionUrl: '/doctor/billing',
        actionLabel: 'Check Status'
      },

      // Patient Record Notifications
      patient_record_update: {
        title: 'Patient Record Updated 📋',
        message: `Patient ${eventData.patientName}'s record has been updated with new information.`,
        type: 'info',
        category: 'patient_record',
        priority: 'normal',
        actionUrl: `/doctor/patients/${eventData.patientId}`,
        actionLabel: 'View Record'
      },
      treatment_followup: {
        title: 'Treatment Follow-up Required 🔄',
        message: `${eventData.patientName} needs follow-up for ${eventData.treatment} performed on ${eventData.date}.`,
        type: 'warning',
        category: 'patient_record',
        priority: 'normal',
        actionUrl: `/doctor/patients/${eventData.patientId}`,
        actionLabel: 'View Patient'
      },
      lab_results_ready: {
        title: 'Lab Results Ready 🧪',
        message: `Lab results for ${eventData.patientName} are ready for review.`,
        type: 'info',
        category: 'patient_record',
        priority: 'high',
        actionUrl: `/doctor/patients/${eventData.patientId}`,
        actionLabel: 'View Results'
      }
    };

    const notification = notifications[eventType];
    if (!notification) {
      throw new Error(`Unknown doctor notification type: ${eventType}`);
    }

    return await createNotification({
      recipientId: doctorId,
      ...notification,
      metadata: { eventType, ...eventData }
    });
  } catch (error) {
    console.error('Error sending doctor notification:', error);
    return { success: false, error: error.message };
  }
};

// Notify all doctors about general events
export const notifyAllDoctors = async (eventType, eventData) => {
  try {
    const { data: doctors, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'doctor')
      .neq('disabled', true);

    if (error) throw error;

    const doctorIds = doctors.map(doctor => doctor.id);

    const notifications = {
      schedule_change: {
        title: 'Schedule Update',
        message: `Clinic schedule has been updated for ${eventData.date}. Please check your appointments.`,
        type: 'warning',
        category: 'system',
        priority: 'high',
        actionUrl: '/doctor/appointments',
        actionLabel: 'View Schedule'
      },
      new_protocol: {
        title: 'New Medical Protocol',
        message: `New protocol for ${eventData.procedure} has been implemented. Please review.`,
        type: 'info',
        category: 'system',
        priority: 'normal',
        actionUrl: '/doctor/settings',
        actionLabel: 'View Protocol'
      },
      staff_meeting: {
        title: 'Staff Meeting Scheduled',
        message: `Staff meeting scheduled for ${eventData.date} at ${eventData.time}. Topic: ${eventData.topic}`,
        type: 'info',
        category: 'system',
        priority: 'normal',
        actionUrl: '/doctor/dashboard',
        actionLabel: 'Mark Calendar'
      }
    };

    const notification = notifications[eventType];
    if (!notification) {
      throw new Error(`Unknown doctor broadcast type: ${eventType}`);
    }

    return await createBulkNotifications(doctorIds, {
      ...notification,
      metadata: { eventType, ...eventData }
    });
  } catch (error) {
    console.error('Error sending doctor broadcast:', error);
    return { success: false, error: error.message };
  }
};

/**
 * STAFF NOTIFICATIONS
 * Staff only see what's relevant to their role:
 * - New or cancelled appointments
 * - Queue updates (patient check-in, next in line)
 * - Payments needing confirmation
 */

// Notify staff about their tasks and duties
export const notifyStaffTask = async (staffId, eventType, eventData) => {
  try {
    const notifications = {
      // Appointment Notifications
      new_appointment: {
        title: 'New Appointment Booked 📅',
        message: `New appointment booked: ${eventData.patientName} on ${eventData.date} at ${eventData.time}.`,
        type: 'info',
        category: 'appointment',
        priority: 'normal',
        actionUrl: '/staff/appointments',
        actionLabel: 'View Appointment'
      },
      cancelled_appointment: {
        title: 'Appointment Cancelled ❌',
        message: `Appointment cancelled: ${eventData.patientName} for ${eventData.date} at ${eventData.time}.`,
        type: 'warning',
        category: 'appointment',
        priority: 'normal',
        actionUrl: '/staff/appointments',
        actionLabel: 'View Details'
      },
      appointment_preparation: {
        title: 'Prepare for Appointment 🏥',
        message: `Prepare room for ${eventData.patientName}'s ${eventData.procedure} appointment in 30 minutes.`,
        type: 'warning',
        category: 'appointment',
        priority: 'high',
        actionUrl: '/staff/appointments',
        actionLabel: 'View Details'
      },

      // Queue Notifications
      patient_checkin: {
        title: 'Patient Check-in Required ✅',
        message: `${eventData.patientName} has arrived and needs to be checked in. Queue #${eventData.queueNumber}.`,
        type: 'info',
        category: 'queue',
        priority: 'high',
        actionUrl: '/staff/queue',
        actionLabel: 'Check In Patient'
      },
      next_in_line: {
        title: 'Next Patient Ready 📋',
        message: `${eventData.patientName} is next in line. Please prepare for their appointment.`,
        type: 'info',
        category: 'queue',
        priority: 'high',
        actionUrl: '/staff/queue',
        actionLabel: 'View Queue'
      },
      queue_update: {
        title: 'Queue Status Update 📊',
        message: `Queue updated: ${eventData.currentPatients} patients waiting, ${eventData.estimatedWait} minutes average wait time.`,
        type: 'info',
        category: 'queue',
        priority: 'normal',
        actionUrl: '/staff/queue',
        actionLabel: 'View Queue'
      },

      // Payment Notifications
      payment_confirmation: {
        title: 'Payment Needs Confirmation 💰',
        message: `Payment of ₱${eventData.amount?.toLocaleString()} from ${eventData.patientName} needs confirmation.`,
        type: 'warning',
        category: 'payment',
        priority: 'high',
        actionUrl: '/staff/billing',
        actionLabel: 'Confirm Payment'
      },
      payment_processed: {
        title: 'Payment Processed ✅',
        message: `Payment of ₱${eventData.amount?.toLocaleString()} from ${eventData.patientName} has been processed successfully.`,
        type: 'success',
        category: 'payment',
        priority: 'normal',
        actionUrl: '/staff/billing',
        actionLabel: 'View Receipt'
      },
      billing_task: {
        title: 'Billing Task 📋',
        message: `Process billing for ${eventData.patientName} - ${eventData.service} (₱${eventData.amount?.toLocaleString()}).`,
        type: 'info',
        category: 'billing',
        priority: 'normal',
        actionUrl: `/staff/billing/edit/${eventData.invoiceId}`,
        actionLabel: 'Process Billing'
      },

      // System Notifications
      inventory_alert: {
        title: 'Inventory Alert 📦',
        message: `${eventData.itemName} is running low (${eventData.quantity} remaining). Please reorder.`,
        type: 'warning',
        category: 'inventory',
        priority: 'normal',
        actionUrl: '/staff/inventory',
        actionLabel: 'Manage Inventory'
      },
      shift_reminder: {
        title: 'Shift Reminder ⏰',
        message: `Your shift starts in 1 hour. Schedule: ${eventData.startTime} - ${eventData.endTime}`,
        type: 'info',
        category: 'schedule',
        priority: 'normal',
        actionUrl: '/staff/dashboard',
        actionLabel: 'View Schedule'
      },
      training_required: {
        title: 'Training Required 📚',
        message: `Mandatory training on ${eventData.topic} is due. Please complete by ${eventData.dueDate}.`,
        type: 'warning',
        category: 'training',
        priority: 'high',
        actionUrl: '/staff/training',
        actionLabel: 'Start Training'
      }
    };

    const notification = notifications[eventType];
    if (!notification) {
      throw new Error(`Unknown staff notification type: ${eventType}`);
    }

    return await createNotification({
      recipientId: staffId,
      ...notification,
      metadata: { eventType, ...eventData }
    });
  } catch (error) {
    console.error('Error sending staff notification:', error);
    return { success: false, error: error.message };
  }
};

// Notify all staff about general events
export const notifyAllStaff = async (eventType, eventData) => {
  try {
    const { data: staff, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'staff')
      .neq('disabled', true);

    if (error) throw error;

    const staffIds = staff.map(s => s.id);

    const notifications = {
      clinic_closure: {
        title: 'Clinic Closure Notice',
        message: `Clinic will be closed on ${eventData.date} due to ${eventData.reason}.`,
        type: 'warning',
        category: 'system',
        priority: 'high',
        actionUrl: '/staff/dashboard',
        actionLabel: 'View Notice'
      },
      policy_update: {
        title: 'Policy Update',
        message: `New policy regarding ${eventData.policy} is now in effect. Please review.`,
        type: 'info',
        category: 'system',
        priority: 'normal',
        actionUrl: '/staff/settings',
        actionLabel: 'Read Policy'
      },
      training_session: {
        title: 'Training Session',
        message: `Mandatory training on ${eventData.topic} scheduled for ${eventData.date} at ${eventData.time}.`,
        type: 'info',
        category: 'training',
        priority: 'high',
        actionUrl: '/staff/dashboard',
        actionLabel: 'Register'
      }
    };

    const notification = notifications[eventType];
    if (!notification) {
      throw new Error(`Unknown staff broadcast type: ${eventType}`);
    }

    return await createBulkNotifications(staffIds, {
      ...notification,
      metadata: { eventType, ...eventData }
    });
  } catch (error) {
    console.error('Error sending staff broadcast:', error);
    return { success: false, error: error.message };
  }
};

/**
 * PATIENT NOTIFICATIONS (Enhanced)
 * Patients only see their own notifications:
 * - Appointment status (approved, canceled, rescheduled)
 * - Payment updates (paid or pending)
 * - Dental chart updates when doctor adds treatment
 */

// Enhanced patient notifications with specific types
export const notifyPatientEvent = async (patientId, eventType, eventData) => {
  try {
    const notifications = {
      // Appointment Status Notifications
      appointment_approved: {
        title: 'Appointment Approved ✅',
        message: `Your appointment for ${eventData.date} at ${eventData.time} has been approved. Please arrive 15 minutes early.`,
        type: 'success',
        category: 'appointment',
        priority: 'high',
        actionUrl: '/patient/appointments',
        actionLabel: 'View Appointment'
      },
      appointment_cancelled: {
        title: 'Appointment Cancelled ❌',
        message: `Your appointment for ${eventData.date} at ${eventData.time} has been cancelled. ${eventData.reason ? `Reason: ${eventData.reason}` : 'Please contact us to reschedule.'}`,
        type: 'warning',
        category: 'appointment',
        priority: 'high',
        actionUrl: '/patient/appointments',
        actionLabel: 'Reschedule'
      },
      appointment_rescheduled: {
        title: 'Appointment Rescheduled 📅',
        message: `Your appointment has been rescheduled to ${eventData.newDate} at ${eventData.newTime}. Original time: ${eventData.oldDate} at ${eventData.oldTime}.`,
        type: 'info',
        category: 'appointment',
        priority: 'high',
        actionUrl: '/patient/appointments',
        actionLabel: 'View New Time'
      },

      // Payment Update Notifications
      payment_paid: {
        title: 'Payment Received ✅',
        message: `Payment of ₱${eventData.amount?.toLocaleString()} has been received and processed successfully.`,
        type: 'success',
        category: 'payment',
        priority: 'normal',
        actionUrl: '/patient/billing',
        actionLabel: 'View Receipt'
      },
      payment_pending: {
        title: 'Payment Pending ⏳',
        message: `Payment of ₱${eventData.amount?.toLocaleString()} is pending verification. You will be notified once processed.`,
        type: 'info',
        category: 'payment',
        priority: 'normal',
        actionUrl: '/patient/billing',
        actionLabel: 'Check Status'
      },
      payment_failed: {
        title: 'Payment Failed ❌',
        message: `Payment of ₱${eventData.amount?.toLocaleString()} could not be processed. Please try again or contact support.`,
        type: 'error',
        category: 'payment',
        priority: 'high',
        actionUrl: '/patient/billing',
        actionLabel: 'Retry Payment'
      },

      // Dental Chart Update Notifications
      dental_chart_update: {
        title: 'Dental Record Updated 📋',
        message: `Dr. ${eventData.doctorName} has updated your dental chart with new treatment information.`,
        type: 'info',
        category: 'dental_chart',
        priority: 'normal',
        actionUrl: '/patient/records',
        actionLabel: 'View Records'
      },
      treatment_completed: {
        title: 'Treatment Completed ✅',
        message: `Your ${eventData.treatment} treatment has been completed. Follow-up instructions have been added to your records.`,
        type: 'success',
        category: 'dental_chart',
        priority: 'normal',
        actionUrl: '/patient/records',
        actionLabel: 'View Details'
      },

      // System Notifications
      welcome: {
        title: 'Welcome to Silario Dental Clinic! 🦷',
        message: 'Thank you for registering! You can now book appointments and manage your dental care online.',
        type: 'success',
        category: 'system',
        priority: 'normal',
        actionUrl: '/patient/dashboard',
        actionLabel: 'Get Started'
      },
      dental_checkup_due: {
        title: 'Dental Checkup Due ⏰',
        message: 'It\'s been 6 months since your last checkup. Schedule your routine dental examination.',
        type: 'warning',
        category: 'health',
        priority: 'high',
        actionUrl: '/patient/appointments',
        actionLabel: 'Schedule Checkup'
      },
      prescription_ready: {
        title: 'Prescription Ready 💊',
        message: `Your prescription for ${eventData.medication} is ready for pickup.`,
        type: 'success',
        category: 'prescription',
        priority: 'normal',
        actionUrl: '/patient/prescriptions',
        actionLabel: 'View Details'
      },
      birthday_greeting: {
        title: 'Happy Birthday! 🎂',
        message: 'Happy birthday from all of us at Silario Dental Clinic! Enjoy your special day!',
        type: 'success',
        category: 'personal',
        priority: 'low',
        actionUrl: '/patient/dashboard',
        actionLabel: 'Thank You'
      }
    };

    const notification = notifications[eventType];
    if (!notification) {
      throw new Error(`Unknown patient notification type: ${eventType}`);
    }

    return await createNotification({
      recipientId: patientId,
      ...notification,
      metadata: { eventType, ...eventData }
    });
  } catch (error) {
    console.error('Error sending patient notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * ROLE-BASED NOTIFICATION ROUTER
 */

// Main function to send notifications based on user role
export const sendRoleBasedNotification = async (userId, eventType, eventData) => {
  try {
    // Get user role
    const { data: user, error } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', userId)
      .single();

    if (error) throw error;

    switch (user.role) {
      case 'admin':
        return await notifyAdminsSystemEvent(eventType, eventData);
      
      case 'doctor':
        return await notifyDoctorAppointmentEvent(userId, eventType, eventData);
      
      case 'staff':
        return await notifyStaffTask(userId, eventType, eventData);
      
      case 'patient':
        return await notifyPatientEvent(userId, eventType, eventData);
      
      default:
        throw new Error(`Unknown user role: ${user.role}`);
    }
  } catch (error) {
    console.error('Error sending role-based notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * AUTOMATED ROLE-BASED PROCESSING
 */

// Process role-specific notifications from database events
export const processRoleBasedNotifications = async () => {
  try {
    console.log('Processing role-based notifications...');
    
    const results = await Promise.allSettled([
      processAdminNotifications(),
      processDoctorNotifications(),
      processStaffNotifications(),
      processPatientNotifications()
    ]);

    return {
      admin: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason },
      doctor: results[1].status === 'fulfilled' ? results[1].value : { error: results[1].reason },
      staff: results[2].status === 'fulfilled' ? results[2].value : { error: results[2].reason },
      patient: results[3].status === 'fulfilled' ? results[3].value : { error: results[3].reason }
    };
  } catch (error) {
    console.error('Error processing role-based notifications:', error);
    return { success: false, error: error.message };
  }
};

// Process admin-specific notifications
const processAdminNotifications = async () => {
  try {
    // Check for pending user approvals
    const { data: pendingUsers, error: userError } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('disabled', true)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (userError) throw userError;

    for (const user of pendingUsers || []) {
      await notifyAdminsSystemEvent('new_user_registration', {
        userName: user.full_name,
        role: user.role,
        userId: user.id
      });
    }

    // Check for high-value payments needing review
    const { data: highValuePayments, error: paymentError } = await supabase
      .from('payments')
      .select(`
        id, amount, created_at,
        invoice:invoices!invoice_id(
          patient:profiles!patient_id(full_name)
        )
      `)
      .eq('approval_status', 'pending')
      .gte('amount', 5000)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (paymentError) throw paymentError;

    for (const payment of highValuePayments || []) {
      await notifyAdminsSystemEvent('payment_needs_review', {
        amount: parseFloat(payment.amount),
        patientName: payment.invoice?.patient?.full_name || 'Unknown',
        paymentId: payment.id
      });
    }

    return { success: true, processed: (pendingUsers?.length || 0) + (highValuePayments?.length || 0) };
  } catch (error) {
    console.error('Error processing admin notifications:', error);
    return { success: false, error: error.message };
  }
};

// Process doctor-specific notifications
const processDoctorNotifications = async () => {
  try {
    let processed = 0;

    // Check for upcoming appointments (next 2 hours)
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const { data: upcomingAppointments, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        id, appointment_date, appointment_time, doctor_id,
        patient:profiles!patient_id(full_name)
      `)
      .eq('status', 'confirmed')
      .gte('appointment_date', new Date().toISOString().split('T')[0])
      .lte('appointment_date', twoHoursFromNow.toISOString().split('T')[0]);

    if (appointmentError) throw appointmentError;

    for (const appointment of upcomingAppointments || []) {
      if (appointment.doctor_id) {
        await notifyDoctorAppointmentEvent(appointment.doctor_id, 'appointment_reminder', {
          patientName: appointment.patient?.full_name || 'Unknown',
          time: appointment.appointment_time,
          appointmentId: appointment.id
        });
        processed++;
      }
    }

    return { success: true, processed };
  } catch (error) {
    console.error('Error processing doctor notifications:', error);
    return { success: false, error: error.message };
  }
};

// Process staff-specific notifications
const processStaffNotifications = async () => {
  try {
    let processed = 0;

    // Check for patients in queue needing attention
    const { data: queueItems, error: queueError } = await supabase
      .from('queue')
      .select(`
        id, queue_number, created_at,
        patient:profiles!patient_id(full_name, id)
      `)
      .eq('status', 'waiting')
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // Last 30 minutes

    if (queueError) throw queueError;

    // Get all staff members
    const { data: staff, error: staffError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'staff')
      .neq('disabled', true);

    if (staffError) throw staffError;

    for (const queueItem of queueItems || []) {
      // Notify all staff about patient check-in
      for (const staffMember of staff || []) {
        await notifyStaffTask(staffMember.id, 'new_patient_checkin', {
          patientName: queueItem.patient?.full_name || 'Unknown',
          queueNumber: queueItem.queue_number,
          queueId: queueItem.id
        });
        processed++;
      }
    }

    return { success: true, processed };
  } catch (error) {
    console.error('Error processing staff notifications:', error);
    return { success: false, error: error.message };
  }
};

// Process patient-specific notifications  
const processPatientNotifications = async () => {
  try {
    let processed = 0;

    // Check for patients who haven't had checkups in 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: patientsNeedingCheckup, error: checkupError } = await supabase
      .from('profiles')
      .select(`
        id, full_name,
        last_appointment:appointments(appointment_date)
      `)
      .eq('role', 'patient')
      .neq('disabled', true);

    if (checkupError) throw checkupError;

    for (const patient of patientsNeedingCheckup || []) {
      const lastAppointment = patient.last_appointment?.[0]?.appointment_date;
      if (!lastAppointment || new Date(lastAppointment) < sixMonthsAgo) {
        await notifyPatientEvent(patient.id, 'dental_checkup_due', {
          lastCheckup: lastAppointment || 'Never'
        });
        processed++;
      }
    }

    return { success: true, processed };
  } catch (error) {
    console.error('Error processing patient notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * TESTING FUNCTIONS FOR ALL ROLES
 */

// Send test notifications to all roles
export const sendTestNotificationsToAllRoles = async () => {
  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .neq('disabled', true)
      .limit(10); // Limit for testing

    if (error) throw error;

    const results = [];

    for (const user of users) {
      let testEvent, testData;

      switch (user.role) {
        case 'admin':
          testEvent = 'daily_summary';
          testData = { appointments: 12, payments: 8, newPatients: 3 };
          break;
        case 'doctor':
          testEvent = 'appointment_reminder';
          testData = { patientName: 'Test Patient', time: '10:00 AM' };
          break;
        case 'staff':
          testEvent = 'new_patient_checkin';
          testData = { patientName: 'Test Patient', queueNumber: '42' };
          break;
        case 'patient':
          testEvent = 'welcome';
          testData = {};
          break;
        default:
          continue;
      }

      const result = await sendRoleBasedNotification(user.id, testEvent, testData);
      results.push({ userId: user.id, role: user.role, result });
    }

    return { success: true, results };
  } catch (error) {
    console.error('Error sending test notifications:', error);
    return { success: false, error: error.message };
  }
};

// Export all functions for use
export default {
  // Admin functions
  notifyAdminsSystemEvent,
  
  // Doctor functions
  notifyDoctorAppointmentEvent,
  notifyAllDoctors,
  
  // Staff functions
  notifyStaffTask,
  notifyAllStaff,
  
  // Patient functions
  notifyPatientEvent,
  
  // General functions
  sendRoleBasedNotification,
  processRoleBasedNotifications,
  sendTestNotificationsToAllRoles
};