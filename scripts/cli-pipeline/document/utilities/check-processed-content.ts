#!/usr/bin/env ts-node
/**
 * Script to check if expert documents have processed_content
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

async function checkProcessedContent() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Our specific document IDs from the reclassification run
  const docIds = [
    '57fba63b-7c4a-436d-9aa8-01d39ea2e880',  // Hanscom.Clawson.docx
    '6956165d-7086-4adc-a606-c063d28ace90'   // Carter.Stress.SexDiff.May 2021.#2.pdf
  ];
  
  console.log("=== CHECKING BY DOCUMENT IDs ===");
  
  for (const docId of docIds) {
    const { data, error } = await supabase
      .from('expert_documents')
      .select('id, document_processing_status, source_id, processed_content')
      .eq('id', docId)
      .limit(1);
    
    if (error) {
      console.error(`Error for ${docId}:`, error);
      continue;
    }
    
    if (data && data.length > 0) {
      console.log(`Document ${docId}:`);
      console.log(`- Status: ${data[0].document_processing_status}`);
      console.log(`- Source ID: ${data[0].source_id}`);
      console.log(`- Processed content: ${data[0].processed_content ? 'EXISTS' : 'NULL'}`);
      if (data[0].processed_content) {
        console.log(`- Content type: ${typeof data[0].processed_content}`);
        console.log(`- Content structure: ${JSON.stringify(data[0].processed_content).substring(0, 300)}...`);
      }
      console.log('-----------------------------------');
    } else {
      console.log(`No document found for ID: ${docId}`);
    }
  }
  
  // Add additional check by source IDs
  const sourceIds = [
    '4b25fb85-e5be-404b-ab96-cdc219d5a322',  // Hanscom.Clawson.docx
    '08b36fdc-a3b0-4789-942b-2dbb5624c1e4'   // Carter.Stress.SexDiff.May 2021.#2.pdf
  ];
  
  console.log("\n=== CHECKING BY SOURCE IDs ===");
  
  for (const sourceId of sourceIds) {
    // Get source info
    const { data: sources, error: sourceError } = await supabase
      .from('google_sources')
      .select('id, name, mime_type')
      .eq('id', sourceId)
      .limit(1);
    
    if (sourceError) {
      console.error(`Error for source ${sourceId}:`, sourceError);
      continue;
    }
    
    if (!sources || sources.length === 0) {
      console.log(`No source found for ID: ${sourceId}`);
      continue;
    }
    
    const source = sources[0];
    console.log(`Source ${sourceId}:`);
    console.log(`- Name: ${source.name}`);
    console.log(`- MIME Type: ${source.mime_type}`);
    
    // Get expert document
    const { data: docs, error: docError } = await supabase
      .from('expert_documents')
      .select('id, document_processing_status, document_type_id, processed_content')
      .eq('source_id', sourceId)
      .limit(1);
    
    if (docError) {
      console.error(`Error for expert document with source ${sourceId}:`, docError);
      continue;
    }
    
    if (!docs || docs.length === 0) {
      console.log(`No expert document found for source: ${sourceId}`);
      continue;
    }
    
    const doc = docs[0];
    console.log(`Expert Document ${doc.id}:`);
    console.log(`- Status: ${doc.document_processing_status}`);
    console.log(`- Document Type ID: ${doc.document_type_id}`);
    console.log(`- Processed Content: ${doc.processed_content ? 'EXISTS' : 'NULL'}`);
    
    if (doc.processed_content) {
      const type = typeof doc.processed_content;
      console.log(`- Content Type: ${type}`);
      
      if (type === 'object') {
        console.log(`- Content Keys: ${Object.keys(doc.processed_content).join(', ')}`);
      } else {
        const preview = String(doc.processed_content).substring(0, 50) + '...';
        console.log(`- Content Preview: ${preview}`);
      }
    }
    
    console.log('-----------------------------------');
  }
}

// Run the function
checkProcessedContent()
  .catch(error => {
    console.error('Error:', error);
  });