// src/hooks/useComprehensiveAudit.js - Comprehensive Audit Logging Hook
import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import auditLogService from '../services/auditLogService';

export const useComprehensiveAudit = () => {
  const { user, userRole } = useAuth();

  /**
   * Generic audit logging function for any action
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
    metadata = null
  }) => {
    try {
      const result = await auditLogService.logEvent({
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
        metadata
      });
      return result;
    } catch (error) {
      console.error('Error logging audit action:', error);
      return { success: false, error: error.message };
    }
  }, []);

  /**
   * PAGE NAVIGATION AUDIT LOGGING
   */
  const logPageView = useCallback(async (pageName, module, section = null, metadata = null) => {
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
  }, [logAction]);

  /**
   * APPOINTMENT MODULE AUDIT LOGGING
   */
  const logAppointmentView = useCallback(async (appointmentId, patientName, metadata = null) => {
    return await logAction({
      action: 'appointment_view',
      module: 'appointments',
      section: 'viewing',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Appointment for ${patientName}`,
      metadata: {
        ...metadata,
        patientName,
        appointmentId
      }
    });
  }, [logAction]);

  const logAppointmentCreate = useCallback(async (appointmentData) => {
    return await logAction({
      action: 'appointment_create',
      module: 'appointments',
      section: 'scheduling',
      resourceType: 'appointment',
      resourceId: appointmentData.id,
      resourceName: `Appointment for ${appointmentData.patient_name}`,
      newValues: appointmentData,
      metadata: {
        patientId: appointmentData.patient_id,
        doctorId: appointmentData.doctor_id,
        branch: appointmentData.branch,
        appointmentType: appointmentData.appointment_type
      }
    });
  }, [logAction]);

  const logAppointmentUpdate = useCallback(async (appointmentId, oldData, newData) => {
    return await logAction({
      action: 'appointment_update',
      module: 'appointments',
      section: 'scheduling',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Appointment for ${newData.patient_name || oldData.patient_name}`,
      oldValues: oldData,
      newValues: newData,
      metadata: {
        changedFields: Object.keys(newData).filter(key => oldData[key] !== newData[key]),
        patientId: newData.patient_id || oldData.patient_id
      }
    });
  }, [logAction]);

  const logAppointmentStatusChange = useCallback(async (appointmentId, oldStatus, newStatus, patientName, reason = null) => {
    return await logAction({
      action: 'appointment_status_change',
      module: 'appointments',
      section: 'status_management',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Appointment for ${patientName}`,
      oldValues: { status: oldStatus },
      newValues: { status: newStatus },
      metadata: {
        statusChangeReason: reason,
        patientName,
        appointmentId
      }
    });
  }, [logAction]);

  /**
   * BILLING MODULE AUDIT LOGGING
   */
  const logBillingView = useCallback(async (billingId, patientName, metadata = null) => {
    return await logAction({
      action: 'billing_view',
      module: 'billing',
      section: 'viewing',
      resourceType: 'billing',
      resourceId: billingId,
      resourceName: `Billing for ${patientName}`,
      metadata: {
        ...metadata,
        patientName,
        billingId
      }
    });
  }, [logAction]);

  const logInvoiceCreate = useCallback(async (invoiceData) => {
    return await logAction({
      action: 'invoice_create',
      module: 'billing',
      section: 'invoice_management',
      resourceType: 'invoice',
      resourceId: invoiceData.id,
      resourceName: `Invoice #${invoiceData.invoice_number}`,
      newValues: invoiceData,
      metadata: {
        patientId: invoiceData.patient_id,
        totalAmount: invoiceData.total_amount,
        invoiceNumber: invoiceData.invoice_number
      }
    });
  }, [logAction]);

  const logPaymentCreate = useCallback(async (paymentData) => {
    return await logAction({
      action: 'payment_create',
      module: 'billing',
      section: 'payment_processing',
      resourceType: 'payment',
      resourceId: paymentData.id,
      resourceName: `Payment of ₱${paymentData.amount}`,
      newValues: paymentData,
      metadata: {
        patientId: paymentData.patient_id,
        invoiceId: paymentData.invoice_id,
        paymentMethod: paymentData.payment_method,
        amount: paymentData.amount
      }
    });
  }, [logAction]);

  const logPaymentUpdate = useCallback(async (paymentId, oldData, newData) => {
    return await logAction({
      action: 'payment_update',
      module: 'billing',
      section: 'payment_processing',
      resourceType: 'payment',
      resourceId: paymentId,
      resourceName: `Payment of ₱${newData.amount || oldData.amount}`,
      oldValues: oldData,
      newValues: newData,
      metadata: {
        changedFields: Object.keys(newData).filter(key => oldData[key] !== newData[key]),
        patientId: newData.patient_id || oldData.patient_id
      }
    });
  }, [logAction]);

  /**
   * QUEUE MANAGEMENT AUDIT LOGGING
   */
  const logQueueView = useCallback(async (queueId, patientName, metadata = null) => {
    return await logAction({
      action: 'queue_view',
      module: 'queue',
      section: 'viewing',
      resourceType: 'queue',
      resourceId: queueId,
      resourceName: `Queue entry for ${patientName}`,
      metadata: {
        ...metadata,
        patientName,
        queueId
      }
    });
  }, [logAction]);

  const logQueueAdd = useCallback(async (queueData) => {
    return await logAction({
      action: 'queue_add',
      module: 'queue',
      section: 'management',
      resourceType: 'queue',
      resourceId: queueData.id,
      resourceName: `Queue entry for ${queueData.patient_name}`,
      newValues: queueData,
      metadata: {
        patientId: queueData.patient_id,
        doctorId: queueData.doctor_id,
        branch: queueData.branch,
        priority: queueData.priority
      }
    });
  }, [logAction]);

  const logQueueStatusUpdate = useCallback(async (queueId, oldStatus, newStatus, patientName) => {
    return await logAction({
      action: 'queue_status_update',
      module: 'queue',
      section: 'status_management',
      resourceType: 'queue',
      resourceId: queueId,
      resourceName: `Queue entry for ${patientName}`,
      oldValues: { status: oldStatus },
      newValues: { status: newStatus },
      metadata: {
        patientName,
        queueId,
        statusChange: `${oldStatus} → ${newStatus}`
      }
    });
  }, [logAction]);

  /**
   * MEDICAL RECORDS AUDIT LOGGING
   */
  const logMedicalRecordView = useCallback(async (patientId, patientName, metadata = null) => {
    return await logAction({
      action: 'medical_record_view',
      module: 'medical_records',
      section: 'viewing',
      resourceType: 'medical_record',
      resourceId: patientId,
      resourceName: `Medical record for ${patientName}`,
      metadata: {
        ...metadata,
        patientName,
        patientId
      }
    });
  }, [logAction]);

  const logMedicalRecordUpdate = useCallback(async (patientId, oldData, newData) => {
    return await logAction({
      action: 'medical_record_update',
      module: 'medical_records',
      section: 'record_management',
      resourceType: 'medical_record',
      resourceId: patientId,
      resourceName: `Medical record for ${newData.patient_name || oldData.patient_name}`,
      oldValues: oldData,
      newValues: newData,
      metadata: {
        changedFields: Object.keys(newData).filter(key => oldData[key] !== newData[key]),
        patientId
      }
    });
  }, [logAction]);

  const logTreatmentAdd = useCallback(async (patientId, treatmentData) => {
    return await logAction({
      action: 'treatment_add',
      module: 'medical_records',
      section: 'treatment_management',
      resourceType: 'treatment',
      resourceId: patientId,
      resourceName: `Treatment: ${treatmentData.treatment_name}`,
      newValues: treatmentData,
      metadata: {
        patientId,
        doctorId: treatmentData.doctor_id,
        appointmentId: treatmentData.appointment_id,
        treatmentName: treatmentData.treatment_name
      }
    });
  }, [logAction]);

  /**
   * USER MANAGEMENT AUDIT LOGGING
   */
  const logUserView = useCallback(async (userId, userName, metadata = null) => {
    return await logAction({
      action: 'user_view',
      module: 'user_management',
      section: 'viewing',
      resourceType: 'user',
      resourceId: userId,
      resourceName: userName,
      metadata: {
        ...metadata,
        userName,
        userId
      }
    });
  }, [logAction]);

  const logUserCreate = useCallback(async (userData) => {
    return await logAction({
      action: 'user_create',
      module: 'user_management',
      section: 'user_management',
      resourceType: 'user',
      resourceId: userData.id,
      resourceName: userData.full_name || userData.email,
      newValues: userData,
      metadata: {
        userRole: userData.role,
        email: userData.email
      }
    });
  }, [logAction]);

  const logUserUpdate = useCallback(async (userId, oldData, newData) => {
    return await logAction({
      action: 'user_update',
      module: 'user_management',
      section: 'user_management',
      resourceType: 'user',
      resourceId: userId,
      resourceName: newData.full_name || oldData.full_name,
      oldValues: oldData,
      newValues: newData,
      metadata: {
        changedFields: Object.keys(newData).filter(key => oldData[key] !== newData[key]),
        userRole: newData.role || oldData.role
      }
    });
  }, [logAction]);

  const logUserApproval = useCallback(async (userId, userData) => {
    return await logAction({
      action: 'user_approve',
      module: 'user_management',
      section: 'user_approval',
      resourceType: 'user',
      resourceId: userId,
      resourceName: userData.full_name || userData.email,
      newValues: { disabled: false },
      metadata: {
        userRole: userData.role,
        email: userData.email
      }
    });
  }, [logAction]);

  /**
   * ADMIN DASHBOARD AUDIT LOGGING
   */
  const logDashboardView = useCallback(async (dashboardSection, metadata = null) => {
    return await logAction({
      action: 'dashboard_view',
      module: 'admin',
      section: 'dashboard',
      resourceType: 'dashboard',
      resourceName: `Dashboard - ${dashboardSection}`,
      metadata: {
        ...metadata,
        dashboardSection,
        timestamp: new Date().toISOString()
      }
    });
  }, [logAction]);

  const logSettingsView = useCallback(async (settingsSection, metadata = null) => {
    return await logAction({
      action: 'settings_view',
      module: 'admin',
      section: 'settings',
      resourceType: 'settings',
      resourceName: `Settings - ${settingsSection}`,
      metadata: {
        ...metadata,
        settingsSection,
        timestamp: new Date().toISOString()
      }
    });
  }, [logAction]);

  const logSettingsUpdate = useCallback(async (settingKey, oldValue, newValue) => {
    return await logAction({
      action: 'settings_update',
      module: 'admin',
      section: 'settings',
      resourceType: 'settings',
      resourceName: `Setting: ${settingKey}`,
      oldValues: { value: oldValue },
      newValues: { value: newValue },
      metadata: {
        settingKey,
        valueChange: `${oldValue} → ${newValue}`
      }
    });
  }, [logAction]);

  /**
   * SECURITY AUDIT LOGGING
   */
  const logLogin = useCallback(async (userData, success = true, errorMessage = null) => {
    return await logAction({
      action: 'user_login',
      module: 'security',
      section: 'authentication',
      resourceType: 'user',
      resourceId: userData.id,
      resourceName: userData.full_name || userData.email,
      success,
      errorMessage,
      metadata: {
        userRole: userData.role,
        email: userData.email,
        loginMethod: 'password'
      }
    });
  }, [logAction]);

  const logLogout = useCallback(async (userData) => {
    return await logAction({
      action: 'user_logout',
      module: 'security',
      section: 'authentication',
      resourceType: 'user',
      resourceId: userData.id,
      resourceName: userData.full_name || userData.email,
      metadata: {
        userRole: userData.role,
        email: userData.email
      }
    });
  }, [logAction]);

  const logPasswordChange = useCallback(async (userData) => {
    return await logAction({
      action: 'password_change',
      module: 'security',
      section: 'authentication',
      resourceType: 'user',
      resourceId: userData.id,
      resourceName: userData.full_name || userData.email,
      metadata: {
        userRole: userData.role,
        email: userData.email
      }
    });
  }, [logAction]);

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

  return {
    // Generic logging
    logAction,
    logPageView,
    
    // Appointment logging
    logAppointmentView,
    logAppointmentCreate,
    logAppointmentUpdate,
    logAppointmentStatusChange,
    
    // Billing logging
    logBillingView,
    logInvoiceCreate,
    logPaymentCreate,
    logPaymentUpdate,
    
    // Queue logging
    logQueueView,
    logQueueAdd,
    logQueueStatusUpdate,
    
    // Medical records logging
    logMedicalRecordView,
    logMedicalRecordUpdate,
    logTreatmentAdd,
    
    // User management logging
    logUserView,
    logUserCreate,
    logUserUpdate,
    logUserApproval,
    
    // Admin logging
    logDashboardView,
    logSettingsView,
    logSettingsUpdate,
    
    // Security logging
    logLogin,
    logLogout,
    logPasswordChange,
    
    // System logging
    logSystemAction
  };
};

export default useComprehensiveAudit;
