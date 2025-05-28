#!/usr/bin/env ts-node
import { PresentationService } from './services/presentation-service';
import { v4 as uuidv4 } from 'uuid';

async function createPresentationForFolder(folderData: any, presentationService: any) {
  try {
    console.log(`Processing folder: ${folderData.name} (${folderData.id})`);
    const folderId = folderData.id;
    
    // First check if a presentation already exists for this folder
    const { data: existingPresentations, error: existingError } = await presentationService.supabaseClient
      .from('media_presentations')
      .select('id, title')
      .eq('high_level_folder_source_id', folderId)
      .limit(1);
    
    if (!existingError && existingPresentations && existingPresentations.length > 0) {
      console.log(`Presentation already exists for folder ${folderData.name}: ${existingPresentations[0].id}`);
      return false;
    }
    
    console.log('Found folder by name:', folderData.name, 'with ID:', folderId);
    
    // Get folder details - we should already have them from the parameter, but just to be consistent with the old code
    const folder = folderData;
    
    if (!folder || !folder.main_video_id) {
      console.error('Invalid folder data or missing main_video_id');
      return false;
    }
    
    console.log('Found folder:', folder.name);
    
    // Get video details
    const { data: videoDetails, error: videoError } = await presentationService.supabaseClient
      .from('google_sources')
      .select('id, name, mime_type, drive_id, created_at, modified_at')
      .eq('id', folder.main_video_id)
      .single();
    
    if (videoError || !videoDetails) {
      console.error('Video not found:', videoError);
      return false;
    }
    
    console.log('Found video:', videoDetails.name);
    
    // Get expert document for the video
    let expertDocumentId = null;
    const { data: videoDocuments, error: videoDocError } = await presentationService.supabaseClient
      .from('google_expert_documents')
      .select('id')
      .eq('source_id', folder.main_video_id);
      
    if (!videoDocError && videoDocuments && videoDocuments.length > 0) {
      expertDocumentId = videoDocuments[0].id;
      console.log(`Found expert document for video: ${expertDocumentId}`);
    }
    
    // Create a new presentation directly
    const newPresentationId = uuidv4();
    const newPresentation = {
      id: newPresentationId,
      title: folder.name,
      video_source_id: folder.main_video_id,
      high_level_folder_source_id: folder.id,
      root_drive_id: folder.drive_id,
      web_view_link: `https://drive.google.com/drive/folders/${folder.drive_id}`,
      duration_seconds: 0,
      expert_document_id: expertDocumentId, // Set from video's expert document
      view_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('Inserting presentation:', newPresentation);
    
    // Insert the presentation
    const { data: insertedPresentation, error: insertError } = await presentationService.supabaseClient
      .from('media_presentations')
      .insert(newPresentation)
      .select();
    
    if (insertError) {
      console.error('Error creating presentation:', insertError);
      return false;
    }
    
    console.log('Successfully created presentation:', insertedPresentation[0].id);
    
    // Find audio files in the folder for assets
    const { data: folderFiles, error: folderFilesError } = await presentationService.supabaseClient
      .from('google_sources')
      .select('id, name, mime_type')
      .eq('parent_folder_id', folder.drive_id);
    
    if (folderFilesError) {
      console.error('Error fetching folder files:', folderFilesError);
      return true; // Still return true because we did create the presentation
    }
    
    if (folderFiles && folderFiles.length > 0) {
      for (const file of folderFiles) {
        if (file.id !== folder.main_video_id) { // Skip the main video file
          console.log(`Found associated file: ${file.name} (${file.mime_type})`);
          
          // Create an asset for this file
          const assetId = uuidv4();
          
          // Get expert document for this file
          let assetExpertDocumentId = null;
          const { data: fileDocuments, error: fileDocError } = await presentationService.supabaseClient
            .from('google_expert_documents')
            .select('id')
            .eq('source_id', file.id);
            
          if (!fileDocError && fileDocuments && fileDocuments.length > 0) {
            assetExpertDocumentId = fileDocuments[0].id;
            console.log(`Found expert document for file ${file.name}: ${assetExpertDocumentId}`);
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
            assetType = 'document'; // Using 'document' instead of 'expert_bio' as it's a valid enum value
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
            console.error(`Error creating asset for ${file.name}:`, assetError);
          } else {
            console.log(`Created asset for ${file.name}`);
          }
        }
      }
    }
    
    // Verify everything was created
    const { data: verifyPresentation } = await presentationService.supabaseClient
      .from('media_presentations')
      .select('*')
      .eq('id', newPresentationId)
      .single();
    
    console.log('Final presentation:', verifyPresentation);
    
    // Check assets
    const { data: assets } = await presentationService.supabaseClient
      .from('media_presentation_assets')
      .select('*')
      .eq('presentation_id', newPresentationId);
    
    console.log('Created assets:', assets);
    
    return true;
  } catch (error) {
    console.error('Error processing folder:', error);
    return false;
  }
}

async function main() {
  try {
    console.log('Creating presentations for folders missing them...');
    
    // Get the service
    const presentationService = PresentationService.getInstance();
    
    // Get folders with path_depth=0 and main_video_id not null
    // that don't have presentations created for them
    const { data: folders, error: foldersError } = await presentationService.supabaseClient
      .from('google_sources')
      .select('id, name, drive_id, path, main_video_id, path_depth')
      .eq('path_depth', 0)
      .not('main_video_id', 'is', null)
      .order('name', { ascending: true })
      .limit(50); // Process up to 50 at a time
    
    if (foldersError) {
      console.error('Error fetching folders:', foldersError);
      process.exit(1);
    }
    
    if (!folders || folders.length === 0) {
      console.log('No folders found with path_depth=0 and main_video_id not null');
      process.exit(0);
    }
    
    console.log(`Found ${folders.length} potential folders. Will check for missing presentations...`);
    
    let processed = 0;
    let created = 0;
    let skipped = 0;
    let failed = 0;
    
    // Process each folder
    for (const folder of folders) {
      processed++;
      const result = await createPresentationForFolder(folder, presentationService);
      
      if (result === true) {
        created++;
      } else if (result === false) {
        skipped++; // Either presentation already exists or there was a non-fatal error
      } else {
        failed++; // Unexpected error
      }
      
      console.log(`Progress: ${processed}/${folders.length} (Created: ${created}, Skipped: ${skipped}, Failed: ${failed})`);
    }
    
    console.log(`Operation completed! Processed ${processed} folders (Created: ${created}, Skipped: ${skipped}, Failed: ${failed})`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();