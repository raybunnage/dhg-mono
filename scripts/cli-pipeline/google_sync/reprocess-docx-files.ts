#!/usr/bin/env ts-node
/**
 * Script to reprocess DOCX files with needs_reprocessing status
 * 
 * This script specifically:
 * 1. Finds all sources_google records that have:
 *    - A corresponding expert_documents record with document_processing_status='needs_reprocessing'
 *    - File name ending with .docx
 * 2. Processes these files through Claude for classification
 * 3. Updates ONLY the sources_google.document_type_id with the result
 * 
 * Based on the working force-classify-docs.ts script
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { promptService } from '../../../packages/shared/services/prompt-service';
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
import * as path from 'path';
import * as fs from 'fs';

// Define prompt to use for classification
const CLASSIFICATION_PROMPT = 'document-classification-prompt-new';

interface CommandOptions {
  limit: string;
  verbose: boolean;
  dryRun: boolean;
  output?: string;
  concurrency: string;
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
  .name('reprocess-docx-files')
  .description('Reprocess DOCX files with needs_reprocessing status')
  .option('-l, --limit <number>', 'Limit number of files to process', '10')
  .option('-v, --verbose', 'Show verbose output', false)
  .option('--dry-run', 'Run classification but do not update database', false)
  .option('-o, --output <path>', 'Path to save classification results', '')
  .option('-c, --concurrency <number>', 'Number of files to process concurrently (1-3)', '1')
  .action(async (options: CommandOptions) => {
    try {
      const limit = parseInt(options.limit, 10) || 10;
      const verbose = options.verbose;
      const dryRun = options.dryRun;
      const concurrency = Math.min(3, parseInt(options.concurrency, 10) || 1);
      
      console.log('=== Reprocess DOCX Files with needs_reprocessing status ===');
      console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
      console.log(`Limit: ${limit} files`);
      console.log(`Concurrency: ${concurrency}`);
      
      // Get the Supabase client
      const supabase = SupabaseClientService.getInstance().getClient();
      
      // STEP 1: Find all expert_documents with needs_reprocessing status
      console.log('\nFinding expert documents with needs_reprocessing status...');
      
      const { data: docsNeedingReprocessing, error: docsError } = await supabase
        .from('expert_documents')
        .select('id, source_id, raw_content')
        .eq('document_processing_status', 'needs_reprocessing')
        .limit(500); // Get a larger pool than we need
      
      if (docsError) {
        console.error('❌ Error fetching documents needing reprocessing:', docsError.message);
        process.exit(1);
      }
      
      console.log(`Found ${docsNeedingReprocessing?.length || 0} documents with needs_reprocessing status`);
      
      if (!docsNeedingReprocessing || docsNeedingReprocessing.length === 0) {
        console.log('No documents found needing reprocessing');
        process.exit(0);
      }
      
      // Get source IDs
      const sourceIds = docsNeedingReprocessing.map(doc => doc.source_id);
      
      // STEP 2: Find corresponding sources_google records that are .docx files
      console.log('\nFinding corresponding sources_google records with .docx extension...');
      
      const { data: sourceFiles, error: sourceError } = await supabase
        .from('sources_google')
        .select('id, name, drive_id, mime_type')
        .in('id', sourceIds)
        .ilike('name', '%.docx');
      
      if (sourceError) {
        console.error('❌ Error fetching source files:', sourceError.message);
        process.exit(1);
      }
      
      console.log(`Found ${sourceFiles?.length || 0} DOCX files that need reprocessing`);
      
      if (!sourceFiles || sourceFiles.length === 0) {
        console.log('No .docx files found that need reprocessing');
        process.exit(0);
      }
      
      // STEP 3: Create a map of source_id to expert_document
      const expertDocsMap = new Map();
      docsNeedingReprocessing.forEach(doc => {
        expertDocsMap.set(doc.source_id, doc);
      });
      
      // STEP 4: Build a list of files to process, limited by the requested limit
      const filesToProcess = sourceFiles.slice(0, limit);
      
      console.log(`\nProcessing ${filesToProcess.length} DOCX files...`);
      
      // STEP 5: Retrieve the classification prompt
      console.log('\nRetrieving document-classification-prompt-new...');
      
      const promptResult = await promptService.loadPrompt(CLASSIFICATION_PROMPT, {
        includeDatabaseQueries: true,
        includeRelationships: true,
        includeRelatedFiles: true,
        executeQueries: true
      });
      
      if (!promptResult.prompt) {
        console.error('❌ Failed to retrieve prompt "document-classification-prompt-new"');
        process.exit(1);
      }
      
      console.log('✅ Successfully retrieved classification prompt');
      
      // STEP 6: Process each file with concurrency control
      const results: any[] = [];
      
      // Simple helper for parallel processing with concurrency control
      async function processInBatches(items: any[], batchSize: number, processor: (item: any, index: number) => Promise<any>) {
        const results: any[] = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const batchResults = await Promise.all(batch.map((item, batchIndex) => 
            processor(item, i + batchIndex)
          ));
          results.push(...batchResults);
        }
        
        return results;
      }
      
      // Process each file
      async function processFile(file: any, index: number) {
        try {
          // Get the expert document with content
          const expertDoc = expertDocsMap.get(file.id);
          
          if (!expertDoc) {
            return {
              file,
              success: false,
              error: 'Expert document not found in map'
            };
          }
          
          // Log the file being processed
          console.log(`\nProcessing file ${index+1}/${filesToProcess.length}: ${file.name}`);
          
          // Check if we have content
          if (!expertDoc.raw_content) {
            console.log(`❌ No content available for ${file.name}`);
            return {
              file,
              success: false,
              error: 'No content available'
            };
          }
          
          // Build the full prompt
          const fullPrompt = `${promptResult.combinedContent}

### Document Content:
${expertDoc.raw_content}

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
          
          // Process the content through Claude API for classification
          console.log(`Sending to Claude API for classification...`);
          
          const classificationResponse = await claudeService.getJsonResponse<ClassificationResult>(fullPrompt);
          
          if (!classificationResponse) {
            console.log(`[${index+1}/${filesToProcess.length}] ❌ Classification failed`);
            return {
              file,
              success: false,
              error: 'No response from Claude API'
            };
          }
          
          // Display classification result
          if (classificationResponse.document_type_id) {
            console.log(`[${index+1}/${filesToProcess.length}] ✅ Classified with document_type_id: ${classificationResponse.document_type_id}`);
            console.log(`[${index+1}/${filesToProcess.length}] 📝 Document type: ${classificationResponse.name || 'Unknown'}`);
            console.log(`[${index+1}/${filesToProcess.length}] 📊 Confidence: ${(classificationResponse.classification_confidence || 0) * 100}%`);
          } else {
            console.log(`[${index+1}/${filesToProcess.length}] ❌ Classification failed: No document_type_id returned`);
            return {
              file,
              success: false,
              error: 'No document_type_id in classification response'
            };
          }
          
          if (verbose) {
            console.log('\n--- DOCUMENT TYPE ID VERIFICATION ---');
            console.log(`Raw document_type_id from Claude: ${JSON.stringify(classificationResponse.document_type_id)}`);
            console.log(`Type of document_type_id: ${typeof classificationResponse.document_type_id}`);
            console.log(`Raw category from Claude: ${JSON.stringify(classificationResponse.category)}`);
            console.log(`Raw name from Claude: ${JSON.stringify(classificationResponse.name)}`);
            console.log('-----------------------------------\n');
          }
          
          // Only update database if not in dry run mode
          if (!dryRun) {
            console.log(`Updating document_type_id in sources_google table for ${file.name} to ${classificationResponse.document_type_id}`);
            
            // Update ONLY the sources_google record with the document_type_id
            const { error: updateError } = await supabase
              .from('sources_google')
              .update({ 
                document_type_id: classificationResponse.document_type_id,
                updated_at: new Date().toISOString()
              })
              .eq('id', file.id);
            
            if (updateError) {
              console.error(`❌ Error updating sources_google: ${updateError.message}`);
              return {
                file,
                classificationResult: classificationResponse,
                success: false,
                error: `Error updating database: ${updateError.message}`
              };
            }
            
            // Update the expert_document status to mark as reprocessed
            // Note: We are NOT updating the document_type_id in expert_documents
            const { error: updateExpertError } = await supabase
              .from('expert_documents')
              .update({
                // Intentionally NOT updating document_type_id
                document_processing_status: 'reprocessing_done',
                document_processing_status_updated_at: new Date().toISOString(),
                classification_confidence: classificationResponse.classification_confidence || 0.75,
                classification_metadata: classificationResponse,
                classification_reasoning: classificationResponse.classification_reasoning || '',
                title: classificationResponse.suggested_title || file.name, // Use the suggested title 
                key_insights: classificationResponse.concepts ? classificationResponse.concepts.map(c => c.name) : [],
                processing_skip_reason: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', expertDoc.id);
            
            if (updateExpertError) {
              console.error(`❌ Error updating expert_documents: ${updateExpertError.message}`);
              return {
                file,
                classificationResult: classificationResponse,
                success: false,
                error: `Error updating expert_documents: ${updateExpertError.message}`
              };
            }
            
            // Save concepts to document_concepts table if available
            if (classificationResponse.concepts && classificationResponse.concepts.length > 0) {
              if (verbose) {
                console.log(`\nSaving ${classificationResponse.concepts.length} concepts to document_concepts table...`);
              }
              
              // First, delete any existing concepts for this document to avoid duplicates
              const { error: deleteError } = await supabase
                .from('document_concepts')
                .delete()
                .eq('document_id', expertDoc.id);
                
              if (deleteError) {
                console.error(`❌ Error deleting existing concepts: ${deleteError.message}`);
                return {
                  file,
                  classificationResult: classificationResponse,
                  success: false,
                  error: `Error deleting existing concepts: ${deleteError.message}`
                };
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
              const { error: conceptsError } = await supabase
                .from('document_concepts')
                .insert(conceptRecords)
                .select();
                
              if (conceptsError) {
                console.error(`❌ Error saving concepts: ${conceptsError.message}`);
                return {
                  file,
                  classificationResult: classificationResponse,
                  success: false,
                  error: `Error saving concepts: ${conceptsError.message}`
                };
              }
              
              if (verbose) {
                console.log(`✅ Successfully saved ${conceptRecords.length} concepts to document_concepts table`);
                console.log('Concepts:');
                classificationResponse.concepts.slice(0, 5).forEach((concept, index) => {
                  console.log(`  ${index+1}. ${concept.name} (weight: ${concept.weight})`);
                });
                if (classificationResponse.concepts.length > 5) {
                  console.log(`  ... and ${classificationResponse.concepts.length - 5} more`);
                }
              }
            }
            
            // Return successful result
            return {
              file,
              classificationResult: classificationResponse,
              success: true
            };
              };
            }
            
            console.log(`✅ Successfully updated records for ${file.name}`);
          } else {
            console.log(`🔍 DRY RUN: Would update sources_google.document_type_id to ${classificationResponse.document_type_id}`);
          }
          
          return {
            file,
            classificationResult: classificationResponse,
            success: true
          };
        } catch (error) {
          console.error(`❌ Error processing file ${file.name}:`, error instanceof Error ? error.message : String(error));
          return {
            file,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
      
      // Process files with concurrency
      const processingResults = await processInBatches(filesToProcess, concurrency, processFile);
      
      // STEP 7: Save results if output path specified
      if (options.output) {
        const outputPath = options.output;
        const outputDir = path.dirname(outputPath);
        
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Format results
        const outputData = {
          timestamp: new Date().toISOString(),
          mode: dryRun ? 'dry-run' : 'live',
          totalProcessed: processingResults.length,
          successCount: processingResults.filter(r => r.success).length,
          failureCount: processingResults.filter(r => !r.success).length,
          results: processingResults.map(r => ({
            id: r.file.id,
            name: r.file.name,
            success: r.success,
            document_type_id: r.classificationResult?.document_type_id,
            document_type: r.classificationResult?.name,
            error: r.error
          }))
        };
        
        // Write to file
        fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
        console.log(`\nResults saved to ${outputPath}`);
      }
      
      // STEP 8: Display summary
      console.log('\n=== Processing Summary ===');
      console.log(`Total files processed: ${processingResults.length}`);
      console.log(`Successfully classified: ${processingResults.filter(r => r.success).length}`);
      console.log(`Failed to classify: ${processingResults.filter(r => !r.success).length}`);
      
      // Show a table of results
      console.log('\nResults:');
      console.log('-'.repeat(100));
      console.log('| File Name                                    | Success | Document Type ID                       |');
      console.log('-'.repeat(100));
      
      processingResults.forEach(r => {
        const name = (r.file.name || 'Unknown').slice(0, 45).padEnd(45);
        const success = r.success ? '✅ Yes' : '❌ No ';
        const typeId = (r.classificationResult?.document_type_id || 'N/A').padEnd(36);
        console.log(`| ${name} | ${success} | ${typeId} |`);
      });
      
      console.log('-'.repeat(100));
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Export for module usage
export async function reprocessDocxFiles(options: {
  limit?: number;
  verbose?: boolean;
  dryRun?: boolean;
  outputPath?: string;
  concurrency?: number;
}): Promise<any[]> {
  const {
    limit = 10,
    verbose = false,
    dryRun = false,
    outputPath,
    concurrency = 1
  } = options;
  
  try {
    // Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // STEP 1: Find all expert_documents with needs_reprocessing status
    const { data: docsNeedingReprocessing, error: docsError } = await supabase
      .from('expert_documents')
      .select('id, source_id, raw_content')
      .eq('document_processing_status', 'needs_reprocessing')
      .limit(500);
    
    if (docsError) {
      throw new Error(`Error fetching documents needing reprocessing: ${docsError.message}`);
    }
    
    if (!docsNeedingReprocessing || docsNeedingReprocessing.length === 0) {
      return [];
    }
    
    // Get source IDs
    const sourceIds = docsNeedingReprocessing.map(doc => doc.source_id);
    
    // STEP 2: Find corresponding sources_google records that are .docx files
    const { data: sourceFiles, error: sourceError } = await supabase
      .from('sources_google')
      .select('id, name, drive_id, mime_type')
      .in('id', sourceIds)
      .ilike('name', '%.docx');
    
    if (sourceError) {
      throw new Error(`Error fetching source files: ${sourceError.message}`);
    }
    
    if (!sourceFiles || sourceFiles.length === 0) {
      return [];
    }
    
    // STEP 3: Create a map of source_id to expert_document
    const expertDocsMap = new Map();
    docsNeedingReprocessing.forEach(doc => {
      expertDocsMap.set(doc.source_id, doc);
    });
    
    // STEP 4: Build a list of files to process, limited by the requested limit
    const filesToProcess = sourceFiles.slice(0, limit);
    
    // STEP 5: Retrieve the classification prompt
    const promptResult = await promptService.loadPrompt(CLASSIFICATION_PROMPT, {
      includeDatabaseQueries: true,
      includeRelationships: true,
      includeRelatedFiles: true,
      executeQueries: true
    });
    
    if (!promptResult.prompt) {
      throw new Error('Failed to retrieve classification prompt');
    }
    
    // Process each file
    const processingResults = [];
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      
      try {
        // Get the expert document with content
        const expertDoc = expertDocsMap.get(file.id);
        
        if (!expertDoc || !expertDoc.raw_content) {
          processingResults.push({
            file,
            success: false,
            error: !expertDoc ? 'Expert document not found' : 'No content available'
          });
          continue;
        }
        
        // Build the full prompt
        const fullPrompt = `${promptResult.combinedContent}

### Document Content:
${expertDoc.raw_content}

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
        
        // Send to Claude API
        const classificationResponse = await claudeService.getJsonResponse<ClassificationResult>(fullPrompt);
        
        if (!classificationResponse || !classificationResponse.document_type_id) {
          processingResults.push({
            file,
            success: false,
            error: 'Classification failed or no document_type_id returned'
          });
          continue;
        }
        
        // Update database if not in dry run mode
        if (!dryRun) {
          // Update ONLY the sources_google record with the document_type_id
          const { error: updateError } = await supabase
            .from('sources_google')
            .update({ 
              document_type_id: classificationResponse.document_type_id,
              updated_at: new Date().toISOString()
            })
            .eq('id', file.id);
          
          if (updateError) {
            processingResults.push({
              file,
              classificationResult: classificationResponse,
              success: false,
              error: `Error updating sources_google: ${updateError.message}`
            });
            continue;
          }
          
          // Update the expert_document status to mark as reprocessed
          const { error: updateExpertError } = await supabase
            .from('expert_documents')
            .update({
              // Intentionally NOT updating document_type_id
              document_processing_status: 'reprocessing_done',
              document_processing_status_updated_at: new Date().toISOString(),
              classification_confidence: classificationResponse.classification_confidence || 0.75,
              classification_metadata: classificationResponse,
              classification_reasoning: classificationResponse.classification_reasoning || '',
              title: classificationResponse.suggested_title || file.name, // Use the suggested title
              key_insights: classificationResponse.concepts ? classificationResponse.concepts.map(c => c.name) : [],
              processing_skip_reason: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', expertDoc.id);
          
          if (updateExpertError) {
            processingResults.push({
              file,
              classificationResult: classificationResponse,
              success: false,
              error: `Error updating expert_documents: ${updateExpertError.message}`
            });
            continue;
          }
        }
        
        // Add successful result
        processingResults.push({
          file,
          classificationResult: classificationResponse,
          success: true
        });
      } catch (error) {
        processingResults.push({
          file,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Save results if output path specified
    if (outputPath) {
      const outputDir = path.dirname(outputPath);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Format results
      const outputData = {
        timestamp: new Date().toISOString(),
        mode: dryRun ? 'dry-run' : 'live',
        totalProcessed: processingResults.length,
        successCount: processingResults.filter(r => r.success).length,
        failureCount: processingResults.filter(r => !r.success).length,
        results: processingResults.map(r => ({
          id: r.file.id,
          name: r.file.name,
          success: r.success,
          document_type_id: r.classificationResult?.document_type_id,
          document_type: r.classificationResult?.name,
          error: r.error
        }))
      };
      
      // Write to file
      fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    }
    
    return processingResults;
  } catch (error) {
    console.error('Error in reprocessDocxFiles:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

// Run CLI if this module is executed directly
if (require.main === module) {
  program.parse();
}

export default program;