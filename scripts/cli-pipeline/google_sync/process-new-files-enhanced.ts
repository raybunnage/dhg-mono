#!/usr/bin/env ts-node
/**
 * Enhanced Process New Files with Hierarchical Report
 * 
 * This command:
 * 1. Finds sources_google files without expert_documents records
 * 2. Assigns main_video_id using recursive search from high-level folders
 * 3. Creates expert_documents records
 * 4. Generates a detailed hierarchical report showing:
 *    - Complete folder hierarchy from high-level folder down
 *    - All files and folders (existing and new)
 *    - Expert document creation status
 *    - Video associations
 * 
 * Usage:
 *   ts-node process-new-files-enhanced.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be processed without making changes
 *   --limit <n>        Limit number of files to process (default: 100)
 *   --verbose          Show detailed logs
 *   --output-file      Save report to a file (default: true)
 *   --no-output-file   Disable file output
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { getActiveFilterProfile } from './get-active-filter-profile';
import { fileService } from '../../../packages/shared/services/file-service';
import { createWriteStream } from 'fs';

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
const outputToFile = !args.includes('--no-output-file');

const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 && args[limitIndex + 1] 
  ? parseInt(args[limitIndex + 1], 10) 
  : 100;

// Create Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

/**
 * Multi-output handler for console and file
 */
class MultiOutput {
  private fileStream: fs.WriteStream | null = null;
  private filePath: string = '';

  constructor(outputPath?: string) {
    if (outputPath) {
      this.filePath = outputPath;
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.fileStream = createWriteStream(outputPath);
    }
  }

  log(message: string): void {
    console.log(message);
    if (this.fileStream) {
      this.fileStream.write(message + '\n');
    }
  }

  async close(): Promise<void> {
    if (this.fileStream) {
      return new Promise((resolve) => {
        this.fileStream!.end(() => {
          resolve();
        });
      });
    }
  }

  getFilePath(): string {
    return this.filePath;
  }
}

interface FileNode {
  id: string;
  drive_id: string;
  name: string;
  mime_type: string;
  path_depth: number;
  main_video_id: string | null;
  document_type_id: string | null;
  parent_folder_id: string | null;
  created_at: string;
  modified_at: string;
  is_new: boolean;
  expert_document_id?: string;
  children?: FileNode[];
}

interface HighLevelFolder {
  id: string;
  drive_id: string;
  name: string;
  path_depth: number;
  main_video_id: string | null;
  main_video_name: string | null;
  parent_folder_id: string | null;
  created_at: string;
  modified_at: string;
}

interface ProcessResult {
  filesProcessed: number;
  expertDocsCreated: number;
  filesSkipped: number;
  errors: string[];
  duration: number;
  hierarchies: Map<string, FileNode>; // High-level folder drive_id -> tree
  newExpertDocuments: Array<{
    id: string;
    source_id: string;
    source_name: string;
    main_video_name: string | null;
    created_at: string;
  }>;
}

// Supported file types for processing
const PROCESSABLE_EXTENSIONS = [
  '.txt', '.docx', '.pdf', '.pptx', '.mp4', '.webm', 
  '.mov', '.avi', '.mkv', '.m4v', '.mp3', '.wav', 
  '.aac', '.m4a', '.flac', '.wma'
];

// Skip processing file types
const SKIP_PROCESSING_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg',
  '.ico', '.webp', '.tiff', '.zip', '.rar', '.tar',
  '.gz', '.7z', '.exe', '.dmg', '.pkg', '.deb',
  '.rpm', '.iso', '.bin', '.dat'
];

/**
 * Determine processing status based on file type
 */
function determineProcessingStatus(filename: string, mimeType: string): {
  status: string;
  skipReason?: string;
} {
  const ext = path.extname(filename).toLowerCase();
  
  if (PROCESSABLE_EXTENSIONS.includes(ext)) {
    return { status: 'needs_reprocessing' };
  }
  
  if (SKIP_PROCESSING_EXTENSIONS.includes(ext)) {
    return {
      status: 'skip_processing',
      skipReason: `File type ${ext} is not suitable for content extraction`
    };
  }
  
  if (mimeType?.startsWith('application/vnd.google-apps.')) {
    const googleType = mimeType.replace('application/vnd.google-apps.', '');
    switch (googleType) {
      case 'document':
      case 'spreadsheet':
      case 'presentation':
        return { status: 'needs_reprocessing' };
      case 'folder':
        return {
          status: 'skip_processing',
          skipReason: 'Folders do not contain extractable content'
        };
      default:
        return {
          status: 'skip_processing',
          skipReason: `Google ${googleType} type not supported for extraction`
        };
    }
  }
  
  return {
    status: 'skip_processing',
    skipReason: `Unknown file type: ${ext || 'no extension'}`
  };
}

