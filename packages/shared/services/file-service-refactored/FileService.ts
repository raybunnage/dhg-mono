/**
 * File Service - Infrastructure service for file system and Google Drive operations
 * Refactored to extend SingletonService with proper resource management
 */

import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClient } from '@supabase/supabase-js';
import { SingletonService } from '../base-classes/SingletonService';
import { Logger } from '../base-classes/BaseService';

export interface FileResult {
  success: boolean;
  content?: string;
  error?: string;
  path: string;
  stats?: {
    size: number;
    modified: Date;
    lines: number;
  };
}

// Google Drive specific interfaces
export interface GoogleDriveItem {
  id: string;                          // Supabase UUID
  drive_id: string;                    // Google Drive ID
  name: string | null;
  path_depth: number | null;
  document_type_id: string | null;
  parent_folder_id: string | null;     // Parent's Google Drive ID
  main_video_id: string | null;
  mime_type: string | null;
}

export interface FolderTraversalResult {
  folders: GoogleDriveItem[];
  files: GoogleDriveItem[];
  totalItems: number;
}

export interface RecursiveTraversalOptions {
  includeFiles?: boolean;
  includeFolders?: boolean;
  maxDepth?: number;
  onItemProcessed?: (item: GoogleDriveItem, depth: number) => void;
}

interface ServiceMetrics {
  totalFilesRead: number;
  totalFilesWritten: number;
  totalDirectoriesCreated: number;
  totalGoogleDriveTraversals: number;
  totalBytesRead: number;
  totalBytesWritten: number;
  totalErrors: number;
  lastError?: string;
  lastOperation?: string;
  lastOperationTime?: Date;
}

export class FileService extends SingletonService {
  private static instance: FileService;
  
  // Set to track processed Google Drive items to avoid duplicates
  private processedDriveIds = new Set<string>();
  
  private metrics: ServiceMetrics = {
    totalFilesRead: 0,
    totalFilesWritten: 0,
    totalDirectoriesCreated: 0,
    totalGoogleDriveTraversals: 0,
    totalBytesRead: 0,
    totalBytesWritten: 0,
    totalErrors: 0
  };

