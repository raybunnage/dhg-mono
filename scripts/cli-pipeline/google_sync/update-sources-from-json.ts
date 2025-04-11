#!/usr/bin/env ts-node
/**
 * Update Sources Google2 from JSON file
 * 
 * This script:
 * 1. Builds a lookup table for all folder mime types with IDs from Google Drive
 * 2. Updates sources_google2 records by finding matching records by ID
 * 3. Updates the path_array, path_depth, web_view_link, is_deleted, and parent_folder_id
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger } from '../../../packages/shared/utils/logger';

// Load environment variables
dotenv.config();

interface JsonFileEntry {
  id: string;
  mimeType: string;
  parents: string[];
  webViewLink: string;
  name: string;
  path: string;
  path_array?: string[];
  depth?: number;
  web_view_link?: string;
}

async function updateSourcesFromJson(
  jsonFilePath: string, 
  dryRun: boolean = false,
  verbose: boolean = false,
  specificDriveId?: string
) {
  try {
    Logger.info(`Loading JSON data from: ${jsonFilePath}`);
    
    // Create Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Read and parse the JSON file
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    if (!jsonData.files || !Array.isArray(jsonData.files)) {
      throw new Error('JSON file does not contain a valid "files" array');
    }
    
    // Filter by specific drive ID if provided
    let filesToProcess = jsonData.files;
    if (specificDriveId) {
      filesToProcess = jsonData.files.filter((entry: JsonFileEntry) => entry.id === specificDriveId);
      Logger.info(`Found ${filesToProcess.length} entries matching drive ID: ${specificDriveId}`);
      
      if (filesToProcess.length === 0) {
        Logger.warn(`No entries found with drive ID: ${specificDriveId}`);
        return;
      }
    } else {
      Logger.info(`Found ${jsonData.files.length} entries in JSON file`);
    }
    
    // Step 1: Build folder ID lookup table for ALL folders
    Logger.info('Building folder lookup table...');
    const folderLookup: Record<string, string> = {};
    
    // Build the folder lookup based on all folders, regardless of filtering
    jsonData.files.forEach((entry: JsonFileEntry) => {
      if (entry.mimeType === 'application/vnd.google-apps.folder') {
        // Store the ID directly since we need the exact ID
        folderLookup[entry.id] = entry.id;
        if (verbose) {
          Logger.debug(`Added folder ID to lookup: ${entry.id} (${entry.name})`);
        }
      }
    });
    
    Logger.info(`Folder lookup table contains ${Object.keys(folderLookup).length} folders`);
    
    // Step 2: Pre-fetch existing records to reduce individual API calls
    Logger.info('Pre-fetching existing records to optimize performance...');
    
    // Extract all IDs from the filtered JSON data
    const allIds = filesToProcess.map((entry: JsonFileEntry) => entry.id);
    
    // Create a lookup map for faster access
    const entryMap: Record<string, JsonFileEntry> = {};
    filesToProcess.forEach((entry: JsonFileEntry) => {
      entryMap[entry.id] = entry;
    });
    
    // Fetch records in batches to avoid query parameter limitations
    const dbBatchSize = 100; // Maximum number of IDs to include in a single query
    let existingRecords: any[] = [];
    
    for (let i = 0; i < allIds.length; i += dbBatchSize) {
      const idBatch = allIds.slice(i, i + dbBatchSize);
      Logger.info(`Fetching records batch ${Math.floor(i/dbBatchSize) + 1} of ${Math.ceil(allIds.length/dbBatchSize)}...`);
      
      const { data, error } = await supabase
        .from('sources_google2')
        .select('*')
        .in('drive_id', idBatch);
        
      if (error) {
        Logger.error(`Error fetching records batch: ${error.message}`);
        continue;
      }
      
      if (data && data.length > 0) {
        existingRecords = [...existingRecords, ...data];
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    Logger.info(`Found ${existingRecords.length} existing records in sources_google2`);
    
    // Build a map of existing records by drive_id for faster lookups
    const recordMap: Record<string, any> = {};
    existingRecords.forEach(record => {
      recordMap[record.drive_id] = record;
    });
    
    // Step 3: Process and update records
    Logger.info('Processing files and updating records...');
    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    
    // Process in batches to avoid timeout
    const updateBatchSize = 50;
    
    for (let i = 0; i < filesToProcess.length; i += updateBatchSize) {
      const batch = filesToProcess.slice(i, i + updateBatchSize);
      Logger.info(`Processing update batch ${Math.floor(i/updateBatchSize) + 1} of ${Math.ceil(filesToProcess.length/updateBatchSize)}`);
      
      // Prepare updates for this batch
      const updates: Array<{id: string, data: any}> = [];
      
      for (const entry of batch) {
        try {
          const record = recordMap[entry.id];
          
          if (!record) {
            notFoundCount++;
            if (verbose) {
              Logger.debug(`No record found for drive_id: ${entry.id} (${entry.name})`);
            }
            continue;
          }
          
          // Prepare update data
          const updateData: any = {
            // 3) Copy the path_array contents as is
            path_array: entry.path_array || (entry.path ? entry.path.split('/').filter(Boolean) : []),
            // 4) Ensure path_depth matches the depth field from JSON or calculate it correctly
            path_depth: entry.depth !== undefined ? entry.depth : (entry.path_array ? entry.path_array.length - 1 : 0),
            // 5) Write the webViewLink to web_view_link
            web_view_link: entry.webViewLink || entry.web_view_link,
            // 6) Set is_deleted to false
            is_deleted: false,
            // 7) Update size if available
            size: entry.size ? parseInt(entry.size) : null
          };
          
          // 7) Set parent_folder_id from the parents array, if available
          if (entry.parents && entry.parents.length > 0) {
            // Get the first parent ID (most files only have one parent)
            const parentId = entry.parents[0];
            
            // IMPORTANT: We need to ensure the parent folder ID exists in our system
            // Either it must be in the folder lookup or it's the known root folder
            if (folderLookup[parentId] || parentId === '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV') {
              // Set the parent folder ID
              updateData.parent_folder_id = parentId;
              
              if (verbose) {
                Logger.debug(`Setting parent folder ID ${parentId} for ${entry.id}`);
              }
            } else {
              if (verbose) {
                Logger.debug(`Parent folder ID ${parentId} not in folder lookup table, not setting for ${entry.id}`);
              }
            }
          }
          
          if (verbose) {
            Logger.debug(`Preparing update for record ${record.id} (${record.name})`);
            Logger.debug(`Original depth: ${entry.depth}, Path array length: ${entry.path_array ? entry.path_array.length : 'N/A'}`);
            Logger.debug(`Parents: ${entry.parents ? JSON.stringify(entry.parents) : 'none'}`);
            Logger.debug(`Update data: ${JSON.stringify(updateData)}`);
          }
          
          updates.push({
            id: entry.id,
            data: updateData
          });
          
        } catch (error) {
          errorCount++;
          Logger.error(`Error processing entry ${entry.id}: ${error instanceof Error ? error.message : String(error)}`);
          continue;
        }
      }
      
      // Apply updates in a single transaction if not a dry run
      if (!dryRun && updates.length > 0) {
        // We'll update 25 records at a time to avoid issues with large transactions
        const updateChunkSize = 25;
        
        for (let j = 0; j < updates.length; j += updateChunkSize) {
          const updateChunk = updates.slice(j, j + updateChunkSize);
          
          try {
            const promises = updateChunk.map(update => 
              supabase
                .from('sources_google2')
                .update(update.data)
                .eq('drive_id', update.id)
            );
            
            const results = await Promise.all(promises);
            
            // Check for errors
            let chunkErrorCount = 0;
            results.forEach((result, idx) => {
              if (result.error) {
                chunkErrorCount++;
                Logger.error(`Error updating record ${updateChunk[idx].id}: ${result.error.message}`);
              } else {
                updatedCount++;
              }
            });
            
            if (chunkErrorCount > 0) {
              Logger.warn(`${chunkErrorCount} errors occurred while updating this chunk`);
            }
            
          } catch (error) {
            Logger.error(`Error updating batch: ${error instanceof Error ? error.message : String(error)}`);
          }
          
          // Small delay between update chunks
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else if (dryRun) {
        // For dry run, just count the records that would be updated
        updatedCount += updates.length;
      }
      
      // Log progress after each batch
      Logger.info(`Processed ${updatedCount} records so far...`);
      
      // Add a delay between batches to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    Logger.info('Update operation complete!');
    Logger.info(`Updated ${updatedCount} records`);
    Logger.info(`Could not find ${notFoundCount} records`);
    Logger.info(`Encountered ${errorCount} errors during processing`);
    
    if (dryRun) {
      Logger.info('This was a dry run - no actual changes were made to the database');
    }
    
  } catch (error) {
    Logger.error('Error updating sources from JSON:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const jsonFilePath = args.find(arg => !arg.startsWith('--')) || 'file_types/json/google-drive.json';
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  
  // Parse drive_id if provided
  const driveIdArg = args.find(arg => arg.startsWith('--drive-id='));
  const driveId = driveIdArg ? driveIdArg.split('=')[1] : undefined;
  
  updateSourcesFromJson(jsonFilePath, dryRun, verbose, driveId);
}

// Export the function for importing in index.ts
export { updateSourcesFromJson };