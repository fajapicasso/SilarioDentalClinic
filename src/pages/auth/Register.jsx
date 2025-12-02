// src/pages/auth/Register.jsx
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { FiEye, FiEyeOff, FiUser, FiMail, FiPhone, FiHome, FiCalendar, FiLock, FiChevronLeft, FiChevronRight, FiCheck } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import PublicNavbar from '../../components/layouts/PublicNavbar';
import PublicLayout from '../../components/layouts/PublicLayout';
import logo from '../../assets/Logo.png';
import cabugaoImg from '../../assets/Cabugao Branch.jpg';
import sanJuanImg from '../../assets/San Juan Branch.jpg';
import cabugaoImg2 from '../../assets/Cabugaoo.png';
import sanJuanImg2 from '../../assets/San Juan Branchh.jpg';
import cabugaoImg3 from '../../assets/cabugao branchh.jpg';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import PhilippineAddressService from '../../services/philippineAddressService';

const phoneRegExp = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
const passwordRegExp = /^(?=.*[!@#$%^&*])(?=.*[a-zA-Z0-9]).{8,}$/;

const RegisterSchema = Yup.object().shape({
  first_name: Yup.string()
    .min(2, 'Too Short!')
    .max(30, 'Too Long!')
    .required('First name is required'),
  middle_name: Yup.string()
    .max(30, 'Too Long!'),
  last_name: Yup.string()
    .min(2, 'Too Short!')
    .max(30, 'Too Long!')
    .required('Last name is required'),
  email: Yup.string()
    .email('Invalid email')
    .required('Email is required'),
  phone: Yup.string()
    .matches(phoneRegExp, 'Phone number is not valid')
    .required('Phone number is required'),
  street: Yup.string()
    .required('Street address is required'),
  barangay: Yup.string()
    .required('Barangay is required'),
  city: Yup.string()
    .required('City is required'),
  province: Yup.string()
    .required('Province is required'),
  birthday: Yup.date()
    .required('Birthday is required')
    .max(new Date(), 'Birthday cannot be in the future')
    .test('is-adult', 'You must be at least 18 years old to create an account', function(value) {
      if (!value) return false;
      const today = new Date();
      const birthDate = new Date(value);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= 18;
    }),
  age: Yup.number()
    .required('Age is required')
    .positive('Age must be positive')
    .integer('Age must be an integer')
    .min(18, 'You must be at least 18 years old to create an account'),
  gender: Yup.string()
    .oneOf(['male', 'female', 'other'], 'Invalid gender selection')
    .required('Gender is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      passwordRegExp,
      'Password must contain at least 8 characters and one special character'
    )
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Please confirm your password'),
});

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const cardRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [isCompact, setIsCompact] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024);
  
  // Philippine address cascading dropdowns
  const [provinces, setProvinces] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedMunicipality, setSelectedMunicipality] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [focusedSelect, setFocusedSelect] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 640);
      setIsTablet(width >= 768 && width < 1024);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const lockScroll = () => {
      const original = document.body.style.overflow;
      // Don't lock scroll on mobile to allow form scrolling
      if (window.innerWidth >= 640) {
        document.body.style.overflow = 'hidden';
      }
      return () => {
        document.body.style.overflow = original;
      };
    };
    const unlock = lockScroll();
    return () => unlock();
  }, []);

  // Load provinces on component mount
  useEffect(() => {
    const loadProvinces = async () => {
      try {
        const provincesList = await PhilippineAddressService.getProvinces();
        setProvinces(provincesList);
      } catch (error) {
        console.error('Error loading provinces:', error);
        // Set fallback provinces
        setProvinces(['Ilocos Sur', 'La Union', 'Benguet']);
      }
    };
    loadProvinces();
  }, []);

  // Handle province selection
  const handleProvinceChange = async (province, setFieldValue) => {
    setSelectedProvince(province);
    setSelectedMunicipality('');
    setSelectedBarangay('');
    setMunicipalities([]);
    setBarangays([]);
    setFieldValue('province', province);
    setFieldValue('city', '');
    setFieldValue('barangay', '');
    
    // Load municipalities for selected province
    if (province) {
      try {
        const municipalityList = await PhilippineAddressService.getMunicipalities(province);
        setMunicipalities(municipalityList);
      } catch (error) {
        console.error('Error loading municipalities:', error);
      }
    }
  };

  // Handle municipality selection
  const handleMunicipalityChange = async (municipality, setFieldValue) => {
    setSelectedMunicipality(municipality);
    setSelectedBarangay('');
    setBarangays([]);
    setFieldValue('city', municipality);
    setFieldValue('barangay', '');
    
    // Load barangays for selected municipality
    if (municipality && selectedProvince) {
      try {
        const barangayList = await PhilippineAddressService.getBarangays(selectedProvince, municipality);
        setBarangays(barangayList);
      } catch (error) {
        console.error('Error loading barangays:', error);
      }
    }
  };

  // Handle barangay selection
  const handleBarangayChange = (barangay, setFieldValue) => {
    setSelectedBarangay(barangay);
    setFieldValue('barangay', barangay);
  };

  useEffect(() => {
    const computeScale = () => {
      const node = cardRef.current;
      if (!node) return;

      // Temporarily reset scale to measure intrinsic size
      node.style.transform = 'scale(1)';
      node.style.transformOrigin = 'center center';

      const vw = window.visualViewport?.width ?? window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;

      const targetW = vw * 0.94; // safe gutters
      const targetH = vh * 0.88; // leave some vertical margin

      const naturalW = node.offsetWidth;
      const naturalH = node.scrollHeight;

      const widthScale = Math.min(1, targetW / Math.max(1, naturalW));
      const heightScale = Math.min(1, targetH / Math.max(1, naturalH));
      const nextScale = Math.max(0.72, Math.min(widthScale, heightScale)); // readability floor for small phones

      setScale(nextScale);
      node.style.transform = `scale(${nextScale})`;

      // Compact layout hint for very short viewports
      setIsCompact(vh < 720 || vw < 420);
    };

    computeScale();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', computeScale);
      vv.addEventListener('scroll', computeScale);
    }
    window.addEventListener('resize', computeScale);

    const obs = new ResizeObserver(computeScale);
    if (cardRef.current) obs.observe(cardRef.current);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', computeScale);
        vv.removeEventListener('scroll', computeScale);
      }
      window.removeEventListener('resize', computeScale);
      obs.disconnect();
    };
  }, []);

  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    setIsLoading(true);
    
    // Safety check: Verify user is at least 18 years old
    if (values.birthday) {
      const today = new Date();
      const birthDate = new Date(values.birthday);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 18) {
        setIsLoading(false);
        setSubmitting(false);
        toast.error('You must be at least 18 years old to create an account.');
        return;
      }
    }
    
    // Create userData object from form values
    const userData = {
      full_name: `${values.first_name} ${values.middle_name} ${values.last_name}`.trim(),
      first_name: values.first_name,
      middle_name: values.middle_name,
      last_name: values.last_name,
      phone: values.phone,
      address: `${values.street}, ${values.barangay}, ${values.city}, ${values.province}`,
      street: values.street,
      barangay: values.barangay,
      city: values.city,
      province: values.province,
      birthday: values.birthday,
      age: values.age,
      gender: values.gender,
    };
    
    try {
      const { success, error } = await register(values.email, values.password, userData);
      
      if (success) {
        resetForm();
        toast.warning(
          'Account created! You must confirm your email address before logging in. Please check your inbox now.', 
          { autoClose: 8000 }
        );
        navigate('/login');
      } else if (error && (
          error.includes('row-level security policy') || 
          error.includes('violates row-level security')
        )) {
        // This is actually a success case - the auth account was created but the profile creation
        // failed due to RLS, which is expected behavior before email verification
        resetForm();
        toast.warning(
          'Account created! You must verify your email address before accessing your account. Please check your inbox now.', 
          { autoClose: 8000 }
        );
        navigate('/login');
      } else {
        // Handle other errors
        toast.error(error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      // Check for the specific RLS error message pattern
      const errorMessage = error.message || error.toString();
      if (
        errorMessage.includes('row-level security policy') || 
        errorMessage.includes('violates row-level security')
      ) {
        // This is likely a successful auth signup but failed profile creation due to RLS
        resetForm();
        toast.warning(
          'Account created! You must verify your email address before logging in. Please check your inbox now.', 
          { autoClose: 8000 }
        );
        navigate('/login');
      } else {
        toast.error('An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
      setIsLoading(false);
    }
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

  const handleNext = (errors, touched, values, validateForm, setTouched) => {
    // Validate current step before proceeding
    let isValid = true;
    const fieldsToTouch = {};
    
    if (currentStep === 1) {
      // Validate personal information
      if (!values.first_name || !values.last_name || !values.gender || !values.birthday) {
        isValid = false;
        if (!values.first_name) fieldsToTouch.first_name = true;
        if (!values.last_name) fieldsToTouch.last_name = true;
        if (!values.gender) fieldsToTouch.gender = true;
        if (!values.birthday) fieldsToTouch.birthday = true;
      }
      if (errors.first_name || errors.last_name || errors.gender || errors.birthday) {
        isValid = false;
      }
    } else if (currentStep === 2) {
      // Validate contact information
      if (!values.email || !values.phone) {
        isValid = false;
        if (!values.email) fieldsToTouch.email = true;
        if (!values.phone) fieldsToTouch.phone = true;
      }
      if (errors.email || errors.phone) {
        isValid = false;
      }
    } else if (currentStep === 3) {
      // Validate address information
      if (!values.province || !values.city || !values.barangay || !values.street) {
        isValid = false;
        if (!values.province) fieldsToTouch.province = true;
        if (!values.city) fieldsToTouch.city = true;
        if (!values.barangay) fieldsToTouch.barangay = true;
        if (!values.street) fieldsToTouch.street = true;
      }
      if (errors.province || errors.city || errors.barangay || errors.street) {
        isValid = false;
      }
    } else if (currentStep === 4) {
      // Validate password information
      if (!values.password || !values.confirmPassword) {
        isValid = false;
        if (!values.password) fieldsToTouch.password = true;
        if (!values.confirmPassword) fieldsToTouch.confirmPassword = true;
      }
      if (errors.password || errors.confirmPassword) {
        isValid = false;
      }
    }
    
    if (Object.keys(fieldsToTouch).length > 0) {
      setTouched({ ...touched, ...fieldsToTouch }, false);
    }
    
    if (isValid && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <PublicLayout>
      <PublicNavbar />
      <style>{`
        /* Ensure smooth scrolling on mobile and tablet */
        @media (max-width: 1024px) {
          body {
            -webkit-overflow-scrolling: touch;
          }
          [data-modal-container] {
            overflow: visible !important;
          }
        }
        /* Tablet-specific optimizations (768px - 1024px) */
        @media (min-width: 768px) and (max-width: 1024px) {
          [data-modal-container] {
            max-width: 95vw !important;
          }
          [data-modal-container] input,
          [data-modal-container] select,
          [data-modal-container] textarea {
            font-size: 1rem !important;
            padding: 0.875rem 1rem !important;
            min-height: 3rem !important;
          }
          [data-modal-container] button {
            font-size: 1rem !important;
            padding: 0.875rem 1.5rem !important;
            min-height: 3rem !important;
          }
          [data-modal-container] select.address-select[size="5"] {
            max-height: calc(3rem * 5) !important;
            padding: 0.5rem 2.5rem 0.5rem 1rem !important;
          }
          [data-modal-container] select.address-select[size="5"] option {
            padding: 0.625rem 0.75rem !important;
            line-height: 1.75rem !important;
            min-height: 2.5rem !important;
          }
        }
        /* Date picker positioning fixes */
        .react-datepicker-popper {
          z-index: 9999 !important;
        }
        /* Desktop: Force date picker to appear above input field - STRONG OVERRIDE */
        @media (min-width: 641px) {
          .react-datepicker-popper {
            position: absolute !important;
            top: auto !important;
            bottom: 100% !important;
            left: 0 !important;
            right: auto !important;
            margin-top: 0 !important;
            margin-bottom: 0.5rem !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            transform: translate3d(0px, 0px, 0px) !important;
            transform-origin: bottom left !important;
          }
          /* Override any data-placement attribute */
          .react-datepicker-popper[data-placement],
          .react-datepicker-popper[data-placement^="top"],
          .react-datepicker-popper[data-placement^="bottom"],
          .react-datepicker-popper[data-placement^="left"],
          .react-datepicker-popper[data-placement^="right"] {
            top: auto !important;
            bottom: 100% !important;
            left: 0 !important;
            right: auto !important;
            margin-top: 0 !important;
            margin-bottom: 0.5rem !important;
            transform: translate3d(0px, 0px, 0px) !important;
          }
        }
        .react-datepicker {
          border: 1px solid #e5e7eb !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
          background-color: white !important;
          font-size: 1rem !important;
        }
        .react-datepicker__current-month {
          font-size: 1rem !important;
          font-weight: 600 !important;
        }
        .react-datepicker__day-name,
        .react-datepicker__day {
          font-size: 0.9375rem !important;
        }
        .react-datepicker__header {
          background-color: white !important;
        }
        .react-datepicker__month-container {
          background-color: white !important;
        }
        .react-datepicker__month {
          background-color: white !important;
        }
        /* Ensure all day names are visible */
        .react-datepicker__day-names {
          display: flex !important;
          width: 100% !important;
        }
        .react-datepicker__day-name {
          color: #666 !important;
          font-weight: 600 !important;
          width: calc(100% / 7) !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 0.9375rem !important;
        }
        .react-datepicker__day {
          font-size: 0.9375rem !important;
          width: 2.75rem !important;
          height: 2.75rem !important;
          line-height: 2.75rem !important;
        }
        .react-datepicker__header {
          padding: 0.75rem 0.5rem !important;
        }
        .react-datepicker__current-month {
          font-size: 1.125rem !important;
          font-weight: 600 !important;
        }
        /* Ensure date picker stays within modal container */
        [data-modal-container] {
          position: relative;
          overflow: visible !important;
        }
        /* Make select dropdowns mobile-friendly and contained */
        [data-modal-container] select {
          font-size: 0.875rem !important;
        }
        /* Address select styling - compact with 5 visible items when focused */
        [data-modal-container] select.address-select {
          appearance: none !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 9L1 4h10z'/%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: right 0.75rem center !important;
          background-size: 12px !important;
          padding-right: 2.5rem !important;
        }
        /* When size=1 (collapsed), show as normal dropdown */
        [data-modal-container] select.address-select[size="1"] {
          position: relative !important;
          height: 2.5rem !important;
          overflow: hidden !important;
          max-height: 2.5rem !important;
        }
        /* Ensure parent container is relative for absolute positioning */
        [data-modal-container] .relative {
          position: relative !important;
        }
        /* Keep parent container height fixed - prevents layout shift */
        [data-modal-container] .relative > select.address-select {
          position: relative !important;
        }
        [data-modal-container] .relative > select.address-select[size="5"] {
          position: absolute !important;
        }
        /* When size=5 (expanded), show 5 items with scrolling - overlay mode */
        [data-modal-container] select.address-select[size="5"] {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          height: auto !important;
          min-height: 2.5rem !important;
          max-height: calc(2.5rem * 5) !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          padding: 0.25rem 2.5rem 0.25rem 0.75rem !important;
          background-position: right 0.75rem top 0.5rem !important;
          background-color: white !important;
          border: 2px solid #3b82f6 !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
          scrollbar-width: thin !important;
          scrollbar-color: #cbd5e0 #f7fafc !important;
          z-index: 50 !important;
        }
        [data-modal-container] select.address-select[size="5"]::-webkit-scrollbar {
          width: 6px !important;
        }
        [data-modal-container] select.address-select[size="5"]::-webkit-scrollbar-track {
          background: #f7fafc !important;
          border-radius: 3px !important;
        }
        [data-modal-container] select.address-select[size="5"]::-webkit-scrollbar-thumb {
          background: #cbd5e0 !important;
          border-radius: 3px !important;
        }
        [data-modal-container] select.address-select[size="5"]::-webkit-scrollbar-thumb:hover {
          background: #a0aec0 !important;
        }
        [data-modal-container] select.address-select[size="5"] option {
          padding: 0.5rem 0.5rem !important;
          line-height: 1.5rem !important;
          min-height: 2rem !important;
          height: auto !important;
        }
        /* On mobile, make dropdowns more compact and ensure they don't exceed modal */
        @media (max-width: 640px) {
          [data-modal-container] select {
            font-size: 0.875rem !important;
            max-height: 2.5rem !important;
            line-height: 1.25rem !important;
          }
          [data-modal-container] select.address-select[size="1"] {
            padding: 0.625rem 2.5rem 0.625rem 0.75rem !important;
          }
          [data-modal-container] select.address-select[size="5"] {
            max-height: calc(2rem * 5) !important;
            padding: 0.25rem 2.5rem 0.25rem 0.75rem !important;
          }
          [data-modal-container] select.address-select[size="5"] option {
            padding: 0.375rem 0.5rem !important;
            line-height: 1.25rem !important;
            min-height: 1.75rem !important;
          }
          /* Ensure select dropdown options stay within modal when opened */
          [data-modal-container] select:focus {
            position: relative !important;
            z-index: 10 !important;
          }
          /* Limit option text length */
          [data-modal-container] select option {
            font-size: 0.875rem !important;
            padding: 0.5rem 0.75rem !important;
            max-width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }
        }
        /* Make select dropdowns mobile-friendly */
        select {
          font-size: 0.875rem !important;
          max-height: 200px !important;
        }
        /* On mobile, make dropdowns more compact */
        @media (max-width: 640px) {
          select {
            font-size: 0.875rem !important;
            padding: 0.625rem 2.5rem 0.625rem 0.75rem !important;
            max-height: 150px !important;
          }
          /* Ensure select dropdown options stay within modal */
          select option {
            font-size: 0.875rem !important;
            padding: 0.5rem 0.75rem !important;
            max-width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          /* Limit dropdown height on mobile */
          [data-modal-container] select {
            max-height: 2.5rem !important;
          }
        }
        /* On mobile, fix calendar grid layout and keep within modal */
        @media (max-width: 640px) {
          .react-datepicker-popper {
            position: absolute !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            bottom: 100% !important;
            top: auto !important;
            max-width: calc(100vw - 1rem) !important;
            width: 360px !important;
            min-width: 360px !important;
            z-index: 10000 !important;
            margin-bottom: 0.5rem !important;
          }
          .react-datepicker {
            width: 100% !important;
            max-width: 100% !important;
            display: block !important;
            margin: 0 auto !important;
            background-color: white !important;
            font-size: 1rem !important;
            padding: 0.75rem !important;
            box-sizing: border-box !important;
            overflow: visible !important;
          }
          .react-datepicker__header {
            background-color: white !important;
            padding: 0.75rem 0.5rem !important;
          }
          .react-datepicker__current-month {
            font-size: 1.125rem !important;
            font-weight: 600 !important;
            padding: 0.5rem 0 !important;
          }
          .react-datepicker__month-container {
            width: 100% !important;
            display: block !important;
            margin: 0 auto !important;
            background-color: white !important;
            box-sizing: border-box !important;
            overflow: visible !important;
          }
          .react-datepicker__month {
            margin: 0.5rem 0 !important;
            padding: 0 !important;
            display: block !important;
            background-color: white !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          .react-datepicker__week {
            display: flex !important;
            flex-direction: row !important;
            width: 100% !important;
            justify-content: space-between !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .react-datepicker__day-names {
            display: flex !important;
            flex-direction: row !important;
            width: 100% !important;
            justify-content: space-between !important;
            padding: 0.75rem 0 !important;
            margin: 0 !important;
          }
          .react-datepicker__day-name {
            width: calc((100% - 0.5rem) / 7) !important;
            min-width: 0 !important;
            flex: 1 1 auto !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 0 0.0357rem !important;
            line-height: 1.75rem !important;
            font-size: 1rem !important;
            color: #666 !important;
            font-weight: 600 !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          .react-datepicker__day {
            width: calc((100% - 0.5rem) / 7) !important;
            min-width: 0 !important;
            flex: 1 1 auto !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 0.25rem 0.0357rem !important;
            line-height: 2.75rem !important;
            height: 2.75rem !important;
            font-size: 1rem !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
      {/* Swiper Carousel Background */}
      <div className="fixed inset-0 w-full h-full z-0">
        <Swiper
          modules={[Autoplay, Pagination]}
          autoplay={{ delay: 4000, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          loop
          className="w-full h-full"
        >
          <SwiperSlide>
            <img src={cabugaoImg} alt="Cabugao Branch" className="w-full h-full object-cover object-center blur-md" />
          </SwiperSlide>
          <SwiperSlide>
            <img src={sanJuanImg} alt="San Juan Branch" className="w-full h-full object-cover object-center blur-md" />
          </SwiperSlide>
          <SwiperSlide>
            <img src={cabugaoImg2} alt="Cabugao Branch 2" className="w-full h-full object-cover object-center blur-md" />
          </SwiperSlide>
          <SwiperSlide>
            <img src={sanJuanImg2} alt="San Juan Branch 2" className="w-full h-full object-cover object-center blur-md" />
          </SwiperSlide>
          <SwiperSlide>
            <img src={cabugaoImg3} alt="Cabugao Branch 3" className="w-full h-full object-cover object-center blur-md" />
          </SwiperSlide>
        </Swiper>
        <div className="absolute inset-0 bg-black/50" />
      </div>
      {/* Register Card */}
      <div className="fixed inset-0 z-10 flex items-center justify-center px-1 sm:px-4 md:px-6 overflow-y-auto overflow-x-hidden py-2 sm:py-3 md:py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div
          ref={cardRef}
          data-modal-container
          className={`w-full bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-200 space-y-2 sm:space-y-3 md:space-y-4 will-change-transform relative my-auto ${isCompact ? 'px-3 pt-3 pb-3 sm:px-4 sm:pt-4 sm:pb-3 md:px-5 md:pt-5 md:pb-4' : 'px-4 pt-4 pb-3 sm:px-5 sm:pt-5 sm:pb-4 md:px-6 md:pt-6 md:pb-4 lg:px-8 lg:pt-8 lg:pb-6'}`}
          style={{
            maxWidth: isTablet ? 'min(95vw, 700px)' : 'min(98vw, 600px)',
            width: '100%',
            transform: isMobile ? 'none' : `scale(${scale})`,
            transformOrigin: 'center center',
            fontSize: `clamp(14px, ${Math.max(0.95, scale)}rem, 16px)`,
            overflowY: 'visible',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 12px)',
            paddingTop: 'max(env(safe-area-inset-top, 4px), 4px)',
            marginTop: isMobile ? 'auto' : '0',
            marginBottom: isMobile ? 'auto' : '0'
          }}
        >
          {/* Professional Header */}
          <div className="flex flex-col items-center mb-1 sm:mb-2">
              <div className="mb-0">
                <img src={logo} alt="Silario Dental Clinic Logo" className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 lg:h-32 lg:w-32 object-contain" />
              </div>
           
          </div>

          <div className="text-center mb-2 sm:mb-3">
            <h2 className="mt-0 text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-800">Create your account</h2>
            <p className="mt-1 text-xs sm:text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
                Sign in
              </Link>
            </p>
          </div>

          {/* Step Indicator */}
          <div className="mb-2 sm:mb-3 mt-1 sm:mt-2">
            <div className="flex items-center justify-center w-full">
              <div className="flex items-center justify-center w-full max-w-lg mx-auto px-2 sm:px-4">
                {[1, 2, 3, 4].map((step) => {
                  const isActive = currentStep === step;
                  const isCompleted = currentStep > step;
                  const stepLabels = ['Personal', 'Contact', 'Address', 'Security'];
                  
                  return (
                    <div key={step} className="flex items-center justify-center">
                      <div className="flex flex-col items-center relative z-10">
                        {/* Step Circle */}
                        <div className="relative">
                          <div
                            className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm md:text-base transition-all duration-300 shadow-md ${
                              isActive
                                ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-blue-500/50 scale-110'
                                : isCompleted
                                ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-green-500/50'
                                : 'bg-gray-100 text-gray-400 border-2 border-gray-300'
                            }`}
                          >
                            {isCompleted ? (
                              <FiCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                            ) : (
                              step
                            )}
                          </div>
                          {/* Active step pulse effect */}
                          {isActive && (
                            <div className="absolute -inset-1 rounded-full bg-blue-400 animate-ping opacity-20 pointer-events-none"></div>
                          )}
                        </div>
                        {/* Step Label */}
                        <div className={`mt-1.5 sm:mt-2 md:mt-3 text-[9px] sm:text-[10px] md:text-xs font-semibold text-center transition-colors duration-300 whitespace-nowrap ${
                          isActive
                            ? 'text-blue-600'
                            : isCompleted
                            ? 'text-green-600'
                            : 'text-gray-400'
                        }`}>
                          {stepLabels[step - 1]}
                        </div>
                      </div>
                      {/* Connector Line */}
                      {step < 4 && (
                        <div className="w-12 sm:w-14 md:w-16 mx-1.5 sm:mx-2 md:mx-2.5 relative">
                          <div className="h-0.5 sm:h-1 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ease-in-out ${
                                isCompleted
                                  ? 'bg-gradient-to-r from-green-500 to-green-600 w-full'
                                  : currentStep > step
                                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 w-full'
                                  : 'w-0'
                              }`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <Formik
            initialValues={{
              first_name: '',
              middle_name: '',
              last_name: '',
              email: '',
              phone: '',
              street: '',
              barangay: '',
              city: '',
              province: '',
              birthday: null,
              age: '',
              gender: '',
              password: '',
              confirmPassword: '',
            }}
            validationSchema={RegisterSchema}
            onSubmit={handleSubmit}
          >
            {({ isSubmitting, errors, touched, setFieldValue, values, validateForm, setTouched }) => (
              <Form className="mt-2 space-y-2 sm:space-y-3">
                <div className="space-y-2 sm:space-y-3 pb-1">
                  {/* Step 1: Personal Information Section */}
                  {currentStep === 1 && (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center space-x-2 mb-1 sm:mb-2">
                      <FiUser className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                      <h3 className="text-base sm:text-lg font-semibold text-gray-800">Personal Information</h3>
                    </div>
                    
                    <div className={`grid grid-cols-1 ${isCompact ? 'sm:grid-cols-2 md:grid-cols-3' : 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3'} gap-2 sm:gap-2.5 md:gap-3 lg:gap-4`}>
                    {/* First Name */}
                  <div className="group">
                      <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                        First Name *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        <FiUser className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <Field
                          id="first_name"
                          name="first_name"
                        type="text"
                        className={`block w-full pl-10 pr-3 py-3 sm:py-2.5 md:py-3 lg:py-3.5 border-2 rounded-lg text-sm sm:text-base md:text-base lg:text-lg touch-manipulation ${
                            errors.first_name && touched.first_name
                            ? 'border-red-400 text-red-600 placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-red-50'
                            : 'border-gray-300 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white'
                        } transition-all duration-200`}
                          placeholder={(touched.first_name && errors.first_name) ? errors.first_name : 'Name'}
                        style={{ color: errors.first_name && touched.first_name ? 'rgb(220, 38, 38)' : 'rgb(55, 65, 81)' }}
                      />
                    </div>
                    </div>

                    {/* Middle Name */}
                    <div>
                      <label htmlFor="middle_name" className="block text-sm font-medium text-gray-700 mb-1">
                        Middle Name
                      </label>
                      <div className="relative">
                        <Field
                          id="middle_name"
                          name="middle_name"
                          type="text"
                          className={`block w-full pl-3 pr-3 py-2.5 border-2 rounded-lg ${
                            errors.middle_name && touched.middle_name
                              ? 'border-red-400 text-red-600 placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-red-50'
                              : 'border-gray-300 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white'
                          } transition-all duration-200`}
                          placeholder={(touched.middle_name && errors.middle_name) ? errors.middle_name : 'Middle Name'}
                          style={{ color: errors.middle_name && touched.middle_name ? 'rgb(220, 38, 38)' : 'rgb(55, 65, 81)' }}
                        />
                      </div>
                  </div>

                    {/* Last Name */}
                    <div>
                      <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name *
                      </label>
                      <div className="relative">
                        <Field
                          id="last_name"
                          name="last_name"
                          type="text"
                          className={`block w-full pl-3 pr-3 py-2.5 border-2 rounded-lg ${
                            errors.last_name && touched.last_name
                              ? 'border-red-400 text-red-600 placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-red-50'
                              : 'border-gray-300 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white'
                          } transition-all duration-200`}
                          placeholder={(touched.last_name && errors.last_name) ? errors.last_name : 'Last Name'}
                          style={{ color: errors.last_name && touched.last_name ? 'rgb(220, 38, 38)' : 'rgb(55, 65, 81)' }}
                        />
                      </div>
                    </div>

                    {/* Gender */}
                    <div>
                      <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                        Gender
                      </label>
                      <div className="relative">
                        <Field
                          as="select"
                          id="gender"
                          name="gender"
                          className={`block w-full pl-3 pr-10 py-2.5 border-2 rounded-lg ${
                            errors.gender && touched.gender
                              ? 'border-red-400 text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-red-50'
                              : 'border-gray-300 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white'
                          } transition-all duration-200 appearance-none`}
                          style={{ color: errors.gender && touched.gender ? 'rgb(220, 38, 38)' : 'rgb(55, 65, 81)' }}
                        >
                          <option value="" className="text-gray-500">{(touched.gender && errors.gender) ? errors.gender : 'Select Gender'}</option>
                          <option value="male" className="text-gray-700">Male</option>
                          <option value="female" className="text-gray-700">Female</option>
                          <option value="other" className="text-gray-700">Other</option>
                        </Field>
                      </div>
                    </div>

                    {/* Birthday */}
                    <div className="relative">
                      <label htmlFor="birthday" className="block text-sm font-medium text-gray-700 mb-1">
                        Birthday *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none z-10">
                          <FiCalendar className="h-5 w-5 text-gray-400" />
                        </div>
                        <DatePicker
                          id="birthday"
                          selected={values.birthday}
                          onChange={(date) => {
                            setFieldValue('birthday', date);
                            setFieldValue('age', calculateAge(date));
                          }}
                          dateFormat="MM/dd/yyyy"
                          className={`block w-full pl-3 pr-10 py-2.5 border-2 rounded-lg ${
                            errors.birthday && touched.birthday
                              ? 'border-red-400 text-red-600 placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-red-50'
                              : 'border-gray-300 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white'
                          } transition-all duration-200`}
                          placeholderText={(touched.birthday && errors.birthday) ? String(errors.birthday) : 'mm/dd/yyyy'}
                          maxDate={new Date()}
                          minDate={new Date(new Date().setFullYear(new Date().getFullYear() - 100))}
                          showMonthDropdown
                          showYearDropdown
                          scrollableYearDropdown
                          yearDropdownItemNumber={100}
                          popperPlacement="top-start"
                          withPortal={false}
                          popperModifiers={[
                            {
                              name: 'offset',
                              options: {
                                offset: [0, -8],
                              },
                            },
                            {
                              name: 'preventOverflow',
                              enabled: isMobile,
                              options: {
                                boundary: cardRef.current || 'clippingParents',
                                rootBoundary: 'viewport',
                                tether: false,
                                altAxis: false,
                                padding: 8,
                              },
                            },
                            {
                              name: 'flip',
                              enabled: false,
                            },
                            {
                              name: 'computeStyles',
                              options: {
                                gpuAcceleration: false,
                              },
                            },
                          ]}
                          style={{ color: errors.birthday && touched.birthday ? 'rgb(220, 38, 38)' : 'rgb(55, 65, 81)' }}
                        />
                      </div>
                      {errors.birthday && touched.birthday && (
                        <p className="mt-1 text-xs text-red-600">{errors.birthday}</p>
                      )}
                    </div>

                    {/* Age */}
                    <div>
                      <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
                        Age
                      </label>
                      <div className="relative">
                        <Field
                          id="age"
                          name="age"
                          type="number"
                          className={`block w-full pl-3 pr-3 py-2.5 border-2 rounded-lg ${
                            errors.age && touched.age
                              ? 'border-red-400 text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-red-50'
                              : 'border-gray-300 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50'
                          } transition-all duration-200`}
                          placeholder="Age"
                          disabled={true}
                          style={{ color: 'rgb(55, 65, 81)' }}
                        />
                      </div>
                    </div>
                  </div>
                  </div>
                  )}

                  {/* Step 2: Contact Information */}
                  {currentStep === 2 && (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center space-x-2 mb-1 sm:mb-2">
                      <FiMail className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                      <h3 className="text-base sm:text-lg font-semibold text-gray-800">Contact Information</h3>
                    </div>

                  {/* Email + Phone */}
                  <div className={`grid grid-cols-1 ${isCompact ? 'sm:grid-cols-2' : 'sm:grid-cols-2'} gap-2 sm:gap-2.5 md:gap-3`}>
                    {/* Email */}
                    <div className="group">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        <FiMail className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <Field
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        className={`block w-full pl-10 pr-3 py-2.5 border-2 rounded-lg ${
                          errors.email && touched.email
                            ? 'border-red-400 text-red-600 placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-red-50'
                            : 'border-gray-300 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white'
                        } transition-all duration-200`}
                        placeholder={(touched.email && errors.email) ? errors.email : '@r@gmail.com'}
                        style={{ color: errors.email && touched.email ? 'rgb(220, 38, 38)' : 'rgb(55, 65, 81)' }}
                      />
                    </div>
                    </div>

                    {/* Phone */}
                    <div className="group">
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        <FiPhone className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <Field
                        id="phone"
                        name="phone"
                        type="tel"
                        className={`block w-full pl-10 pr-3 py-2.5 border-2 rounded-lg ${
                          errors.phone && touched.phone
                            ? 'border-red-400 text-red-600 placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-red-50'
                            : 'border-gray-300 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white'
                        } transition-all duration-200`}
                        placeholder={(touched.phone && errors.phone) ? errors.phone : '+63 *** *******'}
                        style={{ color: errors.phone && touched.phone ? 'rgb(220, 38, 38)' : 'rgb(55, 65, 81)' }}
                      />
                    </div>
                    </div>
                    
                  </div>
                  </div>
                  )}

                  {/* Step 3: Address Fields - Reordered: Province, City/Municipality, Barangay, Street */}
                  {currentStep === 3 && (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center space-x-2 mb-1 sm:mb-2">
                      <FiHome className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                      <h3 className="text-base sm:text-lg font-semibold text-gray-800">Address Information</h3>
                  </div>

                    <div className={`grid grid-cols-1 ${isCompact ? 'sm:grid-cols-1 md:grid-cols-2' : 'sm:grid-cols-2'} gap-2 sm:gap-2.5 md:gap-3`}>
                      {/* Province - First */}
                      <div>
                        <label htmlFor="province" className="block text-sm font-medium text-gray-700 mb-1">
                          Province *
                        </label>
                        <div className="relative">
                          <Field
                            as="select"
                            id="province"
                            name="province"
                            size={focusedSelect === 'province' ? 5 : 1}
                            className={`block w-full pl-3 pr-10 py-2.5 sm:py-2.5 border-2 rounded-lg text-sm sm:text-base touch-manipulation address-select ${
                              errors.province && touched.province
                                ? 'border-red-400 text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-red-50'
                                : 'border-gray-300 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white'
                            } transition-all duration-200`}
                            style={{ 
                              color: errors.province && touched.province ? 'rgb(220, 38, 38)' : 'rgb(55, 65, 81)'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFocusedSelect('province');
                            }}
                            onFocus={() => setFocusedSelect('province')}
                            onBlur={(e) => {
                              // Don't close if clicking on the select itself
                              if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('select.address-select')) {
                                return;
                              }
                              setTimeout(() => setFocusedSelect(null), 300);
                            }}
                            onChange={(e) => {
                              handleProvinceChange(e.target.value, setFieldValue);
                              setTimeout(() => setFocusedSelect(null), 200);
                            }}
                          >
                            <option value="" className="text-gray-500">
                              {touched.province && errors.province ? errors.province : 'Select Province'}
                            </option>
                            {provinces.map((province) => (
                              <option key={province} value={province} className="text-gray-700">
                                {province}
                              </option>
                            ))}
                          </Field>
                        </div>
                      </div>

                      {/* City/Municipality - Second */}
                      <div>
                        <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                          City/Municipality *
                        </label>
                        <div className="relative">
                          <Field
                            as="select"
                            id="city"
                            name="city"
                            size={focusedSelect === 'city' ? 5 : 1}
                            className={`block w-full pl-3 pr-10 py-2.5 sm:py-2.5 border-2 rounded-lg text-sm sm:text-base touch-manipulation address-select ${
                              errors.city && touched.city
                                ? 'border-red-400 text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-red-50'
                                : 'border-gray-300 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white'
                            } transition-all duration-200`}
                            style={{ 
                              color: errors.city && touched.city ? 'rgb(220, 38, 38)' : 'rgb(55, 65, 81)'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFocusedSelect('city');
                            }}
                            onFocus={() => setFocusedSelect('city')}
                            onBlur={(e) => {
                              // Don't close if clicking on the select itself
                              if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('select.address-select')) {
                                return;
                              }
                              setTimeout(() => setFocusedSelect(null), 300);
                            }}
                            onChange={(e) => {
                              handleMunicipalityChange(e.target.value, setFieldValue);
                              setTimeout(() => setFocusedSelect(null), 200);
                            }}
                          >
                            <option value="" className="text-gray-500">
                              {touched.city && errors.city ? errors.city : selectedProvince ? 'Select City/Municipality' : 'Select Province First'}
                            </option>
                            {municipalities.map((municipality) => (
                              <option key={municipality} value={municipality} className="text-gray-700">
                                {municipality}
                              </option>
                            ))}
                          </Field>
                        </div>
                      </div>

                      {/* Barangay - Third */}
                      <div>
                        <label htmlFor="barangay" className="block text-sm font-medium text-gray-700 mb-1">
                          Barangay *
                        </label>
                        <div className="relative">
                          <Field
                            as="select"
                            id="barangay"
                            name="barangay"
                            size={focusedSelect === 'barangay' ? 5 : 1}
                            className={`block w-full pl-3 pr-10 py-2.5 sm:py-2.5 border-2 rounded-lg text-sm sm:text-base touch-manipulation address-select ${
                              errors.barangay && touched.barangay
                                ? 'border-red-400 text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-red-50'
                                : 'border-gray-300 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white'
                            } transition-all duration-200`}
                            style={{ 
                              color: errors.barangay && touched.barangay ? 'rgb(220, 38, 38)' : 'rgb(55, 65, 81)'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFocusedSelect('barangay');
                            }}
                            onFocus={() => setFocusedSelect('barangay')}
                            onBlur={(e) => {
                              // Don't close if clicking on the select itself
                              if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('select.address-select')) {
                                return;
                              }
                              setTimeout(() => setFocusedSelect(null), 300);
                            }}
                            onChange={(e) => {
                              handleBarangayChange(e.target.value, setFieldValue);
                              setTimeout(() => setFocusedSelect(null), 200);
                            }}
                          >
                            <option value="" className="text-gray-500">
                              {touched.barangay && errors.barangay ? errors.barangay : selectedMunicipality ? 'Select Barangay' : 'Select Municipality First'}
                            </option>
                            {barangays.map((barangay) => (
                              <option key={barangay} value={barangay} className="text-gray-700">
                                {barangay}
                              </option>
                            ))}
                          </Field>
                        </div>
                      </div>

                      {/* Street Address - Fourth */}
                      <div>
                        <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1">
                          Street Address *
                        </label>
                        <div className="relative">
                          <Field
                            id="street"
                            name="street"
                            type="text"
                            className={`block w-full pl-3 pr-3 py-2.5 border-2 rounded-lg ${
                              errors.street && touched.street
                                ? 'border-red-400 text-red-600 placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-red-50'
                                : 'border-gray-300 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white'
                            } transition-all duration-200`}
                            placeholder={(touched.street && errors.street) ? errors.street : 'Street Address'}
                            style={{ color: errors.street && touched.street ? 'rgb(220, 38, 38)' : 'rgb(55, 65, 81)' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Step 4: Account Security */}
                  {currentStep === 4 && (
                  <div className="space-y-2 sm:space-y-3 mt-2 sm:mt-3">
                    <div className="flex items-center space-x-2 mb-1 sm:mb-2">
                      <FiLock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                      <h3 className="text-base sm:text-lg font-semibold text-gray-800">Account Security</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 md:gap-3">
                    {/* Password */}
                    <div className="group">
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                          <FiLock className="h-5 w-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                        </div>
                        <Field
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          className={`block w-full pl-10 pr-10 py-2.5 border-2 rounded-lg ${
                            errors.password && touched.password
                              ? 'border-red-400 text-red-600 placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-red-50'
                              : 'border-gray-300 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white'
                          } transition-all duration-200`}
                          placeholder={(touched.password && errors.password) ? errors.password : '••••••••'}
                          style={{ color: errors.password && touched.password ? 'rgb(220, 38, 38)' : 'rgb(55, 65, 81)' }}
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center z-10">
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
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

                    {/* Confirm Password */}
                    <div className="group">
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                          <FiLock className="h-5 w-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                        </div>
                        <Field
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          className={`block w-full pl-10 pr-10 py-2.5 border-2 rounded-lg ${
                            errors.confirmPassword && touched.confirmPassword
                              ? 'border-red-400 text-red-600 placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-red-50'
                              : 'border-gray-300 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white'
                          } transition-all duration-200`}
                          placeholder={(touched.confirmPassword && errors.confirmPassword) ? errors.confirmPassword : '••••••••'}
                          style={{ color: errors.confirmPassword && touched.confirmPassword ? 'rgb(220, 38, 38)' : 'rgb(55, 65, 81)' }}
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center z-10">
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
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
                  </div>
                  </div>
                  )}
                </div>

                {/* Navigation Buttons */}
                <div className="pt-1 sm:pt-2 mt-1 sm:mt-2">
                  <div className="flex gap-2 sm:gap-3">
                    {/* Previous Button */}
                    {currentStep > 1 && (
                      <button
                        type="button"
                        onClick={handlePrevious}
                        className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 md:gap-2.5 py-3 sm:py-4 md:py-4 lg:py-5 px-4 sm:px-6 md:px-8 lg:px-10 border-2 border-gray-300 text-sm sm:text-base md:text-lg font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 active:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 shadow-md hover:shadow-lg touch-manipulation min-h-[44px] md:min-h-[52px]"
                      >
                        <FiChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="hidden xs:inline">Previous</span>
                        <span className="xs:hidden">Prev</span>
                      </button>
                    )}
                    
                    {/* Next/Submit Button */}
                    {currentStep < totalSteps ? (
                      <button
                        type="button"
                        onClick={() => handleNext(errors, touched, values, validateForm, setTouched)}
                        className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 md:gap-2.5 py-3 sm:py-4 md:py-4 lg:py-5 px-4 sm:px-6 md:px-8 lg:px-10 border border-transparent text-sm sm:text-base md:text-lg font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 active:from-blue-800 active:to-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg hover:shadow-xl touch-manipulation min-h-[44px] md:min-h-[52px]"
                      >
                        <span>Next</span>
                        <FiChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isSubmitting || isLoading}
                        className="flex-1 flex items-center justify-center py-3 sm:py-4 px-4 sm:px-6 border border-transparent text-sm sm:text-base font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 active:from-blue-800 active:to-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl touch-manipulation min-h-[44px]"
                      >
                        {isLoading || isSubmitting ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span className="px-2">Create Account</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </PublicLayout>
  );
};

export default Register;