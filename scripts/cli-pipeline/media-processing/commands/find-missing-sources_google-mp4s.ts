#!/usr/bin/env ts-node
/**
 * Find Missing sources_google MP4s Command
 * 
 * This command identifies MP4 files in the sources_google table with 'video/mp4' mime type
 * that are not yet in the presentations table. It helps find missing video files that
 * need to be copied from Google Drive to ensure complete coverage of all MP4 files.
 * 
 * The command specifically focuses on the "Dynamic Healing Discussion Group" path.
 * 
 * Usage:
 *   find-missing-sources_google-mp4s [options]
 * 
 * Options:
 *   --limit [number]       Limit the number of files to list (default: 25)
 *   --format [format]      Output format (commands, list, json) (default: commands)
 *   --path-contains [string] Filter by path containing a specific string (default: "Dynamic Healing Discussion Group")
 */

import * as path from 'path';
// Import using require to avoid TypeScript issues with winston
const { Logger } = require('../../../../packages/shared/utils');
const { SupabaseClientService } = require('../../../../packages/shared/services/supabase-client');
const { LogLevel } = require('../../../../packages/shared/utils/logger');

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  limit: 25,
  format: 'commands',
  pathContains: '' // Empty default to search all paths
};

// Get limit if specified
const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1 && args[limitIndex + 1]) {
  const limitArg = parseInt(args[limitIndex + 1]);
  if (!isNaN(limitArg)) {
    options.limit = limitArg;
  }
}

// Get format if specified
const formatIndex = args.indexOf('--format');
if (formatIndex !== -1 && args[formatIndex + 1]) {
  const formatArg = args[formatIndex + 1].toLowerCase();
  if (['commands', 'list', 'json'].includes(formatArg)) {
    options.format = formatArg;
  }
}

// Get path-contains if specified
const pathContainsIndex = args.indexOf('--path-contains');
if (pathContainsIndex !== -1 && args[pathContainsIndex + 1]) {
  options.pathContains = args[pathContainsIndex + 1];
}

interface MissingFile {
  id: string;
  name: string;
  path: string;
  drive_id: string | null;
  web_view_link: string | null;
}

/**
 * Get MP4 files from sources_google that are not in presentations
 */
async function getMissingMP4Files(supabase: any): Promise<MissingFile[]> {
  try {
    // First get all presentations to check against
    const { data: presentations, error: presentationsError } = await supabase
      .from('presentations')
      .select('filename, main_video_id')
      .is('main_video_id', null);
      
    if (presentationsError) {
      Logger.error(`Error fetching presentations data: ${presentationsError.message}`);
      return [];
    }
    
    Logger.info(`Found ${presentations.length} presentations without main_video_id`);
    
    // Then get all MP4 files from sources_google
    let query = supabase
      .from('google_sources')
      .select('id, name, path, drive_id, web_view_link, mime_type')
      .eq('mime_type', 'video/mp4')
      .eq('is_deleted', false);
      
    // Only apply path filter if pathContains is provided
    if (options.pathContains) {
      query = query.ilike('path', `%${options.pathContains}%`);
    }
    
    const { data: sources, error: sourcesError } = await query;
      
    if (sourcesError) {
      Logger.error(`Error fetching sources_google data: ${sourcesError.message}`);
      return [];
    }
    
    Logger.info(`Found ${sources.length} MP4 files in sources_google${options.pathContains ? ` with path containing "${options.pathContains}"` : ''}`);
    
    // Get all presentations to check against
    const { data: allPresentations, error: allPresentationsError } = await supabase
      .from('presentations')
      .select('id, filename, main_video_id');
      
    if (allPresentationsError) {
      Logger.error(`Error fetching all presentations data: ${allPresentationsError.message}`);
      return [];
    }
    
    Logger.info(`Found ${allPresentations.length} total presentations`);
    
    // Find presentations without a main_video_id
    const presentationsWithoutVideo = allPresentations.filter((p: any) => !p.main_video_id);
    Logger.info(`Found ${presentationsWithoutVideo.length} presentations without main_video_id`);
    
    // Get existing linked video IDs
    const existingVideoIds = allPresentations
      .filter((p: any) => p.main_video_id)
      .map((p: any) => p.main_video_id);
    Logger.info(`Found ${existingVideoIds.length} presentations with main_video_id already set`);
    
    // Filter out sources that are already in presentations
    const missingFiles = sources.filter((source: any) => 
      !existingVideoIds.includes(source.id)
    );
    
    Logger.info(`Found ${missingFiles.length} MP4 files not yet linked to presentations`);
    
    // Also find presentations with filenames that don't match any sources_google name
    const sourcesFilenames = sources.map((s: any) => s.name.toLowerCase());
    const presentationsWithoutMatchingSource = allPresentations.filter(
      (p: any) => !sourcesFilenames.includes(p.filename.toLowerCase())
    );
    Logger.info(`Found ${presentationsWithoutMatchingSource.length} presentations with filenames that don't match any sources_google name`);
    
    // Find sources_google names that don't match any presentation filename
    const presentationFilenames = allPresentations.map((p: any) => p.filename.toLowerCase());
    const sourcesWithoutMatchingPresentation = sources.filter(
      (s: any) => !presentationFilenames.includes(s.name.toLowerCase())
    );
    Logger.info(`Found ${sourcesWithoutMatchingPresentation.length} sources_google names that don't match any presentation filename`);
    
    // Debug output
    Logger.info("Presentations without matching sources_google name:");
    presentationsWithoutMatchingSource.forEach((p: any) => {
      Logger.info(`  ${p.filename}`);
    });
    
    Logger.info("Sources_google names without matching presentation filename:");
    sourcesWithoutMatchingPresentation.forEach((s: any) => {
      Logger.info(`  ${s.name} (path: ${s.path})`);
    });
    
    return missingFiles;
  } catch (error: any) {
    Logger.error(`Error querying database: ${error.message}`);
    return [];
  }
}

