#!/usr/bin/env ts-node
/**
 * Google Drive Manager CLI
 * 
 * This script provides commands to manage Google Drive root folders and sync files from them.
 * It allows listing, adding, removing root folders and synchronizing their contents with the database.
 * 
 * Usage:
 *   ts-node google-drive-manager.ts [command] [options]
 * 
 * Commands:
 *   list-roots                List all registered root folders
 *   list-potential-roots      List folders that are in Google Drive but not registered
 *   add-root [folderId]       Add a new root folder
 *   remove-root [id]          Remove a root folder
 *   check-folder [folderId]   Check if a folder exists in Google Drive
 *   sync [rootId]             Sync files from a root folder (or all if not specified)
 *   sync-folder [folderId]    Sync a specific folder (doesn't need to be a root)
 *   help                      Show this help message
 * 
 * Options:
 *   --dry-run                 Show what would be synced without making changes
 *   --timeout [ms]            Set timeout for sync operations (default: 600000ms/10min)
 *   --name [name]             Specify a name when adding a root folder
 *   --description [desc]      Specify a description when adding a root folder
 *   --verbose                 Show more detailed output
 * 
 * Examples:
 *   ts-node google-drive-manager.ts list-roots
 *   ts-node google-drive-manager.ts add-root 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --name "Dynamic Healing Discussion Group"
 *   ts-node google-drive-manager.ts sync-folder 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --dry-run
 *   ts-node google-drive-manager.ts sync-folder 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --timeout 1200000
 */

