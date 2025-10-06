# Comprehensive Audit Integration Guide

This guide provides step-by-step instructions for implementing universal audit logging across all pages in the Silario Dental Clinic system.

## Quick Integration Steps

### 1. Import Universal Audit Hook

Replace existing audit imports with the universal audit hook:

```javascript
// OLD
import { useAuditLog } from '../../hooks/useAuditLog';

// NEW
import { useUniversalAudit } from '../../hooks/useUniversalAudit';
```

### 2. Update Hook Usage

```javascript
// OLD
const { logSettingsUpdate } = useAuditLog();

// NEW
const { logSettingsView, logSettingsUpdate, logProfileUpdate, logProfilePictureUpdate } = useUniversalAudit();
```

### 3. Add Page View Logging

Add to the main useEffect in each page:

```javascript
useEffect(() => {
  // Log page view
  logPageView('Page Name', 'module', 'section');
  
  // Existing page logic...
}, [logPageView]);
```

## Page-by-Page Integration

### Admin Pages

#### 1. Admin Dashboard (`src/pages/admin/Dashboard.jsx`)
```javascript
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

#### 2. User Management (`src/pages/admin/UserManagement.jsx`)
```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const UserManagement = () => {
  const { logPageView, logUserCreate, logUserUpdate, logUserDelete } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('User Management', 'user_management', 'management');
  }, [logPageView]);
  
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

#### 3. Admin Appointments (`src/pages/admin/Appointments.jsx`)
```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const Appointments = () => {
  const { logPageView, logAppointmentView, logAppointmentCreate, logAppointmentUpdate } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('Admin Appointments', 'appointments', 'management');
  }, [logPageView]);
  
  const handleViewAppointment = async (appointment) => {
    await logAppointmentView(appointment);
  };
  
  const handleCreateAppointment = async (appointmentData) => {
    await logAppointmentCreate(appointmentData);
  };
};
```

#### 4. Admin Billing (`src/pages/admin/Billing.jsx`)
```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const Billing = () => {
  const { logPageView, logBillingView, logPaymentCreate, logPaymentUpdate } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('Admin Billing', 'billing', 'management');
  }, [logPageView]);
  
  const handleViewInvoice = async (invoice) => {
    await logBillingView(invoice);
  };
  
  const handleCreatePayment = async (paymentData) => {
    await logPaymentCreate(paymentData);
  };
};
```

### Doctor Pages

#### 1. Doctor Dashboard (`src/pages/doctor/Dashboard.jsx`)
```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const DoctorDashboard = () => {
  const { logPageView, logAppointmentView, logQueueView } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('Doctor Dashboard', 'dashboard', 'main');
  }, [logPageView]);
  
  const handleViewAppointment = async (appointment) => {
    await logAppointmentView(appointment);
  };
  
  const handleViewQueue = async (queueData) => {
    await logQueueView(queueData);
  };
};
```

#### 2. Doctor Appointments (`src/pages/doctor/Appointments.jsx`)
```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const DoctorAppointments = () => {
  const { logPageView, logAppointmentView, logAppointmentUpdate } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('Doctor Appointments', 'appointments', 'management');
  }, [logPageView]);
  
  const handleUpdateAppointment = async (appointment, oldValues, newValues) => {
    await logAppointmentUpdate(appointment, oldValues, newValues);
  };
};
```

#### 3. Doctor Medical Records (`src/pages/doctor/MedicalRecords.jsx`)
```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const DoctorMedicalRecords = () => {
  const { logPageView, logMedicalRecordView, logMedicalRecordUpdate, logTreatmentAdd } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('Medical Records', 'medical_records', 'management');
  }, [logPageView]);
  
  const handleAddTreatment = async (treatmentData) => {
    await logTreatmentAdd(treatmentData);
  };
};
```

#### 4. Doctor Dental Chart (`src/pages/doctor/DentalChart.jsx`)
```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const DoctorDentalChart = () => {
  const { logPageView, logMedicalRecordView, logDentalChartUpdate } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('Dental Chart', 'medical_records', 'chart');
  }, [logPageView]);
  
  const handleChartUpdate = async (chartData, oldValues, newValues) => {
    await logDentalChartUpdate(chartData, oldValues, newValues);
  };
};
```

### Staff Pages

#### 1. Staff Dashboard (`src/pages/staff/Dashboard.jsx`)
```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const StaffDashboard = () => {
  const { logPageView } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('Staff Dashboard', 'dashboard', 'main');
  }, [logPageView]);
};
```

#### 2. Staff Queue (`src/pages/staff/Queue.jsx`)
```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const StaffQueue = () => {
  const { logPageView, logQueueView, logQueueAdd, logQueueStatusUpdate } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('Queue Management', 'queue', 'management');
  }, [logPageView]);
  
  const handleAddToQueue = async (queueData) => {
    await logQueueAdd(queueData);
  };
  
  const handleUpdateQueueStatus = async (queueData, oldStatus, newStatus) => {
    await logQueueStatusUpdate(queueData, oldStatus, newStatus);
  };
};
```

