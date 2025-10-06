// src/pages/public/Services.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicNavbar from '../../components/layouts/PublicNavbar';
import PublicFooter from '../../components/layouts/PublicFooter';
import supabase from '../../config/supabaseClient';
import { FiCalendar } from 'react-icons/fi';
import cabugaoImg from '../../assets/Cabugao Branch.jpg';
import sanJuanImg from '../../assets/San Juan Branch.jpg';
import cabugaoImg2 from '../../assets/Cabugaoo.png';
import sanJuanImg2 from '../../assets/San Juan Branchh.jpg';
import cabugaoImg3 from '../../assets/cabugao branchh.jpg';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

const Services = () => {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [categorizedServices, setCategorizedServices] = useState({});

  useEffect(() => {
    const fetchServices = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('services')
          .select('id, name, description, category, price, price_min, price_max, duration, image_url')
          .order('name');
        if (error) throw error;
        setServices(data || []);
        // Extract unique categories
        const uniqueCategories = [...new Set((data || []).map(service => service.category))].filter(Boolean);
        setCategories(['all', ...uniqueCategories]);
        // Group by category
        const grouped = {};
        (data || []).forEach(service => {
          const category = service.category || 'Other';
          if (!grouped[category]) grouped[category] = [];
          grouped[category].push(service);
        });
        setCategorizedServices(grouped);
      } catch (error) {
        console.error('Error fetching services:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchServices();
  }, []);

  // Filtered categories
  const displayedCategories = activeCategory === 'all'
    ? Object.keys(categorizedServices)
    : [activeCategory];

  // Format price
  const formatPrice = (service) => {
    if (service.price_min && service.price_max) {
      return `₱${service.price_min.toLocaleString()} - ₱${service.price_max.toLocaleString()}`;
    } else if (service.price) {
      return `₱${service.price.toLocaleString()}`;
    }
    return 'Price varies';
  };

  // Format category name
  const formatCategoryName = (category) => {
    const categoryMap = {
      'general': 'General Dentistry',
      'cosmetic': 'Cosmetic Dentistry',
      'orthodontics': 'Orthodontics',
      'surgery': 'Oral Surgery',
      'other': 'Other Services'
    };
    return categoryMap[category] || (category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Other Services');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative w-full h-[320px] md:h-[400px] lg:h-[480px] flex items-center justify-center overflow-hidden">
        {/* Swiper Carousel as Background */}
        <Swiper
          modules={[Autoplay, Pagination]}
          autoplay={{ delay: 4000, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          loop
          className="absolute inset-0 w-full h-full z-0"
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
        {/* Overlay for readability */}
        <div className="absolute inset-0 bg-black/50 z-10" />
        {/* Hero Content */}
        <div className="relative z-20 w-full flex flex-col items-center justify-center h-full text-center px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white drop-shadow-lg">Our Dental Services</h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto drop-shadow">
            Comprehensive care for all your dental needs
          </p>
        </div>
      </section>

      {/* Services List */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 rounded-md font-medium border transition-colors ${
                  activeCategory === category
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-primary-50'
                }`}
              >
                {category === 'all' ? 'All Categories' : formatCategoryName(category)}
              </button>
            ))}
          </div>
          {isLoading ? (
            <div className="text-center py-16 text-gray-500">Loading services...</div>
          ) : (
            displayedCategories.map(category => (
              categorizedServices[category] && categorizedServices[category].length > 0 && (
            <div key={category} className="mb-16">
                  <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">{formatCategoryName(category)}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {categorizedServices[category].map(service => (
                  <div 
                        key={service.id}
                        className="bg-gray-50 rounded-lg overflow-hidden shadow-md transition-transform hover:scale-105 flex flex-col items-stretch"
                        style={{ minHeight: '370px' }}
                      >
                        {/* Service Image */}
                        <div className="w-full flex justify-center mb-3">
                          {service.image_url ? (
                            <img
                              src={service.image_url}
                              alt={service.name}
                              className="h-40 w-full object-cover rounded-t-lg shadow-md transition-transform duration-300 hover:scale-105 bg-gray-50"
                              style={{ maxHeight: '160px', minHeight: '120px', objectFit: 'cover' }}
                            />
                          ) : (
                            <div className="h-40 w-full flex items-center justify-center bg-gray-100 rounded-t-lg text-gray-400 text-4xl shadow-md">
                              <span role="img" aria-label="Service">🦷</span>
                            </div>
                          )}
                        </div>
                        <div className="p-6 flex-1 flex flex-col">
                          <h3 className="text-xl font-bold text-gray-900 mb-1 text-center">{service.name}</h3>
                          <div className="flex justify-between items-center mb-3 text-sm">
                            <span className="text-gray-500 font-medium">{service.duration || '-'} min</span>
                            <span className="text-primary-600 font-bold text-lg">{formatPrice(service)}</span>
                      </div>
                          <p className="text-gray-600 mb-4 text-center flex-1">
                            {service.description || 'No description available.'}
                      </p>
                      <Link 
                        to="/login" 
                            className="inline-flex items-center text-primary-600 hover:text-primary-800 justify-center"
                      >
                        <FiCalendar className="mr-1" />
                        <span>Book Appointment</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
              )
            ))
          )}
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Ready to Schedule Your Visit?</h2>
            <p className="text-xl text-gray-600 mb-8">
              Our team is ready to provide you with exceptional dental care
            </p>
            <div className="flex justify-center space-x-4">
              <Link
                to="/register"
                className="px-6 py-3 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 transition-colors"
              >
                Register Now
              </Link>
              <Link
                to="/login"
                className="px-6 py-3 border border-primary-600 text-primary-600 font-medium rounded-md hover:bg-primary-50 transition-colors"
              >
                Login & Book
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default Services;