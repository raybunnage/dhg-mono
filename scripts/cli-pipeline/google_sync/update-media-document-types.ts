#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

const supabaseClient = SupabaseClientService.getInstance().getClient();

/**
 * Updates document_type_id for sources_google records based on mime_type and folder levels
 * - Sets '3e7c880c-d821-4d01-8cc5-3547bdd2e347' for 'video/mp4' files
 * - Sets '6ece37e7-840d-4a0c-864d-9f1f971b1d7e' for 'audio/mp4' files
 * - Sets 'bd903d99-64a1-4297-ba76-1094ab235dac' for folders at level = 0
 * - Sets '0d61a685-10e0-4c82-b964-60b88b02ac15' for folders marked as is_root = true
 * - Sets 'dd6a2cea-c74a-4c6d-8d30-eb20d2c70ddd' for folders at level > 0
 */
async function updateMediaDocumentTypes(options: { dryRun?: boolean }) {
  const startTime = new Date();
  const trackingId = await commandTrackingService.startTracking('google_sync', 'update-media-document-types');
  
  const dryRun = options.dryRun || false;
  
  try {
    console.log(`${dryRun ? '[DRY RUN] ' : ''}Updating document_type_id for media files...`);

    // Get video files that need updating
    const { data: videoFiles, error: videoError } = await supabaseClient
      .from('sources_google')
      .select('id, name, mime_type')
      .eq('mime_type', 'video/mp4')
      .is('document_type_id', null);
    
    if (videoError) {
      throw new Error(`Error fetching video files: ${videoError.message}`);
    }

    // Get audio files that need updating
    const { data: audioFiles, error: audioError } = await supabaseClient
      .from('sources_google')
      .select('id, name, mime_type')
      .eq('mime_type', 'audio/mp4')
      .is('document_type_id', null);
    
    if (audioError) {
      throw new Error(`Error fetching audio files: ${audioError.message}`);
    }

    // Get level 0 folders that need updating
    const { data: level0Folders, error: level0Error } = await supabaseClient
      .from('sources_google')
      .select('id, name, path_depth')
      .eq('path_depth', 0)
      .is('document_type_id', null)
      .is('is_root', false); // Exclude root folders, we'll handle them separately
    
    if (level0Error) {
      throw new Error(`Error fetching level 0 folders: ${level0Error.message}`);
    }

    // Get root folders that need updating
    const { data: rootFolders, error: rootError } = await supabaseClient
      .from('sources_google')
      .select('id, name')
      .eq('is_root', true)
      .is('document_type_id', null);
    
    if (rootError) {
      throw new Error(`Error fetching root folders: ${rootError.message}`);
    }

    // Get higher level folders that need updating
    const { data: higherLevelFolders, error: higherLevelError } = await supabaseClient
      .from('sources_google')
      .select('id, name, path_depth')
      .gt('path_depth', 0)
      .is('document_type_id', null)
      .is('is_root', false); // Exclude root folders, we handled them separately
    
    if (higherLevelError) {
      throw new Error(`Error fetching higher level folders: ${higherLevelError.message}`);
    }

    const totalFiles = (videoFiles?.length || 0) + (audioFiles?.length || 0) + 
                      (level0Folders?.length || 0) + (rootFolders?.length || 0) + 
                      (higherLevelFolders?.length || 0);
    console.log(`Found: 
    - ${videoFiles?.length || 0} video/mp4 files
    - ${audioFiles?.length || 0} audio/mp4 files
    - ${level0Folders?.length || 0} level 0 folders
    - ${rootFolders?.length || 0} root folders
    - ${higherLevelFolders?.length || 0} higher level folders
    without document_type_id`);

    if (totalFiles === 0) {
      console.log('No files need updating.');
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: 0,
        summary: 'No files needed updating'
      });
      return;
    }

    if (dryRun) {
      console.log('[DRY RUN] Would update the following:');
      if (videoFiles && videoFiles.length > 0) {
        console.log(`- ${videoFiles.length} video files with document_type_id = '3e7c880c-d821-4d01-8cc5-3547bdd2e347'`);
        videoFiles.slice(0, 5).forEach((file: { name: string }) => console.log(`  - ${file.name}`));
        if (videoFiles.length > 5) console.log(`  - ... and ${videoFiles.length - 5} more`);
      }
      
      if (audioFiles && audioFiles.length > 0) {
        console.log(`- ${audioFiles.length} audio files with document_type_id = '6ece37e7-840d-4a0c-864d-9f1f971b1d7e'`);
        audioFiles.slice(0, 5).forEach((file: { name: string }) => console.log(`  - ${file.name}`));
        if (audioFiles.length > 5) console.log(`  - ... and ${audioFiles.length - 5} more`);
      }

      if (level0Folders && level0Folders.length > 0) {
        console.log(`- ${level0Folders.length} level 0 folders with document_type_id = 'bd903d99-64a1-4297-ba76-1094ab235dac'`);
        level0Folders.slice(0, 5).forEach((file: { name: string }) => console.log(`  - ${file.name}`));
        if (level0Folders.length > 5) console.log(`  - ... and ${level0Folders.length - 5} more`);
      }

      if (rootFolders && rootFolders.length > 0) {
        console.log(`- ${rootFolders.length} root folders with document_type_id = '0d61a685-10e0-4c82-b964-60b88b02ac15'`);
        rootFolders.slice(0, 5).forEach((file: { name: string }) => console.log(`  - ${file.name}`));
        if (rootFolders.length > 5) console.log(`  - ... and ${rootFolders.length - 5} more`);
      }

      if (higherLevelFolders && higherLevelFolders.length > 0) {
        console.log(`- ${higherLevelFolders.length} higher level folders with document_type_id = 'dd6a2cea-c74a-4c6d-8d30-eb20d2c70ddd'`);
        higherLevelFolders.slice(0, 5).forEach((file: { name: string }) => console.log(`  - ${file.name}`));
        if (higherLevelFolders.length > 5) console.log(`  - ... and ${higherLevelFolders.length - 5} more`);
      }
    } else {
      // Update video files
      if (videoFiles && videoFiles.length > 0) {
        const { error: updateVideoError } = await supabaseClient
          .from('sources_google')
          .update({ document_type_id: '3e7c880c-d821-4d01-8cc5-3547bdd2e347' })
          .eq('mime_type', 'video/mp4')
          .is('document_type_id', null);
        
        if (updateVideoError) {
          throw new Error(`Error updating video files: ${updateVideoError.message}`);
        }
        console.log(`Updated ${videoFiles.length} video/mp4 files with document_type_id`);
      }

      // Update audio files
      if (audioFiles && audioFiles.length > 0) {
        const { error: updateAudioError } = await supabaseClient
          .from('sources_google')
          .update({ document_type_id: '6ece37e7-840d-4a0c-864d-9f1f971b1d7e' })
          .eq('mime_type', 'audio/mp4')
          .is('document_type_id', null);
        
        if (updateAudioError) {
          throw new Error(`Error updating audio files: ${updateAudioError.message}`);
        }
        console.log(`Updated ${audioFiles.length} audio/mp4 files with document_type_id`);
      }

      // Update level 0 folders
      if (level0Folders && level0Folders.length > 0) {
        const { error: updateLevel0Error } = await supabaseClient
          .from('sources_google')
          .update({ document_type_id: 'bd903d99-64a1-4297-ba76-1094ab235dac' })
          .eq('path_depth', 0)
          .is('document_type_id', null)
          .is('is_root', false);
        
        if (updateLevel0Error) {
          throw new Error(`Error updating level 0 folders: ${updateLevel0Error.message}`);
        }
        console.log(`Updated ${level0Folders.length} level 0 folders with document_type_id`);
      }

      // Update root folders
      if (rootFolders && rootFolders.length > 0) {
        const { error: updateRootError } = await supabaseClient
          .from('sources_google')
          .update({ document_type_id: '0d61a685-10e0-4c82-b964-60b88b02ac15' })
          .eq('is_root', true)
          .is('document_type_id', null);
        
        if (updateRootError) {
          throw new Error(`Error updating root folders: ${updateRootError.message}`);
        }
        console.log(`Updated ${rootFolders.length} root folders with document_type_id`);
      }

      // Update higher level folders
      if (higherLevelFolders && higherLevelFolders.length > 0) {
        const { error: updateHigherLevelError } = await supabaseClient
          .from('sources_google')
          .update({ document_type_id: 'dd6a2cea-c74a-4c6d-8d30-eb20d2c70ddd' })
          .gt('path_depth', 0)
          .is('document_type_id', null)
          .is('is_root', false);
        
        if (updateHigherLevelError) {
          throw new Error(`Error updating higher level folders: ${updateHigherLevelError.message}`);
        }
        console.log(`Updated ${higherLevelFolders.length} higher level folders with document_type_id`);
      }
    }

    await commandTrackingService.completeTracking(trackingId, {
      recordsAffected: totalFiles,
      summary: dryRun 
        ? `[DRY RUN] Would update ${totalFiles} media files with document_type_id`
        : `Updated ${totalFiles} media files with document_type_id`
    });

    console.log(`${dryRun ? '[DRY RUN] ' : ''}Media file document types update complete!`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error updating media document types: ${errorMessage}`);
    await commandTrackingService.failTracking(trackingId, `Command failed: ${errorMessage}`);
    throw error;
  }
}

// CLI setup
const program = new Command();

program
  .name('update-media-document-types')
  .description('Update document_type_id for video/mp4 and audio/mp4 files')
  .option('--dry-run', 'Show what would be updated without making changes')
  .action(updateMediaDocumentTypes);

program.parse(process.argv);