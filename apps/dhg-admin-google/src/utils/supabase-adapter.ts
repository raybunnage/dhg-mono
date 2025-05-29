/**
 * React Supabase Adapter
 * 
 * A React-compatible adapter that uses the same interface as the backend
 * but is configured for browser environments.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
// Import Database type from the project root
// We're using a relative path to the types.ts file directly
// @ts-ignore - This import will work at runtime
import type { Database } from '../../../supabase/types';

/**
 * SupabaseClientAdapter - React version
 */
export class SupabaseClientAdapter {
  private static instance: SupabaseClientAdapter;
  private client: SupabaseClient<Database> | null = null;
  private supabaseUrl: string = '';
  private supabaseKey: string = '';
  
  private constructor() {
    // Browser Environment: Use Vite's import.meta.env
    this.supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    
    // IMPORTANT: For this particular page, we need service role access to filter_user_profiles table
    // Prioritize service role key for this application
    this.supabaseKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                       import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    
    console.log(`Supabase adapter (browser): URL found ${this.supabaseUrl ? this.supabaseUrl.substring(0, 20) + '...' : 'MISSING'}`);
    if (this.supabaseKey) {
      const maskedKey = this.supabaseKey.substring(0, 5) + '...' + this.supabaseKey.substring(this.supabaseKey.length - 5);
      console.log(`Supabase adapter (browser): Key found ${maskedKey}`);
      console.log(`Supabase adapter (browser): Using ${this.supabaseKey === import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE ROLE KEY' : 'ANON KEY'}`);
    } else {
      console.error('Supabase adapter (browser): No API key found');
    }
    
    // Validate environment variables
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.error('Missing Supabase environment variables');
      console.error('Check if .env.development has VITE_SUPABASE_URL and at least one of VITE_SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY');
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SupabaseClientAdapter {
    if (!SupabaseClientAdapter.instance) {
      SupabaseClientAdapter.instance = new SupabaseClientAdapter();
    }
    return SupabaseClientAdapter.instance;
  }

  /**
   * Get the Supabase client instance
   * Creates a client appropriate for the browser environment
   */
  public getClient(): SupabaseClient<Database> {
    if (!this.client) {
      // Browser: Include auth options for persistent sessions
      this.client = createClient<Database>(
        this.supabaseUrl,
        this.supabaseKey,
        {
          auth: {
            storageKey: 'dhg-supabase-auth',
            persistSession: true,
            autoRefreshToken: true
          },
          global: {
            headers: {
              'X-Client-Info': 'dhg-hub'
            }
          }
        }
      );
      console.log('Supabase adapter: Created client for browser environment');
    }

    return this.client;
  }

  /**
   * Test the connection to Supabase
   */
  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getClient();
      
      // Try a simple query to filter_user_profiles table
      const { data: profileData, error: profileError } = await client
        .from('filter_user_profiles')
        .select('id, name, is_active')
        .limit(10);
      
      if (profileError) {
        console.warn('Filter profiles test failed:', profileError);
        
        // Fall back to document_types table which should always be accessible
        console.log('Trying document_types table as fallback...');
        const { error } = await client
          .from('document_types')
          .select('document_type')
          .limit(1);
        
        if (error) {
          console.error('Connection test failed completely:', error);
          return { success: false, error: error.message };
        }
        
        console.log('Connection test partially successful (document_types only)');
        return { success: true, error: 'Cannot access filter_user_profiles table' };
      }
      
      // Log the filter profiles found
      if (profileData && profileData.length > 0) {
        console.log(`Found ${profileData.length} filter profiles:`, 
          profileData.map(p => `${p.name} (${p.id})`).join(', '));
      } else {
        console.log('No filter profiles found in the database');
      }
      
      console.log('Connection test successful with filter profiles access');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Connection test error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }
  
