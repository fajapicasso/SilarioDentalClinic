// src/pages/staff/Dashboard.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../config/supabaseClient';
import { 
  FiCalendar, FiUsers, FiClock, FiCheckSquare, 
  FiUser, FiChevronRight, FiEye, FiPhone, FiCheck
} from 'react-icons/fi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { toast } from 'react-toastify';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';
import { 
  getNextQueueNumberForToday, 
  isPatientInTodayQueue 
} from '../../utils/philippineTime';

const StaffDashboard = () => {
  const { user } = useAuth();
  const { logPageView } = useUniversalAudit();
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [waitingPatients, setWaitingPatients] = useState([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  
  const formatDate = (dateStr) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
  };

  const formatTime = (timeStr) => {
    const options = { hour: 'numeric', minute: 'numeric', hour12: true };
    const [hours, minutes] = timeStr.split(':');
    return new Date(0, 0, 0, hours, minutes).toLocaleTimeString('en-US', options);
  };

  useEffect(() => {
    // Log page view
    logPageView('Staff Dashboard', 'dashboard', 'main');
    
    const fetchDashboardData = async () => {
      setIsLoading(true);
      
      try {
        // Fetch staff profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profileError) throw profileError;
        setProfile(profileData);

        // Fetch today's appointments
        const today = new Date().toISOString().split('T')[0];
        const { data: todayData, error: todayError } = await supabase
          .from('appointments')
          .select(`
            id, 
            appointment_date, 
            appointment_time, 
            status, 
            branch,
            is_emergency,
            teeth_involved,
            notes,
            patients:patient_id (id, full_name, phone),
            services:appointment_services(
              service_id (id, name)
            )
          `)
          .eq('appointment_date', today)
          .order('appointment_time');
        
        if (todayError) throw todayError;
        
        // Format the services for each appointment
        const formattedTodayAppointments = todayData.map(appointment => ({
          ...appointment,
          serviceNames: appointment.services.map(s => s.service_id.name),
        }));
        
        setTodayAppointments(formattedTodayAppointments);

        // Fetch waiting patients in queue
        const { data: waitingData, error: waitingError } = await supabase
          .from('queue')
          .select(`
            id,
            queue_number,
            status,
            created_at,
            estimated_wait_time,
            patient_id,
            patients:patient_id (id, full_name, phone),
            appointment_id,
            appointments:appointment_id (
              branch,
              services:appointment_services(
                service_id (name)
              )
            )
          `)
          .in('status', ['waiting', 'serving'])
          .order('queue_number');
        
        if (waitingError) throw waitingError;
        setWaitingPatients(waitingData || []);

        // Fetch count of completed appointments today
        const { count: completedCount, error: completedError } = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('appointment_date', today)
          .eq('status', 'completed');
        
        if (completedError) throw completedError;
        setCompletedToday(completedCount || 0);

        // Fetch count of pending approval appointments
        const { count: pendingCount, error: pendingError } = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');
        
        if (pendingError) throw pendingError;
        setPendingApprovals(pendingCount || 0);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchDashboardData();
    }

    // Setup real-time subscription for queue updates
    const queueSubscription = supabase
      .channel('public:queue')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'queue' 
      }, () => {
        // Refresh queue data when there's a change
        fetchDashboardData();
      })
      .subscribe();

    // Setup real-time subscription for appointments updates
    const appointmentSubscription = supabase
      .channel('public:appointments')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'appointments' 
      }, () => {
        // Refresh appointment data when there's a change
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(queueSubscription);
      supabase.removeChannel(appointmentSubscription);
    };
  }, [user]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const addPatientToQueue = async (patientId, appointmentId) => {
    try {
      // Check if patient is already in today's queue
      const existingQueue = await isPatientInTodayQueue(supabase, patientId);
      
      if (existingQueue) {
        toast.info('Patient is already in today\'s queue');
        return;
      }
      
      // Get the next queue number for today (resets daily in Philippine time)
      const nextQueueNumber = await getNextQueueNumberForToday(supabase);
      
      // Add patient to queue
      const { error: insertError } = await supabase
        .from('queue')
        .insert({
          patient_id: patientId,
          appointment_id: appointmentId,
          status: 'waiting',
          queue_number: nextQueueNumber,
          created_at: new Date().toISOString(),
          estimated_wait_time: 15, // Default 15 min wait time
        });
      
      if (insertError) {
        toast.error('Failed to add patient to queue');
      } else {
        toast.success('Patient added to waiting queue');
      }
    } catch (error) {
      console.error('Error adding to queue:', error);
      toast.error('Failed to add patient to queue');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="space-y-6 p-6">
      {/* Welcome Section */}
      <div className="bg-blue-50 rounded-lg shadow-md p-6 border border-blue-200">
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome, {profile?.full_name || 'Staff'}!
        </h1>
        <p className="text-gray-600 mt-2">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg shadow-md p-6 border border-blue-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-primary-100 text-primary-800">
              <FiCalendar className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Today's Appointments</h3>
              <p className="text-2xl font-semibold text-gray-900">{todayAppointments.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 rounded-lg shadow-md p-6 border border-blue-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-800">
              <FiUsers className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Patients in Queue</h3>
              <p className="text-2xl font-semibold text-gray-900">{waitingPatients.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 rounded-lg shadow-md p-6 border border-blue-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-800">
              <FiClock className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Pending Approvals</h3>
              <p className="text-2xl font-semibold text-gray-900">{pendingApprovals}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 rounded-lg shadow-md p-6 border border-blue-200">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-800">
              <FiCheckSquare className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Completed Today</h3>
              <p className="text-2xl font-semibold text-gray-900">{completedToday}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Appointments */}
      <div className="bg-blue-50 rounded-lg shadow-md overflow-hidden border border-blue-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Today's Appointments</h2>
            <p className="text-sm text-gray-500 mt-1">Confirmed appointments are automatically added to the queue</p>
          </div>
          <Link
            to="/staff/appointments"
            className="text-primary-600 hover:text-primary-800 flex items-center text-sm font-medium"
          >
            View All <FiChevronRight className="ml-1" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          {todayAppointments.length > 0 ? (
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
                    Services
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {todayAppointments.map((appointment) => (
                  <tr key={appointment.id} className={appointment.is_emergency ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTime(appointment.appointment_time)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {appointment.patients.full_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {appointment.patients.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="max-w-xs truncate">
                        {appointment.serviceNames.join(', ')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {appointment.branch}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        appointment.status === 'pending' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : appointment.status === 'cancelled' 
                          ? 'bg-red-100 text-red-800'
                          : appointment.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : appointment.is_emergency
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {appointment.status === 'confirmed' && appointment.is_emergency
                          ? 'Emergency'
                          : appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {appointment.status === 'confirmed' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <FiCheck className="mr-1" />
                          In Queue
                        </span>
                      )}
                      {appointment.status === 'pending' && (
                        <button 
                          onClick={async () => {
                            try {
                              const { error } = await supabase
                                .from('appointments')
                                .update({ status: 'confirmed' })
                                .eq('id', appointment.id);
                              
                              if (error) throw error;
                              toast.success('Appointment confirmed and added to queue');
                            } catch (error) {
                              console.error('Error confirming appointment:', error);
                              toast.error('Failed to confirm appointment');
                            }
                          }}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          Confirm
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No appointments scheduled for today.</p>
            </div>
          )}
        </div>
      </div>

      {/* Waiting Queue */}
      <div className="bg-blue-50 rounded-lg shadow-md overflow-hidden border border-blue-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Current Queue</h2>
            <p className="text-sm text-gray-500 mt-1">Includes confirmed appointments and walk-in patients</p>
          </div>
          <Link
            to="/staff/queue"
            className="text-primary-600 hover:text-primary-800 flex items-center text-sm font-medium"
          >
            Manage Queue <FiChevronRight className="ml-1" />
          </Link>
        </div>
        <div className="p-6">
          {waitingPatients.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {waitingPatients.map((patient, index) => (
                <div key={patient.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Queue #{patient.queue_number}
                      </span>
                      <h3 className="mt-1 text-lg font-medium text-gray-900">{patient.patients.full_name}</h3>
                      <div className="mt-1 text-sm text-gray-600">
                        <div className="flex items-center">
                          <FiPhone className="mr-1 h-3 w-3" />
                          <span>{patient.patients.phone || 'No phone'}</span>
                        </div>
                        <div className="mt-1">
                          <span className="font-medium">Status:</span> {patient.status === 'serving' ? 'Being Served' : 'Waiting'}
                        </div>
                        <div className="mt-1">
                          <span className="font-medium">Wait time:</span> ~{patient.estimated_wait_time || ((index + 1) * 15)} mins
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        // Navigate to patient records
                        window.location.href = `/staff/patients/${patient.patient_id}`;
                      }}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      <FiEye className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No patients in the queue.</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default StaffDashboard;