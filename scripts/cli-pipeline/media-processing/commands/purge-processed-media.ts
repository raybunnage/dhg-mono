#!/usr/bin/env ts-node
/**
 * Purge Processed Media Files
 * 
 * This script identifies successfully processed mp4 and m4a files and removes them
 * to free up disk space. A file is considered "successfully processed" if:
 * 1. It has a corresponding entry in expert_documents
 * 2. The raw_content field is populated (meaning audio extraction and transcription are complete)
 * 
 * Usage:
 *   purge-processed-media.ts [options]
 * 
 * Options:
 *   --dry-run       Show what would be deleted without actually removing files
 *   --force         Delete without confirmation
 *   --days [num]    Only purge files processed more than [num] days ago
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Logger } from '../../../../packages/shared/utils';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  days: 0
};

// Get days if specified
const daysIndex = args.indexOf('--days');
if (daysIndex !== -1 && args[daysIndex + 1]) {
  const daysArg = parseInt(args[daysIndex + 1]);
  if (!isNaN(daysArg)) {
    options.days = daysArg;
  }
}

// Define the file paths
const MP4_DIR = path.join(process.cwd(), 'file_types', 'mp4');
const M4A_DIR = path.join(process.cwd(), 'file_types', 'm4a');

// Helper function to confirm deletion
async function confirmDeletion(message: string): Promise<boolean> {
  if (options.force) {
    return true;
  }
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`${message} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Get all successfully processed files
 */
async function getProcessedFiles(supabase: any): Promise<{ mp4Files: string[]; m4aFiles: string[] }> {
  // Query for successfully processed documents
  let query = supabase
    .from('expert_documents')
    .select('id, source_id, raw_content, processing_status, processed_content, last_processed_at')
    .eq('content_type', 'presentation')
    .eq('processing_status', 'completed')
    .not('raw_content', 'is', null);
  
  // Apply days filter if specified
  if (options.days > 0) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.days);
    const cutoffString = cutoffDate.toISOString();
    query = query.lt('last_processed_at', cutoffString);
  }
  
  const { data: documents, error } = await query;
  
  if (error) {
    Logger.error(`❌ Error fetching processed documents: ${error.message}`);
    return { mp4Files: [], m4aFiles: [] };
  }
  
  if (!documents || documents.length === 0) {
    Logger.info('ℹ️ No successfully processed documents found');
    return { mp4Files: [], m4aFiles: [] };
  }
  
  Logger.info(`Found ${documents.length} successfully processed documents`);
  
  // Get source file information for each document
  const sourceIds = documents.map((doc: any) => doc.source_id);
  
  const { data: sources, error: sourcesError } = await supabase
    .from('google_sources')
    .select('id, name, mime_type')
    .in('id', sourceIds);
  
  if (sourcesError) {
    Logger.error(`❌ Error fetching source information: ${sourcesError.message}`);
    return { mp4Files: [], m4aFiles: [] };
  }
  
  // Create a map of source IDs to filenames
  const sourceMap = new Map();
  for (const source of sources || []) {
    sourceMap.set(source.id, source.name);
  }
  
  // Get corresponding file paths
  const mp4Files: string[] = [];
  const m4aFiles: string[] = [];
  
  for (const doc of documents) {
    const sourceName = sourceMap.get(doc.source_id);
    if (!sourceName) continue;
    
    const baseName = sourceName.replace(/\.[^/.]+$/, "");
    
    // Find corresponding files in the directories
    try {
      const mp4Matches = findMatchingFiles(MP4_DIR, baseName, '.mp4');
      const m4aMatches = findMatchingFiles(M4A_DIR, baseName, '.m4a');
      
      mp4Files.push(...mp4Matches);
      m4aFiles.push(...m4aMatches);
    } catch (error: any) {
      Logger.warn(`⚠️ Error finding files for ${baseName}: ${error.message}`);
    }
  }
  
  return { mp4Files, m4aFiles };
}

/**
 * Find matching files in a directory
 */
