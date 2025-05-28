#!/usr/bin/env ts-node
/**
 * Assign main_video_id to all nested folders and files within a high-level folder
 * 
 * This command finds a folder with path_depth=0 and assigns its main_video_id
 * to all nested folders and files within that folder hierarchy.
 * 
 * Usage:
 *   ts-node assign-main-video-id.ts --folder-id <drive_id> --video-id <main_video_id> [options]
 * 
 * Options:
 *   --folder-id <id>   Google Drive ID of the high-level folder (required)
 *   --video-id <id>    Main video ID to assign (required)
 *   --dry-run          Show what would be updated without making changes
 *   --verbose          Show detailed progress
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import type { Database } from '../../../supabase/types';
import { getActiveFilterProfile } from './get-active-filter-profile';
import { displayActiveFilter } from './display-active-filter';

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

// Get folder ID
const folderIdIndex = args.indexOf('--folder-id');
const folderId = folderIdIndex !== -1 && args[folderIdIndex + 1] 
  ? args[folderIdIndex + 1] 
  : null;

// Get video ID
const videoIdIndex = args.indexOf('--video-id');
const videoId = videoIdIndex !== -1 && args[videoIdIndex + 1] 
  ? args[videoIdIndex + 1] 
  : null;

if (!folderId || !videoId) {
  console.error('Error: Both --folder-id and --video-id are required');
  console.log('\nUsage:');
  console.log('  assign-main-video-id --folder-id <drive_id> --video-id <main_video_id> [--dry-run] [--verbose]');
  process.exit(1);
}

// Create Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

type SourcesGoogleRow = Database['public']['Tables']['google_sources']['Row'];

interface AssignmentResult {
  folderFound: boolean;
  folderName: string;
  folderPathDepth: number;
  totalItems: number;
  foldersUpdated: number;
  filesUpdated: number;
  errors: string[];
  duration: number;
}

interface ItemNode {
  item: SourcesGoogleRow;
  children: ItemNode[];
}

/**
 * Build hierarchical tree structure
 */
async function buildHierarchicalTree(rootDriveId: string): Promise<ItemNode | null> {
  // Get the root folder
  const { data: rootItem, error: rootError } = await supabase
    .from('google_sources')
    .select('*')
    .eq('drive_id', rootDriveId)
    .single();
  
  if (rootError || !rootItem) return null;
  
  // Get all items in this tree using recursive fetch
  const allItems: SourcesGoogleRow[] = [rootItem];
  const toProcess = [rootDriveId];
  const processed = new Set<string>();
  
  while (toProcess.length > 0) {
    const currentId = toProcess.shift()!;
    if (processed.has(currentId)) continue;
    processed.add(currentId);
    
    const { data: children, error: childError } = await supabase
      .from('google_sources')
      .select('*')
      .eq('parent_folder_id', currentId)
      .eq('is_deleted', false);
    
    if (!childError && children) {
      allItems.push(...children);
      children.forEach(child => {
        if (child.drive_id && child.mime_type === 'application/vnd.google-apps.folder') {
          toProcess.push(child.drive_id);
        }
      });
    }
  }
  
  // Build item map
  const itemMap = new Map<string, ItemNode>();
  
  // Create nodes
  allItems.forEach(item => {
    if (item.drive_id) {
      itemMap.set(item.drive_id, { item, children: [] });
    }
  });
  
  // Build parent-child relationships
  allItems.forEach(item => {
    if (item.parent_folder_id && item.drive_id !== rootDriveId) {
      const parent = itemMap.get(item.parent_folder_id);
      const child = itemMap.get(item.drive_id!);
      
      if (parent && child) {
        parent.children.push(child);
      }
    }
  });
  
  return itemMap.get(rootDriveId) || null;
}

/**
 * Display hierarchical tree
 */
