#!/usr/bin/env ts-node
/**
 * Sync M4A Filenames Command
 * 
 * This utility ensures that M4A audio files have matching names with their MP4 video counterparts.
 * It's useful after renaming MP4 files to maintain consistency across file types.
 * 
 * Usage:
 *   sync-m4a-names.ts [options]
 * 
 * Options:
 *   --dry-run              Show what would be renamed without making changes
 *   --force                Rename even if destination files already exist (will overwrite)
 *   --after-rename         Run this after renaming MP4 files to update M4A files accordingly
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../../../packages/shared/utils';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command-line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  afterRename: args.includes('--after-rename')
};

// Define file paths
const MP4_DIR = path.join(process.cwd(), 'file_types', 'mp4');
const M4A_DIR = path.join(process.cwd(), 'file_types', 'm4a');

interface FileSyncResult {
  mp4File: string;
  originalM4aFile: string;
  newM4aFile: string;
  status: 'pending' | 'renamed' | 'error' | 'skipped' | 'missing';
  error?: string;
}

/**
 * Get all MP4 files from the local directory
 */
function getLocalMp4Files(): string[] {
  try {
    if (!fs.existsSync(MP4_DIR)) {
      Logger.warn(`MP4 directory does not exist: ${MP4_DIR}`);
      return [];
    }

    return fs.readdirSync(MP4_DIR)
      .filter(file => file.toLowerCase().endsWith('.mp4'));
  } catch (error: any) {
    Logger.error(`Error reading MP4 directory: ${error.message}`);
    return [];
  }
}

/**
 * Get all M4A files from the local directory
 */
function getLocalM4aFiles(): string[] {
  try {
    if (!fs.existsSync(M4A_DIR)) {
      Logger.warn(`M4A directory does not exist: ${M4A_DIR}`);
      return [];
    }

    return fs.readdirSync(M4A_DIR)
      .filter(file => file.toLowerCase().endsWith('.m4a'));
  } catch (error: any) {
    Logger.error(`Error reading M4A directory: ${error.message}`);
    return [];
  }
}

/**
 * Find the matching M4A file for an MP4 file
 */
function findMatchingM4aFile(mp4Filename: string, m4aFiles: string[]): string | null {
  // Try exact name match (just with different extension)
  const baseName = mp4Filename.replace(/\.mp4$/i, '');
  const exactMatch = m4aFiles.find(file => 
    file.toLowerCase() === `${baseName.toLowerCase()}.m4a`
  );
  if (exactMatch) return exactMatch;

  // Try match with INGESTED_ prefix
  const ingestedMatch = m4aFiles.find(file => 
    file.toLowerCase() === `ingested_${baseName.toLowerCase()}.m4a`
  );
  if (ingestedMatch) return ingestedMatch;

  // Try more fuzzy match - check if the MP4 base name is contained in any M4A file
  const fuzzyMatch = m4aFiles.find(file => {
    const m4aBase = file.replace(/\.m4a$/i, '').toLowerCase().replace(/^ingested_/, '');
    const mp4Base = baseName.toLowerCase();
    return m4aBase.includes(mp4Base) || mp4Base.includes(m4aBase);
  });
  
  return fuzzyMatch || null;
}

/**
 * Generate the desired M4A filename for a given MP4 file
 */
function generateM4aFilename(mp4Filename: string): string {
  // Check if the MP4 filename already has an INGESTED_ prefix
  if (mp4Filename.startsWith('INGESTED_')) {
    return mp4Filename.replace(/\.mp4$/i, '.m4a');
  } else {
    // Add the INGESTED_ prefix according to the current naming convention
    return `INGESTED_${mp4Filename.replace(/\.mp4$/i, '.m4a')}`;
  }
}

/**
 * Sync M4A filenames with their MP4 counterparts
 */
