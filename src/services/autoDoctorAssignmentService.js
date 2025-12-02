// src/services/autoDoctorAssignmentService.js - Automatic Doctor Assignment Service
import supabase from '../config/supabaseClient';
import { ScheduleUtils } from '../services/scheduleUtils';

export class AutoDoctorAssignmentService {
  /**
   * Automatically assign a doctor to an appointment based on availability and load balancing
   * @param {Object} appointmentData - The appointment data
   * @param {string} appointmentData.branch - The branch name
   * @param {string} appointmentData.appointment_date - The appointment date (YYYY-MM-DD)
   * @param {string} appointmentData.appointment_time - The appointment time (HH:MM)
   * @param {Array} appointmentData.services - Array of service IDs
   * @param {number} appointmentData.duration_minutes - Duration in minutes
   * @returns {Promise<Object>} - { success: boolean, doctor_id: string|null, message: string }
   */
  static async assignDoctorAutomatically(appointmentData) {
    try {
      console.log('🤖 Starting automatic doctor assignment for appointment:', {
        branch: appointmentData.branch,
        date: appointmentData.appointment_date,
        time: appointmentData.appointment_time,
        services: appointmentData.services
      });

      const { branch, appointment_date, appointment_time, services = [], duration_minutes = 30 } = appointmentData;

      // Validate required fields
      if (!branch || !appointment_date || !appointment_time) {
        return {
          success: false,
          doctor_id: null,
          message: 'Missing required appointment data for doctor assignment'
        };
      }

      // Get service categories for specialty matching
      const serviceCategories = await this.getServiceCategories(services);

      // Find available doctors using the correct schedule system
      const availableDoctors = await this.findAvailableDoctorsWithSchedule(
        appointment_date,
        appointment_time,
        branch,
        serviceCategories,
        duration_minutes
      );

      if (availableDoctors.length === 0) {
        console.log('❌ No available doctors found for automatic assignment');
        return {
          success: false,
          doctor_id: null,
          message: 'No doctors are available at the selected time and branch. Please contact the clinic for manual assignment.'
        };
      }

      // Select the best doctor using our assignment algorithm
      const selectedDoctor = this.selectBestDoctor(availableDoctors);

      console.log('✅ Selected doctor for automatic assignment:', {
        doctor_id: selectedDoctor.id,
        doctor_name: selectedDoctor.name,
        specialties: selectedDoctor.specialties,
        appointment_count: selectedDoctor.appointmentCount,
        specialty_match_score: selectedDoctor.specialtyMatchScore
      });

      return {
        success: true,
        doctor_id: selectedDoctor.id,
        doctor_name: selectedDoctor.name,
        message: `Automatically assigned to Dr. ${selectedDoctor.name}`
      };

    } catch (error) {
      console.error('Error in automatic doctor assignment:', error);
      return {
        success: false,
        doctor_id: null,
        message: 'Failed to automatically assign doctor. Please contact the clinic.'
      };
    }
  }

