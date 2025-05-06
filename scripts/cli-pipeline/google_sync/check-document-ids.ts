#!/usr/bin/env ts-node
/**
 * Check document_type_id in both sources_google and expert_documents tables
 */
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const program = new Command();

program
  .name('check-document-ids')
  .description('Check document_type_id in both sources_google and expert_documents tables')
  .option('-s, --source-id <id>', 'Source ID to check')
  .action(async (options) => {
    try {
      // Validate required parameters
      const sourceId = options.sourceId;
      if (!sourceId) {
        console.error('❌ Error: source-id parameter is required');
        process.exit(1);
      }

      // Get Supabase client
      const supabase = SupabaseClientService.getInstance().getClient();
      
      // Execute the query
      const { data, error } = await supabase.rpc('execute_sql', {
        sql: `
          SELECT 
            s.id AS source_id, 
            s.name AS source_name, 
            s.document_type_id AS source_document_type_id, 
            e.id AS expert_doc_id,
            e.document_type_id AS expert_document_type_id,
            dt1.name AS source_type_name,
            dt1.category AS source_type_category,
            dt2.name AS expert_type_name,
            dt2.category AS expert_type_category
          FROM 
            sources_google s
          LEFT JOIN 
            expert_documents e ON s.id = e.source_id
          LEFT JOIN
            document_types dt1 ON s.document_type_id = dt1.id
          LEFT JOIN
            document_types dt2 ON e.document_type_id = dt2.id
          WHERE 
            s.id = '${sourceId}'
        `
      });
      
      if (error) {
        console.error(`❌ Error executing query: ${error.message}`);
        process.exit(1);
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        console.error(`❌ No results found for source ID: ${options.sourceId}`);
        process.exit(1);
      }

      const result = data[0];
      
      console.log('=== Document Type ID Check ===\n');
      console.log(`Source ID: ${result.source_id}`);
      console.log(`Source Name: ${result.source_name}`);
      console.log('\nDocument Type IDs:');
      console.log(`- sources_google.document_type_id: ${result.source_document_type_id || 'NULL'}`);
      console.log(`  Type Name: ${result.source_type_name || 'N/A'}`);
      console.log(`  Category: ${result.source_type_category || 'N/A'}`);
      console.log(`\n- expert_documents.document_type_id: ${result.expert_document_type_id || 'NULL'}`);
      console.log(`  Type Name: ${result.expert_type_name || 'N/A'}`);
      console.log(`  Category: ${result.expert_type_category || 'N/A'}`);
      
      if (result.source_document_type_id === result.expert_document_type_id) {
        console.log('\n✅ MATCH: Both tables have the same document_type_id');
      } else {
        console.log('\n⚠️ MISMATCH: Tables have different document_type_id values');
      }
      
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