// src/components/ProtectedRoute.jsx
import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './layouts/Sidebar';
import Header from './layouts/Header';
import LoadingSpinner from './common/LoadingSpinner';

const ProtectedRoute = ({ role }) => {
  const { user, userRole, loading, authError } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Show a more detailed loading screen that provides debug info
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center p-8 bg-white rounded-lg shadow-md">
          <LoadingSpinner />
          <p className="mt-4 text-lg font-medium text-gray-700">
            Verifying your account...
          </p>
          <p className="mt-2 text-sm text-gray-500">
            This may take a few moments. Please wait.
          </p>
        </div>
      </div>
    );
  }

  // If there was an authentication error
  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full">
          <h2 className="text-xl font-bold text-red-600 mb-4">Authentication Error</h2>
          <p className="text-gray-700 mb-4">
            There was a problem authenticating your account. Please try logging in again.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Error details: {authError.message || "Unknown error"}
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  // If not logged in, redirect to login page
  if (!user) {
    console.log("ProtectedRoute: No user found, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  // If a specific role is required and user doesn't have it, redirect to their proper dashboard
  if (role && userRole !== role) {
    console.log(`ProtectedRoute: User role (${userRole}) doesn't match required role (${role}), redirecting`);
    
    // Redirect to the appropriate dashboard based on the user's role
    switch (userRole) {
      case 'admin':
        return <Navigate to="/admin/dashboard" replace />;
      case 'doctor':
        return <Navigate to="/doctor/dashboard" replace />;
      case 'staff':
        return <Navigate to="/staff/dashboard" replace />;
      case 'patient':
        return <Navigate to="/patient/dashboard" replace />;
      default:
        // If role is unknown for some reason, send to home
        console.warn("Unknown user role:", userRole);
        return <Navigate to="/" replace />;
    }
  }

  console.log(`ProtectedRoute: User authorized with role (${userRole}), rendering content`);
  
  // User is authenticated and has the correct role, render the protected content
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
        role={userRole} 
        isMobileMenuOpen={isMobileMenuOpen} 
        setIsMobileMenuOpen={setIsMobileMenuOpen} 
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header 
          role={userRole} 
          isMobileMenuOpen={isMobileMenuOpen} 
          setIsMobileMenuOpen={setIsMobileMenuOpen} 
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ProtectedRoute;