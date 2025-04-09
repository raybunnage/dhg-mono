#!/usr/bin/env ts-node
/**
 * Dynamic Healing Discussion Group Sync Script
 * 
 * This script is specifically for syncing the Dynamic Healing Discussion Group
 * Google Drive folder to the database. It supports both dry runs and actual sync
 * operations.
 * 
 * Usage:
 *   ts-node dynamic-healing-sync.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be synced without making changes
 *   --timeout <ms>     Set timeout for sync operations (default: 600000ms/10min)
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../supabase/types';

// Load multiple environment files
function loadEnvFiles() {
  // Order matters - later files override earlier ones
  const envFiles = [
    '.env',
    '.env.development',
    '.env.local'
  ];
  
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`Loading environment from ${file}`);
      dotenv.config({ path: filePath });
    }
  }
}

// Load environment variables
loadEnvFiles();

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const timeoutIndex = args.indexOf('--timeout');
const timeout = timeoutIndex !== -1 && args[timeoutIndex + 1] 
  ? parseInt(args[timeoutIndex + 1]) 
  : 600000; // Default to 10 minutes

// Folder ID for Dynamic Healing Discussion Group
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Debug loaded environment variables
console.log('Loaded environment variables:');
console.log('- SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Found' : 'Not found');
console.log('- VITE_GOOGLE_ACCESS_TOKEN:', process.env.VITE_GOOGLE_ACCESS_TOKEN ? 'Found' : 'Not found');

// Ensure Supabase credentials are available
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL or key not found in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Check if a folder exists and is valid
 */
async function checkFolder(folderId: string): Promise<{
  valid: boolean;
  name?: string;
  error?: string;
}> {
  try {
    // Get Google access token
    const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN;
    
    if (!accessToken) {
      return { valid: false, error: 'No Google access token found in environment variables' };
    }
    
    // Fetch folder details from Google Drive
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      return { 
        valid: false, 
        error: `Failed to get folder: ${response.status} ${response.statusText}` 
      };
    }
    
    const folderData = await response.json();
    
    if (folderData.mimeType !== 'application/vnd.google-apps.folder') {
      return { 
        valid: false, 
        error: `The provided ID is not a folder: ${folderData.mimeType}` 
      };
    }
    
    return { valid: true, name: folderData.name };
  } catch (error) {
    return { valid: false, error: `Error checking folder: ${(error as Error).message}` };
  }
}

/**
 * Search for files in the specified folder recursively
 */
