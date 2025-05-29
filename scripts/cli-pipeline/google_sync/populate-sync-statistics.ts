#!/usr/bin/env ts-node

import { program } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface SyncStatisticsOptions {
  rootDriveId?: string;
  verbose?: boolean;
  dryRun?: boolean;
}

interface FolderStatistics {
  folder_id: string;
  folder_name: string;
  root_drive_id: string | null;
  google_drive_count: number;
  google_drive_documents: number;
  google_drive_folders: number;
  local_files: number;
  local_only_files: number;
  matching_files: number;
  mp4_files: number;
  mp4_total_size: bigint;
  new_files: number;
  total_google_drive_items: number;
}

async function populateSyncStatistics(options: SyncStatisticsOptions) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Starting sync statistics population...');
  if (options.rootDriveId) {
    console.log(`Filtering for root drive ID: ${options.rootDriveId}`);
  }
  
  try {
    // Get the active filter profile if no root drive ID is provided
    let activeRootDriveId = options.rootDriveId;
    if (!activeRootDriveId) {
      const { data: activeProfile, error: profileError } = await supabase
        .from('filter_user_profiles')
        .select('id, filter_name')
        .eq('is_active', true)
        .single();
      
      if (profileError || !activeProfile) {
        console.log('No active filter profile found. Will calculate statistics for all files.');
      } else {
        console.log(`Using active filter profile: ${activeProfile.filter_name}`);
        
        // Get the root drive IDs for the active profile
        const { data: profileDrives, error: drivesError } = await supabase
          .from('filter_user_profile_drives')
          .select('root_drive_id')
          .eq('profile_id', activeProfile.id);
        
        if (!drivesError && profileDrives && profileDrives.length === 1) {
          activeRootDriveId = profileDrives[0].root_drive_id;
          console.log(`Found single root drive ID from active profile: ${activeRootDriveId}`);
        } else if (!drivesError && profileDrives && profileDrives.length > 1) {
          console.log(`Active profile has ${profileDrives.length} root drives. Please specify one with --root-drive-id`);
          return;
        }
      }
    }
    
    // Build the query for google_sources
    let query = supabase
      .from('google_sources')
      .select('*')
      .eq('is_deleted', false);
    
    if (activeRootDriveId) {
      query = query.eq('root_drive_id', activeRootDriveId);
    }
    
    const { data: sources, error: sourcesError } = await query;
    
    if (sourcesError) {
      console.error('Error fetching sources:', sourcesError);
      return;
    }
    
    if (!sources || sources.length === 0) {
      console.log('No sources found matching the criteria.');
      return;
    }
    
    console.log(`Found ${sources.length} sources to analyze`);
    
    // Group sources by parent_folder_id
    const folderMap = new Map<string, FolderStatistics>();
    
    // Initialize folder statistics
    for (const source of sources) {
      const folderId = source.parent_folder_id || 'root';
      
      if (!folderMap.has(folderId)) {
        // Find the folder name from sources
        const folderSource = sources.find(s => s.drive_id === folderId);
        const folderName = folderSource?.name || (folderId === 'root' ? 'Root' : 'Unknown');
        
        folderMap.set(folderId, {
          folder_id: folderId,
          folder_name: folderName,
          root_drive_id: activeRootDriveId || null,
          google_drive_count: 0,
          google_drive_documents: 0,
          google_drive_folders: 0,
          local_files: 0,
          local_only_files: 0,
          matching_files: 0,
          mp4_files: 0,
          mp4_total_size: BigInt(0),
          new_files: 0,
          total_google_drive_items: 0
        });
      }
      
      const stats = folderMap.get(folderId)!;
      
      // Count Google Drive items
      stats.google_drive_count++;
      stats.total_google_drive_items++;
      
      // Count by mime type
      if (source.mime_type === 'application/vnd.google-apps.folder') {
        stats.google_drive_folders++;
      } else {
        stats.google_drive_documents++;
      }
      
      // Count MP4 files
      if (source.mime_type === 'video/mp4' || source.name?.toLowerCase().endsWith('.mp4')) {
        stats.mp4_files++;
        if (source.size) {
          stats.mp4_total_size = stats.mp4_total_size + BigInt(source.size);
        }
      }
      
      // Count new files (created in last 7 days)
      const createdDate = new Date(source.created_at);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (createdDate > sevenDaysAgo) {
        stats.new_files++;
      }
      
      // For local vs matching files, we'd need to check against local file system
      // For now, we'll set these to 0 as they require file system access
      // In a real implementation, you might want to check against a local directory
    }
    
    if (options.verbose) {
      console.log('\nFolder Statistics:');
      console.log('==================');
      for (const [folderId, stats] of Array.from(folderMap.entries())) {
        console.log(`\nFolder: ${stats.folder_name} (${folderId})`);
        console.log(`  Total items: ${stats.google_drive_count}`);
        console.log(`  Documents: ${stats.google_drive_documents}`);
        console.log(`  Folders: ${stats.google_drive_folders}`);
        console.log(`  MP4 files: ${stats.mp4_files}`);
        console.log(`  MP4 total size: ${(Number(stats.mp4_total_size) / (1024 * 1024 * 1024)).toFixed(2)} GB`);
        console.log(`  New files (last 7 days): ${stats.new_files}`);
      }
    }
    
    if (options.dryRun) {
      console.log('\n[DRY RUN] Would insert/update statistics for', folderMap.size, 'folders');
      return;
    }
    
    // Insert or update statistics in the database
    let successCount = 0;
    let errorCount = 0;
    
    for (const [folderId, stats] of Array.from(folderMap.entries())) {
      // Convert BigInt to string for JSON serialization
      const statsForInsert = {
        ...stats,
        mp4_total_size: stats.mp4_total_size.toString()
      };
      
      const { error } = await supabase
        .from('google_sync_statistics')
        .upsert(statsForInsert, {
          onConflict: 'folder_id,root_drive_id'
        });
      
      if (error) {
        console.error(`Error updating statistics for folder ${stats.folder_name}:`, error);
        errorCount++;
      } else {
        successCount++;
        if (options.verbose) {
          console.log(`✓ Updated statistics for ${stats.folder_name}`);
        }
      }
    }
    
    console.log(`\nStatistics population complete:`);
    console.log(`  Successful updates: ${successCount}`);
    console.log(`  Failed updates: ${errorCount}`);
    console.log(`  Total folders processed: ${folderMap.size}`);
    
  } catch (error) {
    console.error('Error populating sync statistics:', error);
  }
}

// Set up the CLI
program
  .name('populate-sync-statistics')
  .description('Populate the google_sync_statistics table with current folder statistics')
  .option('-r, --root-drive-id <id>', 'Filter statistics for a specific root drive ID')
  .option('-v, --verbose', 'Show detailed statistics for each folder')
  .option('-d, --dry-run', 'Show what would be updated without making changes')
  .action(async (options: SyncStatisticsOptions) => {
    await populateSyncStatistics(options);
  });

program.parse(process.argv);