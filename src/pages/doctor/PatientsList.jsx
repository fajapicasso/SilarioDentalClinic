// src/pages/doctor/PatientsList.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiUser, FiCalendar, FiPhone, FiMail, FiEye, FiFileText, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import supabase from '../../config/supabaseClient';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { toast } from 'react-toastify';
import { useAuditLog } from '../../hooks/useAuditLog';

const PatientsList = () => {
  const navigate = useNavigate();
  const { logPatientView } = useAuditLog();
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [patientFileCounts, setPatientFileCounts] = useState({});
  const [groupedPatients, setGroupedPatients] = useState([]);
  const [expandedGuardians, setExpandedGuardians] = useState(new Set());

  useEffect(() => {
    console.log('PatientsList component mounted');
    fetchPatients();
    
    return () => {
      console.log('PatientsList component unmounted');
    };
  }, []);

  useEffect(() => {
    // Filter grouped patients based on search query
    if (searchQuery.trim() === '') {
      setFilteredPatients(groupedPatients);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = groupedPatients.filter(
        group => {
          // Match guardian
          const guardianMatches = 
            (group.full_name && group.full_name.toLowerCase().includes(query)) ||
            (group.email && group.email.toLowerCase().includes(query)) ||
            (group.phone && group.phone.includes(query));
          
          // Match any child
          const childMatches = group.children?.some(child =>
            (child.full_name && child.full_name.toLowerCase().includes(query)) ||
            (child.email && child.email.toLowerCase().includes(query)) ||
            (child.phone && child.phone.includes(query))
          );
          
          return guardianMatches || childMatches;
        }
      );
      setFilteredPatients(filtered);
    }
  }, [searchQuery, groupedPatients]);

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
      
      // Group patients: separate guardians from children
      const guardians = (data || []).filter(p => !p.guardian_id);
      const children = (data || []).filter(p => p.guardian_id);
      
      // Group children by guardian_id
      const childrenByGuardian = {};
      children.forEach(child => {
        if (!childrenByGuardian[child.guardian_id]) {
          childrenByGuardian[child.guardian_id] = [];
        }
        childrenByGuardian[child.guardian_id].push(child);
      });
      
      // Create grouped structure: guardians with their children
      const grouped = guardians.map(guardian => ({
        ...guardian,
        children: childrenByGuardian[guardian.id] || [],
        isGuardian: true
      }));
      
      // Add guardians that have children but aren't in the main list (edge case)
      Object.keys(childrenByGuardian).forEach(guardianId => {
        if (!grouped.find(g => g.id === guardianId)) {
          const guardian = data.find(p => p.id === guardianId);
          if (guardian) {
            grouped.push({
              ...guardian,
              children: childrenByGuardian[guardianId],
              isGuardian: true
            });
          }
        }
      });
      
      setGroupedPatients(grouped);
      setFilteredPatients(grouped);
      
      // Get file counts for each patient (including children)
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

  const handleViewPatient = async (patientId) => {
    console.log(`Navigating to patient records for ID: ${patientId}`);
    
    // Log audit event for patient view
    try {
      const patient = patients.find(p => p.id === patientId);
      await logPatientView({
        patient_id: patientId,
        patient_name: patient?.full_name,
        doctor_id: null, // Will be filled by the audit service
        action: 'view_patient_records'
      });
    } catch (auditError) {
      console.error('Error logging patient view audit event:', auditError);
      // Continue even if audit logging fails
    }
    
    navigate(`/doctor/patients/${patientId}`);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Patients Record</h1>
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

      {filteredPatients.length > 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredPatients.map((group) => (
              <li key={group.id}>
                {/* Guardian Card */}
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-gray-200 shadow-md">
                          {group.profile_picture_url ? (
                            <img
                              src={`${group.profile_picture_url}?t=${Date.now()}`}
                              alt={group.full_name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }} 
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center ${
                            group.profile_picture_url ? 'hidden' : ''
                          } bg-primary-100 text-primary-600`}>
                            <span className="font-medium text-sm">
                              {group.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-primary-600">{group.full_name}</div>
                        <div className="text-sm text-gray-500">
                          {group.email}
                          {group.phone && ` • ${group.phone}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {patientFileCounts[group.id] > 0 && (
                        <div className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 flex items-center">
                          <FiFileText className="mr-1 h-3 w-3" />
                          {patientFileCounts[group.id]} {patientFileCounts[group.id] === 1 ? 'file' : 'files'}
                        </div>
                      )}
                      <button
                        onClick={() => handleViewPatient(group.id)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        <FiEye className="mr-1 -ml-0.5 h-4 w-4" />
                        View Records
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      {group.birthday && (
                        <div className="flex items-center text-sm text-gray-500 mr-6">
                          <FiCalendar className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                          <span>
                            Age: {calculateAge(group.birthday)}
                            <span className="hidden sm:inline"> ({formatDate(group.birthday)})</span>
                          </span>
                        </div>
                      )}
                      {group.gender && (
                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                          <div className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400">
                            {group.gender === 'male' ? '♂' : group.gender === 'female' ? '♀' : '⚥'}
                          </div>
                          <span>
                            {group.gender.charAt(0).toUpperCase() + group.gender.slice(1)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Children Section - Collapsible */}
                  {group.children && group.children.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedGuardians);
                          if (newExpanded.has(group.id)) {
                            newExpanded.delete(group.id);
                          } else {
                            newExpanded.add(group.id);
                          }
                          setExpandedGuardians(newExpanded);
                        }}
                        className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
                      >
                        {expandedGuardians.has(group.id) ? (
                          <FiChevronUp className="mr-1 h-4 w-4" />
                        ) : (
                          <FiChevronDown className="mr-1 h-4 w-4" />
                        )}
                        <span className="font-medium">
                          {group.children.length} {group.children.length === 1 ? 'Child' : 'Children'}
                        </span>
                      </button>
                      
                      {expandedGuardians.has(group.id) && (
                        <div className="ml-6 space-y-2 mt-2">
                          {group.children.map((child) => (
                            <div key={child.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center flex-1">
                                  <div className="flex-shrink-0">
                                    <div className="h-8 w-8 rounded-full overflow-hidden border-2 border-gray-300 shadow-sm">
                                      {child.profile_picture_url ? (
                                        <img
                                          src={`${child.profile_picture_url}?t=${Date.now()}`}
                                          alt={child.full_name}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                          }} 
                                        />
                                      ) : null}
                                      <div className={`w-full h-full flex items-center justify-center ${
                                        child.profile_picture_url ? 'hidden' : ''
                                      } bg-blue-100 text-blue-600`}>
                                        <span className="font-medium text-xs">
                                          {child.full_name?.charAt(0).toUpperCase() || 'C'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="ml-3 flex-1">
                                    <div className="text-sm font-medium text-primary-600">{child.full_name}</div>
                                    <div className="text-xs text-gray-500">
                                      {child.email}
                                      {child.phone && ` • ${child.phone}`}
                                    </div>
                                    <div className="flex items-center space-x-3 mt-1">
                                      {child.birthday && (
                                        <div className="flex items-center text-xs text-gray-500">
                                          <FiCalendar className="mr-1 h-3 w-3 text-gray-400" />
                                          <span>Age: {calculateAge(child.birthday)} ({formatDate(child.birthday)})</span>
                                        </div>
                                      )}
                                      {child.gender && (
                                        <div className="flex items-center text-xs text-gray-500">
                                          <span className="mr-1">
                                            {child.gender === 'male' ? '♂' : child.gender === 'female' ? '♀' : '⚥'}
                                          </span>
                                          <span>{child.gender.charAt(0).toUpperCase() + child.gender.slice(1)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2 ml-4">
                                  {patientFileCounts[child.id] > 0 && (
                                    <div className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 flex items-center">
                                      <FiFileText className="mr-1 h-3 w-3" />
                                      {patientFileCounts[child.id]} {patientFileCounts[child.id] === 1 ? 'file' : 'files'}
                                    </div>
                                  )}
                                  <button
                                    onClick={() => handleViewPatient(child.id)}
                                    className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                  >
                                    <FiEye className="mr-1 h-3 w-3" />
                                    View Records
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
                  There are no patients registered in the system.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientsList;