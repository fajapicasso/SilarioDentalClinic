# Queue Integration Fix - Confirmed Appointments Not Showing

## Problem
Francis Jey R. Valoria has a confirmed appointment for today (September 28, 2025) but it's not showing up in the queue waiting list.

## Quick Fix Options

### Option 1: Run SQL Script (Recommended)
1. **Open Supabase Dashboard**
2. **Go to SQL Editor**
3. **Copy and paste this script:**

```sql
-- Manual Queue Fix for Francis Jey R. Valoria
-- Get the next queue number for today
WITH today_queue AS (
    SELECT 
        COALESCE(MAX(queue_number), 0) as max_queue_number
    FROM queue 
    WHERE created_at >= CURRENT_DATE 
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
)
-- Insert the appointment into the queue
INSERT INTO queue (
    patient_id,
    appointment_id,
    queue_number,
    status,
    estimated_wait_time,
    created_at,
    updated_at
)
SELECT 
    p.id as patient_id,
    a.id as appointment_id,
    tq.max_queue_number + 1 as queue_number,
    'waiting' as status,
    15 as estimated_wait_time,
    NOW() as created_at,
    NOW() as updated_at
FROM profiles p
CROSS JOIN appointments a
CROSS JOIN (
    SELECT COALESCE(MAX(queue_number), 0) as max_queue_number
    FROM queue 
    WHERE created_at >= CURRENT_DATE 
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
) tq
WHERE p.full_name ILIKE '%Francis Jey R. Valoria%'
AND a.patient_id = p.id
AND a.appointment_date = CURRENT_DATE
AND a.status = 'confirmed'
AND NOT EXISTS (
    SELECT 1 FROM queue q 
    WHERE q.patient_id = p.id 
    AND q.created_at >= CURRENT_DATE 
    AND q.created_at < CURRENT_DATE + INTERVAL '1 day'
);
```

4. **Click "Run"**

### Option 2: Use Debug Script
1. **Open Queue Management page**
2. **Open Browser Console (F12)**
3. **Copy and paste the debug script from `debug_queue_integration.js`**
4. **Press Enter to run it**

### Option 3: Manual Queue Addition
1. **Go to Queue Management page**
2. **Click "+ Add Walk-in Patient"**
3. **Select Francis Jey R. Valoria**
4. **Select the branch and doctor**
5. **Click "Add to Queue"**

## What This Fixes

✅ **Adds Francis Jey R. Valoria to the queue**  
✅ **Assigns the correct queue number**  
✅ **Links the appointment to the queue entry**  
✅ **Shows the patient in the waiting list**  

## After the Fix

1. **Refresh the Queue Management page**
2. **Francis Jey R. Valoria should appear in the waiting list**
3. **The queue number should be 1 (or next available number)**
4. **The appointment should be properly linked**

## Why This Happened

The auto-integration logic exists but might not be working due to:
- Timing issues with the appointment confirmation
- Database constraints
- Race conditions in the queue integration
- Missing patient profile data

## Prevention

The enhanced debugging I added will help identify these issues in the future:
- Better logging of appointment integration
- Clearer error messages
- Automatic retry logic
- Better error handling

## Expected Result

After running the fix:
- **Francis Jey R. Valoria** should appear in the waiting list
- **Queue number** should be 1 (or next available)
- **Status** should be "waiting"
- **Appointment** should be properly linked
- **Doctor** should be able to call the patient
