#!/usr/bin/env ts-node
/**
 * Add Google Drive Root Folder
 * 
 * This script adds a new Google Drive folder as a root folder in the database.
 * 
 * Usage:
 *   npx ts-node add-drive-root.ts <folderId> --name "Folder Name" [--description "Optional description"]
 * 
 * Example:
 *   npx ts-node add-drive-root.ts 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --name "Dynamic Healing Discussion Group"
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { getGoogleDriveService } from '../../../packages/shared/services/google-drive';
import { Logger } from '../../../packages/shared/utils';
import type { Database } from '../../../supabase/types';

// Initialize logger
Logger.setLevel(Logger.LogLevel.INFO);

// Known folder IDs
const KNOWN_FOLDERS: Record<string, string> = {
  'dynamic-healing': '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV',
  'polyvagal-steering': '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc',
};

// Process command line arguments
const args = process.argv.slice(2);
const folderId = args[0];
const nameIndex = args.indexOf('--name');
const name = nameIndex !== -1 && args[nameIndex + 1] ? args[nameIndex + 1] : undefined;
const descIndex = args.indexOf('--description');
const description = descIndex !== -1 && args[descIndex + 1] ? args[descIndex + 1] : undefined;

if (!folderId) {
  Logger.error('❌ Folder ID is required');
  Logger.info('Usage: npx ts-node add-drive-root.ts <folderId> --name "Folder Name" [--description "Description"]');
  process.exit(1);
}

async function main() {
  try {
    // Get the Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    
    try {
      const connectionTest = await supabaseClientService.testConnection();
      if (!connectionTest.success) {
        Logger.error('Failed to connect to Supabase', connectionTest.error);
        process.exit(1);
      }
    } catch (error) {
      Logger.error('Error testing Supabase connection', error);
      process.exit(1);
    }
    
    const supabase = supabaseClientService.getClient();

    // Get the resolved folder ID if it's an alias
    let resolvedFolderId = folderId;
    if (KNOWN_FOLDERS[folderId]) {
      resolvedFolderId = KNOWN_FOLDERS[folderId];
      Logger.info(`Using known folder ID for "${folderId}": ${resolvedFolderId}`);
    }

    // Get Google Drive service
    const googleDriveService = getGoogleDriveService(supabase);
    
    Logger.info(`🔍 Checking folder with ID: ${resolvedFolderId}`);
    
    // Verify the folder exists in Google Drive
    const folderData = await googleDriveService.getFileMetadata(resolvedFolderId);
    
    if (!folderData) {
      Logger.error(`Folder not found with ID: ${resolvedFolderId}`);
      process.exit(1);
    }
    
    const isFolder = folderData.mimeType === 'application/vnd.google-apps.folder';
    
    if (!isFolder) {
      Logger.error(`The provided ID is not a folder: ${folderData.mimeType}`);
      process.exit(1);
    }
    
    // Use the folder name if no custom name is provided
    const folderName = name || folderData.name;
    Logger.info(`Using folder name: "${folderName}"`);
    
    // Check if folder already exists in the database
    const { data: existingFolders, error: queryError } = await supabase
      .from('sources_google')
      .select('id, drive_id, name')
      .eq('drive_id', resolvedFolderId)
      .eq('deleted', false);
      
    if (queryError) {
      throw queryError;
    }
    
    // If folder exists, update it
    if (existingFolders && existingFolders.length > 0) {
      Logger.info(`Folder already exists with name "${existingFolders[0].name}", updating...`);
      
      const { data, error } = await supabase
        .from('sources_google')
        .update({
          name: folderName,
          is_root: true,
          path: `/${folderName}`,
          parent_path: null,
          parent_folder_id: null,
          metadata: { 
            description: description,
            isRootFolder: true,
            lastUpdated: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('drive_id', resolvedFolderId)
        .select();
        
      if (error) {
        throw error;
      }
      
      Logger.info(`✅ Updated root folder: ${folderName}`);
      return;
    }
    
    // Insert new root folder
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('sources_google')
      .insert({
        drive_id: resolvedFolderId,
        name: folderName,
        is_root: true,
        mime_type: 'application/vnd.google-apps.folder',
        path: `/${folderName}`,
        parent_path: null,
        parent_folder_id: null,
        metadata: { 
          description: description,
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
    
    Logger.info(`✅ Added new root folder: ${folderName} with database ID: ${data[0].id}`);
  } catch (error: any) {
    Logger.error('Error:', error.message);
    process.exit(1);
  }
}

// Execute the main function
main().catch(error => {
  Logger.error('Unhandled error:', error);
  process.exit(1);
});