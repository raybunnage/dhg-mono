import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);

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

/**
 * FileSystemService - Centralized file system operations for CLI pipelines
 * 
 * This service consolidates common file system operations that were previously
 * duplicated across multiple CLI pipelines including google_sync, document,
 * media-processing, and scripts pipelines.
 */
export class FileSystemService {
  private static instance: FileSystemService;

  private constructor() {}

  static getInstance(): FileSystemService {
    if (!FileSystemService.instance) {
      FileSystemService.instance = new FileSystemService();
    }
    return FileSystemService.instance;
  }

  /**
   * Calculate hash of a file
   * Replaces duplicate implementations in google_sync, document pipelines
   */
  async calculateFileHash(
    filePath: string, 
    options: HashOptions = {}
  ): Promise<string | null> {
    const { algorithm = 'sha256', encoding = 'hex' } = options;
    
    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) {
        return null;
      }

      return new Promise((resolve, reject) => {
        const hash = createHash(algorithm);
        const stream = fs.createReadStream(filePath);

        stream.on('error', (err) => {
          console.error(`Error reading file ${filePath}:`, err);
          resolve(null);
        });

        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest(encoding)));
      });
    } catch (error) {
      console.error(`Error calculating hash for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Walk directory recursively and return file metadata
   * Inspired by Google Drive sync patterns for optimal performance
   * Replaces duplicate implementations in document, google_sync pipelines
   */
  async walkDir(
    dir: string, 
    options: WalkOptions = {}
  ): Promise<FileMetadata[]> {
    const {
      includeDirectories = false,
      excludePatterns = [],
      maxDepth = 6, // Default from Google Drive sync
      followSymlinks = false,
      onProgress,
      parallelism = 5 // Process up to 5 subdirectories in parallel
    } = options;

    const results: FileMetadata[] = [];
    const progressStats = {
      foldersScanned: 0,
      filesFound: 0,
      startTime: Date.now()
    };

    async function walk(currentPath: string, depth: number): Promise<void> {
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
          const stats = await stat(fullPath);
          results.push({
            path: fullPath,
            name: entry.name,
            size: stats.size,
            mtime: stats.mtime,
            isDirectory: false
          });
        });

        await Promise.all(filePromises);

        // Add directories if requested
        if (includeDirectories) {
          const dirPromises = directories.map(async (entry) => {
            const fullPath = path.join(currentPath, entry.name);
            const stats = await stat(fullPath);
            results.push({
              path: fullPath,
              name: entry.name,
              size: stats.size,
              mtime: stats.mtime,
              isDirectory: true
            });
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
        console.error(`Error walking directory ${currentPath}:`, error);
      }
    }

    await walk(dir, 0);
    return results;
  }

  /**
   * Get detailed file metadata
   */
  async getFileMetadata(filePath: string): Promise<FileMetadata | null> {
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
      console.error(`Error getting metadata for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Ensure directory exists, creating it if necessary
   */
  async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist, which is fine
      const stats = await stat(dirPath).catch(() => null);
      if (!stats?.isDirectory()) {
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

    return (path: string, filesInFolder: number) => {
      stats.foldersScanned++;
      stats.filesFound += filesInFolder;
      
      // Only update display every 100ms to avoid flickering
      const now = Date.now();
      if (now - stats.lastUpdate < 100) return;
      stats.lastUpdate = now;
      
      const elapsed = (now - stats.startTime) / 1000;
      const rate = stats.foldersScanned / elapsed;
      
      // Clear previous line and show progress
      process.stdout.write('\r\x1b[K'); // Clear line
      process.stdout.write(
        `📂 ${label}: ${stats.foldersScanned} folders | ` +
        `📄 ${stats.filesFound} files | ` +
        `⚡ ${rate.toFixed(1)} folders/sec | ` +
        `📍 ${path.slice(-50)}`
      );
    };
  }
}

// Export singleton instance
export const fileSystemService = FileSystemService.getInstance();