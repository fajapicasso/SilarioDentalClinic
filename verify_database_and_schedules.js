// COMPREHENSIVE DATABASE & SCHEDULE VERIFICATION TOOL
// Run this in browser console to verify everything is working correctly

async function verifyDatabaseAndSchedules() {
  console.log('🔍 COMPREHENSIVE SCHEDULE SYSTEM VERIFICATION');
  console.log('===========================================\n');
  
  try {
    // Step 1: Check Authentication
    console.log('1️⃣ CHECKING AUTHENTICATION');
    console.log('==========================');
    
    const { data: { user }, error: userError } = await window.supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ Not logged in:', userError);
      return;
    }
    
    console.log('✅ Authenticated user:', user.email);
    console.log('✅ User ID:', user.id);
    
    // Step 2: Verify Database Schema
    console.log('\n2️⃣ VERIFYING DATABASE SCHEMA');
    console.log('============================');
    
    // Test if schedule columns exist
    try {
      const { data: schemaTest, error: schemaError } = await window.supabase
        .from('profiles')
        .select('id, schedule, unavailable_dates')
        .limit(1);
      
      if (schemaError) {
        if (schemaError.code === '42703' || schemaError.message?.includes('column')) {
          console.error('❌ CRITICAL: Database schema missing!');
          console.error('Missing columns: schedule and/or unavailable_dates');
          console.log('\n💡 SOLUTION: Run this SQL in Supabase SQL Editor:');
          console.log(`
-- Add missing columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS unavailable_dates JSONB DEFAULT '[]'::jsonb;

-- Create staff_schedules table if it doesn't exist
CREATE TABLE IF NOT EXISTS staff_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    schedule JSONB DEFAULT NULL,
    unavailable_dates JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(staff_id)
);

-- Add comments
COMMENT ON COLUMN profiles.schedule IS 'Working schedule configuration per branch and day';
COMMENT ON COLUMN profiles.unavailable_dates IS 'Array of unavailable dates and times';
          `);
          return;
        } else {
          throw schemaError;
        }
      }
      
      console.log('✅ Database schema verified - schedule columns exist');
      
    } catch (error) {
      console.error('❌ Database schema verification failed:', error);
      return;
    }
    
    // Step 3: Check Current User's Profile and Schedule
    console.log('\n3️⃣ CHECKING CURRENT USER PROFILE');
    console.log('=================================');
    
    const { data: currentProfile, error: profileError } = await window.supabase
      .from('profiles')
      .select('id, full_name, role, schedule, unavailable_dates')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('❌ Failed to fetch current user profile:', profileError);
      return;
    }
    
    console.log('✅ Current user profile:');
    console.log(`   Name: ${currentProfile.full_name}`);
    console.log(`   Role: ${currentProfile.role}`);
    console.log(`   Has schedule: ${!!currentProfile.schedule}`);
    console.log(`   Has unavailable dates: ${!!currentProfile.unavailable_dates}`);
    
    if (currentProfile.schedule) {
      console.log('\n📅 CURRENT USER SCHEDULE:');
      console.log('========================');
      console.log(JSON.stringify(currentProfile.schedule, null, 2));
      
      // Analyze the schedule
      let enabledDaysCount = 0;
      Object.keys(currentProfile.schedule).forEach(branch => {
        console.log(`\n🏥 ${branch.toUpperCase()} BRANCH:`);
        Object.keys(currentProfile.schedule[branch]).forEach(day => {
          const dayConfig = currentProfile.schedule[branch][day];
          if (dayConfig.enabled) {
            enabledDaysCount++;
            console.log(`   ✅ ${day}: ${dayConfig.start} - ${dayConfig.end}`);
          } else {
            console.log(`   ❌ ${day}: disabled`);
          }
        });
      });
      
      if (enabledDaysCount === 0) {
        console.warn('\n⚠️ NO DAYS ARE ENABLED IN CURRENT USER SCHEDULE!');
        console.log('This user will not appear as available provider.');
      } else {
        console.log(`\n✅ Current user has ${enabledDaysCount} enabled day configurations`);
      }
    } else {
      console.warn('⚠️ Current user has no schedule configured');
    }
    
    // Step 4: Check All Doctors in System
    console.log('\n4️⃣ CHECKING ALL DOCTORS IN SYSTEM');
    console.log('==================================');
    
    const { data: allDoctors, error: doctorsError } = await window.supabase
      .from('profiles')
      .select('id, full_name, role, schedule, unavailable_dates')
      .eq('role', 'doctor');
    
    if (doctorsError) {
      console.error('❌ Failed to fetch doctors:', doctorsError);
      return;
    }
    
    console.log(`👨‍⚕️ Found ${allDoctors.length} doctors in system`);
    
    let doctorsWithSchedules = 0;
    let doctorsWithEnabledDays = 0;
    
    allDoctors.forEach((doctor, index) => {
      console.log(`\n👤 Doctor ${index + 1}: ${doctor.full_name} (${doctor.id})`);
      
      if (doctor.schedule) {
        doctorsWithSchedules++;
        console.log('   ✅ Has schedule configuration');
        
        // Check if any days are enabled
        let hasEnabledDays = false;
        let enabledDaysCount = 0;
        
        Object.keys(doctor.schedule).forEach(branch => {
          const branchConfig = doctor.schedule[branch];
          if (branchConfig) {
            Object.keys(branchConfig).forEach(day => {
              const dayConfig = branchConfig[day];
              if (dayConfig && dayConfig.enabled) {
                hasEnabledDays = true;
                enabledDaysCount++;
              }
            });
          }
        });
        
        if (hasEnabledDays) {
          doctorsWithEnabledDays++;
          console.log(`   ✅ Has ${enabledDaysCount} enabled day configurations`);
        } else {
          console.log('   ⚠️ NO DAYS ENABLED - This doctor won\'t appear in appointment slots!');
        }
        
        // Show detailed schedule for this doctor
        console.log('   📋 Schedule details:');
        Object.keys(doctor.schedule).forEach(branch => {
          console.log(`      🏥 ${branch}:`);
          Object.keys(doctor.schedule[branch]).forEach(day => {
            const dayConfig = doctor.schedule[branch][day];
            const status = dayConfig.enabled ? '✅' : '❌';
            console.log(`         ${status} ${day}: ${dayConfig.start} - ${dayConfig.end}`);
          });
        });
        
      } else {
        console.log('   ❌ No schedule configuration');
      }
    });
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total doctors: ${allDoctors.length}`);
    console.log(`   With schedules: ${doctorsWithSchedules}`);
    console.log(`   With enabled days: ${doctorsWithEnabledDays}`);
    
    // Step 5: Test Schedule Service
    console.log('\n5️⃣ TESTING SCHEDULE SERVICE');
    console.log('===========================');
    
    if (!window.ScheduleService) {
      console.error('❌ ScheduleService not available in window');
      console.log('💡 This might indicate the ScheduleService is not loaded properly');
      return;
    }
    
    console.log('✅ ScheduleService available');
    
    // Test for tomorrow's appointments
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const testDate = tomorrow.toISOString().split('T')[0];
    const dayName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' });
    
    console.log(`📅 Testing for: ${testDate} (${dayName})`);
    
    const branches = ['Cabugao', 'San Juan'];
    
    for (const branch of branches) {
      console.log(`\n🏥 Testing ${branch} branch:`);
      
      try {
        // Test provider availability
        const providers = await window.ScheduleService.getAvailableProviders(branch, testDate, '08:00');
        console.log(`   Available providers: ${providers.length}`);
        
        if (providers.length > 0) {
          providers.forEach(provider => {
            console.log(`   👨‍⚕️ ${provider.full_name} - Available`);
          });
          
          // Test time slot generation
          const slots = await window.ScheduleService.getAvailableTimeSlots(branch, testDate, 30);
          console.log(`   Generated time slots: ${slots.availableSlots.length}`);
          
          if (slots.availableSlots.length > 0) {
            console.log(`   First few slots: ${slots.availableSlots.slice(0, 5).join(', ')}`);
            console.log(`   ✅ ${branch} branch working correctly!`);
          } else {
            console.log(`   ⚠️ No time slots generated despite having providers`);
            if (slots.message) {
              console.log(`   Message: ${slots.message}`);
            }
          }
        } else {
          console.log(`   ⚠️ No providers available for ${branch} on ${dayName}`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error testing ${branch}:`, error);
      }
    }
    
    // Step 6: Final Recommendations
    console.log('\n6️⃣ FINAL RECOMMENDATIONS');
    console.log('========================');
    
    if (doctorsWithEnabledDays === 0) {
      console.log('🚨 CRITICAL ISSUE: No doctors have enabled working days!');
      console.log('');
      console.log('SOLUTION:');
      console.log('1. Each doctor needs to login');
      console.log('2. Go to Settings → Schedule tab');
      console.log('3. CHECK THE BOXES ✅ to enable working days');
      console.log('4. Set appropriate start and end times');
      console.log('5. Click "Save Schedule & Availability"');
      console.log('');
      console.log('💡 The checkboxes are the most important part!');
      
    } else if (doctorsWithEnabledDays > 0) {
      console.log('✅ Schedule system is properly configured!');
      console.log('');
      console.log('If appointment slots still don\'t appear:');
      console.log('1. Refresh the patient appointments page');
      console.log('2. Clear browser cache');
      console.log('3. Try a different date');
      console.log('4. Check console logs for specific errors');
    }
    
    if (doctorsWithSchedules < allDoctors.length) {
      const missingSchedules = allDoctors.length - doctorsWithSchedules;
      console.log(`⚠️ ${missingSchedules} doctor(s) still need to configure their schedules`);
    }
    
    console.log('\n🎉 VERIFICATION COMPLETE!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Auto-run the verification
console.log('🔧 LOADING SCHEDULE VERIFICATION TOOL...');
setTimeout(verifyDatabaseAndSchedules, 1000);

// Make available for manual run
window.verifyDatabaseAndSchedules = verifyDatabaseAndSchedules;
console.log('💡 You can also run: verifyDatabaseAndSchedules()');

