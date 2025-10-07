// Atomic Auto-Add Fix for Queue Management
// This replaces the race condition-prone auto-add logic

// Replace the entire auto-add section with this atomic version:

if (missingAppointments.length > 0 && !skipAutoAdd && user?.role === 'doctor') {
  console.log(`👨‍⚕️ DOCTOR ROLE: Attempting atomic auto-add for ${missingAppointments.length} appointments`);
  
  // Use atomic auto-add to prevent race conditions
  const autoAddResult = await atomicAutoAdd(missingAppointments, todayDate);
  
  if (autoAddResult.success) {
    console.log(`✅ ATOMIC AUTO-ADD SUCCESS: Added ${autoAddResult.addedCount} appointments`);
    if (autoAddResult.addedCount > 0) {
      const todayKey = getTodayDate();
      if (autoAddToastKeyRef.current !== todayKey) {
        autoAddToastKeyRef.current = todayKey;
        toast.success(`Auto-added ${autoAddResult.addedCount} confirmed/appointed appointments to today's queue`);
      }
    }
  } else {
    console.log(`🚫 ATOMIC AUTO-ADD BLOCKED: ${autoAddResult.reason || autoAddResult.error}`);
    if (autoAddResult.reason === 'already_running') {
      console.log('Another auto-add process is already running, skipping...');
    } else if (autoAddResult.reason === 'already_processed') {
      console.log('Auto-add already processed today, skipping...');
    }
  }
}