function displayTree(node: ItemNode, indent: string = '', isLast: boolean = true): void {
  const isFolder = node.item.mime_type === 'application/vnd.google-apps.folder';
  const icon = isFolder ? '📁' : '📄';
  const branch = isLast ? '└── ' : '├── ';
  const extension = isLast ? '    ' : '│   ';
  
  // Show folder with indication if it's empty
  const folderSuffix = isFolder && node.children.length === 0 ? ' (empty)' : '';
  console.log(`${indent}${branch}${icon} ${node.item.name || 'Unknown'}${folderSuffix}`);
  
  // Sort children: folders first, then files
  const sortedChildren = node.children.sort((a, b) => {
    const aIsFolder = a.item.mime_type === 'application/vnd.google-apps.folder';
    const bIsFolder = b.item.mime_type === 'application/vnd.google-apps.folder';
    
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return (a.item.name || '').localeCompare(b.item.name || '');
  });
  
  sortedChildren.forEach((child, index) => {
    const isChildLast = index === sortedChildren.length - 1;
    displayTree(child, indent + extension, isChildLast);
  });
}

/**
 * Recursively get all nested items within a folder
 */
async function getAllNestedItems(parentDriveId: string): Promise<SourcesGoogleRow[]> {
  const allItems: SourcesGoogleRow[] = [];
  const processedIds = new Set<string>();
  
  async function fetchChildren(driveId: string) {
    // Prevent infinite loops
    if (processedIds.has(driveId)) return;
    processedIds.add(driveId);
    
    // Get direct children
    const { data: children, error } = await supabase
      .from('google_sources')
      .select('*')
      .eq('parent_folder_id', driveId)
      .eq('is_deleted', false);
    
    if (error) {
      console.error(`Error fetching children of ${driveId}:`, error.message);
      return;
    }
    
    if (children && children.length > 0) {
      allItems.push(...children);
      
      // Recursively process folders
      const childFolders = children.filter(item => 
        item.mime_type === 'application/vnd.google-apps.folder'
      );
      
      for (const folder of childFolders) {
        if (folder.drive_id) {
          await fetchChildren(folder.drive_id);
        }
      }
    }
  }
  
  if (parentDriveId) {
    await fetchChildren(parentDriveId);
  }
  return allItems;
}

/**
 * Assign main_video_id to nested items
 */
