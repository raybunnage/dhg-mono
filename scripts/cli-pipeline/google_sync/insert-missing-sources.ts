#!/usr/bin/env ts-node
/**
 * Insert Missing Sources
 * 
 * This script:
 * 1. Reads the Google Drive JSON file
 * 2. Identifies records that exist in the JSON but not in sources_google
 * 3. Inserts these records into sources_google with proper fields
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger } from '../../../packages/shared/utils/logger';
import { Json } from '../../../supabase/types';

// Load environment variables
dotenv.config();

interface JsonFileEntry {
  id: string;
  mimeType: string;
  parents: string[];
  webViewLink?: string;
  webContentLink?: string;
  name: string;
  path: string;
  path_array?: string[];
  depth?: number;
  web_view_link?: string;
  view_url?: string;
  web_content_link?: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  is_root?: boolean;
  metadata?: Json;
}

async function insertMissingSources(
  jsonFilePath: string,
  dryRun: boolean = false,
  verbose: boolean = false,
  specificIds?: string[],
  checkAllUnderDHDG: boolean = false
) {
  try {
    Logger.info(`Loading JSON data from: ${jsonFilePath}`);
    
    // Create Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Check if the file path exists
    if (!fs.existsSync(jsonFilePath)) {
      // Try the path relative to the current directory
      const absolutePath = path.join(process.cwd(), jsonFilePath);
      if (fs.existsSync(absolutePath)) {
        jsonFilePath = absolutePath;
      } else {
        throw new Error(`JSON file does not exist at path: ${jsonFilePath}`);
      }
    }
    
    // Read and parse the JSON file
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    if (!jsonData.files || !Array.isArray(jsonData.files)) {
      throw new Error('JSON file does not contain a valid "files" array');
    }
    
    // Step 1: Build folder ID lookup table for ALL folders
    Logger.info('Building folder lookup table...');
    const folderLookup: Record<string, string> = {};
    
    // Build the folder lookup based on all folders
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
    
    // Step 2: Find entries to insert
    let entriesToInsert: JsonFileEntry[] = [];
    
    // Get all existing IDs from sources_google (needed regardless of flow)
    Logger.info('Fetching all drive_ids from sources_google...');
    const { data: existingRecords, error } = await supabase
      .from('sources_google')
      .select('drive_id');
      
    if (error) {
      throw new Error(`Error fetching existing records: ${error.message}`);
    }
    
    const existingIds = existingRecords?.map(record => record.drive_id) || [];
    Logger.info(`Found ${existingIds.length} existing records in sources_google`);
    
    // If specific IDs are provided, only look for those and check if they exist first
    if (specificIds && specificIds.length > 0) {
      Logger.info(`Looking for specific IDs: ${specificIds.join(', ')}`);
      
      // For each specific ID, check if it already exists
      for (const id of specificIds) {
        if (existingIds.includes(id)) {
          Logger.info(`ID ${id} already exists in the database, skipping`);
          continue;
        }
        
        // Find the entry in the JSON data
        const entry = jsonData.files.find((entry: JsonFileEntry) => entry.id === id);
        if (entry) {
          entriesToInsert.push(entry);
          if (verbose) {
            Logger.debug(`Found entry to insert: ${entry.id} (${entry.name})`);
          }
        } else {
          Logger.warn(`ID ${id} not found in JSON data`);
        }
      }
    } 
    // If checkAllUnderDHDG is true, find all entries under the DHDG folder that don't exist in DB
    else if (checkAllUnderDHDG) {
      Logger.info('Checking for any missing files under the Dynamic Healing Discussion Group folder');
      
      // Find all entries that are under the DHDG root (either directly or nested)
      const dhgRootId = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';
      
      // First, identify all folder IDs that are under the DHDG root (recursively)
      const folderIdsUnderDHDG = new Set<string>();
      folderIdsUnderDHDG.add(dhgRootId); // Start with the root itself
      
      // Build the folder hierarchy
      const folderParents: Record<string, string[]> = {};
      jsonData.files.forEach((entry: JsonFileEntry) => {
        if (entry.parents && entry.parents.length > 0) {
          folderParents[entry.id] = entry.parents;
        }
      });
      
      // Function to recursively add folders under DHDG
      const addFoldersUnderParent = (parentId: string) => {
        jsonData.files.forEach((entry: JsonFileEntry) => {
          if (entry.mimeType === 'application/vnd.google-apps.folder' && 
              entry.parents && 
              entry.parents.includes(parentId) && 
              !folderIdsUnderDHDG.has(entry.id)) {
            
            folderIdsUnderDHDG.add(entry.id);
            addFoldersUnderParent(entry.id); // Recursively add child folders
          }
        });
      };
      
      // Start the recursive process from the DHDG root
      addFoldersUnderParent(dhgRootId);
      Logger.info(`Found ${folderIdsUnderDHDG.size} folders under DHDG (including nested folders)`);
      
      // Now find all files that are under any of these folders and not in the database
      jsonData.files.forEach((entry: JsonFileEntry) => {
        if (entry.parents && 
            entry.parents.some(parentId => folderIdsUnderDHDG.has(parentId)) && 
            !existingIds.includes(entry.id)) {
          
          entriesToInsert.push(entry);
          if (verbose) {
            Logger.debug(`Found missing entry under DHDG: ${entry.id} (${entry.name}) with parent ${entry.parents[0]}`);
          }
        }
      });
    } 
    // Otherwise, look for all files in JSON that don't exist in DB
    else {
      // Find entries in JSON that don't exist in sources_google
      jsonData.files.forEach((entry: JsonFileEntry) => {
        if (!existingIds.includes(entry.id)) {
          entriesToInsert.push(entry);
          if (verbose) {
            Logger.debug(`Found entry to insert: ${entry.id} (${entry.name})`);
          }
        }
      });
    }
    
    Logger.info(`Found ${entriesToInsert.length} entries to insert`);
    
    // Step 3: Insert entries into sources_google one by one to avoid duplicate key errors
    if (!dryRun && entriesToInsert.length > 0) {
      const insertBatchSize = 1; // Insert one at a time to better handle errors
      let insertedCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;
      
      for (let i = 0; i < entriesToInsert.length; i += insertBatchSize) {
        const batch = entriesToInsert.slice(i, i + insertBatchSize);
        Logger.info(`Processing entry ${i + 1} of ${entriesToInsert.length}`);
        
        for (const entry of batch) {
          // Check one more time if the record already exists (in case it was added during processing)
          const { data: existCheck, error: existError } = await supabase
            .from('sources_google')
            .select('drive_id')
            .eq('drive_id', entry.id);
            
          if (existError) {
            Logger.error(`Error checking if record exists: ${existError.message}`);
            continue;
          }
          
          if (existCheck && existCheck.length > 0) {
            Logger.info(`Record with drive_id ${entry.id} already exists, skipping`);
            duplicateCount++;
            continue;
          }
          
          // Generate a file signature
          let fileSignature = null;
          // If it's a file (not a folder) and has a size and name
          if (entry.mimeType !== 'application/vnd.google-apps.folder' && entry.name) {
            // Create a signature using name, size, and modified time if available
            const signatureComponents = [
              entry.id,
              entry.name,
              entry.size || '0',
              entry.modifiedTime || new Date().toISOString()
            ];
            fileSignature = crypto.createHash('md5').update(signatureComponents.join('-')).digest('hex');
          }

          // Create a metadata object with relevant fields, excluding size since it's a top-level field
          const metadata: any = {
            view_url: entry.view_url || null,
            web_content_link: entry.web_content_link || null,
            last_modified: entry.modifiedTime || null,
            created: entry.createdTime || null,
            // Include any other metadata that might be useful, but exclude size
          };

          // Prepare record data
          const record: any = {
            id: crypto.randomUUID(), // Generate UUID for the ID field
            drive_id: entry.id,
            name: entry.name,
            mime_type: entry.mimeType,
            path: entry.path || `/${entry.name}`,
            path_array: entry.path_array || (entry.path ? entry.path.split('/').filter(Boolean) : []),
            // Ensure path_depth matches the depth field from JSON or calculate it correctly
            path_depth: entry.depth !== undefined ? entry.depth : (entry.path_array ? entry.path_array.length - 1 : 0),
            web_view_link: entry.webViewLink || entry.web_view_link,
            is_deleted: false,
            // Use the size field in the table
            size: entry.size ? parseInt(entry.size) : null,
            created_at: entry.createdTime ? new Date(entry.createdTime).toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString(),
            modified_at: entry.modifiedTime || null,
            // Set root_drive_id to Dynamic Healing Discussion Group
            root_drive_id: '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV',
            // Do not set file_signature field as it has DEFAULT handling in the database
            // The following fields are allowed to be null
            thumbnail_link: null,
            document_type_id: null,
            expert_id: null,
            last_indexed: null,
            main_video_id: null,
            is_root: entry.is_root || false,
            metadata: entry.metadata || metadata
          };
          
          // Set parent_folder_id from the parents array, if available
          if (entry.parents && entry.parents.length > 0) {
            // Get the first parent ID (most files only have one parent)
            const parentId = entry.parents[0];
            
            // IMPORTANT: We need to ensure the parent folder ID exists in our system
            // Either it must be in the folder lookup or it's the known root folder
            if (folderLookup[parentId] || parentId === '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV') {
              // Set the parent folder ID
              record.parent_folder_id = parentId;
              
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
            Logger.debug(`Inserting record for ${entry.id} (${entry.name})`);
          }
          
          // Insert the record
          const { data, error } = await supabase
            .from('sources_google')
            .insert([record])
            .select();
            
          if (error) {
            if (error.message.includes('duplicate key value')) {
              Logger.warn(`Duplicate key for ${entry.id} (${entry.name})`);
              duplicateCount++;
            } else {
              errorCount++;
              Logger.error(`Error inserting record: ${error.message}`);
            }
          } else {
            insertedCount++;
            Logger.info(`Successfully inserted record for ${entry.id} (${entry.name})`);
          }
        }
        
        // Small delay between entries
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      Logger.info('Insert operation complete!');
      Logger.info(`Successfully inserted ${insertedCount} records`);
      Logger.info(`Found ${duplicateCount} duplicate records (already in database)`);
      Logger.info(`Encountered errors for ${errorCount} records`);
    } else if (dryRun) {
      Logger.info('This was a dry run - no records were inserted');
      
      // Always log records that would be inserted in dry run mode
      entriesToInsert.forEach(entry => {
        // Generate file signature for logging
        let fileSignature = null;
        if (entry.mimeType !== 'application/vnd.google-apps.folder' && entry.name) {
          const signatureComponents = [
            entry.id,
            entry.name,
            entry.size || '0',
            entry.modifiedTime || new Date().toISOString()
          ];
          fileSignature = crypto.createHash('md5').update(signatureComponents.join('-')).digest('hex');
        }
        
        // Create metadata object for logging
        const metadata = {
          view_url: entry.view_url || null,
          web_content_link: entry.web_content_link || null,
          last_modified: entry.modifiedTime || null,
          created: entry.createdTime || null,
        };
        
        // Generate a file signature using a slightly different approach for display
        if (fileSignature) {
          Logger.info(`Would insert file: ${entry.id} (${entry.name})`);
          Logger.info(`  mimeType: ${entry.mimeType}`);
          Logger.info(`  path: ${entry.path}`);
          Logger.info(`  size: ${entry.size ? parseInt(entry.size) : 0}`);
          Logger.info(`  file_signature: ${fileSignature}`);
          
          // Show the exact record that would be inserted
          const record: any = {
            id: '<random-uuid>',
            drive_id: entry.id,
            name: entry.name,
            mime_type: entry.mimeType,
            path: entry.path || `/${entry.name}`,
            path_array: entry.path_array || (entry.path ? entry.path.split('/').filter(Boolean) : []),
            path_depth: entry.depth !== undefined ? entry.depth : (entry.path_array ? entry.path_array.length - 1 : 0),
            web_view_link: entry.webViewLink || entry.web_view_link,
            is_deleted: false,
            size: entry.size ? parseInt(entry.size) : null,
            created_at: entry.createdTime ? new Date(entry.createdTime).toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString(),
            modified_at: entry.modifiedTime || null,
            root_drive_id: '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV',
            // file_signature: handled by database default
            thumbnail_link: null,
            document_type_id: null,
            expert_id: null,
            last_indexed: null,
            main_video_id: null,
            is_root: entry.is_root || false,
            metadata: metadata
          };
          
          Logger.info(`Record to insert: ${JSON.stringify(record, null, 2)}`);
          Logger.info('-----------------------------------');
        }
      });
      
      if (verbose) {
        // Additional verbose logging here if needed
      }
    }
    
  } catch (error) {
    Logger.error('Error inserting missing sources:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const jsonFilePath = args.find(arg => !arg.startsWith('--') && !arg.includes('=')) || 'file_types/json/google-drive.json';
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  const checkAllUnderDHDG = args.includes('--check-all-dhdg');
  
  // Parse specific IDs
  const specificIds: string[] = [];
  const idsArg = args.find(arg => arg.startsWith('--ids='));
  if (idsArg) {
    const idsStr = idsArg.split('=')[1];
    specificIds.push(...idsStr.split(',').map(id => id.trim()));
  }
  
  // Pre-defined IDs from the question
  if (args.includes('--missing-nine')) {
    specificIds.push(
      '1lY0Vxhv51RBZ5K9PmVQ9_T5PGpmcnkdh',
      '16FpSTTysb1KQ27pKX4gpMnCU4UawN_te',
      '16_yUoUFiyIT1lCRp3djQroTmKJjs9pYx',
      '1UxtOppPsbbbvG5BHP2M89TCPAs6ygAKQ',
      '1v9o3h8szKYHV_ZMKnph2XzAQYhMJmI-h',
      '1R3KlwjPNO6imIerLeBxg9cAXtU23WOcE',
      '1ab12OG1nS8jeWyY8gb4fCc_NPOP52F6k',
      '1Ldhx29BXAKJEU0F9mFN_AodvykRGZ06-',
      '13G5WPeK47jeeJI8kGG26jxqcIsjRAzQR'
    );
  }
  
  insertMissingSources(
    jsonFilePath, 
    dryRun, 
    verbose, 
    specificIds.length > 0 ? specificIds : undefined,
    checkAllUnderDHDG
  );
}

// Export the function for importing in index.ts
export { insertMissingSources };