// test_comprehensive_audit.js - Test Comprehensive Audit Logging
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-supabase-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Test comprehensive audit logging
async function testComprehensiveAuditLogging() {
  console.log('🧪 Testing Comprehensive Audit Logging System...\n');

  try {
    // Test 1: Check if audit_logs table exists and has data
    console.log('1. Checking audit_logs table...');
    const { data: auditLogs, error: auditError } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);

    if (auditError) {
      console.error('❌ Error fetching audit logs:', auditError);
      return;
    }

    console.log(`✅ Found ${auditLogs.length} audit log entries`);
    
    // Test 2: Check for different user roles
    console.log('\n2. Checking user roles in audit logs...');
    const userRoles = [...new Set(auditLogs.map(log => log.user_role))];
    console.log('📊 User roles found:', userRoles);

    // Test 3: Check for different modules
    console.log('\n3. Checking modules in audit logs...');
    const modules = [...new Set(auditLogs.map(log => log.module))];
    console.log('📊 Modules found:', modules);

    // Test 4: Check for different actions
    console.log('\n4. Checking actions in audit logs...');
    const actions = [...new Set(auditLogs.map(log => log.action))];
    console.log('📊 Actions found:', actions);

    // Test 5: Check for page views
    console.log('\n5. Checking for page view activities...');
    const pageViews = auditLogs.filter(log => log.action === 'page_view');
    console.log(`📊 Page views found: ${pageViews.length}`);
    if (pageViews.length > 0) {
      console.log('📄 Page view examples:');
      pageViews.slice(0, 3).forEach(log => {
        console.log(`   - ${log.user_name} (${log.user_role}) viewed ${log.resource_name} in ${log.module}`);
      });
    }

    // Test 6: Check for appointment activities
    console.log('\n6. Checking for appointment activities...');
    const appointmentActivities = auditLogs.filter(log => log.module === 'appointments');
    console.log(`📊 Appointment activities found: ${appointmentActivities.length}`);
    if (appointmentActivities.length > 0) {
      console.log('📄 Appointment activity examples:');
      appointmentActivities.slice(0, 3).forEach(log => {
        console.log(`   - ${log.user_name} (${log.user_role}) ${log.action} ${log.resource_name}`);
      });
    }

    // Test 7: Check for billing activities
    console.log('\n7. Checking for billing activities...');
    const billingActivities = auditLogs.filter(log => log.module === 'billing');
    console.log(`📊 Billing activities found: ${billingActivities.length}`);
    if (billingActivities.length > 0) {
      console.log('📄 Billing activity examples:');
      billingActivities.slice(0, 3).forEach(log => {
        console.log(`   - ${log.user_name} (${log.user_role}) ${log.action} ${log.resource_name}`);
      });
    }

    // Test 8: Check for queue activities
    console.log('\n8. Checking for queue activities...');
    const queueActivities = auditLogs.filter(log => log.module === 'queue');
    console.log(`📊 Queue activities found: ${queueActivities.length}`);
    if (queueActivities.length > 0) {
      console.log('📄 Queue activity examples:');
      queueActivities.slice(0, 3).forEach(log => {
        console.log(`   - ${log.user_name} (${log.user_role}) ${log.action} ${log.resource_name}`);
      });
    }

    // Test 9: Check for medical records activities
    console.log('\n9. Checking for medical records activities...');
    const medicalActivities = auditLogs.filter(log => log.module === 'medical_records');
    console.log(`📊 Medical records activities found: ${medicalActivities.length}`);
    if (medicalActivities.length > 0) {
      console.log('📄 Medical records activity examples:');
      medicalActivities.slice(0, 3).forEach(log => {
        console.log(`   - ${log.user_name} (${log.user_role}) ${log.action} ${log.resource_name}`);
      });
    }

    // Test 10: Check for user management activities
    console.log('\n10. Checking for user management activities...');
    const userActivities = auditLogs.filter(log => log.module === 'user_management');
    console.log(`📊 User management activities found: ${userActivities.length}`);
    if (userActivities.length > 0) {
      console.log('📄 User management activity examples:');
      userActivities.slice(0, 3).forEach(log => {
        console.log(`   - ${log.user_name} (${log.user_role}) ${log.action} ${log.resource_name}`);
      });
    }

    // Test 11: Check for admin activities
    console.log('\n11. Checking for admin activities...');
    const adminActivities = auditLogs.filter(log => log.module === 'admin');
    console.log(`📊 Admin activities found: ${adminActivities.length}`);
    if (adminActivities.length > 0) {
      console.log('📄 Admin activity examples:');
      adminActivities.slice(0, 3).forEach(log => {
        console.log(`   - ${log.user_name} (${log.user_role}) ${log.action} ${log.resource_name}`);
      });
    }

    // Test 12: Check for security activities
    console.log('\n12. Checking for security activities...');
    const securityActivities = auditLogs.filter(log => log.module === 'security');
    console.log(`📊 Security activities found: ${securityActivities.length}`);
    if (securityActivities.length > 0) {
      console.log('📄 Security activity examples:');
      securityActivities.slice(0, 3).forEach(log => {
        console.log(`   - ${log.user_name} (${log.user_role}) ${log.action} ${log.resource_name}`);
      });
    }

    // Summary
    console.log('\n📊 COMPREHENSIVE AUDIT LOGGING SUMMARY:');
    console.log('=====================================');
    console.log(`Total audit log entries: ${auditLogs.length}`);
    console.log(`User roles tracked: ${userRoles.length} (${userRoles.join(', ')})`);
    console.log(`Modules tracked: ${modules.length} (${modules.join(', ')})`);
    console.log(`Action types tracked: ${actions.length}`);
    console.log(`Page views: ${pageViews.length}`);
    console.log(`Appointment activities: ${appointmentActivities.length}`);
    console.log(`Billing activities: ${billingActivities.length}`);
    console.log(`Queue activities: ${queueActivities.length}`);
    console.log(`Medical records activities: ${medicalActivities.length}`);
    console.log(`User management activities: ${userActivities.length}`);
    console.log(`Admin activities: ${adminActivities.length}`);
    console.log(`Security activities: ${securityActivities.length}`);

    // Check if we have comprehensive coverage
    const expectedModules = ['appointments', 'billing', 'queue', 'medical_records', 'user_management', 'admin', 'security'];
    const coveredModules = expectedModules.filter(module => modules.includes(module));
    const coveragePercentage = (coveredModules.length / expectedModules.length) * 100;

    console.log(`\n🎯 MODULE COVERAGE: ${coveragePercentage.toFixed(1)}%`);
    console.log(`Covered modules: ${coveredModules.join(', ')}`);
    console.log(`Missing modules: ${expectedModules.filter(m => !modules.includes(m)).join(', ')}`);

    if (coveragePercentage >= 80) {
      console.log('\n✅ COMPREHENSIVE AUDIT LOGGING IS WORKING WELL!');
      console.log('The system is successfully tracking activities across multiple modules.');
    } else if (coveragePercentage >= 50) {
      console.log('\n⚠️  PARTIAL AUDIT LOGGING COVERAGE');
      console.log('Some modules are being tracked, but coverage could be improved.');
    } else {
      console.log('\n❌ LIMITED AUDIT LOGGING COVERAGE');
      console.log('The audit logging system needs more integration across modules.');
    }

  } catch (error) {
    console.error('❌ Error testing comprehensive audit logging:', error);
  }
}

// Run the test
testComprehensiveAuditLogging();
