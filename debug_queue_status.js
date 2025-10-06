/**
 * Debug Queue Status Script
 * Run this in the browser console to debug queue issues
 */

// Debug function to check Francis Jey R. Valoria's queue status
async function debugFrancisQueueStatus() {
  console.log('🔍 Debugging Francis Jey R. Valoria\'s queue status...');
  
  try {
    // Get Francis's patient ID
    const { data: patientData, error: patientError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .ilike('full_name', '%Francis Jey R. Valoria%')
      .limit(1);
    
    if (patientError) {
      console.error('❌ Error finding patient:', patientError);
      return;
    }
    
    if (!patientData || patientData.length === 0) {
      console.log('❌ Patient not found');
      return;
    }
    
    const patient = patientData[0];
    console.log(`👤 Found patient: ${patient.full_name} (ID: ${patient.id})`);
    
    // Check all queue entries for this patient today
    const today = new Date().toISOString().split('T')[0];
    const { data: allQueueEntries, error: allQueueError } = await supabase
      .from('queue')
      .select('*')
      .eq('patient_id', patient.id)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .order('created_at', { ascending: false });
    
    if (allQueueError) {
      console.error('❌ Error fetching all queue entries:', allQueueError);
      return;
    }
    
    console.log(`📋 All queue entries for Francis today:`, allQueueEntries);
    
    // Check only active queue entries
    const { data: activeQueueEntries, error: activeQueueError } = await supabase
      .from('queue')
      .select('*')
      .eq('patient_id', patient.id)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .in('status', ['waiting', 'serving'])
      .order('created_at', { ascending: false });
    
    if (activeQueueError) {
      console.error('❌ Error fetching active queue entries:', activeQueueError);
      return;
    }
    
    console.log(`✅ Active queue entries for Francis today:`, activeQueueEntries);
    
    // Check if patient should be able to be added to queue
    if (activeQueueEntries && activeQueueEntries.length > 0) {
      console.log('🚫 Francis is already in active queue - "Add to Queue Again" button should be hidden');
    } else {
      console.log('✅ Francis is NOT in active queue - "Add to Queue Again" button should be visible');
    }
    
    // Check confirmed appointments for Francis today
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('*')
      .eq('patient_id', patient.id)
      .eq('appointment_date', today)
      .eq('status', 'confirmed');
    
    if (appointmentsError) {
      console.error('❌ Error fetching appointments:', appointmentsError);
      return;
    }
    
    console.log(`📅 Confirmed appointments for Francis today:`, appointments);
    
    if (appointments && appointments.length > 0) {
      console.log('✅ Francis has confirmed appointments - should show "Add to Queue Again" button');
    } else {
      console.log('❌ Francis has no confirmed appointments - button should not show');
    }
    
  } catch (error) {
    console.error('❌ Error in debug function:', error);
  }
}

// Run the debug function
debugFrancisQueueStatus();
