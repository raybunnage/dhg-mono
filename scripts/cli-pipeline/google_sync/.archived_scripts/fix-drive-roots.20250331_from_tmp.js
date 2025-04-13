#!/usr/bin/env node
/**
 * Fix Drive Root Folders
 * 
 * This script fixes issues with the Polyvagal Steering and Dynamic Healing Group root folders:
 * 1. Marks the Polyvagal Steering folder as a root folder
 * 2. Corrects the paths for both folders
 * 3. Fixes parent-child relationships
 * 
 * Usage:
 *   node tmp/fix-drive-roots.js [--dry-run]
 * 
 * Options:
 *   --dry-run   Show what would be changed without making changes
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
function loadEnvFiles() {
  const envFiles = ['.env', '.env.development', '.env.local'];
  
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath });
    }
  }
}

loadEnvFiles();

// Process command-line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// Root folder IDs
const POLYVAGAL_FOLDER_ID = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc';
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Ensure Supabase credentials are available
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL or key not found in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Get folder details from Google Drive
 */
async function getFolderInfo(folderId) {
  try {
    // Get Google access token
    const accessToken = process.env.VITE_GOOGLE_ACCESS_TOKEN;
    
    if (!accessToken) {
      throw new Error('No Google access token found in environment variables');
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
      throw new Error(`Failed to get folder: ${response.status} ${response.statusText}`);
    }
    
    const folderData = await response.json();
    
    if (folderData.mimeType !== 'application/vnd.google-apps.folder') {
      throw new Error(`The provided ID is not a folder: ${folderData.mimeType}`);
    }
    
    return { 
      id: folderData.id,
      name: folderData.name,
      mimeType: folderData.mimeType
    };
  } catch (error) {
    console.error(`Error getting folder info: ${error.message}`);
    return null;
  }
}

/**
 * Fix the Polyvagal folder to be a root folder
 */
async function fixPolyvagalFolder() {
  console.log('=== Fixing Polyvagal Steering Folder ===');
  
  try {
    // Get current folder record
    const { data: folder, error: folderError } = await supabase
      .from('sources_google')
      .select('*')
      .eq('drive_id', POLYVAGAL_FOLDER_ID)
      .single();
    
    if (folderError) {
      throw folderError;
    }
    
    console.log('Current folder state:');
    console.log(`- Name: ${folder.name}`);
    console.log(`- Is Root: ${folder.is_root ? 'Yes' : 'No'}`);
    console.log(`- Path: ${folder.path || '/'}`);
    console.log(`- Parent Folder ID: ${folder.parent_folder_id || 'None'}`);
    
    // Get actual folder name from Google Drive
    const folderInfo = await getFolderInfo(POLYVAGAL_FOLDER_ID);
    
    if (!folderInfo) {
      throw new Error('Could not get folder information from Google Drive');
    }
    
    console.log(`\nGoogle Drive folder name: "${folderInfo.name}"`);
    
    // Update the folder to be a root
    const updates = {
      name: folderInfo.name,
      is_root: true,
      path: `/${folderInfo.name}`,
      parent_path: null,
      parent_folder_id: null,
      updated_at: new Date().toISOString()
    };
    
    console.log('\nChanges to make:');
    console.log(`- Name: ${folder.name} -> ${updates.name}`);
    console.log(`- Is Root: ${folder.is_root} -> ${updates.is_root}`);
    console.log(`- Path: ${folder.path || '/'} -> ${updates.path}`);
    console.log(`- Parent Folder ID: ${folder.parent_folder_id || 'None'} -> ${updates.parent_folder_id}`);
    
    if (isDryRun) {
      console.log('\nDRY RUN: Would update the Polyvagal folder');
    } else {
      const { error: updateError } = await supabase
        .from('sources_google')
        .update(updates)
        .eq('id', folder.id);
      
      if (updateError) {
        throw updateError;
      }
      
      console.log('\n✅ Successfully updated Polyvagal folder');
    }
    
    return folderInfo;
  } catch (error) {
    console.error(`Error fixing Polyvagal folder: ${error.message}`);
    return null;
  }
}

/**
 * Get all records related to a folder
 */
