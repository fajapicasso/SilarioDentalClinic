# 📅 Calendar-Based Schedule System Integration Guide

## 🎯 Overview

This guide provides a more intuitive **calendar-first approach** to doctor schedule management, where doctors can:

1. **Pick specific dates from a calendar**
2. **Configure working hours for those dates and branches**
3. **Override default weekly schedules with custom daily schedules**
4. **Mark specific dates as unavailable**

## 🆕 New Features

### ✅ **Calendar-Based Date Selection**
- Visual calendar interface for selecting dates
- Highlight dates with custom schedules
- Easy navigation between months/years

### ✅ **Specific Date Overrides**
- Set custom working hours for specific dates
- Override default weekly schedules
- Multiple time slots per day

### ✅ **Enhanced Time Slot Management**
- Add/remove multiple time slots per day
- Visual time slot management
- Different hours for different branches on same date

### ✅ **Unavailable Date Marking**
- Mark entire dates as unavailable
- Branch-specific unavailability
- Easy toggle between available/unavailable

## 📁 Files Created

### 🆕 **Core Components:**
1. **`src/components/doctor/CalendarScheduleManager.jsx`** - Main calendar interface
2. **`src/services/calendarScheduleUtils.js`** - Calendar-specific utilities
3. **`enhanced_calendar_schedule_setup.sql`** - Database setup with calendar support

### 🔄 **Integration Files:**
1. **`CALENDAR_SCHEDULE_INTEGRATION_GUIDE.md`** - This guide
2. Enhanced schedule validation and appointment booking

## 🚀 Quick Setup

### Step 1: Run Database Setup
Execute the enhanced database setup script:
```sql
-- Run in Supabase SQL Editor
-- Copy contents from enhanced_calendar_schedule_setup.sql
```

### Step 2: Add Calendar Component to Doctor Settings
Add the calendar manager to your doctor settings page:

```jsx
// In src/pages/doctor/Settings.jsx
import CalendarScheduleManager from '../../components/doctor/CalendarScheduleManager';

// Add to your settings tabs
{activeTab === 'calendar-schedule' && (
  <CalendarScheduleManager />
)}
```

### Step 3: Update Navigation
Add calendar schedule tab to doctor settings:

```jsx
<button
  onClick={() => setActiveTab('calendar-schedule')}
  className={`tab-button ${activeTab === 'calendar-schedule' ? 'active' : ''}`}
>
  📅 Calendar Schedule
</button>
```

## 💡 How It Works

### **1. Calendar-First Interface**
```
Select Date → Choose Branch → Configure Hours → Save
```

### **2. Data Structure**
The system stores both weekly and date-specific schedules:

```json
{
  // Regular weekly schedule
  "cabugao": {
    "monday": {"enabled": true, "start": "08:00", "end": "12:00"},
    "friday": {"enabled": true, "start": "08:00", "end": "12:00"}
  },
  
  // Specific date overrides (calendar-based)
  "2025-09-12_sanjuan": {
    "date": "2025-09-12",
    "branch": "sanjuan",
    "timeSlots": [
      {"id": "1", "startTime": "13:00", "endTime": "17:00", "isAvailable": true},
      {"id": "2", "startTime": "18:00", "endTime": "20:00", "isAvailable": true}
    ]
  }
}
```

### **3. Priority System**
1. **Specific date schedules** (calendar-based) take priority
2. **Weekly schedules** are used as fallback
3. **Unavailable markings** override everything

## 🎨 User Experience

### **For Doctors:**

#### **Setting Up a Custom Friday Schedule:**
1. **Open Settings** → **Calendar Schedule**
2. **Click on Friday, September 12, 2025** in calendar
3. **Select "San Juan" branch**
4. **Click "Add Time Slot"**
5. **Set times: 1:00 PM - 5:00 PM**
6. **Click "Save Schedule for This Date"**

#### **Marking a Date Unavailable:**
1. **Select the date** and branch
2. **Click "Mark Unavailable"**
3. **Date is blocked for appointments**

#### **Managing Multiple Time Slots:**
1. **Select date and branch**
2. **Add multiple time slots** (e.g., morning + evening)
3. **Each slot can have different hours**
4. **Remove slots individually**

### **For Patients:**
- **See only available time slots** based on real provider schedules
- **Calendar-based schedules** automatically reflected in booking
- **Better error messages** when slots unavailable

## 🔧 Technical Implementation

