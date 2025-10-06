import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FiUser, 
  FiCalendar, 
  FiPhone, 
  FiMail, 
  FiMapPin, 
  FiAlertCircle, 
  FiFileText, 
  FiUpload, 
  FiTrash2, 
  FiDownload, 
  FiEye, 
  FiX, 
  FiRefreshCw,
  FiInfo,
  FiCamera
} from 'react-icons/fi';
import supabase from '../../config/supabaseClient';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Define bucket name as a constant to avoid typos
const BUCKET_NAME = 'patient-files';

// Helper function to detect Supabase version
const detectSupabaseVersion = () => {
  let version = 'unknown';
  try {
    if (supabase.auth.getSession) {
      version = 'v2+';
    } else if (typeof supabase.auth.session === 'function') {
      version = 'v1';
    } else if (supabase.auth.session) {
      version = 'v1 (property)';
    }
  } catch (e) {
    console.error('Error detecting Supabase version:', e);
  }
  return version;
};

const supabaseVersion = detectSupabaseVersion();
console.log('Detected Supabase version:', supabaseVersion);

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  // Profile state - like doctor profile
  const [profile, setProfile] = useState({
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
    gender: '',
    allergies: '',
    medical_conditions: '',
    medications: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    age: '',
    certificate_url: '',
    nickname: '',
    occupation: '',
    nationality: '',
    office_no: '',
    profile_picture_url: '',
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  
  // State for file preview modal
  const [filePreview, setFilePreview] = useState(null);
  const [fileData, setFileData] = useState(null); // Stores actual binary file data
  const [debugInfo, setDebugInfo] = useState('');
  const [isDiagnosticVisible, setIsDiagnosticVisible] = useState(false);
  const [certificateFile, setCertificateFile] = useState(null);
  const [isUploadingCertificate, setIsUploadingCertificate] = useState(false);
  
  // Profile picture states
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [isUploadingProfilePicture, setIsUploadingProfilePicture] = useState(false);
  const [isDraggingProfilePicture, setIsDraggingProfilePicture] = useState(false);
  
  // Profile pictures bucket constant
  const PROFILE_PICTURES_BUCKET = 'profile-pictures';

  useEffect(() => {
    console.log('Profile useEffect - user:', user);
    if (user) {
      console.log('User found, fetching profile...');
      fetchUserProfile();
      fetchUploadedFiles();
      // Initialize storage system
      initializeStorage().then(success => {
        if (success) {
          console.log('Storage initialized successfully');
        } else {
          console.warn('Storage initialization failed, fallbacks will be used');
        }
      });
    } else {
      console.log('No user available yet');
    }
  }, [user]);



  const fetchUserProfile = async () => {
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
      
      if (error) {
        console.error('Profile fetch error:', error);
        
        // If profile doesn't exist, create a basic one
        if (error.code === 'PGRST116') {
          console.log('Profile not found, creating basic profile...');
          
          try {
            // Create basic profile with auth user data
            const computedFullName = authUser.user_metadata?.full_name || 
                                    [authUser.user_metadata?.first_name, authUser.user_metadata?.middle_name, authUser.user_metadata?.last_name]
                                      .filter(Boolean).join(' ') ||
                                    authUser.email.split('@')[0];
                                    
            const { error: createError } = await supabase
              .from('profiles')
              .insert([{
                id: user.id,
                email: authUser.email,
                full_name: computedFullName,
                first_name: authUser.user_metadata?.first_name || '',
                middle_name: authUser.user_metadata?.middle_name || '',
                last_name: authUser.user_metadata?.last_name || '',
                phone: authUser.user_metadata?.phone || '',
                street: authUser.user_metadata?.street || '',
                barangay: authUser.user_metadata?.barangay || '',
                city: authUser.user_metadata?.city || '',
                province: authUser.user_metadata?.province || '',
                address: authUser.user_metadata?.address || '',
                birthday: authUser.user_metadata?.birthday || null,
                age: authUser.user_metadata?.age ? parseInt(authUser.user_metadata.age) : null,
                gender: authUser.user_metadata?.gender || '',
                role: authUser.user_metadata?.role || 'patient',
                disabled: false,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }]);
              
            if (createError) {
              console.error('Failed to create profile:', createError);
              throw createError;
            }
            
            // Fetch the newly created profile
            const { data: newData, error: newError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
              
            if (newError) throw newError;
            data = newData;
            
            toast.success('Profile created successfully!');
          } catch (createProfileError) {
            console.error('Error creating profile:', createProfileError);
            
            // Fall back to using auth metadata directly
            setProfile({
              first_name: authUser.user_metadata?.first_name || '',
              middle_name: authUser.user_metadata?.middle_name || '',
              last_name: authUser.user_metadata?.last_name || '',
              email: authUser?.email || '',
              phone: authUser.user_metadata?.phone || '',
              certificate_url: '',
              street: authUser.user_metadata?.street || '',
              barangay: authUser.user_metadata?.barangay || '',
              city: authUser.user_metadata?.city || '',
              province: authUser.user_metadata?.province || '',
              age: authUser.user_metadata?.age || '',
              birthday: authUser.user_metadata?.birthday || '',
              gender: authUser.user_metadata?.gender || '',
              profile_picture_url: '',
              emergency_contact_name: '',
              emergency_contact_phone: '',
              nickname: '',
              occupation: '',
              nationality: '',
              office_no: ''
            });
            
            toast.warning('Profile loaded from registration data. You may want to update it.');
            return;
          }
        } else {
          throw error;
        }
      }
      
      // Set profile data from database
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
      
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast.error('Failed to load profile data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUploadedFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('patient_files')
        .select('*')
        .eq('patient_id', user.id)
        .order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      setUploadedFiles(data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Failed to load your files');
    }
  };

  const refreshAuth = async () => {
    setDebugInfo('Refreshing authentication...');
    setIsDiagnosticVisible(true);
    
    try {
      // Check which version of Supabase we're using
      let refreshResult;
      
      if (supabase.auth.refreshSession) {
        // Supabase v2
        refreshResult = await supabase.auth.refreshSession();
        setDebugInfo(prev => prev + '\nUsing Supabase v2 refreshSession');
      } else if (typeof supabase.auth.refreshSession === 'function') {
        // Supabase v1
        refreshResult = await supabase.auth.refreshSession();
        setDebugInfo(prev => prev + '\nUsing Supabase v1 refreshSession');
      } else {
        setDebugInfo(prev => prev + '\nCould not detect refresh method, trying signInWithOAuth');
        // Last resort
        refreshResult = { error: new Error('No refresh method available') };
      }
      
      if (refreshResult.error) {
        setDebugInfo(prev => prev + `\nAuth refresh error: ${refreshResult.error.message}`);
      } else {
        setDebugInfo(prev => prev + '\nAuthentication refreshed successfully');
        // Force reload profile and files
        fetchUserProfile();
        fetchUploadedFiles();
      }
    } catch (error) {
      setDebugInfo(`Auth refresh exception: ${error.message}`);
    }
  };

  const runDiagnostics = async () => {
    setDebugInfo('Running Supabase diagnostics...');
    setIsDiagnosticVisible(true);
    
    try {
      // Check authentication - compatible with v1 and v2
      let session, user;
      let info = 'Checking authentication method...\n';
      
      try {
        if (supabase.auth.getSession) {
          info += 'Supabase v2 detected, using new auth methods\n';
          session = (await supabase.auth.getSession()).data.session;
          user = (await supabase.auth.getUser()).data.user;
        } else if (typeof supabase.auth.session === 'function') {
          info += 'Supabase v1 detected, using legacy auth methods\n';
          session = supabase.auth.session();
          user = supabase.auth.user();
        } else {
          info += 'Unknown Supabase version, trying to detect auth method\n';
          session = supabase.auth.session; // might be a property
          user = supabase.auth.user;
        }
      } catch (authError) {
        info += `Auth method detection error: ${authError.message}\n`;
      }
      
      info += `Auth status: ${session ? 'Authenticated' : 'Not authenticated'}\n`;
      info += `User ID: ${user?.id || 'None'}\n\n`;
      
      // Check profile data
      info += `Testing profile data access...\n`;
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
      
      if (profileError) {
        info += `Profile error: ${profileError.message}\n`;
        info += `Code: ${profileError.code}\n`;
      } else {
        info += `Profile data access: SUCCESS\n`;
      }
      
      // Check storage access
      info += `\nTesting storage access...\n`;
      try {
        const { data: buckets, error: bucketsError } = await supabase.storage
          .listBuckets();
        
        if (bucketsError) {
          info += `Bucket list error: ${bucketsError.message}\n`;
        } else {
          info += `Available buckets: ${buckets.map(b => b.name).join(', ') || 'None'}\n`;
          
          // Check if our bucket exists
          const patientFilesBucket = buckets.find(b => b.name === BUCKET_NAME);
          if (patientFilesBucket) {
            info += `${BUCKET_NAME} bucket exists\n`;
            info += `Public access: ${patientFilesBucket.public ? 'Yes' : 'No'}\n`;
            
            // Try to list files
            const { data: files, error: filesError } = await supabase.storage
              .from(BUCKET_NAME)
              .list(user?.id);
            
            if (filesError) {
              info += `File list error: ${filesError.message}\n`;
            } else {
              info += `Files in user directory: ${files.length}\n`;
              if (files.length > 0) {
                info += `Sample file: ${files[0].name}\n`;
              }
            }
          } else {
            info += `${BUCKET_NAME} bucket NOT FOUND\n`;
            
            // Try to create the bucket
            info += `Attempting to create bucket...\n`;
            try {
              const { error: createError } = await supabase.storage
                .createBucket(BUCKET_NAME, {
                  public: true,
                  fileSizeLimit: 50 * 1024 * 1024,
                });
              
              if (createError) {
                info += `Bucket creation error: ${createError.message}\n`;
              } else {
                info += `Bucket created successfully\n`;
              }
            } catch (e) {
              info += `Bucket creation exception: ${e.message}\n`;
            }
          }
        }
      } catch (storageError) {
        info += `Storage access exception: ${storageError.message}\n`;
      }
      
      // Check database schema for patient_files table
      info += `\nChecking patient_files table schema...\n`;
      try {
        const { data: tables, error: tablesError } = await supabase
          .rpc('get_table_columns', { table_name: 'patient_files' });
        
        if (tablesError) {
          info += `Schema query error: ${tablesError.message}\n`;
        } else {
          if (tables && tables.length > 0) {
            const columnNames = tables.map(col => col.column_name);
            info += `Columns found: ${columnNames.join(', ')}\n`;
            
            // Check for storage_status column
            if (columnNames.includes('storage_status')) {
              info += `storage_status column is present\n`;
            } else {
              info += `storage_status column is NOT present - will adapt file uploads\n`;
            }
          } else {
            info += `No columns information found for patient_files table\n`;
          }
        }
      } catch (schemaError) {
        info += `Schema check exception: ${schemaError.message}\n`;
      }
      
      // Display diagnostic info
      setDebugInfo(info);
      console.log('Supabase diagnostics:', info);
      
    } catch (error) {
      setDebugInfo(`Diagnostic error: ${error.message}`);
      console.error('Diagnostic error:', error);
    }
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const processedData = {
        ...profile,
        // Optionally update full_name/address for legacy support
        full_name: [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' '),
        address: [profile.street, profile.barangay, profile.city, profile.province].filter(Boolean).join(', '),
        birthday: profile.birthday === '' ? null : profile.birthday,
        gender: !profile.gender ? null : profile.gender,
        age: profile.age === '' ? null : Number(profile.age),
      };
      const { success, error } = await updateProfile(processedData);
      if (success) {
        setProfile(prev => ({ ...prev, ...processedData }));
        setIsEditing(false);
        toast.success('Profile updated successfully');
        // Re-fetch to ensure latest data
        fetchUserProfile();
      } else {
        throw error || new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced file download function with multiple fallback methods
  const downloadFileDirectly = async (file) => {
    if (!file || !file.file_path) {
      toast.error('File information is incomplete');
      return null;
    }
    
    try {
      // Log debug info
      let debugMsg = `Attempting to download file: ${file.file_name}\n`;
      debugMsg += `File path: ${file.file_path}\n`;
      
      // Check authentication status - compatible with Supabase v1 and v2
      let session, user;
      try {
        // Try Supabase v2 method first
        session = supabase.auth.getSession ? (await supabase.auth.getSession()).data.session : undefined;
        user = supabase.auth.getUser ? (await supabase.auth.getUser()).data.user : undefined;
      } catch (e) {
        // Fallback to v1 method if needed
        try {
          session = typeof supabase.auth.session === 'function' ? supabase.auth.session() : undefined;
          user = typeof supabase.auth.user === 'function' ? supabase.auth.user() : undefined;
        } catch (e2) {
          debugMsg += `Auth method detection error: ${e2.message}\n`;
        }
      }
      
      if (!session || !user) {
        debugMsg += `Error: Not authenticated with Supabase\n`;
        setDebugInfo(debugMsg);
        
        // Attempt to refresh auth
        await supabase.auth.refreshSession();
        const refreshedSession = supabase.auth.session();
        
        if (!refreshedSession) {
          throw new Error('Authentication failed. Please log in again.');
        }
        
        debugMsg += `Session refreshed successfully\n`;
      }
      
      // Add authorization diagnostic
      debugMsg += `Auth status: ${session ? 'Authenticated' : 'Not authenticated'}\n`;
      debugMsg += `User ID: ${user?.id}\n`;
      setDebugInfo(debugMsg);
      
      // Try multiple download methods
      
      // METHOD 1: Verify bucket exists before proceeding
      debugMsg += `Verifying storage bucket...\n`;
      setDebugInfo(debugMsg);
      
      try {
        const { data: bucketData, error: bucketError } = await supabase.storage
          .getBucket(BUCKET_NAME);
        
        if (bucketError) {
          debugMsg += `Bucket verification error: ${bucketError.message}\n`;
          debugMsg += `Attempting to create bucket...\n`;
          setDebugInfo(debugMsg);
          
          // Try to create the bucket if it doesn't exist
          try {
            const { error: createError } = await supabase.storage
              .createBucket(BUCKET_NAME, {
                public: false,
                fileSizeLimit: 100 * 1024 * 1024,
              });
            
            if (createError && !createError.message.includes('already exists')) {
              debugMsg += `Bucket creation error: ${createError.message}\n`;
            } else {
              debugMsg += `Bucket created or already exists\n`;
            }
          } catch (createErr) {
            debugMsg += `Bucket creation exception: ${createErr.message}\n`;
          }
        } else {
          debugMsg += `Storage bucket '${BUCKET_NAME}' verified\n`;
        }
      } catch (bucketError) {
        debugMsg += `Bucket verification exception: ${bucketError.message}\n`;
      }
      
      setDebugInfo(debugMsg);
      
      // METHOD 2: Direct download using standard API
      debugMsg += `Attempting direct download...\n`;
      setDebugInfo(debugMsg);
      
      try {
        const { data, error } = await supabase.storage
          .from(BUCKET_NAME)
          .download(file.file_path);
        
        if (error) {
          debugMsg += `Direct download error: ${error.message || JSON.stringify(error)}\n`;
          debugMsg += `Error code: ${error.code || 'Unknown'}\n`;
          setDebugInfo(debugMsg);
        } else if (data) {
          debugMsg += `Successfully downloaded file via direct method: ${data.size} bytes\n`;
          setDebugInfo(debugMsg);
          return data;
        } else {
          debugMsg += `Direct download returned no data and no error\n`;
          setDebugInfo(debugMsg);
        }
      } catch (directError) {
        debugMsg += `Direct download exception: ${directError.message}\n`;
        setDebugInfo(debugMsg);
      }
      
      // METHOD 3: Try with signed URL
      debugMsg += `Attempting download via signed URL...\n`;
      setDebugInfo(debugMsg);
      
      try {
        const { data: urlData, error: urlError } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(file.file_path, 60);
        
        if (urlError) {
          debugMsg += `Signed URL error: ${urlError.message}\n`;
          setDebugInfo(debugMsg);
        } else if (urlData && urlData.signedUrl) {
          debugMsg += `Got signed URL\n`;
          setDebugInfo(debugMsg);
          
          // Use fetch with the signed URL
          const response = await fetch(urlData.signedUrl);
          if (response.ok) {
            const blob = await response.blob();
            debugMsg += `Successfully downloaded file via signed URL: ${blob.size} bytes\n`;
            setDebugInfo(debugMsg);
            return blob;
          } else {
            debugMsg += `Fetch with signed URL failed: ${response.status} ${response.statusText}\n`;
            setDebugInfo(debugMsg);
          }
        } else {
          debugMsg += `No signed URL returned\n`;
          setDebugInfo(debugMsg);
        }
      } catch (signedError) {
        debugMsg += `Signed URL exception: ${signedError.message}\n`;
        setDebugInfo(debugMsg);
      }
      
      // METHOD 4: Get file from public URL if possible
      debugMsg += `Attempting to use public URL...\n`;
      setDebugInfo(debugMsg);
      
      try {
        // Set bucket to public if not already
        try {
          await supabase.storage.updateBucket(BUCKET_NAME, {
            public: true
          });
          debugMsg += `Updated bucket to public\n`;
        } catch (updateError) {
          debugMsg += `Could not update bucket: ${updateError.message}\n`;
        }
        
        const { data: publicData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(file.file_path);
        
        if (publicData && publicData.publicUrl) {
          debugMsg += `Got public URL\n`;
          setDebugInfo(debugMsg);
          
          // Add cache-busting parameter
          const cacheUrl = `${publicData.publicUrl}?t=${Date.now()}`;
          
          const response = await fetch(cacheUrl);
          if (response.ok) {
            const blob = await response.blob();
            debugMsg += `Successfully downloaded file via public URL: ${blob.size} bytes\n`;
            setDebugInfo(debugMsg);
            return blob;
          } else {
            debugMsg += `Public URL fetch failed: ${response.status} ${response.statusText}\n`;
            setDebugInfo(debugMsg);
          }
        } else {
          debugMsg += `No public URL available\n`;
          setDebugInfo(debugMsg);
        }
      } catch (publicError) {
        debugMsg += `Public URL exception: ${publicError.message}\n`;
        setDebugInfo(debugMsg);
      }
      
      // METHOD 5: Try direct URL from database if available
      if (file.file_url) {
        debugMsg += `Attempting to use stored file_url from database...\n`;
        setDebugInfo(debugMsg);
        
        try {
          // Add cache-busting parameter
          const cacheUrl = `${file.file_url}?t=${Date.now()}`;
          
          const response = await fetch(cacheUrl);
          if (response.ok) {
            const blob = await response.blob();
            debugMsg += `Successfully downloaded file via stored URL: ${blob.size} bytes\n`;
            setDebugInfo(debugMsg);
            return blob;
          } else {
            debugMsg += `Stored URL fetch failed: ${response.status} ${response.statusText}\n`;
            setDebugInfo(debugMsg);
          }
        } catch (storedUrlError) {
          debugMsg += `Stored URL exception: ${storedUrlError.message}\n`;
          setDebugInfo(debugMsg);
        }
      }
      
      // All methods failed
      debugMsg += `All download methods failed\n`;
      debugMsg += `Request diagnostic details: ${JSON.stringify({
        userId: user?.id,
        filePath: file.file_path,
        fileName: file.file_name,
        timestamp: new Date().toISOString()
      })}\n`;
      
      setDebugInfo(debugMsg);
      throw new Error('All download methods failed');
      
    } catch (error) {
      console.error('Error downloading file directly:', error);
      toast.error(`Failed to download file: ${error.message}`);
      return null;
    }
  };

  // Function to check if file exists in storage - compatible with Supabase v1 and v2
  const checkFileExists = async (filePath) => {
    if (!filePath) return false;
    
    try {
      // Split the path to get directory and filename
      const pathParts = filePath.split('/');
      const fileName = pathParts.pop(); // Get the last part (filename)
      const directory = pathParts.join('/'); // Rejoin the rest as directory
      
      setDebugInfo(prev => prev + `\nChecking if file exists: ${fileName} in directory ${directory}`);
      
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(directory, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });
      
      if (error) {
        setDebugInfo(prev => prev + `\nError checking file existence: ${error.message}`);
        return false;
      }
      
      // Log what files were found
      if (data && data.length > 0) {
        setDebugInfo(prev => prev + `\nFound ${data.length} files in directory: ${data.map(f => f.name).join(', ')}`);
      } else {
        setDebugInfo(prev => prev + `\nNo files found in directory ${directory}`);
      }
      
      const fileExists = data.some(item => item.name === fileName);
      setDebugInfo(prev => prev + `\nFile ${fileName} ${fileExists ? 'exists' : 'does not exist'} in storage`);
      
      return fileExists;
    } catch (error) {
      setDebugInfo(prev => prev + `\nException checking file existence: ${error.message}`);
      return false;
    }
  };

  // Function to handle file viewing with improved fallback methods
  const handleViewFile = async (file) => {
    if (!file) {
      toast.error('File information is missing');
      return;
    }
    
    // Show diagnostic panel
    setIsDiagnosticVisible(true);
    
    // Show modal first with loading state
    setFilePreview(file);
    setFileData(null);
    setDebugInfo('Preparing download request...');
    
    try {
      // Parse timestamp from filename if available
      let timestamp = null;
      try {
        const match = file.file_path.match(/\/(\d+)_/);
        if (match && match[1]) {
          timestamp = match[1];
        }
      } catch (e) {}
      
      // First check if we have a cached preview
      if (timestamp) {
        setDebugInfo(prev => prev + `\nChecking for cached preview (timestamp: ${timestamp})...`);
        
        // For text files
        const cachedText = localStorage.getItem(`file_${timestamp}`);
        if (cachedText && file.file_type && (file.file_type.includes('text') || file.file_type.includes('html'))) {
          setDebugInfo(prev => prev + `\nFound cached text preview (${cachedText.length} bytes)`);
          
          // Convert text to blob
          const blob = new Blob([cachedText], { type: file.file_type });
          setFileData(blob);
          setDebugInfo(prev => prev + `\nText preview loaded successfully!`);
          return;
        }
        
        // For binary files (images, PDFs)
        const cachedUrl = localStorage.getItem(`file_${timestamp}_url`);
        if (cachedUrl) {
          setDebugInfo(prev => prev + `\nFound cached binary preview URL`);
          
          try {
            const response = await fetch(cachedUrl);
            if (response.ok) {
              const blob = await response.blob();
              setFileData(blob);
              setDebugInfo(prev => prev + `\nBinary preview loaded successfully!`);
              return;
            }
          } catch (e) {
            setDebugInfo(prev => prev + `\nError accessing cached preview: ${e.message}`);
          }
        }
      }
      
      // Check if file exists in storage
      setDebugInfo(prev => prev + `\nChecking if file exists in storage...`);
      const fileExists = await checkFileExists(file.file_path);
      
      if (fileExists) {
        setDebugInfo(prev => prev + `\nFile found in storage, attempting download...`);
      } else {
        setDebugInfo(prev => prev + `\nFile not found in storage. Attempting alternative download methods...`);
      }
      
      // Try URL from database first if it's a data URL - these are most reliable
      if (file.file_url && file.file_url.startsWith('data:')) {
        setDebugInfo(prev => prev + `\nUsing embedded data URL from database...`);
        
        try {
          // Convert data URL to blob
          const response = await fetch(file.file_url);
          if (response.ok) {
            const blob = await response.blob();
            setFileData(blob);
            setDebugInfo(prev => prev + `\nFile loaded from data URL successfully!`);
            return;
          }
        } catch (e) {
          setDebugInfo(prev => prev + `\nError loading from data URL: ${e.message}`);
        }
      }
      
      // Get the file from Supabase storage or other sources
      setDebugInfo(prev => prev + `\nAttempting storage download...`);
      const fileBlob = await downloadFileDirectly(file);
      
      if (fileBlob) {
        // Store the blob data for use in the modal
        setFileData(fileBlob);
        setDebugInfo(prev => prev + `\nFile downloaded successfully! Ready for viewing or saving.`);
        
        // Cache for future use if appropriate size
        if (fileBlob.size < 5 * 1024 * 1024 && timestamp) { // 5MB limit
          try {
            if (file.file_type.includes('text')) {
              const text = await fileBlob.text();
              localStorage.setItem(`file_${timestamp}`, text.substring(0, 1024 * 1024)); // Store up to 1MB
            } else {
              const url = URL.createObjectURL(fileBlob);
              localStorage.setItem(`file_${timestamp}_url`, url);
            }
            
            setDebugInfo(prev => prev + `\nFile cached for future access.`);
          } catch (e) {
            setDebugInfo(prev => prev + `\nCould not cache file: ${e.message}`);
          }
        }
      } else {
        // Try one last approach - if file.file_url is a URL, try to fetch it directly
        if (file.file_url && (file.file_url.startsWith('http://') || file.file_url.startsWith('https://'))) {
          setDebugInfo(prev => prev + `\nTrying direct fetch from file_url...`);
          
          try {
            const response = await fetch(file.file_url);
            if (response.ok) {
              const blob = await response.blob();
              setFileData(blob);
              setDebugInfo(prev => prev + `\nFile fetched from URL successfully!`);
              return;
            } else {
              setDebugInfo(prev => prev + `\nFailed to fetch from URL: ${response.status} ${response.statusText}`);
            }
          } catch (e) {
            setDebugInfo(prev => prev + `\nError fetching from URL: ${e.message}`);
          }
        }
        
        // If we get here, all methods failed
        setDebugInfo(prev => prev + `\nFailed to download file data. Check console for errors.`);
        toast.error('Could not download the file. Please try again later or contact support.');
      }
    } catch (error) {
      console.error('Error viewing file:', error);
      setDebugInfo(prev => prev + `\nException: ${error.message}`);
      toast.error(`Error viewing file: ${error.message}`);
    }
  };

  // Close file preview modal
  const closeFilePreview = () => {
    setFilePreview(null);
    setFileData(null);
    setDebugInfo('');
    setIsDiagnosticVisible(false);
  };

  // Function to download the file to the user's device
  const saveFile = (fileBlob, fileName) => {
    if (!fileBlob) {
      toast.error('No file data available');
      return;
    }
    
    try {
      // Create a Blob URL and trigger download
      const blobUrl = URL.createObjectURL(fileBlob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || 'download';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 100);
      
      toast.success('File download started');
    } catch (error) {
      console.error('Error saving file:', error);
      toast.error('Failed to save file: ' + error.message);
    }
  };

  // Function to create a view URL for an image or PDF
  const createViewUrl = (fileBlob, fileType) => {
    if (!fileBlob) return null;
    return URL.createObjectURL(fileBlob);
  };

  // Initialize Supabase storage - should be called once at component load
  const initializeStorage = async () => {
    try {
      setDebugInfo('Initializing Supabase storage...');
      setIsDiagnosticVisible(true);
      
      // First check if storage is accessible
      try {
        const { data: buckets, error } = await supabase.storage.listBuckets();
        
        if (error) {
          setDebugInfo(prev => prev + `\nError accessing storage: ${error.message}`);
          return false;
        }
        
        setDebugInfo(prev => prev + `\nStorage access successful. Found ${buckets.length} buckets.`);
        
        // Check if our bucket exists
        const patientFilesBucket = buckets.find(b => b.name === BUCKET_NAME);
        
        if (patientFilesBucket) {
          setDebugInfo(prev => prev + `\nBucket '${BUCKET_NAME}' already exists.`);
          
          // Update bucket to be public if it's not
          if (!patientFilesBucket.public) {
            setDebugInfo(prev => prev + `\nUpdating bucket to be public...`);
            
            try {
              await supabase.storage.updateBucket(BUCKET_NAME, {
                public: true,
                fileSizeLimit: 50 * 1024 * 1024 // 50MB
              });
              setDebugInfo(prev => prev + `\nBucket updated to public successfully.`);
            } catch (updateError) {
              setDebugInfo(prev => prev + `\nFailed to update bucket: ${updateError.message}`);
            }
          }
          
          return true;
        }
        
        // Bucket doesn't exist, create it
        setDebugInfo(prev => prev + `\nBucket '${BUCKET_NAME}' not found. Creating it...`);
        
        const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: 50 * 1024 * 1024 // 50MB limit
        });
        
        if (createError) {
          // Try with smaller size limit if it fails due to size
          if (createError.message.includes('exceeded the maximum allowed size')) {
            setDebugInfo(prev => prev + `\nReducing size limit and retrying...`);
            
            const { error: retryError } = await supabase.storage.createBucket(BUCKET_NAME, {
              public: true,
              fileSizeLimit: 10 * 1024 * 1024 // 10MB limit
            });
            
            if (retryError) {
              setDebugInfo(prev => prev + `\nStill failed to create bucket: ${retryError.message}`);
              return false;
            } else {
              setDebugInfo(prev => prev + `\nBucket created successfully with 10MB limit.`);
              return true;
            }
          }
          
          setDebugInfo(prev => prev + `\nFailed to create bucket: ${createError.message}`);
          return false;
        }
        
        setDebugInfo(prev => prev + `\nBucket created successfully with 50MB limit.`);
        return true;
      } catch (e) {
        setDebugInfo(prev => prev + `\nException initializing storage: ${e.message}`);
        return false;
      }
    } catch (error) {
      console.error('Storage initialization error:', error);
      setDebugInfo(prev => prev + `\nStorage initialization failed: ${error.message}`);
      return false;
    }
  };

  // Enhanced file upload with better storage handling
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setIsUploading(true);
      
      // Show toast for starting upload
      const toastId = toast.info('Uploading file...', { autoClose: false });
      
      // Show diagnostic panel
      setIsDiagnosticVisible(true);
      
      // Create sanitized file name and path
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const timestamp = Date.now();
      const filePath = `${user.id}/${timestamp}_${sanitizedFileName}`;
      
      let debugMsg = `Starting upload for file: ${file.name}\n`;
      debugMsg += `Sanitized path: ${filePath}\n`;
      setDebugInfo(debugMsg);
      
      // Initialize storage and bucket if needed
      debugMsg += `Checking storage access...\n`;
      setDebugInfo(debugMsg);
      
      // Try the normal upload process first
      let uploadSuccess = false;
      let fileUrl = null;
      
      // First try to upload through Supabase storage
      try {
        // Ensure bucket exists
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) {
          debugMsg += `Error listing buckets: ${listError.message}\n`;
          setDebugInfo(debugMsg);
        } else {
          const bucketExists = buckets.some(b => b.name === BUCKET_NAME);
          
          if (!bucketExists) {
            debugMsg += `Creating '${BUCKET_NAME}' bucket...\n`;
            setDebugInfo(debugMsg);
            
            // Try to create with various size limits if needed
            let bucketCreated = false;
            
            for (const sizeLimit of [50, 20, 10, 5, 2]) {
              try {
                const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
                  public: true,
                  fileSizeLimit: sizeLimit * 1024 * 1024
                });
                
                if (!createError) {
                  debugMsg += `Bucket created with ${sizeLimit}MB limit\n`;
                  setDebugInfo(debugMsg);
                  bucketCreated = true;
                  break;
                } else if (!createError.message.includes('exceeded the maximum allowed size')) {
                  debugMsg += `Error creating bucket: ${createError.message}\n`;
                  break;
                }
              } catch (e) {
                debugMsg += `Exception creating bucket: ${e.message}\n`;
              }
            }
            
            if (!bucketCreated) {
              debugMsg += `Could not create bucket with any size limit\n`;
              setDebugInfo(debugMsg);
            }
          } else {
            debugMsg += `Bucket '${BUCKET_NAME}' exists\n`;
            setDebugInfo(debugMsg);
            
            // Update to be public if needed
            try {
              await supabase.storage.updateBucket(BUCKET_NAME, { public: true });
            } catch (updateError) {
              debugMsg += `Note: Could not update bucket: ${updateError.message}\n`;
              setDebugInfo(debugMsg);
            }
          }
        }
        
        // Try to upload the file to storage
        debugMsg += `Attempting to upload to Supabase storage...\n`;
        setDebugInfo(debugMsg);
        
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });
        
        if (uploadError) {
          debugMsg += `Storage upload error: ${uploadError.message}\n`;
          setDebugInfo(debugMsg);
        } else {
          debugMsg += `File uploaded to storage successfully\n`;
          setDebugInfo(debugMsg);
          uploadSuccess = true;
          
          // Try to get URLs for the file
          try {
            // Try public URL first - more reliable for publicly accessible files
            const { data: publicUrlData } = supabase.storage
              .from(BUCKET_NAME)
              .getPublicUrl(filePath);
            
            if (publicUrlData?.publicUrl) {
              fileUrl = publicUrlData.publicUrl;
              debugMsg += `Got public URL for file\n`;
            } else {
              // Try signed URL
              const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from(BUCKET_NAME)
                .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry
              
              if (signedUrlData?.signedUrl && !signedUrlError) {
                fileUrl = signedUrlData.signedUrl;
                debugMsg += `Got signed URL for file\n`;
              } else {
                debugMsg += `Could not get signed URL: ${signedUrlError?.message || 'Unknown error'}\n`;
              }
            }
          } catch (urlError) {
            debugMsg += `Error getting file URL: ${urlError.message}\n`;
          }
        }
      } catch (storageError) {
        debugMsg += `Storage error: ${storageError.message}\n`;
      }
      
      setDebugInfo(debugMsg);
      
      // If we still don't have a URL, try a short-lived signed URL. Do NOT insert local:// placeholders.
      if (!fileUrl) {
        try {
          const { data: signed } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(filePath, 60);
          if (signed?.signedUrl) {
            fileUrl = signed.signedUrl;
            debugMsg += `Generated signed URL as fallback\n`;
            setDebugInfo(debugMsg);
          }
        } catch (e) {
          // ignore and handle below
        }
      }

      if (!fileUrl) {
        debugMsg += `No accessible URL for uploaded file. Aborting record insert.\n`;
        setDebugInfo(debugMsg);
        throw new Error('Upload succeeded but file URL is not accessible. Please check bucket public setting or policies.');
      }
      
      // Save file record in database
      debugMsg += `Saving file record to database...\n`;
      setDebugInfo(debugMsg);
      
      // Create base record without storage_status field
      const fileRecord = {
        patient_id: user.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_path: filePath,
        file_url: fileUrl,
        uploaded_at: new Date().toISOString(),
        uploaded_by: user.id
      };
      
      // Insert record
      const { error: recordError } = await supabase
        .from('patient_files')
        .insert([fileRecord]);
      
      if (recordError) {
        debugMsg += `Error saving file record: ${recordError.message}\n`;
        setDebugInfo(debugMsg);
        throw recordError;
      }
      
      // If all went well, show success message
      debugMsg += `File record saved successfully!\n`;
      setDebugInfo(debugMsg);
      
      // Directly read the file contents for text, PDF and image files
      if (file.type.includes('text') || file.type.includes('pdf') || file.type.includes('image')) {
        debugMsg += `Reading file contents for preview...\n`;
        setDebugInfo(debugMsg);
        
        try {
          const reader = new FileReader();
          const fileData = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result);
            if (file.type.includes('text')) {
              reader.readAsText(file);
            } else {
              reader.readAsArrayBuffer(file);
            }
          });
          
          // Store the file data in a format we can use later
          if (typeof fileData === 'string') {
            localStorage.setItem(`file_${timestamp}`, fileData.substring(0, 1024 * 1024)); // Store up to 1MB 
            debugMsg += `Stored file text preview in local storage\n`;
          } else {
            // For binary data, convert to Blob and store the URL temporarily
            const blob = new Blob([fileData], { type: file.type });
            const url = URL.createObjectURL(blob);
            localStorage.setItem(`file_${timestamp}_url`, url);
            debugMsg += `Created local preview URL for file\n`;
          }
          
          setDebugInfo(debugMsg);
        } catch (readError) {
          debugMsg += `Error reading file: ${readError.message}\n`;
          setDebugInfo(debugMsg);
        }
      }
      
      // Update toast
      toast.update(toastId, {
        render: uploadSuccess 
          ? 'File uploaded successfully' 
          : 'File saved with fallback storage',
        type: uploadSuccess ? 'success' : 'warning',
        autoClose: 3000
      });
      
      // Refresh file list
      fetchUploadedFiles();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(`Failed to upload file: ${error.message}`);
    } finally {
      setIsUploading(false);
      // Reset the file input
      e.target.value = null;
    }
  };

  const handleFileDelete = async (file) => {
    setFileToDelete(file);
  };

  const confirmFileDelete = async () => {
    if (!fileToDelete) return;
    
    try {
      setIsDeleting(true);
      
      // Show delete toast
      const toastId = toast.info('Deleting file...', { autoClose: false });
      
      // First delete from storage (if possible)
      try {
        const { error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([fileToDelete.file_path]);
        
        if (storageError) {
          console.warn('Could not delete from storage:', storageError);
          // Continue anyway - we'll still delete the database record
        }
      } catch (storageError) {
        console.warn('Storage delete failed:', storageError);
        // Continue to delete the database record
      }
      
      // Delete the record from the database
      const { error: dbError } = await supabase
        .from('patient_files')
        .delete()
        .eq('id', fileToDelete.id);
      
      if (dbError) throw dbError;
      
      // Update toast
      toast.update(toastId, {
        render: 'File deleted successfully',
        type: 'success',
        autoClose: 3000
      });
      
      // Update the local state to remove the file
      setUploadedFiles(uploadedFiles.filter(f => f.id !== fileToDelete.id));
      
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file: ' + error.message);
    } finally {
      setIsDeleting(false);
      setFileToDelete(null);
    }
  };

  const cancelFileDelete = () => {
    setFileToDelete(null);
  };

  const calculateAge = (birthday) => {
    if (!birthday) return '';
    const today = new Date();
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
  };

  // Format file size to human-readable format
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
    else return (bytes / 1073741824).toFixed(2) + ' GB';
  };

  // Helper function to determine if a file is of a specific type
  const isFileType = (file, type) => {
    if (!file || !file.file_type) return false;
    
    // For image files
    if (type === 'image') {
      return file.file_type.includes('image');
    }
    
    // For PDF files
    if (type === 'pdf') {
      return file.file_type.includes('pdf');
    }
    
    // For Word documents
    if (type === 'word') {
      return (
        file.file_type.includes('application/msword') ||
        file.file_type.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
        file.file_type.includes('application/vnd.oasis.opendocument.text') ||
        file.file_name.endsWith('.doc') ||
        file.file_name.endsWith('.docx') ||
        file.file_name.endsWith('.odt')
      );
    }
    
    // For text files
    if (type === 'text') {
      return file.file_type.includes('text');
    }
    
    return false;
  };

  // Helper function for displaying text content from a blob
  const TextViewer = ({ blob }) => {
    const [text, setText] = useState('Loading text content...');
    
    useEffect(() => {
      if (blob) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setText(e.target.result);
        };
        reader.readAsText(blob);
      }
    }, [blob]);
    
    return (
      <pre className="whitespace-pre-wrap">{text}</pre>
    );
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
      fetchUserProfile();
      
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
      fetchUserProfile();
      
    } catch (error) {
      console.error('Error removing certificate:', error);
      toast.error(`Failed to remove certificate: ${error.message}`);
    }
  };

  // Profile picture functions
  const initializeProfilePicturesBucket = async () => {
    try {
      // First, try to list buckets to see what's available
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        // If we can't list buckets, try to create the bucket anyway
      } else {
        const profilePicturesBucket = buckets?.find(b => b.name === PROFILE_PICTURES_BUCKET);
        
        if (profilePicturesBucket) {
          // Check if bucket is public
          if (!profilePicturesBucket.public) {
            try {
              const { error: updateError } = await supabase.storage.updateBucket(PROFILE_PICTURES_BUCKET, {
                public: true,
                fileSizeLimit: 10 * 1024 * 1024 // 10MB limit for profile pictures
              });
            } catch (updateError) {
              // Continue anyway, the bucket exists
            }
          }
          
          // Test if we can access the bucket
          try {
            const { data: testData, error: testError } = await supabase.storage
              .from(PROFILE_PICTURES_BUCKET)
              .list('', { limit: 1 });
          } catch (testError) {
            // This might be a permissions issue, but we'll continue
          }
          
          return true;
        }
      }
      
      // Try to create the bucket if it doesn't exist
      try {
        const { data: createData, error: createError } = await supabase.storage.createBucket(PROFILE_PICTURES_BUCKET, {
          public: true,
          fileSizeLimit: 10 * 1024 * 1024 // 10MB limit
        });
        
        if (createError) {
          // If bucket creation fails, it might already exist or we don't have permissions
          // Let's try to use it anyway
          
          // Test if we can access the bucket even if creation failed
          try {
            const { data: testData, error: testError } = await supabase.storage
              .from(PROFILE_PICTURES_BUCKET)
              .list('', { limit: 1 });
            
            if (testError) {
              return false;
            } else {
              return true;
            }
          } catch (testError) {
            return false;
          }
        }
        
        return true;
        
      } catch (createException) {
        // Try to use the bucket anyway
        try {
          const { data: testData, error: testError } = await supabase.storage
            .from(PROFILE_PICTURES_BUCKET)
            .list('', { limit: 1 });
          
          if (testError) {
            return false;
          } else {
            return true;
          }
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
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      // Validate file size (5MB limit)
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
      
      // Try to initialize profile pictures bucket, but continue even if it fails
      const bucketInitialized = await initializeProfilePicturesBucket();
      if (!bucketInitialized) {
        // Continue with upload anyway
      }
      
      // Create unique filename
      const fileExtension = profilePictureFile.name.split('.').pop();
      const fileName = `${user.id}_profile.${fileExtension}`;
      
      // Upload file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from(PROFILE_PICTURES_BUCKET)
        .upload(fileName, profilePictureFile, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (uploadError) {
        throw uploadError;
      }
      
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from(PROFILE_PICTURES_BUCKET)
        .getPublicUrl(fileName);
      
      if (!publicUrlData?.publicUrl) {
        throw new Error('Failed to get public URL for profile picture');
      }
      
      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_picture_url: publicUrlData.publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }
      
      // Clear the file input
      setProfilePictureFile(null);
      
      // Force a complete refresh of the page to clear any cached images
      toast.success('Profile picture updated successfully! Refreshing page...');
      
      // Wait a moment for the toast to show, then refresh
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

  const handleRemoveProfilePicture = async () => {
    try {
      await supabase
        .from('profiles')
        .update({
          profile_picture_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      toast.success('Profile picture removed successfully!');
      window.location.reload();
    } catch (error) {
      console.error('Error removing profile picture:', error);
      toast.error('Failed to remove profile picture');
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

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user data...</p>
        </div>
      </div>
    );
  }



  return (
    <div className="space-y-6">
      <div className="bg-white rounded-md shadow border border-blue-100 w-full p-6 mt-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-primary-700 mb-2">My Profile</h1>
              <p className="text-gray-600 text-sm">Manage your personal information and medical records</p>
            </div>
            <div className="flex space-x-3">
            
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
                  onClick={() => document.getElementById('profile-picture-input').click()}
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
                  onClick={() => document.getElementById('profile-picture-input').click()}
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
                    id="profile-picture-input"
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
                        onClick={() => document.getElementById('profile-picture-input').click()}
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
                  <label className="block text-sm font-medium text-gray-700">Nickname</label>
                  <div className="mt-1 text-gray-900 font-semibold">{profile.nickname || 'Not provided'}</div>
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
                    {profile.birthday ? `${formatDate(profile.birthday)} (${calculateAge(profile.birthday)} years old)` : 'Not provided'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Gender</label>
                  <div className="mt-1 text-gray-900 font-semibold">
                    {profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : 'Not specified'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Occupation</label>
                  <div className="mt-1 text-gray-900 font-semibold">{profile.occupation || 'Not provided'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nationality</label>
                  <div className="mt-1 text-gray-900 font-semibold">{profile.nationality || 'Not provided'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Office No.</label>
                  <div className="mt-1 text-gray-900 font-semibold">{profile.office_no || 'Not provided'}</div>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
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
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-2">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={profile.first_name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="middle_name" className="block text-sm font-medium text-gray-700">Middle Name</label>
                  <input
                    type="text"
                    id="middle_name"
                    name="middle_name"
                    value={profile.middle_name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={profile.last_name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Contact Number</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={profile.phone}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                    placeholder="09XX XXX XXXX"
                  />
                </div>
              </div>
              {/* Birthday, Gender and Age Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-2 mt-2">
                <div>
                  <label htmlFor="birthday" className="block text-sm font-medium text-gray-700">Birthday</label>
                  <DatePicker
                    id="birthday"
                    name="birthday"
                    selected={profile.birthday ? new Date(profile.birthday) : null}
                    onChange={date => {
                      handleInputChange({ target: { id: 'birthday', value: date } });
                      // Auto-calculate age
                      if (date) {
                        const today = new Date();
                        const birthDate = new Date(date);
                        let age = today.getFullYear() - birthDate.getFullYear();
                        const m = today.getMonth() - birthDate.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                          age--;
                        }
                        handleInputChange({ target: { id: 'age', value: age } });
                      } else {
                        handleInputChange({ target: { id: 'age', value: '' } });
                      }
                    }}
                    dateFormat="yyyy-MM-dd"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                    placeholderText="Select your birthday"
                    maxDate={new Date()}
                    showMonthDropdown
                    showYearDropdown
                    scrollableYearDropdown
                    yearDropdownItemNumber={100}
                  />
                </div>
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
                  <select
                    id="gender"
                    value={profile.gender || ''}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="age" className="block text-sm font-medium text-gray-700">Age</label>
                  <input
                    type="number"
                    id="age"
                    name="age"
                    value={profile.age}
                    readOnly
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>
              </div>
              {/* Nickname, Nationality, Office No., Occupation Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-x-3 gap-y-2 mt-2">
                <div>
                  <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">Nickname</label>
                  <input
                    type="text"
                    id="nickname"
                    name="nickname"
                    value={profile.nickname}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                  />
                </div>
                <div>
                  <label htmlFor="nationality" className="block text-sm font-medium text-gray-700">Nationality</label>
                  <input
                    type="text"
                    id="nationality"
                    name="nationality"
                    value={profile.nationality}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                  />
                </div>
                <div>
                  <label htmlFor="office_no" className="block text-sm font-medium text-gray-700">Office No.</label>
                  <input
                    type="text"
                    id="office_no"
                    name="office_no"
                    value={profile.office_no}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                  />
                </div>
                <div>
                  <label htmlFor="occupation" className="block text-sm font-medium text-gray-700">Occupation</label>
                  <input
                    type="text"
                    id="occupation"
                    name="occupation"
                    value={profile.occupation}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                  />
                </div>
              </div>
              {/* Address Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-x-3 gap-y-2 mt-2">
                <div>
                  <label htmlFor="street" className="block text-sm font-medium text-gray-700">Street</label>
                  <input
                    type="text"
                    id="street"
                    name="street"
                    value={profile.street}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                  />
                </div>
                <div>
                  <label htmlFor="barangay" className="block text-sm font-medium text-gray-700">Barangay</label>
                  <input
                    type="text"
                    id="barangay"
                    name="barangay"
                    value={profile.barangay}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                  />
                </div>
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">City/Municipality</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={profile.city}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                  />
                </div>
                <div>
                  <label htmlFor="province" className="block text-sm font-medium text-gray-700">Province</label>
                  <input
                    type="text"
                    id="province"
                    name="province"
                    value={profile.province}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                  />
                </div>
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
                    name="emergency_contact_name"
                    value={profile.emergency_contact_name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                  />
                </div>
                
                <div>
                  <label htmlFor="emergency_contact_phone" className="block text-sm font-medium text-gray-700">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    id="emergency_contact_phone"
                    name="emergency_contact_phone"
                    value={profile.emergency_contact_phone}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
                  />
                </div>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label htmlFor="certificate" className="block text-sm font-medium text-gray-700 mb-1">Certificates/ID (Upload Image)</label>
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
                    disabled={isUploadingCertificate}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors duration-200 text-sm flex items-center gap-2 disabled:bg-primary-300 disabled:cursor-not-allowed"
                  >
                    {isUploadingCertificate ? (
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


            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Medical Records */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Medical Records & Documents</h2>
          <div className="flex space-x-2">
           
            <label
              htmlFor="file-upload"
              className="cursor-pointer inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300 disabled:cursor-not-allowed"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <FiUpload className="mr-2 -ml-1 h-4 w-4" />
                  Upload File
                </>
              )}
              <input
                id="file-upload"
                type="file"
                className="sr-only"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </label>
          </div>
        </div>
        <div className="p-6">
          {uploadedFiles.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {uploadedFiles.map((file) => (
                <li key={file.id} className="py-4 flex flex-wrap sm:flex-nowrap items-center justify-between">
                  <div className="flex items-center mb-2 sm:mb-0">
                    <div className="flex-shrink-0">
                      {isFileType(file, 'image') ? (
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      ) : isFileType(file, 'pdf') ? (
                        <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                          <FiFileText className="h-6 w-6" />
                        </div>
                      ) : isFileType(file, 'word') ? (
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                          <FiFileText className="h-6 w-6" />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                          <FiFileText className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="ml-3">
                      <div className="flex items-center">
                        <p className="text-sm font-medium text-gray-900">{file.file_name}</p>
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatDate(file.uploaded_at)} • {formatFileSize(file.file_size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => handleViewFile(file)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      aria-label={`View ${file.file_name}`}
                    >
                      <FiEye className="mr-1 h-4 w-4" />
                      <span className="hidden sm:inline">View</span>
                    </button>
                    <button
                      onClick={() => handleFileDelete(file)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      aria-label={`Delete ${file.file_name}`}
                      disabled={isDeleting}
                    >
                      <FiTrash2 className="mr-1 h-4 w-4" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-6">
              <FiUpload className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No files uploaded</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload medical records, x-rays, or other documents for your dental care.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* File Preview Modal - SIMPLIFIED VERSION */}
      {filePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                {filePreview.file_name}
                <span className="ml-2 text-sm text-gray-500">
                  ({formatFileSize(filePreview.file_size)})
                </span>
              </h3>
              <button
                onClick={closeFilePreview}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4 relative">
              {!fileData ? (
                // Loading state
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-center text-gray-600">Loading file data...</p>
                </div>
              ) : (
                // File preview based on type
                <div className="flex flex-col items-center justify-center">
                  {isFileType(filePreview, 'image') ? (
                    // Image Viewer
                    <img 
                      src={createViewUrl(fileData)}
                      alt={filePreview.file_name}
                      className="max-w-full max-h-[70vh] object-contain"
                    />
                  ) : isFileType(filePreview, 'pdf') ? (
                    // PDF Viewer
                    <object
                      data={createViewUrl(fileData)}
                      type="application/pdf"
                      width="100%"
                      height="70vh"
                      className="w-full h-[70vh] border border-gray-200"
                    >
                      <p className="text-center p-4">
                        Your browser doesn't support embedded PDF viewing. 
                        <button 
                          onClick={() => saveFile(fileData, filePreview.file_name)}
                          className="ml-2 text-primary-600 hover:underline"
                        >
                          Click here to download the PDF.
                        </button>
                      </p>
                    </object>
                  ) : isFileType(filePreview, 'word') ? (
                    // Word Document Viewer (simple preview)
                    <div className="w-full h-[70vh] bg-gray-100 p-6 flex flex-col items-center justify-center">
                      <FiFileText className="h-16 w-16 text-blue-600 mb-4" />
                      <h4 className="text-xl font-medium mb-2">Word Document</h4>
                      <p className="text-gray-600 mb-4">
                        Word documents can't be previewed directly in browser.
                      </p>
                      <button
                        onClick={() => saveFile(fileData, filePreview.file_name)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                      >
                        <FiDownload className="inline mr-2" />
                        Download Document
                      </button>
                    </div>
                  ) : isFileType(filePreview, 'text') ? (
                    // Text File Viewer
                    <div className="w-full h-[70vh] overflow-auto bg-gray-50 p-4 font-mono text-sm border border-gray-200 rounded">
                      <TextViewer blob={fileData} />
                    </div>
                  ) : (
                    // Generic File Type with download button
                    <div className="w-full h-64 bg-gray-100 p-6 flex flex-col items-center justify-center">
                      <FiFileText className="h-16 w-16 text-gray-600 mb-4" />
                      <h4 className="text-xl font-medium mb-2">File Ready</h4>
                      <p className="text-gray-600 mb-4">
                        This file type cannot be previewed in browser.
                      </p>
                      <button
                        onClick={() => saveFile(fileData, filePreview.file_name)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                      >
                        <FiDownload className="inline mr-2" />
                        Download File
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Simplified Action Buttons */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex justify-center space-x-4">
                {fileData && (
                  <>
                    <button
                      onClick={() => saveFile(fileData, filePreview.file_name)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      <FiDownload className="mr-2 h-5 w-5" />
                      Download
                    </button>
                    
                    <button
                      onClick={() => handleFileDelete(filePreview)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <FiTrash2 className="mr-2 h-5 w-5 text-red-500" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Deletion</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete the file "{fileToDelete.file_name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelFileDelete}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmFileDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-300"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;