async function syncM4aWithMp4Files(): Promise<FileSyncResult[]> {
  const results: FileSyncResult[] = [];
  
  // Get MP4 and M4A files
  const mp4Files = getLocalMp4Files();
  const m4aFiles = getLocalM4aFiles();
  
  Logger.info(`Found ${mp4Files.length} MP4 files and ${m4aFiles.length} M4A files`);
  
  if (mp4Files.length === 0) {
    Logger.warn('No MP4 files found to process');
    return results;
  }
  
  if (m4aFiles.length === 0) {
    Logger.warn('No M4A files found to sync');
    return results;
  }
  
  // Process each MP4 file to ensure it has a matching M4A file
  for (const mp4File of mp4Files) {
    // Find the corresponding M4A file
    const existingM4aFile = findMatchingM4aFile(mp4File, m4aFiles);
    
    // If no matching M4A file, skip
    if (!existingM4aFile) {
      Logger.warn(`No M4A file found for MP4: ${mp4File}`);
      results.push({
        mp4File,
        originalM4aFile: '',
        newM4aFile: '',
        status: 'missing',
        error: 'No matching M4A file found'
      });
      continue;
    }
    
    // Generate the desired M4A filename based on the MP4 name
    const desiredM4aFile = generateM4aFilename(mp4File);
    
    // Skip if the existing M4A file already has the correct name
    if (existingM4aFile === desiredM4aFile) {
      Logger.info(`Skipping ${existingM4aFile} - filename already correct`);
      results.push({
        mp4File,
        originalM4aFile: existingM4aFile,
        newM4aFile: desiredM4aFile,
        status: 'skipped',
        error: 'Filename already correct'
      });
      continue;
    }
    
    // Prepare for renaming
    const sourcePath = path.join(M4A_DIR, existingM4aFile);
    const destPath = path.join(M4A_DIR, desiredM4aFile);
    
    // Check if destination file already exists
    if (fs.existsSync(destPath) && !options.force) {
      Logger.warn(`Cannot rename ${existingM4aFile} to ${desiredM4aFile} - destination exists (use --force to override)`);
      results.push({
        mp4File,
        originalM4aFile: existingM4aFile,
        newM4aFile: desiredM4aFile,
        status: 'error',
        error: 'Destination file already exists'
      });
      continue;
    }
    
    // Log the planned rename
    Logger.info(`${options.dryRun ? 'Would rename' : 'Renaming'} ${existingM4aFile} to ${desiredM4aFile}`);
    
    // Perform the rename
    if (!options.dryRun) {
      try {
        fs.renameSync(sourcePath, destPath);
        Logger.info(`✅ Successfully renamed ${existingM4aFile} to ${desiredM4aFile}`);
        results.push({
          mp4File,
          originalM4aFile: existingM4aFile,
          newM4aFile: desiredM4aFile,
          status: 'renamed'
        });
      } catch (error: any) {
        Logger.error(`❌ Error renaming ${existingM4aFile} to ${desiredM4aFile}: ${error.message}`);
        results.push({
          mp4File,
          originalM4aFile: existingM4aFile,
          newM4aFile: desiredM4aFile,
          status: 'error',
          error: error.message
        });
      }
    } else {
      results.push({
        mp4File,
        originalM4aFile: existingM4aFile,
        newM4aFile: desiredM4aFile,
        status: 'pending'
      });
    }
  }
  
  return results;
}

/**
 * Display a summary of the synchronization results
 */
function displaySummary(results: FileSyncResult[]): void {
  const renamed = results.filter(r => r.status === 'renamed').length;
  const pending = results.filter(r => r.status === 'pending').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const errors = results.filter(r => r.status === 'error').length;
  const missing = results.filter(r => r.status === 'missing').length;
  
  Logger.info('\n=== SYNC SUMMARY ===');
  Logger.info(`Total MP4 files processed: ${results.length}`);
  
  if (options.dryRun) {
    Logger.info(`M4A files that would be renamed: ${pending}`);
  } else {
    Logger.info(`M4A files successfully renamed: ${renamed}`);
  }
  
  Logger.info(`M4A files skipped (already correct): ${skipped}`);
  Logger.info(`M4A files with errors: ${errors}`);
  Logger.info(`MP4 files without matching M4A: ${missing}`);
  
  if (missing > 0) {
    Logger.info('\nTo create missing M4A files, run:');
    Logger.info('./scripts/cli-pipeline/media-processing/media-processing-cli.sh convert --batch 20');
  }
  
  if (options.dryRun) {
    Logger.info('\n=== DRY RUN - No changes were made ===');
    Logger.info('Run without --dry-run to perform the renames');
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    Logger.info('🔄 M4A File Sync Utility');
    Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL SYNC'}`);
    Logger.info(`Force rename: ${options.force ? 'ON' : 'OFF'}`);
    Logger.info(`Post-rename mode: ${options.afterRename ? 'ON' : 'OFF'}`);
    
    const results = await syncM4aWithMp4Files();
    displaySummary(results);
  } catch (error: any) {
    Logger.error(`Error in sync-m4a-names: ${error.message}`);
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

// Export the main function for use in the CLI
export default main;