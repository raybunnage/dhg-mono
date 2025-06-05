#!/usr/bin/env node
/**
 * Analyze Drive Root Folders
 * 
 * This script analyzes the Polyvagal Steering and Dynamic Healing Group root folders,
 * reporting on their content and parent-child relationships.
 * 
 * Usage:
 *   node tmp/analyze-drive-roots.js [--fix-relationships]
 * 
 * Options:
 *   --fix-relationships   Fix incorrect parent-child relationships
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
const fixRelationships = args.includes('--fix-relationships');

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
 * Get detailed information about a root folder
 */
async function getRootFolderDetails(folderId) {
  try {
    // Get the root folder itself
    const { data: folder, error: folderError } = await supabase
      .from('google_sources')
      .select('*')
      .eq('drive_id', folderId)
      .single();
      
    if (folderError) {
      throw folderError;
    }
    
    // Get all records related to this root folder
    const { data: relatedRecords, error: recordsError } = await supabase
      .from('google_sources')
      .select('*')
      .or(`parent_folder_id.eq.${folderId},drive_id.eq.${folderId}`);
      
    if (recordsError) {
      throw recordsError;
    }
    
    // Get all records where this folder is the parent
    const { data: childRecords, error: childrenError } = await supabase
      .from('google_sources')
      .select('*')
      .eq('parent_folder_id', folderId);
      
    if (childrenError) {
      throw childrenError;
    }
    
    return {
      rootFolder: folder,
      relatedRecords,
      directChildren: childRecords
    };
  } catch (error) {
    console.error(`Error getting details for folder ${folderId}:`, error);
    return null;
  }
}

/**
 * Get all records in the database for analysis
 */
async function getAllRecords() {
  try {
    const { data, error } = await supabase
      .from('google_sources')
      .select('*');
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting all records:', error);
    return [];
  }
}

/**
 * Analyze parent-child relationships in the database
 */
async function analyzeParentChildRelationships() {
  try {
    // Get all records
    const allRecords = await getAllRecords();
    console.log(`Total records in database: ${allRecords.length}`);
    
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
    
    console.log(`Records with missing parent references: ${missingParents.length}`);
    
    if (missingParents.length > 0) {
      console.log('\nSample of records with missing parents:');
      missingParents.slice(0, 5).forEach((record, index) => {
        console.log(`${index + 1}. ${record.name} (${record.mime_type || 'unknown'})`);
        console.log(`   ID: ${record.id}`);
        console.log(`   Drive ID: ${record.drive_id}`);
        console.log(`   Parent Folder ID: ${record.parent_folder_id}`);
        console.log(`   Path: ${record.path || '/'}`);
      });
    }
    
    // Check for circular references
    const circularRefs = [];
    allRecords.forEach(record => {
      if (!record.parent_folder_id) return;
      
      // Check if any parent points back to itself
      let current = record;
      const visited = new Set();
      
      while (current.parent_folder_id) {
        if (visited.has(current.drive_id)) {
          circularRefs.push(record);
          break;
        }
        
        visited.add(current.drive_id);
        current = recordMap[current.parent_folder_id];
        
        if (!current) break; // Parent doesn't exist
      }
    });
    
    console.log(`Records with circular parent references: ${circularRefs.length}`);
    
    if (circularRefs.length > 0) {
      console.log('\nRecords with circular references:');
      circularRefs.slice(0, 5).forEach((record, index) => {
        console.log(`${index + 1}. ${record.name} (${record.mime_type || 'unknown'})`);
        console.log(`   ID: ${record.id}`);
        console.log(`   Drive ID: ${record.drive_id}`);
        console.log(`   Parent Folder ID: ${record.parent_folder_id}`);
      });
    }
    
    return { missingParents, circularRefs };
  } catch (error) {
    console.error('Error analyzing relationships:', error);
    return { missingParents: [], circularRefs: [] };
  }
}

/**
 * Fix parent-child relationships
 */
