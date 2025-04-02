#!/usr/bin/env ts-node
/**
 * Find Missing Media Command
 * 
 * This command identifies missing MP4 files in the file_types/mp4 directory
 * that are referenced in the database and generates copy commands to help
 * transfer them from Google Drive or another source.
 * 
 * Usage:
 *   find-missing-media.ts [options]
 * 
 * Options:
 *   --limit [number]       Limit the number of files to list (default: 25)
 *   --source [path]        Source directory to look for files (default: ~/Google Drive)
 *   --format [format]      Output format (commands, list, json)
 *   --deep                 Perform a deep search through subdirectories
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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
  source: path.join(os.homedir(), 'Google Drive'),
  format: 'commands',
  deep: args.includes('--deep')
};

// Get limit if specified
const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1 && args[limitIndex + 1]) {
  const limitArg = parseInt(args[limitIndex + 1]);
  if (!isNaN(limitArg)) {
    options.limit = limitArg;
  }
}

// Get source directory if specified
const sourceIndex = args.indexOf('--source');
if (sourceIndex !== -1 && args[sourceIndex + 1]) {
  options.source = args[sourceIndex + 1];
}

// Get format if specified
const formatIndex = args.indexOf('--format');
if (formatIndex !== -1 && args[formatIndex + 1]) {
  const formatArg = args[formatIndex + 1].toLowerCase();
  if (['commands', 'list', 'json'].includes(formatArg)) {
    options.format = formatArg;
  }
}

interface MissingFile {
  filename: string;
  sourcePath?: string;
  found: boolean;
}

/**
 * Get all MP4 files referenced in the database
 */
async function getReferencedMediaFiles(supabase: any): Promise<string[]> {
  try {
    const { data: sources, error } = await supabase
      .from('sources_google')
      .select('name, mime_type')
      .eq('mime_type', 'video/mp4')
      .eq('deleted', false);

    if (error) {
      Logger.error(`Error fetching sources_google data: ${error.message}`);
      return [];
    }

    return sources
      .filter((source: any) => source.name && source.name.toLowerCase().endsWith('.mp4'))
      .map((source: any) => source.name);
  } catch (error: any) {
    Logger.error(`Error querying database: ${error.message}`);
    return [];
  }
}

/**
 * Get all local MP4 files
 */
function getLocalMediaFiles(directory: string): string[] {
  try {
    if (!fs.existsSync(directory)) {
      Logger.warn(`Directory ${directory} does not exist`);
      return [];
    }

    return fs.readdirSync(directory)
      .filter(file => file.toLowerCase().endsWith('.mp4'))
      .map(file => file);
  } catch (error: any) {
    Logger.error(`Error reading ${directory}: ${error.message}`);
    return [];
  }
}

/**
 * Find a file in a source directory, optionally recursively
 */
function findFileInDirectory(filename: string, directory: string, deep: boolean = false): string | null {
  try {
    if (!fs.existsSync(directory)) {
      return null;
    }

    const entries = fs.readdirSync(directory, { withFileTypes: true });
    
    // First, look for exact matches in the current directory
    const exactMatch = entries.find(entry => 
      !entry.isDirectory() && 
      (entry.name.toLowerCase() === filename.toLowerCase())
    );
    
    if (exactMatch) {
      return path.join(directory, exactMatch.name);
    }
    
    // Then, look for files where the name is contained within
    const partialMatch = entries.find(entry => 
      !entry.isDirectory() && 
      entry.name.toLowerCase().endsWith('.mp4') &&
      (
        entry.name.toLowerCase().includes(filename.toLowerCase().replace(/\.mp4$/, '')) || 
        filename.toLowerCase().includes(entry.name.toLowerCase().replace(/\.mp4$/, ''))
      )
    );
    
    if (partialMatch) {
      return path.join(directory, partialMatch.name);
    }
    
    // If deep search is enabled, look in subdirectories
    if (deep) {
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subResult = findFileInDirectory(filename, path.join(directory, entry.name), true);
          if (subResult) {
            return subResult;
          }
        }
      }
    }
    
    return null;
  } catch (error: any) {
    Logger.warn(`Error searching in ${directory}: ${error.message}`);
    return null;
  }
}

/**
 * Find missing MP4 files and their potential locations
 */
async function findMissingFiles(): Promise<MissingFile[]> {
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

  // Get referenced files from database
  const referencedFiles = await getReferencedMediaFiles(supabase);
  Logger.info(`Found ${referencedFiles.length} MP4 files referenced in the database`);
  
  // Get local files
  const localDir = path.join(process.cwd(), 'file_types', 'mp4');
  const localFiles = getLocalMediaFiles(localDir);
  Logger.info(`Found ${localFiles.length} MP4 files in ${localDir}`);
  
  // Find files that are referenced but not present locally
  const missingFiles: MissingFile[] = [];
  
  for (const refFile of referencedFiles) {
    const isLocallyAvailable = localFiles.some(locFile => 
      locFile.toLowerCase() === refFile.toLowerCase()
    );
    
    if (!isLocallyAvailable) {
      const missingFile: MissingFile = {
        filename: refFile,
        found: false
      };
      
      // Try to find the file in the source directory
      const sourcePath = findFileInDirectory(refFile, options.source, options.deep);
      if (sourcePath) {
        missingFile.sourcePath = sourcePath;
        missingFile.found = true;
      }
      
      missingFiles.push(missingFile);
    }
  }
  
  return missingFiles;
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
      if (file.found) {
        return `${file.filename} (found at: ${file.sourcePath})`;
      } else {
        return `${file.filename} (not found)`;
      }
    }).join('\n');
  }
  
  // Default: commands format
  return limitedFiles.map(file => {
    if (file.found) {
      const targetPath = path.join(process.cwd(), 'file_types', 'mp4', file.filename);
      return `cp "${file.sourcePath}" "${targetPath}"`;
    } else {
      return `# File not found: ${file.filename}`;
    }
  }).join('\n');
}

/**
 * Main function
 */
async function main() {
  try {
    Logger.info('🔍 Finding Missing Media Files');
    Logger.info(`Source directory: ${options.source}`);
    Logger.info(`Deep search: ${options.deep ? 'Yes' : 'No'}`);
    Logger.info(`Limit: ${options.limit}`);
    Logger.info(`Output format: ${options.format}`);
    
    const missingFiles = await findMissingFiles();
    const foundCount = missingFiles.filter(file => file.found).length;
    
    Logger.info(`Found ${missingFiles.length} missing files, located ${foundCount} in source directory`);
    
    // Debug: Log all found files
    console.log('\n=== DEBUG: FOUND FILES ===');
    missingFiles.filter(file => file.found).forEach(file => {
      console.log(`Found: ${file.filename} at ${file.sourcePath}`);
    });
    
    const output = formatOutput(missingFiles);
    console.log('\n=== MISSING FILES ===\n');
    console.log(output);
    
    if (options.format === 'commands') {
      console.log('\nCopy and paste these commands to copy the files, or redirect to a script:');
      console.log('find-missing-media.ts > copy-files.sh && chmod +x copy-files.sh && ./copy-files.sh');
    }
  } catch (error: any) {
    Logger.error(`Error in find-missing-media: ${error.message}`);
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
    if (cliOptions.source) options.source = cliOptions.source;
    if (cliOptions.format) options.format = cliOptions.format;
    if (cliOptions.deep) options.deep = true;
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