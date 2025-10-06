// src/utils/appointmentUtils.js
import supabase from '../config/supabaseClient';

/**
 * Get available time slots for a specific date, branch, and doctor
 * @param {string} doctorId - The UUID of the doctor (optional, if null returns branch hours)
 * @param {string} date - The date in ISO format (YYYY-MM-DD)
 * @param {string} branch - The branch name
 * @returns {Promise<Array>} - Array of available time slots (HH:MM format)
 */
export const getAvailableTimeSlots = async (doctorId, date, branch) => {
  try {
    if (!date || !branch) {
      return [];
    }
    
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Define branch hours (fallback if no doctor specific hours)
    let branchStart, branchEnd, interval = 30; // 30-minute intervals
    
    // Branch working hours logic
    if (branch === 'Cabugao') {
      if (dayOfWeek === 0) { // Sunday
        return []; // Closed
      } else if (dayOfWeek === 6) { // Saturday
        branchStart = '08:00';
        branchEnd = '17:00';
      } else { // Monday to Friday
        branchStart = '08:00';
        branchEnd = '17:00';
      }
    } else if (branch === 'San Juan') {
      if (dayOfWeek === 6) { // Saturday
        return []; // Closed
      } else if (dayOfWeek === 0) { // Sunday
        branchStart = '08:00';
        branchEnd = '17:00';
      } else { // Monday to Friday
        branchStart = '08:00';
        branchEnd = '17:00';
      }
    }
    
    // If a specific doctor is provided, check their availability
    let doctorHours = [];
    
    if (doctorId) {
      // Check recurring availability
      const { data: recurringData, error: recurringError } = await supabase
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('branch', branch)
        .eq('recurring', true)
        .eq('day_of_week', dayOfWeek)
        .eq('is_available', true);
      
      if (!recurringError && recurringData && recurringData.length > 0) {
        doctorHours = [...recurringData];
      }
      
      // Check specific date availability (overrides recurring)
      const { data: specificData, error: specificError } = await supabase
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('branch', branch)
        .eq('recurring', false)
        .eq('specific_date', date)
        .eq('is_available', true);
      
      if (!specificError && specificData && specificData.length > 0) {
        doctorHours = [...specificData]; // Override recurring with specific
      }
    }
    
    // Generate all possible time slots based on branch or doctor hours
    const allTimeSlots = [];
    
    if (doctorHours.length > 0) {
      // Use doctor's specific hours
      for (const schedule of doctorHours) {
        const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
        const [endHour, endMinute] = schedule.end_time.split(':').map(Number);
        
        let currentHour = startHour;
        let currentMinute = startMinute;
        
        while (
          currentHour < endHour || 
          (currentHour === endHour && currentMinute < endMinute)
        ) {
          const timeString = `${currentHour.toString().padStart(2, '0')}:${
            currentMinute.toString().padStart(2, '0')}`;
          
          allTimeSlots.push(timeString);
          
          // Increment by interval
          currentMinute += interval;
          if (currentMinute >= 60) {
            currentHour += 1;
            currentMinute -= 60;
          }
        }
      }
    } else {
      // Use default branch hours
      const [startHour, startMinute] = branchStart.split(':').map(Number);
      const [endHour, endMinute] = branchEnd.split(':').map(Number);
      
      let currentHour = startHour;
      let currentMinute = startMinute;
      
      while (
        currentHour < endHour || 
        (currentHour === endHour && currentMinute < endMinute)
      ) {
        const timeString = `${currentHour.toString().padStart(2, '0')}:${
          currentMinute.toString().padStart(2, '0')}`;
        
        allTimeSlots.push(timeString);
        
        // Increment by interval
        currentMinute += interval;
        if (currentMinute >= 60) {
          currentHour += 1;
          currentMinute -= 60;
        }
      }
    }
    
    // If no doctor specified, return all branch hours
    if (!doctorId) {
      return allTimeSlots;
    }
    
    // Get doctor's appointments for this date to filter out booked slots
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select(`
        id, 
        appointment_time, 
        appointment_durations(duration_minutes)
      `)
      .eq('doctor_id', doctorId)
      .eq('appointment_date', date)
      .neq('status', 'cancelled')
      .neq('status', 'rejected');
    
    if (appointmentsError) {
      console.error('Error fetching doctor appointments:', appointmentsError);
      return allTimeSlots; // Return all slots if we can't fetch appointments
    }
    
    // Filter out booked time slots
    const availableSlots = allTimeSlots.filter(timeSlot => {
      const [hours, minutes] = timeSlot.split(':').map(Number);
      const slotTime = new Date(date);
      slotTime.setHours(hours, minutes, 0, 0);
      
      // Check if this slot conflicts with any appointment
      return !appointments.some(appointment => {
        const [aptHours, aptMinutes] = appointment.appointment_time.split(':').map(Number);
        const appointmentTime = new Date(date);
        appointmentTime.setHours(aptHours, aptMinutes, 0, 0);
        
        // Get appointment duration
        const duration = appointment.appointment_durations?.length > 0 
          ? appointment.appointment_durations[0].duration_minutes 
          : 30; // Default
        
        // Calculate appointment end time
        const appointmentEndTime = new Date(appointmentTime);
        appointmentEndTime.setMinutes(appointmentEndTime.getMinutes() + duration);
        
        // Calculate slot end time (assume standard 30-min duration for slots)
        const slotEndTime = new Date(slotTime);
        slotEndTime.setMinutes(slotEndTime.getMinutes() + interval);
        
        // Check for overlap
        return (
          (slotTime < appointmentEndTime && slotEndTime > appointmentTime)
        );
      });
    });
    
    return availableSlots;
  } catch (error) {
    console.error('Error in getAvailableTimeSlots:', error);
    return [];
  }
};

