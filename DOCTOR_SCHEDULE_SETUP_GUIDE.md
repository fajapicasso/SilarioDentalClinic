# 👨‍⚕️ Doctor & Staff Schedule Setup Guide

## 🎯 IMPORTANT: Schedule Configuration Required

**The appointment booking system now ONLY shows time slots that doctors and staff have specifically configured in their settings. No more hardcoded schedules!**

### 📋 What This Means:

- ✅ **Only YOUR configured working hours will show as available appointment slots**
- ✅ **You have full control over when patients can book with you**
- ✅ **No appointments can be booked during times you haven't set as available**
- ❌ **If you don't set your schedule, NO appointment slots will be available**

## 🔧 How to Set Up Your Working Schedule

### **For Doctors:**

1. **Login to your doctor account**
2. **Go to Settings** (gear icon in sidebar)
3. **Click on "Schedule" tab**
4. **Configure your working hours:**

   **📅 For each day of the week:**
   - ✅ **Check the box** to enable that day
   - ⏰ **Set Start Time** (when you start seeing patients)
   - ⏰ **Set End Time** (when you finish seeing patients)
   
   **🏥 For each branch (Cabugao & San Juan):**
   - Configure different hours for different branches if needed
   - You can work different hours at different locations

5. **Mark unavailable dates (optional):**
   - Click "Mark Date Unavailable"
   - Select specific dates when you won't be available
   - Choose branch and date
   - Choose full day or specific time slots

6. **Save your schedule:**
   - Click "Save Schedule & Availability"
   - Verify you see success message

### **For Staff:**

1. **Login to your staff account**
2. **Go to Settings** 
3. **Click on "Schedule" tab**
4. **Follow the same steps as doctors above**

## 📝 Example Schedule Configurations

### **Example 1: Traditional Doctor Schedule**
```
Cabugao Branch:
- Monday: ✅ Enabled, 8:00 AM - 12:00 PM
- Tuesday: ✅ Enabled, 8:00 AM - 12:00 PM  
- Wednesday: ✅ Enabled, 8:00 AM - 12:00 PM
- Thursday: ✅ Enabled, 8:00 AM - 12:00 PM
- Friday: ✅ Enabled, 8:00 AM - 12:00 PM
- Saturday: ✅ Enabled, 8:00 AM - 5:00 PM
- Sunday: ❌ Disabled (Day off)

San Juan Branch:
- Monday: ✅ Enabled, 1:00 PM - 5:00 PM
- Tuesday: ✅ Enabled, 1:00 PM - 5:00 PM
- Wednesday: ✅ Enabled, 1:00 PM - 5:00 PM  
- Thursday: ✅ Enabled, 1:00 PM - 5:00 PM
- Friday: ✅ Enabled, 1:00 PM - 5:00 PM
- Saturday: ❌ Disabled (Day off)
- Sunday: ✅ Enabled, 8:00 AM - 5:00 PM
```

### **Example 2: Part-time Doctor**
```
Cabugao Branch:
- Monday: ✅ Enabled, 9:00 AM - 1:00 PM
- Tuesday: ❌ Disabled (Not working)
- Wednesday: ✅ Enabled, 9:00 AM - 1:00 PM
- Thursday: ❌ Disabled (Not working)
- Friday: ✅ Enabled, 9:00 AM - 1:00 PM
- Saturday: ❌ Disabled (Day off)
- Sunday: ❌ Disabled (Day off)

San Juan Branch:  
- All days: ❌ Disabled (Doesn't work at this branch)
```

## ⚠️ Important Notes

### **❗ What Happens If You Don't Set Your Schedule:**

- **NO appointment slots will be available for patients**
- **Patients will see: "No healthcare providers have set their working hours"**
- **Appointments cannot be booked with you**

### **✅ Benefits of Proper Schedule Setup:**

1. **Full Control**: You decide exactly when you're available
2. **Automatic Blocking**: System prevents booking during your off hours
3. **Branch Flexibility**: Different schedules for different locations
4. **Vacation Management**: Mark specific dates as unavailable
5. **Real-time Updates**: Changes apply immediately to appointment booking

### **🔄 Schedule Management:**

- **Modify Anytime**: Change your schedule whenever needed
- **Seasonal Adjustments**: Update for holidays, vacations, etc.
- **Emergency Changes**: Quickly mark dates as unavailable
- **Advance Planning**: Set unavailable dates months in advance

## 🚨 Troubleshooting

### **Problem: "No available time slots" for patients**

**Solution:**
1. Check if you've enabled at least one day of the week
2. Verify your working hours are set correctly  
3. Make sure you clicked "Save Schedule & Availability"
4. Check if you accidentally marked the date as unavailable

### **Problem: Schedule not saving**

**Solution:**
1. Run the database migration script (`add_schedule_columns.sql`)
2. Contact administrator to set up database schema
3. Check browser console for error messages

### **Problem: Patients booking at wrong times**

**Solution:**
1. Verify your schedule configuration is correct
2. Check that the day is actually enabled (checkbox checked)
3. Verify time ranges are set properly
4. Make sure you saved the schedule

## 📞 Support

### **For Doctors/Staff:**
- If you need help setting up your schedule, contact the clinic administrator
- If the schedule tab is missing, database setup may be needed
- If schedules aren't saving, run the SQL migration scripts

### **For Administrators:**
- Run `add_schedule_columns.sql` to set up database schema
- Ensure all doctors and staff configure their schedules
- Monitor that appointment slots are available for patients

## 🎯 Quick Setup Checklist

**✅ For Each Doctor/Staff Member:**

- [ ] Login to settings
- [ ] Go to Schedule tab  
- [ ] Enable working days for each branch
- [ ] Set specific start and end times
- [ ] Mark any known unavailable dates
- [ ] Click "Save Schedule & Availability"
- [ ] Verify success message appears
- [ ] Test by checking patient appointment booking

**✅ For Administrators:**

- [ ] Run database migration script
- [ ] Ensure all providers set up schedules
- [ ] Verify appointment booking shows available slots
- [ ] Train staff on schedule management

---

## 🎉 Result

**Once properly configured, the appointment booking system will show ONLY the exact time slots you've made available, giving you complete control over your schedule while ensuring patients can book appointments during your actual working hours!**
