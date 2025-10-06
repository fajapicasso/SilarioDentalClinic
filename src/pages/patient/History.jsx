// src/pages/patient/History.jsx - Enhanced with Better Filtering and Medical Records Integration
import React, { useState, useEffect } from 'react';
import { FiCalendar, FiFilter, FiUser, FiFileText, FiEye, FiX, FiPrinter, FiDownload, FiClock, FiMapPin, FiActivity, FiUpload, FiTrash2, FiRefreshCw, FiEdit } from 'react-icons/fi';
import supabase from '../../config/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ModernDentalChart from '../../components/common/ModernDentalChart';
import { toast } from 'react-toastify';

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

const History = () => {
  const { user } = useAuth();
  
  // Function to clean notes for display (remove hidden appointment references)
  const cleanNotesForDisplay = (notes) => {
    if (!notes) return '';
    // Remove HTML comment-style appointment references
    return notes.replace(/<!--APPOINTMENT_REF:[^>]*-->/g, '').trim();
  };
  
  const [treatments, setTreatments] = useState([]);
  const [filteredTreatments, setFilteredTreatments] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [selectedTooth, setSelectedTooth] = useState('all');
  const [selectedProcedure, setSelectedProcedure] = useState('all');
  const [procedures, setProcedures] = useState([]);
  const [teeth, setTeeth] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDentalChart, setShowDentalChart] = useState(false);
  const [selectedToothInChart, setSelectedToothInChart] = useState(null);
  const [toothTreatments, setToothTreatments] = useState([]);
  const [patientProfile, setPatientProfile] = useState(null);
  const [dentalChart, setDentalChart] = useState(null);
  
  // Pagination states for treatment timeline
  const [treatmentCurrentPage, setTreatmentCurrentPage] = useState(1);
  const [treatmentItemsPerPage] = useState(5); // Fixed at 5 items per page
  
  // Medical Records States
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileData, setFileData] = useState(null);

  // Define bucket name for file uploads
  const BUCKET_NAME = 'patient-files';

  useEffect(() => {
    if (user) {
      fetchTreatmentHistory();
      fetchPatientProfile();
      fetchUploadedFiles();
      fetchDentalChart();
    }
  }, [user]);


  useEffect(() => {
    filterTreatments();
    setTreatmentCurrentPage(1); // Reset to first page when filters change
  }, [treatments, selectedFilter, customDateRange, selectedTooth, selectedProcedure]);

  useEffect(() => {
    if (selectedToothInChart) {
      const toothSpecificTreatments = treatments.filter(
        treatment => treatment.tooth_number === selectedToothInChart
      );
      setToothTreatments(toothSpecificTreatments);
    } else {
      setToothTreatments([]);
    }
  }, [selectedToothInChart, treatments]);

  const fetchPatientProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      setPatientProfile(data);
    } catch (error) {
      console.error('Error fetching patient profile:', error);
    }
  };

  const fetchUploadedFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('patient_files')
        .select('*')
        .eq('patient_id', user.id)
        .order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      setUploadedFiles(data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Failed to load your files');
    }
  };

  const fetchDentalChart = async () => {
    try {
      const { data, error } = await supabase
        .from('dental_charts')
        .select('*')
        .eq('patient_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      setDentalChart(data);
      console.log('Dental chart fetched:', data);
      if (data) {
        console.log('Dental chart teeth data:', data.teeth);
        console.log('Number of teeth with data:', data.teeth ? Object.keys(data.teeth).length : 0);
        if (data.teeth) {
          console.log('Sample teeth with symbols:', Object.entries(data.teeth).slice(0, 5));
        }
      }
    } catch (error) {
      console.error('Error fetching dental chart:', error);
      // Don't show error toast as dental chart might not exist yet
    }
  };
  
  const fetchTreatmentHistory = async () => {
    setIsLoading(true);
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
          doctor:doctor_id (id, full_name)
        `)
        .eq('patient_id', user.id)
        .order('treatment_date', { ascending: false });
      
      if (error) throw error;
      
      setTreatments(data || []);
      
      // Extract unique teeth
      const uniqueTeeth = [...new Set(data
        .filter(treatment => treatment.tooth_number)
        .map(treatment => treatment.tooth_number)
      )].sort((a, b) => a - b);
      
      setTeeth(['all', ...uniqueTeeth.map(tooth => tooth.toString())]);
      
      // Extract unique procedures
      const uniqueProcedures = [...new Set(data.map(treatment => treatment.procedure))].sort();
      
      setProcedures(['all', ...uniqueProcedures]);
    } catch (error) {
      console.error('Error fetching treatment history:', error);
      toast.error('Failed to load treatment history');
    } finally {
      setIsLoading(false);
    }
  };

  const filterTreatments = () => {
    let filtered = [...treatments];
    
    // Apply date filter
    if (selectedFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (selectedFilter) {
        case 'today':
          filtered = filtered.filter(treatment => {
            const treatmentDate = new Date(treatment.treatment_date);
            return treatmentDate >= today && treatmentDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
          });
          break;
        case 'week':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          filtered = filtered.filter(treatment => {
            const treatmentDate = new Date(treatment.treatment_date);
            return treatmentDate >= weekStart && treatmentDate <= weekEnd;
          });
          break;
        case 'month':
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          filtered = filtered.filter(treatment => {
            const treatmentDate = new Date(treatment.treatment_date);
            return treatmentDate >= monthStart && treatmentDate <= monthEnd;
          });
          break;
        case 'year':
          const yearStart = new Date(today.getFullYear(), 0, 1);
          const yearEnd = new Date(today.getFullYear(), 11, 31);
          filtered = filtered.filter(treatment => {
            const treatmentDate = new Date(treatment.treatment_date);
            return treatmentDate >= yearStart && treatmentDate <= yearEnd;
          });
          break;
        case 'custom':
          if (customDateRange.start && customDateRange.end) {
            const startDate = new Date(customDateRange.start);
            const endDate = new Date(customDateRange.end);
            filtered = filtered.filter(treatment => {
              const treatmentDate = new Date(treatment.treatment_date);
              return treatmentDate >= startDate && treatmentDate <= endDate;
            });
          }
          break;
      }
    }
    
    // Apply tooth filter
    if (selectedTooth !== 'all') {
      filtered = filtered.filter(treatment => 
        treatment.tooth_number && treatment.tooth_number.toString() === selectedTooth
      );
    }
    
    // Apply procedure filter
    if (selectedProcedure !== 'all') {
      filtered = filtered.filter(treatment => treatment.procedure === selectedProcedure);
    }
    
    setFilteredTreatments(filtered);
  };

  const formatDate = (dateStr) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
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

  const handleToothClick = (toothNumber) => {
    setSelectedToothInChart(toothNumber === selectedToothInChart ? null : toothNumber);
  };

  // Pagination helper functions for treatment timeline
  const getCurrentPageTreatments = () => {
    const startIndex = (treatmentCurrentPage - 1) * treatmentItemsPerPage;
    const endIndex = startIndex + treatmentItemsPerPage;
    return filteredTreatments.slice(startIndex, endIndex);
  };

  const getTotalTreatmentPages = () => {
    return Math.ceil(filteredTreatments.length / treatmentItemsPerPage);
  };

  const handleTreatmentPageChange = (page) => {
    setTreatmentCurrentPage(page);
  };

  // Enhanced print treatment history with professional styling and correct clinic info
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

    const logoBase64 = 'data:image/png;base64,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';

    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>My Dental Treatment History - ${patientProfile?.full_name || 'Patient'}</title>
        <style>
          @page {
            size: A4;
            margin: 0.75in 0.5in 0.5in 0.5in;
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            line-height: 1.4;
            color: #000000 !important;
            font-size: 12px;
          }
          * {
            color: #000000 !important;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 25px;
            background: #f8fafc;
            padding: 25px 20px;
            border-radius: 8px;
          }
          .clinic-logo {
            width: 80px;
            height: 80px;
            margin: 0 auto 15px auto;
            display: block;
          }
          .clinic-name {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 8px;
            color: #000000 !important;
          }
          .clinic-tagline {
            font-size: 14px;
            margin-bottom: 5px;
            color: #000000 !important;
          }
          .clinic-contact {
            font-size: 12px;
            color: #000000 !important;
            margin-bottom: 10px;
          }
          .report-title {
            font-size: 20px;
            font-weight: bold;
            margin: 15px 0 10px 0;
            color: #000000 !important;
          }
          
          .patient-card {
            background: #f8fafc;
            border: 2px solid #2563eb;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 25px;
          }
          .patient-card h2 {
            margin: 0 0 15px 0;
            color: #000000 !important;
            font-size: 16px;
            text-align: center;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 8px;
          }
          .patient-info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 12px;
            margin-bottom: 15px;
          }
          .info-item {
            background: white;
            padding: 8px 12px;
            border-radius: 4px;
            border-left: 4px solid #2563eb;
            font-size: 11px;
          }
          .info-label {
            font-weight: bold;
            color: #000000 !important;
          }
          .info-value {
            color: #000000 !important;
          }
          .report-meta {
            text-align: center;
            background: white;
            padding: 10px;
            border-radius: 4px;
            font-size: 11px;
            color: #000000 !important;
            border: 1px solid #e5e7eb;
          }
          
          .filters-applied {
            background: #e0f2fe;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 5px solid #0288d1;
          }
          .filters-applied h4 {
            margin-top: 0;
            color: #000000 !important;
            font-size: 14px;
          }
          .filter-item {
            background: white;
            display: inline-block;
            padding: 4px 8px;
            margin: 2px 4px 2px 0;
            border-radius: 4px;
            font-size: 11px;
            color: #000000 !important;
            border: 1px solid #e5e7eb;
          }
          
          .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1fr;
            gap: 15px;
            margin-bottom: 25px;
          }
          .stat-card {
            background: white;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
          }
          .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #000000 !important;
            margin-bottom: 5px;
          }
          .stat-label {
            font-size: 11px;
            color: #000000 !important;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .treatments-section {
            margin-top: 25px;
            page-break-inside: avoid;
          }
          .section-title {
            background: #2563eb;
            color: #ffffff !important;
            padding: 15px 25px;
            margin: 0 0 20px 0;
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            border-radius: 8px;
          }
          .treatment-timeline {
            position: relative;
            padding-left: 30px;
          }
          .timeline-line {
            position: absolute;
            left: 15px;
            top: 0;
            bottom: 0;
            width: 3px;
            background: #2563eb;
            border-radius: 2px;
          }
          .treatment-item {
            position: relative;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            page-break-inside: avoid;
          }
          .treatment-item::before {
            content: '🦷';
            position: absolute;
            left: -25px;
            top: 15px;
            width: 16px;
            height: 16px;
            background: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            border: 3px solid #2563eb;
          }
          .treatment-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f1f5f9;
          }
          .treatment-procedure {
            font-size: 14px;
            font-weight: bold;
            color: #000000 !important;
          }
          .treatment-date-badge {
            background: #2563eb;
            color: #ffffff !important;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: bold;
          }
          .treatment-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 10px;
          }
          .detail-item {
            background: #f8fafc;
            padding: 6px 10px;
            border-radius: 4px;
            border-left: 3px solid #2563eb;
            font-size: 11px;
          }
          .detail-label {
            font-weight: bold;
            color: #000000 !important;
          }
          .detail-value {
            color: #000000 !important;
          }
          .tooth-badge {
            background: #f59e0b;
            color: #ffffff !important;
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 10px;
            font-weight: bold;
            margin-left: 8px;
          }
          .notes-section {
            grid-column: 1 / -1;
            margin-top: 8px;
          }
          .notes-content {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 8px;
            font-style: italic;
            color: #000000 !important;
            font-size: 11px;
          }
          
          .empty-state {
            text-align: center;
            padding: 40px 20px;
            background: #f8fafc;
            border-radius: 8px;
            border: 2px dashed #cbd5e1;
          }
          .empty-icon {
            font-size: 36px;
            color: #000000 !important;
            margin-bottom: 15px;
          }
          .empty-title {
            color: #000000 !important;
            font-size: 16px;
            font-weight: bold;
            margin: 0 0 8px 0;
          }
          .empty-subtitle {
            color: #000000 !important;
            margin: 0;
            font-size: 12px;
          }
          
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #000000 !important;
            border-top: 2px solid #e5e7eb;
            padding-top: 15px;
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            page-break-inside: avoid;
          }
          .footer-logo {
            font-size: 14px;
            font-weight: bold;
            color: #000000 !important;
            margin-bottom: 5px;
          }
          .footer-tagline {
            font-style: italic;
            margin-bottom: 5px;
            color: #000000 !important;
          }
          
          @media print {
            body { 
              margin: 0; 
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .no-print { display: none; }
            .page-break { page-break-before: always; }
            .treatments-section { page-break-inside: avoid; }
            .treatment-item { page-break-inside: avoid; }
            .footer { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="src/assets/Logo.png" alt="Silario Dental Clinic Logo" class="clinic-logo" />
          <div class="clinic-name">SILARIO DENTAL CLINIC</div>
          <div class="clinic-tagline">Your Trusted Partner in Dental Care</div>
          <div class="clinic-contact">📧 silariodental@gmail.com | 📞 +63 919 123 4567 | 📍 Cabugao & San Juan, Ilocos Sur</div>
          <div class="clinic-contact">🕒 Mon-Fri 8AM-5PM | Sat 8AM-12PM (Cabugao) | Sun 1PM-5PM (San Juan)</div>
          <div class="report-title">PERSONAL DENTAL TREATMENT HISTORY</div>
        </div>

        <div class="patient-card">
          <h2>👤 Patient Information</h2>
          <div class="patient-info-grid">
            <div class="info-item">
              <div class="info-label">Full Name:</div>
              <div class="info-value">${patientProfile?.full_name || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Patient ID:</div>
              <div class="info-value">${patientProfile?.id ? patientProfile.id.substring(0, 8) : 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Date of Birth:</div>
              <div class="info-value">${patientProfile?.birthday ? formatDate(patientProfile.birthday) : 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Age:</div>
              <div class="info-value">${patientProfile?.birthday ? calculateAge(patientProfile.birthday) + ' years' : 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Gender:</div>
              <div class="info-value">${patientProfile?.gender ? patientProfile.gender.charAt(0).toUpperCase() + patientProfile.gender.slice(1) : 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Contact:</div>
              <div class="info-value">${patientProfile?.phone || 'N/A'}</div>
            </div>
          </div>
          <div class="report-meta">
            📧 ${patientProfile?.email || 'N/A'} | 📍 ${patientProfile?.address || 'N/A'} | 📅 Report Generated: ${currentDate}
          </div>
        </div>

        ${getActiveFiltersText()}

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${filteredTreatments.length}</div>
            <div class="stat-label">Total Treatments</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${new Set(filteredTreatments.map(t => t.procedure)).size}</div>
            <div class="stat-label">Different Procedures</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${new Set(filteredTreatments.filter(t => t.tooth_number).map(t => t.tooth_number)).size}</div>
            <div class="stat-label">Teeth Treated</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${new Set(filteredTreatments.map(t => t.doctor?.full_name)).size}</div>
            <div class="stat-label">Attending Doctors</div>
          </div>
        </div>

        <div class="treatments-section">
          <div class="section-title">📋 Complete Treatment History Timeline</div>
          
          ${filteredTreatments.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">📋</div>
              <div class="empty-title">No Treatment Records Found</div>
              <div class="empty-subtitle">${treatments.length === 0 ? 'You have no recorded treatments yet.' : 'No records match your current filters.'}</div>
            </div>
          ` : `
            <div class="treatment-timeline">
              <div class="timeline-line"></div>
              ${filteredTreatments.map((treatment, index) => `
                <div class="treatment-item">
                  <div class="treatment-header">
                    <div class="treatment-procedure">
                      ${treatment.procedure || 'Unspecified Procedure'}
                      ${treatment.tooth_number ? `<span class="tooth-badge">Tooth #${treatment.tooth_number}</span>` : ''}
                    </div>
                    <div class="treatment-date-badge">📅 ${formatDate(treatment.treatment_date)}</div>
                  </div>
                  
                  <div class="treatment-details">
                    ${treatment.diagnosis ? `
                      <div class="detail-item">
                        <div class="detail-label">🔬 Treatment Plan:</div>
                        <div class="detail-value">${treatment.diagnosis}</div>
                      </div>
                    ` : ''}
                    
                    <div class="detail-item">
                      <div class="detail-label">👨‍⚕️ Doctor:</div>
                      <div class="detail-value">Dr. ${treatment.doctor?.full_name || 'Unknown'}</div>
                    </div>
                    
                    ${treatment.notes ? `
                      <div class="detail-item notes-section">
                        <div class="detail-label">📝 Notes:</div>
                        <div class="notes-content">${cleanNotesForDisplay(treatment.notes)}</div>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="footer">
          <div class="footer-logo">🦷 SILARIO DENTAL CLINIC</div>
          <div class="footer-tagline">Your Trusted Partner in Comprehensive Dental Care</div>
          <p>Professional Dental Services | Modern Technology | Compassionate Care</p>
          <p>📍 Cabugao Branch: Mon-Fri 8AM-12PM, Sat 8AM-5PM | San Juan Branch: Mon-Fri 1PM-5PM, Sun 8AM-5PM</p>
          <p>📞 Emergency Hotline: +63 919 123 4567 | 📧 silariodental@gmail.com</p>
          <p><strong>📋 Personal Treatment History Report</strong> - Generated on ${currentDate}</p>
          <p style="font-size: 9px; margin-top: 8px;">
            🔒 <strong>Confidential Medical Document:</strong> This report contains personal dental information. Keep secure and confidential.
          </p>
        </div>
      </body>
      </html>
    `;

    // Helper function to get active filters text
    function getActiveFiltersText() {
      const hasFilters = selectedFilter !== 'all' || selectedTooth !== 'all' || selectedProcedure !== 'all';
      
      if (!hasFilters) return '';
      
      let filtersText = `
        <div class="filters-applied">
          <h4>🔍 Applied Filters:</h4>
      `;
      
      if (selectedFilter !== 'all') {
        const filterLabels = {
          'today': 'Today',
          'week': 'This Week',
          'month': 'This Month', 
          'year': 'This Year',
          'custom': `Custom Range (${customDateRange.start} to ${customDateRange.end})`
        };
        filtersText += `<span class="filter-item">📅 Period: ${filterLabels[selectedFilter]}</span>`;
      }
      
      if (selectedTooth !== 'all') {
        filtersText += `<span class="filter-item">🦷 Tooth: #${selectedTooth}</span>`;
      }
      
      if (selectedProcedure !== 'all') {
        filtersText += `<span class="filter-item">⚕️ Procedure: ${selectedProcedure}</span>`;
      }
      
      filtersText += `
        </div>
      `;
      
      return filtersText;
    }

    reportWindow.document.write(reportHTML);
    reportWindow.document.close();
    
    // Wait for content to load then print
    reportWindow.onload = function() {
      setTimeout(() => {
        reportWindow.print();
        reportWindow.onafterprint = function() {
          setTimeout(() => {
            reportWindow.close();
          }, 1000);
        };
      }, 500);
    };
    
    toast.success('Opening print dialog...');
  };

  // Enhanced download function
  const downloadTreatmentHistory = () => {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let content = `SILARIO DENTAL CLINIC\n`;
    content += `Your Trusted Partner in Dental Care\n`;
    content += `Email: silariodental@gmail.com | Phone: +63 919 123 4567\n`;
    content += `Cabugao & San Juan Branches, Ilocos Sur\n`;
    content += `Mon-Fri 8AM-5PM | Sat 8AM-12PM (Cabugao) | Sun 1PM-5PM (San Juan)\n\n`;
    content += `PERSONAL DENTAL TREATMENT HISTORY\n`;
    content += `${'='.repeat(60)}\n\n`;
    
    content += `PATIENT INFORMATION:\n`;
    content += `Name: ${patientProfile?.full_name || 'N/A'}\n`;
    content += `Patient ID: ${patientProfile?.id ? patientProfile.id.substring(0, 8) : 'N/A'}\n`;
    content += `Date of Birth: ${patientProfile?.birthday ? formatDate(patientProfile.birthday) : 'N/A'}\n`;
    content += `Age: ${patientProfile?.birthday ? calculateAge(patientProfile.birthday) + ' years' : 'N/A'}\n`;
    content += `Gender: ${patientProfile?.gender ? patientProfile.gender.charAt(0).toUpperCase() + patientProfile.gender.slice(1) : 'N/A'}\n`;
    content += `Contact: ${patientProfile?.phone || 'N/A'}\n`;
    content += `Email: ${patientProfile?.email || 'N/A'}\n`;
    content += `Address: ${patientProfile?.address || 'N/A'}\n`;
    content += `Report Generated: ${currentDate}\n\n`;

    // Add filter information
    const hasFilters = selectedFilter !== 'all' || selectedTooth !== 'all' || selectedProcedure !== 'all';
    if (hasFilters) {
      content += `APPLIED FILTERS:\n`;
      if (selectedFilter !== 'all') {
        const filterLabels = {
          'today': 'Today',
          'week': 'This Week',
          'month': 'This Month', 
          'year': 'This Year',
          'custom': `Custom Range (${customDateRange.start} to ${customDateRange.end})`
        };
        content += `- Period: ${filterLabels[selectedFilter]}\n`;
      }
      if (selectedTooth !== 'all') content += `- Tooth Number: #${selectedTooth}\n`;
      if (selectedProcedure !== 'all') content += `- Procedure Type: ${selectedProcedure}\n`;
      content += `\n`;
    }

    content += `TREATMENT STATISTICS:\n`;
    content += `- Total Treatments: ${filteredTreatments.length}\n`;
    content += `- Different Procedures: ${new Set(filteredTreatments.map(t => t.procedure)).size}\n`;
    content += `- Teeth Treated: ${new Set(filteredTreatments.filter(t => t.tooth_number).map(t => t.tooth_number)).size}\n`;
    content += `- Attending Doctors: ${new Set(filteredTreatments.map(t => t.doctor?.full_name)).size}\n\n`;

    content += `COMPLETE TREATMENT HISTORY:\n`;
    content += `${'='.repeat(60)}\n\n`;

    if (filteredTreatments.length === 0) {
      content += `No treatment records found${hasFilters ? ' with the applied filters' : ''}.\n`;
      if (treatments.length === 0) {
        content += `You have no recorded treatments yet. Your treatment history will appear here after your first dental appointment.\n`;
      }
    } else {
      filteredTreatments.forEach((treatment, index) => {
        content += `${index + 1}. ${treatment.procedure || 'Unspecified Procedure'}\n`;
        content += `   Date: ${formatDate(treatment.treatment_date)}\n`;
        if (treatment.tooth_number) content += `   Tooth Number: #${treatment.tooth_number}\n`;
        if (treatment.diagnosis) content += `   Diagnosis: ${treatment.diagnosis}\n`;
        if (treatment.notes) content += `   Treatment Notes: ${cleanNotesForDisplay(treatment.notes)}\n`;
        content += `   Attending Doctor: Dr. ${treatment.doctor?.full_name || 'Unknown'}\n`;
        content += `   ${'-'.repeat(50)}\n\n`;
      });
    }

    content += `\n${'='.repeat(60)}\n`;
    content += `END OF TREATMENT HISTORY REPORT\n\n`;
    content += `Silario Dental Clinic\n`;
    content += `Your Trusted Partner in Comprehensive Dental Care\n`;
    content += `Cabugao & San Juan Branches, Ilocos Sur\n`;
    content += `Emergency Hotline: +63 919 123 4567\n`;
    content += `Email: silariodental@gmail.com\n`;
    content += `Generated on ${currentDate}\n\n`;
    content += `CONFIDENTIAL MEDICAL DOCUMENT\n`;
    content += `This report contains personal dental information.\n`;
    content += `Please keep it secure and confidential.`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dental_history_${patientProfile?.full_name?.replace(/\s+/g, '_') || 'patient'}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('📱 Treatment history downloaded successfully!');
  };

  // File upload handler (restored to previous working logic)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setIsUploading(true);
      const toastId = toast.info('Uploading file...', { autoClose: false });
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const timestamp = Date.now();
      const filePath = `${user.id}/${timestamp}_${sanitizedFileName}`;
      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
      if (uploadError) throw uploadError;
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);
      // Save file record in database
      const { error: recordError } = await supabase
        .from('patient_files')
        .insert([{
          patient_id: user.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_path: filePath,
          file_url: publicUrl,
          uploaded_at: new Date().toISOString(),
          uploaded_by: user.id
        }]);
      if (recordError) throw recordError;
      toast.update(toastId, {
        render: 'File uploaded successfully',
        type: 'success',
        autoClose: 3000
      });
      fetchUploadedFiles();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(`Failed to upload file: ${error.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = null;
    }
  };

  // File view handler (restored to previous working logic)
  const handleViewFile = async (file) => {
    setFilePreview(file);
    setFileData(null);
    try {
      // Prefer public URL (works without RLS SELECT policy)
      const { data: pub } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(file.file_path);
      if (pub?.publicUrl) {
        const res = await fetch(`${pub.publicUrl}?t=${Date.now()}`);
        if (res.ok) {
          const blob = await res.blob();
          setFileData(blob);
          return;
        }
      }
      // Fallback 0.5: create a short-lived signed URL and fetch it
      try {
        const { data: signed } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(file.file_path, 60);
        if (signed?.signedUrl) {
          const resSigned = await fetch(`${signed.signedUrl}`);
          if (resSigned.ok) {
            const blob = await resSigned.blob();
            setFileData(blob);
            return;
          }
        }
      } catch (_) {}
      // Fallback 1: direct download via Supabase API (requires SELECT policy on storage.objects)
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(file.file_path);
      if (!error && data) {
        const blob = data instanceof Response ? await data.blob() : data;
        setFileData(blob);
        return;
      }
      // Fallback 2: use stored file_url from DB if present
      if (file.file_url) {
        const res2 = await fetch(`${file.file_url}?t=${Date.now()}`);
        if (res2.ok) {
          const blob = await res2.blob();
          setFileData(blob);
          return;
        }
      }
      throw new Error('All download methods failed');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error(`Failed to download file: ${error.message}`);
    }
  };

  // File delete handler
  const handleFileDelete = async (file) => {
    setFileToDelete(file);
  };

  const confirmFileDelete = async () => {
    if (!fileToDelete) return;
    
    try {
      setIsDeleting(true);
      
      const toastId = toast.info('Deleting file...', { autoClose: false });
      
      // Delete from storage
      await supabase.storage
        .from(BUCKET_NAME)
        .remove([fileToDelete.file_path]);
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('patient_files')
        .delete()
        .eq('id', fileToDelete.id);
      
      if (dbError) throw dbError;
      
      toast.update(toastId, {
        render: 'File deleted successfully',
        type: 'success',
        autoClose: 3000
      });
      
      setUploadedFiles(uploadedFiles.filter(f => f.id !== fileToDelete.id));
      
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file: ' + error.message);
    } finally {
      setIsDeleting(false);
      setFileToDelete(null);
    }
  };

  // Helper functions
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
    else return (bytes / 1073741824).toFixed(2) + ' GB';
  };

  const isFileType = (file, type) => {
    if (!file || !file.file_type) return false;
    
    if (type === 'image') return file.file_type.includes('image');
    if (type === 'pdf') return file.file_type.includes('pdf');
    if (type === 'word') return file.file_type.includes('application/msword') || file.file_type.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    if (type === 'text') return file.file_type.includes('text');
    
    return false;
  };

  const createViewUrl = (fileBlob) => {
    if (!fileBlob) return null;
    return URL.createObjectURL(fileBlob);
  };

  const saveFile = (fileBlob, fileName) => {
    if (!fileBlob) {
      toast.error('No file data available');
      return;
    }
    
    // Detect mobile browsers and messaging apps
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isInApp = /FBAN|FBAV|Instagram|Line|WhatsApp|Telegram|Messenger/i.test(navigator.userAgent);
    
    try {
      // Method 1: Try direct download with enhanced mobile support
      const blobUrl = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || 'download';
      a.style.display = 'none';
      
      // Add mobile-specific attributes
      if (isMobile) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
      
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 100);
      
      // Show success message with mobile-specific instructions
      if (isMobile || isInApp) {
        toast.success('Download started! If the file opens in browser, use the browser menu to save it.', {
          autoClose: 8000,
          hideProgressBar: false
        });
      } else {
        toast.success('File download started');
      }
      
    } catch (error) {
      console.error('Download failed:', error);
      
      // Fallback method for mobile/messaging apps
      if (isMobile || isInApp) {
        // Create a new window with download instructions
        const downloadWindow = window.open('', '_blank');
        if (downloadWindow) {
          downloadWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Download ${fileName || 'File'}</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  margin: 0; padding: 20px; background: #f5f5f5;
                  text-align: center; line-height: 1.6;
                }
                .container { 
                  max-width: 400px; margin: 50px auto; 
                  background: white; padding: 30px; border-radius: 12px;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                }
                .icon { font-size: 48px; margin-bottom: 20px; }
                .btn { 
                  display: inline-block; background: #4F46E5; color: white; 
                  padding: 12px 24px; text-decoration: none; border-radius: 8px; 
                  margin: 10px; font-weight: 500;
                }
                .btn:hover { background: #4338CA; }
                .instructions { 
                  background: #F3F4F6; padding: 15px; border-radius: 8px; 
                  margin: 20px 0; text-align: left; font-size: 14px;
                }
                .step { margin: 8px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="icon">📱</div>
                <h2>Download ${fileName || 'Your File'}</h2>
                <p>To download this file on mobile:</p>
                <div class="instructions">
                  <div class="step">1. Tap the download button below</div>
                  <div class="step">2. If it opens in browser, tap the share button</div>
                  <div class="step">3. Select "Save to Files" or "Download"</div>
                  <div class="step">4. Choose your preferred location</div>
                </div>
                <a href="${URL.createObjectURL(fileBlob)}" download="${fileName || 'download'}" class="btn">
                  📥 Download File
                </a>
                <br>
                <a href="javascript:window.close()" class="btn" style="background: #6B7280;">
                  ✕ Close
                </a>
              </div>
            </body>
            </html>
          `);
          downloadWindow.document.close();
        }
        
        toast.info('Download instructions opened in new tab', {
          autoClose: 5000
        });
      } else {
        toast.error('Download failed. Please try again.');
      }
    }
  };


  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 rounded-xl shadow-xl p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <FiActivity className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">My Treatment History</h1>
              <p className="text-blue-100 text-lg">Personal dental care journey and records</p>
              <div className="flex items-center space-x-4 mt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white bg-opacity-20 backdrop-blur-sm">
                  <FiUser className="w-4 h-4 mr-2" />
                  {patientProfile?.full_name || 'Patient'}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white bg-opacity-20 backdrop-blur-sm">
                  <FiFileText className="w-4 h-4 mr-2" />
                  {treatments.length} Total Records
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 md:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={downloadTreatmentHistory}
              className="inline-flex items-center px-6 py-3 border border-white border-opacity-30 text-sm font-medium rounded-lg text-white bg-white bg-opacity-20 hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white backdrop-blur-sm transition-all duration-200"
            >
              <FiDownload className="mr-2 -ml-1 h-5 w-5" />
              Download Report
            </button>
            <button
              onClick={printTreatmentHistory}
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-blue-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg"
            >
              <FiPrinter className="mr-2 -ml-1 h-5 w-5" />
              Print History
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-blue-500 text-white">
              <FiFileText className="h-8 w-8" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-blue-900">Total Treatments</p>
              <p className="text-3xl font-bold text-blue-600">{treatments.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-2 border-green-200 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-500 text-white">
              <FiActivity className="h-8 w-8" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-green-900">Procedures Types</p>
              <p className="text-3xl font-bold text-green-600">{new Set(treatments.map(t => t.procedure)).size}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border-2 border-yellow-200 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-yellow-500 text-white">
              <FiUser className="h-8 w-8" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-yellow-900">Teeth Treated</p>
              <p className="text-3xl font-bold text-yellow-600">{new Set(treatments.filter(t => t.tooth_number).map(t => t.tooth_number)).size}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-200 shadow-lg">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-purple-500 text-white">
              <FiClock className="h-8 w-8" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-purple-900">Last Visit</p>
              <p className="text-sm font-bold text-purple-600">
                {treatments.length > 0 ? formatDate(treatments[0].treatment_date) : 'No visits yet'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <FiFilter className="h-6 w-6 text-gray-400 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Filter Treatment History</h2>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label htmlFor="date-filter" className="block text-sm font-semibold text-gray-700 mb-2">
                📅 Filter by Date
              </label>
              <select
                id="date-filter"
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="block w-full px-4 py-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
              >
                <option value="all">📅 All Time</option>
                <option value="today">📅 Today</option>
                <option value="week">📅 This Week</option>
                <option value="month">📅 This Month</option>
                <option value="year">📅 This Year</option>
                <option value="custom">📅 Custom Range</option>
              </select>
            </div>
            
            {selectedFilter === 'custom' && (
              <>
                <div>
                  <label htmlFor="start-date" className="block text-sm font-semibold text-gray-700 mb-2">
                    📅 Start Date
                  </label>
                  <input
                    type="date"
                    id="start-date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange({...customDateRange, start: e.target.value})}
                    className="block w-full px-4 py-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  />
                </div>
                <div>
                  <label htmlFor="end-date" className="block text-sm font-semibold text-gray-700 mb-2">
                    📅 End Date
                  </label>
                  <input
                    type="date"
                    id="end-date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange({...customDateRange, end: e.target.value})}
                    className="block w-full px-4 py-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  />
                </div>
              </>
            )}
            
            <div>
              <label htmlFor="tooth-filter" className="block text-sm font-semibold text-gray-700 mb-2">
                🦷 Filter by Tooth
              </label>
              <select
                id="tooth-filter"
                value={selectedTooth}
                onChange={(e) => setSelectedTooth(e.target.value)}
                className="block w-full px-4 py-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
              >
                {teeth.map(tooth => (
                  <option key={tooth} value={tooth}>
                    {tooth === 'all' ? '🦷 All Teeth' : `🦷 Tooth #${tooth}`}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="procedure-filter" className="block text-sm font-semibold text-gray-700 mb-2">
                ⚕️ Filter by Procedure
              </label>
              <select
                id="procedure-filter"
                value={selectedProcedure}
                onChange={(e) => setSelectedProcedure(e.target.value)}
                className="block w-full px-4 py-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
              >
                {procedures.map(procedure => (
                  <option key={procedure} value={procedure}>
                    {procedure === 'all' ? '⚕️ All Procedures' : `⚕️ ${procedure}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {(selectedFilter !== 'all' || selectedTooth !== 'all' || selectedProcedure !== 'all') && (
            <div className="mt-6 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border-2 border-blue-200">
              <div className="flex items-center space-x-4">
                <FiFilter className="h-5 w-5 text-blue-600" />
                <div className="text-sm">
                  <span className="font-semibold text-blue-900">Filters Active:</span>
                  <span className="text-blue-700 ml-2">
                    Showing {filteredTreatments.length} of {treatments.length} records
                  </span>
                </div>
              </div>
                <button
                  onClick={() => {
                    setSelectedFilter('all');
                    setSelectedTooth('all');
                    setSelectedProcedure('all');
                    setCustomDateRange({ start: '', end: '' });
                    setTreatmentCurrentPage(1);
                  }}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-white border-2 border-blue-200 rounded-lg hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
              >
                <FiX className="w-4 h-4 mr-2" />
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Treatment Records */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <FiFileText className="w-6 h-6 mr-3 text-gray-600" />
            Treatment Records Timeline
          </h2>
        </div>
        
        <div className="p-6">
          {filteredTreatments.length > 0 ? (
            <div className="space-y-6">
              {getCurrentPageTreatments().map((treatment, index) => (
                <div key={treatment.id} className="relative bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                  {index < getCurrentPageTreatments().length - 1 && (
                    <div className="absolute left-8 top-20 w-0.5 h-8 bg-gradient-to-b from-blue-400 to-blue-600"></div>
                  )}
                  
                  <div className="absolute left-6 top-6 w-4 h-4 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border-2 border-white shadow-lg"></div>
                  
                  <div className="pl-12">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-xl font-bold text-gray-900">{treatment.procedure}</h3>
                        {treatment.tooth_number && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-sm">
                            🦷 Tooth #{treatment.tooth_number}
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg mt-2 sm:mt-0">
                        📅 {formatDate(treatment.treatment_date)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      {treatment.diagnosis && (
                        <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-400">
                          <p className="text-sm font-semibold text-blue-900 mb-1">🔬 Treatment Plan</p>
                          <p className="text-blue-800">{treatment.diagnosis}</p>
                        </div>
                      )}
                      
                      <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-400">
                        <p className="text-sm font-semibold text-green-900 mb-1">👨‍⚕️ Attending Doctor</p>
                        <p className="text-green-800">Dr. {treatment.doctor?.full_name || 'Unknown'}</p>
                      </div>
                    </div>
                    
                    {treatment.notes && (
                      <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-gray-400">
                        <p className="text-sm font-semibold text-gray-900 mb-2">📝 Treatment Notes</p>
                        <p className="text-gray-700 italic">{cleanNotesForDisplay(treatment.notes)}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Pagination Controls */}
              {getTotalTreatmentPages() > 1 && (
                <div className="mt-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
                  <div className="text-sm text-gray-700 font-medium">
                    Page {treatmentCurrentPage} of {getTotalTreatmentPages()} • Showing {getCurrentPageTreatments().length} of {filteredTreatments.length} treatments
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleTreatmentPageChange(treatmentCurrentPage - 1)}
                      disabled={treatmentCurrentPage === 1}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Previous
                    </button>
                    
                    {/* Page Numbers */}
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: getTotalTreatmentPages() }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => handleTreatmentPageChange(page)}
                          className={`w-10 h-10 flex items-center justify-center text-sm font-medium rounded-lg transition-all duration-200 ${
                            treatmentCurrentPage === page
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                              : 'text-gray-700 bg-white border border-gray-300 hover:bg-blue-50 hover:border-blue-300'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => handleTreatmentPageChange(treatmentCurrentPage + 1)}
                      disabled={treatmentCurrentPage === getTotalTreatmentPages()}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                    >
                      Next
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                <FiFileText className="w-12 h-12 text-gray-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {treatments.length === 0 ? 'No Treatment Records Yet' : 'No Records Match Your Filters'}
              </h3>
              <p className="text-lg text-gray-600 mb-6">
                {treatments.length === 0 
                  ? 'Your treatment history will appear here after your first dental appointment.'
                  : 'Try adjusting your filters to see more results, or clear all filters to view your complete history.'
                }
              </p>
              {(selectedFilter !== 'all' || selectedTooth !== 'all' || selectedProcedure !== 'all') && (
                <button
                  onClick={() => {
                    setSelectedFilter('all');
                    setSelectedTooth('all');
                    setSelectedProcedure('all');
                    setCustomDateRange({ start: '', end: '' });
                    setTreatmentCurrentPage(1);
                  }}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg"
                >
                  <FiEye className="mr-2 -ml-1 h-5 w-5" />
                  View All Records
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Dental Chart Section */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center mr-3">
              <FiUser className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Interactive Dental Chart</h2>
              <p className="text-sm text-gray-600">Visual overview of your dental treatment history</p>
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/patient/dental-chart'}
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
          >
            <FiEdit className="mr-2 -ml-1 h-5 w-5" />
            View/Edit My Dental Chart
          </button>
        </div>
        {showDentalChart ? (
          <div className="p-6">
            <ModernDentalChart
              treatments={treatments}
              dentalChart={dentalChart?.chart_data || dentalChart}
              chartSymbols={enhancedChartSymbols}
              onToothClick={(toothNumber, toothData) => {
                setSelectedToothInChart(toothNumber === selectedToothInChart ? null : toothNumber);
                const treatmentCount = toothData?.treatmentCount || 0;
                const symbolInfo = toothData?.symbolData?.name || 'Healthy';
                
                if (treatmentCount > 0) {
                  toast.info(`Tooth ${toothNumber}: ${treatmentCount} treatment(s) | Condition: ${symbolInfo}`, {
                    autoClose: 4000
                  });
                } else {
                  toast.info(`Tooth ${toothNumber}: No treatments | Condition: ${symbolInfo}`, {
                    autoClose: 3000
                  });
                }
              }}
              selectedTeeth={[]}
              selectedTooth={selectedToothInChart}
              role="patient"
              editMode={false}
              patientId={user?.id}
              onDentalChartUpdate={(updatedChart) => {
                setDentalChart(updatedChart);
              }}
            />

            {/* Selected Tooth Treatment Details */}
            {selectedToothInChart && (
              <div className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl overflow-hidden shadow-lg">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 text-white">
                  <h3 className="font-bold text-xl flex items-center">
                    <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-3">
                      🦷
                    </div>
                    Tooth #{selectedToothInChart} Treatment History
                  </h3>
                </div>
                
                <div className="p-6">
                  {toothTreatments.length > 0 ? (
                    <div className="space-y-4">
                      {toothTreatments.map(treatment => (
                        <div key={treatment.id} className="bg-white p-6 rounded-lg border-2 border-blue-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="font-bold text-lg text-gray-800">{treatment.procedure}</h4>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                              📅 {formatDate(treatment.treatment_date)}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {treatment.diagnosis && (
                              <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-400">
                                <span className="font-semibold text-blue-900 text-sm">🔬 Treatment Plan:</span>
                                <p className="text-blue-800 mt-1">{treatment.diagnosis}</p>
                              </div>
                            )}
                            <div className="bg-green-50 rounded-lg p-3 border-l-4 border-green-400">
                              <span className="font-semibold text-green-900 text-sm">👨‍⚕️ Doctor:</span>
                              <p className="text-green-800 mt-1">Dr. {treatment.doctor?.full_name || 'Unknown'}</p>
                            </div>
                          </div>
                          {treatment.notes && (
                            <div className="mt-4 bg-gray-50 rounded-lg p-3 border-l-4 border-gray-400">
                              <span className="font-semibold text-gray-900 text-sm">📝 Notes:</span>
                              <p className="text-gray-700 mt-1 italic">{cleanNotesForDisplay(treatment.notes)}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-8 text-center border-2 border-dashed border-gray-300">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                        <FiFileText className="w-8 h-8 text-gray-500" />
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2">No Treatment History</h4>
                      <p className="text-gray-600">This tooth has no recorded treatments yet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center">
                <FiUser className="w-12 h-12 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Interactive Dental Chart</h3>
              <p className="text-gray-600 text-lg mb-6">
                Click "View Chart" to see your dental treatment history and manage your medical documents.
              </p>
              <button
                onClick={() => setShowDentalChart(true)}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200 shadow-lg"
              >
                <FiEye className="mr-2 -ml-1 h-5 w-5" />
                View Chart & Records
              </button>
            </div>
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {filePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                {filePreview.file_name}
                <span className="ml-2 text-sm text-gray-500">
                  ({formatFileSize(filePreview.file_size)})
                </span>
              </h3>
              <button
                onClick={() => setFilePreview(null)}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              {!fileData ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-center text-gray-600">Loading file...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  {isFileType(filePreview, 'image') ? (
                    <img 
                      src={createViewUrl(fileData)}
                      alt={filePreview.file_name}
                      className="max-w-full max-h-[60vh] object-contain"
                    />
                  ) : isFileType(filePreview, 'pdf') ? (
                    <object
                      data={createViewUrl(fileData)}
                      type="application/pdf"
                      width="100%"
                      height="60vh"
                      className="border border-gray-200"
                    >
                      <p className="text-center p-4">
                        PDF viewer not supported. 
                        <button 
                          onClick={() => saveFile(fileData, filePreview.file_name)}
                          className="ml-2 text-primary-600 hover:underline"
                        >
                          Download PDF
                        </button>
                      </p>
                    </object>
                  ) : (
                    <div className="text-center py-8">
                      <FiFileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">File Ready</h4>
                      <p className="text-gray-600 mb-4">This file type cannot be previewed in browser.</p>
                      <button
                        onClick={() => saveFile(fileData, filePreview.file_name)}
                        className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        <FiDownload className="mr-2 h-4 w-4" />
                        Download File
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200">
              <div className="flex justify-center space-x-4">
                {fileData && (
                  <button
                    onClick={() => saveFile(fileData, filePreview.file_name)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <FiDownload className="mr-2 h-4 w-4" />
                    Download
                  </button>
                )}
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
              Are you sure you want to delete "{fileToDelete.file_name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmFileDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-300"
                disabled={isDeleting}
              >
                {isDeleting ? (
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

export default History;