/**
 * Format the output based on the selected format
 */
function formatOutput(missingFiles: MissingFile[]): string {
  // Take only up to the limit
  const limitedFiles = missingFiles.slice(0, options.limit);
  
  if (options.format === 'json') {
    return JSON.stringify(limitedFiles, null, 2);
  }
  
  if (options.format === 'list') {
    return limitedFiles.map(file => {
      return `${file.name} (path: ${file.path}, id: ${file.id})`;
    }).join('\n');
  }
  
  // Default: commands format
  return limitedFiles.map(file => {
    if (file.web_view_link) {
      return `# File: ${file.name}\n# Path: ${file.path}\n# Google Drive: ${file.web_view_link}\n# ID: ${file.id}\ngoogle-drive-cli.sh download-file "${file.id}" --output "file_types/mp4/${file.name}"`;
    } else {
      return `# File not found: ${file.name} (ID: ${file.id}, Path: ${file.path})`;
    }
  }).join('\n\n');
}

/**
 * Main function
 */
async function main() {
  try {
    Logger.info('🔍 Finding Missing sources_google MP4 Files');
    Logger.info(`Path contains: ${options.pathContains || '(searching all paths)'}`);
    Logger.info(`Limit: ${options.limit}`);
    Logger.info(`Output format: ${options.format}`);
    
    // Get Supabase client using singleton pattern
    const supabaseClientService = SupabaseClientService.getInstance();
    let supabase: any;
    
    try {
      supabase = supabaseClientService.getClient();
      Logger.info('Successfully connected to Supabase');
    } catch (error: any) {
      Logger.error(`Error getting Supabase client: ${error.message}`);
      process.exit(1);
    }
    
    const missingFiles = await getMissingMP4Files(supabase);
    
    const output = formatOutput(missingFiles);
    console.log('\n=== MISSING SOURCES_GOOGLE MP4 FILES ===\n');
    console.log(output);
    
    if (options.format === 'commands') {
      console.log('\nCopy and paste these commands to download the files from Google Drive:');
      console.log('# You can save this to a script with:');
      console.log('# find-missing-sources_google-mp4s > download-mp4s.sh && chmod +x download-mp4s.sh');
    }
  } catch (error: any) {
    Logger.error(`Error in find-missing-sources_google-mp4s: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Default export function for CLI integration
 */
export default async function(cliOptions?: any): Promise<void> {
  // Override default options with CLI options if provided
  if (cliOptions) {
    if (cliOptions.limit) options.limit = parseInt(cliOptions.limit);
    if (cliOptions.format) options.format = cliOptions.format;
    if (cliOptions.pathContains) options.pathContains = cliOptions.pathContains;
  }
  
  try {
    await main();
  } catch (error: any) {
    Logger.error(`Unhandled error: ${error}`);
    process.exit(1);
  }
}

// If running directly (not imported), execute the main function
if (require.main === module) {
  main().catch(error => {
    Logger.error(`Unhandled error: ${error}`);
    process.exit(1);
  });
}