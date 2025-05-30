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

async function populateSyncStatisticsRecursive(options: SyncStatisticsOptions) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Starting recursive sync statistics population...');
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
    
    // Create a map for quick lookups
    const sourcesByDriveId = new Map<string, any>();
    const sourcesByParentId = new Map<string, any[]>();
    
    // Build lookup maps
    for (const source of sources) {
      sourcesByDriveId.set(source.drive_id, source);
      
      const parentId = source.parent_folder_id || 'root';
      if (!sourcesByParentId.has(parentId)) {
        sourcesByParentId.set(parentId, []);
      }
      sourcesByParentId.get(parentId)!.push(source);
    }
    
    // Recursive function to count all items in a folder and its subfolders
    function countFolderContentsRecursive(folderId: string, depth: number = 0): FolderStatistics {
      const stats: FolderStatistics = {
        folder_id: folderId,
        folder_name: '',
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
      };
      
      // Get the folder itself
      const folder = sourcesByDriveId.get(folderId);
      if (folder) {
        stats.folder_name = folder.name || 'Unknown';
      } else if (folderId === 'root') {
        stats.folder_name = 'Root';
      }
      
      // Get all direct children
      const children = sourcesByParentId.get(folderId) || [];
      
      if (options.verbose && depth === 0) {
        console.log(`\nProcessing folder: ${stats.folder_name} (${folderId})`);
        console.log(`  Direct children: ${children.length}`);
      }
      
      // Process each child
      for (const child of children) {
        // Count the child itself
        stats.google_drive_count++;
        stats.total_google_drive_items++;
        
        // Categorize by type
        if (child.mime_type === 'application/vnd.google-apps.folder') {
          stats.google_drive_folders++;
          
          // Recursively count contents of subfolders
          if (depth < 10) { // Limit recursion depth to prevent infinite loops
            const subfolderStats = countFolderContentsRecursive(child.drive_id, depth + 1);
            
            // Add subfolder counts to current folder
            stats.google_drive_count += subfolderStats.google_drive_count;
            stats.google_drive_documents += subfolderStats.google_drive_documents;
            stats.google_drive_folders += subfolderStats.google_drive_folders;
            stats.mp4_files += subfolderStats.mp4_files;
            stats.mp4_total_size = stats.mp4_total_size + subfolderStats.mp4_total_size;
            stats.new_files += subfolderStats.new_files;
            stats.total_google_drive_items += subfolderStats.total_google_drive_items;
          }
        } else {
          stats.google_drive_documents++;
        }
        
        // Count MP4 files
        if (child.mime_type === 'video/mp4' || child.name?.toLowerCase().endsWith('.mp4')) {
          stats.mp4_files++;
          if (child.size) {
            stats.mp4_total_size = stats.mp4_total_size + BigInt(child.size);
          }
        }
        
        // Count new files (created in last 7 days)
        const createdDate = new Date(child.created_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (createdDate > sevenDaysAgo) {
          stats.new_files++;
        }
      }
      
      return stats;
    }
    
    // Find all top-level folders (folders with path_depth = 0 or parent_folder_id = null/root)
    const topLevelFolders = sources.filter(source => 
      source.mime_type === 'application/vnd.google-apps.folder' &&
      (source.path_depth === 0 || !source.parent_folder_id || source.parent_folder_id === activeRootDriveId)
    );
    
    console.log(`Found ${topLevelFolders.length} top-level folders`);
    
    // Also process root level files (files without parent_folder_id)
    const rootLevelFiles = sources.filter(source => 
      source.mime_type !== 'application/vnd.google-apps.folder' &&
      (!source.parent_folder_id || source.parent_folder_id === activeRootDriveId)
    );
    
    console.log(`Found ${rootLevelFiles.length} root-level files`);
    
    // Calculate statistics for each top-level folder
    const folderStatsList: FolderStatistics[] = [];
    
    // Process top-level folders
    for (const folder of topLevelFolders) {
      const stats = countFolderContentsRecursive(folder.drive_id);
      folderStatsList.push(stats);
      
      if (options.verbose) {
        console.log(`\nFolder: ${stats.folder_name} (${folder.drive_id})`);
        console.log(`  Total items (recursive): ${stats.google_drive_count}`);
        console.log(`  Documents: ${stats.google_drive_documents}`);
        console.log(`  Folders: ${stats.google_drive_folders}`);
        console.log(`  MP4 files: ${stats.mp4_files}`);
        console.log(`  MP4 total size: ${(Number(stats.mp4_total_size) / (1024 * 1024 * 1024)).toFixed(2)} GB`);
        console.log(`  New files (last 7 days): ${stats.new_files}`);
      }
    }
    
    // Create a virtual folder for root-level files
    if (rootLevelFiles.length > 0) {
      const rootStats: FolderStatistics = {
        folder_id: 'root-files',
        folder_name: 'Root Level Files',
        root_drive_id: activeRootDriveId || null,
        google_drive_count: rootLevelFiles.length,
        google_drive_documents: rootLevelFiles.length,
        google_drive_folders: 0,
        local_files: 0,
        local_only_files: 0,
        matching_files: 0,
        mp4_files: 0,
        mp4_total_size: BigInt(0),
        new_files: 0,
        total_google_drive_items: rootLevelFiles.length
      };
      
      for (const file of rootLevelFiles) {
        // Count MP4 files
        if (file.mime_type === 'video/mp4' || file.name?.toLowerCase().endsWith('.mp4')) {
          rootStats.mp4_files++;
          if (file.size) {
            rootStats.mp4_total_size = rootStats.mp4_total_size + BigInt(file.size);
          }
        }
        
        // Count new files
        const createdDate = new Date(file.created_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (createdDate > sevenDaysAgo) {
          rootStats.new_files++;
        }
      }
      
      folderStatsList.push(rootStats);
    }
    
    // Calculate grand total
    let grandTotal = {
      files: 0,
      documents: 0,
      folders: 0,
      mp4s: 0,
      mp4Size: BigInt(0),
      newFiles: 0
    };
    
    for (const stats of folderStatsList) {
      grandTotal.files += stats.google_drive_count;
      grandTotal.documents += stats.google_drive_documents;
      grandTotal.folders += stats.google_drive_folders;
      grandTotal.mp4s += stats.mp4_files;
      grandTotal.mp4Size = grandTotal.mp4Size + stats.mp4_total_size;
      grandTotal.newFiles += stats.new_files;
    }
    
    console.log('\n=== GRAND TOTALS ===');
    console.log(`Total items across all folders: ${grandTotal.files}`);
    console.log(`Total documents: ${grandTotal.documents}`);
    console.log(`Total folders: ${grandTotal.folders}`);
    console.log(`Total MP4 files: ${grandTotal.mp4s}`);
    console.log(`Total MP4 size: ${(Number(grandTotal.mp4Size) / (1024 * 1024 * 1024)).toFixed(2)} GB`);
    console.log(`Total new files: ${grandTotal.newFiles}`);
    console.log(`\nTotal unique sources in database: ${sources.length}`);
    
    if (options.dryRun) {
      console.log('\n[DRY RUN] Would insert/update statistics for', folderStatsList.length, 'folders');
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
        if (options.verbose) {
          console.log(`✓ Updated statistics for ${stats.folder_name}`);
        }
      }
    }
    
    console.log(`\nStatistics population complete:`);
    console.log(`  Successful updates: ${successCount}`);
    console.log(`  Failed updates: ${errorCount}`);
    console.log(`  Total folders processed: ${folderStatsList.length}`);
    
  } catch (error) {
    console.error('Error populating sync statistics:', error);
  }
}

// Set up the CLI
program
  .name('populate-sync-statistics-recursive')
  .description('Populate the google_sync_statistics table with recursive folder statistics')
  .option('-r, --root-drive-id <id>', 'Filter statistics for a specific root drive ID')
  .option('-v, --verbose', 'Show detailed statistics for each folder')
  .option('-d, --dry-run', 'Show what would be updated without making changes')
  .option('-c, --clear-existing', 'Clear existing statistics before populating')
  .action(async (options: SyncStatisticsOptions) => {
    await populateSyncStatisticsRecursive(options);
  });

program.parse(process.argv);