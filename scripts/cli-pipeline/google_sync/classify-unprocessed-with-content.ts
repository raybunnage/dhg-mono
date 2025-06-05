#!/usr/bin/env ts-node
/**
 * Command to find docx, txt, or pptx files that need classification and have raw_content,
 * then classify them using the document-classification-prompt-new and update document_type_id
 */
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { promptService } from '../../../packages/shared/services/prompt-service';
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';

// Define the prompt name to use for classification
const CLASSIFICATION_PROMPT = 'document-classification-prompt-new';

interface CommandOptions {
  limit?: number;
  dryRun?: boolean;
  verbose?: boolean;
  mimeTypes?: string;
  concurrency?: number;
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
}

// Process files concurrently with controlled concurrency
async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<R>,
  progressCallback?: (current: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];
  let currentIndex = 0;
  const total = items.length;

  // Process the next item in the queue
  async function processNext(): Promise<void> {
    const index = currentIndex++;
    if (index >= total) return;

    try {
      const result = await processor(items[index], index);
      results[index] = result; // Store the result at the correct index
      
      if (progressCallback) {
        progressCallback(index + 1, total);
      }

      // Process the next item
      await processNext();
    } catch (error) {
      console.error(`Error processing item at index ${index}:`, error);
      // Even if there's an error, try to process the next item
      await processNext();
    }
  }

  // Start processing up to 'concurrency' items in parallel
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, total); i++) {
    workers.push(processNext());
  }

  // Wait for all workers to complete
  await Promise.all(workers);
  
  return results;
}

// Main command program
const program = new Command();

