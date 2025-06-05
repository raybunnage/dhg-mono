#!/usr/bin/env ts-node
/**
 * Find a specific folder or file by name in Google Drive
 * 
 * This script searches for folders or files with a specific name pattern
 * in the Dynamic Healing Discussion Group Google Drive folder.
 * 
 * Usage:
 *   ts-node find-folder.ts <folder-name> [options]
 * 
 * Options:
 *   --verbose          Show detailed logs
 *   --exact            Use exact match instead of partial match
 *   --type <type>      Type of item to find (folder, file, or all) - default: all
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { getGoogleDriveService } from '../../../packages/shared/services/google-drive';

// Load multiple environment files
function loadEnvFiles() {
  // Order matters - later files override earlier ones
  const envFiles = [
    '.env',
    '.env.local',
    '.env.development'
  ];
  
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`Loading environment variables from ${file}`);
      dotenv.config({ path: filePath });
    }
  }
}

// Load environment variables
loadEnvFiles();

// Process command line arguments
const args = process.argv.slice(2);
const searchPattern = args[0]; // First argument is the search pattern

if (!searchPattern) {
  console.error('Error: You must provide a folder or file name to search for');
  process.exit(1);
}

const isVerbose = args.includes('--verbose');
const isExact = args.includes('--exact');
const typeIndex = args.indexOf('--type');
const itemType = typeIndex !== -1 && args[typeIndex + 1] 
  ? args[typeIndex + 1].toLowerCase()
  : 'all';

// Folder ID for Dynamic Healing Discussion Group
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Create Supabase client using the singleton pattern
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

/**
 * Find folders or files by name
 */
