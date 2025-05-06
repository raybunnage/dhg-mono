#!/usr/bin/env ts-node
/**
 * Force-classify documents with prompt service
 * This command retrieves the document-classification-prompt-new and displays information about it
 */
import { Command } from 'commander';
import { promptService } from '../../../packages/shared/services/prompt-service';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';

interface CommandOptions {
  id?: string;
  verbose?: boolean;
  dryRun?: boolean;
}

interface ClassificationResult {
  generalCategory: string;
  specificDocumentType: string;
  keyConcepts: string[];
  confidence: number;
  reasoning: string;
}

const program = new Command();

program
  .name('force-classify-docs')
  .description('Force classify documents using the document-classification-prompt-new')
  .option('-i, --id <id>', 'Source ID to force classify')
  .option('-v, --verbose', 'Show verbose output')
  .option('--dry-run', 'Run classification but do not update database')
  .action(async (options: CommandOptions) => {
    try {
      console.log('=== Force Classify Documents ===');
      console.log('Retrieving document-classification-prompt-new...');

      // Retrieve the prompt with all related data
      const promptResult = await promptService.loadPrompt('document-classification-prompt-new', {
        includeDatabaseQueries: true,
        includeRelationships: true,
        includeRelatedFiles: true,
        executeQueries: true
      });

      if (!promptResult.prompt) {
        console.error('❌ Failed to retrieve prompt "document-classification-prompt-new"');
        process.exit(1);
      }

      console.log('\n✅ Successfully retrieved prompt:', promptResult.prompt.name);
      console.log('Prompt ID:', promptResult.prompt.id);
      console.log('Description:', promptResult.prompt.description);
      
      // Display a sample of the prompt content
      const contentPreview = promptResult.prompt.content.slice(0, 500);
      console.log('\nPrompt content preview:');
      console.log('---------------------------------');
      console.log(contentPreview + '...');
      console.log('---------------------------------');

      // Display database query results as requested
      if (promptResult.databaseQueries.length > 0) {
        console.log('\nDatabase Queries Results:');
        console.log('---------------------------------');
        
        // Show the first 3 records from the first 2 queries (if available)
        const queriesToShow = Math.min(2, promptResult.databaseQueries.length);
        
        for (let i = 0; i < queriesToShow; i++) {
          const query = promptResult.databaseQueries[i];
          console.log(`\nQuery ${i+1}: ${query.queryText}`);
          
          if (query.queryResults && Array.isArray(query.queryResults) && query.queryResults.length > 0) {
            const recordsToShow = Math.min(3, query.queryResults.length);
            console.log(`Results (showing ${recordsToShow} of ${query.queryResults.length}):`);
            
            for (let j = 0; j < recordsToShow; j++) {
              console.log(`Record ${j+1}:`, JSON.stringify(query.queryResults[j], null, 2));
            }
          } else {
            console.log('No results returned for this query');
          }
        }
        console.log('---------------------------------');
      } else {
        console.log('\nNo database queries were found in the prompt metadata');
      }
      
      // If an ID was provided, fetch the document and prepare for classification
      if (options.id) {
        console.log(`\nSource ID provided: ${options.id}`);
        
        // Get the Supabase client
        const supabase = SupabaseClientService.getInstance().getClient();
        
        console.log('Fetching document information...');
        
        // First, check if the document exists in sources_google
        const { data: sourceData, error: sourceError } = await supabase
          .from('sources_google')
          .select(`
            id,
            name,
            mime_type,
            drive_id,
            expert_documents(id, title, document_type_id)
          `)
          .eq('id', options.id)
          .limit(1);
        
        if (sourceError) {
          console.error('❌ Error fetching source data:', sourceError.message);
          process.exit(1);
        }
        
        if (!sourceData || sourceData.length === 0) {
          console.error(`❌ Source with ID ${options.id} not found in the database`);
          process.exit(1);
        }
        
        const source = sourceData[0];
        console.log('✅ Found source:', source.name);
        console.log('MIME Type:', source.mime_type);
        
        // Check if there's an expert document
        if (source.expert_documents && source.expert_documents.length > 0) {
          const expertDoc = source.expert_documents[0];
          console.log('\n✅ Found existing expert document with ID:', expertDoc.id);
          
          // Get the document type if it exists
          if (expertDoc.document_type_id) {
            const { data: docTypeData, error: docTypeError } = await supabase
              .from('document_types')
              .select('id, name, description, category, is_general_type')
              .eq('id', expertDoc.document_type_id)
              .limit(1);
              
            if (docTypeError) {
              console.error('❌ Error fetching document type:', docTypeError.message);
            } else if (docTypeData && docTypeData.length > 0) {
              console.log('Current document type:', docTypeData[0].name);
              console.log('Category:', docTypeData[0].category || 'N/A');
              console.log('Is general type:', docTypeData[0].is_general_type ? 'Yes' : 'No');
              console.log('Description:', docTypeData[0].description);
            }
          } else {
            console.log('⚠️ No document type assigned to this expert document');
          }
          
          // Fetch the content separately if needed
          const { data: contentData, error: contentError } = await supabase
            .from('expert_documents')
            .select('raw_content')
            .eq('id', expertDoc.id)
            .limit(1);
            
          if (contentError) {
            console.error('❌ Error fetching document content:', contentError.message);
          } else if (contentData && contentData.length > 0 && contentData[0].raw_content) {
            const contentPreview = contentData[0].raw_content.slice(0, 300);
            console.log('\nContent preview:');
            console.log('---------------------------------');
            console.log(contentPreview + '...');
            console.log('---------------------------------');
            console.log(`Total content length: ${contentData[0].raw_content.length} characters`);
          } else {
            console.log('⚠️ No content available for this expert document');
          }
          
          console.log('\nThis document is ready for classification using document-classification-prompt-new');
          console.log('Next implementation phase will process this content through Claude');
        } else {
          console.log('⚠️ No expert document found for this source');
          console.log('Next implementation phase will fetch content and create an expert document');
        }
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