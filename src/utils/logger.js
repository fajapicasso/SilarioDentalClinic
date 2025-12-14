// src/utils/logger.js
// Development-only logger utility to prevent sensitive data exposure in production

// Strict check: Only log in development mode
// Check multiple conditions to ensure we're truly in development
const isDevelopment = 
  import.meta.env.DEV === true || 
  import.meta.env.MODE === 'development' ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost') ||
  (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1');

// In production, completely disable all logging
const isProduction = import.meta.env.PROD === true || import.meta.env.MODE === 'production';

/**
 * Safe logger that only logs in development mode
 * In production, ALL logs are completely suppressed to protect sensitive data
 */
export const logger = {
  log: (...args) => {
    // Completely disable in production
    if (isProduction) return;
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  info: (...args) => {
    // Completely disable in production
    if (isProduction) return;
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  warn: (...args) => {
    // Completely disable in production
    if (isProduction) return;
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  error: (...args) => {
    // In production, completely suppress errors too (for security)
    if (isProduction) return;
    
    // In development, log errors normally
    if (isDevelopment) {
      console.error(...args);
    }
  },
  
  debug: (...args) => {
    // Completely disable in production
    if (isProduction) return;
    if (isDevelopment) {
      console.debug(...args);
    }
  }
};

export default logger;

