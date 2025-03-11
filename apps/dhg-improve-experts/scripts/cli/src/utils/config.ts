import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Logger, LogLevel } from './logger';
import { AppError } from './error-handler';

class Config {
  private static instance: Config;
  
  supabaseUrl: string;
  supabaseKey: string;
  anthropicApiKey: string;
  logLevel: LogLevel;
  defaultOutputDir: string;
  
  private constructor() {
    // Load environment variables - first try .env file in current directory
    dotenv.config();
    
    // Try to load from app-specific location if exists
    try {
      const appEnvPath = path.resolve(process.cwd(), 'apps/dhg-improve-experts/.env.development');
      if (fs.existsSync(appEnvPath)) {
        Logger.debug(`Loading environment from: ${appEnvPath}`);
        dotenv.config({ path: appEnvPath });
      }
    } catch (error) {
      Logger.warn('Failed to load app-specific environment file', error);
    }
    
    // Required environment variables
    this.supabaseUrl = this.getRequiredEnv('VITE_SUPABASE_URL');
    this.supabaseKey = this.getRequiredEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');
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