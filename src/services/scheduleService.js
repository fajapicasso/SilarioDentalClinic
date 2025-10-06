// src/services/scheduleService.js - Schedule and Availability Service
import supabase from '../config/supabaseClient';

export class ScheduleService {
  /**
   * Debug method to inspect multi-doctor availability scenarios
   */
  static async debugMultiDoctorAvailability(branch, date, time) {
    try {
      console.log(`🔍 Debugging multi-doctor availability for ${branch} on ${date} at ${time}`);
      
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const branchKey = branch.toLowerCase().replace(' ', '');
      
      // Get all doctors
      const { data: doctors, error } = await supabase
        .from('profiles')
        .select('id, full_name, schedule, unavailable_dates')
        .eq('role', 'doctor');
      
      if (error) throw error;
      
      console.log(`👥 Found ${doctors.length} doctors to check`);
      
      const results = [];
      
      for (const doctor of doctors) {
        const isAvailable = await this.isProviderAvailable(doctor, branch, date, time, dayOfWeek);
        
        const schedule = doctor.schedule;
        const daySchedule = schedule?.[branchKey]?.[dayOfWeek];
        
        const unavailableDates = doctor.unavailable_dates || [];
        const isDateUnavailable = unavailableDates.some(entry => 
          entry.date === date && 
          entry.branch.toLowerCase().replace(' ', '') === branchKey &&
          entry.type !== 'specific_schedule' &&
          (entry.timeSlots === null || (Array.isArray(entry.timeSlots) && entry.timeSlots.includes(time)))
        );
        
        results.push({
          doctor: doctor.full_name,
          isAvailable,
          schedule: daySchedule ? {
            enabled: daySchedule.enabled,
            start: daySchedule.start,
            end: daySchedule.end
          } : 'No schedule',
          isDateUnavailable,
          unavailableDates: unavailableDates.filter(entry => 
            entry.date === date && 
            entry.branch.toLowerCase().replace(' ', '') === branchKey
          )
        });
      }
      
      console.log('📊 Multi-doctor availability results:', results);
      
      const availableDoctors = results.filter(r => r.isAvailable);
      const unavailableDoctors = results.filter(r => !r.isAvailable);
      
      console.log(`✅ Available doctors (${availableDoctors.length}):`, availableDoctors.map(d => d.doctor));
      console.log(`❌ Unavailable doctors (${unavailableDoctors.length}):`, unavailableDoctors.map(d => `${d.doctor} - ${d.schedule}`));
      
      return {
        timeSlot: `${time} on ${date} at ${branch}`,
        availableDoctors,
        unavailableDoctors,
        totalDoctors: doctors.length,
        timeSlotAvailable: availableDoctors.length > 0
      };
      
    } catch (error) {
      console.error('Debug error:', error);
      return { error: error.message };
    }
  }

