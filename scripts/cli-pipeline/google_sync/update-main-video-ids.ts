#!/usr/bin/env ts-node
/**
 * Update Main Video IDs
 * 
 * This script updates presentation records by setting the main_video_id field for each 
 * presentation that has a null main_video_id. It recursively searches for MP4 files in the
 * presentation's folder and any subfolders, prioritizing MP4 files found in media-related folders.
 * 
 * Usage:
 *   ts-node update-main-video-ids.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be updated without making changes
 *   --folder-id <id>   Specify a folder ID (default: Dynamic Healing Discussion Group)
 *   --verbose          Show detailed logs
 *   --limit <n>        Limit processing to n presentations (default: no limit)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger, LogLevel } from '../../../packages/shared/utils/logger';

// Load environment variables
const envFiles = ['.env', '.env.development', '.env.local'];
for (const file of envFiles) {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`Loading environment variables from ${filePath}`);
    dotenv.config({ path: filePath });
  }
}

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

if (isVerbose) {
  Logger.setLevel(LogLevel.DEBUG);
} else {
  Logger.setLevel(LogLevel.INFO);
}

// Get folder ID from command line or use default
const folderIdIndex = args.indexOf('--folder-id');
let folderId = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'; // Default: Dynamic Healing Discussion Group
if (folderIdIndex !== -1 && args[folderIdIndex + 1]) {
  folderId = args[folderIdIndex + 1];
}

// Get limit if specified
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 && args[limitIndex + 1] ? parseInt(args[limitIndex + 1], 10) : undefined;

/**
 * Find all MP4 files recursively in a folder and its subfolders in sources_google table
 */
