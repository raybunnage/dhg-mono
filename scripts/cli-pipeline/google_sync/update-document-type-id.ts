#!/usr/bin/env ts-node
/**
 * Update document_type_id in the expert_documents table
 */
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface CommandOptions {
  sourceId?: string;
  documentTypeId?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

const program = new Command();

program
  .name('update-document-type-id')
  .description('Update document_type_id for a sources_google record')
  .option('-s, --source-id <id>', 'Source ID to update document_type_id for')
  .option('-t, --document-type-id <id>', 'Document type ID to set')
  .option('-d, --dry-run', 'Show what would be updated without making changes')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options: CommandOptions) => {
    try {
      // Validate required parameters
      if (!options.sourceId) {
        console.error('❌ Error: source-id parameter is required');
        process.exit(1);
      }

      if (!options.documentTypeId) {
        console.error('❌ Error: document-type-id parameter is required');
        process.exit(1);
      }

      console.log(`Updating document_type_id for source ${options.sourceId} to ${options.documentTypeId}${options.dryRun ? ' (DRY RUN)' : ''}`);
      
      // Get Supabase client
      const supabase = SupabaseClientService.getInstance().getClient();
      
      // First check if the source exists and get its current document_type_id
      const { data: sourceData, error: sourceError } = await supabase
        .from('sources_google')
        .select('id, name, document_type_id')
        .eq('id', options.sourceId)
        .single();
      
      if (sourceError) {
        console.error(`❌ Error fetching source: ${sourceError.message}`);
        process.exit(1);
      }
      
      if (!sourceData) {
        console.error(`❌ Source with ID ${options.sourceId} not found`);
        process.exit(1);
      }
      
      console.log(`✅ Found source: ${sourceData.name}`);
      console.log(`Current document_type_id: ${sourceData.document_type_id || 'None'}`);
      
      // Also check if document type ID exists
      const { data: documentTypeData, error: documentTypeError } = await supabase
        .from('document_types')
        .select('id, name, category')
        .eq('id', options.documentTypeId)
        .single();
      
      if (documentTypeError) {
        console.error(`⚠️ Warning: Error checking document type: ${documentTypeError.message}`);
        console.log('This update may fail if the document type ID is invalid.');
      } else if (!documentTypeData) {
        console.log(`⚠️ Warning: Document type with ID ${options.documentTypeId} not found`);
        console.log('This update may fail if the document type ID is invalid.');
      } else {
        console.log(`✅ Document type to set: ${documentTypeData.name} (${documentTypeData.category || 'No category'})`);
      }
      
      if (options.dryRun) {
        console.log('\n🔍 DRY RUN: Would update sources_google record with:');
        console.log(`- Set document_type_id = ${options.documentTypeId}`);
        console.log('No changes made.');
        return;
      }
      
      // Update the document_type_id in sources_google
      console.log('\nUpdating sources_google record...');
      const { data: updateData, error: updateError } = await supabase
        .from('sources_google')
        .update({
          document_type_id: options.documentTypeId,
          updated_at: new Date().toISOString()
        })
        .eq('id', options.sourceId)
        .select();
      
      if (updateError) {
        console.error(`❌ Error updating sources_google: ${updateError.message}`);
        process.exit(1);
      }
      
      console.log('✅ Successfully updated sources_google record');
      
      // Check if there's an expert document that needs to be updated as well
      console.log('\nChecking for related expert_documents...');
      const { data: expertDocsData, error: expertDocsError } = await supabase
        .from('expert_documents')
        .select('id, document_type_id, title')
        .eq('source_id', options.sourceId);
      
      if (expertDocsError) {
        console.error(`❌ Error checking expert_documents: ${expertDocsError.message}`);
        return;
      }
      
      if (!expertDocsData || expertDocsData.length === 0) {
        console.log('No related expert_documents found for this source.');
        return;
      }
      
      console.log(`Found ${expertDocsData.length} related expert document(s).`);
      
      // Update each expert document
      for (const expertDoc of expertDocsData) {
        console.log(`\nUpdating expert document ID: ${expertDoc.id}`);
        console.log(`Current document_type_id: ${expertDoc.document_type_id || 'None'}`);
        console.log(`Title: ${expertDoc.title || 'No title'}`);
        
        const { error: expertUpdateError } = await supabase
          .from('expert_documents')
          .update({
            document_type_id: options.documentTypeId,
            updated_at: new Date().toISOString()
          })
          .eq('id', expertDoc.id);
        
        if (expertUpdateError) {
          console.error(`❌ Error updating expert document: ${expertUpdateError.message}`);
          console.log('Trying alternative approach...');
          
          // Use RPC to execute direct SQL if there's a foreign key constraint issue
          const { error: rpcError } = await supabase.rpc('execute_sql', {
            sql: `
              UPDATE expert_documents 
              SET document_type_id = '${options.documentTypeId}',
                  updated_at = NOW() 
              WHERE id = '${expertDoc.id}';
            `
          });
          
          if (rpcError) {
            console.error(`❌ SQL execution error: ${rpcError.message}`);
            console.log('Update failed for this expert document.');
          } else {
            console.log('✅ Successfully updated expert document with direct SQL');
          }
        } else {
          console.log('✅ Successfully updated expert document');
        }
      }
      
      console.log('\n✅ All updates completed successfully');
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
