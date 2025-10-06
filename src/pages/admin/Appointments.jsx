// src/pages/admin/Appointments.jsx - Fixed with Proper Doctor Assignment
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../config/supabaseClient';
import { toast } from 'react-toastify';
import { QueueService } from '../../services/queueService';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';
import { useAppointmentNotifications } from '../../hooks/useNotificationIntegration';
import { 
  FiCalendar, FiClock, FiMapPin, FiUser, FiMessageSquare,
  FiCheck, FiX, FiEdit, FiFilter, FiSearch, FiAlertTriangle, 
  FiClipboard, FiRefreshCw, FiUserPlus, FiUsers, FiUserMinus
} from 'react-icons/fi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

const AdminAppointments = () => {
  const { user } = useAuth();
  const { logPageView, logAppointmentView, logAppointmentCreate, logAppointmentUpdate, logAppointmentCancel } = useUniversalAudit();
  const [isLoading, setIsLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isViewingDetails, setIsViewingDetails] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isAssigningDoctor, setIsAssigningDoctor] = useState(false);
  
  // Filters
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Reschedule states
  const [rescheduleDate, setRescheduleDate] = useState(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [selectedBranchForReschedule, setSelectedBranchForReschedule] = useState('');
  
  // Doctor assignment
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  
  // Appointment durations
  const [appointmentDurations, setAppointmentDurations] = useState({});
  const [isSettingDuration, setIsSettingDuration] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(30);

  // Fetch data
  useEffect(() => {
    fetchAppointments();
    fetchDoctors();
    // Log page view
    logPageView('Admin Appointments', 'appointments', 'management');
  }, [user, logPageView]);

  // Filter appointments when filters change
  useEffect(() => {
    filterAppointments();
    if (activeTab === 'cancelled') {
      console.log('Cancelled tab selected, filteredAppointments:', filteredAppointments.length);
    }
  }, [activeTab, searchQuery, selectedBranch, selectedDoctor, dateRange, appointments]);

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching appointments...');
      
      const { data: testData, error: testError } = await supabase
        .from('appointments')
        .select('count')
        .limit(1)
        .single();
      
      if (testError) {
        console.error('Connection test failed:', testError);
        throw new Error('Database connection test failed. Please check your authentication status.');
      }
      
      console.log('Connection test successful, proceeding with appointments query');
      
      // Fetch appointments with proper doctor assignment data
      const { data, error } = await supabase
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
          created_at,
          patients:profiles!patient_id(id, full_name, email, phone, profile_picture_url),
          doctors:profiles!doctor_id(id, full_name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching appointments:', error);
        throw error;
      }
      
      const appointmentIds = data.map(app => app.id);
      
      const { data: servicesData, error: servicesError } = await supabase
        .from('appointment_services')
        .select(`
          appointment_id, 
          service_id,
          services:service_id(id, name, description, price)
        `)
        .in('appointment_id', appointmentIds);
      
      if (servicesError) {
        console.error('Error fetching services:', servicesError);
      }
      
      const servicesMap = {};
      if (servicesData) {
        servicesData.forEach(item => {
          if (!servicesMap[item.appointment_id]) {
            servicesMap[item.appointment_id] = [];
          }
          servicesMap[item.appointment_id].push({
            service_id: item.services
          });
        });
      }
      
      const formattedAppointments = data.map(appointment => ({
        ...appointment,
        services: servicesMap[appointment.id] || [],
        serviceIds: servicesMap[appointment.id] 
          ? servicesMap[appointment.id].map(s => s.service_id.id) 
          : [],
        serviceNames: servicesMap[appointment.id] 
          ? servicesMap[appointment.id].map(s => s.service_id.name) 
          : [],
        patientName: appointment.patients?.full_name || 'Unknown',
        doctorName: appointment.doctors?.full_name || null
      }));
      
      console.log(`Successfully loaded ${formattedAppointments.length} appointments`);
      setAppointments(formattedAppointments);
      
      // Fetch appointment durations
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
          console.log('Appointment durations loaded:', Object.keys(durationMap).length);
        } else if (durationError) {
          console.warn('Could not fetch appointment durations:', durationError);
        }
      } catch (durationErr) {
        console.warn('Error fetching appointment durations:', durationErr);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.error(`Failed to load appointments: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const { data: testData, error: testError } = await supabase
        .from('profiles')
        .select('count')
        .eq('role', 'doctor')
        .limit(1);
      
      if (testError) {
        console.error('Doctor connection test failed:', testError);
        throw new Error('Database connection test failed for doctors query.');
      }
      
      // Only fetch active (non-disabled) doctors
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'doctor')
        .neq('disabled', true)
        .order('full_name');
      
      if (error) {
        console.error('Error details:', error);
        throw error;
      }
      
      console.log(`Successfully loaded ${data?.length || 0} active doctors`);
      setDoctors(data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast.error(`Failed to load doctors: ${error.message}`);
    }
  };

  const filterAppointments = () => {
    if (!appointments.length) return;
    
    let filtered = [...appointments];
    
    if (activeTab === 'pending') {
      filtered = filtered.filter(app => app.status === 'pending');
    } else if (activeTab === 'confirmed') {
      filtered = filtered.filter(app => app.status === 'confirmed');
    } else if (activeTab === 'completed') {
      filtered = filtered.filter(app => app.status === 'completed');
    } else if (activeTab === 'cancelled') {
      filtered = filtered.filter(app => app.status === 'cancelled' || app.status === 'rejected');
    } else if (activeTab === 'emergency') {
      filtered = filtered.filter(app => app.is_emergency === true);
    } else if (activeTab === 'unassigned') {
      filtered = filtered.filter(app => !app.doctor_id);
    }
    
    if (selectedBranch) {
      filtered = filtered.filter(app => app.branch === selectedBranch);
    }
    
    if (selectedDoctor) {
      filtered = filtered.filter(app => app.doctor_id === selectedDoctor);
    }
    
    if (startDate && endDate) {
      filtered = filtered.filter(app => {
        const appDate = new Date(app.appointment_date);
        return appDate >= startDate && appDate <= endDate;
      });
    }
    
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(app => 
        (app.patientName && app.patientName.toLowerCase().includes(query)) ||
        (app.doctorName && app.doctorName.toLowerCase().includes(query)) ||
        (app.branch && app.branch.toLowerCase().includes(query)) ||
        (app.serviceNames && app.serviceNames.some(service => service.toLowerCase().includes(query)))
      );
    }
    
    setFilteredAppointments(filtered);
  };

  // Get available time slots based on selected date and branch
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
      
      if (selectedDoctorId) {
        const doctorBookedSlots = bookedSlots
          .filter(slot => slot.doctor_id === selectedDoctorId)
          .map(slot => slot.appointment_time);
        
        availableSlots = allTimeSlots.filter(time => !doctorBookedSlots.includes(time));
      } else {
        const allBookedTimeStrings = bookedSlots.map(slot => slot.appointment_time);
        availableSlots = allTimeSlots.filter(time => !allBookedTimeStrings.includes(time));
      }
      
      setAvailableTimeSlots(availableSlots);
    } catch (error) {
      console.error('Error fetching available time slots:', error);
      toast.error('Failed to load available time slots');
    }
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

      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);
      
      if (error) throw error;

      // Log audit event for status change
      try {
        await logAppointmentStatusChange(appointmentId, oldStatus, newStatus, {
          ...appointment,
          patient_name: appointment.patientName,
          doctor_id: appointment.doctor_id,
          branch: appointment.branch,
          status_change_reason: 'admin_action',
          changed_by: user.id
        });
        
        // Also log with comprehensive audit
        await logAppointmentUpdate(appointmentId, { status: oldStatus }, { status: newStatus });
      } catch (auditError) {
        console.error('Error logging audit event:', auditError);
        // Continue even if audit logging fails
      }
      
      // If approving appointment, automatically add to today's queue if it's for today
      if (newStatus === 'confirmed') {
        const appointment = appointments.find(app => app.id === appointmentId);
        if (appointment) {
          const appointmentDate = appointment.appointment_date;
          const today = new Date().toISOString().split('T')[0];
          
          if (appointmentDate === today) {
            const queueResult = await QueueService.addAppointmentToQueue(appointment, { source: 'admin_appointments' });

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
      
      setAppointments(appointments.map(appointment => 
        appointment.id === appointmentId 
          ? { ...appointment, status: newStatus } 
          : appointment
      ));
      
      toast.success(`Appointment ${newStatus} successfully`);
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
        console.warn('Fetch error details:', {
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
          code: fetchError.code
        });
        console.warn('Continuing with reschedule using local appointment data...');
        // Don't throw error, just continue with the reschedule using local data
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
            console.log('Update without status succeeded, now updating status...');
            // Now try to update status separately
            console.log('Attempting separate status update to pending...');
            const statusResult = await supabase
              .from('appointments')
              .update({ status: 'pending' })
              .eq('id', selectedAppointment.id)
              .select('id, status, appointment_date, appointment_time, branch');
            
            if (statusResult.error) {
              console.error('Status update failed:', statusResult.error);
              console.error('Status update error details:', {
                message: statusResult.error.message,
                details: statusResult.error.details,
                hint: statusResult.error.hint,
                code: statusResult.error.code
              });
              // Don't throw error, but log the issue
              console.warn('Status update failed, but appointment was rescheduled. Status remains:', result2.data[0]?.status);
            } else {
              console.log('Status update successful:', statusResult.data);
              // Use the status update result which includes the new status
              updateResult = statusResult.data;
            }
            
            // If status update failed, use the original result
            if (!updateResult) {
              updateResult = result2.data;
            }
          }
        } else {
          throw error;
        }
      }
      
      console.log('Update successful:', updateResult);
      
      // Force status update if needed - try this immediately after the main update
      if (shouldChangeToPending) {
        console.log('Forcing status update to pending immediately...');
        
        // Try updating with all fields including status to bypass constraint
        const { data: forceStatusData, error: forceStatusError } = await supabase
          .from('appointments')
          .update({ 
            status: 'pending',
            appointment_date: rescheduleDate.toISOString().split('T')[0],
            appointment_time: selectedTimeSlot,
            branch: selectedBranchForReschedule,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedAppointment.id)
          .select('id, status, appointment_date, appointment_time, branch');
        
        if (forceStatusError) {
          console.error('Force status update failed:', forceStatusError);
          console.error('Force status error details:', {
            message: forceStatusError.message,
            details: forceStatusError.details,
            hint: forceStatusError.hint,
            code: forceStatusError.code
          });
          
          // Try a different approach - update without status first, then try to update status
          console.log('Trying alternative approach - update without status first...');
          const { data: altUpdateData, error: altError } = await supabase
            .from('appointments')
            .update({
              appointment_date: rescheduleDate.toISOString().split('T')[0],
              appointment_time: selectedTimeSlot,
              branch: selectedBranchForReschedule,
              updated_at: new Date().toISOString()
            })
            .eq('id', selectedAppointment.id)
            .select('id, status, appointment_date, appointment_time, branch');
          
          if (altError) {
            console.error('Alternative update also failed:', altError);
          } else {
            console.log('Alternative update successful, now trying status update...');
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
          console.log('Force status update successful:', forceStatusData);
        }
      }
      
      // Wait a moment for database to process the update
      if (shouldChangeToPending) {
        console.log('Waiting for database to process status update...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      }
      
      // Verify the status was actually updated in the database
      if (shouldChangeToPending) {
        console.log('Verifying status update in database...');
        const { data: verifyData, error: verifyError } = await supabase
          .from('appointments')
          .select('id, status, appointment_date, appointment_time, branch')
          .eq('id', selectedAppointment.id)
          .single();
        
        if (verifyError) {
          console.error('Error verifying status update:', verifyError);
        } else {
          console.log('Database verification result:', verifyData);
          if (verifyData.status !== 'pending') {
            console.warn('Status was not updated to pending in database. Current status:', verifyData.status);
            console.log('Attempting final status update with explicit data...');
            
            // Try updating with explicit data and proper error handling
            const { data: finalUpdateData, error: finalStatusError } = await supabase
              .from('appointments')
              .update({ 
                status: 'pending',
                updated_at: new Date().toISOString()
              })
              .eq('id', selectedAppointment.id)
              .select('id, status, appointment_date, appointment_time, branch');
            
            if (finalStatusError) {
              console.error('Final status update failed:', finalStatusError);
              console.error('Final status error details:', {
                message: finalStatusError.message,
                details: finalStatusError.details,
                hint: finalStatusError.hint,
                code: finalStatusError.code
              });
              
              // Try one more time with just the status field
              console.log('Trying one more time with just status field...');
              const { data: simpleUpdateData, error: simpleError } = await supabase
                .from('appointments')
                .update({ status: 'pending' })
                .eq('id', selectedAppointment.id)
                .select('id, status');
              
              if (simpleError) {
                console.error('Simple status update also failed:', simpleError);
              } else {
                console.log('Simple status update successful:', simpleUpdateData);
              }
            } else {
              console.log('Final status update successful:', finalUpdateData);
            }
          } else {
            console.log('Status successfully updated to pending in database');
          }
        }
      }
      
      // If status change was needed but didn't work, try a separate update
      if (shouldChangeToPending && updateResult && updateResult[0] && updateResult[0].status !== 'pending') {
        console.log('Status change may have failed, attempting separate status update...');
        const { error: statusError } = await supabase
          .from('appointments')
          .update({ status: 'pending' })
          .eq('id', selectedAppointment.id);
        
        if (statusError) {
          console.warn('Status update failed, but appointment was rescheduled:', statusError);
        }
      }
      
      setAppointments(appointments.map(appointment => 
        appointment.id === selectedAppointment.id 
          ? { 
              ...appointment, 
              appointment_date: rescheduleDate.toISOString().split('T')[0], 
              appointment_time: selectedTimeSlot,
              branch: selectedBranchForReschedule,
              status: shouldChangeToPending ? 'pending' : appointment.status
            } 
          : appointment
      ));
      
      const statusMessage = shouldChangeToPending 
        ? 'Appointment rescheduled and status changed to pending for approval'
        : 'Appointment rescheduled successfully';
      
      toast.success(statusMessage);
      setIsRescheduling(false);
      setIsViewingDetails(false);
      
      // Reset reschedule states
      setRescheduleDate(null);
      setSelectedTimeSlot('');
      setSelectedBranchForReschedule('');
      setAvailableTimeSlots([]);
      
      // Wait a moment for all database updates to complete
      console.log('Waiting for all database updates to complete...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      // Refresh appointments to ensure UI shows latest data from database
      console.log('Refreshing appointments to get latest status from database...');
      await fetchAppointments();
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      console.error('Full error object:', error);
      console.error('Error stack:', error.stack);
      
      // Check if it's a specific "case not found" error
      if (error.message && error.message.includes('case not found')) {
        console.error('"Case not found" error detected - this might be a database constraint issue');
        toast.error('Database constraint error - please try again or contact support');
      } else {
        toast.error(`Failed to reschedule appointment: ${error.message}`);
      }
    }
  };

  const handleAssignDoctor = async () => {
    if (!selectedDoctorId) {
      toast.error('Please select a doctor');
      return;
    }

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          doctor_id: selectedDoctorId,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedAppointment.id);
      
      if (error) throw error;
      
      const doctor = doctors.find(d => d.id === selectedDoctorId);
      
      // Update the appointment in local state
      setAppointments(appointments.map(appointment => 
        appointment.id === selectedAppointment.id 
          ? { 
              ...appointment, 
              doctor_id: selectedDoctorId,
              doctorName: doctor?.full_name || 'Unknown',
              doctors: doctor ? { id: doctor.id, full_name: doctor.full_name } : null
            } 
          : appointment
      ));
      
      // Update the selected appointment for the modal
      setSelectedAppointment(prev => ({
        ...prev,
        doctor_id: selectedDoctorId,
        doctorName: doctor?.full_name || 'Unknown',
        doctors: doctor ? { id: doctor.id, full_name: doctor.full_name } : null
      }));
      
      toast.success(`Doctor ${doctor?.full_name} assigned successfully`);
      setIsAssigningDoctor(false);
    } catch (error) {
      console.error('Error assigning doctor:', error);
      toast.error('Failed to assign doctor');
    }
  };

  const handleUnassignDoctor = async (appointmentId) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          doctor_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);
      
      if (error) throw error;
      
      // Update the appointment in local state
      setAppointments(appointments.map(appointment => 
        appointment.id === appointmentId 
          ? { 
              ...appointment, 
              doctor_id: null,
              doctorName: null,
              doctors: null
            } 
          : appointment
      ));
      
      toast.success('Doctor unassigned successfully');
    } catch (error) {
      console.error('Error unassigning doctor:', error);
      toast.error('Failed to unassign doctor');
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

  const getStatusBadgeClass = (status) => {
    switch (status.toLowerCase()) {
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

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Appointment Management</h1>
            
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
          </div>
          <div className="flex space-x-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search appointments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 text-gray-500"
              title="Filter"
            >
              <FiFilter className="h-5 w-5" />
            </button>
            <button 
              onClick={fetchAppointments}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 text-gray-500"
              title="Refresh"
            >
              <FiRefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {isFilterOpen && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Advanced Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-1">
                  Branch
                </label>
                <select
                  id="branch"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All Branches</option>
                  <option value="Cabugao">Cabugao Branch</option>
                  <option value="San Juan">San Juan Branch</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="doctor" className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned Doctor
                </label>
                <select
                  id="doctor"
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All Doctors</option>
                  <option value="unassigned">Unassigned</option>
                  {doctors.map(doctor => (
                    <option key={doctor.id} value={doctor.id}>
                      Dr. {doctor.full_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="date-range" className="block text-sm font-medium text-gray-700 mb-1">
                  Date Range
                </label>
                <DatePicker
                  selectsRange={true}
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(update) => {
                    setDateRange(update);
                  }}
                  isClearable={true}
                  placeholderText="Select date range"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setSelectedBranch('');
                  setSelectedDoctor('');
                  setDateRange([null, null]);
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

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
              onClick={() => setActiveTab('confirmed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'confirmed'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Confirmed
            </button>
            <button
              onClick={() => setActiveTab('unassigned')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'unassigned'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Unassigned
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'completed'
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
              Cancelled
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'all'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Appointments
            </button>
          </nav>
        </div>
        
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
                  </div>
                  
                  {/* Doctor Assignment Section */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-700">Assigned Doctor:</span>
                        {selectedAppointment.doctorName ? (
                          <div className="mt-1 flex items-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Dr. {selectedAppointment.doctorName}
                            </span>
                            <button 
                              onClick={() => handleUnassignDoctor(selectedAppointment.id)}
                              className="ml-2 text-red-600 hover:text-red-700 text-sm"
                              title="Unassign Doctor"
                            >
                              <FiUserMinus className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mt-1">
                            Not assigned
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          setIsAssigningDoctor(true);
                          setSelectedDoctorId(selectedAppointment.doctor_id || '');
                        }} 
                        className="text-primary-600 hover:text-primary-700 text-sm px-3 py-1 border border-primary-300 rounded-md flex items-center"
                      >
                        <FiUserPlus className="mr-1 h-4 w-4" />
                        {selectedAppointment.doctorName ? 'Change Doctor' : 'Assign Doctor'}
                      </button>
                    </div>
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
                  )}
                  
                  {/* Reschedule Button (for any non-completed status) */}
                  {['pending', 'confirmed', 'rejected', 'cancelled'].includes(selectedAppointment.status) && (
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
                  
                  {/* Mark as Completed (for confirmed appointments) */}
                  {selectedAppointment.status === 'confirmed' && (
                    <button
                      onClick={() => {
                        handleUpdateStatus(selectedAppointment.id, 'completed');
                        setIsViewingDetails(false);
                      }}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      <FiCheck className="inline-block mr-1" /> Mark as Completed
                    </button>
                  )}
                  
                  {/* Cancel Button (for pending/confirmed appointments) */}
                  {['pending', 'confirmed'].includes(selectedAppointment.status) && (
                    <button
                      onClick={() => {
                        handleUpdateStatus(selectedAppointment.id, 'cancelled');
                        setIsViewingDetails(false);
                      }}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      <FiX className="inline-block mr-1" /> Cancel Appointment
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Assign Doctor Modal */}
        {isAssigningDoctor && selectedAppointment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  {selectedAppointment.doctorName ? 'Change Doctor Assignment' : 'Assign Doctor'}
                </h2>
                <button 
                  onClick={() => setIsAssigningDoctor(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-6">
                <p className="mb-2 text-sm text-gray-600">
                  <span className="font-medium">Patient:</span> {selectedAppointment.patientName}
                </p>
                <p className="mb-2 text-sm text-gray-600">
                  <span className="font-medium">Date & Time:</span> {formatDate(selectedAppointment.appointment_date)} at {formatTime(selectedAppointment.appointment_time)}
                </p>
                <p className="mb-4 text-sm text-gray-600">
                  <span className="font-medium">Branch:</span> {selectedAppointment.branch}
                </p>
                
                {selectedAppointment.doctorName && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-md">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">Currently assigned to:</span> Dr. {selectedAppointment.doctorName}
                    </p>
                  </div>
                )}
                
                <label htmlFor="doctor-select" className="block text-sm font-medium text-gray-700 mb-1">
                  Select Doctor
                </label>
                <select
                  id="doctor-select"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select a doctor</option>
                  {doctors.map(doctor => (
                    <option key={doctor.id} value={doctor.id}>
                      Dr. {doctor.full_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsAssigningDoctor(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignDoctor}
                  disabled={!selectedDoctorId}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:bg-primary-300"
                >
                  {selectedAppointment.doctorName ? 'Change Assignment' : 'Assign Doctor'}
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

        {/* Appointment List */}
        <div className="bg-white overflow-hidden border border-gray-200 rounded-lg">
          <div className="px-4 py-5 sm:px-6 bg-gray-50 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {activeTab === 'pending' ? 'Pending Appointments' : 
                activeTab === 'confirmed' ? 'Confirmed Appointments' :
                activeTab === 'completed' ? 'Completed Appointments' :
                activeTab === 'cancelled' ? 'Cancelled/Rejected Appointments' :
                activeTab === 'unassigned' ? 'Unassigned Appointments' : 'All Appointments'}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {filteredAppointments.length} appointments found
              </p>
            </div>
          </div>
          
          {filteredAppointments.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500">No appointments found matching your criteria.</p>
            </div>
          ) : activeTab === 'cancelled' ? (
            // Card view for cancelled/rejected appointments
            <div className="space-y-4 p-4">
              {filteredAppointments.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-500">No cancelled or rejected appointments found.</p>
                </div>
              ) : (
                filteredAppointments.map((appointment) => (
                <div 
                  key={appointment.id}
                  className="bg-white rounded-lg border border-gray-300 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-medium text-gray-800">{appointment.patientName}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadgeClass(appointment.status)}`}>
                          {appointment.status}
                        </span>
                        {appointment.is_emergency && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full flex items-center">
                            <FiAlertTriangle className="mr-1" />
                            Emergency
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center text-gray-600">
                            <FiCalendar className="mr-2 h-4 w-4" />
                            {new Date(appointment.appointment_date).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </div>
                          <div className="flex items-center text-gray-600">
                            <FiMapPin className="mr-2 h-4 w-4" />
                            {appointment.branch}
                          </div>
                          <div className="flex items-center text-gray-600">
                            <FiUser className="mr-2 h-4 w-4" />
                            {appointment.doctorName || 'Not assigned'}
                          </div>
                          <div className="flex items-center text-gray-600">
                            <FiMessageSquare className="mr-2 h-4 w-4" />
                            Services: {appointment.serviceNames && appointment.serviceNames.length > 0 ? 
                              appointment.serviceNames.join(', ') : 'None specified'}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center text-gray-600">
                            <FiClock className="mr-2 h-4 w-4" />
                            {formatTime(appointment.appointment_time)}
                          </div>
                          <div className="flex items-center text-gray-600">
                            <FiClock className="mr-2 h-4 w-4" />
                            Duration: {appointmentDurations[appointment.id] ? 
                              `${appointmentDurations[appointment.id]} minutes` : 
                              appointment.totalServiceDuration > 0 ? 
                                `${appointment.totalServiceDuration} minutes (based on services)` : 
                                'Duration not set'}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-4 flex flex-col space-y-2">
                      {/* Only show buttons for rejected appointments, not cancelled ones */}
                      {appointment.status === 'rejected' && (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                </div>
                ))
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Branch
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned Doctor
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAppointments.map((appointment) => (
                    <tr key={appointment.id} 
                      className={`hover:bg-gray-50 ${appointment.is_emergency ? 'bg-red-50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden border border-gray-200 shadow-sm">
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
                              <span className="font-medium text-sm">
                                {appointment.patientName?.charAt(0)?.toUpperCase() || 'P'}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {appointment.patientName}
                              {appointment.is_emergency && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                  <FiAlertTriangle className="mr-1" />
                                  Emergency
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {appointment.patients?.phone || 'No phone'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(appointment.appointment_date)}</div>
                        <div className="text-sm text-gray-500">{formatTime(appointment.appointment_time)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{appointment.branch}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {appointment.doctorName ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Dr. {appointment.doctorName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(appointment.status)}`}>
                          {appointment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setSelectedAppointment(appointment);
                              setIsViewingDetails(true);
                              // Log appointment view
                              logAppointmentView(appointment.id, appointment.patient_name, {
                                appointmentType: appointment.appointment_type,
                                branch: appointment.branch,
                                status: appointment.status
                              });
                            }}
                            className="text-primary-600 hover:text-primary-900"
                            title="View Details"
                          >
                            <FiClipboard className="h-5 w-5" />
                          </button>
                          
                          {/* Quick Assign Doctor Button */}
                          {!appointment.doctorName && ['pending', 'confirmed'].includes(appointment.status) && (
                            <button
                              onClick={() => {
                                setSelectedAppointment(appointment);
                                setSelectedDoctorId('');
                                setIsAssigningDoctor(true);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                              title="Assign Doctor"
                            >
                              <FiUserPlus className="h-5 w-5" />
                            </button>
                          )}
                          
                          {/* Quick Unassign Doctor Button */}
                          {appointment.doctorName && ['pending', 'confirmed'].includes(appointment.status) && (
                            <button
                              onClick={() => handleUnassignDoctor(appointment.id)}
                              className="text-orange-600 hover:text-orange-900"
                              title="Unassign Doctor"
                            >
                              <FiUserMinus className="h-5 w-5" />
                            </button>
                          )}
                          
                          {/* Approve/Reject for pending appointments */}
                          {appointment.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(appointment.id, 'confirmed')}
                                className="text-green-600 hover:text-green-900"
                                title="Approve"
                              >
                                <FiCheck className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(appointment.id, 'rejected')}
                                className="text-red-600 hover:text-red-900"
                                title="Reject"
                              >
                                <FiX className="h-5 w-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAppointments;