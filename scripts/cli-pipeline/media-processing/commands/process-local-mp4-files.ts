#!/usr/bin/env ts-node
/**
 * Process Local MP4 Files Command
 * 
 * This utility processes local MP4 files from the file_types/mp4/ folder. It checks for
 * corresponding M4A files, creates document IDs if needed, and hands them off to the
 * transcribe command using A10G accelerator.
 * 
 * Usage:
 *   process-local-mp4-files.ts [options]
 * 
 * Options:
 *   --dry-run              Show what would be processed without making changes
 *   --force                Process files even if they already have transcripts
 *   --max-parallel [num]   Maximum number of parallel processes (default: 2)
 *   --limit [num]          Maximum number of files to process (default: 10)
 *   --specific-files       Only process specific files (comma-separated list)
 *   --skip-registering     Skip the registering step and only process already registered files
 *   --skip-transcription   Skip the transcription step and only register files
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Default options
const options = {
  dryRun: false,
  force: false,
  maxParallel: 2,
  limit: 10,
  specificFiles: '',
  skipRegistering: false,
  skipTranscription: false
};

// Define file paths
const MP4_DIR = path.join(process.cwd(), 'file_types', 'mp4');
const M4A_DIR = path.join(process.cwd(), 'file_types', 'm4a');
const TRANSCRIPTS_DIR = path.join(process.cwd(), 'file_types', 'transcripts');

interface MP4FileInfo {
  name: string;
  path: string;
  size: number;
  sizeFormatted: string;
  m4aPath: string | null;
  m4aExists: boolean;
  documentId: string | null;
  status: 'pending' | 'registered' | 'transcribed' | 'error';
  error?: string;
}

/**
 * Format file size to human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' bytes';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * Get all local MP4 files
 */
function getLocalMp4Files(): string[] {
  try {
    if (!fs.existsSync(MP4_DIR)) {
      Logger.warn(`Directory ${MP4_DIR} does not exist`);
      return [];
    }

    // Only get files from the root mp4 directory, not subdirectories
    let files = fs.readdirSync(MP4_DIR)
      .filter(file => file.toLowerCase().endsWith('.mp4'))
      .map(file => file);
    
    // Filter to specific files if requested
    if (options.specificFiles) {
      const specificFilesArray = options.specificFiles.split(',').map(f => f.trim().toLowerCase());
      files = files.filter(file => 
        specificFilesArray.some(specific => 
          file.toLowerCase().includes(specific.toLowerCase())
        )
      );
      Logger.info(`Filtered to ${files.length} files matching specified patterns`);
    }

    // Limit the number of files
    if (files.length > options.limit) {
      files = files.slice(0, options.limit);
      Logger.info(`Limited to ${files.length} files due to limit option`);
    }
    
    return files;
  } catch (error: any) {
    Logger.error(`Error reading ${MP4_DIR}: ${error.message}`);
    return [];
  }
}

/**
 * Find corresponding M4A file for an MP4 file
 */
function findM4aFile(mp4Filename: string): string | null {
  if (!fs.existsSync(M4A_DIR)) {
    return null;
  }

  try {
    const files = fs.readdirSync(M4A_DIR);
    const baseFilename = mp4Filename.replace(/\.mp4$/i, '');
    const normalizedBaseFilename = baseFilename.toLowerCase().replace(/[\s.]+/g, '');

    // Try different matching strategies, from most specific to least
    // 1. Try exact match with or without extension
    let matchingFile = files.find(file => 
      file === mp4Filename.replace(/\.mp4$/i, '.m4a') || 
      file === 'INGESTED_' + mp4Filename.replace(/\.mp4$/i, '.m4a')
    );

    // 2. Try a normalized match that ignores dots, spaces, and case
    if (!matchingFile) {
      matchingFile = files.find(file => {
        const normalizedFile = file.toLowerCase().replace(/[\s.]+/g, '').replace('.m4a', '');
        return normalizedFile.includes(normalizedBaseFilename) && 
              file.endsWith('.m4a');
      });
    }

    // 3. Try a partial match as a last resort
    if (!matchingFile) {
      matchingFile = files.find(file => 
        file.toLowerCase().includes(baseFilename.toLowerCase().substring(0, 10)) && 
        file.endsWith('.m4a')
      );
    }

    return matchingFile ? path.join(M4A_DIR, matchingFile) : null;
  } catch (error: any) {
    Logger.error(`Error finding M4A file for ${mp4Filename}: ${error.message}`);
    return null;
  }
}

