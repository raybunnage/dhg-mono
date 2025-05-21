#!/usr/bin/env ts-node
/**
 * Update Main Video ID
 * 
 * This script finds a folder with path_depth=0 by name and an MP4 file by name,
 * then updates the main_video_id of the folder to the found MP4 file ID.
 * 
 * Usage:
 *   ts-node update-main-video-id.ts --folder-name <folder-name> --video-name <video-name>
 * 
 * Options:
 *   --folder-name <name>    Name of the folder with path_depth=0 to find
 *   --video-name <name>     Name of the video file (MP4) to set as main_video_id
 *   --verbose               Show detailed logs
 *   --dry-run               Don't make any actual changes, just show what would happen
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
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

// Extract options
const folderNameIndex = args.indexOf('--folder-name');
const videoNameIndex = args.indexOf('--video-name');
const isVerbose = args.includes('--verbose');
const isDryRun = args.includes('--dry-run');

// Configure logger based on verbosity
if (isVerbose) {
  Logger.setLevel(LogLevel.DEBUG);
} else {
  Logger.setLevel(LogLevel.INFO);
}

// Validate arguments
if (folderNameIndex === -1 || !args[folderNameIndex + 1] || videoNameIndex === -1 || !args[videoNameIndex + 1]) {
  console.error('Error: Both --folder-name and --video-name are required parameters');
  console.error('Usage: ts-node update-main-video-id.ts --folder-name <folder-name> --video-name <video-name> [--dry-run] [--verbose]');
  process.exit(1);
}

// Get the folder and video names from the arguments
const folderName = args[folderNameIndex + 1];
const videoName = args[videoNameIndex + 1];

/**
 * Main function to update the main_video_id for a folder
 */
async function updateMainVideoId(): Promise<void> {
  Logger.info('=== Update Main Video ID ===');
  Logger.info(`Folder Name: ${folderName}`);
  Logger.info(`Video Name: ${videoName}`);
  
  if (isDryRun) {
    Logger.info('DRY RUN MODE - No changes will be made to the database');
  }
  
  // Initialize Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Step 1: Find the folder with path_depth=0 by name
    Logger.debug(`Looking for folder: ${folderName} with path_depth=0`);
    const { data: folder, error: folderError } = await supabase
      .from('sources_google')
      .select('id, name, path, drive_id, path_depth, main_video_id, metadata')
      .eq('path_depth', 0)
      .eq('is_deleted', false)
      .ilike('name', folderName)
      .single();
    
    if (folderError) {
      Logger.error(`Error finding folder: ${folderError.message}`);
      process.exit(1);
    }
    
    if (!folder) {
      Logger.error(`No folder found with name: ${folderName} and path_depth=0`);
      process.exit(1);
    }
    
    Logger.info(`Found folder: ${folder.name} (ID: ${folder.id})`);
    
    // Step 2: Find the video file by name
    Logger.debug(`Looking for video file: ${videoName}`);
    const { data: videoFiles, error: videoError } = await supabase
      .from('sources_google')
      .select('id, name, drive_id, mime_type, path')
      .eq('mime_type', 'video/mp4')
      .eq('is_deleted', false)
      .ilike('name', videoName);
    
    if (videoError) {
      Logger.error(`Error finding video file: ${videoError.message}`);
      process.exit(1);
    }
    
    if (!videoFiles || videoFiles.length === 0) {
      Logger.error(`No video file found with name: ${videoName}`);
      process.exit(1);
    }
    
    // If multiple videos found, use the first one and warn
    if (videoFiles.length > 1) {
      Logger.warn(`Found ${videoFiles.length} matching videos. Using the first match: ${videoFiles[0].name}`);
    }
    
    const videoFile = videoFiles[0];
    Logger.info(`Found video file: ${videoFile.name} (ID: ${videoFile.id})`);
    
    // Step 3: Check if main_video_id is already set
    if (folder.main_video_id === videoFile.id) {
      Logger.info(`Folder ${folder.name} already has main_video_id set to ${videoFile.name}. No update needed.`);
      process.exit(0);
    }
    
    // Step 4: Update the main_video_id field
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    
    // Prepare metadata update
    const metadata = {
      ...folder.metadata, // Keep existing metadata
      video_correction: {
        previous_main_video_id: folder.main_video_id,
        new_main_video_id: videoFile.id,
        corrected_on: formattedDate,
        video_name: videoFile.name
      }
    };
    
    if (!isDryRun) {
      // Update the main_video_id field
      const { data: updateResult, error: updateError } = await supabase
        .from('sources_google')
        .update({ 
          main_video_id: videoFile.id,
          metadata: metadata
        })
        .eq('id', folder.id)
        .select();
      
      if (updateError) {
        Logger.error(`Error updating main_video_id: ${updateError.message}`);
        process.exit(1);
      }
      
      Logger.info(`✅ Successfully updated main_video_id for folder '${folder.name}'`);
      Logger.info(`Previous main_video_id: ${folder.main_video_id || 'None'}`);
      Logger.info(`New main_video_id: ${videoFile.id} (${videoFile.name})`);
      Logger.info(`Metadata updated with correction information`);
      
      // Step 5: Update any related files in the folder tree with the same main_video_id
      const { data: relatedFiles, error: relatedError } = await supabase
        .from('sources_google')
        .select('id, name')
        .eq('is_deleted', false)
        .contains('path_array', [folder.name]);
        
      if (relatedError) {
        Logger.error(`Error finding related files: ${relatedError.message}`);
      } else if (relatedFiles && relatedFiles.length > 0) {
        Logger.info(`Updating main_video_id for ${relatedFiles.length} related files in the folder tree`);
        
        // Update in batches of 50 to avoid overwhelming the database
        const batchSize = 50;
        for (let i = 0; i < relatedFiles.length; i += batchSize) {
          const batch = relatedFiles.slice(i, i + batchSize);
          const relatedIds = batch.map(f => f.id);
          
          const { error: batchError } = await supabase
            .from('sources_google')
            .update({ main_video_id: videoFile.id })
            .in('id', relatedIds);
            
          if (batchError) {
            Logger.error(`Error updating batch of files: ${batchError.message}`);
          } else {
            Logger.debug(`Updated ${batch.length} related files (batch ${Math.floor(i/batchSize) + 1})`);
          }
        }
        
        Logger.info(`✅ Updated main_video_id for all related files in the folder tree`);
      } else {
        Logger.info(`No related files found in the folder tree`);
      }
    } else {
      // Dry run mode - just show what would happen
      Logger.info(`DRY RUN: Would update main_video_id for folder '${folder.name}'`);
      Logger.info(`DRY RUN: Previous main_video_id: ${folder.main_video_id || 'None'}`);
      Logger.info(`DRY RUN: New main_video_id would be: ${videoFile.id} (${videoFile.name})`);
      Logger.info(`DRY RUN: Would update metadata with correction information`);
      
      // Show how many related files would be updated
      const { data: relatedFiles, error: relatedError } = await supabase
        .from('sources_google')
        .select('id', { count: 'exact' })
        .eq('is_deleted', false)
        .contains('path_array', [folder.name]);
        
      if (relatedError) {
        Logger.error(`Error finding related files: ${relatedError.message}`);
      } else {
        const count = relatedFiles?.length || 0;
        Logger.info(`DRY RUN: Would update main_video_id for ${count} related files in the folder tree`);
      }
    }
  } catch (error) {
    Logger.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Execute main function if run directly
if (require.main === module) {
  updateMainVideoId().catch(error => {
    Logger.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  });
}

// Export for use in other modules
export { updateMainVideoId };