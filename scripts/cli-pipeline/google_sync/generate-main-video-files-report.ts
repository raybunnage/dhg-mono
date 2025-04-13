#!/usr/bin/env ts-node
/**
 * Generate Main Video Files Report
 * 
 * This script creates a markdown report of all files recursively beneath folders
 * at path_level 0 that have a main_video_id. For each file found, it shows the filename
 * and its main_video_id to help identify if the main_video_id is properly set for files
 * that could have a main_video_id.
 * 
 * Usage:
 *   ts-node generate-main-video-files-report.ts [options]
 * 
 * Options:
 *   --folder-id <id>    Specify a folder ID (default: Dynamic Healing Discussion Group)
 *   --verbose           Show detailed logs
 *   --output <path>     Path to write markdown output to (default: docs/cli-pipeline/main_video_files.md)
 *   --limit <number>    Limit the number of folders to process
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger, LogLevel } from '../../../packages/shared/utils/logger';

// Load environment variables
const envFiles = ['.env', '.env.development', '.env.local'];
for (const file of envFiles) {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`Loading environment variables from ${filePath}`);
    dotenv.config({ path: filePath });
  }
}

// Process command line arguments
const args = process.argv.slice(2);
const isVerbose = args.includes('--verbose');

if (isVerbose) {
  Logger.setLevel(LogLevel.DEBUG);
} else {
  Logger.setLevel(LogLevel.INFO);
}

// Get folder ID from command line or use default
const folderIdIndex = args.indexOf('--folder-id');
let folderId = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'; // Default: Dynamic Healing Discussion Group
if (folderIdIndex !== -1 && args[folderIdIndex + 1]) {
  folderId = args[folderIdIndex + 1];
}

// Set default output file
const outputIndex = args.indexOf('--output');
let outputFile = '/Users/raybunnage/Documents/github/dhg-mono/docs/cli-pipeline/main_video_files.md'; // Default output location
if (outputIndex !== -1 && args[outputIndex + 1]) {
  outputFile = args[outputIndex + 1];
}

// Limit number of folders to process
const limitIndex = args.indexOf('--limit');
let folderLimit = 0; // Default: process all folders
if (limitIndex !== -1 && args[limitIndex + 1]) {
  folderLimit = parseInt(args[limitIndex + 1], 10);
}

interface FolderInfo {
  id: string;
  name: string;
  drive_id: string;
  path: string;
  path_depth: number;
  main_video_id: string | null;
  files: FileInfo[];
}

interface FileInfo {
  id: string;
  name: string;
  mime_type: string;
  drive_id: string;
  path: string;
  main_video_id: string | null;
  document_type_id: string | null;
  document_type?: string;
}

/**
 * Main function to generate a report of files and their main_video_id values
 */
