# Queue Reset Implementation - Daily Philippine Time Reset

## Overview
The queueing system has been updated to reset queue numbers daily based on Philippine time (UTC+8). This ensures that queue numbers start from 1 every day at midnight Philippine time, providing a clean daily reset for the queue system.

## Key Changes Made

### 1. Philippine Time Utility (`src/utils/philippineTime.js`)
Created a comprehensive utility module for handling Philippine time operations:

- **`getPhilippineTime()`** - Gets current time in Philippine timezone
- **`getTodayPhilippineDate()`** - Gets today's date in YYYY-MM-DD format
- **`getTodayStartPhilippine()`** - Gets start of today in Philippine time
- **`getTodayEndPhilippine()`** - Gets end of today in Philippine time
- **`getNextQueueNumberForToday(supabase)`** - Gets next queue number for today only
- **`isPatientInTodayQueue(supabase, patientId)`** - Checks if patient is in today's queue
- **`getTodayQueueEntries(supabase, status)`** - Gets all queue entries for today

### 2. Updated QueueService (`src/services/queueService.js`)
Modified the centralized queue service to use daily reset logic:

- Uses `getTodayPhilippineDate()` for date comparisons
- Uses `getNextQueueNumberForToday()` for queue number generation
- Uses `isPatientInTodayQueue()` for duplicate checking
- All queue operations are now filtered by today's date in Philippine time

### 3. Updated Components
Updated all components that handle queue operations:

#### Patient Dashboard (`src/pages/patient/Dashboard.jsx`)
- Updated `joinQueue()` function to use daily reset logic
- Uses Philippine time utilities for queue number generation

#### Staff Queue Management (`src/pages/staff/QueueManagement.jsx`)
- Updated `addPatientToQueue()` function
- Uses daily reset logic for queue number assignment

#### Doctor Queue Management (`src/pages/doctor/QueueManagement.jsx`)
- Updated `addPatientToQueue()` function
- Implements daily reset for queue numbering

#### Staff Dashboard (`src/pages/staff/Dashboard.jsx`)
- Updated `addPatientToQueue()` function
- Uses Philippine time utilities

#### Admin Queue Monitoring (`src/pages/admin/QueueMonitoring.jsx`)
- Added Philippine time imports for future enhancements

## How It Works

### Daily Reset Logic
1. **Queue Number Generation**: Instead of getting the maximum queue number globally, the system now:
   - Gets the maximum queue number for today only (filtered by `created_at` between today's start and end in Philippine time)
   - If no entries exist for today, starts with queue number 1
   - If entries exist, uses the maximum + 1

2. **Duplicate Checking**: 
   - Checks if a patient is already in today's queue only
   - Ignores queue entries from previous days

3. **Date Filtering**:
   - All queue operations are filtered by today's date in Philippine timezone
   - Uses `created_at` field with Philippine time boundaries

### Timezone Handling
- Philippine time is UTC+8
- All date calculations are done in Philippine timezone
- Queue reset happens at midnight Philippine time (00:00 UTC+8)

## Benefits

1. **Clean Daily Reset**: Queue numbers start from 1 every day
2. **Timezone Accuracy**: Uses Philippine time for all operations
3. **Consistent Behavior**: All components use the same reset logic
4. **Better User Experience**: Patients see queue numbers starting from 1 each day
5. **Data Integrity**: Prevents queue number inflation over time

## Testing

A test script (`test_queue_reset.js`) has been created to verify the functionality:

```bash
node test_queue_reset.js
```

The test verifies:
- Philippine time calculations
- Queue number generation
- Patient queue checking
- Today's queue entries retrieval

## Usage Examples

### Getting Next Queue Number
```javascript
import { getNextQueueNumberForToday } from '../utils/philippineTime';

const nextQueueNumber = await getNextQueueNumberForToday(supabase);
// Returns the next queue number for today (resets daily)
```

### Checking if Patient is in Today's Queue
```javascript
import { isPatientInTodayQueue } from '../utils/philippineTime';

const existingQueue = await isPatientInTodayQueue(supabase, patientId);
if (existingQueue) {
  console.log(`Patient is already in today's queue: #${existingQueue.queue_number}`);
}
```

### Getting Today's Queue Entries
```javascript
import { getTodayQueueEntries } from '../utils/philippineTime';

const todayQueue = await getTodayQueueEntries(supabase, 'waiting');
// Returns all waiting patients in today's queue
```

## Migration Notes

- **No Database Changes Required**: The existing queue table structure is maintained
- **Backward Compatible**: Existing queue entries are not affected
- **Immediate Effect**: The reset logic takes effect immediately after deployment
- **No Data Loss**: All existing queue data is preserved

## Monitoring

To monitor the queue reset functionality:

1. Check queue numbers at midnight Philippine time
2. Verify that queue numbers start from 1 each day
3. Monitor the `created_at` timestamps to ensure they're in Philippine time
4. Use the admin queue monitoring page to see today's queue entries

## Troubleshooting

If queue numbers don't reset properly:

1. Verify the Philippine time utility is working correctly
2. Check that all components are using the updated queue service
3. Ensure the database timezone settings are correct
4. Verify that the `created_at` field is being set correctly

## Future Enhancements

- Add queue reset notifications
- Implement queue statistics by day
- Add queue history tracking
- Create queue reset monitoring dashboard
