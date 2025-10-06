// src/utils/testIpDetection.js - Test IP Address and Location Detection

import { getClientInfo } from './ipUtils';

/**
 * Test function to verify IP address and location detection
 * This can be called from the browser console or a test page
 */
export async function testIpDetection() {
  console.log('🔍 Testing IP address and location detection...');
  
  try {
    const clientInfo = await getClientInfo();
    
    console.log('✅ Client Information:');
    console.log('  IP Address:', clientInfo.ipAddress);
    console.log('  User Agent:', clientInfo.userAgent);
    console.log('  Location:', clientInfo.location);
    
    return clientInfo;
  } catch (error) {
    console.error('❌ Error testing IP detection:', error);
    return null;
  }
}

/**
 * Test function that can be called from browser console
 * Usage: window.testIpDetection()
 */
if (typeof window !== 'undefined') {
  window.testIpDetection = testIpDetection;
}
