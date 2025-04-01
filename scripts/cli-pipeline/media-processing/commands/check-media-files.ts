#!/usr/bin/env ts-node
/**
 * Check Media Files Command
 * 
 * This utility checks for MP4 files in the sources_google table and compares them 
 * with local files in the file_types/mp4 directory to identify any missing files.
 * 
 * Usage:
 *   check-media-files.ts [options]
 * 
 * Options:
 *   --summary        Display only summary information
 *   --json           Output in JSON format
 */

import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command-line arguments
const args = process.argv.slice(2);
const options = {
  summary: args.includes('--summary'),
  json: args.includes('--json')
};

// Define file paths
const MP4_DIR = path.join(process.cwd(), 'file_types', 'mp4');
const M4A_DIR = path.join(process.cwd(), 'file_types', 'm4a');

interface MediaFile {
  name: string;
  path: string;
  exists: boolean;
  size?: number;
  referenced: boolean;
}

interface MediaCheckResult {
  localMp4Count: number;
  localM4aCount: number;
  referencedMp4Count: number;
  missingMp4Files: string[];
  missingM4aFiles: string[];
  orphanedMp4Files: string[];
  orphanedM4aFiles: string[];
  mediaFiles: {
    mp4: MediaFile[];
    m4a: MediaFile[];
  };
}

/**
 * Get all local MP4 files
 */
function getLocalMediaFiles(directory: string, extension: string): MediaFile[] {
  try {
    if (!fs.existsSync(directory)) {
      Logger.warn(`Directory ${directory} does not exist`);
      return [];
    }

    return fs.readdirSync(directory)
      .filter(file => file.endsWith(extension))
      .map(file => ({
        name: file,
        path: path.join(directory, file),
        exists: true,
        size: fs.statSync(path.join(directory, file)).size,
        referenced: false
      }));
  } catch (error: any) {
    Logger.error(`Error reading ${directory}: ${error.message}`);
    return [];
  }
}

/**
 * Get all referenced MP4 files from the database
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
 * Perform media file check
 */
async function checkMediaFiles(): Promise<MediaCheckResult> {
  // Get local files
  const localMp4Files = getLocalMediaFiles(MP4_DIR, '.mp4');
  const localM4aFiles = getLocalMediaFiles(M4A_DIR, '.m4a');

  if (!options.summary) {
    Logger.info(`Found ${localMp4Files.length} MP4 files in ${MP4_DIR}`);
    Logger.info(`Found ${localM4aFiles.length} M4A files in ${M4A_DIR}`);
  }

  // Get Supabase client using singleton pattern
  const supabaseClientService = SupabaseClientService.getInstance();
  let supabase: any;
  
  try {
    supabase = supabaseClientService.getClient();
    if (!options.summary) {
      Logger.info('Successfully connected to Supabase');
    }
  } catch (error: any) {
    Logger.error(`Error getting Supabase client: ${error.message}`);
    process.exit(1);
  }

  // Get referenced files from database
  const referencedMp4Files = await getReferencedMediaFiles(supabase);
  if (!options.summary) {
    Logger.info(`Found ${referencedMp4Files.length} MP4 files referenced in the database`);
  }

  // Mark referenced files
  for (const mp4File of localMp4Files) {
    mp4File.referenced = referencedMp4Files.includes(mp4File.name);
  }

  // Identify corresponding M4A files
  for (const m4aFile of localM4aFiles) {
    // Check if there's a corresponding MP4 referenced in the database
    const baseName = m4aFile.name.replace(/^INGESTED_/, '').replace(/\.m4a$/, '');
    
    m4aFile.referenced = referencedMp4Files.some(mp4File => {
      const mp4BaseName = mp4File.replace(/\.mp4$/, '');
      return mp4BaseName === baseName;
    });
  }

  // Find missing MP4 files (referenced but not locally available)
  const missingMp4Files = referencedMp4Files.filter(
    refFile => !localMp4Files.some(locFile => locFile.name === refFile)
  );

  // Find orphaned MP4 files (locally available but not referenced)
  const orphanedMp4Files = localMp4Files
    .filter(file => !file.referenced)
    .map(file => file.name);

  // Find orphaned M4A files (locally available but no corresponding MP4 referenced)
  const orphanedM4aFiles = localM4aFiles
    .filter(file => !file.referenced)
    .map(file => file.name);

  // Find potentially missing M4A files (MP4 is referenced but no M4A exists)
  const missingM4aFiles: string[] = [];
  for (const refMp4 of referencedMp4Files) {
    const mp4BaseName = refMp4.replace(/\.mp4$/, '');
    
    // Check for both regular and INGESTED_ prefix versions
    const hasM4a = localM4aFiles.some(m4aFile => {
      const m4aName = m4aFile.name;
      return m4aName === `${mp4BaseName}.m4a` || 
             m4aName === `INGESTED_${mp4BaseName}.m4a`;
    });
    
    if (!hasM4a) {
      missingM4aFiles.push(`${mp4BaseName}.m4a`);
    }
  }

  return {
    localMp4Count: localMp4Files.length,
    localM4aCount: localM4aFiles.length,
    referencedMp4Count: referencedMp4Files.length,
    missingMp4Files,
    missingM4aFiles,
    orphanedMp4Files,
    orphanedM4aFiles,
    mediaFiles: {
      mp4: localMp4Files,
      m4a: localM4aFiles
    }
  };
}