  /**
   * Find available doctors using the correct schedule system (profiles.schedule)
   * @param {string} date - The appointment date (YYYY-MM-DD)
   * @param {string} time - The appointment time (HH:MM)
   * @param {string} branch - The branch name
   * @param {Array} serviceCategories - Service categories for specialty matching
   * @param {number} durationMinutes - Duration in minutes
   * @returns {Promise<Array>} - Array of available doctors
   */
  static async findAvailableDoctorsWithSchedule(date, time, branch, serviceCategories = [], durationMinutes = 30) {
    try {
      console.log('🔍 Finding available doctors with schedule system:', { date, time, branch });

      // Get all active doctors
      const { data: doctors, error: doctorsError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          schedule,
          doctor_specialties(specialty)
        `)
        .eq('role', 'doctor')
        .neq('disabled', true);

      if (doctorsError) {
        console.error('Error fetching doctors:', doctorsError);
        return [];
      }

      console.log(`Found ${doctors.length} doctors to check for availability`);

      // Check each doctor's availability using the schedule system
      const availableDoctorsPromises = doctors.map(async (doctor) => {
        try {
          // Use ScheduleUtils to validate appointment against doctor's schedule
          const validation = await ScheduleUtils.validateAppointment(
            doctor.id,
            branch,
            date,
            time,
            durationMinutes
          );

          if (!validation.valid) {
            console.log(`❌ Doctor ${doctor.full_name} not available: ${validation.reason}`);
            return null;
          }

          // Count today's appointments for load balancing
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

          // Calculate specialty match score
          let specialtyMatchScore = 0;
          if (serviceCategories.length > 0 && specialties.length > 0) {
            specialtyMatchScore = serviceCategories.filter(c => 
              specialties.includes(c)
            ).length;
          }

          console.log(`✅ Doctor ${doctor.full_name} is available at ${time}`);

          return {
            id: doctor.id,
            name: doctor.full_name,
            specialties,
            appointmentCount: parseInt(appointmentCount),
            specialtyMatchScore,
            validation
          };
        } catch (error) {
          console.error(`Error checking availability for doctor ${doctor.full_name}:`, error);
          return null;
        }
      });

      const availableDoctors = (await Promise.all(availableDoctorsPromises))
        .filter(doctor => doctor !== null);

      console.log(`Found ${availableDoctors.length} available doctors`);
      return availableDoctors;

    } catch (error) {
      console.error('Error finding available doctors:', error);
      return [];
    }
  }

  /**
   * Get service categories for specialty matching
   * @param {Array} serviceIds - Array of service IDs
   * @returns {Promise<Array>} - Array of service categories
   */
  static async getServiceCategories(serviceIds) {
    try {
      if (!serviceIds || serviceIds.length === 0) {
        return [];
      }

      const { data: services, error } = await supabase
        .from('services')
        .select('category')
        .in('id', serviceIds);

      if (error) {
        console.error('Error fetching service categories:', error);
        return [];
      }

      // Extract unique categories
      const categories = [...new Set(services.map(service => service.category).filter(Boolean))];
      console.log('Service categories for specialty matching:', categories);
      return categories;

    } catch (error) {
      console.error('Error getting service categories:', error);
      return [];
    }
  }

  /**
   * Select the best doctor from available doctors using intelligent assignment algorithm
   * @param {Array} availableDoctors - Array of available doctors with metadata
   * @returns {Object} - Selected doctor object
   */
  static selectBestDoctor(availableDoctors) {
    if (availableDoctors.length === 1) {
      return availableDoctors[0];
    }

    // Sort doctors by priority criteria:
    // 1. Specialty match score (higher is better)
    // 2. Appointment count (lower is better for load balancing)
    // 3. Alphabetical by name (for consistency)
    const sortedDoctors = availableDoctors.sort((a, b) => {
      // Primary: Specialty match score (descending)
      if (a.specialtyMatchScore !== b.specialtyMatchScore) {
        return b.specialtyMatchScore - a.specialtyMatchScore;
      }
      
      // Secondary: Appointment count (ascending for load balancing)
      if (a.appointmentCount !== b.appointmentCount) {
        return a.appointmentCount - b.appointmentCount;
      }
      
      // Tertiary: Alphabetical by name (ascending for consistency)
      return a.name.localeCompare(b.name);
    });

    const selectedDoctor = sortedDoctors[0];
    
    console.log('Doctor selection algorithm results:', {
      total_available: availableDoctors.length,
      selected: {
        name: selectedDoctor.name,
        specialty_score: selectedDoctor.specialtyMatchScore,
        appointment_count: selectedDoctor.appointmentCount
      },
      alternatives: sortedDoctors.slice(1, 3).map(d => ({
        name: d.name,
        specialty_score: d.specialtyMatchScore,
        appointment_count: d.appointmentCount
      }))
    });

    return selectedDoctor;
  }

  /**
   * Check if automatic assignment is enabled for the system
   * @returns {Promise<boolean>} - True if auto-assignment is enabled
   */
  static async isAutoAssignmentEnabled() {
    try {
      // Check if there's a system setting for auto-assignment
      const { data: settings, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'auto_doctor_assignment')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking auto-assignment setting:', error);
        return true; // Default to enabled if setting doesn't exist
      }

      return settings?.value === 'true' || settings?.value === true;
    } catch (error) {
      console.error('Error checking auto-assignment setting:', error);
      return true; // Default to enabled
    }
  }

  /**
   * Get assignment statistics for monitoring
   * @param {string} date - Date to get stats for (YYYY-MM-DD)
   * @returns {Promise<Object>} - Assignment statistics
   */
  static async getAssignmentStats(date) {
    try {
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('id, doctor_id, status, created_at')
        .eq('appointment_date', date);

      if (error) {
        console.error('Error fetching assignment stats:', error);
        return { total: 0, assigned: 0, unassigned: 0 };
      }

      const total = appointments.length;
      const assigned = appointments.filter(app => app.doctor_id).length;
      const unassigned = total - assigned;

      return {
        total,
        assigned,
        unassigned,
        assignment_rate: total > 0 ? (assigned / total * 100).toFixed(1) : 0
      };
    } catch (error) {
      console.error('Error getting assignment stats:', error);
      return { total: 0, assigned: 0, unassigned: 0 };
    }
  }
}

export default AutoDoctorAssignmentService;
