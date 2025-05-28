# Archived on 2025-04-11 - Original file used with sources_google table
#!/usr/bin/env ts-node
/**
 * Report Drive Roots
 * 
 * This script generates a summary report of all root folders in the sources_google
 * table, showing the count of files and folders under each root.
 * 
 * Usage:
 *   npx ts-node scripts/report-drive-roots.ts [options]
 * 
 * Options:
 *   --show-paths         Show file paths for verification
 *   --max-depth <n>      Maximum depth to show in path output (default: 2)
 *   --max-items <n>      Maximum items to show per root (default: 20)
 *   --root-id <id>       Focus on a specific root folder by ID
 *   --verbose            Show detailed information
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../../../../supabase/types';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../../../.env.development') });

// Process command line arguments
const args = process.argv.slice(2);
const showPaths = args.includes('--show-paths');
const verbose = args.includes('--verbose');
const outputJson = args.includes('--json');
const outputFile = args.find((arg, i) => arg === '--output' && i < args.length - 1) 
  ? args[args.indexOf('--output') + 1] 
  : null;

// Parse max depth
const maxDepthIndex = args.indexOf('--max-depth');
const maxDepth = maxDepthIndex !== -1 && args[maxDepthIndex + 1] 
  ? parseInt(args[maxDepthIndex + 1], 10) 
  : 2;

// Parse max items
const maxItemsIndex = args.indexOf('--max-items');
const maxItems = maxItemsIndex !== -1 && args[maxItemsIndex + 1] 
  ? parseInt(args[maxItemsIndex + 1], 10) 
  : 20;

// Parse root ID
const rootIdIndex = args.indexOf('--root-id');
const rootId = rootIdIndex !== -1 && args[rootIdIndex + 1] 
  ? args[rootIdIndex + 1]
  : null;

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL or key not found in environment variables');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

interface RootFolderSummary {
  id: string;
  name: string;
  drive_id: string;
  path: string;
  created_at: string;
  updated_at: string;
  direct_children: number;
  total_descendants: number;
  folders_count: number;
  files_count: number;
  file_types?: Record<string, number>;
  file_hierarchy?: any;
}

/**
 * Main function to report on drive roots
 */
