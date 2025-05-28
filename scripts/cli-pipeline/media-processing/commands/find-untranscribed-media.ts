#\!/usr/bin/env node

/**
 * Find Untranscribed Media Command
 * 
 * This command identifies MP4 files that need transcription:
 * - In the database but not on disk
 * - Don't already have transcriptions in expert_documents
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

// Default options
const options = {
  limit: 5,
  source: path.join(os.homedir(), 'Google Drive'),
  format: 'commands',
  deep: true
};

// Process command line arguments
const args = process.argv.slice(2);
const limitIndex = args.indexOf('--limit');
if (limitIndex \!== -1 && args[limitIndex + 1]) {
  const limitArg = parseInt(args[limitIndex + 1]);
  if (\!isNaN(limitArg)) {
    options.limit = limitArg;
  }
}

const sourceIndex = args.indexOf('--source');
if (sourceIndex \!== -1 && args[sourceIndex + 1]) {
  options.source = args[sourceIndex + 1];
}

/**
 * Find a file in a source directory, optionally recursively
 */
function findFileInDirectory(filename: string, directory: string, deep: boolean = false): string | null {
  try {
    if (\!fs.existsSync(directory)) {
      return null;
    }

    const entries = fs.readdirSync(directory, { withFileTypes: true });
    
    // First, look for exact matches in the current directory
    const exactMatch = entries.find(entry => 
      \!entry.isDirectory() && 
      (entry.name.toLowerCase() === filename.toLowerCase())
    );
    
    if (exactMatch) {
      return path.join(directory, exactMatch.name);
    }
    
    // Then, look for files where the name is contained within
    const partialMatch = entries.find(entry => 
      \!entry.isDirectory() && 
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
 * Find untranscribed MP4 files
 */
async function findUntranscribedFiles(): Promise<any[]> {
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
  
  // Get local files
  const localDir = path.join(process.cwd(), 'file_types', 'mp4');
  const localFiles = fs.existsSync(localDir) 
    ? fs.readdirSync(localDir).filter(f => f.endsWith('.mp4')) 
    : [];
  Logger.info(`Found ${localFiles.length} MP4 files in ${localDir}`);
  
  // 1. Get MP4 files from sources_google
  const { data: sources, error: sourcesError } = await supabase
    .from('google_sources')
    .select('id, name, mime_type')
    .eq('mime_type', 'video/mp4')
    .eq('deleted', false);
    
  if (sourcesError) {
    Logger.error(`Error fetching sources: ${sourcesError.message}`);
    return [];
  }
  
  // 2. Get files that have been transcribed
  const { data: expertDocs, error: docsError } = await supabase
    .from('google_expert_documents')
    .select('source_id')
    .not('raw_content', 'is', null);
  
  if (docsError) {
    Logger.error(`Error fetching expert documents: ${docsError.message}`);
    return [];
  }
  
  // Create a set of transcribed source IDs
  const transcribedSourceIds = new Set(expertDocs.map((doc: any) => doc.source_id));
  
  // Filter for untranscribed sources
  const untranscribedSources = sources.filter((source: any) => 
    source.name.endsWith('.mp4') && 
    \!transcribedSourceIds.has(source.id) &&
    \!localFiles.includes(source.name)
  );
  
  Logger.info(`Found ${untranscribedSources.length} untranscribed MP4 files`);
  
  // Find these files on disk
  const missingFiles = [];
  for (const source of untranscribedSources.slice(0, options.limit)) {
    const filePath = findFileInDirectory(source.name, options.source, true);
    if (filePath) {
      missingFiles.push({
        filename: source.name,
        sourcePath: filePath,
        sourceId: source.id
      });
    }
  }
  
  Logger.info(`Located ${missingFiles.length} files in ${options.source}`);
  
  // Generate copy commands
  const commands = missingFiles.map(file => {
    const targetPath = path.join(process.cwd(), 'file_types', 'mp4', file.filename);
    return `cp "${file.sourcePath}" "${targetPath}"`;
  }).join('\n');
  
  console.log('\n=== UNTRANSCRIBED FILES ===\n');
  console.log(commands);
  console.log('\nCopy and paste these commands or save to a script file');
  
  return missingFiles;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    Logger.info('🔍 Finding Untranscribed Media Files');
    Logger.info(`Limit: ${options.limit} files`);
    Logger.info(`Source directory: ${options.source}`);
    
    await findUntranscribedFiles();
  } catch (error: any) {
    Logger.error(`Error: ${error.message}`);
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
