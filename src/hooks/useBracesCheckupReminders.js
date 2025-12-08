// src/hooks/useBracesCheckupReminders.js
import { useEffect, useRef } from 'react';
import notificationService from '../services/notificationService';

/**
 * Hook to check for upcoming braces checkups and send reminder notifications
 * Runs once on mount and then every 6 hours to catch any new checkups
 */
export const useBracesCheckupReminders = () => {
  const intervalRef = useRef(null);
  const hasRunRef = useRef(false);

  useEffect(() => {
    // Run immediately on mount
    const checkReminders = async () => {
      try {
        console.log('[useBracesCheckupReminders] Checking for braces checkup reminders...');
        const result = await notificationService.checkAndNotifyBracesCheckups();
        if (result.success) {
          if (result.count > 0) {
            console.log(`[useBracesCheckupReminders] ✓ Successfully processed ${result.count} reminder(s)`);
          } else {
            console.log('[useBracesCheckupReminders] No reminders needed at this time');
          }
        } else {
          console.error('[useBracesCheckupReminders] ✗ Error processing reminders:', result.error);
        }
      } catch (error) {
        console.error('[useBracesCheckupReminders] ✗ Exception in reminder check:', error);
      }
    };

    // Run immediately if not already run
    if (!hasRunRef.current) {
      checkReminders();
      hasRunRef.current = true;
    }

    // Set up interval to check every 6 hours (to catch any new checkups added during the day)
    // This ensures reminders are sent even if checkups are added later in the day
    intervalRef.current = setInterval(() => {
      checkReminders();
    }, 6 * 60 * 60 * 1000); // 6 hours in milliseconds

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return null; // This hook doesn't return anything, it just runs in the background
};
