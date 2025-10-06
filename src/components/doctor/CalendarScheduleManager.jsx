// Enhanced Calendar-based Schedule Manager for Doctors
import React, { useState, useEffect } from 'react';
import { FiCalendar, FiClock, FiMapPin, FiSave, FiTrash2, FiPlus, FiEdit3 } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import ScheduleUtils from '../../services/scheduleUtils';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const CalendarScheduleManager = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedBranch, setSelectedBranch] = useState('cabugao');
  const [workingHours, setWorkingHours] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scheduleData, setScheduleData] = useState({});
  const [showAddTimeSlot, setShowAddTimeSlot] = useState(false);
  const [newTimeSlot, setNewTimeSlot] = useState({
    startTime: '08:00',
    endTime: '12:00',
    isAvailable: true
  });

  // Load existing schedule data
  useEffect(() => {
    loadScheduleData();
  }, [user.id]);

  const loadScheduleData = async () => {
    try {
      const result = await ScheduleUtils.getProviderSchedule(user.id, 'doctor');
      if (result.schedule) {
        setScheduleData(result.schedule);
        loadWorkingHoursForDate(selectedDate, selectedBranch, result.schedule);
      }
    } catch (error) {
      console.error('Error loading schedule data:', error);
    }
  };

  // Load working hours for selected date and branch
  const loadWorkingHoursForDate = (date, branch, schedule = scheduleData) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const branchKey = branch.toLowerCase();

    // Check if there's a specific date override
    const specificDateKey = `${dateStr}_${branchKey}`;
    if (schedule[specificDateKey]) {
      setWorkingHours(schedule[specificDateKey].timeSlots || []);
      return;
    }

    // Fall back to regular weekly schedule
    if (schedule[branchKey] && schedule[branchKey][dayOfWeek] && schedule[branchKey][dayOfWeek].enabled) {
      const daySchedule = schedule[branchKey][dayOfWeek];
      setWorkingHours([{
        id: `default_${dayOfWeek}`,
        startTime: daySchedule.start,
        endTime: daySchedule.end,
        isAvailable: true,
        isDefault: true
      }]);
    } else {
      setWorkingHours([]);
    }
  };

  // Handle date selection
  const handleDateChange = (date) => {
    setSelectedDate(date);
    loadWorkingHoursForDate(date, selectedBranch);
  };

  // Handle branch selection
  const handleBranchChange = (branch) => {
    setSelectedBranch(branch);
    loadWorkingHoursForDate(selectedDate, branch);
  };

  // Add new time slot
  const addTimeSlot = () => {
    const newSlot = {
      id: Date.now().toString(),
      ...newTimeSlot
    };
    
    setWorkingHours(prev => [...prev.filter(slot => !slot.isDefault), newSlot]);
    setNewTimeSlot({
      startTime: '08:00',
      endTime: '12:00',
      isAvailable: true
    });
    setShowAddTimeSlot(false);
  };

  // Remove time slot
  const removeTimeSlot = (slotId) => {
    setWorkingHours(prev => prev.filter(slot => slot.id !== slotId));
  };

  // Update time slot
  const updateTimeSlot = (slotId, field, value) => {
    setWorkingHours(prev => prev.map(slot => 
      slot.id === slotId ? { ...slot, [field]: value } : slot
    ));
  };

  // Save schedule for selected date
  const saveScheduleForDate = async () => {
    try {
      setIsLoading(true);
      
      const dateStr = selectedDate.toISOString().split('T')[0];
      const branchKey = selectedBranch.toLowerCase();
      const specificDateKey = `${dateStr}_${branchKey}`;

      // Create updated schedule data
      const updatedSchedule = {
        ...scheduleData,
        [specificDateKey]: {
          date: dateStr,
          branch: branchKey,
          timeSlots: workingHours.filter(slot => !slot.isDefault)
        }
      };

      // If no custom time slots, remove the specific date entry
      if (workingHours.filter(slot => !slot.isDefault).length === 0) {
        delete updatedSchedule[specificDateKey];
      }

      const result = await ScheduleUtils.updateProviderSchedule(
        user.id,
        'doctor',
        updatedSchedule,
        [] // unavailable dates handled separately
      );

      if (result.success) {
        setScheduleData(updatedSchedule);
        toast.success(`Schedule saved for ${selectedDate.toDateString()} at ${selectedBranch} branch!`);
      } else {
        throw new Error(result.error?.message || 'Failed to save schedule');
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('Failed to save schedule: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Mark entire date as unavailable
  const markDateUnavailable = async () => {
    try {
      setIsLoading(true);
      const dateStr = selectedDate.toISOString().split('T')[0];
      const branchKey = selectedBranch.toLowerCase();
      const specificDateKey = `${dateStr}_${branchKey}`;

      const updatedSchedule = {
        ...scheduleData,
        [specificDateKey]: {
          date: dateStr,
          branch: branchKey,
          timeSlots: [],
          unavailable: true
        }
      };

      const result = await ScheduleUtils.updateProviderSchedule(
        user.id,
        'doctor',
        updatedSchedule,
        []
      );

      if (result.success) {
        setScheduleData(updatedSchedule);
        setWorkingHours([]);
        toast.success(`${selectedDate.toDateString()} marked as unavailable at ${selectedBranch} branch!`);
      }
    } catch (error) {
      console.error('Error marking date unavailable:', error);
      toast.error('Failed to mark date unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate time options
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 6; hour < 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(time);
      }
    }
    return options;
  };

  // Format time for display
  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Check if date has custom schedule
  const hasCustomSchedule = (date, branch) => {
    const dateStr = date.toISOString().split('T')[0];
    const branchKey = branch.toLowerCase();
    const specificDateKey = `${dateStr}_${branchKey}`;
    return scheduleData[specificDateKey] !== undefined;
  };

  // Get date status for calendar highlighting
  const getDateClassName = (date) => {
    const isToday = date.toDateString() === new Date().toDateString();
    const hasCustom = hasCustomSchedule(date, selectedBranch);
    
    if (isToday) return 'bg-blue-100 text-blue-800 font-bold';
    if (hasCustom) return 'bg-green-100 text-green-800';
    return '';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">📅 Calendar-Based Schedule Management</h2>
        <p className="text-gray-600">Select a date and branch to configure your working hours for that specific day.</p>
      </div>

      {/* Date and Branch Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FiCalendar className="inline mr-2" />
            Select Date
          </label>
          <DatePicker
            selected={selectedDate}
            onChange={handleDateChange}
            dateFormat="MMMM d, yyyy"
            minDate={new Date()}
            dayClassName={getDateClassName}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholderText="Select a date"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FiMapPin className="inline mr-2" />
            Select Branch
          </label>
          <select
            value={selectedBranch}
            onChange={(e) => handleBranchChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="cabugao">🏥 Cabugao Branch</option>
            <option value="sanjuan">🏥 San Juan Branch</option>
          </select>
        </div>
      </div>

      {/* Schedule Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">
          Schedule for {selectedDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })} at {selectedBranch.charAt(0).toUpperCase() + selectedBranch.slice(1)} Branch
        </h3>
        
        {hasCustomSchedule(selectedDate, selectedBranch) ? (
          <p className="text-green-600 text-sm">✅ Custom schedule configured for this date</p>
        ) : (
          <p className="text-gray-600 text-sm">📋 Using default weekly schedule (if any)</p>
        )}
      </div>

      {/* Working Hours Configuration */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            <FiClock className="inline mr-2" />
            Working Hours
          </h3>
          <div className="space-x-2">
            <button
              onClick={() => setShowAddTimeSlot(true)}
              className="inline-flex items-center px-3 py-1 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <FiPlus className="w-4 h-4 mr-1" />
              Add Time Slot
            </button>
            <button
              onClick={markDateUnavailable}
              className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <FiTrash2 className="w-4 h-4 mr-1" />
              Mark Unavailable
            </button>
          </div>
        </div>

        {/* Existing Time Slots */}
        <div className="space-y-3">
          {workingHours.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FiClock className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No working hours configured for this date.</p>
              <p className="text-sm">Add time slots or use default weekly schedule.</p>
            </div>
          ) : (
            workingHours.map((slot) => (
              <div key={slot.id} className={`border rounded-lg p-4 ${slot.isDefault ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {slot.isDefault && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        Default Schedule
                      </span>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <select
                        value={slot.startTime}
                        onChange={(e) => updateTimeSlot(slot.id, 'startTime', e.target.value)}
                        disabled={slot.isDefault}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {generateTimeOptions().map(time => (
                          <option key={time} value={time}>{formatTime(time)}</option>
                        ))}
                      </select>
                      
                      <span className="text-gray-500">to</span>
                      
                      <select
                        value={slot.endTime}
                        onChange={(e) => updateTimeSlot(slot.id, 'endTime', e.target.value)}
                        disabled={slot.isDefault}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {generateTimeOptions().map(time => (
                          <option key={time} value={time}>{formatTime(time)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {!slot.isDefault && (
                    <button
                      onClick={() => removeTimeSlot(slot.id)}
                      className="text-red-600 hover:text-red-800 focus:outline-none"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Time Slot Form */}
        {showAddTimeSlot && (
          <div className="mt-4 p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
            <h4 className="font-medium text-gray-900 mb-3">Add New Time Slot</h4>
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
                <select
                  value={newTimeSlot.startTime}
                  onChange={(e) => setNewTimeSlot(prev => ({ ...prev, startTime: e.target.value }))}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {generateTimeOptions().map(time => (
                    <option key={time} value={time}>{formatTime(time)}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
                <select
                  value={newTimeSlot.endTime}
                  onChange={(e) => setNewTimeSlot(prev => ({ ...prev, endTime: e.target.value }))}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {generateTimeOptions().map(time => (
                    <option key={time} value={time}>{formatTime(time)}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex space-x-2 mt-5">
                <button
                  onClick={addTimeSlot}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddTimeSlot(false)}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end space-x-4">
        <button
          onClick={saveScheduleForDate}
          disabled={isLoading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <FiSave className="w-4 h-4 mr-2" />
              Save Schedule for This Date
            </>
          )}
        </button>
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Calendar Legend:</h4>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded mr-2"></div>
            <span>Today</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-100 border border-green-200 rounded mr-2"></div>
            <span>Custom Schedule Configured</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded mr-2"></div>
            <span>Default/No Custom Schedule</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarScheduleManager;
