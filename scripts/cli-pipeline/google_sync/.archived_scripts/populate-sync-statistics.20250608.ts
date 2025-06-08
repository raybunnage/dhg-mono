#!/usr/bin/env ts-node

import { program } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface SyncStatisticsOptions {
  rootDriveId?: string;
  verbose?: boolean;
  dryRun?: boolean;
  clearExisting?: boolean;
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
        .select('id, name')
        .eq('is_active', true)
        .single();
      
      if (profileError || !activeProfile) {
        console.log('No active filter profile found. Please set an active profile or specify --root-drive-id');
        console.log('You can check profiles with: ./google-sync-cli.sh get-active-filter-profile');
        return;
      } else {
        console.log(`Using active filter profile: ${activeProfile.name} (${activeProfile.id})`);
        
        // Get the root drive IDs for the active profile
        const { data: profileDrives, error: drivesError } = await supabase
          .from('filter_user_profile_drives')
          .select('root_drive_id')
          .eq('profile_id', activeProfile.id);
        
        if (drivesError) {
          console.error('Error fetching profile drives:', drivesError);
          return;
        }
        
        if (!profileDrives || profileDrives.length === 0) {
          console.log('No drives found for active profile. Please configure drives for this profile.');
          return;
        }
        
        if (profileDrives.length === 1) {
          activeRootDriveId = profileDrives[0].root_drive_id;
          console.log(`Found single root drive ID from active profile: ${activeRootDriveId}`);
        } else {
          console.log(`Active profile has ${profileDrives.length} root drives:`);
          profileDrives.forEach((drive, index) => {
            console.log(`  ${index + 1}. ${drive.root_drive_id}`);
          });
          console.log('Please specify one with --root-drive-id <drive_id>');
          return;
        }
      }
    }
    
    // Clear existing statistics if requested
    if (options.clearExisting) {
      console.log('Clearing existing statistics...');
      const { error: deleteError } = await supabase
        .from('google_sync_statistics')
        .delete()
        .eq('root_drive_id', activeRootDriveId);
      
      if (deleteError) {
        console.error('Error clearing existing statistics:', deleteError);
        return;
      }
      console.log('Existing statistics cleared.');
    }
    
    // Get ALL sources for the active root drive
    const { data: sources, error: sourcesError } = await supabase
      .from('google_sources')
      .select('*')
      .eq('is_deleted', false)
      .eq('root_drive_id', activeRootDriveId);
    
    if (sourcesError) {
      console.error('Error fetching sources:', sourcesError);
      return;
    }
    
    if (!sources || sources.length === 0) {
      console.log('No sources found matching the criteria.');
      return;
    }
    
    console.log(`Found ${sources.length} sources to analyze for root drive: ${activeRootDriveId}`);
    
    // Group sources by parent_folder_id to get folder statistics
    const folderStats = new Map<string, FolderStatistics>();
    
    // Process each source
    for (const source of sources) {
      const parentId = source.parent_folder_id || 'root';
      
      if (!folderStats.has(parentId)) {
        // Find the parent folder info
        const parentFolder = sources.find(s => s.drive_id === parentId);
        const folderName = parentFolder?.name || (parentId === 'root' ? 'Root Level Items' : `Unknown (${parentId})`);
        
        folderStats.set(parentId, {
          folder_id: parentId,
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
      
      const stats = folderStats.get(parentId)!;
      
      // Count this item
      stats.google_drive_count++;
      stats.total_google_drive_items++;
      
      // Categorize by type
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
    }
    
    // Now we'll only keep statistics for folders that have direct children
    // And create one overall summary
    const folderStatsList: FolderStatistics[] = [];
    
    // Add folder statistics (only for folders with direct children)
    for (const [folderId, stats] of folderStats.entries()) {
      if (stats.google_drive_count > 0) {
        folderStatsList.push(stats);
      }
    }
    
    // Create an overall summary entry
    const overallStats: FolderStatistics = {
      folder_id: `TOTAL-${activeRootDriveId}`,
      folder_name: 'TOTAL FILES IN DRIVE',
      root_drive_id: activeRootDriveId || null,
      google_drive_count: sources.length,
      google_drive_documents: sources.filter(s => s.mime_type !== 'application/vnd.google-apps.folder').length,
      google_drive_folders: sources.filter(s => s.mime_type === 'application/vnd.google-apps.folder').length,
      local_files: 0,
      local_only_files: 0,
      matching_files: 0,
      mp4_files: 0,
      mp4_total_size: BigInt(0),
      new_files: 0,
      total_google_drive_items: sources.length
    };
    
    // Calculate MP4 stats for overall
    for (const source of sources) {
      if (source.mime_type === 'video/mp4' || source.name?.toLowerCase().endsWith('.mp4')) {
        overallStats.mp4_files++;
        if (source.size) {
          overallStats.mp4_total_size = overallStats.mp4_total_size + BigInt(source.size);
        }
      }
      
      const createdDate = new Date(source.created_at);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (createdDate > sevenDaysAgo) {
        overallStats.new_files++;
      }
    }
    
    // Add the overall stats as the first entry
    folderStatsList.unshift(overallStats);
    
    if (options.verbose) {
      console.log('\nFolder Statistics (Direct Children Only):');
      console.log('==========================================');
      
      // Sort by count descending, but keep TOTAL first
      const sortedStats = folderStatsList.slice(1).sort((a, b) => b.google_drive_count - a.google_drive_count);
      const allStats = [folderStatsList[0], ...sortedStats];
      
      for (const stats of allStats) {
        if (stats.folder_id.startsWith('TOTAL-')) {
          console.log(`\n=== ${stats.folder_name} ===`);
        } else {
          console.log(`\nFolder: ${stats.folder_name}`);
        }
        console.log(`  Items in folder: ${stats.google_drive_count}`);
        console.log(`  Documents: ${stats.google_drive_documents}`);
        console.log(`  Subfolders: ${stats.google_drive_folders}`);
        if (stats.mp4_files > 0) {
          console.log(`  MP4 files: ${stats.mp4_files}`);
          console.log(`  MP4 total size: ${(Number(stats.mp4_total_size) / (1024 * 1024 * 1024)).toFixed(2)} GB`);
        }
        if (stats.new_files > 0) {
          console.log(`  New files (last 7 days): ${stats.new_files}`);
        }
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total unique files in database: ${sources.length}`);
    console.log(`Total folders with direct children: ${folderStatsList.length - 1}`); // -1 for TOTAL entry
    
    if (options.dryRun) {
      console.log('\n[DRY RUN] Would insert/update statistics for', folderStatsList.length, 'entries');
      return;
    }
    
    // Insert or update statistics in the database
    let successCount = 0;
    let errorCount = 0;
    
    for (const stats of folderStatsList) {
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
      }
    }
    
    console.log(`\nStatistics population complete:`);
    console.log(`  Successful updates: ${successCount}`);
    console.log(`  Failed updates: ${errorCount}`);
    console.log(`  Total entries created: ${folderStatsList.length}`);
    
  } catch (error) {
    console.error('Error populating sync statistics:', error);
  }
}

// Set up the CLI
program
  .name('populate-sync-statistics')
  .description('Populate the google_sync_statistics table with folder statistics (non-recursive)')
  .option('-r, --root-drive-id <id>', 'Filter statistics for a specific root drive ID')
  .option('-v, --verbose', 'Show detailed statistics for each folder')
  .option('-d, --dry-run', 'Show what would be updated without making changes')
  .option('-c, --clear-existing', 'Clear existing statistics before populating')
  .action(async (options: SyncStatisticsOptions) => {
    await populateSyncStatistics(options);
  });

program.parse(process.argv);