# 🏥 Enhanced Doctor & Staff Working Schedule System

## 📋 Overview

This implementation provides a comprehensive working schedule system that reflects real operating schedules with specific time availability and unavailable date/time management for doctors and staff.

## 🚀 Key Features Implemented

### ✅ **Real Operating Schedule Based System**
- **Specific working hours per day** (Start Time – End Time)
- **Branch-specific schedules** (Cabugao and San Juan)
- **Day-by-day configuration** with enable/disable options
- **Unavailable dates/times marking** with granular control

### ✅ **Enhanced Appointment Validation**
- **Real-time availability checking** against actual doctor schedules
- **Conflict detection** with existing appointments
- **Duration-aware booking** (appointments must fit within working hours)
- **Detailed error messages** explaining why slots are unavailable

### ✅ **Improved Schedule Management**
- **Doctor/Staff settings interface** for schedule configuration
- **Visual schedule management** with intuitive UI
- **Backup storage** (localStorage + database)
- **Validation and error handling**

## 📁 Files Created/Modified

### 🆕 New Files:
1. **`update_doctor_schedules.sql`** - Database setup and sample schedule data
2. **`src/services/scheduleUtils.js`** - Enhanced schedule utilities
3. **`ENHANCED_SCHEDULE_SYSTEM_GUIDE.md`** - This implementation guide

### 🔄 Modified Files:
1. **`src/services/scheduleService.js`** - Enhanced time-based availability checking
2. **`src/pages/patient/Appointments.jsx`** - Better appointment validation
3. **`src/pages/doctor/Settings.jsx`** - Integration with new schedule utilities

## 💾 Database Setup

### Step 1: Run the Database Setup Script

Execute the `update_doctor_schedules.sql` script in your Supabase SQL Editor:

```sql
-- This script will:
-- 1. Add schedule and unavailable_dates columns to profiles table
-- 2. Create staff_schedules table for staff working schedules
-- 3. Update existing doctors with sample working schedules
-- 4. Create necessary indexes for performance
```

### Step 2: Verify Database Structure

The following columns should exist in your `profiles` table:
- `schedule` (JSONB) - Working hours configuration
- `unavailable_dates` (JSONB) - Array of unavailable dates/times

## 📊 Schedule Data Structure

### Working Schedule Format:
```json
{
  "cabugao": {
    "monday": { "enabled": true, "start": "08:00", "end": "12:00" },
    "tuesday": { "enabled": true, "start": "08:00", "end": "12:00" },
    "wednesday": { "enabled": false, "start": "08:00", "end": "12:00" },
    "thursday": { "enabled": true, "start": "08:00", "end": "12:00" },
    "friday": { "enabled": true, "start": "08:00", "end": "12:00" },
    "saturday": { "enabled": true, "start": "08:00", "end": "17:00" },
    "sunday": { "enabled": false, "start": "08:00", "end": "17:00" }
  },
  "sanjuan": {
    "monday": { "enabled": true, "start": "13:00", "end": "17:00" },
    "tuesday": { "enabled": true, "start": "13:00", "end": "17:00" },
    "wednesday": { "enabled": true, "start": "13:00", "end": "17:00" },
    "thursday": { "enabled": true, "start": "13:00", "end": "17:00" },
    "friday": { "enabled": true, "start": "13:00", "end": "17:00" },
    "saturday": { "enabled": false, "start": "08:00", "end": "17:00" },
    "sunday": { "enabled": true, "start": "08:00", "end": "17:00" }
  }
}
```

### Unavailable Dates Format:
```json
[
  {
    "id": "1234567890",
    "date": "2025-09-15",
    "branch": "cabugao",
    "timeSlots": null // null = entire day unavailable
  },
  {
    "id": "1234567891", 
    "date": "2025-09-16",
    "branch": "sanjuan",
    "timeSlots": ["09:00", "09:30", "10:00"] // specific times unavailable
  }
]
```

## 🎯 How It Works

### 1. **Doctor Schedule Configuration**
Doctors can access their settings and configure:
- **Working days** for each branch (enable/disable)
- **Working hours** (start and end times)
- **Unavailable dates** (entire days or specific time slots)

### 2. **Appointment Booking Validation**
When patients book appointments:
1. System checks if any providers are scheduled to work
2. Validates time falls within working hours
3. Checks for existing appointment conflicts
4. Verifies date/time is not marked unavailable
5. Provides detailed feedback if booking fails

### 3. **Time Slot Generation**
The system now:
- Only shows time slots when providers are actually working
- Considers individual provider schedules
- Respects unavailable dates/times
- Ensures appointments fit within working hours

## 🛠️ Usage Instructions

### For Doctors:
1. **Login** to your doctor account
2. **Go to Settings** → **Schedule** tab
3. **Configure working hours** for each day and branch
4. **Mark unavailable dates** as needed
5. **Save** your schedule

### For Staff:
1. **Login** to your staff account
2. **Follow the same steps** as doctors
3. **Configure your working schedule**

### For Patients:
1. **Select branch and date** for appointment
2. **System will show only available time slots** based on actual provider schedules
3. **Book appointment** with enhanced validation

## 🔧 API Methods Available

### ScheduleService Methods:
- `getAvailableProviders(branch, date, time)` - Get available doctors/staff
- `getAvailableTimeSlots(branch, date, duration)` - Get all available slots
- `isProviderAvailable(provider, branch, date, time, dayOfWeek)` - Check specific availability
- `validateAppointment(providerId, branch, date, time, duration)` - Validate booking

### ScheduleUtils Methods:
- `updateProviderSchedule(providerId, role, schedule, unavailableDates)` - Save schedule
- `getProviderSchedule(providerId, role)` - Get current schedule
- `validateAppointment(providerId, branch, date, time, duration)` - Enhanced validation
- `getAvailableProvidersForTime(branch, date, time, duration)` - Get available providers

## 📈 Benefits

### ✅ **For Clinic Management:**
- **Real schedule control** - only show available times
- **Prevent overbooking** - appointments validated against actual availability
- **Flexible scheduling** - doctors control their own schedules
- **Better resource management** - see who's working when

### ✅ **For Doctors:**
- **Full schedule control** - set working hours per branch
- **Mark unavailable times** - vacations, meetings, etc.
- **Branch-specific schedules** - different hours at different locations
- **Easy schedule updates** - modify through settings interface

### ✅ **For Patients:**
- **Only see available slots** - no more booking unavailable times
- **Clear feedback** - understand why slots aren't available
- **Better booking experience** - fewer errors and conflicts

## 🔍 Troubleshooting

### Issue: "No time slots available"
**Solution:** Check if doctors have configured their schedules in Settings.

### Issue: "Schedule save failed"
**Solutions:**
1. Run the `update_doctor_schedules.sql` script
2. Check database column exists
3. Fallback to localStorage (temporary)

### Issue: Appointments still bookable outside hours
**Solution:** Clear browser cache and check schedule configuration.

## 📋 Current Provider Schedules

Based on the updated database, here are the current provider schedules:

### Dr. Ellaine Mae Silario Saplor
- **Cabugao**: Mon,Tue,Fri (8AM-12PM), Sun (8AM-5PM)
- **San Juan**: Mon,Tue,Fri (1PM-5PM), Sun (8AM-5PM)

### Dr. Gian Paul Valoria Vivit  
- **Cabugao**: Wed,Thu (8AM-12PM), Sat (8AM-5PM)
- **San Juan**: Sun (8AM-5PM)

### Staff - Jerome T. Eva
- **Cabugao**: Mon-Fri (8AM-12PM), Sat (8AM-5PM)
- **San Juan**: Mon-Fri (1PM-5PM), Sun (8AM-5PM)

### Staff - Jerome T. Eva (Assistant)
- **Cabugao**: Wed,Thu (8AM-12PM)
- **San Juan**: Mon,Tue,Fri (1PM-5PM)

## 🚀 Next Steps

1. **Run the database setup script** to update provider schedules
2. **Test appointment booking** with the new validation
3. **Train doctors/staff** on how to update their schedules
4. **Monitor system performance** and user feedback
5. **Consider adding more features** like break times, special schedules, etc.

## 📞 Support

If you encounter any issues:
1. Check the console for detailed error messages
2. Verify database columns exist
3. Ensure providers have configured their schedules
4. Contact system administrator if problems persist

---

**This enhanced schedule system ensures that appointment booking is based on real provider availability, giving you complete control over clinic operations while providing a better experience for patients.**
