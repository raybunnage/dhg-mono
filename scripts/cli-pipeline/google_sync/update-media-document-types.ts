#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

// Initialize Supabase client - but we'll test the connection before using it
const supabaseService = SupabaseClientService.getInstance();
const supabaseClient = supabaseService.getClient();

// Using the document_processing_status enum for expert_documents:
//   'needs_reprocessing',    -- Document needs to be reprocessed
//   'reprocessing_done',     -- Reprocessing has been completed
//   'skip_processing',       -- Document should be skipped (unsupported type, password protected, etc)
//   'not_set'                -- Initial state
//
// This is a dedicated field separate from the processing_status field

/**
 * Updates document_type_id for sources_google and expert_documents records based on file characteristics
 * 
 * Document type mappings (based on specified rules):
 * 
 * 1. If there is JSON in the related processed_content field in expert_document and the 
 *    document_type_id in sources_google is 46dac359-01e9-4e36-bfb2-531da9c25e3f, make 
 *    the document_type_id in expert_documents = 1f71f894-d2f8-415e-80c1-a4d6db4d8b18
 * 
 * 2. If there is JSON in the related processed_content field in expert_document and the 
 *    document_type_id in sources_google is 03743a23-d2f3-4c73-a282-85afc138fdfd, make 
 *    the document_type_id in expert_documents = 5b1f8963-0946-4e89-884d-30517eebb8a5
 * 
 * 3. If the name of the file in sources_google ends in .conf, set the document type in 
 *    sources google to c1a7b78b-c61e-44a4-8b77-a27a38cbba7e and the expert_document_id 
 *    to 1f71f894-d2f8-415e-80c1-a4d6db4d8b18
 * 
 * 4-12. If the record in sources_google is of certain document_type_ids, then set 
 *       expert_document_id to 1f71f894-d2f8-415e-80c1-a4d6db4d8b18
 * 
 * Additional rules:
 * - If there is JSON in the related processed_content that starts with {"title", mark as 5b1f8963-0946-4e89-884d-30517eebb8a5
 * - If there is not JSON, mark as needs_reprocessing = true
 * - If document_type_id is e9d3e473-5315-4837-9f5f-61f150cbd137 and content has "File analysis unavailable", mark as needs_reprocessing = true
 * - If the mime_type is a folder, mark as needs_reprocessing = true
 * - If document_type_id is ea74c86e-7f22-4ecf-ae16-0430291995e2, set as 1f71f894-d2f8-415e-80c1-a4d6db4d8b18
 * - If document_type_id is 9ccdc433-99d8-46fb-8bf7-3ba72cf27c88, set as 2f5af574-9053-49b1-908d-c35001ce9680
 * - If document_type_id is 5e61bfbc-39ef-4380-80c0-592017b39b71, set as 2f5af574-9053-49b1-908d-c35001ce9680
 */
