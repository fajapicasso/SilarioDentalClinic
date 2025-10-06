// src/pages/doctor/PatientRecords.jsx - Enhanced with Treatment History and Dental Chart
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiUpload, FiEye, FiEyeOff, FiTrash2, FiFileText, FiX, FiPrinter, FiPlus, FiEdit, FiSave, FiDownload, FiUser, FiCalendar, FiClock, FiMapPin } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import supabase from '../../config/supabaseClient';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ModernDentalChart from '../../components/common/ModernDentalChart';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

// Define bucket name as a constant to avoid typos
const BUCKET_NAME = 'patient-files';

// Utility functions for temporary teeth mapping
const getTempTeethMap = () => ({
  'A': 101, 'B': 102, 'C': 103, 'D': 104, 'E': 105,
  'F': 106, 'G': 107, 'H': 108, 'I': 109, 'J': 110,
  'K': 111, 'L': 112, 'M': 113, 'N': 114, 'O': 115,
  'P': 116, 'Q': 117, 'R': 118, 'S': 119, 'T': 120
});

const getReverseTempTeethMap = () => {
  const tempMap = getTempTeethMap();
  return Object.fromEntries(Object.entries(tempMap).map(([k, v]) => [v, k]));
};

const convertToothNumberForDisplay = (toothNumber) => {
  if (toothNumber >= 101 && toothNumber <= 120) {
    const reverseMap = getReverseTempTeethMap();
    return reverseMap[toothNumber] || toothNumber;
  }
  return toothNumber;
};

// Format text with automatic bullet points
const formatBulletPoints = (text) => {
  if (!text) return '';
  
  // Split by lines and filter out empty lines
  const lines = text.split('\n').filter(line => line.trim() !== '');
  
  // If only one line or no line breaks, return as regular text
  if (lines.length <= 1) {
    return text;
  }
  
  // Convert multiple lines to bullet points automatically
  return (
    <ul className="list-none space-y-1">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();
        // Remove existing bullet points if any
        const cleanLine = trimmedLine.startsWith('•') ? trimmedLine.substring(1).trim() : trimmedLine;
        
        return (
          <li key={index} className="flex items-start">
            <span className="text-gray-600 mr-2">•</span>
            <span>{cleanLine}</span>
          </li>
        );
      })}
    </ul>
  );
};

// Dental chart symbols from the official form
const chartSymbols = {
  'A': 'Decayed (Caries Indicated for filling)',
  'B': 'Missing due to caries',
  'C': 'Caries Indicated for Extraction',
  'D': 'Filled Fragment',
  'E': 'Filled tooth for caries',
  'F': 'Impacted Tooth',
  'G': 'Jacket Crown',
  'H': 'Abutment Filling',
  'I': 'Pontic',
  'J': 'Full Crown Prosthetic',
  'K': 'Removable Denture',
  'L': 'Extraction due to other causes',
  'M': 'Congenitally missing',
  'N': 'Supernumerary tooth',
  'O': 'Root Fragment',
  'P': 'Unerupted'
};

// Enhanced dental chart symbols with proper colors and visual indicators
const enhancedChartSymbols = {
  'A': { name: 'Decayed (Caries Indicated for filling)', color: '#ef4444', bgColor: '#fef2f2', borderColor: '#fecaca', icon: '🦷' },
  'B': { name: 'Missing due to caries', color: '#7f1d1d', bgColor: '#450a0a', borderColor: '#991b1b', icon: '❌' },
  'C': { name: 'Caries Indicated for Extraction', color: '#dc2626', bgColor: '#fef2f2', borderColor: '#fca5a5', icon: '⚠️' },
  'D': { name: 'Filled Fragment', color: '#f97316', bgColor: '#fff7ed', borderColor: '#fed7aa', icon: '🔧' },
  'E': { name: 'Filled tooth for caries', color: '#10b981', bgColor: '#ecfdf5', borderColor: '#a7f3d0', icon: '✅' },
  'F': { name: 'Impacted Tooth', color: '#8b5cf6', bgColor: '#f5f3ff', borderColor: '#c4b5fd', icon: '🔒' },
  'G': { name: 'Jacket Crown', color: '#f59e0b', bgColor: '#fffbeb', borderColor: '#fde68a', icon: '👑' },
  'H': { name: 'Abutment Filling', color: '#06b6d4', bgColor: '#ecfeff', borderColor: '#a5f3fc', icon: '🔗' },
  'I': { name: 'Pontic', color: '#3b82f6', bgColor: '#eff6ff', borderColor: '#93c5fd', icon: '🌉' },
  'J': { name: 'Full Crown Prosthetic', color: '#6366f1', bgColor: '#eef2ff', borderColor: '#a5b4fc', icon: '👑' },
  'K': { name: 'Removable Denture', color: '#ec4899', bgColor: '#fdf2f8', borderColor: '#f9a8d4', icon: '🦷' },
  'L': { name: 'Extraction due to other causes', color: '#991b1b', bgColor: '#450a0a', borderColor: '#dc2626', icon: '🚫' },
  'M': { name: 'Congenitally missing', color: '#64748b', bgColor: '#f8fafc', borderColor: '#cbd5e1', icon: '⭕' },
  'N': { name: 'Supernumerary tooth', color: '#84cc16', bgColor: '#f7fee7', borderColor: '#bef264', icon: '➕' },
  'O': { name: 'Root Fragment', color: '#a3a3a3', bgColor: '#f9fafb', borderColor: '#d1d5db', icon: '🦴' },
  'P': { name: 'Unerupted', color: '#6b7280', bgColor: '#f9fafb', borderColor: '#d1d5db', icon: '🌱' }
};

// Dynamic validation schema for treatment history
const createTreatmentSchema = (isMultiProcedureMode, selectedTeethInChart = [], editingTreatment = null) => {
  const baseSchema = {
  treatment_plan: Yup.string().required('Treatment plan is required'),
  notes: Yup.string().max(500, 'Notes must be less than 500 characters'),
  treatment_date: Yup.date().required('Treatment date is required').max(new Date(), 'Treatment date cannot be in the future')
  };

  if (isMultiProcedureMode) {
    // Multi-procedure mode: validate procedureDetails, not individual fields
    return Yup.object().shape({
      ...baseSchema,
      procedure: Yup.string().notRequired(), // Not required in multi-procedure mode
      tooth_number: Yup.mixed().notRequired(), // Not required in multi-procedure mode
      procedureDetails: Yup.array().of(
        Yup.object().shape({
          procedure: Yup.string().required('Procedure is required'),
          tooth_number: Yup.mixed().required('Tooth number is required').test('tooth-format', 'Invalid tooth format', function(value) {
            // Accept numbers 1-32 for permanent teeth (both number and string types)
            if ((typeof value === 'number' && value >= 1 && value <= 32) || 
                (typeof value === 'string' && /^[1-9]$|^[12][0-9]$|^3[0-2]$/.test(value))) return true;
            // Accept letters A-T for temporary teeth
            if (typeof value === 'string' && /^[A-T]$/.test(value)) return true;
            return false;
          })
        })
      ).min(1, 'At least one procedure is required')
    });
  } 
  
  // For multi-teeth selection (single procedure, multiple teeth)
  if (selectedTeethInChart.length > 1 && !editingTreatment) {
    return Yup.object().shape({
      ...baseSchema,
      procedure: Yup.string().required('Procedure is required'),
      tooth_number: Yup.mixed().notRequired(), // Not required when multiple teeth selected
      procedureDetails: Yup.array().notRequired()
    });
  }
  
  // Single procedure, single tooth mode: validate individual fields
  return Yup.object().shape({
    ...baseSchema,
    procedure: Yup.string().required('Procedure is required'),
    tooth_number: Yup.mixed().required('Tooth number is required').test('tooth-format', 'Invalid tooth format', function(value) {
      // Accept numbers 1-32 for permanent teeth (both number and string types)
      if ((typeof value === 'number' && value >= 1 && value <= 32) || 
          (typeof value === 'string' && /^[1-9]$|^[12][0-9]$|^3[0-2]$/.test(value))) return true;
      // Accept letters A-T for temporary teeth
      if (typeof value === 'string' && /^[A-T]$/.test(value)) return true;
      return false;
    }),
    procedureDetails: Yup.array().notRequired() // Not required in single procedure mode
  });
};