/**
 * Find document ID from filename
 */
async function findDocumentIdFromFilename(filename: string, supabase: any): Promise<string | null> {
  try {
    // Strip extension if present
    const baseFilename = filename.replace(/\.[^/.]+$/, "");
    
    // Find corresponding documents in database
    const { data: matchingDocs, error: queryError } = await supabase
      .from('expert_documents')
      .select(`
        id, 
        sources_google!inner(id, name, mime_type)
      `)
      .eq('content_type', 'presentation')
      .eq('sources_google.mime_type', 'video/mp4')
      .ilike('sources_google.name', `%${baseFilename}%`);
    
    if (queryError) {
      Logger.error(`❌ Error querying documents for ${filename}: ${queryError.message}`);
      return null;
    }
    
    if (!matchingDocs || matchingDocs.length === 0) {
      // Try to find files with the extension
      const { data: matchingDocsWithExt } = await supabase
        .from('expert_documents')
        .select(`
          id, 
          sources_google!inner(id, name, mime_type)
        `)
        .eq('content_type', 'presentation')
        .eq('sources_google.mime_type', 'video/mp4')
        .ilike('sources_google.name', `%${filename}%`);
      
      if (!matchingDocsWithExt || matchingDocsWithExt.length === 0) {
        Logger.error(`❌ No matching document found for file: ${filename}`);
        return null;
      } else {
        if (matchingDocsWithExt.length > 1) {
          Logger.warn(`⚠️ Multiple matches found for ${filename}. Using first match.`);
          
          // Display all matches
          matchingDocsWithExt.forEach((doc: any, index: number) => {
            Logger.info(`   ${index + 1}. ID: ${doc.id}, Name: ${doc.sources_google.name}`);
          });
        }
        
        return matchingDocsWithExt[0].id;
      }
    }
    
    if (matchingDocs.length > 1) {
      Logger.warn(`⚠️ Multiple matches found for ${filename}. Using first match.`);
      
      // Display all matches
      matchingDocs.forEach((doc: any, index: number) => {
        Logger.info(`   ${index + 1}. ID: ${doc.id}, Name: ${doc.sources_google.name}`);
      });
    }
    
    return matchingDocs[0].id;
  } catch (error: any) {
    Logger.error(`❌ Exception in findDocumentIdFromFilename: ${error.message}`);
    return null;
  }
}

/**
 * Check if file has a corresponding expert document
 */
async function checkExpertDocument(supabase: any, sourceId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('expert_documents')
      .select('id, source_id, raw_content')
      .eq('source_id', sourceId);

    if (error) {
      Logger.error(`Error checking expert document for source ${sourceId}: ${error.message}`);
      return null;
    }

    if (data && data.length > 0) {
      return data[0].id;
    }

    return null;
  } catch (error: any) {
    Logger.error(`Exception checking expert document for source ${sourceId}: ${error.message}`);
    return null;
  }
}

/**
 * Register an MP4 file in the database if not already registered
 */