async function updateMediaDocumentTypes(options: { dryRun?: boolean, batchSize?: number, debug?: boolean }) {
  const dryRun = options.dryRun || false;
  const debug = options.debug || false;
  const batchSize = options.batchSize || 50;
  
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Updating media document types...`);

  // Track the command
  let trackingId: string;
  try {
    trackingId = await commandTrackingService.startTracking('google_sync', 'update-media-document-types');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
    trackingId = 'tracking-unavailable';
  }

  try {
    // Test Supabase connection first
    console.log('Testing Supabase connection...');
    const connectionTest = await supabaseService.testConnection();
    
    if (!connectionTest.success) {
      throw new Error(`Supabase connection test failed: ${connectionTest.error}`);
    }
    
    console.log('✅ Supabase connection test successful');
    // Fetch all expert documents with non-null processed_content
    console.log('\nFetching expert documents with processed content...');
    const { data: expertDocs, error: expertDocsError } = await supabaseClient
      .from('expert_documents')
      .select('id, source_id, document_type_id, processed_content, processing_status, processing_skip_reason')
      .not('processed_content', 'is', null);

    if (expertDocsError) {
      console.error('Error fetching expert documents:', expertDocsError.message);
      throw new Error(`Failed to fetch expert documents: ${expertDocsError.message}`);
    }

    if (!expertDocs || expertDocs.length === 0) {
      console.log('No expert documents found with processed content.');
      return;
    }

    console.log(`Found ${expertDocs.length} expert documents with processed content.`);
    
    // Set document_processing_status to skip_processing if processing_skip_reason is not null
    console.log('\nUpdating document_processing_status for documents with processing_skip_reason...');
    const docsWithSkipReason = expertDocs.filter(doc => doc.processing_skip_reason !== null);
    
    if (docsWithSkipReason.length > 0) {
      console.log(`Found ${docsWithSkipReason.length} documents with processing_skip_reason`);
      
      if (!dryRun) {
        // Process in batches
        for (let i = 0; i < docsWithSkipReason.length; i += batchSize) {
          const batchDocs = docsWithSkipReason.slice(i, i + batchSize);
          const updates = [];

          for (const doc of batchDocs) {
            updates.push({
              id: doc.id,
              source_id: doc.source_id,  // Include source_id to satisfy not-null constraint 
              document_processing_status: 'skip_processing',  // Using new dedicated field
              document_processing_status_updated_at: new Date().toISOString(),
              processing_status: 'completed',  // Keep the original processing_status field as is
              processing_skip_reason: doc.processing_skip_reason ? doc.processing_skip_reason + ' - skip processing' : 'Skip processing'
            });
          }

          const { error: updateError } = await supabaseClient
            .from('expert_documents')
            .upsert(updates, { onConflict: 'id' });

          if (updateError) {
            console.error(`Error updating batch ${i}-${i+batchSize} for documents with skip reason:`, updateError.message);
          } else {
            console.log(`✓ Updated batch ${i}-${i+batchSize} of ${docsWithSkipReason.length} documents with document_processing_status=skip_processing`);
          }
        }
      } else {
        console.log(`[DRY RUN] Would update ${docsWithSkipReason.length} documents with document_processing_status=skip_processing`);
      }
    }

    // 1. Update .conf files in sources_google and their expert documents
    console.log('\nProcessing .conf files...');
    const { data: confFiles, error: confFilesError } = await supabaseClient
      .from('sources_google')
      .select('id, name')
      .ilike('name', '%.conf');

    if (confFilesError) {
      console.error('Error fetching .conf files:', confFilesError.message);
    } else if (confFiles && confFiles.length > 0) {
      console.log(`Found ${confFiles.length} .conf files`);

      // Update sources_google document type
      if (!dryRun) {
        const { error: updateSourcesError } = await supabaseClient
          .from('sources_google')
          .update({ document_type_id: 'c1a7b78b-c61e-44a4-8b77-a27a38cbba7e' }) // Configuration File
          .in('id', confFiles.map(file => file.id));

        if (updateSourcesError) {
          console.error('Error updating .conf files in sources_google:', updateSourcesError.message);
        } else {
          console.log(`✓ Updated ${confFiles.length} .conf files in sources_google to document_type_id c1a7b78b-c61e-44a4-8b77-a27a38cbba7e (Configuration File)`);
        }

        // Get related expert documents
        const { data: confExpertDocs, error: confExpertDocsError } = await supabaseClient
          .from('expert_documents')
          .select('id')
          .in('source_id', confFiles.map(file => file.id));

        if (confExpertDocsError) {
          console.error('Error fetching expert documents for .conf files:', confExpertDocsError.message);
        } else if (confExpertDocs && confExpertDocs.length > 0) {
          // Update expert_documents to Document type
          const { error: updateExpertDocsError } = await supabaseClient
            .from('expert_documents')
            .update({ document_type_id: '1f71f894-d2f8-415e-80c1-a4d6db4d8b18' }) // Document
            .in('id', confExpertDocs.map(doc => doc.id));

          if (updateExpertDocsError) {
            console.error('Error updating expert documents for .conf files:', updateExpertDocsError.message);
          } else {
            console.log(`✓ Updated ${confExpertDocs.length} expert documents for .conf files to document_type_id 1f71f894-d2f8-415e-80c1-a4d6db4d8b18 (Document)`);
          }
        }
      } else {
        console.log(`[DRY RUN] Would update ${confFiles.length} .conf files in sources_google and their expert documents`);
      }
    }

    // 2. Process specific document types (4-12) - multiple document types to Document
    const documentTypeIdsToDocument = [
      'c62f92f5-6123-4324-876d-14639841284e', // Publication
      '83849c95-823e-4f8b-bf47-4318ae014f16', // Calendar
      '98ac1e77-2cff-474a-836e-4db32a521a16', // Worksheet
      '5eb89387-854c-4754-baf8-3632ac286d92', // Whitepaper
      'e886b004-b90c-4130-bfa7-971d084e88ec', // Article
      'ab90f374-00f6-4220-90e0-91b2054eafad', // News
      'eca21963-c638-4435-85f5-0da67458995c', // Technical Document
      'f2fd129e-a0ad-485d-a457-ec49736010a9', // Manual
      'bb90f01f-b6c4-4030-a3ea-db9dd8c4b55a', // Guide
      'ea74c86e-7f22-4ecf-ae16-0430291995e2', // Spreadsheet
    ];

    console.log(`\nProcessing sources with specific document types (to Document)...`);
    const { data: specificTypeSources, error: specificTypesError } = await supabaseClient
      .from('sources_google')
      .select('id, document_type_id')
      .in('document_type_id', documentTypeIdsToDocument);

    if (specificTypesError) {
      console.error('Error fetching sources with specific document types:', specificTypesError.message);
    } else if (specificTypeSources && specificTypeSources.length > 0) {
      console.log(`Found ${specificTypeSources.length} sources with document types to be set as Document`);

      // Get corresponding expert documents
      const { data: specificTypeExpertDocs, error: specificTypeExpertDocsError } = await supabaseClient
        .from('expert_documents')
        .select('id')
        .in('source_id', specificTypeSources.map(source => source.id));

      if (specificTypeExpertDocsError) {
        console.error('Error fetching expert documents for specific source types:', specificTypeExpertDocsError.message);
      } else if (specificTypeExpertDocs && specificTypeExpertDocs.length > 0) {
        if (!dryRun) {
          const { error: updateError } = await supabaseClient
            .from('expert_documents')
            .update({ document_type_id: '1f71f894-d2f8-415e-80c1-a4d6db4d8b18' }) // Document
            .in('id', specificTypeExpertDocs.map(doc => doc.id));

          if (updateError) {
            console.error('Error updating expert documents to Document type:', updateError.message);
          } else {
            console.log(`✓ Updated ${specificTypeExpertDocs.length} expert documents to document_type_id 1f71f894-d2f8-415e-80c1-a4d6db4d8b18 (Document)`);
          }
        } else {
          console.log(`[DRY RUN] Would update ${specificTypeExpertDocs.length} expert documents to Document type`);
        }
      }
    }

    // 3. Process specific document types to PDF/PPTX
    const documentTypesToPdfPptx = [
      '9ccdc433-99d8-46fb-8bf7-3ba72cf27c88', // Presentation
      '5e61bfbc-39ef-4380-80c0-592017b39b71', // Technical Paper
      'fc07c06a-ab03-4714-baf2-343427d433a3', // New type to be set as PDF/PPTX
    ];

    console.log(`\nProcessing sources with document types to be set as PDF/PPTX...`);
    const { data: pdfPptxSources, error: pdfPptxSourcesError } = await supabaseClient
      .from('sources_google')
      .select('id, document_type_id')
      .in('document_type_id', documentTypesToPdfPptx);

    if (pdfPptxSourcesError) {
      console.error('Error fetching sources for PDF/PPTX types:', pdfPptxSourcesError.message);
    } else if (pdfPptxSources && pdfPptxSources.length > 0) {
      console.log(`Found ${pdfPptxSources.length} sources with document types to be set as PDF/PPTX`);

      // Get corresponding expert documents
      const { data: pdfPptxExpertDocs, error: pdfPptxExpertDocsError } = await supabaseClient
        .from('expert_documents')
        .select('id')
        .in('source_id', pdfPptxSources.map(source => source.id));

      if (pdfPptxExpertDocsError) {
        console.error('Error fetching expert documents for PDF/PPTX source types:', pdfPptxExpertDocsError.message);
      } else if (pdfPptxExpertDocs && pdfPptxExpertDocs.length > 0) {
        if (!dryRun) {
          const { error: updateError } = await supabaseClient
            .from('expert_documents')
            .update({ document_type_id: '2f5af574-9053-49b1-908d-c35001ce9680' }) // PDF/PPTX
            .in('id', pdfPptxExpertDocs.map(doc => doc.id));

          if (updateError) {
            console.error('Error updating expert documents to PDF/PPTX type:', updateError.message);
          } else {
            console.log(`✓ Updated ${pdfPptxExpertDocs.length} expert documents to document_type_id 2f5af574-9053-49b1-908d-c35001ce9680 (PDF/PPTX)`);
          }
        } else {
          console.log(`[DRY RUN] Would update ${pdfPptxExpertDocs.length} expert documents to PDF/PPTX type`);
        }
      }
    }

    // 4. Process expert documents with JSON content (rules 1 and 2)
    console.log('\nProcessing expert documents with JSON content for specific source types...');
    
    // Process documents for rule 1: document_type_id 46dac359-01e9-4e36-bfb2-531da9c25e3f (regardless of content)
    const { data: rule1Sources, error: rule1SourcesError } = await supabaseClient
      .from('sources_google')
      .select('id')
      .eq('document_type_id', '46dac359-01e9-4e36-bfb2-531da9c25e3f');

    if (rule1SourcesError) {
      console.error('Error fetching sources for rule 1:', rule1SourcesError.message);
    } else if (rule1Sources && rule1Sources.length > 0) {
      // Get all expert documents for these sources (regardless of content)
      const { data: rule1ExpertDocs, error: rule1ExpertDocsError } = await supabaseClient
        .from('expert_documents')
        .select('id')
        .in('source_id', rule1Sources.map(source => source.id));

      if (rule1ExpertDocsError) {
        console.error('Error fetching expert documents for rule 1:', rule1ExpertDocsError.message);
      } else if (rule1ExpertDocs && rule1ExpertDocs.length > 0) {
        console.log(`Found ${rule1ExpertDocs.length} expert documents for document_type_id 46dac359-01e9-4e36-bfb2-531da9c25e3f`);

        if (!dryRun) {
          const { error: updateError } = await supabaseClient
            .from('expert_documents')
            .update({ document_type_id: '1f71f894-d2f8-415e-80c1-a4d6db4d8b18' }) // Document
            .in('id', rule1ExpertDocs.map(doc => doc.id));

          if (updateError) {
            console.error('Error updating expert documents for rule 1:', updateError.message);
          } else {
            console.log(`✓ Updated ${rule1ExpertDocs.length} expert documents to document_type_id 1f71f894-d2f8-415e-80c1-a4d6db4d8b18 (Document)`);
          }
        } else {
          console.log(`[DRY RUN] Would update ${rule1ExpertDocs.length} expert documents for rule 1`);
        }
      }
    }

    // Process documents for rule 2: ANY document_type_id 03743a23-d2f3-4c73-a282-85afc138fdfd (not just those with JSON)
    const { data: rule2Sources, error: rule2SourcesError } = await supabaseClient
      .from('sources_google')
      .select('id')
      .eq('document_type_id', '03743a23-d2f3-4c73-a282-85afc138fdfd');

    if (rule2SourcesError) {
      console.error('Error fetching sources for rule 2:', rule2SourcesError.message);
    } else if (rule2Sources && rule2Sources.length > 0) {
      // Get all expert documents for these sources (regardless of content)
      console.log(`Found ${rule2Sources.length} sources with document_type_id 03743a23-d2f3-4c73-a282-85afc138fdfd (Working Document)`);
      
      const { data: rule2Docs, error: rule2DocsError } = await supabaseClient
        .from('expert_documents')
        .select('id')
        .in('source_id', rule2Sources.map(source => source.id));
        
      if (rule2DocsError) {
        console.error('Error fetching expert documents for rule 2:', rule2DocsError.message);
      } else if (rule2Docs && rule2Docs.length > 0) {
        console.log(`Found ${rule2Docs.length} expert documents for document_type_id 03743a23-d2f3-4c73-a282-85afc138fdfd sources`);

        if (!dryRun) {
          const { error: updateError } = await supabaseClient
            .from('expert_documents')
            .update({ document_type_id: '5b1f8963-0946-4e89-884d-30517eebb8a5' }) // Json Expert Summary
            .in('id', rule2Docs.map(doc => doc.id));

          if (updateError) {
            console.error('Error updating expert documents for rule 2:', updateError.message);
          } else {
            console.log(`✓ Updated ${rule2Docs.length} expert documents to document_type_id 5b1f8963-0946-4e89-884d-30517eebb8a5 (Json Expert Summary)`);
          }
        } else {
          console.log(`[DRY RUN] Would update ${rule2Docs.length} expert documents for rule 2`);
        }
      }
    }

    // 5. Process documents with JSON content starting with {"title"
    console.log('\nProcessing expert documents with JSON content starting with {"title"...');
    const titleJsonDocs = expertDocs.filter(doc => 
      typeof doc.processed_content === 'string' && 
      doc.processed_content.trim().startsWith('{"title')
    );

    if (titleJsonDocs.length > 0) {
      console.log(`Found ${titleJsonDocs.length} expert documents with JSON content starting with {"title"`);

      if (!dryRun) {
        const { error: updateError } = await supabaseClient
          .from('expert_documents')
          .update({ document_type_id: '5b1f8963-0946-4e89-884d-30517eebb8a5' }) // Json Expert Summary
          .in('id', titleJsonDocs.map(doc => doc.id));

        if (updateError) {
          console.error('Error updating expert documents with {"title" content:', updateError.message);
        } else {
          console.log(`✓ Updated ${titleJsonDocs.length} expert documents to document_type_id 5b1f8963-0946-4e89-884d-30517eebb8a5 (Json Expert Summary)`);
        }
      } else {
        console.log(`[DRY RUN] Would update ${titleJsonDocs.length} expert documents with {"title" content`);
      }
    }

    // 6. Mark documents with non-JSON content as needs_reprocessing
    console.log('\nMarking documents with non-JSON content as needs_reprocessing...');
    const nonJsonDocs = expertDocs.filter(doc => {
      // Check if the content is not valid JSON
      try {
        return !(typeof doc.processed_content === 'string' && 
                doc.processed_content.trim().startsWith('{') && 
                JSON.parse(doc.processed_content));
      } catch (e) {
        return true; // Any parse error means it's not valid JSON
      }
    });

    if (nonJsonDocs.length > 0) {
      console.log(`Found ${nonJsonDocs.length} expert documents with non-JSON content`);

      // Process in batches
      for (let i = 0; i < nonJsonDocs.length; i += batchSize) {
        const batchDocs = nonJsonDocs.slice(i, i + batchSize);
        const updates = [];

        for (const doc of batchDocs) {
          updates.push({
            id: doc.id,
            source_id: doc.source_id,  // Include source_id to satisfy not-null constraint 
            document_processing_status: 'needs_reprocessing',  // Using new dedicated field
            document_processing_status_updated_at: new Date().toISOString(),
            processing_status: 'pending',  // Keep the original processing_status field as is
            processing_skip_reason: 'No valid JSON content found - needs reprocessing'
          });
        }

        if (!dryRun) {
          // Use UPSERT to handle the updates efficiently
          const { error: updateError } = await supabaseClient
            .from('expert_documents')
            .upsert(updates, { onConflict: 'id' });

          if (updateError) {
            console.error(`Error updating batch ${i}-${i+batchSize} for non-JSON documents:`, updateError.message);
          } else {
            console.log(`✓ Updated batch ${i}-${i+batchSize} of ${nonJsonDocs.length} non-JSON documents with document_processing_status=needs_reprocessing`);
          }
        } else {
          console.log(`[DRY RUN] Would update batch ${i}-${i+batchSize} of ${nonJsonDocs.length} non-JSON documents with document_processing_status=needs_reprocessing`);
        }
      }
    }

    // 7. Mark documents containing "File analysis unavailable" for document_type_id e9d3e473-5315-4837-9f5f-61f150cbd137
    console.log('\nProcessing documents containing "File analysis unavailable"...');
    const { data: researchPaperSources, error: researchPaperSourcesError } = await supabaseClient
      .from('sources_google')
      .select('id')
      .eq('document_type_id', 'e9d3e473-5315-4837-9f5f-61f150cbd137'); // Research Paper

    if (researchPaperSourcesError) {
      console.error('Error fetching Research Paper sources:', researchPaperSourcesError.message);
    } else if (researchPaperSources && researchPaperSources.length > 0) {
      // Find expert documents for these sources with "File analysis unavailable"
      const unavailableDocs = expertDocs.filter(doc => 
        researchPaperSources.some(source => source.id === doc.source_id) && 
        typeof doc.processed_content === 'string' && 
        doc.processed_content.includes('File analysis unavailable')
      );

      if (unavailableDocs.length > 0) {
        console.log(`Found ${unavailableDocs.length} expert documents with "File analysis unavailable" for Research Paper sources`);

        // Process in batches
        for (let i = 0; i < unavailableDocs.length; i += batchSize) {
          const batchDocs = unavailableDocs.slice(i, i + batchSize);
          const updates = [];

          for (const doc of batchDocs) {
            updates.push({
              id: doc.id,
              source_id: doc.source_id,  // Include source_id to satisfy not-null constraint
              document_processing_status: 'needs_reprocessing',  // Using new dedicated field
              document_processing_status_updated_at: new Date().toISOString(),
              processing_status: 'pending',  // Keep the original processing_status field as is
              processing_skip_reason: 'Contains "File analysis unavailable" message - needs reprocessing'
            });
          }

          if (!dryRun) {
            // Use UPSERT to handle the updates efficiently
            const { error: updateError } = await supabaseClient
              .from('expert_documents')
              .upsert(updates, { onConflict: 'id' });

            if (updateError) {
              console.error(`Error updating batch ${i}-${i+batchSize} for "File analysis unavailable" documents:`, updateError.message);
            } else {
              console.log(`✓ Updated batch ${i}-${i+batchSize} of ${unavailableDocs.length} "File analysis unavailable" documents with document_processing_status=needs_reprocessing`);
            }
          } else {
            console.log(`[DRY RUN] Would update batch ${i}-${i+batchSize} of ${unavailableDocs.length} "File analysis unavailable" documents with document_processing_status=needs_reprocessing`);
          }
        }
      }
    }

    // 8. Mark folder documents as needs_reprocessing
    console.log('\nMarking folder documents as needs_reprocessing...');
    const { data: folderSources, error: folderSourcesError } = await supabaseClient
      .from('sources_google')
      .select('id')
      .eq('mime_type', 'application/vnd.google-apps.folder');

    if (folderSourcesError) {
      console.error('Error fetching folder sources:', folderSourcesError.message);
    } else if (folderSources && folderSources.length > 0) {
      // Get expert documents for these folder sources
      const { data: folderDocs, error: folderDocsError } = await supabaseClient
        .from('expert_documents')
        .select('id, source_id')
        .in('source_id', folderSources.map(source => source.id));

      if (folderDocsError) {
        console.error('Error fetching expert documents for folders:', folderDocsError.message);
      } else if (folderDocs && folderDocs.length > 0) {
        console.log(`Found ${folderDocs.length} expert documents for folders`);

        // Process in batches
        for (let i = 0; i < folderDocs.length; i += batchSize) {
          const batchDocs = folderDocs.slice(i, i + batchSize);
          const updates = [];

          for (const doc of batchDocs) {
            updates.push({
              id: doc.id,
              source_id: doc.source_id,  // Include source_id to satisfy not-null constraint
              document_processing_status: 'skip_processing',  // Using new dedicated field
              document_processing_status_updated_at: new Date().toISOString(),
              processing_status: 'completed',  // Keep the original processing_status field as is
              processing_skip_reason: 'Google Drive folder, not a document - skip processing'
            });
          }

          if (!dryRun) {
            // Use UPSERT to handle the updates efficiently
            const { error: updateError } = await supabaseClient
              .from('expert_documents')
              .upsert(updates, { onConflict: 'id' });

            if (updateError) {
              console.error(`Error updating batch ${i}-${i+batchSize} for folder documents:`, updateError.message);
            } else {
              console.log(`✓ Updated batch ${i}-${i+batchSize} of ${folderDocs.length} folder documents with document_processing_status=skip_processing`);
            }
          } else {
            console.log(`[DRY RUN] Would update batch ${i}-${i+batchSize} of ${folderDocs.length} folder documents with document_processing_status=skip_processing`);
          }
        }
      }
    }

    // 9. Mark password protected documents
    console.log('\nMarking password protected documents...');
    const { data: passwordProtectedSources, error: passwordProtectedError } = await supabaseClient
      .from('sources_google')
      .select('id')
      .eq('document_type_id', '9dbe32ff-5e82-4586-be63-1445e5bcc548');

    if (passwordProtectedError) {
      console.error('Error fetching password protected sources:', passwordProtectedError.message);
    } else if (passwordProtectedSources && passwordProtectedSources.length > 0) {
      // Get expert documents for these sources
      const { data: passwordProtectedDocs, error: passwordProtectedDocsError } = await supabaseClient
        .from('expert_documents')
        .select('id, source_id')
        .in('source_id', passwordProtectedSources.map(source => source.id));

      if (passwordProtectedDocsError) {
        console.error('Error fetching expert documents for password protected sources:', passwordProtectedDocsError.message);
      } else if (passwordProtectedDocs && passwordProtectedDocs.length > 0) {
        console.log(`Found ${passwordProtectedDocs.length} expert documents for password protected sources`);

        // Process in batches
        for (let i = 0; i < passwordProtectedDocs.length; i += batchSize) {
          const batchDocs = passwordProtectedDocs.slice(i, i + batchSize);
          const updates = [];

          for (const doc of batchDocs) {
            updates.push({
              id: doc.id,
              source_id: doc.source_id,
              document_processing_status: 'skip_processing',  // Using new dedicated field
              document_processing_status_updated_at: new Date().toISOString(),
              processing_status: 'completed',  // Keep the original processing_status field as is
              processing_skip_reason: 'Password protected - skip processing'
            });
          }

          if (!dryRun) {
            const { error: updateError } = await supabaseClient
              .from('expert_documents')
              .upsert(updates, { onConflict: 'id' });

            if (updateError) {
              console.error(`Error updating batch ${i}-${i+batchSize} for password protected documents:`, updateError.message);
            } else {
              console.log(`✓ Updated batch ${i}-${i+batchSize} of ${passwordProtectedDocs.length} password protected documents`);
            }
          } else {
            console.log(`[DRY RUN] Would update batch ${i}-${i+batchSize} of ${passwordProtectedDocs.length} password protected documents`);
          }
        }
      }
    }

    // 10. Mark unsupported document types
    console.log('\nMarking unsupported document types...');
    
    // For these specific IDs, we'll mark them as skip_processing
    const unsupportedDocumentTypeIds = [
      // Specifically requested IDs
      '6ece37e7-840d-4a0c-864d-9f1f971b1d7e', // m4a audio
      'e9d3e473-5315-4837-9f5f-61f150cbd137', // Code Documentation Markdown
      
      // Category: Audio
      '4edfb133-ffeb-4b9c-bfd4-79ee9a9d73af', // mp3 audio
      'd2206940-e4f3-476e-9245-0e1eb12fd195', // aac audio
      '8ce8fbbc-b397-4061-a80f-81402515503b', // m3u file
      'fe697fc5-933c-41c9-9b11-85e0defa86ed', // wav audio
      
      // Category: Operations
      '53f42e7d-78bd-4bde-8106-dc12a4835695', // Document Processing Script
      '4fdbd8be-fe5a-4341-934d-2b6bd43be7be', // CI CD Pipeline Script
      'a1dddf8e-1264-4ec0-a5af-52eafb536ee3', // Deployment Script
      '561a86b0-7064-4c20-a40e-2ec6905c4a42', // Database Management Script
      'f7e83857-8bb8-4b18-9d8f-16d5cb783650', // Environment Setup Script
      
      // Category: Spreadsheet
      'b26a68ed-a0d1-415d-8271-cba875bfe3ce', // xlsx document
      '920893fc-f0be-4211-85b4-fc29882ade97', // google sheet
      
      // Other existing types
      'e29b5194-7ba0-4a3c-a7db-92b0d8adca6a', // Unknown Document Type
      '9dbe32ff-5e82-4586-be63-1445e5bcc548'  // Password Protected Document (already being handled, added for completeness)
    ];

    // Unsupported MIME types
    const unsupportedMimeTypes = [
      'application/vnd.google-apps.audio',
      'application/vnd.google-apps.video',
      'application/vnd.google-apps.drawing',
      'application/vnd.google-apps.form',
      'application/vnd.google-apps.map',
      'application/vnd.google-apps.presentation', // Google Slides
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/svg+xml'
    ];

    // First try by document type ID
    const { data: unsupportedSources, error: unsupportedError } = await supabaseClient
      .from('sources_google')
      .select('id, document_type_id, name, mime_type')
      .in('document_type_id', unsupportedDocumentTypeIds);
      
    // Then try by MIME type
    const { data: unsupportedMimeSources, error: unsupportedMimeError } = await supabaseClient
      .from('sources_google')
      .select('id, document_type_id, name, mime_type')
      .in('mime_type', unsupportedMimeTypes);

    // Combine the results from both queries
    let allUnsupportedSources: any[] = [];
    
    if (unsupportedError) {
      console.error('Error fetching unsupported document type sources:', unsupportedError.message);
    } else if (unsupportedSources && unsupportedSources.length > 0) {
      allUnsupportedSources = [...unsupportedSources];
    }
    
    if (unsupportedMimeError) {
      console.error('Error fetching unsupported MIME type sources:', unsupportedMimeError.message);
    } else if (unsupportedMimeSources && unsupportedMimeSources.length > 0) {
      // Append to the combined list, avoiding duplicates
      for (const source of unsupportedMimeSources) {
        if (!allUnsupportedSources.some(s => s.id === source.id)) {
          allUnsupportedSources.push(source);
        }
      }
    }
    
    if (allUnsupportedSources.length > 0) {
      console.log(`Found ${allUnsupportedSources.length} sources with unsupported types (by ID or MIME type):`);
      if (debug) {
        console.log('Unsupported sources:', allUnsupportedSources.map(s => ({ 
          id: s.id, 
          name: s.name, 
          document_type_id: s.document_type_id,
          mime_type: s.mime_type,
          type_reason: unsupportedDocumentTypeIds.indexOf(s.document_type_id) !== -1 ? 
            `Unsupported document type: ${['3D Model', 'Audio Recording', 'Video Recording', 'Image', 'Unknown Document Type', 'Password Protected'][unsupportedDocumentTypeIds.indexOf(s.document_type_id)]}` : 
            `Unsupported MIME type: ${s.mime_type}`
        })));
      }
      
      // Get expert documents for these sources
      const { data: unsupportedDocs, error: unsupportedDocsError } = await supabaseClient
        .from('expert_documents')
        .select('id, source_id')
        .in('source_id', allUnsupportedSources.map(source => source.id));

      if (unsupportedDocsError) {
        console.error('Error fetching expert documents for unsupported document types:', unsupportedDocsError.message);
      } else if (unsupportedDocs && unsupportedDocs.length > 0) {
        console.log(`Found ${unsupportedDocs.length} expert documents with unsupported document types`);

        // Process in batches
        for (let i = 0; i < unsupportedDocs.length; i += batchSize) {
          const batchDocs = unsupportedDocs.slice(i, i + batchSize);
          const updates = [];

          for (const doc of batchDocs) {
            // Find the corresponding source to get type information
            const source = allUnsupportedSources.find(s => s.id === doc.source_id);
            
            let typeReason = 'Unknown unsupported document type';
            if (source) {
              if (unsupportedDocumentTypeIds.indexOf(source.document_type_id) !== -1) {
                // This is an unsupported document type ID
                typeReason = `Unsupported document type: ${
                  ['3D Model', 'Audio Recording', 'Video Recording', 'Image', 'Unknown Document Type', 'Password Protected'][
                    unsupportedDocumentTypeIds.indexOf(source.document_type_id)
                  ]
                }`;
              } else if (unsupportedMimeTypes.includes(source.mime_type)) {
                // This is an unsupported MIME type
                typeReason = `Unsupported MIME type: ${source.mime_type}`;
              }
              
              typeReason += ` (${source.name})`;
            }
              
            updates.push({
              id: doc.id,
              source_id: doc.source_id,
              document_processing_status: 'skip_processing',  // Using new dedicated field
              document_processing_status_updated_at: new Date().toISOString(),
              processing_status: 'completed',  // Keep the original processing_status field as is
              processing_skip_reason: `Unsupported file - skip processing: ${typeReason}`
            });
          }

          if (!dryRun) {
            const { error: updateError } = await supabaseClient
              .from('expert_documents')
              .upsert(updates, { onConflict: 'id' });

            if (updateError) {
              console.error(`Error updating batch ${i}-${i+batchSize} for unsupported document types:`, updateError.message);
            } else {
              console.log(`✓ Updated batch ${i}-${i+batchSize} of ${unsupportedDocs.length} documents with unsupported types`);
            }
          } else {
            console.log(`[DRY RUN] Would update batch ${i}-${i+batchSize} of ${unsupportedDocs.length} documents with unsupported types`);
          }
        }
      }
    }

    // Complete tracking
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: 0, // We don't know exactly how many records were affected
          summary: `${dryRun ? '[DRY RUN] ' : ''}Updated media document types`
        });
      } catch (error) {
        console.warn(`Warning: Unable to complete command tracking: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Media document types update completed successfully`);
  } catch (error) {
    console.error(`Error updating media document types: ${error instanceof Error ? error.message : String(error)}`);
    
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.failTracking(trackingId, `Command failed: ${error instanceof Error ? error.message : String(error)}`);
      } catch (trackingError) {
        console.warn(`Warning: Unable to record command failure: ${trackingError instanceof Error ? trackingError.message : String(trackingError)}`);
      }
    }
  }
}

// Set up CLI
const program = new Command();

program
  .name('update-media-document-types')
  .description('Update document_type_id for media files and expert documents')
  .option('--dry-run', 'Show what would be updated without making changes')
  .option('--batch-size <number>', 'Number of records to process in each batch', '50')
  .option('--debug', 'Show debug information')
  .action((options) => {
    updateMediaDocumentTypes({
      dryRun: options.dryRun,
      batchSize: parseInt(options.batchSize),
      debug: options.debug
    });
  });

program.parse(process.argv);