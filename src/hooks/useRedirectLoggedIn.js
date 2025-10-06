// src/hooks/useRedirectLoggedIn.js
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Custom hook to redirect logged-in users to their appropriate dashboard
 * Can be used in public pages to prevent logged-in users from accessing them
 */
const useRedirectLoggedIn = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return; // Wait until auth state is loaded
    
    if (user) {
      // Redirect based on role
      switch (userRole) {
        case 'admin':
          navigate('/admin/dashboard', { replace: true });
          break;
        case 'doctor':
          navigate('/doctor/dashboard', { replace: true });
          break;
        case 'staff':
          navigate('/staff/dashboard', { replace: true });
          break;
        case 'patient':
          navigate('/patient/dashboard', { replace: true });
          break;
        default:
          navigate('/', { replace: true });
      }
    }
  }, [user, userRole, loading, navigate]);

  return { isLoggedIn: !!user, isLoading: loading };
};

export default useRedirectLoggedIn;