/**
 * Test Button State Script
 * Run this in browser console to test the button state logic
 */

// Test function to check button state logic
function testButtonState() {
  console.log('🧪 Testing Button State Logic...');
  
  // Simulate patient IDs
  const patientId1 = 'ccf43fef-4671-45f7-9d1c-e649657a9fc8'; // Francis
  const patientId2 = 'another-patient-id';
  
  // Simulate patientsInQueue state
  const patientsInQueue = new Set([patientId1]); // Francis is in queue
  
  console.log('📊 Current patientsInQueue state:', Array.from(patientsInQueue));
  
  // Test button visibility logic
  console.log(`🔍 Patient 1 (Francis) in queue: ${patientsInQueue.has(patientId1)}`);
  console.log(`🔍 Patient 2 in queue: ${patientsInQueue.has(patientId2)}`);
  
  // Test button should be hidden for Francis (he's in queue)
  const shouldShowButton1 = !patientsInQueue.has(patientId1);
  const shouldShowButton2 = !patientsInQueue.has(patientId2);
  
  console.log(`❌ Button for Francis should be HIDDEN: ${!shouldShowButton1}`);
  console.log(`✅ Button for Patient 2 should be VISIBLE: ${shouldShowButton2}`);
  
  // Test adding Francis to queue
  console.log('\n🔄 Simulating adding Francis to queue...');
  const newPatientsInQueue = new Set([...patientsInQueue, patientId1]);
  console.log('📊 Updated patientsInQueue state:', Array.from(newPatientsInQueue));
  
  // Test button visibility after addition
  const shouldShowButtonAfter1 = !newPatientsInQueue.has(patientId1);
  console.log(`❌ Button for Francis should now be HIDDEN: ${!shouldShowButtonAfter1}`);
}

// Run the test
testButtonState();

