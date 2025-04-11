# Archived on 2025-04-11 - Original file used with sources_google table
#!/usr/bin/env ts-node
/**
 * List Drive Roots
 * 
 * This script lists all root folders registered in the database and 
 * potential root folders from Google Drive that aren't registered yet.
 * 
 * Usage:
 *   ts-node list-drive-roots.ts [options]
 * 
 * Options:
 *   --potential          Show unregistered potential root folders
 *   --limit <number>     Limit the number of potential folders (default: 20)
 * 
 * Examples:
 *   ts-node list-drive-roots.ts
 *   ts-node list-drive-roots.ts --potential
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { defaultGoogleAuth } from '../../../packages/shared/services/google-drive';
import { Logger } from '../../../packages/shared/utils';
import type { Database } from '../../../supabase/types';

// Initialize logger
import { LogLevel } from '../../../packages/shared/utils/logger';
Logger.setLevel(LogLevel.INFO);

// Process command line arguments
const args = process.argv.slice(2);
const showPotential = args.includes('--potential');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 && args[limitIndex + 1] 
  ? parseInt(args[limitIndex + 1]) 
  : 20;

// Get the Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
let supabase: any;

/**
 * Main function
 */
async function listRoots(): Promise<void> {
  try {
    // Get the client - skip connection test since it's failing
    try {
      supabase = supabaseClientService.getClient();
      Logger.info('Got Supabase client');
    } catch (error) {
      Logger.error('Error getting Supabase client', error);
      process.exit(1);
    }
    
    Logger.info('=== Google Drive Root Folders ===\n');
    
    // Get registered root folders
    const { data: rootFolders, error } = await supabase
      .from('sources_google')
      .select('id, name, drive_id, path, created_at, updated_at')
      .eq('is_root', true)
      .eq('deleted', false)
      .order('name');
      
    if (error) {
      throw error;
    }
    
    // Display registered root folders
    if (!rootFolders || rootFolders.length === 0) {
      Logger.info('No registered root folders found in the database.');
    } else {
      Logger.info(`Found ${rootFolders.length} registered root folders:`);
      Logger.info('--------------------------------------------------------');
      Logger.info('ID\t\tDrive ID\t\t\t\tName\t\tLast Updated');
      Logger.info('--------------------------------------------------------');
      
      rootFolders.forEach((folder: any) => {
        const updated = new Date(folder.updated_at).toLocaleDateString();
        Logger.info(`${folder.id}\t${folder.drive_id}\t${folder.name}\t${updated}`);
      });
    }
    
    // If --potential flag is set, also list potential root folders
    if (showPotential) {
      await listPotentialRoots(
        rootFolders?.map((f: any) => f.drive_id) || []
      );
    }
  } catch (error) {
    Logger.error('❌ Error listing root folders:', error);
  }
}

/**
 * List potential root folders (top-level folders in Google Drive)
 */
async function listPotentialRoots(existingRootIds: string[]): Promise<void> {
  try {
    Logger.info('\n=== Potential Root Folders ===\n');
    
    // Check if auth service is ready
    if (!await defaultGoogleAuth.isReady()) {
      Logger.error('Google authentication is not ready');
      return;
    }
    
    // Get access token
    const accessToken = await defaultGoogleAuth.getAccessToken();
    if (!accessToken) {
      Logger.error('❌ No Google access token found');
      return;
    }
    
    // Create a set of existing root folder IDs for faster lookups
    const existingRootIdsSet = new Set(existingRootIds);
    
    // Search for folders in the "My Drive" root
    Logger.info('Searching for folders in Google Drive...');
    
    // Query for top-level folders
    const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`);
    const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime,owners),nextPageToken');
    
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=${limit}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search files: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    const folders = data.files || [];
    
    Logger.info(`Found ${folders.length} top-level folders in Google Drive`);
    
    // Print the folders that aren't registered as roots
    Logger.info('\nFolders that could be registered as roots:');
    Logger.info('--------------------------------------------------------');
    
    const unregisteredFolders = folders.filter(
      (folder: { id: string }) => !existingRootIdsSet.has(folder.id)
    );
    
    if (unregisteredFolders.length === 0) {
      Logger.info('No unregistered folders found.');
    } else {
      // Print a table of folders
      Logger.info('Drive ID\t\t\t\tName\t\t\tModified (Owner)');
      Logger.info('--------------------------------------------------------');
      
      unregisteredFolders.forEach((folder: { 
        id: string;
        name: string;
        modifiedTime: string;
        owners?: Array<{ displayName?: string }>;
      }) => {
        const modified = new Date(folder.modifiedTime).toLocaleDateString();
        const owner = folder.owners?.[0]?.displayName || 'Unknown';
        Logger.info(`${folder.id}\t${folder.name}\t\t${modified} (${owner})`);
      });
      
      // Add usage instructions
      Logger.info('\nTo add a root folder, use:');
      Logger.info('./google-drive-cli.sh add-root <folderId> --name "Folder Name"');
    }
  } catch (error) {
    Logger.error('❌ Error listing potential root folders:', error);
  }
}

// Execute the main function
listRoots().catch(error => {
  Logger.error('Unexpected error:', error);
  process.exit(1);
});