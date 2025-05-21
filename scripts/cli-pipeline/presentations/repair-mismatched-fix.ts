#!/usr/bin/env ts-node
/**
 * Direct script to fix mismatched video IDs in presentations
 * This bypasses the problematic repair-presentations command
 */
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger } from '../../../packages/shared/utils/logger';

// Create backup table before making changes
async function backupPresentationsTable() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const backupTableName = `presentations_backup_${today}`;
    
    // Check if backup table already exists
    const { data: existingTables, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', backupTableName)
      .eq('table_schema', 'public');
    
    if (checkError) {
      console.log(`Error checking for existing backup table: ${checkError.message}`);
      return false;
    }
    
    if (existingTables && existingTables.length > 0) {
      console.log(`Backup table ${backupTableName} already exists, skipping backup creation`);
      return true;
    }
    
    // Create backup using RPC call
    const { data, error } = await supabase.rpc('create_table_backup', {
      source_table: 'presentations',
      destination_table: backupTableName
    });
    
    if (error) {
      console.log(`Failed to create backup: ${error.message}`);
      console.log("Attempting alternative backup method...");
      
      // Try direct SQL method if RPC fails
      const { error: sqlError } = await supabase.rpc('execute_sql', {
        sql_query: `CREATE TABLE ${backupTableName} AS SELECT * FROM presentations;`
      });
      
      if (sqlError) {
        console.log(`Alternative backup method failed: ${sqlError.message}`);
        return false;
      }
      
      console.log(`✅ Backup created as ${backupTableName} using alternative method`);
      return true;
    }
    
    console.log(`✅ Backup created as ${backupTableName}`);
    return true;
  } catch (error) {
    console.log(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// Main function to directly fix mismatched video IDs
async function main() {
  try {
    const dryRun = process.argv.includes('--dry-run');
    
    console.log("Starting to fix mismatched video IDs...");
    console.log(dryRun ? "DRY RUN: No changes will be made" : "LIVE RUN: Changes will be applied to the database");
    
    // Create backup for safety if not in dry run mode
    if (!dryRun) {
      console.log("Creating backup of presentations table...");
      const backupSuccess = await backupPresentationsTable();
      
      if (!backupSuccess) {
        console.log("⚠️ Warning: Unable to create backup. Continuing without backup.");
        const proceed = await promptToContinue("Do you want to proceed without a backup? (yes/no): ");
        
        if (!proceed) {
          console.log("Operation cancelled by user");
          return;
        }
      }
    }
    
    // Get Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Step 1: Get all presentations with high_level_folder_source_id
    console.log("Fetching presentations with high_level_folder_source_id...");
    
    const { data: presentations, error: presError } = await supabase
      .from('presentations')
      .select('id, title, video_source_id, high_level_folder_source_id')
      .not('high_level_folder_source_id', 'is', null)
      .limit(100);
    
    if (presError) {
      console.log(`ERROR fetching presentations: ${presError.message}`);
      return;
    }
    
    if (!presentations || presentations.length === 0) {
      console.log("No presentations with high_level_folder_source_id found.");
      return;
    }
    
    console.log(`Found ${presentations.length} presentations with high_level_folder_source_id.`);
    
    // Get unique folder IDs from presentations
    const folderIds = Array.from(new Set(
      presentations
        .map(p => p.high_level_folder_source_id)
        .filter(id => id !== null)
    ));
    
    // Step 2: Get info about these folders
    console.log("Fetching folders with main_video_id...");
    
    const { data: folders, error: foldersError } = await supabase
      .from('sources_google')
      .select('id, name, main_video_id')
      .in('id', folderIds)
      .not('main_video_id', 'is', null);
    
    if (foldersError) {
      console.log(`ERROR fetching folders: ${foldersError.message}`);
      return;
    }
    
    if (!folders || folders.length === 0) {
      console.log("No folders with main_video_id found.");
      return;
    }
    
    console.log(`Found ${folders.length} folders with main_video_id set.`);
    
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
      console.log(`ERROR fetching video information: ${videosError.message}`);
      return;
    }
    
    // Create video lookup
    const videoMap = new Map();
    if (videos) {
      videos.forEach(video => {
        videoMap.set(video.id, video);
      });
    }
    
    // Step 5: Find and fix mismatches
    console.log("Finding and fixing mismatched video IDs...");
    
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
    
    // Step 6: Fix mismatches or display results
    if (mismatches.length === 0) {
      console.log("✅ No mismatched video IDs found.");
      return;
    }
    
    console.log(`Found ${mismatches.length} presentations with mismatched video IDs:\n`);
    
    // Display table header
    console.log("PRESENTATIONS WITH MISMATCHED VIDEO IDs:");
    console.log("----------------------------------------");
    console.log(" Presentation Title           | Current Video            | Folder Main Video");
    console.log("----------------------------- | ------------------------ | -------------------------");
    
    // Display each mismatched presentation
    for (const mismatch of mismatches) {
      // Truncate titles for better display
      const presentationTitle = truncateString(mismatch.presentationTitle, 25);
      const currentVideoName = truncateString(mismatch.currentVideoName, 22);
      const folderMainVideoName = truncateString(mismatch.folderMainVideoName, 22);
      
      console.log(`${padString(presentationTitle, 28)} | ${padString(currentVideoName, 24)} | ${folderMainVideoName}`);
    }
    
    console.log("\n");
    
    // Fix mismatches if not in dry run mode
    if (!dryRun) {
      console.log("Fixing mismatched video IDs...");
      
      let successCount = 0;
      let failCount = 0;
      
      // Process each mismatch one by one
      for (const mismatch of mismatches) {
        console.log(`Updating presentation: ${mismatch.presentationTitle}`);
        console.log(`  Changing video_source_id from ${mismatch.currentVideoId} to ${mismatch.folderMainVideoId}`);
        
        // Update the presentation
        const { data, error } = await supabase
          .from('presentations')
          .update({ video_source_id: mismatch.folderMainVideoId })
          .eq('id', mismatch.presentationId)
          .select('id, title');
        
        if (error) {
          console.log(`  ❌ Failed to update: ${error.message}`);
          failCount++;
        } else {
          console.log(`  ✅ Successfully updated`);
          successCount++;
        }
      }
      
      console.log(`\nFix operation complete: ${successCount} presentations updated, ${failCount} failed`);
    } else {
      console.log("DRY RUN - No changes made. To fix these mismatches, run:");
      console.log("./scripts/cli-pipeline/presentations/repair-mismatched-fix.ts");
    }
    
  } catch (error) {
    console.log(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    Logger.error('Error fixing mismatched video IDs:', error);
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

// Helper function to prompt for confirmation
async function promptToContinue(message: string): Promise<boolean> {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    readline.question(message, (answer: string) => {
      readline.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});