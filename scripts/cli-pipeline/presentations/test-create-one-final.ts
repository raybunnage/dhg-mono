#!/usr/bin/env ts-node
import { PresentationService } from './services/presentation-service';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  try {
    console.log('Creating presentation with all fields populated...');
    
    // Get the service
    const presentationService = PresentationService.getInstance();
    
    // Let's use a different approach - query by folder name
    // First find the folder by name
    const { data: folderSearch, error: folderSearchError } = await presentationService.supabaseClient
      .from('sources_google')
      .select('id, name, drive_id, path, main_video_id')
      .eq('name', '2020-08-19-Porges-Polyvagal overview')
      .eq('path_depth', 0)
      .limit(1);
    
    if (folderSearchError || !folderSearch || folderSearch.length === 0) {
      console.error('Error finding folder by name:', folderSearchError || 'Not found');
      process.exit(1);
    }
    
    const folderData = folderSearch[0];
    const folderId = folderData.id;
    
    console.log('Found folder by name:', folderData.name, 'with ID:', folderId);
    
    // Get folder details
    const { data: folder, error } = await presentationService.supabaseClient
      .from('sources_google')
      .select('id, name, drive_id, path, main_video_id')
      .eq('id', folderId)
      .single();
    
    if (error || !folder) {
      console.error('Error finding folder:', error);
      process.exit(1);
    }
    
    console.log('Found folder:', folder.name);
    
    // Get video details
    const { data: videoDetails } = await presentationService.supabaseClient
      .from('sources_google')
      .select('id, name, mime_type, drive_id, created_at, modified_at')
      .eq('id', folder.main_video_id)
      .single();
    
    if (!videoDetails) {
      console.error('Video not found');
      process.exit(1);
    }
    
    console.log('Found video:', videoDetails.name);
    
    // Get expert document for the video
    let expertDocumentId = null;
    const { data: videoDocuments, error: videoDocError } = await presentationService.supabaseClient
      .from('expert_documents')
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
      .from('presentations')
      .insert(newPresentation)
      .select();
    
    if (insertError) {
      console.error('Error creating presentation:', insertError);
      process.exit(1);
    }
    
    console.log('Successfully created presentation:', insertedPresentation[0].id);
    
    // Find audio files in the folder for assets
    const { data: folderFiles } = await presentationService.supabaseClient
      .from('sources_google')
      .select('id, name, mime_type')
      .eq('parent_folder_id', folder.drive_id);
    
    if (folderFiles && folderFiles.length > 0) {
      for (const file of folderFiles) {
        if (file.id !== folder.main_video_id) { // Skip the main video file
          console.log(`Found associated file: ${file.name} (${file.mime_type})`);
          
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
            assetRole = 'primary';
          } else if (file.name.toLowerCase().includes('summary')) {
            assetType = 'summary';
            assetRole = 'supplementary';
          } else if (file.name.toLowerCase().includes('bio') || 
                    file.name.toLowerCase().includes('profile')) {
            assetType = 'expert_bio';
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
            .from('presentation_assets')
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
      .from('presentations')
      .select('*')
      .eq('id', newPresentationId)
      .single();
    
    console.log('Final presentation:', verifyPresentation);
    
    // Check assets
    const { data: assets } = await presentationService.supabaseClient
      .from('presentation_assets')
      .select('*')
      .eq('presentation_id', newPresentationId);
    
    console.log('Created assets:', assets);
    
    console.log('Operation completed successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();