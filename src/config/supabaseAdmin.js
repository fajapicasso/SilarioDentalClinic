// src/config/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

// Only create admin client in development
let supabaseAdmin = null;

if (import.meta.env.DEV && supabaseServiceKey) {
  console.warn('⚠️ Using service role key in development mode. Never use this in production!');
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export { supabaseAdmin };