// src/pages/public/Home.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCalendar, FiClock, FiMapPin, FiPhone, FiMail, FiChevronRight } from 'react-icons/fi';
import supabase from '../../config/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import PublicNavbar from '../../components/layouts/PublicNavbar';
import PublicFooter from '../../components/layouts/PublicFooter';
import clinicImg from '../../assets/clinic.png';
import cabugaoImg from '../../assets/Cabugao Branch.jpg';
import sanJuanImg from '../../assets/San Juan Branch.jpg';
import cabugaoImg2 from '../../assets/Cabugaoo.png';
import sanJuanImg2 from '../../assets/San Juan Branchh.jpg';
import cabugaoImg3 from '../../assets/cabugao branchh.jpg';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

const Home = () => {
  const [currentQueue, setCurrentQueue] = useState(null);
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect if user is logged in
  useEffect(() => {
    if (!loading && user) {
      // If user is logged in, redirect to appropriate dashboard
      switch (userRole) {
        case 'admin':
          navigate('/admin/dashboard', { replace: true });
          break;
        case 'doctor':
          navigate('/doctor/dashboard', { replace: true });
          break;
        case 'staff':
          navigate('/staff/dashboard', { replace: true });
          break;
        case 'patient':
          navigate('/patient/dashboard', { replace: true });
          break;
        default:
          // Do nothing if no role is assigned
          break;
      }
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    const fetchCurrentQueue = async () => {
      try {
        const { data, error } = await supabase
          .from('queue')
          .select('*')
          .eq('status', 'serving')
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        setCurrentQueue(data || null);
      } catch (error) {
        console.error('Error fetching current queue:', error);
      }
    };

    fetchCurrentQueue();

    // Setup real-time subscription for queue updates
    const queueSubscription = supabase
      .channel('public:queue')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'queue' 
      }, (payload) => {
        if (payload.new.status === 'serving') {
          setCurrentQueue(payload.new);
        } else if (payload.old && payload.old.status === 'serving' && payload.new.status !== 'serving') {
          // Refresh the queue data when the current serving patient changes status
          fetchCurrentQueue();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(queueSubscription);
    };
  }, []);

  // If we're still rendering, it means the user is not logged in or redirect is in progress
  
  const services = [
    {
      id: 1,
      title: 'General Dentistry',
      description: 'Comprehensive dental care including check-ups, cleaning, and preventive treatments.',
      icon: '🦷',
    },
    {
      id: 2,
      title: 'Orthodontics',
      description: 'Braces and aligners to straighten teeth and correct bite issues.',
      icon: '😁',
    },
    {
      id: 3,
      title: 'Cosmetic Dentistry',
      description: 'Enhance your smile with whitening, veneers, and other aesthetic treatments.',
      icon: '✨',
    },
    {
      id: 4,
      title: 'Oral Surgery',
      description: 'Extractions, implants, and other surgical procedures.',
      icon: '🔧',
    },
  ];

  const testimonials = [
    {
      id: 1,
      name: 'Maria Santos',
      quote: 'The staff at Silario Dental Clinic are incredibly professional and made me feel comfortable during my first visit. Highly recommended!',
      rating: 5,
    },
    {
      id: 2,
      name: 'John Rivera',
      quote: 'I had a dental emergency and they accommodated me right away. Dr. Silario was gentle and efficient. Great service!',
      rating: 5,
    },
    {
      id: 3,
      name: 'Elena Cruz',
      quote: 'Getting braces has never been easier. The team explained everything clearly and made sure I was comfortable with the process.',
      rating: 4,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar />

      {/* Hero Section with Swiper Carousel Background */}
      <section className="relative w-full min-h-[100vh] flex items-center justify-center overflow-hidden">
        {/* Swiper Carousel as Background */}
        <Swiper
          modules={[Autoplay, Pagination]}
          autoplay={{ delay: 4000, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          loop
          className="absolute inset-0 w-full h-full z-0"
        >
          <SwiperSlide>
            <img
              src={cabugaoImg}
              alt="Cabugao Branch"
              className="w-full h-full object-cover object-center"
            />
          </SwiperSlide>
          <SwiperSlide>
            <img
              src={sanJuanImg}
              alt="San Juan Branch"
              className="w-full h-full object-cover object-center"
            />
          </SwiperSlide>
          <SwiperSlide>
            <img
              src={cabugaoImg2}
              alt="Cabugao Branch 2"
              className="w-full h-full object-cover object-center"
            />
          </SwiperSlide>
          <SwiperSlide>
            <img
              src={sanJuanImg2}
              alt="San Juan Branch 2"
              className="w-full h-full object-cover object-center"
            />
          </SwiperSlide>
          <SwiperSlide>
            <img
              src={cabugaoImg3}
              alt="Cabugao Branch 3"
              className="w-full h-full object-cover object-center"
            />
          </SwiperSlide>
        </Swiper>
        {/* Overlay for readability */}
        <div className="absolute inset-0 bg-black/50 z-10" />
        {/* Hero Content */}
        <div className="relative z-20 w-full flex flex-col items-center justify-center h-full text-center px-4">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-white drop-shadow-lg">
            Your Smile, Our Priority
          </h1>
          <p className="mt-6 text-lg md:text-xl text-white/90 max-w-2xl mx-auto drop-shadow">
            Welcome to Silario Dental Clinic, where we provide exceptional dental care in a comfortable environment.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md bg-white text-primary-700 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white shadow"
            >
              Get Started
            </Link>
            <Link
              to="/services"
              className="inline-flex items-center justify-center px-6 py-3 border border-white text-base font-medium rounded-md text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-400 shadow"
            >
              Our Services
            </Link>
          </div>
        </div>
      </section>

     
      {/* Keep the rest of the original Home component */}
      {/* ... */}
      
      <PublicFooter />
    </div>
  );
};

export default Home; 