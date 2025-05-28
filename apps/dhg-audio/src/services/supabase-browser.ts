/**
 * Supabase Browser Client for dhg-audio
 * 
 * A browser-specific Supabase client that properly handles Vite environment variables
 * This bypasses the shared service complexity and provides direct access to Supabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/types';

class SupabaseBrowserClient {
  private static instance: SupabaseBrowserClient;
  private client: SupabaseClient<Database> | null = null;
  
  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): SupabaseBrowserClient {
    if (!SupabaseBrowserClient.instance) {
      SupabaseBrowserClient.instance = new SupabaseBrowserClient();
    }
    return SupabaseBrowserClient.instance;
  }

  public getClient(): SupabaseClient<Database> {
    if (!this.client) {
      // Get environment variables directly from Vite
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      // Use service role key for RLS bypass (following dhg-hub pattern)
      const supabaseKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const isServiceKey = supabaseKey === import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      console.log('[SupabaseBrowserClient] Initializing with:', {
        url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING',
        key: supabaseKey ? `${supabaseKey.substring(0, 10)}...` : 'MISSING',
        keyType: isServiceKey ? 'SERVICE_ROLE' : 'ANON'
      });

      if (!supabaseUrl || !supabaseKey) {
        throw new Error(
          'Missing Supabase environment variables. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY) are set in .env.development'
        );
      }

      this.client = createClient<Database>(supabaseUrl, supabaseKey, {
        auth: {
          storageKey: 'dhg-audio-auth',
          persistSession: true,
          autoRefreshToken: false
        }
      });

      console.log('[SupabaseBrowserClient] Client created successfully');
    }

    return this.client;
  }

  /**
   * Test the connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const client = this.getClient();
      const { error } = await client.from('auth_allowed_emails').select('id').limit(1);
      
      if (error) {
        console.error('[SupabaseBrowserClient] Connection test failed:', error);
        return false;
      }
      
      console.log('[SupabaseBrowserClient] Connection test successful');
      return true;
    } catch (error) {
      console.error('[SupabaseBrowserClient] Connection test error:', error);
      return false;
    }
  }
}

// Export singleton instance and convenience methods
export const supabaseBrowserClient = SupabaseBrowserClient.getInstance();
export const getSupabase = () => supabaseBrowserClient.getClient();
export const supabase = supabaseBrowserClient.getClient();