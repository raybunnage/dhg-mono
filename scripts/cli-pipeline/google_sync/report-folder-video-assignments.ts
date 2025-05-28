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

type SourcesGoogleRow = Database['public']['Tables']['google_sources']['Row'];

interface FolderItem {
  id: string;
  drive_id: string;
  name: string;
  mime_type: string;
  path_depth: number;
  main_video_id: string | null;
  path: string | null;
  isFolder: boolean;
  parent_folder_id: string | null;
  created_at: string | null;
  modified_at: string | null;
  document_type_id: string | null;
  document_type_name?: string;
  expert_document_id?: string;
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
    .from('google_sources')
    .select('*')
    .eq('drive_id', rootDriveId)
    .single();
  
  if (rootError || !rootFolder) {
    console.error('Root folder not found:', rootDriveId);
    return null;
  }
  
  // Get all items in this folder tree
  const { data: allItems, error: itemsError } = await supabase
    .from('google_sources')
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
  
  // Get document types for all items
  const { data: documentTypes } = await supabase
    .from('document_types')
    .select('id, name');
  
  const docTypeMap = new Map<string, string>();
  documentTypes?.forEach(dt => docTypeMap.set(dt.id, dt.name));
  
  // Get expert documents for all items
  const itemIds = allItems.map(item => item.id);
  const { data: expertDocs } = await supabase
    .from('expert_documents')
    .select('id, source_id')
    .in('source_id', itemIds);
  
  const expertDocMap = new Map<string, string>();
  expertDocs?.forEach(ed => expertDocMap.set(ed.source_id, ed.id));
  
  // Build hierarchy
  const itemMap = new Map<string, FolderItem>();
  
  // Convert to FolderItem format with all fields
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
      parent_folder_id: item.parent_folder_id,
      created_at: item.created_at,
      modified_at: item.modified_at,
      document_type_id: item.document_type_id,
      document_type_name: item.document_type_id ? docTypeMap.get(item.document_type_id) : undefined,
      expert_document_id: expertDocMap.get(item.id),
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
 * Format date for display
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleString();
}

/**
 * Generate markdown report content
 */
function generateMarkdownReport(data: ReportData): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`# Main Video ID Assignment Report`);
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push(`Mode: REPORT`);
  lines.push('');
  
  // Summary statistics
  lines.push('## Summary');
  lines.push(`- **Folder**: ${data.folder.name}`);
  lines.push(`- **Total Items**: ${data.totalItems}`);
  lines.push(`- **Items with Video ID**: ${data.itemsWithVideoId}`);
  lines.push(`- **Items without Video ID**: ${data.itemsWithoutVideoId}`);
  lines.push(`- **Coverage**: ${data.videoIdCoverage.toFixed(1)}%`);
  lines.push('');
  
  // Hierarchical view header
  lines.push('## Hierarchical View of Folder Structure');
  lines.push('');
  lines.push('Legend: ✓ = Has main_video_id | ✗ = Missing main_video_id | 📁 = Folder | 📄 = File');
  lines.push('');
  
  // Detailed folder information
  const printDetailedItem = (item: FolderItem, indent: string = '', isRoot: boolean = true) => {
    const icon = item.isFolder ? '📁' : '📄';
    const videoStatus = item.main_video_id ? '✓' : '✗';
    
    if (isRoot || item.path_depth === 0) {
      // High-level folder format
      lines.push(`### ${icon} ${item.name} (High-Level Folder)`);
      lines.push(`- **Path Depth**: ${item.path_depth}`);
      lines.push(`- **Drive ID**: ${item.drive_id}`);
      lines.push(`- **Supabase ID**: ${item.id}`);
      lines.push(`- **Parent Folder**: ${item.parent_folder_id || 'None (Root)'}`);
      lines.push(`- **Main Video ID**: ${item.main_video_id || 'Not assigned'}`);
      lines.push(`- **Created**: ${formatDate(item.created_at)}`);
      lines.push(`- **Modified**: ${formatDate(item.modified_at)}`);
      lines.push('');
      lines.push('**Contents:**');
      lines.push('');
    }
    
    // Print item with proper indentation
    if (!isRoot) {
      const docType = item.document_type_name || 'Unclassified';
      let itemLine = `${indent}${videoStatus} ${icon} ${item.name}`;
      
      if (!item.isFolder) {
        itemLine += `\n${indent}      Type: ${docType} | Video ID: ${item.main_video_id || 'None'}`;
        if (item.expert_document_id) {
          itemLine += `\n${indent}      Expert Doc ID: ${item.expert_document_id}`;
        }
        itemLine += `\n${indent}      Drive ID: ${item.drive_id}`;
        itemLine += `\n${indent}      Supabase ID: ${item.id}`;
      } else {
        itemLine += ` (${item.children?.length || 0} items)`;
        itemLine += `\n${indent}      Drive ID: ${item.drive_id}`;
        itemLine += `\n${indent}      Video ID: ${item.main_video_id || 'None'}`;
      }
      
      lines.push(itemLine);
    }
    
    // Process children
    if (item.children && item.children.length > 0) {
      // Sort children: folders first, then files
      const sortedChildren = [...item.children].sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      });
      
      sortedChildren.forEach(child => {
        const childIndent = isRoot ? '    ' : indent + '    ';
        printDetailedItem(child, childIndent, false);
      });
    }
  };
  
  printDetailedItem(data.folder);
  lines.push('');
  
  // Items without video ID section
  if (data.itemsWithoutVideoId > 0) {
    lines.push('──────────────────────────────────────────────────────────────────────────────────────────────────────────────');
    lines.push('');
    lines.push('## Items Missing Main Video ID');
    lines.push('');
    
    const listMissingItems = (item: FolderItem, path: string = '') => {
      const currentPath = path ? `${path}/${item.name}` : item.name;
      
      if (!item.main_video_id) {
        const itemType = item.isFolder ? 'Folder' : 'File';
        const docType = item.document_type_name || 'Unclassified';
        lines.push(`- **${currentPath}**`);
        lines.push(`  - Type: ${itemType} (${docType})`);
        lines.push(`  - Drive ID: ${item.drive_id}`);
        lines.push(`  - Supabase ID: ${item.id}`);
        if (item.expert_document_id) {
          lines.push(`  - Expert Doc ID: ${item.expert_document_id}`);
        }
        lines.push('');
      }
      
      if (item.children) {
        item.children.forEach(child => listMissingItems(child, currentPath));
      }
    };
    
    listMissingItems(data.folder);
  }
  
  // Next steps
  lines.push('## Next Steps');
  if (data.itemsWithoutVideoId > 0) {
    lines.push('- Run `assign-main-video-id` to assign video IDs to all items');
  } else {
    lines.push('- All items have main_video_id assigned ✓');
  }
  lines.push('- Run `classify-docs-service` for .docx/.txt files');
  lines.push('- Run `classify-pdfs` for PDF files');
  lines.push('- Run `classify-powerpoints` for PowerPoint files');
  lines.push('');
  
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
  
  try {
    // Display active filter prominently
    await displayActiveFilter();
    
    // Build folder hierarchy
    console.log('Building folder hierarchy...');
    const folderHierarchy = await buildFolderHierarchy(folderId!);
    
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