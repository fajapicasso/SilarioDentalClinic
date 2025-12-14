// src/utils/logger.js
// Development-only logger utility to prevent sensitive data exposure in production

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

/**
 * Safe logger that only logs in development mode
 * In production, all logs are suppressed to protect sensitive data
 */
export const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  error: (...args) => {
    // Always log errors, but sanitize sensitive data
    if (isDevelopment) {
      console.error(...args);
    } else {
      // In production, only log error messages without sensitive data
      const sanitized = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          const sanitized = { ...arg };
          // Remove sensitive fields
          delete sanitized.password;
          delete sanitized.password_hash;
          delete sanitized.email;
          delete sanitized.user_id;
          delete sanitized.userId;
          delete sanitized.id;
          delete sanitized.token;
          delete sanitized.access_token;
          delete sanitized.refresh_token;
          delete sanitized.session;
          return sanitized;
        }
        return arg;
      });
      console.error(...sanitized);
    }
  },
  
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  }
};

export default logger;

