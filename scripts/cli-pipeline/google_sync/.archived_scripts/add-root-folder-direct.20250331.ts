#!/usr/bin/env ts-node
/**
 * Add Google Drive Root Folder - Direct Method
 * 
 * This script adds a new Google Drive folder as a root folder in the database
 * without validating the folder in Google Drive first.
 * 
 * Usage:
 *   npx ts-node tmp/add-root-folder-direct.ts <folderId> --name "Folder Name" [--description "Optional description"]
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });

// Process command line arguments
const args = process.argv.slice(2);
const folderId = args[0];
const nameIndex = args.indexOf('--name');
const name = nameIndex !== -1 && args[nameIndex + 1] ? args[nameIndex + 1] : undefined;
const descIndex = args.indexOf('--description');
const description = descIndex !== -1 && args[descIndex + 1] ? args[descIndex + 1] : undefined;

if (!folderId) {
  console.error('❌ Folder ID is required');
  console.log('Usage: npx ts-node tmp/add-root-folder-direct.ts <folderId> --name "Folder Name" [--description "Description"]');
  process.exit(1);
}

if (!name) {
  console.error('❌ Folder name is required with --name parameter');
  console.log('Usage: npx ts-node tmp/add-root-folder-direct.ts <folderId> --name "Folder Name" [--description "Description"]');
  process.exit(1);
}

async function main() {
  try {
    // Ensure Supabase credentials are available
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase URL or key not found in environment variables');
      process.exit(1);
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log(`🔍 Setting up root folder with ID: ${folderId} and name: ${name}`);
    
    // Check if folder already exists in the database
    const { data: existingFolders, error: queryError } = await supabase
      .from('google_sources')
      .select('id, drive_id, name')
      .eq('drive_id', folderId)
      .eq('deleted', false);
      
    if (queryError) {
      throw queryError;
    }
    
    // If folder exists, update it
    if (existingFolders && existingFolders.length > 0) {
      console.log(`Folder already exists with name "${existingFolders[0].name}", updating...`);
      
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('google_sources')
        .update({
          name: name,
          is_root: true,
          path: `/${name}`,
          parent_path: null,
          parent_folder_id: null,
          metadata: JSON.stringify({ 
            description: description || null,
            isRootFolder: true,
            lastUpdated: now
          }),
          updated_at: now
        })
        .eq('drive_id', folderId)
        .select();
        
      if (error) {
        throw error;
      }
      
      console.log(`✅ Updated root folder: ${name}`);
      return;
    }
    
    // Insert new root folder
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('google_sources')
      .insert({
        drive_id: folderId,
        name: name,
        is_root: true,
        mime_type: 'application/vnd.google-apps.folder',
        path: `/${name}`,
        parent_path: null,
        parent_folder_id: null,
        metadata: JSON.stringify({ 
          description: description || null,
          isRootFolder: true,
          createdAt: now
        }),
        created_at: now,
        updated_at: now,
        deleted: false
      })
      .select();
      
    if (error) {
      throw error;
    }
    
    console.log(`✅ Added new root folder: ${name} with database ID: ${data[0].id}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Execute the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});