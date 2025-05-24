import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Conditionally import Node.js modules only in Node.js environment
let config: any = null;
let dotenv: any = null;
let path: any = null;
let fs: any = null;

// Detect if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';


if (!isBrowser) {
  // Only import Node.js modules in Node.js environment
  try {
    dotenv = require('dotenv');
    path = require('path');
    fs = require('fs');
  } catch (error) {
    console.warn('Could not load core Node.js modules:', error);
  }
  
  // Try to load config separately as it might fail
  try {
    config = require('../utils').config;
  } catch (error) {
    console.warn('Could not load config module, will use direct env loading');
  }
}

/**
 * Singleton class to manage Supabase client instance
 */
export class SupabaseClientService {
  private static instance: SupabaseClientService;
  private client: SupabaseClient | null = null;
  private supabaseUrl: string = '';
  private supabaseKey: string = '';

  private constructor() {
    // Private constructor to enforce singleton pattern
    // Load credentials directly from .env.development
    this.loadCredentials();
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
   * Load Supabase credentials from appropriate source based on environment
   */
  private loadCredentials(): void {
    if (isBrowser) {
      // Browser environment - use import.meta.env or global env
      this.loadBrowserCredentials();
    } else {
      // Node.js environment - read from .env files
      this.loadNodeCredentials();
    }
  }

  /**
   * Load credentials in browser environment
   */
  private loadBrowserCredentials(): void {
    try {
      // Try Vite environment variables first
      // Use eval to avoid TypeScript compilation errors in Node.js
      try {
        const importMeta = eval('import.meta');
        if (importMeta && importMeta.env) {
          this.supabaseUrl = importMeta.env.VITE_SUPABASE_URL || '';
          this.supabaseKey = importMeta.env.VITE_SUPABASE_ANON_KEY || 
                            importMeta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
        }
      } catch (e) {
        // import.meta not available, skip
      }
      
      // Fallback to process.env if available in browser
      if (!this.supabaseUrl || !this.supabaseKey) {
        if (typeof process !== 'undefined' && process.env) {
          this.supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
          this.supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 
                            process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
                            process.env.SUPABASE_ANON_KEY ||
                            process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        }
      }
      
      if (this.supabaseUrl && this.supabaseKey) {
        console.log('Loaded Supabase credentials successfully from browser environment');
      }
    } catch (err) {
      console.error('Error loading credentials in browser:', err);
    }
  }

  /**
   * Load credentials in Node.js environment
   */
  private loadNodeCredentials(): void {
    try {
      if (!path || !fs) {
        console.warn('Node.js modules not available, cannot load from .env files');
        return;
      }
      
      // Look for .env.development starting from cwd and going up to find the project root
      let envPath = path.resolve(process.cwd(), '.env.development');
      let currentDir = process.cwd();
      
      // If not found in current directory, try going up until we find it or reach the root
      while (!fs.existsSync(envPath) && currentDir !== path.dirname(currentDir)) {
        currentDir = path.dirname(currentDir);
        envPath = path.resolve(currentDir, '.env.development');
      }
      
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        
        // Extract URL and SERVICE_ROLE key directly
        const urlMatch = content.match(/SUPABASE_URL=(.+)/);
        const serviceKeyMatch = content.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
        
        if (urlMatch && serviceKeyMatch) {
          this.supabaseUrl = urlMatch[1].trim();
          this.supabaseKey = serviceKeyMatch[1].trim();
          console.log(`Loaded Supabase credentials successfully from ${envPath}`);
        } else {
          console.warn('Could not find SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.development');
        }
      }
    } catch (err) {
      console.error('Error loading credentials from env file:', err);
    }
  }

  /**
   * Manually load environment variables as fallback
   * This is a fallback if the config doesn't have Supabase credentials
   */
  private loadEnvironmentVariables(): { supabaseUrl: string, supabaseKey: string } {
    if (isBrowser) {
      return this.loadBrowserEnvironmentVariables();
    } else {
      return this.loadNodeEnvironmentVariables();
    }
  }

