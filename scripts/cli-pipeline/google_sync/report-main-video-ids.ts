#!/usr/bin/env ts-node
/**
 * Report Main Video IDs
 * 
 * This script reports on main_video_id values for folders directly beneath
 * the root folder of Dynamic Healing Discussion Group (at path_depth=1). For each of these folders,
 * it recursively searches for MP4 files, and reports the potential main_video_id 
 * for each folder.
 * 
 * Usage:
 *   ts-node report-main-video-ids.ts [options]
 * 
 * Options:
 *   --folder-id <id>    Specify a folder ID (default: Dynamic Healing Discussion Group)
 *   --verbose           Show detailed logs
 *   --output <path>     Path to write markdown output to
 *   --limit <number>    Limit the number of folders to process
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger, LogLevel } from '../../../packages/shared/utils/logger';
import { getGoogleDriveService } from '../../../packages/shared/services/google-drive';

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
const isDryRun = args.includes('--dry-run');
const updateDb = args.includes('--update-db');

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

// Set default output file in docs/script-reports
const outputIndex = args.indexOf('--output');
let outputFile = '/Users/raybunnage/Documents/github/dhg-mono/docs/script-reports/main-video-ids-report.md'; // Default output location
if (outputIndex !== -1 && args[outputIndex + 1]) {
  outputFile = args[outputIndex + 1];
}

// Limit number of folders to process
const limitIndex = args.indexOf('--limit');
let folderLimit = 0; // Default: process all folders
if (limitIndex !== -1 && args[limitIndex + 1]) {
  folderLimit = parseInt(args[limitIndex + 1], 10);
}

// The initDriveClient function has been replaced with the GoogleDriveService singleton

interface FolderInfo {
  id: string;
  name: string;
  drive_id: string;
  path: string;
  path_depth: number;
  mp4Files?: Mp4FileInfo[];
  mainVideoId?: string;
  document_type_id?: string;
  document_type?: string;
  expert_id?: string;
  expert_name?: string;
}

interface Mp4FileInfo {
  id: string;
  name: string;
  drive_id: string;
  path: string;
  parent_folder_id: string;
  isPresentationFolder: boolean;
  matchScore?: number;
  matchReason?: string[];
}

/**
 * List files recursively in Google Drive using the GoogleDriveService
 */
async function listFilesRecursively(driveService: any, folderId: string, parentPath = ''): Promise<any[]> {
  let allFiles: any[] = [];
  
  try {
    // Get files in the folder
    const files = await driveService.listFilesInFolder(folderId, {
      fields: 'id,name,mimeType,parents',
      includeSubfolders: false
    });
    
    // Add all files to the collection
    allFiles = [...allFiles, ...files.map((file: any) => ({ 
      ...file, 
      path: `${parentPath}${file.name}`
    }))];
    
    // Process folders recursively
    for (const folder of files.filter((file: any) => file.mimeType === 'application/vnd.google-apps.folder')) {
      const subFiles: any[] = await listFilesRecursively(driveService, folder.id, `${parentPath}${folder.name}/`);
      allFiles = [...allFiles, ...subFiles];
    }
    
    return allFiles;
  } catch (error) {
    Logger.error(`Error listing files in folder ${folderId}: ${error}`);
    return [];
  }
}

/**
 * Find MP4 files recursively in a folder using Supabase sources_google table
 */
