// Re-export from refactored service for backwards compatibility
export { 
  LoggerService,
  logger,
  type ExtendedLoggerConfig,
  type LogEntry,
  type LogStatistics,
  type LogLevel
} from '../logger-refactored';

// Re-export original types for compatibility
export type { LoggerConfig } from '../logger-original/logger.types';