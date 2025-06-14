// Example implementation showing how the base classes would work

import { SupabaseClient, createClient } from '@supabase/supabase-js';

// ============= Base Types =============
interface ServiceMetadata {
  name: string;
  initialized: boolean;
  type: string;
  version?: string;
  dependencies?: string[];
}

interface ServiceDependencies {
  [key: string]: any;
}

interface Logger {
  info(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

// ============= Example: Refactored SupabaseClientService =============
import { SingletonService } from './SingletonService';

export class SupabaseClientServiceRefactored extends SingletonService {
  private client?: SupabaseClient;
  private url?: string;
  private anonKey?: string;

  private constructor() {
    super('SupabaseClientService');
  }

  static getInstance(): SupabaseClientServiceRefactored {
    return this.getSingletonInstance('SupabaseClientService', () => 
      new SupabaseClientServiceRefactored()
    );
  }

  protected async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load from environment
    this.url = process.env.SUPABASE_URL;
    this.anonKey = process.env.SUPABASE_ANON_KEY;

    if (!this.url || !this.anonKey) {
      throw new Error('Missing Supabase credentials');
    }

    this.client = createClient(this.url, this.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true
      }
    });

    this.initialized = true;
    this.logger?.info('SupabaseClientService initialized');
  }

  protected async cleanup(): Promise<void> {
    // Clean up any subscriptions
    if (this.client) {
      await this.client.removeAllChannels();
    }
    this.initialized = false;
  }

  protected async releaseResources(): Promise<void> {
    await this.cleanup();
    this.client = undefined;
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    try {
      if (!this.client) {
        return { healthy: false, details: { error: 'Client not initialized' } };
      }

      // Simple health check - try to query a system table
      const { error } = await this.client
        .from('sys_health_check')
        .select('count')
        .limit(1);

      return {
        healthy: !error,
        details: error ? { error: error.message } : { status: 'connected' }
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  async getClient(): Promise<SupabaseClient> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.client) {
      throw new Error('Failed to initialize Supabase client');
    }
    return this.client;
  }
}

// ============= Example: Business Service =============
import { BusinessService } from './BusinessService';

export class UserProfileServiceRefactored extends BusinessService {
  constructor(
    private supabaseClient: SupabaseClient,
    logger?: Logger
  ) {
    super('UserProfileService', { supabaseClient }, logger);
  }

  protected validateDependencies(): void {
    if (!this.dependencies.supabaseClient) {
      throw new Error('SupabaseClient is required');
    }
  }

  protected async initialize(): Promise<void> {
    // Any initialization logic
    this.initialized = true;
  }

  protected async cleanup(): Promise<void> {
    // Cleanup logic
    this.initialized = false;
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    return { healthy: true, details: { status: 'operational' } };
  }

  // Business methods
  async getUserProfile(userId: string) {
    return this.withTransaction(async () => {
      const { data, error } = await this.supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    });
  }

  async updateUserProfile(userId: string, updates: any) {
    this.logger?.info(`Updating profile for user ${userId}`);
    
    return this.withTransaction(async () => {
      const { data, error } = await this.supabaseClient
        .from('user_profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  }
}

// ============= Example: Adapter Service =============
import { AdapterService } from './AdapterService';

interface SupabaseAdapterConfig {
  url: string;
  anonKey: string;
  options?: any;
  env?: any;
}

export class SupabaseAdapterRefactored extends AdapterService<SupabaseAdapterConfig, SupabaseClient> {
  constructor(config: SupabaseAdapterConfig, logger?: Logger) {
    super('SupabaseAdapter', config, logger);
  }

  protected validateConfig(config: SupabaseAdapterConfig): void {
    if (!config.url || !config.anonKey) {
      throw new Error('Supabase URL and anon key are required');
    }
  }

  protected createClient(config: SupabaseAdapterConfig): SupabaseClient {
    return createClient(config.url, config.anonKey, config.options || {});
  }

  protected async initialize(): Promise<void> {
    this.validateConfig(this.config);
    this.client = this.createClient(this.config);
    this.initialized = true;
  }

  protected async cleanup(): Promise<void> {
    if (this.client) {
      await this.client.removeAllChannels();
    }
    this.initialized = false;
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    try {
      const { error } = await this.client!
        .from('sys_health_check')
        .select('count')
        .limit(1);

      return { healthy: !error };
    } catch {
      return { healthy: false };
    }
  }

  // Adapter-specific methods
  async executeQuery<T>(query: () => Promise<T>): Promise<T> {
    return this.withRetry(query, 3);
  }
}

// ============= Usage Examples =============

// 1. Singleton Pattern (Infrastructure)
async function exampleSingletonUsage() {
  const supabaseClient = SupabaseClientServiceRefactored.getInstance();
  const client = await supabaseClient.getClient();
  
  // Use client for queries
  const { data } = await client.from('users').select('*');
}

// 2. Business Service Pattern (Dependency Injection)
async function exampleBusinessServiceUsage() {
  // Get the singleton client
  const clientService = SupabaseClientServiceRefactored.getInstance();
  const client = await clientService.getClient();
  
  // Inject into business service
  const userService = new UserProfileServiceRefactored(client);
  
  const profile = await userService.getUserProfile('user-123');
}

// 3. Adapter Pattern (Browser/Environment specific)
async function exampleAdapterUsage() {
  const adapter = new SupabaseAdapterRefactored({
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    env: import.meta.env
  });
  
  await adapter.initialize();
  
  // Use adapter for environment-specific operations
}

// ============= Migration Helper =============
export class ServiceMigrationHelper {
  static async migrateService(
    oldService: any,
    newService: any,
    featureFlag: string
  ): Promise<any> {
    const useNewService = process.env[featureFlag] === 'true';
    
    if (useNewService) {
      console.log(`Using new ${newService.constructor.name}`);
      return newService;
    }
    
    console.log(`Using legacy ${oldService.constructor.name}`);
    return oldService;
  }
}