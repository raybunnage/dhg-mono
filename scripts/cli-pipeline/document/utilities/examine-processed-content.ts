#!/usr/bin/env ts-node
/**
 * Script to examine processed_content in expert_documents
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

async function examineProcessedContent() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get documents with processed_content
  const { data, error } = await supabase
    .from('expert_documents')
    .select('id, document_processing_status, source_id, processed_content')
    .not('processed_content', 'is', null)
    .limit(5);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('No documents found with processed_content');
    return;
  }
  
  console.log(`Found ${data.length} documents with processed_content`);
  
  for (const doc of data) {
    console.log(`\nDocument ${doc.id}:`);
    console.log(`- Status: ${doc.document_processing_status}`);
    console.log(`- Source ID: ${doc.source_id}`);
    
    const content = doc.processed_content;
    console.log(`- Content type: ${typeof content}`);
    
    // Check object structure
    if (typeof content === 'object') {
      console.log('- Content keys:');
      for (const key in content) {
        const value = content[key];
        const valuePreview = typeof value === 'string' 
          ? value.substring(0, 50) + (value.length > 50 ? '...' : '')
          : value;
        console.log(`  * ${key}: (${typeof value}) ${valuePreview}`);
      }
    } else {
      console.log(`- Content: ${String(content).substring(0, 100)}...`);
    }
    
    console.log('-----------------------------------');
  }
}

// Run the function
examineProcessedContent()
  .catch(error => {
    console.error('Error:', error);
  });