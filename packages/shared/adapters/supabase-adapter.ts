import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Options for creating a Supabase adapter
 */
export interface SupabaseAdapterOptions {
  /**
   * Use service role key instead of anon key
   * This provides admin access and bypasses RLS
   */
  useServiceRole?: boolean;
  
  /**
   * Custom auth configuration
   */
  authConfig?: {
    autoRefreshToken?: boolean;
    persistSession?: boolean;
    detectSessionInUrl?: boolean;
    storageKey?: string;
  };
}

/**
 * Creates a Supabase client adapter that automatically detects the environment
 * and uses the correct configuration (browser vs server/CLI)
 * 
 * @param options - Configuration options
 * @returns A configured Supabase client
 */
export function createSupabaseAdapter(options: SupabaseAdapterOptions = {}): SupabaseClient<any> {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';
  
  let supabaseUrl: string;
  let supabaseKey: string;
  
  if (isBrowser) {
    // Browser environment - use Vite prefixed variables
    // Use type assertion to handle import.meta in different environments
    const env = (import.meta as any)?.env || {};
    supabaseUrl = env.VITE_SUPABASE_URL;
    
    if (options.useServiceRole) {
      supabaseKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseKey) {
        throw new Error('Missing required Vite environment variable: VITE_SUPABASE_SERVICE_ROLE_KEY');
      }
    } else {
      supabaseKey = env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseKey) {
        throw new Error('Missing required Vite environment variable: VITE_SUPABASE_ANON_KEY');
      }
    }
    
    if (!supabaseUrl) {
      throw new Error('Missing required Vite environment variable: VITE_SUPABASE_URL');
    }
  } else {
    // Server/CLI environment - use standard variables
    supabaseUrl = process.env.SUPABASE_URL || '';
    
    if (options.useServiceRole) {
      supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (!supabaseKey) {
        throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
      }
    } else {
      supabaseKey = process.env.SUPABASE_ANON_KEY || '';
      if (!supabaseKey) {
        throw new Error('Missing required environment variable: SUPABASE_ANON_KEY');
      }
    }
    
    if (!supabaseUrl) {
      throw new Error('Missing required environment variable: SUPABASE_URL');
    }
  }
  
  // Default auth config based on key type
  const defaultAuthConfig = options.useServiceRole
    ? { autoRefreshToken: false, persistSession: false }
    : { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true };
  
  const authConfig = { ...defaultAuthConfig, ...options.authConfig };
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: authConfig
  });
}