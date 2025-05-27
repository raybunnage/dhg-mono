#!/usr/bin/env ts-node
/**
 * Repair a high-level folder by completely re-syncing it
 * 
 * This command helps fix folders where nesting wasn't properly set up:
 * - Deletes all database records for the folder and its contents
 * - Deletes associated expert_documents
 * - Re-syncs the folder from Google Drive
 * - Re-processes files to create new expert_documents
 * 
 * Usage:
 *   ts-node repair-folder.ts --folder-name <name> [options]
 * 
 * Options:
 *   --folder-name <name>   Name of the high-level folder to repair (required)
 *   --dry-run              Show what would be done without making changes
 *   --verbose              Show detailed progress
 *   --skip-processing      Skip the process-new-files step
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { getGoogleDriveService, GoogleDriveService } from '../../../packages/shared/services/google-drive';
import type { Database } from '../../../supabase/types';
import { getActiveFilterProfile } from './get-active-filter-profile';
import { displayActiveFilter } from './display-active-filter';
import { syncFiles } from './sync-files';
import { processNewFilesEnhanced } from './process-new-files-enhanced';

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
const skipProcessing = args.includes('--skip-processing');

// Get folder name
const folderNameIndex = args.indexOf('--folder-name');
const folderName = folderNameIndex !== -1 && args[folderNameIndex + 1] 
  ? args[folderNameIndex + 1] 
  : null;

if (!folderName) {
  console.error('Error: --folder-name is required');
  console.log('\nUsage:');
  console.log('  repair-folder --folder-name <name> [--dry-run] [--verbose] [--skip-processing]');
  process.exit(1);
}

// Create Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

type SourcesGoogleRow = Database['public']['Tables']['sources_google']['Row'];
type ExpertDocumentRow = Database['public']['Tables']['expert_documents']['Row'];

interface RepairResult {
  folderFound: boolean;
  folderDriveId: string;
  folderMainVideoId: string | null;
  itemsDeleted: number;
  expertDocsDeleted: number;
  itemsSynced: number;
  filesProcessed: number;
  errors: string[];
  duration: number;
}

/**
 * Get all nested items for a folder
 */
async function getAllNestedItems(rootDriveId: string): Promise<SourcesGoogleRow[]> {
  const allItems: SourcesGoogleRow[] = [];
  const toProcess = [rootDriveId];
  const processed = new Set<string>();
  
  while (toProcess.length > 0) {
    const currentId = toProcess.shift()!;
    if (processed.has(currentId)) continue;
    processed.add(currentId);
    
    const { data: children, error } = await supabase
      .from('sources_google')
      .select('*')
      .or(`drive_id.eq.${currentId},parent_folder_id.eq.${currentId}`);
    
    if (!error && children) {
      for (const child of children) {
        if (child.drive_id && !processed.has(child.drive_id)) {
          allItems.push(child);
          if (child.mime_type === 'application/vnd.google-apps.folder') {
            toProcess.push(child.drive_id);
          }
        }
      }
    }
  }
  
  return allItems;
}

/**
 * Delete expert documents for given source IDs
 */
async function deleteExpertDocuments(sourceIds: string[], isDryRun: boolean): Promise<number> {
  if (sourceIds.length === 0) return 0;
  
  // Get count of expert documents
  const { count, error: countError } = await supabase
    .from('expert_documents')
    .select('*', { count: 'exact', head: true })
    .in('source_id', sourceIds);
  
  if (countError) {
    console.error('Error counting expert documents:', countError);
    return 0;
  }
  
  const docsToDelete = count || 0;
  
  if (docsToDelete > 0 && !isDryRun) {
    const { error: deleteError } = await supabase
      .from('expert_documents')
      .delete()
      .in('source_id', sourceIds);
    
    if (deleteError) {
      console.error('Error deleting expert documents:', deleteError);
      return 0;
    }
  }
  
  return docsToDelete;
}

/**
 * Delete sources_google records
 */
async function deleteSourceRecords(itemIds: string[], isDryRun: boolean): Promise<number> {
  if (itemIds.length === 0) return 0;
  
  if (!isDryRun) {
    const { error: deleteError } = await supabase
      .from('sources_google')
      .delete()
      .in('id', itemIds);
    
    if (deleteError) {
      console.error('Error deleting source records:', deleteError);
      return 0;
    }
  }
  
  return itemIds.length;
}

/**
 * Main repair function
 */
