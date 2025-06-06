/**
 * Logger Service
 * 
 * Provides consistent logging across all services with configurable levels,
 * formatting, and outputs.
 */
import * as fs from 'fs';
import * as path from 'path';
import { LogLevel, LoggerConfig } from '../interfaces/types';

/**
 * Log entry structure
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
}

/**
 * Logger Service implementation
 */
export class LoggerService {
  private static instance: LoggerService;
  private config: LoggerConfig;
  private context: Record<string, any> = {};
  private logFile: fs.WriteStream | null = null;
  
  /**
   * Create a new logger service
   * Private constructor to enforce singleton pattern
   */
  private constructor(config: LoggerConfig) {
    this.config = {
      level: config.level || LogLevel.INFO,
      includeTimestamp: config.includeTimestamp !== false, // Default to true
      logToFile: config.logToFile || false,
      logFilePath: config.logFilePath
    };
    
    // Initialize log file if needed
    if (this.config.logToFile && this.config.logFilePath) {
      this.initializeLogFile();
    }
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(config?: LoggerConfig): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService(config || { level: LogLevel.INFO });
    } else if (config) {
      // Update configuration if provided
      LoggerService.instance.updateConfig(config);
    }
    return LoggerService.instance;
  }
  
  /**
   * Update logger configuration
   */
  public updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Reinitialize log file if configuration changed
    if (this.config.logToFile && this.config.logFilePath) {
      this.initializeLogFile();
    } else if (!this.config.logToFile && this.logFile) {
      this.logFile.end();
      this.logFile = null;
    }
  }
  
  /**
   * Initialize log file
   */
  private initializeLogFile(): void {
    if (this.logFile) {
      this.logFile.end();
    }
    
    const logDir = path.dirname(this.config.logFilePath!);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Create or append to log file
    this.logFile = fs.createWriteStream(this.config.logFilePath!, { flags: 'a' });
  }
  
  /**
   * Set context data that will be included with each log
   */
  public setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }
  
  /**
   * Clear specific context key
   */
  public clearContext(key?: string): void {
    if (key) {
      delete this.context[key];
    } else {
      this.context = {};
    }
  }
  
  /**
   * Format log entry
   */
  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, message, context } = entry;
    
    let formattedMessage = '';
    
    if (this.config.includeTimestamp) {
      formattedMessage += `${timestamp} `;
    }
    
    formattedMessage += `[${level}] ${message}`;
    
    if (context && Object.keys(context).length > 0) {
      formattedMessage += ` ${JSON.stringify(context)}`;
    }
    
    return formattedMessage;
  }
  
  /**
   * Write log entry to file
   */
  private writeToFile(entry: LogEntry): void {
    if (this.logFile) {
      const formattedEntry = this.formatLogEntry(entry) + '\n';
      this.logFile.write(formattedEntry);
    }
  }
  
  /**
   * Write log entry to console
   */
  private writeToConsole(entry: LogEntry): void {
    const formattedEntry = this.formatLogEntry(entry);
    
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(formattedEntry);
        break;
      case LogLevel.WARN:
        console.warn(formattedEntry);
        break;
      case LogLevel.INFO:
        console.info(formattedEntry);
        break;
      case LogLevel.DEBUG:
        console.debug(formattedEntry);
        break;
    }
  }
  
  /**
   * Create log entry
   */
  private createLogEntry(level: LogLevel, message: string, additionalContext?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: additionalContext ? { ...this.context, ...additionalContext } : this.context
    };
  }
  
  /**
   * Log a message at specified level
   */
  private log(level: LogLevel, message: string, additionalContext?: any): void {
    // Skip logging if level is below configured level
    const levels = Object.values(LogLevel);
    if (levels.indexOf(level) > levels.indexOf(this.config.level)) {
      return;
    }
    
    const entry = this.createLogEntry(level, message, additionalContext);
    
    // Write to console
    this.writeToConsole(entry);
    
    // Write to file if configured
    if (this.config.logToFile) {
      this.writeToFile(entry);
    }
  }
  
  /**
   * Log error message
   */
  public error(message: string, error?: any): void {
    const context = error ? { error: this.formatError(error) } : undefined;
    this.log(LogLevel.ERROR, message, context);
  }
  
  /**
   * Format error for logging
   */
  private formatError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    return error;
  }
  
  /**
   * Log warning message
   */
  public warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }
  
  /**
   * Log info message
   */
  public info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }
  
  /**
   * Log debug message
   */
  public debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }
  
  /**
   * Close log file if open
   */
  public close(): void {
    if (this.logFile) {
      this.logFile.end();
      this.logFile = null;
    }
  }
}

// Create default logger instance
export const logger = LoggerService.getInstance();