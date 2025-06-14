/**
 * Logger Service
 * 
 * Provides consistent logging across all services with configurable levels,
 * formatting, and outputs. This is a browser-safe implementation that works
 * in both Node.js and browser environments.
 * 
 * Refactored to extend SingletonService for proper lifecycle management.
 */
import { SingletonService } from '../base-classes/SingletonService';
import { LogLevel, LoggerConfig } from '../logger-original/logger.types';

// Re-export for convenience
export { LogLevel } from '../logger-original/logger.types';

// Extended types for refactored service
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

// Extended configuration with more options
export interface ExtendedLoggerConfig extends LoggerConfig {
  maxLogSize?: number;          // Max size of in-memory log buffer
  enableBuffering?: boolean;    // Buffer logs for batch processing
  colorize?: boolean;          // Colorize console output (Node.js only)
  prettyPrint?: boolean;       // Pretty print JSON objects
  serviceName?: string;        // Service name prefix
  environment?: string;        // Environment (dev, staging, prod)
}

// Log statistics
interface LogStatistics {
  [LogLevel.ERROR]: number;
  [LogLevel.WARN]: number;
  [LogLevel.INFO]: number;
  [LogLevel.DEBUG]: number;
  total: number;
  firstLogTime?: Date;
  lastLogTime?: Date;
}

/**
 * LoggerService provides centralized logging with enhanced features.
 * 
 * @example
 * ```typescript
 * const logger = LoggerService.getInstance({
 *   level: LogLevel.INFO,
 *   enableBuffering: true,
 *   prettyPrint: true
 * });
 * await logger.ensureInitialized();
 * 
 * logger.info('Application started', { version: '1.0.0' });
 * logger.error('Something went wrong', new Error('Failed'));
 * ```
 */
export class LoggerService extends SingletonService {
  private static instance: LoggerService;
  private config: ExtendedLoggerConfig;
  private context: Record<string, any> = {};
  private logBuffer: LogEntry[] = [];
  private statistics: LogStatistics = {
    [LogLevel.ERROR]: 0,
    [LogLevel.WARN]: 0,
    [LogLevel.INFO]: 0,
    [LogLevel.DEBUG]: 0,
    total: 0
  };
  
