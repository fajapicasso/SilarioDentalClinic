// src/pages/patient/Appointments.jsx - Enhanced with Location-Based Branch Suggestion
import React, { useState, useEffect } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../config/supabaseClient';
import { toast } from 'react-toastify';
import { Formik, Form, Field, ErrorMessage } from 'formik';

import * as Yup from 'yup';

import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

import { 
  FiCalendar, FiClock, FiMapPin, FiUser, FiCheck, 
  FiX, FiEdit, FiTrash2, FiAlertTriangle, FiArrowLeft,
  FiBell, FiInfo, FiDownload, FiDollarSign, FiUsers,
  FiNavigation, FiTarget, FiGlobe
} from 'react-icons/fi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ScheduleService from '../../services/scheduleService';
import ScheduleUtils from '../../services/scheduleUtils';

// Debug: Make ScheduleService available in window for debugging
if (typeof window !== 'undefined') {
  window.ScheduleService = ScheduleService;
  console.log('✅ ScheduleService loaded and available in window.ScheduleService');
  console.log('🔧 Debug methods available:');
  console.log('  - window.ScheduleService.debugScheduleIssue(branch, date)');
  console.log('  - window.ScheduleService.debugMultiDoctorAvailability(branch, date, time)');
  console.log('📝 Examples:');
  console.log('  - window.ScheduleService.debugScheduleIssue("Cabugao", "2024-12-15")');
  console.log('  - window.ScheduleService.debugMultiDoctorAvailability("Cabugao", "2024-12-15", "10:00")');
}
import { useAppointmentNotifications } from '../../hooks/useNotificationIntegration';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

// Branch coordinates for distance calculation
const BRANCH_COORDINATES = {
  'Cabugao': {
    lat: 17.787353, // Approximate coordinates for Cabugao, Ilocos Sur
    lng: 120.428588,
    address: 'Cabugao, Ilocos Sur'
  },
  'San Juan': {
    lat: 17.741318, // Approximate coordinates for San Juan, Ilocos Sur  
    lng: 120.457377,
    address: 'San Juan, Ilocos Sur'
  }
};

// Validation schema
const appointmentSchema = Yup.object().shape({
  branch: Yup.string().required('Branch is required'),
  appointment_date: Yup.date()
    .required('Appointment date is required')
    .min((() => {
      // Get tomorrow's date at midnight (start of day)
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    })(), 'You cannot appoint for today. You should book appointments in advance (at least tomorrow)'),
  appointment_time: Yup.string().required('Appointment time is required'),
  service_id: Yup.array()
    .min(1, 'Please select at least one service')
    .required('Please select at least one service'),
  teeth_involved: Yup.string(),
  notes: Yup.string().max(500, 'Notes must be less than 500 characters'),
  is_emergency: Yup.boolean(),
  agree_terms: Yup.boolean()
    .oneOf([true], 'You must agree to the cancellation policy')
});

