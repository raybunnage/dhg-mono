#!/usr/bin/env ts-node
/**
 * Find documents with content that can be used for classification
 */
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const program = new Command();

interface CommandOptions {
  limit?: number;
  verbose?: boolean;
}

program
  .name('find-documents-with-content')
  .description('Find documents with content that can be used for classification')
  .option('-l, --limit <number>', 'Limit the number of documents to find')
  .option('-v, --verbose', 'Show verbose output including content preview')
  .action(async (options: CommandOptions) => {
    try {
      console.log('=== Find Documents With Content ===');
      
      // Get the Supabase client using the singleton pattern
      const supabase = SupabaseClientService.getInstance().getClient();
      
      // Use the proper limit
      const limit = options.limit ? parseInt(options.limit.toString(), 10) : 5;
      
      console.log(`Searching for documents with content (limit: ${limit})...`);
      
      // Query for documents with raw_content not null
      const { data, error } = await supabase
        .from('google_expert_documents')
        .select('id, title, source_id, raw_content, document_type_id')
        .not('raw_content', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(limit);
        
      if (error) {
        console.error('❌ Error fetching documents:', error.message);
        process.exit(1);
      }
      
      if (!data || data.length === 0) {
        console.log('❌ No documents with content found.');
        process.exit(0);
      }
      
      console.log(`\n✅ Found ${data.length} documents with content:\n`);
      
      for (const doc of data) {
        console.log(`Document ID: ${doc.id}`);
        console.log(`Source ID: ${doc.source_id}`);
        console.log(`Title: ${doc.title}`);
        console.log(`Document Type ID: ${doc.document_type_id || 'Not set'}`);
        console.log(`Content length: ${doc.raw_content.length} characters`);
        
        if (options.verbose) {
          const contentPreview = doc.raw_content.substring(0, 150).replace(/\n/g, ' ');
          console.log(`Content preview: ${contentPreview}...`);
        }
        
        console.log('-'.repeat(50));
      }
      
      console.log('\nTo classify a document, use:');
      console.log(`ts-node scripts/cli-pipeline/google_sync/force-classify-docs.ts --id <source_id> [--dry-run]`);
      console.log('\nExample:');
      console.log(`ts-node scripts/cli-pipeline/google_sync/force-classify-docs.ts --id ${data[0].source_id} --dry-run`);
      
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