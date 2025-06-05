/**
 * Environment Configuration Service
 * 
 * Provides a unified way to access environment variables across browser and Node.js environments
 * Automatically detects the environment and uses the appropriate prefix (VITE_ for browser)
 */

interface EnvConfig {
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
}

/**
 * Environment detection and configuration service
 */
export class EnvConfigService {
  private static instance: EnvConfigService;
  private isBrowser: boolean;
  private config: Partial<EnvConfig> = {};
  
  private constructor() {
    this.isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    this.loadConfig();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): EnvConfigService {
    if (!EnvConfigService.instance) {
      EnvConfigService.instance = new EnvConfigService();
    }
    return EnvConfigService.instance;
  }
  
  /**
   * Load configuration based on environment
   */
  private loadConfig(): void {
    if (this.isBrowser) {
      // Browser environment - use import.meta.env with VITE_ prefix
      // @ts-ignore - import.meta.env is available in Vite
      const env = (typeof import !== 'undefined' && import.meta?.env) || {};
      
      this.config = {
        SUPABASE_URL: env.VITE_SUPABASE_URL,
        SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: env.VITE_SUPABASE_SERVICE_ROLE_KEY,
        CLAUDE_API_KEY: env.VITE_CLAUDE_API_KEY,
        APP_NAME: env.VITE_APP_NAME,
        APP_ENV: env.VITE_ENV,
        API_URL: env.VITE_API_URL,
        FEATURE_FLAGS: env.VITE_FEATURE_FLAGS,
        TEST_USER_EMAIL: env.VITE_TEST_USER_EMAIL,
        TEST_USER_PASSWORD: env.VITE_TEST_USER_PASSWORD,
      };
    } else {
      // Node.js environment - use process.env
      this.config = {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
        APP_NAME: process.env.APP_NAME,
        APP_ENV: process.env.NODE_ENV,
        API_URL: process.env.API_URL,
        FEATURE_FLAGS: process.env.FEATURE_FLAGS,
        TEST_USER_EMAIL: process.env.TEST_USER_EMAIL,
        TEST_USER_PASSWORD: process.env.TEST_USER_PASSWORD,
        GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
      };
    }
  }
  
  /**
   * Get environment variable value
   */
  public get<K extends keyof EnvConfig>(key: K): EnvConfig[K] | undefined {
    return this.config[key] as EnvConfig[K] | undefined;
  }
  
  /**
   * Get required environment variable (throws if missing)
   */
  public getRequired<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    const value = this.get(key);
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
  }
  
  /**
   * Check if environment variable exists
   */
  public has(key: keyof EnvConfig): boolean {
    return !!this.get(key);
  }
  
  /**
   * Get all environment variables
   */
  public getAll(): Partial<EnvConfig> {
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
    if (!key) {
      return { valid: false, message: 'Key is missing' };
    }
    
    if (key.length < 20) {
      return { valid: false, message: 'Key is too short' };
    }
    
    if (!key.includes('_')) {
      return { valid: false, message: 'Key has invalid format' };
    }
    
    return { valid: true, message: 'Key appears valid' };
  }
  
  /**
   * Get environment diagnostics
   */
  public getDiagnostics(): {
    environment: string;
    isBrowser: boolean;
    hasSupabaseConfig: boolean;
    hasClaudeConfig: boolean;
    hasGoogleConfig: boolean;
    missingRequired: string[];
  } {
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
      isBrowser: this.isBrowser,
      hasSupabaseConfig: this.has('SUPABASE_URL') && this.has('SUPABASE_ANON_KEY'),
      hasClaudeConfig: this.has('CLAUDE_API_KEY'),
      hasGoogleConfig: this.has('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
      missingRequired,
    };
  }
}

// Export singleton instance
export const envConfig = EnvConfigService.getInstance();