// Calendar-based schedule utilities
import supabase from '../config/supabaseClient';
import ScheduleUtils from './scheduleUtils';

export class CalendarScheduleUtils {
  /**
   * Get available time slots for a specific date (supports calendar-based scheduling)
   */
  static getProviderTimeSlotsForDate(schedule, branch, date) {
    if (!schedule) return [];
    
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const branchKey = branch.toLowerCase().replace(' ', '');
    const specificDateKey = `${date}_${branchKey}`;
    
    // Check for specific date override first (calendar-based scheduling)
    if (schedule[specificDateKey]) {
      const specificSchedule = schedule[specificDateKey];
      
      // If marked as unavailable
      if (specificSchedule.unavailable) {
        return [];
      }
      
      // Return custom time slots
      if (specificSchedule.timeSlots && specificSchedule.timeSlots.length > 0) {
        return specificSchedule.timeSlots.filter(slot => slot.isAvailable);
      }
    }
    
    // Fall back to regular weekly schedule
    const daySchedule = schedule[branchKey]?.[dayOfWeek];
    if (daySchedule && daySchedule.enabled) {
      return [{
        id: `default_${dayOfWeek}`,
        startTime: daySchedule.start,
        endTime: daySchedule.end,
        isAvailable: true,
        isDefault: true
      }];
    }
    
    return [];
  }

  /**
   * Save calendar-based schedule for a specific date
   */
  static async saveCalendarSchedule(providerId, role, date, branch, timeSlots) {
    try {
      console.log(`📅 Saving calendar schedule for ${role} ${providerId} on ${date} at ${branch}`);
      
      // Get current schedule
      const currentSchedule = await ScheduleUtils.getProviderSchedule(providerId, role);
      const branchKey = branch.toLowerCase().replace(' ', '');
      const specificDateKey = `${date}_${branchKey}`;
      
      // Update schedule with specific date
      const updatedSchedule = {
        ...currentSchedule.schedule,
        [specificDateKey]: {
          date: date,
          branch: branchKey,
          timeSlots: timeSlots,
          lastUpdated: new Date().toISOString()
        }
      };
      
      // If no time slots, remove the entry (revert to default)
      if (!timeSlots || timeSlots.length === 0) {
        delete updatedSchedule[specificDateKey];
      }
      
      // Save updated schedule
      return await ScheduleUtils.updateProviderSchedule(
        providerId,
        role,
        updatedSchedule,
        currentSchedule.unavailable_dates
      );
    } catch (error) {
      console.error('Error saving calendar schedule:', error);
      return { success: false, error };
    }
  }

  /**
   * Mark specific date as unavailable
   */
  static async markDateUnavailable(providerId, role, date, branch) {
    try {
      console.log(`🚫 Marking ${date} as unavailable for ${role} ${providerId} at ${branch}`);
      
      // Get current schedule
      const currentSchedule = await ScheduleUtils.getProviderSchedule(providerId, role);
      const branchKey = branch.toLowerCase().replace(' ', '');
      const specificDateKey = `${date}_${branchKey}`;
      
      // Mark date as unavailable
      const updatedSchedule = {
        ...currentSchedule.schedule,
        [specificDateKey]: {
          date: date,
          branch: branchKey,
          unavailable: true,
          timeSlots: [],
          lastUpdated: new Date().toISOString()
        }
      };
      
      return await ScheduleUtils.updateProviderSchedule(
        providerId,
        role,
        updatedSchedule,
        currentSchedule.unavailable_dates
      );
    } catch (error) {
      console.error('Error marking date unavailable:', error);
      return { success: false, error };
    }
  }

  /**
   * Remove calendar-based schedule for a specific date (revert to weekly schedule)
   */
  static async removeCalendarSchedule(providerId, role, date, branch) {
    try {
      console.log(`🗑️ Removing calendar schedule for ${role} ${providerId} on ${date} at ${branch}`);
      
      // Get current schedule
      const currentSchedule = await ScheduleUtils.getProviderSchedule(providerId, role);
      const branchKey = branch.toLowerCase().replace(' ', '');
      const specificDateKey = `${date}_${branchKey}`;
      
      // Remove specific date entry
      const updatedSchedule = { ...currentSchedule.schedule };
      delete updatedSchedule[specificDateKey];
      
      return await ScheduleUtils.updateProviderSchedule(
        providerId,
        role,
        updatedSchedule,
        currentSchedule.unavailable_dates
      );
    } catch (error) {
      console.error('Error removing calendar schedule:', error);
      return { success: false, error };
    }
  }

  /**
   * Check if a specific date has custom schedule
   */
  static hasCustomScheduleForDate(schedule, branch, date) {
    if (!schedule) return false;
    
    const branchKey = branch.toLowerCase().replace(' ', '');
    const specificDateKey = `${date}_${branchKey}`;
    
    return schedule[specificDateKey] !== undefined;
  }

  /**
   * Get all custom scheduled dates for a provider
   */
  static getCustomScheduledDates(schedule, branch = null) {
    if (!schedule) return [];
    
    const customDates = [];
    
    Object.keys(schedule).forEach(key => {
      // Check if key is a date-based key (format: YYYY-MM-DD_branchname)
      if (key.includes('_') && key.match(/^\d{4}-\d{2}-\d{2}_/)) {
        const [date, scheduleBranch] = key.split('_');
        
        // Filter by branch if specified
        if (!branch || scheduleBranch === branch.toLowerCase().replace(' ', '')) {
          customDates.push({
            date,
            branch: scheduleBranch,
            schedule: schedule[key]
          });
        }
      }
    });
    
    return customDates.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Validate calendar-based appointment
   */
  static async validateCalendarAppointment(providerId, branch, date, time, durationMinutes = 30) {
    try {
      // Get provider schedule
      const scheduleData = await ScheduleUtils.getProviderSchedule(providerId, 'doctor');
      
      if (!scheduleData.schedule) {
        return { valid: false, reason: 'Provider has no schedule configured' };
      }
      
      // Get time slots for this specific date
      const timeSlots = this.getProviderTimeSlotsForDate(scheduleData.schedule, branch, date);
      
      if (timeSlots.length === 0) {
        return { valid: false, reason: 'Provider is not working on this date at this branch' };
      }
      
      // Check if appointment time falls within any available time slot
      const [requestHour, requestMinute] = time.split(':').map(Number);
      const requestTimeMinutes = requestHour * 60 + requestMinute;
      const requestEndMinutes = requestTimeMinutes + durationMinutes;
      
      const isWithinTimeSlot = timeSlots.some(slot => {
        const [startHour, startMinute] = slot.startTime.split(':').map(Number);
        const [endHour, endMinute] = slot.endTime.split(':').map(Number);
        
        const slotStartMinutes = startHour * 60 + startMinute;
        const slotEndMinutes = endHour * 60 + endMinute;
        
        return requestTimeMinutes >= slotStartMinutes && requestEndMinutes <= slotEndMinutes;
      });
      
      if (!isWithinTimeSlot) {
        return { 
          valid: false, 
          reason: `Appointment time ${time} is outside available working hours` 
        };
      }
      
      // Check for conflicts with existing appointments
      const { data: conflicts, error } = await supabase
        .from('appointments')
        .select('id, appointment_time')
        .eq('doctor_id', providerId)
        .eq('appointment_date', date)
        .neq('status', 'cancelled')
        .neq('status', 'rejected');
        
      if (error) throw error;
      
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
      
      return { valid: true };
    } catch (error) {
      console.error('Error validating calendar appointment:', error);
      return { valid: false, reason: 'Error validating appointment: ' + error.message };
    }
  }
}

export default CalendarScheduleUtils;
