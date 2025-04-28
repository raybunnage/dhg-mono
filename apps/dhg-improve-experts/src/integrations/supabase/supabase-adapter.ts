/**
 * Supabase Adapter
 * 
 * This adapter provides a bridge between the shared backend SupabaseClientService
 * and the frontend environment. It adapts the backend service to work in a browser context.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/types';

/**
 * Frontend-compatible implementation of the SupabaseClientService
 * This class mimics the API of the backend service while working in a browser environment
 */
export class SupabaseClientService {
  private static instance: SupabaseClientService;
  private client: SupabaseClient<Database> | null = null;
  private supabaseUrl: string;
  private supabaseKey: string;

  private constructor() {
    // Read environment variables with Vite's import.meta.env
    this.supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    this.supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                      import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

    // Validate environment variables
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.error('Missing Supabase environment variables. Please check your .env file.');
      console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_SERVICE_ROLE_KEY');
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
    }

    return this.client;
  }

  /**
   * Test the connection to Supabase - mimics the backend API
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
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }
}

// Export singleton instance reference - matching the backend pattern
export default SupabaseClientService;