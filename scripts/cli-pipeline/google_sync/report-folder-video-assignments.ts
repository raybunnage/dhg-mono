#!/usr/bin/env ts-node
/**
 * Generate a report showing main_video_id assignments for a specific folder and all nested items
 * 
 * This command creates a detailed report similar to main-video-folders report but focused on
 * a single high-level folder, showing the main_video_id assignments for all nested content.
 * 
 * Usage:
 *   ts-node report-folder-video-assignments.ts --folder-id <drive_id> [options]
 * 
 * Options:
 *   --folder-id <id>    Google Drive ID of the high-level folder (required)
 *   --output <path>     Output file path for the report (optional)
 *   --format <type>     Output format: 'markdown' or 'json' (default: markdown)
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

// Get folder ID
const folderIdIndex = args.indexOf('--folder-id');
const folderId = folderIdIndex !== -1 && args[folderIdIndex + 1] 
  ? args[folderIdIndex + 1] 
  : null;

// Get output path
const outputIndex = args.indexOf('--output');
const outputPath = outputIndex !== -1 && args[outputIndex + 1] 
  ? args[outputIndex + 1] 
  : null;

// Get format
const formatIndex = args.indexOf('--format');
const format = formatIndex !== -1 && args[formatIndex + 1] 
  ? args[formatIndex + 1] 
  : 'markdown';

if (!folderId) {
  console.error('Error: --folder-id is required');
  console.log('\nUsage:');
  console.log('  report-folder-video-assignments --folder-id <drive_id> [--output <path>] [--format markdown|json]');
  process.exit(1);
}

// Create Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

type SourcesGoogleRow = Database['public']['Tables']['sources_google']['Row'];

interface FolderItem {
  id: string;
  drive_id: string;
  name: string;
  mime_type: string;
  path_depth: number;
  main_video_id: string | null;
  path: string | null;
  isFolder: boolean;
  children?: FolderItem[];
}

interface ReportData {
  folder: FolderItem;
  totalItems: number;
  itemsWithVideoId: number;
  itemsWithoutVideoId: number;
  videoIdCoverage: number;
  generatedAt: string;
}

/**
 * Build a hierarchical structure of the folder and its contents
 */
async function buildFolderHierarchy(rootDriveId: string): Promise<FolderItem | null> {
  // Get the root folder
  const { data: rootFolder, error: rootError } = await supabase
    .from('sources_google')
    .select('*')
    .eq('drive_id', rootDriveId)
    .single();
  
  if (rootError || !rootFolder) {
    console.error('Root folder not found:', rootDriveId);
    return null;
  }
  
  // Get all items in this folder tree
  const { data: allItems, error: itemsError } = await supabase
    .from('sources_google')
    .select('*')
    .eq('root_drive_id', rootFolder.root_drive_id)
    .gte('path_depth', rootFolder.path_depth || 0)
    .eq('is_deleted', false)
    .order('path_depth', { ascending: true })
    .order('name', { ascending: true });
  
  if (itemsError || !allItems) {
    console.error('Error fetching items:', itemsError);
    return null;
  }
  
  // Build hierarchy
  const itemMap = new Map<string, FolderItem>();
  
  // Convert to FolderItem format
  allItems.forEach(item => {
    const folderItem: FolderItem = {
      id: item.id,
      drive_id: item.drive_id || '',
      name: item.name || 'Unknown',
      mime_type: item.mime_type || '',
      path_depth: item.path_depth || 0,
      main_video_id: item.main_video_id,
      path: item.path,
      isFolder: item.mime_type === 'application/vnd.google-apps.folder',
      children: []
    };
    
    if (item.drive_id) {
      itemMap.set(item.drive_id, folderItem);
    }
  });
  
  // Build parent-child relationships
  allItems.forEach(item => {
    if (item.parent_folder_id && item.drive_id && item.drive_id !== rootDriveId) {
      const parent = itemMap.get(item.parent_folder_id);
      const child = itemMap.get(item.drive_id);
      
      if (parent && child && parent.children) {
        parent.children.push(child);
      }
    }
  });
  
  return itemMap.get(rootDriveId) || null;
}

/**
 * Count items in the hierarchy
 */
function countItems(folder: FolderItem): { total: number; withVideoId: number; withoutVideoId: number } {
  let total = 1; // Count the folder itself
  let withVideoId = folder.main_video_id ? 1 : 0;
  let withoutVideoId = folder.main_video_id ? 0 : 1;
  
  if (folder.children) {
    folder.children.forEach(child => {
      const childCounts = countItems(child);
      total += childCounts.total;
      withVideoId += childCounts.withVideoId;
      withoutVideoId += childCounts.withoutVideoId;
    });
  }
  
  return { total, withVideoId, withoutVideoId };
}

