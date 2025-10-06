// src/components/PublicRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './common/LoadingSpinner';

/**
 * Public route component that redirects authenticated users to their respective dashboards
 * and allows unauthenticated users to access public pages
 */
const PublicRoute = () => {
  const { user, userRole, loading, authError } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="flex flex-col items-center p-8 bg-white rounded-lg shadow-md">
          <LoadingSpinner />
          <p className="mt-4 text-lg font-medium text-gray-700">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // If there was an authentication error, still allow access to public routes
  if (authError) {
    console.warn("Auth error in PublicRoute:", authError);
    // Continue to public route anyway since auth errors shouldn't block public pages
  }

  // If user is authenticated, redirect to their dashboard based on role
  if (user) {
    console.log("PublicRoute: User authenticated, redirecting to dashboard");
    
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
        console.warn("Unknown user role in PublicRoute:", userRole);
        // If role is unknown, still redirect to home page
        return <Navigate to="/" replace />;
    }
  }

  // Not authenticated, show the public route
  console.log("PublicRoute: No authenticated user, showing public content");
  return <Outlet />;
};

export default PublicRoute;