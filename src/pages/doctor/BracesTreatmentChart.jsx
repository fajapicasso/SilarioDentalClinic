// src/components/doctor/BracesTreatmentChart.jsx
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import supabase from '../../config/supabaseClient';
import { FiSave, FiEdit, FiInfo, FiCalendar, FiCheck, FiX, FiUser } from 'react-icons/fi';
import { useAuditLog } from '../../hooks/useAuditLog';

const BracesTreatmentChart = ({ patientId, readOnly = false }) => {
  const { logBracesAdjustment, logBracesPlan } = useAuditLog();
  const [loading, setLoading] = useState(true);
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [bracesData, setBracesData] = useState(null);
  const [adjustmentHistory, setAdjustmentHistory] = useState([]);
  const [notes, setNotes] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [bracesEvents, setBracesEvents] = useState({});
  const [modalMode, setModalMode] = useState('adjustment'); // 'adjustment' or 'plan'
  const [adjustmentType, setAdjustmentType] = useState('');
  const [teethInvolved, setTeethInvolved] = useState([]);

  // List of braces adjustment types
  const adjustmentTypes = [
    'Initial Installation',
    'Wire Change',
    'Tightening',
    'Bracket Replacement',
    'Elastic Band Change',
    'Progress Check',
    'Bracket Removal',
    'Retainer Fitting',
    'Final Removal',
    'Emergency Adjustment',
    'Other'
  ];

  // Define the adult teeth chart
  const adultTeeth = {
    upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
    upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
    lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
    lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38]
  };

  // All teeth numbers in a flat array
  const allTeethNumbers = [
    ...adultTeeth.upperRight,
    ...adultTeeth.upperLeft,
    ...adultTeeth.lowerRight,
    ...adultTeeth.lowerLeft
  ];

  useEffect(() => {
    if (patientId) {
      fetchBracesData();
    }
  }, [patientId]);

  const fetchBracesData = async () => {
    setLoading(true);
    try {
      // Fetch braces treatment data
      const { data: bracesStatusData, error: bracesError } = await supabase
        .from('braces_treatment')
        .select('*')
        .eq('patient_id', patientId)
        .single();
      
      if (bracesError && bracesError.code !== 'PGRST116') {
        throw bracesError;
      }
      
      setBracesData(bracesStatusData || null);

      // Fetch braces adjustments history
      const { data: adjustmentsData, error: adjustmentsError } = await supabase
        .from('braces_adjustments')
        .select(`
          id,
          patient_id,
          adjustment_date,
          adjustment_type,
          teeth_involved,
          notes,
          doctor_id,
          profiles:doctor_id (full_name)
        `)
        .eq('patient_id', patientId)
        .order('adjustment_date', { ascending: false });
      
      if (adjustmentsError) throw adjustmentsError;
      
      setAdjustmentHistory(adjustmentsData || []);

      // Fetch braces events (planned and completed work by tooth)
      const { data: eventsData, error: eventsError } = await supabase
        .from('braces_events')
        .select('*')
        .eq('patient_id', patientId);
      
      if (eventsError) throw eventsError;
      
      // Organize events by tooth number
      const eventsByTooth = {};
      
      if (eventsData && eventsData.length > 0) {
        eventsData.forEach(event => {
          if (event.tooth_number) {
            eventsByTooth[event.tooth_number] = event;
          }
        });
      }
      
      setBracesEvents(eventsByTooth);
    } catch (error) {
      console.error('Error fetching braces data:', error);
      toast.error('Failed to load braces treatment data');
    } finally {
      setLoading(false);
    }
  };

  const handleToothClick = (toothNumber) => {
    if (readOnly) return;
    
    setSelectedTooth(toothNumber);
    setTeethInvolved(prev => 
      prev.includes(toothNumber) 
        ? prev.filter(t => t !== toothNumber) 
        : [...prev, toothNumber]
    );
  };

  const handleShowAdjustmentModal = () => {
    if (teethInvolved.length === 0) {
      toast.error('Please select at least one tooth for the adjustment');
      return;
    }

    setModalMode('adjustment');
    setAdjustmentType('');
    setNotes('');
    setShowModal(true);
  };

  const handleShowPlanModal = () => {
    if (!selectedTooth) {
      toast.error('Please select a tooth to plan work on');
      return;
    }

    setModalMode('plan');
    const event = bracesEvents[selectedTooth];
    setNotes(event?.notes || '');
    setShowModal(true);
  };

  const saveAdjustment = async () => {
    if (teethInvolved.length === 0 || !adjustmentType) {
      toast.error('Please select teeth and adjustment type');
      return;
    }

    try {
      setLoading(true);
      
      const { data: userData } = await supabase.auth.getUser();
      const doctorId = userData?.user?.id || '';

      // Save the adjustment
      const adjustmentData = {
        patient_id: patientId,
        adjustment_date: new Date().toISOString(),
        adjustment_type: adjustmentType,
        teeth_involved: teethInvolved,
        notes: notes,
        doctor_id: doctorId,
      };
      
      const { data, error } = await supabase
        .from('braces_adjustments')
        .insert([adjustmentData])
        .select();
      
      if (error) throw error;
      
      // If this is the initial installation
      if (adjustmentType === 'Initial Installation' && (!bracesData || !bracesData.id)) {
        // Create braces treatment record
        const bracesRecord = {
          patient_id: patientId,
          start_date: new Date().toISOString(),
          estimated_duration_months: 24, // Default to 24 months
          status: 'active',
          doctor_id: doctorId,
        };
        
        const { data: bracesData, error: bracesError } = await supabase
          .from('braces_treatment')
          .insert([bracesRecord])
          .select();
        
        if (bracesError) throw bracesError;
        
        setBracesData(bracesData[0]);
      }
      
      // If this is final removal
      if (adjustmentType === 'Final Removal' && bracesData) {
        const { error: updateError } = await supabase
          .from('braces_treatment')
          .update({ 
            status: 'completed',
            end_date: new Date().toISOString()
          })
          .eq('id', bracesData.id);
        
        if (updateError) throw updateError;
        
        // Update local state
        setBracesData({
          ...bracesData,
          status: 'completed',
          end_date: new Date().toISOString()
        });
      }
      
      // Add to adjustment history
      const newAdjustment = {
        ...data[0],
        profiles: { full_name: 'Current Doctor' } // This would be replaced with the actual doctor name
      };
      
      setAdjustmentHistory([newAdjustment, ...adjustmentHistory]);
      
      // Log audit event for braces adjustment
      try {
        await logBracesAdjustment({
          adjustment_id: data[0].id,
          patient_id: patientId,
          adjustment_type: adjustmentType,
          teeth_involved: teethInvolved,
          notes: notes,
          doctor_id: doctorId,
          adjustment_date: new Date().toISOString()
        });
      } catch (auditError) {
        console.error('Error logging braces adjustment audit event:', auditError);
        // Continue even if audit logging fails
      }
      
      toast.success('Braces adjustment saved successfully');
      setShowModal(false);
      setTeethInvolved([]);
      setAdjustmentType('');
      setNotes('');
    } catch (error) {
      console.error('Error saving braces adjustment:', error);
      toast.error('Failed to save adjustment');
    } finally {
      setLoading(false);
    }
  };

  const saveBracesPlan = async () => {
    if (!selectedTooth) {
      toast.error('Please select a tooth to plan work on');
      return;
    }

    try {
      setLoading(true);
      
      const { data: userData } = await supabase.auth.getUser();
      const doctorId = userData?.user?.id || '';

      // Check if there's already a plan for this tooth
      if (bracesEvents[selectedTooth]) {
        // Update existing plan
        const { error } = await supabase
          .from('braces_events')
          .update({
            notes: notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', bracesEvents[selectedTooth].id);
        
        if (error) throw error;
        
        // Update local state
        const updatedEvents = { ...bracesEvents };
        updatedEvents[selectedTooth] = {
          ...bracesEvents[selectedTooth],
          notes: notes,
          updated_at: new Date().toISOString()
        };
        setBracesEvents(updatedEvents);
      } else {
        // Create new plan
        const eventData = {
          patient_id: patientId,
          tooth_number: selectedTooth,
          event_type: 'planned',
          notes: notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          doctor_id: doctorId,
        };
        
        const { data, error } = await supabase
          .from('braces_events')
          .insert([eventData])
          .select();
        
        if (error) throw error;
        
        // Update local state
        const updatedEvents = { ...bracesEvents };
        updatedEvents[selectedTooth] = data[0];
        setBracesEvents(updatedEvents);
      }
      
      // Log audit event for braces plan
      try {
        await logBracesPlan({
          plan_id: bracesEvents[selectedTooth]?.id || data[0]?.id,
          patient_id: patientId,
          tooth_number: selectedTooth,
          event_type: 'planned',
          notes: notes,
          doctor_id: doctorId,
          action: bracesEvents[selectedTooth] ? 'update' : 'create'
        });
      } catch (auditError) {
        console.error('Error logging braces plan audit event:', auditError);
        // Continue even if audit logging fails
      }
      
      toast.success('Braces plan saved successfully');
      setShowModal(false);
      setSelectedTooth(null);
      setNotes('');
    } catch (error) {
      console.error('Error saving braces plan:', error);
      toast.error('Failed to save braces plan');
    } finally {
      setLoading(false);
    }
  };

  const getToothColor = (toothNumber) => {
    // If tooth is in currently selected teeth
    if (teethInvolved.includes(toothNumber)) {
      return 'bg-primary-200';
    }
    
    // If tooth has braces events
    if (bracesEvents[toothNumber]) {
      if (bracesEvents[toothNumber].event_type === 'completed') {
        return 'bg-green-200';
      } else {
        return 'bg-orange-200';
      }
    }
    
    // Default color
    return 'bg-white';
  };

  const getToothBorder = (toothNumber) => {
    if (selectedTooth === toothNumber) {
      return 'border-4 border-primary-500';
    }
    if (teethInvolved.includes(toothNumber)) {
      return 'border-2 border-primary-400';
    }
    if (bracesEvents[toothNumber]) {
      return bracesEvents[toothNumber].event_type === 'completed'
        ? 'border-2 border-green-500'
        : 'border-2 border-orange-500';
    }
    return 'border border-gray-300';
  };

  const renderBracesStatus = () => {
    if (!bracesData) {
      return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiInfo className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                No braces treatment has been started for this patient. 
                Add a new "Initial Installation" adjustment to begin.
              </p>
            </div>
          </div>
        </div>
      );
    }

    const startDate = new Date(bracesData.start_date);
    const endDate = bracesData.end_date ? new Date(bracesData.end_date) : null;
    const today = new Date();
    
    // Calculate months elapsed
    const monthsElapsed = Math.floor(
      (today - startDate) / (1000 * 60 * 60 * 24 * 30.44)
    );
    
    // Calculate estimated completion percentage
    const estimatedDuration = bracesData.estimated_duration_months || 24;
    const completionPercentage = Math.min(
      Math.round((monthsElapsed / estimatedDuration) * 100),
      bracesData.status === 'completed' ? 100 : 99
    );

    return (
      <div className={`rounded-md p-4 mb-4 ${
        bracesData.status === 'completed' 
          ? 'bg-green-50 border border-green-200' 
          : 'bg-blue-50 border border-blue-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium text-gray-900">
            Braces Treatment {bracesData.status === 'completed' ? 'Completed' : 'In Progress'}
          </h3>
          {bracesData.status === 'completed' && (
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
              Completed
            </span>
          )}
          {bracesData.status === 'active' && (
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
              Active
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center text-sm mb-1">
              <FiCalendar className="mr-1 text-gray-500" />
              <span className="font-medium">Started:</span>
              <span className="ml-2">{startDate.toLocaleDateString()}</span>
            </div>
            
            {endDate && (
              <div className="flex items-center text-sm mb-1">
                <FiCalendar className="mr-1 text-gray-500" />
                <span className="font-medium">Completed:</span>
                <span className="ml-2">{endDate.toLocaleDateString()}</span>
              </div>
            )}
            
            <div className="flex items-center text-sm">
              <FiUser className="mr-1 text-gray-500" />
              <span className="font-medium">Doctor:</span>
              <span className="ml-2">{bracesData.doctor_name || 'Not specified'}</span>
            </div>
          </div>
          
          <div>
            <div className="mb-1">
              <span className="text-sm font-medium">Progress:</span>
              <span className="text-sm ml-2">
                {bracesData.status === 'completed' 
                  ? 'Complete' 
                  : `Month ${monthsElapsed} of ${estimatedDuration} (${completionPercentage}%)`
                }
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full ${
                  bracesData.status === 'completed' ? 'bg-green-600' : 'bg-blue-600'
                }`}
                style={{ width: `${completionPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Braces Treatment Chart</h2>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div>
          {/* Braces Status */}
          {renderBracesStatus()}
          
          {/* Action Buttons */}
          {!readOnly && (
            <div className="mb-6 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                onClick={handleShowAdjustmentModal}
                disabled={teethInvolved.length === 0}
              >
                <FiEdit className="mr-2" />
                Record Adjustment
              </button>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                onClick={handleShowPlanModal}
                disabled={!selectedTooth}
              >
                <FiCalendar className="mr-2" />
                Add Note/Plan
              </button>
              <div className="ml-auto text-sm text-gray-500">
                {teethInvolved.length > 0 && (
                  <span>{teethInvolved.length} teeth selected</span>
                )}
              </div>
            </div>
          )}
          
          {/* Upper Teeth */}
          <div className="mb-8">
            <div className="grid grid-cols-16 gap-1">
              {/* Spacing for visual alignment */}
              <div className="col-span-4"></div>
              
              {/* Upper right quadrant */}
              {adultTeeth.upperRight.map((toothNumber) => (
                <div key={`tooth-${toothNumber}`} className="flex flex-col items-center">
                  <div 
                    className={`w-12 h-16 ${getToothColor(toothNumber)} ${getToothBorder(toothNumber)} rounded-md flex items-center justify-center cursor-pointer hover:border-primary-400 transition-colors`}
                    onClick={() => handleToothClick(toothNumber)}
                  >
                    <span className="text-xs font-semibold">{toothNumber}</span>
                  </div>
                  <span className="text-xs mt-1">{toothNumber}</span>
                </div>
              ))}
              
              {/* Upper left quadrant */}
              {adultTeeth.upperLeft.map((toothNumber) => (
                <div key={`tooth-${toothNumber}`} className="flex flex-col items-center">
                  <div 
                    className={`w-12 h-16 ${getToothColor(toothNumber)} ${getToothBorder(toothNumber)} rounded-md flex items-center justify-center cursor-pointer hover:border-primary-400 transition-colors`}
                    onClick={() => handleToothClick(toothNumber)}
                  >
                    <span className="text-xs font-semibold">{toothNumber}</span>
                  </div>
                  <span className="text-xs mt-1">{toothNumber}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Lower Teeth */}
          <div>
            <div className="grid grid-cols-16 gap-1">
              {/* Spacing for visual alignment */}
              <div className="col-span-4"></div>
              
              {/* Lower right quadrant */}
              {adultTeeth.lowerRight.map((toothNumber) => (
                <div key={`tooth-${toothNumber}`} className="flex flex-col items-center">
                  <span className="text-xs mb-1">{toothNumber}</span>
                  <div 
                    className={`w-12 h-16 ${getToothColor(toothNumber)} ${getToothBorder(toothNumber)} rounded-md flex items-center justify-center cursor-pointer hover:border-primary-400 transition-colors`}
                    onClick={() => handleToothClick(toothNumber)}
                  >
                    <span className="text-xs font-semibold">{toothNumber}</span>
                  </div>
                </div>
              ))}
              
              {/* Lower left quadrant */}
              {adultTeeth.lowerLeft.map((toothNumber) => (
                <div key={`tooth-${toothNumber}`} className="flex flex-col items-center">
                  <span className="text-xs mb-1">{toothNumber}</span>
                  <div 
                    className={`w-12 h-16 ${getToothColor(toothNumber)} ${getToothBorder(toothNumber)} rounded-md flex items-center justify-center cursor-pointer hover:border-primary-400 transition-colors`}
                    onClick={() => handleToothClick(toothNumber)}
                  >
                    <span className="text-xs font-semibold">{toothNumber}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Legend and History */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Braces Treatment Legend</h3>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-white border border-gray-300 rounded mr-2"></div>
                  <span className="text-sm">No Treatment</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-primary-200 border border-primary-400 rounded mr-2"></div>
                  <span className="text-sm">Selected for Adjustment</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-orange-200 border border-orange-500 rounded mr-2"></div>
                  <span className="text-sm">Planned Work</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-200 border border-green-500 rounded mr-2"></div>
                  <span className="text-sm">Completed Work</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Recent Adjustment History</h3>
              {adjustmentHistory.length > 0 ? (
                <div className="text-sm text-gray-600 space-y-2 max-h-40 overflow-y-auto">
                  {adjustmentHistory.slice(0, 5).map((adjustment, index) => (
                    <div key={index} className="border-l-2 border-primary-200 pl-3 py-1">
                      <div className="font-medium">
                        {adjustment.adjustment_type} - {new Date(adjustment.adjustment_date).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {adjustment.teeth_involved.length} teeth | Doctor: {adjustment.profiles?.full_name || 'Unknown'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No adjustment history available</p>
              )}
            </div>
          </div>
          
          {/* Adjustment Modal */}
          {showModal && modalMode === 'adjustment' && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
              <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Record Braces Adjustment
                </h3>
                
                <div className="space-y-4">
                  {/* Teeth selection summary */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">Teeth Selected:</h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {teethInvolved.map(tooth => (
                        <span 
                          key={tooth} 
                          className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-800 rounded-full"
                        >
                          {tooth}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* Adjustment type selection */}
                  <div>
                    <label htmlFor="adjustment-type" className="block text-sm font-medium text-gray-700">
                      Adjustment Type
                    </label>
                    <select
                      id="adjustment-type"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                      value={adjustmentType}
                      onChange={(e) => setAdjustmentType(e.target.value)}
                    >
                      <option value="">Select an adjustment type</option>
                      {adjustmentTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Notes */}
                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                      Notes
                    </label>
                    <textarea
                      id="notes"
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      placeholder="Add adjustment notes here..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      onClick={saveBracesPlan}
                    >
                      <FiSave className="mr-2" />
                      Save Plan
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      onClick={() => setShowModal(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BracesTreatmentChart;