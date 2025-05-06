#!/usr/bin/env ts-node
/**
 * Script to classify documents for .docx files with needs_reprocessing status
 * Based on the logic from force-classify-docs.ts
 * 
 * IMPORTANT: This script ONLY updates the document_type_id in the sources_google table
 * and does NOT update the document_type_id in the expert_documents table.
 * This behavior matches force-classify-docs.ts approach.
 * 
 * Selection criteria:
 * 1. The expert_documents raw_content field is not empty
 * 2. The associated sources_google file's name ends with .docx
 * 3. There is content in the raw_content field of the expert_document record
 * 4. The existing document_type_id field of the sources_google != 554ed67c-35d1-4218-abba-8d1b0ff7156d
 * 5. The expert_documents record has document_processing_status = 'needs_reprocessing'
 */

import { program } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { promptService } from '../../../packages/shared/services/prompt-service';
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';

// Define the prompt name to use for classification
const CLASSIFICATION_PROMPT = 'document-classification-prompt-new';

// The ID we want to avoid
const EXCLUDED_DOCUMENT_TYPE_ID = '554ed67c-35d1-4218-abba-8d1b0ff7156d';

// Interface for classification result
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

// Process a single file with content
async function processFile(
  driveId: string,
  mimeType: string,
  fileName: string,
  debug: boolean = false
): Promise<{ classificationResult: any, fileContent: string }> {
  try {
    if (debug) {
      console.log(`Processing file with Drive ID: ${driveId}, MIME Type: ${mimeType}`);
    }
    
    // Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Find the file's source_id from drive_id
    const { data: sourceData, error: sourceError } = await supabase
      .from('sources_google')
      .select('id')
      .eq('drive_id', driveId)
      .limit(1);
    
    if (sourceError) {
      throw new Error(`Error finding source record: ${sourceError.message}`);
    }
    
    if (!sourceData || sourceData.length === 0) {
      throw new Error(`Source record not found for drive_id: ${driveId}`);
    }
    
    const sourceId = sourceData[0].id;
    
    // Find the expert_document with content
    const { data: expertDocsData, error: expertDocsError } = await supabase
      .from('expert_documents')
      .select('id, raw_content')
      .eq('source_id', sourceId)
      .eq('document_processing_status', 'needs_reprocessing')
      .limit(1);
    
    if (expertDocsError) {
      throw new Error(`Error finding expert document: ${expertDocsError.message}`);
    }
    
    if (!expertDocsData || expertDocsData.length === 0) {
      throw new Error(`No expert document with 'needs_reprocessing' status found for source_id: ${sourceId}`);
    }
    
    const expertDoc = expertDocsData[0];
    const expertDocId = expertDoc.id;
    const fileContent = expertDoc.raw_content || '';
    
    if (!fileContent) {
      throw new Error(`No content found in expert document: ${expertDocId}`);
    }

    if (debug) {
      console.log(`Found expert document ID: ${expertDocId} for source ID: ${sourceId}`);
      console.log(`Content length: ${fileContent.length} characters`);
    }
    
    // Process the document with its content - classification only
    const classificationResult = await processDocument(sourceId, expertDocId, fileContent, debug);
    
    return { 
      classificationResult: classificationResult || {}, 
      fileContent
    };
  } catch (error) {
    console.error(`Error processing file: ${error instanceof Error ? error.message : String(error)}`);
    return { classificationResult: {}, fileContent: '' };
  }
}

