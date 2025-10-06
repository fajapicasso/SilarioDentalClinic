// src/config/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Check .env file');
}

console.log("Initializing Supabase client");

// Enhanced client with better options
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  // Add realtime subscription parameters
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  // Add global error handler
  global: {
    fetch: (...args) => fetch(...args)
  }
});

// Test connection on initialization, but don't block the app
(async function testConnection() {
  try {
    console.log("Testing Supabase connection...");
    // Simple health check
    const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('Supabase connection test failed:', error.message);
    } else {
      console.log('Supabase connection successful');
    }
  } catch (e) {
    console.error('Supabase connection test exception:', e);
  }
})();

// Add debug method to help with troubleshooting
supabase.debug = async function() {
  try {
    // Test auth
    const { data: authData, error: authError } = await this.auth.getSession();
    console.log("Auth status:", authError ? "Error" : "OK");
    console.log("Session present:", authData?.session ? "Yes" : "No");
    
    // Test database access
    const { data: dbData, error: dbError } = await this.from('profiles').select('count', { count: 'exact', head: true });
    console.log("Database access:", dbError ? "Error" : "OK");
    
    // Return debug info
    return {
      auth: { ok: !authError, error: authError, session: !!authData?.session },
      db: { ok: !dbError, error: dbError },
      config: { url: supabaseUrl ? "Present" : "Missing" }
    };
  } catch (e) {
    console.error("Debug method error:", e);
    return { error: e.message };
  }
};

/**
 * Utility to handle Supabase errors with better messaging
 * @param {Error} error - The error from Supabase
 * @param {string} defaultMessage - Fallback message
 * @returns {string} User-friendly error message
 */
export const handleSupabaseError = (error, defaultMessage = 'An error occurred') => {
  if (!error) return defaultMessage;
  
  console.error('Supabase error:', error);
  
  // Check for common error codes
  if (error.code === 'PGRST301') {
    return 'Access denied: you may not have permission to perform this action';
  } else if (error.code === '23505') {
    return 'This record already exists';
  } else if (error.code === '23503') {
    return 'This operation would violate database constraints';
  } else if (error.code === 'PGRST116') {
    return 'Database resource not found';
  } else if (error.message) {
    return error.message;
  }
  
  return defaultMessage;
};

/**
 * Get the current logged in user
 * @returns {Promise<object|null>} The user object or null if not logged in
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Error getting current user:', error);
      return null;
    }
    
    return user;
  } catch (e) {
    console.error('Exception getting current user:', e);
    return null;
  }
};

/**
 * Get the current user's profile with role information
 * @returns {Promise<object|null>} The profile object or null
 */
export const getCurrentUserProfile = async () => {
  try {
    const user = await getCurrentUser();
    
    if (!user) return null;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
    
    return data;
  } catch (e) {
    console.error('Exception fetching user profile:', e);
    return null;
  }
};

/**
 * Check if current user has a specific role
 * @param {string} role - The role to check for
 * @returns {Promise<boolean>}
 */
const hasRole = async (role) => {
  try {
    const profile = await getCurrentUserProfile();
    return profile?.role === role;
  } catch (e) {
    console.error(`Error checking ${role} role:`, e);
    return false;
  }
};

/**
 * Check if current user has admin role
 * @returns {Promise<boolean>}
 */
export const isAdmin = async () => hasRole('admin');

/**
 * Check if current user has doctor role
 * @returns {Promise<boolean>}
 */
export const isDoctor = async () => hasRole('doctor');

/**
 * Check if current user has staff role
 * @returns {Promise<boolean>}
 */
export const isStaff = async () => hasRole('staff');

/**
 * Check if current user has patient role
 * @returns {Promise<boolean>}
 */
export const isPatient = async () => hasRole('patient');

/**
 * Helper function to safely fetch data with error handling
 * @param {string} table - Table name to query
 * @param {string} select - Selection string
 * @param {Object} options - Additional query options
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export const safeFetch = async (table, select = '*', options = {}) => {
  try {
    let query = supabase.from(table).select(select);
    
    // Apply filters if provided
    if (options.filters) {
      for (const filter of options.filters) {
        const [column, operator, value] = filter;
        query = query[operator](column, value);
      }
    }
    
    // Apply ordering if provided
    if (options.order) {
      const [column, direction] = options.order;
      query = query.order(column, { ascending: direction === 'asc' });
    }
    
    // Apply pagination if provided
    if (options.pagination) {
      const { page, pageSize } = options.pagination;
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      query = query.range(start, end);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`Error fetching from ${table}:`, error);
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (e) {
    console.error(`Exception fetching from ${table}:`, e);
    return { data: null, error: e };
  }
};

export default supabase;