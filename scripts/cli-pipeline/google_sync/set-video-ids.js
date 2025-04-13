#!/usr/bin/env node

/**
 * Set Main Video IDs for DHG Files
 * 
 * This script sets main_video_id for files directly using specific patterns
 * to ensure files are properly linked to their main videos.
 */

const { createClient } = require('@supabase/supabase-js');

// Hardcode credentials from .env.development
const SUPABASE_URL = 'https://jdksnfkupzywjdfefkyj.supabase.co';
const SUPABASE_KEY = '***REMOVED***';

// Target root folder ID
const DHG_ROOT_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Process command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

/**
 * Find MP4 files that can serve as main videos
 */
async function findMainVideos(supabase) {
  try {
    // Find videos with mp4 mime type in DHG
    const { data: mp4Files, error: mp4Error } = await supabase
      .from('sources_google')
      .select('id, name, drive_id, path')
      .eq('root_drive_id', DHG_ROOT_ID)
      .like('mime_type', '%mp4%')
      .limit(200);
    
    if (mp4Error) {
      throw new Error(`Failed to find MP4 files: ${mp4Error.message}`);
    }
    
    console.log(`Found ${mp4Files.length} MP4 files that could be main videos`);
    
    return mp4Files;
  } catch (error) {
    console.error('Error finding main videos:', error.message);
    return [];
  }
}

/**
 * Set main_video_id for files that match patterns
 */
async function setMainVideoIds(supabase, mp4Files) {
  if (isDryRun) {
    console.log(`DRY RUN - Would set main_video_id for files related to ${mp4Files.length} videos`);
    return;
  }
  
  let totalUpdated = 0;
  
  for (const video of mp4Files) {
    // Extract base name without extension
    const baseName = video.name.replace(/\.mp4$/, '');
    
    // Update files with similar names or related content
    // Including transcripts, documents, etc.
    try {
      // Approach 1: Update based on name similarity
      const { data: updatedByName, error: nameError } = await supabase
        .from('sources_google')
        .update({ main_video_id: video.id })
        .eq('root_drive_id', DHG_ROOT_ID)
        .is('main_video_id', null)
        .ilike('name', `%${baseName}%`)
        .select('id');
      
      if (nameError) {
        console.error(`Error updating by name for ${baseName}: ${nameError.message}`);
      } else if (updatedByName && updatedByName.length > 0) {
        console.log(`Updated ${updatedByName.length} files with name similar to "${baseName}"`);
        totalUpdated += updatedByName.length;
      }
      
      // Approach 2: Update video itself to be its own main_video_id
      const { data: updatedSelf, error: selfError } = await supabase
        .from('sources_google')
        .update({ main_video_id: video.id })
        .eq('id', video.id)
        .is('main_video_id', null)
        .select('id');
      
      if (selfError) {
        console.error(`Error updating video itself ${baseName}: ${selfError.message}`);
      } else if (updatedSelf && updatedSelf.length > 0) {
        console.log(`Set ${video.name} as its own main video`);
        totalUpdated += updatedSelf.length;
      }
      
      // Approach 3: Set main_video_id for all files with same path prefix
      if (video.path) {
        const pathParts = video.path.split('/');
        // Remove the filename
        pathParts.pop();
        const dirPath = pathParts.join('/');
        
        if (dirPath) {
          const { data: updatedByPath, error: pathError } = await supabase
            .from('sources_google')
            .update({ main_video_id: video.id })
            .eq('root_drive_id', DHG_ROOT_ID)
            .is('main_video_id', null)
            .like('path', `${dirPath}/%`)
            .select('id');
          
          if (pathError) {
            console.error(`Error updating by path for ${dirPath}: ${pathError.message}`);
          } else if (updatedByPath && updatedByPath.length > 0) {
            console.log(`Updated ${updatedByPath.length} files with path prefix "${dirPath}"`);
            totalUpdated += updatedByPath.length;
          }
        }
      }
    } catch (error) {
      console.error(`Unexpected error updating for ${baseName}: ${error.message}`);
    }
  }
  
  console.log(`Total files updated with main_video_id: ${totalUpdated}`);
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Setting main_video_id for DHG files...');
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE RUN'}`);
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Step 1: Find main videos
    console.log('\nSTEP 1: Finding potential main videos...');
    const mp4Files = await findMainVideos(supabase);
    
    if (mp4Files.length === 0) {
      console.log('No MP4 files found. Cannot proceed.');
      return;
    }
    
    // Step 2: Set main_video_id for related files
    console.log('\nSTEP 2: Setting main_video_id for related files...');
    await setMainVideoIds(supabase, mp4Files);
    
    // Step 3: Count updated records
    if (!isDryRun) {
      console.log('\nSTEP 3: Verifying results...');
      
      const { count, error } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .eq('root_drive_id', DHG_ROOT_ID)
        .not('main_video_id', 'is', null);
      
      if (error) {
        console.error(`Error counting updated records: ${error.message}`);
      } else {
        console.log(`Total records with main_video_id set: ${count}`);
      }
    }
    
    console.log('\nOperation completed successfully!');
    
  } catch (error) {
    console.error('Error setting main_video_id:', error);
    process.exit(1);
  }
}

main();