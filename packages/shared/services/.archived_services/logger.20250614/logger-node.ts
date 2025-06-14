/**
 * Node.js Logger Service
 * 
 * Extends the base Logger with Node.js-specific features like file logging.
 * This should only be imported in Node.js environments (CLI scripts, servers).
 */
import * as fs from 'fs';
import * as path from 'path';
import { LoggerService } from './logger';
import { LogLevel, LoggerConfig, LogEntry } from './logger.types';

/**
 * Node.js-specific Logger Service implementation
 * Adds file logging capabilities to the base logger
 */
export class NodeLoggerService extends LoggerService {
  private static nodeInstance: NodeLoggerService;
  private logFile: fs.WriteStream | null = null;
  private nodeConfig: LoggerConfig;
  
  /**
   * Create a new Node logger service
   * Private constructor to enforce singleton pattern
   */
  private constructor(config: LoggerConfig) {
    super(config);
    this.nodeConfig = config;
    
    // Initialize log file if needed
    if (this.nodeConfig.logToFile && this.nodeConfig.logFilePath) {
      this.initializeLogFile();
    }
  }
  
  /**
   * Get singleton instance for Node.js environments
   */
  public static getInstance(config?: LoggerConfig): NodeLoggerService {
    if (!NodeLoggerService.nodeInstance) {
      NodeLoggerService.nodeInstance = new NodeLoggerService(config || { level: LogLevel.INFO });
    } else if (config) {
      // Update configuration if provided
      NodeLoggerService.nodeInstance.updateConfig(config);
    }
    return NodeLoggerService.nodeInstance;
  }
  
  /**
   * Update logger configuration
   */
  public updateConfig(config: Partial<LoggerConfig>): void {
    super.updateConfig(config);
    this.nodeConfig = { ...this.nodeConfig, ...config };
    
    // Reinitialize log file if configuration changed
    if (this.nodeConfig.logToFile && this.nodeConfig.logFilePath) {
      this.initializeLogFile();
    } else if (!this.nodeConfig.logToFile && this.logFile) {
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
    
    const logDir = path.dirname(this.nodeConfig.logFilePath!);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Create or append to log file
    this.logFile = fs.createWriteStream(this.nodeConfig.logFilePath!, { flags: 'a' });
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
   * Format log entry (protected to allow access from subclass)
   */
  protected formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, message, context } = entry;
    
    let formattedMessage = '';
    
    if (this.nodeConfig.includeTimestamp !== false) {
      formattedMessage += `${timestamp} `;
    }
    
    formattedMessage += `[${level}] ${message}`;
    
    if (context && Object.keys(context).length > 0) {
      formattedMessage += ` ${JSON.stringify(context)}`;
    }
    
    return formattedMessage;
  }
  
  /**
   * Override log method to add file writing
   */
  protected log(level: LogLevel, message: string, additionalContext?: any): void {
    // Call parent log method
    super.log(level, message, additionalContext);
    
    // Additionally write to file if configured
    if (this.nodeConfig.logToFile) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context: additionalContext
      };
      this.writeToFile(entry);
    }
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

// Create default Node logger instance
export const nodeLogger = NodeLoggerService.getInstance();