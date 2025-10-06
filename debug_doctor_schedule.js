// DOCTOR SCHEDULE DEBUG TOOL
// Run this in browser console while logged in as doctor on Settings page

async function debugDoctorSchedule() {
  console.log('🔍 DOCTOR SCHEDULE DEBUGGING');
  console.log('============================');
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await window.supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ Not logged in');
      return;
    }
    
    console.log('✅ User ID:', user.id);
    console.log('✅ User email:', user.email);
    
    // Check what's actually in the database
    console.log('\n📊 CHECKING DATABASE:');
    console.log('===================');
    
    const { data: profileData, error: profileError } = await window.supabase
      .from('profiles')
      .select('id, full_name, role, schedule, unavailable_dates')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('❌ Database error:', profileError);
      
      if (profileError.code === '42703' || profileError.message?.includes('column')) {
        console.error('🚨 CRITICAL: schedule/unavailable_dates columns missing!');
        console.log('💡 SOLUTION: Run add_schedule_columns.sql to add missing columns');
        
        // Check what columns exist
        const { data: basicData, error: basicError } = await window.supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('id', user.id)
          .single();
        
        if (!basicError) {
          console.log('✅ Basic profile data exists:', basicData);
        }
        
        return;
      }
    } else {
      console.log('✅ Profile data found:');
      console.log('   Name:', profileData.full_name);
      console.log('   Role:', profileData.role);
      console.log('   Has schedule:', !!profileData.schedule);
      console.log('   Has unavailable_dates:', !!profileData.unavailable_dates);
      
      if (profileData.schedule) {
        console.log('\n📅 SCHEDULE DATA:');
        console.log('================');
        console.log(JSON.stringify(profileData.schedule, null, 2));
        
        // Check if any days are enabled
        let enabledDaysCount = 0;
        Object.keys(profileData.schedule).forEach(branch => {
          console.log(`\n🏥 ${branch.toUpperCase()} BRANCH:`);
          Object.keys(profileData.schedule[branch]).forEach(day => {
            const dayConfig = profileData.schedule[branch][day];
            if (dayConfig.enabled) {
              enabledDaysCount++;
              console.log(`   ✅ ${day}: ${dayConfig.start} - ${dayConfig.end}`);
            } else {
              console.log(`   ❌ ${day}: disabled`);
            }
          });
        });
        
        if (enabledDaysCount === 0) {
          console.warn('\n⚠️ NO DAYS ARE ENABLED!');
          console.log('This is why no appointment slots appear.');
        } else {
          console.log(`\n✅ ${enabledDaysCount} enabled day configurations found`);
        }
      } else {
        console.warn('⚠️ No schedule data in database');
      }
    }
    
    // Check localStorage
    console.log('\n📱 CHECKING LOCALSTORAGE:');
    console.log('========================');
    
    const localKey = `doctor_schedule_${user.id}`;
    const localData = localStorage.getItem(localKey);
    
    if (localData) {
      console.log('✅ Found localStorage data:');
      try {
        const parsed = JSON.parse(localData);
        console.log(JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.error('❌ Invalid localStorage JSON');
      }
    } else {
      console.log('❌ No localStorage data found');
    }
    
    // Test the ScheduleService
    console.log('\n🔧 TESTING SCHEDULE SERVICE:');
    console.log('===========================');
    
    if (window.ScheduleService) {
      console.log('✅ ScheduleService available');
      
      // Test getting providers
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const testDate = tomorrow.toISOString().split('T')[0];
      
      console.log(`📅 Testing for date: ${testDate}`);
      
      const branches = ['Cabugao', 'San Juan'];
      
      for (const branch of branches) {
        console.log(`\n🏥 Testing ${branch}:`);
        
        try {
          const providers = await window.ScheduleService.getAvailableProviders(branch, testDate, '08:00');
          console.log(`   Available providers: ${providers.length}`);
          
          if (providers.length > 0) {
            providers.forEach(provider => {
              console.log(`   👨‍⚕️ ${provider.full_name}`);
              console.log(`      Has schedule: ${!!provider.schedule}`);
            });
          }
          
          const slots = await window.ScheduleService.getAvailableTimeSlots(branch, testDate, 30);
          console.log(`   Available slots: ${slots.availableSlots.length}`);
          
          if (slots.message) {
            console.log(`   Message: ${slots.message}`);
          }
          
        } catch (error) {
          console.error(`   ❌ Error testing ${branch}:`, error.message);
        }
      }
    } else {
      console.error('❌ ScheduleService not available');
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('==================');
    
    if (profileError && (profileError.code === '42703' || profileError.message?.includes('column'))) {
      console.log('1. 🚨 CRITICAL: Run SQL migration to add schedule columns');
      console.log('2. Use add_schedule_columns.sql script');
    } else if (!profileData?.schedule) {
      console.log('1. Set up your schedule in Settings → Schedule tab');
      console.log('2. Make sure to CHECK THE BOXES to enable working days');
      console.log('3. Click "Save Schedule & Availability"');
    } else if (profileData.schedule) {
      const hasEnabledDays = Object.values(profileData.schedule).some(branch => 
        Object.values(branch).some(day => day.enabled)
      );
      
      if (!hasEnabledDays) {
        console.log('1. 🚨 ENABLE WORKING DAYS: Check the boxes in Settings → Schedule');
        console.log('2. Save the schedule after enabling days');
      } else {
        console.log('✅ Schedule looks correct!');
        console.log('If still having issues:');
        console.log('1. Refresh the page');
        console.log('2. Try booking appointment again');
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Auto-run
console.log('🚨 DOCTOR SCHEDULE DEBUG TOOL LOADED');
debugDoctorSchedule();

// Make available for manual run
window.debugDoctorSchedule = debugDoctorSchedule;
