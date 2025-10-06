// Example integration of CalendarScheduleManager into doctor Settings.jsx
// This shows how to add the calendar-based schedule management to the existing settings page

// ADD THESE IMPORTS to your existing Settings.jsx:
import CalendarScheduleManager from '../../components/doctor/CalendarScheduleManager';
import CalendarScheduleUtils from '../../services/calendarScheduleUtils';

// ADD THIS TAB to your existing tab navigation (around line 1800+):
const tabNavigation = [
  { id: 'profile', label: '👤 Profile Information', icon: FiUser },
  { id: 'security', label: '🔒 Security', icon: FiLock },
  { id: 'schedule', label: '📅 Weekly Schedule', icon: FiCalendar },
  { id: 'calendar-schedule', label: '🗓️ Calendar Schedule', icon: FiCalendar }, // NEW TAB
  { id: 'professional', label: '💼 Professional Info', icon: FiBriefcase },
];

// ADD THIS CASE to your tab content rendering (around line 1900+):
{activeTab === 'calendar-schedule' && (
  <div>
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">🗓️ Calendar-Based Schedule Management</h2>
      <p className="text-gray-600">
        Select specific dates and configure your working hours. This gives you more flexibility than the weekly schedule.
      </p>
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Calendar Schedule vs Weekly Schedule
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Calendar Schedule:</strong> Set specific working hours for individual dates (overrides weekly schedule)</li>
                <li><strong>Weekly Schedule:</strong> Set regular working hours that repeat every week</li>
                <li><strong>Priority:</strong> Calendar schedules take priority over weekly schedules for appointment booking</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <CalendarScheduleManager />
  </div>
)}

// EXAMPLE: How to show calendar status in weekly schedule tab
// ADD THIS helper function to show when calendar overrides exist:
const getCalendarOverrideInfo = () => {
  if (!schedule) return null;
  
  const customDates = CalendarScheduleUtils.getCustomScheduledDates(schedule);
  
  if (customDates.length === 0) return null;
  
  return (
    <div className="mt-4 p-4 bg-green-50 rounded-lg">
      <h4 className="font-medium text-green-800 mb-2">
        📅 You have {customDates.length} custom calendar schedule(s)
      </h4>
      <div className="text-sm text-green-700">
        {customDates.slice(0, 3).map((customDate, index) => (
          <div key={index} className="flex justify-between">
            <span>{new Date(customDate.date).toLocaleDateString()}</span>
            <span className="font-medium">{customDate.branch.toUpperCase()}</span>
          </div>
        ))}
        {customDates.length > 3 && (
          <div className="text-xs text-green-600 mt-1">
            And {customDates.length - 3} more custom dates...
          </div>
        )}
      </div>
      <p className="text-xs text-green-600 mt-2">
        These custom dates will override your weekly schedule settings.
      </p>
    </div>
  );
};

// ADD THIS in your weekly schedule tab content (around line 1960):
{activeTab === 'schedule' && (
  <div>
    {/* Existing weekly schedule content */}
    
    {/* ADD THIS at the end of your weekly schedule tab: */}
    {getCalendarOverrideInfo()}
    
    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-gray-900">Want more flexibility?</h4>
          <p className="text-sm text-gray-600 mt-1">
            Use Calendar Schedule to set different working hours for specific dates.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('calendar-schedule')}
          className="inline-flex items-center px-3 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          🗓️ Open Calendar Schedule
        </button>
      </div>
    </div>
  </div>
)}

/* 
COMPLETE INTEGRATION STEPS:

1. Copy the imports above to your Settings.jsx file
2. Add the new tab to your tab navigation array
3. Add the calendar-schedule case to your tab content rendering
4. Add the getCalendarOverrideInfo helper function
5. Add the calendar override info display to your weekly schedule tab
6. Test the new calendar interface

BENEFITS OF THIS INTEGRATION:
- Doctors can still use weekly schedules for regular patterns
- Calendar schedules provide flexibility for special dates
- Clear indication when calendar overrides exist
- Smooth transition between weekly and calendar views
- Maintains backward compatibility with existing weekly schedules

EXAMPLE USE CASE - Solving Friday San Juan Issue:
1. Doctor goes to Settings → Calendar Schedule
2. Selects Friday, September 12, 2025
3. Chooses San Juan branch
4. Adds time slot: 1:00 PM - 5:00 PM
5. Saves - patients can now book Friday appointments at San Juan!

This calendar approach is much more intuitive than trying to configure complex weekly patterns.
*/
