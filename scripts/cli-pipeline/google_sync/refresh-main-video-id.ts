#!/usr/bin/env ts-node
/**
 * Refresh main_video_id for a high-level folder
 * 
 * This command finds the MP4 file within a high-level folder and updates
 * the main_video_id for the folder and all its nested contents.
 * 
 * Usage:
 *   ts-node refresh-main-video-id.ts --folder-name <name> [options]
 * 
 * Options:
 *   --folder-name <name>   Name of the high-level folder (required)
 *   --dry-run              Show what would be updated without making changes
 *   --verbose              Show detailed progress
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import type { Database } from '../../../supabase/types';

// Load environment files
function loadEnvFiles() {
  const envFiles = ['.env', '.env.local', '.env.development'];
  
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`Loading environment variables from ${file}`);
      dotenv.config({ path: filePath });
    }
  }
}

loadEnvFiles();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

// Get folder name
const folderNameIndex = args.indexOf('--folder-name');
const folderName = folderNameIndex !== -1 && args[folderNameIndex + 1] 
  ? args[folderNameIndex + 1] 
  : null;

if (!folderName) {
  console.error('Error: --folder-name is required');
  console.log('\nUsage:');
  console.log('  refresh-main-video-id --folder-name <name> [--dry-run] [--verbose]');
  console.log('\nExample:');
  console.log('  refresh-main-video-id --folder-name "2025-05-07 - Raison - Depression a survival strategy"');
  process.exit(1);
}

// Create Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

type SourcesGoogleRow = Database['public']['Tables']['google_sources']['Row'];

/**
 * Find MP4 file in folder hierarchy
 */
async function findMP4InFolder(folderDriveId: string): Promise<SourcesGoogleRow | null> {
  // First check direct children
  const { data: directChildren } = await supabase
    .from('google_sources')
    .select('*')
    .eq('parent_folder_id', folderDriveId)
    .ilike('name', '%.mp4')
    .eq('is_deleted', false)
    .limit(1)
    .single();
  
  if (directChildren) {
    return directChildren;
  }
  
  // If not found, check nested folders
  const { data: subfolders } = await supabase
    .from('google_sources')
    .select('drive_id')
    .eq('parent_folder_id', folderDriveId)
    .eq('mime_type', 'application/vnd.google-apps.folder')
    .eq('is_deleted', false);
  
  if (subfolders && subfolders.length > 0) {
    for (const subfolder of subfolders) {
      const mp4 = await findMP4InFolder(subfolder.drive_id);
      if (mp4) return mp4;
    }
  }
  
  return null;
}

/**
 * Get all items in folder hierarchy
 */
async function getAllItemsInFolder(folderDriveId: string): Promise<SourcesGoogleRow[]> {
  const allItems: SourcesGoogleRow[] = [];
  const toProcess = [folderDriveId];
  const processed = new Set<string>();
  
  while (toProcess.length > 0) {
    const currentId = toProcess.pop()!;
    if (processed.has(currentId)) continue;
    processed.add(currentId);
    
    // Get all items with this parent
    const { data: items } = await supabase
      .from('google_sources')
      .select('*')
      .eq('parent_folder_id', currentId)
      .eq('is_deleted', false);
    
    if (items) {
      allItems.push(...items);
      
      // Add subfolders to process queue
      items
        .filter(item => item.mime_type === 'application/vnd.google-apps.folder')
        .forEach(folder => toProcess.push(folder.drive_id));
    }
  }
  
  return allItems;
}

/**
 * Main function to refresh main_video_id
 */
async function refreshMainVideoId() {
  console.log(`\n=== Refresh Main Video ID for "${folderName}" ===`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}\n`);
  
  const startTime = Date.now();
  
  try {
    // Find the high-level folder
    const { data: folder, error: folderError } = await supabase
      .from('google_sources')
      .select('*')
      .eq('name', folderName)
      .eq('path_depth', 0)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .eq('is_deleted', false)
      .single();
    
    if (folderError || !folder) {
      console.error(`❌ Could not find high-level folder named "${folderName}"`);
      if (folderError) console.error(`   Error: ${folderError.message}`);
      process.exit(1);
    }
    
    console.log(`✅ Found folder:`);
    console.log(`   Drive ID: ${folder.drive_id}`);
    console.log(`   Current main_video_id: ${folder.main_video_id || 'None'}`);
    
    // Find MP4 file in the folder
    console.log(`\n🔍 Searching for MP4 file in folder hierarchy...`);
    const mp4File = await findMP4InFolder(folder.drive_id);
    
    if (!mp4File) {
      console.error(`❌ No MP4 file found in "${folderName}" or its subfolders`);
      process.exit(1);
    }
    
    console.log(`\n✅ Found MP4 file:`);
    console.log(`   Name: ${mp4File.name}`);
    console.log(`   ID: ${mp4File.id}`);
    console.log(`   Drive ID: ${mp4File.drive_id}`);
    
    if (folder.main_video_id === mp4File.id) {
      console.log(`\n✓ Folder already has correct main_video_id`);
      process.exit(0);
    }
    
    // Get all items in the folder hierarchy
    console.log(`\n📋 Gathering all items in folder hierarchy...`);
    const allItems = await getAllItemsInFolder(folder.drive_id);
    console.log(`   Found ${allItems.length} items (folders and files)`);
    
    // Update main_video_id
    if (isDryRun) {
      console.log(`\n🔄 DRY RUN: Would update main_video_id to ${mp4File.id} for:`);
      console.log(`   - High-level folder: ${folder.name}`);
      console.log(`   - ${allItems.filter(i => i.mime_type === 'application/vnd.google-apps.folder').length} subfolders`);
      console.log(`   - ${allItems.filter(i => i.mime_type !== 'application/vnd.google-apps.folder').length} files`);
    } else {
      console.log(`\n🔄 Updating main_video_id to ${mp4File.id}...`);
      
      // Update the high-level folder
      const { error: updateFolderError } = await supabase
        .from('google_sources')
        .update({ main_video_id: mp4File.id })
        .eq('id', folder.id);
      
      if (updateFolderError) {
        console.error(`❌ Error updating folder: ${updateFolderError.message}`);
        process.exit(1);
      }
      
      // Update all items in batches
      const allItemIds = allItems.map(item => item.id);
      const batchSize = 100;
      let totalUpdated = 1; // Include the folder itself
      
      for (let i = 0; i < allItemIds.length; i += batchSize) {
        const batch = allItemIds.slice(i, i + batchSize);
        const { error: batchError } = await supabase
          .from('google_sources')
          .update({ main_video_id: mp4File.id })
          .in('id', batch);
        
        if (batchError) {
          console.error(`❌ Error updating batch: ${batchError.message}`);
        } else {
          totalUpdated += batch.length;
          if (isVerbose) {
            console.log(`   Updated batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allItemIds.length/batchSize)}`);
          }
        }
      }
      
      console.log(`\n✅ Successfully updated ${totalUpdated} items`);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✓ Completed in ${duration}s`);
    
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Export for use as module
export { refreshMainVideoId };

// Run if called directly
if (require.main === module) {
  refreshMainVideoId();
}