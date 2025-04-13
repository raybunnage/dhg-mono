#!/usr/bin/env node

/**
 * Test Sources Google Implementation
 * 
 * This script verifies that the sources_google table is properly set up
 * and that we can correctly traverse the folder structure, especially
 * for the Dynamic Healing Discussion Group.
 */

const { createClient } = require('@supabase/supabase-js');

// Hardcode credentials from .env.development
const SUPABASE_URL = 'https://jdksnfkupzywjdfefkyj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impka3NuZmt1cHp5d2pkZmVma3lqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDE4OTAxMywiZXhwIjoyMDQ5NzY1MDEzfQ.ytwo7scGIQRoyue71Bu6W6P6vgSnLP3S3iaL6BoRP_E';

// Target root folder ID
const DHG_ROOT_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';
const DHG_ROOT_NAME = 'Dynamic Healing Discussion Group';

// Process command line arguments
const args = process.argv.slice(2);
const depthToShow = parseInt(args[0] || '3');
const specificFolderId = args[1];
const maxFiles = parseInt(args[2] || '10');

/**
 * Get basic stats about sources_google
 */
async function getSourcesGoogleStats(supabase) {
  try {
    // Total record count
    const { count: totalCount, error: totalError } = await supabase
      .from('sources_google')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) {
      throw new Error(`Failed to get total count: ${totalError.message}`);
    }
    
    // Count by mime type
    const { data: mimeData, error: mimeError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT mime_type, COUNT(*) as count
        FROM sources_google
        WHERE mime_type IS NOT NULL
        GROUP BY mime_type
        ORDER BY count DESC
        LIMIT 10
      `
    });
    
    if (mimeError) {
      console.warn(`Warning: Could not get mime type stats: ${mimeError.message}`);
    }
    
    // Count by path depth
    const { data: depthData, error: depthError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT path_depth, COUNT(*) as count
        FROM sources_google
        WHERE path_depth IS NOT NULL
        GROUP BY path_depth
        ORDER BY path_depth
      `
    });
    
    if (depthError) {
      console.warn(`Warning: Could not get path depth stats: ${depthError.message}`);
    }
    
    // Count by match method
    const { data: matchData, error: matchError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT metadata->>'_match_method' as match_method, COUNT(*) as count
        FROM sources_google
        WHERE metadata->>'_match_method' IS NOT NULL
        GROUP BY metadata->>'_match_method'
        ORDER BY count DESC
      `
    });
    
    if (matchError) {
      console.warn(`Warning: Could not get match method stats: ${matchError.message}`);
    }
    
    // Get some example files at different depths
    const { data: exampleFiles, error: exampleError } = await supabase
      .from('sources_google')
      .select('name, path, path_depth, mime_type')
      .order('path_depth', { ascending: true })
      .limit(10);
    
    if (exampleError) {
      console.warn(`Warning: Could not get example files: ${exampleError.message}`);
    }
    
    return {
      totalCount,
      mimeTypes: mimeData || [],
      pathDepths: depthData || [],
      matchMethods: matchData || [],
      exampleFiles: exampleFiles || []
    };
  } catch (error) {
    console.error('Error getting stats:', error.message);
    return null;
  }
}

/**
 * Get all subfolders of a given folder
 */
async function getSubfolders(supabase, parentFolderId) {
  try {
    const { data, error } = await supabase
      .from('sources_google')
      .select('id, name, drive_id, path')
      .eq('parent_folder_id', parentFolderId)
      .like('mime_type', '%folder%');
    
    if (error) {
      throw new Error(`Failed to get subfolders: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error(`Error getting subfolders for ${parentFolderId}:`, error.message);
    return [];
  }
}

/**
 * Get files in a folder (non-recursive)
 */
async function getFilesInFolder(supabase, folderId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('sources_google')
      .select('id, name, drive_id, path, mime_type')
      .eq('parent_folder_id', folderId)
      .not('mime_type', 'like', '%folder%')
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to get files: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error(`Error getting files for ${folderId}:`, error.message);
    return [];
  }
}

/**
 * Recursively traverse and print folder structure
 */
async function traverseFolder(supabase, folderId, folderName, path, depth = 0, maxDepth = 3, indent = '', filesShown = 0, maxFiles = 10) {
  if (depth > maxDepth) return filesShown;
  
  console.log(`${indent}📁 ${folderName} (${folderId})`);
  
  // Get files in this folder
  const files = await getFilesInFolder(supabase, folderId, 5);
  
  // Show up to maxFiles per level
  const filesToShow = Math.min(files.length, maxFiles - filesShown);
  for (let i = 0; i < filesToShow; i++) {
    const file = files[i];
    const icon = getFileIcon(file.mime_type);
    console.log(`${indent}  ${icon} ${file.name}`);
    filesShown++;
  }
  
  if (files.length > filesToShow) {
    console.log(`${indent}  ... and ${files.length - filesToShow} more files`);
  }
  
  // Get subfolders and recursively traverse
  const subfolders = await getSubfolders(supabase, folderId);
  for (const subfolder of subfolders) {
    filesShown = await traverseFolder(
      supabase, 
      subfolder.drive_id, 
      subfolder.name, 
      (path ? path + '/' : '') + subfolder.name,
      depth + 1, 
      maxDepth, 
      indent + '  ',
      filesShown,
      maxFiles
    );
    
    if (filesShown >= maxFiles) break;
  }
  
  return filesShown;
}

