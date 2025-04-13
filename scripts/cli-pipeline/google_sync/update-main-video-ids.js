#!/usr/bin/env node

/**
 * Update Main Video IDs in sources_google
 * 
 * This script analyzes the folder structure in sources_google to identify
 * the main video file (mp4) for each presentation folder and sets the
 * main_video_id field accordingly.
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
const isDryRun = args.includes('--dry-run');
const forceUpdate = args.includes('--force');
const batchSize = 100;
const maxDepth = 6; // Increase depth to 6 to catch all nested files

/**
 * Find all MP4 files in the sources_google table
 */
async function findAllMp4Files(supabase) {
  try {
    const { data: mp4Files, error: mp4Error } = await supabase
      .from('sources_google')
      .select('id, name, drive_id, parent_folder_id, path, path_depth, root_drive_id')
      .eq('root_drive_id', DHG_ROOT_ID)
      .like('mime_type', '%mp4%')
      .is('main_video_id', null);
    
    if (mp4Error) {
      throw new Error(`Failed to fetch MP4 files: ${mp4Error.message}`);
    }
    
    console.log(`Found ${mp4Files.length} MP4 files`);
    
    return mp4Files;
  } catch (error) {
    console.error('Error finding MP4 files:', error.message);
    return [];
  }
}

/**
 * Find all directories in sources_google
 */
async function findAllDirectories(supabase, maxDepth) {
  try {
    const { data: directories, error: dirError } = await supabase
      .from('sources_google')
      .select('id, name, drive_id, parent_folder_id, path, path_depth, root_drive_id')
      .eq('root_drive_id', DHG_ROOT_ID)
      .like('mime_type', '%folder%')
      .lte('path_depth', maxDepth);
    
    if (dirError) {
      throw new Error(`Failed to fetch directories: ${dirError.message}`);
    }
    
    console.log(`Found ${directories.length} directories`);
    
    return directories;
  } catch (error) {
    console.error('Error finding directories:', error.message);
    return [];
  }
}

/**
 * Find the main video for each directory
 */
function findMainVideosForDirectories(directories, mp4Files) {
  const mainVideos = [];
  
  console.log('Looking for matching videos in directories...');
  
  // For each directory, find its MP4 files
  for (const dir of directories) {
    // Find MP4s that have this directory as parent (multiple ways to check)
    const dirMp4s = mp4Files.filter(mp4 => {
      // Method 1: direct parent_folder_id match
      if (mp4.parent_folder_id === dir.drive_id) {
        return true;
      }
      
      // Method 2: path prefix matching
      if (dir.path && mp4.path && mp4.path.startsWith(dir.path + '/')) {
        return true;
      }
      
      // Method 3: name matching
      if (dir.name && mp4.name && mp4.name.includes(dir.name)) {
        return true;
      }
      
      return false;
    });
    
    if (dirMp4s.length === 0) {
      continue; // No MP4s in this directory
    }
    
    console.log(`Found ${dirMp4s.length} MP4s for directory "${dir.name}"`);
    
    
    // If there's only one MP4, it's the main one
    if (dirMp4s.length === 1) {
      mainVideos.push({
        directory: dir,
        mainVideo: dirMp4s[0],
        confidence: 'high'
      });
      continue;
    }
    
    // If there are multiple MP4s, try to find the best one:
    
    // 1. First, check for one with the same name as the directory
    const nameMatch = dirMp4s.find(mp4 => {
      const mp4BaseName = mp4.name.replace(/\.mp4$/, '');
      const dirBaseName = dir.name;
      
      return mp4BaseName === dirBaseName || 
             mp4BaseName.includes(dirBaseName) || 
             dirBaseName.includes(mp4BaseName);
    });
    
    if (nameMatch) {
      mainVideos.push({
        directory: dir,
        mainVideo: nameMatch,
        confidence: 'high'
      });
      continue;
    }
    
    // 2. Look for specific keywords in filenames
    const presentationKeywords = ['presentation', 'main', 'talk', 'interview', 'primary'];
    const keywordMatch = dirMp4s.find(mp4 => {
      return presentationKeywords.some(keyword => 
        mp4.name.toLowerCase().includes(keyword.toLowerCase())
      );
    });
    
    if (keywordMatch) {
      mainVideos.push({
        directory: dir,
        mainVideo: keywordMatch,
        confidence: 'medium'
      });
      continue;
    }
    
    // 3. Take the largest file (assume it's the main video)
    // Note: We don't have file size in this example, so we'll use the one with the shortest name
    const shortest = dirMp4s.reduce((a, b) => a.name.length <= b.name.length ? a : b);
    
    mainVideos.push({
      directory: dir,
      mainVideo: shortest,
      confidence: 'low'
    });
  }
  
  return mainVideos;
}

/**
 * Recursively identify main video for files in a directory
 */