const PatientRecords = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { logPageView, logMedicalRecordView, logMedicalRecordUpdate, logTreatmentAdd } = useUniversalAudit();
  const [patient, setPatient] = useState(null);

  // Function to clean notes for display (remove hidden appointment references)
  const cleanNotesForDisplay = (notes) => {
    if (!notes) return '';
    // Remove HTML comment-style appointment references
    return notes.replace(/<!--APPOINTMENT_REF:[^>]*-->/g, '').trim();
  };
  const [isLoading, setIsLoading] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [isFileDeleting, setIsFileDeleting] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  
  // Treatment History States
  const [treatments, setTreatments] = useState([]);
  const [showTreatmentForm, setShowTreatmentForm] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [isSubmittingTreatment, setIsSubmittingTreatment] = useState(false);
  const [showDentalChart, setShowDentalChart] = useState(false);
  const [selectedToothInChart, setSelectedToothInChart] = useState(null);
  const [selectedTeethInChart, setSelectedTeethInChart] = useState([]); // New state for multi-selection
  const [toothTreatments, setToothTreatments] = useState([]);
  const [showTreatmentHistory, setShowTreatmentHistory] = useState(true); // New state for hiding treatment history
  
  // Pagination and Filter States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [procedureFilter, setProcedureFilter] = useState('');
  const [toothFilter, setToothFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState({ startDate: '', endDate: '' });
  const [filteredTreatments, setFilteredTreatments] = useState([]);
  
  // New states for simplified treatment flow
  const [completedAppointments, setCompletedAppointments] = useState([]);
  const [availableProcedures, setAvailableProcedures] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedAppointmentForTreatment, setSelectedAppointmentForTreatment] = useState(null);
  const [isAutoCreatingTreatments, setIsAutoCreatingTreatments] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [treatmentToDelete, setTreatmentToDelete] = useState(null);
  
  // States for multi-procedure handling
  const [procedureDetails, setProcedureDetails] = useState([]);
  const [isMultiProcedureMode, setIsMultiProcedureMode] = useState(false);
  
  // Dental Chart States
  const [dentalChart, setDentalChart] = useState(null);
  const [showDentalChartDetails, setShowDentalChartDetails] = useState(false);
  
  // File preview and print states
  const [filePreview, setFilePreview] = useState(null);
  const [printWindow, setPrintWindow] = useState(null);

  useEffect(() => {
    if (patientId) {
      fetchPatientData();
      fetchTreatmentHistory();
      // Log page view
      logPageView('Patient Records', 'medical_records', 'viewing');
      fetchDentalChart();
      fetchCompletedAppointments();
      fetchServices();
    } else {
      setIsLoading(false);
    }
    return () => {
      if (printWindow && !printWindow.closed) {
        printWindow.close();
      }
    };
  }, [patientId]);

  useEffect(() => {
    if (selectedToothInChart) {
      const toothSpecificTreatments = treatments.filter(treatment => {
        const displayToothNumber = convertToothNumberForDisplay(treatment.tooth_number);
        return displayToothNumber === selectedToothInChart;
      });
      setToothTreatments(toothSpecificTreatments);
    } else {
      setToothTreatments([]);
    }
  }, [selectedToothInChart, treatments]);

  // Auto-populate tooth number when teeth are selected from dental chart
  useEffect(() => {
    if (selectedTeethInChart.length > 0 && showTreatmentForm && !editingTreatment) {
      // If only one tooth is selected, auto-populate the tooth number field
      if (selectedTeethInChart.length === 1) {
        const selectedTooth = selectedTeethInChart[0];
        // Set the tooth number in the form
        const toothNumberField = document.getElementById('tooth_number');
        if (toothNumberField) {
          // Convert to string for the field value, but ensure proper type handling
          toothNumberField.value = String(selectedTooth);
          // Trigger change event to update formik
          toothNumberField.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
  }, [selectedTeethInChart, showTreatmentForm, editingTreatment]);

  // Filter treatments based on search and filters
  useEffect(() => {
    let filtered = [...treatments];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(treatment => 
        treatment.procedure?.toLowerCase().includes(query) ||
        treatment.diagnosis?.toLowerCase().includes(query) ||
        treatment.notes?.toLowerCase().includes(query) ||
        treatment.doctor?.full_name?.toLowerCase().includes(query)
      );
    }

    // Procedure filter
    if (procedureFilter) {
      filtered = filtered.filter(treatment => treatment.procedure === procedureFilter);
    }

    // Tooth number filter
    if (toothFilter) {
      filtered = filtered.filter(treatment => {
        const displayToothNumber = convertToothNumberForDisplay(treatment.tooth_number);
        return displayToothNumber?.toString() === toothFilter;
      });
    }

    // Date range filter
    if (dateRangeFilter.startDate || dateRangeFilter.endDate) {
      filtered = filtered.filter(treatment => {
        const treatmentDate = new Date(treatment.treatment_date);
        const startDate = dateRangeFilter.startDate ? new Date(dateRangeFilter.startDate) : new Date('1900-01-01');
        const endDate = dateRangeFilter.endDate ? new Date(dateRangeFilter.endDate) : new Date();
        return treatmentDate >= startDate && treatmentDate <= endDate;
      });
    }

    setFilteredTreatments(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [treatments, searchQuery, procedureFilter, toothFilter, dateRangeFilter]);

  // Update available procedures when services change
  useEffect(() => {
    if (services.length > 0) {
      setAvailableProcedures(services.map(service => service.name));
    }
  }, [services]);

  const fetchPatientData = async () => {
    setIsLoading(true);
    
    try {
      // Fetch patient profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', patientId)
        .single();
      
      if (profileError) throw profileError;
      setPatient(profileData);
      
      // Fetch patient files
      const { data: filesData, error: filesError } = await supabase
        .from('patient_files')
        .select('*')
        .eq('patient_id', patientId)
        .order('uploaded_at', { ascending: false });
      
      if (filesError) throw filesError;
      
      const processedFiles = filesData?.map(file => {
        if (!file) return null;
        return {
          ...file,
          isPatientUploaded: file.uploaded_by === patientId,
          displayDate: formatDate(file.uploaded_at),
          uploaderType: file.uploaded_by === patientId ? 'patient' : 'staff'
        };
      }).filter(file => file !== null) || [];
      
      setUploadedFiles(processedFiles);
    } catch (error) {
      console.error('Error fetching patient data:', error);
      toast.error('Failed to load patient data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTreatmentHistory = async () => {
    try {
      // Get the current logged-in doctor
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('Error getting user:', userError);
        toast.error('Authentication error');
        return;
      }

      const { data, error } = await supabase
        .from('treatments')
        .select(`
          id, 
          procedure, 
          tooth_number, 
          diagnosis,
          notes, 
          treatment_date,
          created_at,
          doctor:doctor_id (id, full_name)
        `)
        .eq('patient_id', patientId)
        .eq('doctor_id', user.id) // Only show treatments by the logged-in doctor
        .order('treatment_date', { ascending: false });
      
      if (error) throw error;

      // Fetch appointments to get time and branch information
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('id, appointment_date, appointment_time, branch, status')
        .eq('patient_id', patientId)
        .eq('doctor_id', user.id)
        .eq('status', 'completed');

      if (appointmentsError) {
        console.error('Error fetching appointments for treatments:', appointmentsError);
      }

      // Enhance treatments with appointment data
      const enhancedTreatments = data ? data.map(treatment => {
        const treatmentDate = new Date(treatment.treatment_date).toLocaleDateString();
        
        // Try to find matching appointment by date, time, and branch from notes
        let matchingAppointment = null;
        
        if (treatment.notes) {
          // Extract time and branch from treatment notes
          const timeMatch = treatment.notes.match(/at (\d{2}:\d{2}:\d{2})/);
          const branchMatch = treatment.notes.match(/(?:From appointment|Auto-created from appointment): ([^a]+) Branch/);
          
          if (timeMatch && branchMatch) {
            const treatmentTime = timeMatch[1];
            const treatmentBranch = branchMatch[1].trim();
            
            // Find appointment with matching date, time, and branch
            matchingAppointment = appointmentsData?.find(appointment => 
              new Date(appointment.appointment_date).toLocaleDateString() === treatmentDate &&
              appointment.appointment_time === treatmentTime &&
              appointment.branch === treatmentBranch
            );
          }
        }
        
        // Fallback: if no exact match found, use first appointment with same date
        if (!matchingAppointment) {
          matchingAppointment = appointmentsData?.find(appointment => 
            new Date(appointment.appointment_date).toLocaleDateString() === treatmentDate
          );
        }

        return {
          ...treatment,
          appointment_time: matchingAppointment?.appointment_time || null,
          appointment_branch: matchingAppointment?.branch || null
        };
      }) : [];
      
      setTreatments(enhancedTreatments);
    } catch (error) {
      console.error('Error fetching treatment history:', error);
      toast.error('Failed to load treatment history');
    }
  };

  const fetchDentalChart = async () => {
    try {
      const { data, error } = await supabase
        .from('dental_charts')
        .select(`
          id,
          chart_data,
          medical_history,
          dental_history,
          created_at,
          updated_at,
          doctor:created_by (id, full_name)
        `)
        .eq('patient_id', patientId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      setDentalChart(data);
    } catch (error) {
      console.error('Error fetching dental chart:', error);
      // Don't show error toast as dental chart might not exist yet
    }
  };

  // Fetch completed appointments with their procedures for treatment creation
  const fetchCompletedAppointments = async () => {
    try {
      // Get the current logged-in doctor
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('Error getting user:', userError);
        toast.error('Authentication error');
        return;
      }

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          status,
          branch,
          notes,
          created_at,
          doctor_id,
          doctor:doctor_id (id, full_name)
        `)
        .eq('patient_id', patientId)
        .eq('status', 'completed')
        .eq('doctor_id', user.id) // Only show appointments for the logged-in doctor
        .order('appointment_date', { ascending: false });

      if (appointmentsError) throw appointmentsError;

      if (appointmentsData && appointmentsData.length > 0) {
        // Fetch appointment services for completed appointments
        const appointmentIds = appointmentsData.map(a => a.id);
        
        const { data: serviceJoinData, error: serviceJoinError } = await supabase
          .from('appointment_services')
          .select('appointment_id, service_id')
          .in('appointment_id', appointmentIds);

        if (serviceJoinError) {
          console.error('Error fetching appointment services:', serviceJoinError);
          setCompletedAppointments(appointmentsData);
          return;
        }

        // Get service details
        const serviceIds = serviceJoinData ? [...new Set(serviceJoinData.map(s => s.service_id))] : [];
        
        const { data: servicesData, error: servicesError } = serviceIds.length > 0 
          ? await supabase
              .from('services')
              .select('id, name, description')
              .in('id', serviceIds)
          : { data: [], error: null };

        if (servicesError) {
          console.error('Error fetching services:', servicesError);
          setCompletedAppointments(appointmentsData);
          return;
        }

        // Create service lookup map
        const serviceMap = {};
        if (servicesData) {
          servicesData.forEach(service => {
            serviceMap[service.id] = service;
          });
        }

        // Map appointments to services
        const appointmentServicesMap = {};
        if (serviceJoinData) {
          serviceJoinData.forEach(joinRecord => {
            if (!appointmentServicesMap[joinRecord.appointment_id]) {
              appointmentServicesMap[joinRecord.appointment_id] = [];
            }
            
            const serviceInfo = serviceMap[joinRecord.service_id];
            if (serviceInfo) {
              appointmentServicesMap[joinRecord.appointment_id].push(serviceInfo);
            }
          });
        }

        // Check which appointments already have treatments by matching treatment notes with appointment info
        const { data: existingTreatments, error: treatmentsError } = await supabase
          .from('treatments')
          .select('notes, treatment_date, procedure')
          .eq('patient_id', patientId)
          .eq('doctor_id', user.id);

        if (treatmentsError) {
          console.error('Error fetching existing treatments:', treatmentsError);
        }

        // Create a set of appointment identifiers that already have treatments
        const treatedAppointmentIds = new Set();
        
        if (existingTreatments) {
          appointmentsData.forEach(appointment => {
            const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString();
            const appointmentBranch = appointment.branch;
            const appointmentTime = appointment.appointment_time;
            
            // Check if any treatment matches this specific appointment
            const hasTreatment = existingTreatments.some(treatment => {
              if (!treatment.notes) return false;
              
              // Check for new format: <!--APPOINTMENT_REF:appointmentId:branch:time-->
              const newFormatMatch = treatment.notes.includes(`<!--APPOINTMENT_REF:${appointment.id}:`);
              
              // Check for old format: From appointment ID appointmentId:
              const oldFormatMatch = treatment.notes.includes(`From appointment ID ${appointment.id}:`);
              
              const hasMatch = newFormatMatch || oldFormatMatch;
              
              // Debug logging
              console.log(`Checking appointment ${appointment.id}:`, {
                appointmentId: appointment.id,
                treatmentNotes: treatment.notes,
                newFormatMatch,
                oldFormatMatch,
                hasMatch
              });
              
              return hasMatch;
            });
            
            if (hasTreatment) {
              treatedAppointmentIds.add(appointment.id);
              console.log(`Appointment ${appointment.id} will be hidden - has treatment`);
            }
          });
        }

        // Format appointments with services and filter out those with existing treatments
        console.log('Treated appointment IDs:', Array.from(treatedAppointmentIds));
        console.log('Total appointments before filtering:', appointmentsData.length);
        
        const formattedAppointments = appointmentsData
          .filter(appointment => !treatedAppointmentIds.has(appointment.id))
          .map(appointment => ({
          ...appointment,
          services: appointmentServicesMap[appointment.id] || [],
          serviceNames: (appointmentServicesMap[appointment.id] || []).map(s => s.name)
        }));

        console.log('Appointments after filtering:', formattedAppointments.length);
        setCompletedAppointments(formattedAppointments);
      } else {
        setCompletedAppointments([]);
      }
    } catch (error) {
      console.error('Error fetching completed appointments:', error);
      setCompletedAppointments([]);
    }
  };

  // Fetch services from admin service management
  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
    }
  };

  const handleTreatmentSubmit = async (values, { resetForm }) => {
    console.log('=== FORM SUBMISSION DEBUG START ===');
    console.log('Form submission started with values:', values);
    console.log('isMultiProcedureMode:', isMultiProcedureMode);
    console.log('procedureDetails state:', procedureDetails);
    console.log('Treatment plan:', values.treatment_plan);
    console.log('Notes:', values.notes);
    console.log('editingTreatment:', editingTreatment);
    console.log('selectedAppointmentForTreatment:', selectedAppointmentForTreatment);
    
    setIsSubmittingTreatment(true);
    
    try {
      console.log('=== AUTHENTICATION CHECK ===');
      console.log('Starting treatment submission with values:', values);
      console.log('Multi-procedure mode:', isMultiProcedureMode);
      console.log('Procedure details:', values.procedureDetails);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Error getting user:', userError);
        throw new Error('Authentication error: ' + userError.message);
      }
      
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      console.log('Authenticated user:', user.id);
      
      // Validate required fields based on mode
      if (!isMultiProcedureMode) {
        // Single procedure mode validation
        if (!values.procedure) {
          throw new Error('Procedure is required');
        }
        
        // For multi-teeth selection, we don't need tooth_number from form
        if (selectedTeethInChart.length <= 1 && !values.tooth_number) {
          throw new Error('Tooth number is required');
        }
        
        // For multi-teeth selection, ensure we have selected teeth
        if (selectedTeethInChart.length > 1 && selectedTeethInChart.length === 0) {
          throw new Error('Please select at least one tooth');
        }
      } else {
        // Multi-procedure mode validation
        if (!values.procedureDetails || values.procedureDetails.length === 0) {
          throw new Error('At least one procedure is required');
        }
        // Check if all procedures have tooth numbers
        const missingToothNumbers = values.procedureDetails.filter(detail => !detail.tooth_number);
        if (missingToothNumbers.length > 0) {
          throw new Error('Tooth number is required for all procedures');
        }
      }
      
      // Common validation for both modes
      if (!values.treatment_plan) {
        throw new Error('Treatment plan is required');
      }
      if (!values.treatment_date) {
        throw new Error('Treatment date is required');
      }
      
      // Handle multi-procedure vs single procedure
      let treatmentData;
      
      console.log('=== PROCEDURE PROCESSING CHECK ===');
      console.log('isMultiProcedureMode:', isMultiProcedureMode);
      console.log('values.procedureDetails:', values.procedureDetails);
      console.log('values.procedureDetails length:', values.procedureDetails?.length);
      
      if (isMultiProcedureMode && values.procedureDetails && values.procedureDetails.length > 0) {
        // Multi-procedure mode: create combined record
        console.log('=== MULTI-PROCEDURE MODE PROCESSING ===');
        console.log('Processing multi-procedure data:', values.procedureDetails);
        console.log('Form values:', values);
        console.log('Treatment plan:', values.treatment_plan);
        console.log('Notes:', values.notes);
        
        const procedures = values.procedureDetails.map(detail => detail.procedure);
        const toothNumbers = values.procedureDetails.map(detail => detail.tooth_number);
        
        console.log('Multi-procedure mode - creating combined record:', {
          procedures,
          toothNumbers,
          procedureDetails: values.procedureDetails,
          treatmentPlan: values.treatment_plan,
          notes: values.notes
        });
        
        console.log('=== VALIDATION CHECK ===');
        console.log('Treatment plan validation:', {
          hasTreatmentPlan: !!values.treatment_plan,
          treatmentPlanValue: values.treatment_plan,
          treatmentPlanTrimmed: values.treatment_plan?.trim(),
          isEmpty: !values.treatment_plan || values.treatment_plan.trim() === ''
        });
        
        // Validate that we have a treatment plan
        if (!values.treatment_plan || values.treatment_plan.trim() === '') {
          throw new Error('Treatment plan is required for multi-procedure treatments');
        }
        
        treatmentData = {
          patient_id: patientId,
          doctor_id: user.id,
          procedure: procedures.join(', '), // Combine all procedures
          tooth_number: toothNumbers[0], // Primary tooth number
          diagnosis: values.treatment_plan,
          notes: (() => {
            if (editingTreatment) {
              // When editing, preserve existing appointment reference and add user notes
              const existingNotes = editingTreatment.notes || '';
              const existingAppointmentRef = existingNotes.match(/<!--APPOINTMENT_REF:[^>]*-->/);
              const userNotes = values.notes || '';
              return existingAppointmentRef ? `${userNotes}${existingAppointmentRef[0]}` : userNotes;
            } else {
              // When creating new, add appointment reference if from appointment
              const appointmentNote = selectedAppointmentForTreatment ? 
                `<!--APPOINTMENT_REF:${selectedAppointmentForTreatment.id}:${selectedAppointmentForTreatment.branch}:${selectedAppointmentForTreatment.appointment_time}-->` : '';
              return values.notes ? `${values.notes}${appointmentNote}` : appointmentNote;
            }
          })(),
          treatment_date: values.treatment_date instanceof Date 
            ? values.treatment_date.toISOString().split('T')[0] 
            : values.treatment_date
          // Note: Removed procedure_details field as it may not exist in database schema
        };
      } else if (isMultiProcedureMode) {
        // Multi-procedure mode but no valid procedureDetails - fallback to single procedure
        console.log('Multi-procedure mode but no valid procedureDetails, falling back to single procedure');
        treatmentData = {
          patient_id: patientId,
          doctor_id: user.id,
          procedure: values.procedure || 'Multiple Procedures',
          tooth_number: (() => {
            // Handle temporary teeth by mapping letters to numbers (100+ range)
            const toothNum = values.tooth_number;
            if (typeof toothNum === 'string' && /^[A-T]$/.test(toothNum)) {
              const tempTeethMap = {
                'A': 101, 'B': 102, 'C': 103, 'D': 104, 'E': 105,
                'F': 106, 'G': 107, 'H': 108, 'I': 109, 'J': 110,
                'K': 111, 'L': 112, 'M': 113, 'N': 114, 'O': 115,
                'P': 116, 'Q': 117, 'R': 118, 'S': 119, 'T': 120
              };
              return tempTeethMap[toothNum];
            } else if (typeof toothNum === 'number' || (typeof toothNum === 'string' && /^\d+$/.test(toothNum))) {
              return parseInt(toothNum); // Keep permanent teeth as 1-32
            }
            return 1; // Default fallback
          })(),
          diagnosis: values.treatment_plan,
          notes: (() => {
            if (editingTreatment) {
              // When editing, preserve existing appointment reference and add user notes
              const existingNotes = editingTreatment.notes || '';
              const existingAppointmentRef = existingNotes.match(/<!--APPOINTMENT_REF:[^>]*-->/);
              const userNotes = values.notes || '';
              return existingAppointmentRef ? `${userNotes}${existingAppointmentRef[0]}` : userNotes;
            } else {
              // When creating new, add appointment reference if from appointment
              const appointmentNote = selectedAppointmentForTreatment ? 
                `<!--APPOINTMENT_REF:${selectedAppointmentForTreatment.id}:${selectedAppointmentForTreatment.branch}:${selectedAppointmentForTreatment.appointment_time}-->` : '';
              return values.notes ? `${values.notes}${appointmentNote}` : appointmentNote;
            }
          })(),
          treatment_date: values.treatment_date instanceof Date 
            ? values.treatment_date.toISOString().split('T')[0] 
            : values.treatment_date
        };
      } else {
        // Single procedure mode: standard record or multiple teeth
        
        // Check if multiple teeth are selected
        if (selectedTeethInChart.length > 1 && !editingTreatment) {
          // Create multiple treatments for multiple teeth
          console.log('=== CREATING MULTIPLE TREATMENTS FOR MULTIPLE TEETH ===');
          console.log('Selected teeth:', selectedTeethInChart);
          
          const treatmentPromises = selectedTeethInChart.map(async (toothNumber) => {
            const singleTreatmentData = {
              patient_id: patientId,
              doctor_id: user.id,
              procedure: values.procedure,
              tooth_number: (() => {
                // Handle temporary teeth by mapping letters to numbers (100+ range)
                if (typeof toothNumber === 'string' && /^[A-T]$/.test(toothNumber)) {
                  const tempTeethMap = {
                    'A': 101, 'B': 102, 'C': 103, 'D': 104, 'E': 105,
                    'F': 106, 'G': 107, 'H': 108, 'I': 109, 'J': 110,
                    'K': 111, 'L': 112, 'M': 113, 'N': 114, 'O': 115,
                    'P': 116, 'Q': 117, 'R': 118, 'S': 119, 'T': 120
                  };
                  return tempTeethMap[toothNumber];
                }
                return parseInt(toothNumber); // Keep permanent teeth as 1-32
              })(),
              diagnosis: values.treatment_plan,
              notes: (() => {
                const appointmentNote = selectedAppointmentForTreatment ? 
                  `<!--APPOINTMENT_REF:${selectedAppointmentForTreatment.id}:${selectedAppointmentForTreatment.branch}:${selectedAppointmentForTreatment.appointment_time}-->` : '';
                return values.notes ? `${values.notes}${appointmentNote}` : appointmentNote;
              })(),
              treatment_date: values.treatment_date instanceof Date 
                ? values.treatment_date.toISOString().split('T')[0] 
                : values.treatment_date
            };
            
            console.log(`Creating treatment for tooth #${toothNumber}:`, singleTreatmentData);
            
            const { data, error } = await supabase
              .from('treatments')
              .insert([singleTreatmentData])
              .select();
              
            if (error) {
              console.error(`Error creating treatment for tooth ${toothNumber}:`, error);
              throw error;
            }
            
            return data[0];
          });
          
          // Wait for all treatments to be created
          const createdTreatments = await Promise.all(treatmentPromises);
          console.log('All treatments created successfully:', createdTreatments);
          
          // Log audit events for each treatment
          for (const treatment of createdTreatments) {
            try {
              await logTreatmentCreate(treatment.id, {
                treatment_id: treatment.id,
                patient_id: patientId,
                patient_name: patient?.full_name,
                doctor_id: user.id,
                procedure: treatment.procedure,
                tooth_number: treatment.tooth_number,
                diagnosis: treatment.diagnosis,
                notes: treatment.notes,
                treatment_date: treatment.treatment_date
              });
            } catch (auditError) {
              console.warn(`Failed to log audit for treatment ${treatment.id}:`, auditError);
            }
            
            // Update dental chart for each tooth
            try {
              await updateDentalChartWithTreatment(treatment.tooth_number, treatment.procedure);
            } catch (chartError) {
              console.warn(`Failed to update dental chart for tooth ${treatment.tooth_number}:`, chartError);
            }
          }
          
          toast.success(`${createdTreatments.length} treatment records created successfully for teeth: ${selectedTeethInChart.sort((a, b) => a - b).join(', ')}`);
          
          // Reset form and refresh data
          resetForm();
          setShowTreatmentForm(false);
          setEditingTreatment(null);
          setSelectedAppointmentForTreatment(null);
          setAvailableProcedures([]);
          setSelectedTeethInChart([]);
          setSelectedToothInChart(null);
          
          fetchTreatmentHistory();
          fetchCompletedAppointments();
          fetchDentalChart();
          
          return; // Exit early since we've handled everything
        }
        
        // Single tooth treatment (original logic)
        treatmentData = {
        patient_id: patientId,
        doctor_id: user.id,
        procedure: values.procedure,
        tooth_number: (() => {
          // Handle temporary teeth by mapping letters to numbers (100+ range)
          const toothNum = values.tooth_number;
          if (typeof toothNum === 'string' && /^[A-T]$/.test(toothNum)) {
            // Map temporary teeth letters to numbers in 100+ range
            const tempTeethMap = {
              'A': 101, 'B': 102, 'C': 103, 'D': 104, 'E': 105,
              'F': 106, 'G': 107, 'H': 108, 'I': 109, 'J': 110,
              'K': 111, 'L': 112, 'M': 113, 'N': 114, 'O': 115,
              'P': 116, 'Q': 117, 'R': 118, 'S': 119, 'T': 120
            };
            return tempTeethMap[toothNum];
          } else if (typeof toothNum === 'number' || (typeof toothNum === 'string' && /^\d+$/.test(toothNum))) {
            return parseInt(toothNum); // Keep permanent teeth as 1-32
          }
          return toothNum; // Fallback
        })(),
          diagnosis: values.treatment_plan,
          notes: (() => {
            if (editingTreatment) {
              // When editing, preserve existing appointment reference and add user notes
              const existingNotes = editingTreatment.notes || '';
              const existingAppointmentRef = existingNotes.match(/<!--APPOINTMENT_REF:[^>]*-->/);
              const userNotes = values.notes || '';
              return existingAppointmentRef ? `${userNotes}${existingAppointmentRef[0]}` : userNotes;
            } else {
              // When creating new, add appointment reference if from appointment
              const appointmentNote = selectedAppointmentForTreatment ? 
                `<!--APPOINTMENT_REF:${selectedAppointmentForTreatment.id}:${selectedAppointmentForTreatment.branch}:${selectedAppointmentForTreatment.appointment_time}-->` : '';
              return values.notes ? `${values.notes}${appointmentNote}` : appointmentNote;
            }
          })(),
        treatment_date: values.treatment_date instanceof Date 
          ? values.treatment_date.toISOString().split('T')[0] 
          : values.treatment_date
      };
      }
      
      console.log('=== TREATMENT DATA PREPARED ===');
      console.log('Treatment data to save:', treatmentData);
      console.log('Treatment data type:', typeof treatmentData);
      console.log('Treatment data keys:', Object.keys(treatmentData));

      if (editingTreatment) {
        console.log('=== EDITING EXISTING TREATMENT ===');
        console.log('Editing treatment ID:', editingTreatment.id);
        console.log('Updating existing treatment:', editingTreatment.id);
        const { error } = await supabase
          .from('treatments')
          .update(treatmentData)
          .eq('id', editingTreatment.id);
        
        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        
        // Log audit event for treatment update
        try {
          await logTreatmentUpdate(editingTreatment.id, {
            treatment_id: editingTreatment.id,
            patient_id: patientId,
            patient_name: patient?.full_name,
            doctor_id: user.id,
            procedure: treatmentData.procedure,
            tooth_number: treatmentData.tooth_number,
            diagnosis: treatmentData.diagnosis,
            notes: treatmentData.notes,
            treatment_date: treatmentData.treatment_date
          });
        } catch (auditError) {
          console.error('Error logging treatment update audit event:', auditError);
          // Continue even if audit logging fails
        }
        
        toast.success('Treatment record updated successfully');
      } else {
        console.log('=== CREATING NEW TREATMENT ===');
        // Handle multiple procedures from appointment
        const proceduresToProcess = selectedAppointmentForTreatment && availableProcedures.length > 1 
          ? availableProcedures 
          : [values.procedure];
        
        console.log('=== PROCEDURE PROCESSING FOR INSERT ===');
        console.log('selectedAppointmentForTreatment:', selectedAppointmentForTreatment);
        console.log('availableProcedures:', availableProcedures);
        console.log('availableProcedures.length:', availableProcedures.length);
        console.log('values.procedure:', values.procedure);
        console.log('proceduresToProcess:', proceduresToProcess);
        
        console.log('Inserting treatments for procedures:', proceduresToProcess);
        
        const treatmentsToInsert = proceduresToProcess.map(procedure => ({
          ...treatmentData,
          procedure: procedure
        }));
        
        console.log('=== DATABASE INSERT OPERATION ===');
        console.log('treatmentsToInsert:', treatmentsToInsert);
        console.log('treatmentsToInsert length:', treatmentsToInsert.length);
        
        const { data, error } = await supabase
          .from('treatments')
          .insert(treatmentsToInsert)
          .select();
        
        console.log('=== DATABASE INSERT RESULT ===');
        console.log('Insert result data:', data);
        console.log('Insert result error:', error);
        
        if (error) {
          console.error('Insert error:', error);
          console.error('Insert error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          throw error;
        }
        console.log('Treatments inserted successfully:', data);
        
        // Log audit event for treatment creation
        try {
          for (const treatment of data) {
            await logTreatmentCreate({
              treatment_id: treatment.id,
              patient_id: patientId,
              patient_name: patient?.full_name,
              doctor_id: user.id,
              procedure: treatment.procedure,
              tooth_number: treatment.tooth_number,
              diagnosis: treatment.diagnosis,
              notes: treatment.notes,
              treatment_date: treatment.treatment_date
            });
          }
        } catch (auditError) {
          console.error('Error logging treatment creation audit event:', auditError);
          // Continue even if audit logging fails
        }
        
        if (proceduresToProcess.length > 1) {
          toast.success(`${proceduresToProcess.length} treatment records added successfully`);
        } else {
        toast.success('Treatment record added successfully');
        }
      }

      // Auto-update dental chart with treatment symbol
      try {
        await updateDentalChartWithTreatment(values.tooth_number, values.procedure);
        console.log('Dental chart updated successfully');
      } catch (chartError) {
        console.error('Error updating dental chart:', chartError);
        // Don't fail the whole operation if dental chart update fails
        toast.warning('Treatment saved but dental chart update failed');
      }

      resetForm();
      setShowTreatmentForm(false);
      setEditingTreatment(null);
      setSelectedAppointmentForTreatment(null);
      setAvailableProcedures([]);
      setIsMultiProcedureMode(false);
      setProcedureDetails([]);
      // Clear multi-teeth selection when form is completed
      if (!editingTreatment) {
        setSelectedTeethInChart([]);
        setSelectedToothInChart(null);
      }
      fetchTreatmentHistory();
      fetchCompletedAppointments(); // Refresh completed appointments to hide used ones
      fetchDentalChart(); // Refresh dental chart to show new treatment
    } catch (error) {
      console.log('=== ERROR CAUGHT ===');
      console.error('Error saving treatment:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        values: values,
        isMultiProcedureMode,
        procedureDetails: values.procedureDetails,
        editingTreatment: editingTreatment,
        selectedAppointmentForTreatment: selectedAppointmentForTreatment,
        availableProcedures: availableProcedures
      });
      console.error('Full error object:', error);
      toast.error(`Failed to save treatment record: ${error.message || error}`);
    } finally {
      console.log('=== FORM SUBMISSION COMPLETE ===');
      setIsSubmittingTreatment(false);
    }
  };

  // Auto-update dental chart when treatment is added
  const updateDentalChartWithTreatment = async (toothNumber, procedure) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Determine dental chart symbol based on procedure
      let symbol = '';
      const procedureLower = procedure.toLowerCase();
      
      if (procedureLower.includes('filling') || procedureLower.includes('restoration')) {
        symbol = 'E'; // Filled tooth for caries
      } else if (procedureLower.includes('extraction')) {
        symbol = 'B'; // Missing due to caries (or L for other causes)
      } else if (procedureLower.includes('crown')) {
        symbol = 'J'; // Full Crown Prosthetic
      } else if (procedureLower.includes('root canal')) {
        symbol = 'E'; // Treated tooth
      } else if (procedureLower.includes('cleaning')) {
        // No specific symbol for cleaning, skip chart update
        return;
      }

      if (symbol) {
        // Get current dental chart or create new one
        let currentChart = dentalChart?.chart_data || {};
        
        // Update tooth with treatment symbol
        const updatedChart = {
          ...currentChart,
          teeth: {
            ...currentChart.teeth,
            [toothNumber]: {
              ...currentChart.teeth?.[toothNumber],
              symbol: symbol,
              treatment_date: new Date().toISOString().split('T')[0],
              procedure: procedure
            }
          }
        };

        // Upsert dental chart
        const chartData = {
          patient_id: patientId,
          chart_data: updatedChart,
          created_by: user.id,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('dental_charts')
          .upsert(chartData, {
            onConflict: 'patient_id'
          });

        if (error) {
          console.error('Error updating dental chart:', error);
        } else {
          toast.success(`Dental chart updated for tooth #${toothNumber}`);
        }
      }
    } catch (error) {
      console.error('Error updating dental chart with treatment:', error);
    }
  };

  const handleDeleteTreatment = async (treatmentId) => {
    try {
      const { error } = await supabase
        .from('treatments')
        .delete()
        .eq('id', treatmentId);

      if (error) throw error;

      toast.success('Treatment record deleted successfully');
      fetchTreatmentHistory();
      fetchCompletedAppointments(); // Refresh completed appointments to show previously hidden ones
    } catch (error) {
      console.error('Error deleting treatment:', error);
      toast.error('Failed to delete treatment record');
    }
  };

  const handleDeleteClick = (treatment) => {
    setTreatmentToDelete(treatment);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (treatmentToDelete) {
      handleDeleteTreatment(treatmentToDelete.id);
      setShowDeleteModal(false);
      setTreatmentToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setTreatmentToDelete(null);
  };

  const handleToothClick = (toothNumber) => {
    console.log('handleToothClick called with:', toothNumber);
    console.log('selectedTeethInChart:', selectedTeethInChart);
    
    // Handle special actions from dental chart
    if (toothNumber === 'add-treatment') {
      console.log('Add treatment clicked, selectedTeethInChart.length:', selectedTeethInChart.length);
      if (selectedTeethInChart.length === 0) {
        toast.error('Please select at least one tooth before adding treatment');
        return;
      }
      // Start treatment form with selected teeth
      console.log('Opening treatment form with teeth:', selectedTeethInChart);
      setShowTreatmentForm(true);
      setEditingTreatment(null);
      setSelectedAppointmentForTreatment(null);
      setAvailableProcedures([]);
      setIsMultiProcedureMode(false);
      setProcedureDetails([]);
      
      // Scroll to treatment form after a short delay to ensure it's rendered
      setTimeout(() => {
        const treatmentFormElement = document.getElementById('treatment-form');
        if (treatmentFormElement) {
          treatmentFormElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 100);
      return;
    }
    
    if (toothNumber === 'clear-all') {
      setSelectedTeethInChart([]);
      setSelectedToothInChart(null);
      return;
    }
    
    // For single selection (legacy support when editing existing treatments)
    if (editingTreatment) {
      setSelectedToothInChart(toothNumber === selectedToothInChart ? null : toothNumber);
      return;
    }
    
    // For multi-selection (new functionality)
    setSelectedTeethInChart(prev => {
      // Convert toothNumber to string for consistent comparison
      const toothStr = String(toothNumber);
      const prevStr = prev.map(t => String(t));
      
      if (prevStr.includes(toothStr)) {
        // Remove tooth if already selected
        const newSelection = prev.filter(t => String(t) !== toothStr);
        // Update single selection for backward compatibility
        setSelectedToothInChart(newSelection.length > 0 ? newSelection[0] : null);
        return newSelection;
      } else {
        // Add tooth to selection
        const newSelection = [...prev, toothNumber];
        // Update single selection for backward compatibility
        setSelectedToothInChart(toothNumber);
        return newSelection;
      }
    });
  };

  // Start treatment creation from dental chart tooth selection
  const startTreatmentFromTooth = (toothNumber) => {
    setSelectedToothInChart(toothNumber);
    setSelectedTeethInChart([toothNumber]); // Initialize multi-selection with single tooth
    setSelectedAppointmentForTreatment(null);
    setAvailableProcedures([]);
    setEditingTreatment(null);
    setShowTreatmentForm(true);
    
    // Scroll to treatment form
    setTimeout(() => {
      const treatmentForm = document.querySelector('#treatment-form');
      if (treatmentForm) {
        treatmentForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Handle appointment selection for treatment creation
  const handleAppointmentSelection = (appointment) => {
    setSelectedAppointmentForTreatment(appointment);
    
    // Extract procedures from appointment services
    const procedures = appointment.services.map(service => service.name);
    setAvailableProcedures(procedures);
    
    // Set up multi-procedure mode if there are multiple procedures
    if (procedures.length > 1) {
      setIsMultiProcedureMode(true);
      // Initialize procedure details with default tooth numbers
      const details = procedures.map((procedure, index) => ({
        procedure: procedure,
        tooth_number: 1, // Default tooth number
        index: index
      }));
      setProcedureDetails(details);
    } else {
      setIsMultiProcedureMode(false);
      setProcedureDetails([]);
    }
  };

  // Start treatment creation from specific appointment
  const startTreatmentFromAppointment = async (appointment) => {
    handleAppointmentSelection(appointment);
    
    // Always open the form for manual editing, even with multiple procedures
    setEditingTreatment(null);
    setShowTreatmentForm(true);
  };

  // Auto-create multiple treatments for appointment with multiple procedures
  const autoCreateMultipleTreatments = async (appointment) => {
    setIsAutoCreatingTreatments(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Authentication error');
      }

      const procedures = appointment.services.map(service => service.name);
      const treatmentDate = new Date(appointment.appointment_date);
      
      // Create a single combined treatment record with multiple procedures
      const combinedTreatmentData = {
        patient_id: patientId,
        doctor_id: user.id,
        procedure: procedures.join(', '), // Combine all procedures with comma separation
        tooth_number: 1, // Default tooth number, user can edit later
        diagnosis: '', // Let user fill this manually
        notes: `<!--APPOINTMENT_REF:${appointment.id}:${appointment.branch}:${appointment.appointment_time}-->`, // Hidden appointment reference
        treatment_date: treatmentDate.toISOString().split('T')[0]
        // Note: Removed procedure_details field as it may not exist in database schema
      };

      const { data, error } = await supabase
        .from('treatments')
        .insert([combinedTreatmentData])
        .select();

      if (error) {
        console.error('Error creating combined treatment:', error);
        throw error;
      }

      toast.success(`Combined treatment record created with ${procedures.length} procedures from appointment`);
      
      // Refresh data
      fetchTreatmentHistory();
      fetchCompletedAppointments();
      fetchDentalChart();
      
      // Close form since treatment is already created
      setShowTreatmentForm(false);
      setSelectedAppointmentForTreatment(null);
      setAvailableProcedures([]);
      
    } catch (error) {
      console.error('Error auto-creating combined treatment:', error);
      toast.error(`Failed to create combined treatment: ${error.message}`);
      
      // Fallback to manual form if auto-creation fails
      setEditingTreatment(null);
      setShowTreatmentForm(true);
    } finally {
      setIsAutoCreatingTreatments(false);
    }
  };

  // Start treatment creation without specific appointment
  const startGeneralTreatment = () => {
    setSelectedAppointmentForTreatment(null);
    setAvailableProcedures([]);
    setEditingTreatment(null);
    setSelectedToothInChart(null);
    setSelectedTeethInChart([]); // Clear multi-selection
    setShowTreatmentForm(true);
  };

  // Test database access
  const testDatabaseAccess = async () => {
    try {
      console.log('Testing database access...');
      const { data, error } = await supabase
        .from('treatments')
        .select('count(*)')
        .eq('patient_id', patientId);
      
      if (error) {
        console.error('Database access test failed:', error);
        toast.error(`Database access error: ${error.message}`);
      } else {
        console.log('Database access test successful:', data);
        toast.success('Database connection is working');
      }
    } catch (error) {
      console.error('Database test error:', error);
      toast.error(`Database test error: ${error.message}`);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set';
    try {
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return new Date(dateStr).toLocaleDateString('en-US', options);
    } catch (e) {
      return dateStr || 'Not set';
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return 'Not set';
    try {
      // Handle both HH:mm and HH:mm:ss formats
      const timeParts = timeStr.split(':');
      const hours = parseInt(timeParts[0]);
      const minutes = timeParts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes} ${ampm}`;
    } catch (e) {
      return timeStr || 'Not set';
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
    else return (bytes / 1073741824).toFixed(2) + ' GB';
  };

  const calculateAge = (birthday) => {
    if (!birthday) return '';
    try {
      const today = new Date();
      const birthDate = new Date(birthday);
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch (e) {
      return '';
    }
  };

  // Generate and print treatment history report (simplified format like staff/patient sides)
  const printTreatmentHistory = () => {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups for this site.');
      return;
    }

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Get treatments to print (use filtered treatments)
    const treatmentsToPrint = filteredTreatments.length > 0 ? filteredTreatments : treatments;

    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Treatment History - ${patient.full_name}</title>
        <style>
          body{font-family:Arial,sans-serif;margin:0;padding:12px;font-size:12px;line-height:1.4;color:#000}
          .header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:16px}
          .clinic{display:flex;align-items:center;gap:12px}
          .clinic img{height:36px;width:auto}
          .clinic-name{font-weight:700;font-size:16px}
          .meta{font-size:12px;color:#555}
          .submeta{font-size:11px;color:#666}
          .title{text-align:center;font-weight:700;margin:12px 0 16px 0}
          .card{border:1px solid #ddd;border-radius:6px;overflow:hidden;margin-bottom:16px}
          .card .card-h{background:#f7f7fb;padding:10px 12px;font-weight:700;font-size:13px;border-bottom:1px solid #e5e7eb}
          .card .card-b{padding:8px 12px}
          .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px}
          .row{display:flex;border-bottom:1px solid #f3f4f6;padding:4px 0;line-height:1.2}
          .label{width:128px;font-weight:600;font-size:12px;color:#333}
          .value{flex:1;font-size:12px}
          table{width:100%;border-collapse:collapse}
          thead th{background:#f3f4f6;border:1px solid #e5e7eb;font-size:12px;padding:8px;text-align:left}
          tbody td{border:1px solid #e5e7eb;font-size:12px;padding:8px;vertical-align:top}
          td.doctor{white-space:nowrap}
          tfoot td{font-size:11px;color:#555;padding:6px}
          .right{text-align:right}
          @media print{body{padding:12px}}
        </style>
      </head>
      <body>
        <div class="header">
          <div class="clinic">
            <div class="clinic-name">SILARIO DENTAL CLINIC</div>
            <div>
              <div class="submeta">Cabugao/San Juan, Ilocos Sur • silariodentalclinic@gmail.com</div>
              <div class="meta">Elaine Mae Frando Silario, D.M.D</div>
            </div>
          </div>
          <div class="meta">
            <div>Date: ${currentDate}</div>
            <div>Patient: ${patient?.full_name || ''}</div>
          </div>
        </div>

        <div class="title">Dental Treatment History Record</div>

        <div class="card">
          <div class="card-h">Patient Information</div>
          <div class="card-b">
            <div class="grid">
              <div class="row"><div class="label">Name</div><div class="value">${patient?.full_name || ''}</div></div>
              <div class="row"><div class="label">Age</div><div class="value">${calculateAge(patient?.birthday)}</div></div>
              <div class="row"><div class="label">Address</div><div class="value">${patient?.address || ''}</div></div>
              <div class="row"><div class="label">Sex</div><div class="value">${patient?.gender ? patient.gender[0].toUpperCase()+patient.gender.slice(1) : ''}</div></div>
              <div class="row"><div class="label">Birthdate</div><div class="value">${formatDate(patient?.birthday)}</div></div>
              <div class="row"><div class="label">Date</div><div class="value">${formatDate(new Date())}</div></div>
              <div class="row"><div class="label">Nationality</div><div class="value">${patient?.nationality || ''}</div></div>
              <div class="row"><div class="label">Home No.</div><div class="value">${patient?.phone || ''}</div></div>
              <div class="row"><div class="label">Home Address</div><div class="value">${patient?.address || ''}</div></div>
              <div class="row"><div class="label">Office No.</div><div class="value">${patient?.office_phone || ''}</div></div>
              <div class="row"><div class="label">Occupation</div><div class="value">${patient?.occupation || ''}</div></div>
              <div class="row"><div class="label">Cell/Mobile</div><div class="value">${patient?.mobile || patient?.phone || ''}</div></div>
              <div class="row"><div class="label">Patient ID</div><div class="value">${patient?.id ? patient.id.substring(0,8) : ''}</div></div>
              <div class="row"><div class="label">Email</div><div class="value">${patient?.email || ''}</div></div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-h">Treatment History Summary (${treatmentsToPrint.length} Records)</div>
          <div class="card-b">
            <table>
              <thead>
                <tr>
                  <th style="width:14%">Date</th>
                  <th style="width:24%">Procedure</th>
                  <th style="width:8%">Tooth #</th>
                  <th style="width:22%">Treatment Plan</th>
                  <th style="width:22%">Notes</th>
                  <th style="width:14%">Doctor</th>
                </tr>
              </thead>
              <tbody>
                ${treatmentsToPrint.length === 0 ? `
                  <tr>
                    <td colspan="6" style="text-align: center; padding: 30px; font-style: italic;">
                      No treatment records found for this patient performed by the logged-in doctor.
                    </td>
                  </tr>
                ` : treatmentsToPrint.map(treatment => `
                  <tr>
                    <td>${formatDate(treatment.treatment_date)}</td>
                    <td><strong>${treatment.procedure || ''}</strong></td>
                    <td class="right">${convertToothNumberForDisplay(treatment.tooth_number) || '-'}</td>
                    <td>${treatment.diagnosis || '-'}</td>
                    <td>${treatment.notes && cleanNotesForDisplay(treatment.notes) ? cleanNotesForDisplay(treatment.notes) : '-'}</td>
                    <td class="doctor">Dr. ${treatment.doctor?.full_name || 'Unknown'}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr><td colspan="6">Generated on ${currentDate}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>
      </body>
      </html>
    `;

    reportWindow.document.write(reportHTML);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
    reportWindow.close();
  };

  // File handling functions
  const handleViewFile = (file) => {
    if (!file || !file.file_url) {
      toast.error('File information is missing or incomplete');
      return;
    }
    setFilePreview(file);
  };

  const handlePrintFile = (file) => {
    if (!file || !file.file_url) {
      toast.error('File information is missing or incomplete');
      return;
    }

    const toastId = toast.info('Preparing to print...', { autoClose: false });
    
    try {
      if (printWindow && !printWindow.closed) {
        printWindow.close();
      }

      const isPdf = file.file_type && file.file_type.includes('pdf');
      const isImage = file.file_type && file.file_type.includes('image');
      
      const newWindow = window.open('', '_blank');
      
      if (!newWindow) {
        toast.update(toastId, {
          render: 'Pop-up blocked. Please allow pop-ups for this site.',
          type: toast.TYPE.ERROR,
          autoClose: 5000
        });
        return;
      }
      
      setPrintWindow(newWindow);
      
      if (isImage) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Print: ${file.file_name}</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
              img { max-width: 100%; max-height: 100vh; object-fit: contain; }
              @media print {
                body { height: auto; }
                img { max-height: 100%; }
              }
            </style>
          </head>
          <body>
            <img src="${file.file_url}" alt="${file.file_name}" onload="window.print(); window.addEventListener('afterprint', function() { window.setTimeout(function() { window.close(); }, 1000); });">
          </body>
          </html>
        `);
        newWindow.document.close();
      } else if (isPdf) {
        newWindow.location.href = file.file_url;
        newWindow.addEventListener('load', function() {
          setTimeout(() => {
            if (!newWindow.closed) {
              newWindow.print();
            }
          }, 2000);
        });
      } else {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Download: ${file.file_name}</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; line-height: 1.6; }
              .container { max-width: 600px; margin: 0 auto; }
              .icon { font-size: 48px; margin-bottom: 20px; color: #4F46E5; }
              .btn { display: inline-block; background: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">📄</div>
              <h2>${file.file_name}</h2>
              <p>This file type cannot be printed directly. Please download the file first.</p>
              <a href="${file.file_url}" download="${file.file_name}" class="btn">Download File</a>
            </div>
          </body>
          </html>
        `);
        newWindow.document.close();
      }
      
      toast.update(toastId, {
        render: 'Print dialog prepared',
        type: toast.TYPE.SUCCESS,
        autoClose: 3000
      });
    } catch (error) {
      console.error('Error printing file:', error);
      toast.update(toastId, {
        render: 'Failed to print: ' + error.message,
        type: toast.TYPE.ERROR,
        autoClose: 5000
      });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsFileUploading(true);
    const toastId = toast.info('Uploading file...', { autoClose: false });
    
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${patientId}/${fileName}`;
      
      let fileUrl = null;
      
      try {
        const { error: uploadError, data } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, file);
        
        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          throw uploadError;
        }
        
        const { data: urlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);
        
        fileUrl = urlData?.publicUrl;
        
        if (!fileUrl) {
          throw new Error('Could not generate public URL for file');
        }
      } catch (storageError) {
        console.error('Storage error details:', storageError);
        fileUrl = `${window.location.origin}/storage/${BUCKET_NAME}/${filePath}`;
        toast.update(toastId, {
          render: 'Storage system unreachable. File record will be created but may not be accessible.',
          type: toast.TYPE.WARNING,
          autoClose: 5000
        });
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      const doctorId = user?.id;
      
      const { data: fileData, error: recordError } = await supabase
        .from('patient_files')
        .insert([
          {
            patient_id: patientId,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            file_path: filePath,
            file_url: fileUrl,
            uploaded_at: new Date().toISOString(),
            uploaded_by: doctorId || null,
          }
        ])
        .select();
      
      if (recordError) throw recordError;
      
      toast.update(toastId, {
        render: 'File uploaded successfully',
        type: toast.TYPE.SUCCESS,
        autoClose: 3000
      });
      
      if (fileData && fileData.length > 0) {
        const newFile = {
          ...fileData[0],
          isPatientUploaded: false,
          displayDate: formatDate(fileData[0].uploaded_at),
          uploaderType: 'staff'
        };
        setUploadedFiles(currentFiles => [newFile, ...currentFiles]);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.update(toastId, {
        render: `Failed to upload file: ${error.message}`,
        type: toast.TYPE.ERROR,
        autoClose: 5000
      });
    } finally {
      setIsFileUploading(false);
      e.target.value = null;
    }
  };

  const handleDeleteFile = (file) => {
    setFileToDelete(file);
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    
    setIsFileDeleting(true);
    const toastId = toast.info('Deleting file...', { autoClose: false });
    
    try {
      try {
        const { error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([fileToDelete.file_path]);
        
        if (storageError) {
          console.warn('Storage error:', storageError);
        }
      } catch (storageError) {
        console.warn('Failed to delete from storage:', storageError);
      }
      
      const { error: dbError } = await supabase
        .from('patient_files')
        .delete()
        .eq('id', fileToDelete.id);
      
      if (dbError) throw dbError;
      
      toast.update(toastId, {
        render: 'File deleted successfully',
        type: toast.TYPE.SUCCESS,
        autoClose: 3000
      });
      
      setUploadedFiles(currentFiles => 
        currentFiles.filter(f => f.id !== fileToDelete.id)
      );
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.update(toastId, {
        render: `Failed to delete file: ${error.message}`,
        type: toast.TYPE.ERROR,
        autoClose: 5000
      });
    } finally {
      setIsFileDeleting(false);
      setFileToDelete(null);
    }
  };

  const cancelDeleteFile = () => {
    setFileToDelete(null);
  };

  const closeFilePreview = () => {
    setFilePreview(null);
  };

  // Render tooth in dental chart with symbols
  // Helper function to get dental condition colors - ensures consistency between legend and teeth
  const getDentalConditionColors = (symbolData) => {
    if (!symbolData) return null;
    
    return {
      backgroundColor: symbolData.bgColor || `${symbolData.color}20`,
      borderColor: symbolData.borderColor || symbolData.color,
      textColor: symbolData.color
    };
  };

  const renderTooth = (toothNumber) => {
    const hasHistory = treatments.some(t => t.tooth_number === toothNumber);
    const isSelected = selectedToothInChart === toothNumber;
    const isMultiSelected = selectedTeethInChart.includes(toothNumber);
    const toothSymbol = dentalChart?.chart_data?.teeth?.[toothNumber]?.symbol || '';
    
    // Get symbol data for color coding
    const symbolData = toothSymbol ? enhancedChartSymbols[toothSymbol] : null;
    const conditionColors = getDentalConditionColors(symbolData);
    
    let toothClass = "tooth cursor-pointer transition-all duration-200 relative";
    let borderClass = "border border-gray-300";
    let customStyle = {};
    
    // Priority-based coloring logic with enhanced color coding
    if (isMultiSelected) {
      // Multi-selected teeth (highest priority for selection)
      if (conditionColors) {
        // Multi-selected tooth with dental condition
        customStyle = {
          backgroundColor: '#dbeafe',
          borderColor: '#3b82f6',
          borderWidth: '3px',
          backgroundImage: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
          boxShadow: '0 0 0 2px #3b82f6 inset'
        };
      } else if (hasHistory) {
        toothClass += " bg-blue-300 hover:bg-blue-400";
        borderClass = "border-2 border-blue-600";
      } else {
        toothClass += " bg-blue-200 hover:bg-blue-300";
        borderClass = "border-2 border-blue-500";
      }
    } else if (isSelected) {
      // Single selected tooth
      if (conditionColors) {
        // Selected tooth with dental condition
        customStyle = {
          backgroundColor: '#e0e7ff',
          borderColor: '#6366f1',
          borderWidth: '3px',
          backgroundImage: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
          boxShadow: '0 0 0 2px #6366f1 inset'
        };
      } else if (hasHistory) {
        toothClass += " bg-indigo-300 hover:bg-indigo-400";
        borderClass = "border-2 border-indigo-600";
      } else {
        toothClass += " bg-primary-200 hover:bg-primary-300";
        borderClass = "border-2 border-primary-500";
      }
    } else if (conditionColors) {
      // Teeth with dental chart symbols (conditions/issues) - use color-coded styling
      customStyle = {
        backgroundColor: conditionColors.backgroundColor,
        borderColor: conditionColors.borderColor,
        borderWidth: '2px',
        backgroundImage: `linear-gradient(135deg, transparent, ${conditionColors.textColor}10)`,
        boxShadow: `0 0 0 1px ${conditionColors.textColor}20 inset`
      };
    } else if (hasHistory) {
      // Teeth with treatment history (important to show clearly)
      toothClass += " bg-green-100 hover:bg-green-200";
      borderClass = "border border-green-300";
    } else {
      // Default healthy teeth
      toothClass += " bg-white hover:bg-gray-100";
    }
    
    return (
      <div 
        key={toothNumber}
        className={`${toothClass} ${borderClass} w-12 h-14 rounded flex flex-col items-center justify-center text-xs font-medium m-1 shadow-sm`}
        style={customStyle}
        onClick={() => handleToothClick(toothNumber)}
        title={`Tooth ${toothNumber}${toothSymbol ? ` - ${enhancedChartSymbols[toothSymbol]?.name || chartSymbols[toothSymbol] || toothSymbol}` : ''}${hasHistory ? ' - Has treatment history' : ''} - Click to ${editingTreatment ? 'select' : 'add to selection'}`}
      >
        {/* Dental Chart Symbol */}
        {toothSymbol && (
          <div 
            className="font-bold text-sm absolute top-0 drop-shadow-sm"
            style={{
              color: conditionColors?.textColor || '#dc2626',
              textShadow: '0 0 2px rgba(255,255,255,0.8)',
              fontWeight: '900'
            }}
          >
            {toothSymbol}
          </div>
        )}
        
        {/* Tooth Number */}
        <div className={`text-xs font-bold mt-2 ${isMultiSelected || isSelected ? 'text-gray-800' : 'text-gray-700'}`}>
          {toothNumber}
        </div>
        
        {/* Treatment History Indicator */}
        {hasHistory && (
          <div className="w-2 h-2 bg-green-600 rounded-full absolute bottom-0 right-0 transform translate-x-1 translate-y-1"></div>
        )}
        
        {/* Multi-Selection Indicator */}
        {isMultiSelected && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
          </div>
        )}
        
        {/* Single Selection Indicator */}
        {isSelected && !isMultiSelected && (
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-primary-500 rounded-full border-2 border-white"></div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!patient && patientId) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Patient not found</h3>
          <p className="mt-1 text-sm text-gray-500">
            The patient you're looking for could not be found.
          </p>
          <div className="mt-3">
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              onClick={() => navigate(-1)}
            >
              <FiArrowLeft className="mr-2 -ml-1 h-5 w-5" aria-hidden="true" />
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Helper functions for pagination and filtering
  const getCurrentPageTreatments = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredTreatments.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(filteredTreatments.length / itemsPerPage);
  };

  const getUniqueProcedures = () => {
    // Use services from database instead of existing treatments
    return services.map(service => service.name).sort();
  };

  const getUniqueToothNumbers = () => {
    // Generate tooth numbers 1-32
    return Array.from({ length: 32 }, (_, i) => i + 1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setProcedureFilter('');
    setToothFilter('');
    setDateRangeFilter({ startDate: '', endDate: '' });
    setCurrentPage(1);
  };


  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <button
          type="button"
          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-primary-700 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          onClick={() => navigate(-1)}
        >
          <FiArrowLeft className="mr-1 -ml-1 h-4 w-4" />
          Back
        </button>
      </div>

      {/* Patient Information Card */}
      {patient && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg shadow-lg overflow-hidden border-2 border-blue-200">
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 shadow-md">
                  {patient.profile_picture_url ? (
                    <img
                      src={`${patient.profile_picture_url}?t=${Date.now()}`}
                      alt={patient.full_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full flex items-center justify-center ${
                    patient.profile_picture_url ? 'hidden' : ''
                  } bg-blue-500 text-white font-bold text-xl`}>
                    {patient.full_name?.charAt(0) || 'P'}
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{patient.full_name}</h1>
                  <p className="text-sm text-gray-600">
                    Patient ID: {patient.id && patient.id.substring(0, 8)}
                  </p>
                  <div className="flex items-center space-x-4 mt-2">
                    {patient.birthday && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <FiCalendar className="w-3 h-3 mr-1" />
                        Age: {calculateAge(patient.birthday)} years
                      </span>
                    )}
                    {patient.gender && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <FiUser className="w-3 h-3 mr-1" />
                        {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                      </span>
                    )}
                    {patient.phone && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <FiClock className="w-3 h-3 mr-1" />
                        {patient.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 md:mt-0 flex space-x-2">
                <button
                  onClick={() => navigate(`/doctor/patients/${patientId}/dental-chart`)}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    dentalChart 
                      ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                      : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                  }`}
                >
                  <FiFileText className="mr-2 -ml-1 h-5 w-5" />
                  {dentalChart ? 'View/Edit Chart' : 'Create Chart'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Dental Chart Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Interactive Dental Chart</h2>
          <button
            onClick={() => setShowDentalChart(!showDentalChart)}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            {showDentalChart ? (
              <>
                <FiX className="mr-2 -ml-1 h-4 w-4" />
                Hide Chart
              </>
            ) : (
              <>
                <FiEye className="mr-2 -ml-1 h-4 w-4" />
                View Chart
              </>
            )}
          </button>
        </div>

        {showDentalChart ? (
          <ModernDentalChart
            dentalChart={dentalChart?.chart_data || dentalChart}
            treatments={treatments}
            onToothClick={handleToothClick}
            selectedTeeth={selectedTeethInChart}
            selectedTooth={selectedToothInChart}
            role="doctor"
            editMode={true}
            chartSymbols={enhancedChartSymbols}
            patientId={patientId}
            onDentalChartUpdate={(updatedChart) => {
              setDentalChart(updatedChart);
            }}
          />
        ) : (
          <div className="p-6">
            <div className="text-center py-8">
              <FiUser className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Interactive Dental Chart</h3>
              <p className="mt-1 text-sm text-gray-500">
                Click the "View Chart" button to see an interactive dental chart with treatment history and multi-teeth selection.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Treatment History Section */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center text-white">
            <FiFileText className="h-6 w-6 mr-3" />
            <div>
              <h2 className="text-lg font-medium">Treatment History</h2>
              <p className="text-blue-100 text-sm">Comprehensive patient treatment records</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowTreatmentHistory(!showTreatmentHistory)}
              className="inline-flex items-center px-4 py-2 border border-white border-opacity-30 text-sm font-medium rounded-md text-white bg-white bg-opacity-20 hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
            >
              {showTreatmentHistory ? (
                <>
                  <FiEyeOff className="mr-2 -ml-1 h-5 w-5" />
                  Hide History
                </>
              ) : (
                <>
                  <FiEye className="mr-2 -ml-1 h-5 w-5" />
                  Show History
                </>
              )}
            </button>
            <button
              onClick={printTreatmentHistory}
              className="inline-flex items-center px-4 py-2 border border-white border-opacity-30 text-sm font-medium rounded-md text-white bg-white bg-opacity-20 hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
            >
              <FiPrinter className="mr-2 -ml-1 h-5 w-5" />
              Print History
            </button>
            <button
              onClick={startGeneralTreatment}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <FiPlus className="mr-2 -ml-1 h-5 w-5" />
              Add Treatment
            </button>
          </div>
        </div>
        
        {showTreatmentHistory && (
        <div className="p-6">
          {/* Treatment Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiFileText className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-900">Total Treatments</p>
                  <p className="text-2xl font-bold text-blue-600">{treatments.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiCalendar className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-900">Procedures</p>
                  <p className="text-2xl font-bold text-green-600">{new Set(treatments.map(t => t.procedure)).size}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiUser className="h-8 w-8 text-yellow-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-yellow-900">Teeth Treated</p>
                  <p className="text-2xl font-bold text-yellow-600">{new Set(treatments.filter(t => t.tooth_number).map(t => t.tooth_number)).size}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiClock className="h-8 w-8 text-purple-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-900">Last Visit</p>
                  <p className="text-sm font-bold text-purple-600">
                    {treatments.length > 0 ? formatDate(treatments[0].treatment_date) : 'No visits'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search Bar */}
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search Treatments
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="search"
                    placeholder="Search by procedure, diagnosis, notes, or doctor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiFileText className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:w-2/3">
                {/* Procedure Filter */}
                <div>
                  <label htmlFor="procedure-filter" className="block text-sm font-medium text-gray-700 mb-1">
                    Procedure
                  </label>
                  <select
                    id="procedure-filter"
                    value={procedureFilter}
                    onChange={(e) => setProcedureFilter(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Procedures</option>
                    {getUniqueProcedures().map(procedure => (
                      <option key={procedure} value={procedure}>{procedure}</option>
                    ))}
                  </select>
                </div>

                {/* Tooth Number Filter */}
                <div>
                  <label htmlFor="tooth-filter" className="block text-sm font-medium text-gray-700 mb-1">
                    Tooth #
                  </label>
                  <select
                    id="tooth-filter"
                    value={toothFilter}
                    onChange={(e) => setToothFilter(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Teeth</option>
                    {getUniqueToothNumbers().map(toothNumber => (
                      <option key={toothNumber} value={toothNumber}>Tooth #{toothNumber}</option>
                    ))}
                  </select>
                </div>

                {/* Items per Page */}
                <div>
                  <label htmlFor="items-per-page" className="block text-sm font-medium text-gray-700 mb-1">
                    Per Page
                  </label>
                  <select
                    id="items-per-page"
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={5}>5 per page</option>
                    <option value={10}>10 per page</option>
                    <option value={15}>15 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  id="start-date"
                  value={dateRangeFilter.startDate}
                  onChange={(e) => setDateRangeFilter(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  placeholder="Select start date"
                />
              </div>
              <div>
                <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  id="end-date"
                  value={dateRangeFilter.endDate}
                  onChange={(e) => setDateRangeFilter(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  placeholder="Select end date"
                />
              </div>
            </div>

            {/* Filter Actions */}
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing {getCurrentPageTreatments().length} of {filteredTreatments.length} treatments
                {filteredTreatments.length !== treatments.length && (
                  <span className="text-blue-600"> (filtered from {treatments.length} total)</span>
                )}
              </div>
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FiX className="mr-1 h-4 w-4" />
                Clear Filters
              </button>
            </div>
          </div>

          {/* Completed Appointments Section */}
          {completedAppointments && completedAppointments.length > 0 && (
            <div className="bg-green-50 rounded-lg p-4 mb-6 border border-green-200">
              <h4 className="text-lg font-medium text-green-900 mb-3">
                ✅ Add Treatments from Completed Appointments ({completedAppointments.length} found)
              </h4>
              <p className="text-sm text-green-700 mb-4">
                Create treatment records directly from completed appointments. This will auto-fill procedure details and update the dental chart.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {completedAppointments.slice(0, 4).map((appointment) => (
                  <div key={appointment.id} className="bg-green-100 border border-green-300 rounded-lg p-3 hover:bg-green-200 hover:shadow-md transition-all duration-200">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="font-medium text-green-900">
                          {formatDate(appointment.appointment_date)}
                        </div>
                        <div className="text-sm text-green-700">
                          {appointment.serviceNames && appointment.serviceNames.length > 0 
                            ? appointment.serviceNames.join(', ') 
                            : 'No procedures specified'}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          {appointment.branch} Branch • {formatTime(appointment.appointment_time)}
                        </div>
                        {appointment.doctor && (
                          <div className="text-xs text-green-600 mt-1">
                            Dr. {appointment.doctor.full_name}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => startTreatmentFromAppointment(appointment)}
                        disabled={isAutoCreatingTreatments}
                        className="ml-3 inline-flex items-center px-3 py-1 border border-green-600 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAutoCreatingTreatments ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                            Creating...
                          </>
                        ) : (
                          <>
                        <FiPlus className="mr-1 h-4 w-4" />
                            {appointment.services && appointment.services.length > 1 
                              ? `Add ${appointment.services.length} Treatments` 
                              : 'Add Treatment'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {completedAppointments.length > 4 && (
                <div className="mt-3 text-center">
                  <p className="text-sm text-green-600">
                    And {completedAppointments.length - 4} more completed appointments...
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* No Completed Appointments Fallback */}
          {completedAppointments && completedAppointments.length === 0 && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
              <h4 className="text-lg font-medium text-blue-900 mb-3">No Completed Appointments Found</h4>
              <p className="text-sm text-blue-700 mb-4">
                This patient doesn't have any completed appointments yet. Once appointments are marked as completed, they will appear here for easy treatment creation.
              </p>
              <div className="text-sm text-blue-600">
                <p className="mb-2">To use the appointment-based treatment flow:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Patient books an appointment</li>
                  <li>Appointment is completed and marked as 'completed' status</li>
                  <li>Completed appointments appear here with "Add Treatment" buttons</li>
                  <li>Click "Add Treatment" to auto-fill procedures from the appointment</li>
                </ol>
              </div>
            </div>
          )}

          {/* Treatment Form Modal */}
          {showTreatmentForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h3 className="text-xl font-semibold text-gray-900">
                {editingTreatment ? 'Edit Treatment Record' : 'Add New Treatment Record'}
              </h3>
                  <button
                    onClick={() => {
                      setShowTreatmentForm(false);
                      setEditingTreatment(null);
                      setSelectedAppointmentForTreatment(null);
                      setAvailableProcedures([]);
                      if (!editingTreatment) {
                        setSelectedTeethInChart([]);
                        setSelectedToothInChart(null);
                      }
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6">
              {selectedTeethInChart.length > 0 && !editingTreatment && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-300 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-800 text-sm font-medium">Selected Teeth: {selectedTeethInChart.sort((a, b) => a - b).join(', ')}</p>
                      <p className="text-blue-600 text-xs mt-1">Click on teeth in the dental chart above to add/remove from selection</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTeethInChart([]);
                        setSelectedToothInChart(null);
                      }}
                      className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              )}
              
              {/* Appointment Selection for Auto-Fill */}
              {!editingTreatment && completedAppointments.length > 0 && !selectedAppointmentForTreatment && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-3">Select from Recent Completed Appointments</h4>
                  <div className="space-y-2">
                    {completedAppointments.slice(0, 5).map((appointment) => (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => handleAppointmentSelection(appointment)}
                        className="w-full text-left p-3 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-blue-900">
                              {formatDate(appointment.appointment_date)} at {formatTime(appointment.appointment_time)}
                            </div>
                            <div className="text-sm text-blue-700">
                              {appointment.serviceNames.length > 0 ? appointment.serviceNames.join(', ') : 'No services specified'}
                            </div>
                            {appointment.doctor && (
                              <div className="text-xs text-blue-600 mt-1">
                                Dr. {appointment.doctor.full_name}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-blue-600">
                            Click to auto-fill
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 text-center">
                    <button
                      type="button"
                      onClick={startGeneralTreatment}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Or create treatment without appointment
                    </button>
                  </div>
                </div>
              )}

              {/* Selected Appointment Info */}
              {selectedAppointmentForTreatment && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-green-900">
                        Auto-filled from appointment: {formatDate(selectedAppointmentForTreatment.appointment_date)}
                      </div>
                      <div className="text-xs text-green-700">
                        Available procedures: {availableProcedures.join(', ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAppointmentForTreatment(null);
                        setAvailableProcedures([]);
                      }}
                      className="text-green-600 hover:text-green-800"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              
              <Formik
                initialValues={{
                  procedure: editingTreatment?.procedure || 
                    (selectedAppointmentForTreatment && availableProcedures.length === 1 
                      ? availableProcedures[0] 
                      : ''),
                  tooth_number: editingTreatment?.tooth_number || '',
                  treatment_plan: editingTreatment?.diagnosis || '',
                  notes: editingTreatment?.notes ? cleanNotesForDisplay(editingTreatment.notes) : '',
                  treatment_date: editingTreatment?.treatment_date 
                    ? new Date(editingTreatment.treatment_date) 
                    : selectedAppointmentForTreatment 
                      ? new Date(selectedAppointmentForTreatment.appointment_date)
                      : new Date(),
                  // Multi-procedure mode values - ensure we have the correct procedureDetails
                  procedureDetails: isMultiProcedureMode && procedureDetails.length > 0 
                    ? procedureDetails 
                    : (editingTreatment?.procedure_details ? JSON.parse(editingTreatment.procedure_details) : [])
                }}
                key={`treatment-form-${isMultiProcedureMode}-${procedureDetails.length}-${selectedAppointmentForTreatment?.id}-${showTreatmentForm}`}
                enableReinitialize={true}
                validationSchema={createTreatmentSchema(isMultiProcedureMode, selectedTeethInChart, editingTreatment)}
                validateOnChange={true}
                validateOnBlur={true}
                onSubmit={(values, actions) => {
                  console.log('=== FORM ONSUBMIT CALLED ===');
                  console.log('Form onSubmit called with values:', values);
                  console.log('Form onSubmit actions:', actions);
                  console.log('isMultiProcedureMode in onSubmit:', isMultiProcedureMode);
                  console.log('procedureDetails in onSubmit:', values.procedureDetails);
                  console.log('Form validation errors:', actions.errors);
                  console.log('Form validation touched:', actions.touched);
                  
                  // Call the original handler
                  handleTreatmentSubmit(values, actions);
                }}
                enableReinitialize={true}
                context={{
                  availableProcedures,
                  isMultiProcedureMode
                }}
              >
                {({ isSubmitting, setFieldValue, values, errors, touched }) => {
                  console.log('Form render - values:', values);
                  console.log('Form render - errors:', errors);
                  console.log('Form render - touched:', touched);
                  console.log('Form render - isMultiProcedureMode:', isMultiProcedureMode);
                  console.log('Form render - procedureDetails:', values.procedureDetails);
                  
                  return (
                  <Form className="space-y-6" name="treatmentForm">
                    {/* Procedure Field */}
                    <div>
                      <label htmlFor="procedure" className="block text-sm font-medium text-gray-700 mb-2">
                        {isMultiProcedureMode ? 'Procedures' : 'Procedure'} <span className="text-red-500">*</span>
                      </label>
                        {isMultiProcedureMode && procedureDetails.length > 0 ? (
                          <div className="space-y-4">
                            <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
                              <div className="flex items-center mb-2">
                                <span className="text-blue-600 font-medium text-sm">
                                  📋 Multiple Procedures from Appointment
                                </span>
                                <span className="ml-2 bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded-full">
                                  {procedureDetails.length} procedures
                                </span>
                              </div>
                              <p className="text-xs text-blue-600">
                                All procedures are auto-filled from the selected appointment. Please specify tooth numbers for each procedure.
                              </p>
                            </div>
                            
                            {procedureDetails.map((detail, index) => (
                              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center">
                                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-2">
                                      {index + 1}
                                    </span>
                                    <span className="font-medium text-gray-900">
                                      {detail.procedure}
                                    </span>
                                  </div>
                                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                    ✅ Auto-filled
                                  </span>
                                </div>
                                <div>
                                  {/* Hidden field for procedure name */}
                                  <Field
                                    as="input"
                                    name={`procedureDetails.${index}.procedure`}
                                    type="hidden"
                                    value={detail.procedure}
                                  />
                                  
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Tooth Number for {detail.procedure} <span className="text-red-500">*</span>
                                  </label>
                                  <Field
                                    as="select"
                                    name={`procedureDetails.${index}.tooth_number`}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                  >
                                    <option value="">Select tooth...</option>
                                    
                                    {/* Permanent Teeth */}
                                    <optgroup label="Permanent Teeth (1-32)">
                                      <optgroup label="Upper Right (1-8)">
                                        {[1,2,3,4,5,6,7,8].map(num => (
                                          <option key={num} value={num}>Tooth {num}</option>
                                        ))}
                                      </optgroup>
                                      <optgroup label="Upper Left (9-16)">
                                        {[9,10,11,12,13,14,15,16].map(num => (
                                          <option key={num} value={num}>Tooth {num}</option>
                                        ))}
                                      </optgroup>
                                      <optgroup label="Lower Left (17-24)">
                                        {[17,18,19,20,21,22,23,24].map(num => (
                                          <option key={num} value={num}>Tooth {num}</option>
                                        ))}
                                      </optgroup>
                                      <optgroup label="Lower Right (25-32)">
                                        {[25,26,27,28,29,30,31,32].map(num => (
                                          <option key={num} value={num}>Tooth {num}</option>
                                        ))}
                                      </optgroup>
                                    </optgroup>
                                    
                                    {/* Temporary Teeth */}
                                    <optgroup label="Temporary Teeth (A-T)">
                                      <optgroup label="Upper Right (A-E)">
                                        {['A','B','C','D','E'].map(letter => (
                                          <option key={letter} value={letter}>Tooth {letter}</option>
                                        ))}
                                      </optgroup>
                                      <optgroup label="Upper Left (F-J)">
                                        {['F','G','H','I','J'].map(letter => (
                                          <option key={letter} value={letter}>Tooth {letter}</option>
                                        ))}
                                      </optgroup>
                                      <optgroup label="Lower Left (K-O)">
                                        {['K','L','M','N','O'].map(letter => (
                                          <option key={letter} value={letter}>Tooth {letter}</option>
                                        ))}
                                      </optgroup>
                                      <optgroup label="Lower Right (P-T)">
                                        {['P','Q','R','S','T'].map(letter => (
                                          <option key={letter} value={letter}>Tooth {letter}</option>
                                        ))}
                                      </optgroup>
                                    </optgroup>
                                  </Field>
                                  <ErrorMessage 
                                    name={`procedureDetails.${index}.tooth_number`} 
                                    component="p" 
                                    className="mt-1 text-sm text-red-600" 
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : selectedAppointmentForTreatment && availableProcedures.length > 0 ? (
                          <div>
                            {availableProcedures.length === 1 ? (
                              <div>
                                <Field
                                  as="input"
                                  id="procedure"
                                  name="procedure"
                                  value={availableProcedures[0]}
                                  readOnly
                                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-700"
                                />
                                <p className="mt-1 text-xs text-green-600">
                                  ✅ Auto-filled from appointment
                                </p>
                              </div>
                            ) : (
                              <div>
                          <Field
                            as="select"
                            id="procedure"
                            name="procedure"
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                          >
                            <option value="">Select from appointment procedures</option>
                            {availableProcedures.map((procedure, index) => (
                              <option key={index} value={procedure}>{procedure}</option>
                            ))}
                          </Field>
                                <p className="mt-1 text-xs text-blue-600">
                                  ℹ️ Multiple procedures available from appointment
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                        <div className="relative">
                        <Field
                          as="select"
                          id="procedure"
                          name="procedure"
                            className="block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                        >
                          <option value="">Select procedure</option>
                          {services.map((service) => (
                            <option key={service.id} value={service.name}>
                              {service.name}
                            </option>
                          ))}
                        </Field>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                        )}
                        {!isMultiProcedureMode && (
                        <ErrorMessage name="procedure" component="p" className="mt-1 text-sm text-red-600" />
                        )}
                      </div>

                    {/* Tooth Number Field */}
                    {!isMultiProcedureMode && (selectedTeethInChart.length <= 1 || editingTreatment) && (
                    <div>
                      <label htmlFor="tooth_number" className="block text-sm font-medium text-gray-700 mb-2">
                        Tooth Number/Letter <span className="text-red-500">*</span>
                      </label>
                      {selectedTeethInChart.length === 1 ? (
                        <p className="text-xs text-green-600 mb-2">
                          ✅ Auto-selected from dental chart: Tooth {selectedTeethInChart[0]}
                        </p>
                      ) : (
                        <p className="text-xs text-blue-600 mb-2">
                          💡 Select the same teeth that you selected from the interactive chart above
                        </p>
                      )}
                      <Field
                        as="select"
                        id="tooth_number"
                        name="tooth_number"
                        className="block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select tooth...</option>
                        
                        {/* Permanent Teeth 1-32 */}
                        {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32].map(num => (
                          <option key={num} value={num}>{num}</option>
                        ))}
                        
                        {/* Temporary Teeth A-T */}
                        {['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'].map(letter => (
                          <option key={letter} value={letter}>{letter}</option>
                        ))}
                      </Field>
                      <ErrorMessage name="tooth_number" component="p" className="mt-1 text-sm text-red-600" />
                      <p className="mt-1 text-xs text-gray-500">
                        Select tooth/letter from dropdown. Permanent teeth (1-32) or Temporary teeth (A-T).
                      </p>
                    </div>
                    )}
                      
                    {/* Message when multiple teeth are selected */}
                    {selectedTeethInChart.length > 1 && !editingTreatment && (
                      <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                        <p className="text-green-800 text-sm font-medium">Multiple Teeth Selected</p>
                        <p className="text-green-700 text-xs mt-1">
                          This treatment will be applied to all selected teeth: {selectedTeethInChart.sort((a, b) => a - b).join(', ')}
                        </p>
                      </div>
                    )}

                    {/* Treatment Plan Field */}
                    <div>
                      <label htmlFor="treatment_plan" className="block text-sm font-medium text-gray-700 mb-2">
                        Treatment Plan <span className="text-red-500">*</span>
                      </label>
                      <Field
                        as="textarea"
                        id="treatment_plan"
                        name="treatment_plan"
                        rows={4}
                        placeholder="Enter treatment plan and approach"
                        className="block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                      <ErrorMessage name="treatment_plan" component="p" className="mt-1 text-sm text-red-600" />
                    </div>

                    {/* Treatment Date Field */}
                    <div>
                      <label htmlFor="treatment_date" className="block text-sm font-medium text-gray-700 mb-2">
                        Treatment Date <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                      <Field
                        type="date"
                        id="treatment_date"
                        name="treatment_date"
                        max={new Date().toISOString().split('T')[0]}
                        value={values.treatment_date instanceof Date ? values.treatment_date.toISOString().split('T')[0] : values.treatment_date}
                        onChange={(e) => setFieldValue('treatment_date', new Date(e.target.value))}
                          className="block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      <ErrorMessage name="treatment_date" component="p" className="mt-1 text-sm text-red-600" />
                      {selectedAppointmentForTreatment && (
                        <p className="mt-1 text-xs text-green-600">
                          Auto-filled from appointment date
                        </p>
                      )}
                    </div>

                    {/* Additional Notes Field */}
                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                        Additional Notes (Optional)
                      </label>
                      <Field
                        as="textarea"
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Any additional remarks or observations"
                        className="block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                      <ErrorMessage name="notes" component="p" className="mt-1 text-sm text-red-600" />
                    </div>

                    {/* Auto-Update Dental Chart Section */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="text-sm text-blue-900 font-medium mb-2">Auto-Update Dental Chart</div>
                      <div className="text-xs text-blue-700">
                        {selectedTeethInChart.length > 1 && !editingTreatment ? (
                          <>When saved, this treatment will automatically update the patient's dental chart with the appropriate symbol for teeth: {selectedTeethInChart.sort((a, b) => a - b).join(', ')}.</>
                        ) : (
                          <>When saved, this treatment will automatically update the patient's dental chart with the appropriate symbol for tooth #{values.tooth_number || '[Select Tooth]'}.</>
                        )}
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
                      <button
                        type="button"
                        onClick={() => {
                          setShowTreatmentForm(false);
                          setEditingTreatment(null);
                          setSelectedAppointmentForTreatment(null);
                          setAvailableProcedures([]);
                          if (!editingTreatment) {
                            setSelectedTeethInChart([]);
                            setSelectedToothInChart(null);
                          }
                        }}
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        onClick={() => {
                          console.log('Submit button clicked');
                          console.log('Current form values:', values);
                          console.log('Current form errors:', errors);
                          console.log('isMultiProcedureMode:', isMultiProcedureMode);
                        }}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 transition-colors flex items-center"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Save Treatment & Update Chart
                          </>
                        )}
                      </button>
                    </div>
                  </Form>
                  );
                }}
              </Formik>
                </div>
              </div>
            </div>
          )}

          {/* Treatment Records List */}
          {filteredTreatments.length > 0 ? (
            <>
              <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
                {getCurrentPageTreatments().map((treatment) => {
                // Get time and branch from treatment data (enhanced with appointment info)
                const time = treatment.appointment_time;
                const branch = treatment.appointment_branch;
                
                return (
                <div key={treatment.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                  {/* Header with procedure and date */}
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-white rounded-full opacity-80"></div>
                        <h4 className="text-lg font-semibold text-white">{treatment.procedure}</h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="px-4 py-1.5 bg-white bg-opacity-20 text-white text-sm font-medium rounded-full backdrop-blur-sm">
                          {formatDate(treatment.treatment_date)}
                        </span>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => {
                              setEditingTreatment(treatment);
                              if (treatment.procedure) {
                                setAvailableProcedures([treatment.procedure]);
                              }
                              setShowTreatmentForm(true);
                            }}
                            className="p-2 text-white hover:text-blue-200 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                            title="Edit Treatment"
                          >
                            <FiEdit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(treatment)}
                            className="p-2 text-white hover:text-red-200 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                            title="Delete Treatment"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-6">
                    {/* Metadata badges */}
                    <div className="flex flex-wrap gap-3 mb-5">
                      {treatment.tooth_number && (
                        <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-full border border-green-200 shadow-sm">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm font-semibold">Tooth #{convertToothNumberForDisplay(treatment.tooth_number)}</span>
                        </div>
                      )}
                      {branch && (
                        <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 rounded-full border border-amber-200 shadow-sm">
                          <FiMapPin className="h-3 w-3" />
                          <span className="text-sm font-semibold">{branch} Branch</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Treatment Plan */}
                    {treatment.diagnosis && (
                      <div className="mb-5">
                        <div className="flex items-center mb-3">
                          <div className="w-1 h-5 bg-blue-500 rounded-full mr-3"></div>
                          <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Treatment Plan</h5>
                        </div>
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200 shadow-sm">
                          <div className="text-sm text-gray-800 leading-relaxed">
                            {formatBulletPoints(treatment.diagnosis)}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Notes */}
                    {treatment.notes && cleanNotesForDisplay(treatment.notes) && (
                      <div className="mb-5">
                        <div className="flex items-center mb-3">
                          <div className="w-1 h-5 bg-amber-500 rounded-full mr-3"></div>
                          <h5 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Additional Notes</h5>
                        </div>
                        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200 shadow-sm">
                          <div className="text-sm text-gray-800 leading-relaxed">
                            {formatBulletPoints(cleanNotesForDisplay(treatment.notes))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Doctor Info */}
                    <div className="flex items-center justify-between pt-5 mt-5 border-t border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                          <FiUser className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">Dr. {treatment.doctor?.full_name || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">Attending Dentist</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-1">Record Created</div>
                        <div className="text-xs font-medium text-gray-700">
                          {new Date(treatment.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
              </div>

              {/* Pagination Controls */}
              {getTotalPages() > 1 && (
                <div className="mt-6 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
                  <div className="text-sm text-gray-700">
                    Page {currentPage} of {getTotalPages()} • Showing {getCurrentPageTreatments().length} of {filteredTreatments.length} treatments
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-l-md text-gray-500 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from({ length: getTotalPages() }, (_, i) => i + 1).map((page) => {
                      const isCurrentPage = page === currentPage;
                      const showPage = page === 1 || page === getTotalPages() || (page >= currentPage - 2 && page <= currentPage + 2);
                      
                      if (!showPage) {
                        if (page === currentPage - 3 || page === currentPage + 3) {
                          return <span key={page} className="relative inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>;
                        }
                        return null;
                      }
                      
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`relative inline-flex items-center px-3 py-2 border text-sm font-medium ${
                            isCurrentPage
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'border-gray-300 text-gray-500 bg-white hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === getTotalPages()}
                      className="relative inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-500 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <FiFileText className="mx-auto h-16 w-16 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No treatment records</h3>
              <p className="mt-2 text-sm text-gray-500">
                No treatment records found for this patient that were performed by you.
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Only treatments performed by the logged-in doctor are displayed.
              </p>
              <div className="mt-4">
                <button
                  onClick={startGeneralTreatment}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                >
                  <FiPlus className="mr-2 -ml-1 h-5 w-5" />
                  Add First Treatment
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>


      {/* Patient Files Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Patient Files</h2>
            <p className="text-sm text-gray-500">Manage X-rays, documents, and other patient files</p>
          </div>
          <label
            htmlFor="file-upload"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 cursor-pointer disabled:bg-primary-400 disabled:cursor-not-allowed"
            tabIndex="0"
          >
            {isFileUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Uploading...
              </>
            ) : (
              <>
                <FiUpload className="mr-2 -ml-1 h-5 w-5" />
                Upload File
              </>
            )}
            <input
              id="file-upload"
              type="file"
              className="sr-only"
              onChange={handleFileUpload}
              disabled={isFileUploading}
            />
          </label>
        </div>
        
        <div className="p-6">
          {uploadedFiles.length > 0 ? (
            <div className="overflow-hidden border border-gray-200 sm:rounded-md">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex justify-between">
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">{uploadedFiles.length}</span> files total
                  </div>
                  <div className="text-sm text-gray-500">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 mr-2">
                      Patient Uploaded
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                      Staff Uploaded
                    </span>
                  </div>
                </div>
              </div>
              <ul className="divide-y divide-gray-200">
                {uploadedFiles.map((file) => (
                  <li key={file.id} className="p-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start">
                      <div className="flex items-center mb-2 sm:mb-0">
                        <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center">
                          {file && file.file_type && file.file_type.includes('image') ? (
                            <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          ) : file && file.file_type && file.file_type.includes('pdf') ? (
                            <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          ) : (
                            <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-900">{file.file_name}</p>
                          <div className="flex flex-wrap items-center">
                            <p className="text-xs text-gray-500 mr-2">
                              {file.displayDate} • {formatFileSize(file.file_size)}
                            </p>
                            {file.isPatientUploaded ? (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                                Patient Uploaded
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                                Staff Uploaded
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2 w-full sm:w-auto justify-end mt-2 sm:mt-0">
                        <button
                          onClick={() => handleViewFile(file)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-50 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                          <FiEye className="mr-1 h-4 w-4" />
                          View
                        </button>
                        <button
                          onClick={() => handlePrintFile(file)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          <FiPrinter className="mr-1 h-4 w-4" />
                          Print
                        </button>
                        <button
                          onClick={() => handleDeleteFile(file)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          <FiTrash2 className="mr-1 h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <FiUpload className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No files yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload X-rays, dental images, or other patient documents here.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Documents uploaded by patients in their profile will also appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* File Preview Modal */}
      {filePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">{filePreview.file_name}</h3>
              <button
                onClick={closeFilePreview}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {filePreview.file_type && filePreview.file_type.includes('image') ? (
                <img 
                  src={filePreview.file_url} 
                  alt={filePreview.file_name}
                  className="max-w-full h-auto mx-auto"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/600x400?text=Image+Not+Available';
                  }}
                />
              ) : filePreview.file_type && filePreview.file_type.includes('pdf') ? (
                <div className="h-[70vh]">
                  <iframe 
                    src={filePreview.file_url} 
                    title={filePreview.file_name}
                    className="w-full h-full"
                  ></iframe>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FiFileText className="mx-auto h-16 w-16 text-gray-400" />
                  <p className="mt-4 text-sm text-gray-500">
                    This file type cannot be previewed directly. Please download the file to view it.
                  </p>
                  <button
                    onClick={() => handlePrintFile(filePreview)}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                  >
                    <FiDownload className="mr-2 -ml-1 h-5 w-5" />
                    Print File
                  </button>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-between">
              <div className="text-sm text-gray-500">
                {filePreview.isPatientUploaded ? (
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                    Uploaded by Patient • {filePreview.displayDate}
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                    Uploaded by Staff • {filePreview.displayDate}
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePrintFile(filePreview)}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100"
                >
                  <FiPrinter className="mr-1 h-4 w-4" />
                  Print
                </button>
                <button
                  onClick={() => {
                    closeFilePreview();
                    handleDeleteFile(filePreview);
                  }}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100"
                >
                  <FiTrash2 className="mr-1 h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Deletion</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete the file "{fileToDelete.file_name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDeleteFile}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteFile}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-300"
                disabled={isFileDeleting}
              >
                {isFileDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <FiTrash2 className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">
                    Delete Treatment Record
                  </h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete this treatment record? This action cannot be undone.
                </p>
                {treatmentToDelete && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm font-medium text-gray-900">
                      {treatmentToDelete.procedure}
                    </p>
                    {treatmentToDelete.tooth_number && (
                      <p className="text-sm text-gray-600">
                        Tooth #{treatmentToDelete.tooth_number}
                      </p>
                    )}
                    <p className="text-sm text-gray-600">
                      {new Date(treatmentToDelete.treatment_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientRecords;
