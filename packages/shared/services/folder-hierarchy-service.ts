/**
 * Folder Hierarchy Service
 * 
 * Provides utilities for navigating the folder hierarchy in sources_google table,
 * including finding high-level folders and their associated main_video_id
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../../supabase/types';

export interface FolderInfo {
  id: string;
  drive_id: string;
  name: string | null;
  path_depth: number;
  parent_folder_id: string | null;
  main_video_id: string | null;
  path: string | null;
  mime_type: string;
}

export interface HighLevelFolderResult {
  folder: FolderInfo | null;
  main_video_id: string | null;
  traversed_path: FolderInfo[];
}

export interface MainVideoSearchResult {
  video_file: FolderInfo | null;
  video_id: string | null;
  search_path: string[];
}

export interface FolderMainVideoAssignmentResult {
  folder_id: string;
  folder_name: string | null;
  main_video_id: string | null;
  items_updated: number;
  errors: string[];
}

export class FolderHierarchyService {
  private supabase: SupabaseClient<Database>;

  constructor(supabaseClient: SupabaseClient<Database>) {
    this.supabase = supabaseClient;
  }

  /**
   * Find the high-level folder (path_depth = 0) for a given file or folder
   * by traversing up the parent hierarchy
   * 
   * @param itemId - The Supabase ID of the file or folder to start from
   * @returns The high-level folder and its main_video_id
   */
  async findHighLevelFolder(itemId: string): Promise<HighLevelFolderResult> {
    const traversedPath: FolderInfo[] = [];
    let currentItem: FolderInfo | null = null;
    let highLevelFolder: FolderInfo | null = null;
    let mainVideoId: string | null = null;

    // Maximum depth to prevent infinite loops
    const MAX_DEPTH = 20;
    let depth = 0;

    // First, get the starting item by its Supabase ID
    const { data: startItem, error: startError } = await this.supabase
      .from('google_sources')
      .select('id, drive_id, name, path_depth, parent_folder_id, main_video_id, path, mime_type')
      .eq('id', itemId)
      .eq('is_deleted', false)
      .single();

    if (startError || !startItem) {
      console.error(`Error fetching starting item ${itemId}:`, startError);
      return { folder: null, main_video_id: null, traversed_path: [] };
    }

    currentItem = startItem as FolderInfo;
    traversedPath.push(currentItem);

    // Check if we're already at a high-level folder
    if (currentItem.path_depth === 0) {
      return {
        folder: currentItem,
        main_video_id: currentItem.main_video_id,
        traversed_path: traversedPath
      };
    }

    // If this item has a main_video_id, use it
    if (currentItem.main_video_id) {
      mainVideoId = currentItem.main_video_id;
    }

    // Now traverse up using parent_folder_id (which is a Google Drive ID)
    let currentDriveId = currentItem.parent_folder_id;

    while (currentDriveId && depth < MAX_DEPTH) {
      // Get the parent by its drive_id
      const { data: item, error } = await this.supabase
        .from('google_sources')
        .select('id, drive_id, name, path_depth, parent_folder_id, main_video_id, path, mime_type')
        .eq('drive_id', currentDriveId)
        .eq('is_deleted', false)
        .single();

      if (error || !item) {
        console.error(`Error fetching item with drive_id ${currentDriveId}:`, error);
        break;
      }

      traversedPath.push(item as FolderInfo);

      // Check if we've reached a high-level folder (path_depth = 0)
      if (item.path_depth === 0) {
        highLevelFolder = item as FolderInfo;
        if (item.main_video_id) {
          mainVideoId = item.main_video_id;
        }
        break;
      }

      // If this item has a main_video_id, use it (even if not at path_depth 0)
      if (item.main_video_id && !mainVideoId) {
        mainVideoId = item.main_video_id;
      }

      // Move up to the parent
      if (item.parent_folder_id) {
        currentDriveId = item.parent_folder_id;
      } else {
        // No parent, we've reached the top
        break;
      }

      depth++;
    }

    return {
      folder: highLevelFolder,
      main_video_id: mainVideoId,
      traversed_path: traversedPath
    };
  }

  /**
   * Find all items (files and folders) under a high-level folder
   * that need their main_video_id updated
   * 
   * @param highLevelFolderId - The ID of the high-level folder
   * @param mainVideoId - The main_video_id to check against
   * @returns Array of items that need updating
   */
  async findItemsNeedingMainVideoIdUpdate(
    highLevelFolderId: string,
    mainVideoId: string
  ): Promise<Array<{ id: string; name: string; current_main_video_id: string | null }>> {
    // Get the high-level folder info
    const { data: folder, error: folderError } = await this.supabase
      .from('google_sources')
      .select('name')
      .eq('id', highLevelFolderId)
      .single();

    if (folderError || !folder) {
      throw new Error(`High-level folder not found: ${highLevelFolderId}`);
    }

    if (!folder.name) {
      throw new Error(`Folder has no name: ${highLevelFolderId}`);
    }

    // Find all items that are in this folder's hierarchy
    // Using path_array contains the folder name
    const { data: items, error } = await this.supabase
      .from('google_sources')
      .select('id, name, main_video_id')
      .contains('path_array', [folder.name])
      .neq('main_video_id', mainVideoId)
      .eq('is_deleted', false);

    if (error) {
      throw new Error(`Error finding items: ${error.message}`);
    }

    return (items || []).map(item => ({
      id: item.id,
      name: item.name || '',
      current_main_video_id: item.main_video_id
    }));
  }

  /**
   * Update main_video_id for multiple items in a batch
   * 
   * @param itemIds - Array of item IDs to update
   * @param mainVideoId - The main_video_id to set
   * @returns Number of items updated
   */
  async updateMainVideoIds(itemIds: string[], mainVideoId: string): Promise<number> {
    if (itemIds.length === 0) return 0;

    // Update in batches of 50
    const BATCH_SIZE = 50;
    let totalUpdated = 0;

    for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
      const batch = itemIds.slice(i, i + BATCH_SIZE);
      
      const { error } = await this.supabase
        .from('google_sources')
        .update({ main_video_id: mainVideoId })
        .in('id', batch);

      if (error) {
        console.error(`Error updating batch: ${error.message}`);
      } else {
        totalUpdated += batch.length;
      }
    }

    return totalUpdated;
  }

  /**
   * Recursively search for MP4 files in a folder and its subfolders
   * Returns the first MP4 file found, prioritizing certain folder names
   * 
   * @param folderId - The Supabase ID of the folder to search
   * @param currentPath - Current search path for logging
   * @returns Search result with video file info
   */
  async findMainVideoRecursively(folderId: string, currentPath: string[] = []): Promise<MainVideoSearchResult> {
    const priorityFolders = ['presentation', 'video', 'media', 'recording', 'mp4'];
    
    // Get the drive_id for this folder first
    const { data: folderInfo, error: folderError } = await this.supabase
      .from('google_sources')
      .select('drive_id')
      .eq('id', folderId)
      .single();

    if (folderError || !folderInfo || !folderInfo.drive_id) {
      return { video_file: null, video_id: null, search_path: currentPath };
    }

    // First check for MP4 files directly in this folder
    const { data: directVideos, error: directError } = await this.supabase
      .from('google_sources')
      .select('id, drive_id, name, path_depth, parent_folder_id, main_video_id, path, mime_type')
      .eq('parent_folder_id', folderInfo.drive_id)
      .eq('mime_type', 'video/mp4')
      .eq('is_deleted', false)
      .order('name');

    if (!directError && directVideos && directVideos.length > 0) {
      // Prioritize videos with certain naming patterns
      const priorityVideo = directVideos.find(v => 
        v.name && (
          v.name.toLowerCase().includes('presentation') ||
          v.name.toLowerCase().includes('main') ||
          v.name.toLowerCase().includes('video')
        )
      );
      
      const selectedVideo = (priorityVideo || directVideos[0]) as FolderInfo;
      return {
        video_file: selectedVideo,
        video_id: selectedVideo.id,
        search_path: [...currentPath, selectedVideo.name || 'unknown']
      };
    }

    // Get subfolders
    const { data: subfolders, error: subfolderError } = await this.supabase
      .from('google_sources')
      .select('id, name, drive_id')
      .eq('parent_folder_id', folderInfo.drive_id)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .eq('is_deleted', false);

    if (subfolderError || !subfolders || subfolders.length === 0) {
      return { video_file: null, video_id: null, search_path: currentPath };
    }

    // Sort subfolders by priority (media-related folders first)
    const sortedSubfolders = subfolders.sort((a, b) => {
      const aPriority = priorityFolders.findIndex(p => 
        a.name && a.name.toLowerCase().includes(p)
      );
      const bPriority = priorityFolders.findIndex(p => 
        b.name && b.name.toLowerCase().includes(p)
      );
      
      if (aPriority === -1 && bPriority === -1) return 0;
      if (aPriority === -1) return 1;
      if (bPriority === -1) return -1;
      return aPriority - bPriority;
    });

    // Recursively search each subfolder
    for (const subfolder of sortedSubfolders) {
      const result = await this.findMainVideoRecursively(
        subfolder.id, 
        [...currentPath, subfolder.name || 'unknown']
      );
      
      if (result.video_file) {
        return result;
      }
    }

    return { video_file: null, video_id: null, search_path: currentPath };
  }

  /**
   * Find and assign main_video_id for high-level folders that don't have one
   * This is the core orchestration method that should be called first
   * 
   * @param rootDriveId - Optional filter by root drive ID
   * @returns Array of assignment results
   */
  async assignMainVideoIdsToHighLevelFolders(rootDriveId?: string): Promise<FolderMainVideoAssignmentResult[]> {
    const results: FolderMainVideoAssignmentResult[] = [];

    try {
      // Get all high-level folders (path_depth = 0) without main_video_id
      let query = this.supabase
        .from('google_sources')
        .select('id, drive_id, name, main_video_id')
        .eq('path_depth', 0)
        .eq('mime_type', 'application/vnd.google-apps.folder')
        .eq('is_deleted', false)
        .is('main_video_id', null);

      if (rootDriveId) {
        query = query.eq('root_drive_id', rootDriveId);
      }

      const { data: highLevelFolders, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch high-level folders: ${error.message}`);
      }

      if (!highLevelFolders || highLevelFolders.length === 0) {
        console.log('No high-level folders without main_video_id found');
        return results;
      }

      console.log(`Found ${highLevelFolders.length} high-level folders needing main_video_id assignment`);

      // Process each high-level folder
      for (const folder of highLevelFolders) {
        const result: FolderMainVideoAssignmentResult = {
          folder_id: folder.id,
          folder_name: folder.name,
          main_video_id: null,
          items_updated: 0,
          errors: []
        };

        try {
          console.log(`Searching for main video in folder: ${folder.name}`);
          
          // Find the main video for this folder
          const videoSearch = await this.findMainVideoRecursively(folder.id);
          
          if (videoSearch.video_file) {
            const mainVideoId = videoSearch.video_file.id;
            console.log(`Found main video: ${videoSearch.video_file.name} at path: ${videoSearch.search_path.join(' > ')}`);
            
            // Update the high-level folder with main_video_id
            const { error: updateError } = await this.supabase
              .from('google_sources')
              .update({ main_video_id: mainVideoId })
              .eq('id', folder.id);

            if (updateError) {
              result.errors.push(`Failed to update folder main_video_id: ${updateError.message}`);
            } else {
              result.main_video_id = mainVideoId;
              result.items_updated++;
              
              // Now propagate to all nested items
              const propagateResult = await this.propagateMainVideoIdToNestedItems(folder.id, mainVideoId);
              result.items_updated += propagateResult;
              
              console.log(`✅ Assigned main_video_id to ${folder.name} and ${propagateResult} nested items`);
            }
          } else {
            console.log(`No MP4 files found in folder: ${folder.name}`);
          }
        } catch (error: any) {
          result.errors.push(`Error processing folder ${folder.name}: ${error.message}`);
        }

        results.push(result);
      }

    } catch (error: any) {
      console.error('Error in assignMainVideoIdsToHighLevelFolders:', error.message);
      throw error;
    }

    return results;
  }

  /**
   * Propagate main_video_id to all items nested under a high-level folder
   * 
   * @param highLevelFolderId - The Supabase ID of the high-level folder
   * @param mainVideoId - The main_video_id to propagate
   * @returns Number of items updated
   */
  async propagateMainVideoIdToNestedItems(highLevelFolderId: string, mainVideoId: string): Promise<number> {
    try {
      // Get the folder name for path_array filtering
      const { data: folder, error: folderError } = await this.supabase
        .from('google_sources')
        .select('name')
        .eq('id', highLevelFolderId)
        .single();

      if (folderError || !folder || !folder.name) {
        throw new Error(`Could not get folder name for ${highLevelFolderId}`);
      }

      // Find all items that are nested under this folder (using path_array)
      const { data: nestedItems, error } = await this.supabase
        .from('google_sources')
        .select('id')
        .contains('path_array', [folder.name])
        .neq('id', highLevelFolderId) // Don't include the folder itself
        .eq('is_deleted', false);

      if (error) {
        throw new Error(`Failed to find nested items: ${error.message}`);
      }

      if (!nestedItems || nestedItems.length === 0) {
        return 0;
      }

      // Update in batches
      const itemIds = nestedItems.map(item => item.id);
      return await this.updateMainVideoIds(itemIds, mainVideoId);

    } catch (error: any) {
      console.error('Error propagating main_video_id:', error.message);
      return 0;
    }
  }

  /**
   * Find the main video file (MP4) for a high-level folder
   * Searches recursively in the folder and subfolders
   * 
   * @param folderId - The folder ID to search in
   * @returns The main video file info or null
   */
  async findMainVideoInFolder(folderId: string): Promise<FolderInfo | null> {
    // First check for MP4 files directly in the folder
    const { data: directVideos, error: directError } = await this.supabase
      .from('google_sources')
      .select('id, drive_id, name, path_depth, parent_folder_id, main_video_id, path, mime_type')
      .eq('parent_folder_id', folderId)
      .eq('mime_type', 'video/mp4')
      .eq('is_deleted', false)
      .order('name');

    if (!directError && directVideos && directVideos.length > 0) {
      // Prioritize videos with certain naming patterns
      const priorityVideo = directVideos.find(v => 
        v.name && (
          v.name.toLowerCase().includes('presentation') ||
          v.name.toLowerCase().includes('main') ||
          v.name.toLowerCase().includes('video')
        )
      );
      
      return (priorityVideo || directVideos[0]) as FolderInfo;
    }

    // If no direct videos, search in subfolders
    const { data: subfolders, error: subfolderError } = await this.supabase
      .from('google_sources')
      .select('id, name')
      .eq('parent_folder_id', folderId)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .eq('is_deleted', false);

    if (subfolderError || !subfolders) {
      return null;
    }

    // Check subfolders, prioritizing those with media-related names
    const priorityFolders = ['presentation', 'video', 'media', 'recording', 'mp4'];
    
    // Sort subfolders by priority
    const sortedSubfolders = subfolders.sort((a, b) => {
      const aPriority = priorityFolders.findIndex(p => 
        a.name && a.name.toLowerCase().includes(p)
      );
      const bPriority = priorityFolders.findIndex(p => 
        b.name && b.name.toLowerCase().includes(p)
      );
      
      if (aPriority === -1 && bPriority === -1) return 0;
      if (aPriority === -1) return 1;
      if (bPriority === -1) return -1;
      return aPriority - bPriority;
    });

    // Recursively search each subfolder
    for (const subfolder of sortedSubfolders) {
      const video = await this.findMainVideoInFolder(subfolder.id);
      if (video) {
        return video;
      }
    }

    return null;
  }
}

// Factory function for easy instantiation
export function createFolderHierarchyService(supabaseClient: SupabaseClient<Database>): FolderHierarchyService {
  return new FolderHierarchyService(supabaseClient);
}