async function fixRelationshipIssues(missingParents, circularRefs) {
  if (missingParents.length === 0 && circularRefs.length === 0) {
    console.log('No relationship issues to fix');
    return;
  }
  
  console.log('\n=== Fixing Relationship Issues ===');
  
  // Fix missing parents by setting parent_folder_id to null
  if (missingParents.length > 0) {
    console.log(`Fixing ${missingParents.length} records with missing parents...`);
    
    for (const record of missingParents) {
      try {
        const { error } = await supabase
          .from('google_sources')
          .update({
            parent_folder_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id);
          
        if (error) {
          console.error(`Error fixing record ${record.id}:`, error);
        }
      } catch (error) {
        console.error(`Error fixing record ${record.id}:`, error);
      }
    }
    
    console.log('✅ Fixed missing parent references');
  }
  
  // Fix circular references by breaking the cycle
  if (circularRefs.length > 0) {
    console.log(`Fixing ${circularRefs.length} records with circular references...`);
    
    for (const record of circularRefs) {
      try {
        const { error } = await supabase
          .from('google_sources')
          .update({
            parent_folder_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id);
          
        if (error) {
          console.error(`Error fixing circular reference for record ${record.id}:`, error);
        }
      } catch (error) {
        console.error(`Error fixing circular reference for record ${record.id}:`, error);
      }
    }
    
    console.log('✅ Fixed circular references');
  }
}

/**
 * Print details about a folder
 */
function printFolderDetails(name, details) {
  if (!details) {
    console.log(`Unable to retrieve details for ${name} folder`);
    return;
  }
  
  const { rootFolder, relatedRecords, directChildren } = details;
  
  console.log(`\n=== ${name} Folder Details ===`);
  console.log(`Folder Name: ${rootFolder.name}`);
  console.log(`Drive ID: ${rootFolder.drive_id}`);
  console.log(`Database ID: ${rootFolder.id}`);
  console.log(`Created: ${new Date(rootFolder.created_at).toLocaleString()}`);
  console.log(`Is Root: ${rootFolder.is_root ? 'Yes' : 'No'}`);
  console.log(`Deleted: ${rootFolder.deleted ? 'Yes' : 'No'}`);
  console.log(`Path: ${rootFolder.path || '/'}`);
  
  // Count records by status
  const activeRecords = relatedRecords.filter(r => !r.deleted);
  const deletedRecords = relatedRecords.filter(r => r.deleted);
  
  console.log(`\nRelated Records: ${relatedRecords.length}`);
  console.log(`- Active: ${activeRecords.length}`);
  console.log(`- Deleted: ${deletedRecords.length}`);
  
  // Count by mime type
  const mimeTypeCounts = {};
  activeRecords.forEach(record => {
    const type = record.mime_type || 'unknown';
    mimeTypeCounts[type] = (mimeTypeCounts[type] || 0) + 1;
  });
  
  console.log('\nFile Types:');
  Object.entries(mimeTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`- ${type}: ${count} files`);
    });
  
  // Direct children
  console.log(`\nDirect Children: ${directChildren.length}`);
  
  if (directChildren.length > 0) {
    console.log('\nTop-level items:');
    directChildren.slice(0, 10).forEach((child, index) => {
      console.log(`${index + 1}. ${child.name} (${child.mime_type || 'unknown'})`);
      console.log(`   Path: ${child.path || '/'}`);
      console.log(`   Drive ID: ${child.drive_id}`);
      console.log(`   Deleted: ${child.deleted ? 'Yes' : 'No'}`);
    });
    
    if (directChildren.length > 10) {
      console.log(`... and ${directChildren.length - 10} more items`);
    }
  }
  
  // Check parent relationship validity
  const selfReferencingCount = relatedRecords.filter(r => 
    r.parent_folder_id === r.drive_id
  ).length;
  
  if (selfReferencingCount > 0) {
    console.log(`\n⚠️ Found ${selfReferencingCount} records that reference themselves as parents`);
  }
  
  // Check path consistency
  const inconsistentPaths = relatedRecords.filter(r => {
    if (!r.path || !r.parent_path) return false;
    
    // For children of this root, parent_path should be the root folder path
    if (r.parent_folder_id === rootFolder.drive_id) {
      return r.parent_path !== (rootFolder.path || '/');
    }
    
    return false;
  }).length;
  
  if (inconsistentPaths > 0) {
    console.log(`\n⚠️ Found ${inconsistentPaths} records with inconsistent paths`);
  }
}

