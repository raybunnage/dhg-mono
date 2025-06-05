import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';

/**
 * Lists high-level folders with main_video_id and their hierarchical contents.
 * Recursively displays:
 * 1. High-level folders (path_depth=0) with their main_video_id and video filename
 * 2. Files within each folder with: filename, document_type, main_video_id, and match status
 * 3. Subfolders with their path_depth and main_video_id
 * 
 * This provides a comprehensive view of all content associated with each main video folder.
 */

interface FolderInfo {
  id: string;             // Supabase UUID
  drive_id: string;       // Google Drive ID
  name: string;
  path_depth: number;
  main_video_id: string | null;
  main_video_name: string | null;
  document_type: string | null;
  parent_folder_id: string | null;  // Google Drive ID of parent
}

interface FileInfo {
  id: string;
  name: string;
  document_type: string | null;
  main_video_id: string | null;
  main_video_name: string | null;
  matches_parent_video_id: boolean;
}

// Define a type for the children from sources_google query
interface SourceItem {
  id: string;           // This is the Supabase UUID
  drive_id: string;     // This is the Google Drive ID, used for parent-child relationships
  name: string | null;
  path_depth: number | null;
  document_type_id: string | null;
  parent_folder_id: string | null;  // This stores the parent's Google Drive ID, not Supabase UUID
  main_video_id: string | null;
  mime_type: string | null;
}

const getSubFoldersAndFiles = async (
  supabase: any, 
  parentDriveId: string, // This is the Google Drive ID of the parent, not the Supabase UUID
  documentTypeMap: Map<string, string>,
  videoNameMap: Map<string, string>,
  parentMainVideoId: string | null,
  indent: string,
  output: MultiOutput = new MultiOutput() // Default to console-only output if not provided
): Promise<void> => {
  // First get all direct children of this folder - using parent_folder_id which matches the drive_id of the parent
  const { data: children, error: childrenError } = await supabase
    .from('google_sources')
    .select(`
      id,
      drive_id,
      name,
      path_depth,
      document_type_id,
      parent_folder_id,
      main_video_id,
      mime_type
    `)
    .eq('parent_folder_id', parentDriveId) // This is the Google Drive ID of the parent
    .order('name');

  if (childrenError) {
    output.log(`${indent}Error fetching children for folder ${parentDriveId}: ${JSON.stringify(childrenError, null, 2)}`);
    return;
  }

  if (!children || children.length === 0) {
    output.log(`${indent}No subfolders or files found`);
    return;
  }

  // Process subfolders - folders have mime_type 'application/vnd.google-apps.folder'
  const subfolders = children.filter((item: SourceItem) => 
    item.mime_type === 'application/vnd.google-apps.folder');
  
  // Filter out folders we've already processed to avoid duplicates
  // Use drive_id for uniqueness since we may have duplicate entries with different Supabase IDs
  const uniqueSubfolders = subfolders.filter((folder: SourceItem) => 
    !processedFiles.has(folder.drive_id));
  
  // Mark these folders as processed (we still want to process their contents)
  uniqueSubfolders.forEach((folder: SourceItem) => 
    processedFiles.add(folder.drive_id));
  
  // Display header for subfolders if any exist
  if (uniqueSubfolders.length > 0) {
    output.log(`${indent}Subfolders:`);
  }
  
  // Process each subfolder
  for (const folder of uniqueSubfolders) {
    const folderVideoId = folder.main_video_id || parentMainVideoId;
    const folderVideoName = folderVideoId ? (videoNameMap.get(folderVideoId) || 'Unknown Video') : 'None';
    const docType = folder.document_type_id ? documentTypeMap.get(folder.document_type_id) || 'Unknown' : 'Folder';
    
    output.log(`${indent}📁 ${folder.name} (Depth: ${folder.path_depth}) | Video: ${folderVideoName} | Type: ${docType}`);
    
    // Recursively process this subfolder's contents with increased indentation
    // Pass the drive_id (not the Supabase id) to match what's stored in parent_folder_id
    await getSubFoldersAndFiles(
      supabase, 
      folder.drive_id, 
      documentTypeMap, 
      videoNameMap, 
      folderVideoId,
      indent + '    ',
      output
    );
  }

  // Process files - anything that's not a folder
  const files = children.filter((item: SourceItem) => 
    item.mime_type !== 'application/vnd.google-apps.folder');
  
  // Filter out files we've already processed to avoid duplicates
  // Use drive_id for uniqueness since we may have duplicate entries with different Supabase IDs
  const uniqueFiles = files.filter((file: SourceItem) => 
    !processedFiles.has(file.drive_id));
  
  // Mark these files as processed
  uniqueFiles.forEach((file: SourceItem) => 
    processedFiles.add(file.drive_id));
  
  // Display header for files if any exist
  if (uniqueFiles.length > 0) {
    output.log(`${indent}Files:`);
    output.log(`${indent}${'Filename'.padEnd(50)} | ${'Document Type'.padEnd(30)} | ${'Main Video ID'.padEnd(30)} | ${'Matches Main?'}`);
    output.log(`${indent}${'-'.repeat(50)} | ${'-'.repeat(30)} | ${'-'.repeat(30)} | ${'-'.repeat(13)}`);
  }
  
  for (const file of uniqueFiles) {
    const docType = file.document_type_id ? documentTypeMap.get(file.document_type_id) || 'Unknown' : 'None';
    const fileVideoId = file.main_video_id || parentMainVideoId;
    const fileVideoName = fileVideoId ? (videoNameMap.get(fileVideoId) || 'Unknown Video') : 'None';
    
    // Check if file's video ID matches the parent folder's main video ID
    const matchesParentVideo = parentMainVideoId !== null && fileVideoId === parentMainVideoId;
    const matchStatus = matchesParentVideo ? '✅ Yes' : '❌ No';
    
    // Truncate filename if too long
    let displayName = file.name || 'Unknown';
    if (displayName.length > 47) {
      displayName = displayName.substring(0, 44) + '...';
    }
    
    // Display file information
    output.log(
      `${indent}${displayName.padEnd(50)} | ` +
      `${docType.padEnd(30)} | ` +
      `${fileVideoName.padEnd(30)} | ` +
      `${matchStatus}`
    );
  }
};

