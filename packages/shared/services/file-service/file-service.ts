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
    includeMainVideoOnly: boolean = false,
    rootDriveId?: string
  ): Promise<GoogleDriveItem[]> {
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
   * Find all MP4 files recursively in a folder and its subfolders
   * Based on the pattern from update-main-video-ids.ts
   */
  async findMp4FilesRecursively(
    supabase: SupabaseClient<any>,
    folderDriveId: string,
    visitedFolders: Set<string> = new Set()
  ): Promise<GoogleDriveItem[]> {
    try {
      // Prevent infinite loops
      if (visitedFolders.has(folderDriveId)) {
        Logger.debug(`Already visited folder ${folderDriveId}, skipping to prevent loop`);
        return [];
      }
      visitedFolders.add(folderDriveId);

      // Get all direct MP4 files in the folder
      const { data: directMp4Files, error: directError } = await supabase
        .from('google_sources')
        .select(`
          id,
          drive_id,
          name,
          path,
          path_depth,
          document_type_id,
          parent_folder_id,
          main_video_id,
          mime_type
        `)
        .eq('parent_folder_id', folderDriveId)
        .eq('is_deleted', false)
        .or('mime_type.eq.video/mp4,name.ilike.%.mp4,name.ilike.%.m4v');
      
      if (directError) {
        Logger.error(`Error fetching direct MP4 files from folder ${folderDriveId}: ${directError.message}`);
        return [];
      }

      // Get all subfolders
      const { data: subfolders, error: subfolderError } = await supabase
        .from('google_sources')
        .select('id, drive_id, name')
        .eq('parent_folder_id', folderDriveId)
        .eq('mime_type', 'application/vnd.google-apps.folder')
        .eq('is_deleted', false);
      
      if (subfolderError) {
        Logger.error(`Error fetching subfolders from folder ${folderDriveId}: ${subfolderError.message}`);
        return directMp4Files || [];
      }

      // Start with direct MP4 files
      let allMp4Files: GoogleDriveItem[] = directMp4Files || [];
      
      // Recursively search each subfolder
      if (subfolders && subfolders.length > 0) {
        for (const subfolder of subfolders) {
          const subfolderId = subfolder.drive_id;
          const mp4FilesInSubfolder = await this.findMp4FilesRecursively(
            supabase, 
            subfolderId, 
            visitedFolders
          );
          
          // Add subfolder information to help with prioritization
          mp4FilesInSubfolder.forEach(file => {
            (file as any).found_in_folder = subfolder.name;
          });
          
          allMp4Files = [...allMp4Files, ...mp4FilesInSubfolder];
        }
      }
      
      return allMp4Files;
    } catch (error: any) {
      Logger.error(`Error in recursive MP4 search: ${error.message}`);
      return [];
    }
  }

  /**
   * Get the best MP4 file from a list, prioritizing files in media-related folders
   * Based on the pattern from update-main-video-ids.ts
   */
  getBestMp4File(mp4Files: GoogleDriveItem[]): GoogleDriveItem | null {
    if (!mp4Files || mp4Files.length === 0) {
      return null;
    }
    
    // If there's only one file, use it
    if (mp4Files.length === 1) {
      return mp4Files[0];
    }
    
    // Priority folders in descending order of importance
    const priorityFolders = ['presentation', 'video', 'media', 'recording', 'mp4'];
    
    // Check for files in priority folders
    for (const priorityKeyword of priorityFolders) {
      const filesInPriorityFolder = mp4Files.filter(file => {
        const foundInFolder = (file as any).found_in_folder;
        return foundInFolder && foundInFolder.toLowerCase().includes(priorityKeyword);
      });
      
      if (filesInPriorityFolder.length > 0) {
        // If multiple files in priority folder, use the first one
        return filesInPriorityFolder[0];
      }
    }
    
    // If no files found in priority folders, just return the first file
    return mp4Files[0];
  }

  /**
   * Find and assign main video ID for a high-level folder
   * Returns the video ID if found and assigned, null otherwise
   */
  async findAndAssignMainVideoId(
    supabase: SupabaseClient<any>,
    folder: GoogleDriveItem
  ): Promise<string | null> {
    try {
      // Only process high-level folders (path_depth = 0)
      if (folder.path_depth !== 0) {
        Logger.debug(`Folder ${folder.name} is not a high-level folder (depth: ${folder.path_depth})`);
        return null;
      }

      // Skip if already has main_video_id
      if (folder.main_video_id) {
        Logger.debug(`Folder ${folder.name} already has main_video_id: ${folder.main_video_id}`);
        return folder.main_video_id;
      }

      // Find MP4 files recursively
      Logger.debug(`Searching for MP4 files in folder: ${folder.name}`);
      const mp4Files = await this.findMp4FilesRecursively(supabase, folder.drive_id);
      
      if (mp4Files.length === 0) {
        Logger.debug(`No MP4 files found in folder: ${folder.name}`);
        return null;
      }

      // Get the best MP4 file
      const bestMp4File = this.getBestMp4File(mp4Files);
      
      if (!bestMp4File) {
        Logger.debug(`No suitable MP4 file found for folder: ${folder.name}`);
        return null;
      }

      Logger.info(`Found MP4 file for ${folder.name}: ${bestMp4File.name} (${bestMp4File.id})`);
      
      // Update the folder with the main_video_id
      const { error: updateError } = await supabase
        .from('google_sources')
        .update({ 
          main_video_id: bestMp4File.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', folder.id);
      
      if (updateError) {
        Logger.error(`Error updating main_video_id for folder ${folder.name}: ${updateError.message}`);
        return null;
      }

      Logger.info(`Successfully assigned main_video_id for folder ${folder.name}`);
      return bestMp4File.id;
    } catch (error: any) {
      Logger.error(`Error in findAndAssignMainVideoId: ${error.message}`);
      return null;
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