  protected constructor(logger?: Logger) {
    super('FileService', logger);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(logger?: Logger): FileService {
    return SingletonService.getSingletonInstance(
      'FileService',
      () => new FileService(logger)
    );
  }

  /**
   * Initialize the service
   */
  protected async initialize(): Promise<void> {
    this.logger?.info('FileService initialized');
  }

  /**
   * Release resources (cleanup)
   */
  protected async releaseResources(): Promise<void> {
    // Clear any cached data
    this.processedDriveIds.clear();
    this.logger?.info('FileService resources released');
  }

  /**
   * Health check implementation
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    try {
      // Test file system access by checking temp directory
      const tempDir = path.join(process.cwd(), '.tmp');
      const canAccess = await this.canAccessPath(tempDir);
      
      return {
        healthy: canAccess,
        details: {
          ...this.metrics,
          fileSystemAccess: canAccess
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          ...this.metrics,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Get service metrics
   */
  public getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset the processed items tracker (call before starting a new traversal)
   */
  resetProcessedItems(): void {
    this.processedDriveIds.clear();
  }

  /**
   * Recursively traverse Google Drive folders and files
   * Based on the solid pattern from list-main-video-folders-tree
   */
  async traverseGoogleDriveFolder(
    supabase: SupabaseClient<any>,
    parentDriveId: string,
    options: RecursiveTraversalOptions = {},
    currentDepth: number = 0
  ): Promise<FolderTraversalResult> {
    this.metrics.lastOperation = 'traverseGoogleDriveFolder';
    this.metrics.lastOperationTime = new Date();
    this.metrics.totalGoogleDriveTraversals++;

    const {
      includeFiles = true,
      includeFolders = true,
      maxDepth = Infinity,
      onItemProcessed
    } = options;

    const result: FolderTraversalResult = {
      folders: [],
      files: [],
      totalItems: 0
    };

    // Stop if we've reached max depth
    if (currentDepth > maxDepth) {
      return result;
    }

    try {
      // Get all direct children of this folder
      const { data: children, error } = await supabase
        .from('google_sources')
        .select(`
          id,
          drive_id,
          name,
          path_depth,
          document_type_id,
          parent_folder_id,
          main_video_id,
          mime_type
        `)
        .eq('parent_folder_id', parentDriveId)
        .order('name');

      if (error) {
        this.handleError(`Error fetching children for folder ${parentDriveId}`, error);
        return result;
      }

      if (!children || children.length === 0) {
        return result;
      }

      // Process folders and files
      for (const item of children) {
        // Skip already processed items
        if (this.processedDriveIds.has(item.drive_id)) {
          continue;
        }

        this.processedDriveIds.add(item.drive_id);

        if (item.mime_type === 'application/vnd.google-apps.folder') {
          if (includeFolders) {
            result.folders.push(item);
            result.totalItems++;
            onItemProcessed?.(item, currentDepth);
          }

          // Recursively process subfolder
          const subResult = await this.traverseGoogleDriveFolder(
            supabase,
            item.drive_id,
            options,
            currentDepth + 1
          );

          result.folders.push(...subResult.folders);
          result.files.push(...subResult.files);
          result.totalItems += subResult.totalItems;
        } else if (includeFiles) {
          result.files.push(item);
          result.totalItems++;
          onItemProcessed?.(item, currentDepth);
        }
      }

      return result;
    } catch (error) {
      this.handleError('Error in traverseGoogleDriveFolder', error);
      return result;
    }
  }

  /**
   * Get Google Drive folder contents (non-recursive)
   */
  async getGoogleDriveFolderContents(
    supabase: SupabaseClient<any>,
    parentDriveId: string
  ): Promise<FolderTraversalResult> {
    this.metrics.lastOperation = 'getGoogleDriveFolderContents';
    this.metrics.lastOperationTime = new Date();

    const result: FolderTraversalResult = {
      folders: [],
      files: [],
      totalItems: 0
    };

    try {
      const { data: children, error } = await supabase
        .from('google_sources')
        .select(`
          id,
          drive_id,
          name,
          path_depth,
          document_type_id,
          parent_folder_id,
          main_video_id,
          mime_type
        `)
        .eq('parent_folder_id', parentDriveId)
        .order('name');

      if (error) {
        this.handleError('Error fetching folder contents', error);
        return result;
      }

      if (!children || children.length === 0) {
        return result;
      }

      // Separate and deduplicate
      for (const item of children) {
        if (this.processedDriveIds.has(item.drive_id)) {
          continue;
        }

        this.processedDriveIds.add(item.drive_id);

        if (item.mime_type === 'application/vnd.google-apps.folder') {
          result.folders.push(item);
        } else {
          result.files.push(item);
        }
        result.totalItems++;
      }

      return result;
    } catch (error) {
      this.handleError('Error in getGoogleDriveFolderContents', error);
      return result;
    }
  }

  /**
   * Get high-level folders (path_depth = 0)
   */
  async getHighLevelFolders(
    supabase: SupabaseClient<any>,
    includeMainVideoOnly: boolean = false,
    rootDriveId?: string
  ): Promise<GoogleDriveItem[]> {
    this.metrics.lastOperation = 'getHighLevelFolders';
    this.metrics.lastOperationTime = new Date();

    try {
      let query = supabase
        .from('google_sources')
        .select(`
          id,
          drive_id,
          name,
          path_depth,
          document_type_id,
          parent_folder_id,
          main_video_id,
          mime_type,
          root_drive_id
        `)
        .eq('path_depth', 0)
        .or('is_root.is.null,is_root.eq.false')
        .eq('mime_type', 'application/vnd.google-apps.folder')
        .order('name');

      // Apply root drive filter if provided
      if (rootDriveId) {
        query = query.eq('root_drive_id', rootDriveId);
      }

      if (includeMainVideoOnly) {
        query = query.not('main_video_id', 'is', null);
      }

      const { data, error } = await query;

      if (error) {
        this.handleError('Error fetching high-level folders', error);
        return [];
      }

      return data || [];
    } catch (error) {
      this.handleError('Error in getHighLevelFolders', error);
      return [];
    }
  }

  /**
   * Find all MP4 files recursively in a folder and its subfolders
   * Based on the pattern from update-main-video-ids.ts
   */
  async findMp4FilesRecursively(
    supabase: SupabaseClient<any>,
    folderDriveId: string,
    visitedFolders: Set<string> = new Set()
  ): Promise<GoogleDriveItem[]> {
    this.metrics.lastOperation = 'findMp4FilesRecursively';
    this.metrics.lastOperationTime = new Date();

    try {
      // Prevent infinite loops
      if (visitedFolders.has(folderDriveId)) {
        this.logger?.debug(`Already visited folder ${folderDriveId}, skipping to prevent loop`);
        return [];
      }
      visitedFolders.add(folderDriveId);

      // Get all MP4 files directly in this folder
      const { data: mp4Files, error: filesError } = await supabase
        .from('google_sources')
        .select(`
          id,
          drive_id,
          name,
          path_depth,
          document_type_id,
          parent_folder_id,
          main_video_id,
          mime_type
        `)
        .eq('parent_folder_id', folderDriveId)
        .eq('mime_type', 'video/mp4');

      if (filesError) {
        this.handleError(`Error fetching MP4 files from folder ${folderDriveId}`, filesError);
        return [];
      }

      const allMp4Files: GoogleDriveItem[] = mp4Files || [];

      // Get all subfolders
      const { data: subfolders, error: foldersError } = await supabase
        .from('google_sources')
        .select('drive_id')
        .eq('parent_folder_id', folderDriveId)
        .eq('mime_type', 'application/vnd.google-apps.folder');

      if (foldersError) {
        this.handleError(`Error fetching subfolders from folder ${folderDriveId}`, foldersError);
        return allMp4Files;
      }

      // Recursively search each subfolder
      if (subfolders && subfolders.length > 0) {
        for (const subfolder of subfolders) {
          const subfolderMp4s = await this.findMp4FilesRecursively(
            supabase,
            subfolder.drive_id,
            visitedFolders
          );
          allMp4Files.push(...subfolderMp4s);
        }
      }

      return allMp4Files;
    } catch (error) {
      this.handleError('Error in findMp4FilesRecursively', error);
      return [];
    }
  }

  /**
   * Check if a file exists
   */
  fileExists(filePath: string): boolean {
    this.metrics.lastOperation = 'fileExists';
    this.metrics.lastOperationTime = new Date();

    try {
      return fs.existsSync(filePath);
    } catch (error) {
      this.handleError('Error checking file existence', error);
      return false;
    }
  }

  /**
   * Read a file and return its content
   */
  readFile(filePath: string): FileResult {
    this.metrics.lastOperation = 'readFile';
    this.metrics.lastOperationTime = new Date();

    try {
      if (!fs.existsSync(filePath)) {
        this.logger?.warn(`File not found: ${filePath}`);
        return {
          success: false,
          error: 'File not found',
          path: filePath
        };
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const stats = this.getFileStats(filePath);
      
      this.metrics.totalFilesRead++;
      if (stats) {
        this.metrics.totalBytesRead += stats.size;
      }

      return {
        success: true,
        content,
        path: filePath,
        stats
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.handleError('Error reading file', error);
      
      return {
        success: false,
        error: errorMessage,
        path: filePath
      };
    }
  }

  /**
   * Write content to a file
   */
  writeFile(filePath: string, content: string): FileResult {
    this.metrics.lastOperation = 'writeFile';
    this.metrics.lastOperationTime = new Date();

    try {
      const dirPath = path.dirname(filePath);
      
      // Ensure directory exists
      if (!this.ensureDirectoryExists(dirPath)) {
        return {
          success: false,
          error: 'Failed to create directory',
          path: filePath
        };
      }

      fs.writeFileSync(filePath, content, 'utf8');
      const stats = this.getFileStats(filePath);
      
      this.metrics.totalFilesWritten++;
      if (stats) {
        this.metrics.totalBytesWritten += stats.size;
      }

      return {
        success: true,
        path: filePath,
        stats
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.handleError('Error writing file', error);
      
      return {
        success: false,
        error: errorMessage,
        path: filePath
      };
    }
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  ensureDirectoryExists(dirPath: string): boolean {
    try {
      if (!fs.existsSync(dirPath)) {
        this.logger?.debug(`Creating directory: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
        this.metrics.totalDirectoriesCreated++;
      }
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.handleError('Error creating directory', error);
      return false;
    }
  }

  /**
   * Get statistics for a file
   */
  getFileStats(filePath: string): FileResult['stats'] {
    try {
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').length;
      
      return {
        size: stats.size,
        modified: stats.mtime,
        lines
      };
    } catch (error) {
      this.logger?.warn(`Error getting file stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return undefined;
    }
  }

  /**
   * Find files in a directory that match a pattern (legacy implementation)
   */
  findFilesLegacy(
    directory: string,
    pattern: RegExp,
    options: { recursive?: boolean } = {}
  ): string[] {
    this.metrics.lastOperation = 'findFilesLegacy';
    this.metrics.lastOperationTime = new Date();

    const results: string[] = [];
    
    const searchDirectory = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && options.recursive) {
            searchDirectory(fullPath);
          } else if (entry.isFile() && pattern.test(entry.name)) {
            results.push(fullPath);
          }
        }
      } catch (error) {
        this.logger?.warn(`Error reading directory ${dir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    
    if (fs.existsSync(directory)) {
      searchDirectory(directory);
    }
    
    return results;
  }

  /**
   * Check if we can access a path
   */
  private async canAccessPath(pathToCheck: string): Promise<boolean> {
    try {
      await fs.promises.access(pathToCheck, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Handle errors consistently
   */
  private handleError(message: string, error: any): void {
    this.metrics.totalErrors++;
    this.metrics.lastError = error?.message || String(error);
    this.logger?.error(message, error);
  }
}