async function findMp4FilesInFolder(supabase: any, folderId: string): Promise<Mp4FileInfo[]> {
  const mp4Files: Mp4FileInfo[] = [];
  
  try {
    // First check if the folder exists in sources_google
    const { data: folder, error: folderError } = await supabase
      .from('google_sources')
      .select('id, name, path, drive_id')
      .eq('drive_id', folderId)
      .eq('is_deleted', false)
      .single();
      
    if (folderError) {
      Logger.error(`Error finding folder ${folderId} in database: ${folderError.message}`);
      return [];
    }
    
    // Extract the folder name parts if it contains slashes
    const folderNameParts = folder.name.split('/');
    const firstFolderNamePart = folderNameParts[0];
    
    // Find all MP4 files that have this folder or its parts in their path_array (recursively)
    
    // Extract more meaningful matching parts from the folder name
    // Format is often YYYY-MM-DD-Name or similar
    const folderParts = folder.name.split('-');
    const dateComponent = folderParts.length >= 3 ? folderParts.slice(0, 3).join('-') : null; // YYYY-MM-DD
    const nameComponent = folderParts.length >= 4 ? folderParts.slice(3).join('-') : null; // Name part
    
    // Build a query to find any MP4 files that might match this folder
    let query = supabase
      .from('google_sources')
      .select('id, name, path, drive_id, parent_folder_id, path_array')
      .eq('mime_type', 'video/mp4')
      .eq('is_deleted', false)
      .order('name');
      
    // Don't filter by path_array yet - we'll do more sophisticated matching afterwards
    const { data: files, error: filesError } = await query;
      
    if (filesError) {
      Logger.error(`Error finding MP4 files for folder ${folder.name}: ${filesError.message}`);
      return [];
    }
    
    // Now we need to filter these files to find the ones that match our folder
    const filteredFiles = [];
    
    if (!files || files.length === 0) {
      Logger.debug(`No MP4 files found for potential matching with folder ${folder.name}`);
      return [];
    }
    
    Logger.debug(`Found ${files.length} MP4 files to check for potential matches with folder ${folder.name}`);
    
    // Process each file to see if it matches the folder
    for (const file of files) {
      // We already have the path_array from our initial query
      const filePathArray = file.path_array || [];
      const fileName = file.name;
      
      // Extract date components from filename (if present)
      // Looking for patterns like: "5.22.24" or "5.22.244" in "Cook.Clawson.5.22.244.mp4"
      const datePattern = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/;
      const dateMatch = fileName.match(datePattern);
      
      // Extract name components from filename and folder name
      // For file: "Cook.Clawson.5.22.244.mp4" -> ["Cook", "Clawson"]
      // For folder: "2024-05-22-Cook" -> "Cook"
      const fileNameParts = fileName.split('.').map((part: string) => part.toLowerCase().trim());
      
      // Score this file's match with the folder (higher is better)
      let matchScore = 0;
      const matchReason = [];
      
      // Check 1: Direct folder name contains in filename
      if (nameComponent && fileName.toLowerCase().includes(nameComponent.toLowerCase())) {
        matchScore += 5;
        matchReason.push(`Folder name component "${nameComponent}" found in filename`);
      }
      
      // Check 2: Folder name parts in file name or path_array
      if (folderParts.length > 3) { // Only if we have actual name components after the date
        for (const part of folderParts.slice(3) as string[]) { // Skip date parts
          const normalizedPart = (part as string).toLowerCase().trim();
          if (normalizedPart.length < 3) continue; // Skip very short parts
          
          // Check filename
          if (fileName.toLowerCase().includes(normalizedPart)) {
            matchScore += 3;
            matchReason.push(`Folder part "${part}" found in filename`);
          }
          
          // Check path_array 
          if (filePathArray.some((pathPart: string | null) => 
              pathPart && pathPart.toLowerCase().includes(normalizedPart))) {
            matchScore += 2;
            matchReason.push(`Folder part "${part}" found in path_array`);
          }
        }
      }
      
      // Check 3: Date component match - this is a strong signal
      if (dateComponent && dateMatch) {
        // Extract the date parts from the match
        const fileMonth = dateMatch[1];
        const fileDay = dateMatch[2];
        
        // Extract corresponding parts from folder date component
        const folderMonth = folderParts[1] ? folderParts[1].padStart(2, '0') : '';
        const folderDay = folderParts[2] ? folderParts[2].padStart(2, '0') : '';
        
        if (fileMonth === folderMonth && fileDay === folderDay) {
          matchScore += 8; // Strong date match
          matchReason.push(`Date match: folder ${folderMonth}-${folderDay} matches file ${fileMonth}.${fileDay}`);
        }
      }
      
      // Check 4: If the folder name explicitly appears in path_array
      if (filePathArray.some((pathPart: string | null) => 
          pathPart && pathPart.toLowerCase().trim() === folder.name.toLowerCase().trim())) {
        matchScore += 10; // Perfect path_array match
        matchReason.push(`Exact folder name found in path_array`);
      }
      
      // Consider it a match if the score is high enough
      if (matchScore >= 3) {
        filteredFiles.push({
          ...file,
          matchScore,
          matchReason
        });
        Logger.debug(`Match found for ${folder.name}: ${fileName} (score: ${matchScore})`);
      }
    }
    
    // Sort by match score (highest first)
    filteredFiles.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    
    // Check for "Presentation" folders and add to final result
    const mp4FilesResult: Mp4FileInfo[] = [];
    
    for (const file of filteredFiles) {
      // Check if the parent folder contains "Presentation" or "Video"
      const { data: parentFolder, error: parentError } = await supabase
        .from('google_sources')
        .select('id, name')
        .eq('id', file.parent_folder_id)
        .single();
        
      const isPresentationFolder = parentFolder && 
        (parentFolder.name.toLowerCase().includes('presentation') || 
         parentFolder.name.toLowerCase().includes('video') ||
         parentFolder.name.toLowerCase().includes('media'));
         
      mp4FilesResult.push({
        id: file.id,
        name: file.name,
        drive_id: file.drive_id,
        path: file.path,
        parent_folder_id: file.parent_folder_id,
        isPresentationFolder,
        matchScore: file.matchScore,
        matchReason: file.matchReason
      });
      
      // Add debug info
      Logger.debug(`Adding ${file.name} as a match for ${folder.name} ${isPresentationFolder ? '(in presentation folder)' : ''}`);
      if (file.matchReason) {
        for (const reason of file.matchReason) {
          Logger.debug(`  - ${reason}`);
        }
      }
    }
    
    return mp4FilesResult;
  } catch (error) {
    Logger.error(`Error finding MP4 files: ${error}`);
    return [];
  }
}

