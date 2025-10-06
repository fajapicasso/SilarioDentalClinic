// Test script to verify audit system is working
// Run this in your browser console or as a test

import auditLogService from './src/services/auditLogService.js';

async function testAuditSystem() {
  console.log('Testing Audit System...');
  
  try {
    // Test 1: Log a test event
    console.log('Test 1: Logging a test event...');
    const result = await auditLogService.logEvent({
      action: 'test_action',
      module: 'testing',
      section: 'test_section',
      resourceType: 'test_resource',
      resourceId: 'test-id-123',
      resourceName: 'Test Resource',
      newValues: { test: 'data' },
      metadata: { testRun: true }
    });
    console.log('✅ Test event logged:', result);

    // Test 2: Fetch audit logs
    console.log('Test 2: Fetching audit logs...');
    const logs = await auditLogService.getAuditLogs({ limit: 10 });
    console.log('✅ Audit logs fetched:', logs);

    // Test 3: Get audit statistics
    console.log('Test 3: Getting audit statistics...');
    const stats = await auditLogService.getAuditStats();
    console.log('✅ Audit statistics:', stats);

    console.log('🎉 All tests passed! Audit system is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('This likely means the database tables haven\'t been created yet.');
    console.error('Please run the setup_audit_database.sql file in your Supabase SQL Editor first.');
  }
}

// Export for use in other files
export { testAuditSystem };

// Auto-run if this file is executed directly
if (typeof window !== 'undefined') {
  window.testAuditSystem = testAuditSystem;
}
