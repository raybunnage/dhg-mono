#!/usr/bin/env ts-node
import { Command } from 'commander';
import { Logger } from '../../../../packages/shared/utils/logger';
import { PresentationService } from '../services/presentation-service';
import { v4 as uuidv4 } from 'uuid';
import { getActiveFilterProfile } from '../get-active-filter-profile';

/**
 * Command to create presentations for folders that don't have them yet.
 * This integrates the functionality from test-create-one-final.ts into the CLI pipeline.
 */

interface CommandOptions {
  limit?: number;
  verbose?: boolean;
  dryRun?: boolean;
}

async function createPresentationForFolder(folderData: any, presentationService: any, verbose: boolean): Promise<boolean> {
  try {
    if (verbose) {
      Logger.info(`Processing folder: ${folderData.name} (${folderData.id})`);
    }
    const folderId = folderData.id;
    
    // First check if a presentation already exists for this folder
    const { data: existingPresentations, error: existingError } = await presentationService.supabaseClient
      .from('media_presentations')
      .select('id, title')
      .eq('high_level_folder_source_id', folderId)
      .limit(1);
    
    if (!existingError && existingPresentations && existingPresentations.length > 0) {
      if (verbose) {
        Logger.info(`Presentation already exists for folder ${folderData.name}: ${existingPresentations[0].id}`);
      }
      return false;
    }
    
    Logger.info(`Found folder: ${folderData.name} with ID: ${folderId}`);
    
    // Get folder details - we should already have them from the parameter
    const folder = folderData;
    
    if (!folder || !folder.main_video_id) {
      Logger.error('Invalid folder data or missing main_video_id');
      return false;
    }
    
    // Get video details
    const { data: videoDetails, error: videoError } = await presentationService.supabaseClient
      .from('sources_google')
      .select('id, name, mime_type, drive_id, created_at, modified_at')
      .eq('id', folder.main_video_id)
      .single();
    
    if (videoError || !videoDetails) {
      Logger.error(`Video not found for ${folder.main_video_id}:`, videoError);
      return false;
    }
    
    Logger.info(`Found video: ${videoDetails.name}`);
    
    // Get expert document for the video
    let expertDocumentId = null;
    const { data: videoDocuments, error: videoDocError } = await presentationService.supabaseClient
      .from('expert_documents')
      .select('id')
      .eq('source_id', folder.main_video_id);
      
    if (!videoDocError && videoDocuments && videoDocuments.length > 0) {
      expertDocumentId = videoDocuments[0].id;
      Logger.info(`Found expert document for video: ${expertDocumentId}`);
    }
    
    // Create a new presentation directly
    const newPresentationId = uuidv4();
    const newPresentation = {
      id: newPresentationId,
      title: folder.name,
      video_source_id: folder.main_video_id,
      high_level_folder_source_id: folder.id,
      root_drive_id: folder.root_drive_id || folder.drive_id, // Use root_drive_id from folder data
      web_view_link: `https://drive.google.com/drive/folders/${folder.drive_id}`,
      duration_seconds: 0,
      expert_document_id: expertDocumentId, // Set from video's expert document
      view_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    if (verbose) {
      Logger.info(`Creating presentation with ID: ${newPresentationId}`);
    }
    
    // Insert the presentation
    const { data: insertedPresentation, error: insertError } = await presentationService.supabaseClient
      .from('media_presentations')
      .insert(newPresentation)
      .select();
    
    if (insertError) {
      Logger.error('Error creating presentation:', insertError);
      return false;
    }
    
    Logger.info(`Successfully created presentation: ${insertedPresentation[0].id}`);
    
    // Find files in the folder for assets
    const { data: folderFiles, error: folderFilesError } = await presentationService.supabaseClient
      .from('sources_google')
      .select('id, name, mime_type')
      .eq('parent_folder_id', folder.drive_id);
    
    if (folderFilesError) {
      Logger.error('Error fetching folder files:', folderFilesError);
      return true; // Still return true because we did create the presentation
    }
    
    if (folderFiles && folderFiles.length > 0) {
      for (const file of folderFiles) {
        if (file.id !== folder.main_video_id) { // Skip the main video file
          if (verbose) {
            Logger.info(`Processing associated file: ${file.name} (${file.mime_type})`);
          }
          
          // Create an asset for this file
          const assetId = uuidv4();
          
          // Get expert document for this file
          let assetExpertDocumentId = null;
          const { data: fileDocuments, error: fileDocError } = await presentationService.supabaseClient
            .from('expert_documents')
            .select('id')
            .eq('source_id', file.id);
            
          if (!fileDocError && fileDocuments && fileDocuments.length > 0) {
            assetExpertDocumentId = fileDocuments[0].id;
            if (verbose) {
              Logger.info(`Found expert document for file ${file.name}: ${assetExpertDocumentId}`);
            }
          }
          
          // Determine asset type based on mime type
          let assetType = 'document'; // Default to document instead of 'other'
          if (file.mime_type.includes('audio')) {
            assetType = 'audio';
          } else if (file.mime_type.includes('video')) {
            assetType = 'video';
          } else if (file.mime_type.includes('pdf')) {
            assetType = 'document';
          } else if (file.mime_type.includes('word')) {
            assetType = 'document';
          } else if (file.mime_type.includes('text')) {
            assetType = 'transcript';
          }
          
          // Determine asset role based on file name
          let assetRole = 'supplementary';
          if (file.name.toLowerCase().includes('transcript')) {
            assetType = 'transcript';
            assetRole = 'main'; // Using 'main' instead of 'primary' as it's a valid enum value
          } else if (file.name.toLowerCase().includes('summary')) {
            assetType = 'document'; // Using 'document' instead of 'summary' as it's a valid enum value
            assetRole = 'supplementary';
          } else if (file.name.toLowerCase().includes('bio') || 
                    file.name.toLowerCase().includes('profile')) {
            // Don't set to expert_bio as it causes enum errors
            assetType = 'document';
            assetRole = 'supplementary';
          }
          
          const newAsset = {
            id: assetId,
            presentation_id: newPresentationId,
            asset_type: assetType,
            asset_role: assetRole,
            asset_source_id: file.id,
            asset_expert_document_id: assetExpertDocumentId, // Set the expert document ID for the asset
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const { error: assetError } = await presentationService.supabaseClient
            .from('media_presentation_assets')
            .insert(newAsset);
          
          if (assetError) {
            Logger.error(`Error creating asset for ${file.name}:`, assetError);
          } else {
            Logger.info(`Created asset for ${file.name}`);
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    Logger.error('Error processing folder:', error);
    return false;
  }
}

const command = new Command('create-missing-presentations')
  .description('Create presentations for folders that don\'t have them yet')
  .option('-l, --limit <number>', 'Limit the number of folders to process', parseInt, 10)
  .option('-v, --verbose', 'Show verbose output')
  .option('--dry-run', 'Show what would be done without making changes')
  .action(async (options: CommandOptions) => {
    try {
      Logger.info(`Starting to create missing presentations ${options.dryRun ? "(dry run)" : ""}`);
      
      // Get the service
      const presentationService = PresentationService.getInstance();
      
      // Check for active filter profile
      const activeFilter = await getActiveFilterProfile();
      if (activeFilter && activeFilter.rootDriveId) {
        Logger.info(`🔍 Active filter: "${activeFilter.profile.name}"`);
        Logger.info(`📁 Using root_drive_id: ${activeFilter.rootDriveId}\n`);
      }
      
      // Get folders with path_depth=0 and main_video_id not null
      // that don't have presentations created for them
      let query = presentationService.supabaseClient
        .from('sources_google')
        .select('id, name, drive_id, path, main_video_id, path_depth, root_drive_id')
        .eq('path_depth', 0)
        .not('main_video_id', 'is', null);
      
      // Apply filter if active
      if (activeFilter && activeFilter.rootDriveId) {
        query = query.eq('root_drive_id', activeFilter.rootDriveId);
      }
      
      const { data: folders, error: foldersError } = await query
        .order('name', { ascending: true })
        .limit(options.limit || 10); // Process up to 10 at a time by default
      
      if (foldersError) {
        Logger.error('Error fetching folders:', foldersError);
        return;
      }
      
      if (!folders || folders.length === 0) {
        Logger.info('No folders found with path_depth=0 and main_video_id not null');
        return;
      }
      
      Logger.info(`Found ${folders.length} potential folders. Will check for missing presentations...`);
      
      let processed = 0;
      let created = 0;
      let skipped = 0;
      let failed = 0;
      
      // Process each folder
      for (const folder of folders) {
        processed++;
        
        if (options.dryRun) {
          // Check if presentation exists
          const { data: existingPres, error: existingError } = await presentationService.supabaseClient
            .from('media_presentations')
            .select('id')
            .eq('high_level_folder_source_id', folder.id)
            .limit(1);
            
          if (!existingError && existingPres && existingPres.length > 0) {
            Logger.info(`[DRY RUN] Would skip folder ${folder.name} - presentation already exists`);
            skipped++;
          } else {
            Logger.info(`[DRY RUN] Would create presentation for folder ${folder.name}`);
            created++;
          }
        } else {
          const result = await createPresentationForFolder(folder, presentationService, options.verbose || false);
          
          if (result === true) {
            created++;
          } else if (result === false) {
            skipped++; // Either presentation already exists or there was a non-fatal error
          } else {
            failed++; // Unexpected error
          }
        }
        
        Logger.info(`Progress: ${processed}/${folders.length} (Created: ${created}, Skipped: ${skipped}, Failed: ${failed})`);
      }
      
      Logger.info(`Operation completed! Processed ${processed} folders (Created: ${created}, Skipped: ${skipped}, Failed: ${failed})`);
    } catch (error) {
      Logger.error('Error in create-missing-presentations command:', error);
    }
  });

// Run the command if this script is executed directly
if (require.main === module) {
  command.parse(process.argv);
}

export default command;