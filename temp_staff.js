// src/pages/doctor/DentalChart.jsx - Enhanced with Official Forms Layout
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiSave, FiPrinter, FiDownload, FiEdit, FiEye, FiX, FiActivity } from 'react-icons/fi';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'react-toastify';
import supabase from '../../config/supabaseClient';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ModernDentalChart from '../../components/common/ModernDentalChart';

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
  const chartPrintRef = useRef(null);
  
  // Treatment History States for ModernDentalChart
  const [treatments, setTreatments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [procedureFilter, setProcedureFilter] = useState('');
  const [toothFilter, setToothFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState({ start: '', end: '' });
  const [filteredTreatments, setFilteredTreatments] = useState([]);

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
  const medicalHistory = [
    'Are you under any form of medication? If yes, please specify',
    'Have you been hospitalized or seriously ill? If yes, when and why?',
    'Are you pregnant?',
    'Are you nursing?',
    'Are you taking birth control pills?',
    'Do you have or have you had any of the following? Check which apply:'
  ];

  const medicalConditions = [
    'High Blood Pressure', 'Low Blood Pressure', 'Epilepsy or Seizures', 'AIDS or HIV Positive',
    'Sexually Transmitted Disease', 'Stomach Troubles', 'Fainting Spells', 'Rapid Weight Loss',
    'Radiation Treatment', 'Joint Replacement', 'Heart Surgery', 'Heart Attack',
    'Heart Murmur', 'Heart Disease', 'Heart Pacemaker', 'Thyroid Problems',
    'Respiratory Problems', 'Hepatitis/Liver Disease', 'Rheumatic Fever', 'Diabetes',
    'Chemotherapy', 'Kidney Problems', 'Tuberculosis', 'Persistent Cough',
    'Bleeding Problems', 'Blood Disease', 'Head Injuries', 'Arthritis or Rheumatism'
  ];

  const dentalHistory = [
    'What is your chief dental concern?',
    'Previous Dentist:',
    'Last Dental Visit:',
    'Do you have toothache now?',
    'Do you clench or grind your teeth?',
    'Have you ever had serious trouble with any previous dental treatment?',
    'Have you ever had complications from anesthetics?'
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

  useEffect(() => {
    if (patientId) {
      fetchPatientData();
      fetchDentalChart();
      fetchTreatmentHistory();
    }
  }, [patientId]);

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
      filtered = filtered.filter(treatment => treatment.tooth_number === parseInt(toothFilter));
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

  const fetchPatientData = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', patientId)
        .single();
      
      if (error) throw error;
      setPatient(data);
      setOriginalPatient(data);
    } catch (error) {
      console.error('Error fetching patient:', error);
      toast.error('Failed to load patient data');
    }
  };

  const fetchDentalChart = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('dental_charts')
        .select('*')
        .eq('patient_id', patientId)
        .single();
      
      if (data) {
        setDentalChart(data.chart_data || {});
        setOriginalDentalChart(data.chart_data || {});
      }
    } catch (error) {
      console.error('Error fetching dental chart:', error);
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

  const saveDentalChart = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const chartData = {
        patient_id: patientId,
        chart_data: dentalChart,
        created_by: user.id,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('dental_charts')
        .upsert(chartData, {
          onConflict: 'patient_id'
        });

      if (error) throw error;
      
      toast.success('Dental chart saved successfully');
      setEditMode(false);
      // Update original data after successful save
      setOriginalDentalChart(dentalChart);
      setOriginalPatient(patient);
    } catch (error) {
      console.error('Error saving dental chart:', error);
      toast.error('Failed to save dental chart');
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
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups for this site.');
      return;
    }

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

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
            padding-bottom: 8px;
            margin-bottom: 18px;
            position: relative;
            min-height: 90px;
          }
          .logo-img {
            width: 80px;
            height: 80px;
            object-fit: contain;
            margin-right:26px;
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
            font-size: 18px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 2px;
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
            margin: 8px 0 12px 0;
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
            margin-bottom: 8px;
            letter-spacing: 0.2px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 18px;
            font-size: 12px;
            margin-bottom: 8px;
          }
          .info-label {
            color: #888;
            font-weight: 500;
            margin-right: 6px;
          }
          .info-value {
            font-weight: bold;
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
          .conditions-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1fr;
            gap: 6px 12px;
            margin-top: 6px;
            margin-bottom: 6px;
          }
          .condition-item {
            display: flex;
            align-items: center;
            font-size: 12px;
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
          .chart-title {
            font-size: 14px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 8px;
            text-align: center;
            letter-spacing: 0.2px;
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
            margin-bottom: 4px;
            font-size: 12px;
            color: #2563eb;
            text-decoration: underline;
          }
          .legend-item {
            display: flex;
            margin: 2px 0;
            align-items: flex-start;
          }
          .legend-symbol {
            font-weight: bold;
            width: 14px;
            text-align: center;
            margin-right: 4px;
            color: #e11d48;
            flex-shrink: 0;
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
            text-align: justify;
            margin-bottom: 8px;
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

        <!-- First Page: Patient Info, Medical History, Medical Conditions, Dental History -->
        <div class="card">
          <div class="card-title">Patient Information</div>
          <div class="info-grid">
            <div><span class="info-label">Name:</span> <span class="info-value">${patient?.full_name || ''}</span></div>
            <div><span class="info-label">Nickname:</span> <span class="info-value">${patient?.nickname || ''}</span></div>
            <div><span class="info-label">Age:</span> <span class="info-value">${patient?.birthday ? calculateAge(patient.birthday) : ''}</span></div>
            <div><span class="info-label">Sex:</span> <span class="info-value">${patient?.gender ? patient.gender.charAt(0).toUpperCase() : ''}</span></div>
            <div><span class="info-label">Address:</span> <span class="info-value">${patient?.address || ''}</span></div>
            <div><span class="info-label">Nationality:</span> <span class="info-value">${patient?.nationality || ''}</span></div>
            <div><span class="info-label">Home No.:</span> <span class="info-value">${patient?.phone || ''}</span></div>
            <div><span class="info-label">Date:</span> <span class="info-value">${currentDate}</span></div>
            <div><span class="info-label">Occupation:</span> <span class="info-value">${patient?.occupation || ''}</span></div>
            <div><span class="info-label">Office No.:</span> <span class="info-value">${patient?.office_no || ''}</span></div>
            <div><span class="info-label">Birthdate:</span> <span class="info-value">${patient?.birthday || ''}</span></div>
            <div><span class="info-label">Cell/Mobile:</span> <span class="info-value">${patient?.mobile || patient?.phone || ''}</span></div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Medical History</div>
          <div class="section-block">
            ${medicalHistory.map((question, index) => `
              <div class="question-block">
                <span class="question-label">${index + 1}. ${question}</span>
                ${dentalChart.medicalHistory?.[`question_${index}`] ? `<div class="question-response">${dentalChart.medicalHistory[`question_${index}`]}</div>` : '<div class="question-response">_____________________</div>'}
              </div>
            `).join('')}
          </div>
          <div class="card-title" style="font-size:11px;margin-top:8px;">Medical Conditions</div>
          <div class="conditions-grid">
            ${medicalConditions.map(condition => `
              <div class="condition-item">
                <div class="checkbox ${dentalChart.medicalConditions?.[condition] ? 'checked' : ''}"></div>
                <span>${condition}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-title">Dental History</div>
          <div class="section-block">
            ${dentalHistory.map((question, index) => `
              <div class="question-block">
                <span class="question-label">${index + 1}. ${question}</span>
                ${dentalChart.dentalHistory?.[`question_${index}`] ? `<div class="question-response">${dentalChart.dentalHistory[`question_${index}`]}</div>` : '<div class="question-response">_____________________</div>'}
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
          ${Object.entries(chartSymbols).map(([symbol, description]) => `
            <div class="legend-item">
              <div class="legend-symbol">${symbol}</div>
              <div>${description}</div>
            </div>
          `).join('')}
        </div>

        <div class="conditions-section">
          <div class="condition-box">
            <div class="condition-title">Conditions</div>
            ${Object.entries(conditions).map(([condition, checked]) => `
              <div class="checkbox-item">
                <div class="checkbox ${dentalChart.conditions?.[condition] ? 'checked' : ''}"></div>
                <span>${condition}</span>
              </div>
            `).join('')}
          </div>
          <div class="condition-box">
            <div class="condition-title">Applications</div>
            ${Object.entries(applications).map(([application, checked]) => `
              <div class="checkbox-item">
                <div class="checkbox ${dentalChart.applications?.[application] ? 'checked' : ''}"></div>
                <span>${application}</span>
              </div>
            `).join('')}
          </div>
          <div class="condition-box">
            <div class="condition-title">TMD</div>
            ${Object.entries(tmdConditions).map(([condition, checked]) => `
              <div class="checkbox-item">
                <div class="checkbox ${dentalChart.tmd?.[condition] ? 'checked' : ''}"></div>
                <span>${condition}</span>
              </div>
            `).join('')}
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

    printWindow.document.write(printHTML);
    printWindow.document.close();
    toast.success('Opening print dialog...');
  };

  const handleDownloadPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups for this site.');
      return;
    }

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

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
            padding-bottom: 8px;
            margin-bottom: 18px;
            position: relative;
            min-height: 90px;
          }
          .logo-img {
            width: 80px;
            height: 80px;
            object-fit: contain;
            margin-right:26px;
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
            font-size: 18px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 2px;
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
            margin: 8px 0 12px 0;
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
            margin-bottom: 8px;
            letter-spacing: 0.2px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 18px;
            font-size: 12px;
            margin-bottom: 8px;
          }
          .info-label {
            color: #888;
            font-weight: 500;
            margin-right: 6px;
          }
          .info-value {
            font-weight: bold;
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
          .conditions-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1fr;
            gap: 6px 12px;
            margin-top: 6px;
            margin-bottom: 6px;
          }
          .condition-item {
            display: flex;
            align-items: center;
            font-size: 12px;
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
          .chart-title {
            font-size: 14px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 8px;
            text-align: center;
            letter-spacing: 0.2px;
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
            margin-bottom: 4px;
            font-size: 12px;
            color: #2563eb;
            text-decoration: underline;
          }
          .legend-item {
            display: flex;
            margin: 2px 0;
            align-items: flex-start;
          }
          .legend-symbol {
            font-weight: bold;
            width: 14px;
            text-align: center;
            margin-right: 4px;
            color: #e11d48;
            flex-shrink: 0;
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
            text-align: justify;
            margin-bottom: 8px;
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

        <!-- First Page: Patient Info, Medical History, Medical Conditions, Dental History -->
        <div class="card">
          <div class="card-title">Patient Information</div>
          <div class="info-grid">
            <div><span class="info-label">Name:</span> <span class="info-value">${patient?.full_name || ''}</span></div>
            <div><span class="info-label">Nickname:</span> <span class="info-value">${patient?.nickname || ''}</span></div>
            <div><span class="info-label">Age:</span> <span class="info-value">${patient?.birthday ? calculateAge(patient.birthday) : ''}</span></div>
            <div><span class="info-label">Sex:</span> <span class="info-value">${patient?.gender ? patient.gender.charAt(0).toUpperCase() : ''}</span></div>
            <div><span class="info-label">Address:</span> <span class="info-value">${patient?.address || ''}</span></div>
            <div><span class="info-label">Nationality:</span> <span class="info-value">${patient?.nationality || ''}</span></div>
            <div><span class="info-label">Home No.:</span> <span class="info-value">${patient?.phone || ''}</span></div>
            <div><span class="info-label">Date:</span> <span class="info-value">${currentDate}</span></div>
            <div><span class="info-label">Occupation:</span> <span class="info-value">${patient?.occupation || ''}</span></div>
            <div><span class="info-label">Office No.:</span> <span class="info-value">${patient?.office_no || ''}</span></div>
            <div><span class="info-label">Birthdate:</span> <span class="info-value">${patient?.birthday || ''}</span></div>
            <div><span class="info-label">Cell/Mobile:</span> <span class="info-value">${patient?.mobile || patient?.phone || ''}</span></div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Medical History</div>
          <div class="section-block">
            ${medicalHistory.map((question, index) => `
              <div class="question-block">
                <span class="question-label">${index + 1}. ${question}</span>
                ${dentalChart.medicalHistory?.[`question_${index}`] ? `<div class="question-response">${dentalChart.medicalHistory[`question_${index}`]}</div>` : '<div class="question-response">_____________________</div>'}
              </div>
            `).join('')}
          </div>
          <div class="card-title" style="font-size:11px;margin-top:8px;">Medical Conditions</div>
          <div class="conditions-grid">
            ${medicalConditions.map(condition => `
              <div class="condition-item">
                <div class="checkbox ${dentalChart.medicalConditions?.[condition] ? 'checked' : ''}"></div>
                <span>${condition}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-title">Dental History</div>
          <div class="section-block">
            ${dentalHistory.map((question, index) => `
              <div class="question-block">
                <span class="question-label">${index + 1}. ${question}</span>
                ${dentalChart.dentalHistory?.[`question_${index}`] ? `<div class="question-response">${dentalChart.dentalHistory[`question_${index}`]}</div>` : '<div class="question-response">_____________________</div>'}
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
          ${Object.entries(chartSymbols).map(([symbol, description]) => `
            <div class="legend-item">
              <div class="legend-symbol">${symbol}</div>
              <div>${description}</div>
            </div>
          `).join('')}
        </div>

        <div class="conditions-section">
          <div class="condition-box">
            <div class="condition-title">Conditions</div>
            ${Object.entries(conditions).map(([condition, checked]) => `
              <div class="checkbox-item">
                <div class="checkbox ${dentalChart.conditions?.[condition] ? 'checked' : ''}"></div>
                <span>${condition}</span>
              </div>
            `).join('')}
          </div>
          <div class="condition-box">
            <div class="condition-title">Applications</div>
            ${Object.entries(applications).map(([application, checked]) => `
              <div class="checkbox-item">
                <div class="checkbox ${dentalChart.applications?.[application] ? 'checked' : ''}"></div>
                <span>${application}</span>
              </div>
            `).join('')}
          </div>
          <div class="condition-box">
            <div class="condition-title">TMD</div>
            ${Object.entries(tmdConditions).map(([condition, checked]) => `
              <div class="checkbox-item">
                <div class="checkbox ${dentalChart.tmd?.[condition] ? 'checked' : ''}"></div>
                <span>${condition}</span>
              </div>
            `).join('')}
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

    printWindow.document.write(printHTML);
    printWindow.document.close();
    toast.success('Opening print dialog...');
  };
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
            </div>
          </div>
        <div className="flex space-x-2">
          <button
            onClick={printDentalChart}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <FiPrinter className="mr-2 -ml-1 h-5 w-5" />
            Print Chart
          </button>
          <button
            onClick={handleDownloadPdf}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <FiDownload className="mr-2 -ml-1 h-5 w-5" />
            Download PDF
          </button>
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
      <div ref={chartPrintRef} className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-gray-300">
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
          </div>
          ) : (
            <div className="grid grid-cols-4 gap-4 text-sm">
              {/* Name */}
              <div className="flex items-center border-b border-black pb-1">
                <span className="font-bold mr-2">Name:</span>
                <span className="flex-1">{patient.full_name}</span>
        </div>
              {/* Nickname */}
              <div className="flex items-center border-b border-black pb-1">
                <span className="font-bold mr-2">Nickname:</span>
                <span className="flex-1">{patient.nickname || ''}</span>
              </div>
              {/* Age */}
              <div className="flex items-center border-b border-black pb-1">
                <span className="font-bold mr-2">Age:</span>
                <span className="flex-1">{patient.birthday ? calculateAge(patient.birthday) : ''}</span>
              </div>
              {/* Sex */}
              <div className="flex items-center border-b border-black pb-1">
                <span className="font-bold mr-2">Sex:</span>
                <span className="flex-1">{patient.gender ? patient.gender.charAt(0).toUpperCase() : ''}</span>
              </div>
              {/* Address */}
              <div className="flex items-center border-b border-black pb-1">
                <span className="font-bold mr-2">Address:</span>
                <span className="flex-1">{patient.address}</span>
              </div>
              {/* Nationality */}
              <div className="flex items-center border-b border-black pb-1">
                <span className="font-bold mr-2">Nationality:</span>
                <span className="flex-1">{patient.nationality || ''}</span>
              </div>
              {/* Home No. */}
              <div className="flex items-center border-b border-black pb-1">
                <span className="font-bold mr-2">Home No.:</span>
                <span className="flex-1">{patient.phone}</span>
              </div>
              {/* Date */}
              <div className="flex items-center border-b border-black pb-1">
                <span className="font-bold mr-2">Date:</span>
                <span className="flex-1">{new Date().toLocaleDateString()}</span>
              </div>
              {/* Occupation */}
              <div className="flex items-center border-b border-black pb-1">
                <span className="font-bold mr-2">Occupation:</span>
                <span className="flex-1">{patient.occupation || ''}</span>
              </div>
              {/* Office No. */}
              <div className="flex items-center border-b border-black pb-1">
                <span className="font-bold mr-2">Office No.:</span>
                <span className="flex-1">{patient.office_no || ''}</span>
              </div>
              {/* Birthdate */}
              <div className="flex items-center border-b border-black pb-1">
                <span className="font-bold mr-2">Birthdate:</span>
                <span className="flex-1">{patient.birthday}</span>
              </div>
              {/* Cell/Mobile */}
              <div className="flex items-center border-b border-black pb-1">
                <span className="font-bold mr-2">Cell/Mobile:</span>
                <span className="flex-1">{patient.mobile || patient.phone}</span>
              </div>
            </div>
          )}
        </div>
        {/* Medical History Section */}
        <div className="border-b border-gray-300">
          <div className="bg-gray-100 p-3 border-b border-gray-400 rounded-t-md">
            <h3 className="font-bold text-center text-lg">MEDICAL HISTORY</h3>
          </div>
          <div className="p-6">
            {editMode ? (
              <div className="space-y-6">
                {medicalHistory.map((question, index) => (
                  <div key={index} className="mb-2">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Medical Conditions</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-md">
                    {medicalConditions.map(condition => (
                      <label key={condition} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={dentalChart.medicalConditions?.[condition] || false}
                          onChange={(e) => updateChartData('medicalConditions', condition, e.target.checked)}
                          className="h-5 w-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">{condition}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {medicalHistory.map((question, index) => (
                  <div key={index} className="flex items-start">
                    <span className="font-bold mr-3 text-sm">{index + 1}.</span>
                    <span className="text-sm flex-1">{question}</span>
                    {!editMode && dentalChart.medicalHistory?.[`question_${index}`] && (
                      <span className="ml-4 text-gray-700">{dentalChart.medicalHistory[`question_${index}`]}</span>
                    )}
                  </div>
                ))}
                
                {/* Medical Conditions in View Mode */}
                <div className="mt-6">
                  <h4 className="font-bold text-sm text-gray-700 mb-3">Medical Conditions:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 bg-gray-50 p-4 rounded-md">
                    {medicalConditions.map(condition => (
                      <div key={condition} className="flex items-center space-x-2">
                        <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                          dentalChart.medicalConditions?.[condition] 
                            ? 'bg-green-500 border-green-500' 
                            : 'bg-white border-gray-300'
                        }`}>
                          {dentalChart.medicalConditions?.[condition] && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm text-gray-700">{condition}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Dental History Section */}
        <div className="border-b border-gray-300">
          <div className="bg-gray-100 p-3 border-b border-gray-400 rounded-t-md">
            <h3 className="font-bold text-center text-lg">DENTAL HISTORY</h3>
          </div>
          <div className="p-6">
            {editMode ? (
              <div className="space-y-6">
                {dentalHistory.map((question, index) => (
                  <div key={index} className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{index + 1}. {question}</label>
                    <textarea
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Response"
                      value={dentalChart.dentalHistory?.[`question_${index}`] || ''}
                      onChange={e => updateChartData('dentalHistory', `question_${index}`, e.target.value)}
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {dentalHistory.map((question, index) => (
                  <div key={index} className="flex items-start">
                    <span className="font-bold mr-3 text-sm">{index + 1}.</span>
                    <span className="text-sm flex-1">{question}</span>
                    {!editMode && dentalChart.dentalHistory?.[`question_${index}`] && (
                      <span className="ml-4 text-gray-700">{dentalChart.dentalHistory[`question_${index}`]}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
              </div>
            </div>
            

        
      </div>

      {/* Tooth Symbol Selection (Only in Edit Mode) */}
      {editMode && selectedTooth && (
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