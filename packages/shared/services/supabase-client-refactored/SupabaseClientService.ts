/**
 * Refactored SupabaseClientService using SingletonService base class
 * Provides a singleton Supabase client for database operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SingletonService } from '../base-classes/SingletonService';
import { HealthCheckResult } from '../base-classes/BaseService';
import * as fs from 'fs';
import * as path from 'path';

interface SupabaseCredentials {
  url: string;
  key: string;
}

export class SupabaseClientService extends SingletonService {
  private client?: SupabaseClient;
  private credentials?: SupabaseCredentials;
  
  // Detect environment
  private readonly isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  private constructor() {
    super('SupabaseClientService');
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): SupabaseClientService {
    return this.getSingletonInstance('SupabaseClientService', () => 
      new SupabaseClientService()
    );
  }

  /**
   * Initialize the service
   */
  protected async initialize(): Promise<void> {
    this.logger?.debug('Initializing SupabaseClientService');
    
    // Load credentials
    this.credentials = await this.loadCredentials();
    
    if (!this.credentials.url || !this.credentials.key) {
      throw new Error(
        this.isBrowser 
          ? 'Unable to find Supabase credentials. Please make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are defined in your .env file.'
          : 'Unable to find Supabase credentials. Please make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are defined in your .env.development file.'
      );
    }

    // Create client with optimized configuration
    const clientOptions: any = {
      global: {
        fetch: this.createOptimizedFetch()
      }
    };

    // Add browser-specific options
    if (this.isBrowser) {
      clientOptions.auth = {
        storageKey: 'dhg-supabase-auth',
        persistSession: true,
        autoRefreshToken: true
      };
    }

    this.client = createClient(this.credentials.url, this.credentials.key, clientOptions);
    
    // Log success (with masked key)
    const maskedKey = this.credentials.key.substring(0, 5) + '...' + 
                     this.credentials.key.substring(this.credentials.key.length - 5);
    this.logger?.info(`Supabase client created with URL: ${this.credentials.url.substring(0, 20)}...`);
    this.logger?.debug(`Using API Key: ${maskedKey}`);
  }

  /**
   * Create an optimized fetch function with timeout
   */
  private createOptimizedFetch() {
    return (url: any, init: any) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const fetchPromise = fetch(url, {
        ...init,
        signal: controller.signal
      });
      
      fetchPromise.finally(() => clearTimeout(timeoutId));
      return fetchPromise;
    };
  }

  /**
   * Load credentials based on environment
   */
  private async loadCredentials(): Promise<SupabaseCredentials> {
    if (this.isBrowser) {
      return this.loadBrowserCredentials();
    } else {
      return this.loadNodeCredentials();
    }
  }

  /**
   * Load credentials in browser environment
   */
  private loadBrowserCredentials(): SupabaseCredentials {
    let url = '';
    let key = '';

    // Try import.meta.env first (Vite)
    try {
      const importMeta = eval('import.meta');
      if (importMeta?.env) {
        url = importMeta.env.VITE_SUPABASE_URL || '';
        key = importMeta.env.VITE_SUPABASE_ANON_KEY || 
              importMeta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
      }
    } catch (e) {
      // import.meta not available
    }

    // Fallback to process.env
    if ((!url || !key) && typeof process !== 'undefined' && process.env) {
      url = url || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      key = key || 
        process.env.VITE_SUPABASE_ANON_KEY || 
        process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    }

    if (url && key) {
      this.logger?.info('Loaded Supabase credentials from browser environment');
    }

    return { url, key };
  }

  /**
   * Load credentials in Node.js environment
   */
  private async loadNodeCredentials(): Promise<SupabaseCredentials> {
    // Look for .env.development file
    let envPath = path.resolve(process.cwd(), '.env.development');
    let currentDir = process.cwd();
    
    // Search up the directory tree
    while (!fs.existsSync(envPath) && currentDir !== path.dirname(currentDir)) {
      currentDir = path.dirname(currentDir);
      envPath = path.resolve(currentDir, '.env.development');
    }
    
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      
      // Extract credentials
      const urlMatch = content.match(/SUPABASE_URL=(.+)/);
      const serviceKeyMatch = content.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
      const anonKeyMatch = content.match(/SUPABASE_ANON_KEY=(.+)/);
      
      const url = urlMatch?.[1].trim() || '';
      const key = serviceKeyMatch?.[1].trim() || anonKeyMatch?.[1].trim() || '';
      
      if (url && key) {
        this.logger?.info(`Loaded Supabase credentials from ${envPath}`);
        return { url, key };
      }
    }

    // Fallback to process.env
    return {
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      key: process.env.SUPABASE_SERVICE_ROLE_KEY || 
           process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
           process.env.SUPABASE_ANON_KEY || 
           process.env.VITE_SUPABASE_ANON_KEY || ''
    };
  }

  /**
   * Release resources
   */
  protected async releaseResources(): Promise<void> {
    if (this.client) {
      // Remove all channels/subscriptions
      await this.client.removeAllChannels();
      this.client = undefined;
    }
    this.credentials = undefined;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      if (!this.client) {
        return {
          healthy: false,
          timestamp: new Date(),
          latencyMs: Date.now() - startTime,
          details: { error: 'Client not initialized' }
        };
      }

      // Try a simple query
      const { error } = await this.client
        .from('sys_shared_services')
        .select('id')
        .limit(1);

      const latencyMs = Date.now() - startTime;

      if (error) {
        return {
          healthy: false,
          timestamp: new Date(),
          latencyMs,
          details: { error: error.message }
        };
      }

      return {
        healthy: true,
        timestamp: new Date(),
        latencyMs,
        details: { status: 'connected' }
      };
    } catch (error) {
      return {
        healthy: false,
        timestamp: new Date(),
        latencyMs: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Get the Supabase client
   */
  async getClient(): Promise<SupabaseClient> {
    await this.ensureInitialized();
    
    if (!this.client) {
      throw new Error('Supabase client not available after initialization');
    }
    
    return this.client;
  }

  /**
   * Test connection (backwards compatibility)
   */
  async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    const result = await this.healthCheck();
    return {
      success: result.healthy,
      error: result.healthy ? undefined : result.details?.error,
      details: result.details
    };
  }
}