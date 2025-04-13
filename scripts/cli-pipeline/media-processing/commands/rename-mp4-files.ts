#!/usr/bin/env ts-node
/**
 * Rename MP4 Files Command
 * 
 * This utility renames local MP4 files to match the names in the Supabase database.
 * It helps bridge the gap between files copied from Google Drive and the database records.
 * 
 * Usage:
 *   rename-mp4-files.ts [options]
 * 
 * Options:
 *   --dry-run        Show what would be renamed without making changes
 *   --force          Rename even if a destination file already exists (will overwrite)
 *   --generate-map   Generate a CSV mapping file of original to new names
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command-line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  generateMap: args.includes('--generate-map'),
  skipSync: args.includes('--skip-sync')
};

// Define file paths
const MP4_DIR = path.join(process.cwd(), 'file_types', 'mp4');
const MAP_FILE = path.join(process.cwd(), 'file_types', 'mp4_rename_map.csv');

interface RenameMapping {
  originalName: string;
  databaseName: string;
  status: 'pending' | 'renamed' | 'error' | 'skipped';
  error?: string;
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

    return fs.readdirSync(MP4_DIR)
      .filter(file => file.toLowerCase().endsWith('.mp4'));
  } catch (error: any) {
    Logger.error(`Error reading ${MP4_DIR}: ${error.message}`);
    return [];
  }
}

/**
 * Get all MP4 files from the database
 */
async function getDatabaseMp4Files(supabase: any): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('sources_google')
      .select('name')
      .eq('mime_type', 'video/mp4')
      .eq('deleted', false);

    if (error) {
      Logger.error(`Error fetching sources_google data: ${error.message}`);
      return [];
    }

    if (!data) {
      return [];
    }

    return data
      .filter((source: {name?: string}) => source.name && source.name.toLowerCase().endsWith('.mp4'))
      .map((source: {name: string}) => source.name);
  } catch (error: any) {
    Logger.error(`Error querying database: ${error.message}`);
    return [];
  }
}

/**
 * Find the best database name match for a local filename
 */
function findBestMatch(localName: string, databaseNames: string[]): string | null {
  // Try exact match first (case insensitive)
  const exactMatch = databaseNames.find(dbName => 
    dbName.toLowerCase() === localName.toLowerCase()
  );
  if (exactMatch) return exactMatch;
  
  // Try checking if database name is contained within local name
  // This handles cases like "2024-01-24-Naviaux DR -Update chronic fatigue Naviaux.DR.1.24.24.mp4" → "Naviaux.DR.1.24.24.mp4"
  const containedMatch = databaseNames.find(dbName => {
    // Extract just the filename without extension for better matching
    const dbNameBase = dbName.replace(/\.mp4$/i, '').toLowerCase();
    const localNameBase = localName.replace(/\.mp4$/i, '').toLowerCase();
    
    return localNameBase.includes(dbNameBase) && dbNameBase.length > 5; // Avoid matching too short strings
  });
  
  return containedMatch || null;
}

/**
 * Rename the MP4 files
 */
async function renameMp4Files(): Promise<RenameMapping[]> {
  const mappings: RenameMapping[] = [];
  
  // Get local files
  const localFiles = getLocalMp4Files();
  Logger.info(`Found ${localFiles.length} MP4 files in ${MP4_DIR}`);

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

  // Get database files
  const databaseFiles = await getDatabaseMp4Files(supabase);
  Logger.info(`Found ${databaseFiles.length} MP4 files in the database`);

  if (localFiles.length === 0) {
    Logger.warn('No local MP4 files found to rename');
    return mappings;
  }

  if (databaseFiles.length === 0) {
    Logger.warn('No database MP4 files found for matching');
    return mappings;
  }

  // Create a set of database filenames for quick lookups
  const databaseFilesSet = new Set(databaseFiles.map(name => name.toLowerCase()));
  
  // Rename each local file if it doesn't match a database name
  for (const localName of localFiles) {
    // Skip if the local file already matches a database name
    if (databaseFilesSet.has(localName.toLowerCase())) {
      Logger.info(`Skipping ${localName} - already matches database name`);
      mappings.push({
        originalName: localName,
        databaseName: localName,
        status: 'skipped',
        error: 'Already matches database name'
      });
      continue;
    }

    // Find the best match in the database
    const bestMatch = findBestMatch(localName, databaseFiles);
    
    if (!bestMatch) {
      Logger.warn(`No database match found for ${localName}`);
      mappings.push({
        originalName: localName,
        databaseName: '',
        status: 'error',
        error: 'No database match found'
      });
      continue;
    }

    // Check if the destination file already exists
    const sourcePath = path.join(MP4_DIR, localName);
    const destPath = path.join(MP4_DIR, bestMatch);
    
    if (fs.existsSync(destPath) && !options.force) {
      Logger.warn(`Cannot rename ${localName} to ${bestMatch} - destination exists (use --force to override)`);
      mappings.push({
        originalName: localName,
        databaseName: bestMatch,
        status: 'error',
        error: 'Destination file already exists'
      });
      continue;
    }

    // Log the planned rename
    Logger.info(`${options.dryRun ? 'Would rename' : 'Renaming'} ${localName} to ${bestMatch}`);
    
    // Perform the rename
    if (!options.dryRun) {
      try {
        fs.renameSync(sourcePath, destPath);
        Logger.info(`✅ Successfully renamed ${localName} to ${bestMatch}`);
        mappings.push({
          originalName: localName,
          databaseName: bestMatch,
          status: 'renamed'
        });
      } catch (error: any) {
        Logger.error(`❌ Error renaming ${localName} to ${bestMatch}: ${error.message}`);
        mappings.push({
          originalName: localName,
          databaseName: bestMatch,
          status: 'error',
          error: error.message
        });
      }
    } else {
      mappings.push({
        originalName: localName,
        databaseName: bestMatch,
        status: 'pending'
      });
    }
  }

  return mappings;
}