async function findByName() {
  try {
    console.log(`=== Searching for ${itemType === 'all' ? 'items' : itemType + 's'} with name "${searchPattern}" ===`);
    console.log(`Match type: ${isExact ? 'Exact match' : 'Partial match'}`);
    
    // Initialize Google Drive client
    const driveService = getGoogleDriveService(supabase);
    console.log('✅ Google Drive service initialized');
    
    // Search directly in Google Drive using the API
    console.log('Searching in Google Drive (this may take a moment)...');
    
    // Build search query
    let query = '';
    
    // Add type filter
    if (itemType === 'folder') {
      query += "mimeType = 'application/vnd.google-apps.folder' and ";
    } else if (itemType === 'file') {
      query += "mimeType != 'application/vnd.google-apps.folder' and ";
    }
    
    // Add name filter
    if (isExact) {
      query += `name = '${searchPattern}' and `;
    } else {
      query += `name contains '${searchPattern}' and `;
    }
    
    // Add trashed filter and parent filter
    query += "trashed = false and ";
    query += `'${DYNAMIC_HEALING_FOLDER_ID}' in parents`; // This limits the search to direct children of the root folder
    
    // Execute search
    const result = await driveService.listFiles(DYNAMIC_HEALING_FOLDER_ID, {
      q: query,
      pageSize: 100,
      fields: 'nextPageToken, files(id, name, mimeType, parents, modifiedTime)'
    });
    
    // First, search for direct children of the root folder
    if (result.files.length > 0) {
      console.log(`\n=== Found ${result.files.length} matching items in the root directory ===`);
      result.files.forEach((file: any, index: number) => {
        const itemTypeStr = file.mimeType === 'application/vnd.google-apps.folder' ? 'Folder' : 'File';
        const modifiedDate = new Date(file.modifiedTime).toLocaleString();
        console.log(`${index + 1}. ${itemTypeStr}: ${file.name} (ID: ${file.id})`);
        console.log(`   Modified: ${modifiedDate}`);
        console.log(`   Type: ${file.mimeType}`);
        console.log(`   Parent: ${file.parents?.[0] || 'Unknown'}`);
        console.log('');
      });
    } else {
      console.log(`No matching items found in the root directory.`);
    }
    
    // Now search for the item in all subfolders recursively
    // Build a more general query that doesn't restrict to direct children
    let recursiveQuery = '';
    
    // Add type filter
    if (itemType === 'folder') {
      recursiveQuery += "mimeType = 'application/vnd.google-apps.folder' and ";
    } else if (itemType === 'file') {
      recursiveQuery += "mimeType != 'application/vnd.google-apps.folder' and ";
    }
    
    // Add name filter
    if (isExact) {
      recursiveQuery += `name = '${searchPattern}' and `;
    } else {
      recursiveQuery += `name contains '${searchPattern}' and `;
    }
    
    // Add trashed filter
    recursiveQuery += "trashed = false";
    
    // Execute recursive search
    const recursiveResult = await driveService.searchFiles(recursiveQuery, {
      pageSize: 100,
      fields: 'nextPageToken, files(id, name, mimeType, parents, modifiedTime, webViewLink)'
    });
    
    if (recursiveResult.files?.length > 0) {
      console.log(`\n=== Found ${recursiveResult.files.length} matching items in all folders (recursive search) ===`);
      
      // Group items by parent folder
      const itemsByParent = new Map<string, any[]>();
      
      // Collect parent folder IDs for later lookup
      const parentIds = new Set<string>();
      
      recursiveResult.files.forEach((file: any) => {
        const parentId = file.parents?.[0];
        if (parentId) {
          if (!itemsByParent.has(parentId)) {
            itemsByParent.set(parentId, []);
            parentIds.add(parentId);
          }
          itemsByParent.get(parentId)?.push(file);
        }
      });
      
      // Get parent folder details
      const parentFolders = new Map<string, any>();
      
      // Process parents in batches
      const batchSize = 50;
      const parentIdArray = Array.from(parentIds);
      
      for (let i = 0; i < parentIdArray.length; i += batchSize) {
        const batch = parentIdArray.slice(i, i + batchSize);
        for (const parentId of batch) {
          try {
            const folder = await driveService.getFile(parentId, 'id, name, parents');
            parentFolders.set(parentId, folder);
          } catch (error) {
            console.log(`Could not get details for parent folder ${parentId}`);
          }
        }
      }
      
      // Now display items by parent folder
      let itemCount = 1;
      for (const [parentId, items] of itemsByParent.entries()) {
        const parentFolder = parentFolders.get(parentId);
        const parentName = parentFolder ? parentFolder.name : 'Unknown folder';
        
        console.log(`\nParent folder: ${parentName} (ID: ${parentId})`);
        
        items.forEach((item: any) => {
          const itemTypeStr = item.mimeType === 'application/vnd.google-apps.folder' ? 'Folder' : 'File';
          const modifiedDate = new Date(item.modifiedTime).toLocaleString();
          console.log(`${itemCount}. ${itemTypeStr}: ${item.name} (ID: ${item.id})`);
          console.log(`   Modified: ${modifiedDate}`);
          console.log(`   Type: ${item.mimeType}`);
          console.log(`   Web Link: ${item.webViewLink || 'N/A'}`);
          itemCount++;
        });
      }
    } else {
      console.log(`No matching items found in recursive search.`);
    }
    
    // Check database for matching items by name
    console.log(`\n=== Checking database for items with name containing "${searchPattern}" ===`);
    
    const { data: dbItems, error: dbError } = await supabase
      .from('google_sources')
      .select('*')
      .ilike('name', `%${searchPattern}%`)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (dbError) {
      console.error(`Error querying database: ${dbError.message}`);
    } else if (dbItems && dbItems.length > 0) {
      console.log(`Found ${dbItems.length} matching items in the database:`);
      console.log(`-----------------------------------------------------`);
      
      dbItems.forEach((item: any, index: number) => {
        const itemType = item.mime_type === 'application/vnd.google-apps.folder' ? 'Folder' : 'File';
        const createdDate = new Date(item.created_at).toLocaleString();
        console.log(`${index + 1}. ${itemType}: ${item.name} (DB ID: ${item.id})`);
        console.log(`   Drive ID: ${item.drive_id}`);
        console.log(`   Path: ${item.path || 'N/A'}`);
        console.log(`   Created: ${createdDate}`);
        console.log(`   Mime Type: ${item.mime_type}`);
        console.log('');
      });
    } else {
      console.log(`No matching items found in the database.`);
    }
    
    console.log('\n=== Search Complete ===');
  } catch (error: any) {
    console.error(`Error searching for items: ${error.message || error}`);
    process.exit(1);
  }
}

// Execute the main function
findByName();