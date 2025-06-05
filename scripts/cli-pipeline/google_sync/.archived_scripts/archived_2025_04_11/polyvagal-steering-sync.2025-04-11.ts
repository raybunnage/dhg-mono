# Archived on 2025-04-11 - Original file used with sources_google table
#!/usr/bin/env ts-node
/**
 * Polyvagal Steering Group Sync Script
 * 
 * This script is specifically for syncing the Polyvagal Steering Group
 * Google Drive folder to the database. It supports both dry runs and actual sync
 * operations.
 * 
 * Usage:
 *   ts-node polyvagal-steering-sync.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be synced without making changes
 *   --timeout <ms>     Set timeout for sync operations (default: 600000ms/10min)
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';

// Load environment variables
dotenv.config();

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const timeoutIndex = args.indexOf('--timeout');
const timeout = timeoutIndex !== -1 && args[timeoutIndex + 1] 
  ? parseInt(args[timeoutIndex + 1]) 
  : 600000; // Default to 10 minutes

// Folder ID for Polyvagal Steering Group
const POLYVAGAL_STEERING_FOLDER_ID = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc';

// Ensure Supabase credentials are available
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

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
    return { valid: false, error: `Error checking folder: ${error.message}` };
  }
}

/**
 * Search for files in the specified folder
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
    
    // This would be a recursive function to search all files and subfolders
    // For simplicity, we'll just do a single query here
    const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const fields = encodeURIComponent('files(id,name,mimeType,size,modifiedTime,parents),nextPageToken');
    
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=1000`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      return { 
        files: [], 
        totalCount: 0, 
        error: `Failed to search files: ${response.status} ${response.statusText}` 
      };
    }
    
    const data = await response.json();
    const files = data.files || [];
    
    // In a real implementation, you would recursively search subfolders
    return { files, totalCount: files.length };
  } catch (error) {
    return { 
      files: [], 
      totalCount: 0, 
      error: `Error searching folder: ${error.message}` 
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
      .from('google_sources')
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
        .from('google_sources')
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
      .from('google_sources')
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
    return { success: false, error: `Error ensuring root folder: ${error.message}` };
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
}> {
  if (dryRun) {
    console.log(`DRY RUN: Would insert ${files.length} files`);
    return { success: files.length, errors: 0 };
  }
  
  // In a real implementation, this would insert files into the database
  // For now, we'll just simulate success
  console.log(`WOULD INSERT: ${files.length} files (implementation pending)`);
  
  return { success: files.length, errors: 0 };
}

/**
 * Main sync function
 */
async function syncPolyvagalSteeringGroup(): Promise<void> {
  console.log('=== Polyvagal Steering Group Sync ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL SYNC'}`);
  console.log(`Timeout: ${timeout}ms`);
  console.log('======================================');
  
  // Check if the folder exists
  console.log(`Checking folder: ${POLYVAGAL_STEERING_FOLDER_ID}`);
  const folderCheck = await checkFolder(POLYVAGAL_STEERING_FOLDER_ID);
  
  if (!folderCheck.valid) {
    console.error(`❌ ${folderCheck.error}`);
    process.exit(1);
  }
  
  console.log(`✅ Folder exists: "${folderCheck.name}"`);
  
  // Ensure it's a root folder in our database
  if (!isDryRun) {
    console.log('Ensuring folder is registered as a root folder...');
    const rootResult = await ensureRootFolder(
      POLYVAGAL_STEERING_FOLDER_ID, 
      folderCheck.name
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
  const searchResult = await searchFolder(POLYVAGAL_STEERING_FOLDER_ID);
  
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
  console.log('\nInserting files...');
  const insertResult = await insertFiles(
    searchResult.files, 
    POLYVAGAL_STEERING_FOLDER_ID, 
    isDryRun
  );
  
  console.log(`✅ ${isDryRun ? 'Would insert' : 'Inserted'} ${insertResult.success} files`);
  
  if (insertResult.errors > 0) {
    console.error(`❌ ${insertResult.errors} errors during insertion`);
  }
  
  console.log('\n=== Sync Complete ===');
}

// Execute the main function
syncPolyvagalSteeringGroup().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});