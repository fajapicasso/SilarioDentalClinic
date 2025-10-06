// src/services/queueService.js - Centralized Queue Management Service
import supabase from '../config/supabaseClient';
import auditLogService from './auditLogService';
import { 
  getTodayPhilippineDate, 
  getNextQueueNumberForToday, 
  isPatientInTodayQueue 
} from '../utils/philippineTime';

export class QueueService {
  /**
   * Add appointment to queue with duplicate prevention
   * This is the centralized function that all pages should use
   */
  static async addAppointmentToQueue(appointment, options = {}) {
    try {
      const { 
        skipDuplicateCheck = false,
        source = 'unknown' // Track where the call came from
      } = options;

      console.log(`[${source}] Adding appointment ${appointment.id} to queue for patient ${appointment.patient_id}`);

      // Use Philippine time for date comparison
      const todayDate = getTodayPhilippineDate();

      // Only add if appointment is for today (Philippine time)
      if (appointment.appointment_date !== todayDate) {
        console.log(`[${source}] Appointment is not for today (${appointment.appointment_date} vs ${todayDate}), skipping queue addition`);
        return { success: false, reason: 'not_today' };
      }

      if (!skipDuplicateCheck) {
        // Check for existing queue entries for this patient in today's queue only
        const existingQueueEntry = await isPatientInTodayQueue(supabase, appointment.patient_id);
        
        if (existingQueueEntry) {
          console.log(`[${source}] Patient already in today's queue:`, existingQueueEntry);

          // If the existing queue entry doesn't have an appointment_id, link it
          if (!existingQueueEntry.appointment_id && appointment.id) {
            const { error: updateError } = await supabase
              .from('queue')
              .update({ 
                appointment_id: appointment.id,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingQueueEntry.id);

            if (updateError) {
              console.error(`[${source}] Error linking appointment to queue:`, updateError);
              return { success: false, error: updateError };
            }

            console.log(`[${source}] Linked appointment to existing queue entry #${existingQueueEntry.queue_number}`);
            return { 
              success: true, 
              action: 'linked', 
              queueNumber: existingQueueEntry.queue_number,
              message: `Appointment linked to existing queue position #${existingQueueEntry.queue_number}`
            };
          } else {
            console.log(`[${source}] Patient already in queue with appointment properly linked`);
            return { 
              success: true, 
              action: 'already_exists', 
              queueNumber: existingQueueEntry.queue_number,
              message: `Patient is already in today's queue (Position #${existingQueueEntry.queue_number})`
            };
          }
        }

        // Additional check: Look for patients with same appointment time and services to prevent duplicates
        if (appointment.appointment_time) {
          const { data: similarAppointments, error: similarError } = await supabase
            .from('appointments')
            .select(`
              id,
              patient_id,
              appointment_time,
              appointment_services(service_id)
            `)
            .eq('appointment_date', todayDate)
            .eq('appointment_time', appointment.appointment_time)
            .in('status', ['confirmed', 'appointed'])
            .neq('id', appointment.id);

          if (similarError) {
            console.error(`[${source}] Error checking for similar appointments:`, similarError);
          } else if (similarAppointments && similarAppointments.length > 0) {
            // Check if any of these similar appointments are already in queue
            const similarPatientIds = similarAppointments.map(apt => apt.patient_id);
            const { data: existingSimilarQueue, error: similarQueueError } = await supabase
              .from('queue')
              .select('patient_id, queue_number, status')
              .in('patient_id', similarPatientIds)
              .in('status', ['waiting', 'serving']);

            if (similarQueueError) {
              console.error(`[${source}] Error checking similar queue entries:`, similarQueueError);
            } else if (existingSimilarQueue && existingSimilarQueue.length > 0) {
              console.log(`[${source}] Found similar appointments already in queue:`, existingSimilarQueue);
              // Don't add this appointment to prevent duplicates with same time/services
              return {
                success: false,
                reason: 'similar_appointment_exists',
                message: `Similar appointment already exists in queue for the same time slot`
              };
            }
          }
        }
      }

      // Check for existing queue entries for this specific appointment
      const { data: existingAppointmentQueue, error: appointmentQueueError } = await supabase
        .from('queue')
        .select('id, appointment_id, status, queue_number, patient_id')
        .eq('appointment_id', appointment.id);

      if (appointmentQueueError) {
        console.error(`[${source}] Error checking appointment queue:`, appointmentQueueError);
        return { success: false, error: appointmentQueueError };
      }

      if (existingAppointmentQueue && existingAppointmentQueue.length > 0) {
        const queueEntry = existingAppointmentQueue[0];
        console.log(`[${source}] Appointment ${appointment.id} already in queue:`, queueEntry);
        return { 
          success: true, 
          action: 'appointment_exists', 
          queueNumber: queueEntry.queue_number,
          message: `Appointment is already in today's queue (Position #${queueEntry.queue_number})`
        };
      }

      // Get next queue number for today (resets daily in Philippine time)
      const nextQueueNumber = await getNextQueueNumberForToday(supabase);

      const queueData = {
        patient_id: appointment.patient_id,
        appointment_id: appointment.id,
        queue_number: nextQueueNumber,
        status: 'waiting',
        estimated_wait_time: 15,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('queue')
        .insert([queueData]);

      if (error) {
        console.error(`[${source}] Error adding to queue:`, error);
        return { success: false, error };
      }

      console.log(`[${source}] Successfully added appointment ${appointment.id} to queue as #${nextQueueNumber}`);

      // Log audit event for queue addition
      try {
        await auditLogService.logQueueAdd(nextQueueNumber, {
          ...queueData,
          patient_name: appointment.patient_name || appointment.patientName,
          doctor_id: appointment.doctor_id,
          branch: appointment.branch,
          appointment_id: appointment.id
        });
      } catch (auditError) {
        console.error(`[${source}] Error logging queue audit event:`, auditError);
        // Continue even if audit logging fails
      }

      return { 
        success: true, 
        action: 'added', 
        queueNumber: nextQueueNumber,
        message: `Patient has been added to today's queue (Position #${nextQueueNumber})`
      };

    } catch (error) {
      console.error(`[${options.source || 'unknown'}] Error in addAppointmentToQueue:`, error);
      return { success: false, error };
    }
  }

  /**
   * Check if patient is already in today's queue
   */
  static async isPatientInQueue(patientId) {
    try {
      const queueEntry = await isPatientInTodayQueue(supabase, patientId);
      
      return { 
        inQueue: queueEntry !== null, 
        queueEntry: queueEntry 
      };
    } catch (error) {
      console.error('Error in isPatientInQueue:', error);
      return { inQueue: false, error };
    }
  }

  /**
   * Check if appointment is already in queue
   */
  static async isAppointmentInQueue(appointmentId) {
    try {
      const { data, error } = await supabase
        .from('queue')
        .select('id, appointment_id, status, queue_number, patient_id')
        .eq('appointment_id', appointmentId);

      if (error) {
        console.error('Error checking if appointment is in queue:', error);
        return { inQueue: false, error };
      }

      return { 
        inQueue: data && data.length > 0, 
        queueEntry: data && data.length > 0 ? data[0] : null 
      };
    } catch (error) {
      console.error('Error in isAppointmentInQueue:', error);
      return { inQueue: false, error };
    }
  }

  /**
   * Remove duplicate queue entries for a patient
   */
  static async removeDuplicateQueueEntries(patientId) {
    try {
      console.log(`Removing duplicate queue entries for patient ${patientId}`);

      // Get all queue entries for this patient
      const { data: queueEntries, error: fetchError } = await supabase
        .from('queue')
        .select('id, appointment_id, status, queue_number, created_at')
        .eq('patient_id', patientId)
        .in('status', ['waiting', 'serving'])
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('Error fetching queue entries:', fetchError);
        return { success: false, error: fetchError };
      }

      if (!queueEntries || queueEntries.length <= 1) {
        console.log('No duplicates found');
        return { success: true, removed: 0 };
      }

      // Keep the first (oldest) entry, remove the rest
      const toRemove = queueEntries.slice(1);
      const idsToRemove = toRemove.map(entry => entry.id);

      const { error: deleteError } = await supabase
        .from('queue')
        .delete()
        .in('id', idsToRemove);

      if (deleteError) {
        console.error('Error removing duplicate queue entries:', deleteError);
        return { success: false, error: deleteError };
      }

      console.log(`Removed ${toRemove.length} duplicate queue entries for patient ${patientId}`);
      return { success: true, removed: toRemove.length };

    } catch (error) {
      console.error('Error in removeDuplicateQueueEntries:', error);
      return { success: false, error };
    }
  }
}
