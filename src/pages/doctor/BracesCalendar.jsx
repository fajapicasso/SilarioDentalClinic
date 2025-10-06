// src/components/doctor/BracesCalendar.jsx
import { useState, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiCheckCircle, FiXCircle, FiPlus, FiTrash2, FiUser, FiEdit, FiCalendar, FiSearch } from 'react-icons/fi';
import supabase from '../../config/supabaseClient';
import { toast } from 'react-toastify';
import Modal from "../../components/common/Modal";
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { useAuditLog } from '../../hooks/useAuditLog';

const BracesCalendar = () => {
  const { logBracesCalendarEvent } = useAuditLog();
  // Main state variables
  const [calendar, setCalendar] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    patients: []
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // Patient management state
  const [allPatients, setAllPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  
  // Modal control state
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [showRemovePatientModal, setShowRemovePatientModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  
  // Form inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  
  // Calendar search and filter
  const [calendarSearchTerm, setCalendarSearchTerm] = useState('');
  const [isAddingNewPatient, setIsAddingNewPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({
    full_name: '',
    phone: '',
    email: '',
    gender: 'male'
  });
  
  // Date selection
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointmentDay, setAppointmentDay] = useState(null);
  const [highLightedDays, setHighlightedDays] = useState({});
  
  // Date picker ref to expose its methods
  const datePickerRef = useState(null);

  // Effect to organize appointments by day
  useEffect(() => {
    if (calendar.patients && calendar.patients.length > 0) {
      // Create a mapping of days to highlight
      const days = {};
      
      calendar.patients.forEach(patient => {
        if (patient.appointment_date) {
          const day = new Date(patient.appointment_date).getDate();
          if (!days[day]) {
            days[day] = 1;
          } else {
            days[day]++;
          }
        }
      });
      
      setHighlightedDays(days);
    }
  }, [calendar.patients]);
  
  // Load calendar data when month/year changes
  useEffect(() => {
    fetchBracesData(calendar.month, calendar.year);
  }, [calendar.month, calendar.year]);

  // Load patient data when add modal opens
  useEffect(() => {
    if (showAddPatientModal) {
      fetchAllPatientsForBraces();
    }
  }, [showAddPatientModal]);

  // Filter patients based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredPatients(allPatients);
    } else {
      const filtered = allPatients.filter(patient => 
        patient.full_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredPatients(filtered);
    }
  }, [searchQuery, allPatients]);

  // ----- Data Fetching Functions -----
  
  const fetchBracesData = async (month, year) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('braces_checkups')
        .select(`
          id,
          patient_id,
          month,
          year,
          appointment_date,
          attended,
          attended_date,
          doctor_id,
          notes,
          patients:profiles!patient_id (id, full_name, disabled)
        `)
        .eq('month', month)
        .eq('year', year);
      
      if (error) throw error;
      
      // Filter out archived/disabled patients from the calendar
      const activePatients = (data || []).filter(patient => 
        !patient.patients?.disabled
      );
      
      setCalendar({
        month,
        year,
        patients: activePatients
      });
    } catch (error) {
      console.error('Error fetching braces data:', error);
      toast.error('Failed to fetch braces calendar data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllPatientsForBraces = async () => {
    try {
      // Get all active (non-archived) patients
      const { data: patientsData, error: patientsError } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email')
        .eq('role', 'patient')
        .neq('disabled', true) // Exclude archived/disabled patients
        .order('full_name');
      
      if (patientsError) throw patientsError;
      
      // Get patients already in braces for this month
      const { data: existingBracesPatients, error: bracesError } = await supabase
        .from('braces_checkups')
        .select('patient_id')
        .eq('month', calendar.month)
        .eq('year', calendar.year);
      
      if (bracesError) throw bracesError;
      
      // Filter out patients already in the braces calendar
      const existingPatientIds = new Set(existingBracesPatients.map(p => p.patient_id));
      const availablePatients = patientsData.filter(patient => !existingPatientIds.has(patient.id));
      
      setAllPatients(availablePatients);
      setFilteredPatients(availablePatients);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Failed to fetch patients list');
    }
  };

  // ----- Event Handlers -----

  const handleToggleAttendance = async (patientId, currentStatus) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const { error } = await supabase
        .from('braces_checkups')
        .update({ 
          attended: !currentStatus,
          attended_date: !currentStatus ? new Date().toISOString() : null,
          doctor_id: !currentStatus ? userId : null
        })
        .eq('patient_id', patientId)
        .eq('month', calendar.month)
        .eq('year', calendar.year);
      
      if (error) throw error;
      
      // Update local state
      setCalendar({
        ...calendar,
        patients: calendar.patients.map(patient => 
          patient.patient_id === patientId 
            ? { ...patient, attended: !currentStatus } 
            : patient
        )
      });
      
      toast.success('Attendance status updated');
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast.error('Failed to update attendance');
    }
  };

  const handleAddPatient = async (patientId) => {
    try {
      const selectedPatientData = allPatients.find(p => p.id === patientId);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      
      // Format date as YYYY-MM-DD in local time to avoid timezone issues
      let appointmentDate = null;
      if (appointmentDay) {
        const month = (calendar.month + 1).toString().padStart(2, '0');
        const day = appointmentDay.toString().padStart(2, '0');
        appointmentDate = `${calendar.year}-${month}-${day}`;
      }
      
      if (!appointmentDate) {
        toast.error('Please select an appointment date');
        return;
      }
      
      // Add patient to current month - match your schema
      const { error: currentError } = await supabase
        .from('braces_checkups')
        .insert({
          patient_id: patientId,
          month: calendar.month,
          year: calendar.year,
          appointment_date: appointmentDate,
          attended: false,
          notes: notes || null,
          doctor_id: userId
        });
      
      if (currentError) throw currentError;
      
      // Prepare data for future months (up to 6 months)
      const futureEntries = [];
      let futureMonth = calendar.month;
      let futureYear = calendar.year;
      
      for (let i = 1; i <= 6; i++) {
        futureMonth++;
        if (futureMonth > 11) {
          futureMonth = 0;
          futureYear++;
        }
        
        // Calculate next month's appointment date (same day of month if possible)
        const futureDate = new Date(futureYear, futureMonth, 1);
        const daysInMonth = new Date(futureYear, futureMonth + 1, 0).getDate();
        const futureDay = Math.min(appointmentDay, daysInMonth);
        const futureMonthStr = (futureMonth + 1).toString().padStart(2, '0');
        const futureDayStr = futureDay.toString().padStart(2, '0');
        const futureDateStr = `${futureYear}-${futureMonthStr}-${futureDayStr}`;
        futureEntries.push({
          patient_id: patientId,
          month: futureMonth,
          year: futureYear,
          appointment_date: futureDateStr,
          attended: false,
          notes: notes || null,
          doctor_id: userId
        });
      }
      
      // Insert future entries
      const { error: futureError } = await supabase
        .from('braces_checkups')
        .insert(futureEntries);
      
      if (futureError) throw futureError;
      
      // Refresh the calendar data
      fetchBracesData(calendar.month, calendar.year);
      setShowAddPatientModal(false);
      setNotes('');
      setAppointmentDay(null);
      
      // Log audit event for braces calendar addition
      try {
        await logBracesCalendarEvent({
          patient_id: patientId,
          patient_name: selectedPatientData.full_name,
          appointment_date: appointmentDate,
          month: calendar.month,
          year: calendar.year,
          action: 'add_to_calendar',
          notes: notes,
          doctor_id: userId
        });
      } catch (auditError) {
        console.error('Error logging braces calendar event audit:', auditError);
        // Continue even if audit logging fails
      }
      
      toast.success(`${selectedPatientData.full_name} added to braces calendar`);
    } catch (error) {
      console.error('Error adding patient:', error);
      toast.error('Failed to add patient to braces calendar');
    }
  };

  const handleCreateNewPatient = async () => {
    if (!newPatient.full_name || !newPatient.phone) {
      toast.error('Name and phone number are required');
      return;
    }

    try {
      // First, create auth user if email is provided
      let userId = null;
      
      if (newPatient.email) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: newPatient.email,
          password: `${Math.random().toString(36).slice(2)}${Math.random().toString(36).toUpperCase().slice(2)}8!`, // Generate a random secure password
          options: {
            data: {
              full_name: newPatient.full_name,
            }
          }
        });
        
        if (authError) throw authError;
        userId = authData.user.id;
      }

      // Create profile record
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          ...(userId ? { id: userId } : {}),
          full_name: newPatient.full_name,
          phone: newPatient.phone,
          email: newPatient.email || null,
          gender: newPatient.gender || 'male',
          role: 'patient'
        })
        .select()
        .single();
      
      if (profileError) throw profileError;

      toast.success('New patient created successfully');
      
      // Add to allPatients list and select
      const newPatientData = { ...profileData };
      setAllPatients(prev => [...prev, newPatientData]);
      setFilteredPatients(prev => [...prev, newPatientData]);
      
      // Reset form and switch back to patient selection
      setNewPatient({
        full_name: '',
        phone: '',
        email: '',
        gender: 'male'
      });
      setIsAddingNewPatient(false);
      
      // Automatically select the newly created patient
      setTimeout(() => {
        handleAddPatient(newPatientData.id);
      }, 100);
      
    } catch (error) {
      console.error('Error creating patient:', error);
      toast.error('Failed to create new patient');
    }
  };

  const handleRemovePatient = async (patientId) => {
    try {
      // Get all future records for this patient
      const futureRecords = [];
      let future = {
        month: calendar.month,
        year: calendar.year
      };
      
      // Find records for current month and beyond
      for (let i = 0; i < 7; i++) {
        const { data, error } = await supabase
          .from('braces_checkups')
          .select('id')
          .eq('patient_id', patientId)
          .eq('month', future.month)
          .eq('year', future.year);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          futureRecords.push(...data.map(record => record.id));
        }
        
        // Move to next month
        future.month++;
        if (future.month > 11) {
          future.month = 0;
          future.year++;
        }
      }
      
      // Delete these records
      if (futureRecords.length > 0) {
        const { error } = await supabase
          .from('braces_checkups')
          .delete()
          .in('id', futureRecords);
        
        if (error) throw error;
      }
      
      // Refresh the calendar data
      fetchBracesData(calendar.month, calendar.year);
      setShowRemovePatientModal(false);
      
      toast.success('Patient removed from braces calendar');
    } catch (error) {
      console.error('Error removing patient:', error);
      toast.error('Failed to remove patient from braces calendar');
    }
  };

  const handleUpdateNotes = async (patientId) => {
    try {
      const { error } = await supabase
        .from('braces_checkups')
        .update({ notes: notes })
        .eq('patient_id', patientId)
        .eq('month', calendar.month)
        .eq('year', calendar.year);
      
      if (error) throw error;
      
      // Update local state
      setCalendar({
        ...calendar,
        patients: calendar.patients.map(patient => 
          patient.patient_id === patientId 
            ? { ...patient, notes: notes } 
            : patient
        )
      });
      
      setShowNotesModal(false);
      toast.success('Notes updated');
    } catch (error) {
      console.error('Error updating notes:', error);
      toast.error('Failed to update notes');
    }
  };

  const navigateMonth = (direction) => {
    let newMonth = calendar.month + direction;
    let newYear = calendar.year;
    
    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    } else if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }
    
    setCalendar({
      ...calendar,
      month: newMonth,
      year: newYear
    });
  };

  // New handler for date picker
  const handleDateChange = (date) => {
    setSelectedDate(date);
    setCalendar({
      ...calendar,
      month: date.getMonth(),
      year: date.getFullYear()
    });
  };

  // ----- Helper Functions -----

  const getMonthName = (monthIndex) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex];
  };

  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  // Filter patients based on calendar search term
  const getFilteredCalendarPatients = () => {
    if (!calendarSearchTerm.trim()) {
      return calendar.patients;
    }
    
    return calendar.patients.filter(patient => {
      const patientName = patient.patients?.full_name.toLowerCase() || '';
      const patientNotes = patient.notes?.toLowerCase() || '';
      
      return patientName.includes(calendarSearchTerm.toLowerCase()) || 
             patientNotes.includes(calendarSearchTerm.toLowerCase());
    });
  };

  // ----- Render Functions -----

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(calendar.month, calendar.year);
    const firstDay = getFirstDayOfMonth(calendar.month, calendar.year);
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 border border-gray-200 bg-gray-50"></div>);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      // Check if this day has appointments
      const hasAppointments = highLightedDays[day] > 0;
      // Check if this is the day being selected in the add patient modal
      const isSelected = day === appointmentDay && 
                         calendar.month === selectedDate.getMonth() && 
                         calendar.year === selectedDate.getFullYear();
      
      days.push(
        <div 
          key={`day-${day}`} 
          className={`h-24 border border-gray-200 p-2 overflow-y-auto ${
            hasAppointments ? 'bg-blue-50' : ''
          } ${
            isSelected ? 'border-primary-500 border-2' : ''
          }`}
          onClick={() => {
            if (showAddPatientModal) {
              setAppointmentDay(day);
              
              // Update the selected date if needed
              if (selectedDate.getMonth() !== calendar.month || 
                  selectedDate.getFullYear() !== calendar.year) {
                const newDate = new Date(calendar.year, calendar.month, day);
                setSelectedDate(newDate);
              }
            }
          }}
        >
          <div className="font-medium mb-1 flex justify-between items-center">
            <span>{day}</span>
            {hasAppointments && (
              <span className="text-xs bg-primary-100 text-primary-800 rounded-full px-1.5 py-0.5">
                {highLightedDays[day]}
              </span>
            )}
          </div>
          {renderPatientsForDay(day)}
        </div>
      );
    }
    
    return days;
  };

  const renderPatientsForDay = (day) => {
    // Get filtered patients
    const filteredPatients = getFilteredCalendarPatients();
    
    // Get patients with appointments on this specific day
    const patientsForDay = filteredPatients.filter(patient => {
      if (patient.appointment_date) {
        const appointmentDay = new Date(patient.appointment_date).getDate();
        return appointmentDay === day;
      }
      return false;
    });
    
    if (patientsForDay.length === 0) {
      return null;
    }
    
    return (
      <div className="space-y-1">
        {patientsForDay.map(patient => (
          <div 
            key={patient.id} 
            className={`p-1 rounded ${
              patient.attended 
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            <div className="flex justify-between items-center text-xs">
              <span className="truncate">{patient.patients?.full_name}</span>
              <button
                onClick={() => handleToggleAttendance(patient.patient_id, patient.attended)}
                className="ml-1 flex-shrink-0"
              >
                {patient.attended ? <FiCheckCircle size={14} /> : <FiXCircle size={14} />}
              </button>
            </div>
            {/* Display notes directly under patient name */}
            {patient.notes && (
              <div className="text-xs italic mt-1 truncate">"{patient.notes}"</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // ----- Component Render -----

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header section with search bar, month navigation and add button */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-3">
          {/* Date selection and navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              <FiChevronLeft className="h-5 w-5" />
            </button>
            
            <div className="relative">
              <DatePicker
                selected={selectedDate}
                onChange={handleDateChange}
                dateFormat="MMMM yyyy"
                showMonthYearPicker
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                ref={datePickerRef}
              />
              <FiCalendar className="absolute left-3 top-3 text-gray-400" />
            </div>
            
            <button
              onClick={() => navigateMonth(1)}
              className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              <FiChevronRight className="h-5 w-5" />
            </button>
            
            <h2 className="text-lg font-semibold text-gray-800 ml-2">
              {getMonthName(calendar.month)} {calendar.year}
            </h2>
          </div>
          
          {/* Search and add button */}
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Search patients..."
                value={calendarSearchTerm}
                onChange={(e) => setCalendarSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 w-full"
              />
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
            
            <button
              onClick={() => setShowAddPatientModal(true)}
              className="inline-flex items-center px-3 py-2 text-sm rounded-md text-white bg-primary-600 hover:bg-primary-700"
            >
              <FiPlus className="mr-1" />
              Add Patient
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        {/* Summary stats */}
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-green-100 text-green-800">
              <FiCheckCircle className="h-5 w-5" />
            </div>
            <div className="ml-2">
              <span className="text-sm font-medium text-gray-500">Attended</span>
              <p className="text-lg font-semibold text-gray-900">
                {getFilteredCalendarPatients().filter(p => p.attended).length}
              </p>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-red-100 text-red-800">
              <FiXCircle className="h-5 w-5" />
            </div>
            <div className="ml-2">
              <span className="text-sm font-medium text-gray-500">Missed</span>
              <p className="text-lg font-semibold text-gray-900">
                {getFilteredCalendarPatients().filter(p => !p.attended).length}
              </p>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-blue-100 text-blue-800">
              <FiUser className="h-5 w-5" />
            </div>
            <div className="ml-2">
              <span className="text-sm font-medium text-gray-500">Total Patients</span>
              <p className="text-lg font-semibold text-gray-900">
                {getFilteredCalendarPatients().length}
              </p>
            </div>
          </div>
        </div>
        
        {/* Loading state or content */}
        {isLoading ? (
          <div className="text-center py-8">
            <svg className="animate-spin h-8 w-8 mx-auto text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-2 text-gray-500">Loading calendar data...</p>
          </div>
        ) : (
          <>
            {/* Mobile view (patient list only) */}
            <div className="md:hidden mb-4">
              <h3 className="text-md font-medium text-gray-700 mb-2">All Braces Patients</h3>
              {getFilteredCalendarPatients().length > 0 ? (
                <div className="space-y-2">
                  {getFilteredCalendarPatients().map(patient => (
                    <div 
                      key={patient.id}
                      className={`p-3 rounded-lg border ${
                        patient.attended 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900">{patient.patients?.full_name}</h3>
                          {/* Notes displayed directly under patient name */}
                          {patient.notes && (
                            <p className="text-sm text-gray-600 mt-1 italic">"{patient.notes}"</p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setSelectedPatient(patient);
                              setNotes(patient.notes || '');
                              setShowNotesModal(true);
                            }}
                            className="p-1 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200"
                          >
                            <FiEdit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleToggleAttendance(patient.patient_id, patient.attended)}
                            className={`p-1 rounded-full ${
                              patient.attended 
                                ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                                : 'bg-red-100 text-red-600 hover:bg-red-200'
                            }`}
                          >
                            {patient.attended ? (
                              <FiCheckCircle className="h-5 w-5" />
                            ) : (
                              <FiXCircle className="h-5 w-5" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPatient(patient);
                              setShowRemovePatientModal(true);
                            }}
                            className="p-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                          >
                            <FiTrash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">
                    {calendarSearchTerm ? 'No matching patients found' : 'No braces patients for this month'}
                  </p>
                </div>
              )}
            </div>
            
            {/* Desktop/tablet view (calendar) */}
            <div className="hidden md:block">
              {/* Calendar header */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center font-medium text-gray-700 py-2 bg-gray-100">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {renderCalendarDays()}
              </div>
              
              {/* Patient list below calendar */}
              <div className="mt-4 border-t border-gray-200 pt-4">
                <h3 className="text-md font-medium text-gray-700 mb-2">All Braces Patients</h3>
                {getFilteredCalendarPatients().length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {getFilteredCalendarPatients().map(patient => (
                      <div 
                        key={patient.id}
                        className={`p-3 rounded-lg border ${
                          patient.attended 
                            ? 'border-green-200 bg-green-50' 
                            : 'border-red-200 bg-red-50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-gray-900">{patient.patients?.full_name}</h3>
                            {/* Notes displayed directly under patient name */}
                            {patient.notes && (
                              <p className="text-sm text-gray-600 mt-1 italic">"{patient.notes}"</p>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedPatient(patient);
                                setNotes(patient.notes || '');
                                setShowNotesModal(true);
                              }}
                              className="p-1 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200"
                            >
                              <FiEdit className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleToggleAttendance(patient.patient_id, patient.attended)}
                              className={`p-1 rounded-full ${
                                patient.attended 
                                  ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                                  : 'bg-red-100 text-red-600 hover:bg-red-200'
                              }`}
                            >
                              {patient.attended ? (
                                <FiCheckCircle className="h-5 w-5" />
                              ) : (
                                <FiXCircle className="h-5 w-5" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPatient(patient);
                                setShowRemovePatientModal(true);
                              }}
                              className="p-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                            >
                              <FiTrash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">
                      {calendarSearchTerm ? 'No matching patients found' : 'No braces patients for this month'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Add Patient Modal */}
      {showAddPatientModal && (
        <Modal
          title="Add Patient to Braces Calendar"
          onClose={() => {
            setShowAddPatientModal(false);
            setIsAddingNewPatient(false);
            setNewPatient({
              full_name: '',
              phone: '',
              email: '',
              gender: 'male'
            });
          }}
        >
          <div className="p-4">
            {!isAddingNewPatient ? (
              <>
                <div className="mb-4">
                  <label htmlFor="patient-search" className="block text-sm font-medium text-gray-700 mb-1">
                    Search Patients
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <FiSearch className="text-gray-400" />
                    </span>
                    <input
                      type="text"
                      id="patient-search"
                      placeholder="Type patient name..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Appointment Date
                  </label>
                  <div className="flex space-x-2 items-center mb-2">
                    <div className="flex-grow">
                      <DatePicker
                        selected={appointmentDay ? new Date(calendar.year, calendar.month, appointmentDay) : null}
                        onChange={(date) => {
                          if (date) {
                            setAppointmentDay(date.getDate());
                            if (date.getMonth() !== calendar.month || date.getFullYear() !== calendar.year) {
                              setCalendar({
                                ...calendar,
                                month: date.getMonth(),
                                year: date.getFullYear()
                              });
                            }
                          } else {
                            setAppointmentDay(null);
                          }
                        }}
                        placeholderText="Choose a date"
                        dateFormat="MMMM d, yyyy"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    {appointmentDay && (
                      <button
                        onClick={() => setAppointmentDay(null)}
                        className="p-2 text-gray-500 hover:text-gray-700"
                        title="Clear date"
                      >
                        <FiXCircle />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 italic">
                    You can also click directly on a day in the calendar to select it
                  </p>
                </div>
                <div className="max-h-60 overflow-y-auto mb-4">
                  {filteredPatients.length > 0 ? (
                    <div className="space-y-2">
                      {filteredPatients.map(patient => (
                        <div 
                          key={patient.id}
                          className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                          onClick={() => handleAddPatient(patient.id)}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-medium">{patient.full_name}</span>
                              {patient.phone && (
                                <p className="text-xs text-gray-500">{patient.phone}</p>
                              )}
                            </div>
                            <FiPlus className="text-primary-600" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500">
                        {searchQuery ? 'No matching patients found' : 'No patients available to add'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex justify-between">
                 
                  <button
                    onClick={() => setShowAddPatientModal(false)}
                    className="px-8 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="full-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name*
                    </label>
                    <input
                      type="text"
                      id="full-name"
                      placeholder="Enter patient's full name"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                      value={newPatient.full_name}
                      onChange={(e) => setNewPatient({...newPatient, full_name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number*
                    </label>
                    <input
                      type="text"
                      id="phone"
                      placeholder="Enter patient's phone number"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                      value={newPatient.phone}
                      onChange={(e) => setNewPatient({...newPatient, phone: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      id="email"
                      placeholder="Enter patient's email address"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                      value={newPatient.email}
                      onChange={(e) => setNewPatient({...newPatient, email: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                      Gender
                    </label>
                    <select
                      id="gender"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                      value={newPatient.gender}
                      onChange={(e) => setNewPatient({...newPatient, gender: e.target.value})}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="new-patient-notes" className="block text-sm font-medium text-gray-700 mb-1">
                      Braces Notes (Optional)
                    </label>
                    <textarea
                      id="new-patient-notes"
                      placeholder="Add any notes about the patient's braces treatment..."
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                
                <div className="mt-4 flex justify-between">
                  <button
                    onClick={() => setIsAddingNewPatient(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  
                  <button
                    onClick={handleCreateNewPatient}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700"
                  >
                    Create & Add Patient
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
      
      {/* Notes Modal */}
      {showNotesModal && selectedPatient && (
        <Modal
          title="Update Patient Notes"
          onClose={() => setShowNotesModal(false)}
        >
          <div className="p-4">
            <p className="mb-2">
              Update notes for <strong>{selectedPatient.patients?.full_name}</strong>
            </p>
            
            <div className="mb-4">
              <label htmlFor="edit-notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                id="edit-notes"
                placeholder="Add any notes about the patient's braces treatment..."
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowNotesModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateNotes(selectedPatient.patient_id)}
                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700"
              >
                Save Notes
              </button>
            </div>
          </div>
        </Modal>
      )}
      
      {/* Remove Patient Confirmation Modal */}
      {showRemovePatientModal && selectedPatient && (
        <Modal
          title="Remove Patient from Braces Calendar"
          onClose={() => setShowRemovePatientModal(false)}
        >
          <div className="p-4">
            <p className="mb-4">
              Are you sure you want to remove <strong>{selectedPatient.patients?.full_name}</strong> from 
              the braces calendar? This will remove them from this month and all future months.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRemovePatientModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemovePatient(selectedPatient.patient_id)}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BracesCalendar;