export async function generateMainVideoFilesReport(
  folderIdParam?: string,  
  verboseParam?: boolean,
  outputFileParam?: string,
  limitParam?: number
): Promise<void> {
  // Override the global parameters if provided
  const actualFolderId = folderIdParam || folderId;
  const actualOutputFile = outputFileParam || outputFile;
  const actualLimit = limitParam || folderLimit;
  
  if (verboseParam) {
    Logger.setLevel(LogLevel.DEBUG);
  }
  
  console.log('=== Generate Main Video Files Report (sources_google) ===');
  console.log(`Root Folder ID: ${actualFolderId}`);
  console.log('===================================================');

  // Initialize Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Step 1: Verify the root folder exists in sources_google
    const { data: rootFolder, error: rootFolderError } = await supabase
      .from('sources_google')
      .select('id, name, path, drive_id')
      .eq('drive_id', actualFolderId)
      .eq('is_deleted', false)
      .single();
    
    if (rootFolderError) {
      Logger.error(`Error fetching root folder info: ${rootFolderError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Root folder: "${rootFolder.name}" (${actualFolderId})`);
    
    // Step 2: Find all subfolders with path_depth = 0 that have a main_video_id
    const { data: targetFolders, error: targetFoldersError } = await supabase
      .from('sources_google')
      .select('id, name, path, drive_id, path_depth, main_video_id')
      .eq('parent_folder_id', actualFolderId)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .eq('is_deleted', false)
      .eq('path_depth', 0) // Specifically looking for direct children of the root
      .not('main_video_id', 'is', null) // Only folders with main_video_id
      .order('name');
    
    if (targetFoldersError) {
      Logger.error(`Error fetching target folders: ${targetFoldersError.message}`);
      process.exit(1);
    }
    
    if (!targetFolders || targetFolders.length === 0) {
      Logger.info('No folders with main_video_id found under the root folder.');
      return;
    }
    
    Logger.info(`Found ${targetFolders.length} folders with path_depth=0 and main_video_id under the root folder.\n`);
    
    // Apply folder limit if specified
    const foldersToProcess = actualLimit > 0 ? targetFolders.slice(0, actualLimit) : targetFolders;
    Logger.info(`Processing ${foldersToProcess.length} out of ${targetFolders.length} folders${actualLimit > 0 ? ' (limited by --limit)' : ''}`);
    
    // Step 3: For each target folder, get all files within it recursively
    let fileCount = 0;
    let folderCount = 0;
    
    const allFolderInfo: FolderInfo[] = [];
    
    // Create markdown content
    let reportContent = '# Main Video Files Report\n\n';
    reportContent += `Report generated on ${new Date().toISOString()}\n\n`;
    reportContent += `This report shows all files recursively found under folders at path_depth=0 that have a main_video_id set.\n`;
    reportContent += `For each file, it displays the filename and its main_video_id to help identify if the main_video_id is properly set.\n\n`;
    
    for (const folder of foldersToProcess) {
      folderCount++;
      Logger.debug(`Processing folder ${folderCount}/${foldersToProcess.length}: ${folder.name}`);
      
      // Create section for this folder
      reportContent += `## ${folder.name}\n\n`;
      reportContent += `Folder main_video_id: \`${folder.main_video_id}\`\n\n`;
      
      // Find all files under this folder using the path_array
      const { data: folderFiles, error: folderFilesError } = await supabase
        .from('sources_google')
        .select('id, name, mime_type, path, drive_id, main_video_id, document_type_id')
        .contains('path_array', [folder.name])
        .eq('is_deleted', false)
        .not('mime_type', 'eq', 'application/vnd.google-apps.folder') // Exclude folders
        .order('path');
      
      if (folderFilesError) {
        Logger.error(`Error fetching files for folder ${folder.name}: ${folderFilesError.message}`);
        reportContent += `Error fetching files: ${folderFilesError.message}\n\n`;
        continue;
      }
      
      if (!folderFiles || folderFiles.length === 0) {
        reportContent += `No files found under this folder.\n\n`;
        continue;
      }
      
      fileCount += folderFiles.length;
      
      // Collect unique document_type_ids for lookup
      const documentTypeIds = folderFiles
        .map(file => file.document_type_id)
        .filter(id => id !== null) as string[];
      
      // Fetch document_types for these IDs
      const documentTypeMap: Record<string, string> = {};
      
      if (documentTypeIds.length > 0) {
        const { data: documentTypes, error: documentTypesError } = await supabase
          .from('document_types')
          .select('id, document_type')
          .in('id', documentTypeIds);
          
        if (!documentTypesError && documentTypes) {
          for (const docType of documentTypes) {
            documentTypeMap[docType.id] = docType.document_type;
          }
        } else if (documentTypesError) {
          Logger.error(`Error fetching document types: ${documentTypesError.message}`);
        }
      }
      
      // Add table headers
      reportContent += `| File Path | Document Type | Main Video ID | Match Status |\n`;
      reportContent += `|-----------|--------------|--------------|-------------|\n`;
      
      // Process each file
      const files: FileInfo[] = [];
      
      for (const file of folderFiles) {
        // Get document type name if available
        const documentType = file.document_type_id 
          ? (documentTypeMap[file.document_type_id] || `Unknown (${file.document_type_id})`) 
          : '-';
          
        files.push({
          id: file.id,
          name: file.name,
          mime_type: file.mime_type,
          drive_id: file.drive_id,
          path: file.path,
          main_video_id: file.main_video_id,
          document_type_id: file.document_type_id,
          document_type: documentType
        });
        
        // Determine match status
        let matchStatus = 'Missing';
        
        if (file.main_video_id) {
          if (file.main_video_id === folder.main_video_id) {
            matchStatus = '✅ Matches Folder';
          } else {
            matchStatus = '❌ Different';
          }
        }
        
        // Add file to the table, keeping it on one line
        reportContent += `| ${file.path} | ${documentType} | ${file.main_video_id || 'null'} | ${matchStatus} |\n`;
      }
      
      // Add a blank line after the table
      reportContent += `\n`;
      
      // Store folder info
      allFolderInfo.push({
        ...folder,
        files
      });
    }
    
    // Add summary
    reportContent += `## Summary\n\n`;
    reportContent += `- Total folders processed: ${folderCount}\n`;
    reportContent += `- Total files found: ${fileCount}\n`;
    
    // Write to output file if specified
    if (actualOutputFile) {
      try {
        // Create directory if it doesn't exist
        const dir = path.dirname(actualOutputFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Write to file
        fs.writeFileSync(actualOutputFile, reportContent);
        Logger.info(`Report written to ${actualOutputFile}`);
      } catch (writeError: any) {
        Logger.error(`Error writing to output file: ${writeError.message}`);
      }
    }
    
    // Display confirmation
    console.log(`Report generation complete. Found ${fileCount} files across ${folderCount} folders.`);
    
  } catch (error: any) {
    Logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Execute main function if run directly
if (require.main === module) {
  generateMainVideoFilesReport().catch(error => {
    Logger.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  });
}