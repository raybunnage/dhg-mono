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
  
  private constructor() {
    // First try loading from .env file in the CLI directory
    dotenv.config();
    
    // Find the .env.development file
    let envFilePath = '';
    
    // Try the direct app path
    const appEnvPath = path.resolve(process.cwd(), '.env.development');
    if (fs.existsSync(appEnvPath)) {
      envFilePath = appEnvPath;
    } 
    // Try one level up
    else if (fs.existsSync(path.resolve(process.cwd(), '../.env.development'))) {
      envFilePath = path.resolve(process.cwd(), '../.env.development');
    }
    // Look for standard path
    else if (fs.existsSync(path.resolve(process.cwd(), 'apps/dhg-improve-experts/.env.development'))) {
      envFilePath = path.resolve(process.cwd(), 'apps/dhg-improve-experts/.env.development');
    }
    // Look for real absolute path
    else if (fs.existsSync('/Users/raybunnage/Documents/github/dhg-mono/apps/dhg-improve-experts/.env.development')) {
      envFilePath = '/Users/raybunnage/Documents/github/dhg-mono/apps/dhg-improve-experts/.env.development';
    }
    
    try {
      if (envFilePath) {
        Logger.debug(`Loading environment from: ${envFilePath}`);
        dotenv.config({ path: envFilePath });
        
        // Log the loaded env values for debugging (first few chars only)
        const supabaseUrl = process.env.VITE_SUPABASE_URL || 'not-set';
        const supabaseKeyPrefix = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY 
          ? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY.substring(0, 5) + '...' 
          : 'not-set';
        const apiKeyPrefix = process.env.VITE_ANTHROPIC_API_KEY 
          ? process.env.VITE_ANTHROPIC_API_KEY.substring(0, 5) + '...' 
          : 'not-set';
          
        Logger.debug(`Loaded env variables from ${envFilePath}:`, {
          VITE_SUPABASE_URL: supabaseUrl,
          VITE_SUPABASE_SERVICE_ROLE_KEY: supabaseKeyPrefix,
          VITE_ANTHROPIC_API_KEY: apiKeyPrefix
        });
      } else {
        Logger.warn('Environment file not found in any of the expected locations');
        throw new AppError('Environment file .env.development not found', 'CONFIG_ERROR');
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.warn('Failed to load app-specific environment file', error);
      throw new AppError('Failed to load environment file', 'CONFIG_ERROR');
    }
    
    // Required environment variables
    this.supabaseUrl = this.getRequiredEnv('VITE_SUPABASE_URL');
    this.supabaseKey = this.getRequiredEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');
    this.supabaseAnonKey = this.getRequiredEnv('VITE_SUPABASE_ANON_KEY');
    this.anthropicApiKey = this.getRequiredEnv('VITE_ANTHROPIC_API_KEY');
    
    // Optional environment variables with defaults
    this.logLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'info');
    this.defaultOutputDir = process.env.OUTPUT_DIR || 'docs';
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