async function assignMainVideoId(): Promise<AssignmentResult> {
  const startTime = Date.now();
  const result: AssignmentResult = {
    folderFound: false,
    folderName: '',
    folderPathDepth: -1,
    totalItems: 0,
    foldersUpdated: 0,
    filesUpdated: 0,
    errors: [],
    duration: 0
  };
  
  try {
    // First, verify the folder exists and has path_depth = 0
    const { data: folder, error: folderError } = await supabase
      .from('google_sources')
      .select('*')
      .eq('drive_id', folderId)
      .eq('path_depth', 0)
      .single();
    
    if (folderError || !folder) {
      result.errors.push(`Folder not found or not a high-level folder (path_depth must be 0): ${folderId}`);
      result.duration = (Date.now() - startTime) / 1000;
      return result;
    }
    
    result.folderFound = true;
    result.folderName = folder.name || 'Unknown';
    result.folderPathDepth = folder.path_depth || 0;
    
    console.log(`\n📁 Found high-level folder: ${result.folderName}`);
    console.log(`   Drive ID: ${folderId}`);
    console.log(`   Path depth: ${result.folderPathDepth}`);
    console.log(`   Assigning main_video_id: ${videoId}\n`);
    
    // Build and display the hierarchical tree
    console.log('📊 Folder Structure:');
    const treeRoot = await buildHierarchicalTree(folderId!);
    if (treeRoot) {
      console.log(`📁 ${treeRoot.item.name || 'Unknown'}`);
      treeRoot.children.forEach((child, index) => {
        const isLast = index === treeRoot.children.length - 1;
        displayTree(child, '', isLast);
      });
    }
    console.log('\n');
    
    // Update the folder itself first
    if (!isDryRun) {
      const { error: updateError } = await supabase
        .from('google_sources')
        .update({ 
          main_video_id: videoId,
          updated_at: new Date().toISOString()
        })
        .eq('id', folder.id);
      
      if (updateError) {
        result.errors.push(`Error updating folder: ${updateError.message}`);
      } else {
        result.foldersUpdated++;
        if (isVerbose) {
          console.log(`✓ Updated folder: ${folder.name}`);
        }
      }
    } else {
      console.log(`[DRY RUN] Would update folder: ${folder.name}`);
      result.foldersUpdated++;
    }
    
    // Get all nested items
    console.log('🔍 Finding all nested items...');
    const nestedItems = await getAllNestedItems(folderId!);
    result.totalItems = nestedItems.length;
    
    console.log(`Found ${result.totalItems} nested items to update\n`);
    
    // Process in batches
    const BATCH_SIZE = 50;
    const batches = Math.ceil(nestedItems.length / BATCH_SIZE);
    
    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, nestedItems.length);
      const batch = nestedItems.slice(start, end);
      
      console.log(`Processing batch ${i + 1}/${batches} (${batch.length} items)`);
      
      // Separate folders and files for counting
      const folders = batch.filter(item => 
        item.mime_type === 'application/vnd.google-apps.folder'
      );
      const files = batch.filter(item => 
        item.mime_type !== 'application/vnd.google-apps.folder'
      );
      
      if (!isDryRun) {
        // Update batch
        const ids = batch.map(item => item.id);
        const { error: updateError } = await supabase
          .from('google_sources')
          .update({ 
            main_video_id: videoId,
            updated_at: new Date().toISOString()
          })
          .in('id', ids);
        
        if (updateError) {
          result.errors.push(`Batch ${i + 1} error: ${updateError.message}`);
        } else {
          result.foldersUpdated += folders.length;
          result.filesUpdated += files.length;
          
          if (isVerbose) {
            batch.forEach(item => {
              const type = item.mime_type === 'application/vnd.google-apps.folder' ? '📁' : '📄';
              console.log(`  ${type} ${item.name} (depth: ${item.path_depth})`);
            });
          }
        }
      } else {
        console.log(`[DRY RUN] Would update ${folders.length} folders and ${files.length} files`);
        result.foldersUpdated += folders.length;
        result.filesUpdated += files.length;
        
        if (isVerbose) {
          batch.slice(0, 5).forEach(item => {
            const type = item.mime_type === 'application/vnd.google-apps.folder' ? '📁' : '📄';
            console.log(`  ${type} ${item.name} (depth: ${item.path_depth})`);
          });
          if (batch.length > 5) {
            console.log(`  ... and ${batch.length - 5} more items`);
          }
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    result.errors.push(error.message);
  }
  
  result.duration = (Date.now() - startTime) / 1000;
  return result;
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Assign Main Video ID ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Folder ID: ${folderId}`);
  console.log(`Video ID: ${videoId}`);
  
  try {
    // Display active filter prominently
    const activeFilter = await displayActiveFilter();
    
    // Verify folder is within active filter if one exists
    if (activeFilter && activeFilter.rootDriveId) {
      // Get the folder to check its root_drive_id
      const { data: folderCheck, error: checkError } = await supabase
        .from('google_sources')
        .select('root_drive_id')
        .eq('drive_id', folderId)
        .single();
      
      if (checkError || !folderCheck) {
        console.error('❌ Error: Could not verify folder');
        process.exit(1);
      }
      
      if (folderCheck.root_drive_id !== activeFilter.rootDriveId) {
        console.error('❌ Error: This folder is not within the active drive filter');
        console.error(`   Folder root_drive_id: ${folderCheck.root_drive_id}`);
        console.error(`   Active filter expects: ${activeFilter.rootDriveId}`);
        process.exit(1);
      }
    }
    
    // Run the assignment
    const result = await assignMainVideoId();
    
    // Display results
    console.log('\n=== Assignment Complete ===');
    if (result.folderFound) {
      console.log(`✓ Folder: ${result.folderName}`);
      console.log(`✓ Total nested items: ${result.totalItems}`);
      console.log(`✓ Folders updated: ${result.foldersUpdated}`);
      console.log(`✓ Files updated: ${result.filesUpdated}`);
      console.log(`✓ Duration: ${result.duration.toFixed(1)}s`);
    } else {
      console.log('❌ Folder not found or not a high-level folder');
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
export { assignMainVideoId };

// Run if called directly
if (require.main === module) {
  main();
}