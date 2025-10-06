// src/App.jsx - Updated with NotificationProvider and routes
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ClinicProvider } from './contexts/ClinicContext';
import { NotificationProvider } from './contexts/NotificationContext';
import DebugLockoutFix from './components/common/DebugLockoutFix';

// Public Pages
import Home from './pages/public/Home';
import About from './pages/public/About';
import Services from './pages/public/Services';
import Contact from './pages/public/Contact';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// Common Pages
import NotificationsPage from './components/common/Notifications';
import NotificationSettings from './components/common/NotificationSettings';

// Private Pages - Admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminUserManagement from './pages/admin/UserManagement';
import AdminAppointments from './pages/admin/Appointments';
import AdminBilling from './pages/admin/Billing';
import AdminEditInvoice from './pages/admin/EditInvoice';
import AdminServiceManagement from './pages/admin/ServiceManagement';
import CommonQueueManagement from './components/common/QueueManagement';
import AdminReports from './pages/admin/Reports';
import AdminSettings from './pages/admin/Settings';
import AdminAnalytics from './pages/admin/Analytics';
import AuditLogs from './pages/admin/AuditLogs';

// Private Pages - Doctor
import DoctorDashboard from './pages/doctor/Dashboard';
import DoctorAppointments from './pages/doctor/Appointments';
import DoctorPatientRecords from './pages/doctor/PatientRecords';
import PatientsList from './pages/doctor/PatientsList';
import DoctorEmergencyCases from './pages/doctor/EmergencyCases';
// import DoctorQueueManagement from './pages/doctor/QueueManagement'; // Using common component
import DoctorBilling from './pages/doctor/Billing';
import EditInvoice from './pages/doctor/EditInvoice';
import DoctorSettings from './pages/doctor/Settings';
import DoctorAnalytics from './pages/doctor/Analytics';
import DentalChart from './pages/doctor/DentalChart';

// Private Pages - Staff
import StaffDashboard from './pages/staff/Dashboard';
import StaffAppointments from './pages/staff/Appointments';
// import StaffQueueManagement from './pages/staff/QueueManagement'; // Using common component
import StaffPatientRecords from './pages/staff/PatientRecords';
import StaffPatientsList from './pages/staff/PatientsList';
import StaffSettings from './pages/staff/Settings';
import StaffDentalChart from './pages/staff/DentalChart';
import StaffEditInvoice from './pages/staff/EditInvoice';
import StaffPaymentsPage from './pages/staff/ManagePayments';
import StaffTreatmentHistory from './pages/staff/TreatmentHistory';

// Private Pages - Patient
import PatientDashboard from './pages/patient/Dashboard';
import PatientProfile from './pages/patient/Profile';
import PatientServices from './pages/patient/Services';
import PatientAppointments from './pages/patient/Appointments';
import PatientPayments from './pages/patient/Payments';
import PatientHistory from './pages/patient/History';
import PatientDentalChart from './pages/patient/DentalChart';
import PatientAnalytics from './pages/patient/Analytics';
import PatientSettings from './pages/patient/Settings';
// Patient Records (combined) and Treatment History standalone
import MyDentalRecords from './pages/patient/MyDentalRecords';
import PatientTreatmentHistory from './pages/patient/TreatmentHistory';


// Shared Components
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import NotFound from './pages/NotFound';

// Import supabase to check for persistent sessions at startup
import supabase from './config/supabaseClient';

