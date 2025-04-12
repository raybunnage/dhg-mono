#\!/usr/bin/env ts-node
/**
 * Update Main Video ID from Folder-Video Mapping
 * 
 * This script takes a folder-to-file mapping as input, finds the folder and file
 * in the sources_google database, and sets the main_video_id for the folder and all its subfolders.
 * 
 * Usage:
 *   ts-node update-folder-video-mapping.ts --mapping "'folder name': 'file.mp4'"
 * 
 * Options:
 *   --mapping <string>   Mapping in the format: 'folder name': 'file.mp4'
 *   --dry-run            Show what would be updated without making changes
 *   --verbose            Show detailed logs
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

// Show loaded env vars for debugging
console.log(`Current process.env after loading: ${Object.keys(process.env)}`);

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

if (isVerbose) {
  Logger.setLevel(LogLevel.DEBUG);
} else {
  Logger.setLevel(LogLevel.INFO);
}

// Get mapping from command line
const mappingIndex = args.indexOf('--mapping');
let folderName = '';
let fileName = '';

if (mappingIndex \!== -1 && args[mappingIndex + 1]) {
  const mappingStr = args[mappingIndex + 1];
  
  try {
    // Parse mapping string in format: 'folder name': 'file name.mp4'
    const colonIndex = mappingStr.indexOf(':');
    if (colonIndex === -1) {
      throw new Error("Mapping must be in format: 'folder name': 'file name.mp4'");
    }
    
    const folderPart = mappingStr.substring(0, colonIndex).trim();
    const filePart = mappingStr.substring(colonIndex + 1).trim();
    
    // Extract folder name from single quotes
    const folderMatch = folderPart.match(/^['"](.+)['"]$/);
    if (\!folderMatch) {
      throw new Error("Folder name must be in quotes");
    }
    folderName = folderMatch[1];
    
    // Extract file name from single quotes
    const fileMatch = filePart.match(/^['"](.+)['"]$/);
    if (\!fileMatch) {
      throw new Error("File name must be in quotes");
    }
    fileName = fileMatch[1];
    
  } catch (error) {
    console.error('Error parsing mapping:', error);
    process.exit(1);
  }
} else {
  console.error('Missing required parameter: --mapping');
  console.error("Format should be: --mapping '2022-04-20-Tauben': 'Tauben.Sullivan.4.20.22.mp4'");
  process.exit(1);
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
 * Update folder and related items with main_video_id
 */
