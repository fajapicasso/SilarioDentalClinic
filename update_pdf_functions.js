// Script to update PDF download functions in all dental chart files
const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/doctor/DentalChart.jsx',
  'src/pages/staff/DentalChart.jsx', 
  'src/pages/patient/DentalChart.jsx'
];

const newFunction = `  const downloadDentalFormPDF = async () => {
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
  };`;

files.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Find the start of downloadDentalFormPDF function
    const startPattern = /const downloadDentalFormPDF = async \(\) => \{/;
    const startMatch = content.match(startPattern);
    
    if (startMatch) {
      const startIndex = startMatch.index;
      
      // Find the end of the function (look for the closing brace and semicolon)
      let braceCount = 0;
      let endIndex = startIndex;
      let inFunction = false;
      
      for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') {
          braceCount++;
          inFunction = true;
        } else if (content[i] === '}') {
          braceCount--;
          if (inFunction && braceCount === 0) {
            // Check if next character is semicolon
            if (content[i + 1] === ';') {
              endIndex = i + 2;
              break;
            }
          }
        }
      }
      
      // Replace the function
      const before = content.substring(0, startIndex);
      const after = content.substring(endIndex);
      const newContent = before + newFunction + '\n' + after;
      
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Updated ${filePath}`);
    } else {
      console.log(`downloadDentalFormPDF function not found in ${filePath}`);
    }
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
  }
});

console.log('PDF function updates completed!');
