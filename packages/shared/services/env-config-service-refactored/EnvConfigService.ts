/**
 * Environment Configuration Service - Refactored
 * 
 * Provides a unified way to access environment variables across Node.js environments
 * Refactored to extend SingletonService with proper resource management
 * 
 * Note: This service is for Node.js/CLI environments only. Browser apps should use
 * createSupabaseAdapter with import.meta.env directly.
 * 
 * @module EnvConfigService
 */

import { SingletonService } from '../base-classes/SingletonService';

// Types
export interface EnvConfig {
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  
  // Claude AI
  CLAUDE_API_KEY?: string;
  
  // App Config
  APP_NAME?: string;
  APP_ENV?: string;
  API_URL?: string;
  FEATURE_FLAGS?: string;
  
  // Auth
  TEST_USER_EMAIL?: string;
  TEST_USER_PASSWORD?: string;
  
  // Google Services
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  
  // Additional dynamic keys
  [key: string]: string | undefined;
}

interface EnvConfigServiceMetrics {
  totalGets: number;
  totalValidations: number;
  missingKeys: string[];
  lastAccessTime?: Date;
}

interface EnvDiagnostics {
  environment: string;
  isBrowser: boolean;
  hasSupabaseConfig: boolean;
  hasClaudeConfig: boolean;
  hasGoogleConfig: boolean;
  missingRequired: string[];
}

export class EnvConfigService extends SingletonService {
  private static instance: EnvConfigService;
  private config: Partial<EnvConfig> = {};
  private metrics: EnvConfigServiceMetrics = {
    totalGets: 0,
    totalValidations: 0,
    missingKeys: []
  };

