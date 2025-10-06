// src/utils/auditMiddleware.js - Automatic Audit Logging Middleware
import auditLogService from '../services/auditLogService';

class AuditMiddleware {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('AuditMiddleware: Initializing...');
      this.initialized = true;
      console.log('AuditMiddleware: Initialized successfully');
    } catch (error) {
      console.error('AuditMiddleware: Initialization failed', error);
    }
  }

  /**
   * Wrap API calls with audit logging
   */
  async withAuditLog(operation, auditConfig) {
    try {
      await this.initialize();

      const startTime = Date.now();
      let result;
      let error = null;

      try {
        result = await operation();
      } catch (err) {
        error = err;
        throw err;
      } finally {
        const duration = Date.now() - startTime;
        
        // Log the operation
        await auditLogService.logEvent({
          action: auditConfig.action,
          module: auditConfig.module,
          section: auditConfig.section,
          resourceType: auditConfig.resourceType,
          resourceId: auditConfig.resourceId,
          resourceName: auditConfig.resourceName,
          oldValues: auditConfig.oldValues,
          newValues: auditConfig.newValues,
          success: !error,
          errorMessage: error ? error.message : null,
          metadata: {
            ...auditConfig.metadata,
            duration,
            timestamp: new Date().toISOString()
          }
        });
      }

      return result;
    } catch (error) {
      console.error('Audit middleware error:', error);
      // Don't throw here to avoid breaking the original operation
      return null;
    }
  }

  /**
   * USER MANAGEMENT AUDIT WRAPPERS
   */

  async logUserCreate(userData) {
    return await auditLogService.logUserCreate(userData.id, userData);
  }

  async logUserUpdate(userId, oldData, newData) {
    return await auditLogService.logUserUpdate(userId, oldData, newData);
  }

  async logUserDelete(userId, userData) {
    return await auditLogService.logUserDelete(userId, userData);
  }

  async logUserApproval(userId, userData) {
    return await auditLogService.logUserApproval(userId, userData);
  }

  async logUserLogin(userId, userData, success = true, errorMessage = null) {
    return await auditLogService.logUserLogin(userId, userData, success, errorMessage);
  }

  async logPasswordChange(userId, userData) {
    return await auditLogService.logPasswordChange(userId, userData);
  }

  /**
   * COMPREHENSIVE APPOINTMENT AUDIT WRAPPERS
   */

  async logAppointmentCreate(appointmentData) {
    return await auditLogService.logAppointmentCreate(appointmentData.id, appointmentData);
  }

  async logAppointmentUpdate(appointmentId, oldData, newData) {
    return await auditLogService.logAppointmentUpdate(appointmentId, oldData, newData);
  }

  async logAppointmentCancel(appointmentId, appointmentData, reason = null) {
    return await auditLogService.logAppointmentCancel(appointmentId, appointmentData, reason);
  }

  async logAppointmentStatusChange(appointmentId, oldStatus, newStatus, appointmentData) {
    return await auditLogService.logAppointmentStatusChange(appointmentId, oldStatus, newStatus, appointmentData);
  }

  async logAppointmentConfirm(appointmentId, appointmentData) {
    return await auditLogService.logAppointmentConfirm(appointmentId, appointmentData);
  }

  async logAppointmentComplete(appointmentId, appointmentData, completionNotes = null) {
    return await auditLogService.logAppointmentComplete(appointmentId, appointmentData, completionNotes);
  }

  async logAppointmentNoShow(appointmentId, appointmentData, reason = null) {
    return await auditLogService.logAppointmentNoShow(appointmentId, appointmentData, reason);
  }

  async logAppointmentReminderSent(appointmentId, appointmentData, reminderType, sentTo) {
    return await auditLogService.logAppointmentReminderSent(appointmentId, appointmentData, reminderType, sentTo);
  }

  async logAppointmentNotesAdd(appointmentId, appointmentData, notes) {
    return await auditLogService.logAppointmentNotesAdd(appointmentId, appointmentData, notes);
  }

  async logAppointmentNotesUpdate(appointmentId, appointmentData, oldNotes, newNotes) {
    return await auditLogService.logAppointmentNotesUpdate(appointmentId, appointmentData, oldNotes, newNotes);
  }

  async logEmergencyAppointmentCreate(appointmentId, appointmentData) {
    return await auditLogService.logEmergencyAppointmentCreate(appointmentId, appointmentData);
  }

  async logWalkInAppointment(appointmentId, appointmentData) {
    return await auditLogService.logWalkInAppointment(appointmentId, appointmentData);
  }

  /**
   * PAYMENT AUDIT WRAPPERS
   */

  async logPaymentCreate(paymentData) {
    return await auditLogService.logPaymentCreate(paymentData.id, paymentData);
  }

  async logPaymentUpdate(paymentId, oldData, newData) {
    return await auditLogService.logPaymentUpdate(paymentId, oldData, newData);
  }

  async logPaymentApproval(paymentId, paymentData) {
    return await auditLogService.logPaymentApproval(paymentId, paymentData);
  }

  /**
   * SERVICE AUDIT WRAPPERS
   */

  async logServiceCreate(serviceData) {
    return await auditLogService.logServiceCreate(serviceData.id, serviceData);
  }

  async logServiceUpdate(serviceId, oldData, newData) {
    return await auditLogService.logServiceUpdate(serviceId, oldData, newData);
  }

  async logServiceDelete(serviceId, serviceData) {
    return await auditLogService.logServiceDelete(serviceId, serviceData);
  }

  /**
   * MEDICAL RECORD AUDIT WRAPPERS
   */

  async logMedicalRecordUpdate(patientId, oldData, newData) {
    return await auditLogService.logMedicalRecordUpdate(patientId, oldData, newData);
  }

  async logTreatmentAdd(patientId, treatmentData) {
    return await auditLogService.logTreatmentAdd(patientId, treatmentData);
  }

  /**
   * QUEUE AUDIT WRAPPERS
   */

  async logQueueAdd(queueData) {
    return await auditLogService.logQueueAdd(queueData.id, queueData);
  }

  async logQueueStatusUpdate(queueId, oldData, newData) {
    return await auditLogService.logQueueStatusUpdate(queueId, oldData, newData);
  }

  /**
   * SYSTEM AUDIT WRAPPERS
   */

  async logSystemBackup(backupData) {
    return await auditLogService.logSystemBackup(backupData);
  }

  async logSystemConfigUpdate(configData) {
    return await auditLogService.logSystemConfigUpdate(configData);
  }

  /**
   * SECURITY AUDIT WRAPPERS
   */

  async logSecurityEvent(eventType, eventData) {
    return await auditLogService.logSecurityEvent(eventType, eventData);
  }

  /**
   * SUPABASE OPERATION WRAPPERS
   * These wrap Supabase operations with automatic audit logging
   */

  async supabaseInsert(table, data, auditConfig) {
    return await this.withAuditLog(async () => {
      const { data: result, error } = await supabase
        .from(table)
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    }, {
      ...auditConfig,
      action: auditConfig.action || 'create',
      newValues: data
    });
  }

  async supabaseUpdate(table, id, updates, auditConfig) {
    return await this.withAuditLog(async () => {
      // Get old data first
      const { data: oldData } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      const { data: result, error } = await supabase
        .from(table)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { result, oldData };
    }, {
      ...auditConfig,
      action: auditConfig.action || 'update',
      resourceId: id,
      oldValues: auditConfig.oldValues,
      newValues: updates
    });
  }

  async supabaseDelete(table, id, auditConfig) {
    return await this.withAuditLog(async () => {
      // Get data before deletion
      const { data: oldData } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return oldData;
    }, {
      ...auditConfig,
      action: auditConfig.action || 'delete',
      resourceId: id,
      oldValues: auditConfig.oldValues
    });
  }

  /**
   * REACT HOOK WRAPPERS
   * These can be used in React components to automatically log actions
   */

  useAuditLog() {
    return {
      logUserCreate: this.logUserCreate.bind(this),
      logUserUpdate: this.logUserUpdate.bind(this),
      logUserDelete: this.logUserDelete.bind(this),
      logUserApproval: this.logUserApproval.bind(this),
      logUserLogin: this.logUserLogin.bind(this),
      logPasswordChange: this.logPasswordChange.bind(this),
      logAppointmentCreate: this.logAppointmentCreate.bind(this),
      logAppointmentUpdate: this.logAppointmentUpdate.bind(this),
      logAppointmentCancel: this.logAppointmentCancel.bind(this),
      logPaymentCreate: this.logPaymentCreate.bind(this),
      logPaymentUpdate: this.logPaymentUpdate.bind(this),
      logPaymentApproval: this.logPaymentApproval.bind(this),
      logServiceCreate: this.logServiceCreate.bind(this),
      logServiceUpdate: this.logServiceUpdate.bind(this),
      logServiceDelete: this.logServiceDelete.bind(this),
      logMedicalRecordUpdate: this.logMedicalRecordUpdate.bind(this),
      logTreatmentAdd: this.logTreatmentAdd.bind(this),
      logQueueAdd: this.logQueueAdd.bind(this),
      logQueueStatusUpdate: this.logQueueStatusUpdate.bind(this),
      logSystemBackup: this.logSystemBackup.bind(this),
      logSystemConfigUpdate: this.logSystemConfigUpdate.bind(this),
      logSecurityEvent: this.logSecurityEvent.bind(this)
    };
  }

  /**
   * AUTOMATIC INTEGRATION HELPERS
   */

  // Wrap fetch requests with audit logging
  async auditFetch(url, options = {}, auditConfig) {
    return await this.withAuditLog(async () => {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    }, auditConfig);
  }

  // Wrap async functions with audit logging
  async auditAsyncFunction(fn, auditConfig) {
    return await this.withAuditLog(fn, auditConfig);
  }

  /**
   * BATCH AUDIT LOGGING
   */

  async logBatchEvents(events) {
    try {
      await this.initialize();

      const results = [];
      for (const event of events) {
        const result = await auditLogService.logEvent(event);
        results.push(result);
      }

      return { success: true, results };
    } catch (error) {
      console.error('Error logging batch events:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * AUDIT LOG QUERIES
   */

  async getAuditLogs(filters = {}) {
    return await auditLogService.getAuditLogs(filters);
  }

  async getAuditLogStats(filters = {}) {
    return await auditLogService.getAuditLogStats(filters);
  }

  async generateAuditReport(reportData) {
    return await auditLogService.generateAuditReport(reportData);
  }
}

// Create singleton instance
const auditMiddleware = new AuditMiddleware();

export default auditMiddleware;
