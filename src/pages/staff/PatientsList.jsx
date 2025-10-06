// src/pages/staff/PatientsList.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiUser, FiCalendar, FiPhone, FiMail, FiEye, FiFileText, FiPlus, FiX } from 'react-icons/fi';
import { FiEdit } from 'react-icons/fi';
import supabase from '../../config/supabaseClient';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { toast } from 'react-toastify';

const PatientsList = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [patientFileCounts, setPatientFileCounts] = useState({});
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [newPatientData, setNewPatientData] = useState({
    full_name: '',
    email: '',
    phone: '',
    birthday: '',
    gender: '',
    address: ''
  });

  useEffect(() => {
    console.log('PatientsList component mounted');
    fetchPatients();
    
    return () => {
      console.log('PatientsList component unmounted');
    };
  }, []);

  useEffect(() => {
    // Filter patients based on search query
    if (searchQuery.trim() === '') {
      setFilteredPatients(patients);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = patients.filter(
        patient => 
          (patient.full_name && patient.full_name.toLowerCase().includes(query)) ||
          (patient.email && patient.email.toLowerCase().includes(query)) ||
          (patient.phone && patient.phone.includes(query))
      );
      setFilteredPatients(filtered);
    }
  }, [searchQuery, patients]);

  const fetchPatients = async () => {
    setIsLoading(true);
    
    try {
      console.log('Fetching patients...');
      // Only get patients with role 'patient'
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'patient')
        .neq('disabled', true)
        .order('full_name');
      
      if (error) throw error;
      
      setPatients(data || []);
      setFilteredPatients(data || []);
      
      // Get file counts for each patient
      fetchPatientFileCounts(data);
      
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Failed to load patients list');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPatientFileCounts = async (patientsList) => {
    if (!patientsList || patientsList.length === 0) return;
    
    try {
      // Get file counts for all patients at once
      const { data, error } = await supabase
        .from('patient_files')
        .select('patient_id, id');
      
      if (error) throw error;
      
      // Create a map of patient ID to file count
      const countMap = {};
      
      // Initialize all patients with 0 files
      patientsList.forEach(patient => {
        countMap[patient.id] = 0;
      });
      
      // Count files for each patient
      data.forEach(file => {
        if (countMap[file.patient_id] !== undefined) {
          countMap[file.patient_id]++;
        }
      });
      
      setPatientFileCounts(countMap);
      
    } catch (error) {
      console.error('Error fetching file counts:', error);
    }
  };

  const handleNewPatientSubmit = async (e) => {
    e.preventDefault();
    
    if (!newPatientData.full_name || !newPatientData.email) {
      toast.error('Name and email are required fields');
      return;
    }
    
    try {
      // First, create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newPatientData.email,
        password: 'TemporaryPassword123!', // This should be randomly generated in production
        options: {
          data: {
            full_name: newPatientData.full_name,
            role: 'patient'
          }
        }
      });
      
      if (authError) throw authError;
      
      // Then, create or update profile record
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: authData?.user?.id,
          email: newPatientData.email,
          full_name: newPatientData.full_name,
          phone: newPatientData.phone,
          birthday: newPatientData.birthday,
          gender: newPatientData.gender,
          address: newPatientData.address,
          role: 'patient',
          age: calculateAge(newPatientData.birthday).toString()
        });
      
      if (error) throw error;
      
      toast.success('Patient created successfully');
      setShowNewPatientModal(false);
      setNewPatientData({
        full_name: '',
        email: '',
        phone: '',
        birthday: '',
        gender: '',
        address: ''
      });
      
      // Refresh the patient list
      fetchPatients();
      
    } catch (error) {
      console.error('Error creating patient:', error);
      toast.error(`Failed to create patient: ${error.message}`);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set';
    try {
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return new Date(dateStr).toLocaleDateString('en-US', options);
    } catch (e) {
      return dateStr || 'Not set';
    }
  };

  const calculateAge = (birthday) => {
    if (!birthday) return '';
    try {
      const today = new Date();
      const birthDate = new Date(birthday);
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch (e) {
      return '';
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleViewPatient = (patientId) => {
    window.location.href = `/staff/patients/${patientId}`;
  };

  // Function to handle input changes in the new patient form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewPatientData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Patient Records</h1>
        <div className="flex space-x-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
          
        </div>
      </div>

      {filteredPatients.length > 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredPatients.map((patient) => (
              <li key={patient.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-gray-200 shadow-md">
                          {patient.profile_picture_url ? (
                            <img
                              src={`${patient.profile_picture_url}?t=${Date.now()}`}
                              alt={patient.full_name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center ${
                            patient.profile_picture_url ? 'hidden' : ''
                          } bg-primary-100 text-primary-600`}>
                            <span className="font-medium text-sm">
                              {patient.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-primary-600">{patient.full_name}</div>
                        <div className="text-sm text-gray-500">
                          {patient.email}
                          {patient.phone && ` • ${patient.phone}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {patientFileCounts[patient.id] > 0 && (
                        <div className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 flex items-center">
                          <FiFileText className="mr-1 h-3 w-3" />
                          {patientFileCounts[patient.id]} {patientFileCounts[patient.id] === 1 ? 'file' : 'files'}
                        </div>
                      )}
                      <button
                        onClick={() => handleViewPatient(patient.id)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        <FiEye className="mr-1 -ml-0.5 h-4 w-4" />
                        View Records
                      </button>
                     
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      {patient.birthday && (
                        <div className="flex items-center text-sm text-gray-500 mr-6">
                          <FiCalendar className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                          <span>
                            Age: {calculateAge(patient.birthday)}
                            <span className="hidden sm:inline"> ({formatDate(patient.birthday)})</span>
                          </span>
                        </div>
                      )}
                      {patient.gender && (
                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                          <div className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400">
                            {patient.gender === 'male' ? '♂' : patient.gender === 'female' ? '♀' : '⚥'}
                          </div>
                          <span>
                            {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                      <span>
                        Patient ID: {patient.id.substring(0, 8)}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6 text-center">
            <FiUser className="mx-auto h-12 w-12 text-gray-400" />
            {searchQuery.trim() !== '' ? (
              <>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No patients match your search</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try different keywords or clear the search field.
                </p>
                {patients.length > 0 && (
                  <div className="mt-3">
                    <button
                      type="button"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200"
                      onClick={() => setSearchQuery('')}
                    >
                      Clear search
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No patients yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Start by adding a new patient to the system.
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                    onClick={() => setShowNewPatientModal(true)}
                  >
                    <FiPlus className="mr-2 -ml-1 h-5 w-5" />
                    New Patient
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* New Patient Modal */}
      {showNewPatientModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Add New Patient</h3>
                <button
                  onClick={() => setShowNewPatientModal(false)}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>
              <div className="mt-2 px-7 py-3">
                <div className="space-y-4">
                  <div className="text-left">
                    <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input
                      type="text"
                      id="full_name"
                      name="full_name"
                      value={newPatientData.full_name}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div className="text-left">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={newPatientData.email}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div className="text-left">
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={newPatientData.phone}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div className="text-left">
                    <label htmlFor="birthday" className="block text-sm font-medium text-gray-700">Birthday</label>
                    <input
                      type="date"
                      id="birthday"
                      name="birthday"
                      value={newPatientData.birthday}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div className="text-left">
                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
                    <select
                      id="gender"
                      name="gender"
                      value={newPatientData.gender}
                      onChange={handleInputChange}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="text-left">
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700">Address</label>
                    <textarea
                      id="address"
                      name="address"
                      rows="2"
                      value={newPatientData.address}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    ></textarea>
                  </div>
                </div>
              </div>
              <div className="items-center px-4 py-3">
                <button
                  onClick={handleNewPatientSubmit}
                  className="w-full px-4 py-2 bg-primary-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  Create Patient
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientsList;