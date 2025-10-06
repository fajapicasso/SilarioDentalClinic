        // src/pages/doctor/Settings.jsx
        import React, { useState, useEffect } from 'react';
        import { FiUser, FiLock, FiCalendar, FiBriefcase, FiSave, FiCamera, FiUpload, FiTrash2, FiRefreshCw, FiEye, FiEyeOff } from 'react-icons/fi';
        import supabase from '../../config/supabaseClient';
import ScheduleUtils from '../../services/scheduleUtils';
        import { useAuth } from '../../contexts/AuthContext';
        import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';

        const PROFILE_PICTURES_BUCKET = 'profile-pictures';
        const DOCTOR_GCASH_QR_BUCKET = 'doctor-gcash-qr';

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
    office_no: '',
    // GCash QR management
    gcash_qr_urls: [],
    gcash_qr_default_index: 0
          });
          const [certificateFile, setCertificateFile] = useState(null);
          const [isUploadingCertificate, setIsUploadingCertificate] = useState(false);
          
          // Profile picture states
          const [profilePictureFile, setProfilePictureFile] = useState(null);
          const [isUploadingProfilePicture, setIsUploadingProfilePicture] = useState(false);
          const [isDraggingProfilePicture, setIsDraggingProfilePicture] = useState(false);
          // QR Code upload states
          const [qrFile, setQrFile] = useState(null);
          const [isUploadingQr, setIsUploadingQr] = useState(false);
          
          // Password state
          const [passwordData, setPasswordData] = useState({
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          });
          const [passwordErrors, setPasswordErrors] = useState({});
          
          // Password visibility states
          const [showCurrentPassword, setShowCurrentPassword] = useState(false);
          const [showNewPassword, setShowNewPassword] = useState(false);
          const [showConfirmPassword, setShowConfirmPassword] = useState(false);
          
          // Success message state
          const [successMessage, setSuccessMessage] = useState('');
          
  // Enhanced Schedule state with default working hours enabled
  const [schedule, setSchedule] = useState({
    cabugao: {
      monday: { enabled: true, start: '08:00', end: '12:00' },
      tuesday: { enabled: true, start: '08:00', end: '12:00' },
      wednesday: { enabled: true, start: '08:00', end: '12:00' },
      thursday: { enabled: true, start: '08:00', end: '12:00' },
      friday: { enabled: true, start: '08:00', end: '12:00' },
      saturday: { enabled: true, start: '08:00', end: '17:00' },
      sunday: { enabled: false, start: '08:00', end: '17:00' },
    },
    sanjuan: {
      monday: { enabled: true, start: '13:00', end: '17:00' },
      tuesday: { enabled: true, start: '13:00', end: '17:00' },
      wednesday: { enabled: true, start: '13:00', end: '17:00' },
      thursday: { enabled: true, start: '13:00', end: '17:00' },
      friday: { enabled: true, start: '13:00', end: '17:00' },
      saturday: { enabled: false, start: '08:00', end: '17:00' },
      sunday: { enabled: true, start: '08:00', end: '17:00' },
    }
  });

  // New state for improved schedule management
  const [selectedBranchForSchedule, setSelectedBranchForSchedule] = useState('cabugao');
  const [selectedDateForSchedule, setSelectedDateForSchedule] = useState('');
  const [selectedStartTime, setSelectedStartTime] = useState('08:00');
  const [selectedEndTime, setSelectedEndTime] = useState('17:00');
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Unavailable dates/times state
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('cabugao');
  const [selectedDate, setSelectedDate] = useState(null);
  const [unavailableTimeSlots, setUnavailableTimeSlots] = useState({});
          
          // Specialization state
          const [specialization, setSpecialization] = useState({
            primary: 'General Dentistry',
            procedures: {
              examination: false,
              filling: false,
              rootCanal: false,
              extraction: false,
              implants: false,
              orthodontic: false
            }
          });

          // Fetch doctor's data on component mount
          useEffect(() => {
            if (user) {
              // Log settings page view
              logSettingsView('doctor');
              fetchDoctorData();
              loadScheduleData();
            }
          }, [user, logSettingsView]);

          // Load schedule data from database or localStorage
          const loadScheduleData = async () => {
            try {
              // First try to load from database
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('schedule, unavailable_dates')
                .eq('id', user.id)
                .single();
              
              if (!profileError && profileData) {
                const validatedSchedule = ensureScheduleStructure(profileData.schedule);
                setSchedule(validatedSchedule);
                console.log('Loaded and validated schedule from database:', validatedSchedule);
                if (profileData.unavailable_dates) {
                  setUnavailableDates(profileData.unavailable_dates);
                  console.log('Loaded unavailable dates from database:', profileData.unavailable_dates);
                }
                return; // Successfully loaded from database
              }
              
              // If database loading failed, try localStorage
              console.warn('Database schedule loading failed, trying localStorage:', profileError?.message);
              const stored = localStorage.getItem(`doctor_schedule_${user.id}`);
              if (stored) {
                const data = JSON.parse(stored);
                const validatedSchedule = ensureScheduleStructure(data.schedule);
                setSchedule(validatedSchedule);
                console.log('Loaded and validated schedule from localStorage:', validatedSchedule);
                if (data.unavailable_dates) {
                  setUnavailableDates(data.unavailable_dates);
                }
                console.log('Loaded data from localStorage:', data);
              }
            } catch (error) {
              console.warn('Error loading schedule data:', error);
            }
          };

          // Clear success message when changing tabs
          useEffect(() => {
            setSuccessMessage('');
          }, [activeTab]);

          // Fetch user's certificates
          const fetchUserCertificates = async () => {
            if (!user?.id) return;
            
            try {
              const { data, error } = await supabase.rpc('get_user_certificates', {
                p_user_id: user.id
              });
              
              if (error) {
                console.error('Error fetching certificates:', error);
                return;
              }
              
              // The original code had a 'certificates' state, but it was removed.
              // This function is no longer directly used for displaying certificates,
              // but it's kept as it might be used elsewhere or for future re-introduction.
              // For now, it will just return an empty array or null.
              // setCertificates(data || []); // This line is removed as 'certificates' state is gone
            } catch (error) {
              console.error('Error fetching certificates:', error);
            }
          };

          const fetchDoctorData = async () => {
            if (!user?.id) {
              setIsLoading(false);
              return;
            }
            
            setIsLoading(true);
            try {
              // Get user's email from auth
              const { data: { user: authUser } } = await supabase.auth.getUser();
              
              if (!authUser) {
                throw new Error('User not authenticated');
              }
              
              // Get profile data
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
                office_no: data?.office_no || '',
                gcash_qr_urls: Array.isArray(data?.gcash_qr_urls) ? data.gcash_qr_urls : [],
                gcash_qr_default_index: Number.isInteger(data?.gcash_qr_default_index) ? data.gcash_qr_default_index : 0
              });
              
              // Fetch certificates
              await fetchUserCertificates();
              
            } catch (error) {
              console.error('Error fetching doctor data:', error);
              toast.error('Failed to load profile data');
            } finally {
              setIsLoading(false);
            }
          };

          // QR helpers
          const handleQrFileChange = (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const allowedMimeTypes = [
              'image/png',
              'image/jpeg',
              'image/jpg',
              'image/webp',
              'image/gif',
              'image/svg+xml'
            ];
            const allowedExtensions = ['png','jpg','jpeg','webp','gif','svg'];
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            const typeOk = allowedMimeTypes.includes(file.type);
            const extOk = allowedExtensions.includes(ext);
            if (!typeOk && !extOk) {
              toast.error('Unsupported file. Use PNG, JPG, JPEG, WEBP, GIF, or SVG.');
              return;
            }
            if (file.size > 10 * 1024 * 1024) {
              toast.error('QR image must be less than 10MB');
              return;
            }
            setQrFile(file);
          };

          const uploadDoctorQr = async () => {
            if (!qrFile) {
              toast.error('Please select a QR image first');
              return;
            }
            if (!user?.id) return;
            setIsUploadingQr(true);
            try {
              const fileExt = qrFile.name.split('.').pop();
              const fileName = `${user.id}/qr-${Date.now()}.${fileExt}`;
              const { error: uploadError } = await supabase.storage
                .from(DOCTOR_GCASH_QR_BUCKET)
                .upload(fileName, qrFile, { cacheControl: '3600', upsert: false });
              if (uploadError) throw uploadError;

              const { data: { publicUrl } } = supabase.storage
                .from(DOCTOR_GCASH_QR_BUCKET)
                .getPublicUrl(fileName);

              const nextUrls = [...(profile.gcash_qr_urls || []), publicUrl];
              const isFirst = (profile.gcash_qr_urls || []).length === 0;
              const { error: updateError } = await supabase
                .from('profiles')
                .update({
                  gcash_qr_urls: nextUrls,
                  gcash_qr_default_index: isFirst ? 0 : profile.gcash_qr_default_index,
                  updated_at: new Date().toISOString()
                })
                .eq('id', user.id);
              if (updateError) throw updateError;

              setProfile(prev => ({ ...prev, gcash_qr_urls: nextUrls, gcash_qr_default_index: isFirst ? 0 : prev.gcash_qr_default_index }));
              setQrFile(null);
              toast.success('QR uploaded');
            } catch (err) {
              console.error('Error uploading doctor QR:', err);
              toast.error(`Failed to upload QR: ${err.message || 'Unknown error'}`);
            } finally {
              setIsUploadingQr(false);
            }
          };

          const setDefaultDoctorQr = async (index) => {
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ gcash_qr_default_index: index, updated_at: new Date().toISOString() })
                .eq('id', user.id);
              if (error) throw error;
              setProfile(prev => ({ ...prev, gcash_qr_default_index: index }));
              toast.success('Default QR updated');
            } catch (err) {
              console.error('Error setting default QR:', err);
              toast.error('Failed to set default QR');
            }
          };

          const removeDoctorQr = async (index) => {
            try {
              const urls = [...(profile.gcash_qr_urls || [])];
              const toRemove = urls[index];
              const nextUrls = urls.filter((_, i) => i !== index);
              const nextDefault = Math.min(profile.gcash_qr_default_index, Math.max(0, nextUrls.length - 1));

              // Try to delete object from storage (best-effort)
              try {
                const parts = toRemove.split('/');
                const pathStart = parts.findIndex(p => p === DOCTOR_GCASH_QR_BUCKET) + 1;
                const storagePath = parts.slice(pathStart).join('/');
                if (storagePath) {
                  await supabase.storage.from(DOCTOR_GCASH_QR_BUCKET).remove([storagePath]);
                }
              } catch (e) {
                console.warn('Could not remove storage object:', e.message);
              }

              const { error } = await supabase
                .from('profiles')
                .update({ gcash_qr_urls: nextUrls, gcash_qr_default_index: nextDefault, updated_at: new Date().toISOString() })
                .eq('id', user.id);
              if (error) throw error;

              setProfile(prev => ({ ...prev, gcash_qr_urls: nextUrls, gcash_qr_default_index: nextDefault }));
              toast.success('QR removed');
            } catch (err) {
              console.error('Error removing QR:', err);
              toast.error('Failed to remove QR');
            }
          };

          const handleProfileChange = (e) => {
            const { id, value } = e.target;
                  setProfile(prev => ({
                    ...prev,
              [id]: value
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

            setIsUploadingCertificate(true);
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
              fetchDoctorData();
              
            } catch (error) {
              console.error('Error uploading certificate:', error);
              toast.error(`Failed to upload certificate: ${error.message}`);
            } finally {
              setIsUploadingCertificate(false);
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
              fetchDoctorData();
              
            } catch (error) {
              console.error('Error removing certificate:', error);
              toast.error(`Failed to remove certificate: ${error.message}`);
            }
          };

          const initializeProfilePicturesBucket = async () => {
            try {
              const { data: buckets, error: listError } = await supabase.storage.listBuckets();
              
              if (listError) {
                return false;
              } else {
                const profilePicturesBucket = buckets?.find(b => b.name === PROFILE_PICTURES_BUCKET);
                
                if (profilePicturesBucket) {
                  if (!profilePicturesBucket.public) {
                    try {
                      await supabase.storage.updateBucket(PROFILE_PICTURES_BUCKET, {
                        public: true,
                        fileSizeLimit: 10 * 1024 * 1024
                      });
                    } catch (updateError) {
                      // Continue anyway
                    }
                  }
                  return true;
                }
              }
              
              try {
                const { data: createData, error: createError } = await supabase.storage.createBucket(PROFILE_PICTURES_BUCKET, {
                  public: true,
                  fileSizeLimit: 10 * 1024 * 1024
                });
                
                if (createError) {
                  try {
                    const { data: testData, error: testError } = await supabase.storage
                      .from(PROFILE_PICTURES_BUCKET)
                      .list('', { limit: 1 });
                    
                    return !testError;
                  } catch (testError) {
                    return false;
                  }
                }
                
                return true;
                
              } catch (createException) {
                try {
                  const { data: testData, error: testError } = await supabase.storage
                    .from(PROFILE_PICTURES_BUCKET)
                    .list('', { limit: 1 });
                  
                  return !testError;
                } catch (testError) {
                  return false;
                }
              }
              
            } catch (error) {
              return false;
            }
          };

          const handleProfilePictureChange = (e) => {
            const file = e.target.files[0];
            if (file) {
              if (!file.type.startsWith('image/')) {
                toast.error('Please select an image file');
                return;
              }
              
              if (file.size > 5 * 1024 * 1024) {
                toast.error('File size must be less than 5MB');
                return;
              }
              
              setProfilePictureFile(file);
            }
          };

          const handleProfilePictureUpload = async () => {
            if (!profilePictureFile || !user) {
              toast.error('Please select a file to upload');
              return;
            }

            try {
              setIsUploadingProfilePicture(true);
              
              const bucketInitialized = await initializeProfilePicturesBucket();
              if (!bucketInitialized) {
                // Continue with upload anyway
              }
              
              const fileExtension = profilePictureFile.name.split('.').pop();
              const fileName = `${user.id}_profile.${fileExtension}`;
              
              const { error: uploadError } = await supabase.storage
                .from(PROFILE_PICTURES_BUCKET)
                .upload(fileName, profilePictureFile, {
                  cacheControl: '3600',
                  upsert: true
                });
              
              if (uploadError) {
                throw uploadError;
              }
              
              const { data: publicUrlData } = supabase.storage
                .from(PROFILE_PICTURES_BUCKET)
                .getPublicUrl(fileName);
              
              if (!publicUrlData?.publicUrl) {
                throw new Error('Failed to get public URL for profile picture');
              }
              
              const { error: updateError } = await supabase
                .from('profiles')
                .update({
                  profile_picture_url: publicUrlData.publicUrl,
                  updated_at: new Date().toISOString()
                })
                .eq('id', user.id);
              
              if (updateError) {
                throw updateError;
              }
              
              // Log profile picture upload
              try {
                await logProfilePictureUpdate(user, 'upload');
              } catch (auditError) {
                console.error('Error logging profile picture upload:', auditError);
              }
              
              setProfilePictureFile(null);
              
              toast.success('Profile picture updated successfully! Refreshing page...');
              
              setTimeout(() => {
                window.location.reload();
              }, 1500);
              
            } catch (error) {
              console.error('Error uploading profile picture:', error);
              toast.error(`Failed to upload profile picture: ${error.message}`);
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
                if (file.size <= 5 * 1024 * 1024) {
                  setProfilePictureFile(file);
                } else {
                  toast.error('File size must be less than 5MB');
                }
              } else {
                toast.error('Please select an image file');
              }
            }
          };

          const handleRemoveProfilePicture = async () => {
            try {
              await supabase
                .from('profiles')
                .update({
                  profile_picture_url: null,
                  updated_at: new Date().toISOString()
                })
                .eq('id', user.id);
              
              // Log profile picture removal
              try {
                await logProfilePictureUpdate(user, 'remove');
              } catch (auditError) {
                console.error('Error logging profile picture removal:', auditError);
              }
              
              toast.success('Profile picture removed successfully!');
              window.location.reload();
            } catch (error) {
              console.error('Error removing profile picture:', error);
              toast.error('Failed to remove profile picture');
            }
          };

          const handlePasswordChange = (e) => {
            const { id, value } = e.target;
            setPasswordData(prev => ({
              ...prev,
              [id]: value
            }));
            
            // Clear errors when user starts typing
            if (passwordErrors[id]) {
              setPasswordErrors(prev => ({
                ...prev,
                [id]: ''
              }));
            }
          };

  const handleScheduleChange = (branch, day, field, value) => {
    setSchedule(prev => ({
      ...prev,
      [branch]: {
        ...prev[branch],
        [day]: {
          ...prev[branch][day],
          [field]: value
        }
      }
    }));
  };

  // New function to add specific date schedule
  const addSpecificDateSchedule = () => {
    if (!selectedDateForSchedule || !selectedBranchForSchedule) {
      toast.error('Please select both date and branch');
      return;
    }

    const date = new Date(selectedDateForSchedule);
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Add to unavailable dates as a special "available" entry
    const newScheduleEntry = {
      id: `schedule_${Date.now()}`,
      date: selectedDateForSchedule,
      branch: selectedBranchForSchedule,
      startTime: selectedStartTime,
      endTime: selectedEndTime,
      dayOfWeek: dayOfWeek,
      type: 'specific_schedule' // Different from unavailable dates
    };

    setUnavailableDates(prev => {
      // Remove any existing schedule for this date/branch
      const filtered = prev.filter(entry => 
        !(entry.date === selectedDateForSchedule && 
          entry.branch === selectedBranchForSchedule && 
          entry.type === 'specific_schedule')
      );
      return [...filtered, newScheduleEntry];
    });

    setShowScheduleModal(false);
    toast.success(`Schedule added for ${selectedDateForSchedule} at ${selectedBranchForSchedule} branch`);
  };

  // Function to remove specific date schedule
  const removeSpecificDateSchedule = (entryId) => {
    setUnavailableDates(prev => prev.filter(entry => entry.id !== entryId));
  };

          const handleSpecializationChange = (field, value) => {
            if (field === 'primary') {
              setSpecialization(prev => ({
                ...prev,
                primary: value
              }));
            } else {
              setSpecialization(prev => ({
                ...prev,
                procedures: {
                  ...prev.procedures,
                  [field]: value
                }
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
      
      // Log profile update
      try {
        await logProfileUpdate(user, {}, processedData);
      } catch (auditError) {
        console.error('Error logging profile update audit event:', auditError);
      }
      
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
            
            // Current password validation (required for doctors)
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
              
              // Log password change
              try {
                await logPasswordChange(user);
              } catch (auditError) {
                console.error('Error logging password change:', auditError);
              }
              
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
              console.error('Error changing password:', error);
              toast.error('Failed to change password');
              setIsPasswordLoading(false);
            }
          };

          const saveSchedule = async () => {
            return saveScheduleAndAvailability();
          };

          const saveSpecialization = async () => {
            try {
              const { error } = await supabase
                .from('profiles')
                .update({
                  specialization: specialization,
                  updated_at: new Date().toISOString()
                })
                .eq('id', user.id);
              
              if (error) throw error;
              
              // Log audit event for specialization update
              try {
                await logSettingsUpdate('doctor_specialization', {
                  specialization: specialization,
                  doctor_id: user.id
                });
              } catch (auditError) {
                console.error('Error logging specialization update audit event:', auditError);
                // Continue even if audit logging fails
              }
              
              toast.success('Specialization updated successfully!');
            } catch (error) {
              console.error('Error updating specialization:', error);
              toast.error('Failed to update specialization');
            }
          };

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(time);
      }
    }
    return options;
  };

  const formatTimeToAMPM = (timeString) => {
    if (!timeString) return '';
    
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Ensure schedule has proper structure
  const ensureScheduleStructure = (scheduleData) => {
    const defaultSchedule = {
      cabugao: {
        monday: { enabled: true, start: '08:00', end: '12:00' },
        tuesday: { enabled: true, start: '08:00', end: '12:00' },
        wednesday: { enabled: true, start: '08:00', end: '12:00' },
        thursday: { enabled: true, start: '08:00', end: '12:00' },
        friday: { enabled: true, start: '08:00', end: '12:00' },
        saturday: { enabled: true, start: '08:00', end: '17:00' },
        sunday: { enabled: false, start: '08:00', end: '17:00' },
      },
      sanjuan: {
        monday: { enabled: true, start: '13:00', end: '17:00' },
        tuesday: { enabled: true, start: '13:00', end: '17:00' },
        wednesday: { enabled: true, start: '13:00', end: '17:00' },
        thursday: { enabled: true, start: '13:00', end: '17:00' },
        friday: { enabled: true, start: '13:00', end: '17:00' },
        saturday: { enabled: false, start: '08:00', end: '17:00' },
        sunday: { enabled: true, start: '08:00', end: '17:00' },
      }
    };

    if (!scheduleData || typeof scheduleData !== 'object') {
      return defaultSchedule;
    }

    // Merge with defaults to ensure all branches and days exist
    const mergedSchedule = { ...defaultSchedule };
    
    // Update with existing data if it exists
    Object.keys(defaultSchedule).forEach(branch => {
      if (scheduleData[branch] && typeof scheduleData[branch] === 'object') {
        Object.keys(defaultSchedule[branch]).forEach(day => {
          if (scheduleData[branch][day] && typeof scheduleData[branch][day] === 'object') {
            mergedSchedule[branch][day] = {
              ...defaultSchedule[branch][day],
              ...scheduleData[branch][day]
            };
          }
        });
      }
    });

    return mergedSchedule;
  };

  // Enhanced schedule management functions
  const markDateUnavailable = (date, branch, timeSlots = null) => {
    const dateKey = `${date}_${branch}`;
    const newUnavailableEntry = {
      date,
      branch,
      timeSlots, // null means entire day, array means specific time slots
      id: Date.now().toString()
    };

    setUnavailableDates(prev => {
      const filtered = prev.filter(entry => `${entry.date}_${entry.branch}` !== dateKey);
      return [...filtered, newUnavailableEntry];
    });
  };

  const removeUnavailableDate = (entryId) => {
    setUnavailableDates(prev => prev.filter(entry => entry.id !== entryId));
  };

  const getUnavailableTimesForDate = (date, branch) => {
    const entry = unavailableDates.find(
      entry => entry.date === date && entry.branch === branch
    );
    return entry?.timeSlots || [];
  };

  const isDateFullyUnavailable = (date, branch) => {
    const entry = unavailableDates.find(
      entry => entry.date === date && entry.branch === branch
    );
    return entry && entry.timeSlots === null;
  };

  const generateTimeSlots = (startTime, endTime) => {
    const slots = [];
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    
    while (start < end) {
      const timeString = start.toTimeString().slice(0, 5);
      slots.push(timeString);
      start.setMinutes(start.getMinutes() + 30);
    }
    return slots;
  };

  const saveScheduleAndAvailability = async () => {
    try {
      setIsLoading(true);
      
      // First, try to check if the columns exist by doing a simple select
      const { data: checkData, error: checkError } = await supabase
        .from('profiles')
        .select('id, schedule, unavailable_dates')
        .eq('id', user.id)
        .limit(1);
      
      if (checkError) {
        console.warn('Schedule columns may not exist, using fallback storage:', checkError);
        
        // Fallback: Store in a separate table or use JSON in existing column
        const { error: fallbackError } = await supabase
          .from('profiles')
          .update({
            // Store schedule data in existing notes or create a custom field
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        if (fallbackError) throw fallbackError;
        
        // Store schedule in localStorage as backup
        localStorage.setItem(`doctor_schedule_${user.id}`, JSON.stringify({
          schedule: schedule,
          unavailable_dates: unavailableDates,
          updated_at: new Date().toISOString()
        }));
        
        toast.success('Schedule saved locally. Database columns will be added in next update.');
        setSuccessMessage('Schedule saved successfully (local storage)!');
        setTimeout(() => setSuccessMessage(''), 3000);
        return;
      }
      
      // If columns exist, proceed with normal update
      const { error } = await supabase
        .from('profiles')
        .update({
          schedule: schedule,
          unavailable_dates: unavailableDates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) {
        // If update fails, might be due to column types, try storing as text
        console.warn('Direct JSON storage failed, trying text storage:', error);
        
        const { error: textError } = await supabase
          .from('profiles')
          .update({
            schedule: JSON.stringify(schedule),
            unavailable_dates: JSON.stringify(unavailableDates),
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
          
        if (textError) throw textError;
      }
      
      // Log audit event for schedule update
      try {
        await logSettingsUpdate('doctor_schedule', {
          schedule: schedule,
          unavailable_dates: unavailableDates,
          doctor_id: user.id
        });
      } catch (auditError) {
        console.error('Error logging schedule update audit event:', auditError);
        // Continue even if audit logging fails
      }
      
      setSuccessMessage('Schedule and availability updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (error) {
      console.error('Error saving schedule:', error);
      
      // Final fallback: Store locally and show helpful message
      try {
        localStorage.setItem(`doctor_schedule_${user.id}`, JSON.stringify({
          schedule: schedule,
          unavailable_dates: unavailableDates,
          updated_at: new Date().toISOString()
        }));
        
        toast.error('Database schema issue detected. Schedule saved locally. Please contact administrator to add schedule columns to database.');
        setSuccessMessage('Schedule saved locally due to database schema issue');
        setTimeout(() => setSuccessMessage(''), 5000);
      } catch (localError) {
        toast.error('Failed to save schedule: ' + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

          const refreshAuth = async () => {
            try {
              await supabase.auth.refreshSession();
              toast.success('Session refreshed successfully');
            } catch (error) {
              console.error('Error refreshing session:', error);
              toast.error('Failed to refresh session');
            }
          };

          if (isLoading) {
            return <LoadingSpinner />;
          }
          
          return (
            <div className="space-y-6">
              <div className="bg-white rounded-md shadow border border-blue-100 w-full p-6 mt-0">
                <div className="max-w-6xl mx-auto">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h1 className="text-3xl font-bold text-primary-700 mb-2">My Profile</h1>
                      <p className="text-gray-600 text-sm">Manage your personal information and account settings</p>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={refreshAuth}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-sm font-medium"
                      >
                        <FiRefreshCw className="inline-block mr-2" /> Refresh Session
                      </button>
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 text-sm font-medium"
                      >
                        {isEditing ? 'Cancel' : 'Edit Profile'}
                      </button>
                    </div>
                  </div>
                  <hr className="mb-6 border-blue-100" />
                </div>
                
                <div className="flex md:flex-row flex-col items-start md:space-x-4 space-y-4 md:space-y-0">
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
                          <span>My Profile</span>
                        </button>
                        
                        <button 
                          onClick={() => setActiveTab('password')}
                          className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                            activeTab === 'password' 
                              ? 'bg-primary-100 text-primary-700' 
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <FiLock className="mr-3 h-5 w-5" />
                          <span>Change Password</span>
                        </button>
                        
                        <button 
                          onClick={() => {
                            console.log('Schedule tab clicked');
                            setActiveTab('schedule');
                          }}
                          className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                            activeTab === 'schedule' 
                              ? 'bg-primary-100 text-primary-700' 
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <FiCalendar className="mr-3 h-5 w-5" />
                          <span>Working Schedule</span>
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
                        </div>
                        
                        <hr className="mb-6 border-blue-100" />
                        
                        {/* Profile Picture Section */}
                        <div className="mb-8 flex justify-center">
                          <div className="flex flex-col items-center space-y-4">
                            {/* Profile Picture Display */}
                            <div className="relative">
                              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-200 shadow-lg">
                                {profile.profile_picture_url ? (
                                  <img
                                    key={profile.profile_picture_url}
                                    src={`${profile.profile_picture_url}?t=${Date.now()}`}
                                    alt="Profile Picture"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className={`w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center ${profile.profile_picture_url ? 'hidden' : ''}`}>
                                  <FiUser className="w-16 h-16 text-white" />
                                </div>
                              </div>
                              
                              {/* Edit Button Overlay - Only show when editing */}
                              {isEditing && (
                                <button
                                  onClick={() => document.getElementById('doctor-profile-picture-input').click()}
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
                                  onClick={() => document.getElementById('doctor-profile-picture-input').click()}
                                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors duration-200 text-sm flex items-center gap-2"
                                >
                                  <FiCamera className="w-4 h-4" />
                                  Change Profile Picture
                                </button>
                                
                                {profile.profile_picture_url && (
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
                                    id="doctor-profile-picture-input"
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
                                        onClick={() => document.getElementById('doctor-profile-picture-input').click()}
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
                                  <div className="mt-1 text-gray-900 font-semibold">{profile.first_name}</div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Middle Name</label>
                                  <div className="mt-1 text-gray-900 font-semibold">{profile.middle_name}</div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                                  <div className="mt-1 text-gray-900 font-semibold">{profile.last_name}</div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Email</label>
                                  <div className="mt-1 text-gray-900 font-semibold">{profile.email}</div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                                  <div className="mt-1 text-gray-900 font-semibold">{profile.phone || 'Not provided'}</div>
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
                                  <div className="mt-1 text-gray-900 font-semibold">{profile.street}</div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">Barangay</label>
                                  <div className="mt-1 text-gray-900 font-semibold">{profile.barangay}</div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">City/Municipality</label>
                                  <div className="mt-1 text-gray-900 font-semibold">{profile.city}</div>
                                </div>
                                                        <div>
                          <label className="block text-sm font-medium text-gray-700">Province</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profile.province}</div>
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
                          <div className="mt-1 text-gray-900 font-semibold">{profile.emergency_contact_name || 'Not provided'}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
                          <div className="mt-1 text-gray-900 font-semibold">{profile.emergency_contact_phone || 'Not provided'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                          <form onSubmit={(e) => { e.preventDefault(); saveProfile(); }} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                              {/* Name fields */}
                              <div>
                                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">First Name</label>
                                <input
                                  type="text"
                                  id="first_name"
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
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                                  value={profile.last_name}
                                  onChange={handleProfileChange}
                                />
                              </div>
                              <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                                <input
                                  type="email"
                                  id="email"
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                                  value={profile.email}
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
                                  value={profile.phone}
                                  onChange={handleProfileChange}
                                />
                              </div>
                                  <div>
                                <label htmlFor="birthday" className="block text-sm font-medium text-gray-700">Birthday</label>
                                <DatePicker
                                  selected={profile.birthday ? new Date(profile.birthday) : null}
                                  onChange={(date) => {
                                    const formattedDate = date ? date.toISOString().split('T')[0] : '';
                                    setProfile(prev => ({
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
                                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                                      value={profile.province}
                                      onChange={handleProfileChange}
                                    />
                                  </div>
                                </div>
                      
                              <div>
                        <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2 mb-4">Emergency Contact</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label htmlFor="emergency_contact_name" className="block text-sm font-medium text-gray-700">
                              Contact Name
                            </label>
                                <input 
                              type="text"
                              id="emergency_contact_name"
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                              value={profile.emergency_contact_name || ''}
                                  onChange={handleProfileChange}
                                />
                              </div>
                          
                              <div>
                            <label htmlFor="emergency_contact_phone" className="block text-sm font-medium text-gray-700">
                              Contact Phone
                            </label>
                            <input
                              type="tel"
                              id="emergency_contact_phone"
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                              value={profile.emergency_contact_phone || ''}
                                  onChange={handleProfileChange}
                            />
                              </div>
                        </div>
                      </div>

                              <div className="col-span-1 md:col-span-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                  {/* Certificate / ID */}
                                  <div className="border rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Certificate / ID</h4>
                                    <div className="flex flex-col gap-4">
                                      <div>
                                        <input
                                          type="file"
                                          id="certificate"
                                          accept="image/*"
                                          className="block w-full md:w-auto text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-primary-700 hover:file:bg-blue-100"
                                          onChange={handleCertificateChange}
                                        />
                                        {certificateFile && (
                                          <button
                                            onClick={handleCertificateUpload}
                                            disabled={isUploadingCertificate}
                                            className="mt-2 px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm disabled:bg-primary-300 disabled:cursor-not-allowed"
                                          >
                                            {isUploadingCertificate ? 'Uploading...' : 'Upload'}
                                          </button>
                                        )}
                                        <p className="mt-2 text-xs text-gray-500">Supported: JPG, PNG, WEBP, GIF (max 10MB)</p>
                                      </div>
                                      <div>
                                        {(certificateFile || profile.certificate_url) ? (
                                          <div>
                                            <div className="w-full h-36 border rounded-md overflow-hidden bg-white flex items-center justify-center">
                                              <img
                                                src={certificateFile ? URL.createObjectURL(certificateFile) : profile.certificate_url}
                                                alt="Certificate"
                                                className="object-contain w-full h-full"
                                              />
                                            </div>
                                            {profile.certificate_url && (
                                              <button
                                                onClick={handleRemoveCertificate}
                                                className="mt-2 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                                              >
                                                <FiTrash2 className="inline mr-1" /> Remove
                                              </button>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="w-full h-36 border border-dashed rounded-md text-xs text-gray-500 flex items-center justify-center">
                                            Preview will appear here
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {/* Doctor GCash QR */}
                                  <div className="border rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-gray-800 mb-2">QR Code</h4>
                                    <div className="flex flex-col gap-4">
                                      <div>
                                        <input
                                          type="file"
                                          id="doctor-qr-upload"
                                          accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.svg"
                                          className="block w-full md:w-auto text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-primary-700 hover:file:bg-blue-100"
                                          onChange={handleQrFileChange}
                                        />
                                        {qrFile && (
                                          <button
                                            onClick={uploadDoctorQr}
                                            disabled={isUploadingQr}
                                            className="mt-2 px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm disabled:bg-primary-300 disabled:cursor-not-allowed"
                                          >
                                            {isUploadingQr ? 'Uploading...' : 'Upload QR'}
                                          </button>
                                        )}
                                        <p className="mt-2 text-xs text-gray-500">Supported: PNG, JPG, JPEG, WEBP, GIF, SVG (max 10MB)</p>
                                      </div>
                                      <div>
                                        {profile.gcash_qr_urls && profile.gcash_qr_urls.length > 0 ? (
                                          profile.gcash_qr_urls.length === 1 ? (
                                            <div>
                                              <div className="w-full h-36 border rounded-md overflow-hidden bg-white flex items-center justify-center">
                                                <img src={`${profile.gcash_qr_urls[0]}`} alt="QR" className="object-contain w-full h-full" />
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => removeDoctorQr(0)}
                                                className="mt-2 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                                              >
                                                Remove
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="grid grid-cols-2 gap-3">
                                              {profile.gcash_qr_urls.map((url, idx) => (
                                                <div key={idx} className={`border rounded-md p-2 ${idx === profile.gcash_qr_default_index ? 'border-green-400' : 'border-gray-200'}`}>
                                                  <div className="w-full aspect-square bg-white border rounded flex items-center justify-center overflow-hidden">
                                                    <img src={`${url}`} alt={`QR ${idx + 1}`} className="object-contain w-full h-full" />
                                                  </div>
                                                  <div className="mt-2 flex flex-col items-center">
                                                    <span className={`text-xs ${idx === profile.gcash_qr_default_index ? 'text-green-700 font-semibold' : 'text-gray-600'}`}>
                                                      {idx === profile.gcash_qr_default_index ? 'Default' : 'Secondary'}
                                                    </span>
                                                    {idx !== profile.gcash_qr_default_index && (
                                                      <button
                                                        type="button"
                                                        onClick={() => setDefaultDoctorQr(idx)}
                                                        className="mt-1 px-2 py-1 text-xs bg-blue-600 text-white rounded"
                                                      >
                                                        Set Default
                                                      </button>
                                                    )}
                                                    <button
                                                      type="button"
                                                      onClick={() => removeDoctorQr(idx)}
                                                      className="mt-2 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                                                    >
                                                      Remove
                                                    </button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )
                                        ) : (
                                          <div className="w-full h-36 border border-dashed rounded-md text-xs text-gray-500 flex items-center justify-center">
                                            No QR uploaded yet
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            
                            <div className="flex justify-end">
                              <button
                                type="submit"
                                disabled={isSaving}
                                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300 disabled:cursor-not-allowed"
                              >
                                {isSaving ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <FiSave className="mr-2 h-4 w-4" />
                                    Save Changes
                                  </>
                                )}
                              </button>
                            </div>
                          </form>
                        )}
                        </div>
                      )}
                      
                      {activeTab === 'password' && (
                        <div>
                          <h2 className="text-lg font-medium text-gray-900 mb-4">Change Password</h2>
                          
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
                          
                          <div className="space-y-4">
                            <div>
                              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">Current Password</label>
                              <div className="relative">
                                <input 
                                  type={showCurrentPassword ? "text" : "password"}
                                  id="currentPassword" 
                                  name="currentPassword"
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 pr-10"
                                  value={passwordData.currentPassword}
                                  onChange={handlePasswordChange}
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
                              {passwordErrors.currentPassword && (
                                <p className="mt-1 text-sm text-red-600">{passwordErrors.currentPassword}</p>
                              )}
                            </div>
                            <div>
                              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">New Password</label>
                              <div className="relative">
                                <input 
                                  type={showNewPassword ? "text" : "password"}
                                  id="newPassword" 
                                  name="newPassword"
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 pr-10"
                                  value={passwordData.newPassword}
                                  onChange={handlePasswordChange}
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
                              {passwordErrors.newPassword && (
                                <p className="mt-1 text-sm text-red-600">{passwordErrors.newPassword}</p>
                              )}
                            </div>
                            <div>
                              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                              <div className="relative">
                                <input 
                                  type={showConfirmPassword ? "text" : "password"}
                                  id="confirmPassword" 
                                  name="confirmPassword"
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 pr-10"
                                  value={passwordData.confirmPassword}
                                  onChange={handlePasswordChange}
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
                              {passwordErrors.confirmPassword && (
                                <p className="mt-1 text-sm text-red-600">{passwordErrors.confirmPassword}</p>
                              )}
                            </div>
                              <button
                                onClick={changePassword}
                                disabled={isPasswordLoading}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300 disabled:cursor-not-allowed"
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
                      
                      {activeTab === 'schedule' && (
                        <div>
                          <div className="mb-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">Working Schedule & Availability</h2>
                            <p className="text-gray-600">Manage your working hours and mark specific dates/times as unavailable.</p>
                          </div>

                          {/* Schedule Management Overview */}
                          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start">
                              <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="ml-3">
                                <h3 className="text-sm font-medium text-blue-800">How Schedule Management Works</h3>
                                <div className="mt-2 text-sm text-blue-700">
                                  <ol className="list-decimal list-inside space-y-1">
                                    <li><strong>Weekly Schedule:</strong> Set your regular working hours for each branch</li>
                                    <li><strong>Specific Date Schedules:</strong> Override weekly schedule for special dates (holidays, events)</li>
                                    <li><strong>Unavailable Dates:</strong> Block specific dates or times when you can't work</li>
                                  </ol>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Branch Tabs */}
                          <div className="mb-6">
                            <div className="border-b border-gray-200">
                              <nav className="-mb-px flex space-x-8">
                                {['cabugao', 'sanjuan'].map((branch) => (
                                  <button
                                    key={branch}
                                    onClick={() => setSelectedBranchForSchedule(branch)}
                                    className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                                      selectedBranchForSchedule === branch
                                        ? 'border-primary-500 text-primary-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                  >
                                    🏥 {branch} Branch
                                  </button>
                                ))}
                              </nav>
                            </div>
                          </div>

                          {/* Weekly Schedule for Selected Branch */}
                          <div className="mb-8">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="text-lg font-medium text-gray-900">📅 Weekly Schedule</h3>
                              <div className="text-xs text-gray-500 bg-green-100 px-2 py-1 rounded">
                                💡 This is your regular working schedule
                              </div>
                            </div>

                            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(schedule[selectedBranchForSchedule] || {}).map(([day, daySchedule]) => (
                                  <div key={day} className="border border-gray-200 rounded-lg p-4 bg-white">
                                    <div className="flex items-center mb-3">
                                      <input 
                                        type="checkbox" 
                                        id={`${selectedBranchForSchedule}-${day}-enabled`}
                                        checked={daySchedule.enabled}
                                        onChange={(e) => handleScheduleChange(selectedBranchForSchedule, day, 'enabled', e.target.checked)}
                                        className="mr-3 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                      />
                                      <label htmlFor={`${selectedBranchForSchedule}-${day}-enabled`} className="text-sm font-medium text-gray-900 capitalize">
                                        {day}
                                      </label>
                                    </div>
                                    {daySchedule.enabled && (
                                      <div className="space-y-3">
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
                                          <select 
                                            value={daySchedule.start}
                                            onChange={(e) => handleScheduleChange(selectedBranchForSchedule, day, 'start', e.target.value)}
                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                                          >
                                            {generateTimeOptions().map(time => (
                                              <option key={time} value={time}>{formatTimeToAMPM(time)}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
                                          <select 
                                            value={daySchedule.end}
                                            onChange={(e) => handleScheduleChange(selectedBranchForSchedule, day, 'end', e.target.value)}
                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                                          >
                                            {generateTimeOptions().map(time => (
                                              <option key={time} value={time}>{formatTimeToAMPM(time)}</option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Special Dates Management */}
                          <div className="mb-8">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="text-lg font-medium text-gray-900">📅 Special Dates Management</h3>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => setShowScheduleModal(true)}
                                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                  Add Special Schedule
                                </button>
                                <button
                                  onClick={() => setShowDatePicker(true)}
                                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                  Mark Unavailable
                                </button>
                              </div>
                            </div>

                            {/* Special Date Schedules */}
                            <div className="mb-6">
                              <h4 className="text-md font-medium text-gray-900 mb-3">✅ Special Working Schedules</h4>
                              {unavailableDates.filter(entry => entry.type === 'specific_schedule').length > 0 ? (
                                <div className="space-y-3">
                                  {unavailableDates.filter(entry => entry.type === 'specific_schedule').map((entry) => (
                                    <div key={entry.id} className="border border-green-200 rounded-lg p-4 bg-green-50">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <div className="flex items-center space-x-3">
                                            <span className="font-medium text-green-900">
                                              📅 {new Date(entry.date).toLocaleDateString('en-US', { 
                                                weekday: 'long', 
                                                year: 'numeric', 
                                                month: 'long', 
                                                day: 'numeric' 
                                              })}
                                            </span>
                                            <span className="px-2 py-1 bg-green-200 text-green-800 text-xs rounded-full font-medium">
                                              {entry.branch.toUpperCase()} BRANCH
                                            </span>
                                          </div>
                                          <div className="mt-2">
                                            <span className="text-sm text-green-700 font-medium">
                                              ⏰ Working Hours: {formatTimeToAMPM(entry.startTime)} - {formatTimeToAMPM(entry.endTime)}
                                            </span>
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => removeSpecificDateSchedule(entry.id)}
                                          className="text-green-600 hover:text-green-800 p-1"
                                          title="Remove special schedule"
                                        >
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                                  <p className="text-sm text-gray-500">No special schedules set. Use "Add Special Schedule" to set custom hours for specific dates.</p>
                                </div>
                              )}
                            </div>

                            {/* Unavailable Dates */}
                            <div>
                              <h4 className="text-md font-medium text-gray-900 mb-3">🚫 Unavailable Dates</h4>
                              {unavailableDates.filter(entry => entry.type !== 'specific_schedule').length > 0 ? (
                                <div className="space-y-3">
                                  {unavailableDates.filter(entry => entry.type !== 'specific_schedule').map((entry) => (
                                    <div key={entry.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <div className="flex items-center space-x-3">
                                            <span className="font-medium text-red-900">
                                              📅 {new Date(entry.date).toLocaleDateString('en-US', { 
                                                weekday: 'long', 
                                                year: 'numeric', 
                                                month: 'long', 
                                                day: 'numeric' 
                                              })}
                                            </span>
                                            <span className="px-2 py-1 bg-red-200 text-red-800 text-xs rounded-full font-medium">
                                              {entry.branch.toUpperCase()} BRANCH
                                            </span>
                                          </div>
                                          <div className="mt-2">
                                            {entry.timeSlots === null ? (
                                              <span className="text-sm text-red-700 font-medium">🔴 Entire day unavailable</span>
                                            ) : (
                                              <div>
                                                <span className="text-sm text-red-700 font-medium">⏰ Unavailable times:</span>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                  {entry.timeSlots.map((time, index) => (
                                                    <span key={index} className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded border">
                                                      {formatTimeToAMPM(time)}
                                                    </span>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => removeUnavailableDate(entry.id)}
                                          className="text-red-600 hover:text-red-800 p-1"
                                          title="Remove unavailable date"
                                        >
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                                  <p className="text-sm text-gray-500">No unavailable dates set. Use "Mark Unavailable" to block specific dates.</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Save Button */}
                          <div className="flex justify-end">
                            <button
                              onClick={saveSchedule}
                              disabled={isLoading}
                              className="inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300"
                            >
                              {isLoading ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Save Schedule & Availability
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modal for Adding Specific Date Schedule */}
                {showScheduleModal && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Add Specific Date Schedule</h3>
                      
                      <div className="space-y-4">
                        {/* Branch Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Select Branch</label>
                          <select
                            value={selectedBranchForSchedule}
                            onChange={(e) => setSelectedBranchForSchedule(e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          >
                            <option value="cabugao">Cabugao Branch</option>
                            <option value="sanjuan">San Juan Branch</option>
                          </select>
                        </div>

                        {/* Date Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                          <input
                            type="date"
                            value={selectedDateForSchedule}
                            onChange={(e) => setSelectedDateForSchedule(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          />
                        </div>

                        {/* Start Time */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                          <select
                            value={selectedStartTime}
                            onChange={(e) => setSelectedStartTime(e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          >
                            {generateTimeOptions().map(time => (
                              <option key={time} value={time}>{formatTimeToAMPM(time)}</option>
                            ))}
                          </select>
                        </div>

                        {/* End Time */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                          <select
                            value={selectedEndTime}
                            onChange={(e) => setSelectedEndTime(e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          >
                            {generateTimeOptions().map(time => (
                              <option key={time} value={time}>{formatTimeToAMPM(time)}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-3 mt-6">
                        <button
                          onClick={() => setShowScheduleModal(false)}
                          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={addSpecificDateSchedule}
                          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                          Add Schedule
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Date Picker Modal for Unavailable Dates */}
                {showDatePicker && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Mark Date as Unavailable</h3>
                      
                      <div className="space-y-4">
                        {/* Branch Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Select Branch</label>
                          <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          >
                            <option value="cabugao">Cabugao Branch</option>
                            <option value="sanjuan">San Juan Branch</option>
                          </select>
                        </div>

                        {/* Date Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                          <input
                            type="date"
                            value={selectedDate || ''}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                          />
                        </div>

                        {/* Unavailability Type */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Unavailability Type</label>
                          <div className="space-y-2">
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name="unavailabilityType"
                                value="full-day"
                                defaultChecked
                                className="mr-2"
                              />
                              <span className="text-sm text-gray-700">Entire day unavailable</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name="unavailabilityType"
                                value="specific-times"
                                className="mr-2"
                              />
                              <span className="text-sm text-gray-700">Specific time slots unavailable</span>
                            </label>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end space-x-3 pt-4">
                          <button
                            onClick={() => {
                              setShowDatePicker(false);
                              setSelectedDate(null);
                            }}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              if (selectedDate) {
                                const unavailabilityType = document.querySelector('input[name="unavailabilityType"]:checked').value;
                                if (unavailabilityType === 'full-day') {
                                  markDateUnavailable(selectedDate, selectedBranch, null);
                                } else {
                                  // For now, mark as full day. Time slot selection can be enhanced later
                                  markDateUnavailable(selectedDate, selectedBranch, null);
                                }
                                setShowDatePicker(false);
                                setSelectedDate(null);
                                toast.success('Date marked as unavailable');
                              } else {
                                toast.error('Please select a date');
                              }
                            }}
                            disabled={!selectedDate}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300"
                          >
                            Mark Unavailable
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>
            );
        };

        export default Settings; 