async function reportDriveRoots() {
  const report: {
    roots: RootFolderSummary[];
    timestamp: string;
    options: Record<string, any>;
  } = {
    roots: [],
    timestamp: new Date().toISOString(),
    options: {
      showPaths,
      verbose,
      maxDepth,
      maxItems,
      rootId
    }
  };
  
  if (!outputJson) {
    console.log('=== Google Drive Root Folders Report ===');
  }

  try {
    // Get all root folders
    const { data: rootFolders, error: rootsError } = await supabase
      .from('google_sources')
      .select('id, name, drive_id, path, created_at, updated_at')
      .eq('is_root', true)
      .eq('deleted', false)
      .order('name');

    if (rootsError) {
      console.error('Error fetching root folders:', rootsError);
      return;
    }

    if (!rootFolders || rootFolders.length === 0) {
      console.log('No root folders found in the database.');
      return;
    }

    // Filter to specific root if requested
    const selectedRoots = rootId 
      ? rootFolders.filter(folder => folder.id === rootId || folder.drive_id === rootId) 
      : rootFolders;

    if (rootId && selectedRoots.length === 0) {
      const errorMsg = `Root folder with ID ${rootId} not found.`;
      if (!outputJson) {
        console.error(errorMsg);
      }
      return;
    }

    if (!outputJson) {
      console.log(`Found ${selectedRoots.length} root folders:\n`);
    }

    for (const root of selectedRoots) {
      // Get immediate children (direct files and folders)
      const { data: directChildren, error: childrenError } = await supabase
        .from('google_sources')
        .select('id, name, mime_type, path')
        .eq('parent_folder_id', root.drive_id)
        .eq('deleted', false);

      if (childrenError) {
        if (!outputJson) {
          console.error(`Error fetching children for ${root.name}:`, childrenError);
        }
        continue;
      }

      // Get all descendants using path pattern matching
      const { data: allDescendants, error: descendantsError } = await supabase
        .from('google_sources')
        .select('id, name, mime_type, path, parent_folder_id')
        .like('path', `${root.path}/%`)
        .eq('deleted', false);

      if (descendantsError) {
        if (!outputJson) {
          console.error(`Error fetching descendants for ${root.name}:`, descendantsError);
        }
        continue;
      }

      const descendants = allDescendants || [];
      const folders = descendants.filter(item => item.mime_type === 'application/vnd.google-apps.folder');
      const files = descendants.filter(item => item.mime_type !== 'application/vnd.google-apps.folder');

      // Sort by path for better readability
      descendants.sort((a, b) => (a.path || '').localeCompare(b.path || ''));
      
      // Create summary for JSON output
      const rootSummary: RootFolderSummary = {
        id: root.id,
        name: root.name,
        drive_id: root.drive_id,
        path: root.path || '',
        created_at: root.created_at,
        updated_at: root.updated_at,
        direct_children: directChildren?.length || 0,
        total_descendants: descendants.length,
        folders_count: folders.length,
        files_count: files.length
      };
      
      // Add to report
      report.roots.push(rootSummary);

      // Print report if not in JSON mode
      if (!outputJson) {
        console.log(`--------------------------------------------`);
        console.log(`Root Folder: ${root.name}`);
        console.log(`ID: ${root.id}`);
        console.log(`Drive ID: ${root.drive_id}`);
        console.log(`Path: ${root.path}`);
        console.log(`Created: ${new Date(root.created_at).toLocaleString()}`);
        console.log(`Last Updated: ${new Date(root.updated_at).toLocaleString()}`);
        console.log(`Direct Children: ${directChildren?.length || 0}`);
        console.log(`Total Descendants: ${descendants.length}`);
        console.log(`  - Folders: ${folders.length}`);
        console.log(`  - Files: ${files.length}`);
      }

      // Process file type breakdown
      const fileTypes: Record<string, number> = {};
      for (const file of files) {
        const type = file.mime_type || 'unknown';
        fileTypes[type] = (fileTypes[type] || 0) + 1;
      }
      
      // Add to JSON output
      rootSummary.file_types = fileTypes;
      
      // Show file type breakdown in console
      if (verbose && !outputJson) {
        console.log('\nFile type breakdown:');
        Object.entries(fileTypes)
          .sort((a, b) => b[1] - a[1])
          .forEach(([type, count]) => {
            const formattedType = type
              .replace('application/vnd.google-apps.', '')
              .replace('application/', '')
              .replace('video/', 'video: ')
              .replace('audio/', 'audio: ')
              .replace('image/', 'image: ');
            console.log(`  - ${formattedType}: ${count} files`);
          });
      }

      // Show file paths if requested
      if (showPaths) {
        if (descendants.length > 0) {
          console.log('\nFile paths (for verification):');
          
          // First, get all items including the root
          const { data: allItems, error: itemsError } = await supabase
            .from('google_sources')
            .select('id, name, mime_type, path, drive_id, parent_folder_id')
            .or(`id.eq.${root.id},path.like.${root.path}/%`)
            .eq('deleted', false);
            
          if (itemsError) {
            console.error(`Error fetching all items for ${root.name}:`, itemsError);
            continue;
          }
          
          // Organize by parent-child relationship
          const itemMap: Record<string, any> = {};
          const rootItems: any[] = [];
          
          // First pass: index all items by drive_id
          for (const item of allItems || []) {
            itemMap[item.drive_id] = {
              ...item,
              children: []
            };
          }
          
          // Second pass: establish parent-child relationships
          for (const item of allItems || []) {
            if (item.parent_folder_id) {
              const parent = itemMap[item.parent_folder_id];
              if (parent) {
                parent.children.push(itemMap[item.drive_id]);
              } else {
                rootItems.push(itemMap[item.drive_id]);
              }
            } else if (item.drive_id === root.drive_id) {
              // This is the root folder
              rootItems.push(itemMap[item.drive_id]);
            }
          }
          
          // Sort children by name
          const sortChildren = (node: any) => {
            if (node.children) {
              node.children.sort((a: any, b: any) => a.name.localeCompare(b.name));
              for (const child of node.children) {
                sortChildren(child);
              }
            }
          };
          
          // Sort and print
          for (const rootItem of rootItems) {
            sortChildren(rootItem);
            printGoogleDriveTree(rootItem, 0, maxDepth, maxItems);
          }
          
          // Alternative approach: use path-based hierarchy
          console.log('\nAlternative Path-based Hierarchy:');
          const folderTree: Record<string, any> = {};
          for (const item of descendants) {
            if (!item.path) continue;
            
            // Skip items beyond max depth
            const pathParts = item.path.split('/').filter(Boolean);
            if (pathParts.length > maxDepth + 1) continue; // +1 for root folder
            
            let current = folderTree;
            for (const part of pathParts) {
              if (!current[part]) {
                current[part] = { _items: [] };
              }
              current = current[part];
            }
            current._items.push(item);
          }
          
          // Print folder tree
          printFolderTree(folderTree, 0, maxItems);
        }
      }

      console.log('--------------------------------------------\n');
    }

    if (!outputJson) {
      console.log('=== End of Report ===');
    } else {
      // Output JSON data
      const jsonOutput = JSON.stringify(report, null, 2);
      
      if (outputFile) {
        try {
          // Ensure directory exists
          const dir = path.dirname(outputFile);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          // Write to file
          fs.writeFileSync(outputFile, jsonOutput);
          console.log(`Report saved to ${outputFile}`);
        } catch (err: any) {
          console.error(`Error writing to file: ${err.message}`);
        }
      } else {
        // Print to console
        console.log(jsonOutput);
      }
    }
  } catch (error: any) {
    if (!outputJson) {
      console.error('Unexpected error:', error.message);
    } else {
      console.log(JSON.stringify({ error: error.message }));
    }
  }
}

