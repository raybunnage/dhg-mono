import { Logger } from './logger';

/**
 * Utility functions for logging
 */
export class LoggerUtils {
  /**
   * Logs an error message
   * @param message The message to log
   * @param error Optional error object (will be stringified)
   */
  static error(message: string, error?: any): void {
    if (error) {
      const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
      Logger.error(`${message}: ${errorStr}`);
    } else {
      Logger.error(message);
    }
  }

  /**
   * Logs a debug message
   * @param message The message to log
   * @param data Optional data to log (will be stringified)
   */
  static debug(message: string, data?: any): void {
    if (data) {
      const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
      Logger.debug(`${message}: ${dataStr}`);
    } else {
      Logger.debug(message);
    }
  }

  /**
   * Logs an info message
   * @param message The message to log
   * @param data Optional data to log (will be stringified)
   */
  static info(message: string, data?: any): void {
    if (data) {
      const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
      Logger.info(`${message}: ${dataStr}`);
    } else {
      Logger.info(message);
    }
  }

  /**
   * Logs a warning message
   * @param message The message to log
   * @param data Optional data to log (will be stringified)
   */
  static warn(message: string, data?: any): void {
    if (data) {
      const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
      Logger.warn(`${message}: ${dataStr}`);
    } else {
      Logger.warn(message);
    }
  }
}