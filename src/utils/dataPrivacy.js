// src/utils/dataPrivacy.js - Comprehensive Data Privacy Protection
// This utility sanitizes all sensitive data before it can be exposed

const isProduction = import.meta.env.PROD === true || import.meta.env.MODE === 'production';

/**
 * Sanitize sensitive data from objects
 * Removes or masks sensitive fields in production
 */
export function sanitizeData(data) {
  if (!isProduction) {
    return data; // In development, return data as-is
  }

  if (!data) return data;

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  // Handle objects
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data };

    // List of sensitive fields to remove or mask
    const sensitiveFields = [
      // Personal Information
      'full_name', 'name', 'first_name', 'last_name', 'middle_name',
      'email', 'phone', 'phone_number', 'mobile', 'mobile_number',
      'address', 'home_address', 'work_address', 'billing_address',
      'city', 'state', 'province', 'country', 'zip_code', 'postal_code',
      'date_of_birth', 'birth_date', 'age', 'gender',
      
      // Medical Information
      'diagnosis', 'treatment_notes', 'medical_history', 'allergies',
      'medications', 'notes', 'description', 'patient_name', 'doctor_name',
      
      // Financial Information
      'price', 'cost', 'amount', 'total', 'balance', 'payment_amount',
      'invoice_number', 'transaction_id', 'card_number', 'account_number',
      'routing_number', 'bank_account', 'credit_card', 'cvv',
      
      // Schedule & Availability
      'schedule', 'unavailable_dates', 'working_hours', 'availability',
      'time_slots', 'appointment_time', 'appointment_date', 'queue_number',
      'estimated_wait_time', 'branch', 'clinic_name',
      
      // Service Information
      'service_name', 'service_description',
      
      // Authentication & Security
      'password', 'token', 'access_token', 'refresh_token', 'api_key',
      'secret', 'session_id', 'ip_address',
      
      // Other Sensitive Data
      'ssn', 'social_security_number', 'insurance_number', 'policy_number',
      'guardian_name', 'staff_name', 'user_name', 'username'
    ];

    // Remove or mask sensitive fields
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        delete sanitized[field];
      }
    });

    // Recursively sanitize nested objects
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = sanitizeData(sanitized[key]);
      }
    });

    return sanitized;
  }

  return data;
}

/**
 * Sanitize Supabase response
 * Wraps Supabase client to automatically sanitize all responses
 */
export function createSanitizedSupabaseClient(originalClient) {
  if (!isProduction) {
    return originalClient; // In development, return original client
  }

  // Intercept the 'from' method to wrap query builders
  const originalFrom = originalClient.from.bind(originalClient);
  
  originalClient.from = function(table) {
    const queryBuilder = originalFrom(table);
    
    // Wrap the query builder's methods that return promises
    const methodsToWrap = ['select', 'insert', 'update', 'delete', 'upsert', 'rpc'];
    
    methodsToWrap.forEach(method => {
      if (typeof queryBuilder[method] === 'function') {
        const originalMethod = queryBuilder[method].bind(queryBuilder);
        queryBuilder[method] = function(...args) {
          const result = originalMethod(...args);
          
          // If it returns a promise, sanitize the response
          if (result && typeof result.then === 'function') {
            return result.then(response => {
              if (response && response.data) {
                return {
                  ...response,
                  data: sanitizeData(response.data),
                  error: response.error ? {
                    message: 'Error occurred',
                    code: response.error.code || 'UNKNOWN'
                  } : null
                };
              }
              return response;
            }).catch(error => {
              return {
                data: null,
                error: {
                  message: 'Error occurred',
                  code: error.code || 'UNKNOWN'
                }
              };
            });
          }
          
          return result;
        };
      }
    });
    
    return queryBuilder;
  };
  
  return originalClient;
}

/**
 * Sanitize console output
 * Prevents any data from being logged in production
 */
export function sanitizeConsole() {
  if (!isProduction) {
    return; // In development, don't modify console
  }

  // Override all console methods in production
  const noop = () => {};
  const sanitizedError = (...args) => {
    // Only log generic error messages
    console.error('[Error] An error occurred');
  };

  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.debug = noop;
  console.error = sanitizedError;
  console.table = noop;
  console.group = noop;
  console.groupEnd = noop;
  console.groupCollapsed = noop;
  console.time = noop;
  console.timeEnd = noop;
  console.trace = noop;
  console.dir = noop;
  console.dirxml = noop;
  console.assert = noop;
  console.count = noop;
  console.countReset = noop;
  console.clear = noop;
  console.profile = noop;
  console.profileEnd = noop;
  console.timeStamp = noop;
  console.memory = noop;
}

/**
 * Initialize privacy protection
 * Call this once at app startup
 */
export function initializePrivacyProtection() {
  if (isProduction) {
    // Sanitize console in production
    sanitizeConsole();
    
    // Prevent data exposure through window object
    if (typeof window !== 'undefined') {
      // Remove any debug objects
      delete window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      delete window.__REDUX_DEVTOOLS_EXTENSION__;
      delete window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
      
      // Prevent React DevTools
      Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
        value: undefined,
        writable: false,
        configurable: false
      });
    }
  }
}

export default {
  sanitizeData,
  createSanitizedSupabaseClient,
  sanitizeConsole,
  initializePrivacyProtection,
  isProduction
};