async function registerMp4File(supabase: any, fileInfo: MP4FileInfo): Promise<string | null> {
  try {
    // First check if this file is already registered using the findDocumentIdFromFilename function
    const existingDocumentId = await findDocumentIdFromFilename(fileInfo.name, supabase);
    
    if (existingDocumentId) {
      Logger.info(`File ${fileInfo.name} already registered with document ID ${existingDocumentId}`);
      return existingDocumentId;
    }

    if (options.dryRun) {
      Logger.info(`Would register ${fileInfo.name} in the database`);
      return "dry-run-doc-id";
    }

    // Step 1: Check if the file exists in sources_google table
    // Use a direct Supabase query to check
    const { data: sourceData, error: sourceError } = await supabase
      .from('sources_google')
      .select('id, name')
      .eq('name', fileInfo.name)
      .eq('deleted', false);
    
    if (sourceError) {
      Logger.error(`Error checking sources_google for ${fileInfo.name}: ${sourceError.message}`);
      return null;
    }
    
    let sourceId: string | null = null;
    
    // If source doesn't exist, register it with register-local-mp4-files
    if (!sourceData || sourceData.length === 0) {
      Logger.info(`Source not found for ${fileInfo.name}, registering with register-local-mp4-files`);
      const scriptPath = path.join(__dirname, '..', 'media-processing-cli.sh');
      const registerCommand = `${scriptPath} register-local-mp4-files --specific-files "${fileInfo.name}" --force`;
      
      Logger.info(`Running registration command: ${registerCommand}`);
      try {
        execSync(registerCommand, { stdio: 'inherit' });
      } catch (error: any) {
        Logger.error(`Error running register-local-mp4-files command: ${error.message}`);
        return null;
      }
      
      // Check if the file was registered successfully
      const { data: newSourceData, error: newSourceError } = await supabase
        .from('sources_google')
        .select('id, name')
        .eq('name', fileInfo.name)
        .eq('deleted', false);
      
      if (newSourceError || !newSourceData || newSourceData.length === 0) {
        Logger.error(`Failed to register source for ${fileInfo.name}`);
        return null;
      }
      
      sourceId = newSourceData[0].id;
      Logger.info(`Successfully registered source with ID: ${sourceId}`);
    } else {
      sourceId = sourceData[0].id;
      Logger.info(`Found existing source with ID: ${sourceId}`);
    }
    
    // Step 2: Now check if an expert_document exists for this source
    const { data: docData, error: docError } = await supabase
      .from('expert_documents')
      .select('id, content_type')
      .eq('source_id', sourceId);
    
    if (docError) {
      Logger.error(`Error checking expert_documents for ${fileInfo.name}: ${docError.message}`);
      return null;
    }
    
    // If document doesn't exist, create it manually since register-expert-docs isn't working
    if (!docData || docData.length === 0) {
      Logger.info(`No expert document found for ${fileInfo.name}, creating one manually`);
      
      // Create a title from the filename (remove extension and underscores)
      const baseFilename = fileInfo.name.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
      const now = new Date().toISOString();
      
      // Insert the expert document directly
      const { data: newDoc, error: insertError } = await supabase
        .from('expert_documents')
        .insert({
          source_id: sourceId,
          content_type: 'presentation',
          document_type_id: 'c6c3969b-c5cd-4c9a-a0f8-6e508ab68a4c', // Standard presentation type
          processing_status: 'pending',
          created_at: now,
          updated_at: now
        })
        .select();
      
      if (insertError || !newDoc || newDoc.length === 0) {
        Logger.error(`Failed to create expert document for ${fileInfo.name}: ${insertError?.message || 'Unknown error'}`);
        return null;
      }
      
      const docId = newDoc[0].id;
      Logger.info(`Successfully created expert document with ID: ${docId}`);
      
      // Also create a presentations entry to make sure everything is linked properly
      const { error: presentationError } = await supabase
        .from('presentations')
        .insert({
          id: docId, // Same ID as the expert_document
          title: baseFilename,
          content_type: 'presentation',
          created_at: now,
          updated_at: now
        });
      
      if (presentationError) {
        Logger.warn(`Warning: Could not create presentations entry: ${presentationError.message}`);
        // Continue anyway since the document was created
      } else {
        Logger.info(`Successfully created presentations entry for ${fileInfo.name}`);
      }
      
      return docId;
    } else {
      const docId = docData[0].id;
      Logger.info(`Found existing expert document with ID: ${docId}`);
      return docId;
    }
  } catch (error: any) {
    Logger.error(`Exception registering ${fileInfo.name}: ${error.message}`);
    return null;
  }
}

/**
 * Transcribe a file using the CLI command
 */
async function transcribeFile(documentId: string): Promise<boolean> {
  try {
    if (options.dryRun) {
      Logger.info(`Would transcribe document ${documentId}`);
      return true;
    }

    // Use the CLI command for uniformity but correctly format the options
    const tsNodePath = './node_modules/.bin/ts-node';
    const scriptPath = path.join(__dirname, '..', 'media-processing-cli.sh');
    const transcribeCommand = `${scriptPath} transcribe ${documentId} --model base --accelerator A10G`;
    
    Logger.info(`Running transcription command: ${transcribeCommand}`);
    execSync(transcribeCommand, { stdio: 'inherit' });
    
    return true;
  } catch (error: any) {
    Logger.error(`Error transcribing document ${documentId}: ${error.message}`);
    return false;
  }
}

/**
 * Convert MP4 to M4A if M4A doesn't exist
 */
