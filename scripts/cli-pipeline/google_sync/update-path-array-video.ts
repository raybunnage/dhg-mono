#!/usr/bin/env ts-node
/**
 * Update Main Video ID from Path Array
 * 
 * This script takes a path_array as input, finds the folder (first element) and MP4 file (last element)
 * in the sources_google2 database, and sets the main_video_id for the folder and all its subfolders.
 * 
 * Usage:
 *   ts-node update-path-array-video.ts --path-array '["folder","subfolder","file.mp4"]'
 * 
 * Options:
 *   --path-array <json>   Path array in JSON string format
 *   --dry-run             Show what would be updated without making changes
 *   --verbose             Show detailed logs
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

// Get path array from command line
const pathArrayIndex = args.indexOf('--path-array');
let pathArray: string[] = [];
if (pathArrayIndex !== -1 && args[pathArrayIndex + 1]) {
  try {
    pathArray = JSON.parse(args[pathArrayIndex + 1]);
    if (!Array.isArray(pathArray)) {
      throw new Error('Path array must be a valid JSON array');
    }
  } catch (error) {
    console.error('Error parsing path array:', error);
    process.exit(1);
  }
} else {
  console.error('Missing required parameter: --path-array');
  process.exit(1);
}

/**
 * Process a matching folder
 */
async function processMatchingFolder(
  folders: any[], 
  supabase: any, 
  fileName: string, 
  isDryRun: boolean
): Promise<void> {
  // Sort the folders by similarity to the filename
  const sortedFolders = folders.sort((a, b) => {
    // Calculate similarity score based on filename overlap
    const aScore = calculateSimilarityScore(a.name, fileName);
    const bScore = calculateSimilarityScore(b.name, fileName);
    return bScore - aScore; // Higher score first
  });
  
  // Use the best matching folder
  const targetFolder = sortedFolders[0];
  Logger.info(`Using best match folder: "${targetFolder.name}" (${targetFolder.id})`);
  
  // Step 2: Find the MP4 file in sources_google2
  const { data: files, error: fileError } = await supabase
    .from('sources_google2')
    .select('id, name, drive_id, path, parent_folder_id')
    .eq('mime_type', 'video/mp4')
    .eq('is_deleted', false)
    .eq('name', fileName);
  
  if (fileError) {
    Logger.error(`Error finding file: ${fileError.message}`);
    process.exit(1);
  }

  if (!files || files.length === 0) {
    Logger.error(`No file found with name: ${fileName}`);
    process.exit(1);
  }

  const targetFile = files[0];
  Logger.info(`Found file: "${targetFile.name}" (${targetFile.id})`);
  
  // Step 3: Update the folder's main_video_id
  if (isDryRun) {
    Logger.info(`DRY RUN: Would update folder "${targetFolder.name}" with main_video_id = ${targetFile.id}`);
  } else {
    const { data: updateResult, error: updateError } = await supabase
      .from('sources_google2')
      .update({ main_video_id: targetFile.id })
      .eq('id', targetFolder.id);
    
    if (updateError) {
      Logger.error(`Error updating folder: ${updateError.message}`);
    } else {
      Logger.info(`Updated folder "${targetFolder.name}" with main_video_id = ${targetFile.id}`);
    }
  }
  
  // Step 4: Find all related subfolders and files to update
  const { data: relatedItems, error: relatedError } = await supabase
    .from('sources_google2')
    .select('id, name, mime_type')
    .eq('is_deleted', false)
    .contains('path_array', [targetFolder.name]);
  
  if (relatedError) {
    Logger.error(`Error finding related items: ${relatedError.message}`);
  } else if (relatedItems && relatedItems.length > 0) {
    Logger.info(`Found ${relatedItems.length} related items to update with main_video_id`);
    
    if (isDryRun) {
      Logger.info(`DRY RUN: Would update ${relatedItems.length} related items with main_video_id = ${targetFile.id}`);
    } else {
      // Update in batches to avoid hitting API limits
      const batchSize = 50;
      for (let i = 0; i < relatedItems.length; i += batchSize) {
        const batch = relatedItems.slice(i, i + batchSize);
        const batchIds = batch.map(item => item.id);
        
        const { error: batchUpdateError } = await supabase
          .from('sources_google2')
          .update({ main_video_id: targetFile.id })
          .in('id', batchIds);
        
        if (batchUpdateError) {
          Logger.error(`Error updating batch: ${batchUpdateError.message}`);
        } else {
          Logger.info(`Updated batch of ${batch.length} items with main_video_id = ${targetFile.id}`);
        }
      }
    }
  }
  
  // Final summary
  Logger.info('\n=== Summary ===');
  Logger.info(`Folder: ${targetFolder.name} (${targetFolder.id})`);
  Logger.info(`File: ${targetFile.name} (${targetFile.id})`);
  if (isDryRun) {
    Logger.info('Note: No actual changes were made (--dry-run mode)');
  }
}

