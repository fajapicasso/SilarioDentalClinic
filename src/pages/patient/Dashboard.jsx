// src/pages/patient/Dashboard.jsx - Enhanced with Queue Integration
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../config/supabaseClient';
import { 
  FiCalendar, FiClock, FiAlertCircle, FiFileText, 
  FiCreditCard, FiUser, FiPlus, FiChevronRight, FiActivity,
  FiUsers, FiBell, FiMapPin, FiArrowRight, FiInfo
} from 'react-icons/fi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { toast } from 'react-toastify';
import { useNotification } from '../../contexts/NotificationContext';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';
import { 
  getTodayPhilippineDate, 
  getNextQueueNumberForToday, 
  isPatientInTodayQueue 
} from '../../utils/philippineTime';

const PatientDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { logPageView } = useUniversalAudit();
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [recentTreatments, setRecentTreatments] = useState([]);
  const [queuePosition, setQueuePosition] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);
  const [waitingList, setWaitingList] = useState([]);
  const [currentlyServing, setCurrentlyServing] = useState(null); // Keep for backward compatibility
  const [servingPatients, setServingPatients] = useState([]); // New: multiple serving patients
  const [showWaitingList, setShowWaitingList] = useState(false);
  const [isYourTurn, setIsYourTurn] = useState(false);
  const [joiningQueue, setJoiningQueue] = useState(false);
  const [completedSession, setCompletedSession] = useState(null);
  const [showPaymentRedirect, setShowPaymentRedirect] = useState(false);
  const [isQueueUpdating, setIsQueueUpdating] = useState(false);
  const [turnNotified, setTurnNotified] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('all'); // Add branch selection state
  // Notification helpers for bell dropdown
  const { notifyQueueUpdate, fetchNotifications } = useNotification();
  const notificationSound = useRef(null);

  useEffect(() => {
    // Log page view
    logPageView('Patient Dashboard', 'dashboard', 'main');
    
    // Create audio element for notification
    notificationSound.current = new Audio('/notification-sound.mp3');
    
    const fetchDashboardData = async () => {
      setIsLoading(true);
      
      try {
        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profileError) throw profileError;
        setProfile(profileData);

        // Fetch upcoming appointments
        const today = new Date().toISOString();
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
            services:appointment_services(
              service_id(id, name, description, price, duration)
            ),
            durations:appointment_durations(
              duration_minutes
            )
          `)
          .eq('patient_id', user.id)
          .gte('appointment_date', today.split('T')[0])
          .neq('status', 'cancelled')
          .neq('status', 'completed')
          .order('appointment_date', { ascending: true })
          .order('appointment_time', { ascending: true })
          .limit(3);
        
        if (appointmentsError) throw appointmentsError;

        // Format the services for each appointment and add duration info
        const formattedAppointments = appointmentsData ? appointmentsData.map(appointment => ({
          ...appointment,
          serviceIds: appointment.services?.map(s => s.service_id.id) || [],
          serviceNames: appointment.services?.map(s => s.service_id.name) || [],
          duration: appointment.durations && appointment.durations.length > 0 
            ? appointment.durations[0].duration_minutes 
            : appointment.services?.reduce((total, s) => 
                total + (s.service_id.duration || 30), 0) || 30
        })) : [];
        
        setUpcomingAppointments(formattedAppointments);

        // Check for confirmed appointments today that can join queue
        const todayAppointments = formattedAppointments.filter(apt => {
          const today = new Date().toISOString().split('T')[0];
          return apt.appointment_date === today && apt.status === 'confirmed';
        });



        // Fetch recent treatments
        const { data: treatmentsData, error: treatmentsError } = await supabase
          .from('treatments')
          .select(`
            id,
            treatment_date,
            tooth_number,
            diagnosis,
            procedure,
            doctor:doctor_id (full_name)
          `)
          .eq('patient_id', user.id)
          .order('treatment_date', { ascending: false })
          .limit(3);
        
        if (treatmentsError) throw treatmentsError;
        setRecentTreatments(treatmentsData || []);

        // Fetch queue information
        await fetchQueueInformation();
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchDashboardData();
    }

    // Setup real-time subscriptions for automatic updates
    const queueSubscription = supabase
      .channel('public:queue')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'queue' 
      }, (payload) => {
        // Refresh queue data when there's a change
        fetchQueueInformation();
      })
      .subscribe();

    const appointmentSubscription = supabase
      .channel('public:appointments')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'appointments' 
      }, (payload) => {
        // Refresh dashboard data when appointments change
        fetchDashboardData();
      })
      .subscribe();

    // Setup periodic refresh every 30 seconds for queue information
    const queueRefreshInterval = setInterval(() => {
      if (user) {
        fetchQueueInformation();
      }
    }, 30000); // 30 seconds

    // Cleanup
    return () => {
      if (notificationSound.current) {
        notificationSound.current.pause();
        notificationSound.current.currentTime = 0;
      }
      supabase.removeChannel(queueSubscription);
      supabase.removeChannel(appointmentSubscription);
      clearInterval(queueRefreshInterval);
    };
  }, [user]);

  // Refresh queue data when branch selection changes
  useEffect(() => {
    if (user) {
      fetchQueueInformation();
    }
  }, [selectedBranch]);



  const fetchQueueInformation = async () => {
    try {
      setIsQueueUpdating(true);
      const todayDate = getTodayDate();
      
      // First, check if patient has confirmed appointments for today
      const { data: todayAppointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          status,
          branch
        `)
        .eq('patient_id', user.id)
        .eq('appointment_date', todayDate)
        .eq('status', 'confirmed');
      
      if (appointmentsError) {
        console.error('Error fetching today\'s appointments:', appointmentsError);
      }
      
      // Check if patient is already in queue today (any status)
      const { data: myQueueData, error: myQueueError } = await supabase
        .from('queue')
        .select(`
          id, 
          queue_number, 
          status, 
          estimated_wait_time,
          created_at,
          appointment_id
        `)
        .eq('patient_id', user.id)
        .gte('created_at', `${todayDate}T00:00:00`)
        .lte('created_at', `${todayDate}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (myQueueError && myQueueError.code !== 'PGRST116') {
        console.error('Error fetching queue status:', myQueueError);
      }
      
      // Set your queue position to only an active entry (waiting/serving)
      let myActiveEntry = null;
      try {
        const { data: myActiveRows } = await supabase
          .from('queue')
          .select('id, queue_number, status, created_at')
          .eq('patient_id', user.id)
          .gte('created_at', `${todayDate}T00:00:00`)
          .lte('created_at', `${todayDate}T23:59:59`)
          .in('status', ['waiting', 'serving'])
          .order('created_at', { ascending: false })
          .limit(1);
        if (myActiveRows && myActiveRows.length > 0) {
          myActiveEntry = myActiveRows[0];
        }
      } catch (e) {
        // ignore
      }
      setQueuePosition(myActiveEntry || null);
      
      // Clean up any duplicate queue entries
      await cleanupDuplicateQueueEntries();
      
      // Auto-join queue if patient has confirmed appointments but not in queue
      if (todayAppointments && todayAppointments.length > 0 && !myQueueData) {
        // Auto-join the first appointment of the day
        const firstAppointment = todayAppointments[0];
        await joinQueue(firstAppointment.id);
        // Refresh queue data after joining
        setTimeout(() => fetchQueueInformation(), 1000);
        return;
      }
      
      // Check for completed session that needs payment
      if (myQueueData && myQueueData.status === 'completed' && !completedSession) {
        if (myQueueData.appointment_id) {
          const { data: appointmentData } = await supabase
            .from('appointments')
            .select('id, status')
            .eq('id', myQueueData.appointment_id)
            .single();
          
          if (appointmentData && appointmentData.status === 'completed') {
            setCompletedSession(myQueueData);
            setShowPaymentRedirect(true);
          }
        }
      }
      
      // Update isYourTurn status based on active entry
      if (myActiveEntry && myActiveEntry.status === 'serving') {
        if (!isYourTurn) {
          setIsYourTurn(true);
          if (notificationSound.current) {
            notificationSound.current.play().catch(e => console.log('Could not play notification sound', e));
          }
          toast.dismiss('your-turn');
          toast.success("It's your turn now! Please proceed to the dental clinic.", {
            toastId: 'your-turn',
            position: "top-right",
            autoClose: 20000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        }
      } else {
        setIsYourTurn(false);
      }
      
      // Get all currently serving patients with branch filtering
      let servingQuery = supabase
        .from('queue')
        .select(`
          id,
          patient_id,
          queue_number,
          status,
          branch,
          estimated_wait_time,
          created_at,
          profiles:patient_id(full_name),
          appointments!queue_appointment_id_fkey(id, branch)
        `)
        .eq('status', 'serving')
        .gte('created_at', `${todayDate}T00:00:00`)
        .lte('created_at', `${todayDate}T23:59:59`)
        .order('created_at', { ascending: true });

      const { data: servingData, error: servingError } = await servingQuery;
      
      if (servingError && servingError.code !== 'PGRST116') {
        console.error('Error fetching serving patient:', servingError);
      }
      
      // Set all serving patients with branch filtering
      let filteredServingData = servingData || [];
      
      // Apply branch filtering to serving patients
      if (selectedBranch !== 'all') {
        const branchName = selectedBranch === 'cabugao' ? 'Cabugao' : 'San Juan';
        filteredServingData = filteredServingData.filter(patient => {
          // Use queue branch as primary, fallback to appointment branch
          const patientBranch = patient.branch || patient.appointments?.branch || 'Walk-in';
          // Handle different possible branch name formats
          const normalizedPatientBranch = patientBranch.toLowerCase().trim();
          const normalizedBranchName = branchName.toLowerCase().trim();
          return normalizedPatientBranch === normalizedBranchName;
        });
      }
      
      setServingPatients(filteredServingData);
      
      // Keep backward compatibility - set first serving patient as currentlyServing
      if (filteredServingData.length > 0) {
        setCurrentlyServing(filteredServingData[0]);
      } else {
        setCurrentlyServing(null);
      }

      // Ensure IT'S YOUR TURN alert reflects the now serving row
      const currentUserServing = filteredServingData.find(patient => patient.patient_id === user.id);
      if (currentUserServing) {
        if (!isYourTurn) {
          setIsYourTurn(true);
          if (notificationSound.current) {
            notificationSound.current.play().catch(() => {});
          }
          toast.dismiss('your-turn');
          toast.success("It's your turn now! Please proceed to the dental clinic.", {
            toastId: 'your-turn',
            position: 'top-right',
            autoClose: 20000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        }
        // Also show the serving queue number in the green banner
        setQueuePosition(prev => (prev?.queue_number === currentUserServing.queue_number ? prev : currentUserServing));

        // Create bell notification once per serving session; ensure appears in dropdown immediately
        if (!turnNotified) {
          try {
            await notifyQueueUpdate({
              patientId: user.id,
              queueId: currentUserServing.id,
              queueNumber: currentUserServing.queue_number,
            }, 'serving');
            setTurnNotified(true);
            fetchNotifications();
          } catch (e) {
            console.warn('Could not create turn-now notification:', e.message);
          }
        }
      }
      
      // Get waiting list with branch information (exclude current user if they are serving)
      const { data: waitingData, error: waitingError } = await supabase
        .from('queue')
        .select(`
          id,
          patient_id,
          queue_number,
          status,
          branch,
          estimated_wait_time,
          created_at,
          profiles:patient_id(full_name),
          appointments!queue_appointment_id_fkey(id, branch)
        `)
        .eq('status', 'waiting')
        .gte('created_at', `${todayDate}T00:00:00`)
        .lte('created_at', `${todayDate}T23:59:59`)
        .order('queue_number', { ascending: true });
      
      if (waitingError) {
        console.error('Error fetching waiting list:', waitingError);
      }
      
      // Filter out current user from waiting list if they are being served
      let filteredWaitingData = waitingData ? waitingData.filter(patient => {
        if (myQueueData && myQueueData.status === 'serving') {
          return patient.queue_number !== myQueueData.queue_number;
        }
        return true;
      }) : [];

      // Apply branch filtering to waiting list
      if (selectedBranch !== 'all') {
        const branchName = selectedBranch === 'cabugao' ? 'Cabugao' : 'San Juan';
        filteredWaitingData = filteredWaitingData.filter(patient => {
          // Use queue branch as primary, fallback to appointment branch
          const patientBranch = patient.branch || patient.appointments?.branch || 'Walk-in';
          // Handle different possible branch name formats
          const normalizedPatientBranch = patientBranch.toLowerCase().trim();
          const normalizedBranchName = branchName.toLowerCase().trim();
          return normalizedPatientBranch === normalizedBranchName;
        });
      }
      
      // Format waiting list with proper privacy handling
      const formattedWaitingList = filteredWaitingData.map(patient => {
        // Primary match: auth user id === queue.patient_id
        let isCurrentUser = !!(patient.patient_id && user?.id && patient.patient_id === user.id);
        // Fallback match: compare normalized full names when patient_id is unavailable (defensive)
        if (!isCurrentUser && (!patient.patient_id || !user?.id)) {
          const a = (patient.profiles?.full_name || '').trim().toLowerCase();
          const b = (profile?.full_name || '').trim().toLowerCase();
          if (a && b && a === b) {
            isCurrentUser = true;
          }
        }
        
        let displayName;
        if (isCurrentUser) {
          // Show full name for current user
          displayName = patient.profiles.full_name || 'You';
        } else if (patient.profiles && patient.profiles.full_name) {
          // Show initials for other patients (privacy)
          const nameParts = patient.profiles.full_name.split(' ');
          displayName = nameParts.map(part => `${part.charAt(0)}.`).join(' ');
        } else {
          displayName = 'Patient';
        }
        
        return {
          id: patient.id,
          queueNumber: patient.queue_number,
          name: displayName,
          fullName: patient.profiles?.full_name || 'Patient',
          status: patient.status,
          waitingTime: calculateWaitingTime(patient.created_at),
          isCurrentUser
        };
      });
      

      
      setWaitingList(formattedWaitingList);
      
      // Calculate status strictly from active entry
      if (myActiveEntry) {
        if (myActiveEntry.status === 'serving') {
          setQueueStatus({
            patientsAhead: 0,
            estimatedMinutes: 0,
            queueNumber: myActiveEntry.queue_number,
            status: 'serving'
          });
        } else {
        const position = formattedWaitingList.findIndex(p => p.isCurrentUser);
        const patientsAhead = position >= 0 ? position : 0;
        const estimatedMinutes = patientsAhead * 15;
        setQueueStatus({
          patientsAhead,
          estimatedMinutes,
            queueNumber: myActiveEntry.queue_number,
            status: 'waiting'
        });
        }
      } else {
        setQueueStatus(null);
      }
      
    } catch (error) {
      console.error('Error fetching queue information:', error);
    } finally {
      setIsQueueUpdating(false);
    }
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const cleanupDuplicateQueueEntries = async () => {
    try {
      const todayDate = getTodayDate();
      
      // Get all queue entries for current user today
      const { data: allQueueEntries, error } = await supabase
        .from('queue')
        .select('id, queue_number, status, created_at')
        .eq('patient_id', user.id)
        .gte('created_at', `${todayDate}T00:00:00`)
        .lte('created_at', `${todayDate}T23:59:59`)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching queue entries:', error);
        return;
      }
      
      // If there are multiple entries, keep only the most recent one
      if (allQueueEntries && allQueueEntries.length > 1) {
        const [latestEntry, ...duplicates] = allQueueEntries;
        
        // Delete duplicate entries
        const duplicateIds = duplicates.map(entry => entry.id);
        const { error: deleteError } = await supabase
          .from('queue')
          .delete()
          .in('id', duplicateIds);
        
        if (deleteError) {
          console.error('Error deleting duplicate queue entries:', deleteError);
        } else {
          console.log('Cleaned up duplicate queue entries');
        }
      }
    } catch (error) {
      console.error('Error in cleanupDuplicateQueueEntries:', error);
    }
  };

  const calculateWaitingTime = (createdAt) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now - created;
    return Math.floor(diffMs / (1000 * 60));
  };

  const joinQueue = async (appointmentId) => {
    setJoiningQueue(true);
    try {
      // Check if patient already has a queue entry for today (Philippine time)
      const existingQueue = await isPatientInTodayQueue(supabase, user.id);
      
      if (existingQueue) {
        console.log('Patient already in today\'s queue:', existingQueue);
        toast.info(`You are already in today's queue (Position #${existingQueue.queue_number})`);
        return;
      }
      
      // Get the next queue number for today (resets daily in Philippine time)
      const nextQueueNumber = await getNextQueueNumberForToday(supabase);
      
      // Create queue entry
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
      
      // Refresh queue information
      await fetchQueueInformation();
    } catch (error) {
      console.error('Error joining queue:', error);
      toast.error('Failed to join queue: ' + error.message);
    } finally {
      setJoiningQueue(false);
    }
  };

  const handlePaymentRedirect = () => {
    setShowPaymentRedirect(false);
    navigate('/patient/payments');
  };

  const dismissPaymentRedirect = () => {
    setShowPaymentRedirect(false);
    setCompletedSession(null);
  };



  if (isLoading) {
    return <LoadingSpinner />;
  }

  const formatDate = (dateStr) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
  };

  const formatTime = (timeStr) => {
    const options = { hour: 'numeric', minute: 'numeric', hour12: true };
    const [hours, minutes] = timeStr.split(':');
    return new Date(0, 0, 0, hours, minutes).toLocaleTimeString('en-US', options);
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
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="space-y-3 sm:space-y-4 lg:space-y-6 p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Welcome Section - Mobile Optimized */}
      <div className="bg-blue-50 rounded-lg shadow-md p-3 sm:p-4 lg:p-6 border border-blue-200">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 leading-tight">
          Welcome back, {profile?.full_name || 'Patient'}!
        </h1>
        <p className="text-xs sm:text-sm lg:text-base text-gray-600 mt-1 sm:mt-2">
          Here's an overview of your dental care information.
        </p>
      </div>
      {/* Branch Selection - Mobile Optimized */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6 mb-3 sm:mb-4 lg:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 space-y-1 sm:space-y-0">
          <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800">Select Branch</h3>
          <div className="flex items-center text-xs text-gray-500">
            <FiMapPin className="mr-1 h-3 w-3" />
            <span className="hidden sm:inline">Choose your branch to view queue information</span>
            <span className="sm:hidden">Choose branch</span>
          </div>
        </div>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-2 sm:space-x-8 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setSelectedBranch('all')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                selectedBranch === 'all'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Branches
            </button>
            <button
              onClick={() => setSelectedBranch('cabugao')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                selectedBranch === 'cabugao'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Cabugao Branch
            </button>
            <button
              onClick={() => setSelectedBranch('sanjuan')}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                selectedBranch === 'sanjuan'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              San Juan Branch
            </button>
          </nav>
        </div>
      </div>

      {/* Queue Monitoring Summary Section - Mobile Optimized */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4 lg:mb-6">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 flex items-center">
          <div className="bg-blue-100 p-2 sm:p-3 rounded-full mr-3 sm:mr-4 flex-shrink-0">
            <FiUsers className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-blue-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-gray-500 text-xs sm:text-sm font-medium">
              <span className="hidden sm:inline">Patients in Queue</span>
              <span className="sm:hidden">In Queue</span>
              {selectedBranch !== 'all' && (
                <span className="ml-1 sm:ml-2 text-xs bg-primary-100 text-primary-700 px-1 sm:px-2 py-0.5 sm:py-1 rounded-full">
                  {selectedBranch === 'cabugao' ? 'Cabugao' : 'San Juan'} Branch
                </span>
              )}
            </div>
            <div className="text-xl sm:text-2xl font-bold text-gray-800">{waitingList.length}</div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 flex items-center">
          <div className="bg-green-100 p-2 sm:p-3 rounded-full mr-3 sm:mr-4 flex-shrink-0">
            <FiClock className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-green-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-gray-500 text-xs sm:text-sm font-medium">
              <span className="hidden sm:inline">Avg. Waiting Time</span>
              <span className="sm:hidden">Avg. Wait</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-gray-800">{waitingList.length > 0 ? `${Math.round(waitingList.reduce((acc, p) => acc + p.waitingTime, 0) / waitingList.length)} min` : '0 min'}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Now Serving Panel */}
        <div className="bg-blue-50 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Now Serving {servingPatients.length > 0 && `(${servingPatients.length})`}
              {selectedBranch !== 'all' && (
                <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">
                  {selectedBranch === 'cabugao' ? 'Cabugao' : 'San Juan'} Branch
                </span>
              )}
            </h3>
            {isQueueUpdating && (
              <div className="flex items-center text-xs text-blue-600">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                Updating...
              </div>
            )}
          </div>
          {servingPatients.length > 0 ? (
            <div className="space-y-3">
              {servingPatients.map((patient, index) => (
                <div key={patient.id} className="flex items-center p-3 bg-white rounded-lg border border-gray-200">
                  <div className="bg-gray-200 rounded-full p-3 mr-4">
                    <FiUser className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold text-gray-800">Queue #{patient.queue_number}</div>
                      {/* Branch indicator */}
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {patient.branch || patient.appointments?.branch || 'Walk-in'}
                      </span>
                    </div>
                    <div className={`${patient.profiles?.full_name === profile?.full_name ? 'font-bold text-primary-700' : 'text-gray-600'}`}>
                      {patient.profiles?.full_name === profile?.full_name ? (
                        patient.profiles?.full_name || "You"
                      ) : (
                        <span className="blur-[4.5px] opacity-100 select-none">
                          {patient.profiles?.full_name || "Patient"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32">
              <FiUser className="h-12 w-12 text-gray-400 mb-2" />
              <div className="font-semibold text-gray-700">No patients being served</div>
              <div className="text-gray-500 text-sm">Currently no patients being served.</div>
            </div>
          )}
        </div>
        {/* Waiting List Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Waiting List
              {selectedBranch !== 'all' && (
                <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">
                  {selectedBranch === 'cabugao' ? 'Cabugao' : 'San Juan'} Branch
                </span>
              )}
            </h3>
            {isQueueUpdating && (
              <div className="flex items-center text-xs text-blue-600">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                Updating...
              </div>
            )}
          </div>
          <div className="text-gray-500 text-sm mb-2">Patients in queue: {waitingList.length}</div>
          {waitingList.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No patients in the waiting queue.</div>
          ) : (
            <ul className="divide-y divide-gray-200 max-h-48 overflow-y-auto">
              {waitingList.map((patient) => (
                <li key={patient.id} className="flex justify-between items-center py-2">
                  <div className="flex items-center">
                    <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full ${patient.isCurrentUser ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-600'} text-sm font-medium mr-3`}>
                      {patient.queueNumber}
                    </span>
                    {patient.isCurrentUser ? (
                      <span className="text-sm font-bold text-primary-700">{patient.fullName}</span>
                    ) : (
                      <span className="text-sm text-gray-700 blur-[4.5px] opacity-100 select-none">{patient.fullName}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{patient.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Payment Redirect Alert */}
      {showPaymentRedirect && completedSession && (
        <div className="bg-green-50 border-l-4 border-green-500 rounded-lg shadow-md p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <FiCreditCard className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-3 flex-grow">
              <h3 className="text-lg font-bold text-green-800">
                Treatment Completed!
              </h3>
              <div className="mt-2">
                <p className="text-green-700 font-medium">
                  Your dental session has been completed. Please proceed to make your payment.
                </p>
                <p className="text-green-700 mt-2">
                  Queue session #{completedSession.queue_number} - Treatment completed
                </p>
              </div>
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={handlePaymentRedirect}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <FiArrowRight className="mr-2 h-4 w-4" />
                  Go to Payment
                </button>
                <button
                  onClick={dismissPaymentRedirect}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IT'S YOUR TURN Alert - Mobile Optimized */}
      {isYourTurn && (
        <div className="bg-green-50 border-l-4 border-green-500 rounded-lg shadow-md p-3 sm:p-4 lg:p-6 animate-pulse">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <FiBell className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-bold text-green-800">
                IT'S YOUR TURN NOW!
              </h3>
              <div className="mt-2">
                <p className="text-sm sm:text-base text-green-700 font-medium">
                  Please proceed to the dental clinic. The doctor is ready to see you.
                </p>
                <p className="text-sm sm:text-base text-green-700 mt-2">
                  Your queue number: <span className="font-bold text-lg sm:text-xl">{queuePosition?.queue_number}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      

      {/* Quick Actions - Mobile Optimized */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        <Link
          to="/patient/appointments"
          className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6 hover:shadow-lg transition-shadow flex flex-col items-center justify-center text-center h-full"
        >
          <div className="p-2 sm:p-3 bg-primary-100 rounded-full">
            <FiCalendar className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-primary-600" />
          </div>
          <h3 className="mt-2 sm:mt-3 lg:mt-4 text-sm sm:text-base lg:text-lg font-medium text-gray-600">Book Appointment</h3>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">Schedule your next dental visit</p>
        </Link>

        <Link
          to="/patient/history"
          className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6 hover:shadow-lg transition-shadow flex flex-col items-center justify-center text-center h-full"
        >
          <div className="p-2 sm:p-3 bg-blue-100 rounded-full">
            <FiFileText className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-blue-600" />
          </div>
          <h3 className="mt-2 sm:mt-3 lg:mt-4 text-sm sm:text-base lg:text-lg font-medium text-gray-600">Dental Charts</h3>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">View your Dental Chart</p>
        </Link>

        <Link
          to="/patient/payments"
          className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6 hover:shadow-lg transition-shadow flex flex-col items-center justify-center text-center h-full"
        >
          <div className="p-2 sm:p-3 bg-green-100 rounded-full">
            <FiCreditCard className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-green-600" />
          </div>
          <h3 className="mt-2 sm:mt-3 lg:mt-4 text-sm sm:text-base lg:text-lg font-medium text-gray-600">Payments</h3>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">Manage your billing and payments</p>
        </Link>
      </div>

      {/* Upcoming Appointments - Mobile Optimized */}
      {upcomingAppointments.length > 0 && (
        <div className="bg-blue-50 rounded-lg shadow-md overflow-hidden border border-blue-200">
          <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-base sm:text-lg font-medium text-gray-900">Upcoming Appointments</h2>
            <Link to="/patient/appointments" className="text-primary-600 hover:text-primary-900 text-xs sm:text-sm font-medium flex items-center">
              <span className="hidden sm:inline">View all</span>
              <span className="sm:hidden">View</span>
              <FiChevronRight className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
            </Link>
          </div>
          <ul className="divide-y divide-gray-200">
            {upcomingAppointments.map((appointment) => (
              <li key={appointment.id} className="p-3 sm:p-4 lg:p-6 hover:bg-gray-50">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="p-1.5 sm:p-2 bg-primary-100 rounded-lg">
                      <FiCalendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between space-x-2">
                      <h3 className="text-sm sm:text-base font-medium text-gray-900 truncate">
                        {formatDate(appointment.appointment_date)}
                      </h3>
                      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-medium rounded-full flex-shrink-0 ${getStatusBadgeClass(appointment.status)}`}>
                        {appointment.status}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      {formatTime(appointment.appointment_time)} - {formatTime(calculateEndTime(appointment.appointment_time, appointment.duration))}
                    </p>
                    
                    {appointment.serviceNames && appointment.serviceNames.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs sm:text-sm font-medium text-gray-700">Services:</p>
                        <ul className="mt-1 text-xs sm:text-sm text-gray-600 space-y-0.5">
                          {appointment.serviceNames.map((service, index) => (
                            <li key={index} className="flex items-center">
                              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-primary-500 rounded-full mr-2 flex-shrink-0"></div>
                              <span className="truncate">{service}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {appointment.branch && (
                      <p className="mt-2 text-xs sm:text-sm text-gray-600 flex items-center">
                        <FiMapPin className="mr-1 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <span className="font-medium">Branch:</span> 
                        <span className="ml-1 truncate">{appointment.branch}</span>
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}


      </div>
    </div>
  );
};

export default PatientDashboard;