import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../utils';

/**
 * Singleton class to manage Supabase client instance
 */
export class SupabaseClientService {
  private static instance: SupabaseClientService;
  private client: SupabaseClient | null = null;

  private constructor() {
    // Private constructor to enforce singleton pattern
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
  public getClient(): SupabaseClient {
    if (!this.client) {
      if (!config.supabaseUrl || !config.supabaseKey) {
        throw new Error('Missing Supabase URL or key. Please check your environment variables.');
      }

      this.client = createClient(config.supabaseUrl, config.supabaseKey);
    }

    return this.client;
  }

  /**
   * Test the connection to Supabase
   */
  public async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      const client = this.getClient();
      
      // Try a simple query to verify connection
      const { data, error } = await client
        .from('scripts')
        .select('count(*)', { count: 'exact', head: true });
      
      if (error) {
        return { success: false, error: 'Failed to connect to scripts table', details: error };
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Error connecting to Supabase', details: error };
    }
  }
}