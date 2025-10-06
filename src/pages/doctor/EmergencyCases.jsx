// src/pages/doctor/EmergencyCases.jsx
import React from 'react';
import { FiAlertCircle, FiUser, FiClock, FiMapPin, FiPhone, FiPlus } from 'react-icons/fi';

const EmergencyCases = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Emergency Cases</h1>
          <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
            <div className="flex items-center">
              <FiPlus className="mr-2" />
              <span>Add Emergency</span>
            </div>
          </button>
        </div>

        {/* Alert Box */}
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiAlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                Emergency cases require immediate attention. Please review and prioritize these patients.
              </p>
            </div>
          </div>
        </div>

        {/* Current Emergencies */}
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <div className="px-4 py-5 sm:px-6 bg-gray-50">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Current Emergency Cases</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Patients requiring immediate attention.</p>
          </div>
          <div className="border-t border-gray-200">
            <div className="p-6 text-center">
              <p className="text-gray-500">No emergency cases at the moment.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyCases;