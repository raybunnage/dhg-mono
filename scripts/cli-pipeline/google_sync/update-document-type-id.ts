#!/usr/bin/env ts-node

/**
 * Update document_type_id without foreign key constraint
 * This command directly updates an expert_document's document_type_id field
 * bypassing the foreign key constraint check
 */
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface CommandOptions {
  expertDocId: string;
  documentTypeId: string;
  dryRun?: boolean;
}

const program = new Command();

program
  .name('update-document-type-id')
  .description('Update document_type_id field without foreign key constraint check')
  .requiredOption('-e, --expert-doc-id <id>', 'Expert document ID to update')
  .requiredOption('-d, --document-type-id <id>', 'Document type ID to set')
  .option('--dry-run', 'Show what would happen without making changes')
  .action(async (options: CommandOptions) => {
    try {
      console.log('=== Update Expert Document Document Type ID ===');
      
      // Get the Supabase client
      const supabase = SupabaseClientService.getInstance().getClient();
      
      console.log(`Expert Document ID: ${options.expertDocId}`);
      console.log(`Document Type ID: ${options.documentTypeId}`);
      
      // Check if the expert document exists
      const { data: expertDoc, error: expertDocError } = await supabase
        .from('expert_documents')
        .select('id, title, document_type_id')
        .eq('id', options.expertDocId)
        .single();
        
      if (expertDocError) {
        console.error(`L Error fetching expert document: ${expertDocError.message}`);
        process.exit(1);
      }
      
      if (!expertDoc) {
        console.error(`L Expert document with ID ${options.expertDocId} not found`);
        process.exit(1);
      }
      
      console.log(` Found expert document: ${expertDoc.title || 'No title'}`);
      console.log(`Current document_type_id: ${expertDoc.document_type_id || 'None'}`);
      
      // Check if document type exists (just for information)
      const { data: docTypeData, error: docTypeError } = await supabase
        .from('document_types')
        .select('id, name, category')
        .eq('id', options.documentTypeId)
        .single();
        
      if (docTypeError) {
        console.error(`  Error checking document type: ${docTypeError.message}`);
        console.log('This update will still proceed, but note that the document type ID may not exist.');
      } else if (docTypeData) {
        console.log(` Found document type: ${docTypeData.name}`);
        console.log(`Category: ${docTypeData.category || 'None'}`);
      } else {
        console.log(`  Document type with ID ${options.documentTypeId} not found`);
        console.log('This update will still proceed, but note that the document type ID does not exist.');
      }
      
      if (options.dryRun) {
        console.log('\n= DRY RUN: Would update expert document with the following:');
        console.log(`- document_type_id: ${options.documentTypeId}`);
        console.log('No changes have been made.');
        return;
      }
      
      console.log('\nUpdating expert document...');
      
      // First approach: Try direct update with SQL query
      try {
        const { data: directUpdate, error: directUpdateError } = await supabase.rpc(
          'execute_sql',
          {
            sql: `
              UPDATE expert_documents 
              SET document_type_id = '${options.documentTypeId}', 
                  updated_at = NOW() 
              WHERE id = '${options.expertDocId}';
            `
          }
        );
        
        if (directUpdateError) {
          console.error(`L Error with direct SQL update: ${directUpdateError.message}`);
          console.log('Trying alternative approach...');
          
          // Try disabling triggers as fallback
          const { data: disableTriggers, error: disableTriggersError } = await supabase.rpc(
            'execute_sql',
            {
              sql: `
                ALTER TABLE expert_documents DISABLE TRIGGER ALL;
                UPDATE expert_documents 
                SET document_type_id = '${options.documentTypeId}', 
                    updated_at = NOW() 
                WHERE id = '${options.expertDocId}';
                ALTER TABLE expert_documents ENABLE TRIGGER ALL;
              `
            }
          );
          
          if (disableTriggersError) {
            console.error(`L Error with trigger disabling approach: ${disableTriggersError.message}`);
            console.error('Update failed.');
            process.exit(1);
          } else {
            console.log(' Successfully updated by disabling triggers');
          }
        } else {
          console.log(' Successfully updated using direct SQL query');
        }
      } catch (error) {
        console.error(`L Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
      
      // Verify the update
      const { data: verifyData, error: verifyError } = await supabase
        .from('expert_documents')
        .select('id, document_type_id')
        .eq('id', options.expertDocId)
        .single();
        
      if (verifyError) {
        console.error(`L Error verifying update: ${verifyError.message}`);
      } else if (verifyData) {
        if (verifyData.document_type_id === options.documentTypeId) {
          console.log(' Verification successful: document_type_id has been updated');
        } else {
          console.error(`L Verification failed: document_type_id is ${verifyData.document_type_id}`);
        }
      }
      
    } catch (error) {
      console.error(`L Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Run the command if this script is executed directly
if (require.main === module) {
  program.parse(process.argv);
}

export default program;