async function updateFolderWithVideoId(
  folder: any,
  file: any,
  supabase: any,
  isDryRun: boolean
): Promise<void> {
  // Update the folder with the main_video_id
  if (isDryRun) {
    Logger.info(`DRY RUN: Would update folder "${folder.name}" with main_video_id = ${file.id}`);
  } else {
    const { error: updateError } = await supabase
      .from('sources_google')
      .update({ main_video_id: file.id })
      .eq('id', folder.id);
    
    if (updateError) {
      Logger.error(`Error updating folder: ${updateError.message}`);
    } else {
      Logger.info(`Updated folder "${folder.name}" with main_video_id = ${file.id}`);
    }
  }
  
  // Find all related items (subfolders, files) that need the same main_video_id
  // Let's try a different approach using path like
  // Folder path often included in path field even if path_array querying fails
  Logger.debug(`Folder path: ${folder.path}`);
  
  // Try alternative approach to find related files - sometimes path_array doesn't work
  // This query looks for items with paths that contain the folder's path
  if (isVerbose) {
    Logger.debug(`Attempting to find related items for folder "${folder.name}" with ID ${folder.id}`);
  }
  
  // Try to find related items by using path_array first
  const { data: relatedItems, error: relatedError } = await supabase
    .from('sources_google')
    .select('id, name, mime_type, path, path_array')
    .eq('is_deleted', false)
    .filter('path_array', 'cs', `{${folder.name}}`);
  
  if (relatedError) {
    Logger.error(`Error finding related items: ${relatedError.message}`);
  } 
  
  // If no related items found or error occurred, try a fallback method
  if (\!relatedItems || relatedItems.length === 0) {
    Logger.debug(`No related items found with path_array filter. Trying fallback method using path LIKE query...`);
    
    // Fallback: Try to find items using a LIKE query on the path field
    let folderPath = folder.path || '';
    if (\!folderPath && folder.name) {
      // If no path available, construct a simple one from the name
      folderPath = `/${folder.name}`;
    }
    
    // Escape special characters for LIKE pattern
    const escapedPath = folderPath.replace(/[%_]/g, '\\$&');
    
    if (isVerbose) {
      Logger.debug(`Using fallback search with path LIKE '${escapedPath}%'`);
    }
    
    // Query using LIKE on path field
    const { data: fallbackItems, error: fallbackError } = await supabase
      .from('sources_google')
      .select('id, name, mime_type, path')
      .eq('is_deleted', false)
      .like('path', `${escapedPath}%`);
    
    if (fallbackError) {
      Logger.error(`Error in fallback search: ${fallbackError.message}`);
    } else if (fallbackItems && fallbackItems.length > 0) {
      Logger.info(`Found ${fallbackItems.length} related items using fallback path search`);
      
      // Log a few sample items for debugging
      if (isVerbose && fallbackItems.length > 0) {
        const sampleItems = fallbackItems.slice(0, Math.min(5, fallbackItems.length));
        Logger.debug(`Sample related items (fallback search):`);
        sampleItems.forEach((item: any) => {
          Logger.debug(`  - ${item.name} (${item.id}), type: ${item.mime_type}`);
        });
      }
      
      // Update relatedItems with the fallback results
      if (isDryRun) {
        Logger.info(`DRY RUN: Would update ${fallbackItems.length} related items with main_video_id = ${file.id}`);
      } else {
        // Update in batches to avoid hitting API limits
        const batchSize = 50;
        for (let i = 0; i < fallbackItems.length; i += batchSize) {
          const batch = fallbackItems.slice(i, i + batchSize);
          const batchIds = batch.map((item: { id: string }) => item.id);
          
          const { error: batchUpdateError } = await supabase
            .from('sources_google')
            .update({ main_video_id: file.id })
            .in('id', batchIds);
          
          if (batchUpdateError) {
            Logger.error(`Error updating batch: ${batchUpdateError.message}`);
          } else {
            Logger.info(`Updated batch of ${batch.length} items with main_video_id = ${file.id}`);
          }
        }
      }
    } else {
      Logger.info(`No related items found using fallback method either.`);
    }
  } else if (relatedItems && relatedItems.length > 0) {
    Logger.info(`Found ${relatedItems.length} related items to update with main_video_id`);
    
    // Log a few sample items for debugging
    if (isVerbose && relatedItems.length > 0) {
      const sampleItems = relatedItems.slice(0, Math.min(5, relatedItems.length));
      Logger.debug(`Sample related items:`);
      sampleItems.forEach((item: any) => {
        Logger.debug(`  - ${item.name} (${item.id}), type: ${item.mime_type}`);
      });
    }
    
    if (isDryRun) {
      Logger.info(`DRY RUN: Would update ${relatedItems.length} related items with main_video_id = ${file.id}`);
    } else {
      // Update in batches to avoid hitting API limits
      const batchSize = 50;
      for (let i = 0; i < relatedItems.length; i += batchSize) {
        const batch = relatedItems.slice(i, i + batchSize);
        const batchIds = batch.map((item: { id: string }) => item.id);
        
        const { error: batchUpdateError } = await supabase
          .from('sources_google')
          .update({ main_video_id: file.id })
          .in('id', batchIds);
        
        if (batchUpdateError) {
          Logger.error(`Error updating batch: ${batchUpdateError.message}`);
        } else {
          Logger.info(`Updated batch of ${batch.length} items with main_video_id = ${file.id}`);
        }
      }
    }
  }
  
  // Display summary
  Logger.info('\n=== Summary ===');
  Logger.info(`Folder: ${folder.name} (${folder.id})`);
  Logger.info(`File: ${file.name} (${file.id})`);
  if (isDryRun) {
    Logger.info('Note: No actual changes were made (--dry-run mode)');
  }
}

