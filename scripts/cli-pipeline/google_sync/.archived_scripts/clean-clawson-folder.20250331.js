#!/usr/bin/env node
/**
 * Clean Dr. Clawson Papers Folder
 * 
 * This script cleans files associated with Dr. Clawson's papers folder,
 * marking them as deleted in the database instead of removing them entirely.
 * The root folder itself is preserved for future use.
 * 
 * Usage:
 *   node tmp/clean-clawson-folder.js [--dry-run] [--verbose] [--permanent-delete]
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
      console.log(`Loading environment from ${file}`);
      dotenv.config({ path: filePath });
    }
  }
}

loadEnvFiles();

// Process command-line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const permanentDelete = args.includes('--permanent-delete');

// Dr. Clawson folder ID
const CLAWSON_FOLDER_ID = '1lLO4dx_V3XhJSb4btA-hH15yxlPhllY2';

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
 * Get files associated with the folder
 */
async function getAssociatedFiles(folderId) {
  try {
    // Get count first
    const { count, error: countError } = await supabase
      .from('sources_google')
      .select('id', { count: 'exact' })
      .or(`parent_folder_id.eq.${folderId},drive_id.eq.${folderId}`)
      .eq('deleted', false);
      
    if (countError) throw countError;
    
    console.log(`Found ${count} records associated with this folder`);
    
    // Then get the actual records
    const { data, error } = await supabase
      .from('sources_google')
      .select('id, drive_id, name, mime_type, path, parent_folder_id')
      .or(`parent_folder_id.eq.${folderId},drive_id.eq.${folderId}`)
      .eq('deleted', false);
      
    if (error) throw error;
    
    // Group by type for reporting
    const filesByType = {};
    data.forEach(file => {
      const type = file.mime_type || 'unknown';
      filesByType[type] = (filesByType[type] || 0) + 1;
    });
    
    // Count folders vs files
    const folders = data.filter(file => file.mime_type === 'application/vnd.google-apps.folder');
    const files = data.filter(file => file.mime_type !== 'application/vnd.google-apps.folder');
    
    // Report
    console.log(`\nFile types:`);
    Object.entries(filesByType).forEach(([type, count]) => {
      console.log(`- ${type}: ${count} files`);
    });
    
    console.log(`\nFolders: ${folders.length}`);
    console.log(`Files: ${files.length}`);
    
    return data;
  } catch (error) {
    console.error('Error fetching files:', error);
    return [];
  }
}

/**
 * Clean files associated with the folder
 */
async function cleanFolder(folderId, options = {}) {
  const { dryRun = true, verbose = false, permanent = false } = options;
  
  console.log(`=== Cleaning Dr. Clawson's Papers Folder ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'ACTUAL CLEAN'}`);
  console.log(`Action: ${permanent ? 'PERMANENTLY DELETE' : 'MARK AS DELETED'}`);
  console.log(`Folder ID: ${folderId}`);
  console.log('===========================================');
  
  try {
    // Get folder information
    const { data: folder, error: folderError } = await supabase
      .from('sources_google')
      .select('*')
      .eq('drive_id', folderId)
      .single();
      
    if (folderError) {
      console.error('Error fetching folder:', folderError);
      return;
    }
    
    console.log(`Folder: ${folder.name} (${folder.drive_id})`);
    console.log(`Path: ${folder.path || '/'}`);
    
    // Safety check - don't delete the root folder
    const rootFolder = folder;
    
    // Get all files associated with this folder
    const files = await getAssociatedFiles(folderId);
    
    if (files.length === 0) {
      console.log('No files found to clean');
      return;
    }
    
    // Filter out the root folder itself - we want to keep it
    const filesToClean = files.filter(file => file.id !== rootFolder.id);
    
    console.log(`\nFound ${filesToClean.length} files/folders to clean`);
    
    if (dryRun) {
      console.log(`DRY RUN: Would ${permanent ? 'permanently delete' : 'mark as deleted'} ${filesToClean.length} files`);
      
      // In dry run mode, display some of the files that would be affected
      if (verbose && filesToClean.length > 0) {
        console.log('\nSample of files that would be affected:');
        filesToClean.slice(0, Math.min(10, filesToClean.length)).forEach((file, index) => {
          console.log(`${index + 1}. ${file.name} (${file.mime_type})`);
          console.log(`   Path: ${file.path || '/'}`);
          console.log(`   ID: ${file.id}`);
          console.log(`   Drive ID: ${file.drive_id}`);
        });
        
        if (filesToClean.length > 10) {
          console.log(`...and ${filesToClean.length - 10} more files`);
        }
      }
      
      return;
    }
    
    // Perform the actual clean operation in batches
    const batchSize = 50;
    const batches = Math.ceil(filesToClean.length / batchSize);
    
    console.log(`Processing ${filesToClean.length} files in ${batches} batches of ${batchSize}`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, filesToClean.length);
      const batch = filesToClean.slice(start, end);
      
      console.log(`Processing batch ${i + 1}/${batches} (${batch.length} files)`);
      
      try {
        if (permanent) {
          // Permanently delete records
          const { data, error } = await supabase
            .from('sources_google')
            .delete()
            .in('id', batch.map(file => file.id));
            
          if (error) throw error;
          
          processedCount += batch.length;
          console.log(`Permanently deleted ${batch.length} files in batch ${i + 1}`);
        } else {
          // Mark records as deleted
          const { data, error } = await supabase
            .from('sources_google')
            .update({ 
              deleted: true, 
              updated_at: new Date().toISOString() 
            })
            .in('id', batch.map(file => file.id));
            
          if (error) throw error;
          
          processedCount += batch.length;
          console.log(`Marked ${batch.length} files as deleted in batch ${i + 1}`);
        }
      } catch (error) {
        console.error(`Error processing batch ${i + 1}:`, error);
        errorCount += batch.length;
      }
      
      // Update progress
      const progress = Math.min(100, Math.round(((i + 1) * batchSize / filesToClean.length) * 100));
      process.stdout.write(`\rProgress: ${Math.min(processedCount + errorCount, filesToClean.length)}/${filesToClean.length} (${progress}%)`);
    }
    
    console.log('\n\n=== Clean Summary ===');
    console.log(`Files processed: ${processedCount}`);
    console.log(`Files with errors: ${errorCount}`);
    console.log(`Total files: ${filesToClean.length}`);
    console.log(`Action: ${permanent ? 'Permanently deleted' : 'Marked as deleted'}`);
    
    console.log('\n✅ Clean operation complete!');
  } catch (error) {
    console.error('Error cleaning folder:', error);
  }
}

// Execute the clean function
cleanFolder(CLAWSON_FOLDER_ID, {
  dryRun: isDryRun,
  verbose: isVerbose,
  permanent: permanentDelete
});