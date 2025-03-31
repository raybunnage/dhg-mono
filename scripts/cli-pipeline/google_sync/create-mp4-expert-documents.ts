#!/usr/bin/env ts-node
/**
 * Create Expert Documents for Presentations with MP4 Files
 * 
 * This script finds presentations with available_on_disk=true metadata and creates
 * corresponding expert_documents and presentation_assets records for further processing.
 * 
 * Usage:
 *   npx ts-node create-mp4-expert-documents.ts [options]
 * 
 * Options:
 *   --dry-run                 Show what would be created without making changes
 *   --limit <number>          Limit the number of presentations to process
 */

import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../../packages/shared/utils';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { LogLevel } from '../../../packages/shared/utils/logger';
import type { Database } from '../../../supabase/types';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  limit: 50
};

// Get limit if specified
const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1 && args[limitIndex + 1]) {
  const limitArg = parseInt(args[limitIndex + 1]);
  if (!isNaN(limitArg)) {
    options.limit = limitArg;
  }
}

// Document type ID for presentations - needs to be a valid ID from document_types table
const PRESENTATION_DOCUMENT_TYPE_ID = null; // Will be populated during runtime

async function main() {
  try {
    Logger.info('🔍 Starting Expert Documents Creation for MP4 Presentations');
    Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
    Logger.info(`Limit: ${options.limit} presentations`);

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

    // First, try to find a valid document type for presentations
    let documentTypeId = null;
    let documentTypeFound = false;
    
    try {
      // Try to find a suitable document type for video presentations
      const searchTerms = ['Video Presentation', 'Presentation', 'Video'];
      
      for (const term of searchTerms) {
        const { data: documentTypes, error: documentTypeError } = await supabase
          .from('document_types')
          .select('id, document_type')
          .ilike('document_type', `%${term}%`)
          .limit(5);
        
        if (!documentTypeError && documentTypes && documentTypes.length > 0) {
          documentTypeId = documentTypes[0].id;
          Logger.info(`📋 Found document type ID for "${documentTypes[0].document_type}": ${documentTypeId}`);
          documentTypeFound = true;
          break;
        }
      }
      
      if (!documentTypeFound) {
        // No specific document type found, try to get any document type
        const { data: anyDocumentTypes, error: anyError } = await supabase
          .from('document_types')
          .select('id, document_type')
          .limit(1);
        
        if (!anyError && anyDocumentTypes && anyDocumentTypes.length > 0) {
          documentTypeId = anyDocumentTypes[0].id;
          Logger.info(`📋 Using generic document type "${anyDocumentTypes[0].document_type}": ${documentTypeId}`);
          documentTypeFound = true;
        }
      }
      
      if (!documentTypeFound) {
        Logger.error('❌ Could not find any valid document type in the database');
        Logger.error('❌ This is required to satisfy the foreign key constraint');
        
        // Create a simple document type for presentations
        if (!options.dryRun) {
          try {
            const { data: newDocType, error: createError } = await supabase
              .from('document_types')
              .insert({
                document_type: 'Video Presentation',
                description: 'Video recordings of presentations',
                category: 'video',
                created_by: '00000000-0000-0000-0000-000000000000', // System user
                updated_by: '00000000-0000-0000-0000-000000000000'  // System user
              })
              .select()
              .single();
            
            if (createError) {
              Logger.error(`❌ Error creating document type: ${createError.message}`);
              Logger.error('❌ Exiting - please create a document type first');
              process.exit(1);
            } else if (newDocType) {
              documentTypeId = newDocType.id;
              Logger.info(`✅ Created new document type "Video Presentation" with ID: ${documentTypeId}`);
              documentTypeFound = true;
            }
          } catch (error: any) {
            Logger.error(`❌ Exception creating document type: ${error.message}`);
            Logger.error('❌ Exiting - please create a document type first');
            process.exit(1);
          }
        } else {
          Logger.warn('⚠️ Continuing in dry-run mode, but this would fail in actual execution');
        }
      }
    } catch (error: any) {
      Logger.error(`❌ Exception fetching document types: ${error.message}`);
      if (!options.dryRun) {
        process.exit(1);
      }
    }

    // Fetch presentations that have MP4 files available on disk
    let presentations: any[] = [];
    try {
      // Query for presentations with MP4 files available on disk
      // Using eq() for JSON field comparisons instead of is()
      const { data, error: presentationsError } = await supabase
        .from('presentations')
        .select('id, title, filename, metadata, main_video_id')
        .eq('metadata->>available_on_disk', 'true')
        .limit(options.limit);

      if (presentationsError) {
        Logger.error(`❌ Error fetching presentations: ${presentationsError.message}`);
        if (options.dryRun) {
          Logger.info('Continuing in dry-run mode with empty presentations list');
        } else {
          process.exit(1);
        }
      } else if (data) {
        presentations = data;
      }

      Logger.info(`📋 Found ${presentations.length} presentations with MP4 files available on disk`);

      if (presentations.length === 0) {
        Logger.info('No presentations with MP4 files found. Run disk-status command first.');
        if (!options.dryRun) {
          process.exit(0);
        }
      }
    } catch (error: any) {
      Logger.error(`❌ Exception fetching presentations: ${error.message}`);
      if (options.dryRun) {
        Logger.info('Continuing in dry-run mode with empty presentations list');
      } else {
        process.exit(1);
      }
    }

    // Collect presentation IDs to check for existing expert documents
    const presentationIds = presentations.map(p => p.id);
    const presentationMainVideoIds = presentations
      .filter(p => p.main_video_id)
      .map(p => p.main_video_id);

    // Map of presentation IDs to their expert documents
    const existingAssetsMap = new Map();
    // Map of source IDs to their expert documents
    const existingDocumentsMap = new Map();

    if (presentationIds.length > 0) {
      try {
        // Check for existing expert documents to avoid duplicates
        const { data: existingAssets, error: assetsError } = await supabase
          .from('presentation_assets')
          .select('presentation_id, expert_document_id')
          .in('presentation_id', presentationIds);

        if (assetsError) {
          Logger.warn(`⚠️ Error checking existing presentation assets: ${assetsError.message}`);
        } else if (existingAssets) {
          existingAssets.forEach((asset: any) => {
            if (asset.expert_document_id) {
              existingAssetsMap.set(asset.presentation_id, asset.expert_document_id);
            }
          });
        }

        Logger.info(`📋 Found ${existingAssetsMap.size} presentations with existing expert documents`);
      } catch (error: any) {
        Logger.warn(`⚠️ Exception checking existing presentation assets: ${error.message}`);
      }
    }

    if (presentationMainVideoIds.length > 0) {
      try {
        // Check for existing expert documents for the main_video_id
        const { data: existingDocuments, error: documentsError } = await supabase
          .from('expert_documents')
          .select('id, source_id')
          .in('source_id', presentationMainVideoIds);

        if (documentsError) {
          Logger.warn(`⚠️ Error checking existing expert documents: ${documentsError.message}`);
        } else if (existingDocuments) {
          existingDocuments.forEach((doc: any) => {
            existingDocumentsMap.set(doc.source_id, doc.id);
          });
        }

        Logger.info(`📋 Found ${existingDocumentsMap.size} existing expert documents for videos`);
      } catch (error: any) {
        Logger.warn(`⚠️ Exception checking existing expert documents: ${error.message}`);
      }
    }

    // Prepare the records to create
    const presentationsToProcess = presentations.filter(p => 
      !existingAssetsMap.has(p.id) && 
      (p.main_video_id ? !existingDocumentsMap.has(p.main_video_id) : true)
    );

    Logger.info(`📋 Found ${presentationsToProcess.length} presentations to process`);

    // Batch in groups of 10 for better display
    const batches = [];
    for (let i = 0; i < presentationsToProcess.length; i += 10) {
      batches.push(presentationsToProcess.slice(i, i + 10));
    }

    // Process each batch
    let expertDocumentsCreated = 0;
    let presentationAssetsCreated = 0;
    let skippedCount = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      Logger.info(`\nProcessing batch ${batchIndex + 1}/${batches.length}...`);

      for (const presentation of batch) {
        const { id: presentationId, title, filename, metadata } = presentation;
        let main_video_id = presentation.main_video_id;
        
        if (!main_video_id) {
          // Try to find a matching Google Drive file for this presentation
          try {
            // Look for a file with a matching filename in sources_google
            Logger.info(`🔍 Presentation "${title}" has no main_video_id, looking for matching Google Drive file...`);

            const { data: matchingFiles, error: matchError } = await supabase
              .from('sources_google')
              .select('id, name, drive_id')
              .eq('deleted', false)
              .eq('mime_type', 'video/mp4')
              .ilike('name', `%${filename.replace(/\.mp4$/, '')}%`)
              .limit(1);

            if (matchError) {
              Logger.warn(`  ⚠️ Error searching for matching files: ${matchError.message}`);
              skippedCount++;
              continue;
            }

            if (!matchingFiles || matchingFiles.length === 0) {
              Logger.warn(`  ⚠️ No matching Google Drive file found for "${title}"`);
              skippedCount++;
              continue;
            }

            // Found a match, update the presentation with the main_video_id
            const matchedFile = matchingFiles[0];
            Logger.info(`  ✅ Found matching Google Drive file: ${matchedFile.name} (${matchedFile.id})`);
            
            if (options.dryRun) {
              Logger.info(`  🔄 Would update presentation "${title}" with main_video_id: ${matchedFile.id}`);
              continue;
            }

            // Update the presentation with the main_video_id
            const { error: updateError } = await supabase
              .from('presentations')
              .update({ main_video_id: matchedFile.id })
              .eq('id', presentationId);

            if (updateError) {
              Logger.error(`  ❌ Error updating presentation with main_video_id: ${updateError.message}`);
              skippedCount++;
              continue;
            }

            Logger.info(`  ✅ Updated presentation "${title}" with main_video_id: ${matchedFile.id}`);
            
            // Continue processing with the newly set main_video_id
            main_video_id = matchedFile.id;
          } catch (error: any) {
            Logger.error(`  ❌ Exception searching for matching file: ${error.message}`);
            skippedCount++;
            continue;
          }
        }

        // Check if we already have an expert document for this source
        if (existingDocumentsMap.has(main_video_id)) {
          Logger.info(`ℹ️ Expert document already exists for "${title}", skipping`);
          skippedCount++;
          continue;
        }

        // Log the planned creation
        Logger.info(`- "${title}" (${filename})`);
        Logger.info(`  📹 Source ID: ${main_video_id}`);
        
        // Skip actual creation in dry run mode
        if (options.dryRun) {
          Logger.info(`  🔄 Would create expert document and presentation asset`);
          continue;
        }

        try {
          // Create expert document
          const { data: expertDocument, error: createError } = await supabase
            .from('expert_documents')
            .insert({
              source_id: main_video_id,
              document_type_id: documentTypeId, // Use the document type ID we found or the placeholder
              processing_status: 'pending',
              content_type: 'presentation',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (createError) {
            Logger.error(`❌ Error creating expert document for "${title}": ${createError.message}`);
            continue;
          }

          const expertDocumentId = expertDocument.id;
          expertDocumentsCreated++;
          
          // Create presentation asset
          const { data: presentationAsset, error: assetError } = await supabase
            .from('presentation_assets')
            .insert({
              presentation_id: presentationId,
              expert_document_id: expertDocumentId,
              source_id: main_video_id,
              asset_type: 'video',
              asset_role: 'main',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              metadata: {
                creation_source: 'mp4-cli-pipeline',
                disk_filename: metadata?.disk_filename || filename,
                disk_file_size: metadata?.disk_file_size || 0,
                created_at: new Date().toISOString()
              }
            })
            .select()
            .single();

          if (assetError) {
            Logger.error(`❌ Error creating presentation asset for "${title}": ${assetError.message}`);
            continue;
          }

          presentationAssetsCreated++;
          Logger.info(`  ✅ Created expert document (${expertDocumentId}) and presentation asset`);
          
        } catch (error: any) {
          Logger.error(`❌ Exception processing "${title}":`, error.message);
        }
      }
    }

    // Display summary
    if (!options.dryRun) {
      Logger.info(`\n✅ Successfully created ${expertDocumentsCreated} expert documents`);
      Logger.info(`✅ Successfully created ${presentationAssetsCreated} presentation assets`);
      Logger.info(`⚠️ Skipped ${skippedCount} presentations`);
    } else {
      Logger.info('\n=== DRY RUN - No changes were made ===');
      Logger.info(`Would create ${presentationsToProcess.length} expert documents and presentation assets`);
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