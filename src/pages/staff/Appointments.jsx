// src/pages/doctor/Appointments.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../config/supabaseClient';
import { toast } from 'react-toastify';
import { 
  FiCalendar, FiClock, FiMapPin, FiUser, FiMessageSquare,
  FiCheck, FiX, FiEdit, FiFilter, FiSearch, FiAlertTriangle, 
  FiClock as FiDuration, FiRefreshCw, FiAlertCircle
} from 'react-icons/fi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';
import { QueueService } from '../../services/queueService';
import { isPatientInTodayQueue, getNextQueueNumberForToday } from '../../utils/philippineTime';

const StaffAppointments = () => {
  const { user } = useAuth();
  const { logPageView, logAppointmentView, logAppointmentCreate, logAppointmentUpdate, logAppointmentCancel } = useUniversalAudit();
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isViewingDetails, setIsViewingDetails] = useState(false);
  const [appointmentDurations, setAppointmentDurations] = useState({});
  const [isSettingDuration, setIsSettingDuration] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(30); // Default 30 minutes
  const [durationValue, setDurationValue] = useState('30'); // For input field
  const [durationUnit, setDurationUnit] = useState('minutes'); // minutes or hours
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isSelectingPatient, setIsSelectingPatient] = useState(false);
  const [patients, setPatients] = useState([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [isAssigningDoctor, setIsAssigningDoctor] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [debugInfo, setDebugInfo] = useState(null);

  // Reschedule states
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [selectedBranchForReschedule, setSelectedBranchForReschedule] = useState('');
  const [patientsInQueue, setPatientsInQueue] = useState(new Set());

  // Get today's date helper function
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Check which patients are in today's queue
  const checkPatientsInQueue = async () => {
    try {
      console.log('🔄 Checking patients in queue...');
      const todayAppointments = appointments.filter(apt => 
        apt.appointment_date === getTodayDate() && 
        apt.status === 'confirmed'
      );
      
      console.log(`📅 Found ${todayAppointments.length} confirmed appointments for today`);
      
      const queueStatus = new Set();
      for (const appointment of todayAppointments) {
        console.log(`🔍 Checking patient ${appointment.patient_id} (${appointment.patient_name})...`);
        const isInQueue = await isPatientInTodayQueue(supabase, appointment.patient_id);
        if (isInQueue) {
          console.log(`✅ Patient ${appointment.patient_id} is in queue`);
          queueStatus.add(appointment.patient_id);
        } else {
          console.log(`❌ Patient ${appointment.patient_id} is NOT in queue`);
        }
      }
      
      console.log(`📊 Queue status updated:`, Array.from(queueStatus));
      setPatientsInQueue(queueStatus);
    } catch (error) {
      console.error('Error checking patients in queue:', error);
    }
  };


  // Initial data fetch - only run once when component mounts
  useEffect(() => {
    if (user && isInitialLoad) {
      checkUserRole();
    }
  }, [user, isInitialLoad]);

  // Set up real-time subscriptions - only run once
  useEffect(() => {
    if (!user) return;

    // Set up real-time subscription for appointments updates
    const appointmentSubscription = supabase
      .channel('public:appointments')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'appointments' 
      }, () => {
        // Only refresh if not currently loading
        if (!isLoading) {
          fetchAppointments(false); // Don't show loading spinner for real-time updates
        }
      })
      .subscribe();
    
    // Set up real-time subscription for queue updates
    const queueSubscription = supabase
      .channel('public:queue')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'queue' 
      }, () => {
        // Only refresh queue status if not currently loading and we have appointments
        if (!isLoading && appointments.length > 0 && activeTab === 'today') {
          checkPatientsInQueue();
        }
      })
      .subscribe();
    
    // Clean up subscriptions
    return () => {
      supabase.removeChannel(appointmentSubscription);
      supabase.removeChannel(queueSubscription);
    };
  }, [user]); // Only depend on user, not appointments or activeTab

  // Check user role before fetching data
  const checkUserRole = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Role check error:', error);
        throw error;
      }
      
      console.log('User role:', data.role);
      
      if (['doctor', 'admin', 'staff'].includes(data.role)) {
        // Log page view
        logPageView('Staff Appointments', 'appointments', 'management');
        
        // User has permission, proceed with fetching data
        await Promise.all([
          fetchAppointments(),
          fetchPatients(),
          fetchDoctors()
        ]);
        
        // Mark initial load as complete
        setIsInitialLoad(false);
      } else {
        // User doesn't have permission
        toast.error('You do not have permission to view this page');
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      toast.error('Failed to verify your account permissions');
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  // Filter appointments when activeTab or searchQuery changes
  useEffect(() => {
    if (appointments.length > 0) {
      filterAppointments();
    }
  }, [activeTab, searchQuery, appointments, selectedPatient]);

  // Check queue status when appointments are loaded
  useEffect(() => {
    if (appointments.length > 0 && activeTab === 'today' && !isLoading) {
      checkPatientsInQueue();
    }
  }, [appointments, activeTab, isLoading]);

  // Filter patients when patientSearchQuery changes
  useEffect(() => {
    if (patients.length > 0) {
      const filtered = patients.filter(patient => {
        const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
        const searchLower = patientSearchQuery.toLowerCase();
        
        return (
          fullName.includes(searchLower) ||
          (patient.email && patient.email.toLowerCase().includes(searchLower)) ||
          (patient.phone && patient.phone.includes(searchLower))
        );
      });
      setFilteredPatients(filtered);
    }
  }, [patientSearchQuery, patients]);

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('role', 'doctor')
        .neq('disabled', true)
        .order('full_name');
      
      if (error) {
        console.error('Doctor fetch error:', error);
        throw error;
      }
      
      setDoctors(data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast.error(`Failed to load doctors: ${error.message}`);
    }
  };

  const fetchPatients = async () => {
    try {
      // Test connection with a simple query first
      const { data: testData, error: testError } = await supabase
        .from('profiles')
        .select('count')
        .eq('role', 'patient')
        .single();
        
      if (testError) {
        console.error('Test connection error:', testError);
        throw new Error('Could not connect to database. Please check your network connection.');
      }
      
      // Proceed with the actual query
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('role', 'patient');
      
      if (error) {
        console.error('Patient fetch error:', error);
        throw error;
      }
      
      // Map the profiles data to match the expected structure
      const formattedPatients = data.map(patient => {
        // Split full_name for UI compatibility
        const nameParts = patient.full_name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        
        return {
          id: patient.id,
          first_name: firstName,
          last_name: lastName,
          email: patient.email,
          phone: patient.phone
        };
      });
      
      setPatients(formattedPatients);
      setFilteredPatients(formattedPatients);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error(`Failed to load patients: ${error.message}`);
    }
  };

  const fetchAppointments = async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      console.log('Fetching appointments...');
      
      // 1. Test basic connection with a simple query
      const { data: testData, error: testError } = await supabase
        .from('appointments')
        .select('count')
        .limit(1)
        .single();
      
      if (testError) {
        console.error('Connection test failed:', testError);
        throw new Error('Database connection test failed. Please check your network connection.');
      }
      
      console.log('Connection test successful, proceeding with appointments query');
      
      // 2. Fetch basic appointment data first (without complex joins)
      let query = supabase
        .from('appointments')
        .select(`
          id, 
          patient_id,
          doctor_id,
          appointment_date, 
          appointment_time, 
          status, 
          branch,
          teeth_involved,
          notes,
          is_emergency,
          created_at
        `)
        .order('appointment_date', { ascending: true });
      
      // If a patient is selected, filter by patient_id
      if (selectedPatient) {
        query = query.eq('patient_id', selectedPatient.id);
      }
      
      // Execute the base query
      const { data: appointmentData, error: appointmentError } = await query;
      
      if (appointmentError) {
        console.error('Error fetching appointments:', appointmentError);
        throw appointmentError;
      }
      
      console.log(`Fetched ${appointmentData.length} appointments`);
      
      // 3. Fetch patient profiles separately
      const patientIds = [...new Set(appointmentData.map(a => a.patient_id))];
      
      const { data: patientData, error: patientError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, profile_picture_url')
        .in('id', patientIds);
      
      if (patientError) {
        console.error('Error fetching patient profiles:', patientError);
        // Continue anyway with empty patient data
      }
      
      // Fetch doctor profiles for appointments that already have a doctor assigned
      const doctorIds = [...new Set(appointmentData.map(a => a.doctor_id).filter(Boolean))];

      const { data: doctorData, error: doctorError } = doctorIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', doctorIds)
        : { data: [], error: null };

      if (doctorError) {
        console.error('Error fetching doctor profiles:', doctorError);
      }

      // Create a lookup map for patient/doctor data
      const patientMap = {};
      if (patientData) {
        patientData.forEach(patient => {
          patientMap[patient.id] = patient;
        });
      }

      const doctorMap = {};
      if (doctorData) {
        doctorData.forEach(doctor => {
          doctorMap[doctor.id] = doctor;
        });
      }
      
             // 4. Fetch appointment services
       const appointmentIds = appointmentData.map(a => a.id);
       
       const { data: serviceJoinData, error: serviceJoinError } = await supabase
         .from('appointment_services')
         .select('appointment_id, service_id')
         .in('appointment_id', appointmentIds);
       
       if (serviceJoinError) {
         console.error('Error fetching appointment-service join data:', serviceJoinError);
         // Continue anyway with empty service data
       }
       
       // Get all service IDs to fetch
       const serviceIds = serviceJoinData ? [...new Set(serviceJoinData.map(s => s.service_id))] : [];
       
       // Fetch service details with duration
       const { data: serviceData, error: serviceError } = serviceIds.length > 0 
         ? await supabase
             .from('services')
             .select('id, name, description, price, duration')
             .in('id', serviceIds)
         : { data: [], error: null };
       
       if (serviceError) {
         console.error('Error fetching service details:', serviceError);
         // Continue anyway with empty service details
       }
       
       // Create a lookup map for service data
       const serviceMap = {};
       if (serviceData) {
         serviceData.forEach(service => {
           serviceMap[service.id] = service;
         });
       }
       
       // Create a map of appointment_id -> [services]
       const appointmentServicesMap = {};
       if (serviceJoinData) {
         serviceJoinData.forEach(joinRecord => {
           if (!appointmentServicesMap[joinRecord.appointment_id]) {
             appointmentServicesMap[joinRecord.appointment_id] = [];
           }
           
           const serviceInfo = serviceMap[joinRecord.service_id];
           if (serviceInfo) {
             appointmentServicesMap[joinRecord.appointment_id].push({
               service_id: serviceInfo
             });
           }
         });
       }
      
             // 5. Combine all the data
       const formattedAppointments = appointmentData.map(appointment => {
         const patient = patientMap[appointment.patient_id] || { full_name: 'Unknown' };
         const doctor = doctorMap[appointment.doctor_id] || null;
         const services = appointmentServicesMap[appointment.id] || [];
         
         // Calculate total service duration
         const totalServiceDuration = services.reduce((total, service) => {
           return total + (service.service_id.duration || 0);
         }, 0);
         
         return {
           ...appointment,
           patients: patient,
           patientName: patient.full_name,
           doctors: doctor,
           doctorName: doctor ? doctor.full_name : null,
           services: services,
           serviceIds: services.map(s => s.service_id.id),
           serviceNames: services.map(s => s.service_id.name),
           totalServiceDuration: totalServiceDuration
         };
       });
      
      setAppointments(formattedAppointments);
      console.log('Appointments processed successfully');
      
      // 6. Try to fetch appointment durations if that table exists
      try {
        const { data: durationData, error: durationError } = await supabase
          .from('appointment_durations')
          .select('appointment_id, duration_minutes');
        
        if (!durationError && durationData) {
          // Convert to a map for easy lookup
          const durationMap = {};
          durationData.forEach(item => {
            durationMap[item.appointment_id] = item.duration_minutes;
          });
          
          setAppointmentDurations(durationMap);
        } else {
          console.log('Appointment durations may not exist yet:', durationError);
          // If the table doesn't exist, this is fine - just use empty durations
          setAppointmentDurations({});
        }
      } catch (durationErr) {
        console.log('Appointment durations table might not exist yet');
        setAppointmentDurations({});
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setDebugInfo(JSON.stringify(error, null, 2));
      toast.error(`Failed to load appointments: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAppointments = () => {
    if (!appointments.length) return;
    
    let filtered = [...appointments];
    
    // Filter by status
    if (activeTab === 'pending') {
      filtered = filtered.filter(app => app.status === 'pending');
    } else if (activeTab === 'upcoming') {
      filtered = filtered.filter(app => app.status === 'confirmed' && new Date(`${app.appointment_date}T${app.appointment_time}`) > new Date());
    } else if (activeTab === 'today') {
      const today = new Date();
      const todayDate = today.toISOString().split('T')[0];
      filtered = filtered.filter(app => app.appointment_date === todayDate && app.status === 'confirmed');
    } else if (activeTab === 'past') {
      const today = new Date();
      filtered = filtered.filter(app => {
        const appDate = new Date(`${app.appointment_date}T${app.appointment_time}`);
        return (appDate < today && app.status === 'completed') || app.status === 'completed';
      });
    } else if (activeTab === 'cancelled') {
      filtered = filtered.filter(app => app.status === 'cancelled' || app.status === 'rejected');
    }
    
    // Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(app => 
        app.patientName?.toLowerCase().includes(query) ||
        app.branch?.toLowerCase().includes(query) ||
        (app.serviceNames && app.serviceNames.some(service => service?.toLowerCase().includes(query)))
      );
    }
    
    setFilteredAppointments(filtered);
  };

  // Get available time slots based on selected date and branch for rescheduling
  const fetchAvailableTimeSlots = async (date, branch) => {
    if (!date || !branch) return;

    const formattedDate = date.toISOString().split('T')[0];
    try {
      let startHour, endHour, interval = 30;

      if (branch === 'Cabugao') {
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0) {
          setAvailableTimeSlots([]);
          return;
        } else if (dayOfWeek === 6) {
          startHour = 8;
          endHour = 17;
        } else {
          startHour = 8;
          endHour = 12;
        }
      } else if (branch === 'San Juan') {
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 6) {
          setAvailableTimeSlots([]);
          return;
        } else if (dayOfWeek === 0) {
          startHour = 8;
          endHour = 17;
        } else {
          startHour = 13;
          endHour = 17;
        }
      }

      const { data: bookedSlots, error } = await supabase
        .from('appointments')
        .select('appointment_time')
        .eq('appointment_date', formattedDate)
        .eq('branch', branch)
        .neq('status', 'cancelled')
        .neq('id', selectedAppointment?.id);

      if (error) throw error;

      const allTimeSlots = [];
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += interval) {
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          allTimeSlots.push(timeString);
        }
      }

      const allBookedTimeStrings = bookedSlots.map(slot => slot.appointment_time);
      const availableSlots = allTimeSlots.filter(time => !allBookedTimeStrings.includes(time));
      setAvailableTimeSlots(availableSlots);
    } catch (err) {
      console.error('Error fetching available time slots:', err);
      toast.error('Failed to load available time slots');
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !selectedTimeSlot || !selectedBranchForReschedule) {
      toast.error('Please select a date, time, and branch');
      return;
    }

    // Validate date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(rescheduleDate);
    appointmentDate.setHours(0, 0, 0, 0);
    
    if (appointmentDate < today) {
      toast.error('Cannot schedule appointments in the past');
      return;
    }

    // Validate time slot format
    if (!selectedTimeSlot || typeof selectedTimeSlot !== 'string') {
      toast.error('Invalid time slot selected');
      return;
    }

    // Validate branch
    if (!selectedBranchForReschedule || !['Cabugao', 'San Juan'].includes(selectedBranchForReschedule)) {
      toast.error('Invalid branch selected');
      return;
    }

    if (!selectedAppointment || !selectedAppointment.id) {
      toast.error('No appointment selected for rescheduling');
      return;
    }

    try {
      // Determine if we need to change status to pending for rejected/cancelled appointments
      const shouldChangeToPending = ['rejected', 'cancelled'].includes(selectedAppointment.status);
      
      const updateData = { 
          appointment_date: rescheduleDate.toISOString().split('T')[0],
          appointment_time: selectedTimeSlot,
          branch: selectedBranchForReschedule
      };
      
      // Add status change if needed
      if (shouldChangeToPending) {
        updateData.status = 'pending';
        console.log('Changing status to pending for rejected/cancelled appointment');
      }
      
      console.log('Updating appointment with data:', updateData);
      console.log('Appointment ID:', selectedAppointment.id);
      console.log('Current appointment status:', selectedAppointment.status);
      
      // Validate data before sending
      if (!updateData.appointment_date || !updateData.appointment_time || !updateData.branch) {
        throw new Error('Missing required fields: appointment_date, appointment_time, or branch');
      }
      
      // Check if date is valid
      const dateObj = new Date(updateData.appointment_date);
      if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid appointment date format');
      }
      
      // Check if time is valid (should be in HH:MM format)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(updateData.appointment_time)) {
        throw new Error('Invalid appointment time format');
      }
      
      // First, verify the appointment exists (optional - don't fail if not found)
      console.log('Fetching appointment details...');
      const { data: existingAppointment, error: fetchError } = await supabase
        .from('appointments')
        .select('id, status, appointment_date, appointment_time, branch, patient_id')
        .eq('id', selectedAppointment.id)
        .single();
      
      if (fetchError) {
        console.warn('Could not fetch appointment details:', fetchError);
        console.warn('Continuing with reschedule using local appointment data...');
      } else {
        console.log('Found appointment:', existingAppointment);
      }
      
      // Check if the new time slot is available
      const { data: conflictingAppointments, error: conflictError } = await supabase
        .from('appointments')
        .select('id, appointment_time, patient_id')
        .eq('appointment_date', updateData.appointment_date)
        .eq('appointment_time', updateData.appointment_time)
        .eq('branch', updateData.branch)
        .neq('id', selectedAppointment.id)
        .in('status', ['pending', 'confirmed']);
      
      if (conflictError) {
        console.error('Error checking for conflicts:', conflictError);
        throw new Error(`Failed to check availability: ${conflictError.message}`);
      }
      
      if (conflictingAppointments && conflictingAppointments.length > 0) {
        toast.error('This time slot is already taken. Please select another time.');
        return;
      }
      
      // Try a simple update first to test basic functionality
      console.log('Attempting to update appointment...');
      console.log('Update data being sent:', JSON.stringify(updateData, null, 2));
      
      // Ensure all data is properly formatted
      const sanitizedUpdateData = {
        appointment_date: updateData.appointment_date,
        appointment_time: updateData.appointment_time,
        branch: updateData.branch
      };
      
      if (updateData.status) {
        sanitizedUpdateData.status = updateData.status;
      }
      
      console.log('Sanitized update data:', JSON.stringify(sanitizedUpdateData, null, 2));
      
      let { data: updateResult, error } = await supabase
        .from('appointments')
        .update(sanitizedUpdateData)
        .eq('id', selectedAppointment.id)
        .select('id, status, appointment_date, appointment_time, branch');
        
      if (error) {
        console.error('Database update error:', error);
        console.error('Update data that failed:', updateData);
        console.error('Appointment ID:', selectedAppointment.id);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        // Try a different approach - update without status first
        if (shouldChangeToPending) {
          console.log('Trying update without status change...');
          const { status, ...dataWithoutStatus } = updateData;
          
          const result2 = await supabase
            .from('appointments')
            .update(dataWithoutStatus)
            .eq('id', selectedAppointment.id)
            .select('id, status, appointment_date, appointment_time, branch');
          
          if (result2.error) {
            console.error('Second update attempt also failed:', result2.error);
            throw error; // Throw original error
          } else {
            console.log('Second update successful, now trying status update...');
            // Now try to update just the status
            const { data: statusOnlyData, error: statusOnlyError } = await supabase
              .from('appointments')
              .update({ status: 'pending' })
              .eq('id', selectedAppointment.id)
              .select('id, status');
            
            if (statusOnlyError) {
              console.error('Status-only update failed:', statusOnlyError);
            } else {
              console.log('Status-only update successful:', statusOnlyData);
            }
          }
        } else {
          throw error; // Throw original error for non-status-change updates
        }
      } else {
        console.log('Update successful:', updateResult);
      }

      // Update local state with the new appointment data
      setAppointments(appointments.map(appointment => 
        appointment.id === selectedAppointment.id
          ? {
              ...appointment,
              appointment_date: rescheduleDate.toISOString().split('T')[0],
              appointment_time: selectedTimeSlot,
              branch: selectedBranchForReschedule,
              status: shouldChangeToPending ? 'pending' : appointment.status,
              updated_at: new Date().toISOString()
            }
          : appointment
      ));

      toast.success('Appointment rescheduled successfully');
      setIsRescheduling(false);
      setIsViewingDetails(false);
      setRescheduleDate(null);
      setSelectedTimeSlot('');
      setSelectedBranchForReschedule('');
      setAvailableTimeSlots([]);
    } catch (err) {
      console.error('Error rescheduling appointment:', err);
      toast.error('Failed to reschedule appointment');
    }
  };

  const handleUpdateStatus = async (appointmentId, newStatus) => {
    try {
      // Get appointment data for queue integration
      const appointment = appointments.find(app => app.id === appointmentId);
      if (!appointment) {
        toast.error('Appointment not found');
        return;
      }

      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);
      
      if (error) throw error;
      
      // If approving appointment, automatically add to today's queue if it's for today
      if (newStatus === 'confirmed') {
        const appointmentDate = appointment.appointment_date;
        const today = new Date().toISOString().split('T')[0];
        
        if (appointmentDate === today) {
          const queueResult = await QueueService.addAppointmentToQueue(appointment, { source: 'staff_appointments' });

          if (queueResult.success) {
            if (queueResult.action === 'added') {
              toast.success(queueResult.message);
            } else if (queueResult.action === 'linked') {
              toast.success(queueResult.message);
            } else if (queueResult.action === 'already_exists') {
              toast.info(queueResult.message);
            }
          } else {
            toast.error('Failed to add patient to queue');
          }
        }
      }
      
      // Update local state
      setAppointments(appointments.map(appointment => 
        appointment.id === appointmentId 
          ? { ...appointment, status: newStatus } 
          : appointment
      ));
      
      // Refresh appointments from database to ensure consistency
      console.log('Refreshing appointments after status update...');
      await fetchAppointments(false);
      
      toast.success(`Appointment ${newStatus} successfully`);
    } catch (error) {
      console.error(`Error updating appointment status to ${newStatus}:`, error);
      toast.error(`Failed to ${newStatus} appointment`);
    }
  };

  const handleAssignDoctor = async () => {
    try {
      if (!selectedAppointment || !selectedDoctor) {
        toast.error('Please select a doctor to assign');
        return;
      }

      // Prevent assignment if appointment already has a doctor (accepted by doctor or assigned by admin)
      if (selectedAppointment.doctor_id) {
        toast.error('This appointment already has an assigned doctor.');
        return;
      }

      const { error } = await supabase
        .from('appointments')
        .update({ 
          doctor_id: selectedDoctor,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedAppointment.id);

      if (error) throw error;

      // Update local state
      setAppointments(appointments.map(appointment => 
        appointment.id === selectedAppointment.id 
          ? { ...appointment, doctor_id: selectedDoctor } 
          : appointment
      ));

      toast.success('Doctor assigned successfully');
      setIsAssigningDoctor(false);
      setSelectedDoctor('');
    } catch (error) {
      console.error('Error assigning doctor:', error);
      toast.error(`Failed to assign doctor: ${error.message}`);
    }
  };

  const handleSetDuration = async () => {
    try {
      if (!selectedAppointment) return;
      
      // First check if appointment_durations table exists
      let tableExists = true;
      
      try {
        const { data: testData, error: testError } = await supabase
          .from('appointment_durations')
          .select('count')
          .limit(1)
          .single();
        
        if (testError && testError.code === 'PGRST116') {
          // Empty result is fine
        } else if (testError) {
          console.error('Error checking durations table:', testError);
          tableExists = false;
        }
      } catch (err) {
        console.error('Error checking durations table:', err);
        tableExists = false;
      }
      
      // If table doesn't exist, create it
      if (!tableExists) {
        toast.info('Setting up appointment durations table...');
        
        try {
          // We'll use the appointment itself to store the duration for now
          const { error: updateError } = await supabase
            .from('appointments')
            .update({ duration_minutes: selectedDuration })
            .eq('id', selectedAppointment.id);
          
          if (updateError) throw updateError;
          
          // Update local state
          setAppointmentDurations({
            ...appointmentDurations,
            [selectedAppointment.id]: selectedDuration
          });
          
          toast.success('Appointment duration set successfully');
          setIsSettingDuration(false);
          return;
        } catch (err) {
          console.error('Error updating appointment with duration:', err);
          throw new Error('Failed to set duration. Durations table may need to be created by an administrator.');
        }
      }
      
      // Otherwise proceed with normal duration table
      // Check if duration record already exists
      const { data: existingData, error: checkError } = await supabase
        .from('appointment_durations')
        .select('id')
        .eq('appointment_id', selectedAppointment.id);
      
      if (checkError) throw checkError;
      
      let result;
      if (existingData && existingData.length > 0) {
        // Update existing duration
        result = await supabase
          .from('appointment_durations')
          .update({ 
            duration_minutes: selectedDuration,
            updated_at: new Date().toISOString(),
            updated_by: user.id
          })
          .eq('appointment_id', selectedAppointment.id);
      } else {
        // Insert new duration
        result = await supabase
          .from('appointment_durations')
          .insert({ 
            appointment_id: selectedAppointment.id, 
            duration_minutes: selectedDuration,
            created_by: user.id,
            created_at: new Date().toISOString()
          });
      }
      
      if (result.error) throw result.error;
      
      // Update local state
      setAppointmentDurations({
        ...appointmentDurations,
        [selectedAppointment.id]: selectedDuration
      });
      
      toast.success('Appointment duration set successfully');
      setIsSettingDuration(false);
    } catch (error) {
      console.error('Error setting appointment duration:', error);
      toast.error(`Failed to set appointment duration: ${error.message}`);
    }
  };

  const formatDate = (dateStr) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
  };

  const formatTime = (timeStr) => {
    const options = { hour: 'numeric', minute: 'numeric', hour12: true };
    const [hours, minutes] = timeStr.split(':');
    return new Date(0, 0, 0, hours, minutes).toLocaleTimeString('en-US', options);
  };

  // Handle duration input changes
  const handleDurationValueChange = (value) => {
    setDurationValue(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      const minutes = durationUnit === 'hours' ? numValue * 60 : numValue;
      setSelectedDuration(Math.round(minutes));
    }
  };

  const handleDurationUnitChange = (unit) => {
    setDurationUnit(unit);
    const numValue = parseFloat(durationValue);
    if (!isNaN(numValue) && numValue > 0) {
      const minutes = unit === 'hours' ? numValue * 60 : numValue;
      setSelectedDuration(Math.round(minutes));
    }
  };

  // Initialize duration values when modal opens
  const initializeDurationValues = (appointment) => {
    const currentDuration = appointmentDurations[appointment.id] || appointment.totalServiceDuration || 30;
    setSelectedDuration(currentDuration);
    
    // Convert to hours if >= 60 minutes, otherwise keep as minutes
    if (currentDuration >= 60) {
      setDurationValue((currentDuration / 60).toString());
      setDurationUnit('hours');
    } else {
      setDurationValue(currentDuration.toString());
      setDurationUnit('minutes');
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setIsSelectingPatient(false);
    // Refresh appointments for this patient
    fetchAppointments(false);
  };

  const clearPatientFilter = () => {
    setSelectedPatient(null);
    fetchAppointments(false);
  };

  if (isLoading && isInitialLoad) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Manage Appointments for San Juan and Cabugao Branch</h1>
            
            {/* Enhanced Reminder Note */}
            <div className="mt-3 bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-400 rounded-r-lg p-4 shadow-sm">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <FiAlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-semibold text-amber-800 flex items-center">
                    <FiUser className="mr-2 h-4 w-4" />
                    Important Reminder
                  </h3>
                  <div className="mt-1 text-sm text-amber-700">
                    <p className="font-medium">Assign doctor first before approving appointments</p>
                    <p className="text-xs mt-1 text-amber-600">
                      This ensures proper doctor-patient assignment and prevents scheduling conflicts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {selectedPatient && (
              <div className="mt-1 flex items-center text-gray-600">
                <span className="text-sm">Patient: <span className="font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</span></span>
                <button 
                  onClick={clearPatientFilter}
                  className="ml-2 text-xs text-primary-600 hover:text-primary-800"
                >
                  Clear Filter
                </button>
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search appointment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <button 
              onClick={() => setIsSelectingPatient(true)}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 text-gray-500"
              title="Filter by Patient"
            >
              <FiUser className="h-5 w-5" />
            </button>
            <button 
              onClick={() => fetchAppointments(true)}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 text-gray-500"
              title="Refresh"
            >
              <FiRefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'pending'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setActiveTab('today')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'today'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'upcoming'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'past'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setActiveTab('cancelled')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'cancelled'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Cancelled/Rejected
            </button>
          </nav>
        </div>

        {/* Patient Selection Modal */}
        {isSelectingPatient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Select Patient</h2>
                <button 
                  onClick={() => setIsSelectingPatient(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiSearch className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name, email, or phone..."
                    value={patientSearchQuery}
                    onChange={(e) => setPatientSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              
              <div className="mt-4 border rounded-md divide-y max-h-96 overflow-y-auto">
                {filteredPatients.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No patients found matching your search.
                  </div>
                ) : (
                  filteredPatients.map(patient => (
                    <div 
                      key={patient.id} 
                      className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                      onClick={() => handleSelectPatient(patient)}
                    >
                      <div>
                        <div className="font-medium">{patient.first_name} {patient.last_name}</div>
                        <div className="text-sm text-gray-500">
                          {patient.email && <div>{patient.email}</div>}
                          {patient.phone && <div>{patient.phone}</div>}
                        </div>
                      </div>
                      <FiCheck className="h-5 w-5 text-primary-600 opacity-0 group-hover:opacity-100" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Appointment Details View */}
        {isViewingDetails && selectedAppointment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Appointment Details</h2>
                <button 
                  onClick={() => setIsViewingDetails(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Patient Info */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="font-medium text-gray-700 mb-2 flex items-center">
                    <FiUser className="mr-2 text-primary-500" /> Patient Information
                  </h3>
                  <p className="text-gray-700">
                    <span className="font-medium">Name:</span> {selectedAppointment.patientName}
                  </p>
                  {selectedAppointment.patients?.email && (
                    <p className="text-gray-700">
                      <span className="font-medium">Email:</span> {selectedAppointment.patients.email}
                    </p>
                  )}
                  {selectedAppointment.patients?.phone && (
                    <p className="text-gray-700">
                      <span className="font-medium">Phone:</span> {selectedAppointment.patients.phone}
                    </p>
                  )}
                </div>
                
                {/* Appointment Info */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="font-medium text-gray-700 mb-2 flex items-center">
                    <FiCalendar className="mr-2 text-primary-500" /> Appointment Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <p className="text-gray-700">
                      <span className="font-medium">Date:</span> {formatDate(selectedAppointment.appointment_date)}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Time:</span> {formatTime(selectedAppointment.appointment_time)}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Branch:</span> {selectedAppointment.branch}
                    </p>
                    <p className="text-gray-700">
                      <span className="font-medium">Status:</span> 
                      <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${getStatusBadgeClass(selectedAppointment.status)}`}>
                        {selectedAppointment.status}
                      </span>
                    </p>
                                         <p className="text-gray-700 md:col-span-2">
                       <span className="font-medium">Procedure Duration:</span> 
                       {appointmentDurations[selectedAppointment.id] ? 
                         ` ${appointmentDurations[selectedAppointment.id]} minutes` : 
                         selectedAppointment.totalServiceDuration > 0 ?
                           ` ${selectedAppointment.totalServiceDuration} minutes (calculated from services)` :
                           ' Not set'}
                       <button 
                         onClick={() => {
                           initializeDurationValues(selectedAppointment);
                           setIsSettingDuration(true);
                         }} 
                         className="ml-2 text-primary-600 hover:text-primary-700 text-sm px-2 py-0.5 border border-primary-300 rounded-md hover:bg-primary-50 transition-colors"
                       >
                         {appointmentDurations[selectedAppointment.id] ? 'Edit Duration' : 'Set Duration'}
                       </button>
                     </p>
                     <p className="text-gray-700 md:col-span-2">
                        <span className="font-medium">Assigned Doctor:</span> 
                        {selectedAppointment.doctor_id ? (
                          <span className="ml-1 text-green-700 font-medium">
                            {doctors.find(d => d.id === selectedAppointment.doctor_id)?.full_name || 'Unknown'}
                          </span>
                        ) : (
                          <span className="ml-1 text-red-600 font-medium">Not assigned</span>
                        )}
                        <button 
                          onClick={() => {
                            if (selectedAppointment.doctor_id) return;
                            setSelectedDoctor(selectedAppointment.doctor_id || '');
                            setIsAssigningDoctor(true);
                          }} 
                          disabled={Boolean(selectedAppointment.doctor_id)}
                          className={`ml-2 text-sm px-2 py-0.5 border rounded-md transition-colors ${selectedAppointment.doctor_id ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-primary-600 hover:text-primary-700 border-primary-300 hover:bg-primary-50'}`}
                        >
                          {selectedAppointment.doctor_id ? 'Assigned' : 'Assign Doctor'}
                        </button>
                      </p>
                  </div>
                </div>
                
                {/* Services */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="font-medium text-gray-700 mb-2">Requested Services</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedAppointment.serviceNames && selectedAppointment.serviceNames.length > 0 ? (
                      selectedAppointment.serviceNames.map((service, index) => (
                        <li key={index} className="text-gray-700">{service}</li>
                      ))
                    ) : (
                      <li className="text-gray-500">No services specified</li>
                    )}
                  </ul>
                </div>
                
                {/* Additional Info */}
                {(selectedAppointment.teeth_involved || selectedAppointment.notes) && (
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h3 className="font-medium text-gray-700 mb-2">Additional Information</h3>
                    {selectedAppointment.teeth_involved && (
                      <p className="text-gray-700 mb-2">
                        <span className="font-medium">Teeth Involved:</span> {selectedAppointment.teeth_involved}
                      </p>
                    )}
                    {selectedAppointment.notes && (
                      <p className="text-gray-700">
                        <span className="font-medium">Notes:</span> {selectedAppointment.notes}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Emergency Alert */}
                {selectedAppointment.is_emergency && (
                  <div className="bg-red-50 p-4 rounded-md border border-red-100">
                    <div className="flex items-center text-red-800">
                      <FiAlertTriangle className="h-5 w-5 mr-2" />
                      <span className="font-medium">This is marked as an emergency appointment</span>
                    </div>
                  </div>
                )}
                
                {/* Duration Not Set Warning */}
                {selectedAppointment.status === 'confirmed' && !appointmentDurations[selectedAppointment.id] && (
                  <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                    <div className="flex items-center text-yellow-800">
                      <FiAlertCircle className="h-5 w-5 mr-2" />
                      <span>Please set the procedure duration for scheduling purposes. This helps prevent scheduling conflicts.</span>
                    </div>
                  </div>
                )}
                
                {/* Doctor Assignment Reminder for Pending Appointments */}
                {selectedAppointment.status === 'pending' && !selectedAppointment.doctor_id && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start">
                      <FiAlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-amber-800 mb-1">Doctor Assignment Required</h4>
                        <p className="text-sm text-amber-700">
                          Please assign a doctor to this appointment before approving it. This ensures proper patient care and scheduling.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3 pt-4">
                  {/* Reschedule for pending/confirmed/rejected */}
                  {['pending', 'confirmed', 'rejected'].includes(selectedAppointment.status) && (
                    <button
                      onClick={() => {
                        setIsRescheduling(true);
                        setRescheduleDate(new Date(selectedAppointment.appointment_date));
                        setSelectedBranchForReschedule(selectedAppointment.branch);
                        fetchAvailableTimeSlots(new Date(selectedAppointment.appointment_date), selectedAppointment.branch);
                      }}
                      className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                    >
                      <FiEdit className="inline-block mr-1" /> Reschedule Appointment
                    </button>
                  )}
                                     {/* Pending Appointment Actions */}
                   {selectedAppointment.status === 'pending' && (
                     <div className="flex flex-col space-y-3">
                       <div className="flex space-x-3">
                         <button
                           onClick={() => {
                             handleUpdateStatus(selectedAppointment.id, 'confirmed');
                             setIsViewingDetails(false);
                           }}
                           className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                         >
                           <FiCheck className="inline-block mr-1" /> Approve
                         </button>
                         <button
                           onClick={() => {
                             handleUpdateStatus(selectedAppointment.id, 'rejected');
                             setIsViewingDetails(false);
                           }}
                           className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                         >
                           <FiX className="inline-block mr-1" /> Reject
                         </button>
                       </div>
                       <button
                         onClick={() => {
                           setSelectedDoctor('');
                           setIsAssigningDoctor(true);
                         }}
                         className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                       >
                         <FiUser className="inline-block mr-1" /> Assign Doctor
                       </button>
                     </div>
                   )}
                  
                                     {/* Confirmed Appointment Actions */}
                   {selectedAppointment.status === 'confirmed' && (
                     <div className="flex flex-col space-y-3">
                       <button
                         onClick={() => {
                           setSelectedDuration(appointmentDurations[selectedAppointment.id] || 30);
                           setIsSettingDuration(true);
                         }}
                         className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                       >
                         <FiDuration className="inline-block mr-1" /> 
                         {appointmentDurations[selectedAppointment.id] ? 'Edit Duration' : 'Set Duration'}
                       </button>
                       <button
                         onClick={() => {
                           setSelectedDoctor(selectedAppointment.doctor_id || '');
                           setIsAssigningDoctor(true);
                         }}
                         className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                       >
                         <FiUser className="inline-block mr-1" /> 
                         {selectedAppointment.doctor_id ? 'Change Doctor' : 'Assign Doctor'}
                       </button>
                       <button
                         onClick={() => {
                           handleUpdateStatus(selectedAppointment.id, 'completed');
                           setIsViewingDetails(false);
                         }}
                         className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                       >
                         <FiCheck className="inline-block mr-1" /> Mark as Completed
                       </button>
                     </div>
                   )}
                </div>
              </div>
            </div>
          </div>
        )}
        
                 {/* Doctor Assignment Modal */}
         {isAssigningDoctor && selectedAppointment && (
           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
             <div className="bg-white rounded-lg p-6 max-w-md w-full">
               <div className="flex justify-between items-start mb-4">
                 <h2 className="text-xl font-semibold text-gray-800">
                   {selectedAppointment.doctor_id ? 'Change Assigned Doctor' : 'Assign Doctor'}
                 </h2>
                 <button 
                   onClick={() => setIsAssigningDoctor(false)}
                   className="text-gray-500 hover:text-gray-700"
                 >
                   <FiX className="h-5 w-5" />
                 </button>
               </div>
               
               <div className="mb-4">
                 <p className="text-sm text-gray-600 mb-4">
                   {selectedAppointment.doctor_id 
                     ? 'Select a different doctor for this appointment.'
                     : 'Assign a doctor to handle this appointment.'
                   }
                 </p>
                 
                 <label htmlFor="doctor" className="block text-sm font-medium text-gray-700 mb-2">
                   Select Doctor
                 </label>
                 <select
                   id="doctor"
                   value={selectedDoctor}
                   onChange={(e) => setSelectedDoctor(e.target.value)}
                   className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                 >
                   <option value="">Choose a doctor...</option>
                   {doctors.map((doctor) => (
                     <option key={doctor.id} value={doctor.id}>
                       {doctor.full_name}
                     </option>
                   ))}
                 </select>
               </div>
               
               <div className="flex space-x-3">
                 <button
                   onClick={() => setIsAssigningDoctor(false)}
                   className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                 >
                   Cancel
                 </button>
                 <button
                   onClick={handleAssignDoctor}
                   disabled={!selectedDoctor}
                   className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {selectedAppointment.doctor_id ? 'Update Assignment' : 'Assign Doctor'}
                 </button>
               </div>
             </div>
           </div>
         )}

         {/* Setting Duration Modal */}
         {isSettingDuration && selectedAppointment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  {appointmentDurations[selectedAppointment.id] ? 'Edit Procedure Duration' : 'Set Procedure Duration'}
                </h2>
                <button 
                  onClick={() => setIsSettingDuration(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-2">
                <p className="text-sm text-gray-600 mb-4">
                  {appointmentDurations[selectedAppointment.id] 
                    ? 'Update the procedure duration as needed. This helps prevent scheduling conflicts and ensures sufficient time is allocated.'
                    : 'Please specify how long this procedure will take. This helps prevent scheduling conflicts and ensures sufficient time is allocated.'
                  }
                </p>
                
                {selectedAppointment.totalServiceDuration > 0 && !appointmentDurations[selectedAppointment.id] && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">Suggested duration:</span> {selectedAppointment.totalServiceDuration} minutes (calculated from selected services)
                    </p>
                  </div>
                )}
                
                {appointmentDurations[selectedAppointment.id] && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-800">
                      <span className="font-medium">Current duration:</span> {appointmentDurations[selectedAppointment.id]} minutes
                    </p>
                  </div>
                )}
                
                {selectedAppointment.totalServiceDuration > 0 && appointmentDurations[selectedAppointment.id] && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">Service-based duration:</span> {selectedAppointment.totalServiceDuration} minutes (calculated from selected services)
                    </p>
                  </div>
                )}
                
                <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    id="duration"
                    value={durationValue}
                    onChange={(e) => handleDurationValueChange(e.target.value)}
                    min="0.5"
                    step="0.5"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter duration"
                  />
                  <select
                    value={durationUnit}
                    onChange={(e) => handleDurationUnitChange(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                  </select>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Total duration:</span> {selectedDuration} minutes
                  {selectedDuration >= 60 && (
                    <span className="ml-2 text-blue-600">
                      ({Math.round(selectedDuration / 60 * 10) / 10} hours)
                    </span>
                  )}
                </div>
              </div>
              
              <div className="text-sm text-gray-600 mb-4">
                <p className="font-medium">Procedure Services:</p>
                <ul className="list-disc list-inside mt-1">
                  {selectedAppointment.serviceNames && selectedAppointment.serviceNames.length > 0 ? (
                    selectedAppointment.serviceNames.map((service, index) => (
                      <li key={index}>{service}</li>
                    ))
                  ) : (
                    <li className="text-gray-500">No services specified</li>
                  )}
                </ul>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setIsSettingDuration(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetDuration}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  {appointmentDurations[selectedAppointment.id] ? 'Update Duration' : 'Save Duration'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reschedule Modal */}
        {isRescheduling && selectedAppointment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Reschedule Appointment</h2>
                <button 
                  onClick={() => setIsRescheduling(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-6">
                <p className="mb-2 text-sm text-gray-600">
                  <span className="font-medium">Patient:</span> {selectedAppointment.patientName}
                </p>
                <p className="mb-4 text-sm text-gray-600">
                  <span className="font-medium">Current Schedule:</span> {formatDate(selectedAppointment.appointment_date)} at {formatTime(selectedAppointment.appointment_time)} - {selectedAppointment.branch} Branch
                </p>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="reschedule-branch" className="block text-sm font-medium text-gray-700 mb-1">
                      Select Branch
                    </label>
                    <select
                      id="reschedule-branch"
                      value={selectedBranchForReschedule}
                      onChange={(e) => {
                        setSelectedBranchForReschedule(e.target.value);
                        setSelectedTimeSlot('');
                        if (rescheduleDate) {
                          fetchAvailableTimeSlots(rescheduleDate, e.target.value);
                        }
                      }}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Select Branch</option>
                      <option value="Cabugao">Cabugao Branch</option>
                      <option value="San Juan">San Juan Branch</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="reschedule-date" className="block text-sm font-medium text-gray-700 mb-1">
                      Select New Date
                    </label>
                    <DatePicker
                      selected={rescheduleDate}
                      onChange={(date) => {
                        setRescheduleDate(date);
                        setSelectedTimeSlot('');
                        if (selectedBranchForReschedule && date) {
                          fetchAvailableTimeSlots(date, selectedBranchForReschedule);
                        }
                      }}
                      minDate={new Date()}
                      dateFormat="MMMM d, yyyy"
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                      scrollableYearDropdown
                      yearDropdownItemNumber={10}
                      placeholderText="Select appointment date"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  {rescheduleDate && selectedBranchForReschedule && (
                    <div>
                      <label htmlFor="reschedule-time" className="block text-sm font-medium text-gray-700 mb-1">
                        Select New Time
                      </label>
                      <select
                        id="reschedule-time"
                        value={selectedTimeSlot}
                        onChange={(e) => setSelectedTimeSlot(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">Select Time</option>
                        {availableTimeSlots.map((timeSlot) => (
                          <option key={timeSlot} value={timeSlot}>
                            {formatTime(timeSlot)}
                          </option>
                        ))}
                      </select>
                      {availableTimeSlots.length === 0 && (
                        <p className="mt-2 text-sm text-yellow-600 flex items-center">
                          <FiAlertTriangle className="mr-1" />
                          No available slots for this date and branch. Please select another date or branch.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsRescheduling(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={!rescheduleDate || !selectedTimeSlot || !selectedBranchForReschedule}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:bg-primary-300"
                >
                  Reschedule
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Debug info display for development */}
        {debugInfo && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md overflow-auto hidden">
            <h3 className="font-medium text-red-800 mb-2">Debug Information</h3>
            <pre className="text-xs text-red-700">{debugInfo}</pre>
          </div>
        )}

        {/* Content */}
        <div>
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-500">
                {selectedPatient 
                  ? `No ${activeTab} appointments found for ${selectedPatient.first_name} ${selectedPatient.last_name}.` 
                  : `No ${activeTab} appointments found.`}
              </p>
              {selectedPatient && (
                <button
                  onClick={clearPatientFilter}
                  className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  View All Patients
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAppointments.map((appointment) => (
                <div 
                  key={appointment.id}
                  className={`bg-white rounded-lg border ${
                    !appointmentDurations[appointment.id] && appointment.status === 'confirmed'
                      ? 'border-yellow-300' 
                      : 'border-gray-300'
                  } p-4 hover:shadow-md transition-shadow`}
                >
                  <div className="flex justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 shadow-sm">
                            {appointment.patients?.profile_picture_url ? (
                              <img
                                src={`${appointment.patients.profile_picture_url}?t=${Date.now()}`}
                                alt={appointment.patientName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full flex items-center justify-center ${
                              appointment.patients?.profile_picture_url ? 'hidden' : ''
                            } bg-primary-100 text-primary-600`}>
                              <span className="font-medium text-xs">
                                {appointment.patientName?.charAt(0)?.toUpperCase() || 'P'}
                              </span>
                            </div>
                          </div>
                          <span className="font-medium text-gray-800">{appointment.patientName}</span>
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadgeClass(appointment.status)}`}>
                          {appointment.status}
                        </span>
                        {appointment.is_emergency && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full flex items-center">
                            <FiAlertTriangle className="mr-1" />
                            Emergency
                          </span>
                        )}
                                                 {appointment.status === 'confirmed' && (
                          <span className={`px-2 py-0.5 text-xs rounded-full flex items-center ${
                            appointmentDurations[appointment.id] 
                              ? 'bg-green-100 text-green-800' 
                              : appointment.totalServiceDuration > 0
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {appointmentDurations[appointment.id] ? (
                              <>
                                <FiDuration className="mr-1" />
                                Duration Set
                              </>
                            ) : appointment.totalServiceDuration > 0 ? (
                              <>
                                <FiDuration className="mr-1" />
                                Calculated Duration
                              </>
                            ) : (
                              <>
                                <FiAlertCircle className="mr-1" />
                                Duration Not Set
                              </>
                            )}
                          </span>
                        )}
                        {appointment.status === 'confirmed' && (
                          <span className={`px-2 py-0.5 text-xs rounded-full flex items-center ${
                            appointment.doctor_id 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {appointment.doctor_id ? (
                              <>
                                <FiUser className="mr-1" />
                                Doctor Assigned
                              </>
                            ) : (
                              <>
                                <FiAlertTriangle className="mr-1" />
                                No Doctor
                              </>
                            )}
                          </span>
                        )}
                        {appointment.status === 'pending' && !appointment.doctor_id && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full flex items-center">
                            <FiAlertTriangle className="mr-1" />
                            Assign Doctor
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                        <div className="flex items-center text-gray-600">
                          <FiCalendar className="mr-2 text-primary-500" />
                          {formatDate(appointment.appointment_date)}
                        </div>
                        <div className="flex items-center text-gray-600">
                          <FiClock className="mr-2 text-primary-500" />
                          {formatTime(appointment.appointment_time)}
                        </div>
                        <div className="flex items-center text-gray-600">
                          <FiMapPin className="mr-2 text-primary-500" />
                          {appointment.branch}
                        </div>
                                                 <div className="flex items-center text-gray-600">
                           <FiDuration className={`mr-2 ${appointmentDurations[appointment.id] ? 'text-green-500' : appointment.totalServiceDuration > 0 ? 'text-blue-500' : 'text-yellow-500'}`} />
                           {appointmentDurations[appointment.id] ? 
                             `${appointmentDurations[appointment.id]} minutes` : 
                             appointment.totalServiceDuration > 0 ? 
                               `${appointment.totalServiceDuration} minutes (calculated)` : 
                               'Duration not set'}
                         </div>
                         <div className="flex items-center text-gray-600">
                           <FiUser className={`mr-2 ${appointment.doctor_id ? 'text-green-500' : 'text-yellow-500'}`} />
                           {appointment.doctor_id ? 
                             doctors.find(d => d.id === appointment.doctor_id)?.full_name || 'Unknown' : 
                             'No doctor assigned'}
                         </div>
                      </div>
                      
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Services:</span> {appointment.serviceNames && appointment.serviceNames.length > 0 ? 
                          appointment.serviceNames.join(', ') : 'None specified'}
                      </div>
                    </div>
                    
                    <div className="ml-4 flex flex-col space-y-2">
                      {/* View Details button - hidden for cancelled appointments */}
                      {appointment.status !== 'cancelled' && (
                        <button
                          onClick={() => {
                            setSelectedAppointment(appointment);
                            setSelectedDuration(appointmentDurations[appointment.id] || appointment.totalServiceDuration || 30);
                            setIsViewingDetails(true);
                          }}
                          className="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
                        >
                          View Details
                        </button>
                      )}
                      
                      {/* Reschedule button for rejected appointments only */}
                      {appointment.status === 'rejected' && (
                        <button
                          onClick={() => {
                            setSelectedAppointment(appointment);
                            setIsRescheduling(true);
                            setRescheduleDate(new Date(appointment.appointment_date));
                            setSelectedBranchForReschedule(appointment.branch);
                            fetchAvailableTimeSlots(new Date(appointment.appointment_date), appointment.branch);
                          }}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          <FiEdit className="inline-block mr-1" /> Reschedule
                        </button>
                      )}
                      
                                             {/* Quick Action Buttons */}
                       {appointment.status === 'pending' && (
                         <>
                           <button
                             onClick={() => handleUpdateStatus(appointment.id, 'confirmed')}
                             className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                           >
                             Approve
                           </button>
                           <button
                             onClick={() => {
                               setSelectedAppointment(appointment);
                               setSelectedDoctor('');
                               setIsAssigningDoctor(true);
                             }}
                             className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                           >
                             Assign Doctor
                           </button>
                           <button
                             onClick={() => handleUpdateStatus(appointment.id, 'rejected')}
                             className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                           >
                             Reject
                           </button>
                         </>
                       )}
                      
                                             {appointment.status === 'confirmed' && (
                         <>
                           
                           <button
                             onClick={() => {
                               setSelectedAppointment(appointment);
                               initializeDurationValues(appointment);
                               setIsSettingDuration(true);
                             }}
                             className={`px-3 py-1 text-white text-sm rounded ${
                               appointmentDurations[appointment.id] 
                                 ? 'bg-primary-600 hover:bg-primary-700' 
                                 : appointment.totalServiceDuration > 0
                                   ? 'bg-blue-600 hover:bg-blue-700'
                                   : 'bg-yellow-600 hover:bg-yellow-700'
                             }`}
                           >
                             {appointmentDurations[appointment.id] ? 'Edit Duration' : 'Set Duration'}
                           </button>
                           <button
                             onClick={() => {
                               if (appointment.doctor_id) return;
                               setSelectedAppointment(appointment);
                               setSelectedDoctor('');
                               setIsAssigningDoctor(true);
                             }}
                             className={`px-3 py-1 text-white text-sm rounded ${
                               appointment.doctor_id 
                                 ? 'bg-green-600 cursor-not-allowed opacity-60' 
                                 : 'bg-orange-600 hover:bg-orange-700'
                             }`}
                           >
                             {appointment.doctor_id ? 'Assigned' : 'Assign Doctor'}
                           </button>
                           <button
                             onClick={() => handleUpdateStatus(appointment.id, 'completed')}
                             className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                           >
                             Complete
                           </button>
                         </>
                       )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffAppointments;