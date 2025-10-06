// src/utils/ipUtils.js - IP Address and Location Utilities

/**
 * Get client IP address using multiple methods
 */
export async function getClientIP() {
  try {
    // Method 1: Try to get IP from a public service
    const response = await fetch('https://api.ipify.org?format=json');
    if (response.ok) {
      const data = await response.json();
      return data.ip;
    }
  } catch (error) {
    console.log('Failed to get IP from ipify.org:', error);
  }

  try {
    // Method 2: Try alternative service
    const response = await fetch('https://ipapi.co/json/');
    if (response.ok) {
      const data = await response.json();
      return data.ip;
    }
  } catch (error) {
    console.log('Failed to get IP from ipapi.co:', error);
  }

  // Fallback to localhost for development
  return '127.0.0.1';
}

/**
 * Get client location based on IP address
 */
export async function getClientLocation(ipAddress) {
  if (!ipAddress || ipAddress === '127.0.0.1') {
    return {
      country: 'Local',
      region: 'Development',
      city: 'Localhost',
      timezone: 'UTC'
    };
  }

  try {
    // Use ipapi.co for location data
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);
    if (response.ok) {
      const data = await response.json();
      return {
        country: data.country_name || 'Unknown',
        region: data.region || 'Unknown',
        city: data.city || 'Unknown',
        timezone: data.timezone || 'Unknown',
        latitude: data.latitude,
        longitude: data.longitude
      };
    }
  } catch (error) {
    console.log('Failed to get location from ipapi.co:', error);
  }

  try {
    // Alternative service
    const response = await fetch(`https://ip-api.com/json/${ipAddress}`);
    if (response.ok) {
      const data = await response.json();
      return {
        country: data.country || 'Unknown',
        region: data.regionName || 'Unknown',
        city: data.city || 'Unknown',
        timezone: data.timezone || 'Unknown',
        latitude: data.lat,
        longitude: data.lon
      };
    }
  } catch (error) {
    console.log('Failed to get location from ip-api.com:', error);
  }

  return {
    country: 'Unknown',
    region: 'Unknown',
    city: 'Unknown',
    timezone: 'Unknown'
  };
}

/**
 * Get comprehensive client information (IP + Location)
 */
export async function getClientInfo() {
  const ipAddress = await getClientIP();
  const location = await getClientLocation(ipAddress);
  
  return {
    ipAddress,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server',
    location
  };
}