async function convertMp4ToM4a(mp4Path: string): Promise<string | null> {
  try {
    const baseName = path.basename(mp4Path, '.mp4');
    const m4aPath = path.join(M4A_DIR, `${baseName}.m4a`);
    const m4aPathIngested = path.join(M4A_DIR, `INGESTED_${baseName}.m4a`);
    
    // Check if M4A already exists (with or without INGESTED_ prefix)
    if (fs.existsSync(m4aPath)) {
      Logger.info(`M4A file already exists: ${m4aPath}`);
      return m4aPath;
    }
    
    if (fs.existsSync(m4aPathIngested)) {
      Logger.info(`INGESTED_ prefixed M4A file already exists: ${m4aPathIngested}`);
      return m4aPathIngested;
    }
    
    if (options.dryRun) {
      Logger.info(`Would convert ${mp4Path} to ${m4aPath}`);
      return "dry-run-m4a-path";
    }
    
    // Ensure M4A directory exists
    if (!fs.existsSync(M4A_DIR)) {
      fs.mkdirSync(M4A_DIR, { recursive: true });
    }
    
    // Use the convert-mp4 command for the specific file
    const scriptPath = path.join(__dirname, '..', 'media-processing-cli.sh');
    const convertCommand = `${scriptPath} convert "${mp4Path}"`;
    
    Logger.info(`Running conversion command: ${convertCommand}`);
    execSync(convertCommand, { stdio: 'inherit' });
    
    // Check both possible filenames after conversion
    if (fs.existsSync(m4aPath)) {
      Logger.info(`Successfully converted to ${m4aPath}`);
      return m4aPath;
    }
    
    if (fs.existsSync(m4aPathIngested)) {
      Logger.info(`Successfully converted to ${m4aPathIngested}`);
      return m4aPathIngested;
    }
    
    // Try to find the m4a file that might have been created with a slightly different name
    const files = fs.readdirSync(M4A_DIR);
    
    // First look for exact filename (with INGESTED_ variations)
    let possibleMatch = files.find(file => {
      const lcFile = file.toLowerCase();
      const lcBaseName = baseName.toLowerCase();
      return (lcFile === lcBaseName + '.m4a' || 
              lcFile === 'ingested_' + lcBaseName + '.m4a');
    });
    
    // If not found, try a more relaxed match
    if (!possibleMatch) {
      possibleMatch = files.find(file => {
        const lcFile = file.toLowerCase();
        const lcBaseName = baseName.toLowerCase();
        return lcFile.includes(lcBaseName) && lcFile.endsWith('.m4a');
      });
    }
    
    if (possibleMatch) {
      const matchPath = path.join(M4A_DIR, possibleMatch);
      Logger.info(`Found a possible M4A match: ${matchPath}`);
      return matchPath;
    }
    
    // If all else fails, try converting directly with ffmpeg
    try {
      Logger.info(`Trying direct ffmpeg conversion for ${mp4Path}`);
      
      // Create the INGESTED_ version as that's what other commands expect
      const outputPath = m4aPathIngested;
      
      // Make sure we have the right command
      const ffmpegCommand = `ffmpeg -i "${mp4Path}" -vn -c:a aac -b:a 128k "${outputPath}"`;
      Logger.info(`Running ffmpeg: ${ffmpegCommand}`);
      
      execSync(ffmpegCommand, { stdio: 'inherit' });
      
      if (fs.existsSync(outputPath)) {
        Logger.info(`Successfully converted to ${outputPath} using direct ffmpeg`);
        return outputPath;
      }
    } catch (ffmpegError: any) {
      Logger.error(`FFmpeg direct conversion failed: ${ffmpegError.message}`);
    }
    
    Logger.error(`All conversion attempts failed for ${mp4Path}`);
    return null;
  } catch (error: any) {
    Logger.error(`Error converting MP4 to M4A: ${error.message}`);
    return null;
  }
}

/**
 * Process all MP4 files
 */
