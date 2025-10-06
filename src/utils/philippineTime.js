/**
 * Philippine Time Utility Functions
 * Handles timezone conversion and daily queue reset logic
 */

/**
 * Get current Philippine time
 * @returns {Date} Current date and time in Philippine timezone
 */
export function getPhilippineTime() {
  const now = new Date();
  // Philippine time is UTC+8
  const philippineTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return philippineTime;
}

/**
 * Get today's date in Philippine timezone (YYYY-MM-DD format)
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export function getTodayPhilippineDate() {
  const philippineTime = getPhilippineTime();
  return philippineTime.toISOString().split('T')[0];
}

/**
 * Get the start of today in Philippine timezone
 * @returns {string} Start of today in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
export function getTodayStartPhilippine() {
  const philippineTime = getPhilippineTime();
  const startOfDay = new Date(philippineTime);
  startOfDay.setUTCHours(0, 0, 0, 0);
  return startOfDay.toISOString();
}

/**
 * Get the end of today in Philippine timezone
 * @returns {string} End of today in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
export function getTodayEndPhilippine() {
  const philippineTime = getPhilippineTime();
  const endOfDay = new Date(philippineTime);
  endOfDay.setUTCHours(23, 59, 59, 999);
  return endOfDay.toISOString();
}

/**
 * Check if a given date is today in Philippine timezone
 * @param {string|Date} date - Date to check
 * @returns {boolean} True if the date is today in Philippine timezone
 */
export function isTodayPhilippine(date) {
  const inputDate = typeof date === 'string' ? new Date(date) : date;
  const today = getTodayPhilippineDate();
  const inputDateStr = inputDate.toISOString().split('T')[0];
  return inputDateStr === today;
}

/**
 * Get the next queue number for today in Philippine timezone
 * This function should be used to get the next queue number that resets daily
 * Uses database-level atomic operations to prevent race conditions
 * @param {Object} supabase - Supabase client instance
 * @param {number} maxRetries - Maximum number of retries for race condition handling
 * @returns {Promise<number>} Next queue number for today
 */
export async function getNextQueueNumberForToday(supabase, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // First, try to use the database function for atomic queue number generation
      const { data: dbFunctionResult, error: dbFunctionError } = await supabase
        .rpc('get_next_queue_number_for_today');

      if (!dbFunctionError && dbFunctionResult !== null) {
        console.log(`Next queue number for today (${getTodayPhilippineDate()}): ${dbFunctionResult} (via DB function)`);
        return dbFunctionResult;
      }

      // Fallback to application-level logic if database function is not available
      console.warn('Database function not available, using fallback logic');
      
      const todayStart = getTodayStartPhilippine();
      const todayEnd = getTodayEndPhilippine();
      
      // Add a small delay for retry attempts to reduce race conditions
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50)); // 50-150ms random delay
      }
      
      const { data: maxQueue, error: maxQueueError } = await supabase
        .from('queue')
        .select('queue_number')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)
        .order('queue_number', { ascending: false })
        .limit(1);

      if (maxQueueError) {
        console.error('Error getting max queue number for today:', maxQueueError);
        throw maxQueueError;
      }

      // If no queue entries for today, start with 1
      const nextQueueNumber = maxQueue && maxQueue.length > 0 ? maxQueue[0].queue_number + 1 : 1;
      
      console.log(`Next queue number for today (${getTodayPhilippineDate()}): ${nextQueueNumber} (attempt ${attempt + 1}, fallback)`);
      return nextQueueNumber;
    } catch (error) {
      console.error(`Error getting next queue number for today (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries - 1) {
        throw error;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
}

/**
 * Get queue entries for today in Philippine timezone
 * @param {Object} supabase - Supabase client instance
 * @param {string} status - Optional status filter (e.g., 'waiting', 'serving')
 * @returns {Promise<Array>} Queue entries for today
 */
export async function getTodayQueueEntries(supabase, status = null) {
  try {
    const todayStart = getTodayStartPhilippine();
    const todayEnd = getTodayEndPhilippine();
    
    // Use a simpler query approach to avoid 406 errors
    let query = supabase
      .from('queue')
      .select('*')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)
      .in('status', ['waiting', 'serving'])
      .order('queue_number', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting today\'s queue entries:', error);
      // Return empty array instead of throwing to prevent app crashes
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting today\'s queue entries:', error);
    // Return empty array instead of throwing to prevent app crashes
    return [];
  }
}

/**
 * Check if a patient is already in today's queue
 * @param {Object} supabase - Supabase client instance
 * @param {string} patientId - Patient ID to check
 * @returns {Promise<Object|null>} Queue entry if patient is in queue, null otherwise
 */
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
      .in('status', ['waiting', 'serving'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error checking if patient is in today\'s queue:', error);
      return null; // Return null instead of throwing to prevent crashes
    }

    const result = data && data.length > 0 ? data[0] : null;
    console.log(`Patient ${patientId} queue status:`, result ? `Found active entry (status: ${result.status})` : 'No active entries');
    
    return result;
  } catch (error) {
    console.error('Error checking if patient is in today\'s queue:', error);
    return null; // Return null instead of throwing to prevent crashes
  }
}
