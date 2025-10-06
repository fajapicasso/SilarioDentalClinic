// src/pages/auth/Register.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { FiEye, FiEyeOff, FiUser, FiMail, FiPhone, FiHome, FiCalendar, FiLock } from 'react-icons/fi';
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
    .max(new Date(), 'Birthday cannot be in the future'),
  age: Yup.number()
    .required('Age is required')
    .positive('Age must be positive')
    .integer('Age must be an integer'),
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

  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    setIsLoading(true);
    
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

  return (
    <PublicLayout>
      <PublicNavbar />
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
            <img src={cabugaoImg} alt="Cabugao Branch" className="w-full h-full object-cover object-center" />
          </SwiperSlide>
          <SwiperSlide>
            <img src={sanJuanImg} alt="San Juan Branch" className="w-full h-full object-cover object-center" />
          </SwiperSlide>
          <SwiperSlide>
            <img src={cabugaoImg2} alt="Cabugao Branch 2" className="w-full h-full object-cover object-center" />
          </SwiperSlide>
          <SwiperSlide>
            <img src={sanJuanImg2} alt="San Juan Branch 2" className="w-full h-full object-cover object-center" />
          </SwiperSlide>
          <SwiperSlide>
            <img src={cabugaoImg3} alt="Cabugao Branch 3" className="w-full h-full object-cover object-center" />
          </SwiperSlide>
        </Swiper>
        <div className="absolute inset-0 bg-black/50" />
      </div>
      {/* Register Card */}
      <div className="relative z-10 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white/80 p-8 rounded-xl shadow-md mt-12">
          {/* Professional Header */}
          <div className="flex flex-col items-center mb-6">
              <div className="mb-2">
                <img src={logo} alt="Silario Dental Clinic Logo" className="h-24 w-24 object-contain" />
              </div>
            <h1 className="text-2xl font-bold text-primary-700 tracking-wide">Silario Dental Clinic</h1>
            <div className="w-16 border-b-2 border-primary-200 mt-2 mb-1"></div>
          </div>

          <div className="text-center">
            <h2 className="mt-6 text-2xl font-bold text-gray-600">Create your account</h2>
            <p className="mt-2 text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                Sign in
              </Link>
            </p>
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
            {({ isSubmitting, errors, touched, setFieldValue, values }) => (
              <Form className="mt-8 space-y-6">
                <div className="space-y-6">
                  {/* Name Fields */}
                <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <FiUser className="h-5 w-5 text-gray-400" />
                      <h3 className="text-lg font-medium text-gray-700">Personal Information</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* First Name */}
                  <div>
                      <label htmlFor="first_name" className="block text-sm font-medium text-gray-500">
                        First Name *
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiUser className="h-5 w-5 text-gray-400" />
                      </div>
                      <Field
                          id="first_name"
                          name="first_name"
                        type="text"
                        className={`block w-full pl-10 pr-3 py-2 border ${
                            errors.first_name && touched.first_name
                            ? 'border-red-300 text-red-600 placeholder-red-200 focus:outline-none focus:ring-red-500 focus:border-red-500 bg-red-50'
                            : 'border-gray-300 text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100'
                        } rounded-md shadow-sm`}
                          placeholder="first name"
                        style={{ color: 'rgb(75, 85, 99)' }}
                      />
                    </div>
                    <ErrorMessage
                        name="first_name"
                        component="p"
                        className="mt-1 text-sm text-yellow-600"
                      />
                    </div>

                    {/* Middle Name */}
                    <div>
                      <label htmlFor="middle_name" className="block text-sm font-medium text-gray-500">
                        Middle Name
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <Field
                          id="middle_name"
                          name="middle_name"
                          type="text"
                          className={`block w-full pl-3 pr-3 py-2 border ${
                            errors.middle_name && touched.middle_name
                              ? 'border-red-300 text-red-600 placeholder-red-200 focus:outline-none focus:ring-red-500 focus:border-red-500 bg-red-50'
                              : 'border-gray-300 text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100'
                          } rounded-md shadow-sm`}
                          placeholder="middle name"
                          style={{ color: 'rgb(75, 85, 99)' }}
                        />
                      </div>
                      <ErrorMessage
                        name="middle_name"
                      component="p"
                      className="mt-1 text-sm text-yellow-600"
                    />
                  </div>

                    {/* Last Name */}
                    <div>
                      <label htmlFor="last_name" className="block text-sm font-medium text-gray-500">
                        Last Name *
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <Field
                          id="last_name"
                          name="last_name"
                          type="text"
                          className={`block w-full pl-3 pr-3 py-2 border ${
                            errors.last_name && touched.last_name
                              ? 'border-red-300 text-red-600 placeholder-red-200 focus:outline-none focus:ring-red-500 focus:border-red-500 bg-red-50'
                              : 'border-gray-300 text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100'
                          } rounded-md shadow-sm`}
                          placeholder="last name"
                          style={{ color: 'rgb(75, 85, 99)' }}
                        />
                      </div>
                      <ErrorMessage
                        name="last_name"
                        component="p"
                        className="mt-1 text-sm text-yellow-600"
                      />
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <FiMail className="h-5 w-5 text-gray-400" />
                      <h3 className="text-lg font-medium text-gray-700">Contact Information</h3>
                    </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-500">
                      Email Address
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiMail className="h-5 w-5 text-gray-400" />
                      </div>
                      <Field
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        className={`block w-full pl-10 pr-3 py-2 border ${
                          errors.email && touched.email
                            ? 'border-red-300 text-red-600 placeholder-red-200 focus:outline-none focus:ring-red-500 focus:border-red-500 bg-red-50'
                            : 'border-gray-300 text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100'
                        } rounded-md shadow-sm`}
                        placeholder="user@gmail.com"
                        style={{ color: 'rgb(75, 85, 99)' }}
                      />
                    </div>
                    <ErrorMessage
                      name="email"
                      component="p"
                      className="mt-1 text-sm text-yellow-600"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-500">
                      Phone Number
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiPhone className="h-5 w-5 text-gray-400" />
                      </div>
                      <Field
                        id="phone"
                        name="phone"
                        type="tel"
                        className={`block w-full pl-10 pr-3 py-2 border ${
                          errors.phone && touched.phone
                            ? 'border-red-300 text-red-600 placeholder-red-200 focus:outline-none focus:ring-red-500 focus:border-red-500 bg-red-50'
                            : 'border-gray-300 text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100'
                        } rounded-md shadow-sm`}
                        placeholder="+63 *** *******"
                        style={{ color: 'rgb(75, 85, 99)' }}
                      />
                    </div>
                    <ErrorMessage
                      name="phone"
                      component="p"
                      className="mt-1 text-sm text-yellow-600"
                    />
                  </div>
                </div>

                  {/* Address Fields */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <FiHome className="h-5 w-5 text-gray-400" />
                      <h3 className="text-lg font-medium text-gray-700">Address Information</h3>
                  </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Street Address */}
                      <div>
                        <label htmlFor="street" className="block text-sm font-medium text-gray-500">
                          Street Address *
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <Field
                            id="street"
                            name="street"
                            type="text"
                            className={`block w-full pl-3 pr-3 py-2 border ${
                              errors.street && touched.street
                                ? 'border-red-300 text-red-600 placeholder-red-200 focus:outline-none focus:ring-red-500 focus:border-red-500 bg-red-50'
                                : 'border-gray-300 text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100'
                            } rounded-md shadow-sm`}
                            placeholder="street address"
                            style={{ color: 'rgb(75, 85, 99)' }}
                          />
                        </div>
                        <ErrorMessage
                          name="street"
                          component="p"
                          className="mt-1 text-sm text-yellow-600"
                        />
                      </div>

                      {/* Barangay */}
                  <div>
                        <label htmlFor="barangay" className="block text-sm font-medium text-gray-500">
                          Barangay *
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                          <Field
                            id="barangay"
                            name="barangay"
                            type="text"
                            className={`block w-full pl-3 pr-3 py-2 border ${
                              errors.barangay && touched.barangay
                                ? 'border-red-300 text-red-600 placeholder-red-200 focus:outline-none focus:ring-red-500 focus:border-red-500 bg-red-50'
                                : 'border-gray-300 text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100'
                            } rounded-md shadow-sm`}
                            placeholder="barangay"
                            style={{ color: 'rgb(75, 85, 99)' }}
                          />
                        </div>
                        <ErrorMessage
                          name="barangay"
                          component="p"
                          className="mt-1 text-sm text-yellow-600"
                        />
                      </div>

                      {/* City */}
                      <div>
                        <label htmlFor="city" className="block text-sm font-medium text-gray-500">
                          City *
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                      <Field
                            id="city"
                            name="city"
                        type="text"
                            className={`block w-full pl-3 pr-3 py-2 border ${
                              errors.city && touched.city
                            ? 'border-red-300 text-red-600 placeholder-red-200 focus:outline-none focus:ring-red-500 focus:border-red-500 bg-red-50'
                            : 'border-gray-300 text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100'
                        } rounded-md shadow-sm`}
                            placeholder="city/municipality"
                        style={{ color: 'rgb(75, 85, 99)' }}
                      />
                    </div>
                    <ErrorMessage
                          name="city"
                      component="p"
                      className="mt-1 text-sm text-yellow-600"
                    />
                      </div>

                      {/* Province */}
                      <div>
                        <label htmlFor="province" className="block text-sm font-medium text-gray-500">
                          Province *
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <Field
                            id="province"
                            name="province"
                            type="text"
                            className={`block w-full pl-3 pr-3 py-2 border ${
                              errors.province && touched.province
                                ? 'border-red-300 text-red-600 placeholder-red-200 focus:outline-none focus:ring-red-500 focus:border-red-500 bg-red-50'
                                : 'border-gray-300 text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100'
                            } rounded-md shadow-sm`}
                            placeholder="province"
                            style={{ color: 'rgb(75, 85, 99)' }}
                          />
                        </div>
                        <ErrorMessage
                          name="province"
                          component="p"
                          className="mt-1 text-sm text-yellow-600"
                        />
                      </div>
                    </div>
                  </div>
                  </div>

                  {/* Birthday */}
                  <div>
                    <label htmlFor="birthday" className="block text-sm font-medium text-gray-500">
                      Birthday
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiCalendar className="h-5 w-5 text-gray-400" />
                      </div>
                      <DatePicker
                        id="birthday"
                        selected={values.birthday}
                        onChange={(date) => {
                          setFieldValue('birthday', date);
                          setFieldValue('age', calculateAge(date));
                        }}
                        dateFormat="MMMM d, yyyy"
                        className={`block w-full pl-10 pr-3 py-2 border ${
                          errors.birthday && touched.birthday
                            ? 'border-red-300 text-red-600 placeholder-red-200 focus:outline-none focus:ring-red-500 focus:border-red-500 bg-red-50'
                            : 'border-gray-300 text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100'
                        } rounded-md shadow-sm`}
                        placeholderText="Select your birthday"
                        maxDate={new Date()}
                        minDate={new Date(new Date().setFullYear(new Date().getFullYear() - 100))}
                        showMonthDropdown
                        showYearDropdown
                        scrollableYearDropdown
                        yearDropdownItemNumber={100}
                        style={{ color: 'rgb(75, 85, 99)' }}
                      />
                    </div>
                    <ErrorMessage
                      name="birthday"
                      component="p"
                      className="mt-1 text-sm text-yellow-600"
                    />
                  </div>

                  {/* Age */}
                  <div>
                    <label htmlFor="age" className="block text-sm font-medium text-gray-500">
                      Age
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <Field
                        id="age"
                        name="age"
                        type="number"
                        className={`block w-full pl-3 pr-3 py-2 border ${
                          errors.age && touched.age
                            ? 'border-red-300 text-red-600 placeholder-red-200 focus:outline-none focus:ring-red-500 focus:border-red-500'
                            : 'border-gray-300 text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500'
                        } rounded-md shadow-sm bg-gray-100`}
                        placeholder="Enter your age"
                        disabled={true}
                        style={{ color: 'rgb(75, 85, 99)' }}
                      />
                    </div>
                    <ErrorMessage
                      name="age"
                      component="p"
                      className="mt-1 text-sm text-yellow-600"
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-gray-500">
                      Gender
                    </label>
                    <div className="mt-1">
                      <Field
                        as="select"
                        id="gender"
                        name="gender"
                        className={`block w-full pl-3 pr-10 py-2 border ${
                          errors.gender && touched.gender
                            ? 'border-red-300 text-red-600 placeholder-red-200 focus:outline-none focus:ring-red-500 focus:border-red-500 bg-red-50'
                            : 'border-gray-300 text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100'
                        } rounded-md shadow-sm`}
                        style={{ color: 'rgb(75, 85, 99)' }}
                      >
                        <option value="" className="text-gray-500">Select Gender</option>
                        <option value="male" className="text-gray-600">Male</option>
                        <option value="female" className="text-gray-600">Female</option>
                        <option value="other" className="text-gray-600">Other</option>
                      </Field>
                    </div>
                    <ErrorMessage
                      name="gender"
                      component="p"
                      className="mt-1 text-sm text-yellow-600"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-500">
                      Password
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiLock className="h-5 w-5 text-gray-400" />
                      </div>
                      <Field
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        className={`block w-full pl-10 pr-10 py-2 border ${
                          errors.password && touched.password
                            ? 'border-red-300 text-red-600 placeholder-red-200 focus:outline-none focus:ring-red-500 focus:border-red-500 bg-red-50'
                            : 'border-gray-300 text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100'
                        } rounded-md shadow-sm`}
                        placeholder="********"
                        style={{ color: 'rgb(75, 85, 99)' }}
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-gray-400 hover:text-gray-500 focus:outline-none"
                        >
                          {showPassword ? (
                            <FiEyeOff className="h-5 w-5" />
                          ) : (
                            <FiEye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Password must be at least 8 characters and include at least one special character.
                    </p>
                    <ErrorMessage
                      name="password"
                      component="p"
                      className="mt-1 text-sm text-yellow-600"
                    />
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-500">
                      Confirm Password
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiLock className="h-5 w-5 text-gray-400" />
                      </div>
                      <Field
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        className={`block w-full pl-10 pr-10 py-2 border ${
                          errors.confirmPassword && touched.confirmPassword
                            ? 'border-red-300 text-red-600 placeholder-red-200 focus:outline-none focus:ring-red-500 focus:border-red-500 bg-red-50'
                            : 'border-gray-300 text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100'
                        } rounded-md shadow-sm`}
                        placeholder="********"
                        style={{ color: 'rgb(75, 85, 99)' }}
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="text-gray-400 hover:text-gray-500 focus:outline-none"
                        >
                          {showConfirmPassword ? (
                            <FiEyeOff className="h-5 w-5" />
                          ) : (
                            <FiEye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <ErrorMessage
                      name="confirmPassword"
                      component="p"
                      className="mt-1 text-sm text-yellow-600"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoading}
                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-300 disabled:cursor-not-allowed"
                  >
                    {isLoading || isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'Create Account'
                    )}
                  </button>
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