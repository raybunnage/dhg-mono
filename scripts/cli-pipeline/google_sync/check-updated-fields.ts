#!/usr/bin/env ts-node
/**
 * Script to check if expert_documents fields are properly updated by reprocess-docx-files
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkDocument() {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get sources_google record for DR.Dantzer.IL-6.docx
    const { data: sourceData, error: sourceError } = await supabase
      .from('sources_google')
      .select('id, name, document_type_id')
      .ilike('name', 'DR.Dantzer.IL-6.docx')
      .limit(1);
      
    if (sourceError) {
      console.error('Error fetching source:', sourceError.message);
      return;
    }
    
    if (!sourceData || sourceData.length === 0) {
      console.log('No source found for DR.Dantzer.IL-6.docx');
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
    console.log('Classification Reasoning:', expertDoc[0].classification_reasoning ? 
      expertDoc[0].classification_reasoning.substring(0, 100) + '...' : 'none');
    console.log('Key Insights:', expertDoc[0].key_insights);
  } catch (error) {
    console.error('Error checking document:', error);
  }
}

checkDocument();