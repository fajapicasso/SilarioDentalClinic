// src/pages/patient/Services.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCalendar, FiSearch, FiFilter } from 'react-icons/fi';
import supabase from '../../config/supabaseClient';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const Services = () => {
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [categorizedServices, setCategorizedServices] = useState({});
  
  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    filterServices();
  }, [services, activeCategory, searchQuery]);

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      // Use patient_service_view if it exists, otherwise use services table
      const { data, error } = await supabase
        .from('patient_service_view')
        .select('id, name, description, category, price, price_min, price_max, duration, image_url')
        .order('name');
      
      if (error) {
        // If view doesn't exist, fallback to regular services table
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('id, name, description, category, price, price_min, price_max, duration, image_url')
          .order('name');
          
        if (servicesError) throw servicesError;
        setServices(servicesData || []);
        
        // Process categories
        const uniqueCategories = [...new Set(servicesData.map(service => service.category))].filter(Boolean);
        setCategories(['all', ...uniqueCategories]);
        
        // Group services by category
        const grouped = {};
        servicesData.forEach(service => {
          const category = service.category || 'Other';
          if (!grouped[category]) {
            grouped[category] = [];
          }
          grouped[category].push(service);
        });
        setCategorizedServices(grouped);
      } else {
        setServices(data || []);
        
        // Process categories
        const uniqueCategories = [...new Set(data.map(service => service.category))].filter(Boolean);
        setCategories(['all', ...uniqueCategories]);
        
        // Group services by category
        const grouped = {};
        data.forEach(service => {
          const category = service.category || 'Other';
          if (!grouped[category]) {
            grouped[category] = [];
          }
          grouped[category].push(service);
        });
        setCategorizedServices(grouped);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterServices = () => {
    let filtered = [...services];
    
    // Filter by category
    if (activeCategory !== 'all') {
      filtered = filtered.filter(service => service.category === activeCategory);
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        service =>
          (service.name && service.name.toLowerCase().includes(query)) ||
          (service.description && service.description.toLowerCase().includes(query))
      );
    }
    
    setFilteredServices(filtered);
    
    // Recategorize filtered services
    const grouped = {};
    filtered.forEach(service => {
      const category = service.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(service);
    });
    setCategorizedServices(grouped);
  };

  // Function to format category name for display
  const formatCategoryName = (category) => {
    if (!category) return 'Other Services';
    
    // Convert category keys like 'general' to 'General Dentistry'
    const categoryMap = {
      'general': 'General Dentistry',
      'cosmetic': 'Cosmetic Dentistry',
      'orthodontics': 'Orthodontics',
      'surgery': 'Oral Surgery',
      'other': 'Other Services'
    };
    
    return categoryMap[category] || category.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format price display
  const formatPrice = (service) => {
    // Check if we have price range
    if (service.price_min && service.price_max) {
      return `₱${service.price_min.toLocaleString()} - ₱${service.price_max.toLocaleString()}`;
    }
    // Otherwise use base price
    else if (service.price) {
      return `₱${service.price.toLocaleString()}`;
    }
    // If neither, show as variable
    return 'Price varies';
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">Dental Services</h1>
        </div>

        {/* Search and filter - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 mb-4 sm:mb-6">
          <div className="relative max-w-xs sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search services..."
              className="block w-full pl-8 sm:pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-gray-100 text-gray-600"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ color: 'rgb(75, 85, 99)' }}
            />
          </div>
          <div className="w-full sm:w-56">
            <div className="relative">
              <FiFilter className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
              <select
                className="block w-full pl-7 sm:pl-8 pr-6 py-1.5 text-xs sm:text-sm border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-md bg-gray-100 text-gray-600"
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                style={{ color: 'rgb(75, 85, 99)' }}
              >
                <option value="all" className="text-gray-600">All Categories</option>
                {categories.filter(cat => cat !== 'all').map((category) => (
                  <option key={category} value={category} className="text-gray-600">
                    {formatCategoryName(category)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Services List - Mobile Optimized */}
        {Object.keys(categorizedServices).length > 0 ? (
          Object.entries(categorizedServices).map(([category, categoryServices]) => (
            <div key={category} className="mb-6 sm:mb-8">
              <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">{formatCategoryName(category)}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {categoryServices.map((service) => (
                  <div 
                    key={service.id} 
                    className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-xl transition-shadow bg-white flex flex-col items-stretch"
                    style={{ minHeight: '280px' }}
                  >
                    {/* Service Image - Mobile Optimized */}
                    <div className="w-full flex justify-center mb-2 sm:mb-3">
                      {service.image_url ? (
                        <img
                          src={service.image_url}
                          alt={service.name}
                          className="h-28 sm:h-32 lg:h-40 w-full object-cover rounded-t-lg shadow-md transition-transform duration-300 hover:scale-105 bg-gray-50"
                          style={{ maxHeight: '160px', minHeight: '112px', objectFit: 'cover' }}
                        />
                      ) : (
                        <div className="h-28 sm:h-32 lg:h-40 w-full flex items-center justify-center bg-gray-100 rounded-t-lg text-gray-400 text-2xl sm:text-3xl lg:text-4xl shadow-md">
                          <span role="img" aria-label="Service">🦷</span>
                        </div>
                      )}
                    </div>
                    <h3 className="font-medium text-gray-900 text-sm sm:text-base lg:text-lg mb-1 text-center">{service.name}</h3>
                    <div className="mt-1 flex justify-between text-xs sm:text-sm mb-2">
                      <span className="text-gray-500">{service.duration || '-'} min</span>
                      <span className="text-primary-600 font-semibold text-right">{formatPrice(service)}</span>
                    </div>
                    <p className="mt-2 text-gray-600 text-xs sm:text-sm line-clamp-3 text-center">
                      {service.description || 'No description available.'}
                    </p>
                    {/* Optionally, add more modern UI elements here */}
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-6 sm:py-8">
            <p className="text-sm sm:text-base text-gray-500">No services found. Please try a different search or filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Services;