async function getRelatedRecords(folderId) {
  try {
    const { data, error } = await supabase
      .from('sources_google')
      .select('*')
      .or(`drive_id.eq.${folderId},parent_folder_id.eq.${folderId}`);
    
    if (error) {
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error(`Error getting related records: ${error.message}`);
    return [];
  }
}

/**
 * Fix paths for all child records
 */
async function fixChildPaths(rootFolderId, rootFolderName) {
  console.log(`\n=== Fixing Paths for ${rootFolderName} ===`);
  
  try {
    // Get all related records
    const records = await getRelatedRecords(rootFolderId);
    const children = records.filter(r => r.parent_folder_id === rootFolderId);
    
    console.log(`Found ${children.length} direct children of ${rootFolderName}`);
    
    // Records that need path updates
    const recordsToUpdate = children.filter(record => {
      // Root folder should have path = /RootName
      if (record.drive_id === rootFolderId) {
        return record.path !== `/${rootFolderName}`;
      }
      
      // Children should have parent_path = /RootName
      return record.parent_path !== `/${rootFolderName}`;
    });
    
    console.log(`Found ${recordsToUpdate.length} records with incorrect paths`);
    
    if (recordsToUpdate.length === 0) {
      console.log('No path updates needed');
      return;
    }
    
    // Update each record
    for (const record of recordsToUpdate) {
      // Calculate correct paths
      const correctParentPath = `/${rootFolderName}`;
      const correctPath = `${correctParentPath}/${record.name}`;
      
      const updates = {
        parent_path: correctParentPath,
        path: correctPath,
        updated_at: new Date().toISOString()
      };
      
      console.log(`\nUpdating: ${record.name}`);
      console.log(`- Path: ${record.path || '/'} -> ${updates.path}`);
      console.log(`- Parent Path: ${record.parent_path || '/'} -> ${updates.parent_path}`);
      
      if (isDryRun) {
        console.log('DRY RUN: Would update path');
      } else {
        const { error } = await supabase
          .from('sources_google')
          .update(updates)
          .eq('id', record.id);
        
        if (error) {
          console.error(`Error updating record ${record.id}: ${error.message}`);
        }
      }
    }
    
    if (!isDryRun) {
      console.log('\n✅ Successfully updated paths');
    }
  } catch (error) {
    console.error(`Error fixing child paths: ${error.message}`);
  }
}

/**
 * Verify all records have valid parent-child relationships
 */
async function verifyParentChildRelationships() {
  console.log('\n=== Verifying Parent-Child Relationships ===');
  
  try {
    // Get all records
    const { data: allRecords, error } = await supabase
      .from('sources_google')
      .select('*');
    
    if (error) {
      throw error;
    }
    
    // Build a map of drive_id to record
    const recordMap = {};
    allRecords.forEach(record => {
      recordMap[record.drive_id] = record;
    });
    
    // Find records with missing parents
    const missingParents = allRecords.filter(record => {
      if (!record.parent_folder_id) return false;
      return !recordMap[record.parent_folder_id];
    });
    
    console.log(`Found ${missingParents.length} records with missing parent references`);
    
    if (missingParents.length === 0) {
      console.log('No missing parent references to fix');
      return;
    }
    
    // Fix missing parent references
    for (const record of missingParents) {
      console.log(`\nFixing record: ${record.name}`);
      console.log(`- Current Parent ID: ${record.parent_folder_id}`);
      
      if (isDryRun) {
        console.log('DRY RUN: Would set parent_folder_id to null');
      } else {
        const { error } = await supabase
          .from('sources_google')
          .update({
            parent_folder_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id);
        
        if (error) {
          console.error(`Error updating record ${record.id}: ${error.message}`);
        }
      }
    }
    
    if (!isDryRun) {
      console.log('\n✅ Successfully fixed parent references');
    }
  } catch (error) {
    console.error(`Error verifying relationships: ${error.message}`);
  }
}

/**
 * Main function
 */
async function fixDriveRoots() {
  console.log('=== Fixing Drive Root Folders ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  // 1. Fix the Polyvagal folder
  const polyvagalInfo = await fixPolyvagalFolder();
  
  // 2. Fix parent-child relationships
  await verifyParentChildRelationships();
  
  // 3. Fix paths for Polyvagal folder children
  if (polyvagalInfo) {
    await fixChildPaths(POLYVAGAL_FOLDER_ID, polyvagalInfo.name);
  }
  
  // 4. Fix paths for Dynamic Healing folder children
  const dynamicHealingInfo = await getFolderInfo(DYNAMIC_HEALING_FOLDER_ID);
  if (dynamicHealingInfo) {
    await fixChildPaths(DYNAMIC_HEALING_FOLDER_ID, dynamicHealingInfo.name);
  }
  
  console.log('\n=== Fix Complete ===');
}

// Run the fix
fixDriveRoots().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});