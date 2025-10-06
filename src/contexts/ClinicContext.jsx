// src/contexts/ClinicContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

// Create a context for clinic information
const ClinicContext = createContext();

// Hook for easy access to the clinic context
export const useClinic = () => useContext(ClinicContext);

export const ClinicProvider = ({ children }) => {
  // State for clinic information
  const [clinicInfo, setClinicInfo] = useState({
    clinicName: 'Silario Dental Clinic',
    clinicAddress: '',
    clinicPhone: '',
    clinicEmail: ''
  });
  
  // Flag to track if clinic data is loading
  const [loading, setLoading] = useState(true);

  // Function to update clinic information
  const updateClinicInfo = async (newClinicInfo) => {
    try {
      // In a real app, you would make an API call here to update the database
      // For example: await api.updateClinicInfo(newClinicInfo);
      
      console.log('Updating clinic info in context:', newClinicInfo);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update local state
      setClinicInfo(newClinicInfo);
      
      // Store in localStorage for persistence
      localStorage.setItem('clinicInfo', JSON.stringify(newClinicInfo));
      
      return { success: true };
    } catch (error) {
      console.error('Error updating clinic information:', error);
      return { success: false, error };
    }
  };

  // Load clinic info from localStorage on initial render
  useEffect(() => {
    const fetchClinicInfo = async () => {
      setLoading(true);
      try {
        // In a real app, you'd fetch from an API first
        // const response = await api.getClinicInfo();
        // setClinicInfo(response.data);
        
        // For now, we'll use localStorage as a simple persistence layer
        const storedClinicInfo = localStorage.getItem('clinicInfo');
        if (storedClinicInfo) {
          setClinicInfo(JSON.parse(storedClinicInfo));
        }
      } catch (error) {
        console.error('Error loading clinic information:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchClinicInfo();
  }, []);

  // Value to be provided to consumers of this context
  const value = {
    clinicInfo,
    updateClinicInfo,
    loading
  };

  return (
    <ClinicContext.Provider value={value}>
      {children}
    </ClinicContext.Provider>
  );
};

export default ClinicContext;