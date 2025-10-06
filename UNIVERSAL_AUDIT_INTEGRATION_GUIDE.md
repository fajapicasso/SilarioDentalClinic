# Universal Audit Integration Guide

This guide explains how to implement comprehensive audit logging across all user types (admin, staff, patient, doctor) and all pages in the Silario Dental Clinic system.

## Overview

The universal audit system tracks all user activities across the entire application, providing comprehensive logging for:
- **Admin users**: All administrative actions
- **Staff users**: All staff operations
- **Patient users**: All patient activities
- **Doctor users**: All doctor operations

## Implementation

### 1. Universal Audit Hook

The `useUniversalAudit` hook provides comprehensive audit logging for all user types:

```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const { 
  logPageView,
  logProfileUpdate,
  logAppointmentCreate,
  logPaymentCreate,
  // ... other audit functions
} = useUniversalAudit();
```

### 2. Automatic Page View Logging

Use the `withAuditLogging` HOC to automatically log page views:

```javascript
import withAuditLogging from '../../components/common/withAuditLogging';

const MyPage = () => {
  // Your page component
};

export default withAuditLogging(MyPage, {
  pageName: 'Dashboard',
  module: 'dashboard',
  section: 'main',
  userRole: 'admin',
  pageType: 'main'
});
```

### 3. Manual Audit Logging

For specific actions, use the audit functions directly:

```javascript
// Log profile updates
await logProfileUpdate(userData, oldValues, newValues);

// Log appointment creation
await logAppointmentCreate(appointmentData);

// Log payment processing
await logPaymentCreate(paymentData);

// Log medical record updates
await logMedicalRecordUpdate(recordData, oldValues, newValues);
```

## Page-by-Page Integration

### Admin Pages

#### 1. Dashboard
```javascript
// In src/pages/admin/Dashboard.jsx
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const Dashboard = () => {
  const { logPageView, logDashboardView } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('Admin Dashboard', 'dashboard', 'main');
  }, [logPageView]);
  
  // Log specific dashboard actions
  const handleUserStatsView = async () => {
    await logDashboardView('user_stats');
  };
};
```

#### 2. User Management
```javascript
// In src/pages/admin/UserManagement.jsx
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const UserManagement = () => {
  const { logUserCreate, logUserUpdate, logUserDelete } = useUniversalAudit();
  
  const handleCreateUser = async (userData) => {
    // Create user logic
    await logUserCreate(userData);
  };
  
  const handleUpdateUser = async (userData, oldValues, newValues) => {
    // Update user logic
    await logUserUpdate(userData, oldValues, newValues);
  };
};
```

#### 3. Appointments
```javascript
// In src/pages/admin/Appointments.jsx
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const Appointments = () => {
  const { logAppointmentView, logAppointmentCreate, logAppointmentUpdate } = useUniversalAudit();
  
  const handleViewAppointment = async (appointment) => {
    await logAppointmentView(appointment);
  };
  
  const handleCreateAppointment = async (appointmentData) => {
    await logAppointmentCreate(appointmentData);
  };
};
```

#### 4. Billing
```javascript
// In src/pages/admin/Billing.jsx
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const Billing = () => {
  const { logBillingView, logPaymentCreate, logPaymentUpdate } = useUniversalAudit();
  
  const handleViewInvoice = async (invoice) => {
    await logBillingView(invoice);
  };
  
  const handleCreatePayment = async (paymentData) => {
    await logPaymentCreate(paymentData);
  };
};
```

### Staff Pages

#### 1. Staff Dashboard
```javascript
// In src/pages/staff/Dashboard.jsx
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const StaffDashboard = () => {
  const { logPageView } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('Staff Dashboard', 'dashboard', 'main');
  }, [logPageView]);
};
```

#### 2. Queue Management
```javascript
// In src/pages/staff/Queue.jsx
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const Queue = () => {
  const { logQueueView, logQueueAdd, logQueueStatusUpdate } = useUniversalAudit();
  
  const handleViewQueue = async (queueData) => {
    await logQueueView(queueData);
  };
  
  const handleAddToQueue = async (queueData) => {
    await logQueueAdd(queueData);
  };
};
```

### Patient Pages