### **Calendar Component Features:**
- **React DatePicker** integration
- **Visual date highlighting** (custom schedules vs default)
- **Time slot management** with add/remove functionality
- **Branch selection** with immediate schedule updates
- **Save/cancel** operations with loading states

### **Backend Integration:**
- **Enhanced schedule storage** supporting date-specific overrides
- **Conflict detection** between time slots
- **Appointment validation** against calendar schedules
- **Performance optimization** with indexed queries

### **API Methods:**
```javascript
// Calendar-specific utilities
CalendarScheduleUtils.getProviderTimeSlotsForDate(schedule, branch, date)
CalendarScheduleUtils.saveCalendarSchedule(providerId, role, date, branch, timeSlots)
CalendarScheduleUtils.markDateUnavailable(providerId, role, date, branch)
CalendarScheduleUtils.hasCustomScheduleForDate(schedule, branch, date)
```

## 📋 Solving the Friday San Juan Issue

### **Current Problem:**
- No providers configured for San Juan Friday
- Weekly schedule shows gaps
- Patients can't book appointments

### **Calendar Solution:**
1. **Doctor logs in** → **Settings** → **Calendar Schedule**
2. **Selects Friday, September 12, 2025**
3. **Chooses San Juan branch**
4. **Adds time slot: 1:00 PM - 5:00 PM**
5. **Saves schedule**
6. **Patients can now book** San Juan Friday appointments

### **Why This is Better:**
- ✅ **More intuitive** - pick date first, then configure
- ✅ **Flexible** - different hours for special dates
- ✅ **Visual** - see all custom dates on calendar
- ✅ **Precise** - exact date and time control
- ✅ **Override-friendly** - custom dates override weekly defaults

## 🎯 Benefits Over Weekly Scheduling

### **Weekly Schedule Limitations:**
- ❌ **Rigid** - same hours every week
- ❌ **No holidays/vacations** - can't handle special dates
- ❌ **Generic** - can't accommodate different needs per date
- ❌ **Confusing** - hard to see which days are actually covered

### **Calendar Schedule Advantages:**
- ✅ **Flexible** - custom hours for any date
- ✅ **Holiday-aware** - mark vacations easily
- ✅ **Special events** - extended hours for busy days
- ✅ **Visual** - see exactly what's scheduled
- ✅ **Intuitive** - calendar-first approach everyone understands

## 🚀 Implementation Steps

### **Phase 1: Basic Integration (Immediate)**
1. **Run database setup** script
2. **Add CalendarScheduleManager** to doctor settings
3. **Test basic date selection** and schedule saving

### **Phase 2: Enhanced Features (Next)**
1. **Copy/paste schedules** between dates
2. **Recurring custom schedules** (e.g., every first Friday of month)
3. **Schedule templates** for common patterns
4. **Bulk unavailable date marking**

### **Phase 3: Advanced Features (Future)**
1. **Schedule conflicts** detection between providers
2. **Automatic schedule suggestions** based on patient demand
3. **Schedule analytics** and optimization
4. **Mobile calendar interface**

## 🛠️ Customization Options

### **Calendar Appearance:**
- **Highlight custom dates** in green
- **Show unavailable dates** in red
- **Today's date** in blue
- **Weekend styling** different from weekdays

### **Time Slot Management:**
- **30-minute intervals** default (customizable)
- **Minimum/maximum** appointment durations
- **Break time** automatic insertion
- **Overlap prevention** between time slots

### **Branch-Specific Features:**
- **Different time intervals** per branch
- **Branch-specific** unavailable dates
- **Copy schedules** between branches
- **Branch preferences** saving

## 📞 Support & Troubleshooting

### **Common Issues:**

#### **"Schedule not saving"**
- Check database columns exist
- Verify user permissions
- Check browser console for errors

#### **"Calendar dates not highlighted"**
- Clear browser cache
- Check schedule data format
- Verify date format (YYYY-MM-DD)

#### **"Time slots not showing"**
- Confirm schedule saved correctly
- Check branch name matching
- Verify date-specific keys format

### **Debug Mode:**
Add to browser console:
```javascript
// Check provider schedule
window.CalendarScheduleUtils = CalendarScheduleUtils;
// View schedule data
console.log('Schedule:', scheduleData);
```

---

**This calendar-based approach provides a much more intuitive and flexible way for doctors to manage their schedules, solving the Friday San Juan issue and providing a foundation for advanced schedule management.**
