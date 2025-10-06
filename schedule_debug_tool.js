// Schedule Debug Tool - Run this in browser console to diagnose schedule issues
// Copy and paste this entire script into browser console (F12)

async function debugScheduleSystem() {
  console.log('🔧 SCHEDULE SYSTEM DIAGNOSTIC TOOL');
  console.log('===================================\n');
  
  // Check if we have Supabase connection
  if (!window.supabase) {
    console.error('❌ Supabase client not found. Please make sure you are on the clinic website.');
    return;
  }
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await window.supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ Not logged in. Please log in first.');
      return;
    }
    
    console.log('✅ Logged in user:', user.email);
    
    // Get user profile
    const { data: profile, error: profileError } = await window.supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      return;
    }
    
    console.log('👤 User role:', profile.role);
    console.log('👤 User name:', profile.full_name);
    
    // Check schedule data
    console.log('\n📅 SCHEDULE CONFIGURATION:');
    console.log('=========================');
    
    if (profile.schedule) {
      console.log('✅ Schedule found in database');
      console.log('📊 Schedule data:');
      console.log(JSON.stringify(profile.schedule, null, 2));
      
      // Check if any days are enabled
      let hasEnabledDays = false;
      Object.keys(profile.schedule).forEach(branch => {
        console.log(`\n🏥 ${branch.toUpperCase()} BRANCH:`);
        Object.keys(profile.schedule[branch]).forEach(day => {
          const dayConfig = profile.schedule[branch][day];
          const status = dayConfig.enabled ? '✅ ENABLED' : '❌ DISABLED';
          console.log(`   ${day}: ${status} (${dayConfig.start} - ${dayConfig.end})`);
          if (dayConfig.enabled) hasEnabledDays = true;
        });
      });
      
      if (!hasEnabledDays) {
        console.warn('⚠️ NO DAYS ARE ENABLED! This is why no appointment slots are available.');
        console.log('💡 FIX: Go to Settings → Schedule → Enable working days by checking the boxes');
      }
      
    } else {
      console.warn('⚠️ No schedule found in database');
      
      // Check localStorage
      const localKey = `${profile.role}_schedule_${user.id}`;
      const localData = localStorage.getItem(localKey);
      
      if (localData) {
        console.log('📱 Found schedule in localStorage:');
        try {
          const parsed = JSON.parse(localData);
          console.log(parsed);
        } catch (e) {
          console.error('❌ Invalid localStorage data');
        }
      } else {
        console.warn('❌ No schedule in localStorage either');
        console.log('💡 FIX: Go to Settings → Schedule → Set up your working hours');
      }
    }
    
    // Test availability for tomorrow
    console.log('\n🧪 TESTING APPOINTMENT AVAILABILITY:');
    console.log('===================================');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    const dayName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' });
    
    console.log(`📅 Testing date: ${dateStr} (${dayName})`);
    
    // Test both branches
    const branches = ['Cabugao', 'San Juan'];
    
    for (const branch of branches) {
      console.log(`\n🏥 ${branch} Branch:`);
      
      try {
        // Check if ScheduleService is available
        if (window.ScheduleService) {
          const providers = await window.ScheduleService.getAvailableProviders(branch, dateStr, '08:00');
          console.log(`   Available providers: ${providers.length}`);
          
          const slots = await window.ScheduleService.getAvailableTimeSlots(branch, dateStr, 30);
          console.log(`   Available time slots: ${slots.availableSlots.length}`);
          
          if (slots.message) {
            console.log(`   Message: ${slots.message}`);
          }
          
          if (slots.availableSlots.length > 0) {
            console.log(`   First few slots: ${slots.availableSlots.slice(0, 3).join(', ')}`);
          }
        } else {
          console.log('   ⚠️ ScheduleService not available in global scope');
        }
      } catch (error) {
        console.error(`   ❌ Error testing ${branch}:`, error.message);
      }
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('==================');
    
    if (!profile.schedule) {
      console.log('1. Go to Settings → Schedule tab');
      console.log('2. Enable working days for both branches');
      console.log('3. Set specific start and end times');
      console.log('4. Click "Save Schedule & Availability"');
    } else {
      const hasEnabledDays = Object.values(profile.schedule).some(branch => 
        Object.values(branch).some(day => day.enabled)
      );
      
      if (!hasEnabledDays) {
        console.log('1. Go to Settings → Schedule tab');
        console.log('2. CHECK THE BOXES to enable working days');
        console.log('3. Click "Save Schedule & Availability"');
      } else {
        console.log('✅ Schedule looks properly configured!');
        console.log('If still having issues:');
        console.log('1. Refresh the page');
        console.log('2. Clear browser cache');
        console.log('3. Check if database columns exist (run SQL migration)');
      }
    }
    
    // Quick fix code
    console.log('\n🔧 QUICK FIX (Emergency Schedule Setup):');
    console.log('========================================');
    console.log('Copy and paste this code to set a default working schedule:');
    console.log(`
// Emergency schedule setup
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

// Save to database
await window.supabase.from('profiles').update({
  schedule: defaultSchedule,
  updated_at: new Date().toISOString()
}).eq('id', '${user.id}');

console.log('✅ Emergency schedule saved! Refresh the page.');
    `);
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

// Instructions
console.log('🛠️ SCHEDULE DIAGNOSTIC TOOL LOADED');
console.log('Run debugScheduleSystem() to start diagnosis');
console.log('or wait 3 seconds for auto-run...');

// Auto-run
setTimeout(debugScheduleSystem, 3000);