/**
 * Generate a CSV mapping file
 */
function generateMappingFile(mappings: RenameMapping[]): void {
  if (!options.generateMap) return;
  
  try {
    const csv = [
      'Original Name,Database Name,Status,Error',
      ...mappings.map(mapping => 
        `"${mapping.originalName}","${mapping.databaseName}","${mapping.status}","${mapping.error || ''}"`
      )
    ].join('\n');
    
    fs.writeFileSync(MAP_FILE, csv);
    Logger.info(`✅ Generated mapping file: ${MAP_FILE}`);
  } catch (error: any) {
    Logger.error(`❌ Error generating mapping file: ${error.message}`);
  }
}

/**
 * Display a summary of the rename results
 */
function displaySummary(mappings: RenameMapping[]): void {
  const renamed = mappings.filter(m => m.status === 'renamed').length;
  const pending = mappings.filter(m => m.status === 'pending').length;
  const errors = mappings.filter(m => m.status === 'error').length;
  const skipped = mappings.filter(m => m.status === 'skipped').length;
  
  Logger.info('\n=== RENAME SUMMARY ===');
  Logger.info(`Total files processed: ${mappings.length}`);
  
  if (options.dryRun) {
    Logger.info(`Files that would be renamed: ${pending}`);
  } else {
    Logger.info(`Files successfully renamed: ${renamed}`);
  }
  
  Logger.info(`Files skipped (already correct): ${skipped}`);
  Logger.info(`Files with errors: ${errors}`);
  
  if (options.generateMap) {
    Logger.info(`Mapping file generated: ${MAP_FILE}`);
  }
  
  if (options.dryRun) {
    Logger.info('\n=== DRY RUN - No changes were made ===');
    Logger.info('Run without --dry-run to perform the renames');
  }
  
  if (!options.dryRun && renamed > 0 && !options.skipSync) {
    Logger.info('\n⚠️ Note: You might need to sync M4A files to match the new MP4 filenames');
    Logger.info('To do this, run:');
    Logger.info('./scripts/cli-pipeline/media-processing/media-processing-cli.sh sync-m4a-names --after-rename');
  }
}

/**
 * Run the sync-m4a-names command to update M4A filenames
 */
function syncM4aNames(): Promise<void> {
  return new Promise((resolve) => {
    Logger.info('\n🔄 Running M4A name synchronization...');
    
    const syncProcess = spawn(
      'ts-node', 
      [
        path.join(__dirname, 'sync-m4a-names.ts'),
        '--after-rename',
        ...(options.force ? ['--force'] : [])
      ]
    );
    
    syncProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    syncProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
    
    syncProcess.on('close', (code) => {
      if (code !== 0) {
        Logger.warn(`M4A sync process exited with code ${code}`);
      }
      resolve();
    });
  });
}

/**
 * Main function
 */
async function main() {
  try {
    Logger.info('🔄 MP4 File Renaming Utility');
    Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL RENAME'}`);
    Logger.info(`Force overwrite: ${options.force ? 'ON' : 'OFF'}`);
    Logger.info(`Generate mapping: ${options.generateMap ? 'ON' : 'OFF'}`);
    Logger.info(`Skip M4A sync: ${options.skipSync ? 'ON' : 'OFF'}`);
    
    const mappings = await renameMp4Files();
    
    if (options.generateMap) {
      generateMappingFile(mappings);
    }
    
    displaySummary(mappings);
    
    // Automatically sync M4A files if any MP4 files were renamed and not in dry-run mode
    const renamed = mappings.filter(m => m.status === 'renamed').length;
    if (!options.dryRun && renamed > 0 && !options.skipSync) {
      await syncM4aNames();
    }
  } catch (error: any) {
    Logger.error(`Error in rename-mp4-files: ${error.message}`);
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