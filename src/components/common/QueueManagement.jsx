// src/pages/doctor/QueueManagement.jsx - Fixed with proper auto-integration
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FiUser, FiClock, FiCheck, FiX, FiArrowRight, FiPlus, FiRefreshCw, FiFileText, FiInfo, FiAlertTriangle } from 'react-icons/fi';
import supabase from '../../config/supabaseClient';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { QueueService } from '../../services/queueService';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';
import { getNextQueueNumberForToday } from '../../utils/philippineTime';

const QueueManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { logPageView, logQueueView, logQueueAdd, logQueueStatusUpdate } = useUniversalAudit();
  const [selectedPatient, setSelectedPatient] = useState(null); // Keep for backward compatibility
  const [servingPatients, setServingPatients] = useState([]); // New: multiple serving patients
  const [waitingPatients, setWaitingPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [patientsList, setPatientsList] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [activityLogs, setActivityLogs] = useState([]);
  const [completingPatient, setCompletingPatient] = useState(false);
  const [activeBranch, setActiveBranch] = useState('all');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [patientToCancel, setPatientToCancel] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [completedPatientData, setCompletedPatientData] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [walkinBranch, setWalkinBranch] = useState('');
  const [availableWalkinSlots, setAvailableWalkinSlots] = useState([]);
  const [formattedWalkinSlots, setFormattedWalkinSlots] = useState([]);
  const [selectedDoctorForInvoice, setSelectedDoctorForInvoice] = useState('');
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState(null);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentModalData, setAppointmentModalData] = useState(null);
  const isAutoAddingRef = useRef(false);
  const autoAddToastKeyRef = useRef('');
  const processedAppointmentsRef = useRef(new Set()); // Track processed appointments to prevent duplicates
  const duplicateBlockerRef = useRef(new Set()); // Block duplicate patients from being added
  const autoAddLockRef = useRef(false); // Atomic lock for auto-add process
  const autoAddPromiseRef = useRef(null); // Promise to prevent multiple concurrent auto-adds

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const calculateEndTime = (startTimeStr, durationMinutes) => {
    const [h, m] = startTimeStr.split(':').map(Number);
    const start = h * 60 + m;
    const end = start + durationMinutes;
    const endH = Math.floor(end / 60);
    const endM = end % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  };

  const fetchWalkinSlotsForToday = async (branch) => {
    if (!branch) return;
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; 
    const interval = 30;

    // Determine working window for today
    let workingStart = null; // hour
    let workingEnd = null;   // hour
    const day = today.getDay();
    if (branch === 'Cabugao') {
      if (day === 0) { /* closed */ }
      else if (day === 6) { workingStart = 8; workingEnd = 17; }
      else { workingStart = 8; workingEnd = 12; }
    } else if (branch === 'San Juan') {
      if (day === 6) { /* closed */ }
      else if (day === 0) { workingStart = 8; workingEnd = 17; }
      else { workingStart = 13; workingEnd = 17; }
    }

    // If closed today for the selected branch, return empty
    if (workingStart === null || workingEnd === null) {
      setAvailableWalkinSlots([]);
      setFormattedWalkinSlots([]);
      return;
    }
    // Only show the branch's working window for today
    const displayStart = workingStart;
    const displayEnd = workingEnd;

    let { data: booked, error } = await supabase
      .from('appointments')
      .select('id, appointment_time, branch')
      .eq('appointment_date', formattedDate)
      .eq('branch', branch)
      .neq('status', 'cancelled');
    if (error) return;

    // Also include patients already in the queue for this branch today
    const { data: queued, error: qErr } = await supabase
      .from('queue')
      .select('id, branch, status, created_at')
      .in('status', ['waiting', 'serving'])
      .eq('branch', branch)
      .gte('created_at', `${formattedDate}T00:00:00`)
      .lte('created_at', `${formattedDate}T23:59:59`);
    // Note: queue schema has no scheduled_time; queued entries are not used to block slots

    const blocked = new Set();
    const appointmentDuration = 30;
    booked.forEach(a => {
      const [hh, mm] = a.appointment_time.split(':').map(Number);
      const start = hh * 60 + mm;
      for (let i = 0; i < appointmentDuration; i += interval) {
        const t = start + i;
        const th = Math.floor(t / 60), tm = t % 60;
        blocked.add(`${th.toString().padStart(2, '0')}:${tm.toString().padStart(2, '0')}`);
      }
    });

    const all = [];
    const formatted = [];
    for (let h = displayStart; h < displayEnd; h++) {
      for (let m = 0; m < 60; m += interval) {
        const tStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const withinWorking = h >= workingStart && h < workingEnd;
        const isAvailable = withinWorking && !blocked.has(tStr);
        if (withinWorking) {
          all.push(tStr);
          formatted.push({ time: tStr, available: isAvailable, displayTime: formatTime(tStr), endTime: formatTime(calculateEndTime(tStr, 30)) });
        }
      }
    }
    setAvailableWalkinSlots(all);
    setFormattedWalkinSlots(formatted);
  };

  const fetchAvailableDoctors = async () => {
    try {
      const { data: doctors, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'doctor')
        .neq('disabled', true)
        .order('full_name');
      
      if (error) {
        console.error('Error fetching doctors:', error);
        return;
      }
      
      setAvailableDoctors(doctors || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  useEffect(() => {
    // Log page view
    logPageView('Doctor Queue Management', 'queue', 'management');
    
    // Clean up old sessionStorage entries from previous days
    const todayDate = getTodayDate();
    const globalAutoAddKey = `globalAutoAddProcessed_${todayDate}`;
    
    // Remove any old auto-add keys from previous days
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('globalAutoAddProcessed_') && key !== globalAutoAddKey) {
        sessionStorage.removeItem(key);
      }
    });
    
    // Clean up duplicate blocker entries from previous days
    cleanupDuplicateBlocker();
    
    // Clean up existing duplicates first, then fetch data
    cleanupExistingDuplicates().then(() => {
      fetchQueueData();
      fetchPatients();
      fetchAvailableDoctors(); // Fetch doctors on mount
    });
    
    // Set up real-time subscription for queue changes
    const queueSubscription = supabase
      .channel('public:queue')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'queue' 
      }, () => {
        console.log('Queue changed, refreshing...');
        // Only refresh data, don't trigger auto-add logic
        fetchQueueDataOnly();
      })
      .subscribe();
    
    // Set up real-time subscription for appointment changes (which affect queue)
    const appointmentSubscription = supabase
      .channel('public:appointments')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'appointments' 
      }, () => {
        console.log('Appointments changed, refreshing queue...');
        // Only refresh data, don't trigger auto-add logic
        fetchQueueDataOnly();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(queueSubscription);
      supabase.removeChannel(appointmentSubscription);
    };
  }, []);

  // Separate effect for branch changes - only fetch data, don't set up subscriptions
  useEffect(() => {
    fetchQueueData();
  }, [activeBranch]);

  // Set up periodic check for appointments that should be added to queue (1 hour before appointment time)
  useEffect(() => {
    const checkAppointmentsInterval = setInterval(() => {
      // Only check if we're not already auto-adding to prevent race conditions
      if (!isAutoAddingRef.current) {
        fetchQueueData();
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkAppointmentsInterval);
  }, []);

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Atomic auto-add function that prevents race conditions
  const atomicAutoAdd = async (missingAppointments, todayDate) => {
    // Check if auto-add is already in progress
    if (autoAddLockRef.current) {
      console.log('🚫 AUTO-ADD BLOCKED: Another auto-add process is already running');
      return { success: false, reason: 'already_running' };
    }

    // Check if auto-add has been processed today
    const globalAutoAddKey = `globalAutoAddProcessed_${todayDate}`;
    const hasAutoAddBeenProcessed = sessionStorage.getItem(globalAutoAddKey);
    
    if (hasAutoAddBeenProcessed === 'true') {
      console.log('🚫 AUTO-ADD BLOCKED: Auto-add already processed today');
      return { success: false, reason: 'already_processed' };
    }

    // Set atomic lock
    autoAddLockRef.current = true;
    sessionStorage.setItem(globalAutoAddKey, 'true');
    
    try {
      console.log(`🔒 ATOMIC AUTO-ADD: Processing ${missingAppointments.length} appointments`);
      
      let addedCount = 0;
      const processedPatients = new Set();
      
      // Process appointments with atomic duplicate checking
      for (const appointment of missingAppointments) {
        try {
          // Atomic duplicate check with database lock
          const isDuplicate = await atomicDuplicateCheck(appointment.patient_id, todayDate);
          if (isDuplicate) {
            console.log(`🚫 ATOMIC DUPLICATE BLOCKED: Patient ${appointment.patient_id} already processed`);
            continue;
          }
          
          // Mark as processed immediately to prevent race conditions
          processedPatients.add(appointment.patient_id);
          
          const result = await QueueService.addAppointmentToQueue(appointment, { 
            source: 'atomic_auto_add',
            timestamp: Date.now()
          });
          
          if (result.success) {
            addedCount++;
            console.log(`✅ ATOMIC ADD: Added appointment ${appointment.id} as #${result.queueNumber}`);
          } else {
            console.error(`❌ ATOMIC ADD FAILED: ${appointment.id} - ${result.error}`);
          }
        } catch (error) {
          console.error(`❌ ATOMIC ADD ERROR for appointment ${appointment.id}:`, error);
        }
      }
      
      console.log(`🔓 ATOMIC AUTO-ADD COMPLETE: Added ${addedCount} appointments`);
      return { success: true, addedCount, processedPatients: Array.from(processedPatients) };
      
    } catch (error) {
      console.error('❌ ATOMIC AUTO-ADD ERROR:', error);
      return { success: false, error: error.message };
    } finally {
      // Always release the lock
      autoAddLockRef.current = false;
    }
  };

  // Atomic duplicate check with database-level locking
  const atomicDuplicateCheck = async (patientId, todayDate) => {
    const duplicateKey = `${patientId}_${todayDate}`;
    
    // Check in-memory first (fastest)
    if (duplicateBlockerRef.current.has(duplicateKey)) {
      console.log(`🚫 ATOMIC DUPLICATE (Memory): Patient ${patientId} already processed`);
      return true;
    }
    
    // Check database with atomic operation
    try {
      const { data: existingEntries, error } = await supabase
        .from('queue')
        .select('id, status, created_at')
        .eq('patient_id', patientId)
        .in('status', ['waiting', 'serving'])
        .gte('created_at', `${todayDate}T00:00:00.000Z`)
        .lt('created_at', `${todayDate}T23:59:59.999Z`)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('Error in atomic duplicate check:', error);
        return false; // Allow if we can't check
      }
      
      if (existingEntries && existingEntries.length > 0) {
        console.log(`🚫 ATOMIC DUPLICATE (Database): Patient ${patientId} already in queue with status: ${existingEntries[0].status}`);
        return true;
      }
      
      // Mark as processed atomically
      duplicateBlockerRef.current.add(duplicateKey);
      console.log(`✅ ATOMIC MARK: Patient ${patientId} marked as processed`);
      return false;
      
    } catch (error) {
      console.error('Error in atomic duplicate check:', error);
      return false; // Allow if we can't check
    }
  };

  // Enhanced duplicate blocker function - prevents same patient from being added multiple times
  const isDuplicatePatient = async (patientId) => {
    const todayKey = getTodayDate();
    const duplicateKey = `${patientId}_${todayKey}`;
    
    // Check in-memory first
    if (duplicateBlockerRef.current.has(duplicateKey)) {
      console.log(`🚫 DUPLICATE BLOCKED (Memory): Patient ${patientId} already processed today`);
      return true;
    }
    
    // Check database for existing queue entries
    try {
      const { data: existingEntries, error } = await supabase
        .from('queue')
        .select('id, status')
        .eq('patient_id', patientId)
        .in('status', ['waiting', 'serving'])
        .gte('created_at', `${todayKey}T00:00:00.000Z`)
        .lt('created_at', `${todayKey}T23:59:59.999Z`);
      
      if (error) {
        console.error('Error checking for duplicates:', error);
        return false; // Allow if we can't check
      }
      
      if (existingEntries && existingEntries.length > 0) {
        console.log(`🚫 DUPLICATE BLOCKED (Database): Patient ${patientId} already in queue today with status: ${existingEntries[0].status}`);
        return true;
      }
    } catch (error) {
      console.error('Error in duplicate check:', error);
      return false; // Allow if we can't check
    }
    
    // Mark this patient as processed
    duplicateBlockerRef.current.add(duplicateKey);
    console.log(`✅ Patient ${patientId} marked as processed for today`);
    return false;
  };

  // Clean up existing duplicates in the database
  const cleanupExistingDuplicates = async () => {
    try {
      const todayKey = getTodayDate();
      console.log('🧹 Cleaning up existing duplicates for today:', todayKey);
      
      // Get all queue entries for today
      const { data: todayEntries, error } = await supabase
        .from('queue')
        .select('id, patient_id, status, created_at')
        .gte('created_at', `${todayKey}T00:00:00.000Z`)
        .lt('created_at', `${todayKey}T23:59:59.999Z`)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching today entries:', error);
        return;
      }
      
      if (!todayEntries || todayEntries.length === 0) {
        console.log('🧹 No entries found for today');
        return;
      }
      
      // Group by patient_id to find duplicates
      const patientGroups = {};
      todayEntries.forEach(entry => {
        if (!patientGroups[entry.patient_id]) {
          patientGroups[entry.patient_id] = [];
        }
        patientGroups[entry.patient_id].push(entry);
      });
      
      // Remove duplicates, keeping only the first entry for each patient
      const entriesToDelete = [];
      Object.keys(patientGroups).forEach(patientId => {
        const entries = patientGroups[patientId];
        if (entries.length > 1) {
          console.log(`🧹 Found ${entries.length} entries for patient ${patientId}, removing duplicates`);
          // Keep the first entry, mark others for deletion
          for (let i = 1; i < entries.length; i++) {
            entriesToDelete.push(entries[i].id);
          }
        }
      });
      
      // Delete duplicate entries
      if (entriesToDelete.length > 0) {
        console.log(`🧹 Deleting ${entriesToDelete.length} duplicate entries`);
        const { error: deleteError } = await supabase
          .from('queue')
          .delete()
          .in('id', entriesToDelete);
        
        if (deleteError) {
          console.error('Error deleting duplicates:', deleteError);
        } else {
          console.log(`✅ Successfully deleted ${entriesToDelete.length} duplicate entries`);
        }
      }
    } catch (error) {
      console.error('Error in cleanupExistingDuplicates:', error);
    }
  };

  // Clean up old duplicate blocker entries from previous days
  const cleanupDuplicateBlocker = () => {
    const todayKey = getTodayDate();
    const entriesToRemove = [];
    
    duplicateBlockerRef.current.forEach(key => {
      if (!key.endsWith(`_${todayKey}`)) {
        entriesToRemove.push(key);
      }
    });
    
    entriesToRemove.forEach(key => {
      duplicateBlockerRef.current.delete(key);
    });
    
    if (entriesToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${entriesToRemove.length} old duplicate blocker entries`);
    }
  };

  // Remove duplicate patients from the current queue display (client-side only)
  const removeDuplicatePatients = (patients) => {
    const seenPatients = new Set();
    const uniquePatients = [];
    
    patients.forEach(patient => {
      if (!seenPatients.has(patient.patient_id)) {
        seenPatients.add(patient.patient_id);
        uniquePatients.push(patient);
      } else {
        console.log(`🚫 Removed duplicate patient from display: ${patient.patient_name || patient.patientProfile?.full_name}`);
      }
    });
    
    return uniquePatients;
  };

  // Function to fetch queue data without auto-add logic (for real-time updates)
  const fetchQueueDataOnly = async () => {
    setIsLoading(true);
    try {
      const todayDate = getTodayDate();
      console.log('=== FETCHING QUEUE DATA (NO AUTO-ADD) ===');
      console.log('Today date:', todayDate);
      
      // Skip auto-add logic for real-time updates
      await fetchQueueDataInternal(todayDate, true);
    } catch (error) {
      console.error('Error fetching queue data:', error);
      toast.error('Failed to fetch queue data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchQueueData = async () => {
    setIsLoading(true);
    try {
      const todayDate = getTodayDate();
      console.log('=== FETCHING QUEUE DATA ===');
      console.log('Today date:', todayDate);
      console.log('User role:', user?.role);
      
      // Check if auto-add has already been processed today globally
      const globalAutoAddKey = `globalAutoAddProcessed_${todayDate}`;
      const hasAutoAddBeenProcessed = sessionStorage.getItem(globalAutoAddKey);
      
      console.log('Global auto-add check:', { globalAutoAddKey, hasAutoAddBeenProcessed });
      
      await fetchQueueDataInternal(todayDate, false, hasAutoAddBeenProcessed);
    } catch (error) {
      console.error('Error fetching queue data:', error);
      toast.error('Failed to fetch queue data');
    } finally {
      setIsLoading(false);
    }
  };

  // Internal function that handles the actual queue data fetching
  const fetchQueueDataInternal = async (todayDate, skipAutoAdd = false, hasAutoAddBeenProcessed = false) => {
    try {
      const globalAutoAddKey = `globalAutoAddProcessed_${todayDate}`;
      
      // Test database connection first
      console.log('=== TESTING DATABASE CONNECTION ===');
      const { data: testData, error: testError } = await supabase
        .from('queue')
        .select('count')
        .limit(1);
      
      console.log('Database connection test:', { testData, testError });
      
      // Test if queue table exists and has data
      const { data: tableTest, error: tableError } = await supabase
        .from('queue')
        .select('*')
        .limit(1);
      
      console.log('Queue table test:', { tableTest, tableError });
      console.log('Queue table has data:', tableTest?.length > 0);
      
      // First, fetch all services
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*');
        
      if (servicesError) {
        console.error('Error fetching services:', servicesError);
        throw servicesError;
      }
      
      const servicesMap = {};
      if (servicesData) {
        servicesData.forEach(service => {
          servicesMap[service.id] = service;
        });
      }
      
             // Fetch today's confirmed/appointed appointments - these should be auto-integrated into queue
       const { data: todayAppointments, error: appointmentsError } = await supabase
         .from('appointments')
         .select(`
           id, 
           patient_id,
           doctor_id,
           appointment_date,
           appointment_time,
           status,
           notes,
           teeth_involved,
           branch,
           created_at,
           updated_at
         `)
         .eq('appointment_date', todayDate)
         .in('status', ['confirmed', 'appointed'])
         .order('appointment_time', { ascending: true });
      
      if (appointmentsError) {
        console.error('Error fetching today\'s appointments:', appointmentsError);
        throw appointmentsError;
      }
      
             console.log(`Found ${todayAppointments?.length || 0} confirmed/appointed appointments for today`);
      
      // Fetch patient profiles for appointments
      const appointmentPatientIds = [...new Set((todayAppointments || []).map(a => a.patient_id))];
      let appointmentPatientProfiles = {};
      
      if (appointmentPatientIds.length > 0) {
        const { data: patientProfilesData, error: patientProfilesError } = await supabase
          .from('profiles')
          .select('id, full_name, phone, email')
          .in('id', appointmentPatientIds);
          
        if (patientProfilesError) {
          console.error('Error fetching patient profiles:', patientProfilesError);
        } else if (patientProfilesData) {
          patientProfilesData.forEach(profile => {
            appointmentPatientProfiles[profile.id] = profile;
          });
        }
      }
      
      // Fetch doctor profiles for appointments that have assigned doctors
      const doctorIds = [...new Set((todayAppointments || []).map(a => a.doctor_id).filter(Boolean))];
      let doctorProfiles = {};
      
      if (doctorIds.length > 0) {
        const { data: doctorProfilesData, error: doctorProfilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', doctorIds);
          
        if (doctorProfilesError) {
          console.error('Error fetching doctor profiles:', doctorProfilesError);
        } else if (doctorProfilesData) {
          doctorProfilesData.forEach(profile => {
            doctorProfiles[profile.id] = profile;
          });
        }
      }
      
      // Fetch appointment services for today's appointments
      const appointmentIds = (todayAppointments || []).map(a => a.id);
      let appointmentServicesData = [];
      
      if (appointmentIds.length > 0) {
        const { data: servicesJoinData, error: servicesJoinError } = await supabase
          .from('appointment_services')
          .select('appointment_id, service_id')
          .in('appointment_id', appointmentIds);
          
        if (servicesJoinError) {
          console.error('Error fetching appointment services:', servicesJoinError);
        } else if (servicesJoinData) {
          appointmentServicesData = servicesJoinData;
        }
      }
      
      // Process appointments to include full service information
      const processedAppointments = {};
      if (todayAppointments && todayAppointments.length > 0) {
        todayAppointments.forEach(appointment => {
          const services = [];
          const patientProfile = appointmentPatientProfiles[appointment.patient_id];
          
          // Get services for this appointment
          const appointmentServices = appointmentServicesData.filter(as => as.appointment_id === appointment.id);
          
          if (appointmentServices.length > 0) {
            appointmentServices.forEach(as => {
              const service = servicesMap[as.service_id];
              if (service) {
                services.push({
                  id: service.id,
                  name: service.name,
                  description: service.description,
                  price: service.price,
                  duration: service.duration || 30
                });
              }
            });
          }
          
          // Fallback services if none found
          if (services.length === 0) {
            if (appointment.teeth_involved && appointment.teeth_involved.trim() !== '') {
              services.push({
                name: `Treatment for: ${appointment.teeth_involved}`,
                description: appointment.notes || '',
                price: '500',
                duration: 30
              });
            } else if (appointment.notes && appointment.notes.trim() !== '') {
              services.push({
                name: appointment.notes,
                description: '',
                price: '500',
                duration: 30
              });
            } else {
              services.push({
                name: 'Dental Consultation',
                description: 'General dental consultation',
                price: '500',
                duration: 30
              });
            }
          }
          
          processedAppointments[appointment.id] = {
            ...appointment,
            enrichedServices: services,
            patientProfile: patientProfile,
            doctorProfile: appointment.doctor_id ? doctorProfiles[appointment.doctor_id] : null
          };
        });
      }
      
      // Fetch current queue entries
      console.log('=== DEBUG: Fetching active queue entries ===');
      const { data: queueData, error: queueError } = await supabase
        .from('queue')
        .select(`
          id, 
          patient_id,
          appointment_id,
          queue_number,
          status,
          branch,
          estimated_wait_time,
          created_at,
          updated_at,
          notes
        `)
        .in('status', ['waiting', 'serving'])
        .order('queue_number', { ascending: true });
      
      console.log('=== DEBUG: Queue query result ===');
      console.log('Queue data:', queueData);
      console.log('Queue error:', queueError);
      console.log('Queue entries found:', queueData?.length || 0);
      
      if (queueError) {
        console.error('Error fetching queue data:', queueError);
        throw queueError;
      }
      
      console.log(`Found ${queueData?.length || 0} active queue entries (waiting/serving)`);
      
             // Check for today's confirmed/appointed appointments that should be in queue but aren't
       const currentQueue = queueData || [];
       const queuePatientIds = new Set(currentQueue.map(q => q.patient_id));
       const queueAppointmentIds = new Set(currentQueue.map(q => q.appointment_id).filter(Boolean));
       
       console.log('Current queue patient IDs:', Array.from(queuePatientIds));
       console.log('Current queue appointment IDs:', Array.from(queueAppointmentIds));
       
       const missingAppointments = [];
       const appointmentsToRemove = [];
       const now = new Date();
       
       Object.values(processedAppointments).forEach(appointment => {
         // Only add confirmed/appointed appointments to queue
         if (appointment.status === 'confirmed' || appointment.status === 'appointed') {
           const isAppointmentInQueue = queueAppointmentIds.has(appointment.id);
           const isPatientInQueue = queuePatientIds.has(appointment.patient_id);
           
           // Check if appointment should be added to queue (1 hour before appointment time)
           let shouldAddToQueue = false;
           if (appointment.appointment_time) {
             const [hours, minutes] = appointment.appointment_time.split(':').map(Number);
             const appointmentDateTime = new Date();
             appointmentDateTime.setHours(hours, minutes, 0, 0);
             
             // Add 1 hour before appointment time
             const oneHourBefore = new Date(appointmentDateTime.getTime() - (60 * 60 * 1000));
             
             // Only add if current time is within 1 hour of appointment time (but not exactly at 1 hour)
             shouldAddToQueue = now > oneHourBefore;
             
             console.log(`Appointment ${appointment.id} timing check:`, {
               appointmentTime: appointment.appointment_time,
               appointmentDateTime: appointmentDateTime.toISOString(),
               oneHourBefore: oneHourBefore.toISOString(),
               currentTime: now.toISOString(),
               shouldAddToQueue
             });
           }
           
           console.log(`Checking appointment ${appointment.id} for patient ${appointment.patient_id}:`, {
             status: appointment.status,
             isAppointmentInQueue,
             isPatientInQueue,
             shouldAddToQueue,
             patientName: appointment.patientProfile?.full_name
           });
           
           if (!isAppointmentInQueue && !isPatientInQueue && shouldAddToQueue) {
             console.log(`Appointment ${appointment.id} for patient ${appointment.patient_id} (${appointment.patientProfile?.full_name}) should be in queue but isn't - adding to missing list`);
             missingAppointments.push(appointment);
           }
           
           // Check if appointment is in queue but shouldn't be (too early)
           if ((isAppointmentInQueue || isPatientInQueue) && !shouldAddToQueue) {
             console.log(`Appointment ${appointment.id} for patient ${appointment.patient_id} (${appointment.patientProfile?.full_name}) is in queue but shouldn't be yet - adding to removal list`);
             appointmentsToRemove.push(appointment);
           }
         }
       });
       
       // Remove appointments that are in queue but shouldn't be yet (too early)
       if (appointmentsToRemove.length > 0 && !isAutoAddingRef.current) {
         console.log(`Removing ${appointmentsToRemove.length} appointments that were added too early to queue`);
         
         let removedCount = 0;
         isAutoAddingRef.current = true;
         
         for (const appointment of appointmentsToRemove) {
           try {
             // Find the queue entry for this appointment
             const queueEntry = currentQueue.find(q => 
               q.appointment_id === appointment.id || q.patient_id === appointment.patient_id
             );
             
             if (queueEntry) {
               const { error } = await supabase
                 .from('queue')
                 .delete()
                 .eq('id', queueEntry.id);
               
               if (error) {
                 console.error(`Error removing queue entry ${queueEntry.id}:`, error);
               } else {
                 removedCount++;
                 console.log(`Successfully removed queue entry ${queueEntry.id} for appointment ${appointment.id}`);
               }
             }
           } catch (error) {
             console.error(`Error removing appointment ${appointment.id} from queue:`, error);
           }
         }
         
         isAutoAddingRef.current = false;
         if (removedCount > 0) {
           const todayKey = getTodayDate();
           if (autoAddToastKeyRef.current !== todayKey) {
             autoAddToastKeyRef.current = todayKey;
             toast.info(`Removed ${removedCount} appointments that were added too early to today's queue`);
           }
           return; // Refresh the data after removal
         }
       }
       
       // Auto-add missing confirmed/appointed appointments to queue
       // ONLY DOCTORS can auto-add appointments to prevent duplication
       // Staff and Admin roles will only see the queue, not add to it
       if (missingAppointments.length > 0 && !isAutoAddingRef.current && !hasAutoAddBeenProcessed && !skipAutoAdd && user?.role === 'doctor') {
         console.log(`👨‍⚕️ DOCTOR ROLE: Auto-adding ${missingAppointments.length} confirmed/appointed appointments to queue`);
         
         // Mark that auto-add is being processed globally
         sessionStorage.setItem(globalAutoAddKey, 'true');
         
         let addedCount = 0;
         isAutoAddingRef.current = true;
         
         // Process appointments sequentially to prevent race conditions in queue numbering
         for (const appointment of missingAppointments) {
           try {
             // 🚫 DUPLICATE BLOCKER: Check if this patient has already been processed today
             if (await isDuplicatePatient(appointment.patient_id)) {
               console.log(`🚫 Skipping duplicate patient ${appointment.patient_id} (${appointment.patientProfile?.full_name})`);
               continue;
             }
             
             const result = await QueueService.addAppointmentToQueue(appointment, { source: 'doctor_queue_management' });
             if (result.success) {
               addedCount++;
               console.log(`✅ Successfully added appointment ${appointment.id} to queue as #${result.queueNumber || 'unknown'}`);
             } else {
               console.error(`❌ Failed to add appointment ${appointment.id} to queue:`, result.error);
             }
           } catch (error) {
             console.error(`❌ Error adding appointment ${appointment.id} to queue:`, error);
           }
         }
         isAutoAddingRef.current = false;
         if (addedCount > 0) {
           const todayKey = getTodayDate();
           if (autoAddToastKeyRef.current !== todayKey) {
             autoAddToastKeyRef.current = todayKey;
             toast.success(`Auto-added ${addedCount} confirmed/appointed appointments to today's queue`);
           }
           return;
         }
       } else if (missingAppointments.length > 0 && user?.role !== 'doctor') {
         console.log(`🚫 ${user?.role?.toUpperCase()} ROLE: Auto-add blocked - only doctors can auto-add appointments to prevent duplication`);
       }
      
      // Fetch patient profiles for queue entries
      const queuePatientIds_array = [...new Set(currentQueue.map(q => q.patient_id))];
      let queuePatientProfiles = {};
      
      if (queuePatientIds_array.length > 0) {
        const { data: queueProfilesData, error: queueProfilesError } = await supabase
          .from('profiles')
          .select('id, full_name, phone, email')
          .in('id', queuePatientIds_array);
          
        if (queueProfilesError) {
          console.error('Error fetching queue patient profiles:', queueProfilesError);
        } else if (queueProfilesData) {
          queueProfilesData.forEach(profile => {
            queuePatientProfiles[profile.id] = profile;
          });
        }
      }
      
      // Format queue data with appointment information
      let formattedQueue = [];
      
      if (currentQueue.length > 0) {
        formattedQueue = currentQueue.map(item => {
          // Find matching appointment data
          const matchingAppointment = item.appointment_id ? 
            processedAppointments[item.appointment_id] : null;
          
          // If no specific appointment, look for any appointment for this patient today
          const fallbackAppointment = !matchingAppointment ? 
            Object.values(processedAppointments).find(a => a.patient_id === item.patient_id) : null;
          
          const appointmentData = matchingAppointment || fallbackAppointment;
          const patientProfile = queuePatientProfiles[item.patient_id] || appointmentData?.patientProfile;
          
          // Get doctor profile from appointment data or queue notes
          let doctorProfile = appointmentData?.doctorProfile;
          
          // If no doctor from appointment, check queue notes for walk-in patients
          if (!doctorProfile && item.notes) {
            const doctorMatch = item.notes.match(/Doctor: Dr\. ([^|\n]+)/);
            if (doctorMatch) {
              const doctorName = doctorMatch[1].trim();
              doctorProfile = { full_name: doctorName };
            }
          }
          
          // Determine services
          let services = [];
          if (appointmentData && appointmentData.enrichedServices) {
            services = appointmentData.enrichedServices;
          } else {
            // Default label for walk-ins without pricing
            services = [{
              name: 'Walk-in Consultation',
              description: 'General dental consultation'
            }];
          }
          
          return {
            id: item.id,
            patientId: item.patient_id,
            appointmentId: item.appointment_id,
            queueNumber: item.queue_number,
            status: item.status,
            name: patientProfile?.full_name || 'Unknown',
            phone: patientProfile?.phone || 'N/A',
            email: patientProfile?.email || 'N/A',
            waitingTime: calculateWaitingTime(item.created_at, item.status, appointmentData?.appointment_time, appointmentData?.appointment_date, item.updated_at),
            services: services,
            appointmentData: appointmentData,
            isFromAppointment: !!item.appointment_id,
            branch: appointmentData?.branch || item.branch || 'Walk-in',
            createdDate: new Date(item.created_at).toLocaleDateString(),
            doctorName: doctorProfile?.full_name || 'N/A',
            doctorId: doctorProfile?.id || null,
            appointmentTime: appointmentData?.appointment_time ? formatTime(appointmentData.appointment_time) : null
          };
        });
      }
      
      // Apply branch filtering if a specific branch is selected
      if (activeBranch !== 'all') {
        const branchName = activeBranch === 'cabugao' ? 'Cabugao' : 'San Juan';
        formattedQueue = formattedQueue.filter(item => item.branch === branchName);
      }
      
      // Set current patients and waiting list
      const serving = formattedQueue.filter(p => p.status === 'serving');
      const waiting = formattedQueue.filter(p => p.status === 'waiting');
      
      // 🚫 Remove duplicate patients from display
      const uniqueWaiting = removeDuplicatePatients(waiting);
      const uniqueServing = removeDuplicatePatients(serving);
      
      setServingPatients(uniqueServing);
      setWaitingPatients(uniqueWaiting);
      
      // Keep selectedPatient for backward compatibility (first serving patient)
      if (serving.length > 0) {
        setSelectedPatient(serving[0]);
      } else {
        setSelectedPatient(null);
      }
      
      console.log(`Queue setup complete: ${formattedQueue.length} total, ${serving.length} serving, ${waiting.length} waiting`);
      
      // Fetch today's activity logs
      await fetchTodayActivity(todayDate);
      
    } catch (error) {
      console.error('Error in fetchQueueData:', error);
      toast.error('Failed to load queue data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };


  const fetchTodayActivity = async (todayDate) => {
    try {
      console.log('=== FETCHING ACTIVITY LOGS ===');
      console.log('Date:', todayDate);
      console.log('Date range start:', `${todayDate}T00:00:00`);
      console.log('Date range end:', `${todayDate}T23:59:59`);
      
      // Get unique queue entries for today (remove duplicates by patient_id)
      const { data: todayQueueEntries, error: queueError } = await supabase
        .from('queue')
        .select(`
          id, 
          patient_id,
          queue_number,
          status,
          created_at,
          profiles!queue_patient_id_fkey(id, full_name)
        `)
        .gte('created_at', `${todayDate}T00:00:00.000Z`)
        .lt('created_at', `${todayDate}T23:59:59.999Z`)
        .order('created_at', { ascending: false });
      
      if (queueError) {
        console.error('Error fetching queue entries:', queueError);
        setActivityLogs([]);
        return;
      }
      
      // Remove duplicates by patient_id, keeping only the first (most recent) entry
      const uniqueEntries = [];
      const seenPatients = new Set();
      
      if (todayQueueEntries) {
        todayQueueEntries.forEach(entry => {
          if (!seenPatients.has(entry.patient_id)) {
            seenPatients.add(entry.patient_id);
            uniqueEntries.push(entry);
          }
        });
      }
      
      console.log(`Found ${todayQueueEntries?.length || 0} total entries, ${uniqueEntries.length} unique patients`);
      
      // First, let's check if there are ANY queue entries at all
      const { data: anyQueueEntries, error: queueError2 } = await supabase
        .from('queue')
        .select(`
          id, 
          patient_id,
          queue_number,
          status,
          created_at,
          profiles!queue_patient_id_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);
      
      console.log('=== DEBUG: All queue entries (any date) ===');
      console.log('Raw query result:', anyQueueEntries);
      console.log('Query error:', queueError);
      console.log('Total entries found:', anyQueueEntries?.length || 0);
      
      if (queueError) {
        console.error('Error fetching queue entries:', queueError);
        return;
      }
      
      // Now try the specific date query with proper patient name fetching
      const { data: todayQueueEntries2, error: todayError } = await supabase
        .from('queue')
        .select(`
          id, 
          patient_id,
          appointment_id,
          queue_number,
          status,
          branch,
          created_at,
          updated_at,
          profiles!queue_patient_id_fkey(id, full_name)
        `)
        .gte('created_at', `${todayDate}T00:00:00`)
        .lte('created_at', `${todayDate}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(200);
      
      console.log('=== DEBUG: Today-specific queue entries ===');
      console.log('Today query result:', todayQueueEntries2);
      console.log('Today query error:', todayError);
      console.log('Today entries found:', todayQueueEntries2?.length || 0);
      
      // Debug patient data specifically
      if (todayQueueEntries2 && todayQueueEntries2.length > 0) {
        console.log('=== DEBUG: Patient data in today entries ===');
        todayQueueEntries2.forEach((entry, index) => {
          console.log(`Entry ${index}:`, {
            id: entry.id,
            patient_id: entry.patient_id,
            queue_number: entry.queue_number,
            profiles: entry.profiles,
            patient_name: entry.profiles?.full_name || 'NO NAME FOUND'
          });
        });
      }
      
      if (todayError) {
        console.error('Error fetching today queue entries:', todayError);
        return;
      }
      
      // Use today's entries if available, otherwise use all entries
      let allQueueEntries = todayQueueEntries2 || [];
      console.log('Using queue entries:', allQueueEntries);
      
      // If no data found, let's try a broader search
      if (allQueueEntries.length === 0) {
        console.log('=== NO DATA FOUND - TRYING BROADER SEARCH ===');
        
        // Try without date filter with proper patient name fetching
        const { data: allTimeEntries, error: allTimeError } = await supabase
          .from('queue')
          .select(`
            id, 
            patient_id,
            appointment_id,
            queue_number,
            status,
            branch,
            created_at,
            updated_at,
            profiles!queue_patient_id_fkey(id, full_name)
          `)
          .order('created_at', { ascending: false })
          .limit(50);
        
        console.log('All-time queue entries:', allTimeEntries);
        console.log('All-time error:', allTimeError);
        
        if (allTimeEntries && allTimeEntries.length > 0) {
          console.log('Found historical data, using it for activity log');
          allQueueEntries = allTimeEntries;
        } else {
          console.log('No queue data found at all - database might be empty');
          setActivityLogs([]);
          return;
        }
      }
      
      // Get appointment data for queue entries that have appointment_id
      const appointmentIds = allQueueEntries?.filter(item => item.appointment_id).map(item => item.appointment_id) || [];
      let appointmentData = {};
      
      if (appointmentIds.length > 0) {
        const { data: appointments, error: appointmentError } = await supabase
          .from('appointments')
          .select('id, branch')
          .in('id', appointmentIds);
          
        if (appointmentError) {
          console.error('Error fetching appointment data:', appointmentError);
        } else if (appointments) {
          appointments.forEach(appointment => {
            appointmentData[appointment.id] = appointment;
          });
        }
      }
      
      // Fallback: If patient names are missing, fetch them manually
      const patientIds = allQueueEntries?.map(item => item.patient_id).filter(Boolean) || [];
      let patientData = {};
      
      if (patientIds.length > 0) {
        console.log('=== DEBUG: Fetching patient names manually ===');
        console.log('Patient IDs to fetch:', patientIds);
        
        const { data: patients, error: patientError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', patientIds);
          
        console.log('Manual patient fetch result:', patients);
        console.log('Manual patient fetch error:', patientError);
        
        if (patientError) {
          console.error('Error fetching patient data manually:', patientError);
        } else if (patients) {
          patients.forEach(patient => {
            patientData[patient.id] = patient;
          });
          console.log('Patient data map:', patientData);
        }
      }
      
      // Process all queue entries to create activity logs
      let activityLogs = [];
      
      allQueueEntries?.forEach(item => {
        // Determine branch: use queue branch, then appointment branch, then default
        let branch = item.branch;
        if (!branch && item.appointment_id && appointmentData[item.appointment_id]) {
          branch = appointmentData[item.appointment_id].branch;
        }
        if (!branch) {
          branch = 'Not specified';
        }
        
        // Create activity log entry based on current status
        // Try to get patient name from multiple sources
        let patientName = 'Unknown Patient';
        
        if (item.profiles?.full_name) {
          patientName = item.profiles.full_name;
        } else if (patientData[item.patient_id]?.full_name) {
          patientName = patientData[item.patient_id].full_name;
        } else {
          console.log(`No patient name found for patient_id: ${item.patient_id}`);
        }
        
        let logEntry = {
          id: item.id,
          patientName: patientName,
          queueNumber: item.queue_number,
          branch: branch,
          originalStatus: item.status
        };
        
        // Determine timestamp and display status based on current status
        if (item.status === 'waiting') {
          logEntry.status = 'added to queue';
          logEntry.timestamp = new Date(item.created_at).toLocaleString();
        } else if (item.status === 'serving') {
          logEntry.status = 'called';
          logEntry.timestamp = new Date(item.updated_at).toLocaleString();
        } else if (item.status === 'completed') {
          logEntry.status = 'completed';
          logEntry.timestamp = new Date(item.updated_at).toLocaleString();
        } else if (item.status === 'cancelled') {
          logEntry.status = 'cancelled';
          logEntry.timestamp = new Date(item.updated_at).toLocaleString();
        } else if (item.status === 'rejected') {
          logEntry.status = 'cancelled';
          logEntry.timestamp = new Date(item.updated_at).toLocaleString();
          logEntry.originalStatus = 'rejected';
        }
        
        activityLogs.push(logEntry);
      });
      
      // Sort by timestamp (most recent first)
      activityLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      console.log('Processed activity logs:', activityLogs);
      
      // Apply branch filtering to activity logs
      if (activeBranch !== 'all') {
        const branchName = activeBranch === 'cabugao' ? 'Cabugao' : 'San Juan';
        activityLogs = activityLogs.filter(log => log.branch === branchName);
        console.log('Filtered logs for branch', branchName, ':', activityLogs);
      }
      
      setActivityLogs(activityLogs);
      console.log('Final activity logs set:', activityLogs);
      
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    }
  };
  
  const calculateWaitingTime = (createdAt, status, appointmentTime, appointmentDate, updatedAt) => {
    const now = new Date();
    
    // If patient is being served, freeze the waiting time at when they started being served
    if (status === 'serving' && updatedAt) {
      // For serving patients, calculate total waiting time from when they started being served
      // Use updated_at (when status changed to 'serving') to freeze the time
      const servingStart = new Date(updatedAt);
      const diffMs = servingStart - new Date(createdAt);
      return Math.floor(diffMs / (1000 * 60)); // This is the frozen waiting time
    }
    
    // For waiting patients, calculate from their appointment time if they have one
    if (appointmentTime && appointmentDate) {
      const today = getTodayDate();
      if (appointmentDate === today) {
        // Parse appointment time (format: "HH:MM")
        const [hours, minutes] = appointmentTime.split(':').map(Number);
        const appointmentDateTime = new Date();
        appointmentDateTime.setHours(hours, minutes, 0, 0);
        
        // If appointment time has passed, start counting from appointment time
        if (now > appointmentDateTime) {
          const diffMs = now - appointmentDateTime;
          return Math.floor(diffMs / (1000 * 60));
        } else {
          // Appointment time hasn't come yet
          return 0;
        }
      }
    }
    
    // Fallback: calculate from when they were added to queue
    const created = new Date(createdAt);
    const diffMs = now - created;
    return Math.floor(diffMs / (1000 * 60)); // Convert ms to minutes
  };
  
  const fetchPatients = async () => {
    try {
      const todayDate = getTodayDate();
      
      // Fetch patients with today's appointments first
      const { data: todayAppointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          patient_id,
          appointment_time,
          profiles:patient_id(id, full_name, phone, email)
        `)
        .eq('appointment_date', todayDate)
        .in('status', ['confirmed', 'in_progress'])
        .order('appointment_time');
      
      if (appointmentsError) throw appointmentsError;
      
      // Fetch all patients
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email, disabled')
        .eq('role', 'patient')
        .neq('disabled', true)
        .order('full_name');
      
      if (error) throw error;
      
      let priorityPatients = [];
      let otherPatients = [];
      
      if (data) {
        data.forEach(patient => {
          const hasAppointment = todayAppointments?.some(
            appointment => appointment.patient_id === patient.id
          );
          
          if (hasAppointment) {
            priorityPatients.push({
              ...patient,
              hasAppointment: true
            });
          } else {
            otherPatients.push({
              ...patient,
              hasAppointment: false
            });
          }
        });
        
        setPatientsList([...priorityPatients, ...otherPatients]);
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Failed to load patient list');
    }
  };
  
  const callNextPatient = async () => {
    if (waitingPatients.length === 0) {
      toast.info('No patients in waiting queue');
      return;
    }
    
    const nextPatient = waitingPatients[0];
    
    try {
      const { error } = await supabase
        .from('queue')
        .update({ 
          status: 'serving',
          updated_at: new Date().toISOString() // Track when serving started
        })
        .eq('id', nextPatient.id);
      
      if (error) throw error;
      
      if (nextPatient.appointmentId) {
        const { error: appointmentError } = await supabase
          .from('appointments')
          .update({ status: 'in_progress' })
          .eq('id', nextPatient.appointmentId);
        
        if (appointmentError) {
          console.error('Could not update appointment status:', appointmentError);
        }
      }
      
      setSelectedPatient(nextPatient);
      setWaitingPatients(waitingPatients.slice(1));
      
      const newLog = {
        id: Date.now(),
        patientName: nextPatient.name,
        queueNumber: nextPatient.queueNumber,
        status: 'called',
        timestamp: new Date().toLocaleString()
      };
      setActivityLogs([newLog, ...activityLogs]);
      
      toast.success(`Now serving: ${nextPatient.name}`);
    } catch (error) {
      console.error('Error calling next patient:', error);
      toast.error('Failed to call next patient');
    }
  };
  
  const callPatient = async (patient) => {
    try {
      // Check if patient is already being served
      const isAlreadyServing = servingPatients.some(p => p.id === patient.id);
      if (isAlreadyServing) {
        toast.info('Patient is already being served');
        return;
      }
      
      const { error } = await supabase
        .from('queue')
        .update({ 
          status: 'serving',
          updated_at: new Date().toISOString() // Track when serving started
        })
        .eq('id', patient.id);
      
      if (error) throw error;
      
      if (patient.appointmentId) {
        const { error: appointmentError } = await supabase
          .from('appointments')
          .update({ status: 'in_progress' })
          .eq('id', patient.appointmentId);
        
        if (appointmentError) {
          console.error('Could not update appointment status:', appointmentError);
        }
      }
      
      await fetchQueueData();
      
      const newLog = {
        id: Date.now(),
        patientName: patient.name,
        queueNumber: patient.queueNumber,
        status: 'called',
        timestamp: new Date().toLocaleString()
      };
      setActivityLogs([newLog, ...activityLogs]);
      
      toast.success(`Now serving: ${patient.name}`);
    } catch (error) {
      console.error('Error calling patient:', error);
      toast.error('Failed to call patient');
      fetchQueueData();
    }
  };
  
  // Enhanced completion with auto-invoice generation for specific patient
  const completeSpecificPatient = async (patient) => {
    if (!patient) return;
    
    setCompletingPatient(true);
    
    try {
      const { error } = await supabase
        .from('queue')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', patient.id);
      
      if (error) throw error;
      
      if (patient.appointmentId) {
        const { error: appointmentError } = await supabase
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', patient.appointmentId);
        
        if (appointmentError) {
          console.error('Could not update appointment status:', appointmentError);
        }
      } else {
        // No linked appointment (likely a walk-in). Create a completed appointment record
        try {
          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const dd = String(today.getDate()).padStart(2, '0');
          const dateStr = `${yyyy}-${mm}-${dd}`;
          const hh = String(today.getHours()).padStart(2, '0');
          const min = String(today.getMinutes()).padStart(2, '0');
          const timeStr = `${hh}:${min}`;

          // Build a simple notes summary from services
          const serviceSummary = (patient.services || [])
            .map(s => s.name)
            .filter(Boolean)
            .join(', ');

          const { error: insertApptErr } = await supabase
            .from('appointments')
            .insert([
              {
                patient_id: patient.patientId,
                doctor_id: user?.id || null,
                appointment_date: dateStr,
                appointment_time: timeStr,
                status: 'completed',
                branch: patient.branch || null,
                notes: serviceSummary ? `Walk-in from queue: ${serviceSummary}` : 'Walk-in from queue',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ]);

          if (insertApptErr) {
            console.error('Failed to create completed appointment for walk-in:', insertApptErr);
          }
        } catch (e) {
          console.error('Unexpected error creating completed appointment for walk-in:', e);
        }
      }
      
      const completedPatient = {
        ...patient,
        completedAt: new Date().toISOString()
      };
      
      setCompletedPatientData(completedPatient);
      
      const items = patient.services
        .filter(service => typeof service.price !== 'undefined' && service.price !== null)
        .map(service => ({
          service_name: service.name,
          description: service.description || service.name,
          quantity: 1,
          price: parseFloat(service.price) || 0,
          total: parseFloat(service.price) || 0
        }));
      
      setInvoiceItems(items);
      
      const total = items.reduce((sum, item) => sum + item.total, 0);
      setInvoiceTotal(total);
      
      // Set default doctor selection
      setSelectedDoctorForInvoice(patient.doctorName ? 'assigned' : '');
      
      setShowInvoiceModal(true);
      
      toast.success(`Completed session for: ${patient.name}`);
      
      const newLog = {
        id: Date.now(),
        patientName: patient.name,
        queueNumber: patient.queueNumber,
        status: 'completed',
        timestamp: new Date().toLocaleString()
      };
      setActivityLogs([newLog, ...activityLogs.slice(0, 9)]);
      
      setSelectedPatient(null);
    } catch (error) {
      console.error('Error completing patient session:', error);
      toast.error('Failed to complete patient session');
    } finally {
      setCompletingPatient(false);
    }
  };

  // Backward compatibility function
  const completeCurrentPatient = async () => {
    if (!selectedPatient) return;
    await completeSpecificPatient(selectedPatient);
  };
  
  // Generate invoice after service completion
  const generateInvoiceForCompletedPatient = async () => {
    if (!completedPatientData) return;
    
    // Prevent multiple invoice generation
    if (isGeneratingInvoice) {
      console.log('Invoice generation already in progress, skipping...');
      return;
    }
    
    setIsGeneratingInvoice(true);
    
    try {
      
      const generateInvoiceNumber = () => {
        const date = new Date();
        const year = date.getFullYear().toString().substr(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        return `INV-${year}${month}${day}-${random}`;
      };
      
      // Always use the assigned doctor for invoice, regardless of who completed the patient
      let doctorInfo = '';
      if (completedPatientData?.doctorName) {
        // Try to resolve id from available doctors by name if not provided
        const matched = availableDoctors.find(d => d.full_name === completedPatientData.doctorName);
        const assignedDoctorId = completedPatientData.doctorId || matched?.id || '';
        doctorInfo = ` - Doctor: Dr. ${completedPatientData.doctorName}${assignedDoctorId ? ` | DoctorId: ${assignedDoctorId}` : ''}`;
        console.log('Using assigned doctor for invoice:', completedPatientData.doctorName, assignedDoctorId ? `(id ${assignedDoctorId})` : '');
        console.log('Current doctor completing:', user?.full_name || 'Unknown');
      } else {
        console.log('No assigned doctor found for invoice');
      }

      console.log('Selected doctor for invoice:', selectedDoctorForInvoice);
      console.log('Available doctors:', availableDoctors);
      console.log('Completed patient data:', completedPatientData);

      const invoiceData = {
        invoice_number: generateInvoiceNumber(),
        invoice_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        patient_id: completedPatientData.patientId,
        total_amount: invoiceTotal,
        amount_paid: 0,
        status: 'pending',
        payment_method: '',
        notes: `Services completed on ${new Date().toLocaleDateString()} - Queue #${completedPatientData.queueNumber}${doctorInfo}`,
        subtotal: invoiceTotal,
        discount: 0,
        tax: 0,
        created_at: new Date().toISOString(),
        created_by: user?.id || completedPatientData.patientId
      };
      
      console.log('Creating invoice with data:', invoiceData);
      console.log('Final notes field:', invoiceData.notes);
      console.log('Doctor ID (created_by):', user?.id);
      
      const { data: invoiceResult, error: invoiceError } = await supabase
        .from('invoices')
        .insert([invoiceData])
        .select('id');
      
      if (invoiceError) {
        console.error('Invoice creation error:', invoiceError);
        throw invoiceError;
      }
      
      const invoiceId = invoiceResult[0].id;
      console.log('Invoice created successfully with ID:', invoiceId);
      
      const invoiceItemsData = invoiceItems.map(item => ({
        invoice_id: invoiceId,
        service_name: item.service_name,
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        discount: 0,
        created_at: new Date().toISOString()
      }));
      
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItemsData);
      
      if (itemsError) throw itemsError;
      
      toast.success(`Invoice ${invoiceData.invoice_number} generated successfully!`);
      
      setShowInvoiceModal(false);
      setCompletedPatientData(null);
      setInvoiceItems([]);
      setInvoiceTotal(0);
      
      fetchQueueData();
      
      // Redirect to invoices page
      navigate('/doctor/billing');
      
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast.error('Failed to generate invoice: ' + error.message);
    } finally {
      setIsGeneratingInvoice(false);
    }
  };
  
  const completePatient = async () => {
    await completeCurrentPatient();
  };
  
  const openCancelModal = () => {
    if (!selectedPatient) return;
    setPatientToCancel(selectedPatient);
    setShowCancelModal(true);
  };
  
  const confirmCancelPatient = async () => {
    if (!patientToCancel) return;
    
    try {
      const { error } = await supabase
        .from('queue')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', patientToCancel.id);
      
      if (error) throw error;

      // If this queue entry originated from an appointment, also reject that appointment
      if (patientToCancel.appointmentId) {
        try {
          const { error: apptErr } = await supabase
            .from('appointments')
            .update({ status: 'rejected', updated_at: new Date().toISOString() })
            .eq('id', patientToCancel.appointmentId);
          if (apptErr) {
            console.error('Failed updating appointment status to rejected:', apptErr);
          } else {
            console.log('Successfully rejected appointment:', patientToCancel.appointmentId);
          }
        } catch (e) {
          console.error('Unexpected error updating appointment to rejected:', e);
        }
      }
      
      const newLog = {
        id: Date.now(),
        patientName: patientToCancel.name,
        queueNumber: patientToCancel.queueNumber,
        status: 'cancelled',
        timestamp: new Date().toLocaleString()
      };
      setActivityLogs([newLog, ...activityLogs.slice(0, 9)]);
      
      toast.info(`Cancelled: ${patientToCancel.name}`);
      
      if (selectedPatient && selectedPatient.id === patientToCancel.id) {
        setSelectedPatient(null);
      }
      
      // Refresh both queue data and activity logs
      fetchQueueData();
      fetchTodayActivity(getTodayDate());
    } catch (error) {
      console.error('Error cancelling patient session:', error);
      toast.error('Failed to cancel patient session');
    } finally {
      setShowCancelModal(false);
      setPatientToCancel(null);
    }
  };
  
  const addPatientToQueue = async () => {
    if (!selectedPatientId) {
      toast.error('Please select a patient');
      return;
    }
    if (!walkinBranch) {
      toast.error('Please select a branch');
      return;
    }
    if (!selectedDoctorForInvoice) {
      toast.error('Please select a doctor');
      return;
    }
    
    try {
      // 🚫 DUPLICATE BLOCKER: Check if this patient has already been processed today
      if (await isDuplicatePatient(selectedPatientId)) {
        toast.error('This patient has already been added to the queue today');
        return;
      }
      
      // Check if patient is already in queue
      const { data: existingQueue, error: existingQueueError } = await supabase
        .from('queue')
        .select('id')
        .eq('patient_id', selectedPatientId)
        .in('status', ['waiting', 'serving']);
      
      if (existingQueueError) throw existingQueueError;
      
      if (existingQueue && existingQueue.length > 0) {
        toast.error('Patient is already in the queue');
        return;
      }
      
      // Use the proper daily queue number generation logic
      const nextQueueNumber = await getNextQueueNumberForToday(supabase);
      const patient = patientsList.find(p => p.id === selectedPatientId);
      
      const todayDate = getTodayDate();
      const { data: patientAppointment, error: appointmentError } = await supabase
        .from('appointments')
        .select(`
          id, 
          status, 
          notes, 
          teeth_involved,
          appointment_services(id, service_id)
        `)
        .eq('patient_id', selectedPatientId)
        .eq('appointment_date', todayDate)
        .in('status', ['confirmed', 'in_progress'])
        .order('appointment_time', { ascending: true })
        .limit(1);
      
      if (appointmentError) {
        console.error('Error checking patient appointment:', appointmentError);
      }
      
      const selectedDoctor = availableDoctors.find(d => d.id === selectedDoctorForInvoice);
      const doctorNote = selectedDoctor ? `Doctor: Dr. ${selectedDoctor.full_name}` : '';
      
      const queueData = {
        patient_id: selectedPatientId,
        appointment_id: patientAppointment && patientAppointment.length > 0 ? patientAppointment[0].id : null,
        queue_number: nextQueueNumber,
        status: 'waiting',
        branch: walkinBranch,
        estimated_wait_time: 15,
        notes: doctorNote,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('queue')
        .insert([queueData]);
      
      if (error) throw error;
      
      const doctorName = selectedDoctor ? selectedDoctor.full_name : null;
      const doctorText = doctorName ? ` (assigned to Dr. ${doctorName})` : '';
      toast.success(`Added ${patient.full_name} to queue${doctorText}`);
      
      const newLog = {
        id: Date.now(),
        patientName: patient.full_name,
        queueNumber: nextQueueNumber,
        status: 'added to queue',
        timestamp: new Date().toLocaleString()
      };
      setActivityLogs([newLog, ...activityLogs.slice(0, 9)]);
      
      setSelectedPatientId('');
      setWalkinBranch('');
      setSelectedDoctorForInvoice('');
      setShowAddPatientModal(false);
      
      fetchQueueData();
    } catch (error) {
      console.error('Error adding patient to queue:', error);
      toast.error('Failed to add patient to queue: ' + error.message);
    }
  };
  
  const removeFromQueue = async (patientId) => {
    const patientToRemove = waitingPatients.find(p => p.id === patientId);
    setConfirmationAction(() => () => performRemoveFromQueue(patientId, patientToRemove));
    setConfirmationMessage('Are you sure you want to remove this patient from the queue?');
    setShowConfirmationModal(true);
  };

  const performRemoveFromQueue = async (patientId, patientToRemove) => {
    try {
      const { error } = await supabase
        .from('queue')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', patientId);
      
      if (error) throw error;

      // If this queue entry originated from an appointment, also reject that appointment
      if (patientToRemove.appointmentId) {
        try {
          const { error: apptErr } = await supabase
            .from('appointments')
            .update({ status: 'rejected', updated_at: new Date().toISOString() })
            .eq('id', patientToRemove.appointmentId);
          if (apptErr) {
            console.error('Failed updating appointment status to rejected:', apptErr);
          } else {
            console.log('Successfully rejected appointment:', patientToRemove.appointmentId);
          }
        } catch (e) {
          console.error('Unexpected error updating appointment to rejected:', e);
        }
      }
      
      setWaitingPatients(waitingPatients.filter(p => p.id !== patientId));
      
      const newLog = {
        id: Date.now(),
        patientName: patientToRemove.name,
        queueNumber: patientToRemove.queueNumber,
        status: 'removed from queue',
        timestamp: new Date().toLocaleString()
      };
      setActivityLogs([newLog, ...activityLogs.slice(0, 9)]);
      
      toast.info(`Removed patient from queue`);
      
      // Refresh activity logs to show the cancellation
      fetchTodayActivity(getTodayDate());
    } catch (error) {
      console.error('Error removing patient from queue:', error);
      toast.error('Failed to remove patient from queue');
    }
  };
  
  const refreshQueue = () => {
    fetchQueueData();
    toast.info('Queue refreshed');
  };

  const openAppointmentModal = (patient) => {
    if (patient.appointmentData) {
      setAppointmentModalData({
        patient: patient,
        appointment: patient.appointmentData,
        services: patient.services || []
      });
      setShowAppointmentModal(true);
    } else {
      toast.info('No appointment information available for this patient');
    }
  };

  const isAssignedDoctor = (patient) => {
    if (!patient || !user) return false;
    
    // Check if current doctor is the assigned doctor
    if (patient.doctorId && patient.doctorId === user.id) {
      return true;
    }
    
    // Check by name if ID doesn't match
    if (patient.doctorName && user.full_name) {
      const currentDoctorName = user.full_name;
      const assignedDoctorName = patient.doctorName;
      return currentDoctorName === assignedDoctorName;
    }
    
    return false;
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
  };
  
  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Queue Management</h1>
            <div className="mt-1 flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Active Queue - Shows all waiting/serving patients
              </span>
                             <div className="flex items-center text-sm text-blue-600">
                 <FiInfo className="h-4 w-4 mr-1" />
                 <span>
                   {user?.role === 'doctor' 
                     ? "Today's confirmed/appointed appointments auto-added to queue. Click complete button to generate invoice."
                     : "Queue management view. Only doctors can auto-add appointments to prevent duplication."
                   }
                 </span>
               </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={refreshQueue}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              title="Refresh queue"
            >
              <FiRefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Branch Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveBranch('all')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeBranch === 'all'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Branches
            </button>
            <button
              onClick={() => setActiveBranch('cabugao')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeBranch === 'cabugao'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Cabugao Branch
            </button>
            <button
              onClick={() => setActiveBranch('sanjuan')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeBranch === 'sanjuan'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              San Juan Branch
            </button>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Patient */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-5 sm:px-6 bg-primary-50 border-b border-primary-100">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Now Serving {servingPatients.length > 0 && `(${servingPatients.length})`}
                </h3>
              </div>
              <div className="p-6">
                {servingPatients.length > 0 ? (
                  <div className="space-y-4">
                    {servingPatients.map((patient, index) => (
                      <div 
                        key={patient.id}
                        className="cursor-pointer hover:bg-gray-50 p-4 rounded-lg border border-gray-200 transition-colors"
                        onClick={() => openAppointmentModal(patient)}
                        title="Click to view appointment details"
                      >
                        {/* Branch indicator */}
                        <div className="mb-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {patient.branch}
                          </span>
                        </div>
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <FiUser className="h-6 w-6 text-primary-600" />
                      </div>
                      <div className="ml-4">
                        <h4 className="text-lg font-medium text-gray-900">{patient.name}</h4>
                        <p className="text-sm text-gray-500">
                          Queue #{patient.queueNumber}
                          {patient.isFromAppointment && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              From Appointment
                            </span>
                          )}
                          {patient.createdDate !== getTodayDate().split('-').reverse().join('/') && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              Added: {patient.createdDate}
                            </span>
                          )}
                        </p>
                        {patient.isFromAppointment && (
                          <p className="text-xs text-blue-600 mt-1">
                            Click to view appointment details
                          </p>
                        )}
                        {!isAssignedDoctor(patient) && (
                          <p className="text-xs text-blue-600 mt-1">
                            ℹ️ Invoice will be assigned to {patient.doctorName || 'assigned doctor'}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-start">
                        <FiClock className="mt-1 mr-2 h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          Waiting time: {patient.waitingTime} minutes
                        </span>
                      </div>
                      {patient.appointmentTime && (
                        <div className="flex items-start">
                          <div className="mr-2 h-4 w-4 text-gray-400">📅</div>
                          <span className="text-sm text-gray-600">
                            Appointment time: {patient.appointmentTime}
                          </span>
                        </div>
                      )}
                      <div className="flex items-start">
                        <div className="mr-2 h-4 w-4 text-gray-400">🏥</div>
                        <span className="text-sm text-gray-600">
                          Branch: {patient.branch}
                          {patient.doctorName && patient.doctorName !== 'N/A' && (
                            <span className="ml-2 text-blue-600 font-medium">
                              • Dr. {patient.doctorName}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-start">
                        <div className="mr-2 h-4 w-4 text-gray-400">🦷</div>
                        <div className="text-sm text-gray-600">
                          <div>Services:</div>
                          <ul className="list-disc list-inside ml-1 mt-1">
                            {patient.services.map((service, idx) => (
                              <li key={idx} className="text-gray-700">
                                {service.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                        <div className="flex space-x-2">
                          <button 
                            className="flex-1 flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              completeSpecificPatient(patient);
                            }}
                            disabled={completingPatient}
                            title={!isAssignedDoctor(patient) ? `Invoice will be assigned to ${patient.doctorName || 'assigned doctor'}` : ''}
                          >
                            {completingPatient ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            ) : (
                              <FiCheck className="mr-2" />
                            )}
                            Complete
                          </button>
                          <button 
                            className="flex-1 flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPatientToCancel(patient);
                              setShowCancelModal(true);
                            }}
                          >
                            <FiX className="mr-2" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="mx-auto h-12 w-12 text-gray-400">
                      <FiUser className="h-full w-full" />
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No patients being served</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Call patients from the waiting list to start serving them.
                    </p>
                    {waitingPatients.length > 0 && (
                      <div className="mt-6">
                        <button
                          type="button"
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                          onClick={callNextPatient}
                        >
                          <FiArrowRight className="-ml-1 mr-2 h-5 w-5" />
                          Call Next Patient
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Waiting List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Waiting List</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    Active patients: {waitingPatients.length} 
                    {waitingPatients.filter(p => p.isFromAppointment).length > 0 && (
                      <span className="text-blue-600">
                        {" "}(From appointments: {waitingPatients.filter(p => p.isFromAppointment).length})
                      </span>
                    )}
                    {waitingPatients.filter(p => {
                      const today = getTodayDate().split('-').reverse().join('/');
                      return p.createdDate !== today;
                    }).length > 0 && (
                      <span className="text-orange-600">
                        {" "}(Previous days: {waitingPatients.filter(p => {
                          const today = getTodayDate().split('-').reverse().join('/');
                          return p.createdDate !== today;
                        }).length})
                      </span>
                    )}
                  </p>
                </div>
                <button 
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  onClick={() => setShowAddPatientModal(true)}
                >
                  <FiPlus className="mr-1" />
                  Add Walk-in Patient
                </button>
              </div>
              <div>
                {waitingPatients.length > 0 ? (
                  <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                    {waitingPatients.map((patient) => (
                      <li key={patient.id} className="px-4 py-3 hover:bg-gray-50">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                              <FiUser className="h-6 w-6 text-gray-400" />
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">{patient.name}</p>
                              <div className="flex items-center flex-wrap">
                                <span className="text-xs text-gray-500">Queue #{patient.queueNumber}</span>
                                <span className="mx-1.5 text-gray-500">•</span>
                                <span className="text-xs text-gray-500">Waiting: {patient.waitingTime} mins</span>
                                {patient.appointmentTime && (
                                  <>
                                    <span className="mx-1.5 text-gray-500">•</span>
                                    <span className="text-xs text-green-600 font-medium">Appt: {patient.appointmentTime}</span>
                                  </>
                                )}
                                <span className="mx-1.5 text-gray-500">•</span>
                                <span className="text-xs text-gray-500">
                                  {patient.branch}
                                  {patient.doctorName && patient.doctorName !== 'N/A' && (
                                    <span className="ml-1 text-blue-600 font-medium">
                                      • Dr. {patient.doctorName}
                                    </span>
                                  )}
                                </span>
                                {patient.createdDate !== getTodayDate().split('-').reverse().join('/') && (
                                  <>
                                    <span className="mx-1.5 text-gray-500">•</span>
                                    <span className="text-xs text-orange-600">Added: {patient.createdDate}</span>
                                  </>
                                )}
                                {patient.isFromAppointment && (
                                  <>
                                    <span className="mx-1.5 text-gray-500">•</span>
                                    <span className="text-xs text-blue-600">Auto-added</span>
                                  </>
                                )}
                              </div>
                              {patient.services && patient.services.length > 0 && (
                                <div className="mt-1">
                                  <span className="text-xs text-gray-500">
                                    Services: {patient.services.map(s => s.name).join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                              onClick={() => callPatient(patient)}
                            >
                              Call
                            </button>
                            <button
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              onClick={() => removeFromQueue(patient.id)}
                            >
                              <FiX className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-6 text-center">
                    <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                      <FiUser className="h-full w-full" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No patients in the waiting queue</h3>
                    <div className="text-sm text-gray-500 space-y-2">
                      <p>Possible reasons:</p>
                      <ul className="list-disc list-inside text-left max-w-md mx-auto">
                        <li>No appointments confirmed for today yet</li>
                        <li>All active patients have been served</li>
                        <li>No active queue entries found</li>
                      </ul>
                      <div className="mt-4 space-y-2">
                        <p className="font-medium text-gray-700">Quick Actions:</p>
                        <div className="flex flex-col sm:flex-row gap-2 justify-center">
                         
                          <button
                            onClick={refreshQueue}
                            className="inline-flex items-center px-3 py-1 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
                          >
                            <FiRefreshCw className="mr-1 h-4 w-4" />
                            Refresh Queue
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
          
        <div className="mt-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">Queue Activity Log</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Today's queue activities: {activityLogs.length} entries found
                  {activityLogs.length > 0 && (
                    <span className="ml-2 text-blue-600">
                      (Last updated: {new Date().toLocaleTimeString()})
                    </span>
                  )}
                </p>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => {
                    console.log('Manual refresh triggered');
                    fetchTodayActivity(getTodayDate());
                  }}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  title="Refresh activity log"
                >
                  <FiRefreshCw className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => {
                    console.log('Current activity logs:', activityLogs);
                    console.log('Current branch filter:', activeBranch);
                    console.log('Today date:', getTodayDate());
                  }}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  title="Debug activity log"
                >
                  Debug
                </button>
              </div>
            </div>
            {activityLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Patient
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Queue #
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Branch
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.timestamp}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{log.patientName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.queueNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.branch}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${log.status === 'completed' ? 'bg-green-100 text-green-800' : 
                             log.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                             log.status === 'called' ? 'bg-blue-100 text-blue-800' :
                             log.status === 'added to queue' ? 'bg-yellow-100 text-yellow-800' :
                             'bg-gray-100 text-gray-800'}`}>
                            {log.status}
                            {log.originalStatus === 'rejected' && (
                              <span className="ml-1 text-xs opacity-75">(rejected)</span>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center">
                <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                  <FiClock className="h-full w-full" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No queue activity recorded today</h3>
                <p className="text-gray-500 mb-4">
                  Activity logs will show all queue entries including:
                  <br />• Patients added to queue (waiting)
                  <br />• Patients called (serving) 
                  <br />• Patients completed
                  <br />• Patients cancelled/rejected
                </p>
                <div className="space-y-2">
                  <button 
                    onClick={() => {
                      console.log('Manual refresh from empty state');
                      fetchTodayActivity(getTodayDate());
                    }}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <FiRefreshCw className="mr-2 h-4 w-4" />
                    Refresh Activity Log
                  </button>
                  <div className="text-xs text-gray-400 mt-2">
                    Current branch filter: {activeBranch === 'all' ? 'All Branches' : activeBranch}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Patient to Queue Modal */}
      {showAddPatientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowAddPatientModal(false)}></div>
          <div className="relative w-full max-w-xl">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-indigo-100">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <FiPlus className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Add Walk-in Patient</h3>
                    <p className="text-xs text-gray-500">Patients with confirmed appointments today are auto-added</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <label htmlFor="patient-select" className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
                <select
                  id="patient-select"
                  className="block w-full rounded-lg border-gray-300 bg-gray-50 text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                >
                  <option value="">Search or select patient…</option>
                  <optgroup label="With today's appointments">
                    {patientsList.filter(p=>p.hasAppointment).map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} {p.phone ? `(${p.phone})` : ''} ⭐</option>
                    ))}
                  </optgroup>
                  <optgroup label="Walk-ins">
                    {patientsList.filter(p=>!p.hasAppointment).map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} {p.phone ? `(${p.phone})` : ''}</option>
                    ))}
                  </optgroup>
                </select>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                    <select
                      className="block w-full rounded-lg border-gray-300 bg-gray-50 text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={walkinBranch}
                      onChange={(e)=>{ setWalkinBranch(e.target.value); setWalkinTime(''); fetchWalkinSlotsForToday(e.target.value); }}
                    >
                      <option value="">Select branch…</option>
                      <option value="Cabugao">Cabugao</option>
                      <option value="San Juan">San Juan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Doctor <span className="text-red-500">*</span></label>
                    <select
                      className="block w-full rounded-lg border-gray-300 bg-gray-50 text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={selectedDoctorForInvoice}
                      onChange={(e) => setSelectedDoctorForInvoice(e.target.value)}
                      required
                    >
                      <option value="">Select a doctor…</option>
                      {availableDoctors.map(doctor => (
                        <option key={doctor.id} value={doctor.id}>
                          Dr. {doctor.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="px-6 pb-6 flex justify-end gap-3">
                <button onClick={() => setShowAddPatientModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={addPatientToQueue} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow">Add to Queue</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Invoice Generation Modal */}
      {showInvoiceModal && completedPatientData && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                    <span className="text-2xl font-bold text-green-600">₱</span>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Generate Invoice for Assigned Doctor{completedPatientData.doctorName ? ` - Dr. ${completedPatientData.doctorName}` : ''}
                    </h3>
                    <div className="mt-4">
                      <p className="text-sm text-gray-600 mb-4">
                        Treatment completed for <strong>{completedPatientData.name}</strong> (Queue #{completedPatientData.queueNumber})
                        {completedPatientData.doctorName && (
                          <>
                            <br/>
                            <span className="text-blue-600 font-medium">
                              Invoice will be assigned to: Dr. {completedPatientData.doctorName}
                            </span>
                          </>
                        )}
                        {!isAssignedDoctor(completedPatientData) && (
                          <>
                            <br/>
                            <span className="text-orange-600 font-medium">
                              Completed by: {user?.full_name || 'Current Doctor'}
                            </span>
                          </>
                        )}
                        <br/>
                        <p className="text-sm text-gray-600 mt-2">Edit the invoice if needed.</p>
                        {completedPatientData.isFromAppointment && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            From Appointment
                          </span>
                        )}
                      </p>
                      
                      <div className="bg-gray-50 p-4 rounded-md">
                        <h4 className="font-medium text-gray-700 mb-2">Services Provided:</h4>
                        <div className="space-y-2">
                          {invoiceItems.map((item, index) => (
                            <div key={index} className="flex justify-between items-center">
                              <div>
                                <div className="font-medium text-sm">{item.service_name}</div>
                                {item.description && item.description !== item.service_name && (
                                  <div className="text-xs text-gray-500">{item.description}</div>
                                )}
                              </div>
                              <div className="text-sm font-medium">
                                {formatCurrency(item.price)}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="border-t border-gray-300 pt-2 mt-3">
                          <div className="flex justify-between items-center font-bold">
                            <span>Total Amount:</span>
                            <span className="text-lg">{formatCurrency(invoiceTotal)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={generateInvoiceForCompletedPatient}
                  disabled={isGeneratingInvoice}
                >
                  {isGeneratingInvoice ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <FiFileText className="mr-2 h-4 w-4" />
                      Generate Invoice
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setShowInvoiceModal(false);
                    setCompletedPatientData(null);
                    setInvoiceItems([]);
                    setInvoiceTotal(0);
                    setSelectedDoctorForInvoice('');
                  }}
                >
                  Skip Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowCancelModal(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <FiX className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Cancel Patient Session
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to cancel the session for this patient? This action cannot be undone.
                      </p>
                      
                      {patientToCancel && (
                        <div className="mt-3 bg-gray-50 p-3 rounded-md">
                          <div className="flex items-center text-sm">
                            <FiUser className="mr-2 text-gray-500" />
                            <span className="font-medium">{patientToCancel.name}</span>
                          </div>
                          <div className="flex items-center text-sm mt-1">
                            <span className="text-gray-500">Queue #{patientToCancel.queueNumber}</span>
                            {patientToCancel.isFromAppointment && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                From Appointment
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
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={confirmCancelPatient}
                >
                  Cancel Session
                </button>
                <button 
                  type="button" 
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setShowCancelModal(false);
                    setPatientToCancel(null);
                  }}
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Information Modal */}
      {showAppointmentModal && appointmentModalData && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <FiFileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Appointment Information
                    </h3>
                    <div className="mt-4">
                      <div className="bg-gray-50 p-4 rounded-md mb-4">
                        <h4 className="font-medium text-gray-700 mb-3">Patient Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-600">Name:</span>
                            <span className="ml-2 text-gray-900">{appointmentModalData.patient.name}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Queue #:</span>
                            <span className="ml-2 text-gray-900">{appointmentModalData.patient.queueNumber}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Phone:</span>
                            <span className="ml-2 text-gray-900">{appointmentModalData.patient.phone}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Email:</span>
                            <span className="ml-2 text-gray-900">{appointmentModalData.patient.email}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 p-4 rounded-md mb-4">
                        <h4 className="font-medium text-gray-700 mb-3">Appointment Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-600">Date:</span>
                            <span className="ml-2 text-gray-900">{appointmentModalData.appointment.appointment_date}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Time:</span>
                            <span className="ml-2 text-gray-900">{formatTime(appointmentModalData.appointment.appointment_time)}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Branch:</span>
                            <span className="ml-2 text-gray-900">{appointmentModalData.appointment.branch}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Status:</span>
                            <span className="ml-2 text-gray-900 capitalize">{appointmentModalData.appointment.status}</span>
                          </div>
                        </div>
                        {appointmentModalData.appointment.notes && (
                          <div className="mt-3">
                            <span className="font-medium text-gray-600">Notes:</span>
                            <p className="mt-1 text-gray-900">{appointmentModalData.appointment.notes}</p>
                          </div>
                        )}
                        {appointmentModalData.appointment.teeth_involved && (
                          <div className="mt-3">
                            <span className="font-medium text-gray-600">Teeth Involved:</span>
                            <p className="mt-1 text-gray-900">{appointmentModalData.appointment.teeth_involved}</p>
                          </div>
                        )}
                      </div>

                      <div className="bg-green-50 p-4 rounded-md">
                        <h4 className="font-medium text-gray-700 mb-3">Services & Pricing</h4>
                        <div className="space-y-2">
                          {appointmentModalData.services.map((service, index) => (
                            <div key={index} className="flex justify-between items-center bg-white p-3 rounded border">
                              <div>
                                <div className="font-medium text-sm">{service.name}</div>
                                {service.description && service.description !== service.name && (
                                  <div className="text-xs text-gray-500">{service.description}</div>
                                )}
                              </div>
                              <div className="text-sm font-medium">
                                {formatCurrency(service.price)}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="border-t border-gray-300 pt-2 mt-3">
                          <div className="flex justify-between items-center font-bold">
                            <span>Total Amount:</span>
                            <span className="text-lg">
                              {formatCurrency(appointmentModalData.services.reduce((sum, service) => sum + (parseFloat(service.price) || 0), 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowAppointmentModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mr-3">
                  <FiAlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Confirm Action</h3>
              </div>
              <p className="text-gray-600 mb-6">{confirmationMessage}</p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowConfirmationModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (confirmationAction) {
                      confirmationAction();
                    }
                    setShowConfirmationModal(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueueManagement;