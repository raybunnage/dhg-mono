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
        
        // Get detailed counts of document types and categories
        let generalCategoriesCount = 0;
        let generalCategories: Record<string, number> = {};
        let specificTypesCount = 0;
        let specificTypes: Record<string, number> = {};
        
        for (const query of promptResult.databaseQueries) {
          if (query.queryText.includes('is_general_type = true')) {
            // Count general categories
            if (query.queryResults && Array.isArray(query.queryResults)) {
              generalCategoriesCount = query.queryResults.length;
              
              // Count by category
              query.queryResults.forEach(result => {
                if (result.category) {
                  generalCategories[result.category] = (generalCategories[result.category] || 0) + 1;
                }
              });
            }
          } else if (query.queryText.includes('is_general_type = false')) {
            // Count specific document types
            if (query.queryResults && Array.isArray(query.queryResults)) {
              specificTypesCount = query.queryResults.length;
              
              // Count by name
              query.queryResults.forEach(result => {
                if (result.name) {
                  specificTypes[result.name] = (specificTypes[result.name] || 0) + 1;
                }
              });
            }
          }
        }
        
        // Display document type statistics
        console.log('\nDocument Type Statistics:');
        console.log(`- Total general categories: ${generalCategoriesCount}`);
        console.log(`- Total specific document types: ${specificTypesCount}`);
        
        // Display category breakdown
        console.log('\nGeneral categories:');
        Object.entries(generalCategories)
          .sort((a, b) => b[1] - a[1]) // Sort by count descending
          .slice(0, 10) // Show top 10
          .forEach(([category, count]) => {
            console.log(`  - ${category}: ${count}`);
          });
        
        if (Object.keys(generalCategories).length > 10) {
          console.log(`  - ...and ${Object.keys(generalCategories).length - 10} more`);
        }
        
        // Display document type breakdown
        console.log('\nTop 10 specific document types:');
        Object.entries(specificTypes)
          .sort((a, b) => b[1] - a[1]) // Sort by count descending
          .slice(0, 10) // Show top 10
          .forEach(([type, count]) => {
            console.log(`  - ${type}: ${count}`);
          });
          
        if (Object.keys(specificTypes).length > 10) {
          console.log(`  - ...and ${Object.keys(specificTypes).length - 10} more`);
        }
        
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
              
              // Add specific instructions to ensure complete JSON response with document_type_id
              const fullPrompt = `${promptResult.combinedContent}

### Document Content:
${documentContent}

Please analyze this document and provide a complete classification with the following fields:
1. document_type_id - The UUID of the specific document type (must be one from the provided list)
2. category - The general document category (must be one of the categories from the provided list)
3. name - The specific document type name (must be one of the document types from the provided list)
4. classification_confidence - A number between 0 and 1 representing your confidence
5. classification_reasoning - Detailed explanation of why you chose this classification
6. concepts - An array of key concepts from the document, each with a name and weight

It is CRITICAL that you include the document_type_id field with the actual UUID from the database queries.
Do NOT use placeholder IDs like "uuid-1" - use the actual UUIDs from the document_types table.

Return your classification as a complete, valid JSON object with all of these fields.`;
              
              // Log the prompt length for debugging
              console.log(`Prompt length: ${fullPrompt.length} characters`);
              
              const classificationResponse = await claudeService.getJsonResponse<ClassificationResult>(fullPrompt);
              
              if (classificationResponse) {
                console.log('\n✅ Classification complete!');
                
                // Display detailed assessment of the response
                console.log('\nClassification Analysis:');
                console.log('---------------------------------');
                
                // Check for expected fields
                const expectedFields = [
                  'category', 
                  'name',
                  'classification_confidence',
                  'classification_reasoning',
                  'concepts'
                ];
                
                const legacyFields = [
                  'generalCategory',
                  'specificDocumentType',
                  'confidence',
                  'reasoning',
                  'keyConcepts'
                ];
                
                // Display fields and check for existence
                expectedFields.forEach(field => {
                  const value = classificationResponse[field as keyof ClassificationResult];
                  const legacyField = legacyFields[expectedFields.indexOf(field)];
                  const legacyValue = classificationResponse[legacyField as keyof ClassificationResult];
                  
                  console.log(`${field}: ${value !== undefined ? '✅ Present' : '❌ Missing'}${legacyValue !== undefined ? ' (found in legacy field)' : ''}`);
                  
                  // Show field value
                  if (value !== undefined) {
                    if (typeof value === 'object' && value !== null) {
                      if (Array.isArray(value)) {
                        console.log(`  Value: Array with ${value.length} items`);
                        if (value.length > 0) {
                          console.log(`  First item: ${JSON.stringify(value[0])}`);
                        }
                      } else {
                        console.log(`  Value: ${JSON.stringify(value).substring(0, 100)}...`);
                      }
                    } else {
                      console.log(`  Value: ${value}`);
                    }
                  } else if (legacyValue !== undefined) {
                    if (typeof legacyValue === 'object' && legacyValue !== null) {
                      if (Array.isArray(legacyValue)) {
                        console.log(`  Legacy value: Array with ${legacyValue.length} items`);
                        if (legacyValue.length > 0) {
                          console.log(`  First item: ${JSON.stringify(legacyValue[0])}`);
                        }
                      } else {
                        console.log(`  Legacy value: ${JSON.stringify(legacyValue).substring(0, 100)}...`);
                      }
                    } else {
                      console.log(`  Legacy value: ${legacyValue}`);
                    }
                  }
                });
                
                console.log('\nComplete Classification Result (RAW JSON):');
                console.log('---------------------------------');
                // Print the raw, unformatted JSON string
                console.log('Raw JSON string:');
                console.log(JSON.stringify(classificationResponse));
                
                console.log('\nFormatted JSON:');
                console.log(JSON.stringify(classificationResponse, null, 2));
                
                // Get all keys to ensure we show ALL properties, even unexpected ones
                console.log('\nAll properties in the response:');
                const allKeys = Object.keys(classificationResponse);
                console.log(`Found ${allKeys.length} properties: ${allKeys.join(', ')}`);
                
                // Show each property and its value
                console.log('\nDetailed property breakdown:');
                allKeys.forEach(key => {
                  const value = classificationResponse[key as keyof typeof classificationResponse];
                  console.log(`\nProperty: ${key}`);
                  console.log(`Type: ${typeof value}`);
                  console.log(`Value: ${JSON.stringify(value, null, 2)}`);
                });
                
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
                  console.log(`- Setting title to: "${classificationResponse.suggested_title || 'No suggested title'}"`);
                  console.log(`- Adding key concepts: ${conceptsList}`);
                  console.log(`- Setting classification confidence: ${confidence}`);
                  console.log(`- Setting classification reasoning: ${(classificationResponse.classification_reasoning || '').substring(0, 100)}...`);
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
                    console.log(`⚠️ No matching document type found for "${documentTypeName}"`);
                    
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
                  
                  // Show what would be added to document_concepts table
                  if (classificationResponse.concepts && classificationResponse.concepts.length > 0) {
                    console.log('\n🔍 DRY RUN: Would save the following concepts to document_concepts table:');
                    classificationResponse.concepts.forEach((concept, index) => {
                      console.log(`  ${index+1}. ${concept.name} (weight: ${concept.weight})`);
                    });
                    console.log(`- First, would delete any existing concepts for document_id: ${expertDoc.id}`);
                    console.log(`- Then, would insert ${classificationResponse.concepts.length} new concept records`);
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
                  
                  // CRITICAL: Use ONLY the document_type_id directly from the AI response
                  // No fallbacks, no lookups by name, exactly what Claude returns
                  
                  console.log('\n--- DOCUMENT TYPE ID VERIFICATION ---');
                  console.log(`Raw document_type_id from Claude: ${JSON.stringify(classificationResponse.document_type_id)}`);
                  console.log(`Type of document_type_id: ${typeof classificationResponse.document_type_id}`);
                  console.log(`Raw category from Claude: ${JSON.stringify(classificationResponse.category)}`);
                  console.log(`Raw name from Claude: ${JSON.stringify(classificationResponse.name)}`);
                  console.log('-----------------------------------\n');
                  
                  // Use the document_type_id directly from the AI response with no modifications
                  if (!classificationResponse.document_type_id) {
                    console.error('❌ No document_type_id returned from Claude AI');
                    console.error('Cannot update without a valid document_type_id');
                    return;
                  }
                  
                  // No lookups by name, no fallback, just use what Claude returned
                  const documentTypeId = classificationResponse.document_type_id;
                  
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
                  
                  // We're not updating the expert_document with the document_type_id as requested
                  // Only updating metadata and other fields in the expert_document

                  const { data: updateData, error: updateError } = await supabase
                    .from('expert_documents')
                    .update({
                      // document_type_id is intentionally NOT included here per requirements
                      classification_confidence: confidence,
                      classification_metadata: classificationMetadata,
                      key_insights: keyConceptsArray,
                      title: classificationResponse.suggested_title || expertDoc.title, // Use suggested title if available
                      classification_reasoning: classificationResponse.classification_reasoning || classificationResponse.reasoning || '',
                      document_processing_status: 'reprocessing_done',
                      document_processing_status_updated_at: new Date().toISOString()
                    })
                    .eq('id', expertDoc.id)
                    .select();
                  
                  if (updateError) {
                    console.error('❌ Error updating expert document:', updateError.message);
                    return;
                  } else {
                    console.log('✅ Successfully updated expert document with classification metadata');
                    console.log(`- Classification confidence: ${confidence}`);
                    console.log(`- Key concepts added: ${keyConceptsArray.length}`);
                    console.log(`- Title updated: ${classificationResponse.suggested_title || 'No suggested title'}`);
                    console.log(`- Classification reasoning added: ${(classificationResponse.classification_reasoning || '').substring(0, 50)}...`);
                    console.log(`- Processing status updated to: reprocessing_done`);
                    
                    // Now save concepts to document_concepts table
                    if (classificationResponse.concepts && classificationResponse.concepts.length > 0) {
                      console.log('\nSaving concepts to document_concepts table...');
                      
                      // First, delete any existing concepts for this document to avoid duplicates
                      const { error: deleteError } = await supabase
                        .from('document_concepts')
                        .delete()
                        .eq('document_id', expertDoc.id);
                        
                      if (deleteError) {
                        console.error('❌ Error deleting existing concepts:', deleteError.message);
                        return;
                      }
                      
                      // Prepare concept records for insertion
                      const conceptRecords = classificationResponse.concepts.map(concept => ({
                        document_id: expertDoc.id,
                        concept: concept.name,
                        weight: concept.weight,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      }));
                      
                      // Insert all concepts
                      const { data: conceptsData, error: conceptsError } = await supabase
                        .from('document_concepts')
                        .insert(conceptRecords)
                        .select();
                        
                      if (conceptsError) {
                        console.error('❌ Error saving concepts:', conceptsError.message);
                      } else {
                        console.log(`✅ Successfully saved ${conceptRecords.length} concepts to document_concepts table`);
                        console.log('Concept details:');
                        classificationResponse.concepts.forEach((concept, index) => {
                          console.log(`  ${index+1}. ${concept.name} (weight: ${concept.weight})`);
                        });
                      }
                    }
                    
                    // Update the document_type_id in sources_google using EXACTLY what Claude returned
                    console.log('\nUpdating document_type_id in sources_google record...');
                    console.log(`About to update sources_google with document_type_id: ${classificationResponse.document_type_id}`);
                    console.log(`Category in classification: ${classificationResponse.category}`);
                    console.log(`Name in classification: ${classificationResponse.name}`);
                    
                    const { data: updateSourceData, error: updateSourceError } = await supabase
                      .from('sources_google')
                      .update({
                        document_type_id: classificationResponse.document_type_id, // Use exactly what Claude returned
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', options.id)
                      .select();
                    
                    if (updateSourceError) {
                      console.error(`❌ Error updating sources_google: ${updateSourceError.message}`);
                    } else {
                      console.log(`✅ Successfully updated sources_google record with document_type_id: ${classificationResponse.document_type_id}`);
                    }
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