  protected constructor() {
    super('EnvConfigService');
    
    // Ensure this service is not used in browser environments
    if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
      throw new Error(
        'EnvConfigService should not be used in browser environments. ' +
        'Use createSupabaseAdapter with import.meta.env instead.'
      );
    }
  }

  public static getInstance(): EnvConfigService {
    if (!EnvConfigService.instance) {
      EnvConfigService.instance = new EnvConfigService();
    }
    return EnvConfigService.instance;
  }

  // BaseService requirements
  protected async initialize(): Promise<void> {
    this.logger?.info('EnvConfigService initializing...');
    
    try {
      this.loadConfig();
      
      // Validate critical environment variables
      const diagnostics = this.getDiagnostics();
      if (diagnostics.missingRequired.length > 0) {
        this.logger?.warn(
          `Missing required environment variables: ${diagnostics.missingRequired.join(', ')}`
        );
      }
      
      this.logger?.info('EnvConfigService initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize EnvConfigService:', error);
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger?.info('EnvConfigService cleaning up...');
    // Clear sensitive data from memory
    this.config = {};
    this.logger?.info('EnvConfigService cleanup completed');
  }

  // SingletonService requirement
  protected async releaseResources(): Promise<void> {
    // Clear configuration from memory
    this.config = {};
    this.metrics.missingKeys = [];
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    const diagnostics = this.getDiagnostics();
    const healthy = diagnostics.missingRequired.length === 0;
    
    return {
      healthy,
      details: {
        ...diagnostics,
        metrics: { ...this.metrics },
        configuredKeys: Object.keys(this.config).length
      },
      timestamp: new Date()
    };
  }

  // Private methods

  /**
   * Load configuration from process.env
   */
  private loadConfig(): void {
    // Load all known environment variables
    const knownKeys: (keyof EnvConfig)[] = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'CLAUDE_API_KEY',
      'APP_NAME',
      'APP_ENV',
      'API_URL',
      'FEATURE_FLAGS',
      'TEST_USER_EMAIL',
      'TEST_USER_PASSWORD',
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
    ];

    // Load known keys
    for (const key of knownKeys) {
      const value = process.env[key];
      if (value !== undefined) {
        this.config[key] = value;
      }
    }

    // Also load NODE_ENV as APP_ENV if APP_ENV not set
    if (!this.config.APP_ENV && process.env.NODE_ENV) {
      this.config.APP_ENV = process.env.NODE_ENV;
    }

    this.logger?.debug(`Loaded ${Object.keys(this.config).length} environment variables`);
  }

  // Public API methods

  /**
   * Get environment variable value
   */
  public get<K extends keyof EnvConfig>(key: K): EnvConfig[K] | undefined {
    this.metrics.totalGets++;
    this.metrics.lastAccessTime = new Date();
    
    const value = this.config[key] as EnvConfig[K] | undefined;
    
    if (!value && !this.metrics.missingKeys.includes(key as string)) {
      this.metrics.missingKeys.push(key as string);
    }
    
    return value;
  }

  /**
   * Get required environment variable (throws if missing)
   */
  public getRequired<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    const value = this.get(key);
    if (!value) {
      const error = new Error(`Missing required environment variable: ${key}`);
      this.logger?.error(error.message);
      throw error;
    }
    return value;
  }

  /**
   * Check if environment variable exists
   */
  public has(key: keyof EnvConfig): boolean {
    return this.config[key] !== undefined;
  }

  /**
   * Get all environment variables
   */
  public getAll(): Partial<EnvConfig> {
    this.metrics.totalGets++;
    return { ...this.config };
  }

  /**
   * Get environment type
   */
  public getEnvironment(): 'production' | 'development' | 'test' | string {
    const env = this.get('APP_ENV') || 'development';
    return env.toLowerCase();
  }

  /**
   * Check if in production
   */
  public isProduction(): boolean {
    return this.getEnvironment() === 'production';
  }

  /**
   * Check if in development
   */
  public isDevelopment(): boolean {
    return this.getEnvironment() === 'development';
  }

  /**
   * Check if in test environment
   */
  public isTest(): boolean {
    return this.getEnvironment() === 'test';
  }

  /**
   * Get feature flags as array
   */
  public getFeatureFlags(): string[] {
    const flags = this.get('FEATURE_FLAGS');
    return flags ? flags.split(',').map(f => f.trim()) : [];
  }

  /**
   * Check if feature flag is enabled
   */
  public hasFeatureFlag(flag: string): boolean {
    return this.getFeatureFlags().includes(flag);
  }

  /**
   * Validate API key format
   */
  public validateApiKey(key?: string): { valid: boolean; message: string } {
    this.metrics.totalValidations++;
    
    if (!key) {
      return { valid: false, message: 'Key is missing' };
    }
    
    if (key.length < 20) {
      return { valid: false, message: 'Key is too short' };
    }
    
    if (!key.includes('_') && !key.includes('-')) {
      return { valid: false, message: 'Key has invalid format' };
    }
    
    // Check for common patterns
    if (key.toLowerCase().includes('your-') || key.toLowerCase().includes('xxx')) {
      return { valid: false, message: 'Key appears to be a placeholder' };
    }
    
    return { valid: true, message: 'Key appears valid' };
  }

  /**
   * Get environment diagnostics
   */
  public getDiagnostics(): EnvDiagnostics {
    const missingRequired: string[] = [];
    
    // Check required variables
    const required: (keyof EnvConfig)[] = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
    for (const key of required) {
      if (!this.has(key)) {
        missingRequired.push(key);
      }
    }
    
    return {
      environment: this.getEnvironment(),
      isBrowser: false, // Always false since constructor prevents browser usage
      hasSupabaseConfig: this.has('SUPABASE_URL') && this.has('SUPABASE_ANON_KEY'),
      hasClaudeConfig: this.has('CLAUDE_API_KEY'),
      hasGoogleConfig: this.has('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
      missingRequired,
    };
  }

  /**
   * Get service metrics
   */
  public getMetrics(): EnvConfigServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Set custom environment variable (for testing)
   * Note: This only affects the service's internal config, not process.env
   */
  public set(key: string, value: string | undefined): void {
    if (this.isProduction()) {
      this.logger?.warn('Attempting to set environment variable in production');
    }
    
    if (value === undefined) {
      delete this.config[key];
    } else {
      this.config[key] = value;
    }
  }

  /**
   * Reload configuration from process.env
   */
  public reload(): void {
    this.config = {};
    this.metrics.missingKeys = [];
    this.loadConfig();
    this.logger?.info('Environment configuration reloaded');
  }
}

export default EnvConfigService;