/**
 * Creates a timestamp string in the format YYYY-MM-DDTHH-MM-SS
 */
const getTimestamp = (): string => {
  const now = new Date();
  return now.toISOString().replace(/:/g, '-').split('.')[0];
};

/**
 * Custom console that writes to both console and a file
 */
class MultiOutput {
  private fileStream: fs.WriteStream | null = null;
  private filePath: string = '';

  constructor(outputPath?: string) {
    if (outputPath) {
      this.filePath = outputPath;
      // Ensure the directory exists
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

  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
    }
  }

  getFilePath(): string {
    return this.filePath;
  }
}

// Keep track of files we've already seen to avoid duplicates
const processedFiles = new Set<string>();

export const listMainVideoFoldersTree = async (options: { 
  outputFile?: boolean;
  outputPath?: string;
} = {}): Promise<void> => {
  // Reset the set of processed files at the start of each run
  processedFiles.clear();
  // Generate a timestamp for the report file
  const timestamp = getTimestamp();
  const reportDir = path.resolve(process.cwd(), 'docs/script-reports');
  
  // Use custom path if provided, otherwise generate default path
  const reportPath = options.outputPath || 
    path.join(reportDir, `main-video-folders-tree-${timestamp}.md`);
  
  // Create output handler that writes to both console and file
  const output = new MultiOutput(options.outputFile !== false ? reportPath : undefined);
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get high-level folders (path_depth = 0) with main_video_id that is not null
    const { data: highLevelFolders, error: folderError } = await supabase
      .from('google_sources')
      .select(`
        id,
        drive_id,
        name,
        path_depth,
        main_video_id,
        document_type_id,
        parent_folder_id,
        mime_type
      `)
      .eq('path_depth', 0)
      .is('is_root', false)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .order('name');

    if (folderError) {
      output.log('Error fetching high-level folders:' + JSON.stringify(folderError, null, 2));
      output.close();
      return;
    }

    if (!highLevelFolders || highLevelFolders.length === 0) {
      output.log('No high-level folders found.');
      output.close();
      return;
    }

    // Get document types for lookup
    const { data: documentTypeData, error: documentTypeError } = await supabase
      .from('document_types')
      .select('id, name');
    
    if (documentTypeError) {
      output.log('Error fetching document types:' + JSON.stringify(documentTypeError, null, 2));
      output.close();
      return;
    }
    
    // Create a lookup map for document types
    const documentTypeMap = new Map<string, string>();
    documentTypeData?.forEach((docType: { id: string; name: string }) => {
      documentTypeMap.set(docType.id, docType.name);
    });

    // Fetch all video files to use as a lookup for main_video_id values
    const { data: videoData, error: videoError } = await supabase
      .from('google_sources')
      .select('id, name')
      .like('mime_type', 'video/%');

    if (videoError) {
      output.log('Error fetching video names:' + JSON.stringify(videoError, null, 2));
      output.close();
      return;
    }

    // Create a lookup map for video names
    const videoNameMap = new Map<string, string>();
    videoData?.forEach((video: { id: string; name: string }) => {
      videoNameMap.set(video.id, video.name);
    });

    // Prepare the folder info array
    const folderInfo: FolderInfo[] = highLevelFolders.map(folder => {
      return {
        id: folder.id,
        drive_id: folder.drive_id,
        name: folder.name || 'Unknown',
        path_depth: folder.path_depth || 0,
        main_video_id: folder.main_video_id,
        main_video_name: folder.main_video_id ? videoNameMap.get(folder.main_video_id) || 'Unknown Video' : null,
        document_type: folder.document_type_id ? documentTypeMap.get(folder.document_type_id) || null : null,
        parent_folder_id: folder.parent_folder_id
      };
    });

    // Display the results
    output.log('\nHigh-Level Folders (path_depth=0) with Recursive Contents:');
    output.log('='.repeat(120));

    // Add high-level folders to processed set to avoid duplicates
    folderInfo.forEach((folder: FolderInfo) => 
      processedFiles.add(folder.drive_id)
    );
    
    // Process each high-level folder
    for (const folder of folderInfo) {
      // Display the main folder information with a prominent header
      output.log(`\n📁 ${folder.name} (High-Level Folder)`);
      output.log(`    Main Video ID: ${folder.main_video_id || 'None'}`);
      output.log(`    Main Video Filename: ${folder.main_video_name || 'None'}`);
      output.log(`    Document Type: ${folder.document_type || 'Folder'}`);
      output.log(`    ${'─'.repeat(100)}`);
      
      // Process subfolders and files recursively using the Google Drive ID
      await getSubFoldersAndFiles(
        supabase,
        folder.drive_id,  // Use drive_id to match with parent_folder_id in child records
        documentTypeMap,
        videoNameMap,
        folder.main_video_id,
        '    ',
        output
      );
    }
    
    output.log(`\nTotal high-level folders: ${folderInfo.length}`);
    output.log(`Total unique files and folders processed: ${processedFiles.size}`);
    output.log('='.repeat(120));
    
    // If we wrote to a file, inform the user
    if (output.getFilePath()) {
      console.log(`\nReport has been saved to: ${output.getFilePath()}`);
    }
    
    // Close the file stream
    output.close();

  } catch (error) {
    console.error('Unexpected error:', error);
    output.log('Unexpected error: ' + JSON.stringify(error, null, 2));
    output.close();
  }
};

// If this file is run directly
if (require.main === module) {
  const program = new Command();
  
  program
    .name('list-main-video-folders-tree')
    .description('List high-level folders with main_video_id and their hierarchical contents recursively')
    .option('--no-output-file', 'Disable writing output to a file')
    .option('-o, --output-path <path>', 'Custom output file path')
    .action((options) => {
      listMainVideoFoldersTree({
        outputFile: options.outputFile !== false,
        outputPath: options.outputPath
      });
    });
  
  program.parse(process.argv);
}