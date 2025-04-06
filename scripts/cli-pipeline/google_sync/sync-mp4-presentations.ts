#!/usr/bin/env ts-node
/**
 * Sync MP4 Files with Presentations
 * 
 * This script synchronizes MP4 files from Google Drive (sources_google table)
 * with the presentations table. It ensures there is one presentation record
 * for every MP4 file in the specified folder.
 * 
 * Usage:
 *   ts-node sync-mp4-presentations.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be synced without making changes
 *   --folder-id <id>   Specify a folder ID (default: Dynamic Healing Discussion Group)
 *   --verbose          Show detailed logs
 *   --limit <n>        Limit processing to n records (default: no limit)
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
 * Main function to sync MP4 files with presentations
 */
async function syncMp4Presentations(): Promise<void> {
  console.log('=== Sync MP4 Files with Presentations ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL SYNC'}`);
  console.log(`Folder ID: ${folderId}`);
  if (limit) console.log(`Limit: ${limit} records`);
  console.log('=========================================');

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
    
    // Step 2: Get all MP4 files in the folder and its subfolders
    // First, let's get any files with proper mime_type
    let query1 = supabase
      .from('sources_google')
      .select('id, name, path, drive_id, parent_path, parent_folder_id, web_view_link, modified_time, mime_type')
      .eq('deleted', false)
      .eq('mime_type', 'video/mp4');
    
    // Add limit if specified
    if (limit) {
      query1 = query1.limit(limit);
    }
    
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
    
    // Add limit if specified
    if (limit) {
      query2 = query2.limit(limit);
    }
    
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
    
    if (isVerbose) {
      Logger.debug(`Combined total MP4 files: ${mp4Files.length}`);
    }
    
    if (mp4Files.length === 0) {
      Logger.info('No MP4 files found.');
      return;
    }
    
    // Filter to only include files under the specified folder
    const folderPath = folderInfo.path;
    
    // Debug the folder path
    Logger.debug(`Folder path: ${folderPath}`);
    
    if (isVerbose) {
      // Show a few sample paths for debugging
      if (mp4Files.length > 0) {
        Logger.debug("Sample file paths:");
        for (let i = 0; i < Math.min(5, mp4Files.length); i++) {
          Logger.debug(`  - ${mp4Files[i].path || 'null'} (parent: ${mp4Files[i].parent_path || 'null'})`);
        }
      }
    }
    
    // Filter to only include files under the specified folder
    const mp4FilesInFolder = mp4Files.filter(file => {
      // Check if parent_folder_id matches
      if (file.parent_folder_id === folderId) {
        return true;
      }
      
      // Check if path or parent_path includes the folder name (with or without leading slash)
      const folderName = folderInfo.name;
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
    
    Logger.info(`Found ${mp4FilesInFolder.length} MP4 files in folder "${folderInfo.name}"`);
    
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
    
    const existingPresentationMap = new Map();
    (existingPresentations || []).forEach(presentation => {
      if (presentation.main_video_id) {
        existingPresentationMap.set(presentation.main_video_id, presentation);
      }
    });
    
    // Step 4: Determine which MP4 files need new presentations
    const filesToProcess = mp4FilesInFolder.filter(file => !existingPresentationMap.has(file.id));
    
    Logger.info(`Found ${existingPresentationMap.size} existing presentations`);
    Logger.info(`Need to create ${filesToProcess.length} new presentations`);
    
    if (filesToProcess.length === 0) {
      Logger.info('All MP4 files already have presentations. Nothing to do.');
      return;
    }
    
    // Step 5: For each MP4 file without a presentation, create one
    if (isDryRun) {
      Logger.info('DRY RUN: Would create the following presentations:');
      filesToProcess.forEach((file, index) => {
        Logger.info(`${index + 1}. ${file.name} (${file.id})`);
      });
    } else {
      Logger.info('Creating new presentations...');
      
      const createdCount = await createPresentations(supabase, filesToProcess);
      Logger.info(`Successfully created ${createdCount} presentations`);
    }
    
    // Final summary
    Logger.info('\n=== Summary ===');
    Logger.info(`Total MP4 files: ${mp4FilesInFolder.length}`);
    Logger.info(`Existing presentations: ${existingPresentationMap.size}`);
    Logger.info(`Presentations to create: ${filesToProcess.length}`);
    
  } catch (error: any) {
    Logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Create presentations for MP4 files
 */
async function createPresentations(supabase: any, files: any[]): Promise<number> {
  let successCount = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      Logger.debug(`Processing file ${i + 1}/${files.length}: ${file.name}`);
      
      // Extract useful metadata for the presentation
      const filePathParts = file.path?.split('/') || [];
      const folderPath = filePathParts.slice(0, -1).join('/') || file.parent_path || '/';
      
      // Try to parse a date from the filename or path
      let recordedDate = null;
      const datePattern = /\d{1,2}[-\._]\d{1,2}[-\._]\d{2,4}|\d{4}[-\._]\d{1,2}[-\._]\d{1,2}/;
      const dateMatch = file.name.match(datePattern) || file.path?.match(datePattern);
      
      if (dateMatch) {
        // Attempt to parse the date
        try {
          const dateStr = dateMatch[0].replace(/[-\._]/g, '-');
          recordedDate = new Date(dateStr).toISOString();
        } catch (e) {
          // If we can't parse the date, just use the file's modified time
          recordedDate = file.modified_time;
        }
      } else {
        // Use modified time as fallback
        recordedDate = file.modified_time;
      }
      
      // Try to extract a presenter name from the filename
      let presenterName = null;
      // Look for patterns like "Name.Topic" or similar
      const namePattern = /^([\w\s]+?)\./;
      const nameMatch = file.name.match(namePattern);
      
      if (nameMatch && nameMatch[1]) {
        presenterName = nameMatch[1].trim();
      }
      
      // Create presentation record
      const newPresentation = {
        main_video_id: file.id,
        filename: file.name,
        folder_path: folderPath,
        title: file.name.replace(/\.[^.]+$/, ''), // Remove file extension
        recorded_date: recordedDate,
        presenter_name: presenterName,
        is_public: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        transcript_status: 'pending'
      };
      
      const { data, error } = await supabase
        .from('presentations')
        .insert(newPresentation)
        .select();
      
      if (error) {
        Logger.error(`Error creating presentation for ${file.name}: ${error.message}`);
      } else {
        Logger.info(`Created presentation for ${file.name} (ID: ${data[0].id})`);
        successCount++;
      }
    } catch (error: any) {
      Logger.error(`Error processing file ${file.name}: ${error.message}`);
    }
  }
  
  return successCount;
}

// Execute main function
syncMp4Presentations().catch(error => {
  Logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});