  /**
   * Load environment variables in browser
   */
  private loadBrowserEnvironmentVariables(): { supabaseUrl: string, supabaseKey: string } {
    let supabaseUrl = '';
    let supabaseKey = '';

    // Try import.meta.env first (Vite)
    // Use eval to avoid TypeScript compilation errors in Node.js
    try {
      const importMeta = eval('import.meta');
      if (importMeta && importMeta.env) {
        supabaseUrl = importMeta.env.VITE_SUPABASE_URL || '';
        supabaseKey = importMeta.env.VITE_SUPABASE_ANON_KEY || 
                     importMeta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
      }
    } catch (e) {
      // import.meta not available, skip
    }

    // Fallback to process.env if available
    if ((!supabaseUrl || !supabaseKey) && typeof process !== 'undefined' && process.env) {
      supabaseUrl = supabaseUrl || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      supabaseKey = supabaseKey || 
        process.env.VITE_SUPABASE_ANON_KEY || 
        process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    }

    return { supabaseUrl, supabaseKey };
  }

  /**
   * Load environment variables in Node.js
   */
  private loadNodeEnvironmentVariables(): { supabaseUrl: string, supabaseKey: string } {
    // Try to load directly from .env.development file first
    try {
      if (path && fs) {
        // Look for .env.development starting from cwd and going up to find the project root
        let envPath = path.resolve(process.cwd(), '.env.development');
        let currentDir = process.cwd();
        
        // If not found in current directory, try going up until we find it or reach the root
        while (!fs.existsSync(envPath) && currentDir !== path.dirname(currentDir)) {
          currentDir = path.dirname(currentDir);
          envPath = path.resolve(currentDir, '.env.development');
        }
        
        if (fs.existsSync(envPath)) {
          console.log(`SupabaseClientService: Reading environment variables directly from ${envPath}`);
          
          const content = fs.readFileSync(envPath, 'utf8');
          
          // Extract URL and SERVICE_ROLE key directly
          const urlMatch = content.match(/SUPABASE_URL=(.+)/);
          const serviceKeyMatch = content.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
          const anonKeyMatch = content.match(/SUPABASE_ANON_KEY=(.+)/);
          
          const directUrl = urlMatch ? urlMatch[1].trim() : '';
          const directServiceKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : '';
          const directAnonKey = anonKeyMatch ? anonKeyMatch[1].trim() : '';
          
          if (directUrl && (directServiceKey || directAnonKey)) {
            console.log('Found Supabase credentials directly in .env.development file');
            return { 
              supabaseUrl: directUrl, 
              supabaseKey: directServiceKey || directAnonKey 
            };
          }
        }
      }
    } catch (err) {
      console.error('Error reading .env.development file directly:', err);
    }
    
    // Fallback to dotenv if direct reading fails
    if (dotenv && path && fs) {
      console.log('Falling back to dotenv for environment variables');
      
      // Try to load environment variables from various files
      const envFiles = ['.env', '.env.local', '.env.development'];
      
      for (const file of envFiles) {
        const filePath = path.resolve(process.cwd(), file);
        
        if (fs.existsSync(filePath)) {
          console.log(`SupabaseClientService: Loading environment variables from ${filePath}`);
          
          const result = dotenv.config({ path: filePath });
          
          if (result.error) {
            console.error(`Error loading ${filePath}:`, result.error);
          }
        }
      }
    }
    
    // Check all possible environment variable names
    const supabaseUrl = (typeof process !== 'undefined' && process.env) ? (
      process.env.SUPABASE_URL || 
      process.env.VITE_SUPABASE_URL || 
      process.env.NEXT_PUBLIC_SUPABASE_URL || 
      ''
    ) : '';
      
    const supabaseKey = (typeof process !== 'undefined' && process.env) ? (
      process.env.SUPABASE_SERVICE_ROLE_KEY || 
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || 
      process.env.SUPABASE_ANON_KEY || 
      process.env.VITE_SUPABASE_ANON_KEY || 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
      ''
    ) : '';
      
    return { supabaseUrl, supabaseKey };
  }
  