function findMatchingFiles(directory: string, baseName: string, extension: string): string[] {
  if (!fs.existsSync(directory)) {
    Logger.warn(`⚠️ Directory ${directory} does not exist`);
    return [];
  }
  
  const files = fs.readdirSync(directory);
  return files
    .filter(file => 
      (file.toLowerCase().includes(baseName.toLowerCase()) || 
       file.toLowerCase().includes(`INGESTED_${baseName.toLowerCase()}`)) && 
      file.endsWith(extension)
    )
    .map(file => path.join(directory, file));
}

/**
 * Delete files
 */
async function deleteFiles(files: string[], fileType: string): Promise<number> {
  if (files.length === 0) {
    Logger.info(`ℹ️ No ${fileType} files to delete`);
    return 0;
  }
  
  Logger.info(`Found ${files.length} ${fileType} files to delete:`);
  files.forEach(file => Logger.info(`  - ${file}`));
  
  if (options.dryRun) {
    Logger.info(`ℹ️ DRY RUN: Would delete ${files.length} ${fileType} files`);
    return 0;
  }
  
  const confirmed = await confirmDeletion(
    `Do you want to delete these ${files.length} ${fileType} files?`
  );
  
  if (!confirmed) {
    Logger.info(`ℹ️ Deletion canceled for ${fileType} files`);
    return 0;
  }
  
  let deleteCount = 0;
  for (const file of files) {
    try {
      fs.unlinkSync(file);
      Logger.info(`✅ Deleted ${file}`);
      deleteCount++;
    } catch (error: any) {
      Logger.error(`❌ Error deleting ${file}: ${error.message}`);
    }
  }
  
  return deleteCount;
}

/**
 * Calculate disk space saved
 */
function calculateSpaceSaved(files: string[]): { bytes: number; megabytes: number } {
  let totalBytes = 0;
  
  for (const file of files) {
    try {
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        totalBytes += stats.size;
      }
    } catch (error) {
      // Ignore errors
    }
  }
  
  return {
    bytes: totalBytes,
    megabytes: totalBytes / (1024 * 1024)
  };
}

/**
 * Main function
 */
async function main() {
  try {
    // Get the Supabase client using singleton pattern
    const supabaseClientService = SupabaseClientService.getInstance();
    let supabase: any;
    
    try {
      supabase = supabaseClientService.getClient();
      Logger.info('✅ Successfully connected to Supabase');
    } catch (error: any) {
      Logger.error('❌ Error getting Supabase client', error);
      process.exit(1);
    }
    
    // Display configuration
    Logger.info('🧹 Purge Processed Media Files');
    Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL DELETE'}`);
    if (options.days > 0) {
      Logger.info(`Only files processed more than ${options.days} days ago`);
    }
    
    // Get processed files
    const { mp4Files, m4aFiles } = await getProcessedFiles(supabase);
    
    // Calculate space that would be saved
    const mp4Space = calculateSpaceSaved(mp4Files);
    const m4aSpace = calculateSpaceSaved(m4aFiles);
    const totalSpace = {
      bytes: mp4Space.bytes + m4aSpace.bytes,
      megabytes: mp4Space.megabytes + m4aSpace.megabytes
    };
    
    Logger.info(`Space that would be freed: ${totalSpace.megabytes.toFixed(2)} MB total`);
    Logger.info(`  - MP4 files: ${mp4Space.megabytes.toFixed(2)} MB`);
    Logger.info(`  - M4A files: ${m4aSpace.megabytes.toFixed(2)} MB`);
    
    // Delete the files
    const mp4Deleted = await deleteFiles(mp4Files, 'MP4');
    const m4aDeleted = await deleteFiles(m4aFiles, 'M4A');
    
    Logger.info(`✅ Purge process complete`);
    Logger.info(`Deleted ${mp4Deleted} MP4 files and ${m4aDeleted} M4A files`);
    if (mp4Deleted > 0 || m4aDeleted > 0) {
      Logger.info(`Freed approximately ${totalSpace.megabytes.toFixed(2)} MB of disk space`);
    }
  } catch (error: any) {
    Logger.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Execute the main function
main().catch((error: any) => {
  Logger.error('Unhandled error:', error);
  process.exit(1);
});