program
  .name('classify-unprocessed-with-content')
  .description('Find unclassified docx, txt, or pptx files with raw_content and classify them')
  .option('-l, --limit <number>', 'Limit the number of files to process (default: 10)', '10')
  .option('--dry-run', 'Run without making database changes', false)
  .option('-v, --verbose', 'Show verbose output', false)
  .option('-m, --mime-types <types>', 'Comma-separated mime types to process (default: docx,txt,pptx)', 'docx,txt,pptx')
  .option('-c, --concurrency <number>', 'Number of files to process concurrently (1-5, default: 1)', '1')
  .action(async (options: CommandOptions) => {
    try {
      console.log('=== Classify Unprocessed Files With Content ===');
      
      // Parse options
      const limit = parseInt(options.limit?.toString() || '10', 10);
      const dryRun = !!options.dryRun;
      const verbose = !!options.verbose;
      const concurrency = Math.min(5, Math.max(1, parseInt(options.concurrency?.toString() || '1', 10)));
      
      // Parse mime types
      const mimeTypes = (options.mimeTypes || 'docx,txt,pptx').split(',').map(t => t.trim());
      
      console.log(`Processing up to ${limit} files with concurrency of ${concurrency}`);
      console.log(`Mime types: ${mimeTypes.join(', ')}`);
      console.log(`Mode: ${dryRun ? 'DRY RUN (no database changes)' : 'LIVE (will update database)'}`);
      
      // Map of file extensions to mime types
      const mimeTypeMap: Record<string, string> = {
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'txt': 'text/plain',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      };
      
      // Map requested mime types to their full mime type strings
      const mimeTypeFilters = mimeTypes.map(type => mimeTypeMap[type] || type).filter(Boolean);
      
      if (mimeTypeFilters.length === 0) {
        throw new Error('No valid mime types specified');
      }
      
      // Get the Supabase client
      const supabase = SupabaseClientService.getInstance().getClient();
      
      // Retrieve the prompt with all related data
      console.log(`\nLoading prompt: ${CLASSIFICATION_PROMPT}`);
      const promptResult = await promptService.loadPrompt(CLASSIFICATION_PROMPT, {
        includeDatabaseQueries: true,
        includeRelationships: true,
        includeRelatedFiles: true,
        executeQueries: true
      });

      if (!promptResult.prompt) {
        console.error(`❌ Failed to retrieve prompt "${CLASSIFICATION_PROMPT}"`);
        process.exit(1);
      }
      
      console.log(`✅ Successfully loaded prompt "${CLASSIFICATION_PROMPT}"`);
      
      // 1. Find files that are unprocessed/unclassified and have raw_content
      console.log('\nFinding unprocessed files with content...');
      
      // Find sources_google records that match our criteria:
      // 1. Has a mime type we want to process (docx, txt, pptx)
      // 2. Either has no document_type_id or its expert_documents has pipeline_status = 'unprocessed'
      // 3. Has raw_content in the expert_documents table
      // 4. Is not deleted
      const { data: filesToProcess, error: filesError } = await supabase
        .from('google_sources')
        .select(`
          id,
          name,
          mime_type,
          document_type_id,
          expert_documents (
            id,
            raw_content,
            pipeline_status
          )
        `)
        .is('is_deleted', false)
        .in('mime_type', mimeTypeFilters)
        .order('modified_at', { ascending: false })
        .limit(limit * 2); // Fetch more than we need to account for filtering
      
      if (filesError) {
        console.error(`❌ Error fetching files: ${filesError.message}`);
        process.exit(1);
      }
      
      if (!filesToProcess || filesToProcess.length === 0) {
        console.log('❌ No matching files found');
        process.exit(0);
      }
      
      // Filter to files with content and either no document_type or unprocessed status
      const validFiles = filesToProcess.filter(file => {
        // Must have at least one expert_document with content
        const hasContent = file.expert_documents && 
                           file.expert_documents.length > 0 && 
                           file.expert_documents.some(doc => doc.raw_content);
        
        // Must either have no document_type_id OR have unprocessed status
        const needsClassification = !file.document_type_id || 
                                   (file.expert_documents && 
                                    file.expert_documents.length > 0 && 
                                    file.expert_documents.some(doc => doc.pipeline_status === 'unprocessed'));
        
        return hasContent && needsClassification;
      }).slice(0, limit); // Limit to requested number
      
      if (validFiles.length === 0) {
        console.log(`❌ No files found with content that need classification`);
        process.exit(0);
      }
      
      console.log(`\n✅ Found ${validFiles.length} files with content that need classification:`);
      
      // Display file details for debug purposes
      validFiles.forEach((file, index) => {
        console.log(`\n${index+1}. ${file.name} (${file.id}):`);
        console.log(`   Mime Type: ${file.mime_type}`);
        console.log(`   Document Type ID: ${file.document_type_id || 'Not set'}`);
        
        const expertDoc = file.expert_documents && file.expert_documents.length > 0 
                         ? file.expert_documents[0] 
                         : null;
        
        if (expertDoc) {
          console.log(`   Expert Document ID: ${expertDoc.id}`);
          console.log(`   Pipeline Status: ${expertDoc.pipeline_status || 'Not set'}`);
          console.log(`   Content Length: ${expertDoc.raw_content ? expertDoc.raw_content.length : 0} characters`);
        } else {
          console.log(`   No expert document found`);
        }
      });
      
      if (dryRun) {
        console.log(`\n🔍 DRY RUN MODE: Would classify ${validFiles.length} files`);
      } else {
        console.log(`\n🔄 Processing ${validFiles.length} files...`);
      }
      
      // Process each file and classify it
      const results = await processWithConcurrency(
        validFiles,
        concurrency,
        async (file, index) => {
          try {
            console.log(`\n[${index+1}/${validFiles.length}] Processing: ${file.name}`);
            
            // Get the expert document with content
            const expertDoc = file.expert_documents && file.expert_documents.length > 0
                           ? file.expert_documents.find(doc => doc.raw_content)
                           : null;
            
            if (!expertDoc || !expertDoc.raw_content) {
              console.log(`❌ No content found for ${file.name}`);
              return {
                file,
                success: false,
                error: 'No content found'
              };
            }
            
            // Extract the content
            const documentContent = expertDoc.raw_content;
            
            // Prepare the prompt with document content
            console.log(`Classifying ${file.name} (content length: ${documentContent.length} characters)`);
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
            
            // Call Claude API for classification
            const classificationResponse = await claudeService.getJsonResponse<ClassificationResult>(fullPrompt);
            
            if (!classificationResponse || !classificationResponse.document_type_id) {
              console.log(`❌ Classification failed for ${file.name}`);
              return {
                file,
                success: false,
                error: 'Classification failed or no document_type_id returned'
              };
            }
            
            // Log classification results
            console.log(`✅ [${index+1}/${validFiles.length}] Classification complete for ${file.name}:`);
            console.log(`   Document Type: ${classificationResponse.name || 'Unknown'}`);
            console.log(`   Category: ${classificationResponse.category || 'Unknown'}`);
            console.log(`   Confidence: ${classificationResponse.classification_confidence || 0}`);
            
            if (verbose) {
              console.log(`   Document Type ID: ${classificationResponse.document_type_id}`);
              console.log(`   Classification Reasoning: ${classificationResponse.classification_reasoning?.substring(0, 100)}...`);
              console.log(`   Concepts: ${classificationResponse.concepts?.map(c => c.name).join(', ') || 'None'}`);
            }
            
            // In dry run mode, don't update the database
            if (dryRun) {
              console.log(`🔍 DRY RUN: Would update document_type_id to ${classificationResponse.document_type_id}`);
              return {
                file,
                success: true,
                classification: classificationResponse,
                updated: false
              };
            }
            
            // Update the sources_google record with the new document_type_id
            const { error: updateError } = await supabase
              .from('google_sources')
              .update({
                document_type_id: classificationResponse.document_type_id,
                updated_at: new Date().toISOString()
              })
              .eq('id', file.id);
            
            if (updateError) {
              console.error(`❌ Error updating sources_google: ${updateError.message}`);
              return {
                file,
                success: false,
                error: `Error updating sources_google: ${updateError.message}`,
                classification: classificationResponse
              };
            }
            
            // Update the expert_document with classification metadata and set pipeline_status to 'processed'
            const classificationMetadata = {
              classifier: 'claude',
              model: 'claude-3-7-sonnet',
              classifiedAt: new Date().toISOString(),
              originalResponse: classificationResponse,
              reasoning: classificationResponse.classification_reasoning || '',
              category: classificationResponse.category || '',
              suggestedTitle: classificationResponse.suggested_title || '',
              concepts: classificationResponse.concepts || []
            };
            
            const { error: updateDocError } = await supabase
              .from('google_expert_documents')
              .update({
                // Keep existing document_type_id in expert_documents if present
                classification_confidence: classificationResponse.classification_confidence || 0,
                classification_metadata: classificationMetadata,
                key_insights: classificationResponse.concepts?.map(c => c.name) || [],
                title: classificationResponse.suggested_title || (expertDoc as any).title || file.name,
                classification_reasoning: classificationResponse.classification_reasoning || '',
                pipeline_status: 'processed',
                processed_content: {
                  raw: documentContent.substring(0, 5000),
                  ai_analysis: classificationResponse,
                  processed_at: new Date().toISOString()
                },
                updated_at: new Date().toISOString()
              })
              .eq('id', expertDoc.id);
            
            if (updateDocError) {
              console.error(`❌ Error updating expert_documents: ${updateDocError.message}`);
              return {
                file,
                success: false,
                error: `Error updating expert_documents: ${updateDocError.message}`,
                classification: classificationResponse,
                sources_google_updated: true
              };
            }
            
            // If the document has concepts, save them to the doc_concepts table
            if (classificationResponse.concepts && classificationResponse.concepts.length > 0) {
              // First delete any existing concepts
              const { error: deleteConceptsError } = await supabase
                .from('doc_concepts')
                .delete()
                .eq('document_id', expertDoc.id);
              
              if (deleteConceptsError) {
                console.error(`❌ Error deleting existing concepts: ${deleteConceptsError.message}`);
              }
              
              // Insert new concepts
              const conceptRecords = classificationResponse.concepts.map(concept => ({
                document_id: expertDoc.id,
                concept: concept.name,
                weight: concept.weight,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }));
              
              const { error: insertConceptsError } = await supabase
                .from('doc_concepts')
                .insert(conceptRecords);
              
              if (insertConceptsError) {
                console.error(`❌ Error inserting concepts: ${insertConceptsError.message}`);
              } else if (verbose) {
                console.log(`✅ Saved ${conceptRecords.length} concepts to doc_concepts table`);
              }
            }
            
            console.log(`✅ Successfully updated ${file.name} with document_type_id: ${classificationResponse.document_type_id}`);
            
            return {
              file,
              success: true,
              classification: classificationResponse,
              updated: true
            };
          } catch (error) {
            console.error(`❌ Error processing ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
            return {
              file,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        },
        (current, total) => {
          console.log(`Progress: ${current}/${total} files processed (${Math.round((current / total) * 100)}%)`);
        }
      );
      
      // Summarize results
      const successCount = results.filter(r => r.success).length;
      const updateCount = results.filter(r => r.updated).length;
      const failCount = results.filter(r => !r.success).length;
      
      console.log('\n=== Classification Summary ===');
      console.log(`Total files processed: ${validFiles.length}`);
      console.log(`Successfully classified: ${successCount}`);
      if (!dryRun) {
        console.log(`Database records updated: ${updateCount}`);
      } else {
        console.log(`Would have updated database records: ${successCount}`);
      }
      console.log(`Failed: ${failCount}`);
      
      // Show a table of results
      console.log('\n=== Classification Results ===');
      console.log('-'.repeat(100));
      console.log('| File Name'.padEnd(40) + ' | Document Type'.padEnd(30) + ' | Status'.padEnd(20) + ' |');
      console.log('-'.repeat(100));
      
      for (const result of results) {
        const fileName = result.file.name.substring(0, 37).padEnd(37);
        const docType = result.classification?.name || 'N/A';
        const status = result.success 
                      ? (result.updated ? 'Updated' : 'Would Update') 
                      : `Failed: ${result.error}`;
        
        console.log(`| ${fileName} | ${docType.substring(0, 27).padEnd(27)} | ${status.substring(0, 17).padEnd(17)} |`);
      }
      
      console.log('-'.repeat(100));
      
    } catch (error) {
      console.error(`❌ Command error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Run the command if this script is executed directly
if (require.main === module) {
  program.parse(process.argv);
}

export default program;