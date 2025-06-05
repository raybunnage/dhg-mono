import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdapter } from '../../../../packages/shared/adapters/supabase-adapter';

/**
 * Browser-compatible Supabase client for dhg-hub
 * This adapter provides a browser-specific implementation
 * that uses the universal adapter with singleton pattern
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
   * This uses the universal adapter which automatically handles environment detection
   */
  public getClient(): SupabaseClient {
    if (!this.client) {
      try {
        console.log('Initializing Supabase with universal adapter...');
        
        this.client = createSupabaseAdapter();
        console.log('Supabase client successfully created using universal adapter');
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