/**
 * Universal Supabase Client Adapter
 * This implementation works in both browser and Node.js environments
 * It supports the same methods as the backend service while providing
 * environment-specific implementations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/types';

/**
 * SupabaseClientService that works in both frontend and backend environments
 */
export class SupabaseClientService {
  private static instance: SupabaseClientService;
  private client: SupabaseClient<Database> | null = null;
  private supabaseUrl: string;
  private supabaseKey: string;
  private isBrowser: boolean;
  
  private constructor() {
    // Detect environment
    this.isBrowser = typeof window !== 'undefined';
    
    if (this.isBrowser) {
      // Browser Environment: Use Vite's import.meta.env
      this.supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      this.supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                         import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
      
      console.log(`Supabase adapter (browser): URL found ${this.supabaseUrl.substring(0, 20)}...`);
      console.log(`Supabase adapter (browser): Key found ${this.supabaseKey.substring(0, 5)}...${this.supabaseKey.substring(this.supabaseKey.length - 5)}`);
    } else {
      // Node.js Environment: Use process.env
      this.supabaseUrl = process.env.SUPABASE_URL || '';
      this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
      
      console.log(`Supabase adapter (Node.js): URL found ${this.supabaseUrl.substring(0, 20)}...`);
      console.log(`Supabase adapter (Node.js): Key found ${this.supabaseKey.substring(0, 5)}...${this.supabaseKey.substring(this.supabaseKey.length - 5)}`);
    }
    
    // Validate environment variables
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.error('Missing Supabase environment variables. Please check your .env or .env.development file.');
      console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY (or their VITE_ equivalents in browser)');
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SupabaseClientService {
    if (!SupabaseClientService.instance) {
      SupabaseClientService.instance = new SupabaseClientService();
    }
    return SupabaseClientService.instance;
  }

  /**
   * Get the Supabase client instance
   * Creates a client appropriate for the current environment
   */
  public getClient(): SupabaseClient<Database> {
    if (!this.client) {
      if (this.isBrowser) {
        // Browser: Include auth options for persistent sessions
        this.client = createClient<Database>(
          this.supabaseUrl,
          this.supabaseKey,
          {
            auth: {
              storageKey: 'dhg-supabase-auth',
              persistSession: true,
              autoRefreshToken: true
            }
          }
        );
        console.log('Supabase adapter: Created client for browser environment');
      } else {
        // Node.js: Simple client without browser-specific auth options
        this.client = createClient<Database>(
          this.supabaseUrl,
          this.supabaseKey
        );
        console.log('Supabase adapter: Created client for Node.js environment');
      }
    }

    return this.client;
  }

  /**
   * Test the connection to Supabase
   */
  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getClient();
      
      // Try a simple query to document_types table
      const { data, error } = await client
        .from('document_types')
        .select('document_type')
        .limit(1);
      
      if (error) {
        console.error('Connection test failed:', error);
        return { success: false, error: error.message };
      }
      
      console.log('Connection test successful');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Connection test error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }
  
  /**
   * Ensure user is authenticated (browser-only)
   * In Node.js environments, this always returns true as service role key is used
   */
  public async ensureAuth(): Promise<boolean> {
    // For backend (Node.js), we're always "authenticated" via service role key
    if (!this.isBrowser) {
      return true;
    }
    
    // For frontend (browser), we need to handle actual authentication
    try {
      const client = this.getClient();
      
      // Check if already authenticated
      const { data: { session } } = await client.auth.getSession();
      if (session) {
        console.log('Already authenticated as:', session.user.email);
        return true;
      }

      // No authentication yet, try to log in with test credentials
      console.log('Not authenticated yet, attempting sign-in with test credentials');
      
      try {
        const email = import.meta.env.VITE_TEST_USER_EMAIL;
        const password = import.meta.env.VITE_TEST_USER_PASSWORD;
        
        if (!email || !password) {
          console.error('Missing test credentials. Set VITE_TEST_USER_EMAIL and VITE_TEST_USER_PASSWORD in .env');
          return false;
        }
        
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error('Authentication error:', error);
          return false;
        }

        console.log('Successfully authenticated as:', data.user?.email);
        return true;
      } catch (e) {
        console.error('Error during authentication:', e);
        return false;
      }
    } catch (error) {
      console.error('Auth error:', error);
      return false;
    }
  }
  
  // Additional methods from the original SupabaseClientService can be added here
}