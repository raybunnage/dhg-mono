// Conditional import for winston - only in Node.js environments
let winston: any = null;
try {
  if (typeof process !== 'undefined' && process.env && !(process as any).browser) {
    winston = require('winston');
  }
} catch (e) {
  // Winston not available or failed to load in browser
}

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
 * Logger class for consistent logging across the application
 * Works in both Node.js and browser environments
 */
export class Logger {
  private static logger: any;
  private static currentLevel: LogLevel = LogLevel.INFO;
  private static isBrowser: boolean = typeof window !== 'undefined';

  /**
   * Initialize the logger
   */
  private static initialize() {
    if (!this.logger) {
      if (this.isBrowser || !winston) {
        // Browser environment or winston not available - use console
        this.logger = {
          error: (message: string, meta?: any) => console.error(`[ERROR]: ${message}`, meta || ''),
          warn: (message: string, meta?: any) => console.warn(`[WARN]: ${message}`, meta || ''),
          info: (message: string, meta?: any) => console.info(`[INFO]: ${message}`, meta || ''),
          debug: (message: string, meta?: any) => console.debug(`[DEBUG]: ${message}`, meta || ''),
          level: this.currentLevel
        };
      } else {
        // Node.js environment with winston available
        this.logger = winston.createLogger({
          level: this.currentLevel,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(
              (info: any) => `${info.timestamp} [${info.level}]: ${info.message}`
            )
          ),
          transports: [
            new winston.transports.Console(),
          ],
        });
      }
    }
  }

  /**
   * Set the log level
   * @param level The log level to set
   */
  public static setLevel(level: LogLevel) {
    this.currentLevel = level;
    this.initialize();
    if (this.logger.level !== undefined) {
      this.logger.level = level;
    }
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param error Optional error object
   */
  public static error(message: string, error?: any) {
    this.initialize();
    if (error) {
      this.logger.error(`${message}`, error);
    } else {
      this.logger.error(message);
    }
  }

  /**
   * Log a warning message
   * @param message The message to log
   */
  public static warn(message: string) {
    this.initialize();
    this.logger.warn(message);
  }

  /**
   * Log an info message
   * @param message The message to log
   */
  public static info(message: string) {
    this.initialize();
    this.logger.info(message);
  }

  /**
   * Log a debug message
   * @param message The message to log
   */
  public static debug(message: string) {
    this.initialize();
    this.logger.debug(message);
  }
}