#### 1. Patient Dashboard
```javascript
// In src/pages/patient/Dashboard.jsx
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const PatientDashboard = () => {
  const { logPageView } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('Patient Dashboard', 'dashboard', 'main');
  }, [logPageView]);
};
```

#### 2. Patient Appointments
```javascript
// In src/pages/patient/Appointments.jsx
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const PatientAppointments = () => {
  const { logAppointmentView, logAppointmentCreate } = useUniversalAudit();
  
  const handleBookAppointment = async (appointmentData) => {
    await logAppointmentCreate(appointmentData);
  };
};
```

#### 3. Patient Medical Records
```javascript
// In src/pages/patient/MedicalRecords.jsx
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const MedicalRecords = () => {
  const { logMedicalRecordView } = useUniversalAudit();
  
  const handleViewRecord = async (record) => {
    await logMedicalRecordView(record);
  };
};
```

### Doctor Pages

#### 1. Doctor Dashboard
```javascript
// In src/pages/doctor/Dashboard.jsx
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const DoctorDashboard = () => {
  const { logPageView } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('Doctor Dashboard', 'dashboard', 'main');
  }, [logPageView]);
};
```

#### 2. Doctor Appointments
```javascript
// In src/pages/doctor/Appointments.jsx
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const DoctorAppointments = () => {
  const { logAppointmentView, logAppointmentUpdate } = useUniversalAudit();
  
  const handleUpdateAppointment = async (appointment, oldValues, newValues) => {
    await logAppointmentUpdate(appointment, oldValues, newValues);
  };
};
```

#### 3. Doctor Medical Records
```javascript
// In src/pages/doctor/MedicalRecords.jsx
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const DoctorMedicalRecords = () => {
  const { logMedicalRecordView, logMedicalRecordUpdate, logTreatmentAdd } = useUniversalAudit();
  
  const handleAddTreatment = async (treatmentData) => {
    await logTreatmentAdd(treatmentData);
  };
};
```

## Authentication Logging

### Login/Logout Tracking
```javascript
// In authentication components
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const LoginComponent = () => {
  const { logLogin, logLogout } = useUniversalAudit();
  
  const handleLogin = async (userData) => {
    // Login logic
    await logLogin(userData, true);
  };
  
  const handleLogout = async (userData) => {
    // Logout logic
    await logLogout(userData);
  };
};
```

## Settings Logging

### Profile Updates
```javascript
// In settings pages
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const Settings = () => {
  const { logProfileUpdate, logProfilePictureUpdate, logPasswordChange } = useUniversalAudit();
  
  const handleProfileUpdate = async (userData, oldValues, newValues) => {
    await logProfileUpdate(userData, oldValues, newValues);
  };
  
  const handlePasswordChange = async (userData) => {
    await logPasswordChange(userData);
  };
};
```

## Error Logging

### System Errors
```javascript
// In error boundaries or catch blocks
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const ErrorComponent = () => {
  const { logError } = useUniversalAudit();
  
  const handleError = async (error, context) => {
    await logError(error, context);
  };
};
```

## Audit Logs Page

The audit logs page now shows activities from all user types:

- **Filter by User Role**: Admin, Doctor, Staff, Patient
- **Filter by Action**: Create, Update, Delete, Login, etc.
- **Filter by Module**: User Management, Appointments, Billing, etc.
- **Search**: Search across all fields
- **Export**: Export logs to CSV/PDF
- **Real-time**: View real-time audit logs

## Best Practices

1. **Always log page views** when users navigate to pages
2. **Log all CRUD operations** (Create, Read, Update, Delete)
3. **Log authentication events** (Login, Logout, Password changes)
4. **Log profile updates** including picture uploads
5. **Log financial transactions** (Payments, Billing)
6. **Log medical record access** and modifications
7. **Log system errors** for debugging
8. **Use appropriate metadata** for context

## Security Considerations

- Audit logs are stored securely in the database
- Only admin users can view audit logs
- Sensitive data is not logged (passwords, etc.)
- IP addresses and user agents are tracked
- All actions are timestamped
- Failed actions are logged with error messages

## Testing

Test the audit system by:

1. **Performing actions** across different user types
2. **Checking audit logs** in the admin panel
3. **Verifying filters** work correctly
4. **Testing exports** (CSV/PDF)
5. **Checking real-time updates**

This comprehensive audit system ensures complete tracking of all user activities across the entire Silario Dental Clinic system.
