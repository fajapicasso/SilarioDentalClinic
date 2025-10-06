// src/pages/admin/QueueMonitoring.jsx
import React, { useState, useEffect } from 'react';
import { FiUser, FiClock, FiEye, FiRefreshCw, FiFilter, FiInfo } from 'react-icons/fi';
import supabase from '../../config/supabaseClient';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getTodayQueueEntries } from '../../utils/philippineTime';

const QueueMonitoring = () => {
  const [currentPatient, setCurrentPatient] = useState(null);
  const [waitingPatients, setWaitingPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activityLogs, setActivityLogs] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [branches, setBranches] = useState(['Cabugao', 'San Juan']);
  const [stats, setStats] = useState({
    totalInQueue: 0,
    avgWaitTime: 0,
    completedToday: 0
  });

  // Fetch initial data
  useEffect(() => {
    fetchQueueData();
    
    // Set up real-time subscription
    const queueSubscription = supabase
      .channel('public:queue')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'queue' 
      }, () => {
        // Refresh data when there's a change in the queue table
        fetchQueueData();
      })
      .subscribe();
    
    // Clean up subscription
    return () => {
      supabase.removeChannel(queueSubscription);
    };
  }, [selectedBranch]);

  // Helper to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Returns YYYY-MM-DD
  };

  const fetchQueueData = async () => {
    setIsLoading(true);
    try {
      const todayDate = getTodayDate();
      
      // First, fetch all services for later reference
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*');
      
      if (servicesError) {
        console.error('Error fetching services:', servicesError);
        throw servicesError;
      }
      
      // Create a map of service IDs to service data
      const servicesMap = {};
      if (servicesData) {
        servicesData.forEach(service => {
          servicesMap[service.id] = service;
        });
      }
      
      // Fetch today's appointments with service information
      let appointmentsQuery = supabase
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
          profiles:patient_id(id, full_name, phone, email),
          appointment_services(id, service_id)
        `)
        .eq('appointment_date', todayDate)
        .in('status', ['confirmed', 'appointed', 'in_progress'])
        .order('appointment_time', { ascending: true });
      
      if (selectedBranch !== 'all') {
        appointmentsQuery = appointmentsQuery.eq('branch', selectedBranch);
      }
      
      const { data: todayAppointments, error: appointmentsError } = await appointmentsQuery;
      
      if (appointmentsError) {
        console.error('Error fetching today\'s appointments:', appointmentsError);
        throw appointmentsError;
      }
      
      // Process appointments to include full service information (doctor id kept for later mapping)
      const processedAppointments = todayAppointments.map(appointment => {
        // Get service objects from service IDs
        const services = [];
        
        if (appointment.appointment_services && appointment.appointment_services.length > 0) {
          appointment.appointment_services.forEach(as => {
            const service = servicesMap[as.service_id];
            if (service) {
              services.push({
                id: service.id,
                name: service.name,
                description: service.description,
                price: service.price,
                duration: service.duration
              });
            }
          });
        }
        
        // If no services found, extract from notes/teeth_involved
        if (services.length === 0) {
          if (appointment.teeth_involved && appointment.teeth_involved.trim() !== '') {
            services.push({
              name: `Treatment for: ${appointment.teeth_involved}`,
              description: '',
              price: '',
              duration: 30
            });
          }
          
          if (appointment.notes && appointment.notes.trim() !== '') {
            services.push({
              name: appointment.notes,
              description: '',
              price: '',
              duration: 30
            });
          }
          
          // Default service if nothing found
          if (services.length === 0) {
            services.push({
              name: 'Walk-in Consultation',
              description: '',
              price: '',
              duration: 30
            });
          }
        }
        
        return {
          ...appointment,
          enrichedServices: services
        };
      });
      
      // Fetch doctor profiles for appointments that have assigned doctors
      const doctorIds = [...new Set(todayAppointments.map(a => a.doctor_id).filter(Boolean))];
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
      
      // Create a map of appointment IDs to processed appointments for easy lookup
      const appointmentsMap = {};
      processedAppointments.forEach(appointment => {
        appointmentsMap[appointment.id] = appointment;
      });
      
      // Then, fetch the queue entries for today
      let queueQuery = supabase
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
          notes,
          profiles:patient_id(id, full_name, phone, email)
        `)
        .in('status', ['waiting', 'serving'])
        .gte('created_at', `${todayDate}T00:00:00`)
        .lte('created_at', `${todayDate}T23:59:59`)
        .order('queue_number', { ascending: true });
      
      const { data: queueData, error: queueError } = await queueQuery;
      
      if (queueError) {
        console.error('Error fetching queue data:', queueError);
        throw queueError;
      }
      
      // After fetching queueData and todayAppointments
      console.log('Fetched queueData:', queueData);
      console.log('Processed appointments:', processedAppointments);
      console.log('Appointments map:', appointmentsMap);
      
      // Format queue data with appointment details and apply branch filtering
      let formattedQueue = [];
      
      if (queueData && queueData.length > 0) {
        formattedQueue = queueData.map(item => {
          // Find matching appointment if appointment_id exists
          const matchingAppointment = item.appointment_id ? 
            appointmentsMap[item.appointment_id] : 
            processedAppointments.find(a => a.patient_id === item.patient_id);
          
          // More robust branch assignment, prioritizing appointment's branch
          let branch = null;
          if (matchingAppointment && matchingAppointment.branch) {
            branch = matchingAppointment.branch;
          } else {
            // Fallback to queue item's branch if appointment branch isn't set
            branch = item.branch;
          }

          // Fallback: try to find the patient's most recent appointment for today
          if (!branch) {
            const todayAppointmentsForPatient = processedAppointments.filter(a => a.patient_id === item.patient_id);
            if (todayAppointmentsForPatient.length > 0) {
              // Use the branch from the most recent appointment (by time)
              todayAppointmentsForPatient.sort((a, b) => new Date(b.appointment_time) - new Date(a.appointment_time));
              branch = todayAppointmentsForPatient[0].branch;
            }
          }
          if (!branch) branch = 'N/A';
          
          // Get services from matching appointment
          const services = matchingAppointment ? 
            matchingAppointment.enrichedServices.map(s => s.name) : 
            ['Dental Consultation'];
          
          // Get doctor information: prefer appointment's doctor; fallback to queue notes (walk-ins)
          let doctorProfile = null;
          if (matchingAppointment && matchingAppointment.doctor_id) {
            doctorProfile = doctorProfiles[matchingAppointment.doctor_id] || null;
          }
          if (!doctorProfile && item.notes) {
            const m = item.notes.match(/Doctor: Dr\. ([^|\n]+)/);
            if (m) {
              doctorProfile = { full_name: m[1].trim() };
            }
          }
          
          return {
            id: item.id,
            patientId: item.patient_id,
            appointmentId: item.appointment_id,
            queueNumber: item.queue_number,
            status: item.status,
            name: item.profiles?.full_name || 'Unknown',
            phone: item.profiles?.phone || 'N/A',
            email: item.profiles?.email || 'N/A',
            doctorName: doctorProfile?.full_name || null,
            branch: branch,
            waitingTime: calculateWaitingTime(item.created_at, item.status, matchingAppointment?.appointment_time, matchingAppointment?.appointment_date, item.updated_at),
            services: services
          };
        });
        
        // Apply branch filtering to the formatted queue data
        if (selectedBranch !== 'all') {
          formattedQueue = formattedQueue.filter(item => item.branch === selectedBranch);
        }
      }
      
      // Set currently serving patient
      const serving = formattedQueue.find(p => p.status === 'serving');
      if (serving) {
        setCurrentPatient(serving);
        
        // Remove serving patient from waiting list
        const waiting = formattedQueue.filter(p => p.status === 'waiting');
        setWaitingPatients(waiting);
      } else {
        setCurrentPatient(null);
        setWaitingPatients(formattedQueue.filter(p => p.status === 'waiting'));
      }
      
      // Also fetch today's activity for the log (completed and cancelled statuses)
      let activityQuery = supabase
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
          profiles:patient_id(id, full_name)
        `)
        .in('status', ['completed', 'cancelled'])
        .gte('updated_at', `${todayDate}T00:00:00`)
        .lte('updated_at', `${todayDate}T23:59:59`)
        .order('updated_at', { ascending: false })
        .limit(10);
      
      const { data: todayActivity, error: activityError } = await activityQuery;
      
      if (activityError) {
        console.error('Error fetching today\'s activity:', activityError);
      } else {
        // Fetch all relevant appointments for these patients
        // First, collect all patient IDs
        const patientIds = todayActivity.map(item => item.patient_id);
        
        // Fetch all appointments for these patients on this day
        const { data: patientAppointments, error: patientAppError } = await supabase
          .from('appointments')
          .select('id, patient_id, branch, doctor_id')
          .in('patient_id', patientIds)
          .eq('appointment_date', todayDate);
        
        // Create lookup maps
        let patientBranchMap = {};
        let appointmentBranchMap = {};
        
        if (!patientAppError && patientAppointments) {
          // Map of patient ID to their most common branch
          patientBranchMap = patientAppointments.reduce((acc, app) => {
            if (!acc[app.patient_id]) {
              acc[app.patient_id] = app.branch;
            }
            return acc;
          }, {});
          
          // Map of appointment ID to branch
          appointmentBranchMap = patientAppointments.reduce((acc, app) => {
            acc[app.id] = app.branch;
            return acc;
          }, {});
        }
        
        // Format activity logs with proper branch information
        let newLogs = todayActivity?.map(item => {
          // Try multiple ways to determine branch:
          // 1. Queue's branch field if present
          // 2. Associated appointment's branch if appointment_id exists
          // 3. Look up patient's appointment for today
          // 4. Default to N/A
          
          let branch = item.branch;
          
          if (!branch && item.appointment_id) {
            branch = appointmentBranchMap[item.appointment_id];
          }
          
          if (!branch && item.patient_id) {
            branch = patientBranchMap[item.patient_id];
          }
          
          // If still no branch, use N/A as fallback
          if (!branch) {
            // Let's do one more check - get the most recent appointment for this patient
            const recentAppointment = patientAppointments?.find(app => app.patient_id === item.patient_id);
            branch = recentAppointment?.branch || 'N/A';
          }
          
          return {
            id: item.id,
            patientName: item.profiles?.full_name || 'Unknown Patient',
            queueNumber: item.queueNumber,
            status: item.status,
            branch: branch,
            timestamp: new Date(item.updated_at).toLocaleString()
          };
        }) || [];
        
        // Apply branch filtering to activity logs
        if (selectedBranch !== 'all') {
          newLogs = newLogs.filter(log => log.branch === selectedBranch);
        }
        
        setActivityLogs(newLogs);
      }
      
      // Calculate stats
      calculateQueueStats(formattedQueue, todayActivity || []);
      
    } catch (error) {
      console.error('Error in fetchQueueData:', error);
      toast.error('Failed to load queue data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Calculate queue statistics
  const calculateQueueStats = (queueData, activityData) => {
    // Total number of patients in queue
    const totalInQueue = queueData.length;
    
    // Average waiting time of current patients
    const totalWaitingTime = queueData.reduce((sum, patient) => sum + patient.waitingTime, 0);
    const avgWaitTime = totalInQueue > 0 ? Math.round(totalWaitingTime / totalInQueue) : 0;
    
    // Count of completed appointments today
    const completedToday = activityData.filter(item => item.status === 'completed').length;
    
    setStats({
      totalInQueue,
      avgWaitTime,
      completedToday
    });
  };
  
  // Function to calculate waiting time in minutes
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
  
  // Refresh queue data
  const refreshQueue = () => {
    fetchQueueData();
    toast.info('Queue refreshed');
  };
  
  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Queue Monitoring</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <label htmlFor="branch-selector" className="mr-2 text-sm font-medium text-gray-700">
                Branch:
              </label>
              <select
                id="branch-selector"
                className="border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="all">All Branches</option>
                {branches.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
            <button 
              onClick={refreshQueue}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              title="Refresh queue"
            >
              <FiRefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-800">
                <FiUser className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Patients in Queue</h3>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalInQueue}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-800">
                <FiClock className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Avg. Waiting Time</h3>
                <p className="text-2xl font-semibold text-gray-900">{stats.avgWaitTime} min</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg shadow-sm p-4">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-primary-100 text-primary-800">
                <FiInfo className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-gray-500">Completed Today</h3>
                <p className="text-2xl font-semibold text-gray-900">{stats.completedToday}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Patient */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-5 sm:px-6 bg-primary-50 border-b border-primary-100">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Now Serving</h3>
              </div>
              <div className="p-6">
                {currentPatient ? (
                  <div>
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <FiUser className="h-6 w-6 text-primary-600" />
                      </div>
                      <div className="ml-4">
                        <h4 className="text-lg font-medium text-gray-900">{currentPatient.name}</h4>
                        {currentPatient.doctorName && (
                          <p className="text-sm text-blue-600 font-medium">
                            Dr. {currentPatient.doctorName}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">Queue #{currentPatient.queueNumber}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-start">
                        <FiClock className="mt-1 mr-2 h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          Waiting time: {currentPatient.waitingTime} minutes
                        </span>
                      </div>
                      <div className="flex items-start">
                        <FiFilter className="mt-1 mr-2 h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          Branch: {currentPatient.branch}
                        </span>
                      </div>
                      <div className="flex items-start">
                        <div className="mr-2 h-4 w-4 text-gray-400">🦷</div>
                        <div className="text-sm text-gray-600">
                          <div>Services:</div>
                          <ul className="list-disc list-inside ml-1 mt-1">
                            {currentPatient.services.map((service, idx) => (
                              <li key={idx}>{service}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="mx-auto h-12 w-12 text-gray-400">
                      <FiUser className="h-full w-full" />
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No active patient</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Currently no patients being served.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Waiting List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Waiting List</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Patients in queue: {waitingPatients.length}</p>
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
                              {patient.doctorName && (
                                <p className="text-xs text-blue-600 font-medium">
                                  Dr. {patient.doctorName}
                                </p>
                              )}
                              <div className="flex items-center flex-wrap">
                                <span className="text-xs text-gray-500">Queue #{patient.queueNumber}</span>
                                <span className="mx-1.5 text-gray-500">•</span>
                                <span className="text-xs text-gray-500">Waiting: {patient.waitingTime} mins</span>
                                <span className="mx-1.5 text-gray-500">•</span>
                                <span className="text-xs text-gray-500">Branch: {patient.branch}</span>
                              </div>
                              <div className="mt-1">
                                <span className="text-xs text-gray-500">
                                  {patient.services.length > 0 ? 
                                    patient.services[0] + (patient.services.length > 1 ? ' +' + (patient.services.length - 1) + ' more' : '') : 
                                    'No services'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Waiting
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-gray-500">No patients in the waiting queue.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Log */}
        <div className="mt-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Queue Activity Log</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">Today's queue management activities</p>
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
                        Status
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
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-gray-500">No queue activity recorded today.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueueMonitoring;