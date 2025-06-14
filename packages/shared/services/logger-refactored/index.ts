// Export the refactored LoggerService
export { LoggerService } from './LoggerService';
export { logger } from './LoggerService';
export type { 
  ExtendedLoggerConfig,
  LogEntry,
  LogStatistics,
  LogLevel
} from './LoggerService';

// For compatibility
export type { LoggerConfig } from '../logger-original/logger.types';