#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import { v4 as uuidv4 } from 'uuid';

const supabaseClient = SupabaseClientService.getInstance().getClient();

/**
 * Updates document_type_id for sources_google records based on mime_type and folder levels
 * and creates corresponding expert_documents for all files.
 * 
 * Document type mappings:
 * - '3e7c880c-d821-4d01-8cc5-3547bdd2e347' for 'video/mp4' files
 * - '6ece37e7-840d-4a0c-864d-9f1f971b1d7e' for 'audio/x-m4a' files
 * - 'bd903d99-64a1-4297-ba76-1094ab235dac' for folders at level = 0
 * - '0d61a685-10e0-4c82-b964-60b88b02ac15' for folders marked as is_root = true
 * - 'dd6a2cea-c74a-4c6d-8d30-eb20d2c70ddd' for folders at level > 0
 * - '299ad443-4d84-40d8-98cb-a9df423ba451' for files with '.pptx' in their name
 */
async function updateMediaDocumentTypes(options: { dryRun?: boolean, createExpertDocs?: boolean, batchSize?: number, debug?: boolean, forceUpdate?: boolean }) {
  const startTime = new Date();
  let trackingId: string;
  
  try {
    trackingId = await commandTrackingService.startTracking('google_sync', 'update-media-document-types');
  } catch (trackingError) {
    console.warn(`Warning: Unable to initialize command tracking. The command will continue but tracking is unavailable. Error: ${trackingError instanceof Error ? trackingError.message : String(trackingError)}`);
    trackingId = 'tracking-unavailable';
  }
  
  const dryRun = options.dryRun || false;
  const createExpertDocs = options.createExpertDocs !== undefined ? options.createExpertDocs : true;
  const batchSize = options.batchSize || 50;
  const debug = options.debug || false;
  const forceUpdate = options.forceUpdate || false;
  
  try {
    console.log(`${dryRun ? '[DRY RUN] ' : ''}Updating document_type_id for media files and creating expert_documents...`);

    // Get video files that need updating
    const { data: videoFiles, error: videoError } = await supabaseClient
      .from('sources_google')
      .select('id, name, mime_type, document_type_id')
      .eq('mime_type', 'video/mp4')
      .is('document_type_id', null);
    
    if (videoError) {
      throw new Error(`Error fetching video files: ${videoError.message}`);
    }

    // Get audio files that need updating
    const { data: audioFiles, error: audioError } = await supabaseClient
      .from('sources_google')
      .select('id, name, mime_type, document_type_id')
      .eq('mime_type', 'audio/x-m4a')
      .is('document_type_id', null);
    
    if (audioError) {
      throw new Error(`Error fetching audio files: ${audioError.message}`);
    }
    
    // Get PowerPoint files (.pptx) that need updating - include those with different document_type_id
    const { data: pptxFiles, error: pptxError } = await supabaseClient
      .from('sources_google')
      .select('id, name, mime_type, document_type_id')
      .ilike('name', '%.pptx%')
      .not('document_type_id', 'eq', '299ad443-4d84-40d8-98cb-a9df423ba451');
    
    if (pptxError) {
      throw new Error(`Error fetching PowerPoint files: ${pptxError.message}`);
    }

    // Get level 0 folders that need updating
    const { data: level0Folders, error: level0Error } = await supabaseClient
      .from('sources_google')
      .select('id, name, path_depth, document_type_id')
      .eq('path_depth', 0)
      .is('document_type_id', null)
      .is('is_root', false); // Exclude root folders, we'll handle them separately
    
    if (level0Error) {
      throw new Error(`Error fetching level 0 folders: ${level0Error.message}`);
    }

    // Get root folders that need updating
    const { data: rootFolders, error: rootError } = await supabaseClient
      .from('sources_google')
      .select('id, name, document_type_id')
      .eq('is_root', true)
      .is('document_type_id', null);
    
    if (rootError) {
      throw new Error(`Error fetching root folders: ${rootError.message}`);
    }

    // Get higher level folders that need updating
    const { data: higherLevelFolders, error: higherLevelError } = await supabaseClient
      .from('sources_google')
      .select('id, name, path_depth, document_type_id')
      .gt('path_depth', 0)
      .is('document_type_id', null)
      .is('is_root', false); // Exclude root folders, we handled them separately
    
    if (higherLevelError) {
      throw new Error(`Error fetching higher level folders: ${higherLevelError.message}`);
    }

    // For files without expert_documents, we'll use a different approach
    // since we can't use large arrays in .not('id', 'in', ...) due to limitations
    
    // Get all document types to validate against
    const { data: allDocumentTypes, error: allDocumentTypesError } = await supabaseClient
      .from('document_types')
      .select('id');
    
    if (allDocumentTypesError) {
      throw new Error(`Error fetching document types: ${allDocumentTypesError.message}`);
    }

    // Create a Set of valid document_type_ids for checking
    const validDocumentTypeIds = new Set();
    if (allDocumentTypes) {
      allDocumentTypes.forEach(dt => {
        if (dt.id) {
          validDocumentTypeIds.add(dt.id);
        }
      });
    }
    console.log(`Found ${validDocumentTypeIds.size} valid document types`);

    // Get all non-folder files in sources_google
    const { data: allFiles, error: allFilesError } = await supabaseClient
      .from('sources_google')
      .select('id, name, mime_type, document_type_id')
      .not('mime_type', 'eq', 'application/vnd.google-apps.folder')
      .is('is_deleted', false);
    
    if (allFilesError) {
      throw new Error(`Error fetching all files: ${allFilesError.message}`);
    }
    
    // Get all source_ids that have expert_documents
    const { data: sourcesWithExpertDocs, error: sourcesWithExpertDocsError } = await supabaseClient
      .from('expert_documents')
      .select('source_id');
    
    if (sourcesWithExpertDocsError) {
      throw new Error(`Error fetching sources with expert_documents: ${sourcesWithExpertDocsError.message}`);
    }

    // Create a Set for fast lookups of source_ids with expert_documents
    const sourceIdsWithExpertDocsSet = new Set();
    if (sourcesWithExpertDocs) {
      sourcesWithExpertDocs.forEach(doc => {
        if (doc.source_id) {
          sourceIdsWithExpertDocsSet.add(doc.source_id);
        }
      });
    }
    
    // Filter to get only files without expert_documents
    const filesWithoutExpertDocs = allFiles?.filter(file => !sourceIdsWithExpertDocsSet.has(file.id)) || [];

    // Get m4a files to associate with mp4 files
    const { data: m4aFiles, error: m4aFilesError } = await supabaseClient
      .from('sources_google')
      .select('id, name, mime_type, document_type_id')
      .eq('mime_type', 'audio/x-m4a')
      .is('is_deleted', false);
    
    if (m4aFilesError) {
      throw new Error(`Error fetching m4a files: ${m4aFilesError.message}`);
    }

    // Calculate mapping of m4a to mp4 files based on file names
    const m4aToMp4Map = new Map<string, string>();
    if (m4aFiles && m4aFiles.length > 0) {
      // Get all mp4 files to match against
      const { data: allMp4Files, error: allMp4FilesError } = await supabaseClient
        .from('sources_google')
        .select('id, name, mime_type')
        .eq('mime_type', 'video/mp4')
        .is('is_deleted', false);
      
      if (allMp4FilesError) {
        throw new Error(`Error fetching all mp4 files: ${allMp4FilesError.message}`);
      }

      if (allMp4Files && allMp4Files.length > 0) {
        // Create a map of mp4 filenames (without extension) to ids
        const mp4NameToIdMap = new Map<string, string>();
        for (const mp4File of allMp4Files) {
          const baseName = mp4File.name.replace(/\.mp4$/i, '');
          mp4NameToIdMap.set(baseName.toLowerCase(), mp4File.id);
        }

        // Match m4a files to mp4 files
        for (const m4aFile of m4aFiles) {
          const baseName = m4aFile.name.replace(/\.m4a$/i, '');
          const matchingMp4Id = mp4NameToIdMap.get(baseName.toLowerCase());
          if (matchingMp4Id) {
            m4aToMp4Map.set(m4aFile.id, matchingMp4Id);
          }
        }
      }
    }

    const totalFilesForDocType = (videoFiles?.length || 0) + (audioFiles?.length || 0) + 
                      (pptxFiles?.length || 0) + (level0Folders?.length || 0) + 
                      (rootFolders?.length || 0) + (higherLevelFolders?.length || 0);
    
    const totalFilesNeedingExpertDocs = filesWithoutExpertDocs?.length || 0;
    
    console.log(`Found: 
    - ${videoFiles?.length || 0} video/mp4 files
    - ${audioFiles?.length || 0} audio/x-m4a files
    - ${pptxFiles?.length || 0} PowerPoint (.pptx) files 
    - ${level0Folders?.length || 0} level 0 folders
    - ${rootFolders?.length || 0} root folders
    - ${higherLevelFolders?.length || 0} higher level folders
    without document_type_id`);

    console.log(`Found ${totalFilesNeedingExpertDocs} files without corresponding expert_documents`);
    console.log(`Found ${m4aToMp4Map.size} audio/x-m4a files with matching video/mp4 files`);

    if (totalFilesForDocType === 0 && totalFilesNeedingExpertDocs === 0) {
      console.log('No files need updating document_type_id or new expert_documents. Will now check if m4a files need main_video_id updates...');
      // Don't return here, we want to continue to check for main_video_id updates
    }

    if (dryRun) {
      console.log('[DRY RUN] Would update the following:');
      
      // Document type updates
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
      
      if (pptxFiles && pptxFiles.length > 0) {
        console.log(`- ${pptxFiles.length} PowerPoint files with document_type_id = '299ad443-4d84-40d8-98cb-a9df423ba451'`);
        pptxFiles.slice(0, 5).forEach((file: { name: string }) => console.log(`  - ${file.name}`));
        if (pptxFiles.length > 5) console.log(`  - ... and ${pptxFiles.length - 5} more`);
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

      // Expert documents creation
      if (createExpertDocs && filesWithoutExpertDocs && filesWithoutExpertDocs.length > 0) {
        console.log(`- Would create ${filesWithoutExpertDocs.length} expert_documents for files without them`);
        filesWithoutExpertDocs.slice(0, 5).forEach((file) => {
          if ('name' in file && 'mime_type' in file) {
            console.log(`  - ${file.name} (${file.mime_type})`);
          } else {
            console.log(`  - ${JSON.stringify(file)}`);
          }
        });
        if (filesWithoutExpertDocs.length > 5) console.log(`  - ... and ${filesWithoutExpertDocs.length - 5} more`);
      }

      if (m4aToMp4Map.size > 0) {
        console.log(`- Found ${m4aToMp4Map.size} audio/x-m4a files with matching video/mp4 files`);
        console.log(`  - Will add main_video_id to metadata for these m4a files in expert_documents`);
        let count = 0;
        for (const [m4aId, mp4Id] of m4aToMp4Map.entries()) {
          if (count < 5) {
            const m4aFile = m4aFiles?.find(file => file.id === m4aId);
            console.log(`  - ${m4aFile?.name} matches video ID: ${mp4Id}`);
          }
          count++;
          if (count === 5) break;
        }
        if (m4aToMp4Map.size > 5) console.log(`  - ... and ${m4aToMp4Map.size - 5} more`);
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
          .eq('mime_type', 'audio/x-m4a')
          .is('document_type_id', null);
        
        if (updateAudioError) {
          throw new Error(`Error updating audio files: ${updateAudioError.message}`);
        }
        console.log(`Updated ${audioFiles.length} audio/x-m4a files with document_type_id`);
      }
      
      // Update PowerPoint files
      if (pptxFiles && pptxFiles.length > 0) {
        const { error: updatePptxError } = await supabaseClient
          .from('sources_google')
          .update({ document_type_id: '299ad443-4d84-40d8-98cb-a9df423ba451' })
          .ilike('name', '%.pptx%')
          .not('document_type_id', 'eq', '299ad443-4d84-40d8-98cb-a9df423ba451');
        
        if (updatePptxError) {
          throw new Error(`Error updating PowerPoint files: ${updatePptxError.message}`);
        }
        console.log(`Updated ${pptxFiles.length} PowerPoint (.pptx) files with document_type_id`);
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

      // Update existing m4a expert_documents to add main_video_id to their metadata
      if (m4aToMp4Map.size > 0) {
        console.log(`Checking existing m4a expert_documents for main_video_id metadata... (m4aToMp4Map size: ${m4aToMp4Map.size})`);
        if (debug) {
          console.log("Debug: m4aToMp4Map entries:");
          let count = 0;
          for (const [m4aId, mp4Id] of m4aToMp4Map.entries()) {
            if (count < 10) { // Show first 10 entries
              console.log(`  ${m4aId} -> ${mp4Id}`);
            }
            count++;
          }
          if (count > 10) {
            console.log(`  ... and ${count - 10} more`);
          }
        }
        
        // Get all m4a files that already have expert_documents
        const existingM4aExpertDocs = await supabaseClient
          .from('expert_documents')
          .select('id, source_id, processing_stats')
          .in('source_id', Array.from(m4aToMp4Map.keys()));
          
        if (existingM4aExpertDocs.error) {
          console.error(`Error fetching existing m4a expert_documents: ${existingM4aExpertDocs.error.message}`);
        } else if (existingM4aExpertDocs.data && existingM4aExpertDocs.data.length > 0) {
          console.log(`Found ${existingM4aExpertDocs.data.length} existing m4a expert_documents to check for main_video_id`);
          
          // Count how many need updating
          let needsUpdateCount = 0;
          for (const doc of existingM4aExpertDocs.data) {
            const mainVideoId = m4aToMp4Map.get(doc.source_id);
            if (mainVideoId) {
              if (forceUpdate || !doc.processing_stats || !doc.processing_stats.main_video_id) {
                needsUpdateCount++;
              } else if (doc.processing_stats.main_video_id !== mainVideoId) {
                needsUpdateCount++;
              }
              
              if (debug) {
                console.log(`Debug: Document ${doc.id} for source ${doc.source_id}:`);
                console.log(`  - Has processing_stats: ${doc.processing_stats ? 'Yes' : 'No'}`);
                console.log(`  - Has main_video_id in stats: ${doc.processing_stats && doc.processing_stats.main_video_id ? 'Yes' : 'No'}`);
                console.log(`  - Current main_video_id: ${doc.processing_stats?.main_video_id || 'None'}`);
                console.log(`  - Matching MP4 ID: ${mainVideoId}`);
                console.log(`  - Needs update: ${forceUpdate || !doc.processing_stats || !doc.processing_stats.main_video_id || doc.processing_stats.main_video_id !== mainVideoId ? 'Yes' : 'No'}`);
              }
            }
          }
          
          if (needsUpdateCount === 0) {
            console.log(`All existing m4a expert_documents already have the correct main_video_id metadata. No updates needed.`);
          } else {
            console.log(`Found ${needsUpdateCount} out of ${existingM4aExpertDocs.data.length} existing m4a expert_documents that need main_video_id metadata updates`);
            
            // Process in batches to avoid overloading the database
            let updatedCount = 0;
            for (let i = 0; i < existingM4aExpertDocs.data.length; i += batchSize) {
              const batch = existingM4aExpertDocs.data.slice(i, i + batchSize);
              console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(existingM4aExpertDocs.data.length/batchSize)} (${batch.length} files)...`);
              
              // Update each expert_document with the main_video_id
              for (const doc of batch) {
                const mainVideoId = m4aToMp4Map.get(doc.source_id);
                if (mainVideoId) {
                  // Check if we need to update this document
                  const needsUpdate = forceUpdate || !doc.processing_stats || !doc.processing_stats.main_video_id || doc.processing_stats.main_video_id !== mainVideoId;
                  
                  if (debug) {
                    console.log(`Debug: ${doc.id} - current stats:`, JSON.stringify(doc.processing_stats));
                    console.log(`Debug: ${doc.id} - mainVideoId: ${mainVideoId}, needsUpdate: ${needsUpdate}`);
                  }
                  
                  if (needsUpdate) {
                    // Create or update the processing_stats metadata
                    const updatedStats = doc.processing_stats || {};
                    updatedStats.main_video_id = mainVideoId;
                    
                    const { error: updateError } = await supabaseClient
                      .from('expert_documents')
                      .update({ processing_stats: updatedStats })
                      .eq('id', doc.id);
                      
                    if (updateError) {
                      console.error(`Error updating expert document (${doc.id}): ${updateError.message}`);
                    } else {
                      updatedCount++;
                    }
                  }
                }
              }
              
              console.log(`Processed batch ${Math.floor(i/batchSize) + 1}`);
            }
            
            console.log(`Updated ${updatedCount} existing m4a expert_documents with main_video_id metadata`);
          }
        } else {
          console.log(`No existing m4a expert_documents found that need updating`);
        }
      }

      // Create expert_documents for files that need them
      if (createExpertDocs && filesWithoutExpertDocs && filesWithoutExpertDocs.length > 0) {
        console.log(`Creating expert_documents for ${filesWithoutExpertDocs.length} files in batches of ${batchSize}...`);
        
        // Process in batches to avoid overloading the database
        for (let i = 0; i < filesWithoutExpertDocs.length; i += batchSize) {
          const batch = filesWithoutExpertDocs.slice(i, i + batchSize);
          console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(filesWithoutExpertDocs.length/batchSize)} (${batch.length} files)...`);
          
          const expertDocRecords = batch.map(file => {
            // Skip files that don't have the required properties
            if (!('id' in file) || !('document_type_id' in file)) {
              console.error(`Skipping invalid file record: ${JSON.stringify(file)}`);
              return null;
            }
            
            // Add metadata for m4a files with main_video_id if it exists
            let metadata = null;
            
            // For m4a files, check if there's a matching main_video_id
            if (file.mime_type === 'audio/x-m4a') {
              const matchingMp4Id = m4aToMp4Map.get(file.id);
              if (matchingMp4Id) {
                metadata = { main_video_id: matchingMp4Id };
              }
            }
            
            // Check if document_type_id is valid
            let docTypeId = null;
            if (file.document_type_id && validDocumentTypeIds.has(file.document_type_id)) {
              docTypeId = file.document_type_id;
            }
            
            return {
              id: uuidv4(),
              source_id: file.id,
              document_type_id: docTypeId,
              raw_content: null,
              processed_content: null,
              processing_stats: metadata // Store the main_video_id in processing_stats as JSON metadata
            };
          }).filter(record => record !== null);
          
          const { error: insertError } = await supabaseClient
            .from('expert_documents')
            .insert(expertDocRecords);
          
          if (insertError) {
            console.error(`Error creating expert_documents (batch ${Math.floor(i/batchSize) + 1}): ${insertError.message}`);
            console.error(`Failed at record: ${JSON.stringify(expertDocRecords[0])}`);
            // Continue to next batch
          } else {
            console.log(`Created ${batch.length} expert_documents (batch ${Math.floor(i/batchSize) + 1})`);
          }
        }
      }
    }

    const totalUpdated = totalFilesForDocType + (createExpertDocs ? totalFilesNeedingExpertDocs : 0);
    
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: totalUpdated,
          summary: dryRun 
            ? `[DRY RUN] Would update ${totalFilesForDocType} media files with document_type_id and create ${createExpertDocs ? totalFilesNeedingExpertDocs : 0} expert_documents`
            : `Updated ${totalFilesForDocType} media files with document_type_id and created ${createExpertDocs ? totalFilesNeedingExpertDocs : 0} expert_documents`
        });
      } catch (trackingError) {
        console.warn(`Warning: Unable to complete command tracking. Error: ${trackingError instanceof Error ? trackingError.message : String(trackingError)}`);
      }
    }

    // Count how many existing expert_documents would be updated with metadata
    let existingDocsCount = 0;
    if (dryRun && m4aToMp4Map.size > 0) {
      // Check how many expert_documents would be updated with main_video_id
      const { data: existingM4aExpertDocsCount, error: countError } = await supabaseClient
        .from('expert_documents')
        .select('id', { count: 'exact' })
        .in('source_id', Array.from(m4aToMp4Map.keys()));
        
      if (!countError && existingM4aExpertDocsCount) {
        existingDocsCount = existingM4aExpertDocsCount.length;
        console.log(`[DRY RUN] Would update ${existingDocsCount} existing expert_documents with main_video_id metadata`);
      }
    }
    
    console.log(`${dryRun ? '[DRY RUN] ' : ''}Media file document types and expert_documents update complete!`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error updating media document types: ${errorMessage}`);
    
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.failTracking(trackingId, `Command failed: ${errorMessage}`);
      } catch (trackingError) {
        console.warn(`Warning: Unable to record command failure in tracking. Error: ${trackingError instanceof Error ? trackingError.message : String(trackingError)}`);
      }
    }
    
    throw error;
  }
}

// CLI setup
const program = new Command();

program
  .name('update-media-document-types')
  .description('Update document_type_id for media files and create corresponding expert_documents')
  .option('--dry-run', 'Show what would be updated without making changes')
  .option('--skip-expert-docs', 'Skip creating expert_documents')
  .option('--batch-size <number>', 'Number of expert_documents to create in each batch (default: 50)', '50')
  .option('--debug', 'Show debug information')
  .option('--force-update', 'Force update of expert_documents even if they have main_video_id')
  .action((options) => {
    updateMediaDocumentTypes({
      dryRun: options.dryRun,
      createExpertDocs: !options.skipExpertDocs,
      batchSize: parseInt(options.batchSize),
      debug: options.debug,
      forceUpdate: options.forceUpdate
    });
  });

program.parse(process.argv);