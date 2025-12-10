// src/components/doctor/BracesCalendar.jsx
import { useState, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiCheckCircle, FiXCircle, FiPlus, FiTrash2, FiUser, FiEdit, FiCalendar, FiSearch, FiX, FiEye, FiFileText, FiPrinter } from 'react-icons/fi';
import supabase from '../../config/supabaseClient';
import { toast } from 'react-toastify';
import Modal from "../../components/common/Modal";
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { useAuditLog } from '../../hooks/useAuditLog';
import { useAuth } from '../../contexts/AuthContext';
import { getLogoBase64DataURL } from '../../utils/logoBase64';

const BracesCalendar = () => {
  const { user } = useAuth();
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
  const [showDayModal, setShowDayModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReportGeneratorModal, setShowReportGeneratorModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  
  // Report state
  const [reportData, setReportData] = useState(null);
  
  // Report generator filters
  const [reportFilters, setReportFilters] = useState({
    period: 'monthly', // daily, weekly, monthly, yearly
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    status: 'all', // all, attended, missed
    patientId: null,
    includeNotes: true
  });
  
  // Form inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTreatment, setSelectedTreatment] = useState('');
  
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

  // Braces treatment options
  const bracesTreatments = [
    'Adjust bracket',
    'Replace rubber band',
    'Tighten wire',
    'Replace wire',
    'Replace bracket',
    'Add elastic',
    'Remove elastic',
    'Clean brackets',
    'Check progress',
    'Emergency repair',
    'Install new bracket',
    'Remove bracket',
    'Adjust archwire',
    'Replace ligature',
    'Check bite',
    'Other'
  ];

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
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

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
        .eq('year', year)
        .eq('doctor_id', user.id);
      
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
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const currentDoctorId = user.id;
      
      // Get all active (non-archived) patients
      const { data: patientsData, error: patientsError } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email')
        .eq('role', 'patient')
        .neq('disabled', true) // Exclude archived/disabled patients
        .order('full_name');
      
      if (patientsError) throw patientsError;
      
      // CRITICAL: Get patients already in braces for this month/year
      // BUT ONLY for the CURRENT doctor (NOT other doctors)
      // This is the KEY: We only check for the current doctor's patients
      // This means if Doctor B has added a patient, Doctor A will still see them in the list
      const { data: existingBracesPatients, error: bracesError } = await supabase
        .from('braces_checkups')
        .select('patient_id, doctor_id')
        .eq('month', calendar.month)
        .eq('year', calendar.year)
        .eq('doctor_id', currentDoctorId); // CRITICAL: Only current doctor's patients
      
      if (bracesError) {
        console.error('Error fetching existing braces patients:', bracesError);
        throw bracesError;
      }
      
      // Extract patient IDs that THIS doctor has already added
      // CRITICAL: We ONLY filter out patients that THIS doctor has added
      // Patients added by OTHER doctors should still be available
      const existingPatientIds = new Set(
        (existingBracesPatients || [])
          .filter(p => {
            // Double-check: only include if it's the current doctor's patient
            const isCurrentDoctor = p.doctor_id === currentDoctorId;
            if (!isCurrentDoctor) {
              console.warn('[BracesCalendar] Found patient from different doctor - ignoring:', p);
            }
            return isCurrentDoctor;
          })
          .map(p => p.patient_id)
      );
      
      // Filter out ONLY patients that THIS doctor has already added
      // Patients added by OTHER doctors will remain in the list
      // This allows multiple doctors to add the same patient
      const availablePatients = patientsData.filter(
        patient => {
          const isExcluded = existingPatientIds.has(patient.id);
          if (isExcluded) {
            console.log('[BracesCalendar] Excluding patient (already added by this doctor):', patient.full_name);
          }
          return !isExcluded;
        }
      );
      
      // Debug logging to verify the logic
      console.log('[BracesCalendar] ===== PATIENT FILTERING =====');
      console.log('[BracesCalendar] Current Doctor ID:', currentDoctorId);
      console.log('[BracesCalendar] Total patients in system:', patientsData.length);
      console.log('[BracesCalendar] Patients THIS doctor has already added:', existingPatientIds.size);
      console.log('[BracesCalendar] Available patients (including those added by other doctors):', availablePatients.length);
      
      // Log some example patient names to verify they're showing
      if (availablePatients.length > 0) {
        console.log('[BracesCalendar] Sample available patients:', availablePatients.slice(0, 5).map(p => p.full_name));
      }
      console.log('[BracesCalendar] ============================');
      
      setAllPatients(availablePatients);
      setFilteredPatients(availablePatients);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Failed to fetch patients list');
    }
  };

  // ----- Report Functions -----
  
  const generateFilteredReport = async () => {
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      setIsLoading(true);
      
      let startDate, endDate;
      const today = new Date();
      
      // Calculate date range based on period
      switch (reportFilters.period) {
        case 'daily':
          startDate = new Date(reportFilters.startDate);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(reportFilters.startDate);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'weekly':
          startDate = new Date(reportFilters.startDate);
          startDate.setHours(0, 0, 0, 0);
          // If endDate is provided, use it; otherwise calculate week end
          if (reportFilters.endDate) {
            endDate = new Date(reportFilters.endDate);
            endDate.setHours(23, 59, 59, 999);
          } else {
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
          }
          break;
        case 'monthly':
          startDate = new Date(reportFilters.startDate);
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          // If endDate is provided, use it; otherwise calculate month end
          if (reportFilters.endDate) {
            endDate = new Date(reportFilters.endDate);
            endDate.setHours(23, 59, 59, 999);
          } else {
            endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
            endDate.setHours(23, 59, 59, 999);
          }
          break;
        case 'yearly':
          startDate = new Date(reportFilters.startDate.getFullYear(), 0, 1);
          startDate.setHours(0, 0, 0, 0);
          // If endDate is provided, use it; otherwise use year end
          if (reportFilters.endDate) {
            endDate = new Date(reportFilters.endDate);
            endDate.setHours(23, 59, 59, 999);
          } else {
            endDate = new Date(reportFilters.startDate.getFullYear(), 11, 31);
            endDate.setHours(23, 59, 59, 999);
          }
          break;
        default:
          startDate = new Date(reportFilters.startDate);
          startDate.setHours(0, 0, 0, 0);
          endDate = reportFilters.endDate ? new Date(reportFilters.endDate) : new Date(reportFilters.startDate);
          endDate.setHours(23, 59, 59, 999);
      }

      // Format dates for query (YYYY-MM-DD format) - use local date to avoid timezone issues
      const formatDateForQuery = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const startDateStr = formatDateForQuery(startDate);
      const endDateStr = formatDateForQuery(endDate);
      
      console.log('Report Filters:', {
        period: reportFilters.period,
        startDate: startDateStr,
        endDate: endDateStr,
        status: reportFilters.status,
        patientId: reportFilters.patientId,
        includeNotes: reportFilters.includeNotes
      });

      // Build query
      let query = supabase
        .from('braces_checkups')
        .select(`
          id,
          patient_id,
          month,
          year,
          appointment_date,
          attended,
          attended_date,
          notes,
          doctor_id,
          patients:profiles!patient_id (id, full_name, phone, email)
        `)
        .eq('doctor_id', user.id)
        .gte('appointment_date', startDateStr)
        .lte('appointment_date', endDateStr);

      // Apply status filter
      if (reportFilters.status === 'attended') {
        query = query.eq('attended', true);
      } else if (reportFilters.status === 'missed') {
        query = query.eq('attended', false);
      }

      // Apply patient filter
      let selectedPatientName = null;
      if (reportFilters.patientId) {
        query = query.eq('patient_id', reportFilters.patientId);
        // Get patient name for display
        const patient = getFilteredCalendarPatients().find(p => p.patient_id === reportFilters.patientId);
        selectedPatientName = patient?.patients?.full_name || null;
      }

      const { data: bracesData, error } = await query.order('appointment_date', { ascending: true });

      if (error) {
        console.error('Error fetching braces data:', error);
        throw error;
      }

      console.log('Raw braces data fetched:', bracesData?.length || 0, 'records');

      // Filter by notes if needed
      let filteredData = bracesData || [];
      if (reportFilters.includeNotes) {
        const beforeFilter = filteredData.length;
        filteredData = filteredData.filter(record => record.notes && record.notes.trim() !== '');
        console.log('After notes filter:', filteredData.length, 'records (was', beforeFilter, ')');
      }
      
      console.log('Final filtered data:', filteredData.length, 'records');
      
      // If patient filter is set but no data found, try to get patient name from profiles
      if (reportFilters.patientId && !selectedPatientName && filteredData.length > 0) {
        selectedPatientName = filteredData[0]?.patients?.full_name || null;
      }
      
      // If still no name, fetch from profiles table
      if (reportFilters.patientId && !selectedPatientName) {
        try {
          const { data: patientData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', reportFilters.patientId)
            .single();
          if (patientData) {
            selectedPatientName = patientData.full_name;
          }
        } catch (err) {
          console.error('Error fetching patient name:', err);
        }
      }

      // Calculate statistics
      const totalAppointments = filteredData.length;
      const attendedCount = filteredData.filter(record => record.attended).length;
      const missedCount = totalAppointments - attendedCount;
      const attendanceRate = totalAppointments > 0 ? ((attendedCount / totalAppointments) * 100).toFixed(1) : 0;

      // Group data based on period
      let groupedData = {};
      filteredData.forEach(record => {
        let groupKey;
        const recordDate = new Date(record.appointment_date);
        
        switch (reportFilters.period) {
          case 'daily':
            groupKey = recordDate.toLocaleDateString();
            break;
          case 'weekly':
            const weekStart = new Date(recordDate);
            weekStart.setDate(recordDate.getDate() - recordDate.getDay());
            groupKey = `Week of ${weekStart.toLocaleDateString()}`;
            break;
          case 'monthly':
            groupKey = `${record.year}-${String(record.month + 1).padStart(2, '0')}`;
            break;
          case 'yearly':
            groupKey = record.year.toString();
            break;
          default:
            groupKey = recordDate.toLocaleDateString();
        }

        if (!groupedData[groupKey]) {
          groupedData[groupKey] = {
            attended: 0,
            missed: 0,
            total: 0,
            appointments: []
          };
        }
        groupedData[groupKey].total++;
        if (record.attended) {
          groupedData[groupKey].attended++;
        } else {
          groupedData[groupKey].missed++;
        }
        groupedData[groupKey].appointments.push(record);
      });

      // Treatment summary
      const treatmentSummary = {};
      filteredData.forEach(record => {
        const treatment = record.notes || 'No specific treatment';
        if (!treatmentSummary[treatment]) {
          treatmentSummary[treatment] = { count: 0, attended: 0 };
        }
        treatmentSummary[treatment].count++;
        if (record.attended) {
          treatmentSummary[treatment].attended++;
        }
      });

      setReportData({
        period: reportFilters.period,
        startDate: startDateStr,
        endDate: endDateStr,
        summary: {
          total: totalAppointments,
          attended: attendedCount,
          missed: missedCount,
          attendanceRate: attendanceRate
        },
        groupedData,
        treatmentSummary,
        allAppointments: filteredData,
        filters: {
          ...reportFilters,
          patientName: selectedPatientName
        }
      });

      setShowReportGeneratorModal(false);
      setShowReportModal(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error generating filtered report:', error);
      toast.error('Failed to generate report');
      setIsLoading(false);
    }
  };
  
  const generatePatientReport = async (patientId) => {
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Get patient info
      const { data: patientData, error: patientError } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email')
        .eq('id', patientId)
        .single();

      if (patientError) throw patientError;

      // Get all braces records for this patient
      const { data: bracesData, error } = await supabase
        .from('braces_checkups')
        .select(`
          id,
          month,
          year,
          appointment_date,
          attended,
          attended_date,
          notes,
          doctor_id
        `)
        .eq('patient_id', patientId)
        .eq('doctor_id', user.id)
        .order('appointment_date', { ascending: true });

      if (error) throw error;

      // Filter appointments to only include those with treatment notes
      const appointmentsWithNotes = bracesData.filter(record => record.notes && record.notes.trim() !== '');

      // Calculate statistics based only on appointments with notes
      const totalAppointments = appointmentsWithNotes.length;
      const attendedCount = appointmentsWithNotes.filter(record => record.attended).length;
      const missedCount = totalAppointments - attendedCount;
      const attendanceRate = totalAppointments > 0 ? ((attendedCount / totalAppointments) * 100).toFixed(1) : 0;

      // Group by month (only appointments with notes)
      const monthlyBreakdown = {};
      appointmentsWithNotes.forEach(record => {
        const monthKey = `${record.year}-${String(record.month + 1).padStart(2, '0')}`;
        if (!monthlyBreakdown[monthKey]) {
          monthlyBreakdown[monthKey] = {
            month: record.month,
            year: record.year,
            attended: 0,
            missed: 0,
            total: 0,
            treatments: []
          };
        }
        monthlyBreakdown[monthKey].total++;
        if (record.attended) {
          monthlyBreakdown[monthKey].attended++;
        } else {
          monthlyBreakdown[monthKey].missed++;
        }
        if (record.notes) {
          monthlyBreakdown[monthKey].treatments.push(record.notes);
        }
      });

      // Treatment summary (only appointments with notes)
      const treatmentSummary = {};
      appointmentsWithNotes.forEach(record => {
        const treatment = record.notes || 'No specific treatment';
        if (!treatmentSummary[treatment]) {
          treatmentSummary[treatment] = { count: 0, attended: 0 };
        }
        treatmentSummary[treatment].count++;
        if (record.attended) {
          treatmentSummary[treatment].attended++;
        }
      });

      setReportData({
        patient: patientData,
        summary: {
          total: totalAppointments,
          attended: attendedCount,
          missed: missedCount,
          attendanceRate: attendanceRate
        },
        monthlyBreakdown,
        treatmentSummary,
        allAppointments: appointmentsWithNotes
      });

      setShowReportModal(true);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    }
  };

  const printReport = async () => {
    if (!reportData) return;

    try {
      // Get logo as base64 for production compatibility
      const logoBase64 = await getLogoBase64DataURL();

      const printWindow = window.open('', '_blank');
      const isFilteredReport = reportData.period && !reportData.patient;
      const title = isFilteredReport 
        ? `Braces Treatment Report - ${reportData.period.charAt(0).toUpperCase() + reportData.period.slice(1)} Report`
        : `Braces Treatment Report - ${reportData.patient.full_name}`;
      
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
            .header-left { display: flex; align-items: flex-start; }
            .logo { width: 150px; height: auto; margin-right: 20px; object-fit: contain; }
          .clinic-info h1 { font-size: 24px; font-weight: bold; color: #2563eb; margin: 0 0 5px 0; }
          .clinic-info h2 { font-size: 14px; color: #6b7280; margin: 0 0 3px 0; font-weight: normal; }
          .clinic-info h3 { font-size: 12px; color: #6b7280; margin: 0 0 8px 0; font-weight: normal; }
          .clinic-info p { font-size: 12px; color: #6b7280; margin: 2px 0; }
          .header-right { text-align: right; }
          .header-right .label { font-size: 12px; color: #9ca3af; margin: 0; }
          .header-right .value { font-size: 16px; font-weight: bold; color: #2563eb; margin: 0 0 15px 0; }
          .section { margin-bottom: 25px; }
          .section h2 { color: #0070f3; font-weight: bold; margin-bottom: 6px; }
          .patient-info-table { width: 100%; border-collapse: collapse; margin: 0; }
          .patient-info-table td { padding: 0; text-align: left; border: none; }
          .section h3 { color: #374151; margin-top: 20px; }
          .summary-box { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 0; }
          .summary-content { margin: 0; }
          .appointment-content { margin: 0; }
          .conclusion-content { margin: 0; }
          .appointment-table { width: 100%; border-collapse: collapse; margin: 0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
          .appointment-table th { background: #f8fafc; color: #374151; font-weight: bold; padding: 15px 12px; text-align: left; font-size: 14px; border-bottom: 2px solid #e5e7eb; }
          .appointment-table td { padding: 15px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
          .appointment-table tbody tr:last-child td { border-bottom: none; }
          .attended-row { background: #f0fdf4; border-left: 4px solid #10b981; }
          .attended-row td:first-child { padding-left: 8px; }
          .missed-row { background: #fef2f2; border-left: 4px solid #ef4444; }
          .missed-row td:first-child { padding-left: 8px; }
          .status-attended { color: #059669; font-weight: bold; }
          .status-missed { color: #dc2626; font-weight: bold; }
          .appointment-item { margin: 0 0 10px 0; padding: 10px; border-left: 4px solid #2563eb; background: #f9fafb; }
          .attended { border-left-color: #10b981; }
          .missed { border-left-color: #ef4444; }
          .treatment-list { margin: 10px 0; }
          .treatment-list li { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
          th { background: #f3f4f6; font-weight: bold; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <img src="${logoBase64}" alt="Silario Logo" class="logo">
            <div class="clinic-info">
              <h1>BRACES TREATMENT REPORT</h1>
              <h2>SILARIO DENTAL CLINIC</h2>
              <p>Cabugao/San Juan, Ilocos Sur</p>
              <p>silariodentalclinic@gmail.com</p>
            </div>
          </div>
          <div class="header-right">
            <p class="label">Date:</p>
            <p class="value">${new Date().toLocaleDateString()}</p>
            ${isFilteredReport ? `
              <p class="label">Period:</p>
              <p class="value">${reportData.period.charAt(0).toUpperCase() + reportData.period.slice(1)}</p>
              <p class="label">Date Range:</p>
              <p class="value">${new Date(reportData.startDate).toLocaleDateString()} - ${new Date(reportData.endDate).toLocaleDateString()}</p>
            ` : `
              <p class="label">Patient:</p>
              <p class="value">${reportData.patient.full_name}</p>
            `}
          </div>
        </div>

        ${!isFilteredReport ? `
        <div class="section">
          <h2>Patient Information</h2>
          <table class="patient-info-table">
            <tr>
              <td><strong>Name:</strong> ${reportData.patient.full_name}</td>
              <td><strong>Phone:</strong> ${reportData.patient.phone || 'Not provided'}</td>
              <td><strong>Email:</strong> ${reportData.patient.email || 'Not provided'}</td>
            </tr>
          </table>
        </div>
        ` : ''}

        <div class="section">
          <h2>Treatment Summary</h2>
          <div class="summary-content">
            <p><strong>Total Appointments:</strong> ${reportData.summary.total}</p>
            <p><strong>Attended:</strong> ${reportData.summary.attended}</p>
            <p><strong>Missed:</strong> ${reportData.summary.missed}</p>
            <p><strong>Attendance Rate:</strong> ${reportData.summary.attendanceRate}%</p>
          </div>
        </div>

        ${isFilteredReport && reportData.groupedData ? `
        <div class="section">
          <h2>Period Breakdown</h2>
          <table class="appointment-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Total</th>
                <th>Attended</th>
                <th>Missed</th>
                <th>Attendance Rate</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(reportData.groupedData).map(([period, data]) => `
                <tr>
                  <td>${period}</td>
                  <td>${data.total}</td>
                  <td>${data.attended}</td>
                  <td>${data.missed}</td>
                  <td>${data.total > 0 ? ((data.attended / data.total) * 100).toFixed(1) : 0}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="section">
          <h2>Braces Checkup History</h2>
          <table class="appointment-table">
            <thead>
              <tr>
                <th>Date</th>
                ${isFilteredReport ? '<th>Patient</th>' : ''}
                <th>Status</th>
                <th>Treatment</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.allAppointments.map(appointment => `
                <tr class="${appointment.attended ? 'attended-row' : 'missed-row'}">
                  <td>${new Date(appointment.appointment_date).toLocaleDateString()}</td>
                  ${isFilteredReport ? `<td>${appointment.patients?.full_name || 'Unknown'}</td>` : ''}
                  <td><span class="${appointment.attended ? 'status-attended' : 'status-missed'}">${appointment.attended ? 'Attended' : 'Missed'}</span></td>
                  <td>${appointment.notes || 'No specific treatment'}</td>
                  <td>${appointment.attended_date ? new Date(appointment.attended_date).toLocaleDateString() : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Treatment Conclusion</h2>
          <div class="conclusion-content">
            <p><strong>Overall Assessment:</strong></p>
            <p>${reportData.summary.attendanceRate >= 80 ? 
              'Patient shows excellent compliance with braces treatment schedule. Treatment progress is on track.' :
              reportData.summary.attendanceRate >= 60 ?
              'Patient shows good compliance with braces treatment schedule. Minor improvements in attendance recommended.' :
              'Patient shows poor compliance with braces treatment schedule. Consider follow-up and additional patient education.'}</p>
          </div>
        </div>

        <div class="no-print" style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Print Report
          </button>
        </div>
      </body>
      </html>
    `;

      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      
      // Auto-print after content loads
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report. Please try again.');
    }
  };

  // ----- Event Handlers -----

  const handleToggleAttendance = async (patientId, currentStatus) => {
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('braces_checkups')
        .update({ 
          attended: !currentStatus,
          attended_date: !currentStatus ? new Date().toISOString() : null,
          doctor_id: !currentStatus ? user.id : null
        })
        .eq('patient_id', patientId)
        .eq('month', calendar.month)
        .eq('year', calendar.year)
        .eq('doctor_id', user.id);
      
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
      
      // Also update selectedDay if it exists (for day modal)
      if (selectedDay) {
        setSelectedDay({
          ...selectedDay,
          patients: selectedDay.patients.map(patient => 
            patient.patient_id === patientId 
              ? { ...patient, attended: !currentStatus } 
              : patient
          )
        });
      }
      
      toast.success('Attendance status updated');
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast.error('Failed to update attendance');
    }
  };

  const handleAddPatient = async (patientId) => {
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const currentDoctorId = user.id;
      const selectedPatientData = allPatients.find(p => p.id === patientId);
      
      if (!selectedPatientData) {
        toast.error('Patient not found in available list');
        return;
      }
      
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
      
      console.log('[BracesCalendar] ===== ATTEMPTING TO ADD PATIENT =====');
      console.log('[BracesCalendar] Patient:', selectedPatientData.full_name, '(ID:', patientId + ')');
      console.log('[BracesCalendar] Current Doctor ID:', currentDoctorId);
      console.log('[BracesCalendar] Month:', calendar.month, 'Year:', calendar.year);
      console.log('[BracesCalendar] Appointment Date:', appointmentDate);
      
      // Quick check: Only prevent if THIS doctor already has this patient
      // We don't check for other doctors - they can have the same patient independently
      const { data: existingForThisDoctor } = await supabase
        .from('braces_checkups')
        .select('id')
        .eq('patient_id', patientId)
        .eq('month', calendar.month)
        .eq('year', calendar.year)
        .eq('doctor_id', currentDoctorId) // ONLY current doctor
        .maybeSingle();
      
      if (existingForThisDoctor) {
        toast.error(`${selectedPatientData.full_name} is already in your braces calendar for this month`);
        console.log('[BracesCalendar] Duplicate prevented - patient already exists for THIS doctor');
        return;
      }
      
      console.log('[BracesCalendar] No duplicate found for this doctor - proceeding with insert');
      console.log('[BracesCalendar] Note: Other doctors may have this patient, but that\'s OK');
      
      // Insert the patient - CRITICAL: doctor_id makes each doctor's entry unique
      // Multiple doctors can have the same patient_id, month, year as long as doctor_id is different
      const insertPayload = {
        patient_id: patientId,
        month: calendar.month,
        year: calendar.year,
        appointment_date: appointmentDate,
        attended: false,
        notes: notes || null,
        doctor_id: currentDoctorId // THIS is what allows multiple doctors to have the same patient
      };
      
      console.log('[BracesCalendar] Insert payload:', JSON.stringify(insertPayload, null, 2));
      
      const { data: insertedData, error: currentError } = await supabase
        .from('braces_checkups')
        .insert(insertPayload)
        .select();
      
      if (currentError) {
        console.error('[BracesCalendar] ===== INSERT FAILED =====');
        console.error('[BracesCalendar] Error Code:', currentError.code);
        console.error('[BracesCalendar] Error Message:', currentError.message);
        console.error('[BracesCalendar] Error Details:', JSON.stringify(currentError, null, 2));
        console.error('[BracesCalendar] Patient ID:', patientId);
        console.error('[BracesCalendar] Doctor ID:', currentDoctorId);
        console.error('[BracesCalendar] Month/Year:', calendar.month + '/' + calendar.year);
        console.error('[BracesCalendar] Insert Payload Was:', JSON.stringify(insertPayload, null, 2));
        console.error('[BracesCalendar] ===========================');
        
        // Handle different error types
        if (currentError.code === '23505') {
          // PostgreSQL unique constraint violation
          // This likely means there's a unique constraint on (patient_id, month, year) without doctor_id
          toast.error('Database constraint error: The patient may already exist. If you haven\'t added this patient, there may be a database constraint preventing multiple doctors from adding the same patient. Please contact support.');
          console.error('[BracesCalendar] CRITICAL: Database has unique constraint that may not include doctor_id');
          console.error('[BracesCalendar] This prevents multiple doctors from adding the same patient');
          console.error('[BracesCalendar] Database constraint needs to include doctor_id in the unique index');
        } else if (currentError.code === 'PGRST116' || currentError.message?.includes('duplicate') || currentError.message?.includes('unique')) {
          toast.error('This patient appears to already exist in your calendar. Please refresh and check.');
        } else {
          toast.error(`Failed to add patient: ${currentError.message || 'Unknown error'}`);
        }
        throw currentError;
      }
      
      console.log('[BracesCalendar] Successfully inserted patient:', insertedData);
      
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
          doctor_id: currentDoctorId // Each doctor has their own future entries
        });
      }
      
      // Insert future entries (only if we have entries to insert)
      if (futureEntries.length > 0) {
        // Check for existing future entries to avoid duplicates
        const futureMonths = futureEntries.map(e => ({ month: e.month, year: e.year }));
        const uniqueMonths = [...new Set(futureMonths.map(m => `${m.year}-${m.month}`))];
        
        // Check existing entries for future months
        const { data: existingFutureEntries, error: futureCheckError } = await supabase
          .from('braces_checkups')
          .select('month, year')
          .eq('patient_id', patientId)
          .eq('doctor_id', currentDoctorId)
          .in('month', futureEntries.map(e => e.month))
          .in('year', futureEntries.map(e => e.year));
        
        if (futureCheckError) {
          console.warn('Error checking future entries:', futureCheckError);
          // Continue anyway - we'll let the insert handle duplicates
        }
        
        // Filter out months that already have entries
        const existingFutureMonths = new Set(
          (existingFutureEntries || []).map(e => `${e.year}-${e.month}`)
        );
        
        const entriesToInsert = futureEntries.filter(e => 
          !existingFutureMonths.has(`${e.year}-${e.month}`)
        );
        
        if (entriesToInsert.length > 0) {
          const { error: futureError } = await supabase
            .from('braces_checkups')
            .insert(entriesToInsert);
          
          if (futureError) {
            console.error('Error inserting future entries:', futureError);
            // Don't throw - the current month entry was successful
            toast.warning('Patient added, but some future months may already have entries');
          }
        }
      }
      
      // Refresh the calendar data
      fetchBracesData(calendar.month, calendar.year);
      
      // Refresh the patient list to remove the added patient from available list
      // (only for this doctor - other doctors can still add the same patient)
      await fetchAllPatientsForBraces();
      
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
          doctor_id: user.id
        });
      } catch (auditError) {
        console.error('Error logging braces calendar event audit:', auditError);
        // Continue even if audit logging fails
      }
      
      toast.success(`${selectedPatientData.full_name} added to braces calendar`);
    } catch (error) {
      console.error('Error adding patient:', error);
      // Error message already shown in the specific error handlers above
      if (!error.message || !error.message.includes('already')) {
        toast.error(`Failed to add patient to braces calendar: ${error.message || 'Unknown error'}`);
      }
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
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Get all future records for this patient (only for current doctor)
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
          .eq('year', future.year)
          .eq('doctor_id', user.id);
        
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
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('braces_checkups')
        .update({ notes: notes })
        .eq('patient_id', patientId)
        .eq('month', calendar.month)
        .eq('year', calendar.year)
        .eq('doctor_id', user.id);
      
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
      setSelectedTreatment('');
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

  // Handle day click to show all appointments for that day
  const handleDayClick = (day) => {
    if (!day) return;
    
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
    
    if (patientsForDay.length > 0) {
      setSelectedDay({
        day,
        date: `${calendar.year}-${String(calendar.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        patients: patientsForDay
      });
      setShowDayModal(true);
    } else {
      toast.info(`No braces appointments scheduled for ${getMonthName(calendar.month)} ${day}, ${calendar.year}`);
    }
  };

  // Close day modal
  const closeDayModal = () => {
    setShowDayModal(false);
    setSelectedDay(null);
  };

  // Handle treatment selection
  const handleTreatmentSelect = (treatment) => {
    setSelectedTreatment(treatment);
    if (treatment === 'Other') {
      // Clear notes to allow custom input
      setNotes('');
    } else {
      // Set the selected treatment as notes
      setNotes(treatment);
    }
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
          } ${day ? 'cursor-pointer hover:bg-gray-50 transition-colors duration-150' : ''}`}
          onClick={() => {
            if (showAddPatientModal) {
              setAppointmentDay(day);
              
              // Update the selected date if needed
              if (selectedDate.getMonth() !== calendar.month || 
                  selectedDate.getFullYear() !== calendar.year) {
                const newDate = new Date(calendar.year, calendar.month, day);
                setSelectedDate(newDate);
              }
            } else {
              // Handle day click for viewing appointments
              handleDayClick(day);
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
            
            <button
              onClick={() => setShowReportGeneratorModal(true)}
              className="inline-flex items-center px-3 py-2 text-sm rounded-md text-white bg-purple-600 hover:bg-purple-700"
            >
              <FiFileText className="mr-1" />
              Generate Report
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
                              setSelectedTreatment('');
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
                            onClick={() => generatePatientReport(patient.patient_id)}
                            className="p-1 rounded-full bg-purple-100 text-purple-600 hover:bg-purple-200"
                            title="Generate Patient Report"
                          >
                            <FiFileText className="h-5 w-5" />
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
                                setSelectedTreatment('');
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
                              onClick={() => generatePatientReport(patient.patient_id)}
                              className="p-1 rounded-full bg-purple-100 text-purple-600 hover:bg-purple-200"
                              title="Generate Patient Report"
                            >
                              <FiFileText className="h-5 w-5" />
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Treatment Type
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {bracesTreatments.map((treatment) => (
                  <button
                    key={treatment}
                    onClick={() => handleTreatmentSelect(treatment)}
                    className={`p-2 text-sm rounded-md border transition-colors duration-150 ${
                      selectedTreatment === treatment
                        ? 'bg-primary-100 border-primary-500 text-primary-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {treatment}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <label htmlFor="edit-notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes {selectedTreatment && selectedTreatment !== 'Other' && `(${selectedTreatment})`}
              </label>
              <textarea
                id="edit-notes"
                placeholder={selectedTreatment === 'Other' ? "Add custom treatment notes..." : "Add additional notes about the treatment..."}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setSelectedTreatment('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleUpdateNotes(selectedPatient.patient_id);
                  setSelectedTreatment('');
                }}
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

      {/* Patient Report Modal */}
      {showReportModal && reportData && (
        <Modal
          title={reportData.patient ? `Braces Report - ${reportData.patient.full_name}` : `Braces Report - ${reportData.period ? reportData.period.charAt(0).toUpperCase() + reportData.period.slice(1) + ' Report' : 'Report'}`}
          onClose={() => setShowReportModal(false)}
        >
          <div className="p-4 max-h-96 overflow-y-auto">
            <div className="space-y-4">
              {/* Patient Info - Only show for patient reports */}
              {reportData.patient && (
                <div className="bg-gray-50 p-3 rounded">
                  <h3 className="font-semibold text-lg mb-2">Patient Information</h3>
                  <p><strong>Name:</strong> {reportData.patient.full_name}</p>
                  <p><strong>Phone:</strong> {reportData.patient.phone || 'Not provided'}</p>
                  <p><strong>Email:</strong> {reportData.patient.email || 'Not provided'}</p>
                </div>
              )}
              
              {/* Report Period Info - Only show for filtered reports */}
              {reportData.period && !reportData.patient && (
                <div className="bg-gray-50 p-3 rounded">
                  <h3 className="font-semibold text-lg mb-2">Report Period</h3>
                  <p><strong>Period:</strong> {reportData.period.charAt(0).toUpperCase() + reportData.period.slice(1)}</p>
                  <p><strong>Date Range:</strong> {new Date(reportData.startDate).toLocaleDateString()} - {new Date(reportData.endDate).toLocaleDateString()}</p>
                  {reportData.filters?.patientId && (
                    <p><strong>Filtered by Patient:</strong> {
                      reportData.filters?.patientName || 
                      (reportData.allAppointments.length > 0 
                        ? reportData.allAppointments[0]?.patients?.full_name 
                        : 'N/A')
                    }</p>
                  )}
                  {reportData.filters?.status !== 'all' && (
                    <p><strong>Status Filter:</strong> {reportData.filters.status.charAt(0).toUpperCase() + reportData.filters.status.slice(1)}</p>
                  )}
                  {reportData.filters?.includeNotes && (
                    <p><strong>Notes Filter:</strong> Only appointments with treatment notes</p>
                  )}
                </div>
              )}

              {/* Summary */}
              <div className="bg-blue-50 p-3 rounded">
                <h3 className="font-semibold text-lg mb-2">Treatment Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <p><strong>Total Appointments:</strong> {reportData.summary.total}</p>
                  <p><strong>Attended:</strong> {reportData.summary.attended}</p>
                  <p><strong>Missed:</strong> {reportData.summary.missed}</p>
                  <p><strong>Attendance Rate:</strong> {reportData.summary.attendanceRate}%</p>
                </div>
              </div>

              {/* Period Breakdown - Only for filtered reports */}
              {reportData.groupedData && Object.keys(reportData.groupedData).length > 0 && (
                <div className="bg-green-50 p-3 rounded">
                  <h3 className="font-semibold text-lg mb-2">Period Breakdown</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Attended</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Missed</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(reportData.groupedData).map(([period, data]) => (
                          <tr key={period}>
                            <td className="px-4 py-2 text-sm text-gray-900">{period}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{data.total}</td>
                            <td className="px-4 py-2 text-sm text-green-600">{data.attended}</td>
                            <td className="px-4 py-2 text-sm text-red-600">{data.missed}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {data.total > 0 ? ((data.attended / data.total) * 100).toFixed(1) : 0}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Assessment */}
              <div className="bg-purple-50 p-3 rounded">
                <h3 className="font-semibold text-lg mb-2">Treatment Assessment</h3>
                <p>
                  {reportData.summary.attendanceRate >= 80 ? 
                    'Patient shows excellent compliance with braces treatment schedule. Treatment progress is on track.' :
                    reportData.summary.attendanceRate >= 60 ?
                    'Patient shows good compliance with braces treatment schedule. Minor improvements in attendance recommended.' :
                    'Patient shows poor compliance with braces treatment schedule. Consider follow-up and additional patient education.'}
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={printReport}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 flex items-center"
              >
                <FiPrinter className="h-4 w-4 mr-2" />
                Print Report
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Report Generator Modal */}
      {showReportGeneratorModal && (
        <Modal
          title="Generate Braces Report"
          onClose={() => setShowReportGeneratorModal(false)}
        >
          <div className="p-4">
            <div className="space-y-4">
              {/* Period Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report Period
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['daily', 'weekly', 'monthly', 'yearly'].map((period) => (
                    <button
                      key={period}
                      onClick={() => {
                        const today = new Date();
                        let startDate = new Date();
                        
                        switch(period) {
                          case 'daily':
                            startDate = new Date(today);
                            break;
                          case 'weekly':
                            startDate = new Date(today);
                            startDate.setDate(today.getDate() - today.getDay());
                            break;
                          case 'monthly':
                            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                            break;
                          case 'yearly':
                            startDate = new Date(today.getFullYear(), 0, 1);
                            break;
                        }
                        
                        setReportFilters({
                          ...reportFilters,
                          period,
                          startDate
                        });
                      }}
                      className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                        reportFilters.period === period
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {reportFilters.period === 'daily' ? 'Select Date' : reportFilters.period === 'yearly' ? 'Select Year' : 'Start Date'}
                </label>
                <DatePicker
                  selected={reportFilters.startDate}
                  onChange={(date) => setReportFilters({ ...reportFilters, startDate: date })}
                  dateFormat={reportFilters.period === 'yearly' ? 'yyyy' : reportFilters.period === 'monthly' ? 'MMMM yyyy' : 'MMMM d, yyyy'}
                  showYearPicker={reportFilters.period === 'yearly'}
                  showMonthYearPicker={reportFilters.period === 'monthly'}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* End Date for custom range */}
              {(reportFilters.period === 'monthly' || reportFilters.period === 'weekly' || reportFilters.period === 'yearly') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date (Optional)
                  </label>
                  <DatePicker
                    selected={reportFilters.endDate}
                    onChange={(date) => setReportFilters({ ...reportFilters, endDate: date })}
                    dateFormat={reportFilters.period === 'yearly' ? 'yyyy' : reportFilters.period === 'monthly' ? 'MMMM yyyy' : 'MMMM d, yyyy'}
                    showYearPicker={reportFilters.period === 'yearly'}
                    showMonthYearPicker={reportFilters.period === 'monthly'}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to use default {reportFilters.period === 'monthly' ? 'month end' : reportFilters.period === 'weekly' ? 'week end' : 'year end'}
                  </p>
                </div>
              )}

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status Filter
                </label>
                <select
                  value={reportFilters.status}
                  onChange={(e) => setReportFilters({ ...reportFilters, status: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">All Appointments</option>
                  <option value="attended">Attended Only</option>
                  <option value="missed">Missed Only</option>
                </select>
              </div>

              {/* Patient Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient Filter (Optional)
                </label>
                <select
                  value={reportFilters.patientId || ''}
                  onChange={(e) => setReportFilters({ ...reportFilters, patientId: e.target.value || null })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All Patients</option>
                  {getFilteredCalendarPatients().map(patient => (
                    <option key={patient.patient_id} value={patient.patient_id}>
                      {patient.patients?.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Include Notes Filter */}
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={reportFilters.includeNotes}
                    onChange={(e) => setReportFilters({ ...reportFilters, includeNotes: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Only include appointments with treatment notes</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowReportGeneratorModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={generateFilteredReport}
                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700"
              >
                Generate Report
              </button>
            </div>
          </div>
        </Modal>
      )}

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
                    {getMonthName(calendar.month)} {selectedDay.day}, {calendar.year}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {selectedDay.patients.length} braces appointment{selectedDay.patients.length !== 1 ? 's' : ''} scheduled
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
                {selectedDay.patients.map((patient) => (
                  <div
                    key={patient.id}
                    className={`p-4 rounded-lg border ${
                      patient.attended 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          {patient.attended ? (
                            <FiCheckCircle className="h-5 w-5 mr-2 text-green-600" />
                          ) : (
                            <FiXCircle className="h-5 w-5 mr-2 text-red-600" />
                          )}
                          <h4 className="text-lg font-semibold">
                            {patient.patients?.full_name || 'Unknown Patient'}
                          </h4>
                          <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${
                            patient.attended ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {patient.attended ? 'Attended' : 'Missed'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <FiCalendar className="h-4 w-4 mr-2 text-gray-500" />
                              <span className="text-gray-700">
                                <strong>Appointment Date:</strong> {new Date(patient.appointment_date).toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                            
                            {patient.attended_date && (
                              <div className="flex items-center">
                                <FiCheckCircle className="h-4 w-4 mr-2 text-gray-500" />
                                <span className="text-gray-700">
                                  <strong>Attended Date:</strong> {new Date(patient.attended_date).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            {/* Patient ID removed from display */}
                          </div>
                        </div>
                        
                        {patient.notes && (
                          <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                            <p className="text-sm text-gray-700">
                              <strong>Notes:</strong> {patient.notes}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col space-y-2 ml-4">
                        <button
                          onClick={() => {
                            setSelectedPatient(patient);
                            setNotes(patient.notes || '');
                            setSelectedTreatment('');
                            setShowNotesModal(true);
                            closeDayModal();
                          }}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors duration-150"
                          title="Edit Notes"
                        >
                          <FiEdit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleAttendance(patient.patient_id, patient.attended)}
                          className={`p-2 rounded-lg transition-colors duration-150 ${
                            patient.attended 
                              ? 'text-green-600 hover:text-green-800 hover:bg-green-50' 
                              : 'text-red-600 hover:text-red-800 hover:bg-red-50'
                          }`}
                          title={patient.attended ? 'Mark as Missed' : 'Mark as Attended'}
                        >
                          {patient.attended ? (
                            <FiCheckCircle className="h-4 w-4" />
                          ) : (
                            <FiXCircle className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPatient(patient);
                            setShowRemovePatientModal(true);
                            closeDayModal();
                          }}
                          className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors duration-150"
                          title="Remove Patient"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
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
    </div>
  );
};

export default BracesCalendar;