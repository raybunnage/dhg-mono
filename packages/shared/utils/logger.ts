import winston from 'winston';

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
 */
export class Logger {
  private static logger: winston.Logger;
  private static currentLevel: LogLevel = LogLevel.INFO;

  /**
   * Initialize the logger
   */
  private static initialize() {
    if (!this.logger) {
      this.logger = winston.createLogger({
        level: this.currentLevel,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(
            (info) => `${info.timestamp} [${info.level}]: ${info.message}`
          )
        ),
        transports: [
          new winston.transports.Console(),
        ],
      });
    }
  }

  /**
   * Set the log level
   * @param level The log level to set
   */
  public static setLevel(level: LogLevel) {
    this.currentLevel = level;
    this.initialize();
    this.logger.level = level;
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