/**
 * Display the check results
 */
function displayResults(results: MediaCheckResult): void {
  if (options.json) {
    // Output JSON format
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (options.summary) {
    // Display summary only
    console.log("=== Media Files Check Summary ===");
    console.log(`MP4 files in file_types/mp4: ${results.localMp4Count}`);
    console.log(`M4A files in file_types/m4a: ${results.localM4aCount}`);
    console.log(`MP4 files referenced in database: ${results.referencedMp4Count}`);
    console.log(`Missing MP4 files: ${results.missingMp4Files.length}`);
    console.log(`Missing M4A files: ${results.missingM4aFiles.length}`);
    console.log(`Orphaned MP4 files: ${results.orphanedMp4Files.length}`);
    console.log(`Orphaned M4A files: ${results.orphanedM4aFiles.length}`);
    return;
  }

  // Display detailed results
  console.log("======= MEDIA FILES CHECK REPORT =======");
  console.log("\n=== STATISTICS ===");
  console.log(`MP4 files in file_types/mp4: ${results.localMp4Count}`);
  console.log(`M4A files in file_types/m4a: ${results.localM4aCount}`);
  console.log(`MP4 files referenced in database: ${results.referencedMp4Count}`);

  console.log("\n=== MISSING MP4 FILES ===");
  console.log("These files are referenced in the database but missing locally:");
  if (results.missingMp4Files.length === 0) {
    console.log("No missing MP4 files");
  } else {
    results.missingMp4Files.forEach(file => console.log(`  - ${file}`));
  }

  console.log("\n=== MISSING M4A FILES ===");
  console.log("These M4A files might need to be extracted from their MP4 counterparts:");
  if (results.missingM4aFiles.length === 0) {
    console.log("No missing M4A files");
  } else {
    results.missingM4aFiles.forEach(file => console.log(`  - ${file}`));
  }

  console.log("\n=== ORPHANED MP4 FILES ===");
  console.log("These MP4 files exist locally but aren't referenced in the database:");
  if (results.orphanedMp4Files.length === 0) {
    console.log("No orphaned MP4 files");
  } else {
    results.orphanedMp4Files.forEach(file => console.log(`  - ${file}`));
  }

  console.log("\n=== ORPHANED M4A FILES ===");
  console.log("These M4A files exist locally but have no referenced MP4 counterpart:");
  if (results.orphanedM4aFiles.length === 0) {
    console.log("No orphaned M4A files");
  } else {
    results.orphanedM4aFiles.forEach(file => console.log(`  - ${file}`));
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const results = await checkMediaFiles();
    displayResults(results);
  } catch (error: any) {
    Logger.error(`Error in check-media-files: ${error.message}`);
    process.exit(1);
  }
}

// Execute the main function
main().catch(error => {
  Logger.error(`Unhandled error: ${error}`);
  process.exit(1);
});