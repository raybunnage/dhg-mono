/**
 * Logger Service Types
 * Defines types and interfaces for the Logger service
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
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  includeTimestamp?: boolean;
  logToFile?: boolean;
  logFilePath?: string;
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
}