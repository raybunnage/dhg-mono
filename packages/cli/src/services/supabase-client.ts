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
      let url = process.env.SUPABASE_URL || process.env.CLI_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      let key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 
                process.env.CLI_SUPABASE_KEY || process.env.CLI_SUPABASE_SERVICE_ROLE_KEY ||
                process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      
      if (!url || !key) {
        // Attempt to load from .env files directly
        console.log('Attempting to load Supabase credentials from .env files...');
        
        // Try several possible locations for .env files
        const possiblePaths = [
          path.join(process.cwd(), '.env.local'),
          path.join(process.cwd(), '.env.development'),
          path.join(process.cwd(), '.env'),
          path.join(process.cwd(), '..', '.env.development'),
          path.join(process.cwd(), '..', '.env'),
          '/Users/raybunnage/Documents/github/dhg-mono/.env.development',
          '/Users/raybunnage/Documents/github/dhg-mono/.env'
        ];
        
        for (const filePath of possiblePaths) {
          if (fs.existsSync(filePath)) {
            console.log(`Loading from ${filePath}`);
            const { exists, variables } = SupabaseClientService.readEnvFile(filePath);
            if (exists) {
              // Try all possible variable names
              url = url || variables['SUPABASE_URL'] || variables['CLI_SUPABASE_URL'] || 
                          variables['VITE_SUPABASE_URL'];
              key = key || variables['SUPABASE_SERVICE_ROLE_KEY'] || variables['SUPABASE_KEY'] || 
                          variables['CLI_SUPABASE_KEY'] || variables['CLI_SUPABASE_SERVICE_ROLE_KEY'] ||
                          variables['VITE_SUPABASE_SERVICE_ROLE_KEY'];
              
              if (url && key) {
                console.log(`Found credentials in ${filePath}`);
                break;
              }
            }
          }
        }
      }
      
      // Hard-coded fallback if all else fails
      if (!url) {
        url = "https://jdksnfkupzywjdfefkyj.supabase.co";
        console.log("Using hardcoded fallback for Supabase URL");
      }
      
      if (!key) {
        key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impka3NuZmt1cHp5d2pkZmVma3lqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDE4OTAxMywiZXhwIjoyMDQ5NzY1MDEzfQ.ytwo7scGIQRoyue71Bu6W6P6vgSnLP3S3iaL6BoRP_E";
        console.log("Using hardcoded fallback for Supabase key");
      }
      
      if (!url || !key) {
        throw new Error('Missing Supabase credentials in environment variables and fallbacks');
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
    let url = process.env.SUPABASE_URL || process.env.CLI_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    let key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 
              process.env.CLI_SUPABASE_KEY || process.env.CLI_SUPABASE_SERVICE_ROLE_KEY ||
              process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      // Attempt to load from .env files directly
      console.log('Attempting to load Supabase credentials from .env files...');
      
      // Try several possible locations for .env files
      const possiblePaths = [
        path.join(process.cwd(), '.env.local'),
        path.join(process.cwd(), '.env.development'),
        path.join(process.cwd(), '.env'),
        path.join(process.cwd(), '..', '.env.development'),
        path.join(process.cwd(), '..', '.env'),
        '/Users/raybunnage/Documents/github/dhg-mono/.env.development',
        '/Users/raybunnage/Documents/github/dhg-mono/.env'
      ];
      
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          console.log(`Loading from ${filePath}`);
          const { exists, variables } = SupabaseClientService.readEnvFile(filePath);
          if (exists) {
            // Try all possible variable names
            url = url || variables['SUPABASE_URL'] || variables['CLI_SUPABASE_URL'] || 
                        variables['VITE_SUPABASE_URL'];
            key = key || variables['SUPABASE_SERVICE_ROLE_KEY'] || variables['SUPABASE_KEY'] || 
                        variables['CLI_SUPABASE_KEY'] || variables['CLI_SUPABASE_SERVICE_ROLE_KEY'] ||
                        variables['VITE_SUPABASE_SERVICE_ROLE_KEY'];
            
            if (url && key) {
              console.log(`Found credentials in ${filePath}`);
              break;
            }
          }
        }
      }
    }
    
    // Hard-coded fallback if all else fails
    if (!url) {
      url = "https://jdksnfkupzywjdfefkyj.supabase.co";
      console.log("Using hardcoded fallback for Supabase URL");
    }
    
    if (!key) {
      key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impka3NuZmt1cHp5d2pkZmVma3lqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDE4OTAxMywiZXhwIjoyMDQ5NzY1MDEzfQ.ytwo7scGIQRoyue71Bu6W6P6vgSnLP3S3iaL6BoRP_E";
      console.log("Using hardcoded fallback for Supabase key");
    }
    
    if (!url || !key) {
      console.error('Missing Supabase credentials in environment variables and fallbacks');
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
      
      console.log('Testing connection with URL:', this.url);
      console.log('API Key length:', this.key ? this.key.length : 0);
      
      // Simple connection test using REST API
      const { data: projectData, error: projectError } = await this.client.rpc('get_project_info');
      if (projectError) {
        console.error('Error getting project info:', projectError);
      } else {
        console.log('Project info:', projectData);
      }
      
      // Try to access a common table
      console.log('Testing access to documentation_files table...');
      const { error, status, statusText } = await this.client
        .from('documentation_files')
        .select('count', { count: 'exact', head: true });
      
      console.log('Status:', status, statusText);
      
      if (error) {
        console.error('Error accessing documentation_files:', error);
        
        // Try another table as a fallback
        console.log('Testing access to document_types table...');
        const { error: error2, status: status2, statusText: statusText2 } = await this.client
          .from('document_types')
          .select('count', { count: 'exact', head: true });
        
        console.log('Status 2:', status2, statusText2);
        
        if (error2) {
          console.error('Error accessing document_types:', error2);
          
          // Try a simple database ping
          console.log('Testing simple database ping...');
          const { error: pingError } = await this.client.rpc('ping');
          
          if (pingError) {
            console.error('Ping error:', pingError);
          }
          
          return { 
            success: false, 
            error: 'Connection test failed for both tables', 
            details: { 
              firstError: JSON.stringify(error), 
              secondError: JSON.stringify(error2),
              status1: status,
              status2: status2,
              statusText1: statusText,
              statusText2: statusText2
            } 
          };
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Unexpected error during connection test:', error);
      return { 
        success: false, 
        error: 'Unexpected error during connection test',
        details: error instanceof Error ? 
          { message: error.message, stack: error.stack } : 
          { error: JSON.stringify(error) }
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