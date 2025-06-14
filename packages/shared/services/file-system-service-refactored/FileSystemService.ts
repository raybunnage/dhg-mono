/**
 * File System Service - Refactored
 * 
 * Centralized file system operations for CLI pipelines with proper lifecycle management
 * Refactored to extend SingletonService with resource management and health monitoring
 * 
 * @module FileSystemService
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { SingletonService } from '../base-classes/SingletonService';

// Promisified fs functions
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

// Types
export interface FileMetadata {
  path: string;
  name: string;
  size: number;
  mtime: Date;
  isDirectory: boolean;
  hash?: string;
}

export interface WalkOptions {
  includeDirectories?: boolean;
  excludePatterns?: RegExp[];
  maxDepth?: number;
  followSymlinks?: boolean;
  onProgress?: (path: string, filesInFolder: number) => void;
  parallelism?: number; // For parallel subdirectory processing
}

export interface HashOptions {
  algorithm?: 'sha256' | 'md5' | 'sha1';
  encoding?: 'hex' | 'base64';
}

interface FileSystemServiceConfig {
  defaultMaxDepth?: number;
  defaultParallelism?: number;
  progressUpdateInterval?: number;
}

interface FileSystemServiceMetrics {
  totalOperations: number;
  filesHashed: number;
  directoriesWalked: number;
  filesFound: number;
  errors: number;
  lastOperationTime?: Date;
  averageHashTime?: number;
  averageWalkTime?: number;
}

export class FileSystemService extends SingletonService {
  private static instance: FileSystemService;
  private config: Required<FileSystemServiceConfig>;
  private metrics: FileSystemServiceMetrics = {
    totalOperations: 0,
    filesHashed: 0,
    directoriesWalked: 0,
    filesFound: 0,
    errors: 0
  };
  private activeStreams = new Set<fs.ReadStream>();

  protected constructor(config: FileSystemServiceConfig = {}) {
    super('FileSystemService');
    this.config = {
      defaultMaxDepth: config.defaultMaxDepth || 6,
      defaultParallelism: config.defaultParallelism || 5,
      progressUpdateInterval: config.progressUpdateInterval || 100
    };
  }

  public static getInstance(config?: FileSystemServiceConfig): FileSystemService {
    if (!FileSystemService.instance) {
      FileSystemService.instance = new FileSystemService(config);
    }
    return FileSystemService.instance;
  }

  // BaseService requirements
  protected async initialize(): Promise<void> {
    this.logger?.info('FileSystemService initializing...');
    
    // Test file system access
    try {
      await access(process.cwd(), fs.constants.R_OK);
      this.logger?.info('FileSystemService initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize FileSystemService:', error);
      throw new Error('Cannot access file system');
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger?.info('FileSystemService cleaning up...');
    
    // Close any active streams
    if (this.activeStreams.size > 0) {
      this.logger?.warn(`Closing ${this.activeStreams.size} active streams...`);
      for (const stream of this.activeStreams) {
        stream.destroy();
      }
      this.activeStreams.clear();
    }
    
    this.logger?.info('FileSystemService cleanup completed');
  }

  // SingletonService requirement
  protected async releaseResources(): Promise<void> {
    // Close all active streams
    for (const stream of this.activeStreams) {
      stream.destroy();
    }
    this.activeStreams.clear();
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    const startTime = Date.now();
    let healthy = true;
    const details: any = {
      metrics: { ...this.metrics },
      activeStreams: this.activeStreams.size,
      fileSystemAccess: 'unknown',
      config: this.config
    };

    try {
      // Test file system access
      await access(process.cwd(), fs.constants.R_OK | fs.constants.W_OK);
      details.fileSystemAccess = 'read-write';
      
      // Test temp directory
      const tempDir = path.join(process.cwd(), '.temp-fs-test');
      try {
        await mkdir(tempDir);
        await fs.promises.rmdir(tempDir);
        details.tempDirectoryTest = 'passed';
      } catch (error) {
        details.tempDirectoryTest = 'failed';
      }
      
      details.responseTime = `${Date.now() - startTime}ms`;
    } catch (error) {
      healthy = false;
      details.error = error instanceof Error ? error.message : 'Unknown error';
      details.fileSystemAccess = 'error';
    }

    return {
      healthy,
      details,
      timestamp: new Date()
    };
  }

  // Public API methods

  /**
   * Calculate hash of a file
   * Replaces duplicate implementations in google_sync, document pipelines
   */
  async calculateFileHash(
    filePath: string, 
    options: HashOptions = {}
  ): Promise<string | null> {
    const { algorithm = 'sha256', encoding = 'hex' } = options;
    const startTime = Date.now();
    
    this.metrics.totalOperations++;
    this.metrics.lastOperationTime = new Date();
    
    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) {
        this.logger?.warn(`Path is not a file: ${filePath}`);
        return null;
      }

      return new Promise((resolve, reject) => {
        const hash = createHash(algorithm);
        const stream = fs.createReadStream(filePath);
        
        // Track active stream
        this.activeStreams.add(stream);

        stream.on('error', (err) => {
          this.activeStreams.delete(stream);
          this.metrics.errors++;
          this.logger?.error(`Error reading file ${filePath}:`, err);
          resolve(null);
        });

        stream.on('data', (data) => hash.update(data));
        
        stream.on('end', () => {
          this.activeStreams.delete(stream);
          this.metrics.filesHashed++;
          
          // Update average hash time
          const duration = Date.now() - startTime;
          if (this.metrics.averageHashTime) {
            this.metrics.averageHashTime = (this.metrics.averageHashTime + duration) / 2;
          } else {
            this.metrics.averageHashTime = duration;
          }
          
          const result = hash.digest(encoding);
          this.logger?.debug(`Calculated ${algorithm} hash for ${filePath}: ${result.substring(0, 16)}...`);
          resolve(result);
        });
      });
    } catch (error) {
      this.metrics.errors++;
      this.logger?.error(`Error calculating hash for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Walk directory recursively and return file metadata
   * Inspired by Google Drive sync patterns for optimal performance
   */
  async walkDir(
    dir: string, 
    options: WalkOptions = {}
  ): Promise<FileMetadata[]> {
    const startTime = Date.now();
    const {
      includeDirectories = false,
      excludePatterns = [],
      maxDepth = this.config.defaultMaxDepth,
      followSymlinks = false,
      onProgress,
      parallelism = this.config.defaultParallelism
    } = options;

    this.metrics.totalOperations++;
    this.metrics.directoriesWalked++;
    this.metrics.lastOperationTime = new Date();

    const results: FileMetadata[] = [];
    const progressStats = {
      foldersScanned: 0,
      filesFound: 0,
      startTime: Date.now()
    };

    this.logger?.info(`Starting directory walk: ${dir} (maxDepth: ${maxDepth})`);

    const walk = async (currentPath: string, depth: number): Promise<void> => {
      if (depth > maxDepth) return;

      try {
        const entries = await readdir(currentPath, { withFileTypes: true });
        const filesInFolder = entries.filter(e => e.isFile()).length;
        
        // Update progress
        progressStats.foldersScanned++;
        progressStats.filesFound += filesInFolder;
        if (onProgress) {
          onProgress(currentPath, filesInFolder);
        }

        // Separate files and directories
        const files: fs.Dirent[] = [];
        const directories: fs.Dirent[] = [];
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          // Check exclusion patterns
          if (excludePatterns.some(pattern => pattern.test(fullPath))) {
            continue;
          }

          if (entry.isDirectory()) {
            directories.push(entry);
          } else if (entry.isFile() || (followSymlinks && entry.isSymbolicLink())) {
            files.push(entry);
          }
        }

        // Process files first (non-blocking)
        const filePromises = files.map(async (entry) => {
          const fullPath = path.join(currentPath, entry.name);
          try {
            const stats = await stat(fullPath);
            results.push({
              path: fullPath,
              name: entry.name,
              size: stats.size,
              mtime: stats.mtime,
              isDirectory: false
            });
          } catch (error) {
            this.logger?.warn(`Failed to stat file ${fullPath}:`, error);
            this.metrics.errors++;
          }
        });

        await Promise.all(filePromises);

        // Add directories if requested
        if (includeDirectories) {
          const dirPromises = directories.map(async (entry) => {
            const fullPath = path.join(currentPath, entry.name);
            try {
              const stats = await stat(fullPath);
              results.push({
                path: fullPath,
                name: entry.name,
                size: stats.size,
                mtime: stats.mtime,
                isDirectory: true
              });
            } catch (error) {
              this.logger?.warn(`Failed to stat directory ${fullPath}:`, error);
              this.metrics.errors++;
            }
          });
          await Promise.all(dirPromises);
        }

        // Process subdirectories in parallel batches
        const chunks: fs.Dirent[][] = [];
        for (let i = 0; i < directories.length; i += parallelism) {
          chunks.push(directories.slice(i, i + parallelism));
        }

        for (const chunk of chunks) {
          const walkPromises = chunk.map(entry => {
            const fullPath = path.join(currentPath, entry.name);
            return walk(fullPath, depth + 1);
          });
          await Promise.all(walkPromises);
        }

      } catch (error) {
        this.metrics.errors++;
        this.logger?.error(`Error walking directory ${currentPath}:`, error);
      }
    };

    await walk(dir, 0);
    
    // Update metrics
    this.metrics.filesFound += results.length;
    const duration = Date.now() - startTime;
    if (this.metrics.averageWalkTime) {
      this.metrics.averageWalkTime = (this.metrics.averageWalkTime + duration) / 2;
    } else {
      this.metrics.averageWalkTime = duration;
    }
    
    this.logger?.info(
      `Directory walk completed: ${progressStats.foldersScanned} folders, ` +
      `${results.length} items found in ${duration}ms`
    );
    
    return results;
  }

  /**
   * Get detailed file metadata
   */
  async getFileMetadata(filePath: string): Promise<FileMetadata | null> {
    this.metrics.totalOperations++;
    
    try {
      const stats = await stat(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        mtime: stats.mtime,
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      this.metrics.errors++;
      this.logger?.error(`Error getting metadata for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Ensure directory exists, creating it if necessary
   */
  async ensureDirectoryExists(dirPath: string): Promise<void> {
    this.metrics.totalOperations++;
    
    try {
      await mkdir(dirPath, { recursive: true });
      this.logger?.debug(`Ensured directory exists: ${dirPath}`);
    } catch (error) {
      // Directory might already exist, which is fine
      const stats = await stat(dirPath).catch(() => null);
      if (!stats?.isDirectory()) {
        this.metrics.errors++;
        throw new Error(`Failed to create directory ${dirPath}: ${error}`);
      }
    }
  }

  /**
   * Get relative path from one location to another
   */
  getRelativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    this.metrics.totalOperations++;
    
    try {
      const stats = await stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Check if a directory exists
   */
  async directoryExists(dirPath: string): Promise<boolean> {
    this.metrics.totalOperations++;
    
    try {
      const stats = await stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get file size in bytes
   */
  async getFileSize(filePath: string): Promise<number | null> {
    this.metrics.totalOperations++;
    
    try {
      const stats = await stat(filePath);
      return stats.size;
    } catch {
      return null;
    }
  }

  /**
   * Get file extension
   */
  getFileExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
  }

  /**
   * Check if path is absolute
   */
  isAbsolutePath(filePath: string): boolean {
    return path.isAbsolute(filePath);
  }

  /**
   * Join path segments
   */
  joinPath(...segments: string[]): string {
    return path.join(...segments);
  }

  /**
   * Get directory name from path
   */
  getDirname(filePath: string): string {
    return path.dirname(filePath);
  }

  /**
   * Get base name from path
   */
  getBasename(filePath: string, ext?: string): string {
    return path.basename(filePath, ext);
  }

  /**
   * Find files matching specific patterns (convenience method)
   * Mirrors the pattern from CLI pipeline file-service
   */
  async findFiles(
    extensions: string[] = ['.md', '.txt'],
    excludeDirs: string[] = ['node_modules', '.git', 'dist', 'build'],
    includeHash: boolean = false
  ): Promise<FileMetadata[]> {
    const excludePatterns = excludeDirs.map(dir => new RegExp(`${dir}`));
    
    const files = await this.walkDir(process.cwd(), {
      excludePatterns,
      includeDirectories: false
    });
    
    // Filter by extensions
    const filtered = files.filter(file => {
      const ext = this.getFileExtension(file.path);
      return extensions.includes(ext);
    });
    
    // Add hashes if requested
    if (includeHash) {
      for (const file of filtered) {
        const hash = await this.calculateFileHash(file.path);
        if (hash !== null) {
          file.hash = hash;
        }
      }
    }
    
    return filtered;
  }

  /**
   * Find documentation files (convenience method)
   * Common pattern used across multiple pipelines
   */
  async findDocumentationFiles(includeHash: boolean = false): Promise<FileMetadata[]> {
    return this.findFiles(
      ['.md', '.txt', '.pdf', '.docx', '.doc', '.rtf'],
      [
        'node_modules', 'dist', 'build', '.git',
        'backup', 'archive', '_archive', 'temp',
        'logs', 'transcripts', 'debug-logs'
      ],
      includeHash
    );
  }

  /**
   * Find script files (convenience method)
   */
  async findScriptFiles(includeHash: boolean = false): Promise<FileMetadata[]> {
    return this.findFiles(
      ['.sh', '.js', '.ts', '.py', '.mjs', '.cjs'],
      [
        'node_modules', 'dist', 'build', '.git',
        'backup', 'archive', '_archive'
      ],
      includeHash
    );
  }

  /**
   * Progress tracking helper for directory walking
   * Returns a progress function compatible with walkDir options
   */
  createProgressTracker(label: string = 'Scanning'): (path: string, filesInFolder: number) => void {
    const stats = {
      foldersScanned: 0,
      filesFound: 0,
      startTime: Date.now(),
      lastUpdate: 0
    };

    return (currentPath: string, filesInFolder: number) => {
      stats.foldersScanned++;
      stats.filesFound += filesInFolder;
      
      // Only update display based on configured interval
      const now = Date.now();
      if (now - stats.lastUpdate < this.config.progressUpdateInterval) return;
      stats.lastUpdate = now;
      
      const elapsed = (now - stats.startTime) / 1000;
      const rate = stats.foldersScanned / elapsed;
      
      // Clear previous line and show progress
      process.stdout.write('\r\x1b[K'); // Clear line
      process.stdout.write(
        `📂 ${label}: ${stats.foldersScanned} folders | ` +
        `📄 ${stats.filesFound} files | ` +
        `⚡ ${rate.toFixed(1)} folders/sec | ` +
        `📍 ${currentPath.slice(-50)}`
      );
    };
  }

  /**
   * Get service metrics
   */
  getMetrics(): FileSystemServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalOperations: 0,
      filesHashed: 0,
      directoriesWalked: 0,
      filesFound: 0,
      errors: 0
    };
    this.logger?.info('FileSystemService metrics reset');
  }
}

export default FileSystemService;