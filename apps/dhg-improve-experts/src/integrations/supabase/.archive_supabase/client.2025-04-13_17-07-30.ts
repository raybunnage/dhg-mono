// This file loads Supabase credentials from environment variables
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/types';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Read environment variables (from Vite)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
}

// Create a single supabase instance with specific storage key
// Note: autoRefreshToken is true by default, but explicitly stated for clarity
export const supabase = createClient<Database>(
  supabaseUrl as string, 
  supabaseAnonKey as string, 
  {
    auth: {
      storageKey: 'dhg-supabase-auth',
      persistSession: true,
      autoRefreshToken: true
    }
  }
);

// For backwards compatibility
export const getSupabaseClient = () => supabase;