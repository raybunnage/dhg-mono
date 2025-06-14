/**
 * Refactored SupabaseAdapterService using AdapterService base class
 * Provides environment-specific Supabase client creation
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AdapterService, AdapterConfig } from '../base-classes/AdapterService';
import { HealthCheckResult, Logger } from '../base-classes/BaseService';

/**
 * Configuration for the Supabase adapter
 */
export interface SupabaseAdapterConfig extends AdapterConfig {
  /**
   * Use service role key instead of anon key
   * This provides admin access and bypasses RLS
   */
  useServiceRole?: boolean;
  
  /**
   * Custom auth configuration
   */
  authConfig?: {
    autoRefreshToken?: boolean;
    persistSession?: boolean;
    detectSessionInUrl?: boolean;
    storageKey?: string;
  };
  
  /**
   * Environment variables to use (for browser environments)
   * If not provided, will try to read from process.env in Node.js
   */
  env?: {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
    VITE_SUPABASE_SERVICE_ROLE_KEY?: string;
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  };
}

interface SupabaseCredentials {
  url: string;
  key: string;
}

/**
 * Supabase adapter service that handles environment-specific client creation
 */
export class SupabaseAdapterService extends AdapterService<SupabaseAdapterConfig, SupabaseClient> {
  private credentials?: SupabaseCredentials;
  private readonly isBrowser = typeof window !== 'undefined';

  constructor(config: SupabaseAdapterConfig = {}, logger?: Logger) {
    super('SupabaseAdapterService', config, logger);
  }

  /**
   * Validate the configuration
   */
  protected validateConfig(config: SupabaseAdapterConfig): void {
    if (this.isBrowser && !config.env) {
      throw new Error(
        'Environment variables must be provided for browser usage. ' +
        'Pass import.meta.env or similar to the adapter config.'
      );
    }
  }

  /**
   * Extract credentials from configuration
   */
  private extractCredentials(): SupabaseCredentials {
    let url: string;
    let key: string;

    if (this.isBrowser) {
      // Re-validate in case config wasn't provided
      if (!this.config.env) {
        throw new Error(
          'Environment variables must be provided for browser usage. ' +
          'Pass import.meta.env or similar to the adapter config.'
        );
      }
      
      // Browser environment - use provided env
      const env = this.config.env;
      url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
      
      if (this.config.useServiceRole) {
        key = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
        if (!key) {
          throw new Error(
            'Missing required environment variable: VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY'
          );
        }
      } else {
        key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';
        if (!key) {
          throw new Error(
            'Missing required environment variable: VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY'
          );
        }
      }
      
      if (!url) {
        throw new Error('Missing required environment variable: VITE_SUPABASE_URL or SUPABASE_URL');
      }
    } else {
      // Server/CLI environment - use process.env
      url = process.env.SUPABASE_URL || '';
      
      if (this.config.useServiceRole) {
        key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        if (!key) {
          throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
        }
      } else {
        key = process.env.SUPABASE_ANON_KEY || '';
        if (!key) {
          throw new Error('Missing required environment variable: SUPABASE_ANON_KEY');
        }
      }
      
      if (!url) {
        throw new Error('Missing required environment variable: SUPABASE_URL');
      }
    }

    return { url, key };
  }

  /**
   * Create the Supabase client
   */
  protected createClient(config: SupabaseAdapterConfig): SupabaseClient {
    // Extract and cache credentials
    this.credentials = this.extractCredentials();

    // Default auth config based on key type
    const defaultAuthConfig = config.useServiceRole
      ? { autoRefreshToken: false, persistSession: false }
      : { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true };
    
    const authConfig = { ...defaultAuthConfig, ...config.authConfig };

    this.logger?.debug(
      `Creating Supabase client for ${this.isBrowser ? 'browser' : 'server'} environment`
    );

    return createClient(this.credentials.url, this.credentials.key, {
      auth: authConfig,
      global: {
        fetch: this.createEnhancedFetch()
      }
    });
  }

  /**
   * Create an enhanced fetch with retry capability
   */
  private createEnhancedFetch() {
    const originalFetch = fetch;
    
    return async (url: any, init: any) => {
      return this.withRetry(
        async () => originalFetch(url, init),
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
          shouldRetry: (error) => {
            // Retry on network errors and 5xx status codes
            if (error.name === 'AbortError') return false;
            if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
            if (error.status >= 500 && error.status < 600) return true;
            return false;
          }
        }
      );
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const client = await this.getClient();
      
      // Test the connection with a simple query
      const { error } = await client
        .from('sys_shared_services')
        .select('id')
        .limit(1);

      const latencyMs = Date.now() - startTime;

      if (error) {
        return {
          healthy: false,
          timestamp: new Date(),
          latencyMs,
          details: { 
            error: error.message,
            environment: this.isBrowser ? 'browser' : 'server'
          }
        };
      }

      return {
        healthy: true,
        timestamp: new Date(),
        latencyMs,
        details: { 
          status: 'connected',
          environment: this.isBrowser ? 'browser' : 'server',
          useServiceRole: this.config.useServiceRole || false
        }
      };
    } catch (error) {
      return {
        healthy: false,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          environment: this.isBrowser ? 'browser' : 'server'
        }
      };
    }
  }

  /**
   * Get the Supabase client
   */
  async getSupabaseClient(): Promise<SupabaseClient> {
    return this.getClient();
  }

  /**
   * Execute a query with automatic retry
   */
  async executeQuery<T>(
    queryFn: (client: SupabaseClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    
    return this.withRetry(
      () => queryFn(client),
      {
        maxAttempts: 3,
        shouldRetry: (error) => {
          // Don't retry on auth errors or bad requests
          if (error.status >= 400 && error.status < 500) return false;
          return true;
        }
      }
    );
  }

  /**
   * Get the current environment
   */
  getEnvironment(): 'browser' | 'server' {
    return this.isBrowser ? 'browser' : 'server';
  }

  /**
   * Check if using service role
   */
  isUsingServiceRole(): boolean {
    return this.config.useServiceRole || false;
  }
}

/**
 * Factory function for creating adapter (backwards compatibility)
 */
export function createSupabaseAdapter(
  options: SupabaseAdapterConfig = {}
): SupabaseAdapterService {
  return new SupabaseAdapterService(options);
}