async function searchFolder(folderId: string): Promise<{
  files: any[];
  totalCount: number;
  error?: string;
}> {
  try {
    const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN;
    
    if (!accessToken) {
      return { 
        files: [], 
        totalCount: 0, 
        error: 'No Google access token found in environment variables' 
      };
    }
    
    console.log('Searching for files in folder recursively...');
    
    // This approach will:
    // 1. Get all files in the top-level folder
    // 2. Find all subfolders in those results
    // 3. Recursively search each subfolder
    // 4. Combine all results

    // Array to hold all files, including those in subfolders
    let allFiles: any[] = [];
    
    // Function to get files from a specific folder
    async function getFilesInFolder(currentFolderId: string, parentPath?: string): Promise<any[]> {
      const query = encodeURIComponent(`'${currentFolderId}' in parents and trashed=false`);
      const fields = encodeURIComponent('files(id,name,mimeType,size,modifiedTime,parents),nextPageToken');
      const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=1000`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to search files: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const folderFiles = data.files || [];
      
      // Enhance files with path information
      const currentFiles = folderFiles.map((file: any) => {
        // Calculate the full path for this file
        const filePath = parentPath 
          ? `${parentPath}/${file.name}` 
          : `/${file.name}`;
        
        return {
          ...file,
          path: filePath,
          parentPath: parentPath || '/'
        };
      });
      
      // Add these files to our collection
      allFiles = [...allFiles, ...currentFiles];
      
      // Process status update (for large folders)
      if (allFiles.length % 100 === 0) {
        console.log(`Found ${allFiles.length} files so far...`);
      }
      
      // Find all subfolders in the current results
      const subFolders = folderFiles.filter((file: any) => 
        file.mimeType === 'application/vnd.google-apps.folder'
      );
      
      // Recursively process each subfolder
      for (const folder of subFolders) {
        const folderPath = parentPath 
          ? `${parentPath}/${folder.name}` 
          : `/${folder.name}`;
          
        await getFilesInFolder(folder.id, folderPath);
      }
      
      return currentFiles;
    }
    
    // Start the recursive search from the root folder
    await getFilesInFolder(folderId);
    
    // Sort files by path for easier browsing
    allFiles.sort((a, b) => a.path.localeCompare(b.path));
    
    return { files: allFiles, totalCount: allFiles.length };
  } catch (error) {
    return { 
      files: [], 
      totalCount: 0, 
      error: `Error searching folder: ${(error as Error).message}` 
    };
  }
}

/**
 * Add folder as a root folder if not already
 */
async function ensureRootFolder(folderId: string, folderName: string): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  try {
    // Check if folder already exists in the database
    const { data: existingFolders, error: queryError } = await supabase
      .from('sources_google')
      .select('id, drive_id, name, is_root')
      .eq('drive_id', folderId)
      .eq('deleted', false);
      
    if (queryError) {
      throw queryError;
    }
    
    // If folder exists, ensure it's marked as a root
    if (existingFolders && existingFolders.length > 0) {
      const folder = existingFolders[0];
      
      // If it's already a root folder, we're done
      if (folder.is_root) {
        return { success: true, id: folder.id };
      }
      
      // Update it to be a root folder
      const { data, error } = await supabase
        .from('sources_google')
        .update({
          name: folderName,
          is_root: true,
          path: `/${folderName}`,
          parent_path: null,
          parent_folder_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', folder.id)
        .select();
        
      if (error) {
        throw error;
      }
      
      return { success: true, id: data[0].id };
    }
    
    // Insert new root folder
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('sources_google')
      .insert({
        drive_id: folderId,
        name: folderName,
        is_root: true,
        mime_type: 'application/vnd.google-apps.folder',
        path: `/${folderName}`,
        parent_path: null,
        parent_folder_id: null,
        metadata: { 
          isRootFolder: true,
          createdAt: now
        },
        created_at: now,
        updated_at: now,
        deleted: false
      })
      .select();
      
    if (error) {
      throw error;
    }
    
    return { success: true, id: data[0].id };
  } catch (error) {
    return { success: false, error: `Error ensuring root folder: ${(error as Error).message}` };
  }
}

/**
 * Insert files into the database
 */
async function insertFiles(
  files: any[], 
  rootFolderId: string, 
  dryRun: boolean
): Promise<{
  success: number;
  errors: number;
  newFiles?: number;
  existingFiles?: number;
}> {
  if (dryRun) {
    console.log(`DRY RUN: Would process ${files.length} files`);
    return { success: files.length, errors: 0 };
  }
  
  let successCount = 0;
  let errorCount = 0;
  let newFiles = 0;
  let existingFiles = 0;
  
  // Get existing files to avoid duplicates
  const { data: existingRecords, error: queryError } = await supabase
    .from('sources_google')
    .select('drive_id')
    .eq('deleted', false);
    
  if (queryError) {
    console.error('Error fetching existing records:', queryError);
    return { success: 0, errors: files.length };
  }
  
  // Create a Set of existing drive IDs for faster lookups
  const existingDriveIds = new Set(
    (existingRecords || []).map(record => record.drive_id)
  );
  
  // Process files in smaller batches to prevent timeouts
  const batchSize = 50;
  const batches = Math.ceil(files.length / batchSize);
  
  console.log(`Processing ${files.length} files in ${batches} batches of ${batchSize}`);
  
  for (let i = 0; i < batches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, files.length);
    const batch = files.slice(start, end);
    
    console.log(`Processing batch ${i + 1}/${batches} (${batch.length} files)`);
    
    // Filter to new files only
    const newFilesInBatch = batch.filter(file => !existingDriveIds.has(file.id));
    existingFiles += (batch.length - newFilesInBatch.length);
    
    if (newFilesInBatch.length === 0) {
      console.log('No new files in this batch, skipping...');
      continue;
    }
    
    // Prepare the data for insertion
    const filesToInsert = newFilesInBatch.map(file => ({
      drive_id: file.id,
      name: file.name,
      mime_type: file.mimeType,
      path: file.path,
      parent_path: file.parentPath,
      parent_folder_id: file.parents?.[0] || null,
      content_extracted: false,
      deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Add metadata if available
      metadata: {
        size: file.size,
        modifiedTime: file.modifiedTime
      }
    }));
    
    // Insert the files into the database
    const { data, error } = await supabase
      .from('sources_google')
      .insert(filesToInsert);
    
    if (error) {
      console.error(`Error inserting batch ${i + 1}:`, error);
      errorCount += newFilesInBatch.length;
    } else {
      successCount += newFilesInBatch.length;
      newFiles += newFilesInBatch.length;
      console.log(`Successfully inserted ${newFilesInBatch.length} new files in batch ${i + 1}`);
    }
  }
  
  return { 
    success: successCount, 
    errors: errorCount,
    newFiles,
    existingFiles
  };
}

/**
 * Main sync function
 */
async function syncDynamicHealingGroup(): Promise<void> {
  console.log('=== Dynamic Healing Discussion Group Sync ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL SYNC'}`);
  console.log(`Timeout: ${timeout}ms`);
  console.log('==============================================');
  
  // Check if the folder exists
  console.log(`Checking folder: ${DYNAMIC_HEALING_FOLDER_ID}`);
  const folderCheck = await checkFolder(DYNAMIC_HEALING_FOLDER_ID);
  
  if (!folderCheck.valid) {
    console.error(`❌ ${folderCheck.error}`);
    process.exit(1);
  }
  
  console.log(`✅ Folder exists: "${folderCheck.name}"`);
  
  // Ensure it's a root folder in our database
  if (!isDryRun) {
    console.log('Ensuring folder is registered as a root folder...');
    const rootResult = await ensureRootFolder(
      DYNAMIC_HEALING_FOLDER_ID, 
      folderCheck.name || 'Dynamic Healing Discussion Group'
    );
    
    if (!rootResult.success) {
      console.error(`❌ ${rootResult.error}`);
      process.exit(1);
    }
    
    console.log('✅ Folder is registered as a root folder');
  } else {
    console.log('DRY RUN: Would ensure folder is registered as a root folder');
  }
  
  // Search for files in the folder
  console.log('Searching for files...');
  const searchResult = await searchFolder(DYNAMIC_HEALING_FOLDER_ID);
  
  if (searchResult.error) {
    console.error(`❌ ${searchResult.error}`);
    process.exit(1);
  }
  
  console.log(`✅ Found ${searchResult.totalCount} files`);
  
  // Group files by type
  const fileTypes: Record<string, number> = {};
  searchResult.files.forEach(file => {
    const type = file.mimeType || 'unknown';
    fileTypes[type] = (fileTypes[type] || 0) + 1;
  });
  
  console.log('\nFile types:');
  Object.entries(fileTypes).forEach(([type, count]) => {
    console.log(`- ${type}: ${count} files`);
  });
  
  // Show sample of files
  console.log('\nSample of files:');
  searchResult.files.slice(0, 10).forEach((file, index) => {
    console.log(`${index + 1}. ${file.name} (${file.mimeType})`);
  });
  
  if (searchResult.totalCount > 10) {
    console.log(`... and ${searchResult.totalCount - 10} more files`);
  }
  
  // Insert files
  console.log('\nProcessing files...');
  const insertResult = await insertFiles(
    searchResult.files, 
    DYNAMIC_HEALING_FOLDER_ID, 
    isDryRun
  );
  
  if (isDryRun) {
    console.log(`✅ Would process ${insertResult.success} files`);
  } else {
    console.log(`✅ Processing complete:`);
    console.log(`   - New files added: ${insertResult.newFiles || 0}`);
    console.log(`   - Existing files: ${insertResult.existingFiles || 0}`);
    console.log(`   - Total processed: ${insertResult.success}`);
  }
  
  if (insertResult.errors > 0) {
    console.error(`❌ ${insertResult.errors} errors during processing`);
  }
  
  console.log('\n=== Sync Complete ===');
}

// Export for module usage
export { syncDynamicHealingGroup };

// Execute the main function if run directly
if (require.main === module) {
  syncDynamicHealingGroup().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}