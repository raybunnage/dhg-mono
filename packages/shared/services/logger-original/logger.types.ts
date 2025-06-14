/**
 * Logger Types
 * 
 * Shared types for the logger service.
 */

/**
 * Log levels for the application
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * Basic logger configuration
 */
export interface LoggerConfig {
  level?: LogLevel;
  includeTimestamp?: boolean;
  logToFile?: boolean;
}