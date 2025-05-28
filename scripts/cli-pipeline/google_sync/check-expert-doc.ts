#!/usr/bin/env ts-node
/**
 * Small script to check the most recent expert document
 * and verify content extraction worked properly
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkLatestExpertDocument() {
  try {
    // Get Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    console.log('Querying the most recently created expert_document...');
    
    // Query the most recent expert_document - simple version
    const { data, error } = await supabase
      .from('google_expert_documents')
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
    
    // Fetch all columns to check processed_content
    const { data: fullData, error: fullError } = await supabase
      .from('google_expert_documents')
      .select('*')
      .eq('id', doc.id)
      .single();
    
    if (fullError) {
      console.error('Error fetching full document data:', fullError);
    } else if (fullData) {
      console.log('\nFull Document Check:');
      console.log('-'.repeat(50));
      
      // Check all JSON fields
      const jsonFields = ['processed_content', 'classification_metadata', 'ai_analysis', 'processing_stats', 'structure'];
      
      for (const field of jsonFields) {
        if (fullData[field]) {
          console.log(`${field}: Present (${typeof fullData[field]})`);
          try {
            if (typeof fullData[field] === 'object') {
              console.log(`  Keys: ${Object.keys(fullData[field]).join(', ')}`);
              
              // Show a snippet of a few fields for debugging
              if (field === 'processed_content' || field === 'classification_metadata') {
                console.log('  Sample properties:');
                const obj = fullData[field];
                if (obj.document_type) console.log(`    document_type: ${obj.document_type}`);
                if (obj.document_type_id) console.log(`    document_type_id: ${obj.document_type_id}`);
                if (obj.classification_confidence) console.log(`    classification_confidence: ${obj.classification_confidence}`);
              }
            } else if (typeof fullData[field] === 'string') {
              try {
                // Try to parse it in case it's a JSON string
                const parsed = JSON.parse(fullData[field]);
                console.log(`  Parsed JSON string, keys: ${Object.keys(parsed).join(', ')}`);
              } catch (parseError: any) {
                // Just a regular string, show preview
                const preview = fullData[field].substring(0, 50) + (fullData[field].length > 50 ? '...' : '');
                console.log(`  Content: "${preview}"`);
              }
            }
          } catch (err: any) {
            console.log(`  Error examining field: ${err.message}`);
          }
        } else {
          console.log(`${field}: NOT PRESENT (null or undefined)`);
        }
      }
    }
    
    // Get source name in a separate query
    const { data: sourceData } = await supabase
      .from('google_sources')
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