#!/bin/bash

# Script to restore document_type_id values from backup

# Load environment variables from .env file
if [ -f .env ]; then
  echo "Loading environment variables from .env..."
  set -a
  source .env
  set +a
else
  echo "Error: .env file not found."
  exit 1
fi

# Print environment variable status
echo "SUPABASE_URL: $SUPABASE_URL"
echo "SUPABASE_SERVICE_ROLE_KEY length: ${#SUPABASE_SERVICE_ROLE_KEY}"

echo "Creating script to restore document_type_id values from backup..."

node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function restoreDocumentTypes() {
  try {
    console.log('Retrieving backup data...');
    
    // First retrieve the backup data where document_type_id is NOT null
    // Modify this query to match your backup table name
    const { data: backupData, error: backupError } = await supabase
      .from('documentation_files_backup')  // Replace with your actual backup table name
      .select('file_path, document_type_id')
      .not('document_type_id', 'is', null);
      
    if (backupError) {
      console.error('Error retrieving backup data:', backupError.message);
      return;
    }
    
    if (!backupData || backupData.length === 0) {
      console.log('No backup data found with document_type_id values');
      return;
    }
    
    console.log(`Found ${backupData.length} entries in backup with document_type_id values`);
    
    // Create a map for faster lookups
    const backupMap = new Map();
    for (const item of backupData) {
      backupMap.set(item.file_path, item.document_type_id);
    }
    
    // Now get all current files that have NULL document_type_id
    const { data: currentFiles, error: currentError } = await supabase
      .from('documentation_files')
      .select('id, file_path, title')
      .is('document_type_id', null)
      .eq('is_deleted', false);
      
    if (currentError) {
      console.error('Error retrieving current files:', currentError.message);
      return;
    }
    
    if (!currentFiles || currentFiles.length === 0) {
      console.log('No current files found with NULL document_type_id');
      return;
    }
    
    console.log(`Found ${currentFiles.length} current files with NULL document_type_id`);
    
    // Files we can restore using exact path match
    const exactMatches = [];
    // Files we might be able to restore using title/basename match
    const potentialMatches = [];
    // Files with no matches
    const noMatches = [];
    
    // For title matching
    const titleToDocTypeMap = new Map();
    for (const item of backupData) {
      const basename = path.basename(item.file_path, '.md');
      if (!titleToDocTypeMap.has(basename)) {
        titleToDocTypeMap.set(basename, []);
      }
      titleToDocTypeMap.get(basename).push({
        path: item.file_path,
        docType: item.document_type_id
      });
    }
    
    // First pass - check for exact path matches
    for (const file of currentFiles) {
      if (backupMap.has(file.file_path)) {
        exactMatches.push({
          id: file.id,
          path: file.file_path,
          docType: backupMap.get(file.file_path)
        });
      } else {
        // Check for potential title matches
        const basename = path.basename(file.file_path, '.md');
        if (titleToDocTypeMap.has(basename)) {
          potentialMatches.push({
            id: file.id,
            path: file.file_path,
            title: file.title,
            basename: basename,
            matches: titleToDocTypeMap.get(basename)
          });
        } else {
          noMatches.push({
            id: file.id,
            path: file.file_path
          });
        }
      }
    }
    
    console.log(`Exact matches: ${exactMatches.length}`);
    console.log(`Potential matches by title: ${potentialMatches.length}`);
    console.log(`No matches: ${noMatches.length}`);
    
    // Update exact matches
    if (exactMatches.length > 0) {
      console.log('Updating exact matches...');
      
      // Process in batches of 50
      for (let i = 0; i < exactMatches.length; i += 50) {
        const batch = exactMatches.slice(i, i + 50);
        
        for (const match of batch) {
          const { error } = await supabase
            .from('documentation_files')
            .update({ document_type_id: match.docType })
            .eq('id', match.id);
            
          if (error) {
            console.error(`Error updating file ${match.path}:`, error.message);
          } else {
            console.log(`Successfully restored document_type_id for ${match.path} to ${match.docType}`);
          }
        }
      }
    }
    
    // Update potential matches (by title) - only if there's a single match
    if (potentialMatches.length > 0) {
      console.log('Updating potential matches by title...');
      
      const singleMatches = potentialMatches.filter(m => m.matches.length === 1);
      console.log(`Files with single title match: ${singleMatches.length}`);
      
      // Process in batches of 50
      for (let i = 0; i < singleMatches.length; i += 50) {
        const batch = singleMatches.slice(i, i + 50);
        
        for (const match of batch) {
          const docType = match.matches[0].docType;
          
          const { error } = await supabase
            .from('documentation_files')
            .update({ document_type_id: docType })
            .eq('id', match.id);
            
          if (error) {
            console.error(`Error updating file ${match.path}:`, error.message);
          } else {
            console.log(`Successfully restored document_type_id for ${match.path} to ${docType} (by title match)`);
          }
        }
      }
      
      // Log multiple matches for manual review
      const multipleMatches = potentialMatches.filter(m => m.matches.length > 1);
      if (multipleMatches.length > 0) {
        console.log(`Files with multiple possible matches (${multipleMatches.length}):`);
        for (const match of multipleMatches) {
          console.log(`File: ${match.path}`);
          console.log(`  Possible matches:`);
          for (const m of match.matches) {
            console.log(`  - ${m.path} (document_type_id: ${m.docType})`);
          }
        }
      }
    }
    
    // Summary
    console.log('\\nRestore Summary:');
    console.log(`- Total files with NULL document_type_id: ${currentFiles.length}`);
    console.log(`- Files restored with exact path match: ${exactMatches.length}`);
    console.log(`- Files restored with title match: ${potentialMatches.filter(m => m.matches.length === 1).length}`);
    console.log(`- Files with multiple possible matches: ${potentialMatches.filter(m => m.matches.length > 1).length}`);
    console.log(`- Files with no matches: ${noMatches.length}`);
    
  } catch (error) {
    console.error('Unhandled error:', error.message);
  }
}

restoreDocumentTypes();
"

echo "Script completed."