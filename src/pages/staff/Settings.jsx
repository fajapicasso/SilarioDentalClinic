// src/pages/staff/Settings.jsx
import React, { useState, useEffect } from 'react';
import { FiUser, FiLock, FiSave, FiCamera, FiUpload, FiTrash2, FiRefreshCw } from 'react-icons/fi';
import supabase from '../../config/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

const PROFILE_PICTURES_BUCKET = 'profile-pictures';

const Settings = () => {
  const { user } = useAuth();
  const { logSettingsView, logSettingsUpdate, logProfileUpdate, logProfilePictureUpdate, logPasswordChange } = useUniversalAudit();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  
  // Profile state
  const [profile, setProfile] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    certificate_url: '',
    street: '',
    barangay: '',
    city: '',
    province: '',
    age: '',
    birthday: '',
    gender: '',
    birthdayDisabled: false,
    profile_picture_url: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    nickname: '',
    occupation: '',
    nationality: '',
    office_no: ''
  });
  const [certificateFile, setCertificateFile] = useState(null);
  
  // Profile picture states
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [isUploadingProfilePicture, setIsUploadingProfilePicture] = useState(false);
  const [isDraggingProfilePicture, setIsDraggingProfilePicture] = useState(false);
  
  // Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  
  // Success message state
  const [successMessage, setSuccessMessage] = useState('');
  

  // Fetch staff's data on component mount
  useEffect(() => {
    if (user) {
      // Log page view
      logSettingsView('staff');
      
      fetchStaffData();
    }
  }, [user, logSettingsView]);


  // Clear success message when changing tabs
  useEffect(() => {
    setSuccessMessage('');
  }, [activeTab]);

  const fetchStaffData = async () => {
      setIsLoading(true);
      try {
        // First get the user's email from auth
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!authUser) {
          throw new Error('User not authenticated');
        }
        
        // Then get the profile data
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        
      // Set profile data
      setProfile({
          first_name: data?.first_name || '',
          middle_name: data?.middle_name || '',
          last_name: data?.last_name || '',
          email: authUser?.email || '',
          phone: data?.phone || '',
        certificate_url: data?.certificate_url || '',
          street: data?.street || '',
          barangay: data?.barangay || '',
          city: data?.city || '',
          province: data?.province || '',
          age: data?.age || '',
          birthday: data?.birthday || '',
          gender: data?.gender || '',
        profile_picture_url: data?.profile_picture_url || '',
        emergency_contact_name: data?.emergency_contact_name || '',
        emergency_contact_phone: data?.emergency_contact_phone || '',
        nickname: data?.nickname || '',
        occupation: data?.occupation || '',
        nationality: data?.nationality || '',
        office_no: data?.office_no || ''
      });
      
      // Initialize profile pictures bucket
      await initializeProfilePicturesBucket();
      
      } catch (error) {
      console.error('Error fetching staff data:', error);
      toast.error('Failed to load staff data');
      } finally {
        setIsLoading(false);
      }
    };
    
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCertificateChange = (e) => {
    setCertificateFile(e.target.files[0]);
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
      toast.error('Please select a certificate file first');
      return;
    }

    setIsSaving(true);
    try {
      // Validate file type
      if (!certificateFile.type.startsWith('image/')) {
        toast.error('Please select an image file for the certificate');
        return;
      }

      // Validate file size (max 10MB)
      if (certificateFile.size > 10 * 1024 * 1024) {
        toast.error('Certificate file size must be less than 10MB');
        return;
      }

      // Create a unique filename
      const fileExt = certificateFile.name.split('.').pop();
      const fileName = `${user.id}_certificate_${Date.now()}.${fileExt}`;

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

      // Update the profile with the certificate URL using RLS-compliant method
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          certificate_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // Update local state
      setProfile(prev => ({
        ...prev,
        certificate_url: publicUrl
      }));

      setCertificateFile(null);
      toast.success('Certificate uploaded successfully!');
      
      // Refresh the profile data
      fetchStaffData();
      
    } catch (error) {
      console.error('Error uploading certificate:', error);
      toast.error(`Failed to upload certificate: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Remove certificate function
  const handleRemoveCertificate = async () => {
    try {
      // First, get the current certificate URL to delete from storage
      const currentCertificateUrl = profile.certificate_url;
      
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

      // Update the profile to remove certificate URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          certificate_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // Update local state
      setProfile(prev => ({
        ...prev,
        certificate_url: ''
      }));

    setCertificateFile(null);
      toast.success('Certificate removed successfully!');
      
      // Refresh the profile data
      fetchStaffData();
      
    } catch (error) {
      console.error('Error removing certificate:', error);
      toast.error(`Failed to remove certificate: ${error.message}`);
    }
  };

  const initializeProfilePicturesBucket = async () => {
    try {
      // Try to list buckets first to check if it exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.warn('Could not list buckets:', listError.message);
        // Try to create the bucket anyway
        const { error: createError } = await supabase.storage.createBucket(PROFILE_PICTURES_BUCKET, {
          public: false,
          fileSizeLimit: 10 * 1024 * 1024, // 10MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        });
        
        if (createError) {
          console.warn('Could not create profile pictures bucket:', createError.message);
          return false;
        }
      } else {
        // Check if our bucket exists
        const bucketExists = buckets.some(bucket => bucket.name === PROFILE_PICTURES_BUCKET);
        
        if (!bucketExists) {
          const { error: createError } = await supabase.storage.createBucket(PROFILE_PICTURES_BUCKET, {
            public: false,
            fileSizeLimit: 10 * 1024 * 1024, // 10MB
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
          });
          
          if (createError) {
            console.warn('Could not create profile pictures bucket:', createError.message);
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.warn('Profile pictures bucket initialization error:', error.message);
      return false;
    }
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        toast.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
        return;
      }
      
      setProfilePictureFile(file);
    }
  };

  const handleProfilePictureUpload = async () => {
    if (!profilePictureFile) {
      toast.error('Please select a profile picture first');
      return;
    }

    setIsUploadingProfilePicture(true);
    try {
      const fileExt = profilePictureFile.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload the file
      const { error: uploadError } = await supabase.storage
        .from(PROFILE_PICTURES_BUCKET)
        .upload(filePath, profilePictureFile);

      if (uploadError) {
        throw uploadError;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from(PROFILE_PICTURES_BUCKET)
        .getPublicUrl(filePath);

      // Update the profile with the new picture URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_picture_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setProfile(prev => ({
        ...prev,
        profile_picture_url: publicUrl
      }));

      setProfilePictureFile(null);
      toast.success('Profile picture updated successfully!');
      
      // Force a page reload to ensure the new image is displayed
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast.error('Failed to upload profile picture: ' + error.message);
    } finally {
      setIsUploadingProfilePicture(false);
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
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error('File size must be less than 10MB');
        return;
      }
        setProfilePictureFile(file);
      } else {
        toast.error('Please drop an image file');
      }
    }
  };

  const handleRemoveProfilePicture = async () => {
    try {
      // Update the profile to remove the picture URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_picture_url: null })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setProfile(prev => ({
        ...prev,
        profile_picture_url: ''
      }));

      toast.success('Profile picture removed successfully!');
      
      // Force a page reload to ensure the change is reflected
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Error removing profile picture:', error);
      toast.error('Failed to remove profile picture: ' + error.message);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (passwordErrors[name]) {
      setPasswordErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };


  const saveProfile = async () => {
    setIsSaving(true);
    try {
      const processedData = {
        first_name: profile.first_name,
        middle_name: profile.middle_name,
        last_name: profile.last_name,
        phone: profile.phone,
        street: profile.street,
        barangay: profile.barangay,
        city: profile.city,
        province: profile.province,
        age: profile.age,
        birthday: profile.birthday,
        gender: profile.gender || null,
        emergency_contact_name: profile.emergency_contact_name,
        emergency_contact_phone: profile.emergency_contact_phone,
        nickname: profile.nickname,
        occupation: profile.occupation,
        nationality: profile.nationality,
        office_no: profile.office_no,
        // Optionally update full_name/address for legacy support
        full_name: [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' '),
        address: [profile.street, profile.barangay, profile.city, profile.province].filter(Boolean).join(', '),
        birthday: profile.birthday === '' ? null : profile.birthday,
        age: profile.age === '' ? null : Number(profile.age),
          updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('profiles')
        .update(processedData)
        .eq('id', user.id);
      
      if (error) throw error;
      
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile: ' + error.message);
    } finally {
      setIsSaving(false);
    }
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
  
  const changePassword = async () => {
    // Enhanced password validation
    const errors = {};
    
    // Current password validation
    if (!passwordData.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }
    
    // New password validation
    if (!passwordData.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (passwordData.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword)) {
      errors.newPassword = 'Password must include at least one special character';
    }
    
    // Check if new password is too similar to current password
    if (passwordData.currentPassword && passwordData.newPassword) {
      const similarity = calculatePasswordSimilarity(passwordData.currentPassword, passwordData.newPassword);
      if (similarity > 0.7) {
        errors.newPassword = 'New password is too similar to current password. Please choose a more different password.';
      }
    }
    
    // Confirm password validation
    if (!passwordData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password';
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }
    
    setIsPasswordLoading(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });
      
      if (error) throw error;
      
      // Reset loading state immediately
      setIsPasswordLoading(false);
      
      // Show success notification
      toast.success('Password changed successfully! You will be logged out in 2 seconds.');
      
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
      console.error('Error changing password:', error);
      toast.error('Failed to change password: ' + error.message);
      setIsPasswordLoading(false);
    }
  };


  const refreshAuth = async () => {
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) throw error;
      toast.success('Session refreshed successfully!');
    } catch (error) {
      console.error('Error refreshing session:', error);
      toast.error('Failed to refresh session');
    }
  };
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-primary-700 mb-2">My Profile</h1>
              <p className="text-gray-600">Manage your personal information and account settings</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={refreshAuth}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
              >
                <FiRefreshCw className="w-4 h-4" />
                <span>Refresh Session</span>
              </button>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center space-x-2"
                >
                  <FiSave className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={saveProfile}
                    disabled={isSaving}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 disabled:opacity-50"
                  >
                    <FiSave className="w-4 h-4" />
                    <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
          <hr className="mb-6" />
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="bg-white shadow rounded-lg">
            {/* Navigation Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 px-6">
              <button 
                onClick={() => setActiveTab('profile')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'profile' 
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                  <FiUser className="inline w-4 h-4 mr-2" />
                  My Profile
              </button>
              <button 
                onClick={() => setActiveTab('password')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'password' 
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                  <FiLock className="inline w-4 h-4 mr-2" />
                  Change Password
              </button>
              </nav>
          </div>
          
            {/* Tab Content */}
            <div className="p-6">
              {/* Profile Tab */}
            {activeTab === 'profile' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Profile Information</h2>
                    <p className="text-gray-600">Update your personal information.</p>
                  </div>

                  {/* Profile Picture Section */}
                  <div className="mb-8">
                    <div className="flex justify-center">
                      <div className="relative">
                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-200">
                          {profile.profile_picture_url ? (
                            <img
                              src={`${profile.profile_picture_url}?t=${Date.now()}`}
                              alt="Profile"
                              className="w-full h-full object-cover"
                              key={profile.profile_picture_url}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                              <FiUser className="w-12 h-12 text-gray-500" />
                  </div>
                )}
                        </div>
                        {isEditing && (
                          <>
                            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                              <FiCamera className="w-8 h-8 text-white" />
                            </div>
                            <input
                              type="file"
                              id="staff-profile-picture-input"
                              accept="image/*"
                              onChange={handleProfilePictureChange}
                              className="hidden"
                            />
                            <label
                              htmlFor="staff-profile-picture-input"
                              className="absolute inset-0 cursor-pointer"
                            />
                          </>
                        )}
                      </div>
                    </div>
                    
                    {isEditing && (
                      <div className="mt-4 flex justify-center space-x-4">
                        <button
                          onClick={() => document.getElementById('staff-profile-picture-input').click()}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center space-x-2"
                        >
                          <FiCamera className="w-4 h-4" />
                          <span>Change Profile Picture</span>
                        </button>
                        {profile.profile_picture_url && (
                          <button
                            onClick={handleRemoveProfilePicture}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
                          >
                            <FiTrash2 className="w-4 h-4" />
                            <span>Remove Profile Picture</span>
                          </button>
                        )}
                      </div>
                    )}

                    {isEditing && profilePictureFile && (
                      <div className="mt-4 flex justify-center">
                        <div className="text-center">
                          <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-2 border-gray-200 mb-2">
                            <img
                              src={URL.createObjectURL(profilePictureFile)}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{profilePictureFile.name}</p>
                          <div className="flex space-x-2 justify-center">
                            <button
                              onClick={handleProfilePictureUpload}
                              disabled={isUploadingProfilePicture}
                              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-green-300 disabled:cursor-not-allowed"
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
                      </div>
                    )}
                  </div>

                  {!isEditing ? (
                    <div className="space-y-8">
                      <div className="max-w-6xl mx-auto px-8">
                        <h3 className="text-xl font-bold text-primary-700 mb-1">Personal Information</h3>
                        <p className="text-sm text-gray-500 mb-6">View your personal information below.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
                <div>
                            <label className="block text-sm font-medium text-gray-700">First Name</label>
                            <div className="mt-1 text-gray-900 font-semibold">{profile.first_name || 'Not specified'}</div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Middle Name</label>
                            <div className="mt-1 text-gray-900 font-semibold">{profile.middle_name || 'Not specified'}</div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Last Name</label>
                            <div className="mt-1 text-gray-900 font-semibold">{profile.last_name || 'Not specified'}</div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <div className="mt-1 text-gray-900 font-semibold">{profile.email || 'Not specified'}</div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Phone</label>
                            <div className="mt-1 text-gray-900 font-semibold">{profile.phone || 'Not specified'}</div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Birthday</label>
                            <div className="mt-1 text-gray-900 font-semibold">
                              {profile.birthday ? new Date(profile.birthday).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              }) : 'Not specified'}
                            </div>
                            
                          </div>
                          <div>
                          <label className="block text-sm font-medium text-gray-700">Gender</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profile.gender || 'Not specified'}</div>
                        </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Age</label>
                            <div className="mt-1 text-gray-900 font-semibold">
                              {profile.birthday ? 
                                Math.floor((new Date() - new Date(profile.birthday)) / (365.25 * 24 * 60 * 60 * 1000)) + ' years old' 
                                : 'Not specified'}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Occupation/Specialization</label>
                            <div className="mt-1 text-gray-900 font-semibold">{profile.occupation || 'Not specified'}</div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Street</label>
                            <div className="mt-1 text-gray-900 font-semibold">{profile.street || 'Not specified'}</div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Barangay</label>
                            <div className="mt-1 text-gray-900 font-semibold">{profile.barangay || 'Not specified'}</div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">City/Municipality</label>
                            <div className="mt-1 text-gray-900 font-semibold">{profile.city || 'Not specified'}</div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Province</label>
                            <div className="mt-1 text-gray-900 font-semibold">{profile.province || 'Not specified'}</div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Gender</label>
                            <div className="mt-1 text-gray-900 font-semibold">{profile.gender || 'Not specified'}</div>
                          </div>
                        </div>
                      </div>

                      <div className="max-w-6xl mx-auto px-8">
                        <h3 className="text-xl font-bold text-primary-700 mb-1">Emergency Contact</h3>
                        <p className="text-sm text-gray-500 mb-6">Your emergency contact information.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Emergency Contact Name</label>
                            <div className="mt-1 text-gray-900 font-semibold">{profile.emergency_contact_name || 'Not specified'}</div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Emergency Contact Phone</label>
                            <div className="mt-1 text-gray-900 font-semibold">{profile.emergency_contact_phone || 'Not specified'}</div>
                          </div>
                        </div>
                      </div>

                      <div className="max-w-6xl mx-auto px-8">
                        <h3 className="text-xl font-bold text-primary-700 mb-1">Certificates & Credentials</h3>
                        <p className="text-sm text-gray-500 mb-6">Your professional certificates and credentials.</p>
                        {profile.certificate_url ? (
                          <div className="flex items-center space-x-4">
                            <div className="flex-1">
                              <p className="text-sm text-gray-600">Current Certificate</p>
                              <a
                                href={profile.certificate_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:text-primary-800 underline"
                              >
                                View Certificate
                              </a>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500">No certificate uploaded</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div className="max-w-6xl mx-auto px-8">
                        <h3 className="text-xl font-bold text-primary-700 mb-1">Edit Personal Information</h3>
                        <p className="text-sm text-gray-500 mb-6">Update your personal information below.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">First Name</label>
                      <input
                        type="text"
                        id="first_name"
                              name="first_name"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                              value={profile.first_name}
                              onChange={handleProfileChange}
                            />
                    </div>
                    <div>
                      <label htmlFor="middle_name" className="block text-sm font-medium text-gray-700">Middle Name</label>
                      <input
                        type="text"
                        id="middle_name"
                              name="middle_name"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                              value={profile.middle_name}
                              onChange={handleProfileChange}
                            />
                    </div>
                    <div>
                      <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">Last Name</label>
                      <input
                        type="text"
                        id="last_name"
                              name="last_name"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                              value={profile.last_name}
                              onChange={handleProfileChange}
                            />
                    </div>
                    <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
                      <input
                              type="tel"
                              id="phone"
                              name="phone"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                              value={profile.phone}
                              onChange={handleProfileChange}
                      />
                    </div>
                    <div>
                      <label htmlFor="birthday" className="block text-sm font-medium text-gray-700">Birthday</label>
                      <input
                        type="date"
                        id="birthday"
                        name="birthday"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={profile.birthday}
                        onChange={handleProfileChange}
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div>
                        <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
                        <select
                          id="gender"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          value={profile.gender || ''}
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
                        value={profile.birthday ? 
                          Math.floor((new Date() - new Date(profile.birthday)) / (365.25 * 24 * 60 * 60 * 1000)) + ' years old' 
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
                              name="occupation"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                              value={profile.occupation}
                              onChange={handleProfileChange}
                      />
                    </div>
                    <div>
                      <label htmlFor="street" className="block text-sm font-medium text-gray-700">Street</label>
                      <input
                        type="text"
                        id="street"
                              name="street"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                              value={profile.street}
                              onChange={handleProfileChange}
                            />
                    </div>
                    <div>
                      <label htmlFor="barangay" className="block text-sm font-medium text-gray-700">Barangay</label>
                      <input
                        type="text"
                        id="barangay"
                              name="barangay"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                              value={profile.barangay}
                              onChange={handleProfileChange}
                            />
                    </div>
                    <div>
                      <label htmlFor="city" className="block text-sm font-medium text-gray-700">City/Municipality</label>
                      <input
                        type="text"
                        id="city"
                              name="city"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                              value={profile.city}
                              onChange={handleProfileChange}
                            />
                    </div>
                    <div>
                      <label htmlFor="province" className="block text-sm font-medium text-gray-700">Province</label>
                      <input
                        type="text"
                        id="province"
                              name="province"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                              value={profile.province}
                              onChange={handleProfileChange}
                      />
                    </div>
                          
                    <div>
                      <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
                      <select
                        id="gender"
                              name="gender"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                              value={profile.gender || ''}
                              onChange={handleProfileChange}
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                        </div>
                      </div>

                      <div className="max-w-6xl mx-auto px-8">
                        <h3 className="text-xl font-bold text-primary-700 mb-1">Emergency Contact</h3>
                        <p className="text-sm text-gray-500 mb-6">Your emergency contact information.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label htmlFor="emergency_contact_name" className="block text-sm font-medium text-gray-700">Emergency Contact Name</label>
                        <input
                              type="text"
                              id="emergency_contact_name"
                              name="emergency_contact_name"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                              value={profile.emergency_contact_name}
                              onChange={handleProfileChange}
                            />
                          </div>
                          <div>
                            <label htmlFor="emergency_contact_phone" className="block text-sm font-medium text-gray-700">Emergency Contact Phone</label>
                            <input
                              type="tel"
                              id="emergency_contact_phone"
                              name="emergency_contact_phone"
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                              value={profile.emergency_contact_phone}
                              onChange={handleProfileChange}
                            />
                          </div>
                      </div>
                    </div>

                      <div className="max-w-6xl mx-auto px-8">
                        <h3 className="text-xl font-bold text-primary-700 mb-1">Upload Certificate</h3>
                        <p className="text-sm text-gray-500 mb-6">Upload your professional certificates.</p>
                      <div className="flex flex-col md:flex-row items-center gap-4">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCertificateChange}
                            className="block w-full md:w-auto text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-primary-700 hover:file:bg-blue-100"
                          />
                          {certificateFile && (
                            <button
                              onClick={handleCertificateUpload}
                              disabled={isSaving}
                              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors duration-200 text-sm flex items-center gap-2 disabled:bg-primary-300 disabled:cursor-not-allowed"
                            >
                              {isSaving ? (
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
                          {(certificateFile || profile.certificate_url) && (
                            <div className="mt-2 md:mt-0">
                              <img
                                src={certificateFile ? URL.createObjectURL(certificateFile) : profile.certificate_url}
                              alt="Certificate"
                              className="h-32 w-auto object-contain border-2 border-blue-200 rounded-lg shadow-md"
                            />
                              {profile.certificate_url && (
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
                  </div>
                  )}
              </div>
            )}
            
              {/* Password Tab */}
            {activeTab === 'password' && (
              <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Change Password</h2>
                    <p className="text-gray-600">Update your account password.</p>
                  </div>
                  
                  {successMessage && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-green-800">
                            {successMessage}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                
                  <div className="max-w-md space-y-4">
                  <div>
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                        Current Password
                      </label>
                      <input
                        type="password"
                        id="currentPassword"
                        name="currentPassword"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                      />
                    {passwordErrors.currentPassword && (
                        <p className="mt-1 text-sm text-red-600">{passwordErrors.currentPassword}</p>
                    )}
                  </div>
                  
                  <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                        New Password
                      </label>
                      <input
                        type="password"
                        id="newPassword"
                        name="newPassword"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                      />
                    {passwordErrors.newPassword && (
                        <p className="mt-1 text-sm text-red-600">{passwordErrors.newPassword}</p>
                    )}
                  </div>
                  
                  <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                      />
                      {passwordErrors.confirmPassword && (
                        <p className="mt-1 text-sm text-red-600">{passwordErrors.confirmPassword}</p>
                      )}
                    </div>

                      <button
                      onClick={changePassword}
                      disabled={isPasswordLoading}
                      className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:bg-primary-300 disabled:cursor-not-allowed"
                    >
                      {isPasswordLoading ? 'Updating Password...' : 'Change Password'}
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
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;