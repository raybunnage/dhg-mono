# Archived on 2025-04-11 - Original file used with sources_google table
#!/usr/bin/env ts-node
/**
 * Update Presentation Disk Status
 * 
 * This script checks for MP4 files in the file_types/mp4 directory and updates the 
 * presentations table with disk availability status. It helps maintain synchronization
 * between files in Google Drive and local storage.
 * 
 * Usage:
 *   npx ts-node update-presentation-disk-status.ts [options]
 * 
 * Options:
 *   --dry-run                 Show what would be updated without making changes
 *   --force                   Process all presentations even if they already have disk status
 */

import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../../packages/shared/utils';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { LogLevel } from '../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Path to the MP4 files directory
const MP4_DIR = path.resolve(__dirname, '../../../file_types/mp4');

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force')
};

async function main() {
  try {
    Logger.info('🔍 Starting Presentation Disk Status Update');
    Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
    Logger.info(`Force mode: ${options.force ? 'ON' : 'OFF'}`);

    // Get the Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    let supabase;
    
    try {
      supabase = supabaseClientService.getClient();
      Logger.info('✅ Successfully connected to Supabase');
    } catch (error: any) {
      Logger.error('❌ Error getting Supabase client', error);
      process.exit(1);
    }

    // Check if MP4 directory exists
    if (!fs.existsSync(MP4_DIR)) {
      Logger.error(`❌ MP4 directory does not exist: ${MP4_DIR}`);
      process.exit(1);
    }

    // Get list of MP4 files
    const mp4Files = fs.readdirSync(MP4_DIR).filter(file => file.toLowerCase().endsWith('.mp4'));
    Logger.info(`📋 Found ${mp4Files.length} MP4 files in directory`);

    // Get all presentations from the database
    const { data: presentations, error: presentationsError } = await supabase
      .from('presentations')
      .select('id, filename, title, metadata');

    if (presentationsError) {
      Logger.error('❌ Error fetching presentations:', presentationsError.message);
      process.exit(1);
    }

    Logger.info(`📋 Found ${presentations.length} presentations in database`);

    // Get all Google Drive sources
    const { data: googleSources, error: sourcesError } = await supabase
      .from('sources_google')
      .select('id, name, drive_id')
      .eq('deleted', false)
      .eq('mime_type', 'video/mp4');

    if (sourcesError) {
      Logger.error('❌ Error fetching Google Drive sources:', sourcesError.message);
      process.exit(1);
    }

    Logger.info(`📋 Found ${googleSources.length} MP4 files in sources_google`);

    // Process each MP4 file
    let updateCount = 0;
    let missingCount = 0;
    let skipCount = 0;
    let pendingUpdates = [];

    // Build a map of filename to file existence
    const fileExistsMap = new Map();
    mp4Files.forEach(filename => {
      fileExistsMap.set(filename.toLowerCase(), true);
    });

    // First pass: check which files we have on disk that match presentations
    for (const presentation of presentations) {
      const filename = presentation.filename;
      const metadata = presentation.metadata || {};
      const existingDiskStatus = metadata.available_on_disk;
      
      // Skip if already processed and not in force mode
      if (existingDiskStatus !== undefined && !options.force) {
        skipCount++;
        continue;
      }

      // Check if the file exists on disk (exact match or close match)
      const exactFileExists = fileExistsMap.has(filename.toLowerCase());
      
      // Look for an INGESTED_ variant
      const ingestedVariant = `INGESTED_${filename}`;
      const ingestedExists = fileExistsMap.has(ingestedVariant.toLowerCase());
      
      const fileExists = exactFileExists || ingestedExists;
      const foundFilename = exactFileExists ? filename : (ingestedExists ? ingestedVariant : null);
      
      // Prepare the update
      if (fileExists) {
        const fileSize = fs.statSync(path.join(MP4_DIR, foundFilename)).size;
        const fileSizeMB = Math.round(fileSize / (1024 * 1024));
        
        const updatedMetadata = {
          ...metadata,
          available_on_disk: true,
          disk_filename: foundFilename,
          disk_file_size: fileSize,
          disk_file_size_mb: fileSizeMB,
          disk_status_updated: new Date().toISOString()
        };
        
        pendingUpdates.push({
          id: presentation.id,
          title: presentation.title || 'Untitled',
          filename: presentation.filename,
          diskFilename: foundFilename,
          oldStatus: existingDiskStatus,
          newMetadata: updatedMetadata,
          fileSizeMB
        });
      } else {
        // File not found on disk
        const updatedMetadata = {
          ...metadata,
          available_on_disk: false,
          disk_status_updated: new Date().toISOString()
        };
        
        // Remove disk-specific fields if they exist
        delete updatedMetadata.disk_filename;
        delete updatedMetadata.disk_file_size;
        delete updatedMetadata.disk_file_size_mb;
        
        pendingUpdates.push({
          id: presentation.id,
          title: presentation.title || 'Untitled',
          filename: presentation.filename,
          oldStatus: existingDiskStatus,
          newMetadata: updatedMetadata,
          missing: true
        });
        
        missingCount++;
      }
    }

    // Display the pending updates
    Logger.info('\n=== Pending Updates ===');
    Logger.info(`Total presentations: ${presentations.length}`);
    Logger.info(`Presentations to update: ${pendingUpdates.length}`);
    Logger.info(`Presentations with files on disk: ${pendingUpdates.length - missingCount}`);
    Logger.info(`Presentations missing files on disk: ${missingCount}`);
    Logger.info(`Presentations skipped (already processed): ${skipCount}`);
    
    // Show details of each update
    if (pendingUpdates.length > 0) {
      Logger.info('\nUpdate details:');
      
      // First show files found on disk
      const foundUpdates = pendingUpdates.filter(update => !update.missing);
      if (foundUpdates.length > 0) {
        Logger.info('\n📁 Files found on disk:');
        foundUpdates.forEach(update => {
          Logger.info(`- "${update.title}" (${update.filename})`);
          Logger.info(`  📄 Found as: ${update.diskFilename}`);
          Logger.info(`  📊 Size: ${update.fileSizeMB} MB`);
          Logger.info(`  ${update.oldStatus === undefined ? '🆕 New entry' : update.oldStatus ? '🔄 Status unchanged' : '✅ Status changed to available'}`);
        });
      }
      
      // Then show missing files
      const missingUpdates = pendingUpdates.filter(update => update.missing);
      if (missingUpdates.length > 0) {
        Logger.info('\n❌ Files missing on disk:');
        missingUpdates.forEach(update => {
          Logger.info(`- "${update.title}" (${update.filename})`);
          Logger.info(`  ${update.oldStatus === undefined ? '🆕 New entry' : !update.oldStatus ? '🔄 Status unchanged' : '⚠️ Status changed to unavailable'}`);
        });
      }
    }

    // If this is not a dry run, actually update the database
    if (!options.dryRun && pendingUpdates.length > 0) {
      Logger.info('\n=== Applying Updates to Database ===');
      
      for (const update of pendingUpdates) {
        const { id, newMetadata } = update;
        
        try {
          const { error } = await supabase
            .from('presentations')
            .update({ metadata: newMetadata })
            .eq('id', id);
            
          if (error) {
            Logger.error(`❌ Error updating presentation ${id}:`, error.message);
          } else {
            updateCount++;
            if (update.missing) {
              Logger.info(`⚠️ Updated ${update.title} - marked as unavailable on disk`);
            } else {
              Logger.info(`✅ Updated ${update.title} - marked as available on disk`);
            }
          }
        } catch (error: any) {
          Logger.error(`❌ Exception updating presentation ${id}:`, error.message);
        }
      }
      
      Logger.info(`\n✅ Successfully updated ${updateCount} of ${pendingUpdates.length} presentations`);
    } else if (options.dryRun) {
      Logger.info('\n=== DRY RUN - No changes were made ===');
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