  /**
   * Debug method to help troubleshoot schedule issues
   */
  static async debugScheduleIssue(branch, date) {
    console.log(`🔍 DEBUG: Checking schedule issue for ${branch} on ${date}`);
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const branchKey = branch.toLowerCase().replace(' ', '');
    
    console.log(`📅 Day of week: ${dayOfWeek}`);
    console.log(`🏢 Branch key: "${branchKey}"`);
    
    try {
      // Get all doctors
      const { data: doctors, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, schedule, unavailable_dates')
        .eq('role', 'doctor');
        
      if (error) {
        console.error('Error fetching doctors:', error);
        return;
      }
      
      console.log(`👨‍⚕️ Found ${doctors?.length || 0} doctors`);
      
      doctors?.forEach(doctor => {
        console.log(`\n=== Doctor: ${doctor.full_name} ===`);
        console.log('Has schedule:', !!doctor.schedule);
        
        if (doctor.schedule) {
          console.log('Schedule branches:', Object.keys(doctor.schedule));
          
          // Check if doctor has schedule for this branch
          if (doctor.schedule[branchKey]) {
            console.log(`✅ Has schedule for ${branchKey}`);
            console.log('Available days:', Object.keys(doctor.schedule[branchKey]));
            
            if (doctor.schedule[branchKey][dayOfWeek]) {
              const daySchedule = doctor.schedule[branchKey][dayOfWeek];
              console.log(`${dayOfWeek} schedule:`, {
                enabled: daySchedule.enabled,
                start: daySchedule.start,
                end: daySchedule.end
              });
            } else {
              console.log(`❌ No schedule for ${dayOfWeek}`);
            }
          } else {
            console.log(`❌ No schedule for ${branchKey}`);
          }
        }
        
        // Check unavailable dates
        const unavailableDates = doctor.unavailable_dates || [];
        console.log('Unavailable dates:', unavailableDates.length);
        
        unavailableDates.forEach(entry => {
          console.log(`  Date: ${entry.date}, Branch: "${entry.branch}", Type: ${entry.type}, TimeSlots: ${entry.timeSlots}`);
          
          if (entry.date === date) {
            const entryBranchKey = entry.branch.toLowerCase().replace(' ', '');
            console.log(`    🔍 Checking if "${entryBranchKey}" matches "${branchKey}"`);
            if (entryBranchKey === branchKey) {
              console.log(`    ❌ MATCH FOUND - This entry affects ${branch}`);
            } else {
              console.log(`    ✅ No match - This entry doesn't affect ${branch}`);
            }
          }
        });
      });
      
    } catch (error) {
      console.error('Debug error:', error);
    }
  }
  /**
   * Get all providers who have schedules configured for a specific branch and date
   * (regardless of specific time availability)
   */
  static async getProvidersWithScheduleForBranch(branch, date, currentDoctorId = null) {
    try {
      console.log(`🔍 Getting providers with schedules for ${branch} on ${date}`);
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const branchKey = branch.toLowerCase().replace(' ', '');
      
      // Get doctors with their schedules (filter by current doctor if specified)
      let query = supabase
        .from('profiles')
        .select('id, full_name, role, schedule, unavailable_dates')
        .eq('role', 'doctor');
      
      if (currentDoctorId) {
        query = query.eq('id', currentDoctorId);
      }
      
      let { data: doctors, error: doctorError } = await query;
      
      if (doctorError && (doctorError.code === '42703' || doctorError.message?.includes('column'))) {
        console.warn('Schedule columns not found, using fallback data');
        const { data: doctorsBasic, error: basicError } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('role', 'doctor');
          
        if (basicError) throw basicError;
        
        doctors = doctorsBasic?.map(doctor => ({
          ...doctor,
          schedule: this.getLocalSchedule(doctor.id, 'doctor'),
          unavailable_dates: this.getLocalUnavailableDates(doctor.id, 'doctor')
        })) || [];
      }
      
      const { data: staff, error: staffError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'staff');
      
      if (doctorError && !doctorError.message?.includes('column')) {
        throw doctorError;
      }
      if (staffError) throw staffError;
      
      // Get staff schedules separately
      const staffIds = staff?.map(s => s.id) || [];
      let staffSchedules = [];
      
      if (staffIds.length > 0) {
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('staff_schedules')
          .select('*')
          .in('staff_id', staffIds);
          
        if (scheduleError && (scheduleError.code === 'PGRST116' || scheduleError.message?.includes('does not exist'))) {
          console.warn('staff_schedules table not found, using localStorage fallback');
          staffSchedules = staffIds.map(staffId => ({
            staff_id: staffId,
            schedule: this.getLocalSchedule(staffId, 'staff'),
            unavailable_dates: this.getLocalUnavailableDates(staffId, 'staff')
          }));
        } else if (scheduleError) {
          console.warn('Error fetching staff schedules:', scheduleError);
          staffSchedules = [];
        } else {
          staffSchedules = scheduleData || [];
        }
      }
      
      // Combine staff with their schedules
      const staffWithSchedules = staff?.map(staffMember => ({
        ...staffMember,
        schedule: staffSchedules?.find(s => s.staff_id === staffMember.id)?.schedule,
        unavailable_dates: staffSchedules?.find(s => s.staff_id === staffMember.id)?.unavailable_dates || []
      })) || [];
      
      const allProviders = [...(doctors || []), ...staffWithSchedules];
      console.log(`👥 Total providers to check: ${allProviders.length}`);
      
      // Filter providers who have schedules for this branch and day
      const providersWithSchedule = allProviders.filter(provider => {
        const schedule = provider.schedule;
        if (!schedule) return false;
        
        // Check if provider has schedule for this branch
        if (!schedule[branchKey]) return false;
        
        // Check if provider has schedule for this day
        if (!schedule[branchKey][dayOfWeek]) return false;
        
        // Check if provider works on this day (must be explicitly enabled)
        if (!schedule[branchKey][dayOfWeek].enabled) return false;
        
        // Check if the entire day is marked as unavailable
        const unavailableDates = provider.unavailable_dates || [];
        const isEntireDayUnavailable = unavailableDates.some(entry => 
          entry.date === date && 
          entry.branch.toLowerCase().replace(' ', '') === branchKey && 
          entry.type !== 'specific_schedule' && // Not a specific schedule entry
          entry.timeSlots === null // Entire day unavailable
        );
        
        if (isEntireDayUnavailable) {
          console.log(`   ❌ Provider ${provider.full_name} has entire day ${date} marked unavailable at ${branch}`);
          return false;
        }
        
        console.log(`   ✅ Provider ${provider.full_name} has schedule for ${dayOfWeek} at ${branch}`);
        return true;
      });
      
      console.log(`✅ Providers with schedules for ${branch}: ${providersWithSchedule.length}`);
      return providersWithSchedule;
    } catch (error) {
      console.error('❌ Error getting providers with schedules:', error);
      return [];
    }
  }

  /**
   * Get available doctors/staff for a specific branch, date, and time
   */
  static async getAvailableProviders(branch, date, time) {
    try {
      console.log(`🔍 Getting available providers for ${branch} on ${date} at ${time}`);
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      console.log(`📅 Day of week: ${dayOfWeek}`);
      
      // Get all doctors and staff with their schedules
      console.log('📊 Fetching doctors from database...');
      let { data: doctors, error: doctorError } = await supabase
        .from('profiles')
        .select('id, full_name, role, schedule, unavailable_dates')
        .eq('role', 'doctor');
      
      console.log('🔍 Database query result:', { 
        doctors: doctors?.length || 0, 
        error: doctorError ? {
          message: doctorError.message,
          code: doctorError.code,
          details: doctorError.details,
          hint: doctorError.hint
        } : null 
      });
      
      console.log('👨‍⚕️ Doctors found:', doctors?.length || 0);
      if (doctors && doctors.length > 0) {
        doctors.forEach(doctor => {
          console.log(`   Doctor: ${doctor.full_name} (ID: ${doctor.id})`);
          console.log(`   Has schedule:`, !!doctor.schedule);
          if (doctor.schedule) {
            console.log(`   Schedule branches:`, Object.keys(doctor.schedule));
            console.log(`   Full schedule data:`, JSON.stringify(doctor.schedule, null, 2));
          } else {
            console.log(`   ⚠️ No schedule data for this doctor`);
          }
        });
      } else {
        console.log('   ⚠️ No doctors found in database');
      }
        
      // If schedule columns don't exist, try without them and load from localStorage
      if (doctorError && (doctorError.code === '42703' || doctorError.message?.includes('column'))) {
        console.warn('Schedule columns not found, using fallback data');
        const { data: doctorsBasic, error: basicError } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('role', 'doctor');
          
        if (basicError) throw basicError;
        
        // Enhance with localStorage data
        doctors = doctorsBasic?.map(doctor => ({
          ...doctor,
          schedule: this.getLocalSchedule(doctor.id, 'doctor'),
          unavailable_dates: this.getLocalUnavailableDates(doctor.id, 'doctor')
        })) || [];
      }
      
      const { data: staff, error: staffError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'staff');
      
      if (doctorError && !doctorError.message?.includes('column')) {
        throw doctorError;
      }
      if (staffError) throw staffError;
      
      // Get staff schedules separately
      const staffIds = staff?.map(s => s.id) || [];
      let staffSchedules = [];
      
      if (staffIds.length > 0) {
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('staff_schedules')
          .select('*')
          .in('staff_id', staffIds);
          
        if (scheduleError && (scheduleError.code === 'PGRST116' || scheduleError.message?.includes('does not exist'))) {
          console.warn('staff_schedules table not found, using localStorage fallback');
          // Create mock data from localStorage for each staff member
          staffSchedules = staffIds.map(staffId => ({
            staff_id: staffId,
            schedule: this.getLocalSchedule(staffId, 'staff'),
            unavailable_dates: this.getLocalUnavailableDates(staffId, 'staff')
          }));
        } else if (scheduleError) {
          console.warn('Error fetching staff schedules:', scheduleError);
          staffSchedules = [];
        } else {
          staffSchedules = scheduleData || [];
        }
      }
      
      // Combine staff with their schedulesS
      const staffWithSchedules = staff?.map(staffMember => ({
        ...staffMember,
        schedule: staffSchedules?.find(s => s.staff_id === staffMember.id)?.schedule,
        unavailable_dates: staffSchedules?.find(s => s.staff_id === staffMember.id)?.unavailable_dates || []
      })) || [];
      
      const allProviders = [...(doctors || []), ...staffWithSchedules];
      console.log(`👥 Total providers to check: ${allProviders.length}`);
      
      const availableProviders = [];
      
      for (const provider of allProviders) {
        console.log(`🔍 Checking availability for ${provider.full_name}...`);
        const isAvailable = await this.isProviderAvailable(provider, branch, date, time, dayOfWeek);
        console.log(`   Result: ${isAvailable ? '✅ Available' : '❌ Not available'}`);
        
        if (isAvailable) {
          availableProviders.push(provider);
        }
      }
      
      console.log(`✅ Available providers: ${availableProviders.length}`);
      return availableProviders;
    } catch (error) {
      console.error('❌ Error getting available providers:', error);
      console.error('Full error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        stack: error.stack
      });
      return [];
    }
  }
  
