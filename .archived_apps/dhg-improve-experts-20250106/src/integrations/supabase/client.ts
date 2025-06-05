/**
 * Supabase Client Service
 * 
 * Frontend-compatible singleton implementation of the SupabaseClientService
 * Uses the same singleton pattern as the backend service but configured for frontend use
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/types';

/**
 * Singleton class to manage Supabase client instance
 */
export class SupabaseClientService {
  private static instance: SupabaseClientService;
  private client: SupabaseClient<Database> | null = null;
  private supabaseUrl: string;
  private supabaseKey: string;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Read environment variables with fallbacks to support both frontend (VITE_) and backend naming
    this.supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
                      (typeof process !== 'undefined' && process.env ? process.env.SUPABASE_URL : null);
    
    // Try both ANON_KEY and SERVICE_ROLE_KEY as fallbacks
    this.supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                      import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
                      (typeof process !== 'undefined' && process.env ? 
                        (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) : null);

    // Validate environment variables
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.error('Missing Supabase environment variables. Please check your .env or .env.development file.');
      console.error('Required: VITE_SUPABASE_URL/SUPABASE_URL and VITE_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY or their SERVICE_ROLE equivalents');
    } else {
      console.log(`Supabase URL found: ${this.supabaseUrl.substring(0, 20)}...`);
      console.log(`Supabase key found: ${this.supabaseKey.substring(0, 5)}...${this.supabaseKey.substring(this.supabaseKey.length - 5)}`);
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
   */
  public getClient(): SupabaseClient<Database> {
    if (!this.client) {
      // Create client with specific options for frontend
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

      console.log('Supabase client created for frontend');
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
   * Ensure user is authenticated
   */
  public async ensureAuth(): Promise<boolean> {
    try {
      const client = this.getClient();
      
      // Check if already authenticated
      const { data: { session } } = await client.auth.getSession();
      if (session) {
        console.log('Already authenticated as:', session.user.email);
        return true;
      }

      // Try to log in with test user credentials
      const { data, error } = await client.auth.signInWithPassword({
        email: import.meta.env.VITE_TEST_USER_EMAIL,
        password: import.meta.env.VITE_TEST_USER_PASSWORD,
      });

      if (error) {
        console.error('Auth error:', error);
        return false;
      }

      console.log('Successfully authenticated as:', data.user?.email);
      return true;
    } catch (error) {
      console.error('Auth error:', error);
      return false;
    }
  }
}

// Export singleton instance getter
export const getSupabaseService = () => SupabaseClientService.getInstance();

// For compatibility with existing code
export const getSupabaseClient = () => SupabaseClientService.getInstance().getClient();

// Export a ready-to-use client as supabase for direct usage
export const supabase = getSupabaseClient();

// System user ID used across the codebase and database functions
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// Helper function to add user references to records
export async function addUserReferences<T extends Record<string, any>>(recordWithUser: T): Promise<T> {
  try {
    // Try to get the current user session
    const { data } = await supabase.auth.getSession();
    const userId = data?.session?.user?.id || SYSTEM_USER_ID;
    
    // Add user reference fields if they don't exist
    if (!recordWithUser.created_by) {
      recordWithUser.created_by = userId;
    }
    
    if (!recordWithUser.updated_by) {
      recordWithUser.updated_by = userId;
    }
    
    return recordWithUser;
  } catch (error) {
    // If there's any error, fall back to the system user ID
    if (!recordWithUser.created_by) {
      recordWithUser.created_by = SYSTEM_USER_ID;
    }
    
    if (!recordWithUser.updated_by) {
      recordWithUser.updated_by = SYSTEM_USER_ID;
    }
    
    return recordWithUser;
  }
}

// Initialize authentication on load
export async function initializeSupabase() {
  const supabaseService = SupabaseClientService.getInstance();
  return await supabaseService.ensureAuth();
}