// Test script to verify admin client configuration
// Run this in the browser console to test

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log("Environment variables:", {
  url: supabaseUrl ? "Present" : "Missing",
  serviceKey: serviceRoleKey ? "Present" : "Missing"
});

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing environment variables!");
} else {
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  
  // Test admin client access
  adminClient.from('profiles').select('count', { count: 'exact', head: true })
    .then(({ data, error }) => {
      if (error) {
        console.error("Admin client test failed:", error);
      } else {
        console.log("Admin client test successful:", data);
      }
    });
} 