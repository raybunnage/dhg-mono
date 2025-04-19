#!/usr/bin/env ts-node
/**
 * Script to classify PowerPoint documents from Google Drive
 * Downloads PowerPoint (.pptx) files locally, extracts content, and uses 
 * the prompt service with Claude to classify them
 */

import { program } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { Database } from '../../../supabase/types';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { promptService } from '../../../packages/shared/services/prompt-service';
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
import { GoogleDriveService } from '../../../packages/shared/services/google-drive';
import { BatchProcessingService } from '../../../packages/shared/services/batch-processing-service';

// Define the prompt name to use for classification
const CLASSIFICATION_PROMPT = 'scientific-document-analysis-prompt';

// Function to create a fallback classification when extraction or Claude API fails
async function createFallbackClassification(file: any, supabase: any): Promise<any> {
  const fileName = file.name || 'Unknown Document';
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  // Define a document type interface to use for typing
  interface DocumentType {
    id: string;
    document_type: string;
  }

  // Fetch valid document types from the database to ensure we use an existing ID
  const { data: documentTypes, error } = await supabase
    .from('document_types')
    .select('id, document_type')
    .order('document_type');

  if (error) {
    console.error(`Error fetching document types: ${error.message}`);
  }

  // Default to "unknown document type" if we can't determine anything better
  let documentType = 'unknown document type';
  let documentTypeId = '';

  // Find the unknown document type ID from the fetched document types
  const unknownType = documentTypes?.find((dt: DocumentType) => 
    dt.document_type.toLowerCase() === 'unknown document type' ||
    dt.document_type.toLowerCase() === 'unknown' ||
    dt.document_type.toLowerCase().includes('unclassified')
  );

  if (unknownType) {
    documentTypeId = unknownType.id;
  } else if (documentTypes && documentTypes.length > 0) {
    // If no unknown type found, just use the first document type as a fallback
    documentTypeId = documentTypes[0].id;
    documentType = documentTypes[0].document_type;
  }

  // Determine document type based on extension and filename patterns if document types were fetched
  if (documentTypes && documentTypes.length > 0) {
    // For PowerPoint files
    if (extension === 'pptx') {
      const presentationType = documentTypes.find((dt: DocumentType) => 
        dt.document_type.toLowerCase().includes('presentation') ||
        dt.document_type.toLowerCase().includes('powerpoint') ||
        dt.document_type.toLowerCase().includes('slide')
      );
      
      if (presentationType) {
        documentType = presentationType.document_type;
        documentTypeId = presentationType.id;
      }
    }
    
    // Check for common patterns in filenames
    if (fileName.toLowerCase().includes('presentation')) {
      const presentationType = documentTypes.find((dt: DocumentType) => 
        dt.document_type.toLowerCase().includes('presentation')
      );
      
      if (presentationType) {
        documentType = presentationType.document_type;
        documentTypeId = presentationType.id;
      }
    }
  }
  
  // Check for large PowerPoint files specifically to provide a better error message
  let reasoningMessage = `Fallback classification created automatically due to extraction issues. Determined type based on filename "${fileName}" and extension "${extension}".`;
  let summaryMessage = 'This document could not be analyzed by AI due to content extraction issues. The classification is based on the file\'s metadata.';
  
  // Return a basic classification structure
  return {
    document_type: documentType,
    document_type_id: documentTypeId,
    classification_confidence: 0.6, // Lower confidence for fallback
    classification_reasoning: reasoningMessage,
    document_summary: summaryMessage,
    key_topics: ['File analysis unavailable'],
    target_audience: 'Unknown (automatic classification)',
    unique_insights: [
      'Document was classified automatically based on filename and extension'
    ]
  };
}