  protected constructor(config?: ExtendedLoggerConfig) {
    // Use console logger for the base class itself to avoid recursion
    super('LoggerService', {
      info: (msg: string) => console.log(`[LoggerService] ${msg}`),
      error: (msg: string, error?: any) => console.error(`[LoggerService] ${msg}`, error || ''),
      debug: (msg: string) => console.debug(`[LoggerService] ${msg}`),
      warn: (msg: string) => console.warn(`[LoggerService] ${msg}`)
    });
    
    this.config = {
      level: config?.level || LogLevel.INFO,
      includeTimestamp: config?.includeTimestamp !== false,
      logToFile: false, // Always false for browser compatibility
      maxLogSize: config?.maxLogSize || 1000,
      enableBuffering: config?.enableBuffering || false,
      colorize: config?.colorize && typeof process !== 'undefined',
      prettyPrint: config?.prettyPrint || false,
      serviceName: config?.serviceName,
      environment: config?.environment || process?.env?.NODE_ENV || 'development'
    };
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(config?: ExtendedLoggerConfig): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService(config);
    } else if (config) {
      // Update configuration if provided
      LoggerService.instance.updateConfig(config);
    }
    return LoggerService.instance;
  }

  /**
   * Ensure the service is initialized (public wrapper for protected method)
   */
  public async ensureInitialized(): Promise<void> {
    await super.ensureInitialized();
  }

  /**
   * Initialize the service
   */
  protected async initialize(): Promise<void> {
    console.log('[LoggerService] Initializing with config:', {
      level: this.config.level,
      environment: this.config.environment,
      buffering: this.config.enableBuffering,
      maxLogSize: this.config.maxLogSize
    });
    
    // Set up any necessary initialization
    if (this.config.enableBuffering) {
      // Set up periodic flush if buffering is enabled
      setInterval(() => this.flushBuffer(), 5000);
    }
  }

  /**
   * Release resources
   */
  protected async releaseResources(): Promise<void> {
    // Flush any remaining buffered logs
    if (this.config.enableBuffering && this.logBuffer.length > 0) {
      this.flushBuffer();
    }
    
    console.log('[LoggerService] Shutdown complete. Total logs:', this.statistics.total);
  }

  /**
   * Health check for the service
   */
  public async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return {
      healthy: true,
      details: {
        level: this.config.level,
        environment: this.config.environment,
        bufferSize: this.logBuffer.length,
        statistics: { ...this.statistics },
        contextKeys: Object.keys(this.context)
      }
    };
  }
  
  /**
   * Update logger configuration
   */
  public updateConfig(config: Partial<ExtendedLoggerConfig>): void {
    this.config = { ...this.config, ...config };
    // Force disable file logging for browser compatibility
    this.config.logToFile = false;
    
    if (this.config.maxLogSize && this.logBuffer.length > this.config.maxLogSize) {
      // Trim buffer if it exceeds new max size
      this.logBuffer = this.logBuffer.slice(-this.config.maxLogSize);
    }
  }
  
  /**
   * Set context data that will be included with each log
   */
  public setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }
  
  /**
   * Clear specific context key or all context
   */
  public clearContext(key?: string): void {
    if (key) {
      delete this.context[key];
    } else {
      this.context = {};
    }
  }

  /**
   * Get current context
   */
  public getContext(): Record<string, any> {
    return { ...this.context };
  }
  
  /**
   * Format log entry with enhanced formatting
   */
  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, message, context } = entry;
    
    let formattedMessage = '';
    
    // Add service name if configured
    if (this.config.serviceName) {
      formattedMessage += `[${this.config.serviceName}] `;
    }
    
    // Add timestamp if configured
    if (this.config.includeTimestamp) {
      formattedMessage += `${timestamp} `;
    }
    
    // Add level with optional colorization
    const levelStr = `[${level}]`;
    if (this.config.colorize && typeof process !== 'undefined') {
      formattedMessage += this.colorizeLevel(levelStr, level) + ' ';
    } else {
      formattedMessage += levelStr + ' ';
    }
    
    // Add message
    formattedMessage += message;
    
    // Add context if present
    if (context && Object.keys(context).length > 0) {
      if (this.config.prettyPrint) {
        formattedMessage += '\n' + JSON.stringify(context, null, 2);
      } else {
        formattedMessage += ' ' + JSON.stringify(context);
      }
    }
    
    return formattedMessage;
  }

  /**
   * Colorize log level for console output (Node.js only)
   */
  private colorizeLevel(levelStr: string, level: LogLevel): string {
    // Simple ANSI color codes
    const colors = {
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.INFO]: '\x1b[36m',  // Cyan
      [LogLevel.DEBUG]: '\x1b[90m'  // Gray
    };
    const reset = '\x1b[0m';
    
    return colors[level] + levelStr + reset;
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
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.mergeContext(additionalContext)
    };
    
    // Add environment if configured
    if (this.config.environment && this.config.environment !== 'development') {
      entry.context = { ...entry.context, env: this.config.environment };
    }
    
    return entry;
  }

  /**
   * Merge contexts
   */
  private mergeContext(additionalContext?: any): any {
    if (!additionalContext && Object.keys(this.context).length === 0) {
      return undefined;
    }
    
    return additionalContext 
      ? { ...this.context, ...additionalContext } 
      : { ...this.context };
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
    
    // Update statistics
    this.updateStatistics(level);
    
    // Buffer or write immediately
    if (this.config.enableBuffering) {
      this.addToBuffer(entry);
    } else {
      this.writeToConsole(entry);
    }
  }

  /**
   * Update log statistics
   */
  private updateStatistics(level: LogLevel): void {
    this.statistics[level]++;
    this.statistics.total++;
    
    if (!this.statistics.firstLogTime) {
      this.statistics.firstLogTime = new Date();
    }
    this.statistics.lastLogTime = new Date();
  }

  /**
   * Add log entry to buffer
   */
  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Trim buffer if it exceeds max size
    if (this.config.maxLogSize && this.logBuffer.length > this.config.maxLogSize) {
      this.logBuffer.shift(); // Remove oldest entry
    }
    
    // Immediately flush if buffer is getting full
    if (this.logBuffer.length >= (this.config.maxLogSize || 1000) * 0.9) {
      this.flushBuffer();
    }
  }

  /**
   * Flush buffered logs
   */
  public flushBuffer(): void {
    if (this.logBuffer.length === 0) return;
    
    // Write all buffered logs
    this.logBuffer.forEach(entry => this.writeToConsole(entry));
    
    // Clear buffer
    this.logBuffer = [];
  }
  
  /**
   * Log error message with enhanced error formatting
   */
  public error(message: string, error?: any, additionalContext?: any): void {
    const context = {
      ...additionalContext,
      ...(error ? { error: this.formatError(error) } : {})
    };
    this.log(LogLevel.ERROR, message, context);
  }
  
  /**
   * Format error for logging with more details
   */
  private formatError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').map(line => line.trim()),
        ...(error.cause ? { cause: this.formatError(error.cause) } : {})
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
   * Create a child logger with additional context
   */
  public child(context: Record<string, any>): ChildLogger {
    return new ChildLogger(this, context);
  }

  /**
   * Get log statistics
   */
  public getStatistics(): LogStatistics {
    return { ...this.statistics };
  }

  /**
   * Reset statistics
   */
  public resetStatistics(): void {
    this.statistics = {
      [LogLevel.ERROR]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.DEBUG]: 0,
      total: 0,
      firstLogTime: undefined,
      lastLogTime: undefined
    };
  }

  /**
   * Get buffered logs (if buffering is enabled)
   */
  public getBufferedLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Get buffer (alias for getBufferedLogs for compatibility)
   */
  public getBuffer(): LogEntry[] {
    return this.getBufferedLogs();
  }

  /**
   * Update configuration
   */
  public configure(config: Partial<ExtendedLoggerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart flush interval if needed
    if (config.buffer?.flushInterval) {
      this.stopFlushInterval();
      this.startFlushInterval();
    }
  }

  /**
   * Clear buffered logs
   */
  public clearBuffer(): void {
    this.logBuffer = [];
  }
}

/**
 * Child logger with additional context
 */
export class ChildLogger {
  constructor(
    private parent: LoggerService,
    private childContext: Record<string, any>
  ) {}

  error(message: string, error?: any, context?: any): void {
    this.parent.error(message, error, { ...this.childContext, ...context });
  }

  warn(message: string, context?: any): void {
    this.parent.warn(message, { ...this.childContext, ...context });
  }

  info(message: string, context?: any): void {
    this.parent.info(message, { ...this.childContext, ...context });
  }

  debug(message: string, context?: any): void {
    this.parent.debug(message, { ...this.childContext, ...context });
  }

  child(context: Record<string, any>): ChildLogger {
    return new ChildLogger(this.parent, { ...this.childContext, ...context });
  }
}

// Create default logger instance for backwards compatibility
export const logger = LoggerService.getInstance();