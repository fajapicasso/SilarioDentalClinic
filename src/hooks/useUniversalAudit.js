// src/hooks/useUniversalAudit.js - Universal Audit Logging Hook for All User Types
import { useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import auditLogService from '../services/auditLogService';

export const useUniversalAudit = () => {
  const { user, userRole } = useAuth();
  const recentLogs = useRef(new Map()); // Track recent logs to prevent duplicates

  /**
   * Check if a log entry is a duplicate within the last 5 seconds
   */
  const isDuplicate = useCallback((action, module, section, resourceName, userId) => {
    const now = Date.now();
    const key = `${userId}-${action}-${module}-${section}-${resourceName}`;
    const lastLogTime = recentLogs.current.get(key);
    
    if (lastLogTime && (now - lastLogTime) < 5000) { // 5 seconds deduplication window
      return true;
    }
    
    recentLogs.current.set(key, now);
    
    // Clean up old entries (older than 1 minute)
    for (const [logKey, timestamp] of recentLogs.current.entries()) {
      if (now - timestamp > 60000) {
        recentLogs.current.delete(logKey);
      }
    }
    
    return false;
  }, []);

  /**
   * Universal audit logging function for any action by any user type
   */
  const logAction = useCallback(async ({
    action,
    module,
    section = null,
    resourceType = null,
    resourceId = null,
    resourceName = null,
    oldValues = null,
    newValues = null,
    success = true,
    errorMessage = null,
    metadata = null,
    userType = null // Override user type if needed
  }) => {
    try {
      const userId = user?.id;
      
      // Check for duplicates (especially for page views and settings views)
      if (isDuplicate(action, module, section, resourceName, userId)) {
        console.log(`🔄 Skipping duplicate audit log: ${action} - ${module} - ${resourceName}`);
        return { success: true, skipped: true };
      }

      const auditData = {
        action,
        module,
        section,
        resourceType,
        resourceId,
        resourceName,
        oldValues,
        newValues,
        success,
        errorMessage,
        metadata: {
          ...metadata,
          userType: userType || userRole,
          userId: user?.id,
          userName: user?.email || user?.full_name || 'Unknown User',
          timestamp: new Date().toISOString(),
          ipAddress: metadata?.ipAddress || 'Unknown',
          userAgent: metadata?.userAgent || 'Unknown',
          location: metadata?.location || null
        }
      };

      const result = await auditLogService.logEvent(auditData);
      return result;
    } catch (error) {
      console.error('Error logging audit action:', error);
      return { success: false, error: error.message };
    }
  }, [user, userRole, isDuplicate]);

  /**
   * PAGE NAVIGATION AUDIT LOGGING
   */
  const logPageView = useCallback(async (pageName, module, section = null, metadata = null) => {
    // Enhanced deduplication for page views
    const userId = user?.id;
    const key = `page_view-${userId}-${pageName}-${module}`;
    const now = Date.now();
    const lastPageView = recentLogs.current.get(key);
    
    if (lastPageView && (now - lastPageView) < 10000) { // 10 seconds for page views
      console.log(`🔄 Skipping duplicate page view: ${pageName}`);
      return { success: true, skipped: true };
    }
    
    recentLogs.current.set(key, now);
    
    return await logAction({
      action: 'page_view',
      module,
      section,
      resourceType: 'page',
      resourceName: pageName,
      metadata: {
        ...metadata,
        pageName,
        timestamp: new Date().toISOString()
      }
    });
  }, [logAction, user]);

  /**
   * USER AUTHENTICATION AUDIT LOGGING
   */
  const logLogin = useCallback(async (userData, success = true, errorMessage = null) => {
    return await logAction({
      action: 'user_login',
      module: 'authentication',
      section: 'login',
      resourceType: 'user',
      resourceId: userData?.id,
      resourceName: userData?.email || userData?.full_name,
      success,
      errorMessage,
      metadata: {
        userRole: userData?.role,
        email: userData?.email,
        loginMethod: 'email_password'
      }
    });
  }, [logAction]);

  const logLogout = useCallback(async (userData) => {
    return await logAction({
      action: 'user_logout',
      module: 'authentication',
      section: 'logout',
      resourceType: 'user',
      resourceId: userData?.id,
      resourceName: userData?.email || userData?.full_name,
      metadata: {
        userRole: userData?.role,
        email: userData?.email
      }
    });
  }, [logAction]);

  const logPasswordChange = useCallback(async (userData) => {
    return await logAction({
      action: 'password_change',
      module: 'security',
      section: 'authentication',
      resourceType: 'user',
      resourceId: userData?.id,
      resourceName: userData?.email || userData?.full_name,
      metadata: {
        userRole: userData?.role,
        email: userData?.email
      }
    });
  }, [logAction]);

  /**
   * PROFILE MANAGEMENT AUDIT LOGGING
   */
  const logProfileUpdate = useCallback(async (userData, oldValues, newValues) => {
    return await logAction({
      action: 'profile_update',
      module: 'user_management',
      section: 'profile',
      resourceType: 'user',
      resourceId: userData?.id,
      resourceName: userData?.email || userData?.full_name,
      oldValues,
      newValues,
      metadata: {
        userRole: userData?.role,
        email: userData?.email
      }
    });
  }, [logAction]);

  const logProfilePictureUpdate = useCallback(async (userData, action) => {
    return await logAction({
      action: `profile_picture_${action}`,
      module: 'user_management',
      section: 'profile',
      resourceType: 'user',
      resourceId: userData?.id,
      resourceName: userData?.email || userData?.full_name,
      metadata: {
        userRole: userData?.role,
        email: userData?.email,
        action: action // 'upload', 'remove', 'change'
      }
    });
  }, [logAction]);

  /**
   * APPOINTMENT AUDIT LOGGING
   */
  const logAppointmentView = useCallback(async (appointmentData) => {
    return await logAction({
      action: 'appointment_view',
      module: 'appointments',
      section: 'viewing',
      resourceType: 'appointment',
      resourceId: appointmentData?.id,
      resourceName: `Appointment #${appointmentData?.id}`,
      metadata: {
        appointmentId: appointmentData?.id,
        patientId: appointmentData?.patient_id,
        doctorId: appointmentData?.doctor_id,
        appointmentDate: appointmentData?.appointment_date,
        status: appointmentData?.status
      }
    });
  }, [logAction]);

  const logAppointmentCreate = useCallback(async (appointmentData) => {
    return await logAction({
      action: 'appointment_create',
      module: 'appointments',
      section: 'scheduling',
      resourceType: 'appointment',
      resourceId: appointmentData?.id,
      resourceName: `Appointment #${appointmentData?.id}`,
      newValues: appointmentData,
      metadata: {
        appointmentId: appointmentData?.id,
        patientId: appointmentData?.patient_id,
        doctorId: appointmentData?.doctor_id,
        appointmentDate: appointmentData?.appointment_date,
        status: appointmentData?.status
      }
    });
  }, [logAction]);

  const logAppointmentUpdate = useCallback(async (appointmentData, oldValues, newValues) => {
    return await logAction({
      action: 'appointment_update',
      module: 'appointments',
      section: 'modification',
      resourceType: 'appointment',
      resourceId: appointmentData?.id,
      resourceName: `Appointment #${appointmentData?.id}`,
      oldValues,
      newValues,
      metadata: {
        appointmentId: appointmentData?.id,
        patientId: appointmentData?.patient_id,
        doctorId: appointmentData?.doctor_id,
        appointmentDate: appointmentData?.appointment_date,
        status: appointmentData?.status
      }
    });
  }, [logAction]);

  const logAppointmentCancel = useCallback(async (appointmentData) => {
    return await logAction({
      action: 'appointment_cancel',
      module: 'appointments',
      section: 'cancellation',
      resourceType: 'appointment',
      resourceId: appointmentData?.id,
      resourceName: `Appointment #${appointmentData?.id}`,
      metadata: {
        appointmentId: appointmentData?.id,
        patientId: appointmentData?.patient_id,
        doctorId: appointmentData?.doctor_id,
        appointmentDate: appointmentData?.appointment_date,
        reason: appointmentData?.cancellation_reason
      }
    });
  }, [logAction]);

  /**
   * BILLING & PAYMENT AUDIT LOGGING
   */
  const logBillingView = useCallback(async (billingData) => {
    return await logAction({
      action: 'billing_view',
      module: 'billing',
      section: 'viewing',
      resourceType: 'billing',
      resourceId: billingData?.id,
      resourceName: `Invoice #${billingData?.id}`,
      metadata: {
        invoiceId: billingData?.id,
        patientId: billingData?.patient_id,
        amount: billingData?.total_amount,
        status: billingData?.status
      }
    });
  }, [logAction]);

  const logPaymentCreate = useCallback(async (paymentData) => {
    return await logAction({
      action: 'payment_create',
      module: 'billing',
      section: 'payment',
      resourceType: 'payment',
      resourceId: paymentData?.id,
      resourceName: `Payment #${paymentData?.id}`,
      newValues: paymentData,
      metadata: {
        paymentId: paymentData?.id,
        invoiceId: paymentData?.invoice_id,
        patientId: paymentData?.patient_id,
        amount: paymentData?.amount,
        paymentMethod: paymentData?.payment_method,
        status: paymentData?.status
      }
    });
  }, [logAction]);

  const logPaymentUpdate = useCallback(async (paymentData, oldValues, newValues) => {
    return await logAction({
      action: 'payment_update',
      module: 'billing',
      section: 'payment',
      resourceType: 'payment',
      resourceId: paymentData?.id,
      resourceName: `Payment #${paymentData?.id}`,
      oldValues,
      newValues,
      metadata: {
        paymentId: paymentData?.id,
        invoiceId: paymentData?.invoice_id,
        patientId: paymentData?.patient_id,
        amount: paymentData?.amount,
        paymentMethod: paymentData?.payment_method,
        status: paymentData?.status
      }
    });
  }, [logAction]);

  /**
   * MEDICAL RECORDS AUDIT LOGGING
   */
  const logMedicalRecordView = useCallback(async (recordData) => {
    return await logAction({
      action: 'medical_record_view',
      module: 'medical_records',
      section: 'viewing',
      resourceType: 'medical_record',
      resourceId: recordData?.id,
      resourceName: `Medical Record #${recordData?.id}`,
      metadata: {
        recordId: recordData?.id,
        patientId: recordData?.patient_id,
        doctorId: recordData?.doctor_id,
        recordType: recordData?.record_type
      }
    });
  }, [logAction]);

  const logMedicalRecordUpdate = useCallback(async (recordData, oldValues, newValues) => {
    return await logAction({
      action: 'medical_record_update',
      module: 'medical_records',
      section: 'modification',
      resourceType: 'medical_record',
      resourceId: recordData?.id,
      resourceName: `Medical Record #${recordData?.id}`,
      oldValues,
      newValues,
      metadata: {
        recordId: recordData?.id,
        patientId: recordData?.patient_id,
        doctorId: recordData?.doctor_id,
        recordType: recordData?.record_type
      }
    });
  }, [logAction]);

  const logTreatmentAdd = useCallback(async (treatmentData) => {
    return await logAction({
      action: 'treatment_add',
      module: 'medical_records',
      section: 'treatment',
      resourceType: 'treatment',
      resourceId: treatmentData?.id,
      resourceName: `Treatment #${treatmentData?.id}`,
      newValues: treatmentData,
      metadata: {
        treatmentId: treatmentData?.id,
        patientId: treatmentData?.patient_id,
        doctorId: treatmentData?.doctor_id,
        treatmentType: treatmentData?.treatment_type,
        treatmentDate: treatmentData?.treatment_date
      }
    });
  }, [logAction]);

  /**
   * QUEUE MANAGEMENT AUDIT LOGGING
   */
  const logQueueView = useCallback(async (queueData) => {
    return await logAction({
      action: 'queue_view',
      module: 'queue',
      section: 'viewing',
      resourceType: 'queue',
      resourceId: queueData?.id,
      resourceName: `Queue #${queueData?.id}`,
      metadata: {
        queueId: queueData?.id,
        patientId: queueData?.patient_id,
        doctorId: queueData?.doctor_id,
        status: queueData?.status,
        position: queueData?.position
      }
    });
  }, [logAction]);

  const logQueueAdd = useCallback(async (queueData) => {
    return await logAction({
      action: 'queue_add',
      module: 'queue',
      section: 'addition',
      resourceType: 'queue',
      resourceId: queueData?.id,
      resourceName: `Queue #${queueData?.id}`,
      newValues: queueData,
      metadata: {
        queueId: queueData?.id,
        patientId: queueData?.patient_id,
        doctorId: queueData?.doctor_id,
        status: queueData?.status,
        position: queueData?.position
      }
    });
  }, [logAction]);

  const logQueueStatusUpdate = useCallback(async (queueData, oldStatus, newStatus) => {
    return await logAction({
      action: 'queue_status_update',
      module: 'queue',
      section: 'status_change',
      resourceType: 'queue',
      resourceId: queueData?.id,
      resourceName: `Queue #${queueData?.id}`,
      oldValues: { status: oldStatus },
      newValues: { status: newStatus },
      metadata: {
        queueId: queueData?.id,
        patientId: queueData?.patient_id,
        doctorId: queueData?.doctor_id,
        oldStatus,
        newStatus
      }
    });
  }, [logAction]);

  /**
   * USER MANAGEMENT AUDIT LOGGING (Admin/Staff only)
   */
  const logUserCreate = useCallback(async (userData) => {
    return await logAction({
      action: 'user_create',
      module: 'user_management',
      section: 'creation',
      resourceType: 'user',
      resourceId: userData?.id,
      resourceName: userData?.email || userData?.full_name,
      newValues: userData,
      metadata: {
        newUserRole: userData?.role,
        newUserEmail: userData?.email,
        createdBy: user?.id
      }
    });
  }, [logAction, user]);

  const logUserUpdate = useCallback(async (userData, oldValues, newValues) => {
    return await logAction({
      action: 'user_update',
      module: 'user_management',
      section: 'modification',
      resourceType: 'user',
      resourceId: userData?.id,
      resourceName: userData?.email || userData?.full_name,
      oldValues,
      newValues,
      metadata: {
        updatedUserRole: userData?.role,
        updatedUserEmail: userData?.email,
        updatedBy: user?.id
      }
    });
  }, [logAction, user]);

  const logUserDelete = useCallback(async (userData) => {
    return await logAction({
      action: 'user_delete',
      module: 'user_management',
      section: 'deletion',
      resourceType: 'user',
      resourceId: userData?.id,
      resourceName: userData?.email || userData?.full_name,
      metadata: {
        deletedUserRole: userData?.role,
        deletedUserEmail: userData?.email,
        deletedBy: user?.id
      }
    });
  }, [logAction, user]);

  /**
   * SETTINGS AUDIT LOGGING
   */
  const logSettingsView = useCallback(async (settingsType) => {
    // Enhanced deduplication for settings views
    const userId = user?.id;
    const key = `settings_view-${userId}-${settingsType}`;
    const now = Date.now();
    const lastSettingsView = recentLogs.current.get(key);
    
    if (lastSettingsView && (now - lastSettingsView) < 15000) { // 15 seconds for settings views
      console.log(`🔄 Skipping duplicate settings view: ${settingsType}`);
      return { success: true, skipped: true };
    }
    
    recentLogs.current.set(key, now);
    
    return await logAction({
      action: 'settings_view',
      module: 'settings',
      section: 'viewing',
      resourceType: 'settings',
      resourceName: `${settingsType} Settings`,
      metadata: {
        settingsType,
        userRole: userRole
      }
    });
  }, [logAction, userRole, user]);

  const logSettingsUpdate = useCallback(async (settingsType, oldValues, newValues) => {
    return await logAction({
      action: 'settings_update',
      module: 'settings',
      section: 'modification',
      resourceType: 'settings',
      resourceName: `${settingsType} Settings`,
      oldValues,
      newValues,
      metadata: {
        settingsType,
        userRole: userRole
      }
    });
  }, [logAction, userRole]);

  /**
   * SYSTEM AUDIT LOGGING
   */
  const logSystemAction = useCallback(async (action, module, section, resourceName, metadata = null) => {
    return await logAction({
      action,
      module,
      section,
      resourceType: 'system',
      resourceName,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }, [logAction]);

  /**
   * ERROR LOGGING
   */
  const logError = useCallback(async (error, context = {}) => {
    return await logAction({
      action: 'error_occurred',
      module: 'system',
      section: 'errors',
      resourceType: 'error',
      resourceName: error.name || 'Unknown Error',
      success: false,
      errorMessage: error.message,
      metadata: {
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
      }
    });
  }, [logAction]);

  /**
   * CUSTOM EVENT LOGGING
   */
  const logCustomEvent = useCallback(async (action, module, section, resourceType, resourceId, resourceName, oldValues, newValues, metadata) => {
    return await logAction({
      action,
      module,
      section,
      resourceType,
      resourceId,
      resourceName,
      oldValues,
      newValues,
      metadata
    });
  }, [logAction]);

  return {
    // Generic logging
    logAction,
    logPageView,
    logCustomEvent,
    logError,
    
    // Authentication logging
    logLogin,
    logLogout,
    logPasswordChange,
    
    // Profile logging
    logProfileUpdate,
    logProfilePictureUpdate,
    
    // Appointment logging
    logAppointmentView,
    logAppointmentCreate,
    logAppointmentUpdate,
    logAppointmentCancel,
    
    // Billing logging
    logBillingView,
    logPaymentCreate,
    logPaymentUpdate,
    
    // Medical records logging
    logMedicalRecordView,
    logMedicalRecordUpdate,
    logTreatmentAdd,
    
    // Queue logging
    logQueueView,
    logQueueAdd,
    logQueueStatusUpdate,
    
    // User management logging
    logUserCreate,
    logUserUpdate,
    logUserDelete,
    
    // Settings logging
    logSettingsView,
    logSettingsUpdate,
    
    // System logging
    logSystemAction
  };
};

export default useUniversalAudit;
