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
  document_type_id?: string;
  category?: string;
  name?: string;
  suggested_title?: string;
  classification_confidence?: number;
  classification_reasoning?: string;
  concepts?: Array<{
    name: string;
    weight: number;
  }>;
  
  // Legacy fields - might be returned by some Claude models
  generalCategory?: string;
  specificDocumentType?: string;
  keyConcepts?: string[];
  confidence?: number;
  reasoning?: string;
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
          
          console.log('\nDocument is ready for classification using document-classification-prompt-new');
          
          // If we have content and a prompt, we can proceed with classification
          if (contentData && contentData.length > 0 && contentData[0].raw_content && promptResult.prompt) {
            try {
              console.log('Starting AI classification process...');
              
              // Prepare the full prompt by combining the prompt template with the document content
              const documentContent = contentData[0].raw_content;
              
              // Process the content through Claude API for classification
              console.log('Sending to Claude API for classification...');
              const classificationResponse = await claudeService.getJsonResponse<ClassificationResult>(
                promptResult.combinedContent + '\n\n### Document Content:\n' + documentContent + '\n\nProvide your classification in JSON format.'
              );
              
              if (classificationResponse) {
                console.log('\n✅ Classification complete!');
                console.log('\nClassification Result:');
                console.log('---------------------------------');
                console.log(JSON.stringify(classificationResponse, null, 2));
                console.log('---------------------------------');
                
                // Log what we would do in a real run
                if (options.dryRun) {
                  console.log('\n🔍 DRY RUN: Database update would include:');
                  
                  // Determine the document type name to use based on response format
                  const documentTypeName = classificationResponse.name || 
                    classificationResponse.specificDocumentType || 
                    'Unknown document type';
                  
                  // Extract concepts
                  let conceptsList: string = 'None found';
                  if (classificationResponse.concepts && classificationResponse.concepts.length > 0) {
                    conceptsList = classificationResponse.concepts.map(c => c.name).join(', ');
                  } else if (classificationResponse.keyConcepts && classificationResponse.keyConcepts.length > 0) {
                    conceptsList = classificationResponse.keyConcepts.join(', ');
                  }
                  
                  // Extract confidence score
                  const confidence = classificationResponse.classification_confidence || 
                    classificationResponse.confidence || 
                    0;
                  
                  console.log(`- Setting document_type_id to match "${documentTypeName}"`);
                  console.log(`- Adding key concepts: ${conceptsList}`);
                  console.log(`- Setting classification confidence: ${confidence}`);
                  console.log(`- Adding classification metadata with reasoning`);
                  
                  // Look up the document type ID for the classified type
                  const { data: docTypeMatchData, error: docTypeMatchError } = await supabase
                    .from('document_types')
                    .select('id, name')
                    .eq('name', documentTypeName)
                    .limit(1);
                    
                  if (docTypeMatchError) {
                    console.error('❌ Error finding matching document type:', docTypeMatchError.message);
                  } else if (docTypeMatchData && docTypeMatchData.length > 0) {
                    console.log(`✅ Found matching document type ID: ${docTypeMatchData[0].id}`);
                  } else {
                    console.log(`⚠️ No matching document type found for "${classificationResponse.specificDocumentType}"`);
                    
                    // Find similar document types to suggest alternatives
                    console.log('Searching for similar document types...');
                    const { data: similarTypes, error: similarError } = await supabase
                      .from('document_types')
                      .select('id, name')
                      .eq('is_general_type', false)
                      .limit(5);
                      
                    if (!similarError && similarTypes && similarTypes.length > 0) {
                      console.log('Similar document types you might consider:');
                      similarTypes.forEach(type => console.log(`- ${type.name} (${type.id})`));
                    }
                  }
                } else {
                  console.log('\nPerforming database update...');
                  
                  // Determine the document type name to use based on response format
                  const documentTypeName = classificationResponse.name || 
                    classificationResponse.specificDocumentType || 
                    'Unknown document type';
                  
                  // Extract concepts
                  let keyConceptsArray: string[] = [];
                  if (classificationResponse.concepts && classificationResponse.concepts.length > 0) {
                    keyConceptsArray = classificationResponse.concepts.map(c => c.name);
                  } else if (classificationResponse.keyConcepts && classificationResponse.keyConcepts.length > 0) {
                    keyConceptsArray = classificationResponse.keyConcepts;
                  }
                  
                  // Extract confidence score
                  const confidence = classificationResponse.classification_confidence || 
                    classificationResponse.confidence || 
                    0;
                  
                  // Look up the document type ID for the classified type
                  const { data: docTypeMatchData, error: docTypeMatchError } = await supabase
                    .from('document_types')
                    .select('id, name')
                    .eq('name', documentTypeName)
                    .limit(1);
                  
                  if (docTypeMatchError) {
                    console.error('❌ Error finding matching document type:', docTypeMatchError.message);
                    return;
                  }
                  
                  let documentTypeId: string | null = null;
                  if (docTypeMatchData && docTypeMatchData.length > 0) {
                    documentTypeId = docTypeMatchData[0].id;
                    console.log(`✅ Found matching document type ID: ${documentTypeId}`);
                  } else {
                    console.log(`⚠️ No matching document type found for "${documentTypeName}"`);
                    console.log('Cannot update without a valid document type ID');
                    return;
                  }
                  
                  // Prepare classification metadata
                  const classificationMetadata = {
                    classifier: 'claude',
                    model: 'claude-3-7-sonnet',
                    classifiedAt: new Date().toISOString(),
                    originalResponse: classificationResponse,
                    reasoning: classificationResponse.classification_reasoning || classificationResponse.reasoning || '',
                    category: classificationResponse.category || classificationResponse.generalCategory || '',
                    suggestedTitle: classificationResponse.suggested_title || '',
                    concepts: classificationResponse.concepts || keyConceptsArray.map(name => ({ name, weight: 1.0 }))
                  };
                  
                  // Update the expert document with the new document type and metadata
                  const { data: updateData, error: updateError } = await supabase
                    .from('expert_documents')
                    .update({
                      document_type_id: documentTypeId,
                      classification_confidence: confidence,
                      classification_metadata: classificationMetadata,
                      key_insights: keyConceptsArray,
                      document_processing_status: 'reprocessing_done',
                      document_processing_status_updated_at: new Date().toISOString()
                    })
                    .eq('id', expertDoc.id)
                    .select();
                  
                  if (updateError) {
                    console.error('❌ Error updating expert document:', updateError.message);
                  } else {
                    console.log('✅ Successfully updated expert document with new classification');
                    console.log(`- Document type set to: ${documentTypeName} (${documentTypeId})`);
                    console.log(`- Classification confidence: ${confidence}`);
                    console.log(`- Key concepts added: ${keyConceptsArray.length}`);
                    console.log(`- Processing status updated to: reprocessing_done`);
                  }
                }
              } else {
                console.error('❌ Classification failed: No response from Claude API');
              }
            } catch (error) {
              console.error('❌ Error during classification process:', error instanceof Error ? error.message : String(error));
            }
          } else {
            console.error('❌ Cannot proceed with classification: Missing document content or prompt');
          }
        } else {
          console.log('⚠️ No expert document found for this source');
          console.log('Additional functionality would be needed to process sources without expert documents');
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