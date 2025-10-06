# Queue Number Fix Instructions

## Problem
The queue numbers are still showing 546 and 547 instead of starting from 1 for today. This is because the existing queue entries were created before the daily reset logic was implemented.

## Solution
You need to run a SQL script to reset today's queue numbers to start from 1.

## Steps to Fix

### Option 1: Run SQL Script in Supabase (Recommended)

1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor

2. **Run the Reset Script**
   - Copy the contents of `reset_today_queue_numbers.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute the script

3. **Verify the Results**
   - The script will show "BEFORE UPDATE" and "AFTER UPDATE" results
   - You should see queue numbers change from 546, 547 to 1, 2

### Option 2: Manual Fix (Alternative)

If you prefer to do it manually:

1. **Open Supabase Dashboard**
   - Go to Table Editor
   - Select the `queue` table

2. **Find Today's Entries**
   - Filter by `created_at` to show only today's entries
   - Look for entries with status 'waiting' or 'serving'

3. **Update Queue Numbers**
   - Change the first entry's `queue_number` to 1
   - Change the second entry's `queue_number` to 2
   - Continue for all today's entries

## After the Fix

Once you've run the SQL script:

1. **Refresh the Queue Management Page**
   - The queue numbers should now show 1, 2, etc.

2. **Test Adding New Patients**
   - Try adding a new patient to the queue
   - The queue number should continue from the last number (e.g., 3, 4, etc.)

3. **Verify Tomorrow's Reset**
   - Tomorrow, the queue numbers will automatically start from 1 again
   - This is handled by the new Philippine time utilities

## What the Fix Does

- **Resets Today's Queue Numbers**: Changes 546, 547 to 1, 2
- **Maintains Order**: Keeps the same order based on when patients were added
- **Preserves Data**: Doesn't delete any queue entries, just renumbers them
- **Future-Proof**: Tomorrow will automatically start from 1

## Expected Results

After running the fix:
- Francis Jey R. Valoria: Queue #1 (was #546)
- Neil Joshua V. Vivit: Queue #2 (was #547)
- Any new patients added today will get #3, #4, etc.
- Tomorrow will start from #1 again

## Troubleshooting

If the fix doesn't work:

1. **Check the SQL Results**: Make sure the script ran successfully
2. **Refresh the Page**: Hard refresh (Ctrl+F5) the queue management page
3. **Check Browser Console**: Look for any JavaScript errors
4. **Verify Date**: Make sure the entries are actually from today

## Need Help?

If you're still seeing the old queue numbers:
1. Make sure you ran the SQL script in Supabase
2. Check that the entries are from today (not yesterday)
3. Try refreshing the page completely
4. Check if there are any JavaScript errors in the browser console
