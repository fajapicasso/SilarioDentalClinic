// src/components/common/BracesCheckupReminderService.jsx
// This component runs in the background to check for upcoming braces checkups
// and send reminder notifications to patients
import { useBracesCheckupReminders } from '../../hooks/useBracesCheckupReminders';

const BracesCheckupReminderService = () => {
  // This hook runs the reminder check automatically
  useBracesCheckupReminders();
  
  // This component doesn't render anything
  return null;
};

export default BracesCheckupReminderService;
