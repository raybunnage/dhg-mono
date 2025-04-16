#!/usr/bin/env ts-node
/**
 * Small script to check the most recent expert document
 * and verify content extraction worked properly
 */

import { SupabaseClientService } from './packages/shared/services/supabase-client';

async function checkLatestExpertDocument() {
  try {
    // Get Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    console.log('Querying the most recently created expert_document...');
    
    // Query the most recent expert_document - simple version
    const { data, error } = await supabase
      .from('expert_documents')
      .select('id, source_id, created_at, updated_at, raw_content, document_type_id')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error querying expert_documents:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No expert documents found');
      return;
    }
    
    const doc = data[0];
    
    console.log('\nLatest Expert Document:');
    console.log('-'.repeat(50));
    console.log(`ID: ${doc.id}`);
    console.log(`Source ID: ${doc.source_id}`);
    console.log(`Document Type ID: ${doc.document_type_id}`);
    console.log(`Created At: ${doc.created_at}`);
    console.log(`Updated At: ${doc.updated_at}`);
    
    // Check if raw_content exists and is not null
    if (doc.raw_content) {
      console.log(`Raw Content: Present (Length: ${doc.raw_content.length} characters)`);
      // Log a small preview of the content if it exists
      if (doc.raw_content.length > 0) {
        const preview = doc.raw_content.substring(0, 150) + (doc.raw_content.length > 150 ? '...' : '');
        console.log(`Content Preview: \n"${preview}"`);
      }
    } else {
      console.log('Raw Content: NOT PRESENT (null or empty)');
    }
    
    // Get source name in a separate query
    const { data: sourceData } = await supabase
      .from('sources_google')
      .select('name')
      .eq('id', doc.source_id)
      .single();
      
    if (sourceData) {
      console.log(`Source Name: ${sourceData.name}`);
    }
    
    // Get document type in a separate query
    const { data: typeData } = await supabase
      .from('document_types')
      .select('document_type')
      .eq('id', doc.document_type_id)
      .single();
      
    if (typeData) {
      console.log(`Document Type: ${typeData.document_type}`);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the check
checkLatestExpertDocument();