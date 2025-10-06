// src/pages/admin/UserManagement.jsx - Updated with Archive System
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../config/supabaseClient';
import { toast } from 'react-toastify';
import { useUniversalAudit } from '../../hooks/useUniversalAudit';
import { 
  FiUsers, FiUserPlus, FiEdit, FiSearch, 
  FiRefreshCw, FiCheck, FiX, FiEye, FiEyeOff,
  FiLock, FiUserX, FiUserCheck, FiAlertTriangle,
  FiMail, FiArchive, FiUser, FiBarChart2
} from 'react-icons/fi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Link } from 'react-router-dom';

const UserManagement = () => {
  const { user, requestPasswordResetToken } = useAuth();
  const { logPageView, logUserView, logUserCreate, logUserUpdate, logUserApproval, logUserDelete } = useUniversalAudit();
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [activeSection, setActiveSection] = useState('active'); // 'active' or 'archive'
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isViewingDetails, setIsViewingDetails] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isDisablingUser, setIsDisablingUser] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Form States
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    full_name: '',
    role: 'patient',
    phone: '',
    street: '',
    barangay: '',
    city: '',
    province: '',
    address: '',
    password: '',
    confirm_password: '',
  });

  // Fetch all users
  useEffect(() => {
    fetchUsers();
    // Log page view
    logPageView('User Management', 'user_management', 'management');
  }, [logPageView]);

  // Filter users based on active tab, section, and search query
  useEffect(() => {
    filterUsers();
  }, [activeTab, activeSection, searchQuery, users]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Get all profiles with disabled status and profile pictures
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*, profile_picture_url')
        .order('created_at', { ascending: false });
      
      if (profilesError) throw profilesError;
      
      // Process profiles data and keep the disabled status if it exists
      const processedUsers = profilesData.map(profile => ({
        ...profile,
        // If disabled property exists in database, use it, otherwise default to false
        disabled: profile.disabled === true
      }));
      
      setUsers(processedUsers || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];
    
    // First filter by active/archive section
    if (activeSection === 'active') {
      filtered = filtered.filter(user => !user.disabled);
    } else if (activeSection === 'archive') {
      filtered = filtered.filter(user => user.disabled);
    }
    
    // Then filter by role (tab) - only if not showing all
    if (activeTab !== 'all') {
      filtered = filtered.filter(user => user.role === activeTab);
    }
    
    // Finally filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.full_name.toLowerCase().includes(query) ||
        user.first_name?.toLowerCase().includes(query) ||
        user.middle_name?.toLowerCase().includes(query) ||
        user.last_name?.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.phone && user.phone.includes(query))
      );
    }
    
    setFilteredUsers(filtered);
  };

  const handleAddUser = async () => {
    // Validate form data
    if (!formData.email || !formData.first_name || !formData.last_name || !formData.role || !formData.password || !formData.confirm_password) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    // Validate password confirmation
    if (formData.password !== formData.confirm_password) {
      toast.error('Password and confirm password do not match');
      return;
    }
    
    // Validate password strength
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Check if user already exists to avoid duplicates
      const { data: existingUsers, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', formData.email);
      
      if (checkError) throw checkError;
      
      if (existingUsers && existingUsers.length > 0) {
        toast.error('A user with this email already exists');
        return;
      }
      
      // Combine atomic name fields for backward compatibility - ensure never null
      const fullName = [formData.first_name, formData.middle_name, formData.last_name].filter(Boolean).join(' ') || formData.email.split('@')[0];
      
      // Combine atomic address fields for backward compatibility
      const address = [formData.street, formData.barangay, formData.city, formData.province].filter(Boolean).join(', ');
      
      // Create user with Supabase auth (trigger will create comprehensive profile)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            // Core identity
            full_name: fullName,
            first_name: formData.first_name || '',
            middle_name: formData.middle_name || '',
            last_name: formData.last_name || '',
            // Contact information
            phone: formData.phone || '',
            // Address information (both atomic and combined)
            address: address || '',
            street: formData.street || '',
            barangay: formData.barangay || '',
            city: formData.city || '',
            province: formData.province || '',
            // System fields
            role: formData.role
          }
        }
      });
      
      if (authError) {
        console.error('Auth creation error:', authError);
        throw authError;
      }
      
      // Wait for trigger to complete, then update with enhanced profile data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update the profile with additional details via simple secure RPC
      // Try enhanced function first, fallback to simple function if it doesn't exist
      let profileError = null;
      
      try {
        const { error } = await supabase.rpc('admin_upsert_profile_enhanced', {
          p_profile_id: authData.user.id,
          p_email: formData.email,
          p_first_name: formData.first_name || null,
          p_middle_name: formData.middle_name || null,
          p_last_name: formData.last_name || null,
          p_phone: formData.phone || null,
          p_street: formData.street || null,
          p_barangay: formData.barangay || null,
          p_city: formData.city || null,
          p_province: formData.province || null,
          p_birthday: null,
          p_age: null,
          p_gender: null,
          p_role: formData.role
        });
        profileError = error;
      } catch (enhancedError) {
        // If enhanced function doesn't exist, try simple function
        console.log("Enhanced function not found, trying simple function");
        const { error } = await supabase.rpc('admin_upsert_profile_simple', {
          p_profile_id: authData.user.id,
          p_email: formData.email,
          p_first_name: formData.first_name || null,
          p_middle_name: formData.middle_name || null,
          p_last_name: formData.last_name || null,
          p_phone: formData.phone || null,
          p_street: formData.street || null,
          p_barangay: formData.barangay || null,
          p_city: formData.city || null,
          p_province: formData.province || null,
          p_role: formData.role
        });
        profileError = error;
      }
      
      if (profileError) {
        console.error('Profile update error:', profileError);
        throw profileError;
      }
      
      // Log audit event for user creation
      try {
        await logUserCreate({
          id: authData.user.id,
          email: formData.email,
          full_name: fullName,
          first_name: formData.first_name,
          middle_name: formData.middle_name,
          last_name: formData.last_name,
          phone: formData.phone,
          role: formData.role,
          address: address
        });
      } catch (auditError) {
        console.error('Error logging user creation audit event:', auditError);
        // Continue even if audit logging fails
      }

      toast.success('User created successfully. A confirmation email has been sent to the user.');
      setIsAddingUser(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error(`Failed to create user: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser || !formData.first_name || !formData.last_name || !formData.role) {
      toast.error('Please fill in all required fields (First Name, Last Name, and Role)');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Combine atomic name fields for backward compatibility - ensure never null
      const fullName = [formData.first_name, formData.middle_name, formData.last_name].filter(Boolean).join(' ') || selectedUser.email.split('@')[0];
      
      // Combine atomic address fields for backward compatibility
      const address = [formData.street, formData.barangay, formData.city, formData.province].filter(Boolean).join(', ');
      
      // Update the profile with atomic fields
      const { error } = await supabase
        .from('profiles')
        .update({
          // Atomic name fields
          first_name: formData.first_name,
          middle_name: formData.middle_name,
          last_name: formData.last_name,
          // Backward compatibility
          full_name: fullName,
          // Atomic address fields
          street: formData.street,
          barangay: formData.barangay,
          city: formData.city,
          province: formData.province,
          // Backward compatibility
          address: address,
          // Other fields
          role: formData.role,
          phone: formData.phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedUser.id);
      
      if (error) throw error;

      // Log audit event for user update
      try {
        await logUserUpdate(selectedUser.id, selectedUser, {
          ...selectedUser,
          first_name: formData.first_name,
          middle_name: formData.middle_name,
          last_name: formData.last_name,
          full_name: fullName,
          street: formData.street,
          barangay: formData.barangay,
          city: formData.city,
          province: formData.province,
          address: address,
          role: formData.role,
          phone: formData.phone
        });
      } catch (auditError) {
        console.error('Error logging user update audit event:', auditError);
        // Continue even if audit logging fails
      }
      
      toast.success('User updated successfully');
      setIsEditingUser(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error(`Failed to update user: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisableUser = async () => {
    if (!selectedUser) return;
    
    setIsProcessing(true);
    
    try {
      // Check if the disabled column exists in profiles table
      const { data: checkData, error: checkError } = await supabase
        .from('profiles')
        .select('disabled')
        .eq('id', selectedUser.id)
        .limit(1);
      
      // Handle case where column doesn't exist
      if (checkError && checkError.code === 'PGRST116') {
        const sqlCommand = "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;";
        
        toast.error('The "disabled" column is missing from profiles table. Database update required.');
        
        // Show SQL command to run
        alert(
          "Database Schema Update Required:\n\n" +
          "Please run the following SQL in your Supabase SQL Editor:\n\n" +
          sqlCommand +
          "\n\nAfter running this SQL command, refresh this page and try again."
        );
        
        return;
      }
      
      // Update the user's disabled status
      const { error } = await supabase
        .from('profiles')
        .update({
          disabled: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedUser.id);
      
      if (error) throw error;
      
      toast.success(`${selectedUser.full_name} has been archived successfully`);
      setIsDisablingUser(false);
      
      // Update the user in the local state
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === selectedUser.id ? {...u, disabled: true} : u
        )
      );
    } catch (error) {
      console.error('Error disabling user:', error);
      toast.error(`Failed to archive user: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEnableUser = async (userId) => {
    setIsProcessing(true);
    
    try {
      // First find user details for the success message
      const user = users.find(u => u.id === userId);
      
      // Update the user status in profiles table
      const { error } = await supabase
        .from('profiles')
        .update({
          disabled: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (error) {
        if (error.code === 'PGRST116') {
          toast.error('Failed to restore user. The "disabled" column needs to be added to the profiles table.');
          return;
        } else {
          throw error;
        }
      }
      
      toast.success(`${user?.full_name || 'User'} has been restored from archive successfully`);
      
      // Update the user locally without refetching
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === userId ? {...u, disabled: false} : u
        )
      );
    } catch (error) {
      console.error('Error enabling user:', error);
      toast.error(`Failed to restore user: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Updated to use token-based password reset system
  const handleResetPassword = async () => {
    if (!selectedUser || !selectedUser.email) {
      toast.error('User email is required');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Use the new token-based password reset system
      const { success, error, message } = await requestPasswordResetToken(selectedUser.email);
      
      if (success) {
        toast.success(`6-digit reset code sent to ${selectedUser.email}`);
        setIsResettingPassword(false);
      } else {
        throw new Error(error || 'Failed to send reset code');
      }
    } catch (error) {
      console.error('Error sending password reset token:', error);
      toast.error(`Failed to send reset code: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      full_name: '',
      role: 'patient',
      phone: '',
      street: '',
      barangay: '',
      city: '',
      province: '',
      address: '',
      password: '',
      confirm_password: '',
    });
    // Reset password visibility states
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // Get counts for display
  const getActiveUserCount = () => users.filter(user => !user.disabled).length;
  const getArchivedUserCount = () => users.filter(user => user.disabled).length;

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
            <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
              <span>Active Users: {getActiveUserCount()}</span>
              <span>•</span>
              <span>Archived Users: {getArchivedUserCount()}</span>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                resetForm();
                setIsAddingUser(true);
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <div className="flex items-center">
                <FiUserPlus className="mr-2" />
                <span>Add New User</span>
              </div>
            </button>
            <button
              onClick={fetchUsers}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 text-gray-500"
              title="Refresh"
            >
              <FiRefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Section Toggle (Active/Archive) */}
        <div className="flex justify-center mb-6">
          <div className="bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveSection('active')}
              className={`px-6 py-2 rounded-md font-medium text-sm transition-all ${
                activeSection === 'active'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center">
                <FiUsers className="mr-2" />
                Active Users ({getActiveUserCount()})
              </div>
            </button>
            <button
              onClick={() => setActiveSection('archive')}
              className={`px-6 py-2 rounded-md font-medium text-sm transition-all ${
                activeSection === 'archive'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center">
                <FiArchive className="mr-2" />
                Archive ({getArchivedUserCount()})
              </div>
            </button>
          </div>
        </div>

        {/* User Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-3 sm:space-y-0">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 font-medium text-sm rounded-md mr-2 ${
                activeTab === 'all'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Users
            </button>
            <button
              onClick={() => setActiveTab('doctor')}
              className={`px-4 py-2 font-medium text-sm rounded-md mr-2 ${
                activeTab === 'doctor'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Doctors
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className={`px-4 py-2 font-medium text-sm rounded-md mr-2 ${
                activeTab === 'staff'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Staff
            </button>
            <button
              onClick={() => setActiveTab('patient')}
              className={`px-4 py-2 font-medium text-sm rounded-md mr-2 ${
                activeTab === 'patient'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Patients
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 font-medium text-sm rounded-md ${
                activeTab === 'admin'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Admins
            </button>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={`Search ${activeSection} users...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* User List */}
        <div className={`bg-white overflow-hidden border rounded-lg ${
          activeSection === 'archive' 
            ? 'border-orange-200 bg-orange-50' 
            : 'border-gray-200'
        }`}>
          <div className={`px-4 py-5 sm:px-6 flex justify-between items-center ${
            activeSection === 'archive' 
              ? 'bg-orange-100' 
              : 'bg-gray-50'
          }`}>
            <div>
              <h3 className={`text-lg leading-6 font-medium ${
                activeSection === 'archive' 
                  ? 'text-orange-900' 
                  : 'text-gray-900'
              }`}>
                {activeSection === 'archive' ? (
                  <div className="flex items-center">
                    <FiArchive className="mr-2" />
                    Archived Users
                  </div>
                ) : (
                  <div className="flex items-center">
                    <FiUsers className="mr-2" />
                    {activeTab === 'all' ? 'Active Users' : 
                     activeTab === 'doctor' ? 'Active Doctors' :
                     activeTab === 'staff' ? 'Active Staff' :
                     activeTab === 'patient' ? 'Active Patients' : 'Active Admins'}
                  </div>
                )}
              </h3>
              <p className={`mt-1 max-w-2xl text-sm ${
                activeSection === 'archive' 
                  ? 'text-orange-700' 
                  : 'text-gray-500'
              }`}>
                {filteredUsers.length} users found
                {activeSection === 'archive' && ' (These users are disabled and cannot log in)'}
              </p>
            </div>
          </div>
          
          {filteredUsers.length === 0 ? (
            <div className="p-6 text-center">
              <div className={`${activeSection === 'archive' ? 'text-orange-600' : 'text-gray-500'}`}>
                {activeSection === 'archive' ? (
                  <div>
                    <FiArchive className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No archived users found.</p>
                    <p className="text-sm mt-1">Users who are disabled will appear here.</p>
                  </div>
                ) : (
                  <p>No active users found matching your criteria.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={activeSection === 'archive' ? 'bg-orange-50' : 'bg-gray-50'}>
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className={`hover:bg-gray-50 ${
                      activeSection === 'archive' ? 'opacity-75' : ''
                    }`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-10 w-10 rounded-full overflow-hidden border-2 border-white shadow-md ${
                            activeSection === 'archive' 
                              ? 'border-orange-200' 
                              : 'border-gray-200'
                          }`}>
                            {user.profile_picture_url ? (
                              <img
                                src={`${user.profile_picture_url}?t=${Date.now()}`}
                                alt={user.full_name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full flex items-center justify-center ${
                              user.profile_picture_url ? 'hidden' : ''
                            } ${
                              activeSection === 'archive' 
                                ? 'bg-orange-400 text-white' 
                              : 'bg-primary-100 text-primary-600'
                          }`}>
                            <span className="font-medium text-lg">
                              {user.full_name.charAt(0).toUpperCase()}
                            </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {[user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || user.full_name}
                            </div>
                            <div className="text-sm text-gray-500">{user.phone || 'No phone'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${user.role === 'doctor' ? 'bg-blue-100 text-blue-800' : 
                            user.role === 'staff' ? 'bg-purple-100 text-purple-800' :
                            user.role === 'admin' ? 'bg-red-100 text-red-800' :
                            'bg-green-100 text-green-800'}`}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          activeSection === 'archive'
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {activeSection === 'archive' ? 'Archived' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setIsViewingDetails(true);
                            }}
                            className="text-primary-600 hover:text-primary-900"
                            title="View Details"
                          >
                            <FiEye className="h-5 w-5" />
                          </button>
                          
                          {activeSection === 'active' ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setFormData({
                                    ...formData,
                                    full_name: user.full_name,
                                    role: user.role,
                                    phone: user.phone || '',
                                    address: user.address || '',
                                    // Atomic name fields
                                    first_name: user.first_name || '',
                                    middle_name: user.middle_name || '',
                                    last_name: user.last_name || '',
                                    // Atomic address fields
                                    street: user.street || '',
                                    barangay: user.barangay || '',
                                    city: user.city || '',
                                    province: user.province || '',
                                  });
                                  setIsEditingUser(true);
                                }}
                                className="text-blue-600 hover:text-blue-900"
                                title="Edit User"
                              >
                                <FiEdit className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setIsResettingPassword(true);
                                }}
                                className="text-yellow-600 hover:text-yellow-900"
                                title="Reset Password"
                              >
                                <FiLock className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setIsDisablingUser(true);
                                }}
                                className="text-orange-600 hover:text-orange-900"
                                title="Archive User"
                                disabled={isProcessing}
                              >
                                <FiArchive className="h-5 w-5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleEnableUser(user.id)}
                              className="text-green-600 hover:text-green-900"
                              title="Restore User"
                              disabled={isProcessing}
                            >
                              <FiUserCheck className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {/* Add User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Add New User</h2>
              <button 
                onClick={() => setIsAddingUser(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Account Information */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                          {showPassword ? (
                            <FiEyeOff className="h-5 w-5" />
                          ) : (
                            <FiEye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <input
                        id="confirm_password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirm_password || ''}
                        onChange={(e) => setFormData({...formData, confirm_password: e.target.value})}
                        className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                          {showConfirmPassword ? (
                            <FiEyeOff className="h-5 w-5" />
                          ) : (
                            <FiEye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                      Role *
                    </label>
                    <select
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      required
                    >
                      <option value="">Select Role</option>
                      <option value="patient">Patient</option>
                      <option value="doctor">Doctor</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      id="phone"
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                {/* Right Column - Name and Address */}
                <div className="space-y-4">
                  {/* Atomic Name Fields */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Name Information</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label htmlFor="add_first_name" className="block text-xs font-medium text-gray-500">
                          First Name *
                        </label>
                        <input
                          id="add_first_name"
                          type="text"
                          value={formData.first_name || ''}
                          onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                          required
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="add_middle_name" className="block text-xs font-medium text-gray-500">
                          Middle Name
                        </label>
                        <input
                          id="add_middle_name"
                          type="text"
                          value={formData.middle_name || ''}
                          onChange={(e) => setFormData({...formData, middle_name: e.target.value})}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="add_last_name" className="block text-xs font-medium text-gray-500">
                          Last Name *
                        </label>
                        <input
                          id="add_last_name"
                          type="text"
                          value={formData.last_name || ''}
                          onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                          required
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Atomic Address Fields */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Address Information</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label htmlFor="add_street" className="block text-xs font-medium text-gray-500">
                          Street *
                        </label>
                        <input
                          id="add_street"
                          type="text"
                          value={formData.street || ''}
                          onChange={(e) => setFormData({...formData, street: e.target.value})}
                          required
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="add_barangay" className="block text-xs font-medium text-gray-500">
                          Barangay *
                        </label>
                        <input
                          id="add_barangay"
                          type="text"
                          value={formData.barangay || ''}
                          onChange={(e) => setFormData({...formData, barangay: e.target.value})}
                          required
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="add_city" className="block text-xs font-medium text-gray-500">
                          City *
                        </label>
                        <input
                          id="add_city"
                          type="text"
                          value={formData.city || ''}
                          onChange={(e) => setFormData({...formData, city: e.target.value})}
                          required
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="add_province" className="block text-xs font-medium text-gray-500">
                          Province *
                        </label>
                        <input
                          id="add_province"
                          type="text"
                          value={formData.province || ''}
                          onChange={(e) => setFormData({...formData, province: e.target.value})}
                          required
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setIsAddingUser(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:bg-primary-400"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Adding...
                    </div>
                  ) : (
                    'Add User'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditingUser && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Edit User</h2>
              <button 
                onClick={() => setIsEditingUser(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Basic Information */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={selectedUser.email}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                      disabled
                    />
                    <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                  </div>
                  
                  <div>
                    <label htmlFor="edit_role" className="block text-sm font-medium text-gray-700 mb-1">
                      Role *
                    </label>
                    <select
                      id="edit_role"
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      required
                    >
                      <option value="patient">Patient</option>
                      <option value="doctor">Doctor</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="edit_phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      id="edit_phone"
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600">
                      Status: <span className={`font-medium ${!selectedUser.disabled ? 'text-green-600' : 'text-red-600'}`}>
                        {!selectedUser.disabled ? 'Active' : 'Disabled'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Account status can be changed from the user list page
                    </p>
                  </div>
                </div>

                {/* Right Column - Name and Address */}
                <div className="space-y-4">
                  {/* Atomic Name Fields */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Name Information</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label htmlFor="edit_first_name" className="block text-xs font-medium text-gray-500">
                          First Name *
                        </label>
                        <input
                          id="edit_first_name"
                          type="text"
                          value={formData.first_name || ''}
                          onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                          required
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit_middle_name" className="block text-xs font-medium text-gray-500">
                          Middle Name
                        </label>
                        <input
                          id="edit_middle_name"
                          type="text"
                          value={formData.middle_name || ''}
                          onChange={(e) => setFormData({...formData, middle_name: e.target.value})}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit_last_name" className="block text-xs font-medium text-gray-500">
                          Last Name *
                        </label>
                        <input
                          id="edit_last_name"
                          type="text"
                          value={formData.last_name || ''}
                          onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                          required
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Atomic Address Fields */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Address Information</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label htmlFor="edit_street" className="block text-xs font-medium text-gray-500">
                          Street *
                        </label>
                        <input
                          id="edit_street"
                          type="text"
                          value={formData.street || ''}
                          onChange={(e) => setFormData({...formData, street: e.target.value})}
                          required
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit_barangay" className="block text-xs font-medium text-gray-500">
                          Barangay *
                        </label>
                        <input
                          id="edit_barangay"
                          type="text"
                          value={formData.barangay || ''}
                          onChange={(e) => setFormData({...formData, barangay: e.target.value})}
                          required
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit_city" className="block text-xs font-medium text-gray-500">
                          City/Municipality *
                        </label>
                        <input
                          id="edit_city"
                          type="text"
                          value={formData.city || ''}
                          onChange={(e) => setFormData({...formData, city: e.target.value})}
                          required
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit_province" className="block text-xs font-medium text-gray-500">
                          Province *
                        </label>
                        <input
                          id="edit_province"
                          type="text"
                          value={formData.province || ''}
                          onChange={(e) => setFormData({...formData, province: e.target.value})}
                          required
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setIsEditingUser(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateUser}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:bg-primary-400"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Updating...
                    </div>
                  ) : (
                    'Update User'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View User Details Modal */}
      {isViewingDetails && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-semibold text-gray-800">User Details</h2>
              <button 
                onClick={() => setIsViewingDetails(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Basic Info */}
              <div className="space-y-6">
                {/* Profile Header */}
                <div className="flex items-center bg-gray-50 p-4 rounded-lg">
                  <div className="flex-shrink-0 h-20 w-20 rounded-full overflow-hidden border-2 border-gray-200 shadow-md">
                    {selectedUser.profile_picture_url ? (
                      <img
                        src={`${selectedUser.profile_picture_url}?t=${Date.now()}`}
                        alt={selectedUser.full_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full bg-primary-100 text-primary-600 flex items-center justify-center ${selectedUser.profile_picture_url ? 'hidden' : ''}`}>
                      <span className="font-medium text-3xl">
                        {selectedUser.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-xl font-medium text-gray-900">
                      {[selectedUser.first_name, selectedUser.middle_name, selectedUser.last_name].filter(Boolean).join(' ') || selectedUser.full_name}
                    </h3>
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                      selectedUser.role === 'doctor' ? 'bg-blue-100 text-blue-800' : 
                      selectedUser.role === 'staff' ? 'bg-purple-100 text-purple-800' :
                      selectedUser.role === 'admin' ? 'bg-red-100 text-red-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}
                    </span>
                    <div className="mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        !selectedUser.disabled 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {!selectedUser.disabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>

                                 {/* Personal Information */}
                 <div className="bg-gray-50 p-4 rounded-lg">
                   <h4 className="text-sm font-medium text-gray-700 mb-3">Personal Information</h4>
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <span className="block text-xs font-medium text-gray-500">Email</span>
                       <span className="block text-sm text-gray-900 mt-1">{selectedUser.email}</span>
                     </div>
                     <div>
                       <span className="block text-xs font-medium text-gray-500">Phone</span>
                       <span className="block text-sm text-gray-900 mt-1">{selectedUser.phone || 'Not provided'}</span>
                     </div>
                     {selectedUser.role === 'patient' && (
                       <>
                         <div>
                           <span className="block text-xs font-medium text-gray-500">Nickname</span>
                           <span className="block text-sm text-gray-900 mt-1">{selectedUser.nickname || 'Not provided'}</span>
                         </div>
                         <div>
                           <span className="block text-xs font-medium text-gray-500">Nationality</span>
                           <span className="block text-sm text-gray-900 mt-1">{selectedUser.nationality || 'Not provided'}</span>
                         </div>
                       </>
                     )}
                     <div>
                       <span className="block text-xs font-medium text-gray-500">Birthday</span>
                       <span className="block text-sm text-gray-900 mt-1">
                         {selectedUser.birthday ? (
                           <>
                             {new Date(selectedUser.birthday).toLocaleDateString()}
                             {selectedUser.age && ` (${selectedUser.age} years old)`}
                           </>
                         ) : 'Not provided'}
                       </span>
                     </div>
                     <div>
                       <span className="block text-xs font-medium text-gray-500">Gender</span>
                       <span className="block text-sm text-gray-900 mt-1">
                         {selectedUser.gender ? selectedUser.gender.charAt(0).toUpperCase() + selectedUser.gender.slice(1) : 'Not specified'}
                       </span>
                     </div>
                     <div>
                       <span className="block text-xs font-medium text-gray-500">Occupation</span>
                       <span className="block text-sm text-gray-900 mt-1">{selectedUser.occupation || 'Not provided'}</span>
                     </div>
                   </div>
                 </div>

                {/* Address Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Address Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-xs font-medium text-gray-500">Street</span>
                      <span className="block text-sm text-gray-900 mt-1">{selectedUser.street || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-500">Barangay</span>
                      <span className="block text-sm text-gray-900 mt-1">{selectedUser.barangay || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-500">City/Municipality</span>
                      <span className="block text-sm text-gray-900 mt-1">{selectedUser.city || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-500">Province</span>
                      <span className="block text-sm text-gray-900 mt-1">{selectedUser.province || 'Not provided'}</span>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Emergency Contact</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-xs font-medium text-gray-500">Contact Name</span>
                      <span className="block text-sm text-gray-900 mt-1">{selectedUser.emergency_contact_name || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-500">Contact Phone</span>
                      <span className="block text-sm text-gray-900 mt-1">{selectedUser.emergency_contact_phone || 'Not provided'}</span>
                    </div>
                  </div>
                </div>
              </div>

                             {/* Right Column - Additional Info & Certificates */}
               <div className="space-y-6">
                 {/* Certificates & IDs Section */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Certificates & IDs</h4>
                  {selectedUser.certificate_url ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FiUser className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Uploaded Certificate/ID</p>
                            <p className="text-xs text-gray-500">Click to view</p>
                          </div>
                        </div>
                        <button
                          onClick={() => window.open(selectedUser.certificate_url, '_blank')}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                        >
                          View
                        </button>
                      </div>
                      <div className="mt-2">
                        <img
                          src={selectedUser.certificate_url}
                          alt="Certificate/ID"
                          className="w-full h-48 object-contain border border-gray-200 rounded-lg bg-white"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className="hidden w-full h-48 border border-gray-200 rounded-lg bg-gray-100 flex items-center justify-center">
                          <div className="text-center">
                            <FiUser className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-xs text-gray-500">Certificate/ID Image</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FiUser className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">No certificates or IDs uploaded</p>
                      <p className="text-xs text-gray-400 mt-1">User has not uploaded any certificates or identification documents</p>
                    </div>
                  )}
                </div>

                {/* Account Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Account Information</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="block text-xs font-medium text-gray-500">Created At</span>
                      <span className="block text-sm text-gray-900 mt-1">
                        {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString() : 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-500">Last Updated</span>
                      <span className="block text-sm text-gray-900 mt-1">
                        {selectedUser.updated_at ? new Date(selectedUser.updated_at).toLocaleString() : 'Not available'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsViewingDetails(false);
                  setFormData({
                    ...formData,
                    full_name: selectedUser.full_name,
                    role: selectedUser.role,
                    phone: selectedUser.phone || '',
                    address: selectedUser.address || '',
                    // Atomic name fields
                    first_name: selectedUser.first_name || '',
                    middle_name: selectedUser.middle_name || '',
                    last_name: selectedUser.last_name || '',
                    // Atomic address fields
                    street: selectedUser.street || '',
                    barangay: selectedUser.barangay || '',
                    city: selectedUser.city || '',
                    province: selectedUser.province || '',
                  });
                  setIsEditingUser(true);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center"
              >
                <FiEdit className="mr-2" />
                Edit User
              </button>
              <button
                onClick={() => setIsViewingDetails(false)}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResettingPassword && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Reset Password</h2>
              <button 
                onClick={() => setIsResettingPassword(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
            
            <div>
              <p className="text-gray-600 mb-4">
                You are about to send a password reset code to <span className="font-semibold">{selectedUser.full_name}</span>.
              </p>
              
              <div className="p-4 bg-blue-50 rounded-md border border-blue-100 mb-4 flex items-start">
                <FiMail className="text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm text-blue-800">
                    A 6-digit reset code will be sent to:
                  </p>
                  <p className="text-sm font-medium mt-1">{selectedUser.email}</p>
                  <p className="text-sm text-blue-600 mt-2">
                    Note: The user will receive an email with a 6-digit code and a link to reset their password. The code expires in 15 minutes.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsResettingPassword(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:bg-primary-400"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Sending...
                  </div>
                ) : (
                  'Send Reset Code'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
 {/* Disable User Confirmation Modal - Updated */}
      {isDisablingUser && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Archive User</h2>
              <button 
                onClick={() => setIsDisablingUser(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
            
            <div>
              <p className="text-gray-600 mb-4">
                Are you sure you want to archive <span className="font-semibold">{selectedUser.full_name}</span>? 
                This will move them to the archive and prevent them from logging in.
              </p>
              
              <div className="p-3 bg-orange-50 rounded-md border border-orange-100 mb-4">
                <p className="text-sm text-orange-800">
                  <FiArchive className="h-4 w-4 text-orange-600 inline-block mr-1" />
                  Archived users cannot log in or access the system. 
                  You can restore them from the archive later if needed.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsDisablingUser(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleDisableUser}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:bg-orange-400"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Archiving...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <FiArchive className="mr-2" />
                    Archive User
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      
    </div>
  );
};

export default UserManagement;