/**
 * Main function to update main_video_id from folder and file mapping
 */
async function updateMainVideoIdFromMapping(): Promise<void> {
  console.log('=== Update Main Video ID from Mapping ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
  console.log(`Folder: '${folderName}'`);
  console.log(`File: '${fileName}'`);
  console.log('=========================================');

  // Validate inputs
  if (\!folderName) {
    Logger.error('Folder name is required');
    process.exit(1);
  }

  if (\!fileName) {
    Logger.error('File name is required');
    process.exit(1);
  }
  
  // Verify file has proper extension
  if (\!fileName.endsWith('.mp4') && \!fileName.endsWith('.m4v')) {
    Logger.warn(`Warning: File ${fileName} does not have an expected video extension (.mp4 or .m4v)`);
  }

  // Initialize Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Step 1: Find the folder in sources_google with exact match
    const { data: exactFolders, error: exactFolderError } = await supabase
      .from('sources_google')
      .select('id, name, drive_id, path, path_depth')
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .eq('is_deleted', false)
      .eq('name', folderName);
    
    if (exactFolderError) {
      Logger.error(`Error finding folder: ${exactFolderError.message}`);
      process.exit(1);
    }

    // If exact match fails, try fuzzy search
    if (\!exactFolders || exactFolders.length === 0) {
      // Try a more flexible search
      Logger.debug(`Exact folder match failed, trying flexible search for: "${folderName}"`);
      
      // Extract simplified name for search
      const simplifiedName = folderName.replace(/["']/g, '').trim().split(/\s+/)[0];
      
      const { data: fuzzyFolders, error: fuzzyError } = await supabase
        .from('sources_google')
        .select('id, name, drive_id, path, path_depth')
        .eq('mime_type', 'application/vnd.google-apps.folder')
        .eq('is_deleted', false)
        .ilike('name', `%${simplifiedName}%`);
      
      if (fuzzyError || \!fuzzyFolders || fuzzyFolders.length === 0) {
        Logger.error(`No folder found with name: ${folderName}`);
        process.exit(1);
      }
      
      Logger.info(`Found ${fuzzyFolders.length} potential folder matches using flexible search`);
      
      // Sort folders by similarity to the requested name
      const sortedFolders = fuzzyFolders.sort((a, b) => {
        const aScore = calculateSimilarityScore(a.name, folderName);
        const bScore = calculateSimilarityScore(b.name, folderName);
        return bScore - aScore; // Higher score first
      });
      
      // Use the best matching folder (with preference for path_depth = 0)
      let bestFolder = sortedFolders[0];
      const rootFolder = sortedFolders.find(f => f.path_depth === 0);
      if (rootFolder) {
        bestFolder = rootFolder;
      }
      
      Logger.info(`Using best match folder: "${bestFolder.name}" (${bestFolder.id})`);
      
      // Step 2: Find the MP4 file with exact match
      const { data: exactFiles, error: exactFileError } = await supabase
        .from('sources_google')
        .select('id, name, drive_id, path, parent_folder_id')
        .eq('mime_type', 'video/mp4')
        .eq('is_deleted', false)
        .eq('name', fileName);
      
      if (exactFileError) {
        Logger.error(`Error finding file: ${exactFileError.message}`);
        process.exit(1);
      }
      
      // If exact match fails, try fuzzy search
      if (\!exactFiles || exactFiles.length === 0) {
        // Try fuzzy search for file
        Logger.debug(`Exact file match failed, trying flexible search for: "${fileName}"`);
        
        // Extract base name without extension
        const baseName = fileName.replace(/\.(mp4|m4v)$/i, '');
        
        const { data: fuzzyFiles, error: fuzzyFileError } = await supabase
          .from('sources_google')
          .select('id, name, drive_id, path, parent_folder_id')
          .eq('mime_type', 'video/mp4')
          .eq('is_deleted', false)
          .ilike('name', `%${baseName}%`);
        
        if (fuzzyFileError || \!fuzzyFiles || fuzzyFiles.length === 0) {
          Logger.error(`No file found with name: ${fileName}`);
          process.exit(1);
        }
        
        // Sort files by similarity to the requested filename
        const sortedFiles = fuzzyFiles.sort((a, b) => {
          const aScore = calculateSimilarityScore(a.name, fileName);
          const bScore = calculateSimilarityScore(b.name, fileName);
          return bScore - aScore; // Higher score first
        });
        
        const bestFile = sortedFiles[0];
        Logger.info(`Found best match file: "${bestFile.name}" (${bestFile.id})`);
        
        // Update folder and related items
        await updateFolderWithVideoId(bestFolder, bestFile, supabase, isDryRun);
      } else {
        // Use exact file match
        const bestFile = exactFiles[0];
        Logger.info(`Found file: "${bestFile.name}" (${bestFile.id})`);
        
        // Update folder and related items
        await updateFolderWithVideoId(bestFolder, bestFile, supabase, isDryRun);
      }
    } else {
      // Use exact folder match
      // If multiple folders found, prefer one with path_depth = 0
      const bestFolder = exactFolders.find(f => f.path_depth === 0) || exactFolders[0];
      Logger.info(`Found folder: "${bestFolder.name}" (${bestFolder.id})`);
      
      // Step 2: Find the MP4 file with exact match
      const { data: exactFiles, error: exactFileError } = await supabase
        .from('sources_google')
        .select('id, name, drive_id, path, parent_folder_id')
        .eq('mime_type', 'video/mp4')
        .eq('is_deleted', false)
        .eq('name', fileName);
      
      if (exactFileError) {
        Logger.error(`Error finding file: ${exactFileError.message}`);
        process.exit(1);
      }
      
      // If exact match fails, try fuzzy search
      if (\!exactFiles || exactFiles.length === 0) {
        // Try fuzzy search for file
        Logger.debug(`Exact file match failed, trying flexible search for: "${fileName}"`);
        
        // Extract base name without extension
        const baseName = fileName.replace(/\.(mp4|m4v)$/i, '');
        
        const { data: fuzzyFiles, error: fuzzyFileError } = await supabase
          .from('sources_google')
          .select('id, name, drive_id, path, parent_folder_id')
          .eq('mime_type', 'video/mp4')
          .eq('is_deleted', false)
          .ilike('name', `%${baseName}%`);
        
        if (fuzzyFileError || \!fuzzyFiles || fuzzyFiles.length === 0) {
          Logger.error(`No file found with name: ${fileName}`);
          process.exit(1);
        }
        
        // Sort files by similarity to the requested filename
        const sortedFiles = fuzzyFiles.sort((a, b) => {
          const aScore = calculateSimilarityScore(a.name, fileName);
          const bScore = calculateSimilarityScore(b.name, fileName);
          return bScore - aScore; // Higher score first
        });
        
        const bestFile = sortedFiles[0];
        Logger.info(`Found best match file: "${bestFile.name}" (${bestFile.id})`);
        
        // Update folder and related items
        await updateFolderWithVideoId(bestFolder, bestFile, supabase, isDryRun);
      } else {
        // Use exact file match
        const bestFile = exactFiles[0];
        Logger.info(`Found file: "${bestFile.name}" (${bestFile.id})`);
        
        // Update folder and related items
        await updateFolderWithVideoId(bestFolder, bestFile, supabase, isDryRun);
      }
    }
  } catch (error: any) {
    Logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Execute main function
updateMainVideoIdFromMapping().catch(error => {
  Logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});