async function processMP4Files(): Promise<MP4FileInfo[]> {
  try {
    const fileInfoList: MP4FileInfo[] = [];
    
    // Get all local MP4 files
    const localFiles = getLocalMp4Files();
    Logger.info(`Found ${localFiles.length} MP4 files in ${MP4_DIR}`);
    
    if (localFiles.length === 0) {
      Logger.warn(`No MP4 files found in ${MP4_DIR}`);
      return fileInfoList;
    }
    
    // Get Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    let supabase;
    
    try {
      supabase = supabaseClientService.getClient();
      Logger.info('Successfully connected to Supabase');
    } catch (error: any) {
      Logger.error(`Error getting Supabase client: ${error.message}`);
      process.exit(1);
    }
    
    // Create file info objects
    for (const filename of localFiles) {
      const filePath = path.join(MP4_DIR, filename);
      
      try {
        const stats = fs.statSync(filePath);
        
        const fileInfo: MP4FileInfo = {
          name: filename,
          path: filePath,
          size: stats.size,
          sizeFormatted: formatFileSize(stats.size),
          m4aPath: null,
          m4aExists: false,
          documentId: null,
          status: 'pending'
        };
      
      // Find corresponding M4A file
      const m4aPath = findM4aFile(filename);
      fileInfo.m4aPath = m4aPath;
      fileInfo.m4aExists = m4aPath !== null;
      
      Logger.info(`Processing ${filename} (${fileInfo.sizeFormatted}) - M4A ${fileInfo.m4aExists ? 'found' : 'not found'}`);
      
      // Step 1: Register file in database if not already registered
      if (!options.skipRegistering) {
        const documentId = await registerMp4File(supabase, fileInfo);
        if (!documentId) {
          fileInfo.status = 'error';
          fileInfo.error = 'Failed to register file';
          fileInfoList.push(fileInfo);
          continue;
        }
        
        fileInfo.documentId = documentId;
        fileInfo.status = 'registered';
      } else {
        // Get existing document ID if we're skipping registration
        const documentId = await findDocumentIdFromFilename(filename, supabase);
        if (!documentId) {
          fileInfo.status = 'error';
          fileInfo.error = 'File not registered in database';
          fileInfoList.push(fileInfo);
          continue;
        }
        
        fileInfo.documentId = documentId;
        fileInfo.status = 'registered';
      }
      
      // Step 2: Make sure we have the M4A file if it doesn't exist
      if (!fileInfo.m4aExists) {
        Logger.info(`No M4A file found for ${filename}, attempting to create one`);
        const m4aPath = await convertMp4ToM4a(fileInfo.path);
        if (m4aPath) {
          fileInfo.m4aPath = m4aPath;
          fileInfo.m4aExists = true;
          Logger.info(`Successfully created M4A file: ${m4aPath}`);
        } else {
          Logger.warn(`Failed to create M4A file for ${filename}, but will continue anyway`);
        }
      }
      
      // Step 3: Ensure the expert document has processing_status set to pending
      if (fileInfo.documentId) {
        try {
          const { data: docStatus, error: statusError } = await supabase
            .from('expert_documents')
            .select('id, processing_status')
            .eq('id', fileInfo.documentId)
            .single();
          
          if (!statusError && docStatus && docStatus.processing_status !== 'pending') {
            Logger.info(`Setting processing status to pending for document ${fileInfo.documentId}`);
            
            const { error: updateError } = await supabase
              .from('expert_documents')
              .update({ 
                processing_status: 'pending',
                raw_content: null, // Clear any existing content to force reprocessing
                processed_content: null 
              })
              .eq('id', fileInfo.documentId);
            
            if (updateError) {
              Logger.warn(`Could not update processing status: ${updateError.message}`);
            } else {
              Logger.info(`Successfully updated processing status to pending for ${fileInfo.documentId}`);
            }
          }
        } catch (error: any) {
          Logger.warn(`Error checking/updating document status: ${error.message}`);
        }
      }
      
      fileInfoList.push(fileInfo);
      } catch (error: any) {
        Logger.error(`Error processing file ${filename}: ${error.message}`);
        continue;
      }
    }
    
    // Skip transcription if requested
    if (options.skipTranscription) {
      Logger.info('Skipping transcription step as requested');
      return fileInfoList;
    }
    
    // Step 3: Process files for transcription (with parallel limit)
    const registeredFiles = fileInfoList.filter(f => f.status === 'registered');
    if (registeredFiles.length === 0) {
      Logger.info('No files ready for transcription');
      return fileInfoList;
    }
    
    Logger.info(`Processing ${registeredFiles.length} files for transcription with max ${options.maxParallel} parallel processes`);
    
    // For dry run, just show what would be done
    if (options.dryRun) {
      for (const fileInfo of registeredFiles) {
        Logger.info(`Would transcribe ${fileInfo.name} with document ID ${fileInfo.documentId}`);
        fileInfo.status = 'transcribed'; // Mark as transcribed for summary
      }
      return fileInfoList;
    }
    
    // Use a batch transcribe command with parallel processing
    const documentIds = registeredFiles.map(f => f.documentId).join(',');
    const scriptPath = path.join(__dirname, '..', 'media-processing-cli.sh');
    const batchTranscribeCommand = `${scriptPath} batch-transcribe --model base --accelerator A10G --parallel --max-parallel ${options.maxParallel}`;
    
    Logger.info(`Running batch transcription command: ${batchTranscribeCommand}`);
    
    try {
      execSync(batchTranscribeCommand, { stdio: 'inherit' });
      
      // Mark all files as transcribed
      for (const fileInfo of registeredFiles) {
        fileInfo.status = 'transcribed';
      }
    } catch (error: any) {
      Logger.error(`Error running batch transcription: ${error.message}`);
      Logger.warn('Some files may have failed to transcribe. Will attempt individually.');
      
      // Try to transcribe files individually
      for (const fileInfo of registeredFiles) {
        if (fileInfo.documentId) {
          const success = await transcribeFile(fileInfo.documentId);
          if (success) {
            fileInfo.status = 'transcribed';
          } else {
            fileInfo.status = 'error';
            fileInfo.error = 'Individual transcription failed';
          }
        }
      }
    }
    
    return fileInfoList;
  } catch (error: any) {
    Logger.error(`Error in processMP4Files: ${error.message}`);
    return [];
  }
}

