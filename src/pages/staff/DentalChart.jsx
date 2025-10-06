// src/pages/staff/DentalChart.jsx - Staff Dental Chart with Enhanced Connection Handling
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiSave, FiPrinter, FiDownload, FiEdit, FiEye, FiX, FiActivity } from 'react-icons/fi';
import { toast } from 'react-toastify';
import supabase, { getCurrentUser, getCurrentUserProfile, handleSupabaseError } from '../../config/supabaseClient';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ModernDentalChart from '../../components/common/ModernDentalChart';
import PDFGenerator from '../../components/common/PDFGenerator';
import StandardizedPrinter from '../../components/common/StandardizedPrinter';
import DatePicker from '../../components/common/DatePicker';

const DentalChart = ({ editMode: propEditMode }) => {
  const { pathname } = useLocation();
  const routeEditMode = propEditMode !== undefined ? propEditMode : pathname.endsWith('/edit');
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dentalChart, setDentalChart] = useState({});
  const [originalDentalChart, setOriginalDentalChart] = useState({});
  const [originalPatient, setOriginalPatient] = useState(null);
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [editMode, setEditMode] = useState(routeEditMode); // Mirror patient behavior and allow route-controlled edit
  
  // Treatment History States for ModernDentalChart
  const [treatments, setTreatments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [procedureFilter, setProcedureFilter] = useState('');
  const [toothFilter, setToothFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState({ start: '', end: '' });
  const [filteredTreatments, setFilteredTreatments] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [userProfile, setUserProfile] = useState(null);

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

  // Medical History Questions
const physicianInfo = [
  'Office number'
];

const medicalHistory = [
  'Are you in good health?',
  'Are you under medical treatment now? If so, what is the condition being treated?',
  'Have you ever had serious illness or surgical operation? If so, what illness or operation?',
  'Have you ever been hospitalized? If so, when and why?',
  'Are you taking any prescription/non-prescription medication?',
  'Do you use tobacco products?',
  'Do you use alcohol, cocaine or other dangerous drugs?',
  'Are you allergic to Local Anesthetic or Sulfa Drug?',
  'Bleeding time?',
  'For women only:',
  'Blood type:',
  'Blood pressure:',
  'Do you have any of the following? Check which apply:'
];

const womenOnlyQuestions = [
  'Are you pregnant?',
  'Are you nursing?',
  'Are you taking birth control pills?'
];

  const medicalConditions = [
    'High Blood Pressure', 'Low Blood Pressure', 'Epilepsy / Convulsions', 'AIDS or HIV Infection',
    'Sexually Transmitted Disease', 'Stomach Trouble / Ulcer', 'Fainting Seizure', 'Rapid Weight Loss',
    'Radiation Therapy', 'Joint Replacement / Implant', 'Heart Surgery', 'Heart Attack',
    'Heart Disease', 'Heart Murmur', 'Hepatitis / Liver Disease', 'Rheumatic Fever',
    'Hay Fever / Allergies', 'Respiratory Problems', 'Hepatitis / Jaundice', 'Tuberculosis',
    'Swollen ankles', 'Kidney Disease', 'Diabetes', 'Chest Pain', 'Stroke',
    'Cancer / Tumors', 'Anemia', 'Angina', 'Asthma', 'Emphysema', 'Bleeding Problems',
    'Blood Diseases', 'Head Injuries', 'Arthritis / Rheumatism', 'Other'
  ];

const dentalHistory = [
  'Previous dentist dr.',
  'Last dental visit'
];

  const conditions = {
    'Gingivitis': false,
    'Early Periodontitis': false,
    'Moderate Periodontitis': false,
    'Advanced Periodontitis': false,
    'Cervical': false,
    'Chronic': false,
    'Operative': false,
    'Relative Periodontal': false,
    'Composite': false
  };

  const applications = {
    'Preventive': false,
    'Restorative': false,
    'Extraction': false,
    'Operative': false,
    'Bleaching': false,
    'Cosmetic': false
  };

  const tmdConditions = {
    'Clenching': false,
    'Clicking': false,
    'Locking': false,
    'Muscle Spasm': false
  };

  // Connection and authentication validation
  const validateConnection = async () => {
    try {
      setConnectionStatus('checking');
      
      // Test basic connection
      const { error: connectionError } = await supabase
        .from('profiles')
        .select('count', { count: 'exact', head: true });
      
      if (connectionError) {
        console.error('Connection test failed:', connectionError);
        setConnectionStatus('failed');
        toast.error('Database connection failed. Please check your internet connection.');
        return false;
      }

      // Check authentication
      const user = await getCurrentUser();
      if (!user) {
        console.error('No authenticated user found');
        setConnectionStatus('unauthorized');
        toast.error('Please log in to access the dental chart.');
        navigate('/login');
        return false;
      }

      // Get user profile and verify patient role
      const profile = await getCurrentUserProfile();
      if (!profile) {
        console.error('User profile not found');
        setConnectionStatus('unauthorized');
        toast.error('User profile not found. Please contact support.');
        return false;
      }

      if (profile.role !== 'staff') {
        console.error('User is not a staff member:', profile.role);
        setConnectionStatus('unauthorized');
        toast.error('Access denied. This page is for staff only.');
        navigate('/dashboard');
        return false;
      }

      // For staff, verify they have a patientId to view
      if (!patientId) {
        console.error('No patient ID provided for staff dental chart');
        setConnectionStatus('unauthorized');
        toast.error('No patient selected. Please select a patient first.');
        navigate('/staff/patients');
        return false;
      }

      setUserProfile(profile);
      setConnectionStatus('connected');
      return true;
    } catch (error) {
      console.error('Connection validation error:', error);
      setConnectionStatus('failed');
      toast.error('Connection validation failed. Please try again.');
      return false;
    }
  };

  useEffect(() => {
    const initializeConnection = async () => {
      const isConnected = await validateConnection();
      if (isConnected) {
        fetchPatientData();
        fetchDentalChart();
        fetchTreatmentHistory();
      }
    };

    initializeConnection();
  }, [patientId]); // Include patientId dependency for staff

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

  const fetchPatientData = async (retryCount = 0) => {
    try {
      // For staff, fetch the patient's data
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', patientId)
        .single();
      
      if (error) {
        if (retryCount < 2) {
          console.log(`Retrying fetchPatientData (attempt ${retryCount + 1})`);
          setTimeout(() => fetchPatientData(retryCount + 1), 1000);
          return;
        }
        throw error;
      }
      
      setPatient(data);
      setOriginalPatient(data);
    } catch (error) {
      console.error('Error fetching patient:', error);
      const errorMessage = handleSupabaseError(error, 'Failed to load patient data');
      toast.error(errorMessage);
      
      // If connection failed, try to revalidate
      if (error.message?.includes('connection') || error.message?.includes('network')) {
        setConnectionStatus('failed');
      }
    }
  };

  const fetchDentalChart = async (retryCount = 0) => {
    setIsLoading(true);
    try {
      // For staff, fetch the patient's chart
      const { data, error } = await supabase
        .from('dental_charts')
        .select('*')
        .eq('patient_id', patientId)
        .single();
      
      if (error) {
        if (retryCount < 2) {
          console.log(`Retrying fetchDentalChart (attempt ${retryCount + 1})`);
          setTimeout(() => fetchDentalChart(retryCount + 1), 1000);
          return;
        }
        throw error;
      }
      
      if (data) {
        setDentalChart(data.chart_data || {});
        setOriginalDentalChart(data.chart_data || {});
      }
    } catch (error) {
      console.error('Error fetching dental chart:', error);
      const errorMessage = handleSupabaseError(error, 'Failed to load dental chart');
      toast.error(errorMessage);
      
      // If connection failed, try to revalidate
      if (error.message?.includes('connection') || error.message?.includes('network')) {
        setConnectionStatus('failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTreatmentHistory = async (retryCount = 0) => {
    try {
      // For staff, fetch the patient's treatment history
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
      
      if (error) {
        if (retryCount < 2) {
          console.log(`Retrying fetchTreatmentHistory (attempt ${retryCount + 1})`);
          setTimeout(() => fetchTreatmentHistory(retryCount + 1), 1000);
          return;
        }
        throw error;
      }
      
      setTreatments(data || []);
    } catch (error) {
      console.error('Error fetching treatment history:', error);
      const errorMessage = handleSupabaseError(error, 'Failed to load treatment history');
      toast.error(errorMessage);
      
      // If connection failed, try to revalidate
      if (error.message?.includes('connection') || error.message?.includes('network')) {
        setConnectionStatus('failed');
      }
    }
  };

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

  const saveDentalChart = async (retryCount = 0) => {
    setIsSaving(true);
    try {
      // Verify user is still authenticated
      const user = await getCurrentUser();
      if (!user) {
        toast.error('Session expired. Please log in again.');
        navigate('/login');
        return;
      }

      // Verify user is a staff member
      if (userProfile?.role !== 'staff') {
        toast.error('Access denied. Only staff can save dental charts.');
        return;
      }
      
      const chartData = {
        patient_id: patientId, // Use the patient ID for staff
        chart_data: dentalChart,
        created_by: user.id,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('dental_charts')
        .upsert(chartData, {
          onConflict: 'patient_id'
        });

      if (error) {
        if (retryCount < 2) {
          console.log(`Retrying saveDentalChart (attempt ${retryCount + 1})`);
          setTimeout(() => saveDentalChart(retryCount + 1), 1000);
          return;
        }
        throw error;
      }
      
      toast.success('Dental chart saved successfully');
      setEditMode(false);
      // Update original data after successful save
      setOriginalDentalChart(dentalChart);
      setOriginalPatient(patient);
      // Refresh the dental chart data to ensure latest data is displayed
      fetchDentalChart();
    } catch (error) {
      console.error('Error saving dental chart:', error);
      const errorMessage = handleSupabaseError(error, 'Failed to save dental chart');
      toast.error(errorMessage);
      
      // If connection failed, try to revalidate
      if (error.message?.includes('connection') || error.message?.includes('network')) {
        setConnectionStatus('failed');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    // Reset to original data
    setDentalChart(originalDentalChart);
    setPatient(originalPatient);
    setSelectedTooth(null);
    setEditMode(false);
    toast.info('Changes cancelled. Dental chart restored to previous state.');
  };

  // Manual retry function for connection issues
  const retryConnection = async () => {
    setConnectionStatus('checking');
    const isConnected = await validateConnection();
    if (isConnected) {
      fetchPatientData();
      fetchDentalChart();
      fetchTreatmentHistory();
    }
  };


  const updateToothData = (toothNumber, field, value) => {
    setDentalChart(prev => ({
      ...prev,
      teeth: {
        ...prev.teeth,
        [toothNumber]: {
          ...prev.teeth?.[toothNumber],
          [field]: value
        }
      }
    }));
  };

  const updateChartData = (section, field, value) => {
    setDentalChart(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
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
  const printDentalChart = () => {
    try {
      // Check if patient data is available
      if (!patient) {
        toast.error('Patient data not available. Please refresh the page and try again.');
        return;
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Pop-up blocked. Please allow pop-ups for this site.');
        // Fallback: try to print the current page
        try {
          window.print();
          toast.info('Printing current page as fallback.');
        } catch (fallbackError) {
          console.error('Fallback print failed:', fallbackError);
          toast.error('Print failed. Please check your browser settings and try again.');
        }
        return;
      }

      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Generate dental chart HTML for printing
      const generateDentalChartHTML = () => {
        try {
          // Temporary teeth layout
          const temporaryTeeth = {
            upperRight: ['A', 'B', 'C', 'D', 'E'],
            upperLeft: ['F', 'G', 'H', 'I', 'J'],
            lowerLeft: ['O', 'N', 'M', 'L', 'K'],
            lowerRight: ['T', 'S', 'R', 'Q', 'P']
          };

          const teeth = [
            // Upper teeth (right to left)
            '18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28',
            // Lower teeth (left to right)
            '48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'
          ];

          const upperTeeth = teeth.slice(0, 16);
          const lowerTeeth = teeth.slice(16, 32);

          return `
            <div class="dental-chart-grid">
              <!-- Temporary Teeth Section -->
              <div class="temporary-teeth-section">
                <h3 class="section-title">TEMPORARY TEETH</h3>
                <div class="teeth-row upper-temporary-teeth">
                  <div class="side-label">RIGHT</div>
                  ${temporaryTeeth.upperRight.map(tooth => {
                    const toothData = dentalChart?.temporary_teeth?.[tooth] || dentalChart?.teeth?.[tooth] || {};
                    const symbol = toothData.symbol || '';
                    return `
                      <div class="tooth-container">
                        <div class="tooth-letter">${tooth}</div>
                        <div class="tooth-symbol" style="background-color: #ffffff; color: #000000; border: 2px solid #d1d5db;">
                          ${symbol}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
                <div class="teeth-row upper-temporary-teeth">
                  <div class="side-label">LEFT</div>
                  ${temporaryTeeth.upperLeft.map(tooth => {
                    const toothData = dentalChart?.temporary_teeth?.[tooth] || dentalChart?.teeth?.[tooth] || {};
                    const symbol = toothData.symbol || '';
                    return `
                      <div class="tooth-container">
                        <div class="tooth-letter">${tooth}</div>
                        <div class="tooth-symbol" style="background-color: #ffffff; color: #000000; border: 2px solid #d1d5db;">
                          ${symbol}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
                <div class="teeth-row lower-temporary-teeth">
                  <div class="side-label">LEFT</div>
                  ${temporaryTeeth.lowerLeft.map(tooth => {
                    const toothData = dentalChart?.temporary_teeth?.[tooth] || dentalChart?.teeth?.[tooth] || {};
                    const symbol = toothData.symbol || '';
                    return `
                      <div class="tooth-container">
                        <div class="tooth-letter">${tooth}</div>
                        <div class="tooth-symbol" style="background-color: #ffffff; color: #000000; border: 2px solid #d1d5db;">
                          ${symbol}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
                <div class="teeth-row lower-temporary-teeth">
                  <div class="side-label">RIGHT</div>
                  ${temporaryTeeth.lowerRight.map(tooth => {
                    const toothData = dentalChart?.temporary_teeth?.[tooth] || dentalChart?.teeth?.[tooth] || {};
                    const symbol = toothData.symbol || '';
                    return `
                      <div class="tooth-container">
                        <div class="tooth-letter">${tooth}</div>
                        <div class="tooth-symbol" style="background-color: #ffffff; color: #000000; border: 2px solid #d1d5db;">
                          ${symbol}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
              
              <!-- Permanent Teeth Section -->
              <div class="permanent-teeth-section">
                <h3 class="section-title">PERMANENT TEETH</h3>
                <div class="teeth-row upper-teeth">
                  ${upperTeeth.map(tooth => {
                    const toothData = dentalChart?.teeth?.[tooth] || {};
                    const symbol = toothData.symbol || '';
                    const symbolInfo = enhancedChartSymbols[symbol];
                    return `
                      <div class="tooth-container">
                        <div class="tooth-number">${tooth}</div>
                        <div class="tooth-symbol" style="background-color: #ffffff; color: #000000; border: 2px solid #d1d5db;">
                          ${symbol}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
                <div class="teeth-row lower-teeth">
                  ${lowerTeeth.map(tooth => {
                    const toothData = dentalChart?.teeth?.[tooth] || {};
                    const symbol = toothData.symbol || '';
                    const symbolInfo = enhancedChartSymbols[symbol];
                    return `
                      <div class="tooth-container">
                        <div class="tooth-number">${tooth}</div>
                        <div class="tooth-symbol" style="background-color: #ffffff; color: #000000; border: 2px solid #d1d5db;">
                          ${symbol}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          `;
        } catch (error) {
          console.error('Error generating dental chart HTML:', error);
          return '<div class="dental-chart-error">Dental chart data not available</div>';
        }
      };

      const dentalChartHtml = generateDentalChartHTML();

    const printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dental Chart - ${patient?.full_name}</title>
        <style>
          @page {
            size: A4;
            margin: 1in 0.3in 0.3in 0.3in;
          }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            margin: 0;
            padding: 0;
            font-size: 12px;
            color: #222;
            background: #f7fafd;
          }
          .print-header {
            display: flex;
            align-items: center;
            border-bottom: 1.5px solid #e5e7eb;
            padding-bottom: 4px;
            margin-bottom: 8px;
            position: relative;
            min-height: 60px;
          }
          .logo-img {
            width: 60px;
            height: 60px;
            object-fit: contain;
            margin-right: 16px;
            background: #fff;
            border: none;
            flex-shrink: 0;
          }
          .clinic-info {
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .clinic-name {
            font-size: 16px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 1px;
          }
          .clinic-address, .clinic-email {
            font-size: 12px;
            color: #555;
            margin-bottom: 1px;
          }
          .header-right {
            text-align: right;
            min-width: 120px;
            position: absolute;
            right: 0;
            top: 0;
          }
          .header-label {
            color: #888;
            font-size: 11px;
          }
          .header-value {
            font-weight: bold;
            font-size: 13px;
            color: #2563eb;
          }
          .divider {
            border-bottom: 1px solid #e5e7eb;
            margin: 4px 0 6px 0;
          }
          .card {
            background: #fff;
            border-radius: 6px;
            box-shadow: 0 1px 4px 0 rgba(0,0,0,0.03);
            border: 1px solid #e5e7eb;
            padding: 16px 18px;
            margin-bottom: 12px;
          }
          .card-title {
            font-size: 14px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 4px;
            margin-top: 6px;
            letter-spacing: 0.2px;
          }
          .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 4px;
            margin-top: 6px;
            letter-spacing: 0.2px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px 18px;
            font-size: 12px;
            margin-bottom: 4px;
          }
          .info-label {
            color: #222;
            font-weight: bold;
            margin-right: 6px;
          }
          .info-value {
            font-weight: 600;
            color: #222;
          }
          .section-block {
            margin-bottom: 10px;
          }
          .question-block {
            margin-bottom: 6px;
          }
          .question-label {
            font-weight: 500;
            color: #222;
            margin-bottom: 1px;
            display: block;
            font-size: 12px;
          }
          .question-response {
            margin-left: 12px;
            color: #444;
            font-size: 12px;
          }
          .medical-history-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 8px;
          }
          .medical-left-column, .medical-right-column {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .patient-info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 8px;
          }
          .patient-left-column, .patient-right-column {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .for-minors-section {
            background: #f0f9ff;
            border: 1px solid #0ea5e9;
            border-radius: 6px;
            padding: 12px;
            margin: 12px 0;
          }
          .minors-title {
            font-weight: bold;
            color: #0c4a6e;
            margin-bottom: 8px;
            font-size: 14px;
          }
          .minors-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .additional-questions {
            margin-top: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .medical-conditions-section {
            margin-top: 6px;
            padding: 8px;
            background: #f9fafb;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
          }
          .conditions-title {
            font-weight: bold;
            color: #374151;
            margin-bottom: 4px;
            font-size: 12px;
          }
          .conditions-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 4px;
          }
          .condition-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 10px;
          }
          .checkbox {
            width: 10px;
            height: 10px;
            border: 1px solid #374151;
            border-radius: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
          }
          .checkbox.checked {
            background: #10b981;
            border-color: #10b981;
          }
          .checkbox.checked::after {
            content: '✓';
            color: white;
            font-size: 8px;
            font-weight: bold;
          }
          .checkbox {
            width: 14px;
            height: 14px;
            border: 2px solid #2563eb;
            margin-right: 6px;
            display: inline-block;
            background: #fff;
            border-radius: 2px;
            position: relative;
            flex-shrink: 0;
          }
          .checkbox.checked {
            background: #2563eb;
          }
          .checkbox.checked::after {
            content: '✓';
            position: absolute;
            top: -2px;
            left: 1px;
            color: white;
            font-weight: bold;
            font-size: 12px;
            line-height: 1;
          }
          .page-break {
            page-break-before: always;
            margin-top: 16px;
          }
          .dental-chart-section {
            background: #fff;
            border-radius: 6px;
            box-shadow: 0 1px 4px 0 rgba(0,0,0,0.03);
            border: 1px solid #e5e7eb;
            padding: 16px 18px;
            margin-bottom: 12px;
          }
          .dental-chart-grid {
            display: flex;
            flex-direction: column;
            gap: 20px;
            margin: 20px 0;
          }
          .teeth-row {
            display: flex;
            justify-content: center;
            gap: 8px;
            flex-wrap: wrap;
          }
          .tooth-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 2px;
          }
          .tooth-number {
            font-size: 10px;
            font-weight: bold;
            color: #666;
            margin-bottom: 2px;
          }
          .tooth-symbol {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            border: 2px solid #e5e7eb;
          }
          .upper-teeth {
            margin-bottom: 10px;
          }
          .lower-teeth {
            margin-top: 10px;
          }
          .chart-title {
            font-size: 14px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 8px;
            text-align: center;
            letter-spacing: 0.2px;
          }
          .section-title {
            font-size: 12px;
            font-weight: bold;
            color: #374151;
            margin-bottom: 6px;
            text-align: center;
            letter-spacing: 0.1px;
            background-color: #f3f4f6;
            padding: 4px 8px;
            border-radius: 3px;
            border: 1px solid #d1d5db;
          }
          .temporary-teeth-section {
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 2px solid #f3f4f6;
          }
          .permanent-teeth-section {
            margin-top: 12px;
          }
          .tooth-letter {
            font-size: 10px;
            font-weight: bold;
            color: #374151;
            text-align: center;
            margin-top: 1px;
          }
          .teeth-container {
            padding: 8px 0 12px 0;
            display: flex;
            justify-content: center;
          }
          .teeth-side {
            text-align: center;
            margin: 0 12px;
          }
          .side-label {
            font-weight: bold;
            margin-bottom: 4px;
            font-size: 12px;
            color: #2563eb;
          }
          .teeth-row {
            display: flex;
            justify-content: center;
            margin: 2px 0;
          }
          .tooth {
            width: 18px;
            height: 22px;
            border: 1px solid #2563eb;
            margin: 1px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            position: relative;
            background: #f3f6fa;
            border-radius: 3px;
          }
          .tooth-number {
            font-weight: bold;
            font-size: 10px;
            color: #2563eb;
          }
          .tooth-symbol {
            font-weight: bold;
            color: #e11d48;
            font-size: 10px;
          }
          .legend-section {
            background: #f7fafd;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
            padding: 10px 12px;
            font-size: 11px;
            margin-bottom: 8px;
          }
          .legend-title {
            font-weight: bold;
            text-align: left;
            margin-bottom: 8px;
            font-size: 14px;
            color: #2563eb;
            text-decoration: underline;
          }
          .legend-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 16px;
            margin-bottom: 16px;
          }
          .legend-column {
            display: flex;
            flex-direction: column;
          }
          .legend-column-title {
            font-weight: bold;
            font-size: 11px;
            color: #374151;
            margin-bottom: 6px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 2px;
          }
          .legend-items {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }
          .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            margin: 1px 0;
          }
          .legend-symbol {
            font-weight: bold;
            width: 16px;
            height: 16px;
            text-align: center;
            border-radius: 3px;
            border: 1px solid;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            flex-shrink: 0;
          }
          .legend-item span {
            font-size: 10px;
            color: #374151;
            line-height: 1.2;
          }
          .screening-section {
            margin-top: 12px;
            padding: 8px;
            background: #f9fafb;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
          }
          .screening-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .screening-column {
            display: flex;
            flex-direction: column;
          }
          .screening-title {
            font-weight: bold;
            font-size: 11px;
            color: #374151;
            margin-bottom: 6px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 2px;
          }
          .screening-items {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }
          .screening-item {
            display: flex;
            align-items: center;
            gap: 6px;
            margin: 1px 0;
          }
          .screening-checkbox {
            width: 12px;
            height: 12px;
            border: 1px solid #6b7280;
            border-radius: 2px;
            flex-shrink: 0;
          }
          .screening-checkbox.checked {
            background-color: #10b981;
            border-color: #10b981;
            position: relative;
          }
          .screening-checkbox.checked::after {
            content: '✓';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 8px;
            font-weight: bold;
          }
          .screening-item span {
            font-size: 10px;
            color: #374151;
            line-height: 1.2;
          }
          .screening-lines {
            margin-left: 18px;
            margin-top: 4px;
          }
          .screening-line {
            height: 12px;
            border-bottom: 1px solid #d1d5db;
            margin-bottom: 2px;
          }
          .conditions-section {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px;
            margin-bottom: 8px;
          }
          .condition-box {
            background: #f7fafd;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
            padding: 10px 12px;
            font-size: 11px;
          }
          .condition-title {
            font-weight: bold;
            text-align: left;
            margin-bottom: 4px;
            text-decoration: underline;
            font-size: 12px;
            color: #2563eb;
          }
          .checkbox-item {
            display: flex;
            align-items: center;
            margin: 2px 0;
          }
          .consent-section {
            background: #fff;
            border-radius: 6px;
            box-shadow: 0 1px 4px 0 rgba(0,0,0,0.03);
            border: 1px solid #e5e7eb;
            padding: 16px 18px;
            font-size: 12px;
            line-height: 1.4;
            margin-bottom: 12px;
          }
          .consent-title {
            font-weight: bold;
            text-align: left;
            margin-bottom: 8px;
            font-size: 14px;
            color: #2563eb;
            text-decoration: underline;
          }
          .consent-content {
            font-size: 10px;
            line-height: 1.4;
            text-align: justify;
            margin-bottom: 8px;
          }
          .consent-section {
            margin-bottom: 12px;
            padding: 8px;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            background: #fafafa;
          }
          .consent-title {
            font-weight: bold;
            font-size: 11px;
            color: #1f2937;
            margin-bottom: 6px;
            text-transform: uppercase;
          }
          .consent-text {
            margin-bottom: 8px;
            color: #374151;
            text-align: justify;
            font-size: 10px;
            line-height: 1.3;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 12px;
            padding-top: 6px;
            border-top: 1px solid #e5e7eb;
          }
          .signature-box {
            text-align: center;
            width: 120px;
          }
          .signature-line {
            border-top: 1px solid #e5e7eb;
            margin-top: 14px;
            padding-top: 3px;
            font-size: 11px;
            color: #888;
          }
          .footer {
            text-align: center;
            margin-top: 12px;
            color: #2563eb;
            font-size: 12px;
            font-weight: bold;
          }
          .footer-contact {
            text-align: center;
            color: #888;
            font-size: 10px;
            margin-top: 2px;
            font-weight: 400;
          }
          
          /* Print-specific styles */
          @media print {
            body { 
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .checkbox {
              border: 2px solid #000 !important;
              background: #fff !important;
            }
            .checkbox.checked {
              background: #000 !important;
            }
            .checkbox.checked::after {
              color: white !important;
            }
          }
        </style>
      </head>
      <body>
        <!-- Print Header (only on first page) -->
        <div class="print-header">
          <img src="${window.location.origin}/src/assets/Logo.png" alt="Silario Dental Clinic Logo" class="logo-img" />
          <div class="clinic-info">
            <div class="clinic-name">SILARIO DENTAL CLINIC</div>
            <div class="clinic-address">Cabugao/San Juan, Ilocos Sur</div>
            <div class="clinic-email">silariodentalclinic@gmail.com</div>
          </div>
          <div class="header-right">
            <div class="header-label">Date:</div>
            <div class="header-value">${currentDate}</div>
            <div class="header-label" style="margin-top:4px;">Patient:</div>
            <div class="header-value">${patient?.full_name || ''}</div>
          </div>
        </div>
        <div class="divider"></div>

        <!-- First Page: Patient Information, Dental History, Medical History -->
        <div class="section-title">PATIENT INFORMATION</div>
        <div class="patient-info-grid">
          <div class="patient-left-column">
            <div class="info-row">
              <span class="info-label">Name:</span> <span class="info-value">${patient?.full_name || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Birthdate(mm/dd/yy):</span> <span class="info-value">${patient?.birthday || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Home Address:</span> <span class="info-value">${patient?.address || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Occupation:</span> <span class="info-value">${patient?.occupation || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Dental Insurance:</span> <span class="info-value">${dentalChart.patientInfo?.dental_insurance || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Effective Date:</span> <span class="info-value">${dentalChart.patientInfo?.effective_date || patient?.effective_date || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email Add:</span> <span class="info-value">${patient?.email || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Nickname:</span> <span class="info-value">${patient?.nickname || ''}</span>
            </div>
          </div>
          <div class="patient-right-column">
            <div class="info-row">
              <span class="info-label">Age:</span> <span class="info-value">${patient?.birthday ? calculateAge(patient.birthday) : ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Sex: M/F</span> <span class="info-value">${patient?.gender ? (patient.gender.toLowerCase() === 'male' ? 'M' : 'F') : ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Nationality:</span> <span class="info-value">${patient?.nationality || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Office No.:</span> <span class="info-value">${patient?.office_no || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Home No.:</span> <span class="info-value">${dentalChart.patientInfo?.home_no || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Fax No.:</span> <span class="info-value">${dentalChart.patientInfo?.fax_no || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Cell/Mobile No.:</span> <span class="info-value">${patient?.mobile || patient?.phone || ''}</span>
            </div>
          </div>
        </div>
        
        <div class="section-title">FOR MINORS</div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Parent/Guardian's Name:</span> <span class="info-value">${dentalChart.patientInfo?.parent_guardian_name || ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Parent/Guardian's Occupation:</span> <span class="info-value">${dentalChart.patientInfo?.parent_occupation || ''}</span>
          </div>
        </div>
        
        <div class="section-title">ADDITIONAL INFORMATION</div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Whom may we thank for referring you?:</span> <span class="info-value">${dentalChart.patientInfo?.referral_source || ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">What is your reason for dental consultation?:</span> <span class="info-value">${dentalChart.patientInfo?.consultation_reason || ''}</span>
          </div>
        </div>


        <div class="section-title">DENTAL HISTORY</div>
        <div class="info-grid">
          ${dentalHistory.map((question, index) => `
            <div class="info-row">
              <span class="info-label">${index + 1}. ${question}</span> <span class="info-value">${dentalChart.dentalHistory?.[`question_${index}`] || ''}</span>
            </div>
          `).join('')}
        </div>

        <div class="section-title">MEDICAL HISTORY</div>
        <div class="medical-history-grid">
          <div class="medical-left-column">
            <div class="info-row">
              <span class="info-label">Name of the physician and specialty if applicable:</span> <span class="info-value">${dentalChart.medicalHistory?.physician_name || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Office Address:</span> <span class="info-value">${dentalChart.medicalHistory?.office_address || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Office Number:</span> <span class="info-value">${dentalChart.medicalHistory?.physician_0 || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">1. Are you in good health?</span> <span class="info-value">${dentalChart.medicalHistory?.question_0 || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">2. Are you under medical treatment now? If so, what is the condition being treated?</span> <span class="info-value">${dentalChart.medicalHistory?.question_1 || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">3. Have you ever had serious illness or surgical operation? If so, what illness or operation?</span> <span class="info-value">${dentalChart.medicalHistory?.question_2 || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">4. Have you ever been hospitalized? If so, when and why?</span> <span class="info-value">${dentalChart.medicalHistory?.question_3 || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">5. Are you taking any prescription/non-prescription medication?</span> <span class="info-value">${dentalChart.medicalHistory?.question_4 || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">6. Do you use tobacco products?</span> <span class="info-value">${dentalChart.medicalHistory?.question_5 || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">7. Do you use alcohol, cocaine or other dangerous drugs?</span> <span class="info-value">${dentalChart.medicalHistory?.question_6 || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">8. Are you allergic to Local Anesthetic or Sulfa Drug?</span> <span class="info-value">${dentalChart.medicalHistory?.question_7 || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">13. Do you have any of the following? Check which apply:</span>
            </div>
          </div>
          <div class="medical-right-column">
            <div class="info-row">
              <span class="info-label">9. Bleeding time?</span> <span class="info-value">${dentalChart.medicalHistory?.question_8 || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">10. For women only:</span>
            </div>
            <div class="info-row">
              <span class="info-label">Are you pregnant?</span> <span class="info-value">${dentalChart.medicalHistory?.women_0 || ''}</span>
              <span class="info-label">Are you nursing?</span> <span class="info-value">${dentalChart.medicalHistory?.women_1 || ''}</span>
              <span class="info-label">Are you taking birth control pills?</span> <span class="info-value">${dentalChart.medicalHistory?.women_2 || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">11. Blood type:</span> <span class="info-value">${dentalChart.medicalHistory?.question_9 || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">12. Blood pressure:</span> <span class="info-value">${dentalChart.medicalHistory?.question_10 || ''}</span>
            </div>
          </div>
        </div>
        <div class="medical-conditions-section">
          <h4 class="conditions-title">Medical Conditions:</h4>
          <div class="conditions-grid">
            ${medicalConditions.map(condition => `
              <div class="condition-item">
                <div class="checkbox ${dentalChart.medicalConditions?.[condition] ? 'checked' : ''}"></div>
                <span>${condition}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="page-break"></div>

        <!-- Second Page: Dental Chart -->
        <div class="dental-chart-section">
          <div class="chart-title">Dental Record Chart</div>
          <div class="teeth-container">
            <div class="teeth-side">
              <div class="side-label">RIGHT</div>
              <div class="teeth-row">
                ${[8, 7, 6, 5, 4, 3, 2, 1].map(num => `
                  <div class="tooth">
                    <div class="tooth-symbol">${dentalChart.teeth?.[num]?.symbol || ''}</div>
                    <div class="tooth-number">${num}</div>
                  </div>
                `).join('')}
              </div>
              <div class="teeth-row">
                ${[25, 26, 27, 28, 29, 30, 31, 32].map(num => `
                  <div class="tooth">
                    <div class="tooth-number">${num}</div>
                    <div class="tooth-symbol">${dentalChart.teeth?.[num]?.symbol || ''}</div>
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="teeth-side">
              <div class="side-label">LEFT</div>
              <div class="teeth-row">
                ${[9, 10, 11, 12, 13, 14, 15, 16].map(num => `
                  <div class="tooth">
                    <div class="tooth-symbol">${dentalChart.teeth?.[num]?.symbol || ''}</div>
                    <div class="tooth-number">${num}</div>
                  </div>
                `).join('')}
              </div>
              <div class="teeth-row">
                ${[24, 23, 22, 21, 20, 19, 18, 17].map(num => `
                  <div class="tooth">
                    <div class="tooth-number">${num}</div>
                    <div class="tooth-symbol">${dentalChart.teeth?.[num]?.symbol || ''}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <div class="legend-section">
          <div class="legend-title">Legend</div>
          
          <!-- Three Column Layout -->
          <div class="legend-grid">
            <!-- Condition Column -->
            <div class="legend-column">
              <h4 class="legend-column-title">Condition:</h4>
              <div class="legend-items">
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">D-</div>
                  <span>Decayed (Caries Indicated for filling)</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">M-</div>
                  <span>Missing due to caries</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">F-</div>
                  <span>Filled</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">I-</div>
                  <span>Caries indicated for Extraction</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">RF-</div>
                  <span>Root Fragment</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">MO-</div>
                  <span>Missing due to other causes</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">Im-</div>
                  <span>Impacted Tooth</span>
                </div>
              </div>
            </div>

            <!-- Restoration & Prosthetics Column -->
            <div class="legend-column">
              <h4 class="legend-column-title">Restoration & Prosthetics:</h4>
              <div class="legend-items">
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">J-</div>
                  <span>Jacket Crown</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">A-</div>
                  <span>Amalgam Fillings</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">AB-</div>
                  <span>Abutment</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">P-</div>
                  <span>Pontic</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">In-</div>
                  <span>Inlay</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">FX-</div>
                  <span>Fixed Cure Composite</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">Rm-</div>
                  <span>Removable Denture</span>
                </div>
              </div>
            </div>

            <!-- Surgery Column -->
            <div class="legend-column">
              <h4 class="legend-column-title">Surgery:</h4>
              <div class="legend-items">
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">X-</div>
                  <span>Extraction due to caries</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">XO-</div>
                  <span>Extraction due to other causes</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">✔-</div>
                  <span>Present Teeth</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">Cm-</div>
                  <span>Congenitally missing</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; border-color: #d1d5db; color: #000000;">Sp-</div>
                  <span>Supernumerary</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Screening and Assessment Categories -->
        <div class="screening-section">
          <div class="screening-grid">
            <!-- Prediodical Screening -->
            <div class="screening-column">
              <h4 class="screening-title">Prediodical Screening:</h4>
              <div class="screening-items">
                ${['Gingivitis', 'Early Periodontics', 'Moderate Periodontics', 'Advanced Periodontics'].map(item => `
                  <div class="screening-item">
                    <div class="screening-checkbox ${dentalChart.prediodical_screening?.[item] ? 'checked' : ''}"></div>
                    <span>${item}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Occlusion -->
            <div class="screening-column">
              <h4 class="screening-title">Occlusion:</h4>
              <div class="screening-items">
                ${['Class (Molar)', 'Overjet', 'Overbite', 'Midline Deviation', 'Crossbite'].map(item => `
                  <div class="screening-item">
                    <div class="screening-checkbox ${dentalChart.occlusion?.[item] ? 'checked' : ''}"></div>
                    <span>${item}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Appliances -->
            <div class="screening-column">
              <h4 class="screening-title">Appliances:</h4>
              <div class="screening-items">
                ${['Orthodontic', 'Stayplate', 'Others:'].map(item => `
                  <div class="screening-item">
                    <div class="screening-checkbox ${dentalChart.appliances?.[item] ? 'checked' : ''}"></div>
                    <span>${item}</span>
                  </div>
                `).join('')}
                <div class="screening-lines">
                  <div class="screening-line"></div>
                  <div class="screening-line"></div>
                  <div class="screening-line"></div>
                </div>
              </div>
            </div>

            <!-- TMD -->
            <div class="screening-column">
              <h4 class="screening-title">TMD:</h4>
              <div class="screening-items">
                ${['Clenching', 'Clicking', 'Trismus', 'Muscle Spasm'].map(item => `
                  <div class="screening-item">
                    <div class="screening-checkbox ${dentalChart.tmd?.[item] ? 'checked' : ''}"></div>
                    <span>${item}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <div class="page-break"></div>

        <!-- Third Page: Informed Consent -->
        <div class="consent-section">
          <div class="consent-title">Informed Consent</div>
          <div class="consent-content">
            <p><strong>TREATMENT TO BE DONE:</strong> I understand and consent to have any treatment done by the dentist as deemed necessary or advisable, including the use and administration of anesthetics and or medications.</p>
            <p><strong>CHANGES IN TREATMENT PLAN:</strong> I understand that during treatment it may be necessary or advisable to change or add procedures because of conditions found while working on the teeth that were not discovered during examination, the most common being root canal therapy following routine restorative procedures. I give my permission to the dentist to make any/all changes that he/she deems appropriate.</p>
            <p><strong>DRUGS & MEDICATIONS:</strong> I understand that antibiotics, analgesics and other medications can cause allergic reactions causing redness and swelling of tissues, pain, itching, vomiting, and/or anaphylactic shock (severe allergic reaction).</p>
            <p><strong>CHANGES IN TREATMENT PLAN:</strong> I understand that a perfect result is not guaranteed, and that reperfect procedures may be necessary at patient to charge. I acknowledge that the practice of dentistry is not an exact science and that, therefore, reperfect or alternative treatment methods may be required.</p>
            <p><strong>PERIODONTAL DISEASE:</strong> I understand that I may have a serious condition causing gum and/or bone inflammation or loss and that it can lead to the loss of my teeth. Alternative treatments were explained to me including non-surgical cleaning, surgical cleaning, replacements and/or extractions. I understand that undertreated periodontal disease can lead to pain, infection, swelling, bleeding gums, loss of teeth, and bad breath.</p>
            <p><strong>CROWNS & CAPS & BRIDGES:</strong> I understand that sometimes it is not possible to match the color of natural teeth exactly with artificial teeth. I further understand that I may be wearing temporary crowns, which may come off easily and that I must be careful to ensure that they are kept on until the permanent crowns are delivered. I realize the final opportunity to make changes in my new crown, cap, or bridge (including shape, fit, size, and color) will be before cementation.</p>
            <p><strong>DENTURE CARE:</strong> I realize the final opportunity to make changes in my new denture (including shape, fit, size, placement of teeth, and color) will be the "teeth in wax" try-in visit. I understand that most dentures require several adjustments, and that I will be appointed several times. I realize that sore spots are likely and I understand that talking and chewing may be different with new dentures.</p>
            <p><strong>ENDODONTIC TREATMENT (ROOT CANAL):</strong> I realize there is no guarantee that root canal treatment will be successful, and that complications can occur from the treatment, and that occasionally metal instruments may separate during treatment and remain in the tooth. I understand that occasionally additional surgical procedures may be necessary following root canal treatment (apicoectomy). I understand the alternative to root canal therapy is extraction of the tooth.</p>
            <p><strong>SURGERY:</strong> I understand that a more extensive procedure may sometimes be required than initially planned. I understand that receiving an injection in some circumstances may result in residual numbness of the lip, tongue, teeth, chin or gums that is sometimes temporary and, on occasion, permanent. I understand that complications may result from surgery, drugs, medications, or anesthetics. These complications include but are not limited to: post-operative discomfort and swelling that may necessitate several days of recuperation; prolonged bleeding; injury to adjacent teeth or fillings; referred pain to ear, neck and head; delayed healing; allergic reaction to drugs or medications used; injury to nerve resulting in altered sensation which may be temporary and on occasion permanent; opening into the sinus requiring additional treatment; breakage of instruments.</p>
            <p><strong>ORTHODONTIC TREATMENT:</strong> I understand that orthodontic treatment is a biological process that is generally quite successful but does have some inherent limitations. Complete alignment and ideal bite relationships may not be possible to achieve. During treatment, good oral hygiene is extremely important. Poor oral hygiene can cause permanent markings of the teeth (decalcification), decay, and gum disease. These conditions can lead to loss of teeth. I understand that retainers may have to be worn indefinitely to maintain tooth position, and that without retainers the teeth will tend to move.</p>
          </div>
          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line">Patient / Guardian Signature</div>
            </div>
            <div class="signature-box">
              <div class="signature-line">Doctor Signature & Date</div>
            </div>
          </div>
        </div>

        <div class="footer">Thank you for choosing Silario Dental Clinic</div>
        <div class="footer-contact">For any inquiries, please contact us at silariodentalclinic@gmail.com</div>

        <script>
          window.onload = function() {
            try {
              window.print();
              window.onafterprint = function() {
                setTimeout(function() {
                  window.close();
                }, 1000);
              };
            } catch (error) {
              console.error('Print error:', error);
              setTimeout(function() {
                window.close();
              }, 2000);
            }
          };
        </script>
      </body>
      </html>
    `;

      printWindow.document.write(printHTML);
      printWindow.document.close();
      
      // Add timeout to handle cases where print dialog doesn't appear
      setTimeout(() => {
        if (printWindow.closed === false) {
          printWindow.focus();
        }
      }, 500);
      
      toast.success('Opening print dialog...');
    } catch (error) {
      console.error('Error printing dental chart:', error);
      toast.error('Failed to print dental chart. Please try again.');
    }
  };

  const downloadDentalFormPDF = async () => {
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

    await PDFGenerator.generatePDF(
      patient,
      dentalChart,
      currentDate,
      chartSymbols,
      medicalHistory,
      medicalConditions,
      dentalHistory,
      physicianInfo,
      enhancedChartSymbols,
      toast
    );
  };

  // Connection status handling
  if (connectionStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Validating connection...</p>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="text-red-600 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-red-800 mb-2">Connection Failed</h2>
            <p className="text-red-600 mb-4">
              Unable to connect to the database. Please check your internet connection and try again.
            </p>
            <button
              onClick={() => {
                setConnectionStatus('checking');
                validateConnection();
              }}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'unauthorized') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="text-yellow-600 text-6xl mb-4">🔒</div>
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">Access Denied</h2>
            <p className="text-yellow-600 mb-4">
              You don't have permission to access this page. Please contact support if you believe this is an error.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) return <LoadingSpinner />;
  if (!patient) return <div className="text-center py-12">Unable to load your profile.</div>;
  
  return (
    <div className="space-y-6">
      {/* Edit Mode Notice */}
      {editMode && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
        </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Edit Mode Active
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>
                  You can now edit your dental chart. Update medical history, dental history, and patient information. The dental record chart, legend, conditions, applications, and TMD sections are hidden during editing but will be included when you print. Click "Save Chart" when you're done.
                </p>
      </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <FiArrowLeft className="mr-2 -ml-1 h-4 w-4" />
            Back
          </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Comprehensive Dental Chart</h1>
              <p className="text-sm text-gray-500">{patient.full_name}</p>
              {connectionStatus === 'connected' && (
                <div className="flex items-center mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-xs text-green-600 font-medium">Connected</span>
                </div>
              )}
            </div>
          </div>
        <div className="flex space-x-2">
          <button
            onClick={downloadDentalFormPDF}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <FiDownload className="mr-2 -ml-1 h-5 w-5" />
            Download Dental Form
          </button>
          <button
            onClick={() => StandardizedPrinter.printStandardizedDentalChart(patient, dentalChart, enhancedChartSymbols, toast)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <FiPrinter className="mr-2 -ml-1 h-5 w-5" />
            Standardized Print
          </button>
          {connectionStatus === 'failed' && (
            <button
              onClick={retryConnection}
              className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100"
            >
              <FiActivity className="mr-2 -ml-1 h-5 w-5" />
              Retry Connection
            </button>
          )}
          {editMode ? (
            <>
              <button
                onClick={cancelEdit}
                disabled={isSaving}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100"
              >
                <FiX className="mr-2 -ml-1 h-5 w-5" />
                Cancel
              </button>
              <button
                onClick={saveDentalChart}
                disabled={isSaving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <FiSave className="mr-2 -ml-1 h-5 w-5" />
                )}
                Save Chart
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <FiEdit className="mr-2 -ml-1 h-5 w-5" />
              Edit Information
            </button>
          )}
        </div>
      </div>
      {/* Main Dental Chart Layout */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-gray-300">
        {/* Header with Logo */}
        <div className="flex items-center justify-center p-6 border-b-2 border-black bg-gray-50">
          <div className="flex items-center">
            <img 
              src="/src/assets/Logo.png" 
              alt="Silario Dental Clinic Logo" 
              className="w-16 h-16 object-contain mr-4"
            />
            <div>
              <div className="text-2xl font-bold text-blue-600 tracking-wide">
                SILARIO DENTAL CLINIC
              </div>
              <div className="text-sm text-gray-600 italic">
                Elaine Mae Frando Silario D.M.D
              </div>
            </div>
          </div>
          <div className="ml-8 text-lg font-bold tracking-widest">
            PATIENT INFORMATION RECORD
          </div>
        </div>
        {/* Patient Information Grid */}
        <div className="p-6 border-b border-gray-300">
          <h3 className="text-lg font-bold text-center mb-4 bg-gray-100 p-2 border border-gray-400 rounded-t-md">
            PATIENT INFORMATION
          </h3>
          {editMode ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={patient.full_name || ''} onChange={e => setPatient({ ...patient, full_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nickname</label>
                <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={patient.nickname || ''} onChange={e => setPatient({ ...patient, nickname: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={patient.address || ''} onChange={e => setPatient({ ...patient, address: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={patient.nationality || ''} onChange={e => setPatient({ ...patient, nationality: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <input type="number" className="w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-100" value={patient.birthday ? calculateAge(patient.birthday) : ''} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
                <select className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={patient.gender || ''} onChange={e => setPatient({ ...patient, gender: e.target.value })}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Home No.</label>
                <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={patient.phone || ''} onChange={e => setPatient({ ...patient, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-100" value={new Date().toLocaleDateString()} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
                <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={patient.occupation || ''} onChange={e => setPatient({ ...patient, occupation: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Office No.</label>
                <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={patient.office_no || ''} onChange={e => setPatient({ ...patient, office_no: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Birthdate</label>
                <input type="date" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={patient.birthday || ''} onChange={e => setPatient({ ...patient, birthday: e.target.value })} />
            </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cell/Mobile</label>
                <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={patient.mobile || patient.phone || ''} onChange={e => setPatient({ ...patient, mobile: e.target.value })} />
              </div>
              
              {/* Additional Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dental Insurance:</label>
                <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={dentalChart.patientInfo?.dental_insurance || ''} onChange={e => updateChartData('patientInfo', 'dental_insurance', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date:</label>
                <DatePicker
                  value={dentalChart.patientInfo?.effective_date || ''}
                  onChange={value => updateChartData('patientInfo', 'effective_date', value)}
                  placeholder="Select date"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Home No.:</label>
                <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={dentalChart.patientInfo?.home_no || ''} onChange={e => updateChartData('patientInfo', 'home_no', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fax No.:</label>
                <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={dentalChart.patientInfo?.fax_no || ''} onChange={e => updateChartData('patientInfo', 'fax_no', e.target.value)} />
              </div>
              
              {/* For Minors Section - Highlighted */}
              <div className="md:col-span-2">
                <h4 className="text-lg font-bold text-blue-600 mb-3 bg-blue-50 p-2 rounded border border-blue-200">For Minors:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parent/Guardian's Name:</label>
                    <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={dentalChart.patientInfo?.parent_guardian_name || ''} onChange={e => updateChartData('patientInfo', 'parent_guardian_name', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Occupation:</label>
                    <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={dentalChart.patientInfo?.parent_occupation || ''} onChange={e => updateChartData('patientInfo', 'parent_occupation', e.target.value)} />
                  </div>
                </div>
              </div>
              
              {/* Additional Questions */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Whom may we thank for referring you?</label>
                <input type="text" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" value={dentalChart.patientInfo?.referral_source || ''} onChange={e => updateChartData('patientInfo', 'referral_source', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">What is your reason for dental consultation?</label>
                <textarea className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500" rows={3} value={dentalChart.patientInfo?.consultation_reason || ''} onChange={e => updateChartData('patientInfo', 'consultation_reason', e.target.value)} />
              </div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-2 gap-8 text-sm">
                {/* Left Column */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Name:</span>
                    <span className="flex-1">{patient.full_name}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Birthdate(mm/dd/yy):</span>
                    <span className="flex-1">{patient.birthday || ''}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Home Address:</span>
                    <span className="flex-1">{patient.address}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Occupation:</span>
                    <span className="flex-1">{patient.occupation || ''}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Dental Insurance:</span>
                    <span className="flex-1">{dentalChart.patientInfo?.dental_insurance || ''}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Effective Date:</span>
                    <span className="flex-1">{dentalChart.patientInfo?.effective_date || patient.effective_date || ''}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Email Add:</span>
                    <span className="flex-1">{patient.email || ''}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Nickname:</span>
                    <span className="flex-1">{patient.nickname || ''}</span>
                  </div>
                </div>
                
                {/* Right Column */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Age:</span>
                    <span className="flex-1">{patient.birthday ? calculateAge(patient.birthday) : ''}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Sex: M/F</span>
                    <span className="flex-1">{patient.gender ? (patient.gender.toLowerCase() === 'male' ? 'M' : 'F') : ''}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Nationality:</span>
                    <span className="flex-1">{patient.nationality || ''}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Office No.:</span>
                    <span className="flex-1">{patient.office_no || ''}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Home No.:</span>
                    <span className="flex-1">{dentalChart.patientInfo?.home_no || ''}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Fax No.:</span>
                    <span className="flex-1">{dentalChart.patientInfo?.fax_no || ''}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Cell/Mobile No.:</span>
                    <span className="flex-1">{patient.mobile || patient.phone || ''}</span>
                  </div>
                </div>
              </div>
              
              {/* For Minors Section - Highlighted */}
              <div className="mt-6 bg-blue-50 p-3 rounded border border-blue-200 mb-2">
                <h4 className="text-lg font-bold text-blue-600 mb-2">For Minors:</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Parent/Guardian's Name:</span>
                    <span className="flex-1">{dentalChart.patientInfo?.parent_guardian_name || ''}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Occupation:</span>
                    <span className="flex-1">{dentalChart.patientInfo?.parent_occupation || ''}</span>
                  </div>
                </div>
              </div>
              
              {/* Additional Questions */}
              <div className="mt-4 space-y-2">
                <div className="flex items-start">
                  <span className="font-bold mr-2">Whom may we thank for referring you?:</span>
                  <span className="flex-1">{dentalChart.patientInfo?.referral_source || ''}</span>
                </div>
                <div className="flex items-start">
                  <span className="font-bold mr-2">What is your reason for dental consultation?:</span>
                  <span className="flex-1">{dentalChart.patientInfo?.consultation_reason || ''}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Dental History Section */}
        <div className="border-b border-gray-300">
          <div className="bg-gray-100 p-3 border-b border-gray-400 rounded-t-md">
            <h3 className="font-bold text-center text-lg">DENTAL HISTORY</h3>
          </div>
          <div className="p-6">
            {editMode ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dentalHistory.map((question, index) => (
                  <div key={index}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{index + 1}. {question}</label>
                    {question === 'Last dental visit' ? (
                      <DatePicker
                        value={dentalChart.dentalHistory?.[`question_${index}`] || ''}
                        onChange={value => updateChartData('dentalHistory', `question_${index}`, value)}
                        placeholder="Select date"
                        className="w-full"
                      />
                    ) : (
                      <textarea
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Response"
                        value={dentalChart.dentalHistory?.[`question_${index}`] || ''}
                        onChange={e => updateChartData('dentalHistory', `question_${index}`, e.target.value)}
                        rows={2}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {dentalHistory.map((question, index) => (
                  <div key={index} className="flex items-start">
                    <span className="font-bold mr-3 text-sm">{index + 1}.</span>
                    <div className="flex-1 flex items-start">
                      <span className="font-bold text-sm">{question}</span>
                      {!editMode && dentalChart.dentalHistory?.[`question_${index}`] && (
                        <span className="text-gray-700 text-sm ml-2 flex-shrink-0">{dentalChart.dentalHistory[`question_${index}`]}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Medical History Section */}
        <div className="border-b border-gray-300">
          <div className="bg-gray-100 p-3 border-b border-gray-400 rounded-t-md">
            <h3 className="font-bold text-center text-lg">MEDICAL HISTORY</h3>
          </div>
          <div className="p-6">
            {editMode ? (
              <div className="space-y-6">
                {/* Physician Information Section */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">Physician Information</h4>
                  <div className="space-y-4">
                    {/* Name of the physician - First Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name of the physician and specialty if applicable</label>
                      <textarea
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Response"
                        value={dentalChart.medicalHistory?.physician_name || ''}
                        onChange={e => updateChartData('medicalHistory', 'physician_name', e.target.value)}
                        rows={2}
                      />
                    </div>

                    {/* Office Address - Special Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Office Address:</label>
                      <textarea
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Response"
                        value={dentalChart.medicalHistory?.office_address || ''}
                        onChange={e => updateChartData('medicalHistory', 'office_address', e.target.value)}
                        rows={2}
                      />
                    </div>

                    {/* Physician Information - No Numbers */}
                    {physicianInfo.map((question, index) => (
                      <div key={`physician-${index}`}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{question}</label>
                        <textarea
                          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Response"
                          value={dentalChart.medicalHistory?.[`physician_${index}`] || ''}
                          onChange={e => updateChartData('medicalHistory', `physician_${index}`, e.target.value)}
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Medical History Questions Section */}
                <div className="bg-white p-4 rounded-lg border">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">Medical History Questions</h4>
                  <div className="space-y-4">
                    {/* Questions 1-8 */}
                    {medicalHistory.slice(0, 8).map((question, index) => (
                      <div key={index}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{index + 1}. {question}</label>
                        <textarea
                          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Response"
                          value={dentalChart.medicalHistory?.[`question_${index}`] || ''}
                          onChange={e => updateChartData('medicalHistory', `question_${index}`, e.target.value)}
                          rows={2}
                        />
                      </div>
                    ))}
                    
                    {/* Question 9 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">9. {medicalHistory[8]}</label>
                      <textarea
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Response"
                        value={dentalChart.medicalHistory?.[`question_8`] || ''}
                        onChange={e => updateChartData('medicalHistory', `question_8`, e.target.value)}
                        rows={2}
                      />
                    </div>
                    
                    {/* For Women Only Section */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">10. For women only:</label>
                      <div className="bg-blue-50 p-3 rounded border border-blue-200">
                        <h4 className="text-lg font-bold text-blue-600 mb-3">For Women Only:</h4>
                        <div className="space-y-3">
                          {womenOnlyQuestions.map((womenQuestion, womenIndex) => (
                            <div key={womenIndex} className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                              <label className="text-sm text-gray-700 font-medium sm:w-48 flex-shrink-0">{womenQuestion}</label>
                              <textarea
                                className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                                placeholder="Response"
                                value={dentalChart.medicalHistory?.[`women_${womenIndex}`] || ''}
                                onChange={e => updateChartData('medicalHistory', `women_${womenIndex}`, e.target.value)}
                                rows={1}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Questions 11-12 */}
                    {medicalHistory.slice(10, 12).map((question, index) => (
                      <div key={index + 10}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{index + 11}. {question}</label>
                        <textarea
                          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Response"
                          value={dentalChart.medicalHistory?.[`question_${index + 10}`] || ''}
                          onChange={e => updateChartData('medicalHistory', `question_${index + 10}`, e.target.value)}
                          rows={2}
                        />
                      </div>
                    ))}
                    
                    {/* Question 13 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">13. {medicalHistory[12]}</label>
                      <textarea
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Response"
                        value={dentalChart.medicalHistory?.[`question_12`] || ''}
                        onChange={e => updateChartData('medicalHistory', `question_12`, e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Medical Conditions Section */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Medical Conditions</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {medicalConditions.map(condition => (
                      <label key={condition} className="flex items-center space-x-2 p-2 bg-white rounded border hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={dentalChart.medicalConditions?.[condition] || false}
                          onChange={(e) => updateChartData('medicalConditions', condition, e.target.checked)}
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">{condition}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {/* Left Column - Physician Information + Questions 1-8 + Question 13 */}
                <div className="space-y-2">
                  {/* Name of the physician - First Field */}
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Name of the physician and specialty if applicable:</span>
                    <span className="flex-1">{dentalChart.medicalHistory?.physician_name || ''}</span>
                  </div>

                  {/* Office Address - Special Field */}
                  <div className="flex items-center">
                    <span className="font-bold mr-2">Office Address:</span>
                    <span className="flex-1">{dentalChart.medicalHistory?.office_address || ''}</span>
                  </div>

                  {/* Physician Information - No Numbers */}
                  {physicianInfo.map((question, index) => (
                    <div key={`physician-${index}`} className="flex items-center">
                      <span className="font-bold mr-2">{question}:</span>
                      <span className="flex-1">{dentalChart.medicalHistory?.[`physician_${index}`] || ''}</span>
                    </div>
                  ))}
                  
                  {/* Questions 1-8 on the left side */}
                  {medicalHistory.slice(0, 8).map((question, index) => (
                    <div key={index} className="flex items-start">
                      <span className="font-bold mr-2 text-sm">{index + 1}.</span>
                      <div className="flex-1">
                        <span className="font-bold text-sm">{question}</span>
                        <span className="text-gray-700 text-sm ml-2">{dentalChart.medicalHistory?.[`question_${index}`] || ''}</span>
                      </div>
                    </div>
                  ))}
                  
                  {/* Spacing between question 8 and 13 */}
                  <div className="mt-8"></div>
                  
                  {/* Question 13 on the left side */}
                  <div className="flex items-start">
                    <span className="font-bold mr-2 text-sm">13.</span>
                    <div className="flex-1">
                      <span className="font-bold text-sm">{medicalHistory[12]}</span>
                      <span className="text-gray-700 text-sm ml-2">{dentalChart.medicalHistory?.[`question_12`] || ''}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column - Medical History Questions 9-12 */}
                <div className="space-y-2 ml-16">
                  {/* Question 9 on the right side */}
                  <div className="flex items-start">
                    <span className="font-bold mr-2 text-sm">9.</span>
                    <div className="flex-1">
                      <span className="font-bold text-sm">{medicalHistory[8]}</span>
                      <span className="text-gray-700 text-sm ml-2">{dentalChart.medicalHistory?.[`question_8`] || ''}</span>
                    </div>
                  </div>
                  
                  {/* For Women Only Section */}
                  <div className="flex items-start">
                    <span className="font-bold mr-2 text-sm">10.</span>
                    <div className="flex-1">
                      <span className="font-bold text-sm">For women only:</span>
                      <div className="bg-blue-50 p-3 rounded border border-blue-200 mt-2">
                        <h4 className="text-lg font-bold text-blue-600 mb-2">For Women Only:</h4>
                        <div className="space-y-1">
                          {womenOnlyQuestions.map((womenQuestion, womenIndex) => (
                            <div key={womenIndex} className="flex items-center">
                              <span className="text-sm text-gray-700 mr-2">{womenQuestion}:</span>
                              <span className="text-sm text-gray-700">{dentalChart.medicalHistory?.[`women_${womenIndex}`] || ''}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Questions 11-12 */}
                  {medicalHistory.slice(10, 12).map((question, index) => (
                    <div key={index + 10} className="flex items-start">
                      <span className="font-bold mr-2 text-sm">{index + 11}.</span>
                      <div className="flex-1">
                        <span className="font-bold text-sm">{question}</span>
                        <span className="text-gray-700 text-sm ml-2">{dentalChart.medicalHistory?.[`question_${index + 10}`] || ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Medical Conditions in View Mode */}
                <div className="mt-2">
                  <h4 className="font-bold text-sm text-gray-700 mb-3">Medical Conditions:</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 bg-gray-50 p-6 rounded-md">
                    {medicalConditions.map(condition => {
                      const isChecked = dentalChart.medicalConditions?.[condition];
                      return (
                        <div key={condition} className="flex items-center space-x-3">
                          <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
                            isChecked 
                              ? 'bg-green-500 border-green-500' 
                              : 'bg-white border-gray-300'
                          }`}>
                            {isChecked && (
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm text-gray-700 font-medium">{condition}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tooth Symbol Selection (Only for Doctors in Edit Mode) */}
      {editMode && selectedTooth && false && (
        <div className="p-4 bg-blue-50 border-t border-blue-200">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Edit Tooth #{selectedTooth}
            </h3>
            <div className="grid grid-cols-8 gap-2">
              {Object.entries(chartSymbols).map(([symbol, description]) => (
                <button
                  key={symbol}
                  onClick={() => updateToothData(selectedTooth, 'symbol', symbol)}
                  className={`p-3 border rounded-md text-center hover:bg-blue-100 ${
                    dentalChart.teeth?.[selectedTooth]?.symbol === symbol
                      ? 'bg-blue-200 border-blue-500'
                      : 'bg-white border-gray-300'
                  }`}
                  title={description}
                >
                  <div className="font-bold text-lg text-red-600">{symbol}</div>
                  <div className="text-xs text-gray-600 mt-1">{description.substring(0, 20)}...</div>
                </button>
              ))}
              <button
                onClick={() => updateToothData(selectedTooth, 'symbol', '')}
                className="p-3 border rounded-md text-center hover:bg-red-100 bg-red-50 border-red-300"
                title="Clear symbol"
              >
                <div className="font-bold text-lg text-red-600">Clear</div>
                <div className="text-xs text-gray-600 mt-1">Remove symbol</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {editMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <FiEye className="h-5 w-5 text-blue-400 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">
                Editing Mode Instructions
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Update medical history and dental history responses</li>
                  <li>Modify patient information as needed</li>
                  <li>Dental chart symbols and professional sections are managed by dental staff</li>
                  <li>All sections will be included in the printed chart</li>
                  <li>Click "Save Chart" to save all your changes</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DentalChart;