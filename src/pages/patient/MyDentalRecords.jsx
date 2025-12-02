// src/pages/patient/MyDentalRecords.jsx - Patient's own dental records and treatment history
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiUpload, FiEye, FiTrash2, FiFileText, FiX, FiPrinter, FiPlus, FiEdit, FiSave, FiDownload, FiUser, FiCalendar, FiClock, FiMapPin, FiSearch } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import supabase from '../../config/supabaseClient';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ModernDentalChart from '../../components/common/ModernDentalChart';
import PatientDentalChart from './DentalChart';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';
import { useAuth } from '../../contexts/AuthContext';

// Define bucket name as a constant to avoid typos
const BUCKET_NAME = 'patient-files';

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

// Ensure the storage bucket exists and is public so staff can upload and view files
async function ensurePatientFilesBucketPublic(supabaseClient) {
  try {
    const { data: bucketInfo } = await supabaseClient.storage.getBucket(BUCKET_NAME);
    if (!bucketInfo) {
      // Try to create if missing
      await supabaseClient.storage.createBucket(BUCKET_NAME, { public: true, fileSizeLimit: 52428800 });
    } else if (!bucketInfo.public) {
      await supabaseClient.storage.updateBucket(BUCKET_NAME, { public: true });
    }
  } catch (_) {
    // Non-fatal; UI will still try to upload and fallback to local URL if needed
  }
}

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

// Validation schema for treatment history
const treatmentSchema = Yup.object().shape({
  procedure: Yup.string().required('Procedure is required'),
  tooth_number: Yup.mixed().required('Tooth number is required').test('tooth-format', 'Invalid tooth format', function(value) {
    // Accept numbers 1-32 for permanent teeth
    if (typeof value === 'number' && value >= 1 && value <= 32) return true;
    // Accept letters A-T for temporary teeth
    if (typeof value === 'string' && /^[A-T]$/.test(value)) return true;
    return false;
  }),
  diagnosis: Yup.string(),
  notes: Yup.string().max(500, 'Notes must be less than 500 characters'),
  treatment_date: Yup.date().required('Treatment date is required').max(new Date(), 'Treatment date cannot be in the future')
});