/**
 * Compare two root folders
 */
function compareFolders(polyvagalDetails, dynamicHealingDetails) {
  if (!polyvagalDetails || !dynamicHealingDetails) {
    console.log('Cannot compare folders due to missing details');
    return;
  }
  
  console.log('\n=== Folder Comparison ===');
  
  const polyvagalFiles = polyvagalDetails.relatedRecords.filter(r => !r.deleted);
  const dynamicHealingFiles = dynamicHealingDetails.relatedRecords.filter(r => !r.deleted);
  
  console.log(`Polyvagal Steering folder: ${polyvagalFiles.length} active files`);
  console.log(`Dynamic Healing folder: ${dynamicHealingFiles.length} active files`);
  
  // Check for overlap between the folders
  const polyvagalIds = new Set(polyvagalFiles.map(f => f.drive_id));
  
  const overlappingFiles = dynamicHealingFiles.filter(f => polyvagalIds.has(f.drive_id));
  
  console.log(`\nOverlapping files: ${overlappingFiles.length}`);
  
  if (overlappingFiles.length > 0) {
    console.log('\nSample of files that appear in both folders:');
    overlappingFiles.slice(0, 5).forEach((file, index) => {
      console.log(`${index + 1}. ${file.name} (${file.mime_type || 'unknown'})`);
      console.log(`   Drive ID: ${file.drive_id}`);
      console.log(`   Path: ${file.path || '/'}`);
    });
    
    if (overlappingFiles.length > 5) {
      console.log(`... and ${overlappingFiles.length - 5} more overlapping files`);
    }
  }
  
  // Compare folder structures
  const polyvagalFolders = polyvagalFiles.filter(f => f.mime_type === 'application/vnd.google-apps.folder');
  const dynamicHealingFolders = dynamicHealingFiles.filter(f => f.mime_type === 'application/vnd.google-apps.folder');
  
  console.log(`\nPolyvagal folders: ${polyvagalFolders.length}`);
  console.log(`Dynamic Healing folders: ${dynamicHealingFolders.length}`);
}

/**
 * Main analysis function
 */
async function analyzeRootFolders() {
  console.log('=== Analyzing Drive Root Folders ===');
  
  // First, analyze parent-child relationships in the whole database
  console.log('\n*** Analyzing Parent-Child Relationships ***');
  const { missingParents, circularRefs } = await analyzeParentChildRelationships();
  
  // Fix relationship issues if requested
  if (fixRelationships) {
    await fixRelationshipIssues(missingParents, circularRefs);
  }
  
  // Analyze Polyvagal Steering folder
  console.log('\n*** Analyzing Polyvagal Steering Folder ***');
  const polyvagalDetails = await getRootFolderDetails(POLYVAGAL_FOLDER_ID);
  printFolderDetails('Polyvagal Steering', polyvagalDetails);
  
  // Analyze Dynamic Healing folder
  console.log('\n*** Analyzing Dynamic Healing Discussion Group Folder ***');
  const dynamicHealingDetails = await getRootFolderDetails(DYNAMIC_HEALING_FOLDER_ID);
  printFolderDetails('Dynamic Healing Discussion Group', dynamicHealingDetails);
  
  // Compare the two folders
  compareFolders(polyvagalDetails, dynamicHealingDetails);
  
  console.log('\n=== Analysis Complete ===');
}

// Run the analysis
analyzeRootFolders().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});