async function updateDirectoryHierarchy(supabase, mainVideos) {
  console.log(`\nUpdating main_video_id for files in directories...`);
  
  if (isDryRun) {
    console.log(`DRY RUN - Would update main_video_id for ${mainVideos.length} directories`);
    
    // Show sample of what would be updated
    for (let i = 0; i < Math.min(5, mainVideos.length); i++) {
      const { directory, mainVideo, confidence } = mainVideos[i];
      console.log(`- Directory: ${directory.name} (${directory.drive_id})`);
      console.log(`  Main video: ${mainVideo.name} (${mainVideo.id}) - Confidence: ${confidence}`);
    }
    
    return;
  }
  
  let updatedCount = 0;
  
  // Update in batches
  for (let i = 0; i < mainVideos.length; i++) {
    const { directory, mainVideo } = mainVideos[i];
    
    // First update the directory itself
    const { error: dirError } = await supabase
      .from('sources_google')
      .update({ main_video_id: mainVideo.id })
      .eq('id', directory.id);
    
    if (dirError) {
      console.error(`Error updating directory ${directory.name}: ${dirError.message}`);
      continue;
    }
    
    // Then update all files that are children of this directory
    const folderPath = directory.path;
    
    const { data: files, error: filesError } = await supabase
      .from('sources_google')
      .select('id, name, path')
      .eq('parent_folder_id', directory.drive_id);
    
    if (filesError) {
      console.error(`Error getting files for ${directory.name}: ${filesError.message}`);
      continue;
    }
    
    console.log(`Directory ${directory.name} has ${files?.length || 0} direct files`);
    
    if (files && files.length > 0) {
      // Update files in batches
      for (let j = 0; j < files.length; j += batchSize) {
        const batch = files.slice(j, j + batchSize);
        const ids = batch.map(file => file.id);
        
        const { data, error } = await supabase
          .from('sources_google')
          .update({ main_video_id: mainVideo.id })
          .in('id', ids);
        
        if (error) {
          console.error(`Error updating files batch: ${error.message}`);
        } else {
          updatedCount += ids.length;
        }
      }
    }
    
    // Also update files with paths that are underneath this directory
    const { error: pathUpdateError } = await supabase.rpc('execute_sql', {
      sql: `
        UPDATE sources_google
        SET main_video_id = '${mainVideo.id}'
        WHERE path LIKE '${folderPath}/%'
        AND main_video_id IS NULL
      `
    });
    
    if (pathUpdateError) {
      console.error(`Error updating by path for ${directory.name}: ${pathUpdateError.message}`);
    } else {
      // Get count of updated records
      const { data: pathUpdateCount, error: countError } = await supabase.rpc('execute_sql', {
        sql: `
          SELECT COUNT(*) 
          FROM sources_google 
          WHERE main_video_id = '${mainVideo.id}'
          AND path LIKE '${folderPath}/%'
        `
      });
      
      if (!countError && pathUpdateCount && pathUpdateCount[0]) {
        const count = parseInt(pathUpdateCount[0].count, 10);
        console.log(`Updated ${count} additional files by path pattern`);
        updatedCount += count;
      }
    }
  }
  
  console.log(`Updated main_video_id for ${updatedCount} files`);
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Updating main_video_id in sources_google...');
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE RUN'}`);
    console.log(`Maximum depth: ${maxDepth}`);
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Step 1: Find all MP4 files
    console.log('\nSTEP 1: Finding all MP4 files...');
    const mp4Files = await findAllMp4Files(supabase);
    
    if (mp4Files.length === 0) {
      console.log('No MP4 files found. Nothing to do.');
      return;
    }
    
    // Step 2: Find all directories
    console.log('\nSTEP 2: Finding all directories...');
    const directories = await findAllDirectories(supabase, maxDepth);
    
    if (directories.length === 0) {
      console.log('No directories found. Cannot proceed.');
      return;
    }
    
    // Step 3: Identify main videos for each directory
    console.log('\nSTEP 3: Identifying main videos for directories...');
    const mainVideos = findMainVideosForDirectories(directories, mp4Files);
    
    console.log(`Found ${mainVideos.length} directories with main videos`);
    console.log(`- High confidence: ${mainVideos.filter(mv => mv.confidence === 'high').length}`);
    console.log(`- Medium confidence: ${mainVideos.filter(mv => mv.confidence === 'medium').length}`);
    console.log(`- Low confidence: ${mainVideos.filter(mv => mv.confidence === 'low').length}`);
    
    // Step 4: Update main_video_id for directories and child files
    console.log('\nSTEP 4: Updating main_video_id for directories and child files...');
    await updateDirectoryHierarchy(supabase, mainVideos);
    
    // Step 5: Verify results
    if (!isDryRun) {
      console.log('\nSTEP 5: Verifying results...');
      
      const { data: updatedCount, error: updatedError } = await supabase.rpc('execute_sql', {
        sql: `
          SELECT COUNT(*) 
          FROM sources_google 
          WHERE main_video_id IS NOT NULL
          AND root_drive_id = '${DHG_ROOT_ID}'
        `
      });
      
      if (updatedError) {
        console.error(`Error checking updated count: ${updatedError.message}`);
      } else {
        console.log(`Total records with main_video_id set: ${updatedCount[0].count}`);
      }
    }
    
    console.log('\nOperation completed successfully!');
    
  } catch (error) {
    console.error('Error updating main_video_id:', error);
    process.exit(1);
  }
}

main();