const MyDentalRecords = () => {
  const navigate = useNavigate();
  const { childId } = useParams();
  const { user } = useAuth();
  const { logPageView, logMedicalRecordView, logMedicalRecordUpdate, logTreatmentAdd } = useUniversalAudit();
  const [viewingChildId, setViewingChildId] = useState(childId || null);
  const [patient, setPatient] = useState(null);
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
  const [toothTreatments, setToothTreatments] = useState([]);
  const [showTreatmentHistory, setShowTreatmentHistory] = useState(true);
  const [showToothHistoryModal, setShowToothHistoryModal] = useState(false);
  
  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [procedureFilter, setProcedureFilter] = useState('');
  const [toothFilter, setToothFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState({ start: '', end: '' });
  const [filteredTreatments, setFilteredTreatments] = useState([]);
  
  // Dental Chart States
  const [dentalChart, setDentalChart] = useState(null);
  const [showDentalChartDetails, setShowDentalChartDetails] = useState(false);
  const chartDetailsRef = useRef(null);
  const [showFullChart, setShowFullChart] = useState(false);
  const chartFormRef = useRef(null);

  const openInlineChart = (mode) => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (mode === 'edit' || mode === 'view') params.set('mode', mode);
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    } catch {}
    setShowFullChart(true);
    setTimeout(() => {
      chartFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };
  
  // File preview and print states
  const [filePreview, setFilePreview] = useState(null);
  const [printWindow, setPrintWindow] = useState(null);

  // Children records states
  const [children, setChildren] = useState([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [allPatientsFileCounts, setAllPatientsFileCounts] = useState({});
  const [patientsSearchQuery, setPatientsSearchQuery] = useState('');
  const [allPatients, setAllPatients] = useState([]);
  const [filteredAllPatients, setFilteredAllPatients] = useState([]);

  useEffect(() => {
    // Update viewingChildId when route param changes
    if (childId) {
      setViewingChildId(childId);
    } else {
      setViewingChildId(null);
    }
  }, [childId]);

  useEffect(() => {
    // Log page view
    logPageView('Patient Medical Records', 'medical_records', 'viewing');
    
    fetchPatientData();
    fetchTreatmentHistory();
    fetchDentalChart();
    if (!viewingChildId) {
      fetchChildren(); // Only fetch children list when viewing own records
    }
    return () => {
      if (printWindow && !printWindow.closed) {
        printWindow.close();
      }
    };
  }, [logPageView, viewingChildId]);

  useEffect(() => {
    if (selectedToothInChart) {
      let toothSpecificTreatments;
      
      // Handle temporary teeth conversion
      if (typeof selectedToothInChart === 'string' && /^[A-T]$/.test(selectedToothInChart)) {
        // Convert temporary tooth letter to database number
        const tempTeethMap = {
          'A': 101, 'B': 102, 'C': 103, 'D': 104, 'E': 105,
          'F': 106, 'G': 107, 'H': 108, 'I': 109, 'J': 110,
          'K': 111, 'L': 112, 'M': 113, 'N': 114, 'O': 115,
          'P': 116, 'Q': 117, 'R': 118, 'S': 119, 'T': 120
        };
        const dbToothNumber = tempTeethMap[selectedToothInChart];
        toothSpecificTreatments = treatments.filter(treatment => treatment.tooth_number === dbToothNumber);
      } else {
        // For permanent teeth, use the tooth number directly
        toothSpecificTreatments = treatments.filter(treatment => treatment.tooth_number === selectedToothInChart);
      }
      
      setToothTreatments(toothSpecificTreatments);
    } else {
      setToothTreatments([]);
    }
  }, [selectedToothInChart, treatments]);

  // Filter treatments based on search and filters
  useEffect(() => {
    let filtered = treatments;

    if (searchQuery) {
      filtered = filtered.filter(treatment =>
        treatment.procedure?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        treatment.diagnosis?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        treatment.notes?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (procedureFilter) {
      filtered = filtered.filter(treatment => treatment.procedure === procedureFilter);
    }

    if (toothFilter) {
      filtered = filtered.filter(treatment => treatment.tooth_number == toothFilter); // Use == for loose comparison to handle both numbers and strings
    }

    if (dateRangeFilter.start) {
      filtered = filtered.filter(treatment => 
        new Date(treatment.treatment_date) >= new Date(dateRangeFilter.start)
      );
    }

    if (dateRangeFilter.end) {
      filtered = filtered.filter(treatment => 
        new Date(treatment.treatment_date) <= new Date(dateRangeFilter.end)
      );
    }

    setFilteredTreatments(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [treatments, searchQuery, procedureFilter, toothFilter, dateRangeFilter]);

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
    return [...new Set(treatments.map(t => t.procedure).filter(Boolean))];
  };

  const getUniqueToothNumbers = () => {
    return [...new Set(treatments.map(t => t.tooth_number).filter(Boolean))].sort((a, b) => a - b);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setProcedureFilter('');
    setToothFilter('');
    setDateRangeFilter({ start: '', end: '' });
  };

  // Fetch children for the current user (guardian)
  const fetchChildren = async () => {
    if (!user?.id) {
      return;
    }
    
    setIsLoadingChildren(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('guardian_id', user.id)
        .eq('role', 'patient')
        .order('full_name');
      
      if (error) {
        // Check if guardian_id column doesn't exist
        if (error.code === '42703' || error.message?.includes('guardian_id')) {
          console.error('guardian_id column does not exist in profiles table.');
          setChildren([]);
          return;
        }
        throw error;
      }
      
      setChildren(data || []);
    } catch (error) {
      console.error('Error fetching children:', error);
      if (error.code !== '42703' && !error.message?.includes('guardian_id')) {
        toast.error('Failed to load children records');
      }
    } finally {
      setIsLoadingChildren(false);
    }
  };

  // Fetch file counts for all patients (guardian + children)
  const fetchAllPatientsFileCounts = async (patientsList) => {
    if (!patientsList || patientsList.length === 0) return;
    
    try {
      const patientIds = patientsList.map(p => p.id);
      const { data, error } = await supabase
        .from('patient_files')
        .select('patient_id, id')
        .in('patient_id', patientIds);
      
      if (error) throw error;
      
      // Create a map of patient ID to file count
      const countMap = {};
      
      // Initialize all patients with 0 files
      patientsList.forEach(patient => {
        countMap[patient.id] = 0;
      });
      
      // Count files for each patient
      if (data) {
        data.forEach(file => {
          if (countMap[file.patient_id] !== undefined) {
            countMap[file.patient_id]++;
          }
        });
      }
      
      setAllPatientsFileCounts(countMap);
    } catch (error) {
      console.error('Error fetching file counts:', error);
    }
  };

  // Combine patient and children into one list
  useEffect(() => {
    const combined = [];
    
    // Add the patient/guardian themselves first
    if (patient) {
      combined.push(patient);
    }
    
    // Add children
    if (children && children.length > 0) {
      combined.push(...children);
    }
    
    setAllPatients(combined);
    setFilteredAllPatients(combined);
    
    // Fetch file counts for all patients
    if (combined.length > 0) {
      fetchAllPatientsFileCounts(combined);
    }
  }, [patient, children]);

  // Filter all patients based on search query
  useEffect(() => {
    if (patientsSearchQuery.trim() === '') {
      setFilteredAllPatients(allPatients);
    } else {
      const query = patientsSearchQuery.toLowerCase();
      const filtered = allPatients.filter(
        p => 
          (p.full_name && p.full_name.toLowerCase().includes(query)) ||
          (p.email && p.email.toLowerCase().includes(query)) ||
          (p.phone && p.phone.includes(query))
      );
      setFilteredAllPatients(filtered);
    }
  }, [patientsSearchQuery, allPatients]);

  // Handle view child records
  const handleViewChildRecords = (childId) => {
    navigate(`/patient/records/child/${childId}`);
  };

  const fetchPatientData = async () => {
    setIsLoading(true);
    
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      // Determine which patient to fetch - if viewingChildId is set, fetch that child's data
      const targetPatientId = viewingChildId || user.id;
      
      // If viewing a child (not themselves), verify the user is the guardian
      if (viewingChildId && viewingChildId !== user.id) {
        const { data: childData, error: childError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', viewingChildId)
          .eq('guardian_id', user.id)
          .single();
        
        if (childError) {
          toast.error('You do not have permission to view this child\'s records');
          navigate('/patient/records');
          return;
        }
      }
      
      // Fetch patient profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetPatientId)
        .single();
      
      if (profileError) throw profileError;
      
      // Verify we're getting the correct patient's data
      // If viewing a child, ensure the profile has guardian_id set (not null)
      if (viewingChildId && viewingChildId !== user.id) {
        if (!profileData.guardian_id || profileData.guardian_id !== user.id) {
          console.error('Error: Child profile does not have correct guardian_id');
          toast.error('Unable to load child records. Please verify the child profile is correctly linked.');
          navigate('/patient/records');
          return;
        }
        // Verify this is actually a child's profile, not the guardian's
        if (profileData.id === user.id) {
          console.error('Error: Fetched guardian profile instead of child profile');
          toast.error('Error loading child records');
          navigate('/patient/records');
          return;
        }
      }
      
      setPatient(profileData);
      
      // Fetch patient files
      const { data: filesData, error: filesError } = await supabase
        .from('patient_files')
        .select('*')
        .eq('patient_id', targetPatientId)
        .order('uploaded_at', { ascending: false });
      
      if (filesError) throw filesError;
      
      const processedFiles = filesData?.map(file => {
        if (!file) return null;
        return {
          ...file,
          isPatientUploaded: file.uploaded_by === user.id,
          displayDate: formatDate(file.uploaded_at),
          uploaderType: file.uploaded_by === user.id ? 'patient' : 'staff'
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
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      // Determine which patient to fetch - if viewingChildId is set, fetch that child's data
      const targetPatientId = viewingChildId || user.id;
      
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
        .eq('patient_id', targetPatientId)
        .order('treatment_date', { ascending: false });
      
      if (error) throw error;
      setTreatments(data || []);
    } catch (error) {
      console.error('Error fetching treatment history:', error);
      toast.error('Failed to load treatment history');
    }
  };

  const fetchDentalChart = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      // Determine which patient to fetch - if viewingChildId is set, fetch that child's data
      const targetPatientId = viewingChildId || user.id;
      
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
        .eq('patient_id', targetPatientId)
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

  const handleTreatmentSubmit = async (values, { resetForm }) => {
    setIsSubmittingTreatment(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const treatmentData = {
        ...values,
        patient_id: user.id,
        doctor_id: user.id,
        treatment_date: values.treatment_date.toISOString().split('T')[0]
      };

      if (editingTreatment) {
        const { error } = await supabase
          .from('treatments')
          .update(treatmentData)
          .eq('id', editingTreatment.id);
        
        if (error) throw error;
        toast.success('Treatment record updated successfully');
      } else {
        const { error } = await supabase
          .from('treatments')
          .insert([treatmentData]);
        
        if (error) throw error;
        toast.success('Treatment record added successfully');
      }

      resetForm();
      setShowTreatmentForm(false);
      setEditingTreatment(null);
      fetchTreatmentHistory();
    } catch (error) {
      console.error('Error saving treatment:', error);
      toast.error('Failed to save treatment record');
    } finally {
      setIsSubmittingTreatment(false);
    }
  };

  const handleDeleteTreatment = async (treatmentId) => {
    if (!window.confirm('Are you sure you want to delete this treatment record?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('treatments')
        .delete()
        .eq('id', treatmentId);
      
      if (error) throw error;
      
      toast.success('Treatment record deleted successfully');
      fetchTreatmentHistory();
    } catch (error) {
      console.error('Error deleting treatment:', error);
      toast.error('Failed to delete treatment record');
    }
  };

  const handleToothClick = (toothNumber) => {
    const newSelection = toothNumber === selectedToothInChart ? null : toothNumber;
    setSelectedToothInChart(newSelection);
    if (newSelection) {
      setShowToothHistoryModal(true);
    } else {
      setShowToothHistoryModal(false);
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

  // Generate and print treatment history report
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

    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Treatment History - ${patient.full_name}</title>
        <style>
          body {
            font-family: 'Times New Roman', serif;
            margin: 0;
            padding: 15px;
            line-height: 1.4;
            color: #000;
            font-size: 12px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .clinic-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 10px;
          }
          .logo-circle {
            width: 60px;
            height: 60px;
            border: 3px solid #1e40af;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            background: #3b82f6;
            color: white;
            font-weight: bold;
            font-size: 24px;
          }
          .clinic-text {
            text-align: left;
          }
          .clinic-name {
            font-size: 28px;
            font-weight: bold;
            color: #1e40af;
            margin: 0;
            letter-spacing: 1px;
          }
          .doctor-name {
            font-size: 14px;
            color: #374151;
            font-style: italic;
            margin: 5px 0;
          }
          .form-title {
            font-size: 18px;
            font-weight: bold;
            color: #000;
            margin: 15px 0 10px 0;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .patient-section {
            border: 2px solid #000;
            margin-bottom: 20px;
          }
          .section-header {
            background: #f3f4f6;
            padding: 8px 12px;
            border-bottom: 1px solid #000;
            font-weight: bold;
            font-size: 14px;
            text-transform: uppercase;
          }
          .info-grid {
            padding: 15px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px 30px;
          }
          .info-row {
            display: flex;
            border-bottom: 1px dotted #ccc;
            padding: 5px 0;
          }
          .info-label {
            font-weight: bold;
            width: 120px;
            color: #000;
          }
          .info-value {
            flex: 1;
            border-bottom: 1px solid #000;
            min-height: 16px;
            padding-left: 5px;
          }
          .treatments-section {
            border: 2px solid #000;
            margin-bottom: 20px;
          }
          .treatment-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          .treatment-table th {
            background: #f3f4f6;
            border: 1px solid #000;
            padding: 8px 5px;
            text-align: left;
            font-weight: bold;
            font-size: 10px;
          }
          .treatment-table td {
            border: 1px solid #000;
            padding: 8px 5px;
            vertical-align: top;
          }
          .treatment-table tr:nth-child(even) {
            background: #f9f9f9;
          }
          .signature-section {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            width: 200px;
            text-align: center;
          }
          .signature-line {
            border-top: 1px solid #000;
            margin-top: 50px;
            padding-top: 5px;
            font-size: 10px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 9px;
            color: #666;
            border-top: 1px solid #ccc;
            padding-top: 10px;
          }
          .date-box {
            text-align: right;
            margin-bottom: 10px;
            font-size: 11px;
          }
          @media print {
            body { 
              margin: 0; 
              padding: 10px;
            }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="clinic-logo">
            <div class="logo-circle">SDC</div>
            <div class="clinic-text">
              <div class="clinic-name">SILARIO DENTAL CLINIC</div>
              <div class="doctor-name">Elaine Mae Frando Silario D.M.D</div>
            </div>
          </div>
          <div class="form-title">DENTAL TREATMENT HISTORY RECORD</div>
        </div>

        <div class="date-box">
          Date Generated: <u>${currentDate}</u>
        </div>

        <div class="patient-section">
          <div class="section-header">Patient Information Record</div>
          <div class="info-grid">
            <div class="info-row">
              <span class="info-label">Name:</span>
              <span class="info-value">${patient.full_name || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Age:</span>
              <span class="info-value">${patient.birthday ? calculateAge(patient.birthday) : ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Address:</span>
              <span class="info-value">${patient.address || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Sex:</span>
              <span class="info-value">${patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Birthdate:</span>
              <span class="info-value">${patient.birthday ? formatDate(patient.birthday) : ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date:</span>
              <span class="info-value">${currentDate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Nationality:</span>
              <span class="info-value">${patient.nationality || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Home No.:</span>
              <span class="info-value">${patient.phone || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Home Address:</span>
              <span class="info-value">${patient.address || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Office No.:</span>
              <span class="info-value">${patient.office_phone || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Occupation:</span>
              <span class="info-value">${patient.occupation || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Cell/Mobile No.:</span>
              <span class="info-value">${patient.mobile || patient.phone || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Patient ID:</span>
              <span class="info-value">${patient.id ? patient.id.substring(0, 8) : ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email Add:</span>
              <span class="info-value">${patient.email || ''}</span>
            </div>
          </div>
        </div>

        <div class="treatments-section">
          <div class="section-header">Treatment History Summary (${treatments.length} Records)</div>
          
          ${treatments.length === 0 ? `
            <div style="text-align: center; padding: 30px; font-style: italic;">
              No treatment records found for this patient.
            </div>
          ` : `
            <table class="treatment-table">
              <thead>
                <tr>
                  <th style="width: 12%;">Date</th>
                  <th style="width: 25%;">Procedure</th>
                  <th style="width: 10%;">Tooth #</th>
                  <th style="width: 20%;">Diagnosis</th>
                  <th style="width: 25%;">Notes</th>
                  <th style="width: 15%;">Doctor</th>
                </tr>
              </thead>
              <tbody>
                ${treatments.map((treatment, index) => `
                  <tr>
                    <td>${formatDate(treatment.treatment_date)}</td>
                    <td><strong>${treatment.procedure || 'Not specified'}</strong></td>
                    <td style="text-align: center;">${treatment.tooth_number || '-'}</td>
                    <td>${treatment.diagnosis || '-'}</td>
                    <td>${treatment.notes || '-'}</td>
                    <td>Dr. ${treatment.doctor?.full_name || 'Unknown'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line">
              Patient Signature
            </div>
          </div>
          <div class="signature-box">
            <div class="signature-line">
              Attending Dentist Signature
            </div>
          </div>
        </div>

        <div class="footer">
          <p><strong>SILARIO DENTAL CLINIC</strong></p>
          <p>Professional Dental Care Services | Cabugao Branch & San Juan Branch</p>
          <p>This is an official dental treatment history record generated on ${currentDate}</p>
          <p style="margin-top: 8px; font-size: 8px;">
            This document contains confidential patient information and should be handled according to medical privacy guidelines.
          </p>
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              setTimeout(function() {
                window.close();
              }, 1000);
            };
          };
        </script>
      </body>
      </html>
    `;

    reportWindow.document.write(reportHTML);
    reportWindow.document.close();
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
      await ensurePatientFilesBucketPublic(supabase);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}_${safeName}`;
      const { data: { user } } = await supabase.auth.getUser();
      const filePath = `${user.id}/${fileName}`;
      
      let fileUrl = null;
      
      try {
        const { error: uploadError, data } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type || 'application/octet-stream'
          });
        
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
        // Try short-lived signed URL as a fallback
        try {
          const { data: signed } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(filePath, 60);
          if (signed?.signedUrl) {
            fileUrl = signed.signedUrl;
          }
        } catch (e) {}
      }

      if (!fileUrl) {
        toast.update(toastId, {
          render: 'Upload succeeded but no accessible URL. Check bucket public setting or policies.',
          type: toast.TYPE.ERROR,
          autoClose: 5000
        });
        throw new Error('File URL not accessible');
      }
      
      const { data: fileData, error: recordError } = await supabase
        .from('patient_files')
        .insert([
          {
            patient_id: user.id,
            file_name: safeName,
            file_type: file.type,
            file_size: file.size,
            file_path: filePath,
            file_url: fileUrl,
            uploaded_at: new Date().toISOString(),
            uploaded_by: user.id,
          }
        ])
        .select();
      
      if (recordError) throw recordError;
      
      toast.update(toastId, {
        render: 'File uploaded successfully',
        type: toast.TYPE.SUCCESS,
        autoClose: 3000
      });
      toast.success('Upload complete and file list refreshed');
      
      if (fileData && fileData.length > 0) {
        const newFile = {
          ...fileData[0],
          isPatientUploaded: true,
          displayDate: formatDate(fileData[0].uploaded_at),
          uploaderType: 'patient'
        };
        setUploadedFiles(currentFiles => [newFile, ...currentFiles]);
      }
      // Ensure list stays in sync by refetching from DB after upload
      await fetchPatientData();
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
  const renderTooth = (toothNumber) => {
    const hasHistory = treatments.some(t => t.tooth_number === toothNumber);
    const isSelected = selectedToothInChart === toothNumber;
    const toothSymbol = dentalChart?.chart_data?.teeth?.[toothNumber]?.symbol || '';
    
    let toothClass = "tooth cursor-pointer transition-all duration-200";
    
    if (isSelected) {
      toothClass += " bg-primary-200 border-primary-500 border-2 shadow-md";
    } else if (toothSymbol) {
      toothClass += " bg-red-100 hover:bg-red-200 border-red-300";
    } else if (hasHistory) {
      toothClass += " bg-yellow-100 hover:bg-yellow-200";
    } else {
      toothClass += " bg-white hover:bg-gray-100";
    }
    
    return (
      <div 
        key={toothNumber}
        className={`${toothClass} w-10 h-12 rounded border border-gray-300 flex flex-col items-center justify-center text-xs font-medium m-1 relative`}
        onClick={() => handleToothClick(toothNumber)}
        title={`Tooth ${toothNumber}${toothSymbol ? ` - ${chartSymbols[toothSymbol] || toothSymbol}` : ''}${hasHistory ? ' - Has treatment history' : ''}`}
      >
        {toothSymbol && (
          <div className="text-red-600 font-bold text-sm absolute top-0">
            {toothSymbol}
          </div>
        )}
        <div className="text-xs font-bold text-gray-700 mt-2">
          {toothNumber}
        </div>
        {hasHistory && (
          <div className="w-2 h-2 bg-blue-500 rounded-full absolute bottom-0 right-0 transform translate-x-1 translate-y-1"></div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!patient) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Profile not found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Your profile information could not be loaded.
          </p>
          <div className="mt-3">

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">SDC</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-blue-600">Silario Dental Clinic</h1>
                <p className="text-xs text-gray-500">Patient Portal</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <FiUser className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Patient</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Back button when viewing child records */}
        {viewingChildId && (
          <button
            onClick={() => navigate('/patient/records')}
            className="flex items-center text-blue-600 hover:text-blue-700 mb-2"
          >
            <FiArrowLeft className="mr-2 h-4 w-4" />
            Back to My Records
          </button>
        )}
        
        {/* Patient Information Card - Only show when viewing a specific record */}
        {patient && viewingChildId && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Patient Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200 shadow-md">
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
                  } bg-blue-500 text-white font-bold text-lg`}>
                    {patient.full_name?.charAt(0) || 'P'}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{patient.full_name}</h2>
                  <p className="text-sm text-gray-600">Patient ID: {patient.id && patient.id.substring(0, 8)}</p>
                  {viewingChildId && viewingChildId !== user?.id && (
                    <p className="text-xs text-blue-600 mt-1">Child's Record</p>
                  )}
                  {viewingChildId && viewingChildId === user?.id && (
                    <p className="text-xs text-green-600 mt-1">Your Record</p>
                  )}
                </div>
              </div>
            </div>

            {/* Patient Details */}
            <div className="px-4 py-4">
              <div className="space-y-3 mb-4">
                {/* Name and Basic Info */}
                <div className="grid grid-cols-2 gap-3">
                  {patient.birthday && (
                    <div className="flex items-center space-x-2">
                      <FiCalendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Age</p>
                        <p className="text-sm font-medium">{calculateAge(patient.birthday)} years ({formatDate(patient.birthday)})</p>
                      </div>
                    </div>
                  )}
                  {patient.gender && (
                    <div className="flex items-center space-x-2">
                      <FiUser className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Sex</p>
                        <p className="text-sm font-medium">{patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Address */}
                {patient.address && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Address</p>
                    <p className="text-sm font-medium">{patient.address}</p>
                  </div>
                )}
                
                {/* Contact Information */}
                <div className="grid grid-cols-2 gap-3">
                  {patient.phone && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Phone</p>
                      <p className="text-sm font-medium">{patient.phone}</p>
                    </div>
                  )}
                  {patient.email && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Email</p>
                      <p className="text-sm font-medium">{patient.email}</p>
                    </div>
                  )}
                </div>
                
                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-3">
                  {patient.occupation && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Occupation</p>
                      <p className="text-sm font-medium">{patient.occupation}</p>
                    </div>
                  )}
                  {patient.nationality && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Nationality</p>
                      <p className="text-sm font-medium">{patient.nationality}</p>
                    </div>
                  )}
                </div>
                
                {/* Debug info - show guardian_id to verify this is a child */}
                {patient.guardian_id && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                    <strong>Note:</strong> This is a child's record (Guardian ID: {patient.guardian_id.substring(0, 8)})
                  </div>
                )}
              </div>

              {/* Action Buttons - Mobile Layout */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (viewingChildId && viewingChildId !== user?.id) {
                      navigate(`/patient/dental-chart/child/${viewingChildId}?mode=view`);
                    } else {
                      navigate('/patient/dental-chart?mode=view');
                    }
                  }}
                  className="w-full flex items-center justify-center px-4 py-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  <FiEye className="mr-2 h-4 w-4" />
                  View Chart
                </button>
                <button
                  onClick={() => {
                    if (viewingChildId && viewingChildId !== user?.id) {
                      navigate(`/patient/dental-chart/child/${viewingChildId}?mode=edit`);
                    } else {
                      navigate('/patient/dental-chart?mode=edit');
                    }
                  }}
                  className="w-full flex items-center justify-center px-4 py-3 bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100 transition-colors"
                >
                  <FiEdit className="mr-2 h-4 w-4" />
                  Edit Chart
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Patients Record Section - Includes Guardian and Children */}
        {!viewingChildId && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Patients Record</h1>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Search patients..."
                  value={patientsSearchQuery}
                  onChange={(e) => setPatientsSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {isLoadingChildren && allPatients.length === 0 ? (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <div className="p-8 text-center">
                  <LoadingSpinner />
                </div>
              </div>
            ) : filteredAllPatients.length > 0 ? (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {filteredAllPatients.map((patientRecord) => (
                    <li key={patientRecord.id}>
                      <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-gray-200 shadow-md">
                                {patientRecord.profile_picture_url ? (
                                  <img
                                    src={`${patientRecord.profile_picture_url}?t=${Date.now()}`}
                                    alt={patientRecord.full_name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }} 
                                  />
                                ) : null}
                                <div className={`w-full h-full flex items-center justify-center ${
                                  patientRecord.profile_picture_url ? 'hidden' : ''
                                } bg-primary-100 text-primary-600`}>
                                  <span className="font-medium text-sm">
                                    {patientRecord.full_name?.charAt(0).toUpperCase() || 'P'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-primary-600">{patientRecord.full_name}</div>
                              <div className="text-sm text-gray-500">
                                {patientRecord.email}
                                {patientRecord.phone && ` • ${patientRecord.phone}`}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {allPatientsFileCounts[patientRecord.id] > 0 && (
                              <div className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 flex items-center">
                                <FiFileText className="mr-1 h-3 w-3" />
                                {allPatientsFileCounts[patientRecord.id]} {allPatientsFileCounts[patientRecord.id] === 1 ? 'file' : 'files'}
                              </div>
                            )}
                            <button
                              onClick={() => {
                                if (patientRecord.id === user?.id) {
                                  // When clicking on themselves, show detailed view by setting viewingChildId to their own ID
                                  setViewingChildId(user.id);
                                  navigate(`/patient/records/child/${user.id}`);
                                } else {
                                  handleViewChildRecords(patientRecord.id);
                                }
                              }}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                              <FiEye className="mr-1 -ml-0.5 h-4 w-4" />
                              View Records
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            {patientRecord.birthday && (
                              <div className="flex items-center text-sm text-gray-500 mr-6">
                                <FiCalendar className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                <span>
                                  Age: {calculateAge(patientRecord.birthday)}
                                  <span className="hidden sm:inline"> ({formatDate(patientRecord.birthday)})</span>
                                </span>
                              </div>
                            )}
                            {patientRecord.gender && (
                              <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                <div className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400">
                                  {patientRecord.gender === 'male' ? '♂' : patientRecord.gender === 'female' ? '♀' : '⚥'}
                                </div>
                                <span>
                                  {patientRecord.gender.charAt(0).toUpperCase() + patientRecord.gender.slice(1)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                            <span>
                              Patient ID: {patientRecord.id.substring(0, 8)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <div className="px-4 py-5 sm:p-6 text-center">
                  <FiUser className="mx-auto h-12 w-12 text-gray-400" />
                  {patientsSearchQuery.trim() !== '' ? (
                    <>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No patients match your search</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Try different keywords or clear the search field.
                      </p>
                      {allPatients.length > 0 && (
                        <div className="mt-3">
                          <button
                            type="button"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200"
                            onClick={() => setPatientsSearchQuery('')}
                          >
                            Clear search
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No patients yet</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        There are no patient records available.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      {/* Treatment History removed from this page; view via the dedicated page */}

      {/* Only show dental chart and patient files when viewing a specific record */}
      {viewingChildId && (
        <>
          {/* Inline Full Dental Chart Form (View/Edit) */}
          {showFullChart && (
            <div ref={chartFormRef} className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Comprehensive Dental Chart</h2>
                <button
                  onClick={() => setShowFullChart(false)}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                >
                  <FiX className="mr-2 -ml-1 h-4 w-4" /> Close
                </button>
              </div>
              <div className="p-0">
                <PatientDentalChart />
              </div>
            </div>
          )}

          {/* Interactive Dental Chart Section - Mobile Optimized */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-white">
                <FiEye className="h-5 w-5 mr-2" />
                <div>
                  <h3 className="text-base font-medium">Interactive Dental Chart</h3>
                  <p className="text-blue-100 text-xs">View patient's dental chart with treatment history</p>
                </div>
              </div>
              <button
                onClick={() => setShowDentalChart(!showDentalChart)}
                className="px-3 py-1.5 text-xs font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 transition-colors"
              >
                {showDentalChart ? 'Hide' : 'View'}
              </button>
            </div>
          </div>

          {showDentalChart ? (
            <div className="p-4">
              <div className="overflow-x-auto">
                <ModernDentalChart
                  treatments={treatments}
                  dentalChart={dentalChart?.chart_data || dentalChart}
                  chartSymbols={enhancedChartSymbols}
                  onToothClick={handleToothClick}
                  selectedTeeth={selectedToothInChart ? [selectedToothInChart] : []}
                  selectedTooth={selectedToothInChart}
                  role="patient"
                  patientId={viewingChildId || user?.id}
                  onDentalChartUpdate={(updatedChart) => {
                    setDentalChart(updatedChart);
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="text-center py-6">
                <FiEye className="mx-auto h-8 w-8 text-gray-400" />
                <h4 className="mt-2 text-sm font-medium text-gray-900">Dental chart preview</h4>
                <p className="mt-1 text-xs text-gray-500">
                  Tap "View" to see an interactive dental chart with treatment history.
                </p>
              </div>
            </div>
          )}
          </div>

          {/* Patient Files Section - Mobile Optimized */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-medium text-gray-900">Patient Files</h3>
                <p className="text-xs text-gray-500">X-rays, documents, and other files</p>
              </div>
            </div>
            <label
              htmlFor="file-upload"
              className="w-full flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
              tabIndex="0"
            >
              {isFileUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <FiUpload className="mr-2 h-4 w-4" />
                  Upload File
                </>
              )}
              <input
                id="file-upload"
                type="file"
                className="sr-only"
                onChange={handleFileUpload}
                disabled={isFileUploading}
                accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.heic,.heif,.ppt,.pptx"
              />
            </label>
          </div>
          
          <div className="p-4">
            {uploadedFiles.length > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-3">
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">{uploadedFiles.length}</span> files total
                  </div>
                  <div className="flex space-x-1">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                      Patient
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                      Staff
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
                          {file && file.file_type && file.file_type.includes('image') ? (
                            <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          ) : file && file.file_type && file.file_type.includes('pdf') ? (
                            <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-xs text-gray-500">
                              {file.displayDate} • {formatFileSize(file.file_size)}
                            </p>
                            {file.isPatientUploaded ? (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                                Patient
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                                Staff
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2 mt-3">
                        <button
                          onClick={() => handleViewFile(file)}
                          className="flex-1 flex items-center justify-center px-3 py-2 text-xs font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                        >
                          <FiEye className="mr-1 h-3 w-3" />
                          View
                        </button>
                        <button
                          onClick={() => handlePrintFile(file)}
                          className="flex-1 flex items-center justify-center px-3 py-2 text-xs font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                        >
                          <FiPrinter className="mr-1 h-3 w-3" />
                          Print
                        </button>
                        <button
                          onClick={() => handleDeleteFile(file)}
                          className="flex-1 flex items-center justify-center px-3 py-2 text-xs font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          <FiTrash2 className="mr-1 h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <FiUpload className="mx-auto h-8 w-8 text-gray-400" />
                <h4 className="mt-2 text-sm font-medium text-gray-900">No files yet</h4>
                <p className="mt-1 text-xs text-gray-500">
                  Upload X-rays, dental images, or other documents.
                </p>
              </div>
            )}
          </div>
        </div>
        </>
      )}

        {/* Tooth History Modal - Mobile Optimized */}
        {showToothHistoryModal && selectedToothInChart && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
                <div className="font-semibold text-sm">Tooth #{selectedToothInChart} Treatment History</div>
                <button
                  onClick={() => setShowToothHistoryModal(false)}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-md text-sm"
                >
                  Close
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[75vh]">
                {toothTreatments.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">No treatments recorded for this tooth.</div>
                ) : (
                  <div className="space-y-3">
                    {toothTreatments.map((t) => (
                      <div key={t.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold">{t.procedure || '—'}</h4>
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border">{formatDate(t.treatment_date)}</span>
                        </div>
                        {t.diagnosis && (
                          <div className="text-xs text-gray-700 mb-1">
                            <span className="font-medium">Treatment Plan:</span> 
                            <div className="mt-1">{formatBulletPoints(t.diagnosis)}</div>
                          </div>
                        )}
                        {t.notes && (
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Notes:</span> 
                            <div className="mt-1">{formatBulletPoints(t.notes)}</div>
                          </div>
                        )}
                        <div className="mt-1 text-xs text-gray-500">Doctor: Dr. {t.doctor?.full_name || 'Unknown'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* File Preview Modal - Mobile Optimized */}
        {filePreview && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-t-xl sm:rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-base font-medium text-gray-900 truncate pr-4">{filePreview.file_name}</h3>
                <button
                  onClick={closeFilePreview}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none flex-shrink-0"
                >
                  <FiX className="h-5 w-5" />
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
                  <div className="h-[60vh] sm:h-[70vh]">
                    <iframe 
                      src={filePreview.file_url} 
                      title={filePreview.file_name}
                      className="w-full h-full"
                    ></iframe>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FiFileText className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-4 text-sm text-gray-500">
                      This file type cannot be previewed directly. Please download the file to view it.
                    </p>
                    <button
                      onClick={() => handlePrintFile(filePreview)}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <FiDownload className="mr-2 -ml-1 h-4 w-4" />
                      Print File
                    </button>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
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
                      className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100"
                    >
                      <FiPrinter className="mr-1 h-4 w-4" />
                      Print
                    </button>
                    <button
                      onClick={() => {
                        closeFilePreview();
                        handleDeleteFile(filePreview);
                      }}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100"
                    >
                      <FiTrash2 className="mr-1 h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal - Mobile Optimized */}
        {fileToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-t-xl sm:rounded-lg w-full max-w-md">
              <div className="p-4">
                <h3 className="text-base font-medium text-gray-900 mb-3">Confirm Deletion</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to delete the file "{fileToDelete.file_name}"? This action cannot be undone.
                </p>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                  <button
                    onClick={cancelDeleteFile}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteFile}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-300 transition-colors"
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
          </div>
        )}
      </div>
    </div>
  );
};

export default MyDentalRecords;