/**
 * Helper function to print a folder tree
 */
function printFolderTree(tree: Record<string, any>, level: number, maxItems: number) {
  const indent = '  '.repeat(level);
  let itemsShown = 0;
  
  for (const [folderName, contents] of Object.entries(tree)) {
    if (folderName === '_items') continue;
    
    console.log(`${indent}📁 ${folderName}/`);
    
    // Print items in this folder (up to max)
    const items = contents._items || [];
    const itemsToShow = items.slice(0, maxItems - itemsShown);
    
    for (const item of itemsToShow) {
      const icon = item.mime_type === 'application/vnd.google-apps.folder' ? '📁' : '📄';
      console.log(`${indent}  ${icon} ${item.name}`);
      itemsShown++;
    }
    
    if (items.length > itemsToShow.length) {
      console.log(`${indent}  ... and ${items.length - itemsToShow.length} more items`);
    }
    
    // Print subfolders (recursively)
    const subfolders = Object.keys(contents).filter(key => key !== '_items');
    if (subfolders.length > 0) {
      const subfoldersToProcess: Record<string, any> = {};
      for (const subfolder of subfolders) {
        subfoldersToProcess[subfolder] = contents[subfolder];
      }
      printFolderTree(subfoldersToProcess, level + 1, maxItems - itemsShown);
    }
    
    if (itemsShown >= maxItems) {
      console.log(`${indent}... (more items omitted)`);
      break;
    }
  }
}

/**
 * Helper function to print a Google Drive tree (based on parent-child relationships)
 */
function printGoogleDriveTree(item: any, level: number, maxDepth: number, maxItems: number, itemsShown: number = 0) {
  if (level > maxDepth) return itemsShown;
  
  const indent = '  '.repeat(level);
  const icon = item.mime_type === 'application/vnd.google-apps.folder' ? '📁' : '📄';
  
  console.log(`${indent}${icon} ${item.name}`);
  itemsShown++;
  
  if (item.mime_type === 'application/vnd.google-apps.folder' && item.children && item.children.length > 0) {
    // Sort children: folders first, then files, both alphabetically
    const folders = item.children.filter((c: any) => c.mime_type === 'application/vnd.google-apps.folder');
    const files = item.children.filter((c: any) => c.mime_type !== 'application/vnd.google-apps.folder');
    
    folders.sort((a: any, b: any) => a.name.localeCompare(b.name));
    files.sort((a: any, b: any) => a.name.localeCompare(b.name));
    
    const sortedChildren = [...folders, ...files];
    
    for (const child of sortedChildren) {
      if (itemsShown >= maxItems) {
        console.log(`${indent}  ... (more items omitted)`);
        break;
      }
      
      itemsShown = printGoogleDriveTree(child, level + 1, maxDepth, maxItems, itemsShown);
    }
  }
  
  return itemsShown;
}

// Run the report
reportDriveRoots().catch(console.error);