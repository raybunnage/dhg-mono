#!/usr/bin/env ts-node
/**
 * Temporary script to test the repair-mismatched-video-ids command
 */
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger } from '../../../packages/shared/utils/logger';

// Main function to directly execute the command logic
async function main() {
  try {
    // Force immediate console output
    process.stdout.write("Starting mismatched video ID check...\n");

    // Get Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Step 1: Get all presentations with high_level_folder_source_id
    process.stdout.write("Fetching presentations with high_level_folder_source_id...\n");
    
    const { data: presentations, error: presError } = await supabase
      .from('media_presentations')
      .select('id, title, video_source_id, high_level_folder_source_id')
      .not('high_level_folder_source_id', 'is', null)
      .limit(100);
    
    if (presError) {
      process.stdout.write(`ERROR fetching presentations: ${presError.message}\n`);
      return;
    }
    
    if (!presentations || presentations.length === 0) {
      process.stdout.write("No presentations with high_level_folder_source_id found.\n");
      return;
    }
    
    process.stdout.write(`Found ${presentations.length} presentations with high_level_folder_source_id.\n`);
    
    // Get unique folder IDs from presentations
    const folderIds = Array.from(new Set(
      presentations
        .map(p => p.high_level_folder_source_id)
        .filter(id => id !== null)
    ));
    
    // Step 2: Get info about these folders
    process.stdout.write("Fetching folders with main_video_id...\n");
    
    const { data: folders, error: foldersError } = await supabase
      .from('sources_google')
      .select('id, name, main_video_id')
      .in('id', folderIds)
      .not('main_video_id', 'is', null);
    
    if (foldersError) {
      process.stdout.write(`ERROR fetching folders: ${foldersError.message}\n`);
      return;
    }
    
    if (!folders || folders.length === 0) {
      process.stdout.write("No folders with main_video_id found.\n");
      return;
    }
    
    process.stdout.write(`Found ${folders.length} folders with main_video_id set.\n`);
    
    // Create folder lookup
    const folderMap = new Map();
    folders.forEach(folder => {
      folderMap.set(folder.id, folder);
    });
    
    // Step 3: Get all video IDs that we need to look up
    const allVideoIds = new Set<string>();
    
    presentations.forEach(p => {
      if (p.video_source_id) allVideoIds.add(p.video_source_id);
    });
    
    folders.forEach(f => {
      if (f.main_video_id) allVideoIds.add(f.main_video_id);
    });
    
    const videoIdArray = Array.from(allVideoIds);
    
    // Step 4: Get video name information
    const { data: videos, error: videosError } = await supabase
      .from('sources_google')
      .select('id, name')
      .in('id', videoIdArray);
    
    if (videosError) {
      process.stdout.write(`ERROR fetching video information: ${videosError.message}\n`);
      return;
    }
    
    // Create video lookup
    const videoMap = new Map();
    if (videos) {
      videos.forEach(video => {
        videoMap.set(video.id, video);
      });
    }
    
    // Step 5: Find mismatches
    process.stdout.write("Checking for mismatched video IDs...\n");
    
    const mismatches = [];
    
    for (const presentation of presentations) {
      const folder = folderMap.get(presentation.high_level_folder_source_id);
      
      // Skip if folder not found or has no main_video_id
      if (!folder || !folder.main_video_id) continue;
      
      // Check if video IDs match
      if (presentation.video_source_id !== folder.main_video_id) {
        // This is a mismatch - get names
        const presentationVideo = videoMap.get(presentation.video_source_id);
        const folderVideo = videoMap.get(folder.main_video_id);
        
        mismatches.push({
          presentationId: presentation.id,
          presentationTitle: presentation.title || 'Unknown',
          currentVideoId: presentation.video_source_id,
          currentVideoName: presentationVideo?.name || 'Unknown',
          folderName: folder.name || 'Unknown',
          folderId: folder.id,
          folderMainVideoId: folder.main_video_id,
          folderMainVideoName: folderVideo?.name || 'Unknown'
        });
      }
    }
    
    // Step 6: Display results
    if (mismatches.length === 0) {
      process.stdout.write("✅ No mismatched video IDs found.\n");
      return;
    }
    
    process.stdout.write(`Found ${mismatches.length} presentations with mismatched video IDs:\n\n`);
    
    // Display table header
    process.stdout.write("┌───────────────────────────────────────────────────────────────────────────────────────────┐\n");
    process.stdout.write("│                             PRESENTATIONS WITH MISMATCHED VIDEO IDs                        │\n");
    process.stdout.write("├───────────────────────────────┬───────────────────────────────┬───────────────────────────┤\n");
    process.stdout.write("│ Presentation                  │ Current Video                  │ Folder Main Video         │\n");
    process.stdout.write("├───────────────────────────────┼───────────────────────────────┼───────────────────────────┤\n");
    
    // Display each mismatched presentation
    for (const mismatch of mismatches) {
      // Truncate titles for better display
      const presentationTitle = truncateString(mismatch.presentationTitle, 25);
      const currentVideoName = truncateString(mismatch.currentVideoName, 25);
      const folderMainVideoName = truncateString(mismatch.folderMainVideoName, 25);
      
      process.stdout.write(`│ ${padString(presentationTitle, 27)} │ ${padString(currentVideoName, 27)} │ ${padString(folderMainVideoName, 27)} │\n`);
    }
    
    process.stdout.write("└───────────────────────────────┴───────────────────────────────┴───────────────────────────┘\n\n");
    
    // Display detailed information
    process.stdout.write("DETAILED INFORMATION:\n\n");
    
    for (let i = 0; i < mismatches.length; i++) {
      const mismatch = mismatches[i];
      process.stdout.write(`${i + 1}. Presentation: ${mismatch.presentationTitle}\n`);
      process.stdout.write(`   ID: ${mismatch.presentationId}\n`);
      process.stdout.write(`   Current Video ID: ${mismatch.currentVideoId}\n`);
      process.stdout.write(`   Current Video Name: ${mismatch.currentVideoName}\n`);
      process.stdout.write(`   Folder: ${mismatch.folderName}\n`);
      process.stdout.write(`   Folder ID: ${mismatch.folderId}\n`);
      process.stdout.write(`   Folder Main Video ID: ${mismatch.folderMainVideoId}\n`);
      process.stdout.write(`   Folder Main Video Name: ${mismatch.folderMainVideoName}\n\n`);
    }
    
    process.stdout.write(`To fix these mismatches, run:\n`);
    process.stdout.write(`presentations-cli repair-presentations --no-dry-run\n\n`);
  } catch (error) {
    process.stdout.write(`ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
    Logger.error('Error checking mismatched video IDs:', error);
    process.exit(1);
  }
}

// Helper function to truncate strings
function truncateString(str: string, maxLength: number): string {
  if (!str) return 'Unknown';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

// Helper function to pad strings
function padString(str: string, length: number): string {
  if (!str) str = 'Unknown';
  if (str.length >= length) return str;
  return str + ' '.repeat(length - str.length);
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});