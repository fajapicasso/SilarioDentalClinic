// src/services/auditLogService.js - Comprehensive Audit Logging Service
import supabase from '../config/supabaseClient';
import { getClientInfo } from '../utils/ipUtils';

class AuditLogService {
  constructor() {
    this.initialized = false;
    this.sessionId = this.generateSessionId();
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('AuditLogService: Initializing...');
      this.initialized = true;
      console.log('AuditLogService: Initialized successfully');
    } catch (error) {
      console.error('AuditLogService: Initialization failed', error);
    }
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log an audit event
   * @param {Object} params - Audit log parameters
   * @param {string} params.action - Action performed (create, update, delete, etc.)
   * @param {string} params.module - Module where action was performed
   * @param {string} params.section - Specific section within the module
   * @param {string} params.resourceType - Type of resource affected
   * @param {string} params.resourceId - ID of the resource affected
   * @param {string} params.resourceName - Name of the resource affected
   * @param {Object} params.oldValues - Previous values (for updates)
   * @param {Object} params.newValues - New values (for creates/updates)
   * @param {boolean} params.success - Whether the action was successful
   * @param {string} params.errorMessage - Error message if action failed
   * @param {Object} params.metadata - Additional metadata
   */
  async logEvent({
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
  }) {
    try {
      await this.initialize();

      // Get current user information
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      let userInfo = {
        userId: null,
        userName: 'System',
        userRole: 'system'
      };

      if (user && !authError) {
        // Get user profile information
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('id', user.id)
          .single();

        if (!profileError && profile) {
          userInfo = {
            userId: profile.id,
            userName: profile.full_name,
            userRole: profile.role
          };
        }
      }

      // Get client information
      const clientInfo = await getClientInfo();

      // Prepare audit log entry
      const auditEntry = {
        user_id: userInfo.userId,
        user_name: userInfo.userName,
        user_role: userInfo.userRole,
        action,
        module,
        section,
        resource_type: resourceType,
        resource_id: resourceId,
        resource_name: resourceName,
        old_values: oldValues ? JSON.stringify(oldValues) : null,
        new_values: newValues ? JSON.stringify(newValues) : null,
        ip_address: clientInfo.ipAddress,
        user_agent: clientInfo.userAgent,
        session_id: this.sessionId,
        success,
        error_message: errorMessage,
        metadata: JSON.stringify({
          ...metadata,
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
          location: clientInfo.location,
          timestamp: new Date().toISOString()
        }),
        timestamp: new Date().toISOString()
      };

      // Insert audit log entry
      const { data, error } = await supabase
        .from('audit_logs')
        .insert(auditEntry)
        .select()
        .single();

      if (error) {
        console.error('❌ Error logging audit event:', error);
        console.error('❌ Audit entry that failed:', auditEntry);
        console.error('❌ Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return { success: false, error: error.message };
      }

      console.log('Audit event logged:', {
        id: data.id,
        action,
        module,
        user: userInfo.userName,
        resource: resourceName
      });

      return { success: true, data };
    } catch (error) {
      console.error('Error in audit logging:', error);
      return { success: false, error: error.message };
    }
  }


  /**
   * SPECIFIC AUDIT LOGGING METHODS
   */

  // User Management Audit Logs
  async logUserCreate(userId, userData) {
    return await this.logEvent({
      action: 'user_create',
      module: 'user_management',
      section: 'users',
      resourceType: 'user',
      resourceId: userId,
      resourceName: userData.full_name || userData.email,
      newValues: this.sanitizeUserData(userData),
      metadata: {
        userRole: userData.role,
        email: userData.email
      }
    });
  }

  async logUserUpdate(userId, oldData, newData) {
    return await this.logEvent({
      action: 'user_update',
      module: 'user_management',
      section: 'users',
      resourceType: 'user',
      resourceId: userId,
      resourceName: newData.full_name || oldData.full_name,
      oldValues: this.sanitizeUserData(oldData),
      newValues: this.sanitizeUserData(newData),
      metadata: {
        changedFields: this.getChangedFields(oldData, newData)
      }
    });
  }

  async logUserDelete(userId, userData) {
    return await this.logEvent({
      action: 'user_delete',
      module: 'user_management',
      section: 'users',
      resourceType: 'user',
      resourceId: userId,
      resourceName: userData.full_name || userData.email,
      oldValues: this.sanitizeUserData(userData),
      metadata: {
        userRole: userData.role,
        email: userData.email
      }
    });
  }

  async logUserApproval(userId, userData) {
    return await this.logEvent({
      action: 'user_approve',
      module: 'user_management',
      section: 'users',
      resourceType: 'user',
      resourceId: userId,
      resourceName: userData.full_name || userData.email,
      newValues: { disabled: false },
      metadata: {
        userRole: userData.role,
        email: userData.email
      }
    });
  }

  async logUserLogin(userId, userData, success = true, errorMessage = null) {
    return await this.logEvent({
      action: 'user_login',
      module: 'security',
      section: 'authentication',
      resourceType: 'user',
      resourceId: userId,
      resourceName: userData.full_name || userData.email,
      success,
      errorMessage,
      metadata: {
        userRole: userData.role,
        email: userData.email,
        loginMethod: 'password'
      }
    });
  }

  async logPasswordChange(userId, userData) {
    return await this.logEvent({
      action: 'password_change',
      module: 'security',
      section: 'authentication',
      resourceType: 'user',
      resourceId: userId,
      resourceName: userData.full_name || userData.email,
      metadata: {
        userRole: userData.role,
        email: userData.email
      }
    });
  }

  // Comprehensive Appointment Audit Logs
  async logAppointmentCreate(appointmentId, appointmentData) {
    return await this.logEvent({
      action: 'appointment_create',
      module: 'appointments',
      section: 'scheduling',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Appointment for ${appointmentData.patient_name}`,
      newValues: this.sanitizeAppointmentData(appointmentData),
      metadata: {
        patientId: appointmentData.patient_id,
        doctorId: appointmentData.doctor_id,
        branch: appointmentData.branch,
        isEmergency: appointmentData.is_emergency,
        appointmentType: appointmentData.appointment_type || 'regular',
        serviceType: appointmentData.service_type,
        duration: appointmentData.duration,
        notes: appointmentData.notes
      }
    });
  }

  async logAppointmentStatusChange(appointmentId, oldStatus, newStatus, appointmentData) {
    return await this.logEvent({
      action: 'appointment_status_change',
      module: 'appointments',
      section: 'scheduling',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Appointment for ${appointmentData.patient_name}`,
      oldValues: { status: oldStatus },
      newValues: { status: newStatus },
      metadata: {
        patientId: appointmentData.patient_id,
        doctorId: appointmentData.doctor_id,
        branch: appointmentData.branch,
        statusChangeReason: appointmentData.status_change_reason,
        changedBy: appointmentData.changed_by
      }
    });
  }

  async logAppointmentConfirm(appointmentId, appointmentData) {
    return await this.logEvent({
      action: 'appointment_confirm',
      module: 'appointments',
      section: 'scheduling',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Appointment for ${appointmentData.patient_name}`,
      newValues: { status: 'confirmed', confirmed_at: new Date().toISOString() },
      metadata: {
        patientId: appointmentData.patient_id,
        doctorId: appointmentData.doctor_id,
        branch: appointmentData.branch,
        confirmationMethod: appointmentData.confirmation_method || 'system'
      }
    });
  }

  async logAppointmentComplete(appointmentId, appointmentData, completionNotes = null) {
    return await this.logEvent({
      action: 'appointment_complete',
      module: 'appointments',
      section: 'scheduling',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Appointment for ${appointmentData.patient_name}`,
      newValues: { 
        status: 'completed', 
        completed_at: new Date().toISOString(),
        completion_notes: completionNotes
      },
      metadata: {
        patientId: appointmentData.patient_id,
        doctorId: appointmentData.doctor_id,
        branch: appointmentData.branch,
        actualDuration: appointmentData.actual_duration,
        treatmentsPerformed: appointmentData.treatments_performed
      }
    });
  }

  async logAppointmentNoShow(appointmentId, appointmentData, reason = null) {
    return await this.logEvent({
      action: 'appointment_no_show',
      module: 'appointments',
      section: 'scheduling',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Appointment for ${appointmentData.patient_name}`,
      newValues: { 
        status: 'no_show', 
        no_show_at: new Date().toISOString(),
        no_show_reason: reason
      },
      metadata: {
        patientId: appointmentData.patient_id,
        doctorId: appointmentData.doctor_id,
        branch: appointmentData.branch,
        scheduledTime: appointmentData.appointment_time,
        rescheduleAttempted: appointmentData.reschedule_attempted
      }
    });
  }

  async logAppointmentReminderSent(appointmentId, appointmentData, reminderType, sentTo) {
    return await this.logEvent({
      action: 'appointment_reminder_sent',
      module: 'appointments',
      section: 'notifications',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Appointment for ${appointmentData.patient_name}`,
      newValues: { 
        reminder_sent_at: new Date().toISOString(),
        reminder_type: reminderType,
        sent_to: sentTo
      },
      metadata: {
        patientId: appointmentData.patient_id,
        doctorId: appointmentData.doctor_id,
        branch: appointmentData.branch,
        appointmentTime: appointmentData.appointment_time,
        reminderMethod: appointmentData.reminder_method
      }
    });
  }

  async logAppointmentNotesAdd(appointmentId, appointmentData, notes) {
    return await this.logEvent({
      action: 'appointment_notes_add',
      module: 'appointments',
      section: 'notes',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Appointment for ${appointmentData.patient_name}`,
      newValues: { 
        notes_added_at: new Date().toISOString(),
        notes_content: notes
      },
      metadata: {
        patientId: appointmentData.patient_id,
        doctorId: appointmentData.doctor_id,
        branch: appointmentData.branch,
        notesLength: notes.length,
        notesType: appointmentData.notes_type || 'general'
      }
    });
  }

  async logAppointmentNotesUpdate(appointmentId, appointmentData, oldNotes, newNotes) {
    return await this.logEvent({
      action: 'appointment_notes_update',
      module: 'appointments',
      section: 'notes',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Appointment for ${appointmentData.patient_name}`,
      oldValues: { notes_content: oldNotes },
      newValues: { 
        notes_content: newNotes,
        notes_updated_at: new Date().toISOString()
      },
      metadata: {
        patientId: appointmentData.patient_id,
        doctorId: appointmentData.doctor_id,
        branch: appointmentData.branch,
        notesChanged: oldNotes !== newNotes
      }
    });
  }

  async logEmergencyAppointmentCreate(appointmentId, appointmentData) {
    return await this.logEvent({
      action: 'appointment_emergency_create',
      module: 'appointments',
      section: 'emergency',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Emergency appointment for ${appointmentData.patient_name}`,
      newValues: this.sanitizeAppointmentData(appointmentData),
      metadata: {
        patientId: appointmentData.patient_id,
        doctorId: appointmentData.doctor_id,
        branch: appointmentData.branch,
        emergencyType: appointmentData.emergency_type,
        urgencyLevel: appointmentData.urgency_level,
        symptoms: appointmentData.symptoms,
        isWalkIn: appointmentData.is_walk_in
      }
    });
  }

  async logWalkInAppointment(appointmentId, appointmentData) {
    return await this.logEvent({
      action: 'appointment_walk_in',
      module: 'appointments',
      section: 'walk_in',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Walk-in appointment for ${appointmentData.patient_name}`,
      newValues: this.sanitizeAppointmentData(appointmentData),
      metadata: {
        patientId: appointmentData.patient_id,
        doctorId: appointmentData.doctor_id,
        branch: appointmentData.branch,
        walkInTime: appointmentData.walk_in_time,
        estimatedWaitTime: appointmentData.estimated_wait_time,
        priorityLevel: appointmentData.priority_level
      }
    });
  }

  async logAppointmentUpdate(appointmentId, oldData, newData) {
    return await this.logEvent({
      action: 'appointment_update',
      module: 'appointments',
      section: 'scheduling',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Appointment for ${newData.patient_name || oldData.patient_name}`,
      oldValues: this.sanitizeAppointmentData(oldData),
      newValues: this.sanitizeAppointmentData(newData),
      metadata: {
        changedFields: this.getChangedFields(oldData, newData),
        patientId: newData.patient_id || oldData.patient_id,
        doctorId: newData.doctor_id || oldData.doctor_id
      }
    });
  }

  async logAppointmentCancel(appointmentId, appointmentData, reason = null) {
    return await this.logEvent({
      action: 'appointment_cancel',
      module: 'appointments',
      section: 'scheduling',
      resourceType: 'appointment',
      resourceId: appointmentId,
      resourceName: `Appointment for ${appointmentData.patient_name}`,
      oldValues: { status: appointmentData.status },
      newValues: { status: 'cancelled' },
      metadata: {
        reason,
        patientId: appointmentData.patient_id,
        doctorId: appointmentData.doctor_id,
        branch: appointmentData.branch
      }
    });
  }

  // Payment Audit Logs
  async logPaymentCreate(paymentId, paymentData) {
    return await this.logEvent({
      action: 'payment_create',
      module: 'payments',
      section: 'billing',
      resourceType: 'payment',
      resourceId: paymentId,
      resourceName: `Payment of ₱${paymentData.amount}`,
      newValues: this.sanitizePaymentData(paymentData),
      metadata: {
        patientId: paymentData.patient_id,
        invoiceId: paymentData.invoice_id,
        paymentMethod: paymentData.payment_method
      }
    });
  }

  async logPaymentUpdate(paymentId, oldData, newData) {
    return await this.logEvent({
      action: 'payment_update',
      module: 'payments',
      section: 'billing',
      resourceType: 'payment',
      resourceId: paymentId,
      resourceName: `Payment of ₱${newData.amount || oldData.amount}`,
      oldValues: this.sanitizePaymentData(oldData),
      newValues: this.sanitizePaymentData(newData),
      metadata: {
        changedFields: this.getChangedFields(oldData, newData),
        patientId: newData.patient_id || oldData.patient_id
      }
    });
  }

  async logPaymentApproval(paymentId, paymentData) {
    return await this.logEvent({
      action: 'payment_approve',
      module: 'payments',
      section: 'billing',
      resourceType: 'payment',
      resourceId: paymentId,
      resourceName: `Payment of ₱${paymentData.amount}`,
      oldValues: { approval_status: paymentData.approval_status },
      newValues: { approval_status: 'approved' },
      metadata: {
        patientId: paymentData.patient_id,
        invoiceId: paymentData.invoice_id,
        amount: paymentData.amount
      }
    });
  }

  // Service Audit Logs
  async logServiceCreate(serviceId, serviceData) {
    return await this.logEvent({
      action: 'service_create',
      module: 'services',
      section: 'management',
      resourceType: 'service',
      resourceId: serviceId,
      resourceName: serviceData.name,
      newValues: this.sanitizeServiceData(serviceData),
      metadata: {
        category: serviceData.category,
        price: serviceData.price
      }
    });
  }

  async logServiceUpdate(serviceId, oldData, newData) {
    return await this.logEvent({
      action: 'service_update',
      module: 'services',
      section: 'management',
      resourceType: 'service',
      resourceId: serviceId,
      resourceName: newData.name || oldData.name,
      oldValues: this.sanitizeServiceData(oldData),
      newValues: this.sanitizeServiceData(newData),
      metadata: {
        changedFields: this.getChangedFields(oldData, newData)
      }
    });
  }

  async logServiceDelete(serviceId, serviceData) {
    return await this.logEvent({
      action: 'service_delete',
      module: 'services',
      section: 'management',
      resourceType: 'service',
      resourceId: serviceId,
      resourceName: serviceData.name,
      oldValues: this.sanitizeServiceData(serviceData),
      metadata: {
        category: serviceData.category,
        price: serviceData.price
      }
    });
  }

  // Medical Record Audit Logs
  async logMedicalRecordUpdate(patientId, oldData, newData) {
    return await this.logEvent({
      action: 'record_update',
      module: 'medical_records',
      section: 'patient_records',
      resourceType: 'medical_record',
      resourceId: patientId,
      resourceName: `Medical record for ${newData.patient_name || oldData.patient_name}`,
      oldValues: this.sanitizeMedicalRecordData(oldData),
      newValues: this.sanitizeMedicalRecordData(newData),
      metadata: {
        changedFields: this.getChangedFields(oldData, newData),
        patientId
      }
    });
  }

  async logTreatmentAdd(patientId, treatmentData) {
    return await this.logEvent({
      action: 'treatment_add',
      module: 'medical_records',
      section: 'treatments',
      resourceType: 'treatment',
      resourceId: patientId,
      resourceName: `Treatment: ${treatmentData.treatment_name}`,
      newValues: this.sanitizeTreatmentData(treatmentData),
      metadata: {
        patientId,
        doctorId: treatmentData.doctor_id,
        appointmentId: treatmentData.appointment_id
      }
    });
  }

  // Queue Audit Logs
  async logQueueAdd(queueId, queueData) {
    return await this.logEvent({
      action: 'queue_add',
      module: 'queue',
      section: 'management',
      resourceType: 'queue',
      resourceId: queueId,
      resourceName: `Queue entry for ${queueData.patient_name}`,
      newValues: this.sanitizeQueueData(queueData),
      metadata: {
        patientId: queueData.patient_id,
        doctorId: queueData.doctor_id,
        branch: queueData.branch
      }
    });
  }

  async logQueueStatusUpdate(queueId, oldData, newData) {
    return await this.logEvent({
      action: 'queue_update_status',
      module: 'queue',
      section: 'management',
      resourceType: 'queue',
      resourceId: queueId,
      resourceName: `Queue entry for ${newData.patient_name || oldData.patient_name}`,
      oldValues: { status: oldData.status },
      newValues: { status: newData.status },
      metadata: {
        patientId: newData.patient_id || oldData.patient_id,
        doctorId: newData.doctor_id || oldData.doctor_id
      }
    });
  }

  // System Audit Logs
  async logSystemBackup(backupData) {
    return await this.logEvent({
      action: 'system_backup',
      module: 'system',
      section: 'maintenance',
      resourceType: 'backup',
      resourceName: `Backup ${backupData.backup_name}`,
      newValues: this.sanitizeBackupData(backupData),
      metadata: {
        backupSize: backupData.size,
        backupType: backupData.type
      }
    });
  }

  async logSystemConfigUpdate(configData) {
    return await this.logEvent({
      action: 'system_config_update',
      module: 'system',
      section: 'configuration',
      resourceType: 'configuration',
      resourceName: `Config update: ${configData.setting_key}`,
      oldValues: { value: configData.old_value },
      newValues: { value: configData.new_value },
      metadata: {
        settingKey: configData.setting_key,
        settingType: configData.setting_type
      }
    });
  }

  // Security Audit Logs
  async logSecurityEvent(eventType, eventData) {
    return await this.logEvent({
      action: `security_${eventType}`,
      module: 'security',
      section: 'events',
      resourceType: 'security_event',
      resourceName: `Security event: ${eventType}`,
      newValues: eventData,
      metadata: {
        eventType,
        severity: eventData.severity || 'normal'
      }
    });
  }

  /**
   * DATA SANITIZATION METHODS
   * Remove sensitive information before logging
   */

  sanitizeUserData(userData) {
    const sanitized = { ...userData };
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.password_hash;
    delete sanitized.temporary_password;
    return sanitized;
  }

  sanitizeAppointmentData(appointmentData) {
    const sanitized = { ...appointmentData };
    // Remove sensitive fields
    delete sanitized.notes;
    delete sanitized.internal_notes;
    return sanitized;
  }

  sanitizePaymentData(paymentData) {
    const sanitized = { ...paymentData };
    // Remove sensitive fields
    delete sanitized.payment_reference;
    delete sanitized.transaction_id;
    return sanitized;
  }

  sanitizeServiceData(serviceData) {
    const sanitized = { ...serviceData };
    // No sensitive data in services
    return sanitized;
  }

  sanitizeMedicalRecordData(recordData) {
    const sanitized = { ...recordData };
    // Remove sensitive medical information if needed
    // Keep basic structure but remove detailed medical notes
    return sanitized;
  }

  sanitizeTreatmentData(treatmentData) {
    const sanitized = { ...treatmentData };
    // Remove sensitive treatment details if needed
    return sanitized;
  }

  sanitizeQueueData(queueData) {
    const sanitized = { ...queueData };
    // No sensitive data in queue
    return sanitized;
  }

  sanitizeBackupData(backupData) {
    const sanitized = { ...backupData };
    // Remove sensitive backup details
    delete sanitized.backup_path;
    delete sanitized.encryption_key;
    return sanitized;
  }

  /**
   * UTILITY METHODS
   */

  getChangedFields(oldData, newData) {
    const changes = {};
    for (const key in newData) {
      if (oldData[key] !== newData[key]) {
        changes[key] = {
          old: oldData[key],
          new: newData[key]
        };
      }
    }
    return changes;
  }

  /**
   * TEST AND DEBUG METHODS
   */

  async testAuditLog() {
    try {
      console.log('🧪 Testing audit log system...');
      
      const testEntry = {
        user_id: null,
        user_name: 'Test System',
        user_role: 'system',
        action: 'test_audit_log',
        module: 'system',
        section: 'testing',
        resource_type: 'test',
        resource_id: null, // Changed from string to null since it's not a real UUID
        resource_name: 'Audit Log Test',
        old_values: null,
        new_values: JSON.stringify({ test: true }),
        ip_address: '127.0.0.1',
        user_agent: 'Test Script',
        session_id: 'test-session-' + Date.now(),
        success: true,
        error_message: null,
        metadata: JSON.stringify({ test_run: true }),
        timestamp: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('audit_logs')
        .insert(testEntry)
        .select()
        .single();

      if (error) {
        console.error('❌ Test audit log failed:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Test audit log successful:', data);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Test audit log error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * AUDIT LOG QUERY METHODS
   */

  async getAuditLogs(filters = {}) {
    try {
      await this.initialize();

      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      // Apply filters
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.action) {
        query = query.eq('action', filters.action);
      }
      if (filters.module) {
        query = query.eq('module', filters.module);
      }
      if (filters.resourceType) {
        query = query.eq('resource_type', filters.resourceType);
      }
      if (filters.dateFrom) {
        query = query.gte('timestamp', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('timestamp', filters.dateTo);
      }
      if (filters.success !== undefined) {
        query = query.eq('success', filters.success);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return { success: false, error: error.message };
    }
  }

  async getAuditLogStats(filters = {}) {
    try {
      await this.initialize();

      const { data, error } = await supabase.rpc('get_audit_log_stats', {
        p_date_from: filters.dateFrom || null,
        p_date_to: filters.dateTo || null,
        p_user_id: filters.userId || null,
        p_module: filters.module || null
      });

      if (error) throw error;

      return { success: true, data: data[0] };
    } catch (error) {
      console.error('Error fetching audit log stats:', error);
      return { success: false, error: error.message };
    }
  }

  async generateAuditReport(reportData) {
    try {
      await this.initialize();

      const reportEntry = {
        report_name: reportData.reportName,
        report_type: reportData.reportType,
        generated_by: reportData.generatedBy,
        date_from: reportData.dateFrom,
        date_to: reportData.dateTo,
        filters: JSON.stringify(reportData.filters),
        status: 'generating'
      };

      const { data, error } = await supabase
        .from('audit_log_reports')
        .insert(reportEntry)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error generating audit report:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const auditLogService = new AuditLogService();

export default auditLogService;