/**
 * Main function to report on main_video_id values and optionally update them
 */
export async function reportMainVideoIds(
  folderIdParam?: string,  
  verboseParam?: boolean,
  outputFileParam?: string,
  limitParam?: number,
  updateDbParam?: boolean
): Promise<void> {
  // Override the global parameters if provided
  const actualFolderId = folderIdParam || folderId;
  const actualOutputFile = outputFileParam || outputFile;
  const actualLimit = limitParam || folderLimit;
  const shouldUpdateDb = updateDbParam || updateDb;
  
  if (verboseParam) {
    Logger.setLevel(LogLevel.DEBUG);
  }
  
  console.log('=== Report on Main Video IDs with Experts (sources_google) ===');
  console.log(`Root Folder ID: ${actualFolderId}`);
  if (shouldUpdateDb) {
    console.log('Mode: UPDATE - Will update main_video_id values in the database');
  } else {
    console.log('Mode: REPORT ONLY - Will not modify the database');
  }
  console.log('============================================================');

  // Initialize Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();

  // Check if there are any sources_google entries with document_type_id set
  try {
    // First check for sources_google entries with document_type_id set
    const { data: docTypeCounts, error: docTypeError } = await supabase
      .from('google_sources')
      .select('document_type_id')
      .not('document_type_id', 'is', null)
      .limit(5);
      
    if (docTypeError) {
      Logger.error(`Error checking for document_type_id: ${docTypeError.message}`);
    } else {
      Logger.debug(`Found ${docTypeCounts?.length || 0} sources_google entries with document_type_id set`);
      
      // Then for each found ID, look up the document type
      if (docTypeCounts && docTypeCounts.length > 0) {
        for (const entry of docTypeCounts) {
          const docTypeId = entry.document_type_id;
          
          // Get document type name
          const { data: docTypeData, error: docTypeError } = await supabase
            .from('document_types')
            .select('document_type')
            .eq('id', docTypeId)
            .single();
            
          if (!docTypeError && docTypeData) {
            Logger.debug(`Sample document_type_id: ${docTypeId}, document_type: ${docTypeData.document_type}`);
          } else {
            Logger.debug(`Sample document_type_id: ${docTypeId}, but couldn't find document_type: ${docTypeError?.message || 'No data found'}`);
          }
        }
      }
    }
  } catch (error) {
    Logger.error(`Error in document type lookup: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Initialize Google Drive service using the singleton pattern
  const driveService = getGoogleDriveService(supabase);

  // Supabase client is already initialized above
  
  try {
    // We already have a Supabase client initialized above, use it below
    
    // Step 1: Verify the root folder exists in sources_google
    const { data: rootFolder, error: rootFolderError } = await supabase
      .from('google_sources')
      .select('id, name, path, drive_id')
      .eq('drive_id', actualFolderId)
      .eq('is_deleted', false)
      .single();
    
    if (rootFolderError) {
      Logger.error(`Error fetching root folder info: ${rootFolderError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Root folder: "${rootFolder.name}" (${actualFolderId})`);
    
    // Step 2: Find all subfolders directly under the root folder (path_depth = 0)
    const { data: subFolders, error: subFoldersError } = await supabase
      .from('google_sources')
      .select('id, name, path, drive_id, path_depth')
      .eq('parent_folder_id', actualFolderId)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .eq('is_deleted', false)
      .eq('path_depth', 0) // Specifically looking for direct children of the root
      .order('name');
    
    if (subFoldersError) {
      Logger.error(`Error fetching subfolders: ${subFoldersError.message}`);
      process.exit(1);
    }
    
    if (!subFolders || subFolders.length === 0) {
      Logger.info('No subfolders found under the root folder.');
      return;
    }
    
    Logger.info(`Found ${subFolders.length} subfolders with path_depth=0 under the root folder.\n`);
    
    // Create a markdown table header for the report with fixed-width columns
    const colWidths = {
      folderName: 40,
      videoName: 35,
      docType: 20,
      expert: 20,
      status: 15
    };
    
    // Create header with fixed widths
    let reportContent = `| ${'Folder Name'.padEnd(colWidths.folderName)} | ${'Main Video Filename'.padEnd(colWidths.videoName)} | ${'Document Type'.padEnd(colWidths.docType)} | ${'Expert'.padEnd(colWidths.expert)} | ${'Status'.padEnd(colWidths.status)} |\n`;
    
    // Create separator line with fixed widths
    reportContent += `| ${'-'.repeat(colWidths.folderName)} | ${'-'.repeat(colWidths.videoName)} | ${'-'.repeat(colWidths.docType)} | ${'-'.repeat(colWidths.expert)} | ${'-'.repeat(colWidths.status)} |\n`;
    
    // Apply folder limit if specified
    const foldersToProcess = actualLimit > 0 ? subFolders.slice(0, actualLimit) : subFolders;
    Logger.info(`Processing ${foldersToProcess.length} out of ${subFolders.length} folders${actualLimit > 0 ? ' (limited by --limit)' : ''}`);
    
    // Step 3: For each subfolder, search for MP4 files recursively
    let updateCount = 0;
    let folderCount = 0;
    
    const allFolderInfo: FolderInfo[] = [];
    
    for (const folder of foldersToProcess) {
      folderCount++;
      Logger.debug(`Processing folder ${folderCount}/${foldersToProcess.length}: ${folder.name}`);
      
      // Check if the folder already has a main_video_id and document_type_id set
      const { data: currentMainVideo, error: mainVideoError } = await supabase
        .from('google_sources')
        .select('id, name, main_video_id, document_type_id')
        .eq('id', folder.id)
        .single();
        
      let mainVideoId = null;
      let mainVideoName = "None";
      let status = "No MP4";
      let documentTypeId = currentMainVideo?.document_type_id || null;
      let documentType = "None";
      let expertId = null;
      let expertName = "Unknown";

      // Look up document type directly for the folder
      if (documentTypeId) {
        // Direct lookup by ID
        const { data: docTypeData, error: docTypeError } = await supabase
          .from('document_types')
          .select('document_type')
          .eq('id', documentTypeId)
          .single();
          
        if (!docTypeError && docTypeData) {
          documentType = docTypeData.document_type;
          Logger.debug(`Found document type: ${documentType} for folder ${folder.name}, document_type_id: ${documentTypeId}`);
        } else {
          Logger.debug(`Error looking up document type for folder ${folder.name}, ID ${documentTypeId}: ${docTypeError?.message || 'No data found'}`);
        }
      }
      
      // Look up expert information for this source (folder)
      try {
        // First check google_sources_experts for this source
        const { data: sourceExperts, error: sourceExpertsError } = await supabase
          .from('google_sources_experts')
          .select('expert_id')
          .eq('source_id', folder.id);
          
        if (sourceExpertsError) {
          Logger.debug(`Error looking up expert for folder ${folder.name}: ${sourceExpertsError.message}`);
        } else if (sourceExperts && sourceExperts.length > 0) {
          // We have an expert - get the name from the experts table
          expertId = sourceExperts[0].expert_id;
          
          const { data: expertData, error: expertError } = await supabase
            .from('expert_profiles')
            .select('expert_name, full_name')
            .eq('id', expertId)
            .single();
            
          if (expertError) {
            Logger.debug(`Error looking up expert name for ID ${expertId}: ${expertError.message}`);
          } else if (expertData) {
            // Use the expert_name field (short name) as requested
            expertName = expertData.expert_name;
            
            Logger.debug(`Found expert: ${expertName} for folder ${folder.name}, expert_id: ${expertId}`);
          }
        } else {
          Logger.debug(`No expert found for folder ${folder.name}`);
        }
      } catch (error) {
        Logger.debug(`Unexpected error looking up expert for folder ${folder.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Find MP4 files in this folder recursively
      const mp4Files = await findMp4FilesInFolder(supabase, folder.drive_id);
      
      if (mp4Files.length > 0) {
        // Sort by priority - files in "Presentation" folders first
        const prioritizedFiles = [...mp4Files].sort((a, b) => {
          if (a.isPresentationFolder && !b.isPresentationFolder) return -1;
          if (!a.isPresentationFolder && b.isPresentationFolder) return 1;
          return a.name.localeCompare(b.name);
        });
        
        // Choose the best file (first after sorting)
        const bestFile = prioritizedFiles[0];
        mainVideoId = bestFile.id;
        mainVideoName = bestFile.name;
        
        // Check if currentMainVideo has main_video_id property
        const currentMainVideoId = currentMainVideo?.main_video_id || null;
        
        // Set status based on whether we need to update
        if (currentMainVideoId === mainVideoId) {
          status = "Already Set";
        } else {
          status = bestFile.isPresentationFolder ? "Update (Presentation)" : "Update";
          
          // Update the database if requested
          if (shouldUpdateDb) {
            const { error: updateError } = await supabase
              .from('google_sources')
              .update({ main_video_id: mainVideoId })
              .eq('id', folder.id);
              
            if (updateError) {
              status = `Error: ${updateError.message}`;
              Logger.error(`Error updating main_video_id for folder ${folder.name}: ${updateError.message}`);
            } else {
              updateCount++;
              status = "Updated";
            }
          }
          
          // Also update associated files with the same main_video_id
          if (shouldUpdateDb) {
            // Find all files under this folder's path
            const { data: relatedFiles, error: relatedError } = await supabase
              .from('google_sources')
              .select('id')
              .eq('is_deleted', false)
              .contains('path_array', [folder.name]);
              
            if (relatedError) {
              Logger.error(`Error finding related files for ${folder.name}: ${relatedError.message}`);
            } else if (relatedFiles && relatedFiles.length > 0) {
              const relatedIds = relatedFiles.map(f => f.id);
              
              // Update them all in batches
              const batchSize = 50;
              for (let i = 0; i < relatedIds.length; i += batchSize) {
                const batch = relatedIds.slice(i, i + batchSize);
                const { error: batchError } = await supabase
                  .from('google_sources')
                  .update({ main_video_id: mainVideoId })
                  .in('id', batch);
                  
                if (batchError) {
                  Logger.error(`Error updating batch of files for ${folder.name}: ${batchError.message}`);
                } else {
                  Logger.debug(`Updated ${batch.length} related files for folder ${folder.name}`);
                }
              }
            }
          }
        }
      }
      
      // Add to the report with fixed width columns
      // Truncate values if they're too long to fit in column width and add ellipsis
      const truncate = (str: string, maxLength: number) => {
        if (str.length <= maxLength) return str.padEnd(maxLength);
        return str.substring(0, maxLength - 3) + '...';
      };
      
      reportContent += `| ${truncate(folder.name, colWidths.folderName)} | ${truncate(mainVideoName, colWidths.videoName)} | ${truncate(documentType, colWidths.docType)} | ${truncate(expertName, colWidths.expert)} | ${truncate(status, colWidths.status)} |\n`;
      
      // Store for later processing
      allFolderInfo.push({
        ...folder,
        mp4Files,
        mainVideoId: mainVideoId || undefined,
        document_type_id: documentTypeId || undefined,
        document_type: documentType,
        expert_id: expertId || undefined,
        expert_name: expertName
      });
    }
    
    // Add summary
    reportContent += `\n_Summary:_ Found ${subFolders.length} folders with path_depth=0 under ${rootFolder.name}\n`;
    
    // Count how many folders have experts assigned
    const foldersWithExperts = allFolderInfo.filter(folder => folder.expert_name && folder.expert_name !== "Unknown").length;
    reportContent += `\n${foldersWithExperts} out of ${allFolderInfo.length} folders have experts assigned (${Math.round((foldersWithExperts / allFolderInfo.length) * 100)}%).\n`;
    
    if (shouldUpdateDb) {
      reportContent += `\n${updateCount} folders had their main_video_id updated.\n`;
    }
    
    // Display report
    console.log(reportContent);
    
    // Write to output file if specified
    if (actualOutputFile) {
      try {
        // Create the output content with a proper header
        let fileContent = '# Main Video IDs Report with Expert Information\n\n';
        fileContent += `Report generated on ${new Date().toISOString()}\n\n`;
        fileContent += `This report shows folders with their associated main video files, document types, and experts.\n\n`;
        fileContent += reportContent;
        
        // Write to file
        fs.writeFileSync(actualOutputFile, fileContent);
        Logger.info(`Report written to ${actualOutputFile}`);
      } catch (writeError: any) {
        Logger.error(`Error writing to output file: ${writeError.message}`);
      }
    }
    
  } catch (error: any) {
    Logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Execute main function if run directly
if (require.main === module) {
  reportMainVideoIds().catch(error => {
    Logger.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  });
}