/**
 * Get the next available time slot for a doctor
 * @param {string} doctorId - The UUID of the doctor
 * @param {string} date - The date in ISO format (YYYY-MM-DD)
 * @param {string} time - The time to start looking from (HH:MM)
 * @param {string} branch - The branch name
 * @param {number} durationMinutes - The duration needed for the appointment
 * @returns {Promise<Object>} - Object with nextAvailable time and all available timeSlots
 */
export const getNextAvailableTimeSlot = async (
  doctorId,
  date,
  time,
  branch,
  durationMinutes = 30
) => {
  try {
    // Get all available time slots for this doctor on this date
    const availableSlots = await getAvailableTimeSlots(doctorId, date, branch);
    
    if (availableSlots.length === 0) {
      return { nextAvailable: null, timeSlots: [] };
    }
    
    // Filter slots that are after the requested time
    const laterSlots = availableSlots.filter(slot => slot >= time);
    
    // Find first slot that accommodates the required duration
    for (let i = 0; i < laterSlots.length; i++) {
      const currentSlot = laterSlots[i];
      
      // Check if we have enough consecutive slots for the duration
      let hasEnoughTime = true;
      const slotsNeeded = Math.ceil(durationMinutes / 30);
      
      for (let j = 1; j < slotsNeeded; j++) {
        // Calculate the expected next slot time
        const [hours, minutes] = currentSlot.split(':').map(Number);
        const slotTime = new Date();
        slotTime.setHours(hours, minutes, 0, 0);
        slotTime.setMinutes(slotTime.getMinutes() + (j * 30));
        
        const nextExpectedSlot = `${slotTime.getHours().toString().padStart(2, '0')}:${
          slotTime.getMinutes().toString().padStart(2, '0')}`;
        
        if (!laterSlots.includes(nextExpectedSlot)) {
          hasEnoughTime = false;
          break;
        }
      }
      
      if (hasEnoughTime) {
        return { nextAvailable: currentSlot, timeSlots: laterSlots };
      }
    }
    
    // If no suitable slot found, look at the next day
    const nextDay = new Date(date);
    nextDay.setHours(0, 0, 0, 0); // Set to start of the date
    nextDay.setDate(nextDay.getDate() + 1); // Add one day
    const nextDayStr = nextDay.toISOString().split('T')[0];
    
    // Recursively check next day, starting from the beginning of the day
    return await getNextAvailableTimeSlot(doctorId, nextDayStr, '00:00', branch, durationMinutes);
  } catch (error) {
    console.error('Error in getNextAvailableTimeSlot:', error);
    return { nextAvailable: null, timeSlots: [] };
  }
};

