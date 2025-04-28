/**
 * Adapter for the shared SupabaseClientService that works in a browser environment
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../supabase/types';

/**
 * This class mimics the backend SupabaseClientService API but works in a browser environment
 */
export class SupabaseClientService {
  private static instance: SupabaseClientService;
  private client: SupabaseClient<Database> | null = null;
  private supabaseUrl: string;
  private supabaseKey: string;

  private constructor() {
    this.supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    this.supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                       import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

    // Validate environment variables
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.error('Missing Supabase environment variables in frontend.');
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
   * Test the connection to Supabase - matches the backend API
   */
  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getClient();
      
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