/**
 * Supabase Browser Client for dhg-audio
 * 
 * A browser-specific Supabase client that uses the universal adapter
 * This provides proper singleton pattern with environment auto-detection
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdapter } from '../../../../packages/shared/adapters/supabase-adapter';
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
      // Check if service role key is available
      const hasServiceKey = !!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      
      console.log('[SupabaseBrowserClient] Initializing with universal adapter', {
        useServiceRole: hasServiceKey
      });

      // Use universal adapter with appropriate configuration
      this.client = createSupabaseAdapter({
        useServiceRole: hasServiceKey,
        authConfig: {
          storageKey: 'dhg-audio-auth',
          persistSession: true,
          autoRefreshToken: !hasServiceKey // Only auto-refresh for anon key
        }
      }) as SupabaseClient<Database>;

      console.log('[SupabaseBrowserClient] Client created successfully using universal adapter');
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