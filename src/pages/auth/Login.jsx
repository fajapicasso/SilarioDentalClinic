// src/pages/auth/Login.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { FiEye, FiEyeOff, FiUser, FiLock } from 'react-icons/fi';
import { toast } from 'react-toastify';
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

const LoginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
});

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    setIsLoading(true);
    try {
      const { success, role, error } = await login(values.email, values.password);
      
      if (success) {
        resetForm();
        // Redirect to the appropriate dashboard based on role
        switch (role) {
          case 'admin':
            navigate('/admin/dashboard');
            break;
          case 'doctor':
            navigate('/doctor/dashboard');
            break;
          case 'staff':
            navigate('/staff/dashboard');
            break;
          case 'patient':
            navigate('/patient/dashboard');
            break;
          default:
            navigate('/');
        }
      } else {
        toast.error(error || 'Failed to login. Please try again.');
      }
    } catch (error) {
      toast.error('An unexpected error occurred. Please try again.');
      console.error('Login error:', error);
    } finally {
      setSubmitting(false);
      setIsLoading(false);
    }
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
      {/* Login Card */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 pt-20">
        <div className="max-w-sm w-full space-y-4 bg-white/95 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-white/20 relative overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute -top-10 -right-10 w-20 h-20 bg-gradient-to-br from-blue-100/30 to-purple-100/30 rounded-full blur-xl"></div>
          <div className="absolute -bottom-10 -left-10 w-20 h-20 bg-gradient-to-tr from-purple-100/30 to-blue-100/30 rounded-full blur-xl"></div>
          
          {/* Professional Header */}
          <div className="flex flex-col items-center relative z-10" style={{ marginBottom: '-0.5rem' }}>
            <img src={logo} alt="Silario Dental Clinic Logo" className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 lg:h-32 lg:w-32 object-contain" />
          </div>
          
          <div className="text-center relative z-10 mb-6" style={{ marginTop: '-1.5rem' }}>
            <h2 className="text-xl font-semibold text-gray-800 mb-1">Sign in to your account</h2>
            <p className="text-sm text-gray-500 mb-3">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200">
                Sign up
              </Link>
            </p>
          </div>
          
          <Formik
            initialValues={{ email: '', password: '' }}
            validationSchema={LoginSchema}
            onSubmit={handleSubmit}
          >
            {({ isSubmitting, errors, touched }) => (
              <Form className="mt-4 space-y-4 relative z-10">
                <div className="space-y-4">
                  <div className="group">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        <FiUser className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <Field
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        className={`
                          appearance-none block w-full pl-10 pr-3 py-3 border-2 rounded-lg shadow-sm text-gray-700
                          bg-gray-50/50 backdrop-blur-sm transition-all duration-200
                          focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none focus:bg-white
                          hover:bg-gray-50 hover:border-gray-400
                          ${
                            errors.email && touched.email
                              ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500'
                              : 'border-gray-200'
                          }
                        `}
                        placeholder="you@example.com"
                      />
                    </div>
                    <ErrorMessage
                      name="email"
                      component="p"
                      className="mt-1 text-sm text-red-500 font-medium"
                    />
                  </div>
                  
                  <div className="group">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                        Password
                      </label>
                      <Link
                        to="/forgot-password"
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors duration-200"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        <FiLock className="h-5 w-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                      </div>
                      <Field
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        className={`
                          appearance-none block w-full pl-10 pr-10 py-3 border-2 rounded-lg shadow-sm text-gray-700
                          bg-gray-50/50 backdrop-blur-sm transition-all duration-200
                          focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:outline-none focus:bg-white
                          hover:bg-gray-50 hover:border-gray-400
                          ${
                            errors.password && touched.password
                              ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500'
                              : 'border-gray-200'
                          }
                        `}
                        placeholder="••••••••"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center z-10">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-gray-400 hover:text-gray-600 focus:outline-none transition-colors duration-200"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <FiEyeOff className="h-4 w-4" />
                          ) : (
                            <FiEye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <ErrorMessage
                      name="password"
                      component="p"
                      className="mt-1 text-sm text-red-500 font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-colors"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Remember me
                  </label>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoading}
                    className="group relative w-full flex justify-center py-2 sm:py-2.5 md:py-2.5 lg:py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl min-h-[36px] md:min-h-[40px]"
                  >
                    {isLoading || isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'Sign in'
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

export default Login;