import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client adapter that automatically detects the environment
 * and uses the correct configuration (browser vs server/CLI)
 * 
 * @returns A configured Supabase client
 */
export function createSupabaseAdapter(): SupabaseClient<any> {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';
  
  let supabaseUrl: string;
  let supabaseAnonKey: string;
  
  if (isBrowser) {
    // Browser environment - use Vite prefixed variables
    supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing required Vite environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    }
  } else {
    // Server/CLI environment - use standard variables
    supabaseUrl = process.env.SUPABASE_URL || '';
    supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_ANON_KEY');
    }
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
}