/**
 * Get an icon for a file based on its mime type
 */
function getFileIcon(mimeType) {
  if (!mimeType) return '📄';
  
  if (mimeType.includes('image')) return '🖼️';
  if (mimeType.includes('audio')) return '🔊';
  if (mimeType.includes('video')) return '🎬';
  if (mimeType.includes('pdf')) return '📑';
  if (mimeType.includes('text')) return '📝';
  if (mimeType.includes('document') || mimeType.includes('word')) return '📄';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  
  return '📄';
}

/**
 * Test recursive folder traversal with path_array and path_depth
 */
async function testRecursiveTraversal(supabase) {
  console.log('\nTesting recursive folder traversal using path_array and path_depth...');
  
  // Get all files at depth 1 (direct children of root)
  const { data: level1Files, error: level1Error } = await supabase
    .from('sources_google')
    .select('id, name, drive_id, path, mime_type, path_depth')
    .eq('path_depth', 1)
    .eq('root_drive_id', DHG_ROOT_ID)
    .limit(10);
  
  if (level1Error) {
    console.error('Error getting level 1 files:', level1Error.message);
    return;
  }
  
  console.log(`Found ${level1Files.length} files at depth 1 (root level) of DHG`);
  
  for (let i = 0; i < Math.min(5, level1Files.length); i++) {
    const file = level1Files[i];
    const icon = getFileIcon(file.mime_type);
    console.log(`  ${icon} ${file.name}`);
  }
  
  if (level1Files.length > 5) {
    console.log(`  ... and ${level1Files.length - 5} more files`);
  }
  
  // Get counts by depth
  for (let depth = 1; depth <= 5; depth++) {
    const { count, error } = await supabase
      .from('sources_google')
      .select('*', { count: 'exact', head: true })
      .eq('path_depth', depth)
      .eq('root_drive_id', DHG_ROOT_ID);
    
    if (!error) {
      console.log(`Depth ${depth}: ${count} files`);
    }
  }
  
  // Test a specific path query
  console.log('\nTesting path array querying...');
  
  const { data: arrayTest, error: arrayError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT name, path, path_array
      FROM sources_google
      WHERE root_drive_id = '${DHG_ROOT_ID}'
      AND path_array && ARRAY['transcripts']
      LIMIT 5
    `
  });
  
  if (arrayError) {
    console.error('Error testing path array query:', arrayError.message);
  } else {
    console.log('Files with "transcripts" in their path:');
    arrayTest.forEach(file => {
      console.log(`  - ${file.name} (Path: ${file.path})`);
    });
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Testing sources_google implementation...');
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Step 1: Get basic stats
    console.log('\nSTEP 1: Getting basic statistics...');
    const stats = await getSourcesGoogleStats(supabase);
    
    if (!stats) {
      console.error('Could not get basic stats. Exiting.');
      process.exit(1);
    }
    
    console.log(`Total records in sources_google: ${stats.totalCount}`);
    
    console.log('\nDistribution by mime type:');
    stats.mimeTypes.forEach(row => {
      console.log(`- ${row.mime_type || 'NULL'}: ${row.count} files`);
    });
    
    console.log('\nDistribution by path depth:');
    stats.pathDepths.forEach(row => {
      console.log(`- Depth ${row.path_depth}: ${row.count} files`);
    });
    
    console.log('\nDistribution by match method:');
    stats.matchMethods.forEach(row => {
      console.log(`- ${row.match_method}: ${row.count} files`);
    });
    
    console.log('\nExample files:');
    stats.exampleFiles.forEach(file => {
      console.log(`- ${file.name} (Depth: ${file.path_depth}, Path: ${file.path})`);
    });
    
    // Step 2: Traverse folder structure
    console.log('\nSTEP 2: Traversing folder structure...');
    
    // First get the root folder
    const { data: rootFolder, error: rootError } = await supabase
      .from('sources_google')
      .select('id, name, drive_id')
      .eq('drive_id', DHG_ROOT_ID)
      .eq('is_root', true)
      .limit(1);
    
    if (rootError || !rootFolder || rootFolder.length === 0) {
      console.log('Could not find root folder. Using root ID directly.');
      // If we can't find the root folder record, use the ID directly
      await traverseFolder(supabase, DHG_ROOT_ID, DHG_ROOT_NAME, '', 0, depthToShow, '', 0, maxFiles);
    } else {
      // Use the found root folder
      await traverseFolder(supabase, rootFolder[0].drive_id, rootFolder[0].name, '', 0, depthToShow, '', 0, maxFiles);
    }
    
    // If a specific folder was specified, traverse it too
    if (specificFolderId) {
      console.log(`\nTraversing specific folder: ${specificFolderId}`);
      
      const { data: folderInfo, error: folderError } = await supabase
        .from('sources_google')
        .select('id, name')
        .eq('drive_id', specificFolderId)
        .limit(1);
      
      if (folderError || !folderInfo || folderInfo.length === 0) {
        console.log(`Could not find folder with drive_id ${specificFolderId}`);
      } else {
        await traverseFolder(supabase, specificFolderId, folderInfo[0].name, '', 0, depthToShow, '', 0, maxFiles);
      }
    }
    
    // Step 3: Test recursive traversal using path_array and path_depth
    await testRecursiveTraversal(supabase);
    
    console.log('\nTesting completed successfully!');
    
  } catch (error) {
    console.error('Error during testing:', error);
    process.exit(1);
  }
}

main();