/**
 * Find available doctors for a specific date, time, and branch
 * @param {string} date - The date in ISO format (YYYY-MM-DD)
 * @param {string} time - The time in 24-hour format (HH:MM)
 * @param {string} branch - The branch name
 * @param {array} serviceCategories - The categories of services requested (for specialty matching)
 * @param {number} durationMinutes - The duration of the appointment in minutes
 * @param {string} excludeAppointmentId - Optional appointment ID to exclude (for rescheduling)
 * @returns {Promise<Array>} - Array of available doctors with their specialties
 */
export const findAvailableDoctors = async (
  date,
  time,
  branch,
  serviceCategories = [],
  durationMinutes = 30,
  excludeAppointmentId = null
) => {
  try {
    if (!date || !time || !branch) {
      return [];
    }
    
    // 1. Get all active doctors who work at this branch
    const { data: doctors, error: doctorsError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        doctor_specialties(specialty)
      `)
      .eq('role', 'doctor')
      .neq('disabled', true);
    
    if (doctorsError) {
      console.error('Error fetching doctors:', doctorsError);
      return [];
    }
    
    // 2. For each doctor, check their availability and appointment load
    const availableDoctorsPromises = doctors.map(async (doctor) => {
      const isAvailable = await checkDoctorAvailability(
        doctor.id,
        date,
        time,
        branch,
        durationMinutes,
        excludeAppointmentId
      );
      
      if (!isAvailable) return null;
      
      // Get next available time slot if this one is not available
      const { nextAvailable, timeSlots } = await getNextAvailableTimeSlot(
        doctor.id,
        date,
        time,
        branch,
        durationMinutes
      );
      
      // Count today's appointments for this doctor (for load balancing)
      const { data: todayAppointments, error: countError } = await supabase
        .from('appointments')
        .select('count')
        .eq('doctor_id', doctor.id)
        .eq('appointment_date', date)
        .neq('status', 'cancelled')
        .neq('status', 'rejected');
      
      const appointmentCount = countError ? 0 : (todayAppointments?.[0]?.count || 0);
      
      // Format specialties
      const specialties = doctor.doctor_specialties
        ? doctor.doctor_specialties.map(s => s.specialty)
        : [];
      
      // Calculate specialty match score (higher is better match)
      let specialtyMatchScore = 0;
      if (serviceCategories.length > 0 && specialties.length > 0) {
        specialtyMatchScore = serviceCategories.filter(c => 
          specialties.includes(c)
        ).length;
      }
      
      return {
        id: doctor.id,
        name: doctor.full_name,
        specialties,
        appointmentCount: parseInt(appointmentCount),
        specialtyMatchScore,
        nextAvailableTime: nextAvailable,
        availableTimeSlots: timeSlots
      };
    });
    
    const availableDoctors = (await Promise.all(availableDoctorsPromises))
      .filter(doctor => doctor !== null);
    
    // Sort doctors by specialty match (desc) and appointment count (asc)
    return availableDoctors.sort((a, b) => {
      // First prioritize specialty match
      if (b.specialtyMatchScore !== a.specialtyMatchScore) {
        return b.specialtyMatchScore - a.specialtyMatchScore;
      }
      // Then prioritize doctors with fewer appointments
      return a.appointmentCount - b.appointmentCount;
    });
  } catch (error) {
    console.error('Error in findAvailableDoctors:', error);
    return [];
  }
};

/**
 * Check if a doctor is available at a specific date, time, and branch
 * @param {string} doctorId - The UUID of the doctor
 * @param {string} date - The date in ISO format (YYYY-MM-DD)
 * @param {string} time - The time in 24-hour format (HH:MM)
 * @param {string} branch - The branch name
 * @param {number} durationMinutes - The duration of the appointment in minutes
 * @param {string} excludeAppointmentId - Optional appointment ID to exclude (for rescheduling)
 * @returns {Promise<boolean>} - True if doctor is available, false otherwise
 */
export const checkDoctorAvailability = async (
  doctorId, 
  date, 
  time, 
  branch, 
  durationMinutes = 30,
  excludeAppointmentId = null
) => {
  try {
    if (!doctorId || !date || !time || !branch) {
      return false;
    }
    
    // Convert date string to JavaScript Date
    const appointmentDate = new Date(date);
    const dayOfWeek = appointmentDate.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Parse appointment time
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create a new date object with the appointment time
    const appointmentDateTime = new Date(date);
    appointmentDateTime.setHours(hours, minutes, 0, 0);
    
    // Calculate end time based on duration
    const appointmentEndDateTime = new Date(appointmentDateTime);
    appointmentEndDateTime.setMinutes(appointmentEndDateTime.getMinutes() + durationMinutes);
    
    // Format end time as HH:MM for comparison
    const endTime = `${appointmentEndDateTime.getHours().toString().padStart(2, '0')}:${
      appointmentEndDateTime.getMinutes().toString().padStart(2, '0')}`;
    
    // 1. Check if doctor works at this branch on this day (recurring schedule)
    const { data: recurringAvailability, error: recurringError } = await supabase
      .from('doctor_availability')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('branch', branch)
      .eq('recurring', true)
      .eq('day_of_week', dayOfWeek)
      .eq('is_available', true);
    
    if (recurringError) {
      console.error('Error checking recurring availability:', recurringError);
      return false;
    }
    
    // 2. Check for specific date availability overrides
    const { data: specificAvailability, error: specificError } = await supabase
      .from('doctor_availability')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('branch', branch)
      .eq('recurring', false)
      .eq('specific_date', date)
      .eq('is_available', true);
    
    if (specificError) {
      console.error('Error checking specific date availability:', specificError);
      return false;
    }
    
    // Combine and check if doctor is available at this time
    const availableTimes = [...(recurringAvailability || []), ...(specificAvailability || [])];
    
    // If no availability found for this day/date, doctor is not available
    if (availableTimes.length === 0) {
      return false;
    }
    
    // Check if appointment time falls within any of the available time slots
    const isWithinAvailableHours = availableTimes.some(slot => {
      return time >= slot.start_time && endTime <= slot.end_time;
    });
    
    if (!isWithinAvailableHours) {
      return false;
    }
    
    // 3. Check for conflicting appointments
    let query = supabase
      .from('appointments')
      .select(`
        id, 
        appointment_date, 
        appointment_time, 
        doctor_id,
        appointment_durations(duration_minutes)
      `)
      .eq('doctor_id', doctorId)
      .eq('appointment_date', date)
      .neq('status', 'cancelled')
      .neq('status', 'rejected');
    
    // Exclude the current appointment if provided (for rescheduling)
    if (excludeAppointmentId) {
      query = query.neq('id', excludeAppointmentId);
    }
      
    const { data: conflictingAppointments, error: conflictError } = await query;
    
    if (conflictError) {
      console.error('Error checking for conflicting appointments:', conflictError);
      return false;
    }
    
    // If no conflicting appointments found, doctor is available
    if (!conflictingAppointments || conflictingAppointments.length === 0) {
      return true;
    }
    
    // Check for time conflicts with existing appointments
    for (const appointment of conflictingAppointments) {
      // Get the appointment duration
      const appointmentDuration = appointment.appointment_durations?.length > 0 
        ? appointment.appointment_durations[0].duration_minutes 
        : 30; // Default to 30 minutes if not specified
      
      // Parse the appointment time
      const [aptHours, aptMinutes] = appointment.appointment_time.split(':').map(Number);
      
      // Create Date objects for start and end of existing appointment
      const existingStart = new Date(appointment.appointment_date);
      existingStart.setHours(aptHours, aptMinutes, 0, 0);
      
      const existingEnd = new Date(existingStart);
      existingEnd.setMinutes(existingEnd.getMinutes() + appointmentDuration);
      
      // Check if new appointment overlaps with existing appointment
      if (
        (appointmentDateTime < existingEnd && appointmentEndDateTime > existingStart) ||
        (appointmentDateTime.getTime() === existingStart.getTime())
      ) {
        return false; // Conflict found
      }
    }
    
    // No conflicts found
    return true;
  } catch (error) {
    console.error('Error in checkDoctorAvailability:', error);
    return false;
  }
};