/**
 * Calculate similarity score between two strings
 */
function calculateSimilarityScore(str1: string, str2: string): number {
  // Convert strings to lowercase for better matching
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Split into words
  const words1 = s1.split(/[\s\-_\.]+/).filter(Boolean);
  const words2 = s2.split(/[\s\-_\.]+/).filter(Boolean);
  
  // Count matching words
  let matchCount = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1.includes(word2) || word2.includes(word1)) {
        matchCount++;
      }
    }
  }
  
  return matchCount;
}

/**
 * Main function to update main_video_id from path array
 */
async function updateMainVideoIdFromPathArray(pathArray: string[]): Promise<void> {
  console.log('=== Update Main Video ID from Path Array ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
  console.log(`Path Array: ${JSON.stringify(pathArray)}`);
  console.log('=========================================');

  if (pathArray.length < 2) {
    Logger.error('Path array must have at least 2 elements (folder and file)');
    process.exit(1);
  }

  // Extract folder and file
  const folderName = pathArray[0];
  let fileName = '';
  
  // Find the last element ending with .mp4 (or similar)
  for (let i = pathArray.length - 1; i >= 0; i--) {
    const item = pathArray[i];
    if (item && (item.endsWith('.mp4') || item.endsWith('.m4v'))) {
      fileName = item;
      break;
    }
  }

  if (!fileName) {
    Logger.error('No MP4 file found in path array');
    process.exit(1);
  }

  // Initialize Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Step 1: Find the folder in sources_google2
    // Use exact match to avoid URL encoding issues with special characters
    const { data: folders, error: folderError } = await supabase
      .from('sources_google2')
      .select('id, name, drive_id, path, path_depth')
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .eq('is_deleted', false)
      .eq('name', folderName);
    
    if (folderError) {
      Logger.error(`Error finding folder: ${folderError.message}`);
      process.exit(1);
    }

    if (!folders || folders.length === 0) {
      // If exact match fails, try a more flexible search (strip quotes, trim)
      const simplifiedName = folderName.replace(/["']/g, '').trim();
      Logger.debug(`Exact match failed, trying simplified name: "${simplifiedName}"`);
      
      const { data: altFolders, error: altError } = await supabase
        .from('sources_google2')
        .select('id, name, drive_id, path, path_depth')
        .eq('mime_type', 'application/vnd.google-apps.folder')
        .eq('is_deleted', false)
        .ilike('name', `%${simplifiedName}%`);
      
      if (altError || !altFolders || altFolders.length === 0) {
        Logger.error(`No folder found with name: ${folderName}`);
        process.exit(1);
      }
      
      Logger.info(`Found ${altFolders.length} potential folder matches using flexible search`);
      return await processMatchingFolder(altFolders, supabase, fileName, isDryRun);
    }

    // If multiple folders found, prefer one with path_depth = 0
    let targetFolder = folders.find(f => f.path_depth === 0) || folders[0];
    Logger.info(`Found folder: "${targetFolder.name}" (${targetFolder.id})`);
    
    // Step 2: Find the MP4 file in sources_google2
    const { data: files, error: fileError } = await supabase
      .from('sources_google2')
      .select('id, name, drive_id, path, parent_folder_id')
      .eq('mime_type', 'video/mp4')
      .eq('is_deleted', false)
      .eq('name', fileName);
    
    if (fileError) {
      Logger.error(`Error finding file: ${fileError.message}`);
      process.exit(1);
    }

    if (!files || files.length === 0) {
      // Try a more flexible search if exact match fails
      Logger.debug(`Exact file match failed, trying flexible search for: "${fileName}"`);
      
      // Extract name without extension and any dates
      const baseName = fileName.replace(/\.(mp4|m4v)$/i, '');
      
      const { data: altFiles, error: altFileError } = await supabase
        .from('sources_google2')
        .select('id, name, drive_id, path, parent_folder_id')
        .eq('mime_type', 'video/mp4')
        .eq('is_deleted', false)
        .ilike('name', `%${baseName}%`);
        
      if (altFileError || !altFiles || altFiles.length === 0) {
        Logger.error(`No file found with name: ${fileName}`);
        process.exit(1);
      }
      
      // Sort files by similarity to requested filename
      const sortedFiles = altFiles.sort((a, b) => {
        const aScore = calculateSimilarityScore(a.name, fileName);
        const bScore = calculateSimilarityScore(b.name, fileName);
        return bScore - aScore; // Higher score first
      });
      
      // Update the files reference with the sorted results
      const fileResults = [...sortedFiles];
      Logger.info(`Found ${fileResults.length} potential file matches using flexible search`);
      Logger.info(`Using best match: "${fileResults[0].name}"`);
      
      // Set files to our found matches
      files = fileResults;
    }

    const targetFile = files[0];
    Logger.info(`Found file: "${targetFile.name}" (${targetFile.id})`);
    
    // Step 3: Update the folder's main_video_id
    if (isDryRun) {
      Logger.info(`DRY RUN: Would update folder "${targetFolder.name}" with main_video_id = ${targetFile.id}`);
    } else {
      const { data: updateResult, error: updateError } = await supabase
        .from('sources_google2')
        .update({ main_video_id: targetFile.id })
        .eq('id', targetFolder.id);
      
      if (updateError) {
        Logger.error(`Error updating folder: ${updateError.message}`);
      } else {
        Logger.info(`Updated folder "${targetFolder.name}" with main_video_id = ${targetFile.id}`);
      }
    }
    
    // Step 4: Find all related subfolders and files to update
    const { data: relatedItems, error: relatedError } = await supabase
      .from('sources_google2')
      .select('id, name, mime_type')
      .eq('is_deleted', false)
      .contains('path_array', [folderName]);
    
    if (relatedError) {
      Logger.error(`Error finding related items: ${relatedError.message}`);
    } else if (relatedItems && relatedItems.length > 0) {
      Logger.info(`Found ${relatedItems.length} related items to update with main_video_id`);
      
      if (isDryRun) {
        Logger.info(`DRY RUN: Would update ${relatedItems.length} related items with main_video_id = ${targetFile.id}`);
      } else {
        // Update in batches to avoid hitting API limits
        const batchSize = 50;
        for (let i = 0; i < relatedItems.length; i += batchSize) {
          const batch = relatedItems.slice(i, i + batchSize);
          const batchIds = batch.map(item => item.id);
          
          const { error: batchUpdateError } = await supabase
            .from('sources_google2')
            .update({ main_video_id: targetFile.id })
            .in('id', batchIds);
          
          if (batchUpdateError) {
            Logger.error(`Error updating batch: ${batchUpdateError.message}`);
          } else {
            Logger.info(`Updated batch of ${batch.length} items with main_video_id = ${targetFile.id}`);
          }
        }
      }
    }
    
    // Final summary
    Logger.info('\n=== Summary ===');
    Logger.info(`Folder: ${targetFolder.name} (${targetFolder.id})`);
    Logger.info(`File: ${targetFile.name} (${targetFile.id})`);
    if (isDryRun) {
      Logger.info('Note: No actual changes were made (--dry-run mode)');
    }
    
  } catch (error: any) {
    Logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Execute main function
updateMainVideoIdFromPathArray(pathArray).catch(error => {
  Logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});