### Patient Pages

#### 1. Patient Dashboard (`src/pages/patient/Dashboard.jsx`)
```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const PatientDashboard = () => {
  const { logPageView } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('Patient Dashboard', 'dashboard', 'main');
  }, [logPageView]);
};
```

#### 2. Patient Appointments (`src/pages/patient/Appointments.jsx`)
```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const PatientAppointments = () => {
  const { logPageView, logAppointmentView, logAppointmentCreate } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('Patient Appointments', 'appointments', 'booking');
  }, [logPageView]);
  
  const handleBookAppointment = async (appointmentData) => {
    await logAppointmentCreate(appointmentData);
  };
};
```

#### 3. Patient Medical Records (`src/pages/patient/MyDentalRecords.jsx`)
```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const PatientMedicalRecords = () => {
  const { logPageView, logMedicalRecordView } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('My Medical Records', 'medical_records', 'viewing');
  }, [logPageView]);
  
  const handleViewRecord = async (record) => {
    await logMedicalRecordView(record);
  };
};
```

#### 4. Patient Dental Chart (`src/pages/patient/DentalChart.jsx`)
```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const PatientDentalChart = () => {
  const { logPageView, logMedicalRecordView } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('My Dental Chart', 'medical_records', 'chart');
  }, [logPageView]);
  
  const handleViewChart = async (chartData) => {
    await logMedicalRecordView(chartData);
  };
};
```

#### 5. Patient Payments (`src/pages/patient/Payments.jsx`)
```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const PatientPayments = () => {
  const { logPageView, logBillingView, logPaymentCreate } = useUniversalAudit();
  
  useEffect(() => {
    logPageView('Patient Payments', 'billing', 'payments');
  }, [logPageView]);
  
  const handleCreatePayment = async (paymentData) => {
    await logPaymentCreate(paymentData);
  };
};
```

## Authentication Integration

### Login Component
```javascript
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

## Settings Integration

### All Settings Pages
```javascript
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const Settings = () => {
  const { logSettingsView, logProfileUpdate, logProfilePictureUpdate, logPasswordChange } = useUniversalAudit();
  
  useEffect(() => {
    logSettingsView('Settings Type'); // admin, doctor, staff, patient
  }, [logSettingsView]);
  
  const handleProfileUpdate = async (userData, oldValues, newValues) => {
    await logProfileUpdate(userData, oldValues, newValues);
  };
  
  const handlePasswordChange = async (userData) => {
    await logPasswordChange(userData);
  };
};
```

## Automated Integration Script

Create a script to automatically apply audit logging to all pages:

```javascript
// scripts/applyAuditLogging.js
const fs = require('fs');
const path = require('path');

const pagesToUpdate = [
  'src/pages/admin/Dashboard.jsx',
  'src/pages/admin/UserManagement.jsx',
  'src/pages/admin/Appointments.jsx',
  'src/pages/admin/Billing.jsx',
  'src/pages/doctor/Dashboard.jsx',
  'src/pages/doctor/Appointments.jsx',
  'src/pages/doctor/MedicalRecords.jsx',
  'src/pages/doctor/DentalChart.jsx',
  'src/pages/staff/Dashboard.jsx',
  'src/pages/staff/Queue.jsx',
  'src/pages/patient/Dashboard.jsx',
  'src/pages/patient/Appointments.jsx',
  'src/pages/patient/MyDentalRecords.jsx',
  'src/pages/patient/DentalChart.jsx',
  'src/pages/patient/Payments.jsx'
];

// Apply audit logging to each page
pagesToUpdate.forEach(pagePath => {
  // Implementation would go here
  console.log(`Applying audit logging to ${pagePath}`);
});
```

## Testing the Integration

### 1. Test Page Views
- Navigate to each page
- Check audit logs for page view entries
- Verify user role and page information is correct

### 2. Test Actions
- Perform CRUD operations
- Check audit logs for action entries
- Verify old/new values are logged correctly

### 3. Test Filters
- Use audit logs page filters
- Filter by user role (admin, doctor, staff, patient)
- Filter by action type
- Filter by module

### 4. Test Exports
- Export audit logs to CSV
- Export audit logs to PDF
- Verify all user activities are included

## Benefits of Universal Audit System

✅ **Complete User Activity Tracking** - All users across all roles  
✅ **Comprehensive Audit Trail** - Every action is logged  
✅ **Enhanced Security** - Track all system access and changes  
✅ **Better Debugging** - Error logging and system monitoring  
✅ **Compliance Ready** - Full audit trail for regulatory requirements  
✅ **User Behavior Analytics** - Understand how users interact with the system  
✅ **Security Monitoring** - Detect suspicious activities  
✅ **System Performance** - Track system usage patterns  

This comprehensive audit system ensures complete tracking of all user activities across the entire Silario Dental Clinic system.