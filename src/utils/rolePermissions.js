// src/utils/rolePermissions.js

/**
 * Role Permissions for Silario Dental Clinic System
 * This utility helps manage role-based permissions across the application
 */

// Define permission sets for different roles
const rolePermissions = {
    admin: {
      // User Management
      manageUsers: true,
      addUsers: true,
      editUsers: true,
      archiveUsers: true,
      resetPasswords: true,
      
      // Doctor Management
      manageDoctors: true,
      assignDoctorSchedules: true,
      editDoctorSpecialties: true,
      
      // Staff Management
      manageStaff: true,
      assignStaffRoles: true,
      
      // Patient Management
      managePatients: true,
      viewPatientRecords: true,
      editPatientRecords: true,
      
      // Appointments
      viewAllAppointments: true,
      manageAppointments: true,
      cancelAppointments: true,
      
      // Treatments
      viewAllTreatments: true,
      manageTreatments: true,
      
      // Billing & Payments
      viewAllInvoices: true,
      createInvoices: true,
      managePayments: true,
      
      // Clinic Settings
      manageClinicSettings: true,
      manageServicePricing: true,
      manageWorkingHours: true,
      
      // Reports
      viewFinancialReports: true,
      viewPatientReports: true,
      exportReports: true
    },
    
    doctor: {
      // User Management
      manageUsers: false,
      addUsers: false,
      editUsers: false,
      archiveUsers: false,
      resetPasswords: false,
      
      // Doctor Management
      manageDoctors: false,
      assignDoctorSchedules: false,
      editDoctorSpecialties: false,
      
      // Staff Management
      manageStaff: false,
      assignStaffRoles: false,
      
      // Patient Management
      managePatients: false,
      viewPatientRecords: true,
      editPatientRecords: true,
      
      // Appointments
      viewAllAppointments: true,
      manageAppointments: true,
      cancelAppointments: true,
      
      // Treatments
      viewAllTreatments: true,
      manageTreatments: true,
      
      // Billing & Payments
      viewAllInvoices: true,
      createInvoices: false,
      managePayments: false,
      
      // Clinic Settings
      manageClinicSettings: false,
      manageServicePricing: false,
      manageWorkingHours: false,
      
      // Reports
      viewFinancialReports: false,
      viewPatientReports: true,
      exportReports: false
    },
    
    staff: {
      // User Management
      manageUsers: false,
      addUsers: false,
      editUsers: false,
      archiveUsers: false,
      resetPasswords: false,
      
      // Doctor Management
      manageDoctors: false,
      assignDoctorSchedules: false,
      editDoctorSpecialties: false,
      
      // Staff Management
      manageStaff: false,
      assignStaffRoles: false,
      
      // Patient Management
      managePatients: true,
      viewPatientRecords: true,
      editPatientRecords: true,
      
      // Appointments
      viewAllAppointments: true,
      manageAppointments: true,
      cancelAppointments: true,
      
      // Treatments
      viewAllTreatments: true,
      manageTreatments: false,
      
      // Billing & Payments
      viewAllInvoices: true,
      createInvoices: true,
      managePayments: true,
      
      // Clinic Settings
      manageClinicSettings: false,
      manageServicePricing: false,
      manageWorkingHours: false,
      
      // Reports
      viewFinancialReports: true,
      viewPatientReports: true,
      exportReports: true
    },
    
    patient: {
      // User Management
      manageUsers: false,
      addUsers: false,
      editUsers: false,
      archiveUsers: false,
      resetPasswords: false,
      
      // Doctor Management
      manageDoctors: false,
      assignDoctorSchedules: false,
      editDoctorSpecialties: false,
      
      // Staff Management
      manageStaff: false,
      assignStaffRoles: false,
      
      // Patient Management
      managePatients: false,
      viewPatientRecords: false,
      editPatientRecords: false,
      
      // Appointments
      viewAllAppointments: false,
      manageAppointments: false,
      cancelAppointments: false,
      
      // Treatments
      viewAllTreatments: false,
      manageTreatments: false,
      
      // Billing & Payments
      viewAllInvoices: false,
      createInvoices: false,
      managePayments: false,
      
      // Clinic Settings
      manageClinicSettings: false,
      manageServicePricing: false,
      manageWorkingHours: false,
      
      // Reports
      viewFinancialReports: false,
      viewPatientReports: false,
      exportReports: false
    }
  };
  
  /**
   * Check if a user has a specific permission based on their role
   * @param {string} role - The user's role (admin, doctor, staff, patient)
   * @param {string} permission - The permission to check
   * @returns {boolean} Whether the user has the permission
   */
  export const hasPermission = (role, permission) => {
    if (!role || !permission) return false;
    
    // Default to patient if role doesn't exist in our definitions
    const userRole = rolePermissions[role] || rolePermissions.patient;
    
    // Check if the permission exists for this role
    return userRole[permission] === true;
  };
  
  /**
   * Get all permissions for a specific role
   * @param {string} role - The role to check
   * @returns {Object} An object containing all permissions for this role
   */
  export const getRolePermissions = (role) => {
    if (!role || !rolePermissions[role]) {
      return rolePermissions.patient; // Default to patient permissions
    }
    
    return rolePermissions[role];
  };
  
  /**
   * Check if a user can access a specific page based on their role
   * @param {string} role - The user's role
   * @param {string} page - The page route to check access for
   * @returns {boolean} Whether the user can access the page
   */
  export const canAccessPage = (role, page) => {
    if (!role || !page) return false;
    
    // Define page access permissions
    const pageAccess = {
      '/admin': ['admin'],
      '/admin/users': ['admin'],
      '/admin/settings': ['admin'],
      '/admin/reports': ['admin'],
      
      '/doctor': ['doctor', 'admin'],
      '/doctor/appointments': ['doctor', 'admin'],
      '/doctor/patients': ['doctor', 'admin'],
      '/doctor/treatments': ['doctor', 'admin'],
      
      '/staff': ['staff', 'admin'],
      '/staff/appointments': ['staff', 'admin', 'doctor'],
      '/staff/patients': ['staff', 'admin', 'doctor'],
      '/staff/billing': ['staff', 'admin'],
      
      '/patient': ['patient', 'staff', 'doctor', 'admin'],
      '/patient/appointments': ['patient', 'staff', 'doctor', 'admin'],
      '/patient/treatments': ['patient', 'staff', 'doctor', 'admin'],
      '/patient/invoices': ['patient', 'staff', 'doctor', 'admin'],
      
      // Public pages accessible to all
      '/': true,
      '/login': true,
      '/register': true,
      '/forgot-password': true,
      '/services': true,
      '/contact': true,
    };
    
    // If the page is marked as true, it's accessible to everyone
    if (pageAccess[page] === true) return true;
    
    // Check if the user's role is in the list of allowed roles for this page
    return Array.isArray(pageAccess[page]) && pageAccess[page].includes(role);
  };
  
  export default {
    hasPermission,
    getRolePermissions,
    canAccessPage
  };