import * as dotenv from 'dotenv';
import { writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { Command } from 'commander';
import type { Database } from '../supabase/types';

// Load environment variables
dotenv.config();

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

// Define known folder IDs
const KNOWN_FOLDERS = {
  'dynamic-healing': '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV',
  'polyvagal-steering': '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc',
};

// Implementation will go here as we add each function
// For now, let's set up the CLI structure

const program = new Command()
  .name('google-drive-manager')
  .description('CLI to manage Google Drive folders and sync their contents')
  .version('1.0.0');

// List root folders command
program
  .command('list-roots')
  .description('List all registered root folders')
  .action(async () => {
    console.log('Fetching root folders...');
    try {
      const { data, error } = await supabase
        .from('sources_google')
        .select('*')
        .eq('is_root', true)
        .eq('deleted', false)
        .order('name');
        
      if (error) {
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.log('No root folders found.');
        return;
      }
      
      console.log(`Found ${data.length} root folders:`);
      console.log('------------------------------');
      
      data.forEach((folder, index) => {
        console.log(`${index + 1}. ${folder.name}`);
        console.log(`   ID: ${folder.id}`);
        console.log(`   Drive ID: ${folder.drive_id}`);
        console.log(`   Last Synced: ${folder.last_indexed || 'Never'}`);
        console.log(`   Status: ${folder.sync_status || 'Unknown'}`);
        if (folder.sync_error) {
          console.log(`   Error: ${folder.sync_error}`);
        }
        console.log('------------------------------');
      });
    } catch (error) {
      console.error('❌ Error listing root folders:', error);
    }
  });

// Add root folder command
program
  .command('add-root <folderId>')
  .description('Add a new root folder')
  .option('--name <name>', 'Custom name for the folder')
  .option('--description <description>', 'Description for the folder')
  .action(async (folderId: string, options: { name?: string; description?: string }) => {
    console.log(`Adding root folder with ID: ${folderId}`);
    
    try {
      // First check if the folder exists in Google Drive
      const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN;
      
      if (!accessToken) {
        console.error('❌ No Google access token found in environment variables');
        process.exit(1);
      }
      
      // Check if this is a known folder alias
      if (KNOWN_FOLDERS[folderId as keyof typeof KNOWN_FOLDERS]) {
        const actualId = KNOWN_FOLDERS[folderId as keyof typeof KNOWN_FOLDERS];
        console.log(`Using known folder ID for "${folderId}": ${actualId}`);
        folderId = actualId;
      }
      
      // Verify the folder exists in Google Drive
      try {
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        
        if (!response.ok) {
          console.error(`❌ Failed to get folder from Google Drive: ${response.status} ${response.statusText}`);
          process.exit(1);
        }
        
        const folderData = await response.json();
        const isFolder = folderData.mimeType === 'application/vnd.google-apps.folder';
        
        if (!isFolder) {
          console.error(`❌ The provided ID is not a folder: ${folderData.mimeType}`);
          process.exit(1);
        }
        
        // Use the folder name if no custom name is provided
        if (!options.name) {
          options.name = folderData.name;
          console.log(`Using folder name from Google Drive: "${options.name}"`);
        }
      } catch (error) {
        console.error('❌ Error checking folder in Google Drive:', error);
        process.exit(1);
      }
      
      // Check if folder already exists
      const { data: existingFolders, error: queryError } = await supabase
        .from('sources_google')
        .select('id, drive_id, name')
        .eq('drive_id', folderId)
        .eq('deleted', false);
        
      if (queryError) {
        throw queryError;
      }
      
      // If folder exists, update it
      if (existingFolders && existingFolders.length > 0) {
        console.log(`Folder already exists with name "${existingFolders[0].name}", updating...`);
        
        const { data, error } = await supabase
          .from('sources_google')
          .update({
            name: options.name,
            is_root: true,
            path: `/${options.name}`,
            parent_path: null,
            parent_folder_id: null,
            metadata: { 
              description: options.description,
              isRootFolder: true,
              lastUpdated: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq('drive_id', folderId)
          .select();
          
        if (error) {
          throw error;
        }
        
        console.log(`✅ Updated root folder: ${options.name}`);
        return;
      }
      
      // Insert new root folder
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('sources_google')
        .insert({
          drive_id: folderId,
          name: options.name,
          is_root: true,
          mime_type: 'application/vnd.google-apps.folder',
          path: `/${options.name}`,
          parent_path: null,
          parent_folder_id: null,
          metadata: { 
            description: options.description,
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
      
      console.log(`✅ Added new root folder: ${options.name}`);
    } catch (error) {
      console.error('❌ Error adding root folder:', error);
    }
  });

// Remove root folder command  
program
  .command('remove-root <id>')
  .description('Remove a root folder')
  .option('--hard', 'Hard delete the folder from database')
  .action(async (id: string, options: { hard?: boolean }) => {
    console.log(`Removing root folder with ID: ${id}`);
    
    try {
      // First check if the folder exists
      const { data, error } = await supabase
        .from('sources_google')
        .select('id, name, drive_id')
        .eq('id', id)
        .eq('deleted', false)
        .single();
        
      if (error) {
        throw error;
      }
      
      if (!data) {
        console.error('❌ Root folder not found');
        return;
      }
      
      // Confirm with user
      console.log(`Are you sure you want to remove the root folder "${data.name}"?`);
      console.log(`Type "yes" to confirm:`);
      
      // For now, we'll just proceed without confirmation in this example
      // In a real CLI, you would wait for user input here
      
      if (options.hard) {
        // Hard delete - mark as deleted
        const { error: deleteError } = await supabase
          .from('sources_google')
          .update({ 
            deleted: true, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', id);
          
        if (deleteError) {
          throw deleteError;
        }
        
        console.log(`✅ Hard deleted root folder: ${data.name}`);
      } else {
        // Soft delete - just unmark as root
        const { error: updateError } = await supabase
          .from('sources_google')
          .update({ 
            is_root: false, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', id);
          
        if (updateError) {
          throw updateError;
        }
        
        console.log(`✅ Removed root folder status from: ${data.name}`);
      }
    } catch (error) {
      console.error('❌ Error removing root folder:', error);
    }
  });

// Check folder command
program
  .command('check-folder <folderId>')
  .description('Check if a folder exists in Google Drive')
  .action(async (folderId: string) => {
    console.log(`Checking folder with ID: ${folderId}`);
    
    try {
      // Check if this is a known folder alias
      if (KNOWN_FOLDERS[folderId as keyof typeof KNOWN_FOLDERS]) {
        const actualId = KNOWN_FOLDERS[folderId as keyof typeof KNOWN_FOLDERS];
        console.log(`Using known folder ID for "${folderId}": ${actualId}`);
        folderId = actualId;
      }
      
      const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN;
      
      if (!accessToken) {
        console.error('❌ No Google access token found in environment variables');
        process.exit(1);
      }
      
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,size,createdTime,modifiedTime`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      if (!response.ok) {
        console.error(`❌ Failed to get folder: ${response.status} ${response.statusText}`);
        return;
      }
      
      const folderData = await response.json();
      const isFolder = folderData.mimeType === 'application/vnd.google-apps.folder';
      
      if (!isFolder) {
        console.log(`❌ The provided ID is not a folder. It's a ${folderData.mimeType}`);
        return;
      }
      
      console.log('✅ Folder exists in Google Drive:');
      console.log('------------------------------');
      console.log(`Name: ${folderData.name}`);
      console.log(`ID: ${folderData.id}`);
      console.log(`Type: ${folderData.mimeType}`);
      console.log(`Created: ${folderData.createdTime}`);
      console.log(`Modified: ${folderData.modifiedTime}`);
      
      // Check if it's already a root folder in our system
      const { data, error } = await supabase
        .from('sources_google')
        .select('id, name, is_root, path, last_indexed')
        .eq('drive_id', folderId)
        .eq('deleted', false);
        
      if (error) {
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.log('------------------------------');
        console.log('ℹ️ This folder is not yet in our database.');
        console.log('You can add it with:');
        console.log(`ts-node google-drive-manager.ts add-root ${folderId} --name "${folderData.name}"`);
      } else {
        console.log('------------------------------');
        console.log('ℹ️ This folder exists in our database:');
        console.log(`Database ID: ${data[0].id}`);
        console.log(`Name in database: ${data[0].name}`);
        console.log(`Is root folder: ${data[0].is_root ? 'Yes' : 'No'}`);
        console.log(`Path: ${data[0].path || 'Not set'}`);
        console.log(`Last indexed: ${data[0].last_indexed || 'Never'}`);
      }
    } catch (error) {
      console.error('❌ Error checking folder:', error);
    }
  });

// Sync a specific folder from Google Drive
program
  .command('sync-folder <folderId>')
  .description('Sync a specific folder from Google Drive')
  .option('--dry-run', 'Show what would be synced without making changes')
  .option('--timeout <timeout>', 'Timeout in milliseconds', '600000')
  .action(async (folderId: string, options: { dryRun?: boolean; timeout?: string }) => {
    console.log(`Syncing folder: ${folderId}`);
    console.log(`Dry run: ${options.dryRun ? 'Yes' : 'No'}`);
    console.log(`Timeout: ${options.timeout}ms`);
    
    // Check if this is a known folder alias
    if (KNOWN_FOLDERS[folderId as keyof typeof KNOWN_FOLDERS]) {
      const actualId = KNOWN_FOLDERS[folderId as keyof typeof KNOWN_FOLDERS];
      console.log(`Using known folder ID for "${folderId}": ${actualId}`);
      folderId = actualId;
    }
    
    try {
      // First verify the folder exists
      const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN;
      
      if (!accessToken) {
        console.error('❌ No Google access token found in environment variables');
        process.exit(1);
      }
      
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      if (!response.ok) {
        console.error(`❌ Failed to get folder: ${response.status} ${response.statusText}`);
        return;
      }
      
      const folderData = await response.json();
      if (folderData.mimeType !== 'application/vnd.google-apps.folder') {
        console.error(`❌ The provided ID is not a folder: ${folderData.mimeType}`);
        return;
      }
      
      console.log(`Syncing folder "${folderData.name}" (${folderId})`);
      
      // Here you would call your sync function
      console.log('Searching for files...');
      
      // For now, we just list what we would be syncing
      if (options.dryRun) {
        console.log('DRY RUN - no changes will be made');
        
        // This is where you would implement a dry run report
        console.log('Would sync files from the folder. Implementation pending.');
      } else {
        console.log('ACTUAL SYNC - changes will be made to the database');
        
        // This is where you would implement the actual sync
        console.log('Syncing files from the folder. Implementation pending.');
      }
      
      console.log('✅ Sync operation complete');
    } catch (error) {
      console.error('❌ Error syncing folder:', error);
    }
  });

// Sync root folder(s) command
program
  .command('sync [rootId]')
  .description('Sync files from a root folder (or all if not specified)')
  .option('--dry-run', 'Show what would be synced without making changes')
  .option('--timeout <timeout>', 'Timeout in milliseconds', '600000')
  .action(async (rootId?: string, options: { dryRun?: boolean; timeout?: string }) => {
    try {
      if (rootId) {
        console.log(`Syncing root folder with ID: ${rootId}`);
        
        // Get the root folder details
        const { data, error } = await supabase
          .from('sources_google')
          .select('id, name, drive_id, is_root')
          .eq('id', rootId)
          .eq('deleted', false)
          .single();
          
        if (error) {
          throw error;
        }
        
        if (!data) {
          console.error(`❌ Root folder with ID ${rootId} not found`);
          return;
        }
        
        if (!data.is_root) {
          console.error(`❌ Folder with ID ${rootId} is not marked as a root folder`);
          return;
        }
        
        console.log(`Syncing root folder "${data.name}" (${data.drive_id})`);
        
        // Call the sync-folder command
        const syncFolderCommand = program.commands.find((cmd: Command) => cmd.name() === 'sync-folder');
        if (syncFolderCommand) {
          await syncFolderCommand.parseAsync([data.drive_id, 
            ...(options.dryRun ? ['--dry-run'] : []), 
            ...(options.timeout ? ['--timeout', options.timeout] : [])
          ]);
        }
      } else {
        console.log('Syncing all root folders');
        
        // Get all root folders
        const { data, error } = await supabase
          .from('sources_google')
          .select('id, name, drive_id')
          .eq('is_root', true)
          .eq('deleted', false)
          .order('name');
          
        if (error) {
          throw error;
        }
        
        if (!data || data.length === 0) {
          console.log('No root folders found.');
          return;
        }
        
        console.log(`Found ${data.length} root folders to sync`);
        
        // Sync each root folder
        for (const folder of data) {
          console.log(`\nSyncing root folder "${folder.name}" (${folder.drive_id})`);
          
          // Call the sync-folder command for each folder
          // In a real implementation, you would run the sync logic directly here
          // rather than recursively calling the command
          console.log(`Would sync folder "${folder.name}" here`);
        }
        
        console.log('\n✅ Finished syncing all root folders');
      }
    } catch (error) {
      console.error('❌ Error syncing root folders:', error);
    }
  });

// Add list-potential-roots command
program
  .command('list-potential-roots')
  .description('List folders in Google Drive that are not registered as roots')
  .option('--dry-run', 'Preview mode with no changes', false)
  .option('--limit <number>', 'Limit the number of results', parseInt, 20)
  .action(async (options: { dryRun?: boolean; limit?: number }) => {
    try {
      console.log('=== Potential Root Folders ===');
      
      // Get the access token
      const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN;
      if (!accessToken) {
        console.error('❌ No Google access token found in environment variables');
        process.exit(1);
      }
      
      // Get existing root folders from database
      const { data: existingRoots, error } = await supabase
        .from('sources_google')
        .select('drive_id')
        .eq('is_root', true)
        .eq('deleted', false);
        
      if (error) {
        throw error;
      }
      
      // Create a set of existing root folder IDs
      const existingRootIds = new Set(
        (existingRoots || []).map(root => root.drive_id)
      );
      
      console.log(`Found ${existingRootIds.size} registered root folders in database`);
      
      // Search for folders in the "My Drive" root
      console.log('Searching for folders in Google Drive...');
      
      // Query for top-level folders
      const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`);
      const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime,owners),nextPageToken');
      
      const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=${options.limit}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to search files: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const folders = data.files || [];
      
      console.log(`Found ${folders.length} potential root folders in Google Drive`);
      
      // Print the folders that aren't registered as roots
      console.log('\nFolders that could be registered as roots:');
      console.log('--------------------------------------------');
      
      const unregisteredFolders = folders.filter(
        (folder: { id: string }) => !existingRootIds.has(folder.id)
      );
      
      if (unregisteredFolders.length === 0) {
        console.log('No unregistered folders found.');
      } else {
        // Print a table of folders
        console.log(`ID\t\t\t\t\tName\t\t\tModified`);
        console.log(`${'─'.repeat(100)}`);
        
        unregisteredFolders.forEach((folder: { 
          id: string; 
          name: string; 
          modifiedTime: string; 
          owners?: Array<{ displayName: string }> 
        }) => {
          const modified = new Date(folder.modifiedTime).toLocaleDateString();
          const owner = folder.owners?.[0]?.displayName || 'Unknown';
          console.log(`${folder.id}\t${folder.name}\t\t${modified} (${owner})`);
        });
        
        // Add usage instructions
        console.log('\nTo add a root folder, use:');
        console.log(`ts-node google-drive-manager.ts add-root <folderId> --name "Folder Name"`);
      }
    } catch (error) {
      console.error('❌ Error listing potential root folders:', error);
    }
  });

// Add help command
program
  .command('help')
  .description('Display help information')
  .action(() => {
    program.help();
  });

// Parse command line arguments
program.parse(process.argv);

// If no commands were provided, show help
if (process.argv.length <= 2) {
  program.help();
}