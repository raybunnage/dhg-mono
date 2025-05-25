import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-compatible Supabase client for dhg-hub
 * This adapter provides a browser-specific implementation
 * that uses VITE_ prefixed environment variables
 */
class SupabaseBrowserAdapter {
  private static instance: SupabaseBrowserAdapter;
  private client: SupabaseClient | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SupabaseBrowserAdapter {
    if (!SupabaseBrowserAdapter.instance) {
      SupabaseBrowserAdapter.instance = new SupabaseBrowserAdapter();
    }
    return SupabaseBrowserAdapter.instance;
  }

  /**
   * Get the Supabase client
   * This uses environment variables injected by Vite
   */
  public getClient(): SupabaseClient {
    if (!this.client) {
      try {
        // Using the environment variables that are already set in the project
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

        // Log the URL (but hide most of the key for security)
        console.log('Initializing Supabase with URL:', supabaseUrl);
        console.log('Using ANON key starting with:', 
          supabaseKey ? `${supabaseKey.substring(0, 10)}...` : 'undefined');

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase credentials not found. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are defined in your .env.development file.');
        }

        if (supabaseUrl.includes('your-supabase-url')) {
          throw new Error('Default placeholder Supabase URL detected. Please update your .env.development file with the real Supabase URL.');
        }

        if (supabaseKey.includes('your-anon-key-here')) {
          throw new Error('Default placeholder Supabase anon key detected. Please update your .env.development file with the real anon key.');
        }

        this.client = createClient(supabaseUrl, supabaseKey);
        console.log('Supabase client successfully created');
      } catch (error) {
        console.error('Failed to create Supabase client:', error);
        throw error;
      }
    }
    return this.client;
  }
}

// Export singleton instance
export const supabaseBrowser = SupabaseBrowserAdapter.getInstance();