#!/usr/bin/env ts-node
/**
 * Count MP4 Files
 * 
 * This script counts how many MP4 files are in Google Drive (sources_google table)
 * and how many are associated with presentations.
 * 
 * Usage:
 *   ts-node count-mp4-files.ts [options]
 * 
 * Options:
 *   --folder-id <id>   Specify a folder ID (default: Dynamic Healing Discussion Group)
 *   --verbose          Show detailed logs
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

/**
 * Main function to count MP4 files
 */
async function countMp4Files(): Promise<void> {
  console.log('=== Count MP4 Files ===');
  console.log(`Folder ID: ${folderId}`);
  console.log('=====================');

  // Initialize Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Step 1: Get folder info to verify it exists
    const { data: folderInfo, error: folderError } = await supabase
      .from('sources_google')
      .select('id, name, path')
      .eq('drive_id', folderId)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .single();
    
    if (folderError) {
      Logger.error(`Error fetching folder info: ${folderError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Working with folder: "${folderInfo.name}" (${folderId})`);
    
    // Step 2: Get all MP4 files in the database
    let query1 = supabase
      .from('sources_google')
      .select('id, name, path, drive_id, parent_path, parent_folder_id, web_view_link, modified_time, mime_type')
      .eq('deleted', false)
      .eq('mime_type', 'video/mp4');
    
    const { data: mp4ByMimeType, error: error1 } = await query1;
    
    if (error1) {
      Logger.error(`Error fetching MP4 files by MIME type: ${error1.message}`);
      process.exit(1);
    }
    
    Logger.info(`Found ${mp4ByMimeType?.length || 0} files with MIME type 'video/mp4'`);
    
    // Next, get files by filename extension
    let query2 = supabase
      .from('sources_google')
      .select('id, name, path, drive_id, parent_path, parent_folder_id, web_view_link, modified_time, mime_type')
      .eq('deleted', false)
      .or('name.ilike.%.mp4,name.ilike.%.m4v');
    
    const { data: mp4ByExtension, error: error2 } = await query2;
    
    if (error2) {
      Logger.error(`Error fetching MP4 files by extension: ${error2.message}`);
      process.exit(1);
    }
    
    Logger.info(`Found ${mp4ByExtension?.length || 0} files with .mp4 or .m4v extension`);
    
    // Combine results and remove duplicates
    const mp4Files = [];
    const seenIds = new Set();
    
    // Add files from mime type query
    if (mp4ByMimeType) {
      for (const file of mp4ByMimeType) {
        if (!seenIds.has(file.id)) {
          mp4Files.push(file);
          seenIds.add(file.id);
        }
      }
    }
    
    // Add files from extension query
    if (mp4ByExtension) {
      for (const file of mp4ByExtension) {
        if (!seenIds.has(file.id)) {
          mp4Files.push(file);
          seenIds.add(file.id);
        }
      }
    }
    
    Logger.info(`Combined total MP4 files: ${mp4Files.length}`);
    
    // Filter to only include files under the specified folder
    const folderPath = folderInfo.path;
    const folderName = folderInfo.name;
    
    // Debug the folder path
    Logger.debug(`Folder path: ${folderPath}`);
    
    const mp4FilesInFolder = mp4Files.filter(file => {
      // Check if parent_folder_id matches
      if (file.parent_folder_id === folderId) {
        return true;
      }
      
      // Check if path or parent_path includes the folder name or path
      if (file.path && (file.path.includes(folderName) || file.path.includes(folderPath))) {
        return true;
      }
      
      if (file.parent_path && (
        file.parent_path.includes(folderName) || 
        file.parent_path.startsWith(folderName) ||
        file.parent_path.includes(folderPath.substring(1)) // Remove leading slash
      )) {
        return true;
      }
      
      return false;
    });
    
    Logger.info(`MP4 files in folder "${folderInfo.name}": ${mp4FilesInFolder.length}`);
    
    // Step 3: Get existing presentations that have these MP4 files as main_video_id
    const mp4FileIds = mp4FilesInFolder.map(file => file.id);
    
    const { data: existingPresentations, error: presentationError } = await supabase
      .from('presentations')
      .select('id, title, main_video_id, filename')
      .in('main_video_id', mp4FileIds);
    
    if (presentationError) {
      Logger.error(`Error fetching existing presentations: ${presentationError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Presentations with main_video_id in the folder: ${existingPresentations?.length || 0}`);
    
    // Step 4: Get all presentations
    const { data: allPresentations, error: allPresentationsError } = await supabase
      .from('presentations')
      .select('id, title, main_video_id, filename');
    
    if (allPresentationsError) {
      Logger.error(`Error fetching all presentations: ${allPresentationsError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Total presentations in database: ${allPresentations?.length || 0}`);
    
    // Count presentations with null main_video_id
    const presentationsWithNullVideo = allPresentations.filter(p => !p.main_video_id);
    Logger.info(`Presentations with null main_video_id: ${presentationsWithNullVideo.length}`);
    
    // Files without presentations
    const mp4FilesWithoutPresentation = mp4FilesInFolder.filter(file => 
      !allPresentations.some(p => p.main_video_id === file.id)
    );
    
    Logger.info(`MP4 files in folder without presentations: ${mp4FilesWithoutPresentation.length}`);
    
    if (mp4FilesWithoutPresentation.length > 0) {
      Logger.info("Sample MP4 files without presentations:");
      for (let i = 0; i < Math.min(10, mp4FilesWithoutPresentation.length); i++) {
        Logger.info(`  - ${mp4FilesWithoutPresentation[i].name} (${mp4FilesWithoutPresentation[i].id})`);
      }
    }
    
    // Presentations with MP4 files not in the folder
    const presentationsWithFileNotInFolder = allPresentations.filter(p => 
      p.main_video_id && !mp4FileIds.includes(p.main_video_id)
    );
    
    Logger.info(`Presentations with main_video_id NOT in the folder: ${presentationsWithFileNotInFolder.length}`);
    
    if (presentationsWithFileNotInFolder.length > 0) {
      Logger.info("Sample presentations with main_video_id not in the folder:");
      for (let i = 0; i < Math.min(10, presentationsWithFileNotInFolder.length); i++) {
        Logger.info(`  - ${presentationsWithFileNotInFolder[i].title} (video ID: ${presentationsWithFileNotInFolder[i].main_video_id})`);
      }
    }
    
    // Final summary
    Logger.info('\n=== Summary ===');
    Logger.info(`Total MP4 files: ${mp4Files.length}`);
    Logger.info(`MP4 files in "${folderInfo.name}": ${mp4FilesInFolder.length}`);
    Logger.info(`Total presentations: ${allPresentations.length}`);
    Logger.info(`Presentations with MP4 in "${folderInfo.name}": ${existingPresentations.length}`);
    Logger.info(`Presentations to create: ${mp4FilesWithoutPresentation.length}`);
    
  } catch (error: any) {
    Logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Execute main function
countMp4Files().catch(error => {
  Logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});