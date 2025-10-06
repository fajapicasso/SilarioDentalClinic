// src/pages/doctor/DentalChart.jsx - Enhanced with Fixed Checkbox Printing
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSave, FiPrinter, FiDownload, FiEdit, FiEye, FiCalendar } from 'react-icons/fi';
import { toast } from 'react-toastify';
import supabase from '../../config/supabaseClient';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PDFGenerator from '../../components/common/PDFGenerator';
import StandardizedPrinter from '../../components/common/StandardizedPrinter';
import DatePicker from '../../components/common/DatePicker';

const DentalChart = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dentalChart, setDentalChart] = useState({});
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [editMode, setEditMode] = useState(true);
  const [bracesData, setBracesData] = useState(null);
  const [showBracesInfo, setShowBracesInfo] = useState(false);

  // Enhanced dental chart symbols - NO COLORS for easy management
  const chartSymbols = {
    'D': { name: 'Decayed (Caries Indicated for filling)', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'M': { name: 'Missing due to caries', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'F': { name: 'Filled', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'I': { name: 'Caries indicated for Extraction', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'RF': { name: 'Root Fragment', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'MO': { name: 'Missing due to other causes', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'Im': { name: 'Impacted Tooth', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'J': { name: 'Jacket Crown', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'A': { name: 'Amalgam Fillings', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'AB': { name: 'Abutment', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'P': { name: 'Pontic', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'In': { name: 'Inlay', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'FX': { name: 'Fixed Cure Composite', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'Rm': { name: 'Removable Denture', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'X': { name: 'Extraction due to caries', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'XO': { name: 'Extraction due to other causes', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    '✔': { name: 'Present Teeth', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'Cm': { name: 'Congenitally missing', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' },
    'Sp': { name: 'Supernumerary', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db' }
  };

  // Enhanced dental chart symbols - NO COLORS for easy management
  // Categories: Conditions, Restoration & Prosthetic, Surgery
  const enhancedChartSymbols = {
    // CONDITIONS - No colors
    'D': { name: 'Decayed (Caries Indicated for filling)', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '🦷', category: 'Conditions' },
    'M': { name: 'Missing due to caries', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '❌', category: 'Conditions' },
    'F': { name: 'Filled', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '✅', category: 'Conditions' },
    'I': { name: 'Caries indicated for Extraction', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '⚠️', category: 'Conditions' },
    'RF': { name: 'Root Fragment', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '🦴', category: 'Conditions' },
    'MO': { name: 'Missing due to other causes', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '🚫', category: 'Conditions' },
    'Im': { name: 'Impacted Tooth', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '🔒', category: 'Conditions' },
    
    // RESTORATION & PROSTHETIC - No colors
    'J': { name: 'Jacket Crown', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '👑', category: 'Restoration & Prosthetic' },
    'A': { name: 'Amalgam Fillings', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '🔗', category: 'Restoration & Prosthetic' },
    'AB': { name: 'Abutment', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '🌉', category: 'Restoration & Prosthetic' },
    'P': { name: 'Pontic', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '👑', category: 'Restoration & Prosthetic' },
    'In': { name: 'Inlay', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '🦷', category: 'Restoration & Prosthetic' },
    'FX': { name: 'Fixed Cure Composite', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '🔧', category: 'Restoration & Prosthetic' },
    'Rm': { name: 'Removable Denture', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '🦷', category: 'Restoration & Prosthetic' },
    
    // SURGERY - No colors
    'X': { name: 'Extraction due to caries', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '🚫', category: 'Surgery' },
    'XO': { name: 'Extraction due to other causes', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '🚫', category: 'Surgery' },
    '✔': { name: 'Present Teeth', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '✅', category: 'Surgery' },
    'Cm': { name: 'Congenitally missing', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '⭕', category: 'Surgery' },
    'Sp': { name: 'Supernumerary', color: '#000000', bgColor: '#ffffff', borderColor: '#d1d5db', icon: '➕', category: 'Surgery' }
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

  useEffect(() => {
    if (patientId) {
      fetchPatientData();
      fetchDentalChart();
      fetchBracesData();
    }
  }, [patientId]);

  const fetchPatientData = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', patientId)
        .single();
      
      if (error) throw error;
      setPatient(data);
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
      }
    } catch (error) {
      console.error('Error fetching dental chart:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBracesData = async () => {
    try {
      const { data, error } = await supabase
        .from('braces_treatment')
        .select('*')
        .eq('patient_id', patientId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching braces data:', error);
      } else if (data) {
        setBracesData(data);
      }
    } catch (error) {
      console.error('Error fetching braces data:', error);
    }
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
      // Refresh the dental chart data to ensure latest data is displayed
      fetchDentalChart();
    } catch (error) {
      console.error('Error saving dental chart:', error);
      toast.error('Failed to save dental chart');
    } finally {
      setIsSaving(false);
    }
  };

  const updateToothData = (toothNumber, field, value) => {
    // Check if it's a temporary tooth (letter) or permanent tooth (number)
    const isTemporaryTooth = typeof toothNumber === 'string' && toothNumber.match(/^[A-T]$/);
    
    if (isTemporaryTooth) {
      // Update temporary teeth
      setDentalChart(prev => ({
        ...prev,
        temporary_teeth: {
          ...prev.temporary_teeth,
          [toothNumber]: {
            ...prev.temporary_teeth?.[toothNumber],
            [field]: value
          }
        }
      }));
    } else {
      // Update permanent teeth
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
    }
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

  // Helper function to get dental condition colors - ensures consistency between legend and teeth
  const getDentalConditionColors = (symbolData) => {
    if (!symbolData) return null;
    
    return {
      backgroundColor: symbolData.bgColor || `${symbolData.color}20`,
      borderColor: symbolData.borderColor || symbolData.color,
      textColor: symbolData.color
    };
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
          .section-title {
            font-size: 13px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 3px;
            margin-top: 4px;
            letter-spacing: 0.1px;
          }
          .patient-info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 6px;
          }
          .patient-left-column, .patient-right-column {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .medical-history-grid {
            display: grid;
            grid-template-columns: 1.2fr 0.8fr;
            gap: 12px;
            margin-bottom: 6px;
          }
          .medical-left-column, .medical-right-column {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .medical-conditions-section {
            margin-top: 4px;
            padding: 6px;
            background: #f9fafb;
            border-radius: 4px;
            border: 1px solid #e5e7eb;
          }
          .conditions-title {
            font-weight: bold;
            color: #374151;
            margin-bottom: 3px;
            font-size: 11px;
          }
          .conditions-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 2px;
          }
          .condition-item {
            display: flex;
            align-items: center;
            gap: 3px;
            font-size: 9px;
          }
          .info-row {
            display: flex;
            align-items: center;
            margin-bottom: 1px;
            line-height: 1.2;
          }
          .info-label {
            color: #222;
            font-weight: bold;
            margin-right: 4px;
            font-size: 11px;
          }
          .info-value {
            font-weight: 600;
            color: #222;
            font-size: 11px;
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
            width: 12px;
            height: 12px;
            border: 1px solid #2563eb;
            margin-right: 4px;
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
            padding: 8px;
          }
          .screening-title {
            font-weight: bold;
            color: #374151;
            margin-bottom: 6px;
            font-size: 11px;
            text-decoration: underline;
          }
          .screening-items {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .screening-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 10px;
          }
          .screening-checkbox {
            width: 8px;
            height: 8px;
            border: 1px solid #6b7280;
            border-radius: 1px;
            background: #ffffff;
            flex-shrink: 0;
          }
          .screening-checkbox.checked {
            background: #000000;
            border-color: #000000;
          }
          .screening-lines {
            margin-top: 4px;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .screening-line {
            height: 1px;
            background: #6b7280;
            width: 100%;
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
          <div class="info-row">
            <span class="info-label">1. Previous dentist:</span> <span class="info-value">${dentalChart.dentalHistory?.question_0 || ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">2. Last dental visit:</span> <span class="info-value">${dentalChart.dentalHistory?.question_1 || ''}</span>
          </div>
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
                ${[1, 2, 3, 4, 5, 6, 7, 8].map(num => `
                  <div class="tooth">
                    <div class="tooth-symbol">${dentalChart.teeth?.[num]?.symbol || ''}</div>
                    <div class="tooth-number">${num}</div>
                  </div>
                `).join('')}
              </div>
              <div class="teeth-row">
                ${[32, 31, 30, 29, 28, 27, 26, 25].map(num => `
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
          <div class="legend-grid">
            <div class="legend-column">
              <div class="legend-column-title">Condition</div>
              <div class="legend-items">
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">D</div>
                  <span>D- Decayed (Caries Indicated for filling)</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">M</div>
                  <span>M- Missing due to caries</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">F</div>
                  <span>F- Filled</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">I</div>
                  <span>I- Caries indicated for Extraction</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">RF</div>
                  <span>RF- Root Fragment</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">MO</div>
                  <span>MO- Missing due to other causes</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">Im</div>
                  <span>Im- Impacted Tooth</span>
                </div>
              </div>
            </div>
            <div class="legend-column">
              <div class="legend-column-title">Restoration & Prosthetics</div>
              <div class="legend-items">
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">J</div>
                  <span>J- Jacket Crown</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">A</div>
                  <span>A- Amalgam Fillings</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">AB</div>
                  <span>AB- Abutment</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">P</div>
                  <span>P- Pontic</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">In</div>
                  <span>In- Inlay</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">FX</div>
                  <span>FX- Fixed Cure Composite</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">Rm</div>
                  <span>Rm- Removable Denture</span>
                </div>
              </div>
            </div>
            <div class="legend-column">
              <div class="legend-column-title">Surgery</div>
              <div class="legend-items">
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">X</div>
                  <span>X- Extraction due to caries</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">XO</div>
                  <span>XO- Extraction due to other causes</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">✔</div>
                  <span>✔- Present Teeth</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">Cm</div>
                  <span>Cm- Congenitally missing</span>
                </div>
                <div class="legend-item">
                  <div class="legend-symbol" style="background-color: #ffffff; color: #000000; border-color: #d1d5db;">Sp</div>
                  <span>Sp- Supernumerary</span>
                </div>
              </div>
            </div>
          </div>
        </div>

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


  const renderTooth = (toothNumber, position = 'upper') => {
    // Check if it's a temporary tooth (letter) or permanent tooth (number)
    const isTemporaryTooth = typeof toothNumber === 'string' && toothNumber.match(/^[A-T]$/);
    const toothData = isTemporaryTooth 
      ? (dentalChart.temporary_teeth?.[toothNumber] || {})
      : (dentalChart.teeth?.[toothNumber] || {});
    const isSelected = selectedTooth === toothNumber;
    const hasBraces = bracesData && bracesData.status === 'active';
    
    // Get symbol data for color coding
    const symbolData = toothData.symbol ? enhancedChartSymbols[toothData.symbol] : null;
    const conditionColors = getDentalConditionColors(symbolData);
    
    return (
      <div
        key={toothNumber}
        className={`relative w-8 h-10 border-2 m-0.5 cursor-pointer flex flex-col items-center justify-center text-xs font-medium transition-all duration-200 ${
          isSelected ? 'shadow-md' : ''
        } ${editMode ? 'hover:shadow-md' : ''}`}
        style={(() => {
          // Apply color-coded styling based on symbol
          if (conditionColors) {
            return {
              backgroundColor: conditionColors.backgroundColor,
              borderColor: isSelected ? '#3b82f6' : conditionColors.borderColor,
              borderWidth: isSelected ? '3px' : '2px',
              backgroundImage: `linear-gradient(135deg, transparent, ${conditionColors.textColor}10)`,
              boxShadow: `0 0 0 1px ${conditionColors.textColor}20 inset`
            };
          } else if (hasBraces) {
            return {
              backgroundColor: '#ecfdf5',
              borderColor: isSelected ? '#3b82f6' : '#10b981',
              borderWidth: isSelected ? '3px' : '2px',
              backgroundImage: 'linear-gradient(135deg, transparent, #10b98110)',
              boxShadow: '0 0 0 1px #10b98120 inset'
            };
          } else {
            return {
              backgroundColor: isSelected ? '#dbeafe' : '#ffffff',
              borderColor: isSelected ? '#3b82f6' : '#d1d5db',
              borderWidth: isSelected ? '3px' : '1px',
              backgroundImage: 'linear-gradient(135deg, #ffffff, #f8fafc)'
            };
          }
        })()}
        onClick={() => editMode && setSelectedTooth(toothNumber)}
        title={`Tooth ${toothNumber}${symbolData ? ` - ${symbolData.name}` : ''}${hasBraces ? ' (Has Braces)' : ''}`}
      >
        {position === 'upper' && toothData.symbol && (
          <div 
            className="font-bold text-sm leading-none drop-shadow-sm"
            style={{
              color: conditionColors?.textColor || '#dc2626',
              textShadow: '0 0 2px rgba(255,255,255,0.8)',
              fontWeight: '900'
            }}
          >
            {toothData.symbol}
          </div>
        )}
        <div className="text-xs font-bold text-gray-700">
          {toothNumber}
        </div>
        {position === 'lower' && toothData.symbol && (
          <div 
            className="font-bold text-sm leading-none drop-shadow-sm"
            style={{
              color: conditionColors?.textColor || '#dc2626',
              textShadow: '0 0 2px rgba(255,255,255,0.8)',
              fontWeight: '900'
            }}
          >
            {toothData.symbol}
          </div>
        )}
        {hasBraces && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-white" 
               title="This patient has braces"></div>
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
          <h3 className="text-lg font-medium text-gray-900">Patient not found</h3>
          <button
            onClick={() => navigate('/doctor/patients')}
            className="mt-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            <FiArrowLeft className="mr-2 -ml-1 h-5 w-5" />
            Back to Patient List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-primary-700 hover:bg-primary-50"
          >
            <FiArrowLeft className="mr-1 h-4 w-4" />
            Back
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">Comprehensive Dental Chart</h1>
              {bracesData && (
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    bracesData.status === 'completed' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {bracesData.status === 'completed' ? 'Braces Completed' : 'Has Braces'}
                  </span>
                  <button
                    onClick={() => setShowBracesInfo(!showBracesInfo)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    {showBracesInfo ? 'Hide' : 'Show'} Details
                  </button>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500">{patient.full_name}</p>
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
          {editMode ? (
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
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
            >
              <FiEdit className="mr-2 -ml-1 h-5 w-5" />
              Edit Chart
            </button>
          )}
        </div>
      </div>

      {/* Braces Information Panel */}
      {showBracesInfo && bracesData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Braces Treatment Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center mb-2">
                <span className="font-medium text-blue-800">Status:</span>
                <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${
                  bracesData.status === 'completed' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {bracesData.status === 'completed' ? 'Completed' : 'Active'}
                </span>
              </div>
              <div className="text-sm text-blue-700">
                <div><span className="font-medium">Started:</span> {new Date(bracesData.start_date).toLocaleDateString()}</div>
                {bracesData.end_date && (
                  <div><span className="font-medium">Completed:</span> {new Date(bracesData.end_date).toLocaleDateString()}</div>
                )}
                <div><span className="font-medium">Estimated Duration:</span> {bracesData.estimated_duration_months || 24} months</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigate(`/doctor/patients/${patientId}/braces-chart`)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <FiEye className="mr-2 h-4 w-4" />
                View Braces Chart
              </button>
              <button
                onClick={() => navigate('/doctor/braces-calendar')}
                className="inline-flex items-center px-3 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50"
              >
                <FiCalendar className="mr-2 h-4 w-4" />
                Braces Calendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Dental Chart Layout */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-gray-300">
        {/* Header with Logo */}
        <div className="flex items-center justify-center p-6 border-b-2 border-black bg-gray-50">
          <div className="flex items-center">
            <div className="w-16 h-16 border-3 border-blue-600 rounded-full flex items-center justify-center bg-blue-500 text-white font-bold text-xl mr-4">
              SDC
            </div>
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
                    <span className="font-bold text-sm">{question}</span>
                    {!editMode && dentalChart.dentalHistory?.[`question_${index}`] && (
                      <span className="ml-2 text-gray-700 text-sm flex-shrink-0">{dentalChart.dentalHistory[`question_${index}`]}</span>
                    )}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                {/* Medical History Questions - Two Column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - Questions 1-8 + Question 13 */}
                  <div className="space-y-4">
                    {/* Questions 1-8 on the left side */}
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
                    
                    {/* Spacing between question 8 and 13 */}
                    <div className="mt-8"></div>
                    
                    {/* Question 13 on the left side */}
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

                  {/* Right Column - Questions 9-12 */}
                  <div className="space-y-4">
                    {/* Question 9 on the right side */}
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
                        <div className="space-y-2">
                          {womenOnlyQuestions.map((womenQuestion, womenIndex) => (
                            <div key={womenIndex} className="flex items-center space-x-2">
                              <label className="text-sm text-gray-700">{womenQuestion}</label>
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
              <div className="space-y-2 mb-6">
                
                {/* Medical History Questions - Two Column Layout */}
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
                        <div className="mt-1 space-y-1">
                          {womenOnlyQuestions.map((womenQuestion, womenIndex) => (
                            <div key={womenIndex} className="flex items-center">
                              <span className="text-sm text-gray-700">{womenQuestion}</span>
                              {dentalChart.medicalHistory?.[`women_${womenIndex}`] && (
                                <span className="text-gray-700 text-sm ml-2">{dentalChart.medicalHistory[`women_${womenIndex}`]}</span>
                              )}
                            </div>
                          ))}
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


        {/* Dental Chart */}
        <div className="border-2 border-black">
          <div className="bg-gray-100 p-3 border-b border-black">
            <h3 className="font-bold text-center text-xl">DENTAL RECORD CHART</h3>
          </div>
          <div className="p-6">
            {/* Temporary Teeth Section */}
            <div className="mb-6">
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4">
                <h4 className="font-bold text-center text-lg text-yellow-800">TEMPORARY TEETH</h4>
              </div>
              <div className="flex justify-center space-x-12">
                {/* Right Side - Temporary Teeth */}
                <div className="text-center">
                  <div className="font-bold text-lg mb-4">RIGHT</div>
                  
                  {/* Upper Right Temporary Teeth */}
                  <div className="flex mb-4">
                    {['A', 'B', 'C', 'D', 'E'].map(letter => renderTooth(letter, 'upper'))}
                  </div>
                  
                  {/* Lower Right Temporary Teeth */}
                  <div className="flex">
                    {['T', 'S', 'R', 'Q', 'P'].map(letter => renderTooth(letter, 'lower'))}
                  </div>
                </div>

                {/* Left Side - Temporary Teeth */}
                <div className="text-center">
                  <div className="font-bold text-lg mb-4">LEFT</div>
                  
                  {/* Upper Left Temporary Teeth */}
                  <div className="flex mb-4">
                    {['F', 'G', 'H', 'I', 'J'].map(letter => renderTooth(letter, 'upper'))}
                  </div>
                  
                  {/* Lower Left Temporary Teeth */}
                  <div className="flex">
                    {['O', 'N', 'M', 'L', 'K'].map(letter => renderTooth(letter, 'lower'))}
                  </div>
                </div>
              </div>
            </div>

            {/* Permanent Teeth Section */}
            <div className="border-t border-gray-300 pt-6">
              <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 mb-4">
                <h4 className="font-bold text-center text-lg text-blue-800">PERMANENT TEETH</h4>
              </div>
              <div className="flex justify-center space-x-12">
                {/* Right Side */}
                <div className="text-center">
                  <div className="font-bold text-lg mb-4">RIGHT</div>
                  
                  {/* Upper Right Teeth */}
                  <div className="flex mb-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(num => renderTooth(num, 'upper'))}
                  </div>
                  
                  {/* Lower Right Teeth */}
                  <div className="flex">
                    {[32, 31, 30, 29, 28, 27, 26, 25].map(num => renderTooth(num, 'lower'))}
                  </div>
                </div>

                {/* Left Side */}
                <div className="text-center">
                  <div className="font-bold text-lg mb-4">LEFT</div>
                  
                  {/* Upper Left Teeth */}
                  <div className="flex mb-4">
                    {[9, 10, 11, 12, 13, 14, 15, 16].map(num => renderTooth(num, 'upper'))}
                  </div>
                  
                  {/* Lower Left Teeth */}
                  <div className="flex">
                    {[24, 23, 22, 21, 20, 19, 18, 17].map(num => renderTooth(num, 'lower'))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tooth Symbol Selection (Only in Edit Mode) */}
        {editMode && selectedTooth && (
          <div className="p-4 bg-blue-50 border-t border-blue-200">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Edit Tooth {typeof selectedTooth === 'string' && selectedTooth.match(/^[A-T]$/) ? `#${selectedTooth}` : `#${selectedTooth}`}
              </h3>
              <div className="grid grid-cols-8 gap-2">
                {Object.entries(enhancedChartSymbols).map(([symbol, data]) => {
                  const conditionColors = getDentalConditionColors(data);
                  // Check if it's a temporary tooth and get data accordingly
                  const isTemporaryTooth = typeof selectedTooth === 'string' && selectedTooth.match(/^[A-T]$/);
                  const currentToothData = isTemporaryTooth 
                    ? (dentalChart.temporary_teeth?.[selectedTooth] || {})
                    : (dentalChart.teeth?.[selectedTooth] || {});
                  const isSelected = currentToothData?.symbol === symbol;
                  
                  return (
                    <button
                      key={symbol}
                      onClick={() => updateToothData(selectedTooth, 'symbol', symbol)}
                      className={`p-3 border-2 rounded-md text-center hover:shadow-md transition-all duration-200 ${
                        isSelected
                          ? 'shadow-lg ring-2 ring-blue-500'
                          : 'hover:shadow-md'
                      }`}
                      style={{
                        backgroundColor: isSelected ? '#dbeafe' : conditionColors?.backgroundColor || '#ffffff',
                        borderColor: isSelected ? '#3b82f6' : conditionColors?.borderColor || '#d1d5db',
                        backgroundImage: isSelected 
                          ? 'linear-gradient(135deg, #dbeafe, #bfdbfe)' 
                          : `linear-gradient(135deg, transparent, ${conditionColors?.textColor || '#ef4444'}10)`
                      }}
                      title={data.name}
                    >
                      <div 
                        className="font-bold text-lg"
                        style={{
                          color: conditionColors?.textColor || '#ef4444',
                          textShadow: '0 0 2px rgba(255,255,255,0.8)',
                          fontWeight: '900'
                        }}
                      >
                        {symbol}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {data.name && data.name.length > 20 ? data.name.substring(0, 20) + '...' : data.name}
                      </div>
                    </button>
                  );
                })}
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

        {/* Legend and Conditions */}
        <div className="grid grid-cols-2 gap-6 p-6 border-t border-gray-300 bg-gray-50">
          {/* Legend */}
          <div className="border border-gray-400 p-4">
            <h3 className="font-bold text-center mb-4 underline">Legend</h3>
            <div className="grid grid-cols-1 gap-1 text-xs">
              {Object.entries(enhancedChartSymbols).map(([symbol, data]) => {
                const conditionColors = getDentalConditionColors(data);
                return (
                  <div key={symbol} className="flex items-center space-x-2 p-1 rounded hover:bg-gray-100 transition-colors">
                    <div 
                      className="w-6 h-6 rounded border-2 flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md"
                      style={{ 
                        backgroundColor: conditionColors?.backgroundColor || '#fef2f2', 
                        borderColor: conditionColors?.borderColor || '#fecaca',
                        color: conditionColors?.textColor || '#ef4444',
                        textShadow: '0 0 2px rgba(255,255,255,0.8)',
                        fontWeight: '900'
                      }}
                    >
                      {symbol}
                    </div>
                    <span className="text-xs text-gray-600 truncate flex-1" title={data.name}>
                      {data.name && data.name.length > 20 ? data.name.substring(0, 20) + '...' : data.name}
                    </span>
                  </div>
                );
              })}
            </div>
            {bracesData && (
              <div className="mt-4 pt-4 border-t border-gray-300">
                <h4 className="font-bold text-center mb-2 underline text-xs">Braces Status</h4>
                <div className="flex items-center justify-center">
                  <div className="w-4 h-4 bg-blue-50 border border-blue-300 rounded mr-2"></div>
                  <span className="text-xs">Teeth with braces</span>
                </div>
                <div className="flex items-center justify-center mt-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-full border border-white mr-2"></div>
                  <span className="text-xs">Braces indicator</span>
                </div>
              </div>
            )}
          </div>

          {/* Doctor Assessment Sections - 4 Sections */}
          <div className="grid grid-cols-2 gap-4">
            {/* Prediodical Screening */}
            <div className="border border-blue-400 p-3 bg-blue-50">
              <h4 className="font-bold text-center mb-2 underline text-xs text-blue-800">🔍 Prediodical Screening</h4>
              <div className="space-y-1">
                {['Gingivitis', 'Early Periodontics', 'Moderate Periodontics', 'Advanced Periodontics'].map((condition) => (
                  <label key={condition} className="flex items-center text-xs">
                    <input
                      type="checkbox"
                      checked={dentalChart.prediodical_screening?.[condition] || false}
                      onChange={(e) => updateChartData('prediodical_screening', condition, e.target.checked)}
                      disabled={!editMode}
                      className="mr-2 h-3 w-3 text-blue-600"
                    />
                    <span>{condition}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Occlusion */}
            <div className="border border-green-400 p-3 bg-green-50">
              <h4 className="font-bold text-center mb-2 underline text-xs text-green-800">🦷 Occlusion</h4>
              <div className="space-y-1">
                {['Class (Molar)', 'Overjet', 'Overbite', 'Midline Deviation', 'Crossbite'].map((condition) => (
                  <label key={condition} className="flex items-center text-xs">
                    <input
                      type="checkbox"
                      checked={dentalChart.occlusion?.[condition] || false}
                      onChange={(e) => updateChartData('occlusion', condition, e.target.checked)}
                      disabled={!editMode}
                      className="mr-2 h-3 w-3 text-green-600"
                    />
                    <span>{condition}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Appliances */}
            <div className="border border-yellow-400 p-3 bg-yellow-50">
              <h4 className="font-bold text-center mb-2 underline text-xs text-yellow-800">🦷 Appliances</h4>
              <div className="space-y-1">
                {['Orthodontic', 'Stayplate'].map((appliance) => (
                  <label key={appliance} className="flex items-center text-xs">
                    <input
                      type="checkbox"
                      checked={dentalChart.appliances?.[appliance] || false}
                      onChange={(e) => updateChartData('appliances', appliance, e.target.checked)}
                      disabled={!editMode}
                      className="mr-2 h-3 w-3 text-yellow-600"
                    />
                    <span>{appliance}</span>
                  </label>
                ))}
                <div className="flex items-center text-xs">
                  <input
                    type="checkbox"
                    checked={dentalChart.appliances?.['Others'] || false}
                    onChange={(e) => updateChartData('appliances', 'Others', e.target.checked)}
                    disabled={!editMode}
                    className="mr-2 h-3 w-3 text-yellow-600"
                  />
                  <span>Others:</span>
                  <input
                    type="text"
                    value={dentalChart.appliances_others || ''}
                    onChange={(e) => updateChartData('appliances_others', '', e.target.value)}
                    disabled={!editMode}
                    className="ml-1 text-xs border border-yellow-300 rounded px-1 py-0.5 w-20"
                    placeholder="Specify"
                  />
                </div>
              </div>
            </div>

            {/* TMD */}
            <div className="border border-red-400 p-3 bg-red-50">
              <h4 className="font-bold text-center mb-2 underline text-xs text-red-800">⚠️ TMD</h4>
              <div className="space-y-1">
                {['Clenching', 'Clicking', 'Trismus', 'Muscle Spasm'].map((condition) => (
                  <label key={condition} className="flex items-center text-xs">
                    <input
                      type="checkbox"
                      checked={dentalChart.tmd?.[condition] || false}
                      onChange={(e) => updateChartData('tmd', condition, e.target.checked)}
                      disabled={!editMode}
                      className="mr-2 h-3 w-3 text-red-600"
                    />
                    <span>{condition}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

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
                  <li>Click on any tooth to select it and assign a dental symbol</li>
                  <li>Check medical conditions and dental history responses</li>
                  <li>Mark conditions, applications, and TMD symptoms as needed</li>
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