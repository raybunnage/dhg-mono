#!/usr/bin/env ts-node
/**
 * Check files marked as deleted in sources_google
 * 
 * This script examines records marked as deleted in the sources_google table
 * and helps to verify if they actually exist in Google Drive.
 * 
 * Usage:
 *   ts-node check-deleted-files.ts [options]
 * 
 * Options:
 *   --limit <number>     Limit the number of files to check (default: 10)
 *   --verbose            Show detailed logs
 *   --output <path>      Save results to a markdown file
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { getGoogleDriveService } from '../../../packages/shared/services/google-drive';
import { Logger, LogLevel } from '../../../packages/shared/utils/logger';

// Load environment variables from project root
const envFiles = ['.env', '.env.development', '.env.local'];
for (const file of envFiles) {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    Logger.debug(`Loading environment variables from ${filePath}`);
    dotenv.config({ path: filePath });
  }
}

// Process command line arguments
const args = process.argv.slice(2);
const isVerbose = args.includes('--verbose');
const limitIndex = args.indexOf('--limit');
const outputIndex = args.indexOf('--output');

// Set log level based on verbosity
if (isVerbose) {
  Logger.setLevel(LogLevel.DEBUG);
} else {
  Logger.setLevel(LogLevel.INFO);
}

// Get limit from command line or use default
let limit = 10;
if (limitIndex !== -1 && args[limitIndex + 1]) {
  const limitArg = parseInt(args[limitIndex + 1], 10);
  if (!isNaN(limitArg) && limitArg > 0) {
    limit = limitArg;
  }
}

// Get output file path if specified
let outputFile: string | undefined;
if (outputIndex !== -1 && args[outputIndex + 1]) {
  outputFile = args[outputIndex + 1];
}

// Constants
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Create Supabase client using the singleton pattern
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

/**
 * Checks if a file exists in Google Drive
 * @param driveService - The Google Drive service instance
 * @param fileId - The Google Drive file ID to check
 * @returns An object indicating if the file exists and associated data
 */
