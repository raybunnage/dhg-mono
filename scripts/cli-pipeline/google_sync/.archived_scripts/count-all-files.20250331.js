#!/usr/bin/env node
/**
 * Count All Files in Database
 * 
 * This script counts and summarizes all Google Drive files in the database
 * 
 * Usage:
 *   node tmp/count-all-files.js
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
 * Count all files in the database
 */
async function countAllFiles() {
  try {
    // Get all records
    const { data: allRecords, error } = await supabase
      .from('google_sources')
      .select('*');
    
    if (error) {
      throw error;
    }
    
    // Count by status
    const activeRecords = allRecords.filter(r => !r.deleted);
    const deletedRecords = allRecords.filter(r => r.deleted);
    
    console.log('=== Google Drive Files Summary ===');
    console.log(`Total records: ${allRecords.length}`);
    console.log(`Active records: ${activeRecords.length}`);
    console.log(`Deleted records: ${deletedRecords.length}`);
    
    // Count by mime type
    const mimeTypeCounts = {};
    activeRecords.forEach(record => {
      const type = record.mime_type || 'unknown';
      mimeTypeCounts[type] = (mimeTypeCounts[type] || 0) + 1;
    });
    
    console.log('\nFile types:');
    Object.entries(mimeTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`- ${type}: ${count} files`);
      });
    
    // Count by root folder
    const rootFolders = activeRecords.filter(r => r.is_root);
    
    console.log(`\nRoot folders: ${rootFolders.length}`);
    rootFolders.forEach(folder => {
      console.log(`- ${folder.name} (${folder.drive_id})`);
      
      // Count files for this root folder
      const folderFiles = activeRecords.filter(r => 
        r.drive_id === folder.drive_id || 
        r.parent_folder_id === folder.drive_id
      );
      
      // Now check which folder has most files overall (recursive)
      const pathPrefix = folder.path || `/${folder.name}`;
      const allFolderFiles = activeRecords.filter(r => 
        (r.path && r.path.startsWith(pathPrefix)) || 
        r.drive_id === folder.drive_id
      );
      
      console.log(`  Direct files: ${folderFiles.length}`);
      console.log(`  All files: ${allFolderFiles.length}`);
    });
    
    // Check for orphaned records
    const orphanedRecords = activeRecords.filter(record => {
      // No path and no parent
      return (!record.path || record.path === '/') && 
             !record.parent_folder_id && 
             !record.is_root;
    });
    
    if (orphanedRecords.length > 0) {
      console.log(`\nOrphaned records: ${orphanedRecords.length}`);
      
      // Show some examples
      orphanedRecords.slice(0, 5).forEach((record, index) => {
        console.log(`${index + 1}. ${record.name} (${record.mime_type || 'unknown'})`);
        console.log(`   ID: ${record.id}`);
        console.log(`   Drive ID: ${record.drive_id}`);
        console.log(`   Path: ${record.path || '/'}`);
        console.log(`   Parent folder ID: ${record.parent_folder_id || 'None'}`);
      });
      
      if (orphanedRecords.length > 5) {
        console.log(`... and ${orphanedRecords.length - 5} more orphaned records`);
      }
    }
    
    console.log('\n=== Summary Complete ===');
  } catch (error) {
    console.error('Error counting files:', error);
  }
}

// Run the count
countAllFiles().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});