/**
 * Build hierarchical tree for a high-level folder using file-service
 */
async function buildFolderHierarchy(
  highLevelFolder: HighLevelFolder,
  newFileIds: Set<string>,
  newFolderIds: Set<string>,
  newExpertDocs: Map<string, { id: string; created_at: string }>,
  videoNameMap: Map<string, string>
): Promise<FileNode> {
  // Create the root node for the high-level folder
  const rootNode: FileNode = {
    id: highLevelFolder.id,
    drive_id: highLevelFolder.drive_id,
    name: highLevelFolder.name,
    mime_type: 'application/vnd.google-apps.folder',
    path_depth: 0,
    main_video_id: highLevelFolder.main_video_id,
    document_type_id: null,
    parent_folder_id: null,
    created_at: highLevelFolder.created_at,
    modified_at: highLevelFolder.modified_at,
    is_new: false,
    children: []
  };

  // Map to store nodes by drive_id for building relationships
  const nodeMap = new Map<string, FileNode>();
  nodeMap.set(rootNode.drive_id, rootNode);

  // Use file-service to traverse the folder recursively
  const traversalResult = await fileService.traverseGoogleDriveFolder(
    supabase,
    highLevelFolder.drive_id,
    {
      includeFiles: true,
      includeFolders: true,
      onItemProcessed: (item, depth) => {
        // Create node for this item
        const node: FileNode = {
          id: item.id,
          drive_id: item.drive_id,
          name: item.name || 'Unknown',
          mime_type: item.mime_type || '',
          path_depth: item.path_depth || depth,
          main_video_id: item.main_video_id,
          document_type_id: item.document_type_id,
          parent_folder_id: item.parent_folder_id,
          created_at: '',  // Not available from traversal
          modified_at: '',  // Not available from traversal
          is_new: newFileIds.has(item.id) || newFolderIds.has(item.id),
          children: []
        };

        // Add expert document ID if this is a new file
        if (newExpertDocs.has(item.id)) {
          node.expert_document_id = newExpertDocs.get(item.id)?.id;
        }

        // Store node in map
        nodeMap.set(item.drive_id, node);
      }
    }
  );

  // Second pass: build parent-child relationships
  for (const [driveId, node] of Array.from(nodeMap.entries())) {
    if (node.parent_folder_id && nodeMap.has(node.parent_folder_id)) {
      const parent = nodeMap.get(node.parent_folder_id);
      if (parent && node !== rootNode) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      }
    }
  }

  // If we need the created_at and modified_at dates, fetch them separately
  const allDriveIds = Array.from(nodeMap.keys());
  if (allDriveIds.length > 1) { // More than just the root
    const { data: itemDetails } = await supabase
      .from('sources_google')
      .select('drive_id, created_at, modified_at')
      .in('drive_id', allDriveIds);

    if (itemDetails) {
      for (const detail of itemDetails) {
        const node = nodeMap.get(detail.drive_id);
        if (node) {
          node.created_at = detail.created_at;
          node.modified_at = detail.modified_at;
        }
      }
    }
  }

  return rootNode;
}

/**
 * Print files in a markdown table format
 */
