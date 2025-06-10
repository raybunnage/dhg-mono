import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton storage for browser environments to prevent multiple instances
const browserInstances = new Map<string, SupabaseClient>();

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
  
  /**
   * Environment variables to use (for browser environments)
   * If not provided, will try to read from process.env in Node.js
   */
  env?: {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
    VITE_SUPABASE_SERVICE_ROLE_KEY?: string;
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
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
    // Browser environment - use provided env or throw error
    if (!options.env) {
      throw new Error('Environment variables must be provided for browser usage. Pass import.meta.env to the adapter.');
    }
    
    supabaseUrl = options.env.VITE_SUPABASE_URL || options.env.SUPABASE_URL || '';
    
    if (options.useServiceRole) {
      supabaseKey = options.env.VITE_SUPABASE_SERVICE_ROLE_KEY || options.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (!supabaseKey) {
        throw new Error('Missing required environment variable: VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY');
      }
    } else {
      supabaseKey = options.env.VITE_SUPABASE_ANON_KEY || options.env.SUPABASE_ANON_KEY || '';
      if (!supabaseKey) {
        throw new Error('Missing required environment variable: VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
      }
    }
    
    if (!supabaseUrl) {
      throw new Error('Missing required environment variable: VITE_SUPABASE_URL or SUPABASE_URL');
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
  
  // In browser environments, use singleton pattern to prevent multiple instances
  if (isBrowser) {
    const instanceKey = `${supabaseUrl}-${supabaseKey.substring(0, 10)}-${options.useServiceRole ? 'service' : 'anon'}`;
    
    if (!browserInstances.has(instanceKey)) {
      const client = createClient(supabaseUrl, supabaseKey, {
        auth: authConfig
      });
      browserInstances.set(instanceKey, client);
    }
    
    return browserInstances.get(instanceKey)!;
  }
  
  // In Node.js/CLI environments, create new instances as needed
  return createClient(supabaseUrl, supabaseKey, {
    auth: authConfig
  });
}