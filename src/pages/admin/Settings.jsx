// src/pages/admin/Settings.jsx
import React, { useState, useEffect } from 'react';
import { FiSettings, FiUser, FiLock, FiGlobe, FiAlertCircle, FiSave, FiCheck, FiCalendar, FiMapPin, FiEye, FiEyeOff, FiUpload, FiTrash2, FiCamera } from 'react-icons/fi';
import { useClinic } from '../../contexts/ClinicContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import supabase from '../../config/supabaseClient';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Settings = () => {
  const { logSettingsView, logSettingsUpdate, logProfileUpdate, logProfilePictureUpdate } = useUniversalAudit();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  
  // Get clinic information from context
  const { clinicInfo, updateClinicInfo, loading: clinicLoading } = useClinic();
  
  // Profile state
  const [profileData, setProfileData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    street: '',
    barangay: '',
    city: '',
    province: '',
    birthday: '',
    age: '',
    gender: '',
    profile_picture_url: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    occupation: '',
    nationality: ''
  });

  // Security state
  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Clinic state - Initialize from context
  const [clinicData, setClinicData] = useState(clinicInfo);
  
  // System state
  const [systemData, setSystemData] = useState({
    appointmentReminders: true,
    newPatients: true,
    systemUpdates: false,
    theme: 'light',
    language: 'en'
  });
  
  // Error states
  const [profileErrors, setProfileErrors] = useState({});
  const [securityErrors, setSecurityErrors] = useState({});
  const [clinicErrors, setClinicErrors] = useState({});

  // Add state for password visibility
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // State for certificate file
  const [certificateFile, setCertificateFile] = useState(null);
  
  // Profile picture states
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [isUploadingProfilePicture, setIsUploadingProfilePicture] = useState(false);
  const [isDraggingProfilePicture, setIsDraggingProfilePicture] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Update clinic data when clinicInfo changes
  useEffect(() => {
    if (!clinicLoading) {
      setClinicData(clinicInfo);
    }
  }, [clinicInfo, clinicLoading]);

  // Fetch user profile from database
  useEffect(() => {
    const fetchUserProfile = async () => {
      setLoading(true);
      try {
        // Log settings page view
        await logSettingsView('admin');
        
        // Get user's email from auth
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!authUser) {
          throw new Error('User not authenticated');
        }
        
        // Get profile data from database
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        
        if (error) {
          console.error('Error fetching profile:', error);
          // If profile doesn't exist, create a basic one
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              email: authUser.email,
              first_name: '',
              last_name: '',
              role: 'admin',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (insertError) {
            console.error('Error creating profile:', insertError);
          }
        }
        
        // Set profile data
        setProfileData({
          first_name: data?.first_name || '',
          middle_name: data?.middle_name || '',
          last_name: data?.last_name || '',
          email: authUser?.email || '',
          phone: data?.phone || '',
          street: data?.street || '',
          barangay: data?.barangay || '',
          city: data?.city || '',
          province: data?.province || '',
          birthday: data?.birthday || '',
          age: data?.age || '',
          gender: data?.gender || '',
          profile_picture_url: data?.profile_picture_url || '',
          emergency_contact_name: data?.emergency_contact_name || '',
          emergency_contact_phone: data?.emergency_contact_phone || '',
          occupation: data?.occupation || '',
          nationality: data?.nationality || '',
          certificate_url: data?.certificate_url || ''
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setLoading(false);
      }
    };
    
    fetchUserProfile();
  }, [logSettingsView]);

  // Handle profile input changes
  const handleProfileChange = (e) => {
    const { id, value } = e.target;
    setProfileData({
      ...profileData,
      [id]: value
    });
    
    // Clear error for this field if it exists
    if (profileErrors[id]) {
      setProfileErrors({
        ...profileErrors,
        [id]: ''
      });
    }
  };

  // Handle security input changes
  const handleSecurityChange = (e) => {
    const { id, value } = e.target;
    setSecurityData({
      ...securityData,
      [id]: value
    });
    
    // Clear error for this field if it exists
    if (securityErrors[id]) {
      setSecurityErrors({
        ...securityErrors,
        [id]: ''
      });
    }
  };
  
  // Handle clinic input changes
  const handleClinicChange = (e) => {
    const { id, value } = e.target;
    setClinicData({
      ...clinicData,
      [id]: value
    });
    
    // Clear error for this field if it exists
    if (clinicErrors[id]) {
      setClinicErrors({
        ...clinicErrors,
        [id]: ''
      });
    }
  };
  
  // Handle system input changes
  const handleSystemChange = (e) => {
    const { id, checked, value, type, name } = e.target;
    
    if (type === 'checkbox') {
      setSystemData({
        ...systemData,
        [id]: checked
      });
    } else if (type === 'radio') {
      setSystemData({
        ...systemData,
        [name]: value
      });
    } else {
      setSystemData({
        ...systemData,
        [id]: value
      });
    }
  };

  // Handle certificate file change
  const handleCertificateChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setCertificateFile(e.target.files[0]);
    } else {
      setCertificateFile(null);
    }
  };

  // Initialize certificates bucket - Simplified approach
  const initializeCertificatesBucket = async () => {
    try {
      // Skip bucket checking and go directly to upload
      // The bucket exists (as shown in your screenshot), so we'll assume it's accessible
      console.log('Skipping bucket initialization - proceeding with upload');
      return true;
    } catch (error) {
      console.error('Error in bucket initialization:', error);
      // Even if there's an error, we'll try to proceed with upload
      return true;
    }
  };

  // Certificate upload function
  const handleCertificateUpload = async () => {
    if (!certificateFile) {
      alert('Please select a certificate file first');
      return;
    }

    setLoading(true);
    try {
      // Validate file type
      if (!certificateFile.type.startsWith('image/')) {
        alert('Please select an image file for the certificate');
        return;
      }

      // Validate file size (max 10MB)
      if (certificateFile.size > 10 * 1024 * 1024) {
        alert('Certificate file size must be less than 10MB');
        return;
      }

      // Create a unique filename
      const fileExt = certificateFile.name.split('.').pop();
      const fileName = `admin_certificate_${Date.now()}.${fileExt}`;

      // Try to upload directly to certificates bucket
      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(fileName, certificateFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('certificates')
        .getPublicUrl(fileName);

      if (!publicUrl) {
        throw new Error('Failed to get public URL for certificate');
      }

      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }

      // Update the profile with the certificate URL using RLS-compliant method
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          certificate_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', authUser.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // Update local state
      setProfileData(prev => ({
        ...prev,
        certificate_url: publicUrl
      }));

      setCertificateFile(null);
      alert('Certificate uploaded successfully!');
      
    } catch (error) {
      console.error('Error uploading certificate:', error);
      alert(`Failed to upload certificate: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Remove certificate function
  const handleRemoveCertificate = async () => {
    try {
      // First, get the current certificate URL to delete from storage
      const currentCertificateUrl = profileData.certificate_url;
      
      if (currentCertificateUrl) {
        // Extract filename from URL
        const urlParts = currentCertificateUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        // Delete from storage
        try {
          const { error: deleteError } = await supabase.storage
            .from('certificates')
            .remove([fileName]);
          
          if (deleteError) {
            console.warn('Could not delete certificate from storage:', deleteError.message);
          }
        } catch (storageError) {
          console.warn('Storage deletion error:', storageError.message);
        }
      }

      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }

      // Update the profile to remove certificate URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          certificate_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', authUser.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // Update local state
      setProfileData(prev => ({
        ...prev,
        certificate_url: ''
      }));

      setCertificateFile(null);
      alert('Certificate removed successfully!');
      
    } catch (error) {
      console.error('Error removing certificate:', error);
      alert(`Failed to remove certificate: ${error.message}`);
    }
  };

  // Profile picture handlers
  const handleProfilePictureChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePictureFile(e.target.files[0]);
    }
  };

  const handleProfilePictureDragOver = (e) => {
    e.preventDefault();
    setIsDraggingProfilePicture(true);
  };

  const handleProfilePictureDragLeave = (e) => {
    e.preventDefault();
    setIsDraggingProfilePicture(false);
  };

  const handleProfilePictureDrop = (e) => {
    e.preventDefault();
    setIsDraggingProfilePicture(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      setProfilePictureFile(files[0]);
    }
  };

  const handleProfilePictureUpload = async () => {
    if (!profilePictureFile) {
      alert('Please select a profile picture first');
      return;
    }

    setIsUploadingProfilePicture(true);
    try {
      // Validate file type
      if (!profilePictureFile.type.startsWith('image/')) {
        alert('Please select an image file for the profile picture');
        return;
      }

      // Validate file size (max 5MB)
      if (profilePictureFile.size > 5 * 1024 * 1024) {
        alert('Profile picture file size must be less than 5MB');
        return;
      }

      // Create a unique filename
      const fileExt = profilePictureFile.name.split('.').pop();
      const fileName = `admin_profile_${Date.now()}.${fileExt}`;

      // Upload to profile-pictures bucket
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, profilePictureFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      if (!publicUrl) {
        throw new Error('Failed to get public URL for profile picture');
      }

      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }

      // Update the profile with the profile picture URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          profile_picture_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', authUser.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // Update local state
      setProfileData(prev => ({
        ...prev,
        profile_picture_url: publicUrl
      }));

      // Log profile picture upload
      try {
        await logProfilePictureUpdate(authUser, 'upload');
      } catch (auditError) {
        console.error('Error logging profile picture upload:', auditError);
      }

      setProfilePictureFile(null);
      alert('Profile picture uploaded successfully!');
      
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert(`Failed to upload profile picture: ${error.message}`);
    } finally {
      setIsUploadingProfilePicture(false);
    }
  };

  const handleRemoveProfilePicture = async () => {
    try {
      // First, get the current profile picture URL to delete from storage
      const currentProfilePictureUrl = profileData.profile_picture_url;
      
      if (currentProfilePictureUrl) {
        // Extract filename from URL
        const urlParts = currentProfilePictureUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        // Delete from storage
        try {
          const { error: deleteError } = await supabase.storage
            .from('profile-pictures')
            .remove([fileName]);
          
          if (deleteError) {
            console.warn('Could not delete profile picture from storage:', deleteError.message);
          }
        } catch (storageError) {
          console.warn('Storage deletion error:', storageError.message);
        }
      }

      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }

      // Update the profile to remove profile picture URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          profile_picture_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', authUser.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // Update local state
      setProfileData(prev => ({
        ...prev,
        profile_picture_url: ''
      }));

      // Log profile picture removal
      try {
        await logProfilePictureUpdate(authUser, 'remove');
      } catch (auditError) {
        console.error('Error logging profile picture removal:', auditError);
      }

      setProfilePictureFile(null);
      alert('Profile picture removed successfully!');
      
    } catch (error) {
      console.error('Error removing profile picture:', error);
      alert(`Failed to remove profile picture: ${error.message}`);
    }
  };

  // Validate profile data
  const validateProfile = () => {
    const errors = {};
    
    if (!profileData.first_name.trim()) {
      errors.first_name = 'First name is required';
    }
    
    if (!profileData.last_name.trim()) {
      errors.last_name = 'Last name is required';
    }
    
    if (!profileData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(profileData.email)) {
      errors.email = 'Email is invalid';
    }
    
    if (profileData.phone && !/^\+?[0-9]{10,15}$/.test(profileData.phone.replace(/\s/g, ''))) {
      errors.phone = 'Phone number is invalid';
    }
    
    if (profileData.birthday && !/^\d{4}-\d{2}-\d{2}$/.test(profileData.birthday)) {
      errors.birthday = 'Birthday must be in YYYY-MM-DD format';
    }
    
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Function to calculate password similarity
  const calculatePasswordSimilarity = (password1, password2) => {
    if (!password1 || !password2) return 0;
    
    const longer = password1.length > password2.length ? password1 : password2;
    const shorter = password1.length > password2.length ? password2 : password1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  // Levenshtein distance calculation for password similarity
  const levenshteinDistance = (str1, str2) => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  // Validate security data
  const validateSecurity = () => {
    const errors = {};
    
    if (!securityData.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }
    
    if (!securityData.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (securityData.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(securityData.newPassword)) {
      errors.newPassword = 'Password must include at least one special character';
    }
    
    // Check if new password is too similar to current password
    if (securityData.currentPassword && securityData.newPassword) {
      const similarity = calculatePasswordSimilarity(securityData.currentPassword, securityData.newPassword);
      if (similarity > 0.7) {
        errors.newPassword = 'New password is too similar to current password. Please choose a more different password.';
      }
    }
    
    if (!securityData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (securityData.newPassword !== securityData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setSecurityErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Validate clinic data
  const validateClinic = () => {
    const errors = {};
    
    if (!clinicData.clinicName.trim()) {
      errors.clinicName = 'Clinic name is required';
    }
    
    if (clinicData.clinicEmail && !/\S+@\S+\.\S+/.test(clinicData.clinicEmail)) {
      errors.clinicEmail = 'Email is invalid';
    }
    
    setClinicErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle profile save
  const handleProfileSave = async () => {
    if (validateProfile()) {
      setLoading(true);
      try {
        // Get current user
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!authUser) {
          throw new Error('User not authenticated');
        }
        
        // Prepare data for database update
        const processedData = {
          first_name: profileData.first_name,
          middle_name: profileData.middle_name,
          last_name: profileData.last_name,
          phone: profileData.phone,
          street: profileData.street,
          barangay: profileData.barangay,
          city: profileData.city,
          province: profileData.province,
          birthday: profileData.birthday === '' ? null : profileData.birthday,
          gender: profileData.gender || null,
          emergency_contact_name: profileData.emergency_contact_name,
          emergency_contact_phone: profileData.emergency_contact_phone,
          occupation: profileData.occupation,
          nationality: profileData.nationality,
          // Update legacy fields for compatibility
          full_name: [profileData.first_name, profileData.middle_name, profileData.last_name].filter(Boolean).join(' '),
          address: [profileData.street, profileData.barangay, profileData.city, profileData.province].filter(Boolean).join(', '),
          updated_at: new Date().toISOString()
        };
        
        // Update profile in database
        const { error } = await supabase
          .from('profiles')
          .update(processedData)
          .eq('id', authUser.id);
        
        if (error) throw error;
        
        setLoading(false);
        setIsEditing(false);
        
        // Log audit event for profile update
        try {
          await logProfileUpdate(authUser, {}, processedData);
        } catch (auditError) {
          console.error('Error logging profile update audit event:', auditError);
          // Continue even if audit logging fails
        }
        
        // Show success message
        toast.success('Profile updated successfully!');
        setSuccessMessage('Profile updated successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (error) {
        console.error('Error updating profile:', error);
        setLoading(false);
        toast.error('Failed to update profile: ' + error.message);
        setSuccessMessage('Failed to update profile. Please try again.');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    }
  };

  // Handle security save
  const handleSecuritySave = async () => {
    if (validateSecurity()) {
      setIsPasswordLoading(true);
      try {
        // Update password using Supabase Auth
        const { error } = await supabase.auth.updateUser({
          password: securityData.newPassword,
        });
        
                if (error) throw error;
        
        // Reset loading state immediately
        setIsPasswordLoading(false);
        
        // Show success notification
        toast.success('Password updated successfully! You will be logged out in 2 seconds.');
        
        // Wait 2 seconds then logout
        setTimeout(async () => {
          try {
            await logout();
            navigate('/login');
          } catch (logoutError) {
            console.error('Error during logout:', logoutError);
            // Force redirect anyway
            window.location.href = '/login';
        }
        }, 2000);
        
      } catch (error) {
        console.error('Error updating password:', error);
        toast.error('Failed to update password: ' + error.message);
        setSuccessMessage('Failed to update password: ' + error.message);
        setTimeout(() => setSuccessMessage(''), 3000);
        setIsPasswordLoading(false);
      }
    }
  };
  
  // Handle clinic save
  const handleClinicSave = async () => {
    if (validateClinic()) {
      // Simulating API call to update clinic information
      setLoading(true);
      try {
        // Update clinic information in the context
        const result = await updateClinicInfo(clinicData);
        
        if (result.success) {
          setLoading(false);
          
          // Log audit event for clinic update
          try {
            await logSettingsUpdate('clinic', {
              clinic_name: clinicData.clinicName,
              address: clinicData.address,
              phone: clinicData.phone,
              email: clinicData.email,
              website: clinicData.website,
              operating_hours: clinicData.operatingHours,
              services: clinicData.services
            });
          } catch (auditError) {
            console.error('Error logging clinic update audit event:', auditError);
            // Continue even if audit logging fails
          }
          
          // Show success message
          setSuccessMessage('Clinic information updated successfully!');
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          throw new Error('Failed to update clinic information');
        }
      } catch (error) {
        console.error('Error updating clinic information:', error);
        setLoading(false);
        setSuccessMessage('Failed to update clinic information. Please try again.');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    }
  };
  
  // Handle system save
  const handleSystemSave = async () => {
    // Simulating API call to update system settings
    setLoading(true);
    try {
      // In a real application, you would make an API call here
      console.log('Saving system settings:', systemData);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setLoading(false);
      
      // Log audit event for system settings update
      try {
        await logSettingsUpdate('system', {
          appointment_reminders: systemData.appointmentReminders,
          new_patients: systemData.newPatients,
          system_updates: systemData.systemUpdates,
          theme: systemData.theme,
          language: systemData.language
        });
      } catch (auditError) {
        console.error('Error logging system settings update audit event:', auditError);
        // Continue even if audit logging fails
      }
      
      // Show success message
      setSuccessMessage('System settings updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error updating system settings:', error);
      setLoading(false);
      setSuccessMessage('Failed to update system settings. Please try again.');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  // Clear success message when changing tabs
  useEffect(() => {
    setSuccessMessage('');
    setProfileErrors({});
    setSecurityErrors({});
    setClinicErrors({});
  }, [activeTab]);
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>
        
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <FiCheck className="h-5 w-5 text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            </div>
          </div>
        )}
        
        {loading || clinicLoading ? (
          <div className="mb-4 p-4 bg-blue-50 rounded-md">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700 mr-3"></div>
              <p className="text-sm text-blue-700">Loading...</p>
            </div>
          </div>
        ) : null}
        
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          {/* Tabs */}
          <div className="md:w-1/4 bg-gray-50 rounded-lg p-4">
            <div className="space-y-1">
              <button 
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  activeTab === 'profile' 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <FiUser className="mr-3 h-5 w-5" />
                <span>Profile Settings</span>
              </button>
              
              <button 
                onClick={() => setActiveTab('security')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  activeTab === 'security' 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <FiLock className="mr-3 h-5 w-5" />
                <span>Security</span>
              </button>
              
            
            </div>
          </div>
          
          {/* Content */}
          <div className="md:w-3/4 bg-white rounded-lg border border-gray-200 p-6">
            {activeTab === 'profile' && (
              <div className="max-w-5xl mx-auto w-full">
                {/* Header with buttons */}
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-xl font-bold text-primary-700 mb-1">Profile Information</h2>
                    <p className="text-sm text-gray-500">Update your personal information.</p>
                  </div>
                  <div className="flex gap-2">
                    {!isEditing ? (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors duration-200 text-sm flex items-center gap-2"
                      >
                        <FiUser className="w-4 h-4" />
                        Edit Profile
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsEditing(false)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors duration-200 text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleProfileSave}
                          disabled={loading}
                          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors duration-200 text-sm flex items-center gap-2 disabled:bg-primary-300 disabled:cursor-not-allowed"
                        >
                          {loading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <FiSave className="w-4 h-4" />
                              Save Changes
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <hr className="mb-6 border-blue-100" />
                
                {/* Profile Picture Section */}
                <div className="mb-8 flex justify-center">
                  <div className="flex flex-col items-center space-y-4">
                    {/* Profile Picture Display */}
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-200 shadow-lg">
                        {profileData.profile_picture_url ? (
                          <img
                            key={profileData.profile_picture_url}
                            src={`${profileData.profile_picture_url}?t=${Date.now()}`}
                            alt="Profile Picture"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className={`w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center ${profileData.profile_picture_url ? 'hidden' : ''}`}>
                          <FiUser className="w-16 h-16 text-white" />
                        </div>
                      </div>
                      
                      {/* Edit Button Overlay - Only show when editing */}
                      {isEditing && (
                        <button
                          onClick={() => document.getElementById('admin-profile-picture-input').click()}
                          className="absolute bottom-0 right-0 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary-700 transition-colors duration-200"
                          title="Change Profile Picture"
                        >
                          <FiCamera className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    
                    {/* Change/Remove Profile Picture Buttons - Only show when editing */}
                    {isEditing && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => document.getElementById('admin-profile-picture-input').click()}
                          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors duration-200 text-sm flex items-center gap-2"
                        >
                          <FiCamera className="w-4 h-4" />
                          Change Profile Picture
                        </button>
                        
                        {profileData.profile_picture_url && (
                          <button
                            onClick={handleRemoveProfilePicture}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 text-sm flex items-center gap-2"
                          >
                            <FiTrash2 className="w-4 h-4" />
                            Remove Profile Picture
                          </button>
                        )}
                      </div>
                    )}
                    
                    {/* Profile Picture Upload Interface */}
                    {isEditing && (
                      <div className="w-full max-w-md">
                        {/* Drag and Drop Area */}
                        <div
                          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 ${
                            isDraggingProfilePicture
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-300 hover:border-primary-400'
                          }`}
                          onDragOver={handleProfilePictureDragOver}
                          onDragLeave={handleProfilePictureDragLeave}
                          onDrop={handleProfilePictureDrop}
                        >
                          <input
                            id="admin-profile-picture-input"
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePictureChange}
                            className="hidden"
                          />
                          
                          {profilePictureFile ? (
                            <div className="space-y-3">
                              <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-2 border-gray-200">
                                <img
                                  src={URL.createObjectURL(profilePictureFile)}
                                  alt="Preview"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <p className="text-sm text-gray-600">{profilePictureFile.name}</p>
                              <div className="flex space-x-2 justify-center">
                                <button
                                  onClick={handleProfilePictureUpload}
                                  disabled={isUploadingProfilePicture}
                                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:bg-primary-300 disabled:cursor-not-allowed"
                                >
                                  {isUploadingProfilePicture ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block"></div>
                                      Uploading...
                                    </>
                                  ) : (
                                    <>
                                      <FiUpload className="inline mr-2" />
                                      Upload Picture
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => setProfilePictureFile(null)}
                                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <FiCamera className="w-12 h-12 text-gray-400 mx-auto" />
                              <div>
                                <p className="text-sm font-medium text-gray-700">
                                  Upload Profile Picture
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Drag and drop an image here, or click to browse
                                </p>
                              </div>
                              <button
                                onClick={() => document.getElementById('admin-profile-picture-input').click()}
                                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                              >
                                Choose File
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {/* Upload Guidelines */}
                        <div className="mt-3 text-xs text-gray-500 text-center">
                          <p>Supported formats: JPG, PNG, GIF (Max 5MB)</p>
                          <p>Recommended size: 400x400 pixels or larger</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {!isEditing ? (
                  <div className="space-y-8">
                    <div className="max-w-6xl mx-auto px-8">
                      <h3 className="text-xl font-bold text-primary-700 mb-1">Personal Information</h3>
                      <p className="text-sm text-gray-500 mb-6">View your personal information below.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">First Name</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profileData.first_name}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Middle Name</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profileData.middle_name}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Last Name</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profileData.last_name}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Email</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profileData.email}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Phone</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profileData.phone || 'Not provided'}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Birthday</label>
                          <div className="mt-1 text-gray-900 font-semibold">
                            {profileData.birthday ? new Date(profileData.birthday).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            }) : 'Not specified'}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Gender</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profileData.gender || 'Not specified'}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Age</label>
                          <div className="mt-1 text-gray-900 font-semibold">
                            {profileData.birthday ? 
                              Math.floor((new Date() - new Date(profileData.birthday)) / (365.25 * 24 * 60 * 60 * 1000)) + ' years old' 
                              : 'Not specified'}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Occupation/Specialization</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profileData.occupation || 'Not specified'}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Street</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profileData.street}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Barangay</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profileData.barangay}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">City/Municipality</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profileData.city}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Province</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profileData.province}</div>
                        </div>
                      </div>
                    </div>
                    
                    <hr className="my-6 border-blue-100" />
                    
                    <div className="max-w-6xl mx-auto px-8">
                      <h3 className="text-xl font-bold text-primary-700 mb-1">Emergency Contact</h3>
                      <p className="text-sm text-gray-500 mb-6">Who to contact in case of emergency.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Contact Name</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profileData.emergency_contact_name || 'Not provided'}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profileData.emergency_contact_phone || 'Not provided'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); handleProfileSave(); }} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                      {/* Name fields */}
                      <div>
                        <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">First Name</label>
                        <input
                          type="text"
                          id="first_name"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          value={profileData.first_name}
                          onChange={handleProfileChange}
                        />
                        {profileErrors.first_name && (
                          <p className="mt-1 text-sm text-red-600">{profileErrors.first_name}</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="middle_name" className="block text-sm font-medium text-gray-700">Middle Name</label>
                        <input
                          type="text"
                          id="middle_name"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          value={profileData.middle_name}
                          onChange={handleProfileChange}
                        />
                      </div>
                      <div>
                        <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">Last Name</label>
                        <input
                          type="text"
                          id="last_name"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          value={profileData.last_name}
                          onChange={handleProfileChange}
                        />
                        {profileErrors.last_name && (
                          <p className="mt-1 text-sm text-red-600">{profileErrors.last_name}</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                          type="email"
                          id="email"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          value={profileData.email}
                          disabled
                        />
                        <p className="mt-1 text-xs text-gray-500">Email cannot be changed as it's used for login.</p>
                      </div>
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
                        <input
                          type="tel"
                          id="phone"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          value={profileData.phone}
                          onChange={handleProfileChange}
                        />
                      </div>
                      <div>
                        <label htmlFor="birthday" className="block text-sm font-medium text-gray-700">Birthday</label>
                        <DatePicker
                          selected={profileData.birthday ? new Date(profileData.birthday) : null}
                          onChange={(date) => {
                            const formattedDate = date ? date.toISOString().split('T')[0] : '';
                            setProfileData(prev => ({
                              ...prev,
                              birthday: formattedDate
                            }));
                          }}
                          dateFormat="MMMM d, yyyy"
                          showMonthDropdown
                          showYearDropdown
                          dropdownMode="select"
                          scrollableYearDropdown
                          yearDropdownItemNumber={100}
                          placeholderText="Select your birthday"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          maxDate={new Date()}
                        />
                      </div>
                      <div>
                        <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
                        <select
                          id="gender"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          value={profileData.gender || ''}
                          onChange={handleProfileChange}
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="age" className="block text-sm font-medium text-gray-700">Age</label>
                        <input
                          type="text"
                          id="age"
                          name="age"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-gray-50"
                          value={profileData.birthday ? 
                            Math.floor((new Date() - new Date(profileData.birthday)) / (365.25 * 24 * 60 * 60 * 1000)) + ' years old' 
                            : 'Not specified'}
                          readOnly
                          disabled
                        />
                      </div>
                      <div>
                        <label htmlFor="occupation" className="block text-sm font-medium text-gray-700">Occupation/Specialization</label>
                        <input
                          type="text"
                          id="occupation"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          value={profileData.occupation}
                          onChange={handleProfileChange}
                        />
                      </div>
                      <div>
                        <label htmlFor="street" className="block text-sm font-medium text-gray-700">Street</label>
                        <input
                          type="text"
                          id="street"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          value={profileData.street}
                          onChange={handleProfileChange}
                        />
                      </div>
                      <div>
                        <label htmlFor="barangay" className="block text-sm font-medium text-gray-700">Barangay</label>
                        <input
                          type="text"
                          id="barangay"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          value={profileData.barangay}
                          onChange={handleProfileChange}
                        />
                      </div>
                      <div>
                        <label htmlFor="city" className="block text-sm font-medium text-gray-700">City/Municipality</label>
                        <input
                          type="text"
                          id="city"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          value={profileData.city}
                          onChange={handleProfileChange}
                        />
                      </div>
                      <div>
                        <label htmlFor="province" className="block text-sm font-medium text-gray-700">Province</label>
                        <input
                          type="text"
                          id="province"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          value={profileData.province}
                          onChange={handleProfileChange}
                        />
                      </div>
                    </div>
                    
                    <hr className="my-6 border-blue-100" />
                    
                    <div>
                      <h3 className="text-lg font-bold text-primary-700 mb-4">Emergency Contact</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <div>
                          <label htmlFor="emergency_contact_name" className="block text-sm font-medium text-gray-700">Contact Name</label>
                          <input
                            type="text"
                            id="emergency_contact_name"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                            value={profileData.emergency_contact_name}
                            onChange={handleProfileChange}
                          />
                        </div>
                        <div>
                          <label htmlFor="emergency_contact_phone" className="block text-sm font-medium text-gray-700">Contact Phone</label>
                          <input
                            type="tel"
                            id="emergency_contact_phone"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                            value={profileData.emergency_contact_phone}
                            onChange={handleProfileChange}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <hr className="my-6 border-blue-100" />
                    
                    <div>
                      <label htmlFor="certificate" className="block text-sm font-medium text-gray-700 mb-1">Certificates & Credentials (Upload Image)</label>
                      <div className="flex flex-col md:flex-row items-center gap-4">
                        <input
                          type="file"
                          id="certificate"
                          accept="image/*"
                          className="block w-full md:w-auto text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-primary-700 hover:file:bg-blue-100"
                          onChange={handleCertificateChange}
                        />
                        {certificateFile && (
                          <button
                            onClick={handleCertificateUpload}
                            disabled={loading}
                            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors duration-200 text-sm flex items-center gap-2 disabled:bg-primary-300 disabled:cursor-not-allowed"
                          >
                            {loading ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Uploading...
                              </>
                            ) : (
                              <>
                                <FiUpload className="w-4 h-4" />
                                Upload Certificate
                              </>
                            )}
                          </button>
                        )}
                        {(certificateFile || profileData.certificate_url) && (
                          <div className="mt-2 md:mt-0">
                            <img
                              src={certificateFile ? URL.createObjectURL(certificateFile) : profileData.certificate_url}
                              alt="Certificate"
                              className="h-32 w-auto object-contain border-2 border-blue-200 rounded-lg shadow-md"
                            />
                            {profileData.certificate_url && (
                              <button
                                onClick={handleRemoveCertificate}
                                className="mt-2 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 text-sm flex items-center gap-2"
                              >
                                <FiTrash2 className="w-4 h-4" />
                                Remove Certificate
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}
            
            {activeTab === 'security' && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Security Settings</h2>
                <p className="text-sm text-gray-500 mb-4">Manage your account security.</p>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        id="currentPassword"
                        value={securityData.currentPassword}
                        onChange={handleSecurityChange}
                        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 ${securityErrors.currentPassword ? 'border-red-300' : ''}`}
                        placeholder="********"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showCurrentPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                    {securityErrors.currentPassword && (
                      <p className="mt-1 text-sm text-red-600">{securityErrors.currentPassword}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        id="newPassword"
                        value={securityData.newPassword}
                        onChange={handleSecurityChange}
                        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 ${securityErrors.newPassword ? 'border-red-300' : ''}`}
                        placeholder="********"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                    {securityErrors.newPassword && (
                      <p className="mt-1 text-sm text-red-600">{securityErrors.newPassword}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirmPassword"
                        value={securityData.confirmPassword}
                        onChange={handleSecurityChange}
                        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 ${securityErrors.confirmPassword ? 'border-red-300' : ''}`}
                        placeholder="********"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                    {securityErrors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">{securityErrors.confirmPassword}</p>
                    )}
                  </div>
                  
                  <div className="pt-5">
                    <button
                      type="button"
                      onClick={handleSecuritySave}
                      disabled={isPasswordLoading}
                      className={`inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${isPasswordLoading ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'}`}
                    >
                      {isPasswordLoading ? 'Updating Password...' : (
                        <>
                          <FiSave className="mr-2 h-4 w-4" />
                          Update Password
                        </>
                      )}
                    </button>
                    
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-blue-800">
                            <strong>Note:</strong> After changing your password, you need to restart the page to apply changes. When you log out and log back in, use your new password.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
            
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;