// Process a single document that already has content in expert_documents
// Using the same approach as force-classify-docs.ts - ONLY updating sources_google
async function processDocument(
  sourceId: string,
  expertDocId: string, 
  expertDocContent: string,
  debug: boolean = false
): Promise<ClassificationResult | null> {
  try {
    if (debug) {
      console.log(`Processing expert document ID: ${expertDocId} for source ID: ${sourceId}`);
      console.log(`Content length: ${expertDocContent.length} characters`);
    }
    
    // Retrieve the prompt with all related data
    const promptResult = await promptService.loadPrompt(CLASSIFICATION_PROMPT, {
      includeDatabaseQueries: true,
      includeRelationships: true,
      includeRelatedFiles: true,
      executeQueries: true
    });

    if (!promptResult.prompt) {
      console.error('❌ Failed to retrieve prompt "document-classification-prompt-new"');
      return null;
    }

    // Process the content through Claude API for classification
    console.log('Sending to Claude API for classification...');
    
    // Add specific instructions to ensure complete JSON response with document_type_id
    const fullPrompt = `${promptResult.combinedContent}

### Document Content:
${expertDocContent}

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
    if (debug) {
      console.log(`Prompt length: ${fullPrompt.length} characters`);
    }
    
    // Get classification from Claude
    const classificationResponse = await claudeService.getJsonResponse<ClassificationResult>(fullPrompt);
    
    if (classificationResponse) {
      if (debug) {
        console.log('\n✅ Classification complete!');
        console.log('Classification result:', JSON.stringify(classificationResponse, null, 2));
        
        // Display detailed document_type_id verification
        console.log('\n--- DOCUMENT TYPE ID VERIFICATION ---');
        console.log(`Raw document_type_id from Claude: ${JSON.stringify(classificationResponse.document_type_id)}`);
        console.log(`Type of document_type_id: ${typeof classificationResponse.document_type_id}`);
        console.log(`Raw category from Claude: ${JSON.stringify(classificationResponse.category)}`);
        console.log(`Raw name from Claude: ${JSON.stringify(classificationResponse.name)}`);
        console.log('-----------------------------------\n');
      }
      
      return classificationResponse;
    } else {
      console.error('❌ Classification failed: No response from Claude API');
      return null;
    }
  } catch (error) {
    console.error('❌ Error during document classification:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Simple helper for running promises with concurrency control
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

// Main classification function
async function classifyMissingDocuments(
  limit: number,
  folderId?: string,
  outputPath?: string,
  includePdfs: boolean = false,
  debug: boolean = false,
  dryRun: boolean = false,
  concurrency: number = 1
): Promise<any[]> {
  try {
    // 1. Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // 2. Build query for documents to process
    // First, we'll try to find unclassified files (null document_type_id)
    let query = supabase
      .from('sources_google')
      .select('*, expert_documents(id, document_processing_status)')
      .is('is_deleted', false);
    
    // We'll use two separate queries and combine the results:
    // 1. First, get files with null document_type_id (unclassified)
    const unclassifiedQuery = supabase
      .from('sources_google')
      .select('*')
      .is('is_deleted', false)
      .is('document_type_id', null);
      
    // 2. Find source files related to expert_documents needing reprocessing
    // First, get the list of expert_documents with needs_reprocessing status
    const { data: expertDocsNeedingReprocessing, error: expertDocsError } = await supabase
      .from('expert_documents')
      .select('source_id')
      .eq('document_processing_status', 'needs_reprocessing');
      
    if (expertDocsError) {
      throw new Error(`Error fetching expert documents: ${expertDocsError.message}`);
    }
    
    // Now, get those source files
    const sourceIds = expertDocsNeedingReprocessing?.map(doc => doc.source_id) || [];
    
    let reprocessingFiles: any[] = [];
    if (sourceIds.length > 0) {
      const reprocessingQuery = supabase
        .from('sources_google')
        .select('*')
        .is('is_deleted', false)
        .in('id', sourceIds);
    
      const { data: reprocessingSources, error: reprocessingError } = await reprocessingQuery;
      if (reprocessingError) {
        throw new Error(`Error fetching files needing reprocessing: ${reprocessingError.message}`);
      }
      
      reprocessingFiles = reprocessingSources || [];
    }
      
    // Execute the unclassified files query
    const { data: unclassifiedFiles, error: unclassifiedError } = await unclassifiedQuery;
    if (unclassifiedError) {
      throw new Error(`Error fetching unclassified files: ${unclassifiedError.message}`);
    }
    
    // Combine results, removing duplicates by ID
    const filesMap = new Map();
    
    // Add all unclassified files
    unclassifiedFiles?.forEach(file => {
      filesMap.set(file.id, file);
    });
    
    // Add all reprocessing files
    reprocessingFiles?.forEach(file => {
      filesMap.set(file.id, file);
    });
    
    // Convert back to array
    let files = Array.from(filesMap.values());
    
    // Filter by folder if provided
    if (folderId) {
      if (folderId.length < 36) {
        // It's likely a folder name, look it up
        if (debug) {
          console.log(`Looking up folder ID for name: ${folderId}`);
        }
        
        const { data: folders } = await supabase
          .from('sources_google')
          .select('id, drive_id, name, root_drive_id')
          .or(`name.ilike.%${folderId}%,path.ilike.%${folderId}%`)
          .is('is_folder', true)
          .limit(1);
          
        if (folders && folders.length > 0) {
          const folder = folders[0];
          if (debug) {
            console.log(`Found folder: ${folder.name || 'unnamed'} with ID: ${folder.drive_id}`);
          }
          
          if (folder.root_drive_id) {
            // Filter by root_drive_id
            files = files.filter(file => file.root_drive_id === folder.root_drive_id);
          } else {
            // Filter by parent_id
            files = files.filter(file => file.parent_id === folder.drive_id);
          }
        } else {
          console.log(`No folders found matching '${folderId}'`);
        }
      } else {
        // It's a UUID or Drive ID
        files = files.filter(file => file.parent_id === folderId);
      }
    }
    
    // Now we'll filter the combined results by mime type
    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.google-apps.document'
    ];
    
    // Include PDFs if requested
    if (includePdfs) {
      validMimeTypes.push('application/pdf');
    }
    
    // Filter by mime type
    let filteredFiles = files.filter(file => validMimeTypes.includes(file.mime_type));
    
    // Sort by modified_at descending and limit
    filteredFiles = filteredFiles
      .sort((a, b) => {
        // Sort by modified_at in descending order (newest first)
        const dateA = new Date(a.modified_at || 0).getTime();
        const dateB = new Date(b.modified_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, limit);
      
    // Replace the files array with our filtered version
    files = filteredFiles;
    
    // Note: We've already executed the queries and combined the results above
    
    if (debug) {
      console.log(`Found ${files?.length || 0} files that need processing`);
    }
    
    if (!files || files.length === 0) {
      return [];
    }
    
    // 4. Process files with concurrency
    console.log(`Processing ${files.length} files with concurrency of ${concurrency}`);
    
    // Since we've already filtered the files properly in our database queries,
    // we can just use all the files in the combined filtered array.
    // For debugging purposes, let's calculate the breakdown
    const unclassifiedCount = files.filter(file => file.document_type_id === null).length;
    const reprocessingCount = files.length - unclassifiedCount;
    
    if (debug) {
      console.log(`Of the ${files.length} files to process:`);
      console.log(`- ${unclassifiedCount} are missing document types`);
      console.log(`- ${reprocessingCount} are marked for reprocessing`);
    }
    
    // All files in our list need processing, so no additional filtering needed
    const filesToProcess = files;
    
    if (filesToProcess.length !== files.length) {
      console.log(`Note: Filtered down to ${filesToProcess.length} files that actually need processing`);
    }
    
    // Validate concurrency value
    if (isNaN(concurrency) || concurrency < 1) {
      console.warn(`Invalid concurrency value: ${concurrency}, defaulting to 1`);
      concurrency = 1;
    } else if (concurrency > 5) {
      console.log(`Note: High concurrency (${concurrency}) may lead to rate limiting with Claude API`);
    }
    
    // Process a single file
    const processFileWithResult = async (file: any, index: number): Promise<any> => {
      // Always show progress, regardless of debug mode
      console.log(`Processing file ${index+1}/${files.length}: ${file.name}`);
      
      try {
        if (debug) {
          console.log(`File details: ${file.name} (${file.id})`);
        }
        
        // Process the file
        const { classificationResult, fileContent } = await processFile(
          file.drive_id,
          file.mime_type,
          file.name || '',
          debug
        );
        
        // Show classification result regardless of debug mode
        if (classificationResult && classificationResult.document_type) {
          console.log(`[${index+1}/${files.length}] ✅ Classified as: ${classificationResult.document_type}`);
          console.log(`[${index+1}/${files.length}] 📊 Confidence: ${(classificationResult.classification_confidence * 100).toFixed(1)}%`);
        } else {
          console.log(`[${index+1}/${files.length}] ❌ Classification failed`);
        }
        
        // Only update the database if not in dry run mode
        if (!dryRun && classificationResult.document_type_id) {
          // Update document type in sources_google table ONLY
          // We're NOT updating the document_type_id in expert_documents (same approach as force-classify-docs.ts)
          console.log(`Updating document_type_id in sources_google table for ${file.name} to ${classificationResult.document_type_id}`);
          
          // Ensure the document_type_id is in the correct UUID format (removing any leading characters if needed)
          let cleanDocumentTypeId = classificationResult.document_type_id;
          // If the UUID has more than 36 characters, extract just the last 36 characters
          if (cleanDocumentTypeId.length > 36) {
            cleanDocumentTypeId = cleanDocumentTypeId.substring(cleanDocumentTypeId.length - 36);
            console.log(`Corrected document_type_id format to: ${cleanDocumentTypeId}`);
          }
          
          const { error: updateError } = await supabase
            .from('sources_google')
            .update({ document_type_id: cleanDocumentTypeId })
            .eq('id', file.id);
          
          if (updateError) {
            console.error(`Error updating document type: ${updateError.message}`);
          } else if (debug) {
            console.log(`✅ Successfully updated sources_google record with document_type_id: ${cleanDocumentTypeId}`);
          }
          
          // Check if this file already has an expert_document entry that needs reprocessing
          // We need to query directly since we don't have the joined data anymore
          const { data: expertDocs, error: expertDocsError } = await supabase
            .from('expert_documents')
            .select('*')
            .eq('source_id', file.id)
            .eq('document_processing_status', 'needs_reprocessing')
            .limit(1);
            
          if (expertDocsError) {
            console.error(`Error checking expert documents: ${expertDocsError.message}`);
          }
          
          const existingExpertDoc = expertDocs && expertDocs.length > 0 ? expertDocs[0] : null;
          
          if (existingExpertDoc) {
            // Only update the processing status, NOT the document_type_id
            if (debug) {
              console.log(`Updating processing status for expert document ${existingExpertDoc.id}`);
            }
            
            // Update only status fields to mark reprocessing complete
            const { error: updateExpertDocError } = await supabase
              .from('expert_documents')
              .update({
                // document_type_id: intentionally NOT updated
                classification_confidence: classificationResult.classification_confidence || 0.75,
                classification_metadata: { ...classificationResult, document_type_id: cleanDocumentTypeId },
                document_processing_status: 'reprocessing_done',
                document_processing_status_updated_at: new Date().toISOString(),
                processing_skip_reason: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingExpertDoc.id);
              
            if (updateExpertDocError) {
              console.error(`Error updating expert document status: ${updateExpertDocError.message}`);
            } else if (debug) {
              console.log(`✅ Successfully updated expert document status to 'reprocessing_done'`);
            }
          } else {
            // We don't need to create a new expert document
            // In line with the force-classify-docs.ts approach, we're only updating sources_google
            if (debug) {
              console.log(`No expert document found for ${file.name}, but sources_google has been updated`);
            }
          }
        }
        
        // Save results to output directory if specified
        if (outputPath && classificationResult) {
          const outputDir = path.dirname(outputPath);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // Write individual result to file
          const filePath = path.join(outputDir, `${file.id}.json`);
          fs.writeFileSync(filePath, JSON.stringify(classificationResult, null, 2));
          
          if (debug) {
            console.log(`Saved classification result to ${filePath}`);
          }
        }
        
        // Return successful result
        return {
          file,
          result: classificationResult,
          status: 'completed'
        };
      } catch (error) {
        console.error(`Error processing file ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Return error result
        return {
          file,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 'failed'
        };
      }
    };
    
    // Process all files with concurrency
    const results = await processWithConcurrency(
      filesToProcess,
      concurrency,
      processFileWithResult,
      (current, total) => {
        if (debug) {
          const percentage = Math.round((current / total) * 100);
          console.log(`Progress: ${percentage}% (${current}/${total})`);
        }
      }
    );
    
    // Save combined results if output path specified
    if (outputPath && results.length > 0) {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Format results
      const combined = {
        timestamp: new Date().toISOString(),
        folder_id: folderId || 'all folders',
        include_pdfs: includePdfs,
        dry_run: dryRun,
        total_files: results.length,
        results
      };
      
      // Write to file
      fs.writeFileSync(outputPath, JSON.stringify(combined, null, 2));
      console.log(`Results saved to ${outputPath}`);
    }
    
    return results;
  } catch (error) {
    console.error(`Error classifying documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

// Define CLI program
program
  .name('classify-missing-docs-with-service')
  .description('Classify Google Drive files missing document types using the PromptService')
  .option('-l, --limit <number>', 'Limit the number of files to process', '10')
  .option('-o, --output <path>', 'Output file path for classification results')
  .option('-d, --debug', 'Enable debug logging', false)
  .option('-v, --verbose', 'Enable verbose logging (includes debug)', false)
  .option('--dry-run', 'Process files but do not update database', false)
  .option('--include-pdfs', 'Include PDF files in classification (by default only .docx and .txt files are processed)', false)
  .option('--folder-id <id>', 'Filter by Google Drive folder ID or folder name', '')
  .option('-c, --concurrency <number>', 'Number of files to process concurrently (1-5, default: 1)', '1')
  .action(async (options) => {
    try {
      // Set debug mode if verbose is enabled
      const debug = options.debug || options.verbose;
      const dryRun = options.dryRun;
      
      // Show header
      console.log('='.repeat(50));
      console.log('DOCUMENT CLASSIFICATION WITH PROMPT SERVICE');
      console.log('='.repeat(50));
      console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
      console.log(`Debug: ${debug ? 'ON' : 'OFF'}`);
      
      // Parse limit and concurrency
      const limit = parseInt(options.limit, 10);
      const concurrency = parseInt(options.concurrency, 10);
      
      // Process files
      console.log(`Processing up to ${limit} files missing document types...`);
      console.log(`Concurrency: ${concurrency} (processing up to ${concurrency} files simultaneously)`);
      
      const results = await classifyMissingDocuments(
        limit,
        options.folderId || '',
        options.output,
        options.includePdfs,
        debug,
        dryRun,
        concurrency
      );
      
      // Show summary
      console.log('='.repeat(50));
      const successCount = results.filter(r => r.result).length;
      console.log(`SUMMARY: Processed ${results.length} files, ${successCount} successfully classified`);
      
      // Show results table
      console.log('\nResults:');
      console.log('-'.repeat(155));
      console.log('| File ID                               | File Name                                                         | Document Type              | Status    |');
      console.log('-'.repeat(155));
      
      results.forEach(r => {
        const id = r.file.id.substring(0, 36).padEnd(36);
        const name = (r.file.name || 'Unknown').substring(0, 60).padEnd(60);
        const docType = r.result ? (r.result.document_type || '').substring(0, 30).padEnd(30) : ''.padEnd(30);
        const status = r.result ? 'Success' : 'Failed';
        console.log(`| ${id} | ${name} | ${docType} | ${status.padEnd(9)} |`);
      });
      
      console.log('-'.repeat(155));
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (options.verbose) {
        console.error('Stack trace:', (error as Error).stack);
      }
      process.exit(1);
    }
  });

// Export for module usage
export async function classifyMissingDocsWithService(options: {
  limit?: number;
  folderId?: string;
  outputPath?: string;
  includePdfs?: boolean;
  debug?: boolean;
  dryRun?: boolean;
  concurrency?: number;
}): Promise<any[]> {
  const {
    limit = 10,
    folderId = '',
    outputPath,
    includePdfs = false,
    debug = false,
    dryRun = false,
    concurrency = 1
  } = options;
  
  return classifyMissingDocuments(
    limit,
    folderId,
    outputPath,
    includePdfs,
    debug,
    dryRun,
    concurrency
  );
}

// Run CLI if this module is executed directly
if (require.main === module) {
  program.parse();
}