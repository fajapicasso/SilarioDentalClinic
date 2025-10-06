# Add to Queue Again - Debug Fix

## Issue Analysis

Based on the queue management dashboard screenshot, I can see:

1. **Francis Jey R. Valoria** has queue entries #546 and #547 that are both **"cancelled"**
2. The queue shows **"Active patients: 0"** because there are no active (waiting/serving) patients
3. The **"Add to Queue Again" button is not working** because the system is still finding these cancelled entries

## Root Cause

The problem is that even though I updated the `isPatientInTodayQueue` function to only check for active queue entries, there might be a caching issue or the function is still being called with old parameters.

## Fixes Applied

### 1. **Enhanced Debugging in `isPatientInTodayQueue`**
```javascript
export async function isPatientInTodayQueue(supabase, patientId) {
  try {
    const todayStart = getTodayStartPhilippine();
    const todayEnd = getTodayEndPhilippine();
    
    console.log(`Checking if patient ${patientId} is in today's active queue...`);
    
    const { data, error } = await supabase
      .from('queue')
      .select('*')
      .eq('patient_id', patientId)
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)
      .in('status', ['waiting', 'serving'])  // Only active statuses
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error checking if patient is in today\'s queue:', error);
      return null; // Return null instead of throwing
    }

    const result = data && data.length > 0 ? data[0] : null;
    console.log(`Patient ${patientId} queue status:`, result ? `Found active entry (status: ${result.status})` : 'No active entries');
    
    return result;
  } catch (error) {
    console.error('Error checking if patient is in today\'s queue:', error);
    return null; // Return null instead of throwing
  }
}
```

### 2. **Enhanced Debugging in "Add to Queue Again" Function**
```javascript
const addToQueueAgain = async (appointment) => {
  setIsAddingToQueue(true);
  try {
    console.log(`Attempting to add patient ${appointment.patient_id} to queue again...`);
    
    // Check if patient is already in active queue
    const isInQueue = await isPatientInTodayQueue(supabase, appointment.patient_id);
    console.log(`Patient ${appointment.patient_id} in queue:`, isInQueue);
    
    if (isInQueue) {
      console.log(`Patient ${appointment.patient_id} is already in active queue, skipping...`);
      toast.info('Patient is already in today\'s active queue');
      return;
    }

    console.log(`Patient ${appointment.patient_id} not in active queue, proceeding with addition...`);

    // Add to queue using QueueService
    const result = await QueueService.addAppointmentToQueue(appointment, { 
      source: 'doctor_appointments_add_to_queue_again' 
    });

    console.log(`Queue addition result for patient ${appointment.patient_id}:`, result);

    if (result.success) {
      toast.success(`Patient added to queue as #${result.queueNumber}`);
      // Update the queue status
      setPatientsInQueue(prev => new Set([...prev, appointment.patient_id]));
      // Refresh the appointments to update button states
      setTimeout(() => {
        checkPatientsInQueue();
      }, 1000);
    } else {
      toast.error(result.message || 'Failed to add patient to queue');
    }
  } catch (error) {
    console.error('Error adding patient to queue:', error);
    toast.error('Failed to add patient to queue');
  } finally {
    setIsAddingToQueue(false);
  }
};
```

### 3. **Debug Script for Testing**
Created `debug_queue_status.js` to help debug the issue:
- Checks Francis Jey R. Valoria's queue status
- Shows all queue entries vs active entries
- Verifies appointment status
- Provides clear debugging output

## Testing Steps

### 1. **Check Console Logs**
Open browser console and look for:
- `Checking if patient [ID] is in today's active queue...`
- `Patient [ID] queue status: No active entries`
- `Patient [ID] not in active queue, proceeding with addition...`

### 2. **Verify Button Visibility**
The "Add to Queue Again" button should be visible for Francis Jey R. Valoria because:
- ✅ He has cancelled queue entries (not active)
- ✅ He should have confirmed appointments for today
- ✅ No active queue entries exist

### 3. **Test Button Functionality**
When clicking "Add to Queue Again":
- Should show console logs
- Should add patient to queue with new queue number
- Should update button state (hide button)
- Should show success toast

## Expected Results

### Before Fix:
- ❌ "Add to Queue Again" button not visible
- ❌ Button click does nothing
- ❌ Console shows cancelled entries as "active"

### After Fix:
- ✅ "Add to Queue Again" button visible for Francis
- ✅ Button click works and adds to queue
- ✅ Console shows "No active entries" for Francis
- ✅ New queue entry created with status "waiting"
- ✅ Button disappears after successful addition

## Debugging Commands

Run these in browser console to debug:

```javascript
// Check Francis's queue status
debugFrancisQueueStatus();

// Check specific patient's queue status
const patientId = 'ccf43fef-4671-45f7-9d1c-e649657a9fc8'; // Francis's ID
isPatientInTodayQueue(supabase, patientId).then(result => {
  console.log('Queue status:', result);
});
```

## Files Modified

1. **`src/utils/philippineTime.js`** - Enhanced `isPatientInTodayQueue` with debugging
2. **`src/pages/doctor/Appointments.jsx`** - Enhanced `addToQueueAgain` with debugging
3. **`src/pages/staff/Appointments.jsx`** - Enhanced `addToQueueAgain` with debugging
4. **`debug_queue_status.js`** - Debug script for testing

## Next Steps

1. **Test the fixes** by refreshing the appointments page
2. **Check console logs** to see if cancelled entries are properly ignored
3. **Verify button visibility** for Francis Jey R. Valoria
4. **Test button functionality** by clicking "Add to Queue Again"
5. **Confirm queue addition** in the queue management dashboard

The key fix is ensuring that `isPatientInTodayQueue` only returns active queue entries and ignores cancelled ones, which should make the "Add to Queue Again" button work properly.

