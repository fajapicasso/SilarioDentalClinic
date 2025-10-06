// REAL-TIME SCHEDULE ERROR DIAGNOSTIC TOOL
// Copy and paste this ENTIRE script into browser console (F12) while on the appointment booking page

async function diagnoseLiveScheduleError() {
  console.log('🚨 REAL-TIME SCHEDULE ERROR DIAGNOSTIC');
  console.log('=====================================\n');
  
  try {
    // Step 1: Check basic environment
    console.log('🔍 Step 1: Environment Check');
    console.log('----------------------------');
    
    if (!window.supabase) {
      console.error('❌ CRITICAL: Supabase not loaded!');
      return;
    }
    console.log('✅ Supabase client available');
    
    // Check if ScheduleService is imported properly
    let ScheduleService = null;
    
    // Try different ways to access ScheduleService
    if (window.ScheduleService) {
      ScheduleService = window.ScheduleService;
      console.log('✅ ScheduleService found in window');
    } else {
      // Try to access from React components
      const reactFiberKey = Object.keys(document.querySelector('#root')).find(key => 
        key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
      );
      
      if (reactFiberKey) {
        console.log('🔍 Searching for ScheduleService in React components...');
        // We'll try to call the service directly through the appointment page
      }
    }
    
    // Step 2: Check current user and authentication
    console.log('\n🔍 Step 2: Authentication Check');
    console.log('-------------------------------');
    
    const { data: { user }, error: userError } = await window.supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ CRITICAL: Not authenticated!', userError);
      return;
    }
    
    console.log('✅ User authenticated:', user.email);
    
    // Step 3: Check if we're on the right page
    console.log('\n🔍 Step 3: Page Context Check');
    console.log('-----------------------------');
    
    const currentPath = window.location.pathname;
    console.log('📍 Current page:', currentPath);
    
    if (!currentPath.includes('/patient/appointments')) {
      console.warn('⚠️ Warning: Not on patient appointments page');
      console.log('💡 Navigate to Patient → Appointments to test booking');
    }
    
    // Step 4: Database connectivity test
    console.log('\n🔍 Step 4: Database Connectivity');
    console.log('--------------------------------');
    
    try {
      const { data: testQuery, error: testError } = await window.supabase
        .from('profiles')
        .select('id, full_name, role')
        .limit(1);
      
      if (testError) {
        console.error('❌ Database connection failed:', testError);
        return;
      }
      
      console.log('✅ Database connection working');
    } catch (dbError) {
      console.error('❌ Database test failed:', dbError);
      return;
    }
    
    // Step 5: Check for doctors with schedules
    console.log('\n🔍 Step 5: Doctor Schedule Check');
    console.log('--------------------------------');
    
    try {
      // First try with schedule columns
      const { data: doctorsWithSchedule, error: scheduleError } = await window.supabase
        .from('profiles')
        .select('id, full_name, role, schedule, unavailable_dates')
        .eq('role', 'doctor');
      
      if (scheduleError) {
        if (scheduleError.code === '42703' || scheduleError.message?.includes('column')) {
          console.error('❌ CRITICAL: Database schema missing!');
          console.error('💡 SOLUTION: Run the SQL migration script to add schedule columns');
          console.log('\n📋 Required SQL:');
          console.log('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS schedule JSONB;');
          console.log('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unavailable_dates JSONB DEFAULT \'[]\'::jsonb;');
          return;
        } else {
          throw scheduleError;
        }
      }
      
      console.log(`👨‍⚕️ Found ${doctorsWithSchedule.length} doctors in database`);
      
      let doctorsWithValidSchedule = 0;
      let doctorsWithEnabledDays = 0;
      
      doctorsWithSchedule.forEach(doctor => {
        console.log(`\n👤 Doctor: ${doctor.full_name} (${doctor.id})`);
        
        if (doctor.schedule) {
          doctorsWithValidSchedule++;
          console.log('   ✅ Has schedule configuration');
          
          // Check if any days are enabled
          let hasEnabledDays = false;
          Object.keys(doctor.schedule).forEach(branch => {
            console.log(`   🏥 ${branch} branch:`);
            Object.keys(doctor.schedule[branch]).forEach(day => {
              const dayConfig = doctor.schedule[branch][day];
              if (dayConfig.enabled) {
                hasEnabledDays = true;
                console.log(`      ✅ ${day}: ${dayConfig.start} - ${dayConfig.end}`);
              } else {
                console.log(`      ❌ ${day}: disabled`);
              }
            });
          });
          
          if (hasEnabledDays) {
            doctorsWithEnabledDays++;
          } else {
            console.log('   ⚠️ NO DAYS ENABLED - This doctor won\'t appear in appointment slots!');
          }
        } else {
          console.log('   ❌ No schedule configuration found');
        }
      });
      
      console.log(`\n📊 Summary:`);
      console.log(`   Total doctors: ${doctorsWithSchedule.length}`);
      console.log(`   With schedules: ${doctorsWithValidSchedule}`);
      console.log(`   With enabled days: ${doctorsWithEnabledDays}`);
      
      if (doctorsWithEnabledDays === 0) {
        console.error('\n❌ CRITICAL ISSUE FOUND!');
        console.error('🚨 NO DOCTORS HAVE ENABLED WORKING DAYS!');
        console.log('\n💡 IMMEDIATE FIX REQUIRED:');
        console.log('1. Login as doctor');
        console.log('2. Go to Settings → Schedule');
        console.log('3. CHECK THE BOXES to enable working days');
        console.log('4. Save the schedule');
        
        // Provide emergency fix
        console.log('\n🔧 EMERGENCY FIX - Run this code:');
        console.log(`
// Emergency schedule setup for all doctors
const defaultSchedule = {
  cabugao: {
    monday: { enabled: true, start: '08:00', end: '12:00' },
    tuesday: { enabled: true, start: '08:00', end: '12:00' },
    wednesday: { enabled: true, start: '08:00', end: '12:00' },
    thursday: { enabled: true, start: '08:00', end: '12:00' },
    friday: { enabled: true, start: '08:00', end: '12:00' },
    saturday: { enabled: true, start: '08:00', end: '17:00' },
    sunday: { enabled: false, start: '08:00', end: '17:00' }
  },
  sanjuan: {
    monday: { enabled: true, start: '13:00', end: '17:00' },
    tuesday: { enabled: true, start: '13:00', end: '17:00' },
    wednesday: { enabled: true, start: '13:00', end: '17:00' },
    thursday: { enabled: true, start: '13:00', end: '17:00' },
    friday: { enabled: true, start: '13:00', end: '17:00' },
    saturday: { enabled: false, start: '08:00', end: '17:00' },
    sunday: { enabled: true, start: '08:00', end: '17:00' }
  }
};

const doctorIds = ${JSON.stringify(doctorsWithSchedule.map(d => d.id))};

for (const doctorId of doctorIds) {
  await window.supabase.from('profiles').update({
    schedule: defaultSchedule,
    updated_at: new Date().toISOString()
  }).eq('id', doctorId);
  console.log('✅ Updated schedule for doctor:', doctorId);
}

console.log('🎉 All doctors now have working schedules! Refresh the page.');
        `);
        return;
      }
      
    } catch (error) {
      console.error('❌ Failed to check doctor schedules:', error);
      return;
    }
    
    // Step 6: Test actual appointment slot generation
    console.log('\n🔍 Step 6: Live Appointment Slot Test');
    console.log('------------------------------------');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const testDate = tomorrow.toISOString().split('T')[0];
    const dayName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' });
    
    console.log(`📅 Testing for: ${testDate} (${dayName})`);
    
    const branches = ['Cabugao', 'San Juan'];
    
    for (const branch of branches) {
      console.log(`\n🏥 Testing ${branch} branch:`);
      
      try {
        // Simulate the exact call made by the appointment page
        const response = await fetch('/api/test', { method: 'HEAD' }); // Just to test if we can make requests
        
        // Manual provider availability check
        const { data: providersData, error: providersError } = await window.supabase
          .from('profiles')
          .select('id, full_name, schedule')
          .eq('role', 'doctor');
        
        if (providersError) throw providersError;
        
        let availableProviders = 0;
        const branchKey = branch.toLowerCase().replace(' ', '');
        const dayOfWeek = tomorrow.toLocaleDateString('en-US', { weekday: 'lowercase' });
        
        console.log(`   📋 Checking ${providersData.length} doctors for ${dayOfWeek}...`);
        
        providersData.forEach(provider => {
          if (provider.schedule && 
              provider.schedule[branchKey] && 
              provider.schedule[branchKey][dayOfWeek] && 
              provider.schedule[branchKey][dayOfWeek].enabled) {
            availableProviders++;
            const schedule = provider.schedule[branchKey][dayOfWeek];
            console.log(`   ✅ ${provider.full_name}: ${schedule.start} - ${schedule.end}`);
          } else {
            console.log(`   ❌ ${provider.full_name}: Not available`);
          }
        });
        
        if (availableProviders > 0) {
          console.log(`   🎉 ${availableProviders} providers available - slots should appear!`);
        } else {
          console.log(`   ⚠️ No providers available - no slots will appear`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error testing ${branch}:`, error);
      }
    }
    
    // Final recommendations
    console.log('\n🎯 FINAL DIAGNOSIS & RECOMMENDATIONS');
    console.log('===================================');
    
    console.log('If you\'re still seeing "Error loading available time slots":');
    console.log('1. ✅ Database connection is working');
    console.log('2. ✅ User is authenticated');
    console.log('3. Check if doctors have enabled schedule days (see above)');
    console.log('4. Check browser console for specific error messages');
    console.log('5. Try refreshing the page after setting up schedules');
    
    console.log('\n🔧 Quick Actions:');
    console.log('- If no doctors have enabled days: Use the emergency fix code above');
    console.log('- If database columns missing: Run the SQL migration script');
    console.log('- If still failing: Check browser network tab for failed requests');
    
  } catch (error) {
    console.error('❌ DIAGNOSTIC FAILED:', error);
    console.log('💡 This error itself might be the root cause!');
  }
}

// Auto-run the diagnostic
console.log('🚨 SCHEDULE ERROR DIAGNOSTIC LOADING...');
console.log('⏳ Starting diagnosis in 2 seconds...');
setTimeout(diagnoseLiveScheduleError, 2000);

// Also make it available to run manually
window.diagnoseLiveScheduleError = diagnoseLiveScheduleError;
console.log('💡 You can also run: diagnoseLiveScheduleError()');
