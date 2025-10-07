// src/pages/doctor/Appointments.jsx - Fixed with proper queue integration
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../config/supabaseClient';
import { toast } from 'react-toastify';
import { QueueService } from '../../services/queueService';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';
import { 
  FiCalendar, FiClock, FiMapPin, FiUser, FiMessageSquare,
  FiCheck, FiX, FiEdit, FiFilter, FiSearch, FiAlertTriangle, 
  FiClock as FiDuration, FiRefreshCw, FiAlertCircle
} from 'react-icons/fi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAppointmentNotifications } from '../../hooks/useNotificationIntegration';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const DoctorAppointments = () => {
  const { user } = useAuth();
  
  // Get notification functions from the hook
  const { confirmAppointment, cancelAppointment, rejectAppointment } = useAppointmentNotifications();
  
  // Get audit log functions
  const { logPageView, logAppointmentView, logAppointmentCreate, logAppointmentUpdate, logAppointmentCancel } = useUniversalAudit();
  
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isViewingDetails, setIsViewingDetails] = useState(false);
  const [appointmentDurations, setAppointmentDurations] = useState({});
  const [isSettingDuration, setIsSettingDuration] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [durationValue, setDurationValue] = useState('30'); // For input field
  const [durationUnit, setDurationUnit] = useState('minutes'); // minutes or hours
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isSelectingPatient, setIsSelectingPatient] = useState(false);
  const [patients, setPatients] = useState([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);
  
  // Reschedule states
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [selectedBranchForReschedule, setSelectedBranchForReschedule] = useState('');

  // Fetch appointments on component mount
  useEffect(() => {
    if (user) {
      checkUserRole();
    }
  }, [user]);

  // Filter appointments when activeTab or searchQuery changes
  useEffect(() => {
    filterAppointments();
  }, [activeTab, searchQuery, appointments, selectedPatient]);

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

  // Debug: Log appointments when they change
  useEffect(() => {
    console.log('Appointments updated:', appointments.map(app => ({ 
      id: app.id, 
      status: app.status, 
      patient: app.patientName,
      date: app.appointment_date 
    })));
  }, [appointments]);

  // Check user role and fetch data accordingly
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
      const role = data.role;
      setUserRole(role);
      
      if (['doctor', 'admin', 'staff'].includes(role)) {
        fetchAppointments(role);
        fetchPatients();
        // Log page view
        logPageView('Doctor Appointments', 'appointments', 'doctor_management');
      } else {
        toast.error('You do not have permission to view this page');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      toast.error('Failed to verify your account permissions');
      setIsLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const { data: testData, error: testError } = await supabase
        .from('profiles')
        .select('count')
        .eq('role', 'patient')
        .single();
        
      if (testError) {
        console.error('Test connection error:', testError);
        throw new Error('Could not connect to database. Please check your network connection.');
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('role', 'patient');
      
      if (error) {
        console.error('Patient fetch error:', error);
        throw error;
      }
      
      const formattedPatients = data.map(patient => {
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

  const fetchAppointments = async (role) => {
    setIsLoading(true);
    try {
      console.log('Fetching appointments for role:', role);
      
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
      
      // Build base query - filter by doctor assignment based on role
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
      
      // Filter appointments based on user role:
      // - Doctors can only see appointments assigned to them or unassigned pending appointments
      // - Admins and staff can see all appointments
      if (role === 'doctor') {
        // For doctors: Show appointments assigned to them OR unassigned pending appointments
        query = query.or(`doctor_id.eq.${user.id},and(doctor_id.is.null,status.eq.pending)`);
      }
      
      // If a patient is selected, filter by patient_id
      if (selectedPatient) {
        query = query.eq('patient_id', selectedPatient.id);
      }
      
      const { data: appointmentData, error: appointmentError } = await query;
      
      if (appointmentError) {
        console.error('Error fetching appointments:', appointmentError);
        throw appointmentError;
      }
      
      console.log(`Fetched ${appointmentData.length} appointments for ${role}`);
      console.log('Appointment statuses found:', appointmentData.map(app => ({ id: app.id, status: app.status, patient_id: app.patient_id })));
      
      // Fetch patient profiles separately
      const patientIds = [...new Set(appointmentData.map(a => a.patient_id))];
      
      const { data: patientData, error: patientError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, profile_picture_url')
        .in('id', patientIds);
      
      if (patientError) {
        console.error('Error fetching patient profiles:', patientError);
      }
      
      // Fetch doctor profiles for assigned appointments
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
      
      // Create lookup maps
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
      
      // Fetch appointment services
      const appointmentIds = appointmentData.map(a => a.id);
      console.log('Fetching services for appointment IDs:', appointmentIds);
      
      const { data: serviceJoinData, error: serviceJoinError } = await supabase
        .from('appointment_services')
        .select('appointment_id, service_id')
        .in('appointment_id', appointmentIds);
      
      if (serviceJoinError) {
        console.error('Error fetching appointment-service join data:', serviceJoinError);
      }
      
      console.log('Service join data found:', serviceJoinData);
      const serviceIds = serviceJoinData ? [...new Set(serviceJoinData.map(s => s.service_id))] : [];
      console.log('Service IDs found:', serviceIds);
      
      const { data: serviceData, error: serviceError } = serviceIds.length > 0 
        ? await supabase
            .from('services')
            .select('id, name, description, price, duration')
            .in('id', serviceIds)
        : { data: [], error: null };
      
      if (serviceError) {
        console.error('Error fetching service details:', serviceError);
      }
      
      // Create service lookup maps
      const serviceMap = {};
      if (serviceData) {
        serviceData.forEach(service => {
          serviceMap[service.id] = service;
        });
      }
      
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
      
      // Combine all the data
      const formattedAppointments = appointmentData.map(appointment => {
        const patient = patientMap[appointment.patient_id] || { full_name: 'Unknown' };
        const doctor = doctorMap[appointment.doctor_id] || null;
        const services = appointmentServicesMap[appointment.id] || [];
        
        // Calculate total duration based on services
        const totalServiceDuration = services.reduce((total, service) => {
          return total + (service.service_id.duration || 30); // Default 30 minutes if no duration set
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
      
      // Fetch appointment durations
      try {
        const { data: durationData, error: durationError } = await supabase
          .from('appointment_durations')
          .select('appointment_id, duration_minutes');
        
        if (!durationError && durationData) {
          const durationMap = {};
          durationData.forEach(item => {
            durationMap[item.appointment_id] = item.duration_minutes;
          });
          
          setAppointmentDurations(durationMap);
        } else {
          console.log('Appointment durations may not exist yet:', durationError);
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
        .select('appointment_time, doctor_id')
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

      let availableSlots = [...allTimeSlots];
      
      // For doctors, only check their own bookings plus unassigned slots
      if (userRole === 'doctor') {
        const doctorBookedSlots = bookedSlots
          .filter(slot => slot.doctor_id === user.id)
          .map(slot => slot.appointment_time);
        
        availableSlots = allTimeSlots.filter(time => !doctorBookedSlots.includes(time));
      } else {
        // For admin/staff, check all bookings
        const allBookedTimeStrings = bookedSlots.map(slot => slot.appointment_time);
        availableSlots = allTimeSlots.filter(time => !allBookedTimeStrings.includes(time));
      }
      
      setAvailableTimeSlots(availableSlots);
    } catch (error) {
      console.error('Error fetching available time slots:', error);
      toast.error('Failed to load available time slots');
    }
  };

  const filterAppointments = () => {
    if (!appointments.length) return;
    
    let filtered = [...appointments];
    
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
      
      // Sort to show rejected appointments first, then cancelled
      filtered.sort((a, b) => {
        if (a.status === 'rejected' && b.status === 'cancelled') return -1;
        if (a.status === 'cancelled' && b.status === 'rejected') return 1;
        
        // If both have same status, sort by date (newest first)
        const dateA = new Date(`${a.appointment_date}T${a.appointment_time}`);
        const dateB = new Date(`${b.appointment_date}T${b.appointment_time}`);
        return dateB - dateA;
      });
    }
    
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

  const handleUpdateStatus = async (appointmentId, newStatus) => {
    try {
      // Get appointment data for audit logging
      const appointment = appointments.find(app => app.id === appointmentId);
      if (!appointment) {
        toast.error('Appointment not found');
        return;
      }

      const oldStatus = appointment.status;
      let notificationResult = null;
      
      // Handle notifications based on status - with proper error handling
      try {
        if (newStatus === 'confirmed' && confirmAppointment && typeof confirmAppointment === 'function') {
          notificationResult = await confirmAppointment(appointmentId, user.id);
        } else if (newStatus === 'cancelled' && cancelAppointment && typeof cancelAppointment === 'function') {
          notificationResult = await cancelAppointment(appointmentId);
        } else if (newStatus === 'rejected' && rejectAppointment && typeof rejectAppointment === 'function') {
          notificationResult = await rejectAppointment(appointmentId);
        }
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
        // Continue with status update even if notification fails
      }
      
      // Enhanced status update with constraint handling
      let updateResult, error;
      
      // Try the standard update first
      const result = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId)
        .select('id, status, appointment_date, appointment_time, branch');
      
      updateResult = result.data;
      error = result.error;
      
      // If standard update fails and we're changing from rejected to pending, try completely different approach
      if (error && oldStatus === 'rejected' && newStatus === 'pending') {
        console.log('Standard status update failed, trying completely different approach for rejected to pending...');
        console.error('Status update error:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        // Completely different approach: Create new appointment and delete old one
        console.log('Trying completely different approach: Create new appointment with pending status...');
        
        try {
          // First, fetch the services from the old appointment
          console.log('Fetching services from old appointment...');
          const { data: oldServices, error: servicesError } = await supabase
            .from('appointment_services')
            .select('service_id')
            .eq('appointment_id', appointmentId);
          
          if (servicesError) {
            console.warn('Could not fetch services from old appointment:', servicesError);
          } else {
            console.log('Found services in old appointment:', oldServices);
          }
          
          // Create new appointment with pending status
          const newAppointmentData = {
            patient_id: appointment.patient_id,
            appointment_date: appointment.appointment_date,
            appointment_time: appointment.appointment_time,
            branch: appointment.branch,
            status: 'pending',
            doctor_id: appointment.doctor_id,
            notes: appointment.notes || null
          };
          
          console.log('Creating new appointment with data:', newAppointmentData);
          const createResult = await supabase
            .from('appointments')
            .insert([newAppointmentData])
            .select('id, status, appointment_date, appointment_time, branch');
          
          if (createResult.error) {
            console.error('Failed to create new appointment:', createResult.error);
            throw createResult.error;
          } else {
            console.log('New appointment created successfully:', createResult.data);
            
            const newAppointmentId = createResult.data[0].id;
            console.log('New appointment ID:', newAppointmentId);
            
            // Copy services from old appointment to new appointment
            if (oldServices && oldServices.length > 0) {
              console.log('Copying services to new appointment...');
              const newServicesData = oldServices.map(service => ({
                appointment_id: newAppointmentId,
                service_id: service.service_id
              }));
              
              const { error: copyServicesError } = await supabase
                .from('appointment_services')
                .insert(newServicesData);
              
              if (copyServicesError) {
                console.error('Failed to copy services to new appointment:', copyServicesError);
                console.warn('New appointment created but services not copied. You may need to manually add services.');
              } else {
                console.log('Services copied successfully to new appointment');
              }
            } else {
              console.log('No services found in old appointment to copy');
            }
            
            // Delete the old rejected appointment
            console.log('Deleting old rejected appointment...');
            const deleteResult = await supabase
              .from('appointments')
              .delete()
              .eq('id', appointmentId);
            
            if (deleteResult.error) {
              console.error('Failed to delete old appointment:', deleteResult.error);
              console.warn('New appointment created but old one not deleted. You may need to manually clean up.');
            } else {
              console.log('Old appointment deleted successfully');
            }
            
            // Update the result with the new appointment data
            updateResult = createResult.data;
            
            // Update local state with new appointment ID and preserve services
            setAppointments(appointments.map(app => 
              app.id === appointmentId 
                ? { 
                    ...app, 
                    id: newAppointmentId,
                    status: 'pending',
                    updated_at: new Date().toISOString(),
                    // Preserve existing services data
                    services: app.services || [],
                    serviceIds: app.serviceIds || [],
                    serviceNames: app.serviceNames || [],
                    totalServiceDuration: app.totalServiceDuration || 0
                  } 
                : app
            ));
            
            // Update the appointmentId for the rest of the function
            appointmentId = newAppointmentId;
          }
        } catch (createError) {
          console.error('Completely different approach failed:', createError);
          throw error; // Throw original error
        }
      } else if (error) {
        throw error;
      }

      // Log audit event for status change
      try {
        await logAppointmentStatusChange(appointmentId, oldStatus, newStatus, {
          ...appointment,
          patient_name: appointment.patientName,
          doctor_id: newStatus === 'confirmed' && userRole === 'doctor' ? user.id : appointment.doctor_id,
          branch: appointment.branch,
          status_change_reason: 'doctor_action',
          changed_by: user.id
        });
      } catch (auditError) {
        console.error('Error logging audit event:', auditError);
        // Continue even if audit logging fails
      }
      
      // If approving appointment, automatically add to today's queue if it's for today
      if (newStatus === 'confirmed') {
        const appointment = appointments.find(app => app.id === appointmentId);
        if (appointment) {
          const appointmentDate = appointment.appointment_date;
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const todayDate = `${year}-${month}-${day}`;
          
          if (appointmentDate === todayDate) {
            const queueResult = await QueueService.addAppointmentToQueue({
              ...appointment,
              id: appointmentId,
              status: newStatus,
              doctor_id: newStatus === 'confirmed' && userRole === 'doctor' ? user.id : appointment.doctor_id
            }, { source: 'doctor_appointments' });

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
      }
      
      // Verify the status was actually updated in the database (especially for rejected to pending)
      if (oldStatus === 'rejected' && newStatus === 'pending') {
        console.log('Verifying status update in database...');
        const { data: verifyData, error: verifyError } = await supabase
          .from('appointments')
          .select('id, status, appointment_date, appointment_time, branch')
          .eq('id', appointmentId)
          .single();
        
        if (verifyError) {
          console.error('Error verifying status update:', verifyError);
        } else {
          console.log('Database verification result:', verifyData);
          if (verifyData.status !== 'pending') {
            console.warn('Status was not updated to pending in database. Current status:', verifyData.status);
            console.log('Attempting final status update...');
            
            const { error: finalStatusError } = await supabase
              .from('appointments')
              .update({ status: 'pending' })
              .eq('id', appointmentId);
            
            if (finalStatusError) {
              console.error('Final status update failed:', finalStatusError);
            } else {
              console.log('Final status update successful');
            }
          } else {
            console.log('Status successfully updated to pending in database');
          }
        }
      }
      
      setAppointments(appointments.map(appointment => 
        appointment.id === appointmentId 
          ? { 
              ...appointment, 
              status: newStatus,
              doctor_id: newStatus === 'confirmed' && userRole === 'doctor' ? user.id : appointment.doctor_id,
              doctorName: newStatus === 'confirmed' && userRole === 'doctor' ? user.full_name : appointment.doctorName
            } 
          : appointment
      ));
      
      // Refresh appointments from database to ensure consistency
      console.log('Refreshing appointments after status update...');
      console.log('New appointment ID after status update:', appointmentId);
      await fetchAppointments(userRole);
      
      if (notificationResult?.success) {
        toast.success(`Appointment ${newStatus} successfully - Patient notified`);
      } else {
        toast.success(`Appointment ${newStatus} successfully${newStatus === 'confirmed' && userRole === 'doctor' ? ' and assigned to you' : ''}`);
      }
    } catch (error) {
      console.error(`Error updating appointment status to ${newStatus}:`, error);
      toast.error(`Failed to ${newStatus} appointment`);
    }
  };


  const handleReschedule = async () => {
    if (!rescheduleDate || !selectedTimeSlot || !selectedBranchForReschedule) {
      toast.error('Please select a date, time, and branch');
      return;
    }

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          appointment_date: rescheduleDate.toISOString().split('T')[0], 
          appointment_time: selectedTimeSlot,
          branch: selectedBranchForReschedule
        })
        .eq('id', selectedAppointment.id);
      
      if (error) throw error;
      
      setAppointments(appointments.map(appointment => 
        appointment.id === selectedAppointment.id 
          ? { 
              ...appointment, 
              appointment_date: rescheduleDate.toISOString().split('T')[0], 
              appointment_time: selectedTimeSlot,
              branch: selectedBranchForReschedule
            } 
          : appointment
      ));
      
      toast.success('Appointment rescheduled successfully');
      setIsRescheduling(false);
      setIsViewingDetails(false);
      
      // Reset reschedule states
      setRescheduleDate(null);
      setSelectedTimeSlot('');
      setSelectedBranchForReschedule('');
      setAvailableTimeSlots([]);
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      toast.error('Failed to reschedule appointment');
    }
  };

  const handleSetDuration = async () => {
    try {
      if (!selectedAppointment) return;
      
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
      
      if (!tableExists) {
        toast.info('Setting up appointment durations table...');
        
        try {
          const { error: updateError } = await supabase
            .from('appointments')
            .update({ duration_minutes: selectedDuration })
            .eq('id', selectedAppointment.id);
          
          if (updateError) throw updateError;
          
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
      
      const { data: existingData, error: checkError } = await supabase
        .from('appointment_durations')
        .select('id')
        .eq('appointment_id', selectedAppointment.id);
      
      if (checkError) throw checkError;
      
      let result;
      if (existingData && existingData.length > 0) {
        result = await supabase
          .from('appointment_durations')
          .update({ 
            duration_minutes: selectedDuration,
            updated_at: new Date().toISOString(),
            updated_by: user.id
          })
          .eq('appointment_id', selectedAppointment.id);
      } else {
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
    if (userRole) {
      fetchAppointments(userRole);
    }
  };

  const clearPatientFilter = () => {
    setSelectedPatient(null);
    if (userRole) {
      fetchAppointments(userRole);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {userRole === 'doctor' ? 'My Appointments' : 'Manage All Appointments'}
            </h1>
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
            {userRole === 'doctor' && (
              <p className="text-sm text-gray-600 mt-1">
                Showing appointments assigned to you and unassigned appointments
              </p>
            )}
            <p className="text-sm text-blue-600 mt-1">
              ✅ Confirmed appointments for today are automatically added to the queue
            </p>
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
              onClick={() => userRole && fetchAppointments(userRole)}
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
                      <span className="font-medium">Assigned Doctor:</span> 
                      {selectedAppointment.doctorName ? selectedAppointment.doctorName : ' Not assigned'}
                    </p>
                    <p className="text-gray-700 md:col-span-2">
                      <span className="font-medium">Procedure Duration:</span> 
                      {appointmentDurations[selectedAppointment.id] ? 
                        ` ${appointmentDurations[selectedAppointment.id]} minutes (manually set)` : 
                        selectedAppointment.totalServiceDuration > 0 ? 
                          ` ${selectedAppointment.totalServiceDuration} minutes (calculated from services)` : 
                          ' Not set'}
                      <button 
                        onClick={() => {
                          initializeDurationValues(selectedAppointment);
                          setIsSettingDuration(true);
                        }} 
                        className="ml-2 text-primary-600 hover:text-primary-700 text-sm px-2 py-0.5 border border-primary-300 rounded-md"
                      >
                        {appointmentDurations[selectedAppointment.id] ? 'Change Duration' : 'Set Duration'}
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
                
                {/* Action Buttons */}
                <div className="space-y-3 pt-4">
                  {/* Pending Appointment Actions */}
                  {selectedAppointment.status === 'pending' && (
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          handleUpdateStatus(selectedAppointment.id, 'confirmed');
                          setIsViewingDetails(false);
                        }}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        <FiCheck className="inline-block mr-1" /> 
                        {userRole === 'doctor' ? 'Accept & Assign to Me' : 'Approve'}
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
                  )}
                  
                  {/* Reschedule Button (for any non-completed/cancelled status) */}
                  {['pending', 'confirmed'].includes(selectedAppointment.status) && (
                    <button
                      onClick={() => {
                        setIsRescheduling(true);
                        setRescheduleDate(new Date(selectedAppointment.appointment_date));
                        setSelectedBranchForReschedule(selectedAppointment.branch);
                        fetchAvailableTimeSlots(
                          new Date(selectedAppointment.appointment_date),
                          selectedAppointment.branch
                        );
                      }}
                      className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                    >
                      <FiEdit className="inline-block mr-1" /> Reschedule Appointment
                    </button>
                  )}
                  
                  {/* Confirmed Appointment Actions */}
                  {selectedAppointment.status === 'confirmed' && (
                    <div className="flex flex-col space-y-3">
                      {!appointmentDurations[selectedAppointment.id] && (
                        <button
                          onClick={() => {
                            initializeDurationValues(selectedAppointment);
                            setIsSettingDuration(true);
                          }}
                          className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                        >
                          <FiDuration className="inline-block mr-1" /> Set Procedure Duration
                        </button>
                      )}
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
                  
                  {/* Rejected Appointment Actions */}
                  {selectedAppointment.status === 'rejected' && (
                    <div className="flex flex-col space-y-3">
                      <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                        <div className="flex items-center text-yellow-800">
                          <FiAlertTriangle className="h-5 w-5 mr-2" />
                          <span>This appointment was previously rejected. You can accept it to review and approve.</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleUpdateStatus(selectedAppointment.id, 'pending');
                          setIsViewingDetails(false);
                        }}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        <FiCheck className="inline-block mr-1" /> Accept & Review
                      </button>
                    </div>
                  )}
                  
                </div>
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
        
        {/* Setting Duration Modal */}
        {isSettingDuration && selectedAppointment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Set Procedure Duration</h2>
                <button 
                  onClick={() => setIsSettingDuration(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-2">
                <p className="text-sm text-gray-600 mb-4">
                  Please specify how long this procedure will take. This helps prevent scheduling conflicts and ensures sufficient time is allocated.
                </p>
                
                {selectedAppointment.totalServiceDuration > 0 && !appointmentDurations[selectedAppointment.id] && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">Suggested duration:</span> {selectedAppointment.totalServiceDuration} minutes (calculated from selected services)
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
                  Save Duration
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
                  : `No ${activeTab} appointments found${userRole === 'doctor' ? ' assigned to you' : ''}.`}
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
                        {!appointmentDurations[appointment.id] && appointment.status === 'confirmed' && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full flex items-center">
                            <FiAlertCircle className="mr-1" />
                            Duration Not Set
                          </span>
                        )}
                        {appointment.doctor_id && appointment.doctorName && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                            Dr. {appointment.doctorName}
                          </span>
                        )}
                        {!appointment.doctor_id && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs rounded-full">
                            Unassigned
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
                          <FiDuration className="mr-2 text-primary-500" />
                          {appointmentDurations[appointment.id] ? 
                            `${appointmentDurations[appointment.id]} minutes` : 
                            appointment.totalServiceDuration > 0 ? 
                              `${appointment.totalServiceDuration} minutes (based on services)` : 
                              'Duration not set'}
                        </div>
                      </div>
                      
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Services:</span> {appointment.serviceNames && appointment.serviceNames.length > 0 ? 
                          appointment.serviceNames.join(', ') : 'None specified'}
                      </div>
                    </div>
                    
                    <div className="ml-4 flex flex-col space-y-2">
                      {appointment.status !== 'cancelled' && (
                        <button
                          onClick={() => {
                            setSelectedAppointment(appointment);
                            setSelectedDuration(appointmentDurations[appointment.id] || 30);
                            setIsViewingDetails(true);
                          }}
                          className="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
                        >
                          View Details
                        </button>
                      )}
                      
                      {/* Quick Action Buttons - Consolidated */}
                      {appointment.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateStatus(appointment.id, 'confirmed')}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          {userRole === 'doctor' ? 'Accept & Add to Queue' : 'Approve & Add to Queue'}
                        </button>
                      )}
                      
                      {appointment.status === 'confirmed' && (
                        <>
                                                {!appointmentDurations[appointment.id] && (
                        <button
                          onClick={() => {
                            setSelectedAppointment(appointment);
                            initializeDurationValues(appointment);
                            setIsSettingDuration(true);
                          }}
                          className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                        >
                          Set Duration
                        </button>
                      )}
                      {appointmentDurations[appointment.id] && (
                        <button
                          onClick={() => {
                            setSelectedAppointment(appointment);
                            initializeDurationValues(appointment);
                            setIsSettingDuration(true);
                          }}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Change Duration
                        </button>
                      )}
                          <button
                            onClick={() => handleUpdateStatus(appointment.id, 'completed')}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                          >
                            Complete
                          </button>
                        </>
                      )}
                      
                      {appointment.status === 'rejected' && (
                        <button
                          onClick={() => handleUpdateStatus(appointment.id, 'pending')}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Accept & Review
                        </button>
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

export default DoctorAppointments;