import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils';
import { execSync } from 'child_process';

export interface FileLocation {
  type: 'local' | 'gdrive_desktop' | 'cloud';
  path: string;
  isSymlink?: boolean;
}

export interface CacheConfig {
  tempDir: string;
  maxCacheSize: string;
  retentionDays: number;
  autoCleanup: boolean;
}

export class MediaFileManager {
  private supabase: SupabaseClient<any>;
  private cacheConfig: CacheConfig;
  private googleDriveRoot: string | null = null;

  constructor(supabase: SupabaseClient<any>, cacheConfig: CacheConfig) {
    this.supabase = supabase;
    this.cacheConfig = cacheConfig;
    this.detectGoogleDriveRoot();
  }

  /**
   * Auto-detect Google Drive Desktop root path
   */
  private detectGoogleDriveRoot(): void {
    const possiblePaths = [
      path.join(process.env.HOME || '', 'Library/CloudStorage/GoogleDrive-bunnage.ray@gmail.com/My Drive'),
      path.join(process.env.HOME || '', 'Google Drive/My Drive'),
      '/Volumes/GoogleDrive/My Drive',
      'G:/My Drive' // Windows
    ];

    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        this.googleDriveRoot = testPath;
        Logger.info(`Found Google Drive Desktop at: ${testPath}`);
        break;
      }
    }

    if (!this.googleDriveRoot) {
      Logger.warn('Google Drive Desktop not found. Will use download fallback.');
    }
  }

  /**
   * Get file by Drive ID, checking cache and Google Drive Desktop first
   */
  public async getFile(driveId: string, filename: string): Promise<FileLocation> {
    Logger.info(`Getting file: ${filename} (${driveId})`);

    // Step 1: Check local cache
    const localPath = await this.checkLocalCache(filename);
    if (localPath) {
      Logger.info(`Found in local cache: ${localPath}`);
      return { type: 'local', path: localPath };
    }

    // Step 2: Check Google Drive Desktop
    if (this.googleDriveRoot) {
      const gdrivePath = await this.checkGoogleDriveDesktop(driveId, filename);
      if (gdrivePath) {
        Logger.info(`Found in Google Drive Desktop: ${gdrivePath}`);
        
        // Create symlink in temp directory for faster access
        const symlinkPath = await this.createSymlink(gdrivePath, filename);
        return { type: 'gdrive_desktop', path: symlinkPath, isSymlink: true };
      }
    }

    // Step 3: Download from cloud (would need implementation)
    Logger.info(`File not found locally, would need to download: ${filename}`);
    return { type: 'cloud', path: '' };
  }

  /**
   * Check if file exists in local cache
   */
  private async checkLocalCache(filename: string): Promise<string | null> {
    const extensions = ['.mp4', '.m4a'];
    const dirs = ['mp4', 'm4a'];

    for (const dir of dirs) {
      const dirPath = path.join(this.cacheConfig.tempDir, dir);
      if (!fs.existsSync(dirPath)) continue;

      // Check exact match
      const exactPath = path.join(dirPath, filename);
      if (fs.existsSync(exactPath)) {
        return exactPath;
      }

      // Check with different extensions
      const baseName = filename.replace(/\.[^/.]+$/, '');
      for (const ext of extensions) {
        const testPath = path.join(dirPath, baseName + ext);
        if (fs.existsSync(testPath)) {
          return testPath;
        }
      }
    }

    return null;
  }

  /**
   * Check if file exists in Google Drive Desktop
   */
  private async checkGoogleDriveDesktop(driveId: string, filename: string): Promise<string | null> {
    if (!this.googleDriveRoot) return null;

    try {
      // Get folder path from database
      const { data, error } = await this.supabase
        .from('google_sources')
        .select('path, parent_folder_id')
        .eq('drive_id', driveId)
        .single();

      if (error || !data) {
        return null;
      }

      // Try to construct full path
      if (data.path) {
        const fullPath = path.join(this.googleDriveRoot, data.path);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }

      // Fallback: search by filename
      const searchPath = await this.searchInGoogleDrive(filename);
      return searchPath;

    } catch (error: any) {
      Logger.error(`Error checking Google Drive Desktop: ${error.message}`);
      return null;
    }
  }

  /**
   * Search for file in Google Drive Desktop
   */
  private async searchInGoogleDrive(filename: string): Promise<string | null> {
    if (!this.googleDriveRoot) return null;

    try {
      // Use find command to search (macOS/Linux)
      const cmd = `find "${this.googleDriveRoot}" -name "${filename}" -type f | head -1`;
      const result = execSync(cmd, { encoding: 'utf8' }).trim();
      
      if (result) {
        return result;
      }
    } catch (error) {
      // Find command failed, try manual search in common locations
      const commonFolders = [
        '200_Research Experts',
        'Dynamic Healing Discussion Group',
        '000_DHG',
        '100_Healing Journeys'
      ];

      for (const folder of commonFolders) {
        const testPath = path.join(this.googleDriveRoot, folder);
        if (fs.existsSync(testPath)) {
          const found = this.searchInDirectory(testPath, filename);
          if (found) return found;
        }
      }
    }

    return null;
  }

  /**
   * Recursively search for file in directory
   */
  private searchInDirectory(dir: string, filename: string, maxDepth: number = 5, currentDepth: number = 0): string | null {
    if (currentDepth > maxDepth) return null;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isFile() && entry.name === filename) {
          return fullPath;
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const found = this.searchInDirectory(fullPath, filename, maxDepth, currentDepth + 1);
          if (found) return found;
        }
      }
    } catch (error) {
      // Permission denied or other errors
    }

    return null;
  }

  /**
   * Create symlink for faster access
   */
  private async createSymlink(sourcePath: string, filename: string): Promise<string> {
    const symlinkDir = path.join(this.cacheConfig.tempDir, 'symlinks');
    
    // Ensure symlink directory exists
    if (!fs.existsSync(symlinkDir)) {
      fs.mkdirSync(symlinkDir, { recursive: true });
    }

    const symlinkPath = path.join(symlinkDir, filename);

    // Remove existing symlink if present
    if (fs.existsSync(symlinkPath)) {
      fs.unlinkSync(symlinkPath);
    }

    // Create new symlink
    fs.symlinkSync(sourcePath, symlinkPath);
    Logger.info(`Created symlink: ${symlinkPath} → ${sourcePath}`);

    return symlinkPath;
  }

  /**
   * Clean up old processed files
   */
  public async cleanup(): Promise<void> {
    if (!this.cacheConfig.autoCleanup) {
      Logger.info('Auto-cleanup is disabled');
      return;
    }

    Logger.info('Starting cleanup of old files...');
    
    const dirs = ['mp4', 'm4a', 'transcripts', 'symlinks'];
    const now = Date.now();
    const maxAge = this.cacheConfig.retentionDays * 24 * 60 * 60 * 1000;
    
    let totalDeleted = 0;
    let totalSize = 0;

    for (const dir of dirs) {
      const dirPath = path.join(this.cacheConfig.tempDir, dir);
      if (!fs.existsSync(dirPath)) continue;

      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        
        try {
          const stat = fs.statSync(filePath);
          const age = now - stat.mtimeMs;

          if (age > maxAge) {
            // Check if file has been processed
            const isProcessed = await this.isFileProcessed(file);
            
            if (isProcessed) {
              totalSize += stat.size;
              fs.unlinkSync(filePath);
              totalDeleted++;
              Logger.info(`Deleted old file: ${file} (${this.formatBytes(stat.size)})`);
            }
          }
        } catch (error) {
          Logger.warn(`Error processing ${file}: ${error}`);
        }
      }
    }

    Logger.info(`Cleanup complete: Deleted ${totalDeleted} files (${this.formatBytes(totalSize)})`);
  }

  /**
   * Check if file has been processed
   */
  private async isFileProcessed(filename: string): Promise<boolean> {
    try {
      // Check media_processing_status table
      const { data, error } = await this.supabase
        .from('media_processing_status')
        .select('status')
        .eq('filename', filename)
        .single();

      if (!error && data) {
        return data.status === 'completed';
      }

      // Fallback: check by document
      const baseName = filename.replace(/\.[^/.]+$/, '');
      const { data: docData } = await this.supabase
        .from('google_expert_documents')
        .select('pipeline_status')
        .or(`raw_content.not.is.null`)
        .ilike('google_sources.name', `%${baseName}%`)
        .limit(1);

      return !!(docData && docData.length > 0);

    } catch (error) {
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldFiles: number;
    processedFiles: number;
  }> {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      oldFiles: 0,
      processedFiles: 0
    };

    const dirs = ['mp4', 'm4a', 'transcripts', 'symlinks'];
    const now = Date.now();
    const maxAge = this.cacheConfig.retentionDays * 24 * 60 * 60 * 1000;

    for (const dir of dirs) {
      const dirPath = path.join(this.cacheConfig.tempDir, dir);
      if (!fs.existsSync(dirPath)) continue;

      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        
        try {
          const stat = fs.statSync(filePath);
          stats.totalFiles++;
          stats.totalSize += stat.size;

          const age = now - stat.mtimeMs;
          if (age > maxAge) {
            stats.oldFiles++;
          }

          const isProcessed = await this.isFileProcessed(file);
          if (isProcessed) {
            stats.processedFiles++;
          }
        } catch (error) {
          // Ignore errors
        }
      }
    }

    return stats;
  }

  /**
   * Format bytes to human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Setup workspace with symlinks for batch processing
   */
  public async setupWorkspace(files: Array<{ driveId: string; filename: string }>): Promise<Map<string, string>> {
    const workspace = new Map<string, string>();
    
    Logger.info(`Setting up workspace for ${files.length} files`);

    for (const file of files) {
      try {
        const location = await this.getFile(file.driveId, file.filename);
        if (location.path) {
          workspace.set(file.driveId, location.path);
        }
      } catch (error: any) {
        Logger.error(`Failed to setup ${file.filename}: ${error.message}`);
      }
    }

    Logger.info(`Workspace ready with ${workspace.size} files`);
    return workspace;
  }
}