async function findMp4FilesRecursively(supabase: any, folderId: string, useSourcesGoogle2 = true): Promise<any[]> {
  try {
    const tableName = useSourcesGoogle2 ? 'sources_google2' : 'sources_google';
    const deletedField = useSourcesGoogle2 ? 'is_deleted' : 'deleted';
    
    // Get all direct MP4 files in the folder
    const { data: directMp4Files, error: directError } = await supabase
      .from(tableName)
      .select('id, name, path, drive_id, parent_folder_id, mime_type')
      .eq('parent_folder_id', folderId)
      .eq(deletedField, false)
      .or('mime_type.eq.video/mp4,name.ilike.%.mp4,name.ilike.%.m4v');
    
    if (directError) {
      Logger.error(`Error fetching direct MP4 files from ${tableName}: ${directError.message}`);
      return [];
    }

    // Get all subfolders
    const { data: subfolders, error: subfolderError } = await supabase
      .from(tableName)
      .select('id, name')
      .eq('parent_folder_id', folderId)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .eq(deletedField, false);
    
    if (subfolderError) {
      Logger.error(`Error fetching subfolders from ${tableName}: ${subfolderError.message}`);
      return directMp4Files || [];
    }

    // Recursively search each subfolder
    let allMp4Files = directMp4Files || [];
    
    if (subfolders && subfolders.length > 0) {
      for (const subfolder of subfolders) {
        const subfolderId = subfolder.id;
        const mp4FilesInSubfolder = await findMp4FilesRecursively(supabase, subfolderId, useSourcesGoogle2);
        
        if (mp4FilesInSubfolder.length > 0) {
          // Annotate each file with its folder name to help with prioritization
          mp4FilesInSubfolder.forEach(file => {
            file.found_in_folder = subfolder.name;
          });
          
          allMp4Files = [...allMp4Files, ...mp4FilesInSubfolder];
        }
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
 */
function getBestMp4File(mp4Files: any[]): any | null {
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
    const filesInPriorityFolder = mp4Files.filter(file => 
      file.found_in_folder && file.found_in_folder.toLowerCase().includes(priorityKeyword)
    );
    
    if (filesInPriorityFolder.length > 0) {
      // If multiple files in priority folder, use the first one (could be improved with more logic)
      return filesInPriorityFolder[0];
    }
  }
  
  // If no files found in priority folders, just return the first file
  return mp4Files[0];
}

/**
 * Main function to update main_video_id for presentations
 */
async function updateMainVideoIds(useSourcesGoogle2 = true): Promise<void> {
  console.log('=== Update Main Video IDs ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
  console.log(`Using table: ${useSourcesGoogle2 ? 'sources_google2' : 'sources_google'}`);
  console.log(`Folder ID: ${folderId}`);
  if (limit) console.log(`Limit: ${limit} presentations`);
  console.log('============================');

  // Initialize Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Step 1: Get folder info to verify it exists
    const tableName = useSourcesGoogle2 ? 'sources_google2' : 'sources_google';
    const deletedField = useSourcesGoogle2 ? 'is_deleted' : 'deleted';
    
    const { data: folderInfo, error: folderError } = await supabase
      .from(tableName)
      .select('id, name, path')
      .eq('drive_id', folderId)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .single();
    
    if (folderError) {
      Logger.error(`Error fetching folder info from ${tableName}: ${folderError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Working with folder: "${folderInfo.name}" (${folderId})`);
    
    // Step 2: Get all presentations with null main_video_id
    let query = supabase
      .from('presentations')
      .select('id, title, folder_path, filename')
      .is('main_video_id', null)
      .order('folder_path');
    
    // Add limit if specified
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data: presentationsWithoutVideo, error: presentationsError } = await query;
    
    if (presentationsError) {
      Logger.error(`Error fetching presentations: ${presentationsError.message}`);
      process.exit(1);
    }
    
    if (!presentationsWithoutVideo || presentationsWithoutVideo.length === 0) {
      Logger.info('No presentations found with null main_video_id. Nothing to do.');
      return;
    }
    
    Logger.info(`Found ${presentationsWithoutVideo.length} presentations with null main_video_id.`);
    
    // Step 3: For each presentation, find the associated folder and then search for MP4 files
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < presentationsWithoutVideo.length; i++) {
      const presentation = presentationsWithoutVideo[i];
      Logger.debug(`Processing presentation ${i+1}/${presentationsWithoutVideo.length}: ${presentation.title}`);
      
      // Extract folder path from presentation
      const folderPath = presentation.folder_path;
      
      if (!folderPath) {
        Logger.debug(`Skipping presentation '${presentation.title}' - no folder path`);
        skippedCount++;
        continue;
      }
      
      // Find the folder in sources_google
      const folderName = folderPath.split('/').filter(Boolean).pop() || '';
      
      const { data: folders, error: folderLookupError } = await supabase
        .from(tableName)
        .select('id, name, path, drive_id')
        .eq('mime_type', 'application/vnd.google-apps.folder')
        .eq(deletedField, false)
        .like('path', `%${folderName}%`);
      
      if (folderLookupError) {
        Logger.error(`Error looking up folder for ${presentation.title}: ${folderLookupError.message}`);
        skippedCount++;
        continue;
      }
      
      if (!folders || folders.length === 0) {
        Logger.debug(`No folder found for presentation '${presentation.title}' with path '${folderPath}'`);
        skippedCount++;
        continue;
      }
      
      // Find the best matching folder based on path similarity
      let bestMatchFolder = folders[0];
      let bestMatchScore = 0;
      
      for (const folder of folders) {
        // Simple matching score based on path overlap
        const folderPathParts = folder.path ? folder.path.split('/').filter(Boolean) : [];
        const presentationPathParts = folderPath.split('/').filter(Boolean);
        
        // Count matching parts
        let matchCount = 0;
        for (const part of presentationPathParts) {
          if (folderPathParts.includes(part)) {
            matchCount++;
          }
        }
        
        if (matchCount > bestMatchScore) {
          bestMatchScore = matchCount;
          bestMatchFolder = folder;
        }
      }
      
      // Now we have the best matching folder, search for MP4 files recursively
      const mp4Files = await findMp4FilesRecursively(supabase, bestMatchFolder.id, useSourcesGoogle2);
      
      if (mp4Files.length === 0) {
        Logger.debug(`No MP4 files found for presentation '${presentation.title}' in folder '${bestMatchFolder.name}'`);
        skippedCount++;
        continue;
      }
      
      // Get the best MP4 file
      const bestMp4File = getBestMp4File(mp4Files);
      
      if (!bestMp4File) {
        Logger.debug(`No suitable MP4 file found for presentation '${presentation.title}'`);
        skippedCount++;
        continue;
      }
      
      // Update the presentation with the main_video_id
      if (isDryRun) {
        Logger.info(`DRY RUN: Would update presentation '${presentation.title}' with main_video_id = ${bestMp4File.id} (${bestMp4File.name})`);
        updatedCount++;
      } else {
        const { data: updateResult, error: updateError } = await supabase
          .from('presentations')
          .update({ main_video_id: bestMp4File.id })
          .eq('id', presentation.id)
          .select();
        
        if (updateError) {
          Logger.error(`Error updating presentation '${presentation.title}': ${updateError.message}`);
          skippedCount++;
        } else {
          Logger.info(`Updated presentation '${presentation.title}' with main_video_id = ${bestMp4File.id} (${bestMp4File.name})`);
          updatedCount++;
        }
      }
    }
    
    // Final summary
    Logger.info('\n=== Summary ===');
    Logger.info(`Total presentations processed: ${presentationsWithoutVideo.length}`);
    Logger.info(`Presentations updated: ${updatedCount}`);
    Logger.info(`Presentations skipped: ${skippedCount}`);
    if (isDryRun) {
      Logger.info('Note: No actual changes were made (--dry-run mode)');
    }
    
  } catch (error: any) {
    Logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Add a flag to the args to specify which table to use
const useSourcesGoogle2 = !args.includes('--use-sources-google');

// Execute main function
updateMainVideoIds(useSourcesGoogle2).catch(error => {
  Logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});