// src/components/common/PDFGenerator.jsx - Comprehensive PDF Generator for Dental Charts
import React from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const PDFGenerator = {
  // Data arrays (same as patient dental chart)
  dentalHistory: [
    'Previous dentist dr.',
    'Last dental visit'
  ],

  medicalConditions: [
    'High Blood Pressure', 'Low Blood Pressure', 'Epilepsy / Convulsions', 'AIDS or HIV Infection',
    'Sexually Transmitted Disease', 'Stomach Trouble / Ulcer', 'Fainting Seizure', 'Rapid Weight Loss',
    'Radiation Therapy', 'Joint Replacement / Implant', 'Heart Surgery', 'Heart Attack',
    'Heart Disease', 'Heart Murmur', 'Rheumatic Fever', 'Congenital Heart Disease',
    'Diabetes', 'Thyroid Disease', 'Liver Disease', 'Kidney Disease',
    'Blood Diseases', 'Head Injuries', 'Arthritis / Rheumatism', 'Other'
  ],

  // Generate comprehensive PDF HTML template matching the exact design from patient side printing
  generatePDFHTML: (patient, dentalChart, currentDate, chartSymbols, medicalHistory, medicalConditions, dentalHistory, physicianInfo, enhancedChartSymbols) => {
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

    // Generate dental chart HTML
    const generateDentalChartHTML = () => {
      try {
        return `
            <div class="dental-chart-grid">
              <!-- Temporary Teeth Section -->
              <div class="temporary-teeth-section">
                <h3 class="section-title">TEMPORARY TEETH</h3>
                <div class="teeth-container">
                  <div class="teeth-side">
                    <div class="side-label">RIGHT</div>
                    <div class="teeth-row">
                      ${temporaryTeeth.upperRight.map(tooth => {
                        const toothData = dentalChart?.temporary_teeth?.[tooth] || dentalChart?.teeth?.[tooth] || {};
                        const symbol = toothData.symbol || '';
                        return '<div class="tooth"><div class="tooth-symbol">' + symbol + '</div><div class="tooth-letter">' + tooth + '</div></div>';
                      }).join('')}
                    </div>
                    <div class="teeth-row">
                      ${temporaryTeeth.lowerRight.map(tooth => {
                        const toothData = dentalChart?.temporary_teeth?.[tooth] || dentalChart?.teeth?.[tooth] || {};
                        const symbol = toothData.symbol || '';
                        return '<div class="tooth"><div class="tooth-letter">' + tooth + '</div><div class="tooth-symbol">' + symbol + '</div></div>';
                      }).join('')}
                    </div>
                  </div>
                  <div class="teeth-side">
                    <div class="side-label">LEFT</div>
                    <div class="teeth-row">
                      ${temporaryTeeth.upperLeft.map(tooth => {
                        const toothData = dentalChart?.temporary_teeth?.[tooth] || dentalChart?.teeth?.[tooth] || {};
                        const symbol = toothData.symbol || '';
                        return '<div class="tooth"><div class="tooth-symbol">' + symbol + '</div><div class="tooth-letter">' + tooth + '</div></div>';
                      }).join('')}
                    </div>
                    <div class="teeth-row">
                      ${temporaryTeeth.lowerLeft.map(tooth => {
                        const toothData = dentalChart?.temporary_teeth?.[tooth] || dentalChart?.teeth?.[tooth] || {};
                        const symbol = toothData.symbol || '';
                        return '<div class="tooth"><div class="tooth-letter">' + tooth + '</div><div class="tooth-symbol">' + symbol + '</div></div>';
                      }).join('')}
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Permanent Teeth Section -->
              <div class="permanent-teeth-section">
                <h3 class="section-title">PERMANENT TEETH</h3>
                <div class="teeth-container">
                  <div class="teeth-side">
                    <div class="side-label">RIGHT</div>
                    <div class="teeth-row">
                      ${[1, 2, 3, 4, 5, 6, 7, 8].map(tooth => {
                        const toothData = dentalChart?.teeth?.[tooth] || {};
                        const symbol = toothData.symbol || '';
                        return '<div class="tooth"><div class="tooth-symbol">' + symbol + '</div><div class="tooth-number">' + tooth + '</div></div>';
                      }).join('')}
                    </div>
                    <div class="teeth-row">
                      ${[25, 26, 27, 28, 29, 30, 31, 32].map(tooth => {
                        const toothData = dentalChart?.teeth?.[tooth] || {};
                        const symbol = toothData.symbol || '';
                        return '<div class="tooth"><div class="tooth-number">' + tooth + '</div><div class="tooth-symbol">' + symbol + '</div></div>';
                      }).join('')}
                    </div>
                  </div>
                  <div class="teeth-side">
                    <div class="side-label">LEFT</div>
                    <div class="teeth-row">
                      ${[9, 10, 11, 12, 13, 14, 15, 16].map(tooth => {
                        const toothData = dentalChart?.teeth?.[tooth] || {};
                        const symbol = toothData.symbol || '';
                        return '<div class="tooth"><div class="tooth-symbol">' + symbol + '</div><div class="tooth-number">' + tooth + '</div></div>';
                      }).join('')}
                    </div>
                    <div class="teeth-row">
                      ${[24, 23, 22, 21, 20, 19, 18, 17].map(tooth => {
                        const toothData = dentalChart?.teeth?.[tooth] || {};
                        const symbol = toothData.symbol || '';
                        return '<div class="tooth"><div class="tooth-number">' + tooth + '</div><div class="tooth-symbol">' + symbol + '</div></div>';
                      }).join('')}
                    </div>
                  </div>
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

      return `
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
            font-size: 15px;
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
            font-size: 17px;
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
            font-size: 12px;
          }
          .header-value {
            font-weight: bold;
            font-size: 20px;
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
            font-size: 12px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 4px;
            margin-top: 6px;
            letter-spacing: 0.2px;
          }
          .section-title {
            font-size: 12px;
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
            font-size: 12px;
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
            font-size: 12px;
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
            margin-top: 8px;
          }
          .dental-chart-section {
            background: #fff;
            border-radius: 6px;
            box-shadow: 0 1px 4px 0 rgba(0,0,0,0.03);
            border: 1px solid #e5e7eb;
            padding: 16px 18px;
            margin-bottom: 12px;
            margin-top: -30px;
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
            font-size: 12px;
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
            font-size: 12px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 8px;
            text-align: center;
            letter-spacing: 0.2px;
          }
          .section-title {
            font-size: 12px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 6px;
            text-align: left;
            letter-spacing: 0.1px;
          }
          .temporary-teeth-section {
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid #f3f4f6;
          }
          .permanent-teeth-section {
            margin-top: 12px;
          }
          .tooth-letter {
            font-size: 12px;
            font-weight: bold;
            color: #2563eb;
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
            margin: 0 20px;
          }
          .side-label {
            font-weight: bold;
            margin-bottom: 8px;
            font-size: 14px;
            color: #2563eb;
          }
          .teeth-row {
            display: flex;
            justify-content: center;
            margin: 4px 0;
          }
          .tooth {
            width: 24px;
            height: 28px;
            border: 1px solid #2563eb;
            margin: 2px;
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
            font-size: 12px;
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
            font-size: 12px;
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
            font-size: 12px;
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
            font-size: 12px;
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
            font-size: 12px;
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
            font-size: 12px;
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
            padding: 8px 18px;
            font-size: 12px;
            line-height: 1.4;
            margin-bottom: 12px;
            margin-top: -20px;
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
            font-size: 12px;
            line-height: 1.5;
            text-align: justify;
            margin-bottom: 8px;
          }
          .consent-title {
            font-weight: bold;
            font-size: 12px;
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
            font-size: 12px;
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
              <span class="info-label">Dental Insurance:</span> <span class="info-value">${dentalChart.patientInfo?.dental_insurance || patient?.dental_insurance || ''}</span>
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
              <span class="info-label">Age:</span> <span class="info-value">${patient?.birthday ? PDFGenerator.calculateAge(patient.birthday) : ''}</span>
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
          ${PDFGenerator.dentalHistory.map((question, index) => `
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
              <span class="info-label">11. Blood type:</span> <span class="info-value">${dentalChart.medicalHistory?.question_10 || ''}</span>
            </div>
            <div class="info-row">
              <span class="info-label">12. Blood pressure:</span> <span class="info-value">${dentalChart.medicalHistory?.question_11 || ''}</span>
            </div>
          </div>
        </div>
        <div class="medical-conditions-section">
          <h4 class="conditions-title">Medical Conditions:</h4>
          <div class="conditions-grid">
            ${PDFGenerator.medicalConditions.map(condition => `
              <div class="condition-item">
                <div class="checkbox ${dentalChart.medicalConditions?.[condition] ? 'checked' : ''}"></div>
                <span>${condition}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="page-break"></div>


         <!-- PHYSICAL SPACE TO PUSH TO NEXT PAGE -->
        <div style="height: 80px; margin: 0; padding: 0; clear: both; display: block;"></div>
        <!-- Second Page: Dental Chart -->
        <div class="dental-chart-section">
          <div class="chart-title">Dental Record Chart</div>
          ${dentalChartHtml}
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

         <!-- PHYSICAL SPACE TO PUSH TO NEXT PAGE -->
        <div style="height: 300px; margin: 0; padding: 0; clear: both; display: block;"></div>

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
  },

  // Calculate age from birthday
  calculateAge: (birthday) => {
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
  },

  // Generate PDF from HTML
  generatePDF: async (patient, dentalChart, currentDate, chartSymbols, medicalHistory, medicalConditions, dentalHistory, physicianInfo, enhancedChartSymbols, toast) => {
    try {
      // Check if patient data is available
      if (!patient) {
        toast.error('Patient data not available. Please refresh the page and try again.');
        return;
      }

      let printHTML;
      try {
        printHTML = PDFGenerator.generatePDFHTML(
          patient, 
          dentalChart, 
          currentDate, 
          chartSymbols, 
          medicalHistory, 
          medicalConditions, 
          dentalHistory, 
          physicianInfo, 
          enhancedChartSymbols
        );
        console.log('Generated HTML length:', printHTML ? printHTML.length : 'undefined');
        console.log('HTML preview:', printHTML ? printHTML.substring(0, 200) : 'undefined');
      } catch (error) {
        console.error('Error generating PDF HTML:', error);
        toast.error('Failed to generate PDF content. Please try again.');
        return;
      }

      if (!printHTML) {
        console.error('printHTML is undefined or empty');
        toast.error('Failed to generate PDF content. Please try again.');
        return;
      }

      const parser = new DOMParser();
      const parsed = parser.parseFromString(printHTML, 'text/html');

      
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.top = '0';
      container.style.width = '794px';
      container.style.background = '#fff';

      // Copy styles from the template
      const styleEl = parsed.querySelector('style');
      if (styleEl) {
        const cloneStyle = document.createElement('style');
        cloneStyle.textContent = styleEl.textContent || '';
        container.appendChild(cloneStyle);
      }
      // Move all body children
      Array.from(parsed.body.childNodes).forEach((n) => container.appendChild(n.cloneNode(true)));
      document.body.appendChild(container);

      // Wait for images to load
      const images = Array.from(container.querySelectorAll('img'));
      await Promise.all(images.map(img => new Promise(res => { if (img.complete) res(); else { img.onload = img.onerror = () => res(); } })));

      // Render container to canvas
      const canvas = await html2canvas(container, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff'
      });
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginPt = 43;
      const sideMargin = marginPt;
      const topMarginFirst = marginPt;
      const topMarginNext = marginPt;
      const bottomMargin = marginPt;
      const contentWidthPt = pageWidth - sideMargin * 2;
      const contentHeightPt = pageHeight - topMarginFirst - bottomMargin;
      const pxPerPt = canvas.width / (pageWidth - sideMargin * 2);

      const addSlice = (startPx, heightPx, yPt) => {
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = heightPx;
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, startPx, canvas.width, heightPx, 0, 0, canvas.width, heightPx);
        const imgData = sliceCanvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', sideMargin, yPt, contentWidthPt, heightPx / pxPerPt);
      };

      // First page
      const firstHeightPx = Math.min(canvas.height, Math.floor(contentHeightPt * pxPerPt));
      addSlice(0, firstHeightPx, topMarginFirst);
      let cursorPx = firstHeightPx;

      // Subsequent pages
      while (cursorPx < canvas.height) {
        pdf.addPage('a4', 'p');
        const remainingCapacityPx = Math.max(0, Math.floor((pageHeight - topMarginNext - bottomMargin) * pxPerPt));
        const sliceHeightPx = Math.min(canvas.height - cursorPx, remainingCapacityPx);
        if (sliceHeightPx <= 0) break;
        addSlice(cursorPx, sliceHeightPx, topMarginNext);
        cursorPx += sliceHeightPx;
      }

      const safeName = (patient?.full_name || 'patient').replace(/[^a-z0-9\-\s]/gi, ' ').trim();
      pdf.save(`Dental Form - ${safeName}.pdf`);
      document.body.removeChild(container);
      toast.success('Dental form downloaded successfully!');
    } catch (error) {
      console.error('Error downloading dental form:', error);
      toast.error('Failed to download dental form');
    }
  }
};

export default PDFGenerator;