  /**
   * Check if a specific provider is available
   */
  static async isProviderAvailable(provider, branch, date, time, dayOfWeek) {
    try {
      console.log(`🔍 Checking availability for ${provider.full_name}...`);
      console.log(`   Parameters: branch=${branch}, date=${date}, time=${time}, dayOfWeek=${dayOfWeek}`);
      
      const branchKey = branch.toLowerCase().replace(' ', '');
      console.log(`   Converted branch key: ${branchKey}`);
      
      const schedule = provider.schedule;
      console.log(`   Provider has schedule:`, !!schedule);
      
      // Check if provider has schedule configured at all
      if (!schedule) {
        console.log(`   ❌ Provider ${provider.full_name} has no schedule configured`);
        return false;
      }
      
      console.log(`   Available branches in schedule:`, Object.keys(schedule));
      
      // Check if provider has schedule for this branch
      if (!schedule[branchKey]) {
        console.log(`   ❌ Provider ${provider.full_name} has no schedule for ${branch} branch (key: ${branchKey})`);
        console.log(`   Available branch keys:`, Object.keys(schedule));
        return false;
      }
      
      console.log(`   Available days for ${branchKey}:`, Object.keys(schedule[branchKey]));
      
      // Check if provider has schedule for this day
      if (!schedule[branchKey][dayOfWeek]) {
        console.log(`   ❌ Provider ${provider.full_name} has no schedule for ${dayOfWeek} at ${branch}`);
        console.log(`   Available days:`, Object.keys(schedule[branchKey]));
        return false;
      }
      
      const daySchedule = schedule[branchKey][dayOfWeek];
      console.log(`   Day schedule for ${dayOfWeek}:`, daySchedule);
      
      // Check if provider works on this day (must be explicitly enabled)
      if (!daySchedule.enabled) {
        console.log(`   ❌ Provider ${provider.full_name} is not available on ${dayOfWeek} at ${branch} (not enabled)`);
        return false;
      }
      
      console.log(`   ✅ Day is enabled: ${daySchedule.start} - ${daySchedule.end}`);
      
      // Check if time falls within working hours
      const [requestHour, requestMinute] = time.split(':').map(Number);
      const requestTimeMinutes = requestHour * 60 + requestMinute;
      
      const [startHour, startMinute] = daySchedule.start.split(':').map(Number);
      const startTimeMinutes = startHour * 60 + startMinute;
      
      const [endHour, endMinute] = daySchedule.end.split(':').map(Number);
      const endTimeMinutes = endHour * 60 + endMinute;
      
      if (requestTimeMinutes < startTimeMinutes || requestTimeMinutes >= endTimeMinutes) {
        console.log(`   ❌ Time ${time} outside working hours ${daySchedule.start}-${daySchedule.end}`);
        return false;
      }
      
      // Enhanced unavailable date checking and specific date schedule checking
      const unavailableDates = provider.unavailable_dates || [];
      
      // First check for specific date schedules (overrides regular schedule)
      const specificDateSchedule = unavailableDates.find(entry => 
        entry.date === date && 
        entry.branch.toLowerCase().replace(' ', '') === branchKey && 
        entry.type === 'specific_schedule'
      );
      
      if (specificDateSchedule) {
        console.log(`   📅 Found specific date schedule for ${date} at ${branch}: ${specificDateSchedule.startTime} - ${specificDateSchedule.endTime}`);
        
        // Check if time falls within specific date schedule
        const [requestHour, requestMinute] = time.split(':').map(Number);
        const requestTimeMinutes = requestHour * 60 + requestMinute;
        
        const [startHour, startMinute] = specificDateSchedule.startTime.split(':').map(Number);
        const startTimeMinutes = startHour * 60 + startMinute;
        
        const [endHour, endMinute] = specificDateSchedule.endTime.split(':').map(Number);
        const endTimeMinutes = endHour * 60 + endMinute;
        
        if (requestTimeMinutes >= startTimeMinutes && requestTimeMinutes < endTimeMinutes) {
          console.log(`   ✅ Time ${time} is within specific date schedule`);
          // Still need to check for unavailable times within this specific schedule
          const isUnavailableInSpecificSchedule = unavailableDates.some(entry => 
            entry.date === date && 
            entry.branch.toLowerCase().replace(' ', '') === branchKey && 
            entry.type !== 'specific_schedule' && // Not a specific schedule entry
            (
              (entry.timeSlots === null) || // Entire day unavailable
              (Array.isArray(entry.timeSlots) && entry.timeSlots.includes(time)) // Specific time unavailable
            )
          );
          
          if (isUnavailableInSpecificSchedule) {
            console.log(`   ❌ Time ${time} is marked unavailable within specific date schedule`);
            return false;
          }
          
          return true;
        } else {
          console.log(`   ❌ Time ${time} is outside specific date schedule hours`);
          return false;
        }
      }
      
      // Check for regular unavailable dates
      const isDateUnavailable = unavailableDates.some(entry => {
        // Skip specific schedule entries
        if (entry.type === 'specific_schedule') return false;
        
        // Check if the date matches
        if (entry.date !== date) return false;
        
        // Check if the branch matches (case insensitive and space-insensitive)
        if (entry.branch.toLowerCase().replace(' ', '') !== branchKey) return false;
        
        // If timeSlots is null, entire day is unavailable
        if (entry.timeSlots === null) {
          console.log(`   ❌ Entire day ${date} is marked unavailable at ${branch}`);
          return true;
        }
        
        // If timeSlots is an array, check if this specific time is unavailable
        if (Array.isArray(entry.timeSlots) && entry.timeSlots.includes(time)) {
          console.log(`   ❌ Time ${time} on ${date} is marked unavailable at ${branch}`);
          return true;
        }
        
        return false;
      });
      
      if (isDateUnavailable) {
        return false;
      }
      
      console.log(`   ✅ Provider ${provider.full_name} is available at ${time} on ${date} at ${branch}`);
      return true;
    } catch (error) {
      console.error('Error checking provider availability:', error);
      return false;
    }
  }
  