  /**
   * Get the Supabase client instance
   */
  public getClient(): SupabaseClient {
    if (!this.client) {
      // If credentials weren't loaded directly, try fallbacks
      if (!this.supabaseUrl || !this.supabaseKey) {
        // Try config if available
        if (config && config.supabaseUrl && config.supabaseKey) {
          this.supabaseUrl = config.supabaseUrl;
          this.supabaseKey = config.supabaseKey;
        } else {
          // Last resort - try environment variables
          console.log('Falling back to environment variables');
          const envVars = this.loadEnvironmentVariables();
          this.supabaseUrl = envVars.supabaseUrl;
          this.supabaseKey = envVars.supabaseKey;
        }
        
      }
      
      // Fail if no credentials are found
      if (!this.supabaseUrl || !this.supabaseKey) {
        const errorMsg = isBrowser 
          ? 'Unable to find Supabase credentials. Please make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are defined in your .env file.'
          : 'Unable to find Supabase credentials. Please make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are defined in your .env.development file.';
        throw new Error(errorMsg);
      }
      
      console.log(`Creating Supabase client with URL: ${this.supabaseUrl.substring(0, 20)}...`);
      
      try {
        // Create client with environment-appropriate configuration
        const clientOptions: any = {
          global: {
            fetch: (url: any, init: any) => {
              // Add timeout for fetch operations to handle DNS resolution failures
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
              
              const fetchPromise = fetch(url, {
                ...init,
                signal: controller.signal
              });
              
              fetchPromise.finally(() => clearTimeout(timeoutId));
              return fetchPromise;
            }
          }
        };

        // Add browser-specific options
        if (isBrowser) {
          clientOptions.auth = {
            storageKey: 'dhg-supabase-auth',
            persistSession: true,
            autoRefreshToken: true
          };
        }

        this.client = createClient(this.supabaseUrl, this.supabaseKey, clientOptions);
        
        // Log the API key we're using (partially masked)
        const maskedKey = this.supabaseKey.substring(0, 5) + '...' + this.supabaseKey.substring(this.supabaseKey.length - 5);
        console.log(`Using API Key: ${maskedKey}`);
      } catch (error) {
        console.error('Error creating Supabase client:', error);
        throw new Error(`Failed to create Supabase client: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return this.client;
  }

  /**
   * Test the connection to Supabase
   */
  public async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      const client = this.getClient();
      
      // Try a simple query to document_types table
      try {
        console.log('Testing connection with document_types table...');
        const { error } = await client
          .from('document_types')
          .select('name')
          .limit(1);
        
        if (error) {
          console.error('Error querying document_types:', error);
          return { 
            success: false, 
            error: `Failed to query document_types: ${error.message}`,
            details: error 
          };
        } else {
          console.log('Successfully connected to document_types table');
          return { success: true };
        }
      } catch (e) {
        console.error('Exception querying document_types table:', e);
      }
      
      // Try sources_google table as a fallback
      try {
        console.log('Testing connection with sources_google table...');
        const { error } = await client
          .from('sources_google')
          .select('id')
          .limit(1);
        
        if (error) {
          console.error('Error querying sources_google:', error);
          return { 
            success: false, 
            error: `Failed to query sources_google: ${error.message}`,
            details: error 
          };
        } else {
          console.log('Successfully connected to sources_google table');
          return { success: true };
        }
      } catch (e) {
        console.error('Exception querying sources_google table:', e);
      }
      
      // Final fallback - try a simple RPC call
      try {
        console.log('Testing connection with RPC call...');
        const { error } = await client.rpc('get_schema_version');
        
        if (error) {
          console.error('Error with RPC call:', error);
          return { 
            success: false, 
            error: `Failed to call RPC get_schema_version: ${error.message}`,
            details: error 
          };
        } else {
          console.log('Successfully connected to Supabase using RPC');
          return { success: true };
        }
      } catch (e) {
        console.error('Exception calling RPC:', e);
      }
      
      return { success: false, error: 'Failed to connect to Supabase with all test methods' };
    } catch (error) {
      console.error('Error connecting to Supabase:', error);
      return { success: false, error: 'Error connecting to Supabase', details: error };
    }
  }
}