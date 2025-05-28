#!/usr/bin/env ts-node
/**
 * Script to check if concepts were properly saved to doc_concepts table
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkConcepts() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get sources_google record for "Impact activites.docx"
    const { data: sourceData, error: sourceError } = await supabase
      .from('google_sources')
      .select('id, name, document_type_id')
      .ilike('name', 'Impact activites.docx')
      .limit(1);
      
    if (sourceError) {
      console.error('Error fetching source:', sourceError.message);
      return;
    }
    
    if (!sourceData || sourceData.length === 0) {
      console.log('No source found for "Impact activites.docx"');
      return;
    }
    
    const sourceId = sourceData[0].id;
    console.log('Source:', JSON.stringify(sourceData[0], null, 2));
    
    // Get expert_document record
    const { data: expertDoc, error: expertError } = await supabase
      .from('expert_documents')
      .select('id, title, reprocessing_status, classification_confidence, classification_reasoning, key_insights')
      .eq('source_id', sourceId)
      .limit(1);
      
    if (expertError) {
      console.error('Error fetching expert document:', expertError.message);
      return;
    }
    
    if (!expertDoc || expertDoc.length === 0) {
      console.log('No expert document found for source ID:', sourceId);
      return;
    }
    
    console.log('Expert Document:');
    console.log('ID:', expertDoc[0].id);
    console.log('Title:', expertDoc[0].title);
    console.log('Processing Status:', expertDoc[0].reprocessing_status);
    console.log('Classification Confidence:', expertDoc[0].classification_confidence);
    console.log('Key Insights:', expertDoc[0].key_insights);
    
    // Get doc_concepts records
    const { data: concepts, error: conceptsError } = await supabase
      .from('doc_concepts')
      .select('id, concept, weight')
      .eq('document_id', expertDoc[0].id)
      .order('weight', { ascending: false });
      
    if (conceptsError) {
      console.error('Error fetching concepts:', conceptsError.message);
      return;
    }
    
    console.log('\nDocument Concepts from doc_concepts table:');
    if (!concepts || concepts.length === 0) {
      console.log('No concepts found in doc_concepts table for this document');
    } else {
      console.log(`Found ${concepts.length} concepts:`);
      concepts.forEach((concept, index) => {
        console.log(`  ${index+1}. ${concept.concept} (Weight: ${concept.weight})`);
      });
    }
  } catch (error) {
    console.error('Error checking concepts:', error);
  }
}

checkConcepts();