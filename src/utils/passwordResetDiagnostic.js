// src/utils/passwordResetDiagnostic.js - Diagnostic tool for password reset issues
import supabase from '../config/supabaseClient';

export const runPasswordResetDiagnostic = async () => {
  console.log('🔍 Password Reset Diagnostic Tool');
  console.log('=====================================');
  
  const results = {
    environment: {},
    database: {},
    functions: {},
    tables: {},
    permissions: {}
  };

  // 1. Check environment variables
  console.log('1. Checking environment variables...');
  results.environment = {
    supabase_url: !!import.meta.env.VITE_SUPABASE_URL,
    supabase_anon_key: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
    supabase_service_key: !!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  };
  console.log('Environment:', results.environment);

  // 2. Test basic database connection
  console.log('2. Testing database connection...');
  try {
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    results.database.connection = !error;
    results.database.error = error?.message;
    console.log('Database connection:', results.database.connection ? '✅ OK' : '❌ Failed');
    if (error) console.log('Database error:', error.message);
  } catch (e) {
    results.database.connection = false;
    results.database.error = e.message;
    console.log('Database connection: ❌ Failed -', e.message);
  }

  // 3. Check if password_reset_tokens table exists
  console.log('3. Checking password_reset_tokens table...');
  try {
    const { data, error } = await supabase.from('password_reset_tokens').select('count', { count: 'exact', head: true });
    results.tables.password_reset_tokens = !error;
    results.tables.error = error?.message;
    console.log('password_reset_tokens table:', results.tables.password_reset_tokens ? '✅ Exists' : '❌ Missing');
    if (error) console.log('Table error:', error.message);
  } catch (e) {
    results.tables.password_reset_tokens = false;
    results.tables.error = e.message;
    console.log('password_reset_tokens table: ❌ Missing -', e.message);
  }

  // 4. Test generate_password_reset_token function
  console.log('4. Testing generate_password_reset_token function...');
  try {
    const { data, error } = await supabase.rpc('generate_password_reset_token', {
      user_email: 'test@example.com'
    });
    
    // Function exists if we get a "User not found" error (that's expected for test email)
    const functionExists = !error || error.message === 'User not found';
    results.functions.generate_token = functionExists;
    results.functions.generate_error = error?.message;
    
    if (functionExists) {
      console.log('generate_password_reset_token: ✅ Function exists (tested with non-existent user)');
    } else {
      console.log('generate_password_reset_token: ❌ Function missing');
      console.log('Function error:', error.message);
    }
  } catch (e) {
    results.functions.generate_token = false;
    results.functions.generate_error = e.message;
    console.log('generate_password_reset_token: ❌ Function missing -', e.message);
  }

  // 5. Test validate_password_reset_token function
  console.log('5. Testing validate_password_reset_token function...');
  try {
    const { data, error } = await supabase.rpc('validate_password_reset_token', {
      user_email: 'test@example.com',
      reset_token: '123456'
    });
    results.functions.validate_token = !error;
    results.functions.validate_error = error?.message;
    console.log('validate_password_reset_token:', results.functions.validate_token ? '✅ Works' : '❌ Failed');
    if (error) console.log('Function error:', error.message);
  } catch (e) {
    results.functions.validate_token = false;
    results.functions.validate_error = e.message;
    console.log('validate_password_reset_token: ❌ Failed -', e.message);
  }

  // 6. Check profiles table access
  console.log('6. Testing profiles table access...');
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email')
      .limit(1);
    results.permissions.profiles_read = !error;
    results.permissions.profiles_error = error?.message;
    console.log('Profiles table access:', results.permissions.profiles_read ? '✅ OK' : '❌ Failed');
    if (error) console.log('Profiles error:', error.message);
  } catch (e) {
    results.permissions.profiles_read = false;
    results.permissions.profiles_error = e.message;
    console.log('Profiles table access: ❌ Failed -', e.message);
  }

  // 7. Test with a real email from the database
  console.log('7. Testing with real user email...');
  try {
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('email')
      .limit(1);
    
    if (!userError && users && users.length > 0) {
      const testEmail = users[0].email;
      console.log(`Testing with real email: ${testEmail}`);
      
      const { data, error } = await supabase.rpc('generate_password_reset_token', {
        user_email: testEmail
      });
      
      results.functions.real_user_test = !error;
      results.functions.real_user_email = testEmail;
      results.functions.real_user_error = error?.message;
      
      if (!error) {
        console.log('✅ Password reset works with real user email!');
        console.log('Token generated successfully');
      } else {
        console.log('❌ Failed with real user:', error.message);
      }
    } else {
      console.log('⚠️ No users found in profiles table for testing');
      results.functions.real_user_test = null;
    }
  } catch (e) {
    console.log('❌ Error testing with real user:', e.message);
    results.functions.real_user_test = false;
    results.functions.real_user_error = e.message;
  }

  // Summary
  console.log('\n📊 DIAGNOSTIC SUMMARY');
  console.log('=====================');
  
  const issues = [];
  
  if (!results.environment.supabase_url) issues.push('❌ Missing VITE_SUPABASE_URL');
  if (!results.environment.supabase_anon_key) issues.push('❌ Missing VITE_SUPABASE_ANON_KEY');
  if (!results.database.connection) issues.push('❌ Database connection failed');
  if (!results.tables.password_reset_tokens) issues.push('❌ password_reset_tokens table missing');
  if (!results.functions.generate_token) issues.push('❌ generate_password_reset_token function missing');
  if (!results.functions.validate_token) issues.push('❌ validate_password_reset_token function missing');
  if (results.functions.real_user_test === false) issues.push('❌ Password reset fails with real users');
  if (!results.permissions.profiles_read) issues.push('❌ Cannot read profiles table');

  if (issues.length === 0) {
    console.log('✅ All checks passed! The system should work.');
  } else {
    console.log('🚨 Issues found:');
    issues.forEach(issue => console.log('  ', issue));
  }

  console.log('\n🔧 RECOMMENDED FIXES');
  console.log('====================');
  
  if (!results.environment.supabase_url || !results.environment.supabase_anon_key) {
    console.log('1. Create .env file with Supabase credentials');
  }
  
  if (!results.tables.password_reset_tokens || !results.functions.generate_token) {
    console.log('2. Run password_reset_tokens_schema.sql in Supabase SQL editor');
  }
  
  if (!results.database.connection) {
    console.log('3. Check Supabase URL and keys are correct');
  }

  return results;
};

// Auto-run diagnostic in development
if (import.meta.env.DEV) {
  // Run after a delay to ensure everything is loaded
  setTimeout(() => {
    runPasswordResetDiagnostic();
  }, 2000);
}

export default runPasswordResetDiagnostic;
