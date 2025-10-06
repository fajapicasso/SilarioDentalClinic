# 🔍 SCHEDULE SYSTEM VERIFICATION CHECKLIST

## Step 1: Database Schema Verification

### Option A: Run SQL Script (Recommended)
1. **Open Supabase Dashboard**
2. **Go to SQL Editor**
3. **Copy and paste** `verify_and_fix_database_schema.sql`
4. **Click "Run"**
5. **Check the results** - should show ✅ for all items

### Option B: Browser Console Check
1. **Open browser console** (F12)
2. **Copy and paste** `verify_database_and_schedules.js`
3. **Wait for auto-run** or manually call `verifyDatabaseAndSchedules()`
4. **Review the detailed report**

---

## Step 2: Doctor Schedule Configuration

### For Each Doctor Account:

#### ✅ **Login Process:**
1. Login as doctor
2. Go to **Settings** → **Schedule tab**
3. Verify UI loads without errors

#### ✅ **Schedule Configuration:**
1. **Enable working days** by checking boxes ✅
   - Monday through Friday (typical working days)
   - Saturday if working weekends
   - Sunday if working weekends

2. **Set working hours for each branch:**
   - **Cabugao Branch**: 8:00 AM - 12:00 PM (weekdays), 8:00 AM - 5:00 PM (Saturday)
   - **San Juan Branch**: 1:00 PM - 5:00 PM (weekdays), 8:00 AM - 5:00 PM (Sunday)

3. **Save the schedule:**
   - Click "Save Schedule & Availability"
   - Wait for success message
   - Verify no error messages

#### ✅ **Verification:**
1. Refresh the page
2. Check that settings are preserved
3. Look for "Loaded schedule from database" in console

---

## Step 3: System Testing

### ✅ **Patient Appointment Booking Test:**
1. **Login as patient** (or use different browser)
2. **Go to Appointments page**
3. **Select future date and branch**
4. **Click "Select available time slot"**
5. **Expected Result**: Time slots appear matching doctor's schedule

### ✅ **Console Verification:**
When testing appointment slots, console should show:
```
🔍 Getting available providers for Cabugao on 2025-01-15
👨‍⚕️ Doctors found: 1
   Doctor: Dr. Smith (ID: abc123)
   Has schedule: true
   Full schedule data: { ... }
✅ Available providers: 1
```

---

## Step 4: Troubleshooting Common Issues

### ❌ **"No healthcare providers have set working hours"**
**Cause**: Doctors haven't enabled their working days
**Solution**: Doctors need to check the ✅ boxes in Settings → Schedule

### ❌ **"Failed to save schedule"**
**Cause**: Database columns missing
**Solution**: Run `verify_and_fix_database_schema.sql`

### ❌ **"Error loading available time slots"**
**Cause**: JavaScript errors (fixed)
**Solution**: Refresh page, check console for new errors

### ❌ **Schedule settings don't persist**
**Cause**: Database permissions or column issues
**Solution**: Run SQL verification script

---

## Step 5: Expected Behavior

### ✅ **Correct Working System:**

**Doctor Experience:**
- Can access Settings → Schedule
- Can enable/disable days by checking boxes
- Can set custom hours per branch
- Schedule saves successfully
- Settings persist after refresh

**Patient Experience:**
- Can select date and branch
- Sees time slots matching doctor's schedule
- No slots appear for disabled days
- Time slots respect exact start/end times

**System Behavior:**
- Only shows slots for enabled days
- Respects doctor's working hours exactly
- No hardcoded fallback schedules
- Clear error messages when no schedules configured

---

## 🚨 Critical Success Factors

1. **Database columns exist**: `schedule` and `unavailable_dates` in `profiles` table
2. **Doctors enable days**: The checkboxes ✅ must be checked
3. **Valid schedule data**: Proper JSON structure with enabled days
4. **No JavaScript errors**: Console should be clean
5. **Proper authentication**: Correct user permissions

---

## 📞 Quick Diagnostic Commands

### Browser Console Commands:
```javascript
// Check if user is logged in
await window.supabase.auth.getUser()

// Check current user's schedule
const user = await window.supabase.auth.getUser()
await window.supabase.from('profiles').select('schedule').eq('id', user.data.user.id).single()

// Test schedule service
await window.ScheduleService.getAvailableProviders('Cabugao', '2025-01-15', '08:00')
```

### SQL Diagnostic Queries:
```sql
-- Check if columns exist
SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('schedule', 'unavailable_dates');

-- Check doctor schedules
SELECT full_name, schedule IS NOT NULL as has_schedule FROM profiles WHERE role = 'doctor';
```

---

## ✅ Success Criteria

**The schedule system is working correctly when:**

1. **Database schema**: All required columns and tables exist
2. **Doctor settings**: Doctors can save schedules successfully  
3. **Patient booking**: Time slots appear matching doctor's exact schedule
4. **No fallbacks**: System uses only doctor-configured schedules
5. **Clear feedback**: Appropriate messages when no schedules configured

**🎉 Once all checkboxes are ✅, the appointment booking system will work perfectly!**

