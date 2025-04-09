#!/usr/bin/env node

/**
 * Find All Dynamic Healing Discussion Group Files
 * 
 * This script systematically finds all files that belong to the DHG folder
 * using multiple matching strategies to ensure we capture all ~830 files.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Hardcode credentials from .env.development
const SUPABASE_URL = 'https://jdksnfkupzywjdfefkyj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impka3NuZmt1cHp5d2pkZmVma3lqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDE4OTAxMywiZXhwIjoyMDQ5NzY1MDEzfQ.ytwo7scGIQRoyue71Bu6W6P6vgSnLP3S3iaL6BoRP_E';

// Target root folder ID and name
const DHG_ROOT_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';
const DHG_ROOT_NAME = 'Dynamic Healing Discussion Group';

// Local file paths for matching
const TRANSCRIPT_DIR = path.join(process.cwd(), 'file_types', 'transcripts');
const AUDIO_DIR = path.join(process.cwd(), 'file_types', 'm4a');
const VIDEO_DIR = path.join(process.cwd(), 'file_types', 'mp4');

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const skipCreate = args.includes('--skip-create');
const forceOverwrite = args.includes('--force');
const batchSize = 100;
const maxDepth = 6; // Increase depth to 6 to get all nested files

// Utility to get a hash of a string for consistent IDs
function getFileHash(str) {
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 16);
}

/**
 * Get all local files from filesystem to use for matching
 */
function getLocalFiles() {
  const files = [];
  
  // Get transcript files
  if (fs.existsSync(TRANSCRIPT_DIR)) {
    const transcripts = fs.readdirSync(TRANSCRIPT_DIR)
      .filter(file => file.endsWith('_transcript.txt') || file.includes('transcript'));
    console.log(`Found ${transcripts.length} transcript files`);
    files.push(...transcripts.map(f => ({ name: f, type: 'transcript' })));
  }
  
  // Get audio files
  if (fs.existsSync(AUDIO_DIR)) {
    const audioFiles = fs.readdirSync(AUDIO_DIR);
    console.log(`Found ${audioFiles.length} audio files`);
    files.push(...audioFiles.map(f => ({ name: f, type: 'audio' })));
  }
  
  // Get video files
  if (fs.existsSync(VIDEO_DIR)) {
    const videoFiles = fs.readdirSync(VIDEO_DIR);
    console.log(`Found ${videoFiles.length} video files`);
    files.push(...videoFiles.map(f => ({ name: f, type: 'video' })));
  }
  
  console.log(`Total local files: ${files.length}`);
  return files;
}

/**
 * Find all potential DHG files using multiple methods
 */
