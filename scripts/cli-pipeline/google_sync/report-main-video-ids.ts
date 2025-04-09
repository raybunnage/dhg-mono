#!/usr/bin/env ts-node
/**
 * Report Main Video IDs
 * 
 * This script reports on main_video_id values for folders directly beneath
 * the root folder of Dynamic Healing Discussion Group. For each folder (most with dates
 * in their names), it prints out the filename of the video that is the main_video_id
 * if one has been identified.
 * 
 * Usage:
 *   ts-node report-main-video-ids.ts [options]
 * 
 * Options:
 *   --folder-id <id>    Specify a folder ID (default: Dynamic Healing Discussion Group)
 *   --verbose           Show detailed logs
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
 * Main function to report on main_video_id values
 */
async function reportMainVideoIds(): Promise<void> {
  console.log('=== Report on Main Video IDs ===');
  console.log(`Root Folder ID: ${folderId}`);
  console.log('===============================');

  // Initialize Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Step 1: Verify the root folder exists
    const { data: rootFolder, error: rootFolderError } = await supabase
      .from('sources_google')
      .select('id, name, path')
      .eq('drive_id', folderId)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .single();
    
    if (rootFolderError) {
      Logger.error(`Error fetching root folder info: ${rootFolderError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Root folder: "${rootFolder.name}" (${folderId})`);
    
    // Step 2: Find all subfolders directly under the root folder
    const { data: subFolders, error: subFoldersError } = await supabase
      .from('sources_google')
      .select('id, name, path, drive_id, parent_folder_id')
      .eq('parent_folder_id', folderId)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .eq('deleted', false)
      .order('name');
    
    if (subFoldersError) {
      Logger.error(`Error fetching subfolders: ${subFoldersError.message}`);
      process.exit(1);
    }
    
    if (!subFolders || subFolders.length === 0) {
      Logger.info('No subfolders found under the root folder.');
      return;
    }
    
    Logger.info(`Found ${subFolders.length} subfolders under the root folder.\n`);
    
    // Create a table header for the report
    console.log('| Folder Name | Main Video Filename | Main Video ID | Status |');
    console.log('|-------------|---------------------|--------------|--------|');
    
    // Step 3: For each subfolder, check if there's a main_video_id
    for (const folder of subFolders) {
      Logger.debug(`Processing folder: ${folder.name}`);
      
      // Find presentations that have this folder's ID as parent_folder_id
      const { data: presentations, error: presentationsError } = await supabase
        .from('presentations')
        .select(`
          id, 
          title,
          main_video_id,
          sources_google!presentations_main_video_id_fkey (id, name)
        `)
        .eq('folder_id', folder.id)
        .not('main_video_id', 'is', null);
      
      if (presentationsError) {
        Logger.error(`Error fetching presentations for folder ${folder.name}: ${presentationsError.message}`);
        continue;
      }
      
      // Format and output the results
      if (presentations && presentations.length > 0) {
        // Has presentation with main_video_id
        for (const presentation of presentations) {
          // Handle the nested sources_google object
          const sourceGoogle = presentation.sources_google as { name: string } | null;
          const videoName = sourceGoogle?.name || 'Unknown';
          const videoId = presentation.main_video_id || 'None';
          
          console.log(`| ${folder.name.padEnd(11)} | ${videoName.padEnd(19)} | ${videoId.padEnd(12)} | Found    |`);
        }
      } else {
        // No presentation with main_video_id found
        // Check if any MP4 files exist in this folder
        const { data: mp4Files, error: mp4Error } = await supabase
          .from('sources_google')
          .select('id, name')
          .eq('parent_folder_id', folder.id)
          .eq('mime_type', 'video/mp4')
          .eq('deleted', false);
        
        if (mp4Error) {
          Logger.error(`Error fetching MP4 files for folder ${folder.name}: ${mp4Error.message}`);
          continue;
        }
        
        if (mp4Files && mp4Files.length > 0) {
          // Has MP4 files but no main_video_id
          console.log(`| ${folder.name.padEnd(11)} | ${'No main video set'.padEnd(19)} | ${'None'.padEnd(12)} | Missing  |`);
        } else {
          // No MP4 files found
          console.log(`| ${folder.name.padEnd(11)} | ${'No MP4 files'.padEnd(19)} | ${'None'.padEnd(12)} | No files |`);
        }
      }
    }
    
    // Add summary information at the end
    console.log('\nSummary:');
    
    // Count folders with and without main_video_id
    let foldersWithMainVideo = 0;
    let foldersWithoutMainVideo = 0;
    let foldersWithoutMp4 = 0;
    
    for (const folder of subFolders) {
      // Check if there's a presentation with main_video_id
      const { data: presentations, error: presentationsError } = await supabase
        .from('presentations')
        .select('id')
        .eq('folder_id', folder.id)
        .not('main_video_id', 'is', null);
      
      if (presentationsError) {
        Logger.error(`Error fetching presentations for folder ${folder.name}: ${presentationsError.message}`);
        continue;
      }
      
      if (presentations && presentations.length > 0) {
        foldersWithMainVideo++;
      } else {
        // Check if there are MP4 files
        const { data: mp4Files, error: mp4Error } = await supabase
          .from('sources_google')
          .select('id')
          .eq('parent_folder_id', folder.id)
          .eq('mime_type', 'video/mp4')
          .eq('deleted', false);
        
        if (mp4Error) {
          Logger.error(`Error fetching MP4 files for folder ${folder.name}: ${mp4Error.message}`);
          continue;
        }
        
        if (mp4Files && mp4Files.length > 0) {
          foldersWithoutMainVideo++;
        } else {
          foldersWithoutMp4++;
        }
      }
    }
    
    console.log(`- Folders with main_video_id: ${foldersWithMainVideo}`);
    console.log(`- Folders missing main_video_id: ${foldersWithoutMainVideo}`);
    console.log(`- Folders without MP4 files: ${foldersWithoutMp4}`);
    console.log(`- Total folders: ${subFolders.length}`);
    
  } catch (error: any) {
    Logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Execute main function
reportMainVideoIds().catch(error => {
  Logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});