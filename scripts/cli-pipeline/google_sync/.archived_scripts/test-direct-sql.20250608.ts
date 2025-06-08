#!/usr/bin/env ts-node
/**
 * Test direct SQL query to verify fields updated by our command
 */
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const sourceId = 'dcaff914-0db1-464b-b614-7ffbac9f9b51';

async function checkUpdates() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Execute the query
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT 
        e.document_type_id,
        e.classification_metadata,
        e.updated_at
      FROM 
        expert_documents e
      WHERE 
        e.source_id = '${sourceId}'
    `
  });
  
  if (error) {
    console.error(`❌ Error executing query: ${error.message}`);
    return;
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    console.error(`❌ No results found for source ID: ${sourceId}`);
    return;
  }

  const result = data[0];
  
  console.log('=== Expert Document Update Check ===\n');
  console.log(`Document Type ID: ${result.document_type_id || 'NULL'}`);
  console.log(`Updated At: ${result.updated_at}`);
  
  if (result.classification_metadata) {
    console.log('\nClassification Metadata:');
    console.log('- classifier:', result.classification_metadata.classifier);
    console.log('- model:', result.classification_metadata.model);
    console.log('- classifiedAt:', result.classification_metadata.classifiedAt);
    console.log('- category:', result.classification_metadata.category);
    console.log('- suggestedTitle:', result.classification_metadata.suggestedTitle);
    
    if (result.classification_metadata.concepts && result.classification_metadata.concepts.length > 0) {
      console.log('\nConcepts:');
      result.classification_metadata.concepts.slice(0, 3).forEach((concept, index) => {
        console.log(`  ${index+1}. ${concept.name} (weight: ${concept.weight})`);
      });
      console.log(`  ... and ${result.classification_metadata.concepts.length - 3} more`);
    }
  }
}

checkUpdates().catch(error => {
  console.error('Error:', error);
});