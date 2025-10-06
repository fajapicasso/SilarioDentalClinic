// src/hooks/useAuditLog.js - React Hook for Audit Logging
import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import auditLogService from '../services/auditLogService';
import auditMiddleware from '../utils/auditMiddleware';

export const useAuditLog = () => {
  const { user, userRole } = useAuth();

  /**
   * Generic audit logging function
   */
  const logEvent = useCallback(async (auditData) => {
    try {
      const result = await auditLogService.logEvent(auditData);
      return result;
    } catch (error) {
      console.error('Error logging audit event:', error);
      return { success: false, error: error.message };
    }
  }, []);

  /**
   * USER MANAGEMENT AUDIT LOGGING
   */

  const logUserCreate = useCallback(async (userData) => {
    return await auditMiddleware.logUserCreate(userData);
  }, []);

  const logUserUpdate = useCallback(async (userId, oldData, newData) => {
    return await auditMiddleware.logUserUpdate(userId, oldData, newData);
  }, []);

  const logUserDelete = useCallback(async (userId, userData) => {
    return await auditMiddleware.logUserDelete(userId, userData);
  }, []);

  const logUserApproval = useCallback(async (userId, userData) => {
    return await auditMiddleware.logUserApproval(userId, userData);
  }, []);

  const logUserLogin = useCallback(async (userId, userData, success = true, errorMessage = null) => {
    return await auditMiddleware.logUserLogin(userId, userData, success, errorMessage);
  }, []);

  const logPasswordChange = useCallback(async (userId, userData) => {
    return await auditMiddleware.logPasswordChange(userId, userData);
  }, []);

  /**
   * APPOINTMENT AUDIT LOGGING
   */

  const logAppointmentCreate = useCallback(async (appointmentData) => {
    return await auditMiddleware.logAppointmentCreate(appointmentData);
  }, []);

  const logAppointmentUpdate = useCallback(async (appointmentId, oldData, newData) => {
    return await auditMiddleware.logAppointmentUpdate(appointmentId, oldData, newData);
  }, []);

  const logAppointmentCancel = useCallback(async (appointmentId, appointmentData, reason = null) => {
    return await auditMiddleware.logAppointmentCancel(appointmentId, appointmentData, reason);
  }, []);

  const logAppointmentReschedule = useCallback(async (appointmentId, oldData, newData) => {
    return await logEvent({
      action: 'appointment_reschedule',
      module: 'appointments',
      section: 'scheduling',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Appointment for ${newData.patient_name || oldData.patient_name}`,
      oldValues: {
        appointment_date: oldData.appointment_date,
        appointment_time: oldData.appointment_time
      },
      newValues: {
        appointment_date: newData.appointment_date,
        appointment_time: newData.appointment_time
      },
      metadata: {
        patientId: newData.patient_id || oldData.patient_id,
        doctorId: newData.doctor_id || oldData.doctor_id,
        branch: newData.branch || oldData.branch
      }
    });
  }, [logEvent]);

  /**
   * PAYMENT AUDIT LOGGING
   */

  const logPaymentCreate = useCallback(async (paymentData) => {
    return await auditMiddleware.logPaymentCreate(paymentData);
  }, []);

  const logPaymentUpdate = useCallback(async (paymentId, oldData, newData) => {
    return await auditMiddleware.logPaymentUpdate(paymentId, oldData, newData);
  }, []);

  const logPaymentApproval = useCallback(async (paymentId, paymentData) => {
    return await auditMiddleware.logPaymentApproval(paymentId, paymentData);
  }, []);

  const logPaymentRejection = useCallback(async (paymentId, paymentData, reason = null) => {
    return await logEvent({
      action: 'payment_reject',
      module: 'payments',
      section: 'billing',
      resourceType: 'payment',
      resourceId: paymentId,
      resourceName: `Payment of ₱${paymentData.amount}`,
      oldValues: { approval_status: paymentData.approval_status },
      newValues: { approval_status: 'rejected' },
      metadata: {
        reason,
        patientId: paymentData.patient_id,
        invoiceId: paymentData.invoice_id,
        amount: paymentData.amount
      }
    });
  }, [logEvent]);

  const logPaymentRefund = useCallback(async (paymentId, paymentData, refundAmount, reason = null) => {
    return await logEvent({
      action: 'payment_refund',
      module: 'payments',
      section: 'billing',
      resourceType: 'payment',
      resourceId: paymentId,
      resourceName: `Refund of ₱${refundAmount}`,
      oldValues: { 
        amount: paymentData.amount,
        status: paymentData.status 
      },
      newValues: { 
        refund_amount: refundAmount,
        status: 'refunded' 
      },
      metadata: {
        reason,
        patientId: paymentData.patient_id,
        invoiceId: paymentData.invoice_id,
        originalAmount: paymentData.amount
      }
    });
  }, [logEvent]);

  /**
   * SERVICE AUDIT LOGGING
   */

  const logServiceCreate = useCallback(async (serviceData) => {
    return await auditMiddleware.logServiceCreate(serviceData);
  }, []);

  const logServiceUpdate = useCallback(async (serviceId, oldData, newData) => {
    return await auditMiddleware.logServiceUpdate(serviceId, oldData, newData);
  }, []);

  const logServiceDelete = useCallback(async (serviceId, serviceData) => {
    return await auditMiddleware.logServiceDelete(serviceId, serviceData);
  }, []);

  const logServicePricingUpdate = useCallback(async (serviceId, oldPrice, newPrice) => {
    return await logEvent({
      action: 'service_pricing_update',
      module: 'services',
      section: 'pricing',
      resourceType: 'service',
      resourceId: serviceId,
      oldValues: { price: oldPrice },
      newValues: { price: newPrice },
      metadata: {
        priceChange: newPrice - oldPrice,
        percentageChange: ((newPrice - oldPrice) / oldPrice * 100).toFixed(2)
      }
    });
  }, [logEvent]);

  /**
   * MEDICAL RECORD AUDIT LOGGING
   */

  const logMedicalRecordUpdate = useCallback(async (patientId, oldData, newData) => {
    return await auditMiddleware.logMedicalRecordUpdate(patientId, oldData, newData);
  }, []);

  const logTreatmentAdd = useCallback(async (patientId, treatmentData) => {
    return await auditMiddleware.logTreatmentAdd(patientId, treatmentData);
  }, []);

  const logTreatmentCreate = useCallback(async (treatmentData) => {
    return await logEvent({
      action: 'treatment_create',
      module: 'medical_records',
      section: 'treatments',
      resourceType: 'treatment',
      resourceId: treatmentData.treatment_id,
      resourceName: `Treatment for ${treatmentData.patient_name}`,
      newValues: treatmentData,
      metadata: {
        patient_id: treatmentData.patient_id,
        doctor_id: treatmentData.doctor_id,
        procedure: treatmentData.procedure,
        tooth_number: treatmentData.tooth_number,
        diagnosis: treatmentData.diagnosis,
        treatment_date: treatmentData.treatment_date
      }
    });
  }, []);

  const logTreatmentUpdate = useCallback(async (treatmentId, treatmentData) => {
    return await logEvent({
      action: 'treatment_update',
      module: 'medical_records',
      section: 'treatments',
      resourceType: 'treatment',
      resourceId: treatmentId,
      resourceName: `Treatment for ${treatmentData.patient_name}`,
      newValues: treatmentData,
      metadata: {
        patient_id: treatmentData.patient_id,
        doctor_id: treatmentData.doctor_id,
        procedure: treatmentData.procedure,
        tooth_number: treatmentData.tooth_number,
        diagnosis: treatmentData.diagnosis,
        treatment_date: treatmentData.treatment_date
      }
    });
  }, [logEvent]);

  const logPatientView = useCallback(async (patientData) => {
    return await logEvent({
      action: 'patient_view',
      module: 'medical_records',
      section: 'patient_records',
      resourceType: 'patient',
      resourceId: patientData.patient_id,
      resourceName: `Patient: ${patientData.patient_name}`,
      metadata: {
        patient_id: patientData.patient_id,
        patient_name: patientData.patient_name,
        doctor_id: patientData.doctor_id,
        action: patientData.action
      }
    });
  }, []);

  const logBracesAdjustment = useCallback(async (adjustmentData) => {
    return await logEvent({
      action: 'braces_adjustment',
      module: 'medical_records',
      section: 'braces_treatment',
      resourceType: 'braces_adjustment',
      resourceId: adjustmentData.adjustment_id,
      resourceName: `Braces Adjustment: ${adjustmentData.adjustment_type}`,
      newValues: adjustmentData,
      metadata: {
        patient_id: adjustmentData.patient_id,
        doctor_id: adjustmentData.doctor_id,
        adjustment_type: adjustmentData.adjustment_type,
        teeth_involved: adjustmentData.teeth_involved,
        adjustment_date: adjustmentData.adjustment_date
      }
    });
  }, []);

  const logBracesPlan = useCallback(async (planData) => {
    return await logEvent({
      action: 'braces_plan',
      module: 'medical_records',
      section: 'braces_treatment',
      resourceType: 'braces_plan',
      resourceId: planData.plan_id,
      resourceName: `Braces Plan for Tooth ${planData.tooth_number}`,
      newValues: planData,
      metadata: {
        patient_id: planData.patient_id,
        doctor_id: planData.doctor_id,
        tooth_number: planData.tooth_number,
        event_type: planData.event_type,
        action: planData.action
      }
    });
  }, []);

  const logBracesCalendarEvent = useCallback(async (calendarData) => {
    return await logEvent({
      action: 'braces_calendar_event',
      module: 'medical_records',
      section: 'braces_calendar',
      resourceType: 'braces_calendar',
      resourceId: calendarData.patient_id,
      resourceName: `Braces Calendar: ${calendarData.patient_name}`,
      newValues: calendarData,
      metadata: {
        patient_id: calendarData.patient_id,
        patient_name: calendarData.patient_name,
        doctor_id: calendarData.doctor_id,
        appointment_date: calendarData.appointment_date,
        month: calendarData.month,
        year: calendarData.year,
        action: calendarData.action
      }
    });
  }, []);

  const logDentalChartUpdate = useCallback(async (patientId, chartData) => {
    return await logEvent({
      action: 'dental_chart_update',
      module: 'medical_records',
      section: 'dental_chart',
      resourceType: 'dental_chart',
      resourceId: patientId,
      resourceName: `Dental chart for ${chartData.patient_name}`,
      newValues: chartData,
      metadata: {
        patientId,
        doctorId: chartData.doctor_id,
        updatedFields: Object.keys(chartData)
      }
    });
  }, [logEvent]);

  /**
   * QUEUE AUDIT LOGGING
   */

  const logQueueAdd = useCallback(async (queueData) => {
    return await auditMiddleware.logQueueAdd(queueData);
  }, []);

  const logQueueStatusUpdate = useCallback(async (queueId, oldData, newData) => {
    return await auditMiddleware.logQueueStatusUpdate(queueId, oldData, newData);
  }, []);

  const logQueueRemove = useCallback(async (queueId, queueData, reason = null) => {
    return await logEvent({
      action: 'queue_remove',
      module: 'queue',
      section: 'management',
      resourceType: 'queue',
      resourceId: queueId,
      resourceName: `Queue entry for ${queueData.patient_name}`,
      oldValues: { status: queueData.status },
      newValues: { status: 'removed' },
      metadata: {
        reason,
        patientId: queueData.patient_id,
        doctorId: queueData.doctor_id,
        queueNumber: queueData.queue_number
      }
    });
  }, [logEvent]);

  /**
   * SYSTEM AUDIT LOGGING
   */

  const logSystemBackup = useCallback(async (backupData) => {
    return await auditMiddleware.logSystemBackup(backupData);
  }, []);

  const logSystemConfigUpdate = useCallback(async (configData) => {
    return await auditMiddleware.logSystemConfigUpdate(configData);
  }, []);

  const logSystemMaintenance = useCallback(async (maintenanceData) => {
    return await logEvent({
      action: 'system_maintenance',
      module: 'system',
      section: 'maintenance',
      resourceType: 'system',
      resourceName: `Maintenance: ${maintenanceData.type}`,
      newValues: maintenanceData,
      metadata: {
        duration: maintenanceData.duration,
        affectedServices: maintenanceData.affected_services
      }
    });
  }, [logEvent]);

  /**
   * SECURITY AUDIT LOGGING
   */

  const logSecurityEvent = useCallback(async (eventType, eventData) => {
    return await auditMiddleware.logSecurityEvent(eventType, eventData);
  }, []);

  const logFailedLogin = useCallback(async (email, ipAddress, userAgent) => {
    return await logEvent({
      action: 'security_login_failed',
      module: 'security',
      section: 'authentication',
      resourceType: 'user',
      resourceName: email,
      success: false,
      metadata: {
        email,
        ipAddress,
        userAgent,
        attemptTime: new Date().toISOString()
      }
    });
  }, [logEvent]);

  const logAccountLocked = useCallback(async (userId, userData, reason = null) => {
    return await logEvent({
      action: 'security_account_locked',
      module: 'security',
      section: 'account_security',
      resourceType: 'user',
      resourceId: userId,
      resourceName: userData.full_name || userData.email,
      newValues: { locked: true },
      metadata: {
        reason,
        userRole: userData.role,
        email: userData.email
      }
    });
  }, [logEvent]);

  const logPermissionDenied = useCallback(async (userId, userData, attemptedAction, resource = null) => {
    return await logEvent({
      action: 'security_permission_denied',
      module: 'security',
      section: 'permissions',
      resourceType: 'permission',
      resourceName: attemptedAction,
      success: false,
      metadata: {
        userId,
        userRole: userData.role,
        attemptedAction,
        resource,
        timestamp: new Date().toISOString()
      }
    });
  }, [logEvent]);

  /**
   * DATA EXPORT/IMPORT AUDIT LOGGING
   */

  const logDataExport = useCallback(async (exportData) => {
    return await logEvent({
      action: 'security_data_export',
      module: 'security',
      section: 'data_management',
      resourceType: 'data_export',
      resourceName: `Export: ${exportData.type}`,
      newValues: exportData,
      metadata: {
        exportType: exportData.type,
        recordCount: exportData.record_count,
        format: exportData.format,
        filters: exportData.filters
      }
    });
  }, [logEvent]);

  const logDataImport = useCallback(async (importData) => {
    return await logEvent({
      action: 'security_data_import',
      module: 'security',
      section: 'data_management',
      resourceType: 'data_import',
      resourceName: `Import: ${importData.type}`,
      newValues: importData,
      metadata: {
        importType: importData.type,
        recordCount: importData.record_count,
        format: importData.format,
        source: importData.source
      }
    });
  }, [logEvent]);

  /**
   * AUDIT LOG QUERIES
   */

  const getAuditLogs = useCallback(async (filters = {}) => {
    return await auditLogService.getAuditLogs(filters);
  }, []);

  const getAuditLogStats = useCallback(async (filters = {}) => {
    return await auditLogService.getAuditLogStats(filters);
  }, []);

  const generateAuditReport = useCallback(async (reportData) => {
    return await auditLogService.generateAuditReport(reportData);
  }, []);

  /**
   * UTILITY FUNCTIONS
   */

  const logCustomEvent = useCallback(async (action, module, section, resourceType, resourceId, resourceName, oldValues, newValues, metadata) => {
    return await logEvent({
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
  }, [logEvent]);

  const logError = useCallback(async (error, context = {}) => {
    return await logEvent({
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
  }, [logEvent]);

  return {
    // Generic logging
    logEvent,
    logCustomEvent,
    logError,

    // User management
    logUserCreate,
    logUserUpdate,
    logUserDelete,
    logUserApproval,
    logUserLogin,
    logPasswordChange,

    // Appointments
    logAppointmentCreate,
    logAppointmentUpdate,
    logAppointmentCancel,
    logAppointmentReschedule,

    // Payments
    logPaymentCreate,
    logPaymentUpdate,
    logPaymentApproval,
    logPaymentRejection,
    logPaymentRefund,

    // Services
    logServiceCreate,
    logServiceUpdate,
    logServiceDelete,
    logServicePricingUpdate,

    // Medical records
    logMedicalRecordUpdate,
    logTreatmentAdd,
    logTreatmentCreate,
    logTreatmentUpdate,
    logPatientView,
    logBracesAdjustment,
    logBracesPlan,
    logBracesCalendarEvent,
    logDentalChartUpdate,

    // Queue
    logQueueAdd,
    logQueueStatusUpdate,
    logQueueRemove,

    // System
    logSystemBackup,
    logSystemConfigUpdate,
    logSystemMaintenance,

    // Security
    logSecurityEvent,
    logFailedLogin,
    logAccountLocked,
    logPermissionDenied,
    logDataExport,
    logDataImport,

    // Queries
    getAuditLogs,
    getAuditLogStats,
    generateAuditReport
  };
};

export default useAuditLog;
