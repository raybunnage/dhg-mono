import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Shared Supabase client service that provides a consistent interface
 * for creating and accessing Supabase clients throughout the codebase.
 * 
 * This helps avoid TypeScript errors when passing Supabase clients
 * between different parts of the codebase that might import from
 * different instances of @supabase/supabase-js.
 */
export class SupabaseClientService {
  private static instance: SupabaseClientService;
  private client: SupabaseClient | null = null;
  private url: string | null = null;
  private key: string | null = null;
  
  private constructor() {
    // Private constructor to enforce singleton pattern
  }
  
  /**
   * Get the singleton instance of the service
   */
  public static getInstance(): SupabaseClientService {
    if (!SupabaseClientService.instance) {
      SupabaseClientService.instance = new SupabaseClientService();
    }
    return SupabaseClientService.instance;
  }
  
  /**
   * Initialize the Supabase client
   * @param url The Supabase URL
   * @param key The Supabase API key
   * @returns The initialized client
   */
  public initialize(url: string, key: string): SupabaseClient {
    this.url = url;
    this.key = key;
    this.client = createClient(url, key);
    return this.client;
  }
  
  /**
   * Get the current Supabase client instance
   * @param forceInit Whether to force initialization from environment variables if not already initialized
   * @returns The Supabase client
   */
  public getClient(forceInit: boolean = true): SupabaseClient {
    if (!this.client && forceInit) {
      // Try to initialize from environment variables
      const url = process.env.SUPABASE_URL || process.env.CLI_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 
                  process.env.CLI_SUPABASE_SERVICE_ROLE_KEY || process.env.CLI_SUPABASE_SERVICE_KEY;
      
      if (!url || !key) {
        throw new Error('Missing Supabase credentials in environment variables');
      }
      
      return this.initialize(url, key);
    }
    
    if (!this.client) {
      throw new Error('Supabase client not initialized. Call initialize() first or set forceInit to true.');
    }
    
    return this.client;
  }
  
  /**
   * Check if the client is initialized
   */
  public isInitialized(): boolean {
    return !!this.client;
  }
  
  /**
   * Get the current Supabase URL
   */
  public getUrl(): string | null {
    return this.url;
  }
  
  /**
   * Read and parse environment variables from a .env file
   * @param filePath Path to the environment file
   * @returns Object containing environment variables
   */
  public static readEnvFile(filePath: string): {exists: boolean, variables: Record<string, string | null>} {
    try {
      if (fs.existsSync(filePath)) {
        console.debug(`Reading ${filePath}...`);
        const content = fs.readFileSync(filePath, 'utf8');
        const envVars: Record<string, string | null> = {};
        
        content.split('\n').forEach(line => {
          // Skip comments and empty lines
          if (line.trim() && !line.trim().startsWith('#')) {
            const [key, ...valueParts] = line.split('=');
            const value = valueParts.join('='); // Rejoin in case value contains =
            
            if (key) {
              envVars[key.trim()] = value ? value.trim() : null;
            }
          }
        });
        
        return { exists: true, variables: envVars };
      } else {
        return { exists: false, variables: {} };
      }
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error);
      return { exists: false, variables: {} };
    }
  }
  
  /**
   * Initialize from environment variables, trying multiple env var names
   * @returns The initialized client or null if required environment variables are missing
   */
  public initializeFromEnv(): SupabaseClient | null {
    // Try to load from environment
    const url = process.env.SUPABASE_URL || process.env.CLI_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 
                process.env.CLI_SUPABASE_SERVICE_ROLE_KEY || process.env.CLI_SUPABASE_SERVICE_KEY;
    
    if (!url || !key) {
      console.error('Missing Supabase credentials in environment variables');
      return null;
    }
    
    return this.initialize(url, key);
  }
  
  /**
   * Test the connection to Supabase
   * @returns Object containing connection status and error details if any
   */
  public async testConnection(): Promise<{success: boolean, error?: string, details?: any}> {
    try {
      if (!this.client) {
        return { success: false, error: 'Client not initialized' };
      }
      
      // Try to access a common table
      const { error } = await this.client
        .from('documentation_files')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        // Try another table as a fallback
        const { error: error2 } = await this.client
          .from('document_types')
          .select('count', { count: 'exact', head: true });
        
        if (error2) {
          return { 
            success: false, 
            error: 'Connection test failed for both tables', 
            details: { 
              firstError: error.message, 
              secondError: error2.message 
            } 
          };
        }
      }
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'Unexpected error during connection test',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Convenience function to get the singleton instance
export function getSupabaseClient(forceInit: boolean = true): SupabaseClient {
  return SupabaseClientService.getInstance().getClient(forceInit);
}

// Export the SupabaseClient type for convenience
export { SupabaseClient };