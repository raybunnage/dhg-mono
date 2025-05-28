#!/usr/bin/env ts-node
/**
 * Check concepts for a document
 */
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const program = new Command();

interface CommandOptions {
  id?: string;
}

program
  .name('check-concepts')
  .description('Check concepts for a document')
  .option('-i, --id <id>', 'Source ID to check concepts for')
  .action(async (options: CommandOptions) => {
    try {
      console.log('=== Check Document Concepts ===');
      
      // Check if an ID was provided
      if (!options.id) {
        console.error('❌ No source ID provided. Use --id <source-id>');
        process.exit(1);
      }
      
      // Get the Supabase client using the singleton pattern
      const supabase = SupabaseClientService.getInstance().getClient();
      
      console.log(`Looking for source with ID: ${options.id}`);
      
      // First, find the expert document for this source
      const { data: expertDocs, error: expertDocsError } = await supabase
        .from('expert_documents')
        .select('id, title, classification_confidence, document_type_id')
        .eq('source_id', options.id)
        .limit(1);
        
      if (expertDocsError) {
        console.error('❌ Error fetching expert document:', expertDocsError.message);
        process.exit(1);
      }
      
      if (!expertDocs || expertDocs.length === 0) {
        console.error('❌ No expert document found for source ID:', options.id);
        process.exit(1);
      }
      
      const expertDoc = expertDocs[0];
      console.log(`\n✅ Found expert document: ${expertDoc.id}`);
      console.log(`Title: ${expertDoc.title}`);
      console.log(`Classification Confidence: ${expertDoc.classification_confidence}`);
      
      // Get the document type name
      if (expertDoc.document_type_id) {
        const { data: docTypeData, error: docTypeError } = await supabase
          .from('document_types')
          .select('name, category')
          .eq('id', expertDoc.document_type_id)
          .limit(1);
          
        if (!docTypeError && docTypeData && docTypeData.length > 0) {
          console.log(`Document Type: ${docTypeData[0].name}`);
          console.log(`Category: ${docTypeData[0].category}`);
        } else {
          console.log(`Document Type ID: ${expertDoc.document_type_id}`);
        }
      } else {
        console.log('Document Type: Not set');
      }
      
      // Now get the concepts for this document
      const { data: concepts, error: conceptsError } = await supabase
        .from('doc_concepts')
        .select('*')
        .eq('document_id', expertDoc.id)
        .order('weight', { ascending: false });
        
      if (conceptsError) {
        console.error('❌ Error fetching concepts:', conceptsError.message);
        process.exit(1);
      }
      
      if (!concepts || concepts.length === 0) {
        console.log('\n⚠️ No concepts found for this document');
        process.exit(0);
      }
      
      console.log(`\n✅ Found ${concepts.length} concepts:`);
      console.log('\n┌───┬─────────────────────────────────────────┬─────────┐');
      console.log('│ # │ Concept                                 │ Weight  │');
      console.log('├───┼─────────────────────────────────────────┼─────────┤');
      
      concepts.forEach((concept, index) => {
        const num = (index + 1).toString().padEnd(3);
        const conceptName = concept.concept.padEnd(39);
        const weight = concept.weight.toFixed(2).padStart(7);
        console.log(`│ ${num}│ ${conceptName}│ ${weight} │`);
      });
      
      console.log('└───┴─────────────────────────────────────────┴─────────┘');
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Run the command if this script is executed directly
if (require.main === module) {
  program.parse(process.argv);
}

export default program;