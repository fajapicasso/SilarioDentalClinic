// src/utils/scheduleUtils.js - Schedule Utility Functions
import ScheduleService from '../services/scheduleService';

/**
 * Utility functions for schedule-related operations across the application
 */

/**
 * Get schedule status for a specific date and branch
 */
export const getScheduleStatus = async (branch, date) => {
  try {
    const branchHours = await ScheduleService.getBranchHours(branch, date);
    const providers = await ScheduleService.getAvailableProviders(branch, date, '08:00');
    
    return {
      isOpen: branchHours.open,
      hours: branchHours.hours,
      providerCount: providers.length,
      providers: providers.map(p => ({
        id: p.id,
        name: p.full_name,
        role: p.role
      }))
    };
  } catch (error) {
    console.error('Error getting schedule status:', error);
    return {
      isOpen: false,
      hours: null,
      providerCount: 0,
      providers: []
    };
  }
};

/**
 * Check if a specific time slot is available for booking
 */
export const checkTimeSlotAvailability = async (branch, date, time, duration = 30) => {
  try {
    return await ScheduleService.isTimeSlotAvailable(branch, date, time, duration);
  } catch (error) {
    console.error('Error checking time slot availability:', error);
    return false;
  }
};

/**
 * Get next available appointment slot for a branch
 */
export const getNextAvailableSlot = async (branch, startDate = null, duration = 30) => {
  try {
    const searchStartDate = startDate || new Date();
    const maxDaysAhead = 30; // Search up to 30 days ahead
    
    for (let i = 1; i <= maxDaysAhead; i++) {
      const checkDate = new Date(searchStartDate);
      checkDate.setDate(checkDate.getDate() + i);
      const dateString = checkDate.toISOString().split('T')[0];
      
      const timeSlots = await ScheduleService.getAvailableTimeSlots(branch, dateString, duration);
      
      if (timeSlots.availableSlots.length > 0) {
        return {
          date: dateString,
          time: timeSlots.availableSlots[0],
          dateObject: checkDate
        };
      }
    }
    
    return null; // No available slots found
  } catch (error) {
    console.error('Error finding next available slot:', error);
    return null;
  }
};

/**
 * Format schedule for display purposes
 */
export const formatScheduleForDisplay = (schedule, branch) => {
  if (!schedule || !schedule[branch]) {
    return 'No schedule set';
  }
  
  const branchSchedule = schedule[branch];
  const workingDays = [];
  
  Object.entries(branchSchedule).forEach(([day, config]) => {
    if (config.enabled) {
      workingDays.push({
        day: day.charAt(0).toUpperCase() + day.slice(1),
        hours: `${formatTime(config.start)} - ${formatTime(config.end)}`
      });
    }
  });
  
  if (workingDays.length === 0) {
    return 'Not working at this branch';
  }
  
  return workingDays.map(d => `${d.day}: ${d.hours}`).join(', ');
};

/**
 * Helper function to format time
 */
export const formatTime = (timeString) => {
  if (!timeString) return '';
  
  const [hours, minutes] = timeString.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

/**
 * Get branch operating summary for a week
 */
export const getWeeklyScheduleSummary = async (branch, startDate) => {
  try {
    const weekSummary = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      const status = await getScheduleStatus(branch, dateString);
      
      weekSummary.push({
        date: dateString,
        dateObject: date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        isOpen: status.isOpen,
        hours: status.hours,
        providerCount: status.providerCount
      });
    }
    
    return weekSummary;
  } catch (error) {
    console.error('Error getting weekly schedule summary:', error);
    return [];
  }
};

export default {
  getScheduleStatus,
  checkTimeSlotAvailability,
  getNextAvailableSlot,
  formatScheduleForDisplay,
  formatTime,
  getWeeklyScheduleSummary
};
