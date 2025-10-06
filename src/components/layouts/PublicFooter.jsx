// src/components/layouts/PublicFooter.jsx
import { Link } from 'react-router-dom';
import { FiMapPin, FiPhone, FiMail, FiClock, FiFacebook, FiInstagram } from 'react-icons/fi';

const PublicFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-xl font-semibold mb-4">Silario Dental Clinic</h3>
            <p className="text-gray-400 mb-4">
              Providing quality dental care for families since 2021. We are dedicated to helping you achieve a healthy, beautiful smile.
            </p>
            <div className="flex space-x-4">
              <a href="https://www.facebook.com/SilarioDentalClinicOfficial/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-primary-400 transition-colors">
                <FiFacebook size={20} />
              </a>
              <a href="https://www.instagram.com/silariodentalclinic_official/?fbclid=IwY2xjawJnQiFleHRuA2FlbQIxMAABHogN8Ds0NCKcTrpPjmkSPmMxEdfvjUPriAE3T0ppTay5gnlyjkiwnep8Qg-4_aem_F2o1pxRRIoDZtJbK_-Ow5w" target="_blank" rel="noopener noreferrer" className="text-white hover:text-primary-400 transition-colors">
                <FiInstagram size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xl font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-400 hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-gray-400 hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/services" className="text-gray-400 hover:text-white transition-colors">
                  Services
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-gray-400 hover:text-white transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-gray-400 hover:text-white transition-colors">
                  Patient Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xl font-semibold mb-4">Contact Information</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <FiMapPin className="mt-1 mr-3 text-primary-400" />
                <div>
                  <p className="text-gray-400">Cabugao Branch: Salomague road, Turod, Cabugao, Ilocos Sur</p>
                  <p className="text-gray-400">San Juan Branch: Luna Street, Ressurection, San Juan, Ilocos Sur</p>
                </div>
              </li>
              <li className="flex items-center">
                <FiPhone className="mr-3 text-primary-400" />
                <p className="text-gray-400">09064782745</p>
              </li>
              <li className="flex items-center">
                <FiMail className="mr-3 text-primary-400" />
                <p className="text-gray-400">docsilariosaplor@gmail.com</p>
              </li>
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h3 className="text-xl font-semibold mb-4">Working Hours</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <FiClock className="mt-1 mr-3 text-primary-400" />
                <div>
                  <p className="font-medium text-white">Cabugao Branch:</p>
                  <p className="text-gray-400">Monday to Friday: 8:00 AM - 12:00 PM</p>
                  <p className="text-gray-400">Saturday: 8:00 AM - 5:00 PM</p>
                </div>
              </li>
              <li className="flex items-start">
                <FiClock className="mt-1 mr-3 text-primary-400" />
                <div>
                  <p className="font-medium text-white">San Juan Branch:</p>
                  <p className="text-gray-400">Monday to Friday: 1:00 PM - 5:00 PM</p>
                  <p className="text-gray-400">Sunday: 8:00 AM - 5:00 PM</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 text-center">
          <p className="text-gray-400">
            &copy; {currentYear} Silario Dental Clinic. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;