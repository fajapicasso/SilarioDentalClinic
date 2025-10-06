// Schedule System Diagnostic Script
// Run this in browser console to debug schedule issues

async function runScheduleDiagnostic() {
  console.log('🔍 SCHEDULE SYSTEM DIAGNOSTIC');
  console.log('==============================\n');
  
  // Test 1: Check localStorage for schedule data
  console.log('1️⃣ Checking localStorage for schedule data...');
  const scheduleKeys = Object.keys(localStorage).filter(key => 
    key.includes('schedule') || key.includes('doctor') || key.includes('staff')
  );
  
  if (scheduleKeys.length > 0) {
    console.log('✅ Found schedule data in localStorage:');
    scheduleKeys.forEach(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        console.log(`   📄 ${key}:`, data.schedule ? 'Has schedule' : 'No schedule');
        if (data.schedule) {
          // Check if any days are enabled
          const enabled = Object.values(data.schedule).some(branch => 
            Object.values(branch).some(day => day.enabled)
          );
          console.log(`      Days enabled: ${enabled ? '✅ Yes' : '❌ None'}`);
        }
      } catch (e) {
        console.log(`   ❌ ${key}: Invalid JSON`);
      }
    });
  } else {
    console.log('ℹ️ No schedule data found in localStorage');
  }
  
  // Test 2: Test hardcoded schedule fallback
  console.log('\n2️⃣ Testing hardcoded schedule fallback...');
  const testDate = new Date();
  testDate.setDate(testDate.getDate() + 1); // Tomorrow
  const testDateStr = testDate.toISOString().split('T')[0];
  const dayName = testDate.toLocaleDateString('en-US', { weekday: 'long' });
  
  console.log(`   Testing date: ${testDateStr} (${dayName})`);
  
  // Test both branches
  const branches = ['Cabugao', 'San Juan'];
  
  for (const branch of branches) {
    console.log(`\n   🏥 ${branch} Branch:`);
    const dayOfWeek = testDate.getDay();
    
    if (branch === 'Cabugao') {
      if (dayOfWeek === 0) {
        console.log('      Status: ❌ Closed (Sunday)');
      } else if (dayOfWeek === 6) {
        console.log('      Status: ✅ Open (8AM-5PM)');
      } else {
        console.log('      Status: ✅ Open (8AM-12PM)');
      }
    } else if (branch === 'San Juan') {
      if (dayOfWeek === 6) {
        console.log('      Status: ❌ Closed (Saturday)');
      } else if (dayOfWeek === 0) {
        console.log('      Status: ✅ Open (8AM-5PM)');
      } else {
        console.log('      Status: ✅ Open (1PM-5PM)');
      }
    }
  }
  
  // Test 3: Check if ScheduleService methods are accessible
  console.log('\n3️⃣ Checking ScheduleService availability...');
  if (typeof window !== 'undefined' && window.ScheduleService) {
    console.log('✅ ScheduleService found in global scope');
    
    try {
      const result = await window.ScheduleService.getHardcodedTimeSlots('Cabugao', testDateStr, 30);
      console.log(`   Hardcoded slots for Cabugao: ${result.availableSlots.length} slots`);
      if (result.message) {
        console.log(`   Message: ${result.message}`);
      }
    } catch (error) {
      console.log('   ❌ Error calling hardcoded time slots:', error.message);
    }
  } else {
    console.log('ℹ️ ScheduleService not in global scope (normal)');
  }
  
  // Test 4: Check database connectivity
  console.log('\n4️⃣ Testing basic database connectivity...');
  if (typeof window !== 'undefined' && window.supabase) {
    try {
      const { data, error } = await window.supabase
        .from('profiles')
        .select('id, role')
        .limit(1);
      
      if (error) {
        console.log('   ❌ Database error:', error.message);
      } else {
        console.log('   ✅ Database connection working');
        console.log(`   Found ${data?.length || 0} profile(s)`);
      }
    } catch (error) {
      console.log('   ❌ Database connection failed:', error.message);
    }
  } else {
    console.log('   ℹ️ Supabase client not accessible');
  }
  
  // Test 5: Recommendations
  console.log('\n5️⃣ RECOMMENDATIONS:');
  console.log('====================');
  
  if (scheduleKeys.length === 0) {
    console.log('📝 No schedule data found. Doctors/staff should:');
    console.log('   1. Go to Settings → Schedule tab');
    console.log('   2. Enable working days for both branches');
    console.log('   3. Set appropriate working hours');
    console.log('   4. Save the schedule');
  } else {
    const hasEnabledSchedules = scheduleKeys.some(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        return data.schedule && Object.values(data.schedule).some(branch => 
          Object.values(branch).some(day => day.enabled)
        );
      } catch {
        return false;
      }
    });
    
    if (!hasEnabledSchedules) {
      console.log('⚠️ Schedule data exists but no days are enabled!');
      console.log('   👉 Go to Doctor/Staff Settings → Schedule tab');
      console.log('   👉 Enable working days by checking the boxes');
      console.log('   👉 Save the schedule');
    } else {
      console.log('✅ Schedule data looks good!');
      console.log('   If still having issues:');
      console.log('   1. Try refreshing the page');
      console.log('   2. Clear browser cache');
      console.log('   3. Check browser console for errors');
    }
  }
  
  console.log('\n🎯 QUICK FIXES:');
  console.log('================');
  console.log('1. Clear all schedule data: localStorage.clear()');
  console.log('2. Set default working schedule: (see below)');
  console.log('\n// Copy this to set a default working schedule:');
  console.log(`localStorage.setItem('doctor_schedule_[USER_ID]', JSON.stringify({
  schedule: {
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
  },
  unavailable_dates: [],
  updated_at: new Date().toISOString()
}));`);

  console.log('\n✅ DIAGNOSTIC COMPLETE!');
}

// Auto-run
console.log('🔧 Schedule Diagnostic Tool');
console.log('Run runScheduleDiagnostic() or wait 2 seconds for auto-run...');

if (typeof window !== 'undefined') {
  setTimeout(runScheduleDiagnostic, 2000);
}