/**
 * Generate markdown report content
 */
function generateMarkdownReport(data: ReportData): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`# Main Video ID Assignment Report`);
  lines.push(`## Folder: ${data.folder.name}`);
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push('');
  
  // Summary statistics
  lines.push('## Summary');
  lines.push(`- **Folder Drive ID**: ${data.folder.drive_id}`);
  lines.push(`- **Folder Main Video ID**: ${data.folder.main_video_id || 'Not assigned'}`);
  lines.push(`- **Total Items**: ${data.totalItems}`);
  lines.push(`- **Items with Video ID**: ${data.itemsWithVideoId}`);
  lines.push(`- **Items without Video ID**: ${data.itemsWithoutVideoId}`);
  lines.push(`- **Coverage**: ${data.videoIdCoverage.toFixed(1)}%`);
  lines.push('');
  
  // Folder structure
  lines.push('## Folder Structure');
  lines.push('');
  
  // Recursive function to print hierarchy
  const printItem = (item: FolderItem, indent: string = '') => {
    const icon = item.isFolder ? '📁' : '📄';
    const videoIdStatus = item.main_video_id ? `✓ ${item.main_video_id}` : '✗ No video ID';
    
    lines.push(`${indent}${icon} ${item.name}`);
    lines.push(`${indent}   └─ ${videoIdStatus}`);
    
    if (item.children && item.children.length > 0) {
      // Sort children: folders first, then files
      const sortedChildren = [...item.children].sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      });
      
      sortedChildren.forEach((child, index) => {
        const isLast = index === sortedChildren.length - 1;
        const childIndent = indent + '   ';
        printItem(child, childIndent);
      });
    }
  };
  
  printItem(data.folder);
  lines.push('');
  
  // Items without video ID
  if (data.itemsWithoutVideoId > 0) {
    lines.push('## Items Missing Video ID');
    lines.push('');
    
    const listMissingItems = (item: FolderItem, path: string = '') => {
      const currentPath = path ? `${path}/${item.name}` : item.name;
      
      if (!item.main_video_id) {
        lines.push(`- ${currentPath} (${item.drive_id})`);
      }
      
      if (item.children) {
        item.children.forEach(child => listMissingItems(child, currentPath));
      }
    };
    
    listMissingItems(data.folder);
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Generate JSON report content
 */
function generateJsonReport(data: ReportData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Generate Folder Video Assignment Report ===');
  console.log(`Folder ID: ${folderId}`);
  console.log(`Format: ${format}`);
  if (outputPath) {
    console.log(`Output: ${outputPath}`);
  }
  console.log('=====================================\n');
  
  try {
    // Build folder hierarchy
    console.log('Building folder hierarchy...');
    const folderHierarchy = await buildFolderHierarchy(folderId);
    
    if (!folderHierarchy) {
      console.error('❌ Could not build folder hierarchy');
      process.exit(1);
    }
    
    // Count items
    const counts = countItems(folderHierarchy);
    
    // Prepare report data
    const reportData: ReportData = {
      folder: folderHierarchy,
      totalItems: counts.total,
      itemsWithVideoId: counts.withVideoId,
      itemsWithoutVideoId: counts.withoutVideoId,
      videoIdCoverage: counts.total > 0 ? (counts.withVideoId / counts.total) * 100 : 0,
      generatedAt: new Date().toISOString()
    };
    
    // Generate report content
    let reportContent: string;
    if (format === 'json') {
      reportContent = generateJsonReport(reportData);
    } else {
      reportContent = generateMarkdownReport(reportData);
    }
    
    // Output report
    if (outputPath) {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(outputPath, reportContent);
      console.log(`✓ Report saved to: ${outputPath}`);
    } else {
      console.log('\n' + reportContent);
    }
    
    // Summary
    console.log('\n=== Report Complete ===');
    console.log(`✓ Folder: ${folderHierarchy.name}`);
    console.log(`✓ Total items: ${counts.total}`);
    console.log(`✓ Coverage: ${reportData.videoIdCoverage.toFixed(1)}%`);
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Export for use as module
export { buildFolderHierarchy, generateMarkdownReport };

// Run if called directly
if (require.main === module) {
  main();
}