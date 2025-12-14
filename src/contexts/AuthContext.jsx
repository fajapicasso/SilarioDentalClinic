// src/contexts/AuthContext.jsx - Fixed password reset flow
import React, { createContext, useContext, useState, useEffect } from 'react';
import supabase from '../config/supabaseClient';
import { toast } from 'react-toastify';
import { createClient } from '@supabase/supabase-js';
import emailService from '../services/emailService';
import logger from '../utils/logger';

// Create admin client for bypassing RLS during registration (only if service role key exists)
let supabaseAdmin = null;
if (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  );
  logger.log("Admin client created successfully");
} else {
  logger.log("Service role key not found, admin client not created");
}

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Helper function to check if current URL is a password reset flow
  const isPasswordResetFlow = () => {
    const hash = window.location.hash;
    const pathname = window.location.pathname;
    return pathname.includes('reset-password') || 
           hash.includes('type=recovery') ||
           hash.includes('access_token');
  };

  useEffect(() => {
    // Check for active session on component mount
    const checkSession = async () => {
      try {
        logger.log("Checking session...");
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error("Session check error:", error);
          setAuthError(error);
          setLoading(false);
          return;
        }

        if (data?.session) {
          logger.log("Session found:", data.session.user.id);
          
          // Check if this is a password reset flow
          if (isPasswordResetFlow()) {
            logger.log("Password reset flow detected - not setting user state on mount");
            setLoading(false);
            return;
          }
          
          // Fetch user profile to check disabled status and role
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('role, full_name, disabled')
              .eq('id', data.session.user.id)
              .single();
            
            if (profileError) {
              logger.error("Profile fetch error:", profileError);
            }
            
            // Check if user is disabled
            if (profileData && profileData.disabled === true) {
              logger.warn("User account is disabled:", data.session.user.id);
              await supabase.auth.signOut();
              toast.error('Your account has been disabled. Please contact an administrator.');
              setUser(null);
              setUserRole(null);
            } else if (profileData) {
              setUser(data.session.user);
              logger.log("User role found:", profileData.role);
              setUserRole(profileData.role);
            } else {
              logger.warn("No profile found for user:", data.session.user.id);
              setUser(data.session.user);
              setUserRole('patient');
            }
          } catch (profileFetchError) {
            logger.error("Error in profile fetch:", profileFetchError);
            setUser(data.session.user);
          }
        } else {
          logger.log("No active session found");
        }
      } catch (error) {
        logger.error('Error checking session:', error.message);
        setAuthError(error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.log("Auth state changed:", event);
      
      if (session) {
        logger.log("New session established for user:", session.user.id);
        
        // CRITICAL FIX: Check if this is a password reset flow
        // Don't auto-login for password reset flows
        if (isPasswordResetFlow() && event !== 'SIGNED_IN') {
          logger.log("Password reset flow detected - not setting user state");
          setLoading(false);
          return;
        }
        
        // For password recovery events, don't auto-login
        if (event === 'PASSWORD_RECOVERY') {
          logger.log("Password recovery event - not setting user state");
          setLoading(false);
          return;
        }
        
        // Check for disabled status
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('role, full_name, disabled')
            .eq('id', session.user.id)
            .single();
          
          if (!profileError && profileData) {
            if (profileData.disabled === true) {
              logger.warn("Disabled user attempted to log in:", session.user.id);
              await supabase.auth.signOut();
              toast.error('Your account has been disabled. Please contact an administrator.');
              setUser(null);
              setUserRole(null);
            } else {
              setUser(session.user);
              logger.log("User role updated:", profileData.role);
              setUserRole(profileData.role);
            }
          } else {
            logger.warn("Could not fetch role on auth change:", profileError);
            setUser(session.user);
            setUserRole(userRole || 'patient');
          }
        } catch (profileError) {
          logger.error("Error getting role on auth change:", profileError);
          setUser(session.user);
        }
      } else {
        logger.log("Session ended, clearing user data");
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => {
      logger.log("Cleaning up auth subscription");
      authListener.subscription.unsubscribe();
    };
  }, []);

  const register = async (email, password, userData) => {
    try {
      setLoading(true);
      logger.log("Registering new user:", email);
      
      const first_name = userData.first_name || '';
      const middle_name = userData.middle_name || '';
      const last_name = userData.last_name || '';
      const street = userData.street || '';
      const barangay = userData.barangay || '';
      const city = userData.city || '';
      const province = userData.province || '';
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: userData.full_name,
            first_name: first_name,
            middle_name: middle_name,
            last_name: last_name,
            phone: userData.phone || '',
            address: userData.address || '',
            street: street,
            barangay: barangay,
            city: city,
            province: province,
            birthday: userData.birthday ? new Date(userData.birthday).toISOString().split('T')[0] : '',
            age: userData.age ? userData.age.toString() : '',
            gender: userData.gender || '',
            role: 'patient'
          }
        }
      });

      if (error) {
        logger.error("Registration error:", error);
        throw error;
      }

      if (data?.user) {
        logger.log("User created successfully:", data.user.id);
        logger.log("Registration completed successfully");
        toast.success('Registration successful! Please check your email to verify your account.');
        return { success: true };
      }
    } catch (error) {
      logger.error("Registration process failed:", error);
      
      if (error.message && error.message.includes('row-level security')) {
        toast.warning('Account created! Please check your email to verify your account before logging in.');
        return { success: true };
      }
      
      toast.error(error.message || 'Registration failed. Please try again.');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setLoading(true);
      logger.log("Attempting login for:", email);
      
      const { data: emailCheck, error: emailCheckError } = await supabase
        .from('profiles')
        .select('disabled')
        .eq('email', email)
        .single();
        
      if (!emailCheckError && emailCheck && emailCheck.disabled === true) {
        logger.warn("Attempt to login to disabled account:", email);
        throw new Error('Your account has been disabled. Please contact an administrator.');
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logger.error("Login error:", error);
        throw error;
      }

      if (data?.user) {
        logger.log("Login successful for user:", data.user.id);
        
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('role, full_name, disabled')
            .eq('id', data.user.id)
            .single();
          
          if (profileError) {
            logger.error("Error fetching profile after login:", profileError);
            throw profileError;
          }
          
          if (profileData.disabled === true) {
            logger.warn("Disabled user logged in, forcing logout:", data.user.id);
            await supabase.auth.signOut();
            throw new Error('Your account has been disabled. Please contact an administrator.');
          }
          
          setUser(data.user);
          logger.log("Setting user role:", profileData.role);
          setUserRole(profileData.role);
          toast.success(`Welcome back, ${profileData.full_name}!`);
          return { success: true, role: profileData.role };
        } catch (profileError) {
          logger.error("Profile fetch failed after login:", profileError);
          
          if (profileError.message && profileError.message.includes('disabled')) {
            await supabase.auth.signOut();
            throw profileError;
          }
          
          setUser(data.user);
          toast.success(`Welcome back!`);
          return { success: true, role: 'patient' };
        }
      }
    } catch (error) {
      logger.error("Login process failed:", error);
      toast.error(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      logger.log("Logging out user");
      const { error } = await supabase.auth.signOut();
      if (error && error.message !== "auth session missing!") {
        logger.error("Logout error:", error);
        throw error;
      }
      logger.log("Logout successful");
      setUser(null);
      setUserRole(null);
      toast.success('Logged out successfully');
      return { success: true };
    } catch (error) {
      if (error.message !== "auth session missing!") {
        logger.error("Logout process failed:", error);
        toast.error(error.message);
      }
      setUser(null);
      setUserRole(null);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordResetToken = async (email) => {
    try {
      setLoading(true);
      logger.log("Password reset token requested for:", email);
      
      // Use Supabase's built-in password reset email system
      logger.log("Requesting password reset via Supabase for email:", email);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        logger.error("Password reset error:", error);
        if (error.message.includes('User not found') || error.message.includes('not found')) {
          throw new Error('No account found with this email address.');
        } else if (error.message.includes('disabled')) {
          throw new Error('This account has been disabled. Please contact an administrator.');
        }
        throw error;
      }
      
      logger.log("Password reset email sent successfully via Supabase");
      return { 
        success: true, 
        message: 'Password reset instructions have been sent to your email. Please check your inbox.'
      };
    } catch (error) {
      logger.error("Password reset token request failed:", error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Helper function to handle password update after OTP verification
  const handlePasswordUpdate = async (userId, email, newPassword) => {
    try {
      // Get user profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name, email')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        logger.error("Profile fetch error:", profileError);
        throw new Error('Failed to fetch user profile');
      }
      
      // Update the user's password in Supabase Auth
      logger.log("Attempting to update password for user:", userId);
      
      if (!supabaseAdmin) {
        logger.error("Service role key not available - cannot update password");
        throw new Error('Password reset is not properly configured. Please contact support.');
      }
      
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );
      
      if (updateError) {
        logger.error("Password update error:", updateError);
        logger.error("Error details:", updateError.message);
        throw new Error(`Failed to update password: ${updateError.message}`);
      }
      
      logger.log("Password updated successfully for user:", userId);
      
      // Log the user in after successful password reset
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: profileData.email,
        password: newPassword,
      });
      
      if (loginError) {
        logger.error("Auto-login after password reset failed:", loginError);
        // Password was updated successfully, but auto-login failed
        return { 
          success: true, 
          role: profileData.role,
          message: 'Password reset successfully! Please login with your new password.',
          autoLoginFailed: true 
        };
      }
      
      // Set user state
      setUser(loginData.user);
      setUserRole(profileData.role);
      
      logger.log("Password reset and auto-login successful");
      return { success: true, role: profileData.role };
      
    } catch (error) {
      logger.error("Password update error:", error);
      return { success: false, error: error.message };
    }
  };

  const resetPasswordWithToken = async (email, token, newPassword) => {
    try {
      setLoading(true);
      logger.log("Attempting to reset password with token for:", email);
      logger.log("Token provided:", token);
      
      // Validate the custom token using database function
      const { data: validationData, error: validationError } = await supabase
        .rpc('validate_password_reset_token', {
          user_email: email.toLowerCase().trim(),
          reset_token: token.trim()
        });
      
      if (validationError) {
        logger.error("Token validation error:", validationError);
        throw new Error(`Token validation failed: ${validationError.message}`);
      }
      
      if (!validationData || validationData.length === 0) {
        throw new Error('Invalid reset code. Please check the 6-digit code from your email.');
      }
      
      const validationResult = validationData[0];
      
      if (!validationResult.is_valid) {
        throw new Error(validationResult.message || 'Invalid or expired reset code.');
      }
      
      const userId = validationResult.user_id;
      logger.log("Token validated successfully for user:", userId);
      
      // Update password using admin client (requires service role key)
      if (!supabaseAdmin) {
        logger.error("Service role key not available - cannot update password");
        throw new Error('Password reset is not properly configured. Please contact support.');
      }
      
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );
      
      if (updateError) {
        logger.error("Password update error:", updateError);
        throw new Error(`Failed to update password: ${updateError.message}`);
      }
      
      logger.log("Password updated successfully for user:", userId);
      
      // Get user profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name, email')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        logger.error("Profile fetch error:", profileError);
        throw new Error('Failed to fetch user profile');
      }
      
      // Log the user in after successful password reset
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: profileData.email,
        password: newPassword,
      });
      
      if (loginError) {
        logger.error("Auto-login after password reset failed:", loginError);
        // Password was updated successfully, but auto-login failed
        return { 
          success: true, 
          role: profileData.role,
          message: 'Password reset successfully! Please login with your new password.',
          autoLoginFailed: true 
        };
      }
      
      // Set user state
      setUser(loginData.user);
      setUserRole(profileData.role);
      
      logger.log("Password reset and auto-login successful");
      return { success: true, role: profileData.role };
      
    } catch (error) {
      logger.error("Password reset with token failed:", error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };


  const changePassword = async (currentPassword, newPassword) => {
    try {
      setLoading(true);
      logger.log("Attempting to change password");
      
      if (!user) {
        throw new Error('You must be logged in to change your password.');
      }
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('disabled')
        .eq('id', user.id)
        .single();
      
      if (!profileError && profileData && profileData.disabled === true) {
        logger.warn("Password change attempted for disabled account:", user.id);
        throw new Error('This account has been disabled. Please contact an administrator.');
      }
      
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      
      if (signInError) {
        logger.error("Current password verification failed:", signInError);
        throw new Error('Current password is incorrect. Please try again.');
      }
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      if (error) {
        logger.error("Password update error:", error);
        throw error;
      }
      
      logger.log("Password updated successfully");
      toast.success('Password updated successfully');
      return { success: true };
    } catch (error) {
      logger.error("Password change process failed:", error);
      toast.error(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profileData) => {
    try {
      setLoading(true);
      logger.log("Updating profile for user:", user?.id);
      
      const { disabled, ...safeProfileData } = profileData;
      
      const { error } = await supabase
        .from('profiles')
        .update(safeProfileData)
        .eq('id', user.id);
      
      if (error) {
        logger.error("Profile update error:", error);
        throw error;
      }
      
      logger.log("Profile updated successfully");
      toast.success('Profile updated successfully');
      return { success: true };
    } catch (error) {
      logger.error("Profile update process failed:", error);
      toast.error(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    userRole,
    loading,
    authError,
    register,
    login,
    logout,
    requestPasswordResetToken,
    resetPasswordWithToken,
    changePassword,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}