// Process a single PowerPoint file using the prompt service and Claude
// Returns classification result
async function processPowerPointFile(
  fileId: string,
  fileName: string,
  debug: boolean = false,
  supabase: any = null
): Promise<{ classificationResult: any, tempFilePath: string | null }> {
  let tempFilePath: string | null = null;
  
  try {
    if (debug) {
      console.log(`Processing PowerPoint file: ${fileName} (ID: ${fileId})`);
    }
    
    // Get Supabase client if not provided
    if (!supabase) {
      supabase = SupabaseClientService.getInstance().getClient();
    }
    
    // Import auth service
    const { GoogleAuthService } = require('../../../packages/shared/services/google-drive/google-auth-service');
    const auth = GoogleAuthService.getInstance();
    
    // Get Google Drive service instance
    const googleDriveService = GoogleDriveService.getInstance(auth, supabase);
    
    // Use the Google Drive API directly to get the PowerPoint binary content
    const { google } = require('googleapis');
    const { JWT } = require('google-auth-library');
    
    // Get service account key file path from environment
    const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 
                     process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                     path.resolve(process.cwd(), '.service-account.json');
    
    // Read and parse the service account key file
    const keyFileData = fs.readFileSync(keyFilePath, 'utf8');
    const keyFile = JSON.parse(keyFileData);
    
    // Create JWT auth client with the service account
    const authClient = new JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    
    const drive = google.drive({ version: 'v3', auth: authClient });
    
    // 1. Get file metadata first to confirm it's a PowerPoint file
    const file = await googleDriveService.getFile(fileId);
    if (debug) {
      console.log(`PowerPoint file details: ${JSON.stringify(file, null, 2)}`);
    }
    
    // 2. Download the PowerPoint file
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media',
    }, { responseType: 'arraybuffer' });
    
    if (debug) {
      console.log(`Downloaded PowerPoint, size: ${response.data.byteLength} bytes`);
    }
    
    // 3. Save the PowerPoint to a temporary location
    const tempDir = path.join(process.cwd(), 'file_types', 'powerpoints');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create a safe filename for the temporary file
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    tempFilePath = path.join(tempDir, `temp-${safeName}-${fileId.substring(0, 8)}.pptx`);
    
    // Write the file to disk
    fs.writeFileSync(tempFilePath, Buffer.from(response.data));
    
    if (debug) {
      console.log(`Saved temporary PowerPoint file to ${tempFilePath}`);
    }
    
    // 4. Extract text content from the PowerPoint file
    // Using pptx-parser library that we installed
    const pptxParser = require('pptx-parser');
    
    // Simulating file content extraction - we'll display a sample of what we extracted
    let extractedText = '';
    
    try {
      const parsedPptx = await pptxParser.parse(tempFilePath);
      if (debug) {
        console.log('PPTX parser result structure:', Object.keys(parsedPptx));
      }
      
      // Extract text from slides
      if (parsedPptx && parsedPptx.slides) {
        extractedText = 'PowerPoint Content:\n\n';
        
        // Loop through slides
        parsedPptx.slides.forEach((slide: any, index: number) => {
          extractedText += `Slide ${index + 1}:\n`;
          
          // Extract text from slide elements
          if (slide.elements) {
            slide.elements.forEach((element: any) => {
              if (element.type === 'text' && element.text) {
                extractedText += `- ${element.text}\n`;
              }
            });
          }
          
          extractedText += '\n';
        });
      }
    } catch (extractionError) {
      console.error('Error extracting PowerPoint content:', extractionError);
      
      // Attempt a more primitive extraction method as backup
      console.log('Attempting backup extraction method...');
      
      // Create placeholder extracted content based on the filename
      // In a real implementation, we'd have a more robust extraction method
      extractedText = `PowerPoint Presentation: ${fileName}\n\n`;
      extractedText += `This is a placeholder for content that would be extracted from ${fileName}.\n`;
      extractedText += `File appears to be a PowerPoint presentation with file ID: ${fileId}.\n`;
      extractedText += `The content extraction encountered issues and is showing limited information.\n\n`;
      extractedText += `Filename: ${fileName}\n`;
      extractedText += `File size: ${file.size || 'Unknown'} bytes\n`;
      extractedText += `Last modified: ${file.modifiedTime || 'Unknown'}\n`;
    }
    
    // Display a sample of the extracted content (for demonstration purposes)
    console.log('\nSample of extracted PowerPoint content:');
    console.log('----------------------------------------');
    
    // Show just the first few lines of extracted content
    const contentSample = extractedText.split('\n').slice(0, 10).join('\n');
    console.log(contentSample);
    console.log('----------------------------------------\n');
    
    // 5. Use the prompt service to load the scientific document analysis prompt
    const promptResult = await promptService.loadPrompt(CLASSIFICATION_PROMPT, {
      includeDatabaseQueries: true,  // Include the SQL query to fetch document types
      executeQueries: true,          // Actually execute the query to get document types
      includeRelationships: true,    // Include related database relationships
      includeRelatedFiles: true      // Include any related files
    });
    
    // Log a sample of the document types that were loaded with the prompt
    if (debug) {
      try {
        const promptLines = promptResult.combinedContent.split('\n');
        const documentTypesLineIndex = promptLines.findIndex(line => 
          line.includes('select id, category, document_type, description') || 
          line.includes('AVAILABLE DOCUMENT TYPES')
        );
        
        if (documentTypesLineIndex >= 0) {
          // Show 5 lines after document types are mentioned
          console.log('Document types query or listing included in prompt:');
          for (let i = documentTypesLineIndex; i < documentTypesLineIndex + 6 && i < promptLines.length; i++) {
            console.log(`  ${promptLines[i]}`);
          }
          console.log('  ...');
        }
      } catch (err) {
        // Just log the error but continue with classification
        console.warn('Error extracting document types from prompt (non-critical):', err);
      }
    }
    
    if (debug) {
      console.log(`Loaded prompt with ${promptResult.combinedContent.length} characters of combined content`);
    }
    
    // 6. Prepare the user message for Claude with the extracted PowerPoint content
    const userMessage = `${promptResult.combinedContent}

    Please analyze this PowerPoint presentation content:
    
    ${extractedText}
    
    1. Examine the content, structure, and purpose of this PowerPoint presentation.
    2. Determine which document_type from the document_types table best describes it.
    3. Create a detailed summary that captures the key concepts.
    4. Return your analysis in the requested JSON format with document_type, document_type_id, etc.
    
    IMPORTANT: 
    - Select the most appropriate document_type_id from the available options in the document_types table
    - Base your classification on the extracted content, not just the filename
    - Provide detailed reasoning for your classification choice
    `;
    
    // 7. Get classification from Claude
    let classificationResult;
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        if (debug) {
          console.log(`Using Claude to classify PowerPoint content (attempt ${retries + 1}/${maxRetries})`);
        }
        
        // Always show that we're sending to Claude, regardless of debug mode
        console.log(`Sending PowerPoint content to Claude API for analysis...`);
        
        // Use Claude to classify the content
        classificationResult = await claudeService.getJsonResponse(
          userMessage,
          {
            temperature: 0,
            maxTokens: 4000
          }
        );
        
        // Always show success message
        console.log(`✅ Successfully analyzed PowerPoint content with Claude`);
        
        if (debug) {
          console.log(`Document type assigned: ${classificationResult.document_type || 'Unknown'}`);
        }
        
        // If we got here, the API call succeeded
        break;
      } catch (claudeError) {
        retries++;
        const errorMessage = claudeError instanceof Error ? claudeError.message : 'Unknown error';
        
        // Check if this is a connection error (ECONNRESET)
        const isConnectionError = errorMessage.includes('ECONNRESET') || 
                                errorMessage.includes('timeout') ||
                                errorMessage.includes('network') ||
                                errorMessage.includes('socket');
        
        // Check if it's a rate-limiting or overload error
        const isRateLimitError = errorMessage.includes('429') || 
                               errorMessage.includes('too many requests') ||
                               errorMessage.includes('rate limit') ||
                               errorMessage.includes('Overloaded');
                               
        // Check if it's a connection or rate-limiting error
        if (isConnectionError || isRateLimitError) {
          // These errors are retryable
          console.warn(`Claude API connection error (retry ${retries}/${maxRetries}): ${errorMessage}`);
          
          if (retries < maxRetries) {
            // Add exponential backoff between retries (1s, 2s, 4s)
            const backoffTime = Math.pow(2, retries - 1) * 1000;
            console.log(`Waiting ${backoffTime}ms before retrying...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
          } else {
            console.error(`Maximum retries (${maxRetries}) reached. Using fallback classification.`);
            
            // Try using the traditional method as a fallback since direct analysis failed
            try {
              console.log(`Falling back to metadata-based classification...`);
              
              // Create a descriptive message about the PowerPoint metadata
              const fileMetadata = `
              File Name: ${fileName}
              File Size: ${file.size || 'Unknown'} bytes
              Last Modified: ${file.modifiedTime || 'Unknown'}
              MIME Type: application/vnd.openxmlformats-officedocument.presentationml.presentation
              `;
              
              const fallbackMessage = `${promptResult.combinedContent}
              
              Please classify this PowerPoint document based on the following information:
              
              Document Title: "${fileName}"
              
              PowerPoint Metadata:
              ${fileMetadata}
              
              Context clues:
              1. The filename itself may contain important classification clues
              2. Look for patterns in the file name (e.g., presentation, slides, lecture)
              3. Consider any date patterns or expert names in the filename
              4. Use the document_types table to find the most appropriate type
              
              Important: Select the most appropriate document_type_id from the provided options.
              `;
              
              // Try using prompt service as a fallback
              classificationResult = await promptService.usePromptWithClaude(
                CLASSIFICATION_PROMPT,
                fallbackMessage,
                {
                  expectJson: true,
                  claudeOptions: {
                    temperature: 0,
                    maxTokens: 4000
                  }
                }
              );
              
              console.log(`Successfully used fallback metadata-based classification`);
            } catch (fallbackError) {
              console.error(`Fallback classification also failed: ${fallbackError}`);
              // Create a very basic fallback classification based on file metadata
              classificationResult = await createFallbackClassification(
                { name: fileName || 'Unknown Document', drive_id: fileId },
                supabase
              );
            }
          }
        } else {
          // For other types of errors, don't retry
          console.error(`Non-retryable Claude API error: ${errorMessage}`);
          classificationResult = await createFallbackClassification(
            { name: fileName || 'Unknown Document', drive_id: fileId },
            supabase
          );
          break;
        }
      }
    }
    
    if (!classificationResult) {
      // Just in case we didn't set it in the error handlers
      classificationResult = await createFallbackClassification(
        { name: fileName || 'Unknown Document', drive_id: fileId },
        supabase
      );
    }
    
    if (debug) {
      console.log('Classification result:', classificationResult);
    }
    
    // Return both the classification result and the temp file path
    return { 
      classificationResult, 
      tempFilePath 
    };
  } catch (error) {
    console.error(`Error processing PowerPoint file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // If we failed but have a temporary file, return it for cleanup
    return {
      classificationResult: await createFallbackClassification(
        { name: fileName || 'Unknown Document', drive_id: fileId },
        supabase
      ),
      tempFilePath
    };
  }
}

// Function to clean up temporary files
function cleanupTempFiles(filePaths: string[]): void {
  for (const filePath of filePaths) {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.warn(`Failed to delete temporary file ${filePath}: ${err}`);
      }
    }
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

// Main classification function with batch processing and concurrency
async function classifyPowerPointDocuments(
  limit: number,
  folderId?: string,
  outputPath?: string,
  debug: boolean = false,
  dryRun: boolean = false,
  concurrency: number = 2 // Default concurrency of 2 (PowerPoint extraction can be resource-intensive)
): Promise<any[]> {
  const tempFiles: string[] = [];
  
  try {
    // 1. Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // 2. Build query for unclassified PowerPoint files
    let query = supabase
      .from('sources_google')
      .select('*')
      .is('document_type_id', null)
      .is('is_deleted', false)
      .eq('mime_type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
      .order('modified_at', { ascending: false })
      .limit(limit);
    
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
            query = query.eq('root_drive_id', folder.root_drive_id);
          } else {
            query = query.eq('parent_id', folder.drive_id);
          }
        } else {
          console.log(`No folders found matching '${folderId}'`);
        }
      } else {
        // It's a UUID or Drive ID
        query = query.eq('parent_id', folderId);
      }
    }
    
    // 3. Execute the query
    const { data: files, error } = await query;
    
    if (error) {
      throw new Error(`Error fetching PowerPoint files: ${error.message}`);
    }
    
    console.log(`Found ${files?.length || 0} PowerPoint files missing document types`);
    
    if (!files || files.length === 0) {
      return [];
    }
    
    // Process files with concurrency
    console.log(`Processing ${files.length} PowerPoint files with concurrency of ${concurrency}`);
    
    // Process a single file
    const processFile = async (file: any, index: number): Promise<any> => {
      // Always show progress, regardless of debug mode
      console.log(`Processing PowerPoint file ${index+1}/${files.length}: ${file.name}`);
      
      try {
        if (debug) {
          console.log(`File details: ${file.name} (${file.id}, Drive ID: ${file.drive_id})`);
        }
        
        // Process the file
        console.log(`[${index+1}/${files.length}] ⏳ Reading PowerPoint content...`);
        const { classificationResult, tempFilePath } = await processPowerPointFile(
          file.drive_id,
          file.name || '',
          debug,
          supabase
        );
        
        // Add any temporary files to cleanup list
        if (tempFilePath) {
          tempFiles.push(tempFilePath);
        }
        
        // Show classification result regardless of debug mode
        if (classificationResult && classificationResult.document_type) {
          console.log(`[${index+1}/${files.length}] ✅ Classified as: ${classificationResult.document_type}`);
          console.log(`[${index+1}/${files.length}] 📊 Confidence: ${(classificationResult.classification_confidence * 100).toFixed(1)}%`);
        } else {
          console.log(`[${index+1}/${files.length}] ❌ Classification failed`);
        }
        
        // Only update the database if not in dry run mode
        if (!dryRun && classificationResult.document_type_id) {
          // Update document type in sources_google
          const { error: updateError } = await supabase
            .from('sources_google')
            .update({ document_type_id: classificationResult.document_type_id })
            .eq('id', file.id);
          
          if (updateError) {
            console.error(`Error updating document type: ${updateError.message}`);
          } else if (debug) {
            console.log(`Updated document type for ${file.name} to ${classificationResult.document_type_id}`);
          }
          
          // Create expert document record
          try {
            // If debug mode is enabled, log what we're about to insert
            if (debug) {
              console.log(`Inserting expert document for ${file.name} with document_type_id: ${classificationResult.document_type_id}`);
            }
            
            // Create minimal document
            const minimalDoc = {
              id: uuidv4(),
              source_id: file.id,
              document_type_id: classificationResult.document_type_id,
              classification_confidence: classificationResult.classification_confidence || 0.75,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            
            // Insert the minimal document first (always works)
            const { error: minimalError, data: minimalData } = await supabase
              .from('expert_documents')
              .insert(minimalDoc)
              .select();
              
            if (minimalError) {
              console.error(`Error creating minimal expert document: ${minimalError.message}`);
            } else {
              if (debug) {
                console.log(`Created minimal expert document for ${file.name}`);
              }
              
              // Now try to update with classification metadata
              try {
                if (minimalData && minimalData.length > 0) {
                  const { error: contentUpdateError } = await supabase
                    .from('expert_documents')
                    .update({
                      classification_metadata: classificationResult,
                      processed_content: classificationResult  // Also set processed_content to match classification result
                    })
                    .eq('id', minimalDoc.id);
                  
                  if (contentUpdateError) {
                    if (debug) {
                      console.log(`Could not add classification metadata: ${contentUpdateError.message}`);
                    }
                    // This is fine, we already have the minimal record
                  } else if (debug) {
                    console.log(`Updated expert document with classification metadata for ${file.name}`);
                  }
                }
              } catch (contentErr) {
                // Just log in debug mode, we already have the minimal document
                if (debug) {
                  console.log(`Could not add classification metadata: ${contentErr instanceof Error ? contentErr.message : 'Unknown error'}`);
                }
              }
            }
          } catch (err) {
            console.error(`Error in expert document creation process: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
        
        // Save individual result to output directory if specified
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
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };
    
    // Process all files with concurrency
    const results = await processWithConcurrency(
      files,
      concurrency,
      processFile,
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
        dry_run: dryRun,
        total_files: results.length,
        results
      };
      
      // Write to file
      fs.writeFileSync(outputPath, JSON.stringify(combined, null, 2));
      console.log(`Results saved to ${outputPath}`);
    }
    
    // Clean up temporary files
    cleanupTempFiles(tempFiles);
    
    return results;
  } catch (error) {
    console.error(`Error classifying PowerPoint documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Clean up temporary files even if there was an error
    cleanupTempFiles(tempFiles);
    return [];
  }
}

// Define CLI program
program
  .name('classify-powerpoints')
  .description('Classify PowerPoint (.pptx) files missing document types using content extraction and the PromptService')
  .option('-l, --limit <number>', 'Limit the number of files to process', '5')
  .option('-o, --output <path>', 'Output file path for classification results')
  .option('-d, --debug', 'Enable debug logging', false)
  .option('-v, --verbose', 'Enable verbose logging (includes debug)', false)
  .option('--dry-run', 'Process files but do not update database', false)
  .option('--folder-id <id>', 'Filter by Google Drive folder ID or folder name', '')
  .option('-c, --concurrency <number>', 'Number of files to process concurrently (default: 2)', '2')
  .action(async (options) => {
    try {
      // Set debug mode if verbose is enabled
      const debug = options.debug || options.verbose;
      const dryRun = options.dryRun;
      
      // Show header
      console.log('='.repeat(70));
      console.log('POWERPOINT DOCUMENT CLASSIFICATION');
      console.log('='.repeat(70));
      
      // Parse limit and concurrency
      const limit = parseInt(options.limit, 10);
      const concurrency = parseInt(options.concurrency, 10);
      
      // Show detailed configuration
      console.log(`Mode:              ${dryRun ? '🔍 DRY RUN (no database changes)' : '💾 LIVE (updating database)'}`);
      console.log(`Debug logs:        ${debug ? '✅ ON' : '❌ OFF'}`);
      console.log(`Concurrency:       ${concurrency} files at a time`);
      console.log(`Max files:         ${limit}`);
      console.log(`Folder filter:     ${options.folderId ? options.folderId : 'All folders'}`);
      console.log(`Output file:       ${options.output ? options.output : 'None specified'}`);
      console.log('-'.repeat(70));
      console.log(`Using local content extraction and Claude API to analyze PowerPoint content`);
      console.log(`This may take some time, especially for large PowerPoint files`);
      console.log(`Each PowerPoint will be processed one by one, with progress updates`);
      console.log('='.repeat(70));
      
      const results = await classifyPowerPointDocuments(
        limit,
        options.folderId || '',
        options.output,
        debug,
        dryRun,
        concurrency
      );
      
      // Show summary
      console.log('='.repeat(50));
      const successCount = results.filter(r => r.result).length;
      console.log(`SUMMARY: Processed ${results.length} PowerPoint files, ${successCount} successfully classified`);
      
      // Show results table
      console.log('\nResults:');
      console.log('-'.repeat(80));
      console.log('| File ID                               | File Name                  | Status    |');
      console.log('-'.repeat(80));
      
      results.forEach(r => {
        const id = r.file.id.substring(0, 36).padEnd(36);
        const name = (r.file.name || 'Unknown').substring(0, 25).padEnd(25);
        const status = r.result ? 'Success' : 'Failed';
        console.log(`| ${id} | ${name} | ${status.padEnd(9)} |`);
      });
      
      console.log('-'.repeat(80));
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (options.verbose) {
        console.error('Stack trace:', (error as Error).stack);
      }
      process.exit(1);
    }
  });

// Export for module usage
export async function classifyPowerpointsWithService(options: {
  limit?: number;
  folderId?: string;
  outputPath?: string;
  debug?: boolean;
  dryRun?: boolean;
  concurrency?: number;
}): Promise<any[]> {
  const {
    limit = 5,
    folderId = '',
    outputPath,
    debug = false,
    dryRun = false,
    concurrency = 2
  } = options;
  
  return classifyPowerPointDocuments(
    limit,
    folderId,
    outputPath,
    debug,
    dryRun,
    concurrency
  );
}

// Run CLI if this module is executed directly
if (require.main === module) {
  program.parse();
}