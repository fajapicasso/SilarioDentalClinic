// src/components/layouts/Header.jsx - Updated with Mobile Navigation and NotificationBell
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useClinic } from '../../contexts/ClinicContext';
import supabase from '../../config/supabaseClient';
import { FiUser, FiLogOut, FiSettings, FiAlertCircle, FiMenu, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import NotificationBell from '../common/NotificationBell';
import logo from '../../assets/Logo.png';

const Header = ({ role, isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const { user, logout } = useAuth();
  const { clinicInfo } = useClinic();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [archivedUsersCount, setArchivedUsersCount] = useState(0);

  useEffect(() => {
    fetchProfileData();
    if (role === 'admin') {
      checkArchivedUsers();
    }
  }, [user, role]);

  const fetchProfileData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, role, profile_picture_url')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfileData(data);
      console.log('Fetched profileData:', data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const checkArchivedUsers = async () => {
    try {
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' })
        .eq('disabled', true);

      if (error) throw error;
      setArchivedUsersCount(count || 0);
    } catch (error) {
      console.error('Error checking archived users:', error);
    }
  };

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      navigate('/login');
    }
  };

  const roleColors = {
    admin: 'bg-red-100 text-red-800',
    doctor: 'bg-blue-100 text-blue-800',
    staff: 'bg-purple-100 text-purple-800',
    patient: 'bg-green-100 text-green-800'
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 relative z-40">
      <div className="px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Mobile Menu Button and Logo - Only visible on mobile */}
          <div className="lg:hidden flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen?.(!isMobileMenuOpen)}
              className="p-2 rounded-md text-gray-600 hover:text-primary-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
            </button>
            <div className="flex items-center min-w-0">
              <img 
                src={logo}
                alt={`${clinicInfo?.clinicName} Logo`}
                className="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0"
              />
              <h1 className="ml-1.5 sm:ml-2 text-sm sm:text-lg font-bold text-primary-600 truncate">
                {clinicInfo?.clinicName}
              </h1>
            </div>
          </div>

          {/* Desktop Welcome Message - Hidden on mobile */}
          <div className="hidden lg:flex items-center">
            <h2 className="text-xl font-semibold text-gray-800">
              Welcome back, {profileData?.full_name || ''}
            </h2>
            <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${roleColors[role] || 'bg-gray-100 text-gray-800'}`}>
              {role?.charAt(0).toUpperCase() + role?.slice(1)}
            </span>
          </div>
          
          {/* Mobile Welcome Message - Optimized for small screens */}
          <div className="lg:hidden flex items-center min-w-0 flex-1 mx-2 sm:mx-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-xs sm:text-sm font-medium text-gray-800 truncate">
                Hi, {profileData?.full_name?.split(' ')[0] || 'User'}!
              </h2>
              <span className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded-full ${roleColors[role] || 'bg-gray-100 text-gray-800'}`}>
                {role?.charAt(0).toUpperCase() + role?.slice(1)}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Admin archived users notification - Hidden on small mobile */}
            {role === 'admin' && archivedUsersCount > 0 && (
              <div 
                className="hidden sm:flex items-center px-2 sm:px-3 py-1 bg-red-100 text-red-800 rounded-md cursor-pointer border border-red-200"
                onClick={() => navigate('/admin/users')}
                title={`${archivedUsersCount} archived users`}
              >
                <FiAlertCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">{archivedUsersCount} Archived</span>
                <span className="text-xs font-medium sm:hidden">{archivedUsersCount}</span>
              </div>
            )}

            {/* Notification Bell - Responsive sizing */}
            <div className="scale-90 sm:scale-100">
              <NotificationBell />
            </div>

            {/* User Menu - Responsive sizing */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600 text-white font-bold text-sm sm:text-lg uppercase focus:outline-none overflow-hidden border-2 border-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
              >
                {profileData?.profile_picture_url ? (
                  <img
                    src={`${profileData.profile_picture_url}?t=${Date.now()}`}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`w-full h-full bg-blue-600 flex items-center justify-center ${profileData?.profile_picture_url ? 'hidden' : ''}`}>
                {(() => {
                  if (!role) return 'U';
                  switch (role) {
                    case 'admin': return 'A';
                    case 'doctor': return 'D';
                    case 'staff': return 'S';
                    case 'patient': return 'P';
                    default: return 'U';
                  }
                })()}
                </div>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-44 sm:w-48 bg-white rounded-md shadow-lg z-50 border border-blue-300">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        navigate(`/${role}/settings`);
                      }}
                      className="flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                    >
                      <FiSettings className="mr-2 sm:mr-3 w-3 h-3 sm:w-4 sm:h-4" />
                      Settings
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        handleLogout();
                      }}
                      className="flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                    >
                      <FiLogOut className="mr-2 sm:mr-3 w-3 h-3 sm:w-4 sm:h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;