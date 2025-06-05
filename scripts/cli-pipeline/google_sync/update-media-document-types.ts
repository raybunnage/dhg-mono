#!/usr/bin/env ts-node
import { Command } from 'commander';
import * as crypto from 'crypto';
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
      .from('google_expert_documents')
      .select('id, source_id, document_type_id, processed_content, document_processing_status, processing_skip_reason')
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
            .from('google_expert_documents')
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
      .from('google_sources')
      .select('id, name')
      .ilike('name', '%.conf');

    if (confFilesError) {
      console.error('Error fetching .conf files:', confFilesError.message);
    } else if (confFiles && confFiles.length > 0) {
      console.log(`Found ${confFiles.length} .conf files`);

      // Update sources_google document type
      if (!dryRun) {
        const { error: updateSourcesError } = await supabaseClient
          .from('google_sources')
          .update({ document_type_id: 'c1a7b78b-c61e-44a4-8b77-a27a38cbba7e' }) // Configuration File
          .in('id', confFiles.map(file => file.id));

        if (updateSourcesError) {
          console.error('Error updating .conf files in sources_google:', updateSourcesError.message);
        } else {
          console.log(`✓ Updated ${confFiles.length} .conf files in sources_google to document_type_id c1a7b78b-c61e-44a4-8b77-a27a38cbba7e (Configuration File)`);
        }

        // Get related expert documents
        const { data: confExpertDocs, error: confExpertDocsError } = await supabaseClient
          .from('google_expert_documents')
          .select('id')
          .in('source_id', confFiles.map(file => file.id));

        if (confExpertDocsError) {
          console.error('Error fetching expert documents for .conf files:', confExpertDocsError.message);
        } else if (confExpertDocs && confExpertDocs.length > 0) {
          // Update expert_documents to Document type
          const { error: updateExpertDocsError } = await supabaseClient
            .from('google_expert_documents')
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
      '1e7015f7-43b4-47ed-8a73-b6545c6e0455', // doc file                       | text            | application/msword                  | docx         | No
      '3946ceb8-fcf8-44b2-826b-8b55fe259132', // google doc                     | text            | gdocapplication/vnd.google-apps.d   | docx         | No
      '0b99de50-7dfa-4d5c-bfdd-627fcac3e35a', // markdown document              | text            | text/markdown                       | docx         | No
      '08d25ab0-c3f8-4dfb-b703-3dc420ad50cf', // txt file                       | text            | text/plain                          | docx         | No
      'bb90f01f-b6c4-4030-a3ea-db9dd8c4b55a', // word document                  | text            | application/vnd.openxmlformats-of   | docx         | No
      '4ce87d2a-451b-48e4-a72e-1c981e402df6', // ai discussion transcript       | transcript      |                                     | docx         | Yes
      '5acbbf7a-dcba-46a6-a59c-084fe9dba05a', // ai presentation transcript     | transcript      |                                     | docx         | Yes
      '79c36eb8-b599-45c8-8690-37568f4453da', // cleaned discussion transcrip   | transcript      |                                     | docx         | No
      '3aaf624d-7550-4bb7-8c37-d7c4a80fd20f', // cleaned presentation transcr   | transcript      |                                     | docx         | No
      'c62f92f5-6123-4324-876d-14639841284e', // dicussion transcript           | transcript      |                                     | docx         | No
      'c1a7b78b-c61e-44a4-8b77-a27a38cbba7e', // presentation transcript   
      '46dac359-01e9-4e36-bfb2-531da9c25e3f', // Chat Log 
      '27784498-e35b-4729-a1c4-9e4ec24e6a5a', // science meeting discussion     | presentation    |                                     | docx         | No
      'ba7893d4-8404-4489-b553-b6464cd5cbd8', // scientific presentation and    | presentation    |                                     | docx         | No
    ];


    console.log(`\nProcessing sources with specific document types (to Document)...`);
    const { data: specificTypeSources, error: specificTypesError } = await supabaseClient
      .from('google_sources')
      .select('id, document_type_id')
      .in('document_type_id', documentTypeIdsToDocument);

    if (specificTypesError) {
      console.error('Error fetching sources with specific document types:', specificTypesError.message);
    } else if (specificTypeSources && specificTypeSources.length > 0) {
      console.log(`Found ${specificTypeSources.length} sources with document types to be set as Document`);

      // Get corresponding expert documents
      const { data: specificTypeExpertDocs, error: specificTypeExpertDocsError } = await supabaseClient
        .from('google_expert_documents')
        .select('id')
        .in('source_id', specificTypeSources.map(source => source.id));

      if (specificTypeExpertDocsError) {
        console.error('Error fetching expert documents for specific source types:', specificTypeExpertDocsError.message);
      } else if (specificTypeExpertDocs && specificTypeExpertDocs.length > 0) {
        if (!dryRun) {
          const { error: updateError } = await supabaseClient
            .from('google_expert_documents')
            .update({ document_type_id: '1f71f894-d2f8-415e-80c1-a4d6db4d8b18' }) // json doc summary
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
      '9ccdc433-99d8-46fb-8bf7-3ba72cf27c88', // reseaarch article
      '5e61bfbc-39ef-4380-80c0-592017b39b71', // review article
      'fc07c06a-ab03-4714-baf2-343427d433a3', // book
      'cebcbcd0-7662-4d78-b2d8-29eb37b7d26b', // hypothesis 
      '195b0bee-2a3e-4112-aa3c-83ca95b7cd44', // thesis  
      'ee563275-2e54-4ac8-b756-839486023c91', // editorial 
      '98ac1e77-2cff-474a-836e-4db32a521a16', // essay
      '5eb89387-854c-4754-baf8-3632ac286d92', // journal article
      '19802f2b-24f5-4b9a-ae7a-50e9f5ddacae', // magazine article 

      '81109bf5-36b5-4075-a8db-5397e0e46fd6', // preprint                    
      '9ccdc433-99d8-46fb-8bf7-3ba72cf27c88', // research article             
      '5e61bfbc-39ef-4380-80c0-592017b39b71', // review article                
      'f2fd129e-a0ad-485d-a457-ec49736010a9', // web news article              
      '83849c95-823e-4f8b-bf47-4318ae014f16', // email correspondence 
      'e886b004-b90c-4130-bfa7-971d084e88ec', // letter
      'ab90f374-00f6-4220-90e0-91b2054eafad', // letter to the editor
      'eca21963-c638-4435-85f5-0da67458995c', // url blog post
      'f2fd129e-a0ad-485d-a457-ec49736010a9', // web news article
      'ea74c86e-7f22-4ecf-ae16-0430291995e2', // report
      '97a2a12e-1bdf-49c1-ad4c-d2a411199c9c', // correction                    
      'c7c0f0bb-10c5-4dea-9bc7-25d398f10ee8', // corrigendum                   
      '6691b7f3-ba21-4118-8bd3-acf372fe675a', // erratum    
      '2fa04116-04ed-4828-b091-ca6840eb8863', // pdf document                   
      '5031d315-3960-4d50-b2a8-d621232a6938', // story                         
      '5f3f9982-3295-4d98-8f52-3db81b5e0ccb', // press release   
      '8467f8db-7514-46cb-ba5a-4c3278372726', // new work summary  
      '3b9369c8-73f4-4b5c-ad00-33b9720516f9', // website               
    ];

    console.log(`\nProcessing sources with document types to be set as PDF/PPTX...`);
    const { data: pdfPptxSources, error: pdfPptxSourcesError } = await supabaseClient
      .from('google_sources')
      .select('id, document_type_id')
      .in('document_type_id', documentTypesToPdfPptx);

    if (pdfPptxSourcesError) {
      console.error('Error fetching sources for PDF/PPTX types:', pdfPptxSourcesError.message);
    } else if (pdfPptxSources && pdfPptxSources.length > 0) {
      console.log(`Found ${pdfPptxSources.length} sources with document types to be set as PDF/PPTX`);

      // Get corresponding expert documents
      const { data: pdfPptxExpertDocs, error: pdfPptxExpertDocsError } = await supabaseClient
        .from('google_expert_documents')
        .select('id')
        .in('source_id', pdfPptxSources.map(source => source.id));

      if (pdfPptxExpertDocsError) {
        console.error('Error fetching expert documents for PDF/PPTX source types:', pdfPptxExpertDocsError.message);
      } else if (pdfPptxExpertDocs && pdfPptxExpertDocs.length > 0) {
        if (!dryRun) {
          const { error: updateError } = await supabaseClient
            .from('google_expert_documents')
            .update({ document_type_id: '2f5af574-9053-49b1-908d-c35001ce9680' }) // json pdf summary
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
      .from('google_sources')
      .select('id')
      .eq('document_type_id', '46dac359-01e9-4e36-bfb2-531da9c25e3f');

    if (rule1SourcesError) {
      console.error('Error fetching sources for rule 1:', rule1SourcesError.message);
    } else if (rule1Sources && rule1Sources.length > 0) {
      // Get all expert documents for these sources (regardless of content)
      const { data: rule1ExpertDocs, error: rule1ExpertDocsError } = await supabaseClient
        .from('google_expert_documents')
        .select('id')
        .in('source_id', rule1Sources.map(source => source.id));

      if (rule1ExpertDocsError) {
        console.error('Error fetching expert documents for rule 1:', rule1ExpertDocsError.message);
      } else if (rule1ExpertDocs && rule1ExpertDocs.length > 0) {
        console.log(`Found ${rule1ExpertDocs.length} expert documents for document_type_id 46dac359-01e9-4e36-bfb2-531da9c25e3f`);

        if (!dryRun) {
          const { error: updateError } = await supabaseClient
            .from('google_expert_documents')
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

    // Process documents for rule 2, 3, 4: specific document_type_ids to be set as JSON Expert Summary
    const jsonExpertSummarySourceTypes = [
      '03743a23-d2f3-4c73-a282-85afc138fdfd', // curriculum vitae
      '554ed67c-35d1-4218-abba-8d1b0ff7156d', // Presentation Announcement
      'af194b7e-cbf9-45c3-a1fc-863dbc815f1e'  // professional biography
    ];

    const { data: jsonExpertSources, error: jsonExpertSourcesError } = await supabaseClient
      .from('google_sources')
      .select('id, document_type_id')
      .in('document_type_id', jsonExpertSummarySourceTypes);

    if (jsonExpertSourcesError) {
      console.error('Error fetching sources for JSON Expert Summary:', jsonExpertSourcesError.message);
    } else if (jsonExpertSources && jsonExpertSources.length > 0) {
      // Get all expert documents for these sources (regardless of content)
      console.log(`Found ${jsonExpertSources.length} sources with document_type_id in [${jsonExpertSummarySourceTypes.join(', ')}]`);
      
      const { data: jsonExpertDocs, error: jsonExpertDocsError } = await supabaseClient
        .from('google_expert_documents')
        .select('id')
        .in('source_id', jsonExpertSources.map(source => source.id));
        
      if (jsonExpertDocsError) {
        console.error('Error fetching expert documents for JSON Expert Summary sources:', jsonExpertDocsError.message);
      } else if (jsonExpertDocs && jsonExpertDocs.length > 0) {
        console.log(`Found ${jsonExpertDocs.length} expert documents for JSON Expert Summary source types`);

        if (!dryRun) {
          const { error: updateError } = await supabaseClient
            .from('google_expert_documents')
            .update({ document_type_id: '5b1f8963-0946-4e89-884d-30517eebb8a5' }) // Json Expert Summary
            .in('id', jsonExpertDocs.map(doc => doc.id));

          if (updateError) {
            console.error('Error updating expert documents for JSON Expert Summary:', updateError.message);
          } else {
            console.log(`✓ Updated ${jsonExpertDocs.length} expert documents to document_type_id 5b1f8963-0946-4e89-884d-30517eebb8a5 (Json Expert Summary)`);
          }
        } else {
          console.log(`[DRY RUN] Would update ${jsonExpertDocs.length} expert documents for JSON Expert Summary`);
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
          .from('google_expert_documents')
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

    // 6. Mark documents with non-JSON content as needs_reprocessing, but only for supported file types
    console.log('\nMarking documents with non-JSON content as needs_reprocessing (only for .txt, .docx, .pdf, and .pptx files)...');
    
    // Get all source IDs from expert docs
    const expertDocSourceIds = expertDocs.map(doc => doc.source_id);
    
    // Fetch the corresponding sources_google records to check file extensions
    const { data: sourcesForJsonCheck, error: sourcesJsonCheckError } = await supabaseClient
      .from('google_sources')
      .select('id, name')
      .in('id', expertDocSourceIds);
      
    if (sourcesJsonCheckError) {
      console.error('Error fetching sources for JSON content check:', sourcesJsonCheckError.message);
    }
    
    // Create a map of source IDs to file names for quick lookup
    const sourceIdToNameMap = new Map();
    if (sourcesForJsonCheck) {
      sourcesForJsonCheck.forEach(source => {
        sourceIdToNameMap.set(source.id, source.name);
      });
    }
    
    // Filter only documents that have non-JSON content AND have supported file extensions
    const nonJsonDocs = expertDocs.filter(doc => {
      // Get the file name from the sources map
      const fileName = sourceIdToNameMap.get(doc.source_id);
      
      // Check if it has one of the supported extensions
      const hasValidExtension = fileName && 
        (/\.(txt|docx|pdf|pptx)$/i.test(fileName));
      
      // Only check for JSON content if it's a supported file type
      if (!hasValidExtension) {
        return false;
      }
      
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
            .from('google_expert_documents')
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
      .from('google_sources')
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
              .from('google_expert_documents')
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
      .from('google_sources')
      .select('id')
      .eq('mime_type', 'application/vnd.google-apps.folder');

    if (folderSourcesError) {
      console.error('Error fetching folder sources:', folderSourcesError.message);
    } else if (folderSources && folderSources.length > 0) {
      // Get expert documents for these folder sources
      const { data: folderDocs, error: folderDocsError } = await supabaseClient
        .from('google_expert_documents')
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
              .from('google_expert_documents')
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
      .from('google_sources')
      .select('id')
      .eq('document_type_id', '9dbe32ff-5e82-4586-be63-1445e5bcc548');

    if (passwordProtectedError) {
      console.error('Error fetching password protected sources:', passwordProtectedError.message);
    } else if (passwordProtectedSources && passwordProtectedSources.length > 0) {
      // Get expert documents for these sources
      const { data: passwordProtectedDocs, error: passwordProtectedDocsError } = await supabaseClient
        .from('google_expert_documents')
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
              .from('google_expert_documents')
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
      
      // Category: Image
      'db6518ad-765c-4a02-a684-9c2e49d77cf5', // png image
      '68b95822-2746-4ce1-ad35-34e5b0297177', // jpg image
      
      // Category: Video (except mp4 video)
      '3e7c880c-d821-4d01-8cc5-3547bdd2e347', // video mpeg
      'd70a258e-262b-4bb3-95e3-f826ee9b918b', // video quicktime
      '91fa92a3-d606-493b-832d-9ba1fa83dc9f', // video microsoft avi
      '28ab55b9-b408-486f-b1c3-8f0f0a174ad4', // m4v
      '2c1d3bdc-b429-4194-bec2-7e4bbb165dbf', // conf file (in video category)
      // Not included: 'ba1d7662-0168-4756-a2ea-6d964fd02ba8' (mp4 video) as requested
      
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
      // 'video/mp4' - Removed as requested, this is now supported
      'video/quicktime',
      'video/x-msvideo',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/svg+xml'
    ];

    // First try by document type ID
    const { data: unsupportedSources, error: unsupportedError } = await supabaseClient
      .from('google_sources')
      .select('id, document_type_id, name, mime_type')
      .in('document_type_id', unsupportedDocumentTypeIds);
      
    // Then try by MIME type
    const { data: unsupportedMimeSources, error: unsupportedMimeError } = await supabaseClient
      .from('google_sources')
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
        .from('google_expert_documents')
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
              .from('google_expert_documents')
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

    // NEW FEATURE: Find sources_google files without expert_documents entries
    console.log('\nFinding sources_google files without expert_documents entries...');
    
    // Get all sources_google files that are not folders and not deleted
    const { data: allActiveSources, error: activeSourcesError } = await supabaseClient
      .from('google_sources')
      .select('id, name, document_type_id, mime_type')
      .eq('is_deleted', false)
      .not('mime_type', 'eq', 'application/vnd.google-apps.folder');
      
    if (activeSourcesError) {
      console.error('Error fetching active sources:', activeSourcesError.message);
    } else if (allActiveSources && allActiveSources.length > 0) {
      console.log(`Found ${allActiveSources.length} active non-folder sources in sources_google`);
      
      // Get all expert_documents to check which sources already have entries
      const { data: allExpertDocs, error: allExpertDocsError } = await supabaseClient
        .from('google_expert_documents')
        .select('source_id')
        .not('source_id', 'is', null);
        
      if (allExpertDocsError) {
        console.error('Error fetching all expert documents:', allExpertDocsError.message);
      } else if (allExpertDocs) {
        // Create a set of source_ids that already have expert_documents
        const existingSourceIds = new Set(allExpertDocs.map(doc => doc.source_id));
        
        // Filter for sources that don't have expert_documents
        const sourcesWithoutDocs = allActiveSources.filter(source => !existingSourceIds.has(source.id));
        
        if (sourcesWithoutDocs.length > 0) {
          console.log(`Found ${sourcesWithoutDocs.length} sources without expert_documents entries`);
          
          // Process in batches
          for (let i = 0; i < sourcesWithoutDocs.length; i += batchSize) {
            const batchSources = sourcesWithoutDocs.slice(i, i + batchSize);
            const newDocEntries = [];
            
            for (const source of batchSources) {
              // Check if source has an unsupported document type
              const isUnsupportedType = unsupportedDocumentTypeIds.includes(source.document_type_id) || 
                                      unsupportedMimeTypes.includes(source.mime_type);
              
              let processingStatus = 'pending';
              let processingSkipReason = null;
              let documentProcessingStatus = 'not_set';
              
              if (isUnsupportedType) {
                processingStatus = 'completed';
                documentProcessingStatus = 'skip_processing';
                processingSkipReason = "unsupported document_type";
                
                // Add more specific information if available
                if (unsupportedDocumentTypeIds.includes(source.document_type_id)) {
                  processingSkipReason = `Unsupported document_type: ${source.document_type_id}`;
                } else if (unsupportedMimeTypes.includes(source.mime_type)) {
                  processingSkipReason = `Unsupported MIME type: ${source.mime_type}`;
                }
              }
              
              // Create a new expert_document entry
              newDocEntries.push({
                id: crypto.randomUUID(), // Generate a unique ID
                source_id: source.id,
                document_type_id: source.document_type_id, // Initially set to same as source
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                processing_status: processingStatus,
                document_processing_status: documentProcessingStatus,
                document_processing_status_updated_at: new Date().toISOString(),
                processing_skip_reason: processingSkipReason
              });
            }
            
            if (!dryRun && newDocEntries.length > 0) {
              const { data, error: insertError } = await supabaseClient
                .from('google_expert_documents')
                .insert(newDocEntries)
                .select('id');
                
              if (insertError) {
                console.error(`Error inserting batch ${i}-${i+batchSize} of new expert_documents:`, insertError.message);
              } else {
                console.log(`✓ Created ${newDocEntries.length} new expert_documents entries for batch ${i}-${i+batchSize}`);
                
                // Count how many were marked as skip_processing
                const skippedCount = newDocEntries.filter(doc => doc.document_processing_status === 'skip_processing').length;
                if (skippedCount > 0) {
                  console.log(`  - ${skippedCount} were marked as 'skip_processing' due to unsupported document types`);
                }
              }
            } else {
              console.log(`[DRY RUN] Would create ${newDocEntries.length} new expert_documents entries for batch ${i}-${i+batchSize}`);
              
              // Count how many would be marked as skip_processing
              const skippedCount = newDocEntries.filter(doc => doc.document_processing_status === 'skip_processing').length;
              if (skippedCount > 0) {
                console.log(`  - ${skippedCount} would be marked as 'skip_processing' due to unsupported document types`);
              }
            }
          }
        } else {
          console.log('All active sources already have expert_documents entries');
        }
      }
    }
    
    // NEW FEATURE: Find expert_documents without corresponding sources_google entries
    console.log('\nFinding expert_documents without corresponding sources_google entries...');
    
    // Get all expert documents with their content flags and document types
    const { data: allExpertDocsWithDetails, error: expertDocsDetailsError } = await supabaseClient
      .from('google_expert_documents')
      .select(`
        id, 
        source_id,
        document_type_id,
        document_types(document_type),
        raw_content,
        processed_content
      `)
      .not('source_id', 'is', null);
    
    if (expertDocsDetailsError) {
      console.error('Error fetching expert documents with details:', expertDocsDetailsError.message);
    } else if (allExpertDocsWithDetails && allExpertDocsWithDetails.length > 0) {
      console.log(`Found ${allExpertDocsWithDetails.length} expert documents with source_id values`);
      
      // Get all active source IDs (not just non-folder sources)
      const { data: allSourceIds, error: allSourceIdsError } = await supabaseClient
        .from('google_sources')
        .select('id')
        .eq('is_deleted', false);
        
      if (allSourceIdsError) {
        console.error('Error fetching all source IDs:', allSourceIdsError.message);
      } else if (allSourceIds) {
        // Create a set of all active source IDs
        const activeSourceIdSet = new Set(allSourceIds.map(source => source.id));
        
        // Find expert documents with missing sources
        const docsWithoutSources = allExpertDocsWithDetails.filter(doc => !activeSourceIdSet.has(doc.source_id));
        
        if (docsWithoutSources.length > 0) {
          console.log(`⚠️ Found ${docsWithoutSources.length} expert_documents without corresponding sources_google entries:`);
          console.log('--------------------------------------------------------------------------------------------------------');
          console.log('| ID                                   | Document Type                     | Content Status             |');
          console.log('--------------------------------------------------------------------------------------------------------');
          
          // Display details about each orphaned document
          for (const doc of docsWithoutSources) {
            const docId = doc.id || 'unknown';
            // Handle the document_types nested object structure
            const docType = doc.document_types && doc.document_types[0]?.document_type || 
                           (doc.document_type_id || 'unknown');
            
            // Determine content status
            let contentStatus = 'No content';
            if (doc.raw_content) contentStatus = 'Has raw_content';
            if (doc.processed_content) {
              contentStatus = 'Has processed_content';
              if (doc.raw_content) contentStatus = 'Has both contents';
            }
            
            // Format for table display
            const idCol = docId.padEnd(40).substring(0, 38);
            const typeCol = docType.padEnd(36).substring(0, 34);
            const contentCol = contentStatus.padEnd(28).substring(0, 26);
            
            console.log(`| ${idCol} | ${typeCol} | ${contentCol} |`);
          }
          console.log('--------------------------------------------------------------------------------------------------------');
        } else {
          console.log('✅ All expert_documents have corresponding sources_google entries');
        }
      }
    }
    
    // Additional check: Ensure no files with unsupported document types have needs_reprocessing status
    console.log('\nEnsuring unsupported document types are not marked as needs_reprocessing...');
    
    // First, get sources with unsupported document types
    console.log('Finding sources with unsupported document types...');
    const { data: unsupportedTypeSourcesForMismarked, error: unsupportedTypesErrorForMismarked } = await supabaseClient
      .from('google_sources')
      .select('id')
      .in('document_type_id', unsupportedDocumentTypeIds);
      
    // Second, get sources with unsupported mime types
    console.log('Finding sources with unsupported mime types...');
    const { data: unsupportedMimeSourcesForMismarked, error: unsupportedMimesErrorForMismarked } = await supabaseClient
      .from('google_sources')
      .select('id')
      .in('mime_type', unsupportedMimeTypes);
    
    // Combine source IDs from both queries
    const unsupportedSourceIds: string[] = [];
    
    if (unsupportedTypesErrorForMismarked) {
      console.error('Error fetching sources with unsupported document types:', unsupportedTypesErrorForMismarked.message);
    } else if (unsupportedTypeSourcesForMismarked && unsupportedTypeSourcesForMismarked.length > 0) {
      unsupportedSourceIds.push(...unsupportedTypeSourcesForMismarked.map(s => s.id));
    }
    
    if (unsupportedMimesErrorForMismarked) {
      console.error('Error fetching sources with unsupported mime types:', unsupportedMimesErrorForMismarked.message);
    } else if (unsupportedMimeSourcesForMismarked && unsupportedMimeSourcesForMismarked.length > 0) {
      unsupportedSourceIds.push(...unsupportedMimeSourcesForMismarked.map(s => s.id));
    }
    
    // Find expert documents with unsupported types but marked as needs_reprocessing
    const { data: mismarkedDocs, error: mismarkedDocsError } = 
      unsupportedSourceIds.length > 0 
        ? await supabaseClient
            .from('google_expert_documents')
            .select('id, source_id')
            .eq('document_processing_status', 'needs_reprocessing')
            .in('source_id', unsupportedSourceIds)
        : { data: [], error: null };
      
    if (mismarkedDocsError) {
      console.error('Error finding mismarked documents:', mismarkedDocsError.message);
    } else if (mismarkedDocs && mismarkedDocs.length > 0) {
      console.log(`Found ${mismarkedDocs.length} documents with unsupported types incorrectly marked as 'needs_reprocessing'`);
      
      // Process in batches
      for (let i = 0; i < mismarkedDocs.length; i += batchSize) {
        const batchDocs = mismarkedDocs.slice(i, i + batchSize);
        const updates = [];
        
        for (const doc of batchDocs) {
          updates.push({
            id: doc.id,
            source_id: doc.source_id,
            document_processing_status: 'skip_processing',
            document_processing_status_updated_at: new Date().toISOString(),
            processing_status: 'completed',
            processing_skip_reason: 'Unsupported document type - corrected from needs_reprocessing'
          });
        }
        
        if (!dryRun) {
          const { error: updateError } = await supabaseClient
            .from('google_expert_documents')
            .upsert(updates, { onConflict: 'id' });
            
          if (updateError) {
            console.error(`Error updating batch ${i}-${i+batchSize} of mismarked documents:`, updateError.message);
          } else {
            console.log(`✓ Corrected ${updates.length} documents from 'needs_reprocessing' to 'skip_processing'`);
          }
        } else {
          console.log(`[DRY RUN] Would correct ${updates.length} documents from 'needs_reprocessing' to 'skip_processing'`);
        }
      }
    } else {
      console.log('No documents with unsupported types are incorrectly marked as needs_reprocessing');
    }

    // MP4 FILES CHECK: Ensure no MP4 files are marked as needs_reprocessing
    console.log('\nVerifying that no MP4 files are marked as needs_reprocessing...');
    
    // Get all MP4 sources
    const { data: mp4Sources, error: mp4SourcesError } = await supabaseClient
      .from('google_sources')
      .select('id, name')
      .eq('mime_type', 'video/mp4')
      .eq('is_deleted', false);
      
    if (mp4SourcesError) {
      console.error('Error fetching MP4 sources:', mp4SourcesError.message);
    } else if (mp4Sources && mp4Sources.length > 0) {
      console.log(`Found ${mp4Sources.length} MP4 sources`);
      
      // Check which have expert_documents with needs_reprocessing status
      const { data: mp4DocsNeedingReprocessing, error: mp4DocsError } = await supabaseClient
        .from('google_expert_documents')
        .select('id, source_id')
        .in('source_id', mp4Sources.map(s => s.id))
        .eq('document_processing_status', 'needs_reprocessing');
        
      if (mp4DocsError) {
        console.error('Error checking MP4 documents:', mp4DocsError.message);
      } else if (mp4DocsNeedingReprocessing && mp4DocsNeedingReprocessing.length > 0) {
        console.log(`⚠️ Found ${mp4DocsNeedingReprocessing.length} MP4 files incorrectly marked as needs_reprocessing`);
        
        if (!dryRun) {
          // Update these documents to skip_processing
          const updates = mp4DocsNeedingReprocessing.map(doc => ({
            id: doc.id,
            source_id: doc.source_id,
            document_processing_status: 'skip_processing',
            document_processing_status_updated_at: new Date().toISOString(),
            processing_status: 'completed',
            processing_skip_reason: 'Video files should not be processed with text-based AI tools',
            updated_at: new Date().toISOString()
          }));
          
          // Process in batches
          for (let i = 0; i < updates.length; i += batchSize) {
            const batchUpdates = updates.slice(i, i + batchSize);
            const { error: updateError } = await supabaseClient
              .from('google_expert_documents')
              .upsert(batchUpdates, { onConflict: 'id' });
              
            if (updateError) {
              console.error(`Error updating MP4 documents batch ${i}-${i+batchSize}:`, updateError.message);
            } else {
              console.log(`✅ Updated ${batchUpdates.length} MP4 documents to skip_processing`);
            }
          }
        } else {
          console.log(`[DRY RUN] Would update ${mp4DocsNeedingReprocessing.length} MP4 files to skip_processing`);
        }
      } else {
        console.log('✅ No MP4 files are incorrectly marked as needs_reprocessing');
      }
    }
    
    // Update folders with document_type_id bd903d99-64a1-4297-ba76-1094ab235dac and path_depth > 0
    console.log('\nUpdating folders with document_type_id bd903d99-64a1-4297-ba76-1094ab235dac and path_depth > 0...');
    
    // First, count how many folders have the high-level document_type_id
    const { data: folderCount, error: folderCountError } = await supabaseClient
      .from('google_sources')
      .select('id', { count: 'exact' })
      .eq('document_type_id', 'bd903d99-64a1-4297-ba76-1094ab235dac')
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .eq('is_deleted', false);
    
    if (folderCountError) {
      console.error('Error counting high-level folders:', folderCountError.message);
    } else {
      console.log(`Total high-level folders found: ${folderCount?.length || 0}`);
    }
    
    // Count how many have path_depth = 0
    const { data: depthZeroCount, error: depthZeroError } = await supabaseClient
      .from('google_sources')
      .select('id', { count: 'exact' })
      .eq('document_type_id', 'bd903d99-64a1-4297-ba76-1094ab235dac')
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .eq('path_depth', 0)
      .eq('is_deleted', false);
    
    if (depthZeroError) {
      console.error('Error counting path_depth=0 folders:', depthZeroError.message);
    } else {
      console.log(`High-level folders with path_depth=0: ${depthZeroCount?.length || 0}`);
    }
    
    // Find folders matching criteria: document_type_id = bd903d99-64a1-4297-ba76-1094ab235dac and path_depth > 0
    const { data: specificFolders, error: specificFoldersError } = await supabaseClient
      .from('google_sources')
      .select('id, name, path_depth')
      .eq('document_type_id', 'bd903d99-64a1-4297-ba76-1094ab235dac')
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .gt('path_depth', 0)
      .eq('is_deleted', false);
    
    if (specificFoldersError) {
      console.error('Error fetching specific folders:', specificFoldersError.message);
    } else if (specificFolders && specificFolders.length > 0) {
      console.log(`Found ${specificFolders.length} folders with document_type_id bd903d99-64a1-4297-ba76-1094ab235dac and path_depth > 0`);
      console.log(`These folders will be converted to low-level folders (document_type_id = dd6a2cea-c74a-4c6d-8d30-eb20d2c70ddd)`);
      
      if (!dryRun) {
        // Update each folder's document_type_id
        const { error: updateFoldersError } = await supabaseClient
          .from('google_sources')
          .update({ document_type_id: 'dd6a2cea-c74a-4c6d-8d30-eb20d2c70ddd' }) // making all high level folders with a depth > 0 become a low level folder
          .in('id', specificFolders.map(folder => folder.id));
        
        if (updateFoldersError) {
          console.error('Error updating specific folders:', updateFoldersError.message);
        } else {
          console.log(`✓ Updated ${specificFolders.length} folders with document_type_id dd6a2cea-c74a-4c6d-8d30-eb20d2c70ddd`);
        }
        
        // Get corresponding expert documents
        const { data: folderExpertDocs, error: folderExpertDocsError } = await supabaseClient
          .from('google_expert_documents')
          .select('id')
          .in('source_id', specificFolders.map(folder => folder.id));
        
        if (folderExpertDocsError) {
          console.error('Error fetching expert documents for specific folders:', folderExpertDocsError.message);
        } else if (folderExpertDocs && folderExpertDocs.length > 0) {
          // Update expert_documents to match the new document type
          const { error: updateExpertDocsError } = await supabaseClient
            .from('google_expert_documents')
            .update({ document_type_id: 'dd6a2cea-c74a-4c6d-8d30-eb20d2c70ddd' })
            .in('id', folderExpertDocs.map(doc => doc.id));
          
          if (updateExpertDocsError) {
            console.error('Error updating expert documents for specific folders:', updateExpertDocsError.message);
          } else {
            console.log(`✓ Updated ${folderExpertDocs.length} expert documents for specific folders`);
          }
        }
        
        // Verify the changes were successful
        const { data: verifyFolders, error: verifyError } = await supabaseClient
          .from('google_sources')
          .select('id', { count: 'exact' })
          .eq('document_type_id', 'bd903d99-64a1-4297-ba76-1094ab235dac')
          .gt('path_depth', 0)
          .eq('mime_type', 'application/vnd.google-apps.folder')
          .eq('is_deleted', false);
        
        if (verifyError) {
          console.error('Error verifying folder updates:', verifyError.message);
        } else {
          const remainingFolders = verifyFolders?.length || 0;
          if (remainingFolders === 0) {
            console.log('✅ Verification successful: All high-level folders with path_depth > 0 were converted to low-level folders');
          } else {
            console.log(`⚠️ Verification failed: ${remainingFolders} high-level folders with path_depth > 0 still remain`);
          }
        }
      } else {
        console.log(`[DRY RUN] Would update ${specificFolders.length} folders and their expert documents to document_type_id dd6a2cea-c74a-4c6d-8d30-eb20d2c70ddd`);
      }
    } else {
      console.log('No folders found with document_type_id bd903d99-64a1-4297-ba76-1094ab235dac and path_depth > 0');
    }
    
    // FINAL VERIFICATION: Check that every non-folder sources_google file has an expert_document
    console.log('\nFINAL VERIFICATION: Checking all sources_google files have expert_documents...');
    
    // Get all non-folder, non-deleted sources_google files
    const { data: finalSourcesCheck, error: finalSourcesError } = await supabaseClient
      .from('google_sources')
      .select('id, name')
      .eq('is_deleted', false)
      .not('mime_type', 'eq', 'application/vnd.google-apps.folder');
      
    if (finalSourcesError) {
      console.error('Error fetching sources for final verification:', finalSourcesError.message);
    } else if (finalSourcesCheck && finalSourcesCheck.length > 0) {
      console.log(`Checking ${finalSourcesCheck.length} active non-folder sources`);
      
      // Get all expert_documents with source_id
      const { data: finalDocsCheck, error: finalDocsError } = await supabaseClient
        .from('google_expert_documents')
        .select('source_id');
        
      if (finalDocsError) {
        console.error('Error fetching expert documents for final verification:', finalDocsError.message);
      } else if (finalDocsCheck) {
        // Create a set of source_ids that have expert_documents
        const finalExistingSourceIds = new Set(finalDocsCheck.map(doc => doc.source_id));
        
        // Filter for sources that don't have expert_documents
        const finalSourcesWithoutDocs = finalSourcesCheck.filter(source => !finalExistingSourceIds.has(source.id));
        
        if (finalSourcesWithoutDocs.length > 0) {
          console.log(`⚠️ VERIFICATION FAILED: Found ${finalSourcesWithoutDocs.length} sources that still don't have expert_documents entries:`);
          console.log('---------------------------------------------------------------------------');
          console.log('| ID                                   | Name                             |');
          console.log('---------------------------------------------------------------------------');
          
          for (const source of finalSourcesWithoutDocs.slice(0, 10)) { // Show first 10
            const idCol = source.id.padEnd(40).substring(0, 38);
            const nameCol = (source.name || 'unknown').padEnd(34).substring(0, 32);
            console.log(`| ${idCol} | ${nameCol} |`);
          }
          
          if (finalSourcesWithoutDocs.length > 10) {
            console.log(`... and ${finalSourcesWithoutDocs.length - 10} more`);
          }
          
          console.log('---------------------------------------------------------------------------');
          console.log('Run this command again to create missing expert_documents entries');
        } else {
          console.log('✅ VERIFICATION PASSED: All active non-folder sources have corresponding expert_documents entries');
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