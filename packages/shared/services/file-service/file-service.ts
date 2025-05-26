import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';

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

export class FileService {
  // Set to track processed Google Drive items to avoid duplicates
  private processedDriveIds = new Set<string>();

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
        .from('sources_google')
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
        Logger.error(`Error fetching children for folder ${parentDriveId}: ${error.message}`);
        return result;
      }

      if (!children || children.length === 0) {
        return result;
      }

      // Separate folders and files
      const folders = children.filter((item: GoogleDriveItem) => 
        item.mime_type === 'application/vnd.google-apps.folder'
      );
      
      const files = children.filter((item: GoogleDriveItem) => 
        item.mime_type !== 'application/vnd.google-apps.folder'
      );

      // Process folders
      if (includeFolders) {
        for (const folder of folders) {
          // Skip if already processed
          if (this.processedDriveIds.has(folder.drive_id)) {
            continue;
          }

          this.processedDriveIds.add(folder.drive_id);
          result.folders.push(folder);
          result.totalItems++;

          if (onItemProcessed) {
            onItemProcessed(folder, currentDepth);
          }

          // Recursively process subfolder
          const subfolderResult = await this.traverseGoogleDriveFolder(
            supabase,
            folder.drive_id,
            options,
            currentDepth + 1
          );

          // Merge results
          result.folders.push(...subfolderResult.folders);
          result.files.push(...subfolderResult.files);
          result.totalItems += subfolderResult.totalItems;
        }
      }

      // Process files
      if (includeFiles) {
        for (const file of files) {
          // Skip if already processed
          if (this.processedDriveIds.has(file.drive_id)) {
            continue;
          }

          this.processedDriveIds.add(file.drive_id);
          result.files.push(file);
          result.totalItems++;

          if (onItemProcessed) {
            onItemProcessed(file, currentDepth);
          }
        }
      }

      return result;
    } catch (error) {
      Logger.error(`Error in traverseGoogleDriveFolder: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Get all items in a folder (non-recursive)
   */
  async getGoogleDriveFolderContents(
    supabase: SupabaseClient<any>,
    parentDriveId: string
  ): Promise<FolderTraversalResult> {
    const result: FolderTraversalResult = {
      folders: [],
      files: [],
      totalItems: 0
    };

    try {
      const { data: children, error } = await supabase
        .from('sources_google')
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
        Logger.error(`Error fetching folder contents: ${error.message}`);
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
      Logger.error(`Error in getGoogleDriveFolderContents: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Get high-level folders (path_depth = 0)
   */
  async getHighLevelFolders(
    supabase: SupabaseClient<any>,
    includeMainVideoOnly: boolean = false
  ): Promise<GoogleDriveItem[]> {
    try {
      let query = supabase
        .from('sources_google')
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
        .eq('path_depth', 0)
        .is('is_root', false)
        .eq('mime_type', 'application/vnd.google-apps.folder')
        .order('name');

      if (includeMainVideoOnly) {
        query = query.not('main_video_id', 'is', null);
      }

      const { data, error } = await query;

      if (error) {
        Logger.error(`Error fetching high-level folders: ${error.message}`);
        return [];
      }

      return data || [];
    } catch (error) {
      Logger.error(`Error in getHighLevelFolders: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Read a file from the filesystem
   */
  readFile(filePath: string): FileResult {
    try {
      const fullPath = path.resolve(filePath);
      Logger.debug(`Reading file: ${fullPath}`);
      
      if (!fs.existsSync(fullPath)) {
        Logger.warn(`File does not exist: ${fullPath}`);
        return {
          success: false,
          error: `File not found: ${fullPath}`,
          path: fullPath
        };
      }
      
      const content = fs.readFileSync(fullPath, 'utf8');
      const stats = this.getFileStats(fullPath);
      
      Logger.debug(`Successfully read file with size: ${content.length} bytes`);
      
      return {
        success: true,
        content,
        path: fullPath,
        stats
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Logger.error(`Error reading file: ${errorMessage}`);
      
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
    try {
      const fullPath = path.resolve(filePath);
      Logger.debug(`Writing file: ${fullPath}`);
      
      // Ensure directory exists
      this.ensureDirectoryExists(path.dirname(fullPath));
      
      fs.writeFileSync(fullPath, content, 'utf8');
      const stats = this.getFileStats(fullPath);
      
      Logger.debug(`Successfully wrote file with size: ${content.length} bytes`);
      
      return {
        success: true,
        path: fullPath,
        stats
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Logger.error(`Error writing file: ${errorMessage}`);
      
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
        Logger.debug(`Creating directory: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
      }
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Logger.error(`Error creating directory: ${errorMessage}`);
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
      Logger.warn(`Error getting file stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return undefined;
    }
  }
  
  /**
   * Find files recursively in a directory that match a pattern (legacy method)
   */
  findFilesLegacy(
    directoryPath: string, 
    pattern: RegExp, 
    excludePatterns: RegExp[] = [/node_modules/, /\.git/, /dist/, /build/, /coverage/]
  ): string[] {
    let results: string[] = [];
    
    try {
      const fullPath = path.resolve(directoryPath);
      if (!fs.existsSync(fullPath)) {
        Logger.warn(`Directory does not exist: ${fullPath}`);
        return results;
      }
      
      const items = fs.readdirSync(fullPath);
      
      for (const item of items) {
        const itemPath = path.join(fullPath, item);
        const excluded = excludePatterns.some(regex => regex.test(itemPath));
        
        if (excluded) {
          continue;
        }
        
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          results = results.concat(this.findFilesLegacy(itemPath, pattern, excludePatterns));
        } else if (pattern.test(item)) {
          results.push(itemPath);
        }
      }
      
      return results;
    } catch (error) {
      Logger.error(`Error finding files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return results;
    }
  }
  
  // Removed findFiles method that depends on glob package
  // Use findFilesLegacy for filesystem operations instead
}

// Export a singleton instance
export const fileService = new FileService();