function printFilesTable(
  files: FileNode[],
  output: MultiOutput,
  indent: string,
  videoNameMap: Map<string, string>,
  documentTypeMap: Map<string, string>
) {
  if (files.length === 0) return;
  
  output.log(`${indent}Files:`);
  output.log(`${indent}| Status | ${'Filename'.padEnd(45)} | ${'Document Type'.padEnd(25)} | ${'Main Video ID'.padEnd(36)} | ${'Video Name'.padEnd(25)} |`);
  output.log(`${indent}|--------|${'-'.repeat(45)}--|${'-'.repeat(25)}--|${'-'.repeat(36)}--|${'-'.repeat(25)}--|`);
  
  for (const file of files) {
    const status = file.is_new ? '🆕 New' : '✓ Exist';
    const docType = file.document_type_id ? 
      documentTypeMap.get(file.document_type_id) || 'Unknown' : 
      'Unclassified';
    
    // Truncate filename if too long
    let displayName = file.name || 'Unknown';
    if (displayName.length > 43) {
      displayName = displayName.substring(0, 40) + '...';
    }
    
    // Get video name
    const videoId = file.main_video_id || 'None';
    const videoName = file.main_video_id ? 
      (videoNameMap.get(file.main_video_id) || 'Unknown Video') : 
      'None';
    
    // Truncate video name if needed
    let displayVideoName = videoName;
    if (displayVideoName.length > 23) {
      displayVideoName = displayVideoName.substring(0, 20) + '...';
    }
    
    // Truncate document type if needed
    let displayDocType = docType;
    if (displayDocType.length > 23) {
      displayDocType = displayDocType.substring(0, 20) + '...';
    }
    
    output.log(
      `${indent}| ${status.padEnd(6)} | ${displayName.padEnd(45)} | ${displayDocType.padEnd(25)} | ${videoId.padEnd(36)} | ${displayVideoName.padEnd(25)} |`
    );
  }
  output.log('');
}

/**
 * Print the hierarchical tree with folders and tables for files
 */
function printHierarchicalStructure(
  node: FileNode,
  output: MultiOutput,
  indent: string = '',
  videoNameMap: Map<string, string>,
  documentTypeMap: Map<string, string>,
  depth: number = 0
) {
  const isFolder = node.mime_type === 'application/vnd.google-apps.folder';
  
  if (isFolder) {
    const icon = '📁';
    const statusIcon = node.is_new ? '🆕' : '';
    const folderVideoName = node.main_video_id ? 
      (videoNameMap.get(node.main_video_id) || 'Unknown Video') : 
      'No Video';
    
    // Display folder with status
    if (depth === 0) {
      // High-level folder - already displayed in header
      // Just process children
    } else {
      // Subfolder
      output.log(`${indent}${statusIcon} ${icon} ${node.name || 'Unknown'} (Depth: ${node.path_depth}) | Main Video: ${folderVideoName}`);
    }
    
    // Process children: separate folders and files
    if (node.children && node.children.length > 0) {
      const childFolders = node.children.filter(c => c.mime_type === 'application/vnd.google-apps.folder');
      const childFiles = node.children.filter(c => c.mime_type !== 'application/vnd.google-apps.folder');
      
      // Sort folders by name
      childFolders.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      // Display subfolders first
      if (childFolders.length > 0 && depth > 0) {
        output.log(`${indent}Subfolders:`);
      }
      for (const folder of childFolders) {
        printHierarchicalStructure(folder, output, indent + '    ', videoNameMap, documentTypeMap, depth + 1);
      }
      
      // Display files in table format
      if (childFiles.length > 0) {
        // Sort files by name
        childFiles.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        printFilesTable(childFiles, output, indent, videoNameMap, documentTypeMap);
      }
    }
  }
}

/**
 * Enhanced process new files with hierarchical reporting
 */
