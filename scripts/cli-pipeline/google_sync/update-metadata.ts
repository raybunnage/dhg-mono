#!/usr/bin/env ts-node
/**
 * Update metadata for existing files
 * 
 * This command refreshes metadata for files that have changed:
 * - Updates size, thumbnail links, modification times
 * - Handles file renames
 * - Extracts video metadata where available
 * 
 * Usage:
 *   ts-node update-metadata.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be updated without making changes
 *   --limit <n>        Limit number of files to update (default: 100)
 *   --verbose          Show detailed logs
 *   --force            Update all files, not just changed ones
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { getGoogleDriveService, GoogleDriveService } from '../../../packages/shared/services/google-drive';
import type { Database } from '../../../supabase/types';
import { getActiveFilterProfile } from './get-active-filter-profile';

// Load environment files
function loadEnvFiles() {
  const envFiles = ['.env', '.env.local', '.env.development'];
  
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`Loading environment variables from ${file}`);
      dotenv.config({ path: filePath });
    }
  }
}

loadEnvFiles();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const forceUpdate = args.includes('--force');

const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 && args[limitIndex + 1] 
  ? parseInt(args[limitIndex + 1], 10) 
  : 100;

// Create Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

interface UpdateResult {
  filesChecked: number;
  filesUpdated: number;
  filesRenamed: number;
  filesSkipped: number;
  errors: string[];
  duration: number;
}

/**
 * Update metadata for files
 */
