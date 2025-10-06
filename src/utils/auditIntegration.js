// src/utils/auditIntegration.js - Comprehensive Audit Integration Utilities

import { useUniversalAudit } from '../hooks/useUniversalAudit';

/**
 * Higher-order component for automatic page view logging
 */
export const withPageAudit = (WrappedComponent, pageConfig) => {
  const WithPageAuditComponent = (props) => {
    const { logPageView } = useUniversalAudit();

    useEffect(() => {
      if (pageConfig) {
        logPageView(
          pageConfig.pageName,
          pageConfig.module,
          pageConfig.section,
          {
            userRole: pageConfig.userRole,
            pageType: pageConfig.pageType,
            timestamp: new Date().toISOString()
          }
        );
      }
    }, [logPageView]);

    return <WrappedComponent {...props} />;
  };

  WithPageAuditComponent.displayName = `withPageAudit(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithPageAuditComponent;
};

/**
 * Audit logging configurations for different page types
 */
export const AUDIT_CONFIGS = {
  // Admin Pages
  admin: {
    dashboard: {
      pageName: 'Admin Dashboard',
      module: 'dashboard',
      section: 'main',
      userRole: 'admin',
      pageType: 'main'
    },
    userManagement: {
      pageName: 'User Management',
      module: 'user_management',
      section: 'management',
      userRole: 'admin',
      pageType: 'admin'
    },
    appointments: {
      pageName: 'Admin Appointments',
      module: 'appointments',
      section: 'management',
      userRole: 'admin',
      pageType: 'admin'
    },
    billing: {
      pageName: 'Admin Billing',
      module: 'billing',
      section: 'management',
      userRole: 'admin',
      pageType: 'admin'
    },
    auditLogs: {
      pageName: 'Audit Logs',
      module: 'audit',
      section: 'logs',
      userRole: 'admin',
      pageType: 'admin'
    },
    settings: {
      pageName: 'Admin Settings',
      module: 'settings',
      section: 'profile',
      userRole: 'admin',
      pageType: 'settings'
    }
  },

  // Doctor Pages
  doctor: {
    dashboard: {
      pageName: 'Doctor Dashboard',
      module: 'dashboard',
      section: 'main',
      userRole: 'doctor',
      pageType: 'main'
    },
    appointments: {
      pageName: 'Doctor Appointments',
      module: 'appointments',
      section: 'management',
      userRole: 'doctor',
      pageType: 'doctor'
    },
    medicalRecords: {
      pageName: 'Medical Records',
      module: 'medical_records',
      section: 'management',
      userRole: 'doctor',
      pageType: 'doctor'
    },
    dentalChart: {
      pageName: 'Dental Chart',
      module: 'medical_records',
      section: 'chart',
      userRole: 'doctor',
      pageType: 'doctor'
    },
    analytics: {
      pageName: 'Doctor Analytics',
      module: 'analytics',
      section: 'reports',
      userRole: 'doctor',
      pageType: 'doctor'
    },
    settings: {
      pageName: 'Doctor Settings',
      module: 'settings',
      section: 'profile',
      userRole: 'doctor',
      pageType: 'settings'
    }
  },

  // Staff Pages
  staff: {
    dashboard: {
      pageName: 'Staff Dashboard',
      module: 'dashboard',
      section: 'main',
      userRole: 'staff',
      pageType: 'main'
    },
    queue: {
      pageName: 'Queue Management',
      module: 'queue',
      section: 'management',
      userRole: 'staff',
      pageType: 'staff'
    },
    appointments: {
      pageName: 'Staff Appointments',
      module: 'appointments',
      section: 'management',
      userRole: 'staff',
      pageType: 'staff'
    },
    settings: {
      pageName: 'Staff Settings',
      module: 'settings',
      section: 'profile',
      userRole: 'staff',
      pageType: 'settings'
    }
  },

  // Patient Pages
  patient: {
    dashboard: {
      pageName: 'Patient Dashboard',
      module: 'dashboard',
      section: 'main',
      userRole: 'patient',
      pageType: 'main'
    },
    appointments: {
      pageName: 'Patient Appointments',
      module: 'appointments',
      section: 'booking',
      userRole: 'patient',
      pageType: 'patient'
    },
    medicalRecords: {
      pageName: 'My Medical Records',
      module: 'medical_records',
      section: 'viewing',
      userRole: 'patient',
      pageType: 'patient'
    },
    dentalChart: {
      pageName: 'My Dental Chart',
      module: 'medical_records',
      section: 'chart',
      userRole: 'patient',
      pageType: 'patient'
    },
    payments: {
      pageName: 'Patient Payments',
      module: 'billing',
      section: 'payments',
      userRole: 'patient',
      pageType: 'patient'
    },
    settings: {
      pageName: 'Patient Settings',
      module: 'settings',
      section: 'profile',
      userRole: 'patient',
      pageType: 'settings'
    }
  }
};

/**
 * Get audit config for a specific page
 */
export const getAuditConfig = (userRole, pageName) => {
  return AUDIT_CONFIGS[userRole]?.[pageName] || {
    pageName: `${userRole} ${pageName}`,
    module: 'general',
    section: 'main',
    userRole,
    pageType: 'general'
  };
};

/**
 * Common audit logging functions for different actions
 */
export const createAuditLogger = () => {
  const { 
    logPageView,
    logAppointmentView,
    logAppointmentCreate,
    logAppointmentUpdate,
    logAppointmentCancel,
    logBillingView,
    logPaymentCreate,
    logPaymentUpdate,
    logMedicalRecordView,
    logMedicalRecordUpdate,
    logTreatmentAdd,
    logQueueView,
    logQueueAdd,
    logQueueStatusUpdate,
    logUserCreate,
    logUserUpdate,
    logUserDelete,
    logProfileUpdate,
    logProfilePictureUpdate,
    logPasswordChange,
    logLogin,
    logLogout,
    logSettingsView,
    logSettingsUpdate
  } = useUniversalAudit();

  return {
    // Page navigation
    logPageView,
    
    // Appointments
    logAppointmentView,
    logAppointmentCreate,
    logAppointmentUpdate,
    logAppointmentCancel,
    
    // Billing & Payments
    logBillingView,
    logPaymentCreate,
    logPaymentUpdate,
    
    // Medical Records
    logMedicalRecordView,
    logMedicalRecordUpdate,
    logTreatmentAdd,
    
    // Queue Management
    logQueueView,
    logQueueAdd,
    logQueueStatusUpdate,
    
    // User Management
    logUserCreate,
    logUserUpdate,
    logUserDelete,
    
    // Profile Management
    logProfileUpdate,
    logProfilePictureUpdate,
    logPasswordChange,
    
    // Authentication
    logLogin,
    logLogout,
    
    // Settings
    logSettingsView,
    logSettingsUpdate
  };
};

/**
 * Quick integration helper for pages
 */
export const addAuditToPage = (Component, userRole, pageName) => {
  const config = getAuditConfig(userRole, pageName);
  return withPageAudit(Component, config);
};

export default {
  withPageAudit,
  AUDIT_CONFIGS,
  getAuditConfig,
  createAuditLogger,
  addAuditToPage
};
