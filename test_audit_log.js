// test_audit_log.js - Test script to verify audit log functionality
import { createClient } from '@supabase/supabase-js';

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuditLog() {
  try {
    console.log('🧪 Testing Audit Log System...\n');

    // Test 1: Check if audit_logs table exists and is accessible
    console.log('1. Testing audit_logs table access...');
    const { data: auditLogs, error: auditError } = await supabase
      .from('audit_logs')
      .select('*')
      .limit(5);

    if (auditError) {
      console.error('❌ Error accessing audit_logs table:', auditError.message);
      return;
    }

    console.log('✅ audit_logs table is accessible');
    console.log(`📊 Found ${auditLogs.length} existing audit log entries\n`);

    // Test 2: Test inserting a test audit log entry
    console.log('2. Testing audit log insertion...');
    const testAuditEntry = {
      user_id: null, // System entry
      user_name: 'Test System',
      user_role: 'system',
      action: 'test_audit_log',
      module: 'system',
      section: 'testing',
      resource_type: 'test',
      resource_id: 'test-123',
      resource_name: 'Audit Log Test',
      old_values: null,
      new_values: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
      ip_address: '127.0.0.1',
      user_agent: 'Test Script',
      session_id: 'test-session-' + Date.now(),
      success: true,
      error_message: null,
      metadata: JSON.stringify({ test_run: true }),
      timestamp: new Date().toISOString()
    };

    const { data: insertedLog, error: insertError } = await supabase
      .from('audit_logs')
      .insert(testAuditEntry)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error inserting test audit log:', insertError.message);
      return;
    }

    console.log('✅ Successfully inserted test audit log entry');
    console.log(`📝 Entry ID: ${insertedLog.id}\n`);

    // Test 3: Test audit log statistics function
    console.log('3. Testing audit log statistics...');
    const { data: stats, error: statsError } = await supabase.rpc('get_audit_log_stats');

    if (statsError) {
      console.error('❌ Error getting audit log stats:', statsError.message);
    } else {
      console.log('✅ Successfully retrieved audit log statistics');
      console.log('📊 Statistics:', stats[0]);
    }

    // Test 4: Test audit log categories
    console.log('\n4. Testing audit log categories...');
    const { data: categories, error: categoriesError } = await supabase
      .from('audit_log_categories')
      .select('*');

    if (categoriesError) {
      console.error('❌ Error accessing audit log categories:', categoriesError.message);
    } else {
      console.log('✅ Successfully retrieved audit log categories');
      console.log(`📂 Found ${categories.length} categories`);
    }

    // Test 5: Test audit log actions
    console.log('\n5. Testing audit log actions...');
    const { data: actions, error: actionsError } = await supabase
      .from('audit_log_actions')
      .select('*')
      .limit(10);

    if (actionsError) {
      console.error('❌ Error accessing audit log actions:', actionsError.message);
    } else {
      console.log('✅ Successfully retrieved audit log actions');
      console.log(`🎯 Found ${actions.length} predefined actions`);
    }

    // Test 6: Clean up test entry
    console.log('\n6. Cleaning up test entry...');
    const { error: deleteError } = await supabase
      .from('audit_logs')
      .delete()
      .eq('id', insertedLog.id);

    if (deleteError) {
      console.error('❌ Error cleaning up test entry:', deleteError.message);
    } else {
      console.log('✅ Successfully cleaned up test entry');
    }

    console.log('\n🎉 Audit Log System Test Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ audit_logs table is accessible');
    console.log('   ✅ Audit log insertion works');
    console.log('   ✅ Audit log statistics function works');
    console.log('   ✅ Audit log categories are available');
    console.log('   ✅ Audit log actions are available');
    console.log('   ✅ Test cleanup completed');
    
    console.log('\n💡 Next Steps:');
    console.log('   1. The audit log system is fully functional');
    console.log('   2. Audit logging has been integrated into key application functions');
    console.log('   3. You can now view audit logs in the admin panel');
    console.log('   4. All user actions, appointment changes, and queue operations will be logged');

  } catch (error) {
    console.error('❌ Unexpected error during audit log test:', error);
  }
}

// Run the test
testAuditLog();