  /**
   * Get available time slots for a specific branch and date
   */
  static async getAvailableTimeSlots(branch, date, durationMinutes = 30, currentDoctorId = null) {
    try {
      console.log(`🕐 Getting available time slots for ${branch} on ${date} (duration: ${durationMinutes}min)`);
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const branchKey = branch.toLowerCase().replace(' ', '');
      
      // Get all providers who have schedules for this branch (not just available at 8:00)
      const allProviders = await this.getProvidersWithScheduleForBranch(branch, date, currentDoctorId);
      console.log(`📋 Found ${allProviders.length} total providers with schedules for ${branch}`);
      
      if (allProviders.length === 0) {
        console.log('❌ No providers available - checking if any providers exist at all');
        
        // Check if any providers exist but just have no schedule configured
        const { data: allDoctors } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('role', 'doctor');
          
        const { data: allStaff } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('role', 'staff');
          
        const totalProviders = (allDoctors?.length || 0) + (allStaff?.length || 0);
        
        if (totalProviders > 0) {
          return {
            availableSlots: [],
            formattedSlots: [],
            message: `No healthcare providers have configured their working schedule for ${branch} branch on ${dayOfWeek}s. Please contact the clinic to set up schedules or try another date.`
          };
        } else {
          return {
            availableSlots: [],
            formattedSlots: [],
            message: 'No healthcare providers available. Please contact the clinic administration.'
          };
        }
      }
      
      // Calculate overall available hours based on all providers
      let earliestStart = 24 * 60; // Start with end of day
      let latestEnd = 0;
      const providersWorkingHours = new Map();
      
      allProviders.forEach(provider => {
        const schedule = provider.schedule;
        const unavailableDates = provider.unavailable_dates || [];
        
        // Check if there's a specific schedule for this date
        const specificDateSchedule = unavailableDates.find(entry => 
          entry.date === date && 
          entry.branch.toLowerCase().replace(' ', '') === branchKey && 
          entry.type === 'specific_schedule'
        );
        
        if (specificDateSchedule) {
          // Use specific date schedule
          const [startHour, startMinute] = specificDateSchedule.startTime.split(':').map(Number);
          const [endHour, endMinute] = specificDateSchedule.endTime.split(':').map(Number);
          
          const startMinutes = startHour * 60 + startMinute;
          const endMinutes = endHour * 60 + endMinute;
          
          earliestStart = Math.min(earliestStart, startMinutes);
          latestEnd = Math.max(latestEnd, endMinutes);
          
          // Store individual provider working hours for detailed slot checking
          providersWorkingHours.set(provider.id, { 
            start: startMinutes, 
            end: endMinutes, 
            provider,
            isSpecificSchedule: true,
            specificSchedule: specificDateSchedule
          });
          
          console.log(`📅 Using specific schedule for ${provider.full_name}: ${specificDateSchedule.startTime} - ${specificDateSchedule.endTime}`);
        } else if (schedule && schedule[branchKey] && schedule[branchKey][dayOfWeek] && schedule[branchKey][dayOfWeek].enabled) {
          // Use regular schedule
          const daySchedule = schedule[branchKey][dayOfWeek];
          const [startHour, startMinute] = daySchedule.start.split(':').map(Number);
          const [endHour, endMinute] = daySchedule.end.split(':').map(Number);
          
          const startMinutes = startHour * 60 + startMinute;
          const endMinutes = endHour * 60 + endMinute;
          
          earliestStart = Math.min(earliestStart, startMinutes);
          latestEnd = Math.max(latestEnd, endMinutes);
          
          // Store individual provider working hours for detailed slot checking
          providersWorkingHours.set(provider.id, { 
            start: startMinutes, 
            end: endMinutes, 
            provider,
            isSpecificSchedule: false
          });
        }
      });
      
      console.log(`⏰ Overall operating hours: ${Math.floor(earliestStart/60).toString().padStart(2,'0')}:${(earliestStart%60).toString().padStart(2,'0')} - ${Math.floor(latestEnd/60).toString().padStart(2,'0')}:${(latestEnd%60).toString().padStart(2,'0')}`);
      
      if (earliestStart >= latestEnd) {
        return {
          availableSlots: [],
          formattedSlots: [],
          message: `No providers are scheduled to work on ${dayOfWeek}s at ${branch} branch.`
        };
      }
      
      // Get existing appointments for this date and branch
      // Fetch booked appointments with duration information
      let appointmentQuery = supabase
        .from('appointments')
        .select(`
          appointment_time, 
          doctor_id,
          appointment_durations(duration_minutes)
        `)
        .eq('appointment_date', date)
        .eq('branch', branch)
        .neq('status', 'cancelled')
        .neq('status', 'rejected');
      
      // Show ALL appointments (from all doctors) to determine availability
      // This ensures time slots show as unavailable if ANY doctor has an appointment
      
      const { data: bookedAppointments, error } = await appointmentQuery;
      
      if (error) throw error;
      
      console.log('🔍 Found booked appointments:', bookedAppointments);
      console.log('📅 Date being checked:', date);
      console.log('🏢 Branch being checked:', branch);
      
      // Debug: Show appointment details
      if (bookedAppointments && bookedAppointments.length > 0) {
        bookedAppointments.forEach(apt => {
          console.log('📋 Appointment details:', {
            time: apt.appointment_time,
            doctor_id: apt.doctor_id,
            duration: apt.appointment_durations?.[0]?.duration_minutes || 'not set',
            rawData: apt
          });
        });
      } else {
        console.log('⚠️ No appointments found for this date/branch');
      }
      
      // Generate time slots with enhanced availability checking
      const availableSlots = [];
      const formattedSlots = [];
      const interval = 30; // 30-minute intervals
      
      console.log(`🔄 Generating time slots from ${Math.floor(earliestStart/60)}:${(earliestStart%60).toString().padStart(2,'0')} to ${Math.floor(latestEnd/60)}:${(latestEnd%60).toString().padStart(2,'0')}`);
      
      for (let timeMinutes = earliestStart; timeMinutes < latestEnd; timeMinutes += interval) {
        const hour = Math.floor(timeMinutes / 60);
        const minute = timeMinutes % 60;
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Check if the full appointment duration fits within operating hours
        const appointmentEndMinutes = timeMinutes + durationMinutes;
        
        // Check if ANY appointment exists at this time slot (regardless of which doctor)
        const isTimeSlotBooked = bookedAppointments.some(apt => {
          // Get the duration of the existing appointment
          const appointmentDuration = (apt.appointment_durations && apt.appointment_durations[0]?.duration_minutes) || 
                                   30; // Default 30 minutes
          
          // Calculate the time ranges for both appointments
          const existingStart = this.timeToMinutes(apt.appointment_time);
          const existingEnd = existingStart + appointmentDuration;
          const newStart = timeMinutes;
          const newEnd = timeMinutes + durationMinutes;
          
          // Check for overlap: if either appointment starts during the other
          const hasOverlap = (newStart < existingEnd && newEnd > existingStart);
          
          if (hasOverlap) {
            console.log(`❌ Time slot ${timeString} is booked by doctor ${apt.doctor_id}:`, {
              existingAppointment: `${apt.appointment_time} (${appointmentDuration}min)`,
              existingRange: `${existingStart}-${existingEnd}`,
              newRange: `${newStart}-${newEnd}`,
              hasOverlap
            });
          }
          
          return hasOverlap;
        });

        // Find providers available for this specific time slot (only if not booked)
        const providersAvailableAtTime = [];
        const providersUnavailableAtTime = [];
        
        if (!isTimeSlotBooked) {
          for (const provider of allProviders) {
            // Check if provider is scheduled to work at this specific time
            const isAvailable = await this.isProviderAvailable(provider, branch, date, timeString, dayOfWeek);
            
            if (isAvailable) {
              // Check if provider's schedule can accommodate the full appointment duration
              const providerHours = providersWorkingHours.get(provider.id);
              if (providerHours && appointmentEndMinutes <= providerHours.end) {
                providersAvailableAtTime.push(provider);
                console.log(`   ✅ Doctor ${provider.full_name} is available at ${timeString}`);
              } else {
                providersUnavailableAtTime.push({
                  provider: provider.full_name,
                  reason: 'Appointment duration exceeds working hours'
                });
                console.log(`   ❌ Doctor ${provider.full_name} unavailable at ${timeString}: Appointment duration exceeds working hours`);
              }
            } else {
              providersUnavailableAtTime.push({
                provider: provider.full_name,
                reason: 'Schedule not available or marked unavailable'
              });
              console.log(`   ❌ Doctor ${provider.full_name} unavailable at ${timeString}: Schedule not available or marked unavailable`);
            }
          }
        }
        
        const isAvailable = providersAvailableAtTime.length > 0;
        
        // Additional check: ensure appointment doesn't extend beyond any available provider's working hours
        const canAccommodateFullAppointment = providersAvailableAtTime.some(provider => {
          const providerHours = providersWorkingHours.get(provider.id);
          return providerHours && appointmentEndMinutes <= providerHours.end;
        });
        
        const finalAvailable = isAvailable && canAccommodateFullAppointment;
        
        if (finalAvailable) {
          availableSlots.push(timeString);
        }
        
        // Add debugging information for unavailable slots
        const debugInfo = {
          time: timeString,
          providersChecked: allProviders.length,
          providersAvailable: providersAvailableAtTime.length,
          providersUnavailable: providersUnavailableAtTime.length,
          availableDoctors: providersAvailableAtTime.map(p => p.full_name),
          unavailableDoctors: providersUnavailableAtTime.map(p => `${p.provider} (${p.reason})`),
          isAvailable: finalAvailable,
          reason: finalAvailable ? 'Available' : 'No providers available or time marked unavailable'
        };
        
        if (!finalAvailable && allProviders.length > 0) {
          console.log(`❌ Time slot ${timeString} unavailable:`, debugInfo);
        } else if (finalAvailable) {
          console.log(`✅ Time slot ${timeString} available:`, {
            availableDoctors: debugInfo.availableDoctors,
            unavailableDoctors: debugInfo.unavailableDoctors
          });
        }
        
        formattedSlots.push({
          time: timeString,
          available: finalAvailable,
          providersCount: providersAvailableAtTime.length,
          displayTime: this.formatTime(timeString),
          endTime: this.formatTime(this.calculateEndTime(timeString, durationMinutes)),
          availableProviders: providersAvailableAtTime.map(p => ({
            id: p.id,
            name: p.full_name,
            role: p.role
          })),
          debugInfo: debugInfo
        });
      }
      
      return {
        availableSlots,
        formattedSlots,
        message: availableSlots.length > 0 ? null : 'All time slots are booked for this date.'
      };
    } catch (error) {
      console.error('❌ Error getting available time slots:', error);
      console.error('Full error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        stack: error.stack
      });
      return {
        availableSlots: [],
        formattedSlots: [],
        message: `Error loading available time slots: ${error.message}`
      };
    }
  }
  
  /**
   * Check if a specific date/time is available for booking
   */
  static async isTimeSlotAvailable(branch, date, time, durationMinutes = 30) {
    const providers = await this.getAvailableProviders(branch, date, time);
    return providers.length > 0;
  }
  
  /**
   * Get branch operating hours for a specific date
   */
  static async getBranchHours(branch, date, currentDoctorId = null) {
    try {
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const providers = await this.getProvidersWithScheduleForBranch(branch, date, currentDoctorId);
      
      if (providers.length === 0) {
        return { open: false, hours: null };
      }
      
      const branchKey = branch.toLowerCase().replace(' ', '');
      let earliestStart = null;
      let latestEnd = null;
      
      providers.forEach(provider => {
        const schedule = provider.schedule;
        if (schedule && schedule[branchKey] && schedule[branchKey][dayOfWeek] && schedule[branchKey][dayOfWeek].enabled) {
          const daySchedule = schedule[branchKey][dayOfWeek];
          
          if (!earliestStart || daySchedule.start < earliestStart) {
            earliestStart = daySchedule.start;
          }
          if (!latestEnd || daySchedule.end > latestEnd) {
            latestEnd = daySchedule.end;
          }
        }
      });
      
      return {
        open: !!earliestStart && !!latestEnd,
        hours: earliestStart && latestEnd ? {
          start: earliestStart,
          end: latestEnd,
          startFormatted: this.formatTime(earliestStart),
          endFormatted: this.formatTime(latestEnd)
        } : null
      };
    } catch (error) {
      console.error('❌ Error getting branch hours:', error);
      console.error('Full error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        stack: error.stack
      });
      return { open: false, hours: null };
    }
  }
  
  /**
   * Helper function to format time (always AM/PM format)
   */
  static formatTime(timeString) {
    if (!timeString) return '';
    
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  /**
   * Convert AM/PM time to 24-hour format for internal processing
   */
  static parseTimeTo24Hour(timeString) {
    if (!timeString) return '';
    
    // If already in 24-hour format (contains :), return as is
    if (timeString.includes(':') && !timeString.includes('AM') && !timeString.includes('PM')) {
      return timeString;
    }
    
    // Parse AM/PM format
    const match = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return timeString;
    
    let [, hours, minutes, period] = match;
    hours = parseInt(hours);
    minutes = parseInt(minutes);
    
    if (period.toUpperCase() === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period.toUpperCase() === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Convert time string (HH:MM) to minutes since midnight
   */
  static timeToMinutes(timeString) {
    if (!timeString) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  /**
   * Helper function to calculate end time
   */
  static calculateEndTime(startTimeStr, durationMinutes) {
    if (!startTimeStr) return '';
    
    const [hours, minutes] = startTimeStr.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + durationMinutes;
    
    const endHour = Math.floor(endMinutes / 60);
    const endMinute = endMinutes % 60;
    
    return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  }
  
  /**
   * Get schedule from localStorage as fallback
   */
  static getLocalSchedule(userId, role) {
    try {
      const key = role === 'doctor' ? `doctor_schedule_${userId}` : `staff_schedule_${userId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        return data.schedule || null;
      }
    } catch (error) {
      console.warn('Error loading schedule from localStorage:', error);
    }
    return null;
  }
  
  /**
   * Get unavailable dates from localStorage as fallback
   */
  static getLocalUnavailableDates(userId, role) {
    try {
      const key = role === 'doctor' ? `doctor_schedule_${userId}` : `staff_schedule_${userId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        return data.unavailable_dates || [];
      }
    } catch (error) {
      console.warn('Error loading unavailable dates from localStorage:', error);
    }
    return [];
  }

  /**
   * Hardcoded time slots fallback (original clinic schedule)
   */
  static async getHardcodedTimeSlots(branch, date, durationMinutes = 30) {
    try {
      const dayOfWeek = new Date(date).getDay();
      let startHour, endHour;
      
      // Original hardcoded schedule logic
      if (branch === 'Cabugao') {
        if (dayOfWeek === 0) { // Sunday - closed
          return {
            availableSlots: [],
            formattedSlots: [],
            message: 'The Cabugao branch is closed on Sundays.'
          };
        } else if (dayOfWeek === 6) { // Saturday
          startHour = 8;
          endHour = 17;
        } else { // Monday-Friday
          startHour = 8;
          endHour = 12;
        }
      } else if (branch === 'San Juan') {
        if (dayOfWeek === 6) { // Saturday - closed
          return {
            availableSlots: [],
            formattedSlots: [],
            message: 'The San Juan branch is closed on Saturdays.'
          };
        } else if (dayOfWeek === 0) { // Sunday
          startHour = 8;
          endHour = 17;
        } else { // Monday-Friday
          startHour = 13;
          endHour = 17;
        }
      } else {
        return {
          availableSlots: [],
          formattedSlots: [],
          message: 'Invalid branch selected.'
        };
      }

      // Get existing appointments with duration information
      const { data: bookedAppointments, error } = await supabase
        .from('appointments')
        .select(`
          appointment_time, 
          appointment_durations(duration_minutes)
        `)
        .eq('appointment_date', date)
        .eq('branch', branch)
        .neq('status', 'cancelled')
        .neq('status', 'rejected');
      
      if (error) {
        console.warn('Error fetching appointments for hardcoded schedule:', error);
      }
      
      // Create a set of blocked time ranges (not just start times)
      const blockedTimeRanges = (bookedAppointments || []).map(apt => {
        const appointmentDuration = (apt.appointment_durations && apt.appointment_durations[0]?.duration_minutes) || 
                                 30; // Default 30 minutes
        
        const startMinutes = this.timeToMinutes(apt.appointment_time);
        const endMinutes = startMinutes + appointmentDuration;
        
        return { start: startMinutes, end: endMinutes };
      });

      // Generate time slots
      const availableSlots = [];
      const formattedSlots = [];
      const interval = 30;
      
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += interval) {
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          
          // Check if appointment would fit within working hours
          const endTimeMinutes = (hour * 60 + minute) + durationMinutes;
          const slotEndHour = Math.floor(endTimeMinutes / 60);
          
          if (slotEndHour > endHour) continue;
          
          // Check if this time slot overlaps with any existing appointments
          const slotStartMinutes = hour * 60 + minute;
          const slotEndMinutes = slotStartMinutes + durationMinutes;
          
          const isAvailable = !blockedTimeRanges.some(blocked => {
            // Check for overlap: if either appointment starts during the other
            return (slotStartMinutes < blocked.end && slotEndMinutes > blocked.start);
          });
          
          if (isAvailable) {
            availableSlots.push(timeString);
          }
          
          formattedSlots.push({
            time: timeString,
            available: isAvailable,
            providersCount: isAvailable ? 1 : 0,
            displayTime: this.formatTime(timeString),
            endTime: this.formatTime(this.calculateEndTime(timeString, durationMinutes))
          });
        }
      }
      
      return {
        availableSlots,
        formattedSlots,
        message: availableSlots.length > 0 ? null : 'All time slots are booked for this date.'
      };
      
    } catch (error) {
      console.error('Error in hardcoded time slots:', error);
      return {
        availableSlots: [],
        formattedSlots: [],
        message: 'Error generating time slots. Please try again.'
      };
    }
  }
}

export default ScheduleService;
