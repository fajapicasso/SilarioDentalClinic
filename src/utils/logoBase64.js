// Base64 encoded logo for printing/PDF generation
// This ensures the logo works in production builds
import logo from '../assets/Logo.png';

// Function to get logo as base64 data URL
export const getLogoBase64DataURL = () => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      } catch (error) {
        console.error('Error converting logo to base64:', error);
        // Fallback: return the imported logo path
        resolve(logo);
      }
    };
    
    img.onerror = () => {
      console.error('Error loading logo image');
      // Fallback: return the imported logo path
      resolve(logo);
    };
    
    img.src = logo;
  });
};

// Export the logo path as fallback
export { logo };

