// Additional utilities for enhanced schedule management
import supabase from '../config/supabaseClient';

export class ScheduleUtils {
  /**
   * Update provider schedule in database
   */
  static async updateProviderSchedule(providerId, role, schedule, unavailableDates = []) {
    try {
      console.log(`📝 Updating schedule for ${role} ${providerId}`);
      
      if (role === 'doctor') {
        const { error } = await supabase
          .from('profiles')
          .update({
            schedule: schedule,
            unavailable_dates: unavailableDates,
            updated_at: new Date().toISOString()
          })
          .eq('id', providerId)
          .eq('role', 'doctor');
          
        if (error) throw error;
      } else if (role === 'staff') {
        // Update both profiles and staff_schedules tables
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            schedule: schedule,
            unavailable_dates: unavailableDates,
            updated_at: new Date().toISOString()
          })
          .eq('id', providerId)
          .eq('role', 'staff');
          
        if (profileError) throw profileError;
        
        // Also update staff_schedules table
        const { error: staffError } = await supabase
          .from('staff_schedules')
          .upsert({
            staff_id: providerId,
            schedule: schedule,
            unavailable_dates: unavailableDates,
            updated_at: new Date().toISOString()
          });
          
        if (staffError) throw staffError;
      }
      
      console.log(`✅ Successfully updated ${role} schedule`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error updating ${role} schedule:`, error);
      return { success: false, error };
    }
  }

  /**
   * Get provider's current schedule
   */
  static async getProviderSchedule(providerId, role) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('schedule, unavailable_dates')
        .eq('id', providerId)
        .eq('role', role)
        .single();
        
      if (error) throw error;
      
      return {
        schedule: data.schedule || null,
        unavailable_dates: data.unavailable_dates || []
      };
    } catch (error) {
      console.error('Error fetching provider schedule:', error);
      return {
        schedule: null,
        unavailable_dates: []
      };
    }
  }

  /**
   * Validate appointment against provider availability
   */
  static async validateAppointment(providerId, branch, date, time, durationMinutes = 30, excludeAppointmentId = null) {
    try {
      console.log(`🔍 Validating appointment: Provider ${providerId}, ${branch}, ${date}, ${time}`);
      
      // Get provider details
      const { data: provider, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, schedule, unavailable_dates')
        .eq('id', providerId)
        .single();
        
      if (error) throw error;
      if (!provider) {
        return { valid: false, reason: 'Provider not found' };
      }
      
      // Check if provider has schedule configured
      if (!provider.schedule) {
        return { valid: false, reason: 'Provider has not configured their working schedule' };
      }
      
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const branchKey = branch.toLowerCase().replace(' ', '');
      
      // Check if provider works at this branch on this day
      const daySchedule = provider.schedule[branchKey]?.[dayOfWeek];
      if (!daySchedule || !daySchedule.enabled) {
        return { valid: false, reason: `Provider does not work on ${dayOfWeek}s at ${branch} branch` };
      }
      
      // Check if time falls within working hours
      const [requestHour, requestMinute] = time.split(':').map(Number);
      const requestTimeMinutes = requestHour * 60 + requestMinute;
      const requestEndMinutes = requestTimeMinutes + durationMinutes;
      
      const [startHour, startMinute] = daySchedule.start.split(':').map(Number);
      const startTimeMinutes = startHour * 60 + startMinute;
      
      const [endHour, endMinute] = daySchedule.end.split(':').map(Number);
      const endTimeMinutes = endHour * 60 + endMinute;
      
      if (requestTimeMinutes < startTimeMinutes || requestEndMinutes > endTimeMinutes) {
        return { 
          valid: false, 
          reason: `Appointment time (${time}) is outside working hours (${daySchedule.start}-${daySchedule.end})` 
        };
      }
      
      // Check if date/time is marked as unavailable
      const unavailableDates = provider.unavailable_dates || [];
      const isUnavailable = unavailableDates.some(entry => {
        if (entry.date !== date || entry.branch.toLowerCase() !== branchKey) {
          return false;
        }
        
        // If timeSlots is null, entire day is unavailable
        if (entry.timeSlots === null) {
          return true;
        }
        
        // If timeSlots is an array, check if this specific time is unavailable
        if (Array.isArray(entry.timeSlots) && entry.timeSlots.includes(time)) {
          return true;
        }
        
        return false;
      });
      
      if (isUnavailable) {
        return { valid: false, reason: 'Provider is not available at this time (marked as unavailable)' };
      }
      
      // Check for conflicting appointments
      let query = supabase
        .from('appointments')
        .select('id, appointment_time')
        .eq('doctor_id', providerId)
        .eq('appointment_date', date)
        .neq('status', 'cancelled')
        .neq('status', 'rejected');
        
      if (excludeAppointmentId) {
        query = query.neq('id', excludeAppointmentId);
      }
      
      const { data: conflicts, error: conflictError } = await query;
      if (conflictError) throw conflictError;
      
      // Check if the time slot conflicts with existing appointments
      const hasConflict = conflicts.some(apt => {
        const [aptHour, aptMinute] = apt.appointment_time.split(':').map(Number);
        const aptTimeMinutes = aptHour * 60 + aptMinute;
        const aptEndMinutes = aptTimeMinutes + 30; // Default appointment duration
        
        // Check for overlap
        return (requestTimeMinutes < aptEndMinutes && requestEndMinutes > aptTimeMinutes);
      });
      
      if (hasConflict) {
        return { valid: false, reason: 'Time slot conflicts with existing appointment' };
      }
      
      return { valid: true, provider };
    } catch (error) {
      console.error('Error validating appointment:', error);
      return { valid: false, reason: 'Error validating appointment: ' + error.message };
    }
  }

  /**
   * Get all available providers for a specific date, time, and branch
   */
  static async getAvailableProvidersForTime(branch, date, time, durationMinutes = 30) {
    try {
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const branchKey = branch.toLowerCase().replace(' ', '');
      
      // Get all doctors and staff
      const { data: allProviders, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, schedule, unavailable_dates')
        .in('role', ['doctor', 'staff']);
        
      if (error) throw error;
      
      const availableProviders = [];
      
      for (const provider of allProviders || []) {
        const validation = await this.validateAppointment(provider.id, branch, date, time, durationMinutes);
        if (validation.valid) {
          availableProviders.push(provider);
        }
      }
      
      return availableProviders;
    } catch (error) {
      console.error('Error getting available providers for time:', error);
      return [];
    }
  }

  /**
   * Get working hours summary for a provider
   */
  static getProviderWorkingHoursSummary(schedule) {
    if (!schedule) return null;
    
    const summary = {};
    
    Object.entries(schedule).forEach(([branch, days]) => {
      summary[branch] = {};
      Object.entries(days).forEach(([day, config]) => {
        if (config.enabled) {
          summary[branch][day] = `${config.start} - ${config.end}`;
        }
      });
    });
    
    return summary;
  }

  /**
   * Check if a provider is working on a specific date
   */
  static isProviderWorkingOnDate(schedule, unavailableDates, branch, date) {
    if (!schedule) return false;
    
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const branchKey = branch.toLowerCase().replace(' ', '');
    
    // Check if provider works this day
    const daySchedule = schedule[branchKey]?.[dayOfWeek];
    if (!daySchedule || !daySchedule.enabled) {
      return false;
    }
    
    // Check if date is marked as unavailable
    const isUnavailable = (unavailableDates || []).some(entry => 
      entry.date === date && 
      entry.branch.toLowerCase() === branchKey &&
      entry.timeSlots === null // null means entire day is unavailable
    );
    
    return !isUnavailable;
  }
}

export default ScheduleUtils;
