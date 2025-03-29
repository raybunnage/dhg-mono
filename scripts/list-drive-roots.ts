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

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';

// Load environment variables
dotenv.config();

// Process command line arguments
const args = process.argv.slice(2);
const showPotential = args.includes('--potential');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 && args[limitIndex + 1] 
  ? parseInt(args[limitIndex + 1]) 
  : 20;

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
 * Main function
 */
async function listRoots(): Promise<void> {
  try {
    console.log('=== Google Drive Root Folders ===\n');
    
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
      console.log('No registered root folders found in the database.');
    } else {
      console.log(`Found ${rootFolders.length} registered root folders:`);
      console.log('--------------------------------------------------------');
      console.log('ID\t\tDrive ID\t\t\t\tName\t\tLast Updated');
      console.log('--------------------------------------------------------');
      
      rootFolders.forEach(folder => {
        const updated = new Date(folder.updated_at).toLocaleDateString();
        console.log(`${folder.id}\t${folder.drive_id}\t${folder.name}\t${updated}`);
      });
    }
    
    // If --potential flag is set, also list potential root folders
    if (showPotential) {
      await listPotentialRoots(
        rootFolders?.map(f => f.drive_id) || []
      );
    }
  } catch (error) {
    console.error('❌ Error listing root folders:', error);
  }
}

/**
 * List potential root folders (top-level folders in Google Drive)
 */
async function listPotentialRoots(existingRootIds: string[]): Promise<void> {
  try {
    console.log('\n=== Potential Root Folders ===\n');
    
    // Get the access token
    const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('❌ No Google access token found in environment variables');
      return;
    }
    
    // Create a set of existing root folder IDs for faster lookups
    const existingRootIdsSet = new Set(existingRootIds);
    
    // Search for folders in the "My Drive" root
    console.log('Searching for folders in Google Drive...');
    
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
    
    const data = await response.json();
    const folders = data.files || [];
    
    console.log(`Found ${folders.length} top-level folders in Google Drive`);
    
    // Print the folders that aren't registered as roots
    console.log('\nFolders that could be registered as roots:');
    console.log('--------------------------------------------------------');
    
    const unregisteredFolders = folders.filter(
      (folder: { id: string }) => !existingRootIdsSet.has(folder.id)
    );
    
    if (unregisteredFolders.length === 0) {
      console.log('No unregistered folders found.');
    } else {
      // Print a table of folders
      console.log('Drive ID\t\t\t\tName\t\t\tModified (Owner)');
      console.log('--------------------------------------------------------');
      
      unregisteredFolders.forEach((folder: { 
        id: string;
        name: string;
        modifiedTime: string;
        owners?: Array<{ displayName?: string }>;
      }) => {
        const modified = new Date(folder.modifiedTime).toLocaleDateString();
        const owner = folder.owners?.[0]?.displayName || 'Unknown';
        console.log(`${folder.id}\t${folder.name}\t\t${modified} (${owner})`);
      });
      
      // Add usage instructions
      console.log('\nTo add a root folder, use:');
      console.log('ts-node google-drive-manager.ts add-root <folderId> --name "Folder Name"');
    }
  } catch (error) {
    console.error('❌ Error listing potential root folders:', error);
  }
}

// Execute the main function
listRoots().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});