const PatientAppointments = () => {
  const { user } = useAuth();
  
  // Get notification functions from the hook
  const { createAppointment } = useAppointmentNotifications();
  
  // Get audit log functions
  const { logPageView, logAppointmentView, logAppointmentCreate, logAppointmentUpdate, logAppointmentCancel } = useUniversalAudit();
  
  const [isLoading, setIsLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showTimeSlots, setShowTimeSlots] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [formattedTimeSlots, setFormattedTimeSlots] = useState([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState(30);
  const [branchHours, setBranchHours] = useState(null);
  const [availableProviders, setAvailableProviders] = useState([]);
  const [serviceDurations, setServiceDurations] = useState({});
  const [filterStatus, setFilterStatus] = useState('upcoming');
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [setParentFormFieldValue, setSetParentFormFieldValue] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(''); // 'cancel', 'reschedule'
  const [selectedAppointmentForAction, setSelectedAppointmentForAction] = useState(null);
  
  // Reschedule modal states
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(null);
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState('');
  const [rescheduleBranch, setRescheduleBranch] = useState('');
  const [rescheduleAvailableTimeSlots, setRescheduleAvailableTimeSlots] = useState([]);
  const [appointmentDurations, setAppointmentDurations] = useState({});
  const [autoJoinQueue, setAutoJoinQueue] = useState(true);
  const [showQueueJoinOptions, setShowQueueJoinOptions] = useState(false);
  const [unavailableDates, setUnavailableDates] = useState(new Set());
  
  // Location-based branch suggestion states
  const [userLocation, setUserLocation] = useState(null);
  const [nearestBranch, setNearestBranch] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [branchDistances, setBranchDistances] = useState({});
  const [showLocationSuggestion, setShowLocationSuggestion] = useState(false);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const toRadians = (degrees) => degrees * (Math.PI / 180);
    
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance; // Distance in kilometers
  };

  // Get user's current location
  const getUserLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          }
        );
      });

      const { latitude, longitude } = position.coords;
      setUserLocation({ lat: latitude, lng: longitude });

      // Calculate distances to branches
      const distances = {};
      let closest = null;
      let minDistance = Infinity;

      Object.entries(BRANCH_COORDINATES).forEach(([branchName, coords]) => {
        const distance = calculateDistance(latitude, longitude, coords.lat, coords.lng);
        distances[branchName] = {
          distance: distance,
          distanceText: distance < 1 
            ? `${Math.round(distance * 1000)}m away`
            : `${distance.toFixed(1)}km away`
        };

        if (distance < minDistance) {
          minDistance = distance;
          closest = branchName;
        }
      });

      setBranchDistances(distances);
      setNearestBranch(closest);
      setShowLocationSuggestion(true);

      toast.success(`Found your location! ${closest} branch is nearest to you.`);
    } catch (error) {
      console.error('Error getting location:', error);
      
      let errorMessage = 'Unable to get your location';
      if (error.code === 1) {
        errorMessage = 'Location access denied. Please enable location services to get branch suggestions.';
      } else if (error.code === 2) {
        errorMessage = 'Location unavailable. Please check your GPS settings.';
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out. Please try again.';
      }
      
      setLocationError(errorMessage);
      toast.info(errorMessage);
    } finally {
      setLocationLoading(false);
    }
  };

  // Auto-suggest branch when form opens
  useEffect(() => {
    if (showForm && !editingAppointment && !userLocation && !locationError) {
      // Only try to get location if we haven't tried before and user is booking a new appointment
      getUserLocation();
    }
  }, [showForm, editingAppointment]);

  // Load unavailable dates when form opens
  useEffect(() => {
    if (showForm && !editingAppointment) {
      loadUnavailableDates();
    }
  }, [showForm, editingAppointment]);

  // Check if patient has existing appointment on a specific date
  const checkExistingAppointment = async (date) => {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('appointments')
        .select('id, appointment_time, status')
        .eq('patient_id', user.id)
        .eq('appointment_date', dateStr)
        .in('status', ['pending', 'confirmed']); // Only check active appointments
      
      if (error) {
        console.error('Error checking existing appointments:', error);
        return false; // Allow booking if check fails
      }
      
      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking existing appointments:', error);
      return false; // Allow booking if check fails
    }
  };

  // Load unavailable dates for the date picker
  const loadUnavailableDates = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('appointment_date')
        .eq('patient_id', user.id)
        .in('status', ['pending', 'confirmed']); // Only check active appointments
      
      if (error) {
        console.error('Error loading unavailable dates:', error);
        return;
      }
      
      const unavailableSet = new Set();
      if (data && data.length > 0) {
        data.forEach(appointment => {
          unavailableSet.add(appointment.appointment_date);
        });
      }
      
      console.log('Loaded unavailable dates:', Array.from(unavailableSet));
      setUnavailableDates(unavailableSet);
    } catch (error) {
      console.error('Error loading unavailable dates:', error);
    }
  };

  // Enhanced fetchAppointmentDurations function
  const fetchAppointmentDurations = async (appointmentIds) => {
    if (!appointmentIds || appointmentIds.length === 0) return {};
    
    try {
      const { data, error } = await supabase
        .from('appointment_durations')
        .select('*')
        .in('appointment_id', appointmentIds);
      
      if (error) {
        console.error('Error fetching durations:', error);
        return {};
      }
      
      if (!data || data.length === 0) return {};
      
      const durationsMap = {};
      data.forEach(record => {
        if (!durationsMap[record.appointment_id]) {
          durationsMap[record.appointment_id] = [];
        }
        durationsMap[record.appointment_id].push(record);
      });
      
      const result = {};
      Object.keys(durationsMap).forEach(appointmentId => {
        const sortedRecords = durationsMap[appointmentId].sort((a, b) => {
          const aDate = a.updated_at || a.created_at;
          const bDate = b.updated_at || b.created_at;
          return new Date(bDate) - new Date(aDate);
        });
        
        if (sortedRecords.length > 0) {
          result[appointmentId] = parseInt(sortedRecords[0].duration_minutes, 10);
        }
      });
      
      return result;
    } catch (err) {
      console.error('Error in fetchAppointmentDurations:', err);
      return {};
    }
  };

  const calculateEstimatedCost = (selectedServiceIds) => {
    if (!selectedServiceIds?.length) return 0;
    
    let totalPrice = 0;
    selectedServiceIds.forEach(serviceId => {
      const service = services.find(s => s.id === serviceId);
      if (service) {
        totalPrice += parseFloat(service.price) || 0;
      }
    });
    
    return totalPrice;
  };

  const getDurationSourceText = (appointmentId) => {
    if (appointmentDurations[appointmentId]) {
      return "(Set by doctor)";
    }
    return "(Based on services)";
  };

  // Function to clean up duplicate appointments automatically
  const cleanupDuplicateAppointments = async (showMessages = false) => {
    try {
      // Fetch all appointments for this patient
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('id, appointment_date, appointment_time, branch, created_at')
        .eq('patient_id', user.id)
        .eq('status', 'pending');
      
      if (appointmentsError) throw appointmentsError;
      
      // Get all appointment services
      const appointmentIds = appointmentsData.map(a => a.id);
      const { data: appointmentServicesData, error: servicesError } = await supabase
        .from('appointment_services')
        .select('appointment_id')
        .in('appointment_id', appointmentIds);
      
      if (servicesError) throw servicesError;
      
      // Create a set of appointment IDs that have services
      const appointmentsWithServices = new Set(
        appointmentServicesData.map(as => as.appointment_id)
      );
      
      // Group appointments by date, time, and branch
      const appointmentGroups = {};
      const duplicatesToRemove = [];
      
      appointmentsData.forEach(appointment => {
        const key = `${appointment.appointment_date}_${appointment.appointment_time}_${appointment.branch}`;
        if (!appointmentGroups[key]) {
          appointmentGroups[key] = [];
        }
        appointmentGroups[key].push(appointment);
      });
      
      // Find duplicates and keep the one with services, remove the one without
      Object.values(appointmentGroups).forEach(group => {
        if (group.length > 1) {
          // Find appointments with services in this group
          const appointmentsWithServicesInGroup = group.filter(appointment => 
            appointmentsWithServices.has(appointment.id)
          );
          
          if (appointmentsWithServicesInGroup.length > 0) {
            // Keep the appointment with services, remove others
            const appointmentWithServices = appointmentsWithServicesInGroup[0];
            group.forEach(appointment => {
              if (appointment.id !== appointmentWithServices.id) {
                duplicatesToRemove.push(appointment.id);
              }
            });
          } else {
            // If no appointment has services, keep the newest one
            group.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            group.slice(1).forEach(appointment => {
              duplicatesToRemove.push(appointment.id);
            });
          }
        }
      });
      
      // Remove duplicate appointments
      if (duplicatesToRemove.length > 0) {
        console.log('Cleaning up duplicate appointments:', duplicatesToRemove);
        
        // Remove associated services for duplicate appointments
        await supabase
          .from('appointment_services')
          .delete()
          .in('appointment_id', duplicatesToRemove);
        
        // Remove duplicate appointments
        await supabase
          .from('appointments')
          .delete()
          .in('id', duplicatesToRemove);
        
        if (showMessages) {
          toast.success(`Cleaned up ${duplicatesToRemove.length} duplicate appointment(s)`);
          refreshAppointments();
        }
        
        return duplicatesToRemove.length;
      } else {
        if (showMessages) {
          toast.info('No duplicate appointments found');
        }
        return 0;
      }
    } catch (error) {
      console.error('Error cleaning up duplicate appointments:', error);
      if (showMessages) {
        toast.error('Failed to clean up duplicates');
      }
      return 0;
    }
  };



  // Fetch appointments and services
  useEffect(() => {
    // Log page view
    logPageView('Patient Appointments', 'appointments', 'patient_management');
    
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch services
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('id, name, description, price, duration, category, image_url')
          .order('name');
        
        if (servicesError) throw servicesError;
        
        const servicesMap = {};
        servicesData.forEach(service => {
          servicesMap[service.id] = service;
        });
        
        setServices(servicesData);
        
        const durationMap = {};
        servicesData.forEach(service => {
          durationMap[service.id] = service.duration || 30;
        });
        setServiceDurations(durationMap);
        
        // Fetch appointments
        const { data: appointmentsData, error: appointmentsError } = await supabase
          .from('appointments')
          .select(`
            id, 
            appointment_date, 
            appointment_time, 
            status, 
            branch,
            teeth_involved,
            notes,
            is_emergency,
            created_at,
            doctor_id
          `)
          .eq('patient_id', user.id)
          .order('appointment_date', { ascending: false });
        
        if (appointmentsError) throw appointmentsError;
        
        // Auto-cleanup duplicates before processing (silent)
        await cleanupDuplicateAppointments(false);
        
        // Fetch appointments again after cleanup
        const { data: cleanedAppointmentsData, error: cleanedAppointmentsError } = await supabase
          .from('appointments')
          .select(`
            id, 
            appointment_date, 
            appointment_time, 
            status, 
            branch,
            teeth_involved,
            notes,
            is_emergency,
            created_at,
            doctor_id
          `)
          .eq('patient_id', user.id)
          .order('appointment_date', { ascending: false });
        
        if (cleanedAppointmentsError) throw cleanedAppointmentsError;
        
        const appointmentIds = cleanedAppointmentsData.map(a => a.id);
        const doctorSetDurations = await fetchAppointmentDurations(appointmentIds);
        setAppointmentDurations(doctorSetDurations);
        
        // Fetch doctor information for assigned doctors
        const doctorIds = [...new Set(cleanedAppointmentsData.map(a => a.doctor_id).filter(Boolean))];
        let doctorMap = {};
        if (doctorIds.length > 0) {
          const { data: doctorData, error: doctorError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', doctorIds)
            .eq('role', 'doctor');
          
          if (!doctorError && doctorData) {
            doctorData.forEach(doctor => {
              doctorMap[doctor.id] = doctor;
            });
          }
        }
        
        // Fetch appointment services
        const { data: appointmentServicesData, error: appointmentServicesError } = await supabase
          .from('appointment_services')
          .select('id, appointment_id, service_id')
          .in('appointment_id', appointmentIds);
        
        if (appointmentServicesError) {
          console.error('Error fetching appointment services:', appointmentServicesError);
        }
        
        // Combine data
        const formattedAppointments = cleanedAppointmentsData.map(appointment => {
          const appointmentServices = appointmentServicesData?.filter(
            as => as.appointment_id === appointment.id
          ) || [];
          
          const serviceObjects = appointmentServices.map(as => {
            const service = servicesMap[as.service_id];
            return service || null;
          }).filter(Boolean);
          
          const serviceIds = serviceObjects.map(s => s.id);
          const serviceNames = serviceObjects.map(s => s.name);
          
          const calculatedDuration = serviceObjects.reduce(
            (total, s) => total + (s.duration || 30), 
            0
          ) || 30;
          
          const finalDuration = doctorSetDurations[appointment.id] || calculatedDuration;
          
          // Get doctor information
          const assignedDoctor = appointment.doctor_id ? doctorMap[appointment.doctor_id] : null;
          
          return {
            ...appointment,
            serviceIds,
            serviceNames,
            duration: finalDuration,
            assignedDoctor
          };
        });
        
        setAppointments(formattedAppointments);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load appointments data');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user) {
      fetchData();
    }
  }, [user]);

  // Filter appointments
  useEffect(() => {
    if (!appointments.length) {
      setFilteredAppointments([]);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered;
    switch (filterStatus) {
      case 'today':
        filtered = appointments.filter(appointment => {
          const appointmentDate = new Date(appointment.appointment_date);
          const todayDate = new Date();
          return appointmentDate.toDateString() === todayDate.toDateString();
        });
        break;
      case 'upcoming':
        filtered = appointments.filter(appointment => {
          const appointmentDate = new Date(appointment.appointment_date);
          return appointmentDate >= today && 
                appointment.status !== 'cancelled' && 
                appointment.status !== 'completed' &&
                appointment.status !== 'rejected';
        });
        break;
      case 'completed':
        filtered = appointments.filter(appointment => {
          return appointment.status === 'completed';
        });
        break;
      case 'cancelled':
        filtered = appointments.filter(appointment => {
          return appointment.status === 'cancelled';
        });
        break;
      case 'rejected':
        filtered = appointments.filter(appointment => {
          return appointment.status === 'rejected';
        });
        break;
      default:
        filtered = [...appointments];
        break;
    }

    setFilteredAppointments(filtered);
  }, [appointments, filterStatus]);

  // Auto-refresh time slots every 30 seconds when time slots are visible
  useEffect(() => {
    if (!showTimeSlots || !selectedDate || !selectedBranch) return;

    const interval = setInterval(async () => {
      console.log('🔄 Auto-refreshing time slots...');
      await fetchAvailableTimeSlots(selectedDate, selectedBranch, estimatedDuration);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [showTimeSlots, selectedDate, selectedBranch, estimatedDuration]);

  // Debug reschedule state
  useEffect(() => {
    if (isRescheduling) {
      console.log('Reschedule modal state changed:', {
        isRescheduling,
        selectedAppointmentForAction,
        rescheduleDate,
        rescheduleBranch,
        rescheduleTimeSlot
      });
    }
  }, [isRescheduling, selectedAppointmentForAction, rescheduleDate, rescheduleBranch, rescheduleTimeSlot]);

  const calculateAppointmentDuration = (selectedServiceIds) => {
    if (!selectedServiceIds || selectedServiceIds.length === 0) return 30;
    
    let totalDuration = 0;
    selectedServiceIds.forEach(serviceId => {
      totalDuration += serviceDurations[serviceId] || 30;
    });
    
    return Math.max(totalDuration, 30);
  };

  // Enhanced time slot fetching with queue awareness
  // Enhanced time slot fetching with schedule integration
  const fetchAvailableTimeSlots = async (date, branch, durationMinutes = 30) => {
    if (!date || !branch) return;
    
    console.log('🔍 fetchAvailableTimeSlots called with:', { date, branch, durationMinutes });
    
    const formattedDate = date.toISOString().split('T')[0];
    
    localStorage.setItem('temp_selected_branch', branch);
    localStorage.setItem('temp_selected_date', formattedDate);
    
    try {
      console.log('📞 Calling ScheduleService methods...');
      
      // Check if ScheduleService is available
      if (!ScheduleService) {
        throw new Error('ScheduleService is not available');
      }
      
      console.log('✅ ScheduleService is available, making calls...');
      
      // Get branch hours and available providers
      const [hoursResult, providersResult, slotsResult] = await Promise.all([
        ScheduleService.getBranchHours(branch, formattedDate, null), // null = show all doctors
        ScheduleService.getAvailableProviders(branch, formattedDate, '08:00'),
        ScheduleService.getAvailableTimeSlots(branch, formattedDate, durationMinutes, null) // null = show all doctors and all appointments
      ]);
      
      console.log('📊 ScheduleService results:', {
        hoursResult,
        providersCount: providersResult?.length || 0,
        slotsCount: slotsResult?.availableSlots?.length || 0,
        slotsMessage: slotsResult?.message
      });
      
      setBranchHours(hoursResult);
      setAvailableProviders(providersResult);
      
      if (slotsResult.message) {
        console.log('ℹ️ Schedule service message:', slotsResult.message);
        toast.info(slotsResult.message);
      }
      
      // ONLY use doctor-configured schedules - no hardcoded fallbacks
      setAvailableTimeSlots(slotsResult.availableSlots);
      setFormattedTimeSlots(slotsResult.formattedSlots);
      
      console.log('✅ Time slots updated successfully');
      
      // Show appropriate message if no slots available
      if (slotsResult.availableSlots.length === 0 && slotsResult.message) {
        // The message from schedule service explains why no slots are available
        console.log('No appointment slots available:', slotsResult.message);
      }
      
    } catch (error) {
      console.error('❌ Error fetching available time slots:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      // Check if this is a database schema issue
      const isDatabaseError = error.message?.includes('column') || 
                             error.code === '42703';
      
      if (isDatabaseError) {
        console.warn('Database schema issue detected:', error.message);
        toast.error('Schedule system needs database setup. Please contact administrator to run the SQL migration scripts.');
        setAvailableTimeSlots([]);
        setFormattedTimeSlots([]);
        setBranchHours(null);
        setAvailableProviders([]);
        return;
      }
      
      // Show specific error message to help with debugging
      let errorMessage = 'Error loading available time slots.';
      
      if (error.message?.includes('schedule')) {
        errorMessage = 'No doctor schedules configured. Doctors need to set up their working hours in Settings.';
      } else if (error.message?.includes('provider')) {
        errorMessage = 'No healthcare providers available. Please contact the clinic.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      toast.error(errorMessage);
      console.log('🔧 To debug this issue, run the schedule diagnostic tool in console');
      
      setAvailableTimeSlots([]);
      setFormattedTimeSlots([]);
      setBranchHours(null);
      setAvailableProviders([]);
    }
  };

  const calculateEndTime = (startTimeStr, durationMinutes) => {
    if (!startTimeStr) return '';
    
    const [hours, minutes] = startTimeStr.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + durationMinutes;
    
    const endHour = Math.floor(endMinutes / 60);
    const endMinute = endMinutes % 60;
    
    return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  };

  // Fallback time slot generation (original hardcoded logic)
  const generateFallbackTimeSlots = async (date, branch, durationMinutes = 30) => {
    try {
      const formattedDate = date.toISOString().split('T')[0];
      
      // Get branch working hours (hardcoded original logic)
      let startHour, endHour, interval = 30;
      
      if (branch === 'Cabugao') {
        const dayOfWeek = date.getDay();
        
        if (dayOfWeek === 0) { // Sunday
          return { availableSlots: [], formattedSlots: [] };
        } else if (dayOfWeek === 6) { // Saturday
          startHour = 8;
          endHour = 17;
        } else { // Monday-Friday
          startHour = 8;
          endHour = 12;
        }
      } else if (branch === 'San Juan') {
        const dayOfWeek = date.getDay();
        
        if (dayOfWeek === 6) { // Saturday
          return { availableSlots: [], formattedSlots: [] };
        } else if (dayOfWeek === 0) { // Sunday
          startHour = 8;
          endHour = 17;
        } else { // Monday-Friday
          startHour = 13;
          endHour = 17;
        }
      }

      // Get existing appointments
      const { data: bookedAppointments, error } = await supabase
        .from('appointments')
        .select('appointment_time')
        .eq('appointment_date', formattedDate)
        .eq('branch', branch)
        .neq('status', 'cancelled');
      
      if (error) throw error;
      
      const bookedTimes = new Set(bookedAppointments.map(apt => apt.appointment_time));

      // Generate time slots
      const availableSlots = [];
      const formattedSlots = [];
      
      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += interval) {
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          
          // Check if this slot would fit within working hours
          const endTimeMinutes = (hour * 60 + minute) + durationMinutes;
          const slotEndHour = Math.floor(endTimeMinutes / 60);
          
          if (slotEndHour > endHour) continue;
          
          const isAvailable = !bookedTimes.has(timeString);
          
          if (isAvailable) {
            availableSlots.push(timeString);
          }
          
          formattedSlots.push({
            time: timeString,
            available: isAvailable,
            displayTime: formatTime(timeString),
            endTime: formatTime(calculateEndTime(timeString, durationMinutes)),
            providersCount: isAvailable ? 1 : 0
          });
        }
      }
      
      return { availableSlots, formattedSlots };
      
    } catch (error) {
      console.error('Error in fallback time slot generation:', error);
      return { availableSlots: [], formattedSlots: [] };
    }
  };

  // Enhanced booking with notification integration
  const handleBooking = async (values, { resetForm, setSubmitting }) => {
    try {
      // Prevent double submission
      setSubmitting(true);
      
      // Validate availability using schedule service
      const isAvailable = await ScheduleService.isTimeSlotAvailable(
        values.branch, 
        values.appointment_date.toISOString().split('T')[0], 
        values.appointment_time, 
        calculateAppointmentDuration(values.service_id)
      );
      
      if (!isAvailable) {
        toast.error('This time slot is no longer available. Please select another time.');
        setSubmitting(false);
        return;
      }
      
      const duration = calculateAppointmentDuration(values.service_id);
      
      const appointmentData = {
        patient_id: user.id,
        branch: values.branch,
        appointment_date: values.appointment_date.toISOString().split('T')[0],
        appointment_time: values.appointment_time,
        teeth_involved: values.teeth_involved || '',
        notes: values.notes || '',
        is_emergency: values.is_emergency || false,
        status: editingAppointment && editingAppointment.status === 'rejected' ? 'pending' : 'pending',
        created_at: new Date().toISOString(),
      };

      let appointmentId;
      
      if (editingAppointment) {
        // Update existing appointment
        const { data, error } = await supabase
          .from('appointments')
          .update(appointmentData)
          .eq('id', editingAppointment.id)
          .select('id');
        
        if (error) throw error;
        appointmentId = editingAppointment.id;
        
        // Delete existing service associations
        await supabase
          .from('appointment_services')
          .delete()
          .eq('appointment_id', appointmentId);
        
        const successMessage = editingAppointment.status === 'rejected' 
          ? 'Appointment rescheduled and status changed to pending for approval!'
          : 'Appointment updated successfully!';
        toast.success(successMessage);
      } else {
        // First, clean up any existing duplicates for this patient
        await cleanupDuplicateAppointments(false);
        
        // Check for existing appointment on the same date (one appointment per day rule)
        const { data: existingAppointments, error: checkError } = await supabase
          .from('appointments')
          .select('id, appointment_time, status')
          .eq('patient_id', user.id)
          .eq('appointment_date', appointmentData.appointment_date)
          .in('status', ['pending', 'confirmed']); // Only check active appointments
        
        if (checkError) throw checkError;
        
        if (existingAppointments && existingAppointments.length > 0) {
          const existingAppointment = existingAppointments[0];
          toast.error(`You already have an appointment scheduled for ${formatDate(appointmentData.appointment_date)} at ${formatTime(existingAppointment.appointment_time)}. You can only have one appointment per day. Please choose a different date.`);
          setSubmitting(false);
          return;
        }
        
        // Insert new appointment
        const { data, error } = await supabase
          .from('appointments')
          .insert(appointmentData)
          .select('id');
        
        if (error) throw error;
        appointmentId = data[0].id;
        
        // Log audit event for appointment creation
        try {
          await logAppointmentCreate({
            id: appointmentId,
            patient_id: user.id,
            patient_name: user.user_metadata?.full_name || user.email,
            doctor_id: values.doctor_id,
            branch: values.branch,
            appointment_date: values.appointment_date.toISOString().split('T')[0],
            appointment_time: values.appointment_time,
            service_id: values.service_id,
            notes: values.notes,
            is_emergency: values.is_emergency || false,
            status: 'pending'
          });
        } catch (auditError) {
          console.error('Error logging appointment creation audit event:', auditError);
          // Continue even if audit logging fails
        }
        
        // Send notification for new appointment if createAppointment function is available
        if (createAppointment && typeof createAppointment === 'function') {
          try {
            const notificationResult = await createAppointment({
              patientId: user.id,
              appointmentId: appointmentId,
              date: values.appointment_date.toISOString().split('T')[0],
              time: values.appointment_time,
              branch: values.branch,
              notes: values.notes || '',
              services: values.service_id,
              isEmergency: values.is_emergency || false
            });
            
            if (notificationResult?.success) {
              toast.success('Appointment booked successfully - notified!');
            } else {
              toast.success('Appointment booked successfully!');
            }
          } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            toast.success('Appointment booked successfully! (Notification may have failed)');
          }
        } else {
          toast.success('Appointment booked successfully!');
        }
      }

      // Insert appointment services
      if (values.service_id && values.service_id.length > 0) {
        const serviceAssociations = values.service_id.map(serviceId => ({
          appointment_id: appointmentId,
          service_id: serviceId,
        }));

        const { error: serviceError } = await supabase
          .from('appointment_services')
          .insert(serviceAssociations);
        
        if (serviceError) {
          console.error('Error inserting appointment services:', serviceError);
          // If services fail to insert, clean up the appointment
          if (!editingAppointment) {
            await supabase
              .from('appointments')
              .delete()
              .eq('id', appointmentId);
            throw new Error('Failed to associate services with appointment');
          }
        }
      }

      // Refresh time slots after successful booking to show updated availability
      if (!editingAppointment && selectedDate && selectedBranch) {
        console.log('🔄 Refreshing time slots after booking...');
        await fetchAvailableTimeSlots(selectedDate, selectedBranch, estimatedDuration);
      }

      // Immediately clean up any duplicates that might have been created
      await cleanupDuplicateAppointments(false);

      // Check if appointment is for today and auto-join queue if confirmed
      const appointmentDate = values.appointment_date.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      
      if (appointmentDate === today && autoJoinQueue) {
        setShowQueueJoinOptions(true);
        localStorage.setItem('pending_queue_appointment', appointmentId);
      }

      // Clean up
      localStorage.removeItem('temp_selected_branch');
      localStorage.removeItem('temp_selected_date');
      localStorage.removeItem('temp_selected_time');
      localStorage.removeItem('temp_form_values');

      resetForm();
      setShowForm(false);
      setShowTimeSlots(false);
      setEditingAppointment(null);
      
      // Refresh appointments
      refreshAppointments();
    } catch (error) {
      console.error('Error booking appointment:', error);
      toast.error(error.message || 'Failed to book appointment');
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-join queue after appointment confirmation
  const handleQueueJoin = async (shouldJoin) => {
    const appointmentId = localStorage.getItem('pending_queue_appointment');
    
    if (shouldJoin && appointmentId) {
      try {
        // Get next queue number
        const { data: maxQueue, error: maxQueueError } = await supabase
          .from('queue')
          .select('queue_number')
          .order('queue_number', { ascending: false })
          .limit(1);
        
        if (maxQueueError) throw maxQueueError;
        
        const nextQueueNumber = maxQueue && maxQueue.length > 0 ? maxQueue[0].queue_number + 1 : 1;
        
        const queueData = {
          patient_id: user.id,
          appointment_id: appointmentId,
          queue_number: nextQueueNumber,
          status: 'waiting',
          estimated_wait_time: 15,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('queue')
          .insert([queueData]);
        
        if (error) throw error;
        
        toast.success(`Successfully joined the queue! Your number is ${nextQueueNumber}`);
      } catch (error) {
        console.error('Error joining queue:', error);
        toast.error('Failed to join queue: ' + error.message);
      }
    }
    
    localStorage.removeItem('pending_queue_appointment');
    setShowQueueJoinOptions(false);
  };

  const refreshAppointments = async () => {
    try {
      // First, clean up any duplicates automatically
      await cleanupDuplicateAppointments(false);
      
      // Then fetch the cleaned appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id, 
          appointment_date, 
          appointment_time, 
          status, 
          branch,
          teeth_involved,
          notes,
          is_emergency,
          created_at,
          doctor_id
        `)
        .eq('patient_id', user.id)
        .order('appointment_date', { ascending: false });
      
      if (appointmentsError) throw appointmentsError;
      
      const appointmentIds = appointmentsData.map(a => a.id);
      const doctorSetDurations = await fetchAppointmentDurations(appointmentIds);
      setAppointmentDurations(doctorSetDurations);
      
      // Fetch doctor information for assigned doctors
      const doctorIds = [...new Set(appointmentsData.map(a => a.doctor_id).filter(Boolean))];
      let doctorMap = {};
      if (doctorIds.length > 0) {
        const { data: doctorData, error: doctorError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', doctorIds)
          .eq('role', 'doctor');
        
        if (!doctorError && doctorData) {
          doctorData.forEach(doctor => {
            doctorMap[doctor.id] = doctor;
          });
        }
      }
      
      const { data: appointmentServicesData, error: appointmentServicesError } = await supabase
        .from('appointment_services')
        .select('id, appointment_id, service_id')
        .in('appointment_id', appointmentIds);
      
      if (appointmentServicesError) {
        console.error('Error fetching appointment services:', appointmentServicesError);
      }
      
      const formattedAppointments = appointmentsData.map(appointment => {
        const appointmentServices = appointmentServicesData?.filter(
          as => as.appointment_id === appointment.id
        ) || [];
        
        const serviceIds = [];
        const serviceNames = [];
        
        let calculatedDuration = 0;
        
        if (appointmentServices.length > 0) {
          appointmentServices.forEach(as => {
            const service = services.find(s => s.id === as.service_id);
            if (service) {
              serviceIds.push(service.id);
              serviceNames.push(service.name);
              calculatedDuration += (service.duration || 30);
            }
          });
        }
        
        // Ensure minimum duration of 30 minutes
        calculatedDuration = Math.max(calculatedDuration, 30);
        
        const finalDuration = doctorSetDurations[appointment.id] || Math.max(calculatedDuration, 30);
        
        // Get doctor information
        const assignedDoctor = appointment.doctor_id ? doctorMap[appointment.doctor_id] : null;
        
        return {
          ...appointment,
          serviceIds,
          serviceNames,
          duration: finalDuration,
          assignedDoctor
        };
      });
      
      setAppointments(formattedAppointments);
    } catch (error) {
      console.error('Error refreshing appointments:', error);
      toast.error('Failed to refresh appointments');
    }
  };

  // Enhanced edit function with branch change support
  const handleEditAppointment = async (appointment) => {
    // Clean up any duplicates before editing
    await cleanupDuplicateAppointments(false);
    
    setEditingAppointment(appointment);
    setShowForm(true);
    setShowTimeSlots(false);
    
    const dateParts = appointment.appointment_date.split('-');
    const date = new Date(
      parseInt(dateParts[0]), 
      parseInt(dateParts[1]) - 1, 
      parseInt(dateParts[2])
    );
    
    setSelectedDate(date);
    setSelectedBranch(appointment.branch);
    
    const duration = appointment.duration || calculateAppointmentDuration(appointment.serviceIds);
    setEstimatedDuration(duration);
    
    fetchAvailableTimeSlots(date, appointment.branch, duration);
  };

  // Unified cancel/reschedule modal
  const openActionModal = (appointment, type) => {
    console.log('Opening action modal:', { appointment, type });
    setSelectedAppointmentForAction(appointment);
    setActionType(type);
    setShowActionModal(true);
  };

  const handleAppointmentAction = async () => {
    if (!selectedAppointmentForAction) return;
    
    try {
      if (actionType === 'cancel') {
        const { error } = await supabase
          .from('appointments')
          .update({ status: 'cancelled' })
          .eq('id', selectedAppointmentForAction.id)
          .eq('patient_id', user.id);
        
        if (error) throw error;
        
        setAppointments(appointments.map(appointment => 
          appointment.id === selectedAppointmentForAction.id 
            ? { ...appointment, status: 'cancelled' } 
            : appointment
        ));
        
        // Refresh unavailable dates to allow rebooking
        await loadUnavailableDates();
        
        toast.success('Appointment cancelled successfully. You can now book a new appointment for any date.');
        
        // Clean up any duplicates after cancellation
        await cleanupDuplicateAppointments(false);
        refreshAppointments();
        
        // Close modal after successful cancellation
        setShowActionModal(false);
        setSelectedAppointmentForAction(null);
        setActionType('');
      } else if (actionType === 'reschedule') {
        // Start reschedule process with proper modal
        console.log('Starting reschedule process for appointment:', selectedAppointmentForAction);
        
        // Reset all reschedule states first
        setRescheduleDate(null);
        setRescheduleBranch('');
        setRescheduleTimeSlot('');
        setRescheduleAvailableTimeSlots([]);
        
        // Set initial values
        const initialDate = new Date(selectedAppointmentForAction.appointment_date);
        const initialBranch = selectedAppointmentForAction.branch;
        
        setIsRescheduling(true);
        setRescheduleDate(initialDate);
        setRescheduleBranch(initialBranch);
        
        // Fetch available time slots for the current date and branch
        const duration = selectedAppointmentForAction.duration || 30;
        console.log('Fetching time slots for reschedule:', {
          date: selectedAppointmentForAction.appointment_date,
          branch: initialBranch,
          duration: duration
        });
        fetchRescheduleTimeSlots(initialDate, initialBranch, duration);
        
        // Close the action modal and open reschedule modal
        setShowActionModal(false);
      }
    } catch (error) {
      console.error('Error handling appointment action:', error);
      toast.error(`Failed to ${actionType} appointment: ${error.message}`);
      setShowActionModal(false);
      setSelectedAppointmentForAction(null);
      setActionType('');
    }
  };

  const handleServiceChange = (selectedServices, setFieldValue) => {
    const duration = calculateAppointmentDuration(selectedServices);
    setEstimatedDuration(duration);
    
    if (selectedDate && selectedBranch) {
      fetchAvailableTimeSlots(selectedDate, selectedBranch, duration);
    }
    
    setFieldValue('service_id', selectedServices);
  };

  // Fetch time slots for reschedule modal
  const fetchRescheduleTimeSlots = async (date, branch, duration) => {
    if (!date || !branch) return;
    
    try {
      console.log('Fetching reschedule time slots for:', { date, branch, duration });
      
      const result = await ScheduleService.getAvailableTimeSlots(
        branch,
        date.toISOString().split('T')[0],
        duration,
        null
      );
      
      if (result && result.formattedSlots) {
        setRescheduleAvailableTimeSlots(result.formattedSlots);
        console.log('Reschedule time slots loaded:', result.formattedSlots.length);
      } else {
        setRescheduleAvailableTimeSlots([]);
        console.log('No reschedule time slots available');
      }
    } catch (error) {
      console.error('Error fetching reschedule time slots:', error);
      setRescheduleAvailableTimeSlots([]);
      toast.error('Failed to load available time slots');
    }
  };

  // Patient reschedule function
  const handlePatientReschedule = async () => {
    if (!rescheduleDate || !rescheduleTimeSlot || !rescheduleBranch) {
      toast.error('Please select a date, time, and branch');
      return;
    }

    if (!selectedAppointmentForAction || !selectedAppointmentForAction.id) {
      toast.error('No appointment selected for rescheduling');
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

    try {
      console.log('Patient rescheduling appointment:', {
        appointmentId: selectedAppointmentForAction.id,
        newDate: rescheduleDate.toISOString().split('T')[0],
        newTime: rescheduleTimeSlot,
        newBranch: rescheduleBranch,
        currentStatus: selectedAppointmentForAction.status
      });

      // First, verify the appointment exists and belongs to the patient
      console.log('Verifying appointment ownership...');
      const { data: existingAppointment, error: fetchError } = await supabase
        .from('appointments')
        .select('id, patient_id, status, appointment_date, appointment_time, branch')
        .eq('id', selectedAppointmentForAction.id)
        .eq('patient_id', user.id)
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
        .eq('appointment_date', rescheduleDate.toISOString().split('T')[0])
        .eq('appointment_time', rescheduleTimeSlot)
        .eq('branch', rescheduleBranch)
        .neq('id', selectedAppointmentForAction.id)
        .in('status', ['pending', 'confirmed']);
      
      if (conflictError) {
        console.error('Error checking for conflicts:', conflictError);
        throw new Error(`Failed to check availability: ${conflictError.message}`);
      }
      
      if (conflictingAppointments && conflictingAppointments.length > 0) {
        toast.error('This time slot is already taken. Please select another time.');
        return;
      }

      // Determine if we need to change status to pending for rejected/cancelled appointments
      const shouldChangeToPending = ['rejected', 'cancelled'].includes(selectedAppointmentForAction.status);
      
      // Start with basic fields
      const updateData = { 
        appointment_date: rescheduleDate.toISOString().split('T')[0], 
        appointment_time: rescheduleTimeSlot,
        branch: rescheduleBranch
      };
      
      // Add status change if needed
      if (shouldChangeToPending) {
        updateData.status = 'pending';
        updateData.updated_at = new Date().toISOString();
        console.log('Adding status change to pending for rejected appointment');
      }
      
      console.log('Should change to pending:', shouldChangeToPending);
      console.log('Original status:', selectedAppointmentForAction.status);
      
      console.log('Updating appointment with data:', updateData);
      console.log('Appointment ID:', selectedAppointmentForAction.id);
      console.log('Patient ID:', user.id);
      
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
      
      // Try to update the appointment
      let updateResult, error;
      
      try {
        const result = await supabase
          .from('appointments')
          .update(updateData)
          .eq('id', selectedAppointmentForAction.id)
          .eq('patient_id', user.id)
          .select('id, status, appointment_date, appointment_time, branch');
        
        updateResult = result.data;
        error = result.error;
      } catch (dbError) {
        console.error('Database connection error:', dbError);
        throw new Error(`Database connection failed: ${dbError.message}`);
      }
      
      if (error) {
        console.error('Database update error:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        // Try a different approach - update without status first
        console.log('Trying update without status change...');
        
        // Remove status from updateData for the fallback attempt
        const { status, ...dataWithoutStatus } = updateData;
        
        const result2 = await supabase
          .from('appointments')
          .update(dataWithoutStatus)
          .eq('id', selectedAppointmentForAction.id)
          .eq('patient_id', user.id)
          .select('id, status, appointment_date, appointment_time, branch');
        
        if (result2.error) {
          console.error('Second update attempt also failed:', result2.error);
          throw error; // Throw original error
        } else {
          console.log('Update without status succeeded, now updating status if needed...');
          
          // Now try to update status separately if needed
          if (shouldChangeToPending) {
            console.log('Attempting to update status to pending...');
            
            // Try updating with all fields including status to bypass constraint
            const statusResult = await supabase
              .from('appointments')
              .update({ 
                status: 'pending',
                appointment_date: rescheduleDate.toISOString().split('T')[0],
                appointment_time: rescheduleTimeSlot,
                branch: rescheduleBranch,
                updated_at: new Date().toISOString()
              })
              .eq('id', selectedAppointmentForAction.id)
              .eq('patient_id', user.id)
              .select('id, status, appointment_date, appointment_time, branch');
            
            if (statusResult.error) {
              console.warn('Status update failed, but appointment was rescheduled:', statusResult.error);
              console.error('Status update error details:', {
                message: statusResult.error.message,
                details: statusResult.error.details,
                hint: statusResult.error.hint,
                code: statusResult.error.code
              });
              
              // Try alternative approach - update without status first
              console.log('Trying alternative approach for status update...');
              const altResult = await supabase
                .from('appointments')
                .update({
                  appointment_date: rescheduleDate.toISOString().split('T')[0],
                  appointment_time: rescheduleTimeSlot,
                  branch: rescheduleBranch,
                  updated_at: new Date().toISOString()
                })
                .eq('id', selectedAppointmentForAction.id)
                .eq('patient_id', user.id)
                .select('id, status, appointment_date, appointment_time, branch');
              
              if (altResult.error) {
                console.error('Alternative update failed:', altResult.error);
              } else {
                console.log('Alternative update successful, trying status update...');
                // Now try to update just the status
                const finalStatusResult = await supabase
                  .from('appointments')
                  .update({ status: 'pending' })
                  .eq('id', selectedAppointmentForAction.id)
                  .eq('patient_id', user.id)
                  .select('id, status');
                
                if (finalStatusResult.error) {
                  console.error('Final status update failed:', finalStatusResult.error);
                } else {
                  console.log('Final status update successful:', finalStatusResult.data);
                  updateResult = finalStatusResult.data;
                }
              }
            } else {
              console.log('Status updated to pending successfully:', statusResult.data);
              // Update the result with the new status
              if (statusResult.data && statusResult.data[0]) {
                updateResult = statusResult.data;
              }
            }
          }
          
          // Only use result2.data if we didn't update the status
          if (!shouldChangeToPending || !updateResult) {
            updateResult = result2.data;
          }
        }
      }
      
      console.log('Update successful:', updateResult);
      
      // Update local state with the actual updated status from database
      const updatedStatus = shouldChangeToPending ? 'pending' : updateResult[0]?.status || selectedAppointmentForAction.status;
      
      console.log('Final status update:', {
        shouldChangeToPending,
        updateResult: updateResult[0],
        updatedStatus,
        originalStatus: selectedAppointmentForAction.status
      });
      
      setAppointments(appointments.map(appointment => 
        appointment.id === selectedAppointmentForAction.id 
          ? { 
              ...appointment, 
              appointment_date: rescheduleDate.toISOString().split('T')[0], 
              appointment_time: rescheduleTimeSlot,
              branch: rescheduleBranch,
              status: updatedStatus
            } 
          : appointment
      ));
      
      const statusMessage = shouldChangeToPending 
        ? 'Appointment rescheduled and status changed to pending for approval!'
        : 'Appointment rescheduled successfully!';
      
      toast.success(statusMessage);
      
      // Refresh unavailable dates after rescheduling
      await loadUnavailableDates();
      
      setIsRescheduling(false);
      setShowActionModal(false);
      setSelectedAppointmentForAction(null);
      setActionType('');
      
      // Reset reschedule states
      setRescheduleDate(null);
      setRescheduleTimeSlot('');
      setRescheduleBranch('');
      setRescheduleAvailableTimeSlots([]);
      
      // Refresh appointments to get the latest status from database
      console.log('Refreshing appointments to get updated status...');
      await refreshAppointments();
      
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      toast.error(`Failed to reschedule appointment: ${error.message}`);
    }
  };

  const addToCalendar = (appointment) => {
    const startDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
    const endDateTime = new Date(startDateTime.getTime() + (appointment.duration || 30) * 60000);
    
    const startTime = startDateTime.toISOString().replace(/-|:|\.\d+/g, '');
    const endTime = endDateTime.toISOString().replace(/-|:|\.\d+/g, '');
    
    const services = appointment.serviceNames.join(', ');
    const location = `${appointment.branch} Branch - Silario Dental Clinic`;
    
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Dental Appointment: ${services}&dates=${startTime}/${endTime}&details=Appointment at Silario Dental Clinic.${appointment.notes ? ' Notes: ' + appointment.notes : ''}&location=${encodeURIComponent(location)}`;
    
    window.open(gcalUrl, '_blank');
    toast.success('Opening Google Calendar');
  };

  const formatDate = (dateStr) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
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
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'no-show':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isAppointmentEditable = (appointment) => {
    const isEditableStatus = ['pending', 'confirmed', 'rejected', 'cancelled'].includes(appointment.status.toLowerCase());
    const appointmentDate = new Date(appointment.appointment_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const isEditable = isEditableStatus && appointmentDate >= today;
    console.log('Checking if appointment is editable:', {
      appointmentId: appointment.id,
      status: appointment.status,
      isEditableStatus,
      appointmentDate: appointment.appointment_date,
      today: today.toISOString().split('T')[0],
      isEditable
    });
    
    return isEditable;
  };

  const canCancelAppointment = (appointment) => {
    const isPendingOrConfirmed = ['pending', 'confirmed'].includes(appointment.status.toLowerCase());
    const appointmentDate = new Date(appointment.appointment_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return isPendingOrConfirmed && appointmentDate >= today;
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 space-y-3 sm:space-y-0">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">My Appointments</h1>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setShowTimeSlots(false);
              setEditingAppointment(null);
              setSelectedDate(null);
              setSelectedBranch('');
              setAvailableTimeSlots([]);
              setEstimatedDuration(30);
              setShowLocationSuggestion(false);
            }}
            className="px-3 sm:px-4 py-2 bg-primary-600 text-white text-sm sm:text-base rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {showForm ? 'Cancel' : 'Book New Appointment'}
          </button>
        </div>

        {/* Time Slot Selection View */}
        {showForm && showTimeSlots && (
          <div className="bg-gray-50 rounded-lg p-6 mb-6 border border-gray-200">
            <div className="flex items-center mb-4">
              <button 
                onClick={() => setShowTimeSlots(false)}
                className="mr-3 p-2 rounded-md hover:bg-gray-100"
                aria-label="Back to form"
              >
                <FiArrowLeft />
              </button>
              <h2 className="text-xl font-semibold text-gray-800">
                Available Time Slots
              </h2>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center text-gray-600 mb-2">
                <FiMapPin className="mr-2" /> {selectedBranch} Branch
                {branchDistances[selectedBranch] && (
                  <span className="ml-2 text-sm text-gray-500">
                    ({branchDistances[selectedBranch].distanceText})
                  </span>
                )}
              </div>
              <div className="flex items-center text-gray-600">
                <FiCalendar className="mr-2" /> 
                {selectedDate && selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </div>
              <div className="flex items-center text-gray-600 mt-2">
                <FiClock className="mr-2" /> 
                Estimated Duration: {estimatedDuration} minutes
              </div>
              
              {/* Branch Hours Information */}
              {branchHours && branchHours.open && (
                <div className="flex items-center text-gray-600 mt-2">
                  <FiClock className="mr-2" /> 
                  Operating Hours: {branchHours.hours.startFormatted} - {branchHours.hours.endFormatted}
                </div>
              )}
              
              {/* Available Providers */}
              {availableProviders.length > 0 && (
                <div className="flex items-center text-gray-600 mt-2">
                  <FiUser className="mr-2" /> 
                  Available: {availableProviders.length} healthcare provider{availableProviders.length > 1 ? 's' : ''} 
                  <span className="ml-1 text-sm">
                    ({availableProviders.map(p => `Dr. ${p.full_name}`).join(', ')})
                  </span>
                </div>
              )}
            </div>
            
            {formattedTimeSlots.length === 0 ? (
              <div className="py-8 text-center bg-red-100 rounded-md border border-red-300">
                <FiAlertTriangle className="mx-auto h-8 w-8 text-red-600 mb-2" />
                <div className="text-red-900">
                  <p className="font-medium mb-2">No available time slots for this date</p>
                  {!branchHours?.open ? (
                    <p className="text-sm">
                      The {selectedBranch} branch is closed on this day or no healthcare providers are available.
                    </p>
                  ) : availableProviders.length === 0 ? (
                    <p className="text-sm">
                      No healthcare providers are available at the {selectedBranch} branch on this date.
                    </p>
                  ) : (
                    <p className="text-sm">
                      All available time slots are already booked for this date.
                    </p>
                  )}
                  {branchHours?.open && (
                    <p className="text-sm mt-2 text-red-700">
                      Operating hours: {branchHours.hours.startFormatted} - {branchHours.hours.endFormatted}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowTimeSlots(false)}
                  className="mt-4 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Select Another Date
                </button>
              </div>
            ) : (
              <Formik
                initialValues={{
                  formTime: editingAppointment?.appointment_time || localStorage.getItem('temp_selected_time') || '',
                }}
                onSubmit={(values, actions) => {
                  if (values.formTime) {
                    if (setParentFormFieldValue) {
                      localStorage.setItem('temp_selected_time', values.formTime);
                      setParentFormFieldValue('appointment_time', values.formTime);
                      setSelectedTimeSlot(values.formTime);
                      
                      setTimeout(() => {
                        setShowTimeSlots(false);
                        toast.success('Time slot selected');
                      }, 100);
                    } else {
                      toast.error('Unable to set time slot, please try again');
                    }
                  } else {
                    toast.error('Please select a time slot');
                  }
                  actions.setSubmitting(false);
                }}
              >
                {({ values, setFieldValue, handleSubmit, isSubmitting }) => (
                  <Form>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
                      {formattedTimeSlots.map((slot) => (
                        <div key={slot.time}>
                          <label
                            className={`
                              block border rounded-md py-3 px-4 text-center cursor-pointer transition-all
                              ${values.formTime === slot.time 
                                ? 'bg-green-700 text-white border-green-700 shadow-lg' 
                                : ''
                              }
                              ${!slot.available 
                                ? 'bg-red-200 border-red-400 text-red-800 cursor-not-allowed opacity-90' 
                                : 'bg-green-200 border-green-400 text-green-800 hover:border-green-600 hover:bg-green-300'
                              }
                            `}
                          >
                            <Field
                              type="radio"
                              name="formTime"
                              value={slot.time}
                              disabled={!slot.available}
                              className="sr-only"
                              onClick={async () => {
                                // Real-time availability check before selecting
                                if (slot.available && selectedDate && selectedBranch) {
                                  try {
                                    console.log('🔍 Checking real-time availability for:', slot.time);
                                    const slotsResult = await ScheduleService.getAvailableTimeSlots(
                                      selectedBranch, 
                                      selectedDate.toISOString().split('T')[0], 
                                      estimatedDuration, 
                                      null
                                    );
                                    
                                    // Check if this specific slot is still available
                                    const currentSlot = slotsResult.formattedSlots.find(s => s.time === slot.time);
                                    if (currentSlot && !currentSlot.available) {
                                      toast.error('This time slot is no longer available. Please select another time.');
                                      // Refresh the time slots to show updated availability
                                      await fetchAvailableTimeSlots(selectedDate, selectedBranch, estimatedDuration);
                                      return;
                                    }
                                  } catch (error) {
                                    console.error('Error checking real-time availability:', error);
                                    toast.error('Unable to verify availability. Please try again.');
                                    return;
                                  }
                                }
                                setFieldValue('formTime', slot.time);
                              }}
                            />
                            <span className="block font-medium">{slot.displayTime}</span>
                            <span className="block text-xs mt-1">
                              to {slot.endTime}
                            </span>
                            {slot.available && slot.providersCount && (
                              <span className="block text-xs mt-1 opacity-75">
                                {slot.providersCount} provider{slot.providersCount > 1 ? 's' : ''} available
                              </span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowTimeSlots(false)}
                        className="mr-3 px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!values.formTime || isSubmitting}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:bg-primary-300"
                      >
                        Confirm Selection
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            )}
          </div>
        )}

        {/* Enhanced Appointment Booking Form with Location-Based Branch Suggestion */}
        {showForm && !showTimeSlots && (
          <div className="bg-gray-50 rounded-lg p-6 mb-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              {editingAppointment ? 'Reschedule Appointment' : 'Book a New Appointment'}
            </h2>
            
            {/* Location-Based Branch Suggestion */}
            {showLocationSuggestion && nearestBranch && !editingAppointment && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <FiTarget className="h-6 w-6 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="flex-grow">
                    <h3 className="text-blue-900 font-medium">Recommended Branch Based on Your Location</h3>
                    <p className="text-blue-800 text-sm mt-1">
                      <strong>{nearestBranch} Branch</strong> is closest to you 
                      ({branchDistances[nearestBranch]?.distanceText}).
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBranch(nearestBranch);
                          localStorage.setItem('temp_selected_branch', nearestBranch);
                          setShowLocationSuggestion(false);
                          toast.success(`Selected ${nearestBranch} branch`);
                        }}
                        className="inline-flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        <FiMapPin className="mr-1 h-4 w-4" />
                        Select {nearestBranch}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLocationSuggestion(false)}
                        className="inline-flex items-center px-3 py-1 text-sm bg-white text-blue-700 border border-blue-300 rounded-md hover:bg-blue-50"
                      >
                        <FiX className="mr-1 h-4 w-4" />
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Location Request */}
            {!userLocation && !locationLoading && !showLocationSuggestion && !editingAppointment && !locationError && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <FiNavigation className="h-6 w-6 text-gray-500 mr-3" />
                  <div className="flex-grow">
                    <h3 className="text-gray-900 font-medium">Get Branch Recommendation</h3>
                    <p className="text-gray-600 text-sm mt-1">
                      Allow location access to find the nearest branch to you.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={getUserLocation}
                    className="inline-flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <FiGlobe className="mr-1 h-4 w-4" />
                    Find Nearest Branch
                  </button>
                </div>
              </div>
            )}

            {/* Location Loading */}
            {locationLoading && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                  <div>
                    <h3 className="text-blue-900 font-medium">Getting your location...</h3>
                    <p className="text-blue-800 text-sm">Please allow location access in your browser.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Location Error */}
            {locationError && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <FiAlertTriangle className="h-6 w-6 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="flex-grow">
                    <h3 className="text-yellow-900 font-medium">Location Access Unavailable</h3>
                    <p className="text-yellow-800 text-sm mt-1">{locationError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setLocationError(null);
                        getUserLocation();
                      }}
                      className="inline-flex items-center px-3 py-1 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 mt-2"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <Formik
              initialValues={{
                branch: editingAppointment?.branch || selectedBranch || localStorage.getItem('temp_selected_branch') || '',
                appointment_date: editingAppointment ? 
                  new Date(editingAppointment.appointment_date) : 
                  (localStorage.getItem('temp_selected_date') ? 
                    new Date(localStorage.getItem('temp_selected_date')) : 
                    (() => {
                      const today = new Date();
                      const tomorrow = new Date(today);
                      tomorrow.setDate(today.getDate() + 1);
                      tomorrow.setHours(0, 0, 0, 0);
                      return tomorrow;
                    })()),
                appointment_time: editingAppointment?.appointment_time || localStorage.getItem('temp_selected_time') || '',
                service_id: editingAppointment?.serviceIds || [],
                teeth_involved: editingAppointment?.teeth_involved || '',
                notes: editingAppointment?.notes || '',
                is_emergency: editingAppointment?.is_emergency || false,
                agree_terms: editingAppointment ? true : false,
              }}
              validationSchema={appointmentSchema}
              onSubmit={handleBooking}
              enableReinitialize={true}
            >
              {({ isSubmitting, setFieldValue, values, errors, touched }) => {
                useEffect(() => {
                  setSetParentFormFieldValue(() => setFieldValue);
                  
                  const storedBranch = localStorage.getItem('temp_selected_branch');
                  const storedDate = localStorage.getItem('temp_selected_date');
                  const storedTime = localStorage.getItem('temp_selected_time');
                  
                  if (storedBranch && values.branch !== storedBranch) {
                    setFieldValue('branch', storedBranch);
                    setSelectedBranch(storedBranch);
                  }
                  
                  if (selectedBranch && values.branch !== selectedBranch) {
                    setFieldValue('branch', selectedBranch);
                  }
                  
                  if (storedDate && (!values.appointment_date || values.appointment_date.toISOString().split('T')[0] !== storedDate)) {
                    const dateObj = new Date(storedDate);
                    setFieldValue('appointment_date', dateObj);
                    setSelectedDate(dateObj);
                  }
                  
                  if (storedTime && values.appointment_time !== storedTime) {
                    setFieldValue('appointment_time', storedTime);
                    setSelectedTimeSlot(storedTime);
                  }
                }, [setFieldValue, values.branch, values.appointment_date, values.appointment_time, selectedBranch]);
                
                return (
                  <Form className="space-y-4">
                    {editingAppointment && (
                      <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                        <p className="text-blue-800 font-medium">
                          Rescheduling appointment from {formatDate(editingAppointment.appointment_date)} at {formatTime(editingAppointment.appointment_time)}
                        </p>
                        <p className="text-blue-700 text-sm mt-1">
                          You can change the branch, date, and time as needed.
                        </p>
                      </div>
                    )}

                    {/* Branch and Date Selection */}
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-1">
                          Select Branch <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FiMapPin className="h-5 w-5 text-gray-400" />
                          </div>
                          <Field
                            as="select"
                            id="branch"
                            name="branch"
                            className="block w-full pl-10 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                            onChange={(e) => {
                              const newBranch = e.target.value;
                              setFieldValue('branch', newBranch);
                              setSelectedBranch(newBranch);
                              localStorage.setItem('temp_selected_branch', newBranch);
                              
                              // Auto-select tomorrow's date (1 day in advance)
                              const tomorrow = new Date();
                              tomorrow.setHours(0, 0, 0, 0); // Set to start of today
                              tomorrow.setDate(tomorrow.getDate() + 1); // Add one day
                              setFieldValue('appointment_date', tomorrow);
                              setSelectedDate(tomorrow);
                              localStorage.setItem('temp_selected_date', tomorrow.toISOString().split('T')[0]);
                              
                              setFieldValue('appointment_time', '');
                              localStorage.removeItem('temp_selected_time');
                            }}
                            style={{ color: 'rgb(75, 85, 99)' }}
                          >
                            <option value="" className="text-gray-600">Select Branch</option>
                            <option value="Cabugao" className="text-gray-600">
                              Cabugao Branch
                              {branchDistances.Cabugao && ` (${branchDistances.Cabugao.distanceText})`}
                            </option>
                            <option value="San Juan" className="text-gray-600">
                              San Juan Branch
                              {branchDistances['San Juan'] && ` (${branchDistances['San Juan'].distanceText})`}
                            </option>
                          </Field>
                        </div>
                        <ErrorMessage name="branch" component="p" className="mt-1 text-sm text-red-600" />
                        {values.branch && (
                          <div className="mt-2 text-sm text-gray-600">
                            <p className="font-medium">{values.branch} Branch Hours:</p>
                            {values.branch === 'Cabugao' ? (
                              <div>
                                <p>Monday to Friday: 8:00 AM - 12:00 PM</p>
                                <p>Saturday: 8:00 AM - 5:00 PM</p>
                                <p>Sunday: Closed</p>
                              </div>
                            ) : (
                              <div>
                                <p>Monday to Friday: 1:00 PM - 5:00 PM</p>
                                <p>Saturday: Closed</p>
                                <p>Sunday: 8:00 AM - 5:00 PM</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <label htmlFor="appointment_date" className="block text-sm font-medium text-gray-700 mb-1">
                          Select Date <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FiCalendar className="h-5 w-5 text-gray-400" />
                          </div>
                          <DatePicker
                            id="appointment_date"
                            selected={values.appointment_date}
                            onChange={(date) => {
                              setFieldValue('appointment_date', date);
                              setSelectedDate(date);
                              localStorage.setItem('temp_selected_date', date.toISOString().split('T')[0]);
                              setFieldValue('appointment_time', '');
                              localStorage.removeItem('temp_selected_time');
                              if (values.branch) {
                                fetchAvailableTimeSlots(date, values.branch, estimatedDuration);
                              }
                            }}
                            minDate={(() => {
                              const today = new Date();
                              const tomorrow = new Date(today);
                              tomorrow.setDate(today.getDate() + 1);
                              tomorrow.setHours(0, 0, 0, 0);
                              console.log('Min date calculated:', tomorrow.toISOString().split('T')[0]);
                              return tomorrow;
                            })()}
                            filterDate={(date) => {
                              const day = date.getDay();
                              // Use local date formatting to match the unavailableDates format
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const dayOfMonth = String(date.getDate()).padStart(2, '0');
                              const dateStr = `${year}-${month}-${dayOfMonth}`;
                              
                              console.log('Filtering date:', dateStr, 'Day:', day, 'Branch:', values.branch, 'Unavailable dates:', Array.from(unavailableDates));
                              
                              // Check if patient already has an appointment on this date
                              if (unavailableDates.has(dateStr)) {
                                console.log('Date blocked - patient has existing appointment');
                                return false;
                              }
                              
                              // Check branch-specific day restrictions
                              if (values.branch === 'Cabugao') {
                                const allowed = day !== 0; // Not Sunday
                                console.log('Cabugao branch - Sunday check:', allowed);
                                return allowed;
                              } else if (values.branch === 'San Juan') {
                                const allowed = day !== 6; // Not Saturday
                                console.log('San Juan branch - Saturday check:', allowed);
                                return allowed;
                              }
                              console.log('Date allowed');
                              return true;
                            }}
                            dateFormat="MMMM d, yyyy"
                            className="block w-full pl-10 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                            placeholderText="Select date"
                            disabled={!values.branch}
                            title={unavailableDates.size > 0 ? "Dates with existing appointments are not available" : "Select an available date"}
                          />
                        </div>
                        <ErrorMessage name="appointment_date" component="p" className="mt-1 text-sm text-red-600" />
                        {unavailableDates.size > 0 && (
                          <p className="mt-1 text-sm text-blue-600 flex items-center">
                            <FiUser className="mr-1" />
                          Only one appointment per day is allowed.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Time Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Time <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiClock className="h-5 w-5 text-gray-400" />
                        </div>
                        
                        {values.appointment_time ? (
                          <div className="flex items-center">
                            <div className="block w-full pl-10 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50">
                              {formatTime(values.appointment_time)} 
                              {estimatedDuration && (
                                <span className="text-gray-500">
                                  {" "} - {formatTime(calculateEndTime(values.appointment_time, estimatedDuration))}
                                  {" "} ({estimatedDuration} mins)
                                </span>
                              )}
                            </div>
                            <button
                              type="button" 
                              onClick={() => {
                                if (values.appointment_date && values.branch) {
                                  fetchAvailableTimeSlots(values.appointment_date, values.branch, estimatedDuration);
                                  setShowTimeSlots(true);
                                } else {
                                  toast.error('Please select a branch and date first');
                                }
                              }}
                              className="ml-2 p-2 bg-gray-100 rounded-md hover:bg-gray-200"
                              title="Change time"
                            >
                              <FiEdit className="h-5 w-5 text-gray-600" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (values.appointment_date && values.branch) {
                                fetchAvailableTimeSlots(values.appointment_date, values.branch, estimatedDuration);
                                setShowTimeSlots(true);
                              } else {
                                toast.error('Please select a branch and date first');
                              }
                            }}
                            disabled={!values.appointment_date || !values.branch}
                            className="w-full flex items-center pl-10 py-2 border border-gray-300 rounded-md text-left text-gray-700 disabled:bg-gray-100 disabled:text-gray-500 hover:bg-gray-50"
                          >
                            Select available time slot
                          </button>
                        )}
                      </div>
                      <ErrorMessage name="appointment_time" component="p" className="mt-1 text-sm text-red-600" />
                    </div>

                    {/* Services Selection - Single Column */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Dental Services <span className="text-red-500">*</span>
                      </label>
                      
                      {services.length === 0 ? (
                        <div className="py-4 text-center bg-yellow-50 rounded-md border border-yellow-100">
                          <p className="text-yellow-800">
                            No services are available. Please contact the clinic for assistance.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {services.map(service => (
                              <div 
                                key={service.id} 
                                className={`relative flex items-start p-3 rounded-md border ${
                                  values.service_id.includes(service.id) 
                                    ? 'bg-primary-50 border-primary-300' 
                                    : 'bg-gray-50 border-gray-200 hover:border-primary-300'
                                }`}
                              >
                                <div className="flex items-center h-5">
                                  <Field
                                    type="checkbox"
                                    id={`service_${service.id}`}
                                    name="service_id"
                                    value={service.id}
                                    onChange={(e) => {
                                      const currentServices = [...values.service_id];
                                      
                                      if (e.target.checked) {
                                        currentServices.push(service.id);
                                      } else {
                                        const index = currentServices.indexOf(service.id);
                                        if (index !== -1) {
                                          currentServices.splice(index, 1);
                                        }
                                      }
                                      
                                      handleServiceChange(currentServices, setFieldValue);
                                    }}
                                    className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                  />
                                </div>
                                {service.image_url && (
                                  <img
                                    src={service.image_url}
                                    alt={service.name || 'Service image'}
                                    className="ml-3 w-16 h-16 rounded object-cover border border-gray-200 flex-shrink-0"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                )}
                                <div className="ml-3 text-sm flex-grow">
                                  <label htmlFor={`service_${service.id}`} className="font-medium text-gray-700 cursor-pointer">
                                    {service.name || 'Unnamed Service'}
                                  </label>
                                  <p className="text-gray-500 text-xs mt-1">{service.description || 'No description available'}</p>
                                  <div className="flex justify-between mt-2">
                                    <span className="text-primary-600 font-medium">
                                      ₱{service.price ? parseFloat(service.price).toLocaleString() : '0'}
                                    </span>
                                    <span className="text-gray-500 text-xs">{service.duration || 30} mins</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {estimatedDuration > 0 && values.service_id.length > 0 && (
                            <div className="mt-3 bg-primary-50 p-2 rounded-md">
                              <div className="flex items-center">
                                <FiClock className="h-4 w-4 text-primary-600 mr-2" />
                                <span className="text-primary-700 text-sm">
                                  Estimated appointment duration: <strong>{estimatedDuration} minutes</strong>
                                </span>
                              </div>
                              <div className="flex items-center mt-2">
                              <span className="h-4 w-4 text-primary-600 mr-2">₱</span>
                                <span className="text-primary-700 text-sm">
                                  Estimated cost: <strong>₱{calculateEstimatedCost(values.service_id).toLocaleString()}</strong>
                                </span>
                              </div>
                            </div>
                          )}
                          
                          <ErrorMessage name="service_id" component="div" className="mt-2 text-sm text-red-600 font-medium" />
                        </>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                        Additional Notes (Optional)
                      </label>
                      <Field
                        as="textarea"
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Any additional information you'd like to provide"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                      <ErrorMessage name="notes" component="p" className="mt-1 text-sm text-red-600" />
                    </div>

                    {/* Auto-Queue Option */}
                    <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <Field
                            id="auto_join_queue"
                            name="auto_join_queue"
                            type="checkbox"
                            checked={autoJoinQueue}
                            onChange={(e) => setAutoJoinQueue(e.target.checked)}
                            className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="auto_join_queue" className="font-medium text-blue-800">
                            Auto-join queue for today's appointments
                          </label>
                          <p className="text-blue-700">
                            If this appointment is scheduled for today, automatically join the waiting queue after booking.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Cancellation Policy */}
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <Field
                            id="agree_terms"
                            name="agree_terms"
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="agree_terms" className="font-medium text-gray-700">
                            I agree to the cancellation policy <span className="text-red-500">*</span>
                          </label>
                          <p className="text-gray-500">
                            Appointments must be canceled at least 24 hours in advance. 
                          </p>
                        </div>
                      </div>
                      <ErrorMessage name="agree_terms" component="div" className="mt-2 text-sm text-red-600 font-medium" />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmitting || !values.appointment_time || values.service_id.length === 0 || !values.agree_terms}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          `${editingAppointment ? 'Update' : 'Book'} Appointment`
                        )}
                      </button>
                    </div>
                  </Form>
                );
              }}
            </Formik>
          </div>
        )}

        {/* Appointments List - Mobile Optimized */}
        <div>
          <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">Your Appointments</h2>
          
          {/* Filter Tabs - Mobile Responsive */}
          <div className="border-b border-gray-200 mb-3 sm:mb-4">
            <nav className="-mb-px flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setFilterStatus('all')}
                className={`pb-2 sm:pb-3 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  filterStatus === 'all'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('today')}
                className={`pb-2 sm:pb-3 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  filterStatus === 'today'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setFilterStatus('upcoming')}
                className={`pb-2 sm:pb-3 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  filterStatus === 'upcoming'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Upcoming
              </button>
              <button
                onClick={() => setFilterStatus('completed')}
                className={`pb-2 sm:pb-3 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  filterStatus === 'completed'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Completed
              </button>
              <button
                onClick={() => setFilterStatus('cancelled')}
                className={`pb-2 sm:pb-3 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  filterStatus === 'cancelled'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Cancelled
              </button>
              <button
                onClick={() => setFilterStatus('rejected')}
                className={`pb-2 sm:pb-3 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  filterStatus === 'rejected'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Rejected
              </button>
            </nav>
          </div>
          
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-8 sm:py-12 bg-gray-50 rounded-lg border border-gray-200">
              {appointments.length === 0 ? (
                <>
                  <p className="text-sm sm:text-base text-gray-500 mb-4">You don't have any appointments yet.</p>
                  {!showForm && (
                    <button
                      onClick={() => setShowForm(true)}
                      className="px-3 sm:px-4 py-2 bg-primary-600 text-white text-sm sm:text-base rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    >
                      Book Your First Appointment
                    </button>
                  )}
                </>
              ) : (
                <p className="text-sm sm:text-base text-gray-500">
                  {filterStatus === 'all' && 'No appointments found.'}
                  {filterStatus === 'today' && 'No appointments scheduled for today.'}
                  {filterStatus === 'upcoming' && 'No upcoming appointments.'}
                  {filterStatus === 'completed' && 'No completed appointments.'}
                  {filterStatus === 'cancelled' && 'No cancelled appointments.'}
                  {filterStatus === 'rejected' && 'No rejected appointments.'}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filteredAppointments.map((appointment) => {
                const appointmentDate = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
                const now = new Date();
                const timeDiff = appointmentDate - now;
                const isWithin24Hours = timeDiff > 0 && timeDiff < 24 * 60 * 60 * 1000;
                const isPast = appointmentDate < now;
                
                return (
                  <div 
                    key={appointment.id}
                    className={`bg-white rounded-lg border p-3 sm:p-4 ${
                      appointment.status.toLowerCase() === 'cancelled' ? 'border-gray-200 opacity-75' : 'border-gray-300'
                    } ${isWithin24Hours && appointment.status === 'confirmed' ? 'border-l-4 border-l-green-500' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-grow min-w-0">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                          <FiCalendar className="text-primary-500 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="font-medium text-sm sm:text-base">{formatDate(appointment.appointment_date)}</span>
                          <span className="text-gray-400 text-xs sm:text-sm">•</span>
                          <FiClock className="text-primary-500 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="text-sm sm:text-base">{formatTime(appointment.appointment_time)}</span>
                          <span className="text-gray-400 text-xs sm:text-sm">•</span>
                          <span>
                            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs rounded-full ${getStatusBadgeClass(appointment.status)}`}>
                              {appointment.status}
                            </span>
                          </span>
                          
                          {appointment.is_emergency && (
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-red-100 text-red-800 text-xs rounded-full flex items-center">
                              <FiAlertTriangle className="mr-1 h-3 w-3" />
                              <span className="hidden sm:inline">Emergency</span>
                              <span className="sm:hidden">Emer</span>
                            </span>
                          )}
                          
                          {isWithin24Hours && appointment.status === 'confirmed' && (
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center">
                              <FiBell className="mr-1 h-3 w-3" />
                              <span className="hidden sm:inline">Coming up soon</span>
                              <span className="sm:hidden">Soon</span>
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center">
                          <FiMapPin className="mr-1 sm:mr-2 text-primary-500 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="text-sm sm:text-base">{appointment.branch} Branch</span>
                          {branchDistances[appointment.branch] && (
                            <span className="ml-2 text-xs sm:text-sm text-gray-500">
                              ({branchDistances[appointment.branch].distanceText})
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center">
                          <FiUser className="mr-1 sm:mr-2 text-primary-500 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="text-xs sm:text-sm text-gray-700 min-w-0">
                            <span className="font-medium">
                              <span className="hidden sm:inline">Assigned Doctor:</span>
                              <span className="sm:hidden">Doctor:</span>
                            </span>{' '}
                            {appointment.assignedDoctor ? (
                              <span className="text-primary-600">Dr. {appointment.assignedDoctor.full_name}</span>
                            ) : (
                              <span className="text-gray-500 italic">Not yet assigned</span>
                            )}
                          </span>
                        </div>

                        <div className="mt-2 text-xs sm:text-sm text-gray-600 flex flex-wrap items-center gap-1">
                          <FiClock className="mr-1 text-gray-400 h-3 w-3 flex-shrink-0" />
                          <span>
                            Duration: {appointment.duration || 30} minutes
                            <span className="text-xs ml-1 text-gray-500 hidden sm:inline">
                              {getDurationSourceText(appointment.id)}
                            </span>
                          </span>
                          <span className="text-gray-400 mx-1">•</span>
                          <span>
                            Ends at: {formatTime(calculateEndTime(appointment.appointment_time, appointment.duration || 30))}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {isAppointmentEditable(appointment) && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openActionModal(appointment, 'reschedule')}
                            className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-full"
                            title="Reschedule Appointment"
                          >
                            <FiEdit className="h-5 w-5" />
                          </button>
                          {canCancelAppointment(appointment) && (
                            <button
                              onClick={() => openActionModal(appointment, 'cancel')}
                              className={`p-2 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded-full ${
                                isWithin24Hours ? 'relative' : ''
                              }`}
                              title={isWithin24Hours 
                                ? "Late cancellation (within 24 hours)" 
                                : "Cancel Appointment"
                              }
                            >
                              <FiX className="h-5 w-5" />
                              {isWithin24Hours && (
                                <span className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3 h-3"></span>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Services:</p>
                          <ul className="text-sm text-gray-600 mt-1 space-y-1">
                            {appointment.serviceNames && appointment.serviceNames.length > 0 ? (
                              appointment.serviceNames.map((service, index) => (
                                <li key={index} className="flex items-center">
                                  <FiCheck className="text-green-500 mr-2 h-4 w-4 flex-shrink-0" />
                                  {service}
                                </li>
                              ))
                            ) : (
                              <li className="flex items-center text-gray-400 italic">
                                <FiInfo className="text-gray-300 mr-2 h-4 w-4 flex-shrink-0" />
                                No services specified
                              </li>
                            )}
                          </ul>
                        </div>
                        
                        <div>
                          {appointment.teeth_involved && (
                            <div className="mb-2">
                              <span className="text-sm font-medium text-gray-700">Teeth Involved:</span>{' '}
                              <span className="text-sm text-gray-600">{appointment.teeth_involved}</span>
                            </div>
                          )}

                          {appointment.notes && (
                            <div>
                              <span className="text-sm font-medium text-gray-700">Notes:</span>{' '}
                              <span className="text-sm text-gray-600">{appointment.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Appointment Actions */}
                    {appointment.status === 'confirmed' && !isPast && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => openActionModal(appointment, 'reschedule')}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200"
                        >
                          <FiCalendar className="mr-1" /> Reschedule
                        </button>
                        
                        <button
                          onClick={() => addToCalendar(appointment)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                        >
                          <FiCalendar className="mr-1" /> Add to Calendar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Unified Action Modal (Cancel/Reschedule) */}
      {showActionModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowActionModal(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${
                    actionType === 'cancel' ? 'bg-red-100' : 'bg-blue-100'
                  } sm:mx-0 sm:h-10 sm:w-10`}>
                    {actionType === 'cancel' ? (
                      <FiX className="h-6 w-6 text-red-600" aria-hidden="true" />
                    ) : (
                      <FiEdit className="h-6 w-6 text-blue-600" aria-hidden="true" />
                    )}
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      {actionType === 'cancel' ? 'Cancel Appointment' : 'Reschedule Appointment'}
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {actionType === 'cancel' 
                          ? 'Are you sure you want to cancel this appointment? This action cannot be undone.'
                          : 'Would you like to reschedule this appointment to a different date, time, or branch?'
                        }
                      </p>
                      
                      {selectedAppointmentForAction && (
                        <div className="mt-3 bg-gray-50 p-3 rounded-md">
                          <div className="flex items-center text-sm">
                            <FiCalendar className="mr-2 text-gray-500" />
                            <span>{formatDate(selectedAppointmentForAction.appointment_date)}</span>
                          </div>
                          <div className="flex items-center text-sm mt-1">
                            <FiClock className="mr-2 text-gray-500" />
                            <span>{formatTime(selectedAppointmentForAction.appointment_time)}</span>
                          </div>
                          <div className="flex items-center text-sm mt-1">
                            <FiMapPin className="mr-2 text-gray-500" />
                            <span>{selectedAppointmentForAction.branch} Branch</span>
                            {branchDistances[selectedAppointmentForAction.branch] && (
                              <span className="ml-2 text-xs text-gray-400">
                                ({branchDistances[selectedAppointmentForAction.branch].distanceText})
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button 
                  type="button" 
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${
                    actionType === 'cancel' 
                      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                      : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                  }`}
                  onClick={handleAppointmentAction}
                >
                  {actionType === 'cancel' ? 'Cancel Appointment' : 'Reschedule'}
                </button>
                <button 
                  type="button" 
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setShowActionModal(false);
                    setSelectedAppointmentForAction(null);
                    setActionType('');
                  }}
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {isRescheduling && selectedAppointmentForAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          {console.log('Rendering reschedule modal for:', selectedAppointmentForAction)}
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
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
                <span className="font-medium">Current Schedule:</span> {formatDate(selectedAppointmentForAction.appointment_date)} at {formatTime(selectedAppointmentForAction.appointment_time)} - {selectedAppointmentForAction.branch} Branch
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="reschedule-branch" className="block text-sm font-medium text-gray-700 mb-1">
                    Select Branch
                  </label>
                  <select
                    id="reschedule-branch"
                    value={rescheduleBranch}
                    onChange={(e) => {
                      setRescheduleBranch(e.target.value);
                      setRescheduleTimeSlot('');
                      if (rescheduleDate) {
                        const duration = selectedAppointmentForAction.duration || 30;
                        fetchRescheduleTimeSlots(rescheduleDate, e.target.value, duration);
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
                      setRescheduleTimeSlot('');
                      if (rescheduleBranch && date) {
                        const duration = selectedAppointmentForAction.duration || 30;
                        fetchRescheduleTimeSlots(date, rescheduleBranch, duration);
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

                {rescheduleDate && rescheduleBranch && (
                  <div>
                    <label htmlFor="reschedule-time" className="block text-sm font-medium text-gray-700 mb-1">
                      Select New Time
                    </label>
                    <select
                      id="reschedule-time"
                      value={rescheduleTimeSlot}
                      onChange={(e) => setRescheduleTimeSlot(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Select Time</option>
                      {rescheduleAvailableTimeSlots.map((timeSlot) => (
                        <option key={timeSlot.time} value={timeSlot.time}>
                          {formatTime(timeSlot.time)}
                        </option>
                      ))}
                    </select>
                    {rescheduleAvailableTimeSlots.length === 0 && (
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
                onClick={handlePatientReschedule}
                disabled={!rescheduleDate || !rescheduleTimeSlot || !rescheduleBranch}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:bg-primary-300"
              >
                Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Queue Join Options Modal */}
      {showQueueJoinOptions && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold text-gray-900">
                Join Queue for Today?
              </h3>
              <button
                type="button"
                className="bg-white rounded-md text-gray-400 hover:text-gray-500"
                onClick={() => handleQueueJoin(false)}
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4">
              <div className="flex items-center mb-4">
                <FiUsers className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm text-gray-600">
                    Your appointment has been booked for today. Would you like to join the queue now?
                  </p>
                </div>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-md mb-4">
                <p className="text-sm text-blue-800 font-medium">Benefits of joining the queue:</p>
                <ul className="text-xs text-blue-700 mt-1 space-y-1">
                  <li>• Get real-time updates on your position</li>
                  <li>• Receive notifications when it's your turn</li>
                  <li>• No need to wait at the clinic</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                onClick={() => handleQueueJoin(false)}
              >
                Maybe Later
              </button>
              <button
                type="button"
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                onClick={() => handleQueueJoin(true)}
              >
                Join Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientAppointments;