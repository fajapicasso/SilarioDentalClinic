// src/utils/notificationHelpers.js
import supabase from '../config/supabaseClient';

/**
 * Notification Helper Functions
 * These functions create notifications for common events in the dental clinic system
 */

// Helper function to get all users with a specific role
const getUsersByRole = async (role) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', role)
      .neq('disabled', true);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error(`Error fetching users with role ${role}:`, error);
    return [];
  }
};

// Helper function to create a single notification
const createNotification = async (notificationData) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        recipient_id: notificationData.recipientId,
        sender_id: notificationData.senderId,
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
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error };
  }
};

// Helper function to create bulk notifications
const createBulkNotifications = async (recipients, notificationData) => {
  try {
    const notifications = recipients.map(recipientId => ({
      recipient_id: recipientId,
      sender_id: notificationData.senderId,
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
    return { success: true, data };
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    return { success: false, error };
  }
};

/**
 * APPOINTMENT NOTIFICATIONS
 */

// Notify when appointment is created
export const notifyAppointmentCreated = async (appointmentData, patientData) => {
  const { patientId, appointmentId, date, time, branch, services } = appointmentData;
  
  // Notify the patient
  await createNotification({
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

  // Notify all admins and doctors
  const admins = await getUsersByRole('admin');
  const doctors = await getUsersByRole('doctor');
  const recipients = [...admins, ...doctors].map(user => user.id);

  if (recipients.length > 0) {
    await createBulkNotifications(recipients, {
      title: 'New Appointment Request',
      message: `${patientData.full_name} has requested an appointment for ${date} at ${time} (${branch} branch).`,
      type: 'info',
      category: 'appointment',
      priority: 'normal',
      actionUrl: '/admin/appointments',
      actionLabel: 'Review Request',
      metadata: { appointmentId, patientId, action: 'new_request' }
    });
  }
};

// Notify when appointment is confirmed
export const notifyAppointmentConfirmed = async (appointmentData, patientData, doctorData = null) => {
  const { patientId, appointmentId, date, time, branch } = appointmentData;
  
  await createNotification({
    recipientId: patientId,
    senderId: doctorData?.id,
    title: 'Appointment Confirmed',
    message: `Your appointment on ${date} at ${time} (${branch} branch) has been confirmed.${doctorData ? ` Assigned to Dr. ${doctorData.full_name}.` : ''}`,
    type: 'success',
    category: 'appointment',
    priority: 'high',
    actionUrl: '/patient/appointments',
    actionLabel: 'View Details',
    metadata: { appointmentId, action: 'confirmed' }
  });
};

// Notify when appointment is cancelled
export const notifyAppointmentCancelled = async (appointmentData, patientData, reason = '') => {
  const { patientId, appointmentId, date, time, branch } = appointmentData;
  
  await createNotification({
    recipientId: patientId,
    title: 'Appointment Cancelled',
    message: `Your appointment on ${date} at ${time} (${branch} branch) has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
    type: 'warning',
    category: 'appointment',
    priority: 'high',
    actionUrl: '/patient/appointments',
    actionLabel: 'Book New Appointment',
    metadata: { appointmentId, action: 'cancelled', reason }
  });
};

// Notify appointment reminder
export const notifyAppointmentReminder = async (appointmentData, hours = 24) => {
  const { patientId, appointmentId, date, time, branch, services } = appointmentData;
  
  await createNotification({
    recipientId: patientId,
    title: 'Appointment Reminder',
    message: `Don't forget your appointment ${hours < 24 ? 'today' : 'tomorrow'} at ${time} (${branch} branch).`,
    type: 'info',
    category: 'appointment',
    priority: 'high',
    actionUrl: '/patient/appointments',
    actionLabel: 'View Details',
    metadata: { appointmentId, action: 'reminder', hours },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Expire in 24 hours
  });
};

// Notify when appointment is rescheduled
export const notifyAppointmentRescheduled = async (appointmentData, oldData, patientData) => {
  const { patientId, appointmentId, date, time, branch } = appointmentData;
  
  await createNotification({
    recipientId: patientId,
    title: 'Appointment Rescheduled',
    message: `Your appointment has been rescheduled from ${oldData.date} at ${oldData.time} to ${date} at ${time} (${branch} branch).`,
    type: 'info',
    category: 'appointment',
    priority: 'high',
    actionUrl: '/patient/appointments',
    actionLabel: 'View Details',
    metadata: { appointmentId, action: 'rescheduled', oldDate: oldData.date, oldTime: oldData.time }
  });
};

/**
 * PAYMENT NOTIFICATIONS
 */

// Notify when payment is received
export const notifyPaymentReceived = async (paymentData) => {
  const { patientId, paymentId, invoiceId, amount, method } = paymentData;
  
  await createNotification({
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

  // Notify admins and doctors about new payment
  const admins = await getUsersByRole('admin');
  const doctors = await getUsersByRole('doctor');
  const recipients = [...admins, ...doctors].map(user => user.id);

  if (recipients.length > 0) {
    await createBulkNotifications(recipients, {
      title: 'New Payment Received',
      message: `A payment of ₱${amount.toLocaleString()} has been received and requires review.`,
      type: 'info',
      category: 'payment',
      priority: 'normal',
      actionUrl: '/admin/billing',
      actionLabel: 'Review Payment',
      metadata: { paymentId, invoiceId, patientId, amount, action: 'new_payment' }
    });
  }
};

// Notify when payment is approved
export const notifyPaymentApproved = async (paymentData, approverData) => {
  const { patientId, paymentId, invoiceId, amount } = paymentData;
  
  await createNotification({
    recipientId: patientId,
    senderId: approverData?.id,
    title: 'Payment Approved',
    message: `Your payment of ₱${amount.toLocaleString()} has been approved and processed.`,
    type: 'success',
    category: 'payment',
    priority: 'normal',
    actionUrl: '/patient/payments',
    actionLabel: 'View Payment',
    metadata: { paymentId, invoiceId, amount, action: 'approved' }
  });
};

// Notify when payment is rejected
export const notifyPaymentRejected = async (paymentData, reason = '', rejectorData) => {
  const { patientId, paymentId, invoiceId, amount } = paymentData;
  
  await createNotification({
    recipientId: patientId,
    senderId: rejectorData?.id,
    title: 'Payment Rejected',
    message: `Your payment of ₱${amount.toLocaleString()} has been rejected.${reason ? ` Reason: ${reason}` : ''} Please contact us for more information.`,
    type: 'error',
    category: 'payment',
    priority: 'high',
    actionUrl: '/patient/payments',
    actionLabel: 'View Payment',
    metadata: { paymentId, invoiceId, amount, action: 'rejected', reason }
  });
};

/**
 * QUEUE NOTIFICATIONS
 */

// Notify when patient is added to queue
export const notifyQueueJoined = async (queueData) => {
  const { patientId, queueId, queueNumber, estimatedWaitTime } = queueData;
  
  await createNotification({
    recipientId: patientId,
    title: 'Added to Queue',
    message: `You've been added to the queue. Your number is ${queueNumber}. Estimated wait time: ${estimatedWaitTime} minutes.`,
    type: 'info',
    category: 'queue',
    priority: 'normal',
    actionUrl: '/patient/dashboard',
    actionLabel: 'View Queue Status',
    metadata: { queueId, queueNumber, action: 'joined' }
  });
};

// Notify when patient is next in queue
export const notifyQueueNext = async (queueData) => {
  const { patientId, queueId, queueNumber } = queueData;
  
  await createNotification({
    recipientId: patientId,
    title: 'You\'re Next!',
    message: 'You\'re next in line! Please prepare to be served.',
    type: 'info',
    category: 'queue',
    priority: 'urgent',
    actionUrl: '/patient/dashboard',
    actionLabel: 'View Status',
    metadata: { queueId, queueNumber, action: 'next' },
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // Expire in 30 minutes
  });
};

// Notify when it's patient's turn
export const notifyQueueServing = async (queueData) => {
  const { patientId, queueId, queueNumber } = queueData;
  
  await createNotification({
    recipientId: patientId,
    title: 'Your Turn!',
    message: 'It\'s your turn! Please proceed to the counter.',
    type: 'success',
    category: 'queue',
    priority: 'urgent',
    actionUrl: '/patient/dashboard',
    actionLabel: 'I\'m Here',
    metadata: { queueId, queueNumber, action: 'serving' },
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // Expire in 15 minutes
  });
};

// Notify when queue service is completed
export const notifyQueueCompleted = async (queueData) => {
  const { patientId, queueId, queueNumber } = queueData;
  
  await createNotification({
    recipientId: patientId,
    title: 'Service Completed',
    message: 'Thank you! Your queue service has been completed.',
    type: 'success',
    category: 'queue',
    priority: 'normal',
    actionUrl: '/patient/dashboard',
    actionLabel: 'Rate Experience',
    metadata: { queueId, queueNumber, action: 'completed' }
  });
};

/**
 * SYSTEM NOTIFICATIONS
 */

// Welcome notification for new users
export const notifyWelcomeNewUser = async (userData) => {
  const { userId, fullName, role } = userData;
  
  const roleMessages = {
    patient: 'Welcome to our dental clinic! You can now book appointments, view your dental records, and manage your payments.',
    doctor: 'Welcome to the clinic system! You can now manage appointments, patient records, and billing.',
    staff: 'Welcome to the clinic system! You can now assist with appointments, queue management, and patient services.',
    admin: 'Welcome to the clinic system! You have full administrative access to manage the clinic operations.'
  };

  await createNotification({
    recipientId: userId,
    title: `Welcome to Silario Dental Clinic, ${fullName}!`,
    message: roleMessages[role] || 'Welcome to our system!',
    type: 'info',
    category: 'system',
    priority: 'normal',
    actionUrl: `/${role}/dashboard`,
    actionLabel: 'Get Started',
    metadata: { action: 'welcome', role }
  });
};

// System maintenance notification
export const notifySystemMaintenance = async (maintenanceData) => {
  const { startTime, endTime, description } = maintenanceData;
  
  // Get all active users
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id')
    .neq('disabled', true);

  if (!error && users) {
    const recipients = users.map(user => user.id);
    
    await createBulkNotifications(recipients, {
      title: 'Scheduled System Maintenance',
      message: `The system will be under maintenance from ${startTime} to ${endTime}. ${description}`,
      type: 'warning',
      category: 'system',
      priority: 'high',
      metadata: { action: 'maintenance', startTime, endTime }
    });
  }
};

// Account security notification
export const notifySecurityAlert = async (userId, alertData) => {
  const { action, ipAddress, location, timestamp } = alertData;
  
  await createNotification({
    recipientId: userId,
    title: 'Security Alert',
    message: `Unusual ${action} detected from ${location || 'unknown location'} at ${timestamp}. If this wasn't you, please contact support immediately.`,
    type: 'warning',
    category: 'system',
    priority: 'urgent',
    actionUrl: '/settings/security',
    actionLabel: 'Review Activity',
    metadata: { action: 'security_alert', ipAddress, location, alertType: action }
  });
};

/**
 * BULK NOTIFICATION UTILITIES
 */

// Send notification to all users of specific roles
export const notifyUsersByRole = async (roles, notificationData) => {
  try {
    let allRecipients = [];
    
    for (const role of roles) {
      const users = await getUsersByRole(role);
      allRecipients = [...allRecipients, ...users.map(user => user.id)];
    }
    
    // Remove duplicates
    const uniqueRecipients = [...new Set(allRecipients)];
    
    if (uniqueRecipients.length > 0) {
      return await createBulkNotifications(uniqueRecipients, notificationData);
    }
    
    return { success: true, data: [] };
  } catch (error) {
    console.error('Error sending notifications to roles:', error);
    return { success: false, error };
  }
};

// Send emergency notification to all staff
export const notifyEmergency = async (emergencyData) => {
  const { title, message, location, severity } = emergencyData;
  
  return await notifyUsersByRole(['admin', 'doctor', 'staff'], {
    title: `🚨 EMERGENCY: ${title}`,
    message: `${message}${location ? ` Location: ${location}` : ''}`,
    type: 'error',
    category: 'system',
    priority: 'urgent',
    actionUrl: '/emergency',
    actionLabel: 'Respond',
    metadata: { action: 'emergency', severity, location }
  });
};

// Send announcement to all users
export const notifyAnnouncement = async (announcementData) => {
  const { title, message, targetRoles = ['admin', 'doctor', 'staff', 'patient'], expiresIn = 7 } = announcementData;
  
  const expiresAt = new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString();
  
  return await notifyUsersByRole(targetRoles, {
    title: `📢 ${title}`,
    message: message,
    type: 'info',
    category: 'system',
    priority: 'normal',
    metadata: { action: 'announcement' },
    expiresAt
  });
};