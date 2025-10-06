// EMERGENCY SCHEDULE FIX - Immediate Working Solution
// Copy and paste this into browser console on patient appointments page

console.log('🚨 EMERGENCY SCHEDULE FIX TOOL');
console.log('==============================');

// Step 1: Check if we're on the right page
if (!window.location.pathname.includes('/patient/appointments')) {
  console.error('❌ Please navigate to Patient → Appointments page first');
  return;
}

// Step 2: Override the fetchAvailableTimeSlots function with a working version
async function emergencyTimeSlotFix() {
  console.log('🔧 Installing emergency time slot generator...');
  
  // Find the React component and override its function
  const rootElement = document.querySelector('#root');
  if (!rootElement) {
    console.error('❌ Cannot find React root element');
    return;
  }
  
  // Emergency time slot generator (hardcoded but working)
  window.emergencyGenerateTimeSlots = function(date, branch) {
    console.log(`🕒 Generating emergency time slots for ${branch} on ${date.toISOString().split('T')[0]}`);
    
    const dayOfWeek = date.getDay();
    let startHour, endHour;
    
    if (branch === 'Cabugao') {
      if (dayOfWeek === 0) { // Sunday
        return { availableSlots: [], formattedSlots: [] };
      } else if (dayOfWeek === 6) { // Saturday
        startHour = 8;
        endHour = 17;
      } else { // Monday-Friday
        startHour = 8;
        endHour = 12;
      }
    } else if (branch === 'San Juan') {
      if (dayOfWeek === 6) { // Saturday
        return { availableSlots: [], formattedSlots: [] };
      } else if (dayOfWeek === 0) { // Sunday
        startHour = 8;
        endHour = 17;
      } else { // Monday-Friday
        startHour = 13;
        endHour = 17;
      }
    }
    
    const availableSlots = [];
    const formattedSlots = [];
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        availableSlots.push(timeStr);
        formattedSlots.push(displayTime);
      }
    }
    
    console.log(`✅ Generated ${availableSlots.length} emergency time slots`);
    
    return {
      availableSlots,
      formattedSlots
    };
  };
  
  // Try to hook into React component's state
  console.log('🔌 Attempting to patch React component...');
  
  // Look for the appointment form
  const appointmentButtons = document.querySelectorAll('button');
  let selectTimeButton = null;
  
  appointmentButtons.forEach(button => {
    if (button.textContent.includes('Select available time slot') || 
        button.textContent.includes('Select time slot')) {
      selectTimeButton = button;
    }
  });
  
  if (selectTimeButton) {
    console.log('✅ Found time slot button, adding emergency click handler');
    
    // Override the click handler
    selectTimeButton.addEventListener('click', async function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('🚨 Emergency time slot generation triggered');
      
      // Get the selected date and branch from form
      const dateInputs = document.querySelectorAll('input[type="text"]');
      const branchSelects = document.querySelectorAll('select');
      
      let selectedDate = null;
      let selectedBranch = null;
      
      // Try to find date and branch
      dateInputs.forEach(input => {
        if (input.value && input.value.match(/\d{4}-\d{2}-\d{2}/)) {
          selectedDate = new Date(input.value);
        }
      });
      
      branchSelects.forEach(select => {
        if (select.value && (select.value === 'Cabugao' || select.value === 'San Juan')) {
          selectedBranch = select.value;
        }
      });
      
      if (!selectedDate || !selectedBranch) {
        alert('Please select both date and branch first');
        return;
      }
      
      // Generate emergency time slots
      const slots = window.emergencyGenerateTimeSlots(selectedDate, selectedBranch);
      
      // Create and show time slot modal
      showEmergencyTimeSlotModal(slots, selectedDate, selectedBranch);
    });
  }
  
  console.log('✅ Emergency fix installed successfully!');
  console.log('📋 Instructions:');
  console.log('1. Select a date and branch');
  console.log('2. Click "Select available time slot"');
  console.log('3. Emergency time slots will appear');
}

// Emergency time slot modal
function showEmergencyTimeSlotModal(slots, date, branch) {
  console.log('📅 Showing emergency time slot modal');
  
  // Remove existing modal if any
  const existingModal = document.getElementById('emergency-time-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Create modal
  const modal = document.createElement('div');
  modal.id = 'emergency-time-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    max-width: 600px;
    max-height: 80%;
    overflow-y: auto;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  `;
  
  modalContent.innerHTML = `
    <h3 style="margin-top: 0; color: #059669;">🚨 Emergency Time Slots</h3>
    <p><strong>Date:</strong> ${date.toDateString()}</p>
    <p><strong>Branch:</strong> ${branch}</p>
    <p style="color: #dc2626; font-size: 14px;">⚠️ This is a temporary fix. Please contact administrator to fix the schedule system properly.</p>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin: 20px 0;">
      ${slots.formattedSlots.map((slot, index) => `
        <button onclick="selectEmergencyTimeSlot('${slots.availableSlots[index]}', '${slot}')" 
                style="padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; background: #f9fafb; cursor: pointer;">
          ${slot}
        </button>
      `).join('')}
    </div>
    <div style="text-align: right; margin-top: 20px;">
      <button onclick="closeEmergencyModal()" 
              style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
        Cancel
      </button>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
}

// Emergency time slot selection
window.selectEmergencyTimeSlot = function(timeValue, timeDisplay) {
  console.log(`⏰ Selected emergency time slot: ${timeDisplay} (${timeValue})`);
  
  // Try to find and fill the time input field
  const timeInputs = document.querySelectorAll('select, input');
  
  timeInputs.forEach(input => {
    if (input.name && input.name.includes('time')) {
      input.value = timeValue;
      
      // Trigger change event
      const event = new Event('change', { bubbles: true });
      input.dispatchEvent(event);
    }
  });
  
  // Also try to set it via React
  const timeSelect = document.querySelector('select[name*="time"], input[name*="time"]');
  if (timeSelect) {
    timeSelect.value = timeValue;
    timeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  closeEmergencyModal();
  
  alert(`✅ Time slot selected: ${timeDisplay}\n\nYou can now proceed with booking the appointment.`);
};

window.closeEmergencyModal = function() {
  const modal = document.getElementById('emergency-time-modal');
  if (modal) {
    modal.remove();
  }
};

// Install the emergency fix
emergencyTimeSlotFix();

console.log('🎉 EMERGENCY FIX COMPLETE!');
console.log('');
console.log('📋 How to use:');
console.log('1. Fill out the appointment form (patient info, service, etc.)');
console.log('2. Select a date and branch');
console.log('3. Click "Select available time slot" button');
console.log('4. Choose from the emergency time slots');
console.log('5. Complete your booking');
console.log('');
console.log('⚠️ This is a TEMPORARY solution. The real schedule system needs to be fixed by:');
console.log('1. Running SQL migration to add schedule columns');
console.log('2. Doctors setting up their schedules in Settings');
console.log('3. Fixing any database connectivity issues');