async function repairFolder(): Promise<RepairResult> {
  const startTime = Date.now();
  const result: RepairResult = {
    folderFound: false,
    folderDriveId: '',
    folderMainVideoId: null,
    itemsDeleted: 0,
    expertDocsDeleted: 0,
    itemsSynced: 0,
    filesProcessed: 0,
    errors: [],
    duration: 0
  };
  
  try {
    // Find the folder by name with path_depth = 0 and main_video_id
    const { data: folder, error: folderError } = await supabase
      .from('sources_google')
      .select('*')
      .eq('name', folderName)
      .eq('path_depth', 0)
      .not('main_video_id', 'is', null)
      .single();
    
    if (folderError || !folder) {
      result.errors.push(`Folder "${folderName}" not found or doesn't meet criteria (path_depth=0, has main_video_id)`);
      result.duration = (Date.now() - startTime) / 1000;
      return result;
    }
    
    result.folderFound = true;
    result.folderDriveId = folder.drive_id || '';
    result.folderMainVideoId = folder.main_video_id;
    
    console.log(`\n📁 Found folder: ${folder.name}`);
    console.log(`   Drive ID: ${folder.drive_id}`);
    console.log(`   Main Video ID: ${folder.main_video_id}`);
    console.log(`   Path: ${folder.path || '/'}\n`);
    
    // Check active filter
    const activeFilter = await displayActiveFilter();
    if (activeFilter && activeFilter.rootDriveId) {
      if (folder.root_drive_id !== activeFilter.rootDriveId) {
        result.errors.push('Folder is not within the active drive filter');
        result.duration = (Date.now() - startTime) / 1000;
        return result;
      }
    }
    
    // Get all nested items
    console.log('🔍 Finding all nested items...');
    const allItems = await getAllNestedItems(folder.drive_id!);
    allItems.push(folder); // Include the folder itself
    
    console.log(`Found ${allItems.length} total items (including folder)\n`);
    
    if (isVerbose) {
      console.log('Items to be deleted:');
      allItems.forEach(item => {
        const type = item.mime_type === 'application/vnd.google-apps.folder' ? '📁' : '📄';
        console.log(`  ${type} ${item.name} (${item.drive_id})`);
      });
      console.log('');
    }
    
    // Delete expert documents
    console.log('🗑️  Deleting expert documents...');
    const sourceIds = allItems.map(item => item.id);
    result.expertDocsDeleted = await deleteExpertDocuments(sourceIds, isDryRun);
    console.log(`${isDryRun ? '[DRY RUN] Would delete' : 'Deleted'} ${result.expertDocsDeleted} expert documents`);
    
    // Delete source records
    console.log('\n🗑️  Deleting source records...');
    result.itemsDeleted = await deleteSourceRecords(sourceIds, isDryRun);
    console.log(`${isDryRun ? '[DRY RUN] Would delete' : 'Deleted'} ${result.itemsDeleted} source records`);
    
    if (!isDryRun) {
      // Re-sync the folder
      console.log('\n🔄 Re-syncing folder from Google Drive...');
      const driveService = getGoogleDriveService(supabase);
      
      // Sync just this folder
      const syncResult = await syncFiles(driveService, folder.drive_id!);
      result.itemsSynced = syncResult.filesInserted;
      console.log(`✓ Synced ${result.itemsSynced} items`);
      
      // Process new files unless skipped
      if (!skipProcessing) {
        console.log('\n📄 Processing new files...');
        const processResult = await processNewFilesEnhanced(driveService, 50, false, false);
        result.filesProcessed = processResult.filesProcessed;
        console.log(`✓ Processed ${result.filesProcessed} files`);
      }
    } else {
      console.log('\n[DRY RUN] Would re-sync folder and process new files');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    result.errors.push(error.message);
  }
  
  result.duration = (Date.now() - startTime) / 1000;
  return result;
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Repair Folder ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Folder: ${folderName}`);
  console.log(`Skip processing: ${skipProcessing}`);
  console.log('====================');
  
  try {
    const result = await repairFolder();
    
    // Display results
    console.log('\n=== Repair Complete ===');
    if (result.folderFound) {
      console.log(`✓ Folder: ${folderName}`);
      console.log(`✓ Items deleted: ${result.itemsDeleted}`);
      console.log(`✓ Expert docs deleted: ${result.expertDocsDeleted}`);
      if (!isDryRun) {
        console.log(`✓ Items re-synced: ${result.itemsSynced}`);
        console.log(`✓ Files processed: ${result.filesProcessed}`);
      }
      console.log(`✓ Duration: ${result.duration.toFixed(1)}s`);
    } else {
      console.log('❌ Folder not found or does not meet criteria');
    }
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    process.exit(result.errors.length > 0 ? 1 : 0);
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Export for use as module
export { repairFolder };

// Run if called directly
if (require.main === module) {
  main();
}