async function processNewFilesEnhanced(rootDriveId?: string): Promise<ProcessResult> {
  const startTime = Date.now();
  const result: ProcessResult = {
    filesProcessed: 0,
    expertDocsCreated: 0,
    filesSkipped: 0,
    errors: [],
    duration: 0,
    hierarchies: new Map(),
    newExpertDocuments: []
  };
  
  try {
    // Build query for files AND folders needing processing
    // Include folders to catch the edge case where new folders are created
    // Order by created_at descending to get newest items first
    let query = supabase
      .from('sources_google')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .order('path_depth', { ascending: false })
      .limit(limit);
    
    if (rootDriveId) {
      query = query.eq('root_drive_id', rootDriveId);
    }
    
    const { data: pendingFiles, error: queryError } = await query;
    
    if (queryError) throw queryError;
    
    if (!pendingFiles || pendingFiles.length === 0) {
      console.log('✓ No new files to process');
      result.duration = (Date.now() - startTime) / 1000;
      return result;
    }
    
    console.log(`📋 Found ${pendingFiles.length} items to check`);
    
    // Separate folders and files
    const folders = pendingFiles.filter(f => f.mime_type === 'application/vnd.google-apps.folder');
    const files = pendingFiles.filter(f => f.mime_type !== 'application/vnd.google-apps.folder');
    
    console.log(`   - ${folders.length} folders`);
    console.log(`   - ${files.length} files`);
    
    // Check which files already have expert_documents (folders don't need expert_documents)
    let filesToProcess = [];
    if (files.length > 0) {
      const fileIds = files.map(f => f.id);
      const { data: existingExpDocs } = await supabase
        .from('expert_documents')
        .select('source_id')
        .in('source_id', fileIds);
      
      const existingSourceIds = new Set((existingExpDocs || []).map(e => e.source_id));
      filesToProcess = files.filter(f => !existingSourceIds.has(f.id));
    }
    
    console.log(`📝 ${filesToProcess.length} files need expert_documents records`);
    
    if (filesToProcess.length === 0 && folders.length === 0) {
      console.log('No new files or folders to process');
      result.duration = (Date.now() - startTime) / 1000;
      return result;
    }

    // Get ALL video names for mapping (not just video mime types)
    // Include all files that might be referenced as main_video_id
    const { data: allVideoFiles } = await supabase
      .from('sources_google')
      .select('id, name, mime_type')
      .or('mime_type.like.video/%,name.ilike.%.mp4,name.ilike.%.webm,name.ilike.%.mov,name.ilike.%.avi');
    
    const videoNameMap = new Map<string, string>();
    if (allVideoFiles) {
      for (const video of allVideoFiles) {
        if (video.id && video.name) {
          videoNameMap.set(video.id, video.name);
        }
      }
    }
    
    console.log(`📹 Found ${videoNameMap.size} video files for name mapping`);

    // Get document types for mapping
    const { data: documentTypeData } = await supabase
      .from('document_types')
      .select('id, name');
    
    const documentTypeMap = new Map<string, string>();
    documentTypeData?.forEach((docType: { id: string; name: string }) => {
      documentTypeMap.set(docType.id, docType.name);
    });
    
    if (isDryRun) {
      console.log('DRY RUN: Would process these files:');
      filesToProcess.slice(0, 10).forEach(f => {
        const { status, skipReason } = determineProcessingStatus(f.name, f.mime_type);
        console.log(`  - ${f.name} → ${status}${skipReason ? ` (${skipReason})` : ''}`);
      });
      if (filesToProcess.length > 10) {
        console.log(`  ... and ${filesToProcess.length - 10} more files`);
      }
      result.filesProcessed = filesToProcess.length;
      result.duration = (Date.now() - startTime) / 1000;
      return result;
    }
    
    // Reset the file service's processed items tracker
    fileService.resetProcessedItems();
    
    // PHASE 1: Assign main_video_id to high-level folders
    console.log('\n🔍 Phase 1: Assigning main_video_id to high-level folders...');
    
    // Get high-level folders
    const allHighLevelFolders = await fileService.getHighLevelFolders(supabase, false);
    let foldersWithVideo = 0;
    let totalItemsUpdated = 0;
    
    for (const folder of allHighLevelFolders) {
      if (!folder.main_video_id) {
        // Traverse the folder to find a main video
        const traversalResult = await fileService.traverseGoogleDriveFolder(
          supabase,
          folder.drive_id,
          {
            includeFiles: true,
            includeFolders: false,
            onItemProcessed: async (item) => {
              // Look for MP4 files as main videos
              if (item.mime_type === 'video/mp4' && item.name?.toLowerCase().endsWith('.mp4')) {
                // Update the high-level folder with main_video_id
                await supabase
                  .from('sources_google')
                  .update({ main_video_id: item.id })
                  .eq('drive_id', folder.drive_id);
                
                // Update all nested items
                const nestedResult = await fileService.traverseGoogleDriveFolder(
                  supabase,
                  folder.drive_id,
                  { includeFiles: true, includeFolders: true }
                );
                
                const allItemIds = [
                  ...nestedResult.folders.map(f => f.id),
                  ...nestedResult.files.map(f => f.id)
                ];
                
                if (allItemIds.length > 0) {
                  await supabase
                    .from('sources_google')
                    .update({ main_video_id: item.id })
                    .in('id', allItemIds);
                  
                  totalItemsUpdated += allItemIds.length;
                }
                
                folder.main_video_id = item.id;
                foldersWithVideo++;
                return;
              }
            }
          }
        );
      }
    }
    
    if (foldersWithVideo > 0) {
      console.log(`✅ Assigned main_video_id to ${foldersWithVideo} high-level folders`);
      console.log(`✅ Updated main_video_id for ${totalItemsUpdated} total items`);
    } else {
      console.log('ℹ️  All high-level folders already have main_video_id assigned');
    }
    
    // PHASE 2: Process new files and create expert documents
    console.log('\n📝 Phase 2: Creating expert_documents records...');
    
    const newFileIds = new Set<string>(filesToProcess.map(f => f.id));
    const newFolderIds = new Set<string>(folders.map(f => f.id));
    const newExpertDocsMap = new Map<string, { id: string; created_at: string }>();
    
    if (newFolderIds.size > 0) {
      console.log(`📁 Found ${newFolderIds.size} new folders`);
    }
    
    // Process files in batches
    const BATCH_SIZE = 50;
    const batches = Math.ceil(filesToProcess.length / BATCH_SIZE);
    
    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, filesToProcess.length);
      const batch = filesToProcess.slice(start, end);
      
      const expertDocsToInsert = [];
      
      for (const file of batch) {
        const { status, skipReason } = determineProcessingStatus(file.name, file.mime_type);
        
        // Get main_video_id for this file
        let currentMainVideoId = file.main_video_id;
        
        if (!currentMainVideoId && file.path_depth > 0) {
          // Find the high-level folder for this file by traversing up
          let currentItem = file;
          while (currentItem.path_depth > 0 && currentItem.parent_folder_id) {
            const { data: parentFolder } = await supabase
              .from('sources_google')
              .select('*')
              .eq('drive_id', currentItem.parent_folder_id)
              .single();
            
            if (parentFolder) {
              currentItem = parentFolder;
              if (parentFolder.main_video_id) {
                currentMainVideoId = parentFolder.main_video_id;
                break;
              }
            } else {
              break;
            }
          }
          
          if (currentMainVideoId) {
            // Update the sources_google record
            await supabase
              .from('sources_google')
              .update({ main_video_id: currentMainVideoId })
              .eq('id', file.id);
          }
        }
        
        const expertDocId = uuidv4();
        const createdAt = new Date().toISOString();
        
        expertDocsToInsert.push({
          id: expertDocId,
          source_id: file.id,
          reprocessing_status: status === 'needs_reprocessing' ? 'needs_reprocessing' : 
                              status === 'skip_processing' ? 'skip_processing' : 'not_set',
          reprocessing_status_updated_at: createdAt,
          created_at: createdAt,
          updated_at: createdAt,
          document_type_id: null,
          processing_skip_reason: skipReason
        });
        
        newExpertDocsMap.set(file.id, { id: expertDocId, created_at: createdAt });
        
        result.filesProcessed++;
      }
      
      // Insert expert_documents records
      if (expertDocsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('expert_documents')
          .insert(expertDocsToInsert);
        
        if (insertError) {
          result.errors.push(`Batch ${i + 1} insert error: ${insertError.message}`);
          result.filesSkipped += expertDocsToInsert.length;
        } else {
          result.expertDocsCreated += expertDocsToInsert.length;
          console.log(`✓ Created ${expertDocsToInsert.length} expert_documents in batch ${i + 1}/${batches}`);
        }
      }
    }
    
    // PHASE 3: Build hierarchical report
    console.log('\n📊 Phase 3: Building hierarchical report...');
    
    // Get all affected high-level folders
    const affectedHighLevelFolders = new Set<string>();
    
    // Include high-level folders for new files
    for (const file of filesToProcess) {
      if (file.path_depth === 0) {
        affectedHighLevelFolders.add(file.drive_id);
      } else {
        // Find the high-level folder for this file by traversing up
        let currentItem = file;
        while (currentItem.path_depth > 0 && currentItem.parent_folder_id) {
          const { data: parentFolder } = await supabase
            .from('sources_google')
            .select('*')
            .eq('drive_id', currentItem.parent_folder_id)
            .single();
          
          if (parentFolder) {
            currentItem = parentFolder;
            if (currentItem.path_depth === 0) {
              affectedHighLevelFolders.add(currentItem.drive_id);
              break;
            }
          } else {
            break;
          }
        }
      }
    }
    
    // IMPORTANT: Also include high-level folders for new folders (edge case)
    for (const folder of folders) {
      if (folder.path_depth === 0) {
        affectedHighLevelFolders.add(folder.drive_id);
      } else {
        // Find the high-level folder for this folder by traversing up
        let currentItem = folder;
        while (currentItem.path_depth > 0 && currentItem.parent_folder_id) {
          const { data: parentFolder } = await supabase
            .from('sources_google')
            .select('*')
            .eq('drive_id', currentItem.parent_folder_id)
            .single();
          
          if (parentFolder) {
            currentItem = parentFolder;
            if (currentItem.path_depth === 0) {
              affectedHighLevelFolders.add(currentItem.drive_id);
              break;
            }
          } else {
            break;
          }
        }
      }
    }
    
    // Get details for all affected high-level folders
    const { data: highLevelFolders } = await supabase
      .from('sources_google')
      .select('*')
      .in('drive_id', Array.from(affectedHighLevelFolders))
      .eq('path_depth', 0);
    
    // Build hierarchy for each high-level folder
    for (const folder of (highLevelFolders || [])) {
      // Get video name for main_video_id
      const mainVideoName = folder.main_video_id ? 
        (videoNameMap.get(folder.main_video_id) || null) : 
        null;
      
      // Create HighLevelFolder object
      const hlFolder: HighLevelFolder = {
        id: folder.id,
        drive_id: folder.drive_id,
        name: folder.name,
        path_depth: folder.path_depth,
        main_video_id: folder.main_video_id,
        main_video_name: mainVideoName,
        parent_folder_id: folder.parent_folder_id,
        created_at: folder.created_at,
        modified_at: folder.modified_at
      };
      
      const tree = await buildFolderHierarchy(
        hlFolder,
        newFileIds,
        newFolderIds,
        newExpertDocsMap,
        videoNameMap
      );
      result.hierarchies.set(folder.drive_id, tree);
    }
    
    // Build list of new expert documents with details
    for (const file of filesToProcess) {
      const expertDoc = newExpertDocsMap.get(file.id);
      if (expertDoc) {
        // Get the main_video_id from the file
        const videoName = file.main_video_id ? 
          (videoNameMap.get(file.main_video_id) || 'Unknown Video') : 
          null;
        
        result.newExpertDocuments.push({
          id: expertDoc.id,
          source_id: file.id,
          source_name: file.name,
          main_video_name: videoName,
          created_at: expertDoc.created_at
        });
      }
    }
    
  } catch (error: any) {
    console.error('❌ Processing error:', error.message);
    result.errors.push(error.message);
  }
  
  result.duration = (Date.now() - startTime) / 1000;
  return result;
}

