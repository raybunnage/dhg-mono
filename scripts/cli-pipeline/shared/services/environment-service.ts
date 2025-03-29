/**
 * Environment Service
 * 
 * Manages environment variables, configuration loading, and environment detection.
 * Creates a consistent configuration object that can be used across services.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { EnvironmentConfig, LogLevel } from '../interfaces/types';

/**
 * Environment Service options
 */
export interface EnvironmentServiceOptions {
  rootDir?: string;
  envFiles?: string[];
}

/**
 * Environment Service implementation
 */
export class EnvironmentService {
  private static instance: EnvironmentService;
  private config: EnvironmentConfig;
  private rootDir: string;
  
  /**
   * Create a new environment service
   * Private constructor to enforce singleton pattern
   */
  private constructor(options?: EnvironmentServiceOptions) {
    this.rootDir = options?.rootDir || process.cwd();
    
    // Load environment variables from files
    const envFiles = options?.envFiles || ['.env', '.env.local', '.env.development'];
    this.loadEnvironmentFiles(envFiles);
    
    // Build configuration
    this.config = this.buildConfig();
    
    this.logConfig();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(options?: EnvironmentServiceOptions): EnvironmentService {
    if (!EnvironmentService.instance) {
      EnvironmentService.instance = new EnvironmentService(options);
    }
    return EnvironmentService.instance;
  }
  
  /**
   * Load environment variables from files
   */
  private loadEnvironmentFiles(envFiles: string[]): void {
    for (const envFile of envFiles) {
      const envPath = path.resolve(this.rootDir, envFile);
      if (fs.existsSync(envPath)) {
        console.log(`Loading environment from ${envPath}`);
        dotenv.config({ path: envPath });
      }
    }
  }
  
  /**
   * Build configuration object from environment variables
   */
  private buildConfig(): EnvironmentConfig {
    return {
      nodeEnv: process.env.NODE_ENV || 'development',
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      claudeApiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '',
      claudeApiBaseUrl: process.env.CLAUDE_API_BASE_URL || 'https://api.anthropic.com',
      claudeApiVersion: process.env.CLAUDE_API_VERSION || '2023-06-01',
      logLevel: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
      rootDir: this.rootDir
    };
  }
  
  /**
   * Get configuration
   */
  public getConfig(): EnvironmentConfig {
    return this.config;
  }
  
  /**
   * Get specific configuration value
   */
  public get<K extends keyof EnvironmentConfig>(key: K): EnvironmentConfig[K] {
    return this.config[key];
  }
  
  /**
   * Get Supabase URL
   */
  public getSupabaseUrl(): string {
    return this.config.supabaseUrl;
  }
  
  /**
   * Get Supabase key
   */
  public getSupabaseKey(): string {
    return this.config.supabaseKey;
  }
  
  /**
   * Get Claude API key
   */
  public getClaudeApiKey(): string {
    return this.config.claudeApiKey;
  }
  
  /**
   * Get root directory
   */
  public getRootDir(): string {
    return this.config.rootDir;
  }
  
  /**
   * Check if required environment variables are set
   */
  public validateRequiredEnvVars(requiredVars: (keyof EnvironmentConfig)[]): string[] {
    const missingVars: string[] = [];
    
    for (const varName of requiredVars) {
      if (!this.config[varName]) {
        missingVars.push(varName.toString());
      }
    }
    
    return missingVars;
  }
  
  /**
   * Check if required environment variables are set
   */
  public hasRequiredEnvVars(requiredVars: (keyof EnvironmentConfig)[]): boolean {
    return this.validateRequiredEnvVars(requiredVars).length === 0;
  }
  
  /**
   * Check if running in development environment
   */
  public isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }
  
  /**
   * Check if running in production environment
   */
  public isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }
  
  /**
   * Check if running in test environment
   */
  public isTest(): boolean {
    return this.config.nodeEnv === 'test';
  }
  
  /**
   * Log configuration (with sensitive values masked)
   */
  private logConfig(): void {
    const maskedConfig = { ...this.config };
    
    // Mask sensitive values
    if (maskedConfig.supabaseKey) {
      maskedConfig.supabaseKey = `${maskedConfig.supabaseKey.substring(0, 5)}...`;
    }
    if (maskedConfig.claudeApiKey) {
      maskedConfig.claudeApiKey = `${maskedConfig.claudeApiKey.substring(0, 5)}...`;
    }
    
    console.debug('Environment configuration loaded:', maskedConfig);
  }
}

// Export singleton instance
export const environmentService = EnvironmentService.getInstance();