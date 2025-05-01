#!/usr/bin/env ts-node
/**
 * Reset is_deleted Flag for Files that Still Exist in Google Drive
 * 
 * This script checks files marked as deleted in the database and resets
 * the is_deleted flag for any file that still exists in Google Drive.
 * 
 * Usage:
 *   ts-node reset-deleted-files.ts [options]
 * 
 * Options:
 *   --limit <number>     Limit the number of files to check (default: 100)
 *   --verbose            Show detailed logs
 *   --dry-run            Preview actions without making changes
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
const isDryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const outputIndex = args.indexOf('--output');

// Set log level based on verbosity
if (isVerbose) {
  Logger.setLevel(LogLevel.DEBUG);
} else {
  Logger.setLevel(LogLevel.INFO);
}

// Get limit from command line or use default
let limit = 100;
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
 * Main function to reset the is_deleted flag for files that still exist in Google Drive
 */
export async function resetDeletedFiles(
  limitParam?: number,
  dryRunParam?: boolean,
  verboseParam?: boolean,
  outputFileParam?: string
): Promise<{ restored: number; notFound: number; errors: number }> {
  // Override global parameters if provided
  const actualLimit = limitParam || limit;
  const actualDryRun = dryRunParam !== undefined ? dryRunParam : isDryRun;
  const actualOutputFile = outputFileParam || outputFile;
  
  if (verboseParam !== undefined) {
    Logger.setLevel(verboseParam ? LogLevel.DEBUG : LogLevel.INFO);
  }
  
  // Result counters
  const result = {
    restored: 0,
    notFound: 0,
    errors: 0
  };
  
  try {
    Logger.info('=== Resetting is_deleted Flag for Files that Still Exist in Google Drive ===');
    Logger.info(`Limit: ${actualLimit} files`);
    Logger.info(`Mode: ${actualDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE RUN (changes will be made)'}`);
    
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
      .select('id, drive_id, name, path_array, root_drive_id, updated_at, mime_type, metadata')
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
      return result;
    }
    
    Logger.info(`Found ${deletedFiles.length} files marked as deleted`);
    
    // Prepare results for output
    let markdownContent = '# Deleted Files Reset Report\n\n';
    markdownContent += `Report generated: ${new Date().toISOString()}\n\n`;
    markdownContent += `This report shows files marked as deleted in the database that have been reset because they still exist in Google Drive.\n\n`;
    markdownContent += '| File Name | Drive ID | Last Updated | Status | Details |\n';
    markdownContent += '|-----------|----------|--------------|--------|--------|\n';
    
    // Check each file
    Logger.info('\n=== Checking Files in Google Drive ===');
    for (const file of deletedFiles) {
      Logger.info(`\nChecking file: ${file.name} (${file.drive_id})`);
      Logger.debug(`Path: ${JSON.stringify(file.path_array)}`);
      Logger.debug(`MIME Type: ${file.mime_type || 'Unknown'}`);
      
      try {
        const existResult = await checkFileExists(driveService, file.drive_id);
        
        if (existResult.exists) {
          // File exists in Google Drive but is marked as deleted in our database
          Logger.info(`✅ File EXISTS in Google Drive! Restoring record...`);
          Logger.debug(`Type: ${existResult.data.mimeType}`);
          Logger.debug(`Parent folder: ${existResult.data.parents?.[0] || 'Unknown'}`);
          
          // Add to markdown
          if (!actualDryRun) {
            // Reset the is_deleted flag
            const { error: updateError } = await supabase
              .from('sources_google')
              .update({
                is_deleted: false,
                updated_at: new Date().toISOString(),
                metadata: {
                  ...(file.metadata || {}),
                  restored_at: new Date().toISOString(),
                  restored_reason: 'File found in Google Drive during reset operation'
                }
              })
              .eq('id', file.id);
            
            if (updateError) {
              Logger.error(`❌ Error updating record: ${updateError.message}`);
              result.errors++;
              markdownContent += `| ${file.name} | ${file.drive_id} | ${new Date(file.updated_at).toLocaleString()} | ❌ ERROR | Failed to update record: ${updateError.message} |\n`;
            } else {
              Logger.info(`✅ Successfully restored record`);
              result.restored++;
              markdownContent += `| ${file.name} | ${file.drive_id} | ${new Date(file.updated_at).toLocaleString()} | ✅ RESTORED | Type: ${existResult.data.mimeType} |\n`;
            }
          } else {
            // Dry run mode - just report what would happen
            Logger.info(`🔍 DRY RUN: Would restore record`);
            result.restored++;
            markdownContent += `| ${file.name} | ${file.drive_id} | ${new Date(file.updated_at).toLocaleString()} | 🔍 WOULD RESTORE | Type: ${existResult.data.mimeType} |\n`;
          }
        } else {
          // File does not exist in Google Drive - leave it marked as deleted
          Logger.info(`❌ File DOES NOT EXIST in Google Drive (${existResult.error})`);
          result.notFound++;
          markdownContent += `| ${file.name} | ${file.drive_id} | ${new Date(file.updated_at).toLocaleString()} | ❌ NOT FOUND | ${existResult.error} |\n`;
        }
      } catch (error) {
        Logger.error(`Error checking file ${file.name}:`, error);
        result.errors++;
        markdownContent += `| ${file.name} | ${file.drive_id} | ${new Date(file.updated_at).toLocaleString()} | ❌ ERROR | ${error instanceof Error ? error.message : String(error)} |\n`;
      }
    }
    
    // Add summary to markdown
    markdownContent += '\n## Summary\n\n';
    markdownContent += `- Total files checked: ${deletedFiles.length}\n`;
    markdownContent += `- Files restored (existed in Google Drive): ${result.restored}\n`;
    markdownContent += `- Files still marked as deleted (not found in Google Drive): ${result.notFound}\n`;
    markdownContent += `- Files with errors: ${result.errors}\n`;
    markdownContent += `- Mode: ${actualDryRun ? 'DRY RUN (no changes were made)' : 'LIVE RUN (changes were applied)'}\n`;
    
    // Summary in console
    Logger.info('\n=== Reset Operation Complete ===');
    Logger.info(`Total files checked: ${deletedFiles.length}`);
    Logger.info(`Files restored (existed in Google Drive): ${result.restored}`);
    Logger.info(`Files still marked as deleted (not found in Google Drive): ${result.notFound}`);
    Logger.info(`Files with errors: ${result.errors}`);
    Logger.info(`Mode: ${actualDryRun ? 'DRY RUN (no changes were made)' : 'LIVE RUN (changes were applied)'}`);
    
    // Write to output file if specified
    if (actualOutputFile) {
      try {
        fs.writeFileSync(actualOutputFile, markdownContent);
        Logger.info(`Report written to ${actualOutputFile}`);
      } catch (writeError) {
        Logger.error('Error writing to output file:', writeError);
      }
    }
    
    return result;
  } catch (error) {
    Logger.error('Unexpected error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
    // This return is just to satisfy TypeScript
    return result;
  }
}

// Run the script if called directly
if (require.main === module) {
  resetDeletedFiles().catch(error => {
    Logger.error('Unhandled error:', error);
    process.exit(1);
  });
}