/**
 * Generate timestamp for file names
 */
function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/:/g, '-').split('.')[0];
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Enhanced Process New Files ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit} files`);
  console.log('==================================\n');
  
  // Set up output
  const timestamp = getTimestamp();
  const reportPath = outputToFile ? 
    path.join(process.cwd(), 'docs/script-reports', `process-new-files-report-${timestamp}.md`) : 
    undefined;
  
  const output = new MultiOutput(reportPath);
  
  try {
    // Check for active filter profile
    const activeFilter = await getActiveFilterProfile();
    let rootDriveId: string | undefined;
    
    if (activeFilter && activeFilter.rootDriveId) {
      console.log(`🔍 Active filter: "${activeFilter.profile.name}"`);
      console.log(`📁 Using root_drive_id: ${activeFilter.rootDriveId}\n`);
      rootDriveId = activeFilter.rootDriveId;
    }
    
    // Process new files
    const result = await processNewFilesEnhanced(rootDriveId);
    
    // Get document type mapping
    const { data: documentTypeData } = await supabase
      .from('document_types')
      .select('id, name');
    
    const documentTypeMap = new Map<string, string>();
    documentTypeData?.forEach((docType: { id: string; name: string }) => {
      documentTypeMap.set(docType.id, docType.name);
    });
    
    // Get video name mapping - same as in processNewFilesEnhanced
    const { data: allVideoFiles } = await supabase
      .from('sources_google')
      .select('id, name, mime_type')
      .or('mime_type.like.video/%,name.ilike.%.mp4,name.ilike.%.webm,name.ilike.%.mov,name.ilike.%.avi');
    
    const videoNameMap = new Map<string, string>();
    if (allVideoFiles) {
      for (const video of allVideoFiles) {
        if (video.id && video.name) {
          videoNameMap.set(video.id, video.name);
        }
      }
    }
    
    // Generate the report
    output.log('# Process New Files Report');
    output.log(`Generated: ${new Date().toISOString()}`);
    output.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
    output.log('');
    
    output.log('## Summary');
    output.log(`- Files processed: ${result.filesProcessed}`);
    output.log(`- Expert documents created: ${result.expertDocsCreated}`);
    output.log(`- Files skipped: ${result.filesSkipped}`);
    output.log(`- Errors: ${result.errors.length}`);
    output.log(`- Duration: ${result.duration.toFixed(1)}s`);
    output.log('');
    
    if (result.errors.length > 0) {
      output.log('## Errors');
      result.errors.forEach(err => output.log(`- ${err}`));
      output.log('');
    }
    
    // Display new expert documents table
    if (result.newExpertDocuments.length > 0) {
      output.log('## New Expert Documents Created');
      output.log('');
      output.log('| Source Name                             | Main Video                    | Expert Doc ID                        | Created            |');
      output.log('|-----------------------------------------|-------------------------------|--------------------------------------|--------------------|');
      
      for (const doc of result.newExpertDocuments) {
        const truncatedName = doc.source_name.length > 40 ? 
          doc.source_name.substring(0, 37) + '...' : 
          doc.source_name.padEnd(40);
        const videoName = (doc.main_video_name || 'No Video').length > 30 ?
          (doc.main_video_name || 'No Video').substring(0, 27) + '...' :
          (doc.main_video_name || 'No Video').padEnd(30);
        const createdDate = new Date(doc.created_at).toLocaleString();
        
        output.log(`| ${truncatedName} | ${videoName} | ${doc.id} | ${createdDate.padEnd(18)} |`);
      }
      output.log('');
    }
    
    // Display hierarchical view
    if (result.hierarchies.size > 0) {
      output.log('## Hierarchical View of Affected Folders');
      output.log('');
      output.log('Legend: 🆕 = New file | ✓ = Existing file | 📁 = Folder | 📄 = File');
      output.log('');
      // Don't show column headers for hierarchical view - it's not a table
      
      // Sort hierarchies by folder name
      const sortedHierarchies = Array.from(result.hierarchies.entries()).sort((a, b) => {
        return (a[1].name || '').localeCompare(b[1].name || '');
      });
      
      for (const [driveId, tree] of sortedHierarchies) {
        output.log(`### 📁 ${tree.name} (High-Level Folder)`);
        output.log(`- **Path Depth**: ${tree.path_depth}`);
        output.log(`- **Drive ID**: ${tree.drive_id}`);
        output.log(`- **Supabase ID**: ${tree.id}`);
        output.log(`- **Parent Folder**: ${tree.parent_folder_id || 'None (Root)'}`);
        output.log(`- **Main Video ID**: ${tree.main_video_id || 'None'}`);
        output.log(`- **Main Video**: ${tree.main_video_id ? (videoNameMap.get(tree.main_video_id) || 'Unknown Video') : 'None'}`);
        output.log(`- **Created**: ${new Date(tree.created_at).toLocaleString()}`);
        output.log(`- **Modified**: ${new Date(tree.modified_at).toLocaleString()}`);
        output.log('');
        output.log('**Contents:**');
        output.log('');
        
        // Print the hierarchical structure
        printHierarchicalStructure(tree, output, '', videoNameMap, documentTypeMap);
        output.log('');
        output.log('─'.repeat(110));
        output.log('');
      }
    }
    
    if (result.expertDocsCreated > 0) {
      output.log('## Next Steps');
      output.log('- Run `classify-docs-service` for .docx/.txt files');
      output.log('- Run `classify-pdfs` for PDF files');
      output.log('- Run `classify-powerpoints` for PowerPoint files');
      output.log('');
    }
    
    // Display results summary
    console.log('\n=== Processing Complete ===');
    console.log(`✓ Files processed: ${result.filesProcessed}`);
    console.log(`✓ Expert docs created: ${result.expertDocsCreated}`);
    console.log(`✓ Files skipped: ${result.filesSkipped}`);
    console.log(`✓ Errors: ${result.errors.length}`);
    console.log(`✓ Duration: ${result.duration.toFixed(1)}s`);
    
    if (reportPath) {
      console.log(`\n📄 Report saved to: ${reportPath}`);
    }
    
    await output.close();
    process.exit(result.errors.length > 0 ? 1 : 0);
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    await output.close();
    process.exit(1);
  }
}

// Export for use as module
export { processNewFilesEnhanced };

// Run if called directly
if (require.main === module) {
  main();
}