  /**
   * Get detailed diagnostic information about the environment and connection
   */
  public async getDiagnostics(): Promise<{
    hasUrl: boolean;
    hasKey: boolean;
    urlPreview: string;
    keyPreview: string;
    connectionTest: { success: boolean; error?: string };
  }> {
    const hasUrl = !!this.supabaseUrl;
    const hasKey = !!this.supabaseKey;
    const urlPreview = hasUrl ? `${this.supabaseUrl.substring(0, 20)}...` : 'missing';
    const keyPreview = hasKey 
      ? `${this.supabaseKey.substring(0, 5)}...${this.supabaseKey.substring(this.supabaseKey.length - 5)} (${this.supabaseKey.length} chars)` 
      : 'missing';
    
    // Test connection
    const connectionTest = await this.testConnection();
    
    return {
      hasUrl,
      hasKey,
      urlPreview,
      keyPreview,
      connectionTest
    };
  }
  
  /**
   * Ensure authentication for browser environment
   */
  public async ensureAuth(): Promise<{ success: boolean; diagnostics: string }> {
    // Collect diagnostic information for debugging
    let diagnostics = "";
    const addDiagnostic = (message: string) => {
      console.log(message);
      diagnostics += message + "\n";
    };
    
    // Debug environment variables (without revealing full keys)
    const keyPreview = (key: string | undefined) => {
      if (!key) return "missing";
      if (key.length < 10) return "invalid (too short)";
      return `${key.substring(0, 5)}...${key.substring(key.length - 5)} (${key.length} chars)`;
    };

    addDiagnostic(`Browser environment detected`);
    addDiagnostic(`VITE_SUPABASE_URL: ${this.supabaseUrl ? 'present' : 'missing'}`);
    addDiagnostic(`VITE_SUPABASE_ANON_KEY: ${keyPreview(import.meta.env.VITE_SUPABASE_ANON_KEY)}`);
    
    try {
      // Get the client
      const client = this.getClient();
      
      // Check if we're already authenticated
      const { data: sessionData } = await client.auth.getSession();
      if (sessionData.session) {
        addDiagnostic(`Already authenticated as: ${sessionData.session.user.email || 'Unknown user'}`);
        return { success: true, diagnostics };
      }
      
      // Try sign in with test user credentials if available
      if (import.meta.env.VITE_TEST_USER_EMAIL && import.meta.env.VITE_TEST_USER_PASSWORD) {
        addDiagnostic(`Attempting to sign in with test user: ${import.meta.env.VITE_TEST_USER_EMAIL}`);
        
        const { data, error } = await client.auth.signInWithPassword({
          email: import.meta.env.VITE_TEST_USER_EMAIL,
          password: import.meta.env.VITE_TEST_USER_PASSWORD
        });
        
        if (error) {
          addDiagnostic(`Authentication failed: ${error.message}`);
          return { success: false, diagnostics };
        }
        
        if (data.user) {
          addDiagnostic(`Successfully authenticated as: ${data.user.email}`);
          return { success: true, diagnostics };
        }
      } else {
        addDiagnostic(`No test user credentials available - will use anonymous access`);
      }
      
      // Test database access with the current credentials (anonymous or authenticated)
      const { error } = await client
        .from('document_types')
        .select('id')
        .limit(1);
      
      if (error) {
        addDiagnostic(`Database access failed: ${error.message}`);
        return { success: false, diagnostics };
      }
      
      addDiagnostic(`Database access successful`);
      return { success: true, diagnostics };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addDiagnostic(`Authentication error: ${errorMessage}`);
      return { success: false, diagnostics };
    }
  }
}

// Export singleton instance
export const supabaseAdapter = SupabaseClientAdapter.getInstance();

// Export convenience method to get client
export const getSupabaseClient = () => supabaseAdapter.getClient();

// Export the client directly for ease of use
export const supabase = getSupabaseClient();

// Re-export helper functions from shared service
export { SYSTEM_USER_ID, addUserReferences } from '../../../../packages/shared/services/supabase-helpers';