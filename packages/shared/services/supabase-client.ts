import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../utils';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

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
   * Manually load environment variables
   * This is a fallback if the config doesn't have Supabase credentials
   */
  private loadEnvironmentVariables(): { supabaseUrl: string, supabaseKey: string } {
    // Try to load environment variables from various files
    const envFiles = ['.env', '.env.local', '.env.development'];
    
    for (const file of envFiles) {
      const filePath = path.resolve(process.cwd(), file);
      
      if (fs.existsSync(filePath)) {
        console.log(`SupabaseClientService: Loading environment variables from ${filePath}`);
        
        // Read the file directly to debug
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const envLines = content.split('\n');
          for (const line of envLines) {
            if (line.includes('SUPABASE_URL') || line.includes('SUPABASE_SERVICE_ROLE_KEY')) {
              console.log('Found key in env file:', line.split('=')[0]);
            }
          }
        } catch (err) {
          console.error('Error reading env file:', err);
        }
        
        const result = dotenv.config({ path: filePath });
        
        if (result.error) {
          console.error(`Error loading ${filePath}:`, result.error);
        }
      }
    }
    
    // Check all possible environment variable names
    const supabaseUrl = 
      process.env.SUPABASE_URL || 
      process.env.VITE_SUPABASE_URL || 
      process.env.NEXT_PUBLIC_SUPABASE_URL || 
      '';
      
    const supabaseKey = 
      process.env.SUPABASE_SERVICE_ROLE_KEY || 
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || 
      process.env.SUPABASE_ANON_KEY || 
      process.env.VITE_SUPABASE_ANON_KEY || 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
      '';
      
    return { supabaseUrl, supabaseKey };
  }
  
  /**
   * Get the Supabase client instance
   */
  public getClient(): SupabaseClient {
    if (!this.client) {
      let supabaseUrl = config.supabaseUrl;
      let supabaseKey = config.supabaseKey;
      
      // If config doesn't have the values, try to load them directly
      if (!supabaseUrl || !supabaseKey) {
        console.log('Supabase credentials not found in config, trying environment variables directly');
        const envVars = this.loadEnvironmentVariables();
        supabaseUrl = envVars.supabaseUrl;
        supabaseKey = envVars.supabaseKey;
      }
      
      // For debugging
      console.log('Current process.env after loading:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
      
      // Hardcoded values as a last resort (just for debugging)
      if (!supabaseUrl || !supabaseKey) {
        console.log('Using hardcoded values from .env.development as a last resort');
        supabaseUrl = 'https://jdksnfkupzywjdfefkyj.supabase.co';
        supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impka3NuZmt1cHp5d2pkZmVma3lqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDE4OTAxMywiZXhwIjoyMDQ5NzY1MDEzfQ.ytwo7scGIQRoyue71Bu6W6P6vgSnLP3S3iaL6BoRP_E';
      }
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase URL or key. Please check your environment variables.');
      }
      
      console.log(`Creating Supabase client with URL: ${supabaseUrl.substring(0, 20)}...`);
      
      // Create with more debugging options
      this.client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          fetch: (url, options) => {
            console.log(`Supabase request to: ${url}`);
            return fetch(url, options);
          }
        }
      });
    }

    return this.client;
  }

  /**
   * Test the connection to Supabase
   */
  public async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      const client = this.getClient();
      
      // Try simple queries to verify connection to different tables
      // Try scripts table first
      try {
        const { data, error } = await client
          .from('scripts')
          .select('count(*)', { count: 'exact', head: true });
        
        if (!error) {
          console.log('Successfully connected to scripts table');
          return { success: true };
        }
      } catch (e) {
        console.log('Failed to query scripts table, trying sources_google table');
      }
      
      // Try sources_google table
      try {
        const { data, error } = await client
          .from('sources_google')
          .select('count(*)', { count: 'exact', head: true });
        
        if (!error) {
          console.log('Successfully connected to sources_google table');
          return { success: true };
        }
      } catch (e) {
        console.log('Failed to query sources_google table, trying documentation_files table');
      }
      
      // Try documentation_files table
      try {
        const { data, error } = await client
          .from('documentation_files')
          .select('count(*)', { count: 'exact', head: true });
        
        if (!error) {
          console.log('Successfully connected to documentation_files table');
          return { success: true };
        }
      } catch (e) {
        console.log('Failed to query documentation_files table');
      }
      
      // If we get here, all table queries failed, but the client might still be valid
      // Try a raw query to check the connection
      try {
        const { data, error } = await client.rpc('get_schema_version');
        
        if (!error) {
          console.log('Successfully connected to Supabase using RPC');
          return { success: true };
        }
      } catch (e) {
        console.log('Failed to connect using RPC');
      }
      
      return { success: false, error: 'Failed to connect to any known table' };
    } catch (error) {
      console.error('Error connecting to Supabase:', error);
      return { success: false, error: 'Error connecting to Supabase', details: error };
    }
  }
}