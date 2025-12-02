import React, { useState, useEffect } from 'react';
import supabase from '../../config/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiSearch, FiPlus, FiUser, FiCheckCircle, FiXCircle, FiClock, FiX, FiMapPin, FiEdit, FiEye, FiList } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const AppointmentCalendar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [stats, setStats] = useState({
    attended: 0,
    missed: 0,
    total: 0
  });

  // Get current month and year
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const firstDayWeekday = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  // Generate calendar days
  const generateCalendarDays = () => {
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayWeekday; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();

  // Fetch appointments for the current month
  const fetchAppointments = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(currentYear, currentMonth + 1, 0);
      
      console.log('Date range for query:', {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        currentMonth,
        currentYear
      });
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          status,
          notes,
          branch,
          teeth_involved,
          guardian_id,
          profiles:patient_id (
            id,
            full_name,
            phone,
            email
          )
        `)
        .eq('doctor_id', user.id)
        .gte('appointment_date', startDate.toISOString().split('T')[0])
        .lte('appointment_date', endDate.toISOString().split('T')[0])
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (error) throw error;

      console.log('Raw appointments data from database:', {
        count: data?.length || 0,
        appointments: data?.map(apt => ({
          id: apt.id,
          date: apt.appointment_date,
          status: apt.status,
          patient: apt.profiles?.full_name
        }))
      });

      // Fetch guardian profiles for appointments with guardian_id
      const guardianIds = [...new Set(data?.map(a => a.guardian_id).filter(Boolean))] || [];
      let guardianMap = {};
      
      if (guardianIds.length > 0) {
        const { data: guardianData, error: guardianError } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .in('id', guardianIds);
        
        if (guardianError) {
          console.error('Error fetching guardian profiles:', guardianError);
        } else if (guardianData) {
          guardianData.forEach(guardian => {
            guardianMap[guardian.id] = guardian;
          });
        }
      }

      // Fetch appointment services separately
      const appointmentIds = data?.map(app => app.id) || [];
      let appointmentServicesData = [];
      
      if (appointmentIds.length > 0) {
        const { data: servicesData, error: servicesError } = await supabase
          .from('appointment_services')
          .select(`
            appointment_id,
            service_id,
            services:service_id(id, name, description, price, duration)
          `)
          .in('appointment_id', appointmentIds);
        
        if (servicesError) {
          console.error('Error fetching appointment services:', servicesError);
        } else {
          appointmentServicesData = servicesData || [];
        }
      }

      // Combine appointments with their services and guardian info
      const appointmentsWithServices = data?.map(appointment => {
        const appointmentServices = appointmentServicesData.filter(
          aptService => aptService.appointment_id === appointment.id
        );
        
        const guardian = appointment.guardian_id ? guardianMap[appointment.guardian_id] : null;
        
        console.log(`Appointment ${appointment.id} (${appointment.profiles?.full_name}):`, {
          appointmentServices,
          servicesCount: appointmentServices.length,
          guardian: guardian?.full_name || null
        });
        
        return {
          ...appointment,
          appointment_services: appointmentServices,
          guardian: guardian,
          guardianName: guardian?.full_name || null
        };
      }) || [];

      console.log('All appointment services data:', appointmentServicesData);
      console.log('Appointments with services:', appointmentsWithServices);

      setAppointments(appointmentsWithServices);
      
      // Calculate statistics
      const attended = appointmentsWithServices.filter(apt => apt.status === 'completed').length;
      const missed = appointmentsWithServices.filter(apt => 
        apt.status === 'cancelled' || 
        apt.status === 'no_show' || 
        apt.status === 'rejected'
      ).length;
      const total = appointmentsWithServices.length;
      
      console.log('Statistics calculation:', {
        totalAppointments: appointmentsWithServices.length,
        attended,
        missed,
        allStatuses: appointmentsWithServices.map(apt => ({ 
          id: apt.id, 
          status: apt.status, 
          date: apt.appointment_date,
          patient: apt.profiles?.full_name 
        }))
      });
      
      setStats({ attended, missed, total });
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.error('Failed to load appointments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [user, currentDate]);

  // Get appointments for a specific day
  const getAppointmentsForDay = (day) => {
    if (!day) return [];
    
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return appointments.filter(apt => apt.appointment_date === dateStr);
  };

  // Navigate months
  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  // Handle day click to show all appointments
  const handleDayClick = (day) => {
    if (!day) return;
    
    const dayAppointments = getAppointmentsForDay(day);
    if (dayAppointments.length > 0) {
      setSelectedDay({
        day,
        date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        appointments: dayAppointments
      });
      setShowDayModal(true);
    } else {
      toast.info(`No appointments scheduled for ${monthNames[currentMonth]} ${day}, ${currentYear}`);
    }
  };

  // Close day modal
  const closeDayModal = () => {
    setShowDayModal(false);
    setSelectedDay(null);
  };

  // Handle view appointment
  const handleViewAppointment = (appointment) => {
    setSelectedAppointment(appointment);
    setShowViewModal(true);
  };

  // Handle edit appointment
  const handleEditAppointment = (appointment) => {
    // Navigate to the appointments page with the specific appointment
    navigate(`/doctor/appointments?edit=${appointment.id}`);
  };

  // Close view modal
  const closeViewModal = () => {
    setShowViewModal(false);
    setSelectedAppointment(null);
  };

  // Format time to 12-hour format
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Format services for display
  const formatServices = (appointmentServices) => {
    if (!appointmentServices || appointmentServices.length === 0) {
      return 'No services selected';
    }
    
    const serviceNames = appointmentServices
      .map(aptService => aptService.services?.name)
      .filter(Boolean);
    
    if (serviceNames.length === 0) {
      return 'No services selected';
    }
    
    if (serviceNames.length <= 2) {
      return serviceNames.join(', ');
    }
    
    return `${serviceNames.slice(0, 2).join(', ')} +${serviceNames.length - 2} more`;
  };

  // Get status color and icon
  const getStatusInfo = (status) => {
    switch (status) {
      case 'completed':
        return { color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', icon: FiCheckCircle };
      case 'cancelled':
      case 'no_show':
      case 'rejected':
        return { color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', icon: FiXCircle };
      case 'scheduled':
        return { color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', icon: FiClock };
      default:
        return { color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', icon: FiClock };
    }
  };

  // Filter appointments based on search
  const filteredAppointments = appointments.filter(apt => {
    if (!searchQuery) return true;
    const patientName = apt.profiles?.full_name?.toLowerCase() || '';
    return patientName.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.user_metadata?.full_name || 'Doctor'}</h1>
              <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Doctor
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search patients..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                onClick={() => setShowAddPatient(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FiPlus className="h-4 w-4 mr-2" />
                Add Patient
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <FiChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center">
                <FiCalendar className="h-5 w-5 text-gray-400 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">
                  {monthNames[currentMonth]} {currentYear}
                </h2>
              </div>
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <FiChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-6 py-4">
            <div className="flex items-center">
              <FiCheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">Attended</span>
              <span className="ml-2 text-sm font-bold text-gray-900">{stats.attended}</span>
            </div>
            <div className="flex items-center">
              <FiXCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">Missed</span>
              <span className="ml-2 text-sm font-bold text-gray-900">{stats.missed}</span>
            </div>
            <div className="flex items-center">
              <FiUser className="h-5 w-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">Total Patients</span>
              <span className="ml-2 text-sm font-bold text-gray-900">{stats.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Days of week header */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="px-4 py-3 text-center text-sm font-medium text-gray-500 bg-gray-50">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dayAppointments = getAppointmentsForDay(day);
              const StatusIcon = dayAppointments.length > 0 ? getStatusInfo(dayAppointments[0].status).icon : null;
              
              return (
                <div 
                  key={index} 
                  className={`min-h-[120px] border-r border-b border-gray-200 last:border-r-0 p-2 ${day ? 'cursor-pointer hover:bg-gray-50 transition-colors duration-150' : ''}`}
                  onClick={() => handleDayClick(day)}
                >
                  {day ? (
                    <>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-gray-900">{day}</span>
                        {dayAppointments.length > 0 && (
                          <div className="flex items-center">
                            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-blue-600 bg-blue-100 rounded-full">
                              {dayAppointments.length}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        {dayAppointments.slice(0, 2).map((appointment) => {
                          const statusInfo = getStatusInfo(appointment.status);
                          const StatusIcon = statusInfo.icon;
                          
                          return (
                            <div
                              key={appointment.id}
                              className={`p-2 rounded border ${statusInfo.bgColor} ${statusInfo.borderColor} ${statusInfo.color}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center min-w-0 flex-1">
                                  <StatusIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <span className="text-xs font-medium truncate block">
                                      {appointment.profiles?.full_name || 'Unknown Patient'}
                                    </span>
                                    {appointment.guardianName && (
                                      <span className="text-xs text-gray-500 truncate block mt-0.5">
                                        {appointment.guardianName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {formatTime(appointment.appointment_time)}
                              </div>
                              <div className="text-xs text-gray-500 mt-1 truncate">
                                {formatServices(appointment.appointment_services)}
                              </div>
                              {appointment.notes && (
                                <div className="text-xs text-gray-500 mt-1 truncate">
                                  "{appointment.notes}"
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {dayAppointments.length > 2 && (
                          <div className="text-xs text-gray-500 text-center">
                            +{dayAppointments.length - 2} more
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="h-full"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Day Details Modal */}
      {showDayModal && selectedDay && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center">
                <FiCalendar className="h-6 w-6 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {monthNames[currentMonth]} {selectedDay.day}, {currentYear}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {selectedDay.appointments.length} appointment{selectedDay.appointments.length !== 1 ? 's' : ''} scheduled
                  </p>
                </div>
              </div>
              <button
                onClick={closeDayModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors duration-150"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                {selectedDay.appointments.map((appointment) => {
                  const statusInfo = getStatusInfo(appointment.status);
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <div
                      key={appointment.id}
                      className={`p-4 rounded-lg border ${statusInfo.bgColor} ${statusInfo.borderColor} ${statusInfo.color}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <StatusIcon className="h-5 w-5 mr-2" />
                            <div>
                              <h4 className="text-lg font-semibold">
                                {appointment.profiles?.full_name || 'Unknown Patient'}
                              </h4>
                              {appointment.guardianName && (
                                <p className="text-sm text-gray-600 mt-0.5">
                                  Guardian: {appointment.guardianName}
                                </p>
                              )}
                            </div>
                            <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${
                              appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                              appointment.status === 'cancelled' || appointment.status === 'no_show' || appointment.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                              <div className="flex items-center">
                                <FiClock className="h-4 w-4 mr-2 text-gray-500" />
                                <span className="text-gray-700">
                                  <strong>Time:</strong> {formatTime(appointment.appointment_time)}
                                </span>
                              </div>
                              
                              {appointment.branch && (
                                <div className="flex items-center">
                                  <FiMapPin className="h-4 w-4 mr-2 text-gray-500" />
                                  <span className="text-gray-700">
                                    <strong>Branch:</strong> {appointment.branch}
                                  </span>
                                </div>
                              )}
                              
                              {appointment.teeth_involved && (
                                <div className="flex items-center">
                                  <FiUser className="h-4 w-4 mr-2 text-gray-500" />
                                  <span className="text-gray-700">
                                    <strong>Teeth Involved:</strong> {appointment.teeth_involved}
                                  </span>
                                </div>
                              )}
                              
                              <div className="flex items-center">
                                <FiList className="h-4 w-4 mr-2 text-gray-500" />
                                <span className="text-gray-700">
                                  <strong>Services:</strong> {formatServices(appointment.appointment_services)}
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              {appointment.profiles?.phone && (
                                <div className="flex items-center">
                                  <span className="text-gray-700">
                                    <strong>Phone:</strong> {appointment.profiles.phone}
                                  </span>
                                </div>
                              )}
                              
                              {appointment.profiles?.email && (
                                <div className="flex items-center">
                                  <span className="text-gray-700">
                                    <strong>Email:</strong> {appointment.profiles.email}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {appointment.notes && (
                            <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                              <p className="text-sm text-gray-700">
                                <strong>Notes:</strong> {appointment.notes}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col space-y-2 ml-4">
                          <button
                            onClick={() => handleViewAppointment(appointment)}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors duration-150"
                            title="View Details"
                          >
                            <FiEye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEditAppointment(appointment)}
                            className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors duration-150"
                            title="Edit Appointment"
                          >
                            <FiEdit className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={closeDayModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-150"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Appointment View Modal */}
      {showViewModal && selectedAppointment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center">
                <FiUser className="h-6 w-6 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Appointment Details
                  </h3>
                  <p className="text-sm text-gray-900 font-medium">
                    {selectedAppointment.profiles?.full_name || 'Unknown Patient'}
                  </p>
                  {selectedAppointment.guardianName && (
                    <p className="text-sm text-gray-600 mt-0.5">
                      Guardian: {selectedAppointment.guardianName}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={closeViewModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors duration-150"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-6">
                {/* Patient Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FiUser className="h-5 w-5 mr-2 text-blue-600" />
                    Patient Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Full Name</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedAppointment.profiles?.full_name || 'Not provided'}
                      </p>
                      {selectedAppointment.guardianName && (
                        <p className="mt-1 text-sm text-gray-600">
                          <span className="font-medium">Guardian:</span> {selectedAppointment.guardianName}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedAppointment.profiles?.phone || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedAppointment.profiles?.email || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <span className={`mt-1 inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        selectedAppointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                        selectedAppointment.status === 'cancelled' || selectedAppointment.status === 'no_show' || selectedAppointment.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {selectedAppointment.status.charAt(0).toUpperCase() + selectedAppointment.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Appointment Details */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FiCalendar className="h-5 w-5 mr-2 text-blue-600" />
                    Appointment Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Date</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {new Date(selectedAppointment.appointment_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Time</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {formatTime(selectedAppointment.appointment_time)}
                      </p>
                    </div>
                    {selectedAppointment.branch && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Branch</label>
                        <p className="mt-1 text-sm text-gray-900 flex items-center">
                          <FiMapPin className="h-4 w-4 mr-1 text-gray-500" />
                          {selectedAppointment.branch}
                        </p>
                      </div>
                    )}
                    {selectedAppointment.teeth_involved && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Teeth Involved</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {selectedAppointment.teeth_involved}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Services */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FiList className="h-5 w-5 mr-2 text-blue-600" />
                    Selected Services
                  </h4>
                  <div className="space-y-3">
                    {selectedAppointment.appointment_services && selectedAppointment.appointment_services.length > 0 ? (
                      selectedAppointment.appointment_services.map((aptService, index) => (
                        <div key={index} className="bg-white rounded border border-gray-200 p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900">
                                {aptService.services?.name || 'Unknown Service'}
                              </h5>
                              {aptService.services?.duration && (
                                <p className="text-sm text-gray-500 mt-1">
                                  Duration: {aptService.services.duration} minutes
                                </p>
                              )}
                            </div>
                            {aptService.services?.price && (
                              <div className="text-right">
                                <p className="font-semibold text-gray-900">
                                  PHP {parseFloat(aptService.services.price).toLocaleString()}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white rounded border border-gray-200 p-3 text-center">
                        <p className="text-gray-500">No services selected for this appointment</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {selectedAppointment.notes && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <FiEdit className="h-5 w-5 mr-2 text-blue-600" />
                      Notes
                    </h4>
                    <div className="bg-white rounded border border-gray-200 p-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {selectedAppointment.notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => handleEditAppointment(selectedAppointment)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-150"
              >
                Edit Appointment
              </button>
              <button
                onClick={closeViewModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-150"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700">Loading appointments...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentCalendar;
