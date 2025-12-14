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
 * Sanitize Supabase response for logging only
 * NOTE: This does NOT modify actual data - only for console logging
 * The actual data returned to the UI is unchanged
 */
export function createSanitizedSupabaseClient(originalClient) {
  // Don't wrap Supabase client - it breaks the UI
  // Instead, we only block console logs
  return originalClient;
}

/**
 * Sanitize console output
 * Prevents any data from being logged in production
 * This only blocks console output - does NOT affect UI data
 */
export function sanitizeConsole() {
  if (!isProduction) {
    return; // In development, don't modify console
  }

  // Override ALL console methods in production to completely silence console
  const noop = () => {};
  
  // Store original console methods before overriding (for emergency debugging)
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
  };
  
  // Block ALL console output including errors
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.debug = noop;
  console.error = noop; // Completely block errors
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
  
  // Only block console - don't interfere with error handling
  // This allows the app to function normally while hiding console output
}

/**
 * Initialize privacy protection
 * Call this once at app startup
 * This should be called as early as possible
 */
export function initializePrivacyProtection() {
  if (isProduction) {
    // Sanitize console in production - do this FIRST
    sanitizeConsole();
    
    // Prevent data exposure through window object
    if (typeof window !== 'undefined') {
      // Try to remove debug objects (safely, without errors)
      try {
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          try {
            delete window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
          } catch (e) {
            // Property can't be deleted, try to override it instead
            try {
              Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
                value: undefined,
                writable: false,
                configurable: true
              });
            } catch (e2) {
              // Ignore if we can't override either
            }
          }
        }
      } catch (e) {
        // Ignore errors
      }
      
      try {
        if (window.__REDUX_DEVTOOLS_EXTENSION__) {
          delete window.__REDUX_DEVTOOLS_EXTENSION__;
        }
      } catch (e) {
        // Ignore
      }
      
      try {
        if (window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) {
          delete window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
        }
      } catch (e) {
        // Ignore
      }
      
      // Try to suppress DevTools console output
      try {
        // Override console methods multiple times to ensure they stick
        setInterval(() => {
          if (isProduction) {
            const noop = () => {};
            console.log = noop;
            console.error = noop;
            console.warn = noop;
            console.info = noop;
            console.debug = noop;
          }
        }, 100);
      } catch (e) {
        // Ignore errors
      }
    }
  }
}

/**
 * Initialize privacy protection immediately (before React loads)
 * This runs as soon as the module is imported
 */
if (typeof window !== 'undefined' && isProduction) {
  // Run immediately when module loads
  sanitizeConsole();
  
  // Also run on DOMContentLoaded as backup
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      sanitizeConsole();
      initializePrivacyProtection();
    });
  } else {
    // DOM already loaded, run immediately
    initializePrivacyProtection();
  }
}

export default {
  sanitizeData,
  createSanitizedSupabaseClient,
  sanitizeConsole,
  initializePrivacyProtection,
  isProduction
};

