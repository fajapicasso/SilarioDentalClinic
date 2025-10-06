// src/components/layouts/Sidebar.jsx (Updated)
import { useState } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useClinic } from '../../contexts/ClinicContext';
import { 
  FiHome, FiUsers, FiCalendar, FiList, 
  FiGrid, FiBarChart2, FiSettings, FiClipboard,
  FiUser, FiCreditCard, FiClock, FiFileText, FiAlertCircle, FiHeart,
  FiChevronDown, FiChevronRight, FiMenu, FiX, FiDollarSign, FiShield
} from 'react-icons/fi';
import logo from '../../assets/Logo.png'; // Import the logo properly

const Sidebar = ({ role, isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const location = useLocation();
  const { user } = useAuth();
  const { clinicInfo } = useClinic();
  const [expandedMenus, setExpandedMenus] = useState({});

  const toggleSubmenu = (menu) => {
    setExpandedMenus({
      ...expandedMenus,
      [menu]: !expandedMenus[menu]
    });
  };

 
  const isActive = (path) => {
    return location.pathname.startsWith(path);
  };

  // Define navigation items based on user role
  const getNavItems = () => {
    switch (role) {
      case 'admin':
        return [
          { to: '/admin/dashboard', icon: <FiHome />, text: 'Dashboard' },
          { to: '/admin/users', icon: <FiUsers />, text: 'User Management' },
          { to: '/admin/appointments', icon: <FiCalendar />, text: 'Appointments' },
          { to: '/admin/billing', icon: <FiFileText />, text: 'Billing & Payments' },
          { to: '/admin/services', icon: <FiList />, text: 'Service Management' },
          { to: '/admin/queue', icon: <FiGrid />, text: 'Queue Management' },
          { to: '/admin/analytics', icon: <FiBarChart2 />, text: 'Analytics' },
          { to: '/admin/audit-logs', icon: <FiShield />, text: 'Audit Logs' },
          { to: '/admin/settings', icon: <FiSettings />, text: 'Settings' },
        ];
      case 'doctor':
        return [
          { to: '/doctor/dashboard', icon: <FiHome />, text: 'Dashboard' },
          { to: '/doctor/appointments', icon: <FiCalendar />, text: 'Appointments' },
          { to: '/doctor/patients', icon: <FiUsers />, text: 'Patient Records' },
          { to: '/doctor/queue', icon: <FiGrid />, text: 'Queue Management' },
          { to: '/doctor/billing', icon: <FiFileText />, text: 'Billing' },
          { to: '/doctor/analytics', icon: <FiBarChart2 />, text: 'Analytics' },
          { to: '/doctor/settings', icon: <FiSettings />, text: 'Settings' },
        ];
      case 'staff':
        return [
          { to: '/staff/dashboard', icon: <FiHome />, text: 'Dashboard' },
          { to: '/staff/appointments', icon: <FiCalendar />, text: 'Appointments' },
          { to: '/staff/queue', icon: <FiGrid />, text: 'Queue Management' },
          { to: '/staff/patients', icon: <FiUsers />, text: 'Patient Records' },
          { to: '/staff/payments', icon: <FiCreditCard />, text: 'Payments' },
          { to: '/staff/settings', icon: <FiSettings />, text: 'Settings' },
        ];
      case 'patient':
        return [
          { to: '/patient/dashboard', icon: <FiHome />, text: 'Dashboard' },
          { to: '/patient/services', icon: <FiList />, text: 'Dental Services' },
          { to: '/patient/appointments', icon: <FiCalendar />, text: 'My Appointments' },
          { to: '/patient/payments', icon: <FiCreditCard />, text: 'Payments' },
          { to: '/patient/records', icon: <FiClipboard />, text: 'My Dental Records' },
          { to: '/patient/analytics', icon: <FiBarChart2 />, text: 'Analytics' },
          { to: '/patient/profile', icon: <FiUser />, text: 'My Profile' },
          { to: '/patient/settings', icon: <FiSettings />, text: 'Settings' },
          
        ];
      default:
        return [];
    }
};

const navItems = getNavItems();

return (
  <>
    {/* Mobile menu backdrop */}
    {isMobileMenuOpen && (
      <div
        className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
        onClick={() => setIsMobileMenuOpen?.(false)}
      ></div>
    )}

    {/* Sidebar for desktop */}
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:bg-white lg:border-r lg:border-gray-200">
      <div className="flex items-center justify-center py-4 px-4 border-b border-gray-200 bg-primary-600">
        <div className="flex items-center">
          {/* Logo Image - Made Larger */}
          <img 
            src={logo}
            alt={`${clinicInfo.clinicName} Logo`}
            className="w-12 h-12 mr-3 object-contain"
          />
          <h1 className="text-xl font-bold text-white">{clinicInfo.clinicName}</h1>
        </div>
      </div>
      <div className="flex flex-col flex-grow p-4 overflow-y-auto">
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                }`
              }
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              <span>{item.text}</span>
            </NavLink>
          ))}
          
        </nav>
      </div>
    </aside>

    {/* Mobile sidebar - Improved with better spacing and responsive design */}
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 bg-white shadow-xl transform ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } transition-transform duration-300 ease-in-out lg:hidden overflow-hidden`}
    >
      {/* Mobile Header - Simplified since header now contains the menu button */}
      <div className="flex items-center py-4 px-4 border-b border-gray-200 bg-primary-600">
        <div className="flex items-center min-w-0 flex-1">
          <img 
            src={logo}
            alt={`${clinicInfo?.clinicName} Logo`}
            className="w-10 h-10 sm:w-12 sm:h-12 mr-3 object-contain flex-shrink-0"
          />
          <h1 className="text-lg sm:text-xl font-bold text-white truncate">
            {clinicInfo?.clinicName}
          </h1>
        </div>
      </div>
      
      {/* Navigation Menu with improved spacing */}
      <div className="flex flex-col flex-grow overflow-y-auto">
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-sm sm:text-base font-medium rounded-lg transition-colors duration-200 ${
                  isActive
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                }`
              }
              onClick={() => setIsMobileMenuOpen?.(false)}
            >
              <span className="mr-3 text-lg sm:text-xl flex-shrink-0">{item.icon}</span>
              <span className="truncate">{item.text}</span>
            </NavLink>
          ))}
        </nav>
        
        {/* Bottom padding to ensure content doesn't get cut off */}
        <div className="h-4"></div>
      </div>
    </aside>
  </>
);
};

export default Sidebar;