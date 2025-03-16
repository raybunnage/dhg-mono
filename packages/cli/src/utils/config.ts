import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Logger, LogLevel } from './logger';
import { AppError } from './error-handler';

class Config {
  private static instance: Config;
  
  supabaseUrl: string;
  supabaseKey: string;
  supabaseAnonKey: string;
  anthropicApiKey: string;
  logLevel: LogLevel;
  defaultOutputDir: string;
  environment: string;
  
  private constructor() {
    // Load the environment variables in order of precedence
    this.loadEnvironmentVariables();
    
    // First try the CLI-specific variables
    this.supabaseUrl = this.getEnvVariable('CLI_SUPABASE_URL', 'SUPABASE_URL', 'VITE_SUPABASE_URL');
    this.supabaseKey = this.getEnvVariable('CLI_SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY');
    this.supabaseAnonKey = this.getEnvVariable('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
    this.anthropicApiKey = this.getEnvVariable('CLI_CLAUDE_API_KEY', 'ANTHROPIC_API_KEY', 'VITE_ANTHROPIC_API_KEY');
    
    // Optional environment variables with defaults
    this.environment = process.env.CLI_ENVIRONMENT || process.env.NODE_ENV || 'development';
    this.logLevel = this.parseLogLevel(process.env.CLI_LOG_LEVEL || process.env.LOG_LEVEL || 'info');
    this.defaultOutputDir = process.env.CLI_OUTPUT_DIR || process.env.OUTPUT_DIR || 'docs';
    
    // Log the loaded env variables for debugging (first few chars only)
    Logger.debug('Config loaded with values:', {
      environment: this.environment,
      logLevel: LogLevel[this.logLevel],
      supabaseUrl: this.supabaseUrl || 'not-set',
      supabaseKey: this.supabaseKey ? this.supabaseKey.substring(0, 5) + '...' : 'not-set',
      anthropicApiKey: this.anthropicApiKey ? this.anthropicApiKey.substring(0, 5) + '...' : 'not-set'
    });
  }
  
  /**
   * Load environment variables from files in order of precedence:
   * 1. .env.local (for secrets)
   * 2. .env.[environment] (development/production)
   * 3. .env (base values)
   * 
   * This searches in both the current directory and repository root.
   */
  private loadEnvironmentVariables(): void {
    Logger.debug('Loading environment variables');
    
    // Start by loading .env from the current directory
    dotenv.config();
    
    // Find the repository root and load environment files with proper precedence
    const possibleRootPaths = [
      // Current directory
      process.cwd(),
      // One level up (if in packages/cli)
      path.resolve(process.cwd(), '..'),
      // Two levels up (if in packages/cli/src)
      path.resolve(process.cwd(), '../..'),
      // Absolute path to repository
      '/Users/raybunnage/Documents/github/dhg-mono'
    ];
    
    // Find the first path that contains a .env file
    const rootPath = possibleRootPaths.find(p => 
      fs.existsSync(path.join(p, '.env'))
    );
    
    if (!rootPath) {
      Logger.warn('Could not find repository root with .env file');
      return;
    }
    
    // Load the base .env file
    dotenv.config({ path: path.join(rootPath, '.env') });
    
    // Determine the current environment
    const environment = process.env.CLI_ENVIRONMENT || process.env.NODE_ENV || 'development';
    
    // Load environment-specific file (.env.development or .env.production)
    const envSpecificPath = path.join(rootPath, `.env.${environment}`);
    if (fs.existsSync(envSpecificPath)) {
      Logger.debug(`Loading environment-specific variables from: ${envSpecificPath}`);
      dotenv.config({ path: envSpecificPath });
    }
    
    // Load .env.local (highest priority, contains secrets)
    const localEnvPath = path.join(rootPath, '.env.local');
    if (fs.existsSync(localEnvPath)) {
      Logger.debug(`Loading local environment variables from: ${localEnvPath}`);
      dotenv.config({ path: localEnvPath });
    } else {
      Logger.warn('No .env.local file found. Secrets may not be properly configured.');
    }
  }
  
  /**
   * Gets an environment variable from multiple possible names in order of preference
   */
  private getEnvVariable(...names: string[]): string {
    for (const name of names) {
      const value = process.env[name];
      if (value) {
        return value;
      }
    }
    
    // If we get here, no value was found - throw error with the first name
    // which should be the most specific one (CLI_ prefixed)
    throw new AppError(
      `Required environment variable ${names[0]} is not set`,
      'CONFIG_ERROR'
    );
  }
  
  private getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new AppError(
        `Required environment variable ${name} is not set`,
        'CONFIG_ERROR'
      );
    }
    return value;
  }
  
  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }
  
  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }
}

// Export a singleton instance
const config = Config.getInstance();
export default config;