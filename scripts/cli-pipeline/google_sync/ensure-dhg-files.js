#!/usr/bin/env node

/**
 * Ensure Dynamic Healing Discussion Group Files Script
 * 
 * This script ensures all DHG files from transcripts directory are correctly
 * represented in sources_google table with proper metadata.
 */

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Define the DHG root folder ID
const DHG_ROOT_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';
const DHG_ROOT_NAME = 'Dynamic Healing Discussion Group';

// Define file directory paths
const TRANSCRIPT_DIR = path.join(process.cwd(), 'file_types', 'transcripts');
const AUDIO_DIR = path.join(process.cwd(), 'file_types', 'm4a');
const VIDEO_DIR = path.join(process.cwd(), 'file_types', 'mp4');

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const forceUpdate = args.includes('--force');
const batchSize = 50; // Insert in smaller batches to prevent issues

async function getExistingRecords(supabase) {
  try {
    const { data, error } = await supabase
      .from('sources_google')
      .select('id, name, drive_id, path')
      .eq('root_drive_id', DHG_ROOT_ID);
    
    if (error) {
      throw new Error(`Failed to get existing records: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error('Error getting existing records:', error.message);
    return [];
  }
}

function getFilesFromDirectory(directory, mimeType) {
  try {
    if (!fs.existsSync(directory)) {
      console.log(`Directory ${directory} does not exist`);
      return [];
    }
    
    // Read all files in the directory
    const files = fs.readdirSync(directory);
    console.log(`Found ${files.length} files in ${directory}`);
    
    // Transform into records with correct DHG paths
    return files.map(filename => {
      // Generate a consistent drive ID based on the filename
      const baseID = require('crypto')
        .createHash('md5')
        .update(filename)
        .digest('hex')
        .substring(0, 16);
      
      // Create a full record
      return {
        id: uuidv4(),
        name: filename,
        drive_id: `dhg_file_${baseID}`,
        root_drive_id: DHG_ROOT_ID,
        parent_folder_id: DHG_ROOT_ID, // Parent is the root folder
        path: `/${DHG_ROOT_NAME}/${filename}`,
        is_root: false,
        path_array: [DHG_ROOT_NAME, filename],
        path_depth: 2,
        is_deleted: false,
        mime_type: mimeType,
        metadata: { source: 'file_directory', automated: true, directory_name: path.basename(directory) },
        size: fs.statSync(path.join(directory, filename)).size,
        modified_time: new Date(fs.statSync(path.join(directory, filename)).mtime).toISOString(),
        content_extracted: mimeType === 'text/plain', // Only text files are considered extracted
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error(`Error getting files from ${directory}:`, error.message);
    return [];
  }
}

function getFilelistFromAllDirectories() {
  // Get transcript files
  const transcriptFiles = getFilesFromDirectory(TRANSCRIPT_DIR, 'text/plain')
    .filter(file => file.name.endsWith('_transcript.txt') || file.name.includes('transcript'));
  
  // Get audio files
  const audioFiles = getFilesFromDirectory(AUDIO_DIR, 'audio/m4a');
  
  // Get video files
  const videoFiles = getFilesFromDirectory(VIDEO_DIR, 'video/mp4');
  
  // Combine all files
  const allFiles = [...transcriptFiles, ...audioFiles, ...videoFiles];
  console.log(`Total files: ${allFiles.length} (${transcriptFiles.length} transcripts, ${audioFiles.length} audio, ${videoFiles.length} video)`);
  
  return allFiles;
}

async function insertBatch(supabase, records) {
  if (records.length === 0) return { success: true, count: 0 };
  
  try {
    const { data, error } = await supabase
      .from('sources_google')
      .upsert(records, { onConflict: 'drive_id' });
    
    if (error) {
      throw new Error(`Failed to insert batch: ${error.message}`);
    }
    
    return { success: true, count: records.length };
  } catch (error) {
    console.error('Error inserting batch:', error.message);
    return { success: false, error };
  }
}

async function main() {
  try {
    console.log('Ensuring Dynamic Healing Discussion Group files in sources_google...');
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE RUN'}`);
    
    // Get Supabase client using the singleton service
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Step 1: Check if sources_google exists
    console.log('\nSTEP 1: Checking sources_google table...');
    
    let tableExists = false;
    try {
      const { count, error } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        tableExists = true;
        console.log(`- sources_google exists with ${count} records`);
      }
    } catch (error) {
      console.log('- sources_google does not exist or is not accessible');
    }
    
    if (!tableExists) {
      console.error('sources_google table does not exist. Please create it first.');
      process.exit(1);
    }
    
    // Step 2: Get existing records
    console.log('\nSTEP 2: Getting existing DHG records from sources_google...');
    const existingRecords = await getExistingRecords(supabase);
    console.log(`- Found ${existingRecords.length} existing DHG records`);
    
    // Step 3: Get all files list
    console.log('\nSTEP 3: Getting files from filesystem...');
    const fileRecords = getFilelistFromAllDirectories();
    
    if (fileRecords.length === 0) {
      console.error('No transcript files found. Check the transcript directory path.');
      process.exit(1);
    }
    
    // Step 4: Determine which files to add or update
    console.log('\nSTEP 4: Comparing records...');
    
    // Create a map of existing file paths for quick lookup
    const existingFilePaths = new Map(
      existingRecords.map(record => [record.path?.toLowerCase(), record])
    );
    
    // Split files into new and existing
    const newFiles = [];
    const updatedFiles = [];
    
    for (const file of fileRecords) {
      const existingFile = existingFilePaths.get(file.path?.toLowerCase());
      
      if (!existingFile) {
        newFiles.push(file);
      } else if (forceUpdate) {
        // Preserve the original ID
        file.id = existingFile.id;
        updatedFiles.push(file);
      }
    }
    
    console.log(`- Files to add: ${newFiles.length}`);
    console.log(`- Files to update: ${updatedFiles.length}`);
    
    // Step 5: Insert/update records
    if (isDryRun) {
      console.log('\nDRY RUN - Would add/update the following files:');
      console.log('New files:');
      for (let i = 0; i < Math.min(10, newFiles.length); i++) {
        console.log(`- ${newFiles[i].path}`);
      }
      if (newFiles.length > 10) {
        console.log(`  ... and ${newFiles.length - 10} more`);
      }
      
      console.log('Updated files:');
      for (let i = 0; i < Math.min(10, updatedFiles.length); i++) {
        console.log(`- ${updatedFiles[i].path}`);
      }
      if (updatedFiles.length > 10) {
        console.log(`  ... and ${updatedFiles.length - 10} more`);
      }
    } else {
      console.log('\nSTEP 5: Inserting/updating records...');
      
      // Process in batches
      let totalAdded = 0;
      let totalUpdated = 0;
      
      // First insert new files
      for (let i = 0; i < newFiles.length; i += batchSize) {
        const batch = newFiles.slice(i, i + batchSize);
        console.log(`- Adding batch ${i / batchSize + 1} of ${Math.ceil(newFiles.length / batchSize)} (${batch.length} records)`);
        
        const result = await insertBatch(supabase, batch);
        
        if (result.success) {
          totalAdded += result.count;
        } else {
          console.warn('  Warning: Batch insertion had errors. Continuing with next batch.');
        }
      }
      
      // Then update existing files
      for (let i = 0; i < updatedFiles.length; i += batchSize) {
        const batch = updatedFiles.slice(i, i + batchSize);
        console.log(`- Updating batch ${i / batchSize + 1} of ${Math.ceil(updatedFiles.length / batchSize)} (${batch.length} records)`);
        
        const result = await insertBatch(supabase, batch);
        
        if (result.success) {
          totalUpdated += result.count;
        } else {
          console.warn('  Warning: Batch update had errors. Continuing with next batch.');
        }
      }
      
      console.log(`\nAdded ${totalAdded} new files`);
      console.log(`Updated ${totalUpdated} existing files`);
    }
    
    // Step 6: Verify the results
    if (!isDryRun) {
      console.log('\nSTEP 6: Verifying results...');
      
      const finalRecords = await getExistingRecords(supabase);
      console.log(`- Final DHG record count: ${finalRecords.length}`);
      
      const expectedTotal = existingRecords.length + newFiles.length;
      
      if (finalRecords.length >= expectedTotal) {
        console.log('\nSUCCESS: All files have been added to sources_google');
      } else {
        console.warn(`\nWARNING: Expected at least ${expectedTotal} records, but found ${finalRecords.length}`);
        console.warn('Some files may not have been added correctly.');
      }
    }
    
    console.log('\nOperation completed!');
    
  } catch (error) {
    console.error('Error during operation:', error);
    process.exit(1);
  }
}

main();