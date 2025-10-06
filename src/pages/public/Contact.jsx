// src/pages/public/Contact.jsx
import React, { useState } from 'react';
import PublicNavbar from '../../components/layouts/PublicNavbar';
import PublicFooter from '../../components/layouts/PublicFooter';
import { FiMapPin, FiPhone, FiMail, FiClock, FiSend, FiCheck } from 'react-icons/fi';
import { toast } from 'react-toastify';
import cabugaoImg from '../../assets/Cabugao Branch.jpg';
import sanJuanImg from '../../assets/San Juan Branch.jpg';
import cabugaoImg2 from '../../assets/Cabugaoo.png';
import sanJuanImg2 from '../../assets/San Juan Branchh.jpg';
import cabugaoImg3 from '../../assets/cabugao branchh.jpg';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    try {
      // In a real app, this would be an API call to send the form data
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Message sent successfully!');
      setSubmitted(true);
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
      });
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white drop-shadow-lg">Contact Us</h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto drop-shadow">
            We're here to answer your questions and help you schedule your next visit
          </p>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {/* Cabugao Branch */}
            <div className="bg-gray-50 rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Cabugao Branch</h2>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <FiMapPin className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-gray-900 font-medium">Address</p>
                    <p className="text-gray-600">Salomague road, Turod, Cabugao, Ilocos Sur</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <FiPhone className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-gray-900 font-medium">Phone</p>
                    <p className="text-gray-600">09064782745</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <FiMail className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-gray-900 font-medium">Email</p>
                    <p className="text-gray-600">docsilariosaplor@gmail.com</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <FiClock className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-gray-900 font-medium">Hours</p>
                    <div className="text-gray-600">
                      <p>Monday to Friday: 8:00 AM - 12:00 PM</p>
                      <p>Saturday: 8:00 AM - 5:00 PM</p>
                      
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* San Juan Branch */}
            <div className="bg-gray-50 rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">San Juan Branch</h2>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <FiMapPin className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-gray-900 font-medium">Address</p>
                    <p className="text-gray-600">Luna Street, Ressurection, San Juan, Ilocos Sur</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <FiPhone className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-gray-900 font-medium">Phone</p>
                    <p className="text-gray-600">09064782745</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <FiMail className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-gray-900 font-medium">Email</p>
                    <p className="text-gray-600">docsilariosaplor@gmail.com</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <FiClock className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-gray-900 font-medium">Hours</p>
                    <div className="text-gray-600">
                      <p>Monday to Friday: 1:00 PM - 5:00 PM</p>
                    
                      <p>Sunday: 8:00 AM - 5:00 PM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Clinic Location Maps */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Cabugao Branch Map */}
            <div className="rounded-lg overflow-hidden shadow-lg">
              <div className="bg-primary-600 text-white p-4">
                <h3 className="text-lg font-semibold">Cabugao Branch Location</h3>
                <p className="text-sm opacity-90">Turod, Cabugao, Ilocos Sur</p>
              </div>
              <div className="h-80">
    <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d61339.63367044403!2d120.4285711!3d17.7873582!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x338e8bfd87467c21%3A0x8f66e4289591e9a5!2sTurod%2C%20Cabugao%2C%20Ilocos%20Sur!5e0!3m2!1sen!2sph!4v1683179262796!5m2!1sen!2sph"
      width="100%" 
      height="100%" 
      style={{ border: 0 }} 
      allowFullScreen 
      loading="lazy" 
      referrerPolicy="no-referrer-when-downgrade"
      className="w-full h-full"
    />
              </div>
              <div className="bg-gray-50 p-4">
                <a 
                  href="https://www.google.com/maps/place/Turod,+Cabugao,+Ilocos+Sur/@17.7873582,120.4285711,3a,24.9y,172.48h,81.67t/data=!3m7!1e1!3m5!1sqND2coPvSPaqZZV_2ZRYrg!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D8.32729996166718%26panoid%3DqND2coPvSPaqZZV_2ZRYrg%26yaw%3D172.48375389058597!7i16384!8i8192!4m6!3m5!1s0x338e8bfd87467c21:0x8f66e4289591e9a5!8m2!3d17.7932451!4d120.4386437!16s%2Fg%2F11fyxds25y?authuser=0&entry=ttu&g_ep=EgoyMDI1MDczMC4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center"
                >
                  <FiMapPin className="mr-1" />
                  View Street View
                </a>
              </div>
  </div>
  
            {/* San Juan Branch Map */}
            <div className="rounded-lg overflow-hidden shadow-lg">
              <div className="bg-primary-600 text-white p-4">
                <h3 className="text-lg font-semibold">San Juan Branch Location</h3>
                <p className="text-sm opacity-90">Resurreccion (Pob.), San Juan, Ilocos Sur</p>
              </div>
              <div className="h-80">
    <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d61371.45399090823!2d120.4574483!3d17.7413083!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x338e8a4738fbc319%3A0xd097d575210b603b!2sResurreccion%20(Pob.)%2C%20San%20Juan%2C%20Ilocos%20Sur!5e0!3m2!1sen!2sph!4v1683179378525!5m2!1sen!2sph"
      width="100%" 
      height="100%" 
      style={{ border: 0 }} 
      allowFullScreen 
      loading="lazy" 
      referrerPolicy="no-referrer-when-downgrade"
      className="w-full h-full"
    />
              </div>
              <div className="bg-gray-50 p-4">
                <a 
                  href="https://www.google.com/maps/place/Resurreccion+(Pob.),+San+Juan,+Ilocos+Sur/@17.7413083,120.4574483,3a,48.9y,242.26h,108.31t/data=!3m7!1e1!3m5!1sQfcXLYL1Spkoo3l2daH0yA!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D-18.30738945994223%26panoid%3DQfcXLYL1Spkoo3l2daH0yA%26yaw%3D242.2614631101447!7i16384!8i8192!4m6!3m5!1s0x338e8a4738fbc319:0xd097d575210b603b!8m2!3d17.7405154!4d120.4602459!16s%2Fg%2F11f0wncf8w?authuser=0&entry=ttu&g_ep=EgoyMDI1MDczMC4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center"
                >
                  <FiMapPin className="mr-1" />
                  View Street View
                </a>
              </div>
  </div>
</div>
</div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default Contact;