async function updateMetadata(
  driveService: GoogleDriveService,
  rootDriveId?: string
): Promise<UpdateResult> {
  const startTime = Date.now();
  const result: UpdateResult = {
    filesChecked: 0,
    filesUpdated: 0,
    filesRenamed: 0,
    filesSkipped: 0,
    errors: [],
    duration: 0
  };
  
  try {
    // Build query for files to check
    let query = supabase
      .from('sources_google')
      .select('*')
      .eq('is_deleted', false)
      .neq('mime_type', 'application/vnd.google-apps.folder')
      .order('updated_at', { ascending: true }) // Oldest updated first
      .limit(limit);
    
    // Apply root drive filter if provided
    if (rootDriveId) {
      query = query.eq('root_drive_id', rootDriveId);
    }
    
    // If not forcing, only get files that haven't been updated recently
    if (!forceUpdate) {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      query = query.lt('updated_at', oneDayAgo.toISOString());
    }
    
    const { data: files, error: queryError } = await query;
    
    if (queryError) throw queryError;
    
    if (!files || files.length === 0) {
      console.log('✓ No files need metadata updates');
      result.duration = (Date.now() - startTime) / 1000;
      return result;
    }
    
    console.log(`📋 Found ${files.length} files to check`);
    
    // Process files in batches for API efficiency
    const BATCH_SIZE = 20;
    const batches = Math.ceil(files.length / BATCH_SIZE);
    const updateStartTime = Date.now();
    
    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, files.length);
      const batch = files.slice(start, end);
      
      process.stdout.write('\r\x1b[K');
      process.stdout.write(
        `🔍 Progress: ${i + 1}/${batches} batches | ` +
        `${result.filesChecked}/${files.length} files | ` +
        `📝 ${result.filesUpdated} updated | ` +
        `✏️ ${result.filesRenamed} renamed`
      );
      
      // Fetch metadata for all files in batch in parallel
      const metadataPromises = batch.map(async (file) => {
        try {
          if (!file.drive_id) {
            return { file, error: 'No drive_id' };
          }
          
          const fileData = await driveService.getFile(
            file.drive_id,
            'id,name,mimeType,webViewLink,modifiedTime,size,thumbnailLink'
          );
          
          return { file, fileData, success: true };
        } catch (error: any) {
          if (error.code === 404) {
            return { file, error: 'File not found', notFound: true };
          }
          return { file, error: error.message };
        }
      });
      
      const metadataResults = await Promise.all(metadataPromises);
      
      // Process results
      for (const metadataResult of metadataResults) {
        result.filesChecked++;
        
        if (!metadataResult.success) {
          if (metadataResult.notFound && !isDryRun) {
            // Mark file as deleted if not found
            await supabase
              .from('sources_google')
              .update({
                is_deleted: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', metadataResult.file.id);
            
            if (isVerbose) {
              console.log(`  ✗ Marked as deleted: ${metadataResult.file.name}`);
            }
          }
          continue;
        }
        
        const { file, fileData } = metadataResult;
        const updates: any = {
          updated_at: new Date().toISOString()
        };
        
        // Check for changes
        let hasChanges = false;
        let isRenamed = false;
        
        // Check name change
        if (fileData.name !== file.name) {
          updates.name = fileData.name;
          hasChanges = true;
          isRenamed = true;
          
          // Update path if name changed
          if (file.path) {
            const pathParts = file.path.split('/');
            pathParts[pathParts.length - 1] = fileData.name;
            updates.path = pathParts.join('/');
            
            if (file.path_array && Array.isArray(file.path_array)) {
              const newPathArray = [...file.path_array];
              newPathArray[newPathArray.length - 1] = fileData.name;
              updates.path_array = newPathArray;
            }
          }
        }
        
        // Check size change
        if (fileData.size && parseInt(fileData.size) !== file.size) {
          updates.size = parseInt(fileData.size);
          hasChanges = true;
        }
        
        // Check modification time
        if (fileData.modifiedTime && fileData.modifiedTime !== file.modified_at) {
          updates.modified_at = fileData.modifiedTime;
          hasChanges = true;
        }
        
        // Update links
        if (fileData.thumbnailLink !== file.thumbnail_link) {
          updates.thumbnail_link = fileData.thumbnailLink;
          hasChanges = true;
        }
        
        if (fileData.webViewLink !== file.web_view_link) {
          updates.web_view_link = fileData.webViewLink;
          hasChanges = true;
        }
        
        // Update metadata
        const metadata = file.metadata || {};
        metadata.lastMetadataUpdate = new Date().toISOString();
        
        if (fileData.modifiedTime) metadata.modifiedTime = fileData.modifiedTime;
        if (fileData.thumbnailLink) metadata.thumbnailLink = fileData.thumbnailLink;
        if (fileData.webViewLink) metadata.webViewLink = fileData.webViewLink;
        
        updates.metadata = metadata;
        
        // Extract video metadata for MP4 files if available locally
        if (file.mime_type === 'video/mp4' && !isDryRun) {
          const mp4Dir = path.join(process.cwd(), 'file_types', 'mp4');
          const possiblePaths = [
            path.join(mp4Dir, file.name),
            path.join(mp4Dir, `INGESTED_${file.name}`)
          ];
          
          for (const mp4Path of possiblePaths) {
            if (fs.existsSync(mp4Path)) {
              try {
                const { converterService } = require('../../../packages/shared/services/converter-service');
                const result = await converterService.extractVideoMetadata(mp4Path);
                
                if (result.success && result.metadata) {
                  metadata.videoDuration = result.metadata.durationSeconds;
                  metadata.videoMetadata = result.metadata;
                  hasChanges = true;
                  
                  if (isVerbose) {
                    console.log(`  ✓ Extracted video metadata for ${file.name}`);
                  }
                }
              } catch (error: any) {
                if (isVerbose) {
                  console.log(`  ⚠ Could not extract video metadata: ${error.message}`);
                }
              }
              break;
            }
          }
        }
        
        // Apply updates if there are changes
        if (hasChanges || forceUpdate) {
          if (!isDryRun) {
            const { error: updateError } = await supabase
              .from('sources_google')
              .update(updates)
              .eq('id', file.id);
            
            if (updateError) {
              result.errors.push(`Update error for ${file.name}: ${updateError.message}`);
            } else {
              result.filesUpdated++;
              if (isRenamed) result.filesRenamed++;
              
              if (isVerbose) {
                if (isRenamed) {
                  console.log(`  ✓ Renamed: "${file.name}" → "${fileData.name}"`);
                } else {
                  console.log(`  ✓ Updated: ${file.name}`);
                }
              }
            }
          } else {
            result.filesUpdated++;
            if (isRenamed) result.filesRenamed++;
            
            if (isVerbose) {
              console.log(`  [DRY RUN] Would update: ${file.name}${isRenamed ? ` → ${fileData.name}` : ''}`);
            }
          }
        } else {
          result.filesSkipped++;
          if (isVerbose) {
            console.log(`  - No changes: ${file.name}`);
          }
        }
      }
    }
    
    // Show final progress summary
    const updateElapsed = (Date.now() - updateStartTime) / 1000;
    const rate = result.filesChecked / updateElapsed;
    
    process.stdout.write('\r\x1b[K');
    console.log(
      `✅ Update complete: ${result.filesChecked} files checked | ` +
      `${result.filesUpdated} updated | ` +
      `${result.filesRenamed} renamed | ` +
      `${updateElapsed.toFixed(1)}s | ` +
      `${rate.toFixed(0)} files/sec`
    );
    
  } catch (error: any) {
    console.error('\n❌ Update error:', error.message);
    result.errors.push(error.message);
  }
  
  result.duration = (Date.now() - startTime) / 1000;
  return result;
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Update File Metadata ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit} files`);
  console.log(`Force update: ${forceUpdate}`);
  console.log('============================\n');
  
  try {
    // Check for active filter profile
    const activeFilter = await getActiveFilterProfile();
    let rootDriveId: string | undefined;
    
    if (activeFilter && activeFilter.rootDriveId) {
      console.log(`🔍 Active filter: "${activeFilter.profile.name}"`);
      console.log(`📁 Using root_drive_id: ${activeFilter.rootDriveId}\n`);
      rootDriveId = activeFilter.rootDriveId;
    }
    
    // Initialize Google Drive service
    const driveService = getGoogleDriveService(supabase);
    
    // Update metadata
    const result = await updateMetadata(driveService, rootDriveId);
    
    // Display results
    console.log('\n=== Update Complete ===');
    console.log(`✓ Files checked: ${result.filesChecked}`);
    console.log(`✓ Files updated: ${result.filesUpdated}`);
    console.log(`✓ Files renamed: ${result.filesRenamed}`);
    console.log(`✓ Files skipped: ${result.filesSkipped}`);
    console.log(`✓ Errors: ${result.errors.length}`);
    console.log(`✓ Duration: ${result.duration.toFixed(1)}s`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.slice(0, 5).forEach(err => console.log(`  - ${err}`));
      if (result.errors.length > 5) {
        console.log(`  ... and ${result.errors.length - 5} more errors`);
      }
    }
    
    process.exit(result.errors.length > 0 ? 1 : 0);
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Export for use as module
export { updateMetadata };

// Run if called directly
if (require.main === module) {
  main();
}