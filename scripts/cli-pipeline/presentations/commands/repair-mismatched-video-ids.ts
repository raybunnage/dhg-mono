/**
 * Command to find and display presentations with mismatched video IDs
 * compared to their high-level folders.
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
import { getActiveFilterProfile } from '../get-active-filter-profile';

// Define interface for mismatch records
interface MismatchedPresentation {
  presentationId: string;
  presentationTitle: string;
  currentVideoId: string;
  currentVideoName: string;
  folderName: string;
  folderId: string;
  folderMainVideoId: string;
  folderMainVideoName: string;
}

// Create the command
const command = new Command('repair-mismatched-video-ids')
  .description('Find and display presentations with mismatched video IDs compared to their high-level folders')
  .option('-l, --limit <number>', 'Limit the number of presentations to check', '100')
  .option('-v, --verbose', 'Show detailed logs during processing', false)
  .action(async (options) => {
    try {
      // Extract options
      const limit = parseInt(options.limit) || 100;
      const verbose = !!options.verbose;
      
      // Force immediate console output
      process.stdout.write("Starting mismatched video ID check...\n");

      // Get Supabase client
      const supabase = SupabaseClientService.getInstance().getClient();
      
      // Check for active filter profile
      const activeFilter = await getActiveFilterProfile();
      let rootDriveIdFilter: string | null = null;
      if (activeFilter && activeFilter.rootDriveId) {
        process.stdout.write(`🔍 Active filter: "${activeFilter.profile.name}"\n`);
        process.stdout.write(`📁 Using root_drive_id: ${activeFilter.rootDriveId}\n\n`);
        rootDriveIdFilter = activeFilter.rootDriveId;
      }
      
      // Step 1: Get all presentations with high_level_folder_source_id
      process.stdout.write("Fetching presentations with high_level_folder_source_id...\n");
      
      let presQuery = supabase
        .from('presentations')
        .select('id, title, video_source_id, high_level_folder_source_id, root_drive_id')
        .not('high_level_folder_source_id', 'is', null);
      
      // Apply root_drive_id filter if active
      if (rootDriveIdFilter) {
        presQuery = presQuery.eq('root_drive_id', rootDriveIdFilter);
      }
      
      const { data: presentations, error: presError } = await presQuery
        .limit(limit);
      
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
      
      if (verbose) {
        process.stdout.write(`Found ${folderIds.length} unique folders to check.\n`);
      }
      
      // Step 2: Get info about these folders
      let foldersQuery = supabase
        .from('sources_google')
        .select('id, name, main_video_id, root_drive_id')
        .in('id', folderIds)
        .not('main_video_id', 'is', null);
      
      // Apply root_drive_id filter if active
      if (rootDriveIdFilter) {
        foldersQuery = foldersQuery.eq('root_drive_id', rootDriveIdFilter);
      }
      
      const { data: folders, error: foldersError } = await foldersQuery;
      
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
      let videosQuery = supabase
        .from('sources_google')
        .select('id, name, root_drive_id')
        .in('id', videoIdArray);
      
      // Apply root_drive_id filter if active
      if (rootDriveIdFilter) {
        videosQuery = videosQuery.eq('root_drive_id', rootDriveIdFilter);
      }
      
      const { data: videos, error: videosError } = await videosQuery;
      
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
      
      const mismatches: MismatchedPresentation[] = [];
      
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
  });

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

export default command;