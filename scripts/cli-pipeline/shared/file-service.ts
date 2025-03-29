/**
 * Shared File Service
 * 
 * Provides common file operations for various pipelines.
 * This service handles file scanning, hashing, and metadata operations
 * that can be reused across document, script, and other pipelines.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

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
 * File metadata interface
 */
export interface FileMetadata {
  path: string;
  file_size: number;
  mtime: Date;
  hash?: string;
}

/**
 * Configuration options for the file service
 */
export interface FileServiceOptions {
  rootDir?: string;
  logLevel?: LogLevel;
}

/**
 * File Service implementation
 */
export class FileService {
  private rootDir: string;
  private logLevel: LogLevel;
  
  /**
   * Create a new file service instance
   */
  constructor(options?: FileServiceOptions) {
    // Set root directory
    this.rootDir = options?.rootDir || process.cwd();
    
    // Set log level
    this.logLevel = options?.logLevel || 
      (process.env.LOG_LEVEL as LogLevel) || 
      LogLevel.INFO;
    
    this.log(LogLevel.INFO, 'File Service initialized');
  }
  
  /**
   * Log messages with appropriate level
   */
  private log(level: LogLevel, message: string, error?: any): void {
    // Only log messages at or above the configured level
    const levels = Object.values(LogLevel);
    if (levels.indexOf(level) > levels.indexOf(this.logLevel)) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${level}] ${message}`;
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(`${timestamp} ${logMessage}`, error || '');
        break;
      case LogLevel.WARN:
        console.warn(`${timestamp} ${logMessage}`);
        break;
      case LogLevel.INFO:
        console.log(`${timestamp} ${logMessage}`);
        break;
      case LogLevel.DEBUG:
        console.debug(`${timestamp} ${logMessage}`);
        break;
    }
  }
  
  /**
   * Create directory if it doesn't exist
   */
  public createDirectoryIfNeeded(dirPath: string): boolean {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        this.log(LogLevel.DEBUG, `Created directory: ${dirPath}`);
      }
      return true;
    } catch (error) {
      this.log(LogLevel.ERROR, `Error creating directory ${dirPath}:`, error);
      return false;
    }
  }
  
  /**
   * Calculate file hash
   */
  public calculateFileHash(filePath: string): string | null {
    try {
      const fileContent = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(fileContent).digest('hex');
    } catch (error) {
      this.log(LogLevel.ERROR, `Error calculating hash for ${filePath}:`, error);
      return null;
    }
  }
  
  /**
   * Get file metadata
   */
  public getFileMetadata(filePath: string, includeHash: boolean = false): FileMetadata | null {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        this.log(LogLevel.ERROR, `File does not exist: ${filePath}`);
        return null;
      }
      
      // Get file stats
      const stats = fs.statSync(filePath);
      
      // Create metadata object
      const metadata: FileMetadata = {
        path: path.relative(this.rootDir, filePath),
        file_size: stats.size,
        mtime: stats.mtime
      };
      
      // Calculate hash if requested
      if (includeHash) {
        metadata.hash = this.calculateFileHash(filePath);
      }
      
      return metadata;
    } catch (error) {
      this.log(LogLevel.ERROR, `Error getting metadata for ${filePath}:`, error);
      return null;
    }
  }
  
  /**
   * Walk directory recursively and find files matching patterns
   * @param dir Directory to walk
   * @param includePatterns Array of file extensions to include (e.g., ['.md', '.txt'])
   * @param excludeDirs Array of directories to exclude
   * @param includeHash Whether to calculate file hashes
   */
  public walkDir(
    dir: string = this.rootDir,
    includePatterns: string[] = ['.md', '.txt', '.pdf', '.docx', '.doc', '.rtf'],
    excludeDirs: string[] = [
      'node_modules', 'dist', 'build', '.git',
      'file_types', 'backup', 'archive', '_archive',
      'script-analysis-results', 'reports'
    ],
    includeHash: boolean = false
  ): FileMetadata[] {
    try {
      const result: FileMetadata[] = [];
      
      // Check if directory exists and is accessible
      if (!fs.existsSync(dir)) {
        this.log(LogLevel.ERROR, `Directory does not exist: ${dir}`);
        return result;
      }
      
      // Read directory contents
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        
        try {
          const stat = fs.statSync(filePath);
          
          // Handle directories (recursive scanning)
          if (stat.isDirectory()) {
            if (
              !file.startsWith('.') &&
              !excludeDirs.includes(file) &&
              !filePath.includes('backup') &&
              !filePath.includes('archive')
            ) {
              // Recursively walk subdirectories
              const subDirFiles = this.walkDir(filePath, includePatterns, excludeDirs, includeHash);
              result.push(...subDirFiles);
            }
          } else if (stat.isFile()) {
            // Check if file matches include patterns
            const ext = path.extname(file).toLowerCase();
            if (includePatterns.includes(ext)) {
              // Get file metadata
              const metadata: FileMetadata = {
                path: path.relative(this.rootDir, filePath),
                file_size: stat.size,
                mtime: stat.mtime
              };
              
              // Calculate hash if requested
              if (includeHash) {
                metadata.hash = this.calculateFileHash(filePath);
              }
              
              result.push(metadata);
            }
          }
        } catch (error) {
          this.log(LogLevel.ERROR, `Error processing file ${filePath}:`, error);
          // Continue with other files
        }
      }
      
      return result;
    } catch (error) {
      this.log(LogLevel.ERROR, `Error walking directory ${dir}:`, error);
      return [];
    }
  }
  
  /**
   * Find files matching specific criteria
   * @param extensions Array of file extensions to include
   * @param excludeDirs Array of directories to exclude
   * @param includeHash Whether to calculate file hashes
   */
  public findFiles(
    extensions: string[] = ['.md', '.txt'],
    excludeDirs: string[] = ['node_modules', '.git'],
    includeHash: boolean = false
  ): FileMetadata[] {
    this.log(LogLevel.INFO, `Finding files with extensions: ${extensions.join(', ')}`);
    return this.walkDir(this.rootDir, extensions, excludeDirs, includeHash);
  }
  
  /**
   * Find documentation files (convenience method)
   */
  public findDocumentationFiles(includeHash: boolean = false): FileMetadata[] {
    return this.findFiles(
      ['.md', '.txt', '.pdf', '.docx', '.doc', '.rtf'],
      [
        'node_modules', 'dist', 'build', '.git',
        'file_types', 'backup', 'archive', '_archive',
        'script-analysis-results', 'reports'
      ],
      includeHash
    );
  }
  
  /**
   * Find script files (convenience method)
   */
  public findScriptFiles(includeHash: boolean = false): FileMetadata[] {
    return this.findFiles(
      ['.sh', '.js', '.ts', '.py'],
      [
        'node_modules', 'dist', 'build', '.git',
        'file_types', 'backup', 'archive', '_archive'
      ],
      includeHash
    );
  }
  
  /**
   * Read file content
   */
  public readFileContent(filePath: string): string | null {
    try {
      if (!fs.existsSync(filePath)) {
        this.log(LogLevel.ERROR, `File does not exist: ${filePath}`);
        return null;
      }
      
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      this.log(LogLevel.ERROR, `Error reading file ${filePath}:`, error);
      return null;
    }
  }
}

// Create singleton instance
export const fileService = new FileService();