function App() {
  const [appReady, setAppReady] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Check for debug mode
  const isDebugMode = new URLSearchParams(window.location.search).get('debug') === 'unlock';

  // Add extra initialization to ensure auth is ready
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Force refresh the session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error during initialization:', error);
          // Clear any potentially corrupted state if there's an error
          try {
            await supabase.auth.signOut();
          } catch (e) {
            console.error('Error during cleanup signout:', e);
          }
        }
        
        console.log('Auth initialized, session:', data?.session ? 'Present' : 'None');
      } catch (e) {
        console.error('Error during auth initialization:', e);
      } finally {
        setAuthInitialized(true);
      }
    };

    initializeAuth();
  }, []);

  // Only show the app once auth is initialized to prevent flashes
  useEffect(() => {
    if (authInitialized) {
      setAppReady(true);
    }
  }, [authInitialized]);

  if (!appReady && !isDebugMode) {
    // Simple initial loading screen
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <ClinicProvider>
        <NotificationProvider>
          <Router>
            {/* Always render the debug helper - it will only show when URL has ?debug=unlock */}
            <DebugLockoutFix />
            
            <Routes>
              {/* Public Routes - Will redirect to dashboard if logged in */}
              <Route element={<PublicRoute />}>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/services" element={<Services />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
              </Route>

              {/* Common Protected Routes - Accessible by all authenticated users */}
              <Route path="/notifications" element={<ProtectedRoute />}>
                <Route index element={<NotificationsPage />} />
                <Route path="settings" element={<NotificationSettings />} />
              </Route>

              {/* Admin Routes */}
              <Route path="/admin" element={<ProtectedRoute role="admin" />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<AdminUserManagement />} />
                <Route path="appointments" element={<AdminAppointments />} />
                <Route path="billing" element={<AdminBilling />} />
                <Route path="billing/edit/:invoiceId" element={<AdminEditInvoice />} />
                <Route path="services" element={<AdminServiceManagement />} />
                <Route path="queue" element={<CommonQueueManagement />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="audit-logs" element={<AuditLogs />} />
                {/* Admin notification routes */}
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="notifications/settings" element={<NotificationSettings />} />
              </Route>

              {/* Doctor Routes */}
              <Route path="/doctor" element={<ProtectedRoute role="doctor" />}>
                <Route index element={<Navigate to="/doctor/dashboard" replace />} />
                <Route path="dashboard" element={<DoctorDashboard />} />
                <Route path="appointments" element={<DoctorAppointments />} />
                <Route path="patients" element={<PatientsList />} />
                <Route path="patients/:patientId" element={<DoctorPatientRecords />} />
                <Route path="patients/:patientId/dental-chart" element={<DentalChart />} />
                <Route path="emergencies" element={<DoctorEmergencyCases />} />
                <Route path="queue" element={<CommonQueueManagement />} />
                <Route path="billing" element={<DoctorBilling />} />
                <Route path="billing/edit/:invoiceId" element={<EditInvoice />} />
                <Route path="settings" element={<DoctorSettings />} />
                <Route path="analytics" element={<DoctorAnalytics />} />
                {/* Doctor notification routes */}
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="notifications/settings" element={<NotificationSettings />} />
              </Route>

              {/* Staff Routes */}
              <Route path="/staff" element={<ProtectedRoute role="staff" />}>
                <Route index element={<Navigate to="/staff/dashboard" replace />} />
                <Route path="dashboard" element={<StaffDashboard />} />
                <Route path="appointments" element={<StaffAppointments />} />
                <Route path="queue" element={<CommonQueueManagement />} />
                <Route path="patients" element={<StaffPatientsList />} />
                <Route path="patients/:patientId" element={<StaffPatientRecords />} />
                <Route path="patients/:patientId/dental-chart" element={<StaffDentalChart />} />
                <Route path="patients/:patientId/dental-chart/edit" element={<StaffDentalChart editMode={true} />} />
                <Route path="billing/edit/:invoiceId" element={<StaffEditInvoice />} />
                <Route path="settings" element={<StaffSettings />} />
                <Route path="payments" element={<StaffPaymentsPage />} />
                <Route path="patients/:patientId/treatments" element={<StaffTreatmentHistory />} />
                {/* Staff notification routes */}
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="notifications/settings" element={<NotificationSettings />} />
              </Route>

              {/* Patient Routes */}
              <Route path="/patient" element={<ProtectedRoute role="patient" />}>
                <Route index element={<Navigate to="/patient/dashboard" replace />} />
                <Route path="dashboard" element={<PatientDashboard />} />
                <Route path="profile" element={<PatientProfile />} />
                <Route path="services" element={<PatientServices />} />
                <Route path="appointments" element={<PatientAppointments />} />
                <Route path="payments" element={<PatientPayments />} />
                {/* Treatment history for logged-in patient */}
                <Route path="history" element={<PatientTreatmentHistory />} />
                <Route path="treatments" element={<PatientTreatmentHistory />} />
                {/* My dental records (combined view) */}
                <Route path="records" element={<MyDentalRecords />} />
                <Route path="patient-records" element={<MyDentalRecords />} />
                {/* Interactive chart editor */}
                <Route path="dental-chart" element={<PatientDentalChart />} />
                <Route path="settings" element={<PatientSettings />} />
                <Route path="analytics" element={<PatientAnalytics />} />
                {/* Patient notification routes */}
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="notifications/settings" element={<NotificationSettings />} />
              </Route>

              {/* 404 Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <ToastContainer position="top-right" autoClose={3000} />
          </Router>
        </NotificationProvider>
      </ClinicProvider>
    </AuthProvider>
  );
}

export default App;