// src/components/layouts/PublicNavbar.jsx (Updated)
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useClinic } from '../../contexts/ClinicContext';
import { FiMenu, FiX, FiUser, FiLogIn } from 'react-icons/fi';
import logo from '../../assets/Logo.png'; // Import the logo

const PublicNavbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, userRole } = useAuth();
  const { clinicInfo } = useClinic();
  const location = useLocation();

  // Check if we're on a public page (home, about, services, contact, login, register)
  const isPublicPage = ['/', '/about', '/services', '/contact', '/login', '/register'].includes(location.pathname);

  // Handle scroll event to change navbar appearance
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    
    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Get the appropriate dashboard URL based on user role
  const getDashboardUrl = () => {
    switch (userRole) {
      case 'admin':
        return '/admin/dashboard';
      case 'doctor':
        return '/doctor/dashboard';
      case 'staff':
        return '/staff/dashboard';
      case 'patient':
        return '/patient/dashboard';
      default:
        return '/login';
    }
  };

  // Navigation links
  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'About Us', path: '/about' },
    { name: 'Services', path: '/services' },
    { name: 'Contact Us', path: '/contact' },
  ];

  return (
    <header
      className={`fixed w-full z-50 transition-all duration-300 ${
        isScrolled || !isPublicPage
          ? 'bg-white shadow-md py-2'
          : 'bg-transparent py-4'
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          {/* Logo and Brand */}
          <Link to="/" className="flex items-center">
            <img 
              src={logo}
              alt={`${clinicInfo.clinicName} Logo`}
              className={`h-14 w-14 mr-3 object-contain ${
                isScrolled || !isPublicPage ? '' : 'brightness-0 invert'
              }`}
            />
            <span className={`text-2xl font-bold ${
              isScrolled || !isPublicPage ? 'text-primary-600' : 'text-white'
            }`}>
              {clinicInfo.clinicName}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`${
                  isScrolled || !isPublicPage
                    ? 'text-gray-700 hover:text-primary-600'
                    : 'text-white hover:text-primary-100'
                } font-medium text-sm transition-colors duration-300`}
              >
                {link.name}
              </Link>
            ))}
            
            {user ? (
              <Link
                to={getDashboardUrl()}
                className={`flex items-center px-4 py-2 rounded-md ${
                  isScrolled || !isPublicPage
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-white text-primary-600 hover:bg-primary-50'
                } transition-colors duration-300`}
              >
                <FiUser className="mr-2" />
                Dashboard
              </Link>
            ) : (
              <div className="flex space-x-2">
                <Link
                  to="/login"
                  className={`flex items-center px-4 py-2 rounded-md ${
                    isScrolled || !isPublicPage
                      ? 'text-primary-600 hover:text-primary-700 border border-primary-600'
                      : 'text-white hover:text-primary-100 border border-white'
                  } transition-colors duration-300`}
                >
                  <FiLogIn className="mr-2" />
                  Log In
                </Link>
                <Link
                  to="/register"
                  className={`flex items-center px-4 py-2 rounded-md ${
                    isScrolled || !isPublicPage
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-white text-primary-600 hover:bg-primary-50'
                  } transition-colors duration-300`}
                >
                  <FiUser className="mr-2" />
                  Sign Up
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className={`md:hidden p-2 rounded-md ${
              isScrolled || !isPublicPage
                ? 'text-gray-700 hover:text-primary-600'
                : 'text-white hover:text-primary-100'
            }`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span className="sr-only">Open main menu</span>
            {isMobileMenuOpen ? (
              <FiX className="h-6 w-6" />
            ) : (
              <FiMenu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white shadow-lg">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            
            {user ? (
              <Link
                to={getDashboardUrl()}
                className="flex items-center px-3 py-2 rounded-md text-base font-medium bg-primary-600 text-white hover:bg-primary-700"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <FiUser className="mr-2" />
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center px-3 py-2 rounded-md text-base font-medium text-primary-600 hover:text-primary-700 hover:bg-gray-50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <FiLogIn className="mr-2" />
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="flex items-center px-3 py-2 rounded-md text-base font-medium bg-primary-600 text-white hover:bg-primary-700"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <FiUser className="mr-2" />
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicNavbar;