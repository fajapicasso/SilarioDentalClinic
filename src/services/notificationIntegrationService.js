// src/services/notificationIntegrationService.js - Automatic notification triggers
import { 
  notifyPatientEvent, 
  notifyDoctorAppointmentEvent, 
  notifyStaffTask, 
  notifyAdminsSystemEvent 
} from '../utils/roleBasedNotifications';
import supabase from '../config/supabaseClient';

class NotificationIntegrationService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('NotificationIntegrationService: Initializing...');
      this.initialized = true;
      console.log('NotificationIntegrationService: Initialized successfully');
    } catch (error) {
      console.error('NotificationIntegrationService: Initialization failed', error);
    }
  }

  /**
   * PATIENT NOTIFICATION INTEGRATIONS
   */
  
  // Trigger when appointment status changes
  async handleAppointmentStatusChange(appointmentId, newStatus, oldStatus) {
    try {
      await this.initialize();
      
      // Get appointment details
      const { data: appointment, error } = await supabase
        .from('appointments')
        .select(`
          id, patient_id, doctor_id, appointment_date, appointment_time, status,
          patient:profiles!patient_id(full_name),
          doctor:profiles!doctor_id(full_name)
        `)
        .eq('id', appointmentId)
        .single();

      if (error) throw error;
      if (!appointment) return;

      const eventData = {
        date: appointment.appointment_date,
        time: appointment.appointment_time,
        doctorName: appointment.doctor?.full_name,
        appointmentId: appointment.id
      };

      // Send appropriate notification based on status change
      switch (newStatus) {
        case 'approved':
          await notifyPatientEvent(appointment.patient_id, 'appointment_approved', eventData);
          break;
        case 'cancelled':
          await notifyPatientEvent(appointment.patient_id, 'appointment_cancelled', eventData);
          break;
        case 'rescheduled':
          await notifyPatientEvent(appointment.patient_id, 'appointment_rescheduled', eventData);
          break;
      }
    } catch (error) {
      console.error('Error handling appointment status change:', error);
    }
  }

  // Trigger when payment status changes
  async handlePaymentStatusChange(paymentId, newStatus) {
    try {
      await this.initialize();
      
      // Get payment details
      const { data: payment, error } = await supabase
        .from('payments')
        .select(`
          id, amount, status, patient_id,
          invoice:invoices!invoice_id(
            patient:profiles!patient_id(full_name)
          )
        `)
        .eq('id', paymentId)
        .single();

      if (error) throw error;
      if (!payment) return;

      const eventData = {
        amount: parseFloat(payment.amount),
        patientName: payment.invoice?.patient?.full_name,
        paymentId: payment.id
      };

      // Send appropriate notification based on payment status
      switch (newStatus) {
        case 'paid':
          await notifyPatientEvent(payment.patient_id, 'payment_paid', eventData);
          break;
        case 'pending':
          await notifyPatientEvent(payment.patient_id, 'payment_pending', eventData);
          break;
        case 'failed':
          await notifyPatientEvent(payment.patient_id, 'payment_failed', eventData);
          break;
      }
    } catch (error) {
      console.error('Error handling payment status change:', error);
    }
  }

  // Trigger when dental chart is updated
  async handleDentalChartUpdate(patientId, doctorId, treatmentInfo) {
    try {
      await this.initialize();
      
      // Get doctor details
      const { data: doctor, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', doctorId)
        .single();

      if (error) throw error;

      const eventData = {
        doctorName: doctor.full_name,
        treatment: treatmentInfo.treatment,
        patientId: patientId
      };

      await notifyPatientEvent(patientId, 'dental_chart_update', eventData);
    } catch (error) {
      console.error('Error handling dental chart update:', error);
    }
  }

  /**
   * DOCTOR NOTIFICATION INTEGRATIONS
   */
  
  // Trigger when new appointment is created for doctor
  async handleNewAppointmentForDoctor(appointmentId) {
    try {
      await this.initialize();
      
      const { data: appointment, error } = await supabase
        .from('appointments')
        .select(`
          id, doctor_id, appointment_date, appointment_time,
          patient:profiles!patient_id(full_name)
        `)
        .eq('id', appointmentId)
        .single();

      if (error) throw error;
      if (!appointment || !appointment.doctor_id) return;

      const eventData = {
        patientName: appointment.patient?.full_name,
        date: appointment.appointment_date,
        time: appointment.appointment_time,
        appointmentId: appointment.id
      };

      await notifyDoctorAppointmentEvent(appointment.doctor_id, 'new_appointment_request', eventData);
    } catch (error) {
      console.error('Error handling new appointment for doctor:', error);
    }
  }

  // Trigger when patient arrives in queue
  async handlePatientArrival(queueId) {
    try {
      await this.initialize();
      
      const { data: queueItem, error } = await supabase
        .from('queue')
        .select(`
          id, patient_id, doctor_id, queue_number,
          patient:profiles!patient_id(full_name)
        `)
        .eq('id', queueId)
        .single();

      if (error) throw error;
      if (!queueItem) return;

      const eventData = {
        patientName: queueItem.patient?.full_name,
        queueNumber: queueItem.queue_number,
        queueId: queueItem.id
      };

      // Notify doctor if assigned
      if (queueItem.doctor_id) {
        await notifyDoctorAppointmentEvent(queueItem.doctor_id, 'patient_arrived', eventData);
      }

      // Notify all staff
      const { data: staff, error: staffError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'staff')
        .neq('disabled', true);

      if (!staffError && staff) {
        for (const staffMember of staff) {
          await notifyStaffTask(staffMember.id, 'patient_checkin', eventData);
        }
      }
    } catch (error) {
      console.error('Error handling patient arrival:', error);
    }
  }

  // Trigger when payment is linked to doctor's treatment
  async handlePaymentLinkedToDoctor(paymentId, doctorId) {
    try {
      await this.initialize();
      
      const { data: payment, error } = await supabase
        .from('payments')
        .select(`
          id, amount,
          invoice:invoices!invoice_id(
            patient:profiles!patient_id(full_name),
            services:appointment_services(
              service:services(name)
            )
          )
        `)
        .eq('id', paymentId)
        .single();

      if (error) throw error;
      if (!payment) return;

      const eventData = {
        amount: parseFloat(payment.amount),
        patientName: payment.invoice?.patient?.full_name,
        treatment: payment.invoice?.services?.[0]?.service?.name || 'Treatment',
        paymentId: payment.id
      };

      await notifyDoctorAppointmentEvent(doctorId, 'payment_linked', eventData);
    } catch (error) {
      console.error('Error handling payment linked to doctor:', error);
    }
  }

  /**
   * STAFF NOTIFICATION INTEGRATIONS
   */
  
  // Trigger when new appointment is booked
  async handleNewAppointmentBooked(appointmentId) {
    try {
      await this.initialize();
      
      const { data: appointment, error } = await supabase
        .from('appointments')
        .select(`
          id, appointment_date, appointment_time,
          patient:profiles!patient_id(full_name)
        `)
        .eq('id', appointmentId)
        .single();

      if (error) throw error;
      if (!appointment) return;

      const eventData = {
        patientName: appointment.patient?.full_name,
        date: appointment.appointment_date,
        time: appointment.appointment_time,
        appointmentId: appointment.id
      };

      // Notify all staff
      const { data: staff, error: staffError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'staff')
        .neq('disabled', true);

      if (!staffError && staff) {
        for (const staffMember of staff) {
          await notifyStaffTask(staffMember.id, 'new_appointment', eventData);
        }
      }
    } catch (error) {
      console.error('Error handling new appointment booked:', error);
    }
  }

  // Trigger when appointment is cancelled
  async handleAppointmentCancelled(appointmentId) {
    try {
      await this.initialize();
      
      const { data: appointment, error } = await supabase
        .from('appointments')
        .select(`
          id, appointment_date, appointment_time,
          patient:profiles!patient_id(full_name)
        `)
        .eq('id', appointmentId)
        .single();

      if (error) throw error;
      if (!appointment) return;

      const eventData = {
        patientName: appointment.patient?.full_name,
        date: appointment.appointment_date,
        time: appointment.appointment_time,
        appointmentId: appointment.id
      };

      // Notify all staff
      const { data: staff, error: staffError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'staff')
        .neq('disabled', true);

      if (!staffError && staff) {
        for (const staffMember of staff) {
          await notifyStaffTask(staffMember.id, 'cancelled_appointment', eventData);
        }
      }
    } catch (error) {
      console.error('Error handling appointment cancelled:', error);
    }
  }

  // Trigger when payment needs confirmation
  async handlePaymentNeedsConfirmation(paymentId) {
    try {
      await this.initialize();
      
      const { data: payment, error } = await supabase
        .from('payments')
        .select(`
          id, amount,
          invoice:invoices!invoice_id(
            patient:profiles!patient_id(full_name)
          )
        `)
        .eq('id', paymentId)
        .single();

      if (error) throw error;
      if (!payment) return;

      const eventData = {
        amount: parseFloat(payment.amount),
        patientName: payment.invoice?.patient?.full_name,
        paymentId: payment.id
      };

      // Notify all staff
      const { data: staff, error: staffError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'staff')
        .neq('disabled', true);

      if (!staffError && staff) {
        for (const staffMember of staff) {
          await notifyStaffTask(staffMember.id, 'payment_confirmation', eventData);
        }
      }
    } catch (error) {
      console.error('Error handling payment needs confirmation:', error);
    }
  }

  /**
   * ADMIN NOTIFICATION INTEGRATIONS
   */
  
  // Trigger when new user registers
  async handleNewUserRegistration(userId) {
    try {
      await this.initialize();
      
      const { data: user, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, email')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (!user) return;

      const eventData = {
        userName: user.full_name,
        role: user.role,
        userId: user.id,
        email: user.email
      };

      await notifyAdminsSystemEvent('new_user_registration', eventData);
    } catch (error) {
      console.error('Error handling new user registration:', error);
    }
  }

  // Trigger when high-value payment needs review
  async handleHighValuePayment(paymentId) {
    try {
      await this.initialize();
      
      const { data: payment, error } = await supabase
        .from('payments')
        .select(`
          id, amount,
          invoice:invoices!invoice_id(
            patient:profiles!patient_id(full_name)
          )
        `)
        .eq('id', paymentId)
        .single();

      if (error) throw error;
      if (!payment) return;

      const eventData = {
        amount: parseFloat(payment.amount),
        patientName: payment.invoice?.patient?.full_name,
        paymentId: payment.id
      };

      await notifyAdminsSystemEvent('payment_needs_review', eventData);
    } catch (error) {
      console.error('Error handling high value payment:', error);
    }
  }

  // Trigger daily summary for admins
  async handleDailySummary() {
    try {
      await this.initialize();
      
      const today = new Date().toISOString().split('T')[0];
      
      // Get today's statistics
      const [appointmentsResult, paymentsResult, newPatientsResult] = await Promise.all([
        supabase.from('appointments').select('id').eq('appointment_date', today),
        supabase.from('payments').select('amount').eq('status', 'paid').gte('created_at', `${today}T00:00:00`),
        supabase.from('profiles').select('id').eq('role', 'patient').gte('created_at', `${today}T00:00:00`)
      ]);

      const appointments = appointmentsResult.data?.length || 0;
      const payments = paymentsResult.data?.length || 0;
      const newPatients = newPatientsResult.data?.length || 0;
      const revenue = paymentsResult.data?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;

      const eventData = {
        appointments,
        payments,
        newPatients,
        revenue,
        date: today
      };

      await notifyAdminsSystemEvent('daily_summary', eventData);
    } catch (error) {
      console.error('Error handling daily summary:', error);
    }
  }

  /**
   * AUTOMATED TRIGGERS
   */
  
  // Set up automated triggers (call this once during app initialization)
  async setupAutomatedTriggers() {
    try {
      await this.initialize();
      
      console.log('Setting up automated notification triggers...');
      
      // Set up daily summary trigger (runs at 6 PM daily)
      const now = new Date();
      const sixPM = new Date();
      sixPM.setHours(18, 0, 0, 0);
      
      if (now < sixPM) {
        const timeUntilSixPM = sixPM.getTime() - now.getTime();
        setTimeout(() => {
          this.handleDailySummary();
          // Set up recurring daily trigger
          setInterval(() => this.handleDailySummary(), 24 * 60 * 60 * 1000);
        }, timeUntilSixPM);
      } else {
        // If it's past 6 PM, trigger tomorrow
        const tomorrowSixPM = new Date(sixPM);
        tomorrowSixPM.setDate(tomorrowSixPM.getDate() + 1);
        const timeUntilTomorrowSixPM = tomorrowSixPM.getTime() - now.getTime();
        setTimeout(() => {
          this.handleDailySummary();
          // Set up recurring daily trigger
          setInterval(() => this.handleDailySummary(), 24 * 60 * 60 * 1000);
        }, timeUntilTomorrowSixPM);
      }
      
      console.log('Automated notification triggers set up successfully');
    } catch (error) {
      console.error('Error setting up automated triggers:', error);
    }
  }
}

// Create singleton instance
const notificationIntegrationService = new NotificationIntegrationService();

export default notificationIntegrationService;
