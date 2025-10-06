// src/pages/doctor/PatientRecords.jsx - Enhanced with Treatment History and Dental Chart
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiUpload, FiEye, FiTrash2, FiFileText, FiX, FiPrinter, FiPlus, FiEdit, FiSave, FiDownload, FiUser, FiCalendar, FiClock, FiMapPin } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import supabase from '../../config/supabaseClient';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ModernDentalChart from '../../components/common/ModernDentalChart';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

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

const PatientRecords = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { logPageView, logMedicalRecordView, logMedicalRecordUpdate, logTreatmentAdd } = useUniversalAudit();
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
  
  // File preview and print states
  const [filePreview, setFilePreview] = useState(null);
  const [printWindow, setPrintWindow] = useState(null);

  useEffect(() => {
    if (patientId) {
      // Log page view
      logPageView('Staff Patient Records', 'medical_records', 'viewing');
      
      fetchPatientData();
      fetchTreatmentHistory();
      fetchDentalChart();
    } else {
      setIsLoading(false);
    }
    return () => {
      if (printWindow && !printWindow.closed) {
        printWindow.close();
      }
    };
  }, [patientId, logPageView]);

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

  const handleTreatmentSubmit = async (values, { resetForm }) => {
    setIsSubmittingTreatment(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const treatmentData = {
        ...values,
        patient_id: patientId,
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
      const filePath = `${patientId}/${fileName}`;
      
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
      
      const { data: { user } } = await supabase.auth.getUser();
      const doctorId = user?.id;
      
      const { data: fileData, error: recordError } = await supabase
        .from('patient_files')
        .insert([
          {
            patient_id: patientId,
            file_name: safeName,
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
      toast.success('Upload complete and file list refreshed');
      
      if (fileData && fileData.length > 0) {
        const newFile = {
          ...fileData[0],
          isPatientUploaded: false,
          displayDate: formatDate(fileData[0].uploaded_at),
          uploaderType: 'staff'
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
              onClick={() => navigate('/staff/patients')}
            >
              <FiArrowLeft className="mr-2 -ml-1 h-5 w-5" aria-hidden="true" />
              Back to Patient List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <button
          type="button"
          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-primary-700 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          onClick={() => navigate('/staff/patients')}
        >
          <FiArrowLeft className="mr-1 -ml-1 h-4 w-4" />
          Back to Patient List
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
              <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
                <button
                  onClick={() => navigate(`/staff/patients/${patientId}/dental-chart`)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300"
                >
                  <FiFileText className="mr-2" /> View Chart
                </button>
                <button
                  onClick={() => navigate(`/staff/patients/${patientId}/dental-chart/edit`)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-300"
                >
                  <FiEdit className="mr-2" /> Edit Chart
                </button>
                <button
                  onClick={() => navigate(`/staff/patients/${patientId}/treatments`)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-300"
                >
                  <FiFileText className="mr-2" /> Treatment History
                </button>
                
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Treatment History removed from this page; view via the dedicated page */}

      {/* Modern Interactive Dental Chart Section */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center text-white">
            <FiEye className="h-6 w-6 mr-3" />
            <div>
              <h2 className="text-lg font-medium">Interactive Dental Chart</h2>
              <p className="text-blue-100 text-sm">View patient's dental chart with treatment history</p>
            </div>
          </div>
          <button
            onClick={() => setShowDentalChart(!showDentalChart)}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
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
          <div className="p-6">
            <ModernDentalChart
              treatments={treatments}
              dentalChart={dentalChart?.chart_data || dentalChart}
              chartSymbols={enhancedChartSymbols}
              onToothClick={handleToothClick}
              selectedTeeth={selectedToothInChart ? [selectedToothInChart] : []}
              selectedTooth={selectedToothInChart}
              role="staff"
              patientId={patientId}
              onDentalChartUpdate={(updatedChart) => {
                setDentalChart(updatedChart);
              }}
            />
          </div>
        ) : (
          <div className="p-6">
            <div className="text-center py-8">
              <FiEye className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Dental chart preview</h3>
              <p className="mt-1 text-sm text-gray-500">
                Click the "View Chart" button to see an interactive dental chart with treatment history.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Patient Files Section */}
      {showToothHistoryModal && selectedToothInChart && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="font-semibold">Tooth #{selectedToothInChart} Treatment History</div>
              <button
                onClick={() => setShowToothHistoryModal(false)}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-md"
              >
                Close
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[75vh]">
              {toothTreatments.length === 0 ? (
                <div className="text-center py-10 text-gray-600">No treatments recorded for this tooth.</div>
              ) : (
                <div className="space-y-3">
                  {toothTreatments.map((t) => (
                    <div key={t.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-base font-semibold">{t.procedure || '—'}</h4>
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border">{formatDate(t.treatment_date)}</span>
                      </div>
                      {t.diagnosis && (
                        <div className="text-sm text-gray-700 mb-1">
                          <span className="font-medium">Treatment Plan:</span> 
                          <div className="mt-1">{formatBulletPoints(t.diagnosis)}</div>
                        </div>
                      )}
                      {t.notes && (
                        <div className="text-sm text-gray-600">
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
              accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.heic,.heif,.ppt,.pptx"
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
    </div>
  );
};

export default PatientRecords;