async function findAllDHGFiles(supabase) {
  // Store all DHG files by ID to prevent duplicates
  const dhgFileMap = new Map();
  
  console.log('Finding DHG files using multiple methods...');
  
  // Method 1: Find by root_drive_id
  console.log('\nMethod 1: Matching by root_drive_id...');
  const { data: rootIdFiles, error: rootIdError } = await supabase
    .from('sources_google')
    .select('*')
    .eq('root_drive_id', DHG_ROOT_ID);
  
  if (rootIdError) {
    console.error('Error fetching by root_drive_id:', rootIdError.message);
  } else {
    console.log(`Found ${rootIdFiles.length} files by root_drive_id`);
    
    // Add to map
    rootIdFiles.forEach(file => {
      dhgFileMap.set(file.id, {
        ...file,
        _match_method: 'root_drive_id'
      });
    });
  }
  
  // Method 2: Find by path containing DHG
  console.log('\nMethod 2: Matching by path...');
  const { data: pathFiles, error: pathError } = await supabase
    .from('sources_google')
    .select('*')
    .ilike('path', `%${DHG_ROOT_NAME}%`);
  
  if (pathError) {
    console.error('Error fetching by path:', pathError.message);
  } else {
    console.log(`Found ${pathFiles.length} files by path`);
    
    // Add to map if not already added
    let newFiles = 0;
    pathFiles.forEach(file => {
      if (!dhgFileMap.has(file.id)) {
        dhgFileMap.set(file.id, {
          ...file,
          _match_method: 'path'
        });
        newFiles++;
      }
    });
    
    console.log(`Added ${newFiles} new files from path matching`);
  }
  
  // Method 3: Match by name similarity with local files
  console.log('\nMethod 3: Matching by name similarity with local files...');
  const localFiles = getLocalFiles();
  
  // Get all potential files that could match (not already in dhgFileMap)
  const { data: allFiles, error: allFilesError } = await supabase
    .from('sources_google')
    .select('*');
  
  if (allFilesError) {
    console.error('Error fetching all files:', allFilesError.message);
  } else {
    console.log(`Examining ${allFiles.length} total files from sources_google`);
    
    // Simple name matching (could be enhanced with fuzzy matching)
    let nameMatchCount = 0;
    
    for (const file of allFiles) {
      // Skip if already in map
      if (dhgFileMap.has(file.id)) {
        continue;
      }
      
      // Skip if no name
      if (!file.name) {
        continue;
      }
      
      // Try to match with local files by name
      for (const localFile of localFiles) {
        // Try variations of the name
        const localName = localFile.name.toLowerCase();
        const sourceName = file.name.toLowerCase();
        
        // Check for good matches (modify as needed for your naming patterns)
        const isMatch = 
          localName === sourceName ||
          localName.includes(sourceName) ||
          sourceName.includes(localName) ||
          // Remove common suffixes/prefixes
          localName.replace('_transcript.txt', '') === sourceName.replace('.m4a', '').replace('.mp4', '') ||
          // Extract person name and date patterns
          (sourceName.match(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/) && localName.includes(sourceName.match(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/)[0]));
        
        if (isMatch) {
          dhgFileMap.set(file.id, {
            ...file,
            _match_method: 'name_match',
            _matched_with: localFile.name
          });
          nameMatchCount++;
          break; // Found a match, stop checking other local files
        }
      }
    }
    
    console.log(`Added ${nameMatchCount} new files from name matching`);
  }
  
  // Method 4: Use metadata or parent folder relationships
  console.log('\nMethod 4: Examining metadata and parent relationships...');
  let metadataMatchCount = 0;
  
  // Find files that have DHG files as parents
  const dhgFolderIds = new Set();
  dhgFileMap.forEach(file => {
    if (file.mime_type && file.mime_type.includes('folder')) {
      dhgFolderIds.add(file.drive_id);
    }
  });
  
  console.log(`Found ${dhgFolderIds.size} DHG folders to check for children`);
  
  // For each file not yet matched, check if parent_id is in dhgFolderIds
  for (const file of allFiles) {
    if (dhgFileMap.has(file.id)) {
      continue;
    }
    
    if (file.parent_id && dhgFolderIds.has(file.parent_id)) {
      dhgFileMap.set(file.id, {
        ...file,
        _match_method: 'parent_relationship',
        _parent_folder: file.parent_id
      });
      metadataMatchCount++;
    }
  }
  
  console.log(`Added ${metadataMatchCount} new files from parent relationships`);
  
  // Method 5: Find files that contain known DHG keywords in name
  console.log('\nMethod 5: Matching by DHG keywords in name...');
  const dhgKeywords = [
    'hanscom', 'clawson', 'porges', 'polyvagal', 'naviaux', 'carter', 'wager', 
    'bezruchka', 'dhdg', 'horn', 'dhg', 'healing', 'davis', 'lederman',
    'transcript', 'aria', 'patterson', 'fasting', 'inflammation', 'cells', 
    'pain', 'health', 'INGESTED', 'chronic', 'pain', 'trauma'
  ];
  
  let keywordMatchCount = 0;
  
  for (const file of allFiles) {
    // Skip if already in map
    if (dhgFileMap.has(file.id)) {
      continue;
    }
    
    // Skip if no name
    if (!file.name) {
      continue;
    }
    
    const fileName = file.name.toLowerCase();
    
    // Check for any DHG keyword
    const matchedKeyword = dhgKeywords.find(keyword => 
      fileName.includes(keyword.toLowerCase())
    );
    
    if (matchedKeyword) {
      dhgFileMap.set(file.id, {
        ...file,
        _match_method: 'keyword_match',
        _matched_keyword: matchedKeyword
      });
      keywordMatchCount++;
    }
  }
  
  console.log(`Added ${keywordMatchCount} new files from keyword matching`);
  
  // Method 6: Find neighboring files based on drive_id patterns
  console.log('\nMethod 6: Finding neighboring files by drive_id patterns...');
  
  // Extract drive_id patterns from known DHG files
  const dhgDriveIdPatterns = new Set();
  dhgFileMap.forEach(file => {
    if (file.drive_id && file.drive_id.length > 6) {
      // Get first 6 chars of drive_id which might indicate folder grouping
      dhgDriveIdPatterns.add(file.drive_id.substring(0, 6));
    }
  });
  
  console.log(`Found ${dhgDriveIdPatterns.size} drive_id patterns to check`);
  
  let driveIdMatchCount = 0;
  
  for (const file of allFiles) {
    // Skip if already in map
    if (dhgFileMap.has(file.id)) {
      continue;
    }
    
    // Skip if no drive_id
    if (!file.drive_id || file.drive_id.length < 6) {
      continue;
    }
    
    // Check if drive_id matches a DHG pattern
    const driveIdPrefix = file.drive_id.substring(0, 6);
    if (dhgDriveIdPatterns.has(driveIdPrefix)) {
      dhgFileMap.set(file.id, {
        ...file,
        _match_method: 'drive_id_pattern',
        _matched_pattern: driveIdPrefix
      });
      driveIdMatchCount++;
    }
  }
  
  console.log(`Added ${driveIdMatchCount} new files from drive_id patterns`);
  
  // Convert map to array
  const allDHGFiles = Array.from(dhgFileMap.values());
  
  // Summary of matching methods
  const methodCounts = {};
  allDHGFiles.forEach(file => {
    methodCounts[file._match_method] = (methodCounts[file._match_method] || 0) + 1;
  });
  
  console.log('\nTotal files found by method:');
  Object.entries(methodCounts).forEach(([method, count]) => {
    console.log(`- ${method}: ${count} files`);
  });
  
  console.log(`\nTotal files found: ${allDHGFiles.length}`);
  
  return allDHGFiles;
}

