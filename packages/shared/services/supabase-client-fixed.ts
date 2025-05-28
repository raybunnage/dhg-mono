/**
 * Enhanced Supabase Client Service
 * 
 * This is an improved version of the Supabase client service with better
 * error handling and debugging capabilities.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Singleton class to manage Supabase client instance with enhanced debugging
 */
export class SupabaseClientServiceFixed {
  private static instance: SupabaseClientServiceFixed;
  private client: SupabaseClient | null = null;
  private debugMode: boolean = false;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SupabaseClientServiceFixed {
    if (!SupabaseClientServiceFixed.instance) {
      SupabaseClientServiceFixed.instance = new SupabaseClientServiceFixed();
    }
    return SupabaseClientServiceFixed.instance;
  }

  /**
   * Enable debug mode for more verbose logging
   */
  public enableDebug(enabled: boolean = true): void {
    this.debugMode = enabled;
    console.log(`Supabase Client Service debug mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Manually load environment variables
   * This is a fallback if the config doesn't have Supabase credentials
   */
  private loadEnvironmentVariables(): { supabaseUrl: string, supabaseKey: string } {
    // Try to load environment variables from various files
    const envFiles = ['.env', '.env.local', '.env.development'];
    
    for (const file of envFiles) {
      const filePath = path.resolve(process.cwd(), file);
      
      if (fs.existsSync(filePath)) {
        if (this.debugMode) {
          console.log(`SupabaseClientService: Loading environment variables from ${filePath}`);
        }
        
        // Read the file directly
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          dotenv.config({ path: filePath });
        } catch (err) {
          console.error('Error reading env file:', err);
        }
      }
    }
    
    // Check for environment variables
    const supabaseUrl = process.env.SUPABASE_URL || '';
    
    // Try SERVICE_ROLE_KEY first, then fall back to ANON_KEY
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                         process.env.SUPABASE_ANON_KEY || 
                         process.env.SUPABASE_KEY || '';
                         
    if (this.debugMode) {
      console.log(`SupabaseClientService found URL: ${supabaseUrl ? supabaseUrl.substring(0, 15) + '...' : 'none'}`);
      if (supabaseKey) {
        console.log(`SupabaseClientService found key: ${supabaseKey.substring(0, 5)}...${supabaseKey.substring(supabaseKey.length - 5)}`);
      } else {
        console.log('SupabaseClientService found no valid key');
      }
    }
    
    return { supabaseUrl, supabaseKey };
  }
  
  /**
   * Get the Supabase client instance
   */
  public getClient(): SupabaseClient {
    if (!this.client) {
      const { supabaseUrl, supabaseKey } = this.loadEnvironmentVariables();
      
      // Fail if no credentials are found
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Unable to find Supabase credentials in environment variables. Please make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are defined in your .env file.');
      }
      
      console.log(`Creating Supabase client with URL: ${supabaseUrl.substring(0, 15)}...`);
      
      try {
        // Create client with debugging options
        this.client = createClient(supabaseUrl, supabaseKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          }
        });
        
        // Test the connection immediately to verify credentials
        if (this.debugMode) {
          this.testConnection()
            .then(result => {
              if (result.success) {
                console.log('✅ Supabase connection test successful');
              } else {
                console.error(`❌ Supabase connection test failed: ${result.error}`);
              }
            })
            .catch(error => {
              console.error('Error testing Supabase connection:', error);
            });
        }
      } catch (error) {
        console.error('Error creating Supabase client:', error);
        throw error;
      }
    }

    return this.client;
  }

  /**
   * Test the connection to Supabase
   */
  public async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      if (!this.client) {
        this.getClient(); // Initialize client if not already done
      }
      
      // Try simple queries to verify connection to different tables
      try {
        const { data, error } = await this.client!
          .from('google_sources')
          .select('count(*)', { count: 'exact', head: true });
        
        if (error) {
          return { 
            success: false, 
            error: `Error querying sources_google: ${error.message}`,
            details: error
          };
        }
        
        console.log('Successfully connected to sources_google table');
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: `Error connecting to Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: error
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Error initializing Supabase client: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      };
    }
  }
  
  /**
   * Reset the client - useful for testing or when credentials change
   */
  public resetClient(): void {
    this.client = null;
    console.log('Supabase client has been reset');
  }
}

// Export singleton instance
export const supabaseClientFixed = SupabaseClientServiceFixed.getInstance();