// src/components/common/ModernDentalChart.jsx - Modern Interactive Dental Chart
import React, { useState, useEffect } from 'react';
import { FiInfo, FiPlus, FiActivity, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import supabase from '../../config/supabaseClient';

const ModernDentalChart = ({ 
  dentalChart = {}, 
  treatments = [], 
  onToothClick, 
  selectedTeeth = [], 
  selectedTooth = null,
  editMode = false,
  role = 'patient', // 'doctor', 'staff', 'patient'
  chartSymbols = {}, // Add chartSymbols prop
  patientId = null, // Add patientId prop for database operations
  onDentalChartUpdate // Callback to update parent component's dental chart state
}) => {
  const [hoveredTooth, setHoveredTooth] = useState(null);
  const [showHoverModal, setShowHoverModal] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Debounced hover handlers to prevent glitching
  const handleToothHover = (toothNumber, event) => {
    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    
    // Capture mouse position with stable side positioning
    if (event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const modalWidth = 320;
      const modalHeight = 200;
      
      // Always position to the right first
      let x = rect.right + 15; // 15px to the right of the tooth
      let y = rect.top; // Align with top of tooth
      
      // If not enough space on the right, position to the left
      if (x + modalWidth > viewportWidth - 20) {
        x = rect.left - modalWidth - 15; // 15px to the left of the tooth
      }
      
      // Final boundary checks
      x = Math.max(10, Math.min(x, viewportWidth - modalWidth - 10));
      y = Math.max(10, Math.min(y, window.innerHeight - modalHeight - 10));
      
      setMousePosition({ x, y });
    }
    
    // Set new timeout for hover
    const timeout = setTimeout(() => {
      setHoveredTooth(toothNumber);
      setShowHoverModal(true);
    }, 80); // Optimized delay for stability
    
    setHoverTimeout(timeout);
  };
  
  const handleToothLeave = () => {
    // Clear timeout if mouse leaves before delay
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    
    // Clear hover state immediately for better responsiveness
    setHoveredTooth(null);
    setShowHoverModal(false);
  };
  
  const [assessmentData, setAssessmentData] = useState({
    // Prediodical Screening (1/4)
    gingivitis: false,
    early_periodontics: false,
    moderate_periodontics: false,
    advanced_periodontics: false,
    
    // Occlusion (2/4)
    class_molar: false,
    overjet: false,
    overbite: false,
    midline_deviation: false,
    crossbite: false,
    
    // Appliances (3/4)
    orthodontic: false,
    stayplate: false,
    others_notes: '',
    
    // TMD (4/4)
    clenching: false,
    clicking: false,
    trismus: false,
    muscle_spasm: false
  });
  const [isLoadingAssessment, setIsLoadingAssessment] = useState(false);
  const [isSavingAssessment, setIsSavingAssessment] = useState(false);
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  // Initialize assessment data in dental chart if missing
  const initializeAssessmentData = async () => {
    if (!patientId || role === 'patient') {
      console.log('Skipping initialization - patientId:', patientId, 'role:', role);
      return;
    }
    
    setIsLoadingAssessment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found for assessment initialization');
        return;
      }

      console.log('Initializing assessment data for patient:', patientId);

      // Create initial assessment data structure
      const initialAssessmentData = {
        prediodical_screening: {
          'Gingivitis': false,
          'Early Periodontics': false,
          'Moderate Periodontics': false,
          'Advanced Periodontics': false
        },
        occlusion: {
          'Class (Molar)': false,
          'Overjet': false,
          'Overbite': false,
          'Midline Deviation': false,
          'Crossbite': false
        },
        appliances: {
          'Orthodontic': false,
          'Stayplate': false,
          'Others': ''
        },
        tmd: {
          'Clenching': false,
          'Clicking': false,
          'Trismus': false,
          'Muscle Spasm': false
        }
      };

      // Update dental chart with initial assessment data
      const updatedDentalChart = {
        ...dentalChart,
        ...initialAssessmentData
      };

      console.log('Saving initial assessment data to dental chart:', updatedDentalChart);

      // Save to dental_charts table
      const { error } = await supabase
        .from('dental_charts')
        .upsert({
          patient_id: patientId,
          chart_data: updatedDentalChart,
          created_by: user.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'patient_id'
        });

      if (error) {
        console.error('Assessment initialization error:', error);
        throw error;
      }
      
      console.log('Assessment data initialized successfully');
      
      // Set the assessment data in state
      setAssessmentData({
        gingivitis: false,
        early_periodontics: false,
        moderate_periodontics: false,
        advanced_periodontics: false,
        class_molar: false,
        overjet: false,
        overbite: false,
        midline_deviation: false,
        crossbite: false,
        orthodontic: false,
        stayplate: false,
        others_notes: '',
        clenching: false,
        clicking: false,
        trismus: false,
        muscle_spasm: false
      });
      
    } catch (error) {
      console.error('Error initializing assessment data:', error);
      toast.error('Failed to initialize assessment data');
    } finally {
      setIsLoadingAssessment(false);
    }
  };

  // Fetch assessment data from dental chart
  const fetchAssessmentData = async () => {
    if (!patientId) {
      console.log('Skipping fetch - no patientId:', patientId);
      return;
    }
    
    // Allow all roles to fetch assessment data (patients can view, doctors/staff can edit)
    console.log('Fetching assessment data for role:', role, 'patientId:', patientId);
    
    setIsLoadingAssessment(true);
    try {
      console.log('Fetching assessment data from dental chart for patient:', patientId);
      console.log('Current dentalChart data:', dentalChart);
      console.log('DentalChart keys:', Object.keys(dentalChart || {}));

      // Extract assessment data from dentalChart object
      const prediodicalScreening = dentalChart?.prediodical_screening || {};
      const occlusion = dentalChart?.occlusion || {};
      const appliances = dentalChart?.appliances || {};
      const tmd = dentalChart?.tmd || {};

      console.log('Extracted assessment data:', {
        prediodicalScreening,
        occlusion,
        appliances,
        tmd
      });
      
      console.log('Assessment data keys check:', {
        hasPrediodicalScreening: !!dentalChart?.prediodical_screening,
        hasOcclusion: !!dentalChart?.occlusion,
        hasAppliances: !!dentalChart?.appliances,
        hasTmd: !!dentalChart?.tmd
      });

      // Initialize assessment data if it doesn't exist (only for doctors/staff)
      if (!dentalChart?.prediodical_screening || !dentalChart?.occlusion || !dentalChart?.appliances || !dentalChart?.tmd) {
        if (role === 'patient') {
          console.log('Assessment data missing for patient - showing default state');
          // Set default empty state for patients
          setAssessmentData({
            gingivitis: false,
            early_periodontics: false,
            moderate_periodontics: false,
            advanced_periodontics: false,
            class_molar: false,
            overjet: false,
            overbite: false,
            midline_deviation: false,
            crossbite: false,
            orthodontic: false,
            stayplate: false,
            others_notes: '',
            clenching: false,
            clicking: false,
            trismus: false,
            muscle_spasm: false
          });
          return;
        } else {
          console.log('Assessment data missing, initializing...');
          await initializeAssessmentData();
          return;
        }
      }

      // Map the dental chart data to our assessment format
      setAssessmentData({
        // Prediodical Screening
        gingivitis: prediodicalScreening['Gingivitis'] || false,
        early_periodontics: prediodicalScreening['Early Periodontics'] || false,
        moderate_periodontics: prediodicalScreening['Moderate Periodontics'] || false,
        advanced_periodontics: prediodicalScreening['Advanced Periodontics'] || false,
        
        // Occlusion
        class_molar: occlusion['Class (Molar)'] || false,
        overjet: occlusion['Overjet'] || false,
        overbite: occlusion['Overbite'] || false,
        midline_deviation: occlusion['Midline Deviation'] || false,
        crossbite: occlusion['Crossbite'] || false,
        
        // Appliances
        orthodontic: appliances['Orthodontic'] || false,
        stayplate: appliances['Stayplate'] || false,
        others_notes: appliances['Others'] || '',
        
        // TMD
        clenching: tmd['Clenching'] || false,
        clicking: tmd['Clicking'] || false,
        trismus: tmd['Trismus'] || false,
        muscle_spasm: tmd['Muscle Spasm'] || false
      });

      console.log('Assessment data set successfully');
    } catch (error) {
      console.error('Error fetching assessment data:', error);
      toast.error('Failed to load assessment data');
    } finally {
      setIsLoadingAssessment(false);
    }
  };

  // Save assessment data to dental chart
  const saveAssessmentData = async (updatedData) => {
    if (!patientId || role === 'patient') {
      console.log('Skipping save - patientId:', patientId, 'role:', role);
      return;
    }
    
    setIsSavingAssessment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found for assessment save');
        return;
      }

      console.log('Saving assessment data to dental chart:', updatedData);

      // Map assessment data back to dental chart format
      const updatedDentalChart = {
        ...dentalChart,
        prediodical_screening: {
          'Gingivitis': updatedData.gingivitis || false,
          'Early Periodontics': updatedData.early_periodontics || false,
          'Moderate Periodontics': updatedData.moderate_periodontics || false,
          'Advanced Periodontics': updatedData.advanced_periodontics || false
        },
        occlusion: {
          'Class (Molar)': updatedData.class_molar || false,
          'Overjet': updatedData.overjet || false,
          'Overbite': updatedData.overbite || false,
          'Midline Deviation': updatedData.midline_deviation || false,
          'Crossbite': updatedData.crossbite || false
        },
        appliances: {
          'Orthodontic': updatedData.orthodontic || false,
          'Stayplate': updatedData.stayplate || false,
          'Others': updatedData.others_notes || ''
        },
        tmd: {
          'Clenching': updatedData.clenching || false,
          'Clicking': updatedData.clicking || false,
          'Trismus': updatedData.trismus || false,
          'Muscle Spasm': updatedData.muscle_spasm || false
        }
      };

      console.log('Updated dental chart data:', updatedDentalChart);

      // Save to dental_charts table
      const { error } = await supabase
        .from('dental_charts')
        .upsert({
          patient_id: patientId,
          chart_data: updatedDentalChart,
          created_by: user.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'patient_id'
        });

      if (error) {
        console.error('Assessment save error:', error);
        throw error;
      }
      
      console.log('Assessment data saved to dental chart successfully');
      toast.success('Assessment data saved successfully');
      
      // Update the dentalChart prop by calling the parent's refresh function
      if (onDentalChartUpdate) {
        onDentalChartUpdate(updatedDentalChart);
      }
    } catch (error) {
      console.error('Error saving assessment data:', error);
      toast.error('Failed to save assessment data');
    } finally {
      setIsSavingAssessment(false);
    }
  };

  // Handle assessment checkbox changes
  const handleAssessmentChange = async (field, value) => {
    const updatedData = { ...assessmentData, [field]: value };
    setAssessmentData(updatedData);
    
    // Auto-save to database
    await saveAssessmentData(updatedData);
  };

  // Handle others notes changes
  const handleOthersNotesChange = async (value) => {
    const updatedData = { ...assessmentData, others_notes: value };
    setAssessmentData(updatedData);
    
    // Auto-save to database
    await saveAssessmentData(updatedData);
  };

  // Load assessment data when dentalChart changes
  useEffect(() => {
    if (dentalChart && patientId) {
      fetchAssessmentData();
    }
  }, [dentalChart, patientId, role]);

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

  // Use enhanced symbols or fallback to provided chartSymbols
  const effectiveChartSymbols = (chartSymbols && Object.keys(chartSymbols).length > 0) ? 
    // Check if chartSymbols already contains enhanced data (objects) or simple data (strings)
    Object.entries(chartSymbols).reduce((acc, [symbol, data]) => {
      if (typeof data === 'object' && data !== null) {
        // Already enhanced data, use as is
        acc[symbol] = data;
      } else {
        // Simple string data, convert to enhanced format
        const enhanced = enhancedChartSymbols[symbol];
        acc[symbol] = {
          name: data || symbol,
          color: enhanced?.color || '#000000',
          bgColor: enhanced?.bgColor || '#ffffff',
          borderColor: enhanced?.borderColor || '#d1d5db'
        };
      }
      return acc;
    }, {}) : 
    enhancedChartSymbols;

  // Debug logging for patient role to show dental chart data
  if (role === 'patient') {
    const teethWithSymbols = dentalChart?.teeth ? Object.entries(dentalChart.teeth).filter(([tooth, data]) => data.symbol) : [];
    console.log('Patient Dental Chart Debug:', {
      hasDentalChart: !!dentalChart,
      hasTeeth: !!dentalChart?.teeth,
      teethCount: dentalChart?.teeth ? Object.keys(dentalChart.teeth).length : 0,
      teethWithSymbols: teethWithSymbols.length,
      sampleTeethWithSymbols: teethWithSymbols.slice(0, 3)
    });
    
    if (teethWithSymbols.length === 0) {
      console.log('No teeth with dental symbols found. Teeth will display in default colors until dental conditions are assigned.');
    }
  }

  // Debug logging for treatments
  console.log('ModernDentalChart treatments debug:', {
    treatmentsCount: treatments.length,
    treatments: treatments.map(t => ({ id: t.id, tooth_number: t.tooth_number, procedure: t.procedure })),
    role
  });


  // Helper function to get dental condition colors - NO COLORS for easy management
  const getDentalConditionColors = (symbolData) => {
    if (!symbolData) return null;
    
    return {
      backgroundColor: '#ffffff',
      borderColor: '#d1d5db',
      textColor: '#000000'
    };
  };


  // Adult teeth layout (Universal numbering system 1-32)
  const adultTeeth = {
    upperRight: [1, 2, 3, 4, 5, 6, 7, 8],    // Left to right
    upperLeft: [9, 10, 11, 12, 13, 14, 15, 16],   // Left to right
    lowerRight: [32, 31, 30, 29, 28, 27, 26, 25],  // Right to left
    lowerLeft: [24, 23, 22, 21, 20, 19, 18, 17]   // Right to left
  };

  // Temporary/Deciduous teeth layout (Letters A-T)
  const temporaryTeeth = {
    upperRight: ['A', 'B', 'C', 'D', 'E'],    // Right upper teeth 
    upperLeft: ['F', 'G', 'H', 'I', 'J'],     // Left upper teeth
    lowerLeft: ['O', 'N', 'M', 'L', 'K'],    // Left bottom teeth
    lowerRight: ['T', 'S', 'R', 'Q', 'P']    // Right bottom teeth
  };

  const getToothStatus = (toothNumber) => {
    const hasHistory = treatments.some(t => t.tooth_number === toothNumber);
    const isSelected = selectedTooth === toothNumber;
    const isMultiSelected = selectedTeeth.includes(toothNumber);
    
    // Enhanced symbol retrieval with multiple fallbacks
    const toothData = dentalChart?.teeth?.[toothNumber] || dentalChart?.teeth?.[String(toothNumber)] || {};
    const toothSymbol = toothData.symbol || toothData.condition || toothData.status || '';
    
    // Enhanced symbol lookup with fallback
    let symbolData = null;
    if (toothSymbol) {
      // First try to get from effectiveChartSymbols
      symbolData = effectiveChartSymbols[toothSymbol];
      
      // If not found, create a default one using enhanced symbols
      if (!symbolData && enhancedChartSymbols[toothSymbol]) {
        symbolData = enhancedChartSymbols[toothSymbol];
      }
      
      // If still not found, create a basic color scheme
      if (!symbolData) {
        symbolData = {
          name: `Dental condition ${toothSymbol}`,
          color: '#000000',
          bgColor: '#ffffff',
          borderColor: '#d1d5db'
        };
      }
      
      // Debug logging for patient role to help identify color issues (only for first tooth to avoid spam)
      if (role === 'patient' && toothNumber === 1) {
        console.log(`Tooth ${toothNumber} Debug:`, {
          toothData,
          toothSymbol,
          symbolData,
          hasSymbol: !!toothSymbol,
          effectiveChartSymbols: effectiveChartSymbols[toothSymbol],
          enhancedChartSymbols: enhancedChartSymbols[toothSymbol]
        });
      }
    }
    
    return {
      hasHistory,
      isSelected,
      isMultiSelected,
      toothSymbol,
      symbolData,
      treatmentCount: treatments.filter(t => t.tooth_number === toothNumber).length
    };
  };

  // Get temporary tooth status (for deciduous teeth) - same as permanent teeth
  const getTemporaryToothStatus = (toothLetter) => {
    // Convert tooth letter to database number for treatment lookup
    const tempTeethMap = {
      'A': 101, 'B': 102, 'C': 103, 'D': 104, 'E': 105,
      'F': 106, 'G': 107, 'H': 108, 'I': 109, 'J': 110,
      'K': 111, 'L': 112, 'M': 113, 'N': 114, 'O': 115,
      'P': 116, 'Q': 117, 'R': 118, 'S': 119, 'T': 120
    };
    const dbToothNumber = tempTeethMap[toothLetter];
    
    // Debug logging for temporary teeth
    if (toothLetter === 'D' || toothLetter === 'F' || toothLetter === 'O') {
      console.log(`Debug temporary tooth ${toothLetter}:`, {
        toothLetter,
        dbToothNumber,
        treatments: treatments.map(t => ({ id: t.id, tooth_number: t.tooth_number, procedure: t.procedure })),
        matchingTreatments: treatments.filter(t => t.tooth_number === dbToothNumber)
      });
    }
    
    const hasHistory = treatments.some(t => t.tooth_number === dbToothNumber);
    const isSelected = selectedTooth === toothLetter;
    const isMultiSelected = selectedTeeth.includes(toothLetter);
    
    // Use same data structure as permanent teeth - check both temporary_teeth and teeth
    const toothData = dentalChart?.temporary_teeth?.[toothLetter] || dentalChart?.teeth?.[toothLetter] || dentalChart?.teeth?.[String(toothLetter)] || {};
    const toothSymbol = toothData.symbol || toothData.condition || toothData.status || '';
    
    // Enhanced symbol lookup with fallback - same as permanent teeth
    let symbolData = null;
    if (toothSymbol) {
      // First try to get from effectiveChartSymbols
      symbolData = effectiveChartSymbols[toothSymbol];
      
      // If not found, create a default one using enhanced symbols
      if (!symbolData && enhancedChartSymbols[toothSymbol]) {
        symbolData = enhancedChartSymbols[toothSymbol];
      }
      
      // If still not found, create a basic color scheme
      if (!symbolData) {
        symbolData = {
          name: `Dental condition ${toothSymbol}`,
          color: '#000000',
          bgColor: '#ffffff',
          borderColor: '#d1d5db'
        };
      }
    }
    
    return {
      hasHistory,
      isSelected,
      isMultiSelected,
      toothSymbol,
      symbolData,
      treatmentCount: treatments.filter(t => t.tooth_number === dbToothNumber).length
    };
  };

  const getToothBackground = (toothNumber) => {
    const status = getToothStatus(toothNumber);
    
    // Always return plain white background - no colors
    return '#ffffff';
  };

  const getToothBorder = (toothNumber) => {
    const status = getToothStatus(toothNumber);
    
    // Only show selection colors, otherwise plain gray
    if (status.isMultiSelected) return '#3b82f6';
    if (status.isSelected) return '#8b5cf6';
    return '#d1d5db';
  };

  // Get tooth type for realistic shape
  const getToothType = (toothNumber) => {
    const toothInQuadrant = ((toothNumber - 1) % 8) + 1;
    if (toothInQuadrant <= 2) return 'incisor';     // Central & Lateral incisors
    if (toothInQuadrant === 3) return 'canine';     // Canine
    if (toothInQuadrant <= 5) return 'premolar';    // Premolars
    return 'molar';                                  // Molars
  };

  // Get tooth shape styles based on type
  const getToothShape = (toothNumber) => {
    const toothType = getToothType(toothNumber);
    const isUpper = toothNumber <= 16;
    
    switch (toothType) {
      case 'incisor':
        return isUpper 
          ? 'w-6 h-10 rounded-t-lg rounded-b-sm' 
          : 'w-6 h-10 rounded-t-sm rounded-b-lg';
      case 'canine':
        return isUpper 
          ? 'w-7 h-11 rounded-t-full rounded-b-md' 
          : 'w-7 h-11 rounded-t-md rounded-b-full';
      case 'premolar':
        return isUpper 
          ? 'w-8 h-9 rounded-t-md rounded-b-sm' 
          : 'w-8 h-9 rounded-t-sm rounded-b-md';
      case 'molar':
        return isUpper 
          ? 'w-9 h-8 rounded-t-lg rounded-b-sm' 
          : 'w-9 h-8 rounded-t-sm rounded-b-lg';
      default:
        return 'w-8 h-10 rounded-md';
    }
  };

  const renderTooth = (toothNumber) => {
    const status = getToothStatus(toothNumber);
    // Enhanced tooth data retrieval with better fallbacks
    const toothData = dentalChart?.teeth?.[toothNumber] || dentalChart?.teeth?.[String(toothNumber)] || {};
    const toothShape = getToothShape(toothNumber);
    const toothType = getToothType(toothNumber);
    const isUpper = toothNumber <= 16;

    
    return (
      <div
        key={toothNumber}
        className={`relative ${toothShape} border-2 m-0.5 flex flex-col items-center justify-center text-xs font-medium transition-all duration-200 shadow-sm ${
          status.isSelected ? 'shadow-md' : ''
        } ${role === 'doctor' ? 'cursor-pointer hover:shadow-md' : role === 'staff' ? 'cursor-pointer hover:shadow-md' : 'cursor-default'} w-6 h-7 sm:w-7 sm:h-8 lg:w-8 lg:h-10`}
        style={(() => {
          // Only show colors for teeth with treatments, otherwise make them plain
          const hasTreatment = status.hasHistory;
          const hasSymbol = toothData.symbol && toothData.symbol.trim() !== '';
          
          // Plain styling for untreated teeth
          if (!hasTreatment && !hasSymbol) {
            return {
              backgroundColor: '#ffffff',
              borderColor: '#d1d5db',
              color: '#000000'
            };
          }
          
          // Keep plain styling for teeth with treatments too
          if (hasTreatment) {
            return {
              backgroundColor: '#ffffff',
              borderColor: status.isSelected ? '#3b82f6' : '#d1d5db',
              color: '#000000'
            };
          }
          
          // Plain styling for teeth with symbols but no treatments
          return {
            backgroundColor: '#ffffff',
            borderColor: status.isSelected ? '#3b82f6' : '#d1d5db',
            color: '#000000'
          };
        })()}
        onMouseEnter={(e) => handleToothHover(toothNumber, e)}
        onMouseLeave={handleToothLeave}
        onClick={() => {
          if (onToothClick) {
            const toothTreatments = treatments.filter(t => t.tooth_number === toothNumber);
            onToothClick(toothNumber, {
              treatmentCount: toothTreatments.length,
              symbolData: status.symbolData,
              hasHistory: status.hasHistory,
              treatments: toothTreatments,
              canEdit: role === 'doctor' // Only doctors can edit
            });
          }
        }}
        title={`Tooth ${toothNumber}${status.symbolData ? ` - ${status.symbolData.name}` : ''}${status.hasHistory ? ` (${status.treatmentCount} treatments)` : ''}`}
      >
        {/* Upper Position Symbol */}
        {isUpper && toothData.symbol && (
          <div 
            className="font-bold text-sm leading-none drop-shadow-sm text-black"
            style={{
              color: '#000000',
              textShadow: '0 0 2px rgba(255,255,255,0.8)', // White shadow for better contrast
              fontWeight: '900' // Extra bold for visibility
            }}
          >
            {toothData.symbol}
          </div>
        )}
        
        {/* Tooth Number */}
        <div className="text-xs font-bold text-gray-700 leading-none">
          {toothNumber}
        </div>
        
        {/* Lower Position Symbol */}
        {!isUpper && toothData.symbol && (
          <div 
            className="font-bold text-sm leading-none drop-shadow-sm text-black"
            style={{
              color: '#000000',
              textShadow: '0 0 2px rgba(255,255,255,0.8)', // White shadow for better contrast
              fontWeight: '900' // Extra bold for visibility
            }}
          >
            {toothData.symbol}
          </div>
        )}

        {/* Treatment Count Badge */}
        {status.treatmentCount > 0 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
            <span className="text-white font-bold" style={{fontSize: '9px'}}>
              {status.treatmentCount}
            </span>
          </div>
        )}

        {/* Selection Indicators */}
        {status.isMultiSelected && (
          <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm"></div>
        )}
        
        {status.isSelected && !status.isMultiSelected && (
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-white shadow-sm"></div>
        )}

      </div>
    );
  };

  // Render temporary/deciduous tooth - same functionality as permanent teeth
  const renderTemporaryTooth = (toothLetter) => {
    const status = getTemporaryToothStatus(toothLetter);
    // Use same data structure as permanent teeth - check both temporary_teeth and teeth
    const toothData = dentalChart?.temporary_teeth?.[toothLetter] || dentalChart?.teeth?.[toothLetter] || dentalChart?.teeth?.[String(toothLetter)] || {};
    const isUpper = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].includes(toothLetter);
    
    return (
      <div
        key={toothLetter}
        className={`relative w-6 h-7 sm:w-7 sm:h-8 lg:w-8 lg:h-10 rounded-md border-2 m-0.5 flex flex-col items-center justify-center text-xs font-medium transition-all duration-200 shadow-sm ${
          status.isSelected ? 'shadow-md' : ''
        } ${role === 'doctor' ? 'cursor-pointer hover:shadow-md' : role === 'staff' ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}`}
        style={(() => {
          // Only show colors for teeth with treatments, otherwise make them plain
          const hasTreatment = status.hasHistory;
          const hasSymbol = toothData.symbol && toothData.symbol.trim() !== '';
          
          // Plain styling for untreated teeth
          if (!hasTreatment && !hasSymbol) {
            return {
              backgroundColor: '#ffffff',
              borderColor: '#d1d5db',
              color: '#000000'
            };
          }
          
          // Keep plain styling for teeth with treatments too
          if (hasTreatment) {
            return {
              backgroundColor: '#ffffff',
              borderColor: status.isSelected ? '#3b82f6' : '#d1d5db',
              color: '#000000'
            };
          }
          
          // Plain styling for teeth with symbols but no treatments
          return {
            backgroundColor: '#ffffff',
            borderColor: status.isSelected ? '#3b82f6' : '#d1d5db',
            color: '#000000'
          };
        })()}
        onMouseEnter={(e) => handleToothHover(toothLetter, e)}
        onMouseLeave={handleToothLeave}
        onClick={() => {
          if (onToothClick) {
            // Handle temporary teeth conversion for treatment lookup
            let toothTreatments;
            if (typeof toothLetter === 'string' && /^[A-T]$/.test(toothLetter)) {
              // Convert temporary tooth letter to database number
              const tempTeethMap = {
                'A': 101, 'B': 102, 'C': 103, 'D': 104, 'E': 105,
                'F': 106, 'G': 107, 'H': 108, 'I': 109, 'J': 110,
                'K': 111, 'L': 112, 'M': 113, 'N': 114, 'O': 115,
                'P': 116, 'Q': 117, 'R': 118, 'S': 119, 'T': 120
              };
              const dbToothNumber = tempTeethMap[toothLetter];
              toothTreatments = treatments.filter(t => t.tooth_number === dbToothNumber);
              
              // Debug logging for temporary teeth click
              if (toothLetter === 'D' || toothLetter === 'F' || toothLetter === 'O') {
                console.log(`Click debug temporary tooth ${toothLetter}:`, {
                  toothLetter,
                  dbToothNumber,
                  allTreatments: treatments.map(t => ({ id: t.id, tooth_number: t.tooth_number, procedure: t.procedure })),
                  toothTreatments: toothTreatments.map(t => ({ id: t.id, tooth_number: t.tooth_number, procedure: t.procedure }))
                });
              }
            } else {
              // For permanent teeth, use the tooth number directly
              toothTreatments = treatments.filter(t => t.tooth_number === toothLetter);
            }
            
            onToothClick(toothLetter, {
              treatmentCount: toothTreatments.length,
              symbolData: status.symbolData,
              hasHistory: status.hasHistory,
              treatments: toothTreatments,
              canEdit: role === 'doctor' // Only doctors can edit
            });
          }
        }}
        title={`Tooth ${toothLetter}${status.symbolData ? ` - ${status.symbolData.name}` : ''}${status.hasHistory ? ` (${status.treatmentCount} treatments)` : ''}`}
      >
        {/* Upper Position Symbol */}
        {isUpper && toothData.symbol && (
          <div 
            className="font-bold text-sm leading-none drop-shadow-sm text-black"
            style={{
              color: '#000000',
              textShadow: '0 0 2px rgba(255,255,255,0.8)', // White shadow for better contrast
              fontWeight: '900' // Extra bold for visibility
            }}
          >
            {toothData.symbol}
          </div>
        )}
        
        {/* Tooth Letter */}
        <div className="text-xs font-bold text-gray-700 leading-none">
          {toothLetter}
        </div>
        
        {/* Lower Position Symbol */}
        {!isUpper && toothData.symbol && (
          <div 
            className="font-bold text-sm leading-none drop-shadow-sm text-black"
            style={{
              color: '#000000',
              textShadow: '0 0 2px rgba(255,255,255,0.8)', // White shadow for better contrast
              fontWeight: '900' // Extra bold for visibility
            }}
          >
            {toothData.symbol}
          </div>
        )}

        {/* Treatment Count Badge */}
        {status.treatmentCount > 0 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
            <span className="text-white font-bold" style={{fontSize: '9px'}}>
              {status.treatmentCount}
            </span>
          </div>
        )}

        {/* Selection Indicators */}
        {status.isMultiSelected && (
          <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm"></div>
        )}
        
        {status.isSelected && !status.isMultiSelected && (
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-white shadow-sm"></div>
        )}

      </div>
    );
  };

  return (
    <div className="modern-dental-chart bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Custom CSS for checkboxes */}
      <style jsx>{`
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
      `}</style>
      
      {/* Enhanced Responsive Layout */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 p-2 sm:p-4">
        
        {/* Left Side - Chart Legend (Enhanced Responsive) */}
        <div className="lg:col-span-1 xl:col-span-1 order-2 lg:order-1">
          <div className="space-y-3 sm:space-y-4">
            {/* Chart Legend */}
            <div className="bg-white rounded-lg border border-gray-300 p-3 sm:p-4">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2 sm:mb-3">Legend:</h3>
              
              {/* Enhanced Responsive Grid Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-1 gap-3 sm:gap-4 lg:gap-2">
                {/* Condition Column */}
                <div>
                  <h4 className="text-xs font-bold text-gray-800 mb-1 sm:mb-2">Condition:</h4>
                  <div className="space-y-0.5 sm:space-y-1">
                    {[
                      { symbol: 'D-', name: 'Decayed (Caries Indicated for filling)' },
                      { symbol: 'M-', name: 'Missing due to caries' },
                      { symbol: 'F-', name: 'Filled' },
                      { symbol: 'I-', name: 'Caries indicated for Extraction' },
                      { symbol: 'RF-', name: 'Root Fragment' },
                      { symbol: 'MO-', name: 'Missing due to other causes' },
                      { symbol: 'Im-', name: 'Impacted Tooth' }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center space-x-1 sm:space-x-2">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded border border-gray-300 bg-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          <span className="text-black">{item.symbol}</span>
                        </div>
                        <span className="text-xs text-gray-700 leading-tight">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Restoration & Prosthetics Column */}
                <div>
                  <h4 className="text-xs font-bold text-gray-800 mb-1 sm:mb-2">Restoration & Prosthetics:</h4>
                  <div className="space-y-0.5 sm:space-y-1">
                    {[
                      { symbol: 'J-', name: 'Jacket Crown' },
                      { symbol: 'A-', name: 'Amalgam Fillings' },
                      { symbol: 'AB-', name: 'Abutment' },
                      { symbol: 'P-', name: 'Pontic' },
                      { symbol: 'In-', name: 'Inlay' },
                      { symbol: 'FX-', name: 'Fixed Cure Composite' },
                      { symbol: 'Rm-', name: 'Removable Denture' }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center space-x-1 sm:space-x-2">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded border border-gray-300 bg-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          <span className="text-black">{item.symbol}</span>
                        </div>
                        <span className="text-xs text-gray-700 leading-tight">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Surgery Column */}
                <div>
                  <h4 className="text-xs font-bold text-gray-800 mb-1 sm:mb-2">Surgery:</h4>
                  <div className="space-y-0.5 sm:space-y-1">
                    {[
                      { symbol: 'X-', name: 'Extraction due to caries' },
                      { symbol: 'XO-', name: 'Extraction due to other causes' },
                      { symbol: '✔-', name: 'Present Teeth' },
                      { symbol: 'Cm-', name: 'Congenitally missing' },
                      { symbol: 'Sp-', name: 'Supernumerary' }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center space-x-1 sm:space-x-2">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded border border-gray-300 bg-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          <span className="text-black">{item.symbol}</span>
                        </div>
                        <span className="text-xs text-gray-700 leading-tight">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Side - Dental Chart (Enhanced Responsive) */}
        <div className="lg:col-span-2 xl:col-span-3 order-1 lg:order-2">
          <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden">
            <div className="bg-gray-100 p-2 sm:p-3 border-b border-gray-400">
              <h3 className="font-bold text-center text-sm sm:text-base lg:text-lg">DENTAL RECORD CHART</h3>
            </div>
            <div className="p-2 sm:p-3 lg:p-4 xl:p-6 overflow-x-auto">
              {/* Temporary/Deciduous Teeth Section */}
              <div className="mb-4 sm:mb-6">
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 sm:p-3 mb-2">
                  <h4 className="font-bold text-center text-xs sm:text-sm text-yellow-800">TEMPORARY TEETH</h4>
                </div>
                <div className="flex justify-center space-x-2 sm:space-x-4 lg:space-x-6 xl:space-x-8 min-w-max">
                  {/* Right Side - Temporary Teeth */}
                  <div className="text-center">
                    <div className="font-bold text-xs sm:text-sm lg:text-base mb-1 sm:mb-2 lg:mb-4">RIGHT</div>
                    
                    {/* Upper Right Temporary Teeth */}
                    <div className="flex mb-1 sm:mb-2 lg:mb-4 space-x-0.5 sm:space-x-1 lg:space-x-1.5">
                      {temporaryTeeth.upperRight.map(letter => renderTemporaryTooth(letter))}
                    </div>
                    
                    {/* Lower Right Temporary Teeth */}
                    <div className="flex space-x-0.5 sm:space-x-1 lg:space-x-1.5">
                      {temporaryTeeth.lowerRight.map(letter => renderTemporaryTooth(letter))}
                    </div>
                  </div>

                  {/* Left Side - Temporary Teeth */}
                  <div className="text-center">
                    <div className="font-bold text-xs sm:text-sm lg:text-base mb-1 sm:mb-2 lg:mb-4">LEFT</div>
                    
                    {/* Upper Left Temporary Teeth */}
                    <div className="flex mb-1 sm:mb-2 lg:mb-4 space-x-0.5 sm:space-x-1 lg:space-x-1.5">
                      {temporaryTeeth.upperLeft.map(letter => renderTemporaryTooth(letter))}
                    </div>
                    
                    {/* Lower Left Temporary Teeth */}
                    <div className="flex space-x-0.5 sm:space-x-1 lg:space-x-1.5">
                      {temporaryTeeth.lowerLeft.map(letter => renderTemporaryTooth(letter))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Permanent Teeth Section */}
              <div className="border-t border-gray-300 pt-4">
                <div className="bg-blue-50 border border-blue-300 rounded-lg p-2 sm:p-3 mb-2">
                  <h4 className="font-bold text-center text-xs sm:text-sm text-blue-800">PERMANENT TEETH</h4>
                </div>
                <div className="flex justify-center space-x-2 sm:space-x-4 lg:space-x-6 xl:space-x-8 min-w-max">
                {/* Right Side */}
                <div className="text-center">
                  <div className="font-bold text-xs sm:text-sm lg:text-base mb-1 sm:mb-2 lg:mb-4">RIGHT</div>
                  
                  {/* Upper Right Teeth */}
                  <div className="flex mb-1 sm:mb-2 lg:mb-4 space-x-0.5 sm:space-x-1 lg:space-x-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(num => renderTooth(num))}
                  </div>
                  
                  {/* Lower Right Teeth */}
                  <div className="flex space-x-0.5 sm:space-x-1 lg:space-x-1.5">
                    {[32, 31, 30, 29, 28, 27, 26, 25].map(num => renderTooth(num))}
                  </div>
                </div>

                {/* Left Side */}
                <div className="text-center">
                  <div className="font-bold text-xs sm:text-sm lg:text-base mb-1 sm:mb-2 lg:mb-4">LEFT</div>
                  
                  {/* Upper Left Teeth */}
                  <div className="flex mb-1 sm:mb-2 lg:mb-4 space-x-0.5 sm:space-x-1 lg:space-x-1.5">
                    {[9, 10, 11, 12, 13, 14, 15, 16].map(num => renderTooth(num))}
                  </div>
                  
                  {/* Lower Left Teeth */}
                  <div className="flex space-x-0.5 sm:space-x-1 lg:space-x-1.5">
                    {[24, 23, 22, 21, 20, 19, 18, 17].map(num => renderTooth(num))}
                  </div>
                </div>
              </div>
              </div>
              
              {/* Mobile Instructions */}
              <div className="mt-4 text-center sm:hidden">
                <p className="text-xs text-gray-500">Tap teeth to view treatments • Scroll horizontally if needed</p>
              </div>
            </div>
          </div>

          {/* Doctor Assessment Sections - Moved below dental chart */}
          <div className="mt-4 bg-white rounded-lg border border-gray-300 p-3 sm:p-4">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 text-center border-b pb-1 sm:pb-2">
                🔍 DOCTOR ASSESSMENT SECTIONS (4 Total)
              </h3>
              {role !== 'patient' && (
                <div className="text-xs text-gray-500">
                  Patient: {patientId}
                </div>
              )}
            </div>
            {/* Show message for patients when no assessment data exists */}
            {role === 'patient' && (!dentalChart?.prediodical_screening || !dentalChart?.occlusion || !dentalChart?.appliances || !dentalChart?.tmd) && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <div className="text-yellow-600 mr-2">⚠️</div>
                  <div className="text-sm text-yellow-800">
                    <strong>No Assessment Data Available</strong><br/>
                    <span className="text-xs">Your doctor hasn't completed the assessment sections yet. Check back after your next appointment.</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {/* Prediodical Screening - Section 1 */}
              <div className="border border-blue-300 rounded-lg p-2 sm:p-3 bg-blue-50">
                <h4 className="text-xs font-bold text-blue-800 mb-1 sm:mb-2 text-center">
                  🔍 Prediodical Screening (1/4)
                </h4>
                <div className="space-y-0.5 sm:space-y-1">
                  {[
                    { key: 'gingivitis', label: 'Gingivitis' },
                    { key: 'early_periodontics', label: 'Early Periodontics' },
                    { key: 'moderate_periodontics', label: 'Moderate Periodontics' },
                    { key: 'advanced_periodontics', label: 'Advanced Periodontics' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center space-x-1 sm:space-x-2">
                      <div
                        className={`checkbox ${assessmentData[item.key] ? 'checked' : ''} ${role === 'patient' || isLoadingAssessment ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        onClick={() => {
                          if (role !== 'patient' && !isLoadingAssessment) {
                            handleAssessmentChange(item.key, !assessmentData[item.key]);
                          }
                        }}
                        style={{
                          width: '12px',
                          height: '12px',
                          border: '2px solid #2563eb',
                          borderRadius: '2px',
                          background: assessmentData[item.key] ? '#2563eb' : '#fff',
                          position: 'relative',
                          flexShrink: 0
                        }}
                      />
                      <span className="text-xs text-gray-700 font-medium leading-tight">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Occlusion - Section 2 */}
              <div className="border border-green-300 rounded-lg p-2 sm:p-3 bg-green-50">
                <h4 className="text-xs font-bold text-green-800 mb-1 sm:mb-2 text-center">
                  🦷 Occlusion (2/4)
                </h4>
                <div className="space-y-0.5 sm:space-y-1">
                  {[
                    { key: 'class_molar', label: 'Class (Molar)' },
                    { key: 'overjet', label: 'Overjet' },
                    { key: 'overbite', label: 'Overbite' },
                    { key: 'midline_deviation', label: 'Midline Deviation' },
                    { key: 'crossbite', label: 'Crossbite' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center space-x-1 sm:space-x-2">
                      <div
                        className={`checkbox ${assessmentData[item.key] ? 'checked' : ''} ${role === 'patient' || isLoadingAssessment ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        onClick={() => {
                          if (role !== 'patient' && !isLoadingAssessment) {
                            handleAssessmentChange(item.key, !assessmentData[item.key]);
                          }
                        }}
                        style={{
                          width: '12px',
                          height: '12px',
                          border: '2px solid #2563eb',
                          borderRadius: '2px',
                          background: assessmentData[item.key] ? '#2563eb' : '#fff',
                          position: 'relative',
                          flexShrink: 0
                        }}
                      />
                      <span className="text-xs text-gray-700 font-medium leading-tight">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Appliances - Section 3 */}
              <div className="border border-yellow-300 rounded-lg p-2 sm:p-3 bg-yellow-50">
                <h4 className="text-xs font-bold text-yellow-800 mb-1 sm:mb-2 text-center">
                  🦷 Appliances (3/4)
                </h4>
                <div className="space-y-0.5 sm:space-y-1">
                  {[
                    { key: 'orthodontic', label: 'Orthodontic' },
                    { key: 'stayplate', label: 'Stayplate' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center space-x-1 sm:space-x-2">
                      <div
                        className={`checkbox ${assessmentData[item.key] ? 'checked' : ''} ${role === 'patient' || isLoadingAssessment ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        onClick={() => {
                          if (role !== 'patient' && !isLoadingAssessment) {
                            handleAssessmentChange(item.key, !assessmentData[item.key]);
                          }
                        }}
                        style={{
                          width: '12px',
                          height: '12px',
                          border: '2px solid #2563eb',
                          borderRadius: '2px',
                          background: assessmentData[item.key] ? '#2563eb' : '#fff',
                          position: 'relative',
                          flexShrink: 0
                        }}
                      />
                      <span className="text-xs text-gray-700 font-medium leading-tight">{item.label}</span>
                    </div>
                  ))}
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <span className="text-xs text-gray-700 font-medium leading-tight">Others:</span>
                  </div>
                  <div className="ml-4 sm:ml-5">
                    <textarea
                      value={assessmentData.others_notes || ''}
                      onChange={(e) => handleOthersNotesChange(e.target.value)}
                      disabled={role === 'patient' || isLoadingAssessment}
                      placeholder="Enter additional appliance details..."
                      className="w-full h-16 px-2 py-1 text-xs border border-yellow-300 rounded focus:ring-yellow-500 focus:ring-2 focus:border-yellow-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* TMD - Section 4 */}
              <div className="border border-red-300 rounded-lg p-2 sm:p-3 bg-red-50">
                <h4 className="text-xs font-bold text-red-800 mb-1 sm:mb-2 text-center">
                  ⚠️ TMD (4/4)
                </h4>
                <div className="space-y-0.5 sm:space-y-1">
                  {[
                    { key: 'clenching', label: 'Clenching' },
                    { key: 'clicking', label: 'Clicking' },
                    { key: 'trismus', label: 'Trismus' },
                    { key: 'muscle_spasm', label: 'Muscle Spasm' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center space-x-1 sm:space-x-2">
                      <div
                        className={`checkbox ${assessmentData[item.key] ? 'checked' : ''} ${role === 'patient' || isLoadingAssessment ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        onClick={() => {
                          if (role !== 'patient' && !isLoadingAssessment) {
                            handleAssessmentChange(item.key, !assessmentData[item.key]);
                          }
                        }}
                        style={{
                          width: '12px',
                          height: '12px',
                          border: '2px solid #2563eb',
                          borderRadius: '2px',
                          background: assessmentData[item.key] ? '#2563eb' : '#fff',
                          position: 'relative',
                          flexShrink: 0
                        }}
                      />
                      <span className="text-xs text-gray-700 font-medium leading-tight">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tooth Selection Info */}
          {(selectedTeeth.length > 0 || selectedTooth) && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Tooth Selection</h4>
              <p className="text-xs text-blue-700">
                {role === 'patient' 
                  ? 'Click on teeth to view treatment details.' 
                  : 'Click on teeth to select them for treatment.'}
                {selectedTeeth.length > 0 && ` ${selectedTeeth.length} teeth selected.`}
                {selectedTooth && ` Current tooth: #${selectedTooth}.`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons for Doctor Only */}
      {(role === 'doctor' && selectedTeeth.length > 0) && (
        <div className="px-4 pb-4 flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => onToothClick('add-treatment')}
            className="inline-flex items-center px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors shadow-sm"
          >
            <FiPlus className="w-4 h-4 mr-2" />
            Add Treatment ({selectedTeeth.length} teeth)
          </button>
          <button
            onClick={() => onToothClick('clear-all')}
            className="inline-flex items-center px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors shadow-sm"
          >
            <FiActivity className="w-4 h-4 mr-2" />
            Clear Selection
          </button>
        </div>
      )}

      {/* Hover Modal for Tooth Treatment Information */}
      {showHoverModal && hoveredTooth && (
        <div 
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${mousePosition.x}px`,
            top: `${mousePosition.y}px`
          }}
        >
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-sm w-80 pointer-events-auto transform transition-all duration-200 ease-in-out">
            <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Tooth #{hoveredTooth} Information</h3>
                <button
                  onClick={() => {
                    if (hoverTimeout) {
                      clearTimeout(hoverTimeout);
                      setHoverTimeout(null);
                    }
                    setShowHoverModal(false);
                    setHoveredTooth(null);
                  }}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4">
              {(() => {
                // Handle temporary teeth conversion for treatment lookup
                let toothTreatments;
                if (typeof hoveredTooth === 'string' && /^[A-T]$/.test(hoveredTooth)) {
                  // Convert temporary tooth letter to database number
                  const tempTeethMap = {
                    'A': 101, 'B': 102, 'C': 103, 'D': 104, 'E': 105,
                    'F': 106, 'G': 107, 'H': 108, 'I': 109, 'J': 110,
                    'K': 111, 'L': 112, 'M': 113, 'N': 114, 'O': 115,
                    'P': 116, 'Q': 117, 'R': 118, 'S': 119, 'T': 120
                  };
                  const dbToothNumber = tempTeethMap[hoveredTooth];
                  toothTreatments = treatments.filter(t => t.tooth_number === dbToothNumber);
                } else {
                  // For permanent teeth, use the tooth number directly
                  toothTreatments = treatments.filter(t => t.tooth_number === hoveredTooth);
                }
                
                // Get tooth symbol with proper fallbacks - handle both permanent and temporary teeth
                const toothData = dentalChart?.temporary_teeth?.[hoveredTooth] || dentalChart?.teeth?.[hoveredTooth] || dentalChart?.teeth?.[String(hoveredTooth)] || {};
                const toothSymbol = toothData.symbol || toothData.condition || toothData.status || '';
                
                // Get symbol info from enhanced chart symbols (exact legend match)
                let symbolInfo = enhancedChartSymbols[toothSymbol];
                
                // If not found in enhanced symbols, try effective symbols
                if (!symbolInfo) {
                  symbolInfo = effectiveChartSymbols[toothSymbol];
                }
                
                // Final fallback
                if (!symbolInfo) {
                  symbolInfo = { 
                    name: 'Present Teeth', 
                    color: '#000000',
                    category: 'Surgery'
                  };
                }
                
                // Get category information directly from symbol data
                const categoryInfo = {
                  category: symbolInfo.category || 'Healthy',
                  color: '#000000'
                };
                
                return (
                  <div className="space-y-3">
                    {/* Tooth Status */}
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full border-2 border-gray-300 bg-white"
                      ></div>
                      <span className="text-sm font-medium text-gray-700">
                        Status: {symbolInfo.name}
                      </span>
                    </div>
                    
                    {/* Category */}
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full border-2 border-gray-300 bg-white"
                      ></div>
                      <span className="text-sm text-gray-600">
                        Category: {categoryInfo.category}
                      </span>
                    </div>
                    
                    {/* Treatment Count */}
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">
                        Treatments: {toothTreatments.length}
                      </span>
                    </div>
                    
                    {/* Recent Treatments */}
                    {toothTreatments.length > 0 ? (
                      <div className="mt-3">
                        <h4 className="text-sm font-medium text-gray-800 mb-2">Recent Treatments:</h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {toothTreatments.slice(0, 3).map((treatment, index) => (
                            <div key={treatment.id || index} className="bg-gray-50 rounded p-2 text-xs">
                              <div className="font-medium text-gray-800">{treatment.procedure}</div>
                              <div className="text-gray-600">
                                {new Date(treatment.treatment_date).toLocaleDateString()}
                              </div>
                            </div>
                          ))}
                          {toothTreatments.length > 3 && (
                            <div className="text-xs text-gray-500 text-center">
                              +{toothTreatments.length - 3} more treatments
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        No treatment history for this tooth
                      </div>
                    )}
                    
                    {/* Click instruction */}
                    <div className="text-xs text-gray-400 text-center pt-2 border-t">
                      Click tooth to view full details
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernDentalChart;