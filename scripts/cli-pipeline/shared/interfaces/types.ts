/**
 * Common type definitions for shared services
 */

/**
 * Log levels for the service
 */
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

/**
 * File metadata interface
 */
export interface FileMetadata {
  path: string;
  file_size: number;
  mtime: Date;
  hash?: string;
  content?: string;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  url: string;
  key: string;
  autoConnect?: boolean;
}

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  nodeEnv: string;
  supabaseUrl: string;
  supabaseKey: string;
  claudeApiKey: string;
  claudeApiBaseUrl?: string;
  claudeApiVersion?: string;
  logLevel: LogLevel;
  rootDir: string;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  includeTimestamp?: boolean;
  logToFile?: boolean;
  logFilePath?: string;
}

/**
 * CLI command option
 */
export interface CommandOption {
  name: string;
  shortName?: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  default?: any;
}

/**
 * CLI command definition
 */
export interface Command {
  name: string;
  description: string;
  options?: CommandOption[];
  action: (args: any) => Promise<void>;
}