/**
 * Transform sources_google records into sources_google2 format
 */
function transformRecord(record) {
  // Generate a path if none exists
  let path = record.path;
  if (!path) {
    path = `/${DHG_ROOT_NAME}/${record.name || 'unnamed_file'}`;
  }
  
  // Return transformed record with enhanced path structures
  return {
    id: record.id,
    name: record.name,
    mime_type: record.mime_type,
    drive_id: record.drive_id,
    root_drive_id: DHG_ROOT_ID, // Always set to DHG
    parent_folder_id: record.parent_id, // Note the rename
    path: path,
    is_root: record.is_root || false,
    path_array: path ? path.split('/').filter(p => p) : [record.name || 'unnamed_file'],
    path_depth: path ? path.split('/').filter(p => p).length : 1,
    is_deleted: record.deleted || false, // Note the rename
    metadata: {
      ...record.metadata,
      _match_method: record._match_method,
      _matched_with: record._matched_with,
      _parent_folder: record._parent_folder
    },
    size: record.size || record.size_bytes || (record.metadata?.size ? parseInt(record.metadata.size) : null),
    modified_time: record.modified_time,
    web_view_link: record.web_view_link,
    thumbnail_link: record.thumbnail_link,
    content_extracted: record.content_extracted || false,
    extracted_content: record.extracted_content,
    document_type_id: record.document_type_id,
    expert_id: record.expert_id,
    created_at: record.created_at,
    updated_at: record.updated_at,
    last_indexed: record.last_indexed,
  };
}

/**
 * Copy all found DHG files to sources_google2
 */
async function copyToSourcesGoogle2(supabase, dhgFiles) {
  console.log('\nCopying files to sources_google2...');
  
  if (isDryRun) {
    console.log(`DRY RUN - Would copy ${dhgFiles.length} files to sources_google2`);
    return;
  }
  
  // Check if sources_google2 exists and clear it if needed
  const { data: sg2Count, error: sg2Error } = await supabase
    .from('sources_google2')
    .select('*', { count: 'exact', head: true });
  
  if (sg2Error) {
    if (sg2Error.code === 'PGRST116') {
      console.log('sources_google2 table does not exist');
      
      if (skipCreate) {
        console.error('Table does not exist and --skip-create specified. Cannot proceed.');
        process.exit(1);
      }
      
      // Create the table - note we'd need execute_sql RPC function for this in practice
      console.log('Would create sources_google2 table here...');
    } else {
      console.error('Error checking sources_google2:', sg2Error.message);
      process.exit(1);
    }
  } else {
    console.log(`sources_google2 table exists with ${sg2Count} records`);
    
    if (sg2Count > 0 && !forceOverwrite) {
      console.log('Table has data. Use --force to overwrite existing data.');
      return;
    }
    
    if (sg2Count > 0 && forceOverwrite) {
      console.log('Clearing existing data from sources_google2...');
      const { error: clearError } = await supabase
        .from('sources_google2')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (clearError) {
        console.error('Error clearing table:', clearError.message);
        return;
      }
      
      console.log('Table cleared successfully');
    }
  }
  
  // Insert records in batches
  let totalInserted = 0;
  const transformedRecords = dhgFiles.map(transformRecord);
  
  // Copy in batches
  for (let i = 0; i < transformedRecords.length; i += batchSize) {
    const batch = transformedRecords.slice(i, i + batchSize);
    console.log(`Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transformedRecords.length / batchSize)} (${batch.length} records)...`);
    
    try {
      const { error: insertError } = await supabase
        .from('sources_google2')
        .upsert(batch);
      
      if (insertError) {
        console.error('Error inserting batch:', insertError.message);
      } else {
        totalInserted += batch.length;
        console.log(`Successfully inserted ${batch.length} records (total: ${totalInserted})`);
      }
    } catch (error) {
      console.error('Unexpected error inserting batch:', error.message);
    }
  }
  
  console.log(`\nCompleted inserting ${totalInserted} out of ${transformedRecords.length} records`);
  
  // Final verification
  const { count: finalCount, error: finalError } = await supabase
    .from('sources_google2')
    .select('*', { count: 'exact', head: true });
  
  if (!finalError) {
    console.log(`Final record count in sources_google2: ${finalCount}`);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Finding all Dynamic Healing Discussion Group files...');
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE RUN'}`);
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Step 1: Find all DHG files using multiple methods
    const dhgFiles = await findAllDHGFiles(supabase);
    
    // Step 2: Copy found files to sources_google2
    await copyToSourcesGoogle2(supabase, dhgFiles);
    
    console.log('\nOperation completed successfully!');
    
  } catch (error) {
    console.error('Error during operation:', error);
    process.exit(1);
  }
}

main();