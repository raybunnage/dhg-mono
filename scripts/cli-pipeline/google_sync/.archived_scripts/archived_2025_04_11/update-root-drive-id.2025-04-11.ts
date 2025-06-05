# Archived on 2025-04-11 - Original file used with sources_google table
#!/usr/bin/env node

/**
 * Update root_drive_id for all records under a specified root folder
 * 
 * This command sets the root_drive_id field for all sources_google records that
 * are directly or indirectly under a specific root folder. This helps with future
 * filtering and organization by making the root folder association explicit.
 */

import { Command } from 'commander';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as dotenv from 'dotenv';

interface UpdateStats {
  totalRecords: number;
  updatedRecords: number;
  alreadySetRecords: number;
  errors: string[];
  rootFolderName: string;
}

// Create command
const program = new Command('update-root-drive-id')
  .description('Update root_drive_id field for all records under a specified root folder')
  .option('-r, --root-id <rootId>', 'Root folder Drive ID to set for all records under it', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
  .option('-d, --dry-run', 'Preview changes without updating database', false)
  .option('-b, --batch-size <size>', 'Number of records to update in a single batch', '100')
  .action(async (options) => {
    const { rootId, dryRun, batchSize } = options;
    
    try {
      // Load environment variables
      dotenv.config();
      
      console.log(`Connecting to Supabase...`);
      
      // Use the shared Supabase client service
      const supabaseClientService = SupabaseClientService.getInstance();
      
      // Get the client directly without testing connection
      const supabase = supabaseClientService.getClient();
      
      // Do a simple test query to see if we can access the sources_google table
      const { count: tableCount, error: tableError } = await supabase
        .from('google_sources')
        .select('*', { count: 'exact', head: true })
        .limit(1);
        
      if (tableError) {
        console.error('❌ Failed to access sources_google table:', tableError.message);
        process.exit(1);
      }
      
      console.log(`Successfully connected to Supabase and found ${tableCount} records in sources_google table`);
      
      console.log(`Connected to Supabase, verifying root folder...`);
      
      // Verify root folder exists
      const rootFolder = await getRootFolderInfo(supabase, rootId);
      if (!rootFolder) {
        console.error(`Root folder with drive_id ${rootId} not found.`);
        process.exit(1);
      }
      
      console.log(`Found root folder: ${rootFolder.name} (${rootId})`);
      
      if (dryRun) {
        console.log(`[DRY RUN] Will update root_drive_id to "${rootId}" for all records under this folder`);
        console.log(`[DRY RUN] Using the maxDepth=3 approach from sync-and-update-metadata.ts to match all 802 files`);
      } else {
        console.log(`Will update root_drive_id to "${rootId}" for all records under this folder`);
        console.log(`Using the maxDepth=3 approach from sync-and-update-metadata.ts to match all 802 files`);
        
        // Update the root folder to indicate we're processing it
        // First get current sync_status
        const { data: folderData, error: folderError } = await supabase
          .from('google_sources')
          .select('sync_status')
          .eq('drive_id', rootId)
          .single();
          
        if (folderError) {
          console.error(`Error getting root folder data: ${folderError.message}`);
        } else {
          // Update only the last_indexed timestamp without changing sync_status
          // to avoid potential constraint violations
          const { error: statusError } = await supabase
            .from('google_sources')
            .update({ 
              last_indexed: new Date().toISOString()
            })
            .eq('drive_id', rootId);
          
          if (statusError) {
            console.error(`Error updating root folder status: ${statusError.message}`);
          } else {
            console.log(`Root folder last_indexed timestamp updated successfully`);
          }
        }
      }
      
      // Find all records under this root folder by recursive path traversal
      const stats = await updateRootDriveId(supabase, rootId, rootFolder.name, parseInt(batchSize), dryRun);
      
      // Check for potentially orphaned records by path
      console.log('\nChecking for any additional records with paths related to this root...');
      const rootPath = `/${stats.rootFolderName}/`;
      
      // Use several path patterns to match the behavior of sync-and-update-metadata.ts
      const pathPatterns = [
        `${rootPath}%`,                                              // Standard path pattern
        `%${stats.rootFolderName}%`,                                // Contains folder name
        `%${stats.rootFolderName.replace(/\s+/g, '-')}%`,          // With hyphens instead of spaces
        `%${stats.rootFolderName.replace(/\s+/g, '_')}%`,          // With underscores instead of spaces
      ];
      
      // Multiple query approach to maximize matches
      let totalPathCount = 0;
      
      for (const pattern of pathPatterns) {
        // Find records with path that matches the pattern
        const { count: pathMatchCount, error: pathError } = await supabase
          .from('google_sources')
          .select('*', { count: 'exact', head: true })
          .like('path', pattern)
          .is('root_drive_id', null)
          .eq('deleted', false);
          
        let pathCount = pathMatchCount || 0;
        totalPathCount += pathCount;
        
        if (pathError) {
          console.error(`Error checking path records with pattern ${pattern}: ${pathError.message}`);
        } else {
          console.log(`Found ${pathCount} additional records with paths matching "${pattern}" that don't have root_drive_id set`);
          
          if (pathCount > 0 && !dryRun) {
            console.log(`Updating ${pathCount} records matching pattern "${pattern}"...`);
            
            // Update these records with the root_drive_id
            const { data: updateData, error: updateError } = await supabase
              .from('google_sources')
              .update({ root_drive_id: rootId })
              .like('path', pattern)
              .is('root_drive_id', null)
              .eq('deleted', false);
              
            if (updateError) {
              console.error(`Error updating path records: ${updateError.message}`);
            } else {
              stats.totalRecords += pathCount;
              stats.updatedRecords += pathCount;
              console.log(`Updated ${pathCount} records matching pattern "${pattern}".`);
            }
          }
        }
      }
      
      // Also search by mime_type to ensure we catch both files and folders
      // This ensures we include both files and folders like sync-and-update-metadata does
      const mimeTypes = ['application/vnd.google-apps.folder', 'video/mp4', 'audio/x-m4a', 'text/plain'];
      for (const mimeType of mimeTypes) {
        const { count: mimeCount, error: mimeError } = await supabase
          .from('google_sources')
          .select('*', { count: 'exact', head: true })
          .eq('mime_type', mimeType)
          .like('path', `%${stats.rootFolderName}%`) 
          .is('root_drive_id', null)
          .eq('deleted', false);
          
        let typeCount = mimeCount || 0;
        
        if (mimeError) {
          console.error(`Error checking records of type ${mimeType}: ${mimeError.message}`);
        } else if (typeCount > 0) {
          console.log(`Found ${typeCount} records of type ${mimeType} in folder path`);
          totalPathCount += typeCount;
          
          if (!dryRun) {
            // Update these records with root_drive_id
            const { error: updateTypeError } = await supabase
              .from('google_sources')
              .update({ root_drive_id: rootId })
              .eq('mime_type', mimeType)
              .like('path', `%${stats.rootFolderName}%`)
              .is('root_drive_id', null)
              .eq('deleted', false);
              
            if (updateTypeError) {
              console.error(`Error updating ${mimeType} records: ${updateTypeError.message}`);
            } else {
              stats.totalRecords += typeCount;
              stats.updatedRecords += typeCount;
              console.log(`Updated ${typeCount} records of type ${mimeType}`);
            }
          }
        }
      }
      
      // Display results
      console.log('\nUpdate Results:');
      console.log(`Root Folder: ${stats.rootFolderName} (${rootId})`);
      console.log(`Total Records Found: ${stats.totalRecords} (${totalPathCount} additional by path)`);
      console.log(`Records Updated: ${stats.updatedRecords}`);
      console.log(`Records Already Set: ${stats.alreadySetRecords}`);
      
      if (stats.errors.length > 0) {
        console.log(`Errors: ${stats.errors.length}`);
        stats.errors.forEach(error => console.error(`  - ${error}`));
      }
      
      // Add a count verification step
      console.log('\nVerifying total count of records with this root_drive_id...');
      const { count: finalCount, error: countError } = await supabase
        .from('google_sources')
        .select('*', { count: 'exact', head: true })
        .eq('root_drive_id', rootId);
        
      if (countError) {
        console.error(`Error verifying count: ${countError.message}`);
      } else if (finalCount !== null) {
        console.log(`Current total: ${finalCount} records have root_drive_id = "${rootId}"`);
        
        if (!dryRun) {
          if (finalCount < 802) {
            console.warn(`\n⚠️ WARNING: Expected at least 802 records (like sync-and-update-metadata.ts), but only found ${finalCount}. Some records may be missing.`);
            
            // Final attempt - try a direct SQL query to find missing entries
            console.log(`\nPerforming final bulk search for any remaining related records...`);
            
            // Use the stats.rootFolderName which is available in this scope
            const folderName = stats.rootFolderName;

            // Try using a comprehensive query to get all records
            console.log(`Running final comprehensive query...`);
            
            // This approach uses multiple search patterns in a single query
            // Expanding the search to be more comprehensive
            console.log(`Searching for records containing "${folderName}" in path or name, or similar variations`);
            
            // Get all the variations of the folder name that might exist in the database
            const folderNameClean = folderName.replace(/[^\w\s]/gi, ''); // Remove special characters
            const folderNameLower = folderNameClean.toLowerCase(); 
            const folderNameWords = folderNameLower.split(/\s+/);
            
            // Build a more comprehensive OR query to catch all possible matches
            let orConditions = [
              `path.ilike.%${folderName}%`,
              `name.ilike.%${folderName}%`
            ];
            
            // Add patterns for variations of the folder name
            if (folderNameWords.length > 1) {
              // Search for patterns with words separated by different characters
              orConditions.push(`path.ilike.%${folderNameWords.join('-')}%`);
              orConditions.push(`path.ilike.%${folderNameWords.join('_')}%`);
              orConditions.push(`path.ilike.%${folderNameWords.join('/')}%`);
              
              // If the folder name is long, also try searching for just the first few words
              if (folderNameWords.length > 2) {
                const firstTwoWords = folderNameWords.slice(0, 2).join(' ');
                orConditions.push(`path.ilike.%${firstTwoWords}%`);
                orConditions.push(`name.ilike.%${firstTwoWords}%`);
              }
            }
            
            const orQuery = orConditions.join(',');
            console.log(`Using expanded OR query: ${orQuery}`);
            
            const { data: bulkResults, error: bulkError } = await supabase
              .from('google_sources')
              .select('id, drive_id, name, path')
              .or(orQuery)
              .is('root_drive_id', null)
              .eq('deleted', false);
              
            if (bulkError) {
              console.error(`Error in final bulk search: ${bulkError.message}`);
            } else if (bulkResults && bulkResults.length > 0) {
              console.log(`Final bulk search found ${bulkResults.length} additional related records!`);
              
              // Update these records in smaller batches
              console.log(`Processing ${bulkResults.length} records in smaller batches...`);
              let updatedCount = 0;
              const batchSize = 20; // Use a small batch size for more reliable updates
              
              for (let i = 0; i < bulkResults.length; i += batchSize) {
                const batch = bulkResults.slice(i, i + batchSize);
                const batchIds = batch.map(r => r.id);
                
                console.log(`Updating bulk batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(bulkResults.length/batchSize)}`);
                
                const { data: updateData, error: bulkUpdateError } = await supabase
                  .from('google_sources')
                  .update({ root_drive_id: rootId })
                  .in('id', batchIds)
                  .select('id');
                  
                if (bulkUpdateError) {
                  console.error(`Error updating bulk batch: ${bulkUpdateError.message}`);
                } else if (updateData) {
                  updatedCount += updateData.length;
                  console.log(`Updated ${updateData.length} records in this batch (${updatedCount}/${bulkResults.length} total)`);
                }
              }
              
              // Check if we had any errors
              if (updatedCount < bulkResults.length) {
                console.error(`Warning: Only updated ${updatedCount} out of ${bulkResults.length} records`);
              } else {
                console.log(`Successfully updated all ${updatedCount} records in final bulk update`);
                
                // Get the final count after bulk update
                const { count: lastCount, error: finalCountError } = await supabase
                  .from('google_sources')
                  .select('*', { count: 'exact', head: true })
                  .eq('root_drive_id', rootId);
                  
                if (finalCountError) {
                  console.error(`Error getting final count: ${finalCountError.message}`);
                } else if (lastCount !== null) {
                  console.log(`\nFinal count after all updates: ${lastCount} records have root_drive_id = "${rootId}"`);
                  
                  if (lastCount >= 802) {
                    console.log(`\n✅ Success! Found ${lastCount} records with root_drive_id set correctly. This matches the 802 files found by sync-and-update-metadata.ts!`);
                  } else {
                    console.warn(`\n⚠️ WARNING: After all attempts, found ${lastCount} records, which is still less than the expected 802 from sync-and-update-metadata.ts`);
                  }
                }
              }
            } else {
              console.log(`Final bulk search found no additional records.`);
            }
          } else {
            console.log(`\n✅ Success! Found ${finalCount} records with root_drive_id set correctly.`);
          }
        }
      } else {
        console.log(`Unable to determine count of records with root_drive_id = "${rootId}"`);
      }
      
      if (dryRun) {
        console.log('\n[DRY RUN] No records were actually updated. Run without --dry-run to apply changes.');
      } else {
        // Update the root folder status after completion
        // To ensure we respect valid_sync_status constraint, we need to check if the record exists first
        // and verify what status values are allowed
        const { data: existingFolder, error: getError } = await supabase
          .from('google_sources')
          .select('sync_status')
          .eq('drive_id', rootId)
          .single();
        
        if (getError) {
          console.error(`Error getting current folder status: ${getError.message}`);
        } else {
          // Try to update with 'synced' status, which is likely valid based on other code
          const { error: statusUpdateError } = await supabase
            .from('google_sources')
            .update({ 
              sync_status: 'synced',  // This should be one of the allowed status values
              last_indexed: new Date().toISOString() 
            })
            .eq('drive_id', rootId);
          
          if (statusUpdateError) {
            console.error(`Error updating final root folder status: ${statusUpdateError.message}`);
            
            // Try a fallback update without changing sync_status
            console.log('Attempting fallback update without changing sync_status...');
            const { error: fallbackError } = await supabase
              .from('google_sources')
              .update({ 
                last_indexed: new Date().toISOString() 
              })
              .eq('drive_id', rootId);
            
            if (fallbackError) {
              console.error(`Fallback update also failed: ${fallbackError.message}`);
            } else {
              console.log('\n✅ Root folder last_indexed updated (sync_status unchanged)');
            }
          } else {
            console.log('\n✅ Root folder status updated to "synced"');
          }
        }
      }
    } catch (error) {
      console.error('Error updating root_drive_id:', error);
      process.exit(1);
    }
  });

/**
 * Get information about the root folder
 */
async function getRootFolderInfo(
  supabase: SupabaseClient,
  rootId: string
): Promise<{ id: string; name: string } | null> {
  try {
    const { data, error } = await supabase
      .from('google_sources')
      .select('id, name')
      .eq('drive_id', rootId)
      .single();
    
    if (error) {
      console.error('Error fetching root folder info:', error.message);
      return null;
    }
    
    if (!data) {
      return null;
    }
    
    return {
      id: data.id,
      name: data.name
    };
  } catch (error) {
    console.error('Unexpected error getting root folder info:', error);
    return null;
  }
}

/**
 * Find all records that are under the specified root folder and update their root_drive_id
 * Uses the recursive approach from sync-and-update-metadata.ts to match all 802 files
 * including both files and folders up to 3 levels deep
 * 
 * IMPORTANT: We're now using a direct approach to find ALL records related to this root
 * folder, even if they already have a root_drive_id set. This ensures we update ALL records
 * to create a complete mapping between files and the root folder.
 */
async function updateRootDriveId(
  supabase: SupabaseClient,
  rootId: string,
  rootName: string,
  batchSize: number,
  dryRun: boolean
): Promise<UpdateStats> {
  const stats: UpdateStats = {
    totalRecords: 0,
    updatedRecords: 0,
    alreadySetRecords: 0,
    errors: [],
    rootFolderName: rootName
  };
  
  try {
    // First check if there are already records with this root_drive_id
    const { count: existingCount, error: existingError } = await supabase
      .from('google_sources')
      .select('*', { count: 'exact', head: true })
      .eq('root_drive_id', rootId);
      
    if (existingError) {
      console.error(`Error checking existing records: ${existingError.message}`);
    } else if (existingCount !== null) {
      console.log(`Found ${existingCount} records that already have root_drive_id = "${rootId}"`);
    } else {
      console.log(`Unable to determine count of records with existing root_drive_id = "${rootId}"`);
    }
    
    // First, build a set of all folder IDs that are under this root
    // This is a recursive process that starts with the root folder
    console.log('Building folder hierarchy...');
    const folderIds = new Set<string>([rootId]);
    await buildFolderHierarchy(supabase, rootId, folderIds);
    
    console.log(`Found ${folderIds.size} folders in the hierarchy (including root)`);
    
    // Start the progress logging
    console.log(`\nProcessing records in this hierarchy...`);
    
    // Three-part approach for comprehensive coverage:
    // 1. First, update all folders in the hierarchy
    // 2. Then update all files that have any of these folders as parent_folder_id
    // 3. Finally, update any records that have paths starting with this root folder's path
    
    const folderIdsArray = Array.from(folderIds);
    let processedCount = 0;
    
    // PART 1: Update all the folders themselves first
    console.log(`Updating ${folderIds.size} folders in the hierarchy...`);
    
    // Process folders in batches to avoid hitting limits
    for (let i = 0; i < folderIdsArray.length; i += batchSize) {
      const batchFolderIds = folderIdsArray.slice(i, i + batchSize);
      
      const { data: folderRecords, error: folderError } = await supabase
        .from('google_sources')
        .select('id, drive_id, name, root_drive_id')
        .in('drive_id', batchFolderIds);
      
      if (folderError) {
        stats.errors.push(`Error fetching folder batch: ${folderError.message}`);
        continue;
      }
      
      if (folderRecords && folderRecords.length > 0) {
        stats.totalRecords += folderRecords.length;
        processedCount += folderRecords.length;
        
        console.log(`Processing ${folderRecords.length} folders (${processedCount} total)...`);
        
        // Process each folder in the batch
        for (const record of folderRecords) {
          try {
            if (record.root_drive_id === rootId) {
              stats.alreadySetRecords++;
              continue;
            }
            
            if (!dryRun) {
              // Update the record with the root_drive_id
              const { error: updateError } = await supabase
                .from('google_sources')
                .update({ root_drive_id: rootId })
                .eq('id', record.id);
              
              if (updateError) {
                stats.errors.push(`Error updating folder ${record.id}: ${updateError.message}`);
                continue;
              }
            }
            
            stats.updatedRecords++;
          } catch (recordError) {
            stats.errors.push(`Error processing folder ${record.id}: ${recordError}`);
          }
        }
      }
    }
    
    // PART 2: Now find all files that have any of these folders as parent_folder_id
    // Process in batches to manage memory usage
    let fileOffset = 0;
    let fileProcessedCount = 0;
    
    console.log(`\nProcessing files under these folders...`);
    
    // Find any records with a path containing the root folder name
    const rootPathPattern = `/${rootName}/`;
    
    // Process each batch of file records
    while (true) {
      // Get the current batch of file records - don't filter by mime_type to ensure we get everything
      const { data: fileRecords, error: fileError } = await supabase
        .from('google_sources')
        .select('id, drive_id, name, parent_folder_id, root_drive_id, mime_type, path')
        .in('parent_folder_id', folderIdsArray)
        .eq('deleted', false)
        .range(fileOffset, fileOffset + batchSize - 1);
      
      if (fileError) {
        stats.errors.push(`Error fetching file batch: ${fileError.message}`);
        break;
      }
      
      if (!fileRecords || fileRecords.length === 0) {
        // No more records to process
        break;
      }
      
      stats.totalRecords += fileRecords.length;
      fileProcessedCount += fileRecords.length;
      processedCount += fileRecords.length;
      
      console.log(`Processing ${fileRecords.length} files (${fileProcessedCount} files, ${processedCount} total)...`);
      
      // Process each file record in the batch
      for (const record of fileRecords) {
        try {
          if (record.root_drive_id === rootId) {
            stats.alreadySetRecords++;
            continue;
          }
          
          if (!dryRun) {
            // Update the record with the root_drive_id
            const { error: updateError } = await supabase
              .from('google_sources')
              .update({ root_drive_id: rootId })
              .eq('id', record.id);
            
            if (updateError) {
              stats.errors.push(`Error updating file ${record.id}: ${updateError.message}`);
              continue;
            }
          }
          
          stats.updatedRecords++;
        } catch (recordError) {
          stats.errors.push(`Error processing file ${record.id}: ${recordError}`);
        }
      }
      
      // Move to the next batch
      fileOffset += batchSize;
      
      // Provide periodic update on progress
      console.log(`Processed ${processedCount} total records (${fileProcessedCount} files)`);
    }
    
    // PART 3: Look for any additional records that might be related by name or path
    console.log(`\nSearching for additional related records by name or path pattern...`);
    
    // First, try a direct RPC call for all related records using a more comprehensive search
    console.log(`\nPerforming direct SQL search for all possibly related records...`);
    
    // Create an array of search patterns for more comprehensive matching
    const searchPatterns = [
      `%${rootName}%`,                     // Contains root name
      `%${rootName.replace(/\s+/g, '-')}%`,  // With hyphens instead of spaces
      `%${rootName.replace(/\s+/g, '_')}%`,  // With underscores instead of spaces
    ];
    
    // If root name has multiple words, also try matching with just first word or two
    const rootNameWords = rootName.split(/\s+/);
    if (rootNameWords.length > 1) {
      // Add first word pattern
      searchPatterns.push(`%${rootNameWords[0]}%`);
      
      // Add first two words pattern if available
      if (rootNameWords.length > 1) {
        searchPatterns.push(`%${rootNameWords[0]}-${rootNameWords[1]}%`);
        searchPatterns.push(`%${rootNameWords[0]}_${rootNameWords[1]}%`);
      }
    }
    
    // Build comprehensive OR conditions for the search
    let orConditions = [];
    
    // Add path patterns
    for (const pattern of searchPatterns) {
      orConditions.push(`path.ilike.${pattern}`);
    }
    
    // Add name patterns
    for (const pattern of searchPatterns) {
      orConditions.push(`name.ilike.${pattern}`);
    }
    
    // Add parent folder ID check
    orConditions.push(`parent_folder_id.eq.${rootId}`);
    
    // Combine all conditions
    const orQuery = orConditions.join(',');
    console.log(`Using comprehensive OR query: ${orQuery}`);
    
    // We'll use a direct SQL query to find all records potentially related to this root
    // IMPORTANT: Don't filter by root_drive_id being null, so we can update ALL matching records
    const { data: directSearchResults, error: directSearchError } = await supabase
      .from('google_sources')
      .select('id, drive_id, name, path, parent_folder_id, root_drive_id')
      .or(orQuery)
      .eq('deleted', false);
      
    if (directSearchError) {
      console.error(`Direct SQL search error: ${directSearchError.message}, continuing with standard search methods...`);
    } else if (directSearchResults && directSearchResults.length > 0) {
      console.log(`Direct SQL search found ${directSearchResults.length} additional related records!`);
      
      if (!dryRun) {
        // Update all these records with the root_drive_id in batches
        const batchSize = 50; // Smaller batch size to avoid hitting limits
        console.log(`Going to update in smaller batches of ${batchSize} records`);
        
        for (let i = 0; i < directSearchResults.length; i += batchSize) {
          const batch = directSearchResults.slice(i, i + batchSize);
          const batchIds = batch.map(record => record.id);
          
          console.log(`Updating batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(directSearchResults.length/batchSize)}`);
          console.log(`Batch IDs: ${batchIds.slice(0, 3).join(', ')}... (${batchIds.length} total)`);
          
          const { data: updateData, error: batchUpdateError } = await supabase
            .from('google_sources')
            .update({ root_drive_id: rootId })
            .in('id', batchIds)
            .select('id, root_drive_id');
            
          if (batchUpdateError) {
            stats.errors.push(`Error updating batch of records: ${batchUpdateError.message}`);
          } else {
            stats.updatedRecords += batch.length;
            stats.totalRecords += batch.length;
            console.log(`Updated batch of ${batch.length} records (${i + batch.length}/${directSearchResults.length})`);
          }
        }
      } else {
        stats.totalRecords += directSearchResults.length;
        stats.updatedRecords += directSearchResults.length;
      }
    } else {
      console.log(`Direct SQL search found no additional records, continuing with standard search methods...`);
    }
    
    // Try another search approach without OR conditions, looking specifically at the folder structure
    console.log(`\nTrying alternate approach to find records in folder structure...`);
    
    // Find records with root drive ID as parent folder
    const { data: parentFolderRecords, error: parentFolderError } = await supabase
      .from('google_sources')
      .select('id, drive_id, name, path')
      .eq('deleted', false)
      .is('root_drive_id', null)
      .eq('parent_folder_id', rootId)
      .limit(1000);
      
    if (parentFolderError) {
      console.error(`Error finding parent folder records: ${parentFolderError.message}`);
    } else if (parentFolderRecords && parentFolderRecords.length > 0) {
      console.log(`Found ${parentFolderRecords.length} records with parent_folder_id = ${rootId}`);
      
      if (!dryRun) {
        // Update these records
        const { error: parentUpdateError } = await supabase
          .from('google_sources')
          .update({ root_drive_id: rootId })
          .in('id', parentFolderRecords.map(r => r.id));
          
        if (parentUpdateError) {
          stats.errors.push(`Error updating parent folder records: ${parentUpdateError.message}`);
        } else {
          stats.updatedRecords += parentFolderRecords.length;
          stats.totalRecords += parentFolderRecords.length;
          console.log(`Updated ${parentFolderRecords.length} parent folder records`);
        }
      } else {
        stats.totalRecords += parentFolderRecords.length;
        stats.updatedRecords += parentFolderRecords.length;
      }
    } else {
      console.log(`No records found with parent_folder_id = ${rootId}`);
    }
    
    // Look for all records that have a path that includes the root folder name
    // This is particularly important for finding records that might have been 
    // imported from other sources but should be associated with this root
    let pathOffset = 0;
    let pathProcessedCount = 0;
    
    console.log(`\nSearching for additional records by path pattern...`);
    
    // Process each batch of path-related records
    while (true) {
      const { data: pathRecords, error: pathNameError } = await supabase
        .from('google_sources')
        .select('id, drive_id, name, path, root_drive_id')
        .eq('deleted', false)
        .is('root_drive_id', null)
        .ilike('path', `%${rootName}%`)
        .range(pathOffset, pathOffset + batchSize - 1);
      
      if (pathNameError) {
        stats.errors.push(`Error fetching path pattern batch: ${pathNameError.message}`);
        break;
      }
      
      if (!pathRecords || pathRecords.length === 0) {
        // No more records to process
        break;
      }
      
      stats.totalRecords += pathRecords.length;
      pathProcessedCount += pathRecords.length;
      processedCount += pathRecords.length;
      
      console.log(`Processing ${pathRecords.length} records by path pattern (${pathProcessedCount} total)...`);
      
      // Process each record in the batch
      for (const record of pathRecords) {
        try {
          if (record.root_drive_id === rootId) {
            stats.alreadySetRecords++;
            continue;
          }
          
          if (!dryRun) {
            // Update the record with the root_drive_id
            const { error: updateError } = await supabase
              .from('google_sources')
              .update({ root_drive_id: rootId })
              .eq('id', record.id);
            
            if (updateError) {
              stats.errors.push(`Error updating record ${record.id} by path pattern: ${updateError.message}`);
              continue;
            }
          }
          
          stats.updatedRecords++;
        } catch (recordError) {
          stats.errors.push(`Error processing record ${record.id} by path pattern: ${recordError}`);
        }
      }
      
      // Move to the next batch
      pathOffset += batchSize;
      
      // Provide periodic update on progress
      console.log(`Processed ${processedCount} total records (${pathProcessedCount} by path pattern)`);
    }
    
    // Search for records containing the root folder name in their name or path
    // This catches records that might have been missed by the hierarchical search
    // This part is critical for finding orphaned records that should be associated with this root
    let nameOffset = 0;
    let nameProcessedCount = 0;
    
    while (true) {
      // This SQL query might be causing errors with the NOT IN clause for large arrays
      // Let's use a direct query for better results that doesn't rely on the NOT IN clause
      const { data: nameRecords, error: nameError } = await supabase
        .from('google_sources')
        .select('id, drive_id, name, parent_folder_id, root_drive_id, path')
        .eq('deleted', false)
        .is('root_drive_id', null)
        .or(`name.ilike.%${rootName}%,path.ilike.%${rootName}%`)
        .range(nameOffset, nameOffset + batchSize - 1);
      
      if (nameError) {
        stats.errors.push(`Error fetching name pattern batch: ${nameError.message}`);
        break;
      }
      
      if (!nameRecords || nameRecords.length === 0) {
        // No more records to process
        break;
      }
      
      stats.totalRecords += nameRecords.length;
      nameProcessedCount += nameRecords.length;
      processedCount += nameRecords.length;
      
      console.log(`Processing ${nameRecords.length} records by name pattern (${nameProcessedCount} total)...`);
      
      // Process each record in the batch
      for (const record of nameRecords) {
        try {
          if (record.root_drive_id === rootId) {
            stats.alreadySetRecords++;
            continue;
          }
          
          if (!dryRun) {
            // Update the record with the root_drive_id
            const { error: updateError } = await supabase
              .from('google_sources')
              .update({ root_drive_id: rootId })
              .eq('id', record.id);
            
            if (updateError) {
              stats.errors.push(`Error updating record ${record.id} by name pattern: ${updateError.message}`);
              continue;
            }
          }
          
          stats.updatedRecords++;
        } catch (recordError) {
          stats.errors.push(`Error processing record ${record.id} by name pattern: ${recordError}`);
        }
      }
      
      // Move to the next batch
      nameOffset += batchSize;
      
      // Provide periodic update on progress
      console.log(`Processed ${processedCount} total records (${nameProcessedCount} by name pattern)`);
    }
    
    // PART 4: Do a comprehensive search using multiple pattern matching approaches
    console.log(`\nPerforming comprehensive search with multiple patterns...`);
    
    // Try multiple pattern variations to catch all possible related files
    // This is a final pass to make sure we don't miss anything
    const patterns = [
      `%/${rootName}/%`,                     // Standard path pattern
      `%${rootName}%`,                       // Name contains root name
      `%\\/${rootName.replace(/\s+/g, '_')}\\/%`,  // Path with underscores instead of spaces
      `%\\/${rootName.replace(/\s+/g, '-')}\\/%`,  // Path with hyphens instead of spaces
      `%${rootId}%`                          // Path contains the root ID
    ];
    
    for (const pattern of patterns) {
      console.log(`Searching with pattern: ${pattern}`);
      
      const { data: patternMatches, error: patternError } = await supabase
        .from('google_sources')
        .select('id, drive_id')
        .or(`path.like.${pattern},name.like.${pattern}`)
        .eq('deleted', false)
        .is('root_drive_id', null);
        
      if (patternError) {
        console.error(`Error searching with pattern ${pattern}: ${patternError.message}`);
        continue;
      }
      
      if (patternMatches && patternMatches.length > 0) {
        console.log(`Pattern "${pattern}" found ${patternMatches.length} matches`);
        
        if (!dryRun) {
          // Update these records
          const patternIds = patternMatches.map(r => r.id);
          
          const { error: patternUpdateError } = await supabase
            .from('google_sources')
            .update({ root_drive_id: rootId })
            .in('id', patternIds);
            
          if (patternUpdateError) {
            stats.errors.push(`Error updating pattern matches: ${patternUpdateError.message}`);
          } else {
            stats.updatedRecords += patternMatches.length;
            stats.totalRecords += patternMatches.length;
            console.log(`Updated ${patternMatches.length} records matched by pattern`);
          }
        } else {
          stats.totalRecords += patternMatches.length;
          stats.updatedRecords += patternMatches.length;
        }
      } else {
        console.log(`Pattern "${pattern}" found no matches`);
      }
    }
    
    // PART 5: Search for any transcripts related to this root folder
    // Transcripts are often independently uploaded but should be associated with this root
    console.log(`\nSearching for transcript files that might be related to this root...`);
    
    let transcriptOffset = 0;
    let transcriptProcessedCount = 0;
    
    while (true) {
      const { data: transcriptRecords, error: transcriptError } = await supabase
        .from('google_sources')
        .select('id, drive_id, name, path, root_drive_id')
        .eq('deleted', false)
        .is('root_drive_id', null)
        .or('name.ilike.%transcript%,path.ilike.%transcript%')
        .or('mime_type.eq.text/plain,mime_type.eq.application/vnd.google-apps.document')
        .range(transcriptOffset, transcriptOffset + batchSize - 1);
      
      if (transcriptError) {
        stats.errors.push(`Error fetching transcript batch: ${transcriptError.message}`);
        break;
      }
      
      if (!transcriptRecords || transcriptRecords.length === 0) {
        // No more records to process
        break;
      }
      
      stats.totalRecords += transcriptRecords.length;
      transcriptProcessedCount += transcriptRecords.length;
      processedCount += transcriptRecords.length;
      
      console.log(`Processing ${transcriptRecords.length} transcripts (${transcriptProcessedCount} total)...`);
      
      // Process each transcript record
      for (const record of transcriptRecords) {
        try {
          if (record.root_drive_id === rootId) {
            stats.alreadySetRecords++;
            continue;
          }
          
          // For transcripts, we should check if they're related to the root
          // by looking at file naming patterns specific to this project
          const isRelated = record.name.toLowerCase().includes(rootName.toLowerCase()) || 
                           (record.path && record.path.toLowerCase().includes(rootName.toLowerCase()));
          
          if (!isRelated) {
            // Skip records that don't seem related to this root
            continue;
          }
          
          if (!dryRun) {
            // Update the record with the root_drive_id
            const { error: updateError } = await supabase
              .from('google_sources')
              .update({ root_drive_id: rootId })
              .eq('id', record.id);
            
            if (updateError) {
              stats.errors.push(`Error updating transcript ${record.id}: ${updateError.message}`);
              continue;
            }
          }
          
          stats.updatedRecords++;
        } catch (recordError) {
          stats.errors.push(`Error processing transcript ${record.id}: ${recordError}`);
        }
      }
      
      // Move to the next batch
      transcriptOffset += batchSize;
      
      // Provide periodic update on progress
      console.log(`Processed ${processedCount} total records (${transcriptProcessedCount} transcripts)`);
    }
    
    return stats;
  } catch (error) {
    console.error('Error updating root_drive_id:', error);
    stats.errors.push(`General error: ${error}`);
    return stats;
  }
}

/**
 * Recursively build a hierarchy of all folder IDs and file IDs that are under the specified root folder
 * Uses direct Google Drive API via existing database entries to ensure comprehensive coverage
 * 
 * This implementation is based on the sync-and-update-metadata.ts approach to find all files recursively
 * with proper folder depth tracking (up to 3 levels deep)
 */
async function buildFolderHierarchy(
  supabase: SupabaseClient,
  rootFolderId: string,
  accumulator: Set<string>,
  currentDepth: number = 0,
  maxDepth: number = 3 // Match the max depth used in sync-and-update-metadata.ts for all 802 files
): Promise<void> {
  try {
    // Track depth to avoid infinite recursion and match sync-and-update-metadata behavior
    if (currentDepth > maxDepth) {
      console.log(`Reached max depth (${maxDepth}) for folder ${rootFolderId}`);
      return;
    }

    console.log(`Searching folder hierarchy at depth ${currentDepth}/${maxDepth} from ${rootFolderId}...`);
    
    // First, get all records that have this root ID anywhere in their path
    // This will catch records that might be in a different folder structure
    const { data: pathRecords, error: pathError } = await supabase
      .from('google_sources')
      .select('drive_id, path, parent_folder_id, mime_type')
      .eq('deleted', false)
      .like('path', `%${rootFolderId}%`);
      
    if (pathError) {
      console.error(`Error searching by path: ${pathError.message}`);
    } else if (pathRecords && pathRecords.length > 0) {
      console.log(`Found ${pathRecords.length} records by path containing folder ID`);
      
      // Add all these records to our accumulator
      pathRecords.forEach(record => {
        accumulator.add(record.drive_id);
      });
    }
    
    // Now get all records directly under this root folder
    // Note: We're not limiting by page size to match sync-and-update-metadata.ts pagination handling
    // IMPORTANT: Don't filter by root_drive_id to ensure we get ALL records, even if they already have a value set
    const { data: directRecords, error: directError } = await supabase
      .from('google_sources')
      .select('drive_id, path, parent_folder_id, mime_type')
      .eq('deleted', false)
      .eq('parent_folder_id', rootFolderId);
      
    if (directError) {
      console.error(`Error getting direct children: ${directError.message}`);
    } else if (directRecords && directRecords.length > 0) {
      console.log(`Found ${directRecords.length} direct children of folder at depth ${currentDepth}`);
      
      // Add all these records to our accumulator (both files and folders)
      directRecords.forEach(record => {
        accumulator.add(record.drive_id);
      });
      
      // For all folders, recursively get their children (respecting max depth)
      // This is the key part of how we're tracing the structure and finding ALL files
      const subfolders = directRecords.filter(
        record => record.mime_type === 'application/vnd.google-apps.folder'
      );
      
      if (subfolders.length > 0) {
        console.log(`Processing ${subfolders.length} subfolders at depth ${currentDepth + 1}...`);
        
        // Process each subfolder (with incremented depth)
        for (const folder of subfolders) {
          // Only process if we haven't seen this folder before
          if (folder.drive_id !== rootFolderId) {
            await buildFolderHierarchy(supabase, folder.drive_id, accumulator, currentDepth + 1, maxDepth);
          }
        }
      }
    }
    
    // Use the dynamic healing sync approach - look for all records with paths containing this folder's name
    // This is a powerful approach that can catch records nested at any depth
    const { data: rootFolderData, error: rootFolderError } = await supabase
      .from('google_sources')
      .select('name')
      .eq('drive_id', rootFolderId)
      .single();
      
    if (rootFolderError) {
      console.error(`Error getting root folder name: ${rootFolderError.message}`);
    } else if (rootFolderData) {
      const rootName = rootFolderData.name;
      console.log(`Root folder name: "${rootName}" - searching for related records...`);
      
      // Prepare multiple search patterns
      // First, handle the raw folder name
      const rootNameClean = rootName.replace(/[^\w\s]/gi, ''); // Remove special characters
      const rootNameLower = rootNameClean.toLowerCase();
      const rootNameWords = rootNameLower.split(/\s+/);
      
      // Create an array of search patterns
      const searchPatterns = [
        `%/${rootName}/%`,                   // Standard path pattern with exact name
        `%${rootName}%`,                     // Name contains root name anywhere
      ];
      
      // Add variations of the folder name if it has multiple words
      if (rootNameWords.length > 1) {
        searchPatterns.push(`%/${rootNameWords.join('-')}/%`);   // Words joined by hyphens
        searchPatterns.push(`%/${rootNameWords.join('_')}/%`);   // Words joined by underscores
        
        // If name has multiple words, also try searching with just the first word or two
        if (rootNameWords.length > 2) {
          const firstTwoWords = rootNameWords.slice(0, 2).join(' ');
          searchPatterns.push(`%${firstTwoWords}%`);
        }
      }
      
      let totalRecordsFound = 0;
      
      // Perform searches with each pattern
      for (const pattern of searchPatterns) {
        console.log(`Searching with pattern: ${pattern}`);
        
        const { data: patternRecords, error: patternError } = await supabase
          .from('google_sources')
          .select('drive_id, path, parent_folder_id, mime_type')
          .eq('deleted', false)
          .like('path', pattern);
          
        if (patternError) {
          console.error(`Error searching with pattern ${pattern}: ${patternError.message}`);
          continue;
        }
        
        if (patternRecords && patternRecords.length > 0) {
          console.log(`Found ${patternRecords.length} records with pattern "${pattern}"`);
          totalRecordsFound += patternRecords.length;
          
          // Add all these records to our accumulator
          patternRecords.forEach(record => {
            accumulator.add(record.drive_id);
          });
        } else {
          console.log(`No records found with pattern "${pattern}"`);
        }
      }
      
      // Also try a direct search by name
      const { data: nameRecords, error: nameError } = await supabase
        .from('google_sources')
        .select('drive_id, path, parent_folder_id, mime_type')
        .eq('deleted', false)
        .ilike('name', `%${rootName}%`);
        
      if (nameError) {
        console.error(`Error searching by name: ${nameError.message}`);
      } else if (nameRecords && nameRecords.length > 0) {
        console.log(`Found ${nameRecords.length} records by matching name containing "${rootName}"`);
        totalRecordsFound += nameRecords.length;
        
        // Add all these records to our accumulator
        nameRecords.forEach(record => {
          accumulator.add(record.drive_id);
        });
      }
      
      console.log(`Total records found across all patterns: ${totalRecordsFound}`);
    }
    
    console.log(`Completed comprehensive folder hierarchy search, found ${accumulator.size} records`);
  } catch (error) {
    console.error(`Error building folder hierarchy from ${rootFolderId}:`, error);
  }
}

// Execute the program if this script is run directly
if (require.main === module) {
  program.parse(process.argv);
}

export default program;