/**
 * Display summary of results
 */
function displaySummary(fileInfoList: MP4FileInfo[]): void {
  const registered = fileInfoList.filter(f => f.status === 'registered').length;
  const transcribed = fileInfoList.filter(f => f.status === 'transcribed').length;
  const errors = fileInfoList.filter(f => f.status === 'error').length;
  const pending = fileInfoList.filter(f => f.status === 'pending').length;
  
  Logger.info('\n=== PROCESSING SUMMARY ===');
  Logger.info(`Total files processed: ${fileInfoList.length}`);
  
  if (options.dryRun) {
    Logger.info(`Files that would be processed: ${fileInfoList.length - errors}`);
  } else {
    Logger.info(`Files registered: ${registered}`);
    Logger.info(`Files transcribed: ${transcribed}`);
  }
  
  Logger.info(`Files with errors: ${errors}`);
  
  if (options.dryRun) {
    Logger.info('\n=== DRY RUN - No changes were made ===');
    Logger.info('Run without --dry-run to process the files');
  }
  
  if (errors > 0) {
    Logger.info('\n=== FILES WITH ERRORS ===');
    fileInfoList.filter(f => f.status === 'error').forEach(f => {
      Logger.info(`${f.name}: ${f.error}`);
    });
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    Logger.info('🎬 Local MP4 Processing Utility');
    Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL PROCESSING'}`);
    Logger.info(`Force: ${options.force ? 'ON' : 'OFF'}`);
    Logger.info(`Max parallel processes: ${options.maxParallel}`);
    Logger.info(`Maximum files to process: ${options.limit}`);
    if (options.specificFiles) {
      Logger.info(`Specific files: ${options.specificFiles}`);
    }
    if (options.skipRegistering) {
      Logger.info(`Skipping registration step`);
    }
    if (options.skipTranscription) {
      Logger.info(`Skipping transcription step`);
    }
    
    // Create directories if they don't exist
    [MP4_DIR, M4A_DIR, TRANSCRIPTS_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        Logger.info(`Created directory: ${dir}`);
      }
    });
    
    const fileInfoList = await processMP4Files();
    displaySummary(fileInfoList);
  } catch (error: any) {
    Logger.error(`Error in main: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Default export function for CLI integration
 */
export default async function(cliOptions?: any): Promise<void> {
  // Override default options with CLI options if provided
  if (cliOptions) {
    if (cliOptions.dryRun) options.dryRun = true;
    if (cliOptions.force) options.force = true;
    if (cliOptions.maxParallel) options.maxParallel = parseInt(cliOptions.maxParallel);
    if (cliOptions.limit) options.limit = parseInt(cliOptions.limit);
    if (cliOptions.specificFiles) options.specificFiles = cliOptions.specificFiles;
    if (cliOptions.skipRegistering) options.skipRegistering = true;
    if (cliOptions.skipTranscription) options.skipTranscription = true;
  }
  
  try {
    await main();
  } catch (error: any) {
    Logger.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  }
}

// If this script is run directly, execute the main function
if (require.main === module) {
  main().catch(error => {
    Logger.error(`Unhandled error: ${error}`);
    process.exit(1);
  });
}