async function checkFileExists(driveService: any, fileId: string): Promise<{ exists: boolean; data?: any; error?: string }> {
  try {
    const fileData = await driveService.getFile(fileId, 'id,name,mimeType,parents');
    return { exists: true, data: fileData };
  } catch (error: any) {
    if (error.code === 404 || error.message?.includes('File not found')) {
      return { exists: false, error: 'File not found' };
    }
    return { exists: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Main function to check files marked as deleted
 */
export async function checkDeletedFiles(
  limitParam?: number,
  verboseParam?: boolean,
  outputFileParam?: string
): Promise<void> {
  // Override global parameters if provided
  const actualLimit = limitParam || limit;
  const actualOutputFile = outputFileParam || outputFile;
  
  if (verboseParam) {
    Logger.setLevel(LogLevel.DEBUG);
  }
  
  try {
    Logger.info('=== Checking Files Marked as Deleted ===');
    Logger.info(`Limit: ${actualLimit} files`);
    
    // Verify Supabase connection first
    try {
      const connectionTest = await supabase.from('document_types').select('id').limit(1);
      if (connectionTest.error) {
        throw new Error(`Supabase connection error: ${connectionTest.error.message}`);
      }
      Logger.debug("Supabase connection successful");
    } catch (error) {
      Logger.error('Database connection error:', error);
      process.exit(1);
    }
    
    // Initialize Google Drive service using the singleton pattern
    Logger.debug('Initializing Google Drive service...');
    const driveService = getGoogleDriveService(supabase);
    
    // Fetch deleted files
    Logger.info('Fetching files marked as deleted...');
    const { data: deletedFiles, error } = await supabase
      .from('sources_google')
      .select('id, drive_id, name, path_array, root_drive_id, updated_at, mime_type')
      .eq('is_deleted', true)
      .eq('root_drive_id', DYNAMIC_HEALING_FOLDER_ID)
      .order('updated_at', { ascending: false })
      .limit(actualLimit);
      
    if (error) {
      Logger.error('Error fetching deleted files:', error);
      process.exit(1);
    }
    
    if (!deletedFiles || deletedFiles.length === 0) {
      Logger.info('No deleted files found in the database.');
      return;
    }
    
    Logger.info(`Found ${deletedFiles.length} files marked as deleted`);
    
    // Prepare results for output
    let markdownContent = '# Deleted Files Verification Report\n\n';
    markdownContent += `Report generated: ${new Date().toISOString()}\n\n`;
    markdownContent += `This report shows files marked as deleted in the database and verifies if they still exist in Google Drive.\n\n`;
    markdownContent += '| File Name | Drive ID | Last Updated | Status | Details |\n';
    markdownContent += '|-----------|----------|--------------|--------|--------|\n';
    
    // Status counters
    let existingCount = 0;
    let notExistingCount = 0;
    let errorCount = 0;
    
    // Check each file
    Logger.info('\n=== Checking Files in Google Drive ===');
    for (const file of deletedFiles) {
      Logger.info(`\nChecking file: ${file.name} (${file.drive_id})`);
      Logger.debug(`Path: ${JSON.stringify(file.path_array)}`);
      Logger.debug(`MIME Type: ${file.mime_type || 'Unknown'}`);
      
      try {
        const result = await checkFileExists(driveService, file.drive_id);
        
        if (result.exists) {
          existingCount++;
          Logger.info(`✅ File EXISTS in Google Drive!`);
          Logger.debug(`Type: ${result.data.mimeType}`);
          Logger.debug(`Parent folder: ${result.data.parents?.[0] || 'Unknown'}`);
          
          // Add to markdown
          markdownContent += `| ${file.name} | ${file.drive_id} | ${new Date(file.updated_at).toLocaleString()} | ⚠️ EXISTS | Type: ${result.data.mimeType} |\n`;
        } else {
          notExistingCount++;
          Logger.info(`❌ File DOES NOT EXIST in Google Drive (${result.error})`);
          
          // Add to markdown
          markdownContent += `| ${file.name} | ${file.drive_id} | ${new Date(file.updated_at).toLocaleString()} | ✅ DELETED | ${result.error} |\n`;
        }
      } catch (error) {
        errorCount++;
        Logger.error(`Error checking file ${file.name}:`, error);
        
        // Add to markdown
        markdownContent += `| ${file.name} | ${file.drive_id} | ${new Date(file.updated_at).toLocaleString()} | ❌ ERROR | ${error instanceof Error ? error.message : String(error)} |\n`;
      }
    }
    
    // Add summary to markdown
    markdownContent += '\n## Summary\n\n';
    markdownContent += `- Total files checked: ${deletedFiles.length}\n`;
    markdownContent += `- Files that still exist in Google Drive: ${existingCount}\n`;
    markdownContent += `- Files confirmed deleted from Google Drive: ${notExistingCount}\n`;
    markdownContent += `- Files with check errors: ${errorCount}\n`;
    
    // Summary in console
    Logger.info('\n=== Check Complete ===');
    Logger.info(`Total files checked: ${deletedFiles.length}`);
    Logger.info(`Files that still exist in Google Drive: ${existingCount}`);
    Logger.info(`Files confirmed deleted from Google Drive: ${notExistingCount}`);
    Logger.info(`Files with check errors: ${errorCount}`);
    
    // Write to output file if specified
    if (actualOutputFile) {
      try {
        fs.writeFileSync(actualOutputFile, markdownContent);
        Logger.info(`Report written to ${actualOutputFile}`);
      } catch (writeError) {
        Logger.error('Error writing to output file:', writeError);
      }
    }
  } catch (error) {
    Logger.error('Unexpected error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  checkDeletedFiles().catch(error => {
    Logger.error('Unhandled error:', error);
    process.exit(1);
  });
}