#!/usr/bin/env ts-node
/**
 * Script to reset document_processing_status to 'needs_reprocessing'
 * This will prepare documents for the reclassify-docs command
 */

import { SupabaseClientService } from '../packages/shared/services/supabase-client';

async function resetDocuments() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Finding documents to reset...');
  
  // First, get some files of each type (limit to 2 for testing)
  const { data: sources } = await supabase
    .from('sources_google')
    .select('id, name, mime_type')
    .or('mime_type.eq.application/pdf,mime_type.eq.application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    .is('is_deleted', false)
    .limit(2);
  
  if (!sources || sources.length === 0) {
    console.log('No suitable sources found');
    return;
  }
  
  console.log(`Found ${sources.length} sources to process`);
  
  let resetCount = 0;
  
  // Process each source
  for (const source of sources) {
    console.log(`Processing ${source.name}`);
    
    // Clear the document_type_id to make sure it's picked up
    const { error: clearError } = await supabase
      .from('sources_google')
      .update({ document_type_id: null })
      .eq('id', source.id);
    
    if (clearError) {
      console.error(`Error clearing document_type_id: ${clearError.message}`);
      continue;
    }
    
    // Check for existing expert document
    const { data: expertDocs } = await supabase
      .from('expert_documents')
      .select('id')
      .eq('source_id', source.id);
    
    if (expertDocs && expertDocs.length > 0) {
      // Update existing document
      const { error: updateError } = await supabase
        .from('expert_documents')
        .update({ 
          document_processing_status: 'needs_reprocessing',
          document_processing_status_updated_at: new Date().toISOString()
        })
        .eq('id', expertDocs[0].id);
      
      if (updateError) {
        console.error(`Error updating document ${expertDocs[0].id}: ${updateError.message}`);
      } else {
        console.log(`✅ Reset document ${expertDocs[0].id} to needs_reprocessing`);
        resetCount++;
      }
    } else {
      // Create new expert document
      const docType = source.mime_type.includes('pdf') ? 
        '2f5af574-9053-49b1-908d-c35001ce9680' : // Json pdf summary
        '1f71f894-d2f8-415e-80c1-a4d6db4d8b18';  // Json document summary
      
      const { error: insertError } = await supabase
        .from('expert_documents')
        .insert({
          source_id: source.id,
          document_type_id: docType,
          document_processing_status: 'needs_reprocessing',
          document_processing_status_updated_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error(`Error creating document: ${insertError.message}`);
      } else {
        console.log(`✅ Created new document for ${source.name} with needs_reprocessing`);
        resetCount++;
      }
    }
  }
  
  console.log(`\nReset ${resetCount} documents to needs_reprocessing status`);
  console.log('\nNow run:');
  console.log('./scripts/cli-pipeline/google_sync/google-sync-cli.sh reclassify-docs --limit 5');
}

// Run the function
resetDocuments()
  .catch(error => {
    console.error('Error:', error);
  });