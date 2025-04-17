#!/usr/bin/env ts-node
/**
 * Script to classify missing document types from Google Drive files
 * Uses the document classification service with the new PromptService
 */

import { program } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as mammoth from 'mammoth';
import { Database } from '../../../supabase/types';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { promptService } from '../../../packages/shared/services/prompt-service';
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
import { GoogleDriveService } from '../../../packages/shared/services/google-drive';

// Define the prompt name to use for classification
const CLASSIFICATION_PROMPT = 'document-classification-prompt-new';

// Function to create a fallback classification when Claude API fails
function createFallbackClassification(file: any): any {
  const fileName = file.name || 'Unknown Document';
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Determine document type based on file extension and name
  let documentType = 'unknown document type';
  let documentTypeId = '9dbe32ff-5e82-4586-be63-1445e5bcc548'; // ID for unknown document type
  
  // Basic file type detection from extension and name patterns
  if (extension === 'docx' || extension === 'doc') {
    documentType = 'word document';
    documentTypeId = 'bb90f01f-b6c4-4030-a3ea-db9dd8c4b55a';
  } else if (extension === 'txt') {
    documentType = 'text document';
    documentTypeId = '99db0af9-0e09-49a7-8405-899849b8a86c';
  }
  
  // Check if it's a transcript based on filename patterns
  if (fileName.toLowerCase().includes('transcript')) {
    documentType = 'presentation transcript';
    documentTypeId = 'c1a7b78b-c61e-44a4-8b77-a27a38cbba7e';
  }
  
  // Return a basic classification structure
  return {
    document_type: documentType,
    document_type_id: documentTypeId,
    classification_confidence: 0.6, // Lower confidence for fallback
    classification_reasoning: `Fallback classification created automatically due to API issues. Determined type based on filename "${fileName}" and extension "${extension}".`,
    document_summary: `This document could not be analyzed by AI due to service connectivity issues. The classification is based on the file's metadata.`,
    key_topics: ['File analysis unavailable'],
    target_audience: 'Unknown (automatic classification)',
    unique_insights: [
      'Document was classified automatically based on filename and extension'
    ]
  };
}

// Process a single file using the prompt service and Claude
// Returns classification result and raw file content
async function processFile(
  fileId: string,
  mimeType: string,
  fileName: string,
  debug: boolean = false
): Promise<{ classificationResult: any, fileContent: string }> {
  try {
    if (debug) {
      console.log(`Processing file: ${fileName} (ID: ${fileId}, type: ${mimeType})`);
    }
    
    // Get Google Drive service
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Import auth service
    const { GoogleAuthService } = require('../../../packages/shared/services/google-drive/google-auth-service');
    const auth = GoogleAuthService.getInstance();
    
    // Get Google Drive service instance
    const googleDriveService = GoogleDriveService.getInstance(auth, supabase);
    
    // 1. Get the file content
    let fileContent = '';
    try {
      // Use the Google Drive API directly since the service methods aren't implemented
      const { google } = require('googleapis');
      // Create a JWT client using the service account credentials
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
      
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // For DOCX files
        // Get file metadata
        const file = await googleDriveService.getFile(fileId);
        if (debug) {
          console.log(`DOCX file details: ${JSON.stringify(file, null, 2)}`);
        }
        
        // Use Google Drive API directly to get DOCX binary content
        const response = await drive.files.get({
          fileId: fileId,
          alt: 'media',
        }, { responseType: 'arraybuffer' });
        
        if (debug) {
          console.log(`Downloaded DOCX, size: ${response.data.byteLength} bytes`);
        }
        
        // Process with mammoth to extract text properly
        try {
          // Create a buffer from the response data
          const buffer = Buffer.from(response.data);
          
          // Save the file temporarily to process with mammoth (most reliable method)
          const tempDir = './document-analysis-results';
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          const tempFilePath = path.join(tempDir, `temp-${fileId}.docx`);
          fs.writeFileSync(tempFilePath, buffer);
          
          if (debug) {
            console.log(`Saved temporary DOCX file to ${tempFilePath}`);
          }
          
          try {
            // Extract text using mammoth with file path (most reliable method)
            const result = await mammoth.extractRawText({
              path: tempFilePath
            });
            
            // Clean up the file when done
            try {
              fs.unlinkSync(tempFilePath);
            } catch (e) {
              // Ignore cleanup errors
            }
            
            // Check if we got reasonable content
            if (result.value && result.value.length > 10) {
              // Clean up the text content
              fileContent = result.value
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
                .replace(/\u0000/g, '')  // Remove null bytes
                .replace(/\n{3,}/g, '\n\n')  // Normalize multiple line breaks
                .trim();
                
              if (debug) {
                console.log(`Successfully extracted ${fileContent.length} characters with mammoth`);
                if (result.messages.length > 0) {
                  console.log(`Mammoth messages: ${JSON.stringify(result.messages)}`);
                }
              }
            } else {
              // Fallback for insufficient content
              console.warn(`Warning: Mammoth extraction produced insufficient content (${result.value?.length || 0} chars)`);
              throw new Error("Insufficient content extracted from document");
            }
          } catch (mammothInnerError) {
            // More detailed extraction error - likely invalid DOCX structure
            console.error(`Mammoth inner extraction error: ${mammothInnerError instanceof Error ? mammothInnerError.message : String(mammothInnerError)}`);
            
            // Try an alternative extraction approach using raw XML
            try {
              // Read the file as binary
              const fileData = fs.readFileSync(tempFilePath);
              
              // Try to extract XML content directly
              const xmlContent = fileData.toString('utf8');
              const textMatches = xmlContent.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
              
              if (textMatches.length > 0) {
                // Extract text from XML tags
                const extractedText = textMatches
                  .map(match => {
                    const contentMatch = match.match(/<w:t[^>]*>([^<]+)<\/w:t>/);
                    return contentMatch ? contentMatch[1] : '';
                  })
                  .join(' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                  
                if (extractedText.length > 10) {
                  fileContent = extractedText;
                  if (debug) {
                    console.log(`Successfully extracted ${fileContent.length} characters with manual XML parsing`);
                  }
                } else {
                  // Fallback if extraction produced too little content
                  fileContent = `Title: ${file.name || "Unknown Document"}\n\nThis document appears to be a DOCX file that could not be properly parsed. File ID: ${fileId}, Name: ${file.name || 'unknown'}`;
                  console.warn(`Warning: All extraction methods failed, using metadata-only content`);
                }
              } else {
                // Fallback if extraction failed
                fileContent = `Title: ${file.name || "Unknown Document"}\n\nThis document appears to be a DOCX file that could not be properly parsed. File ID: ${fileId}, Name: ${file.name || 'unknown'}`;
                console.warn(`Warning: XML extraction failed, using metadata-only content`);
              }
            } catch (alternativeError) {
              // Fallback if all extraction methods failed
              fileContent = `Title: ${file.name || "Unknown Document"}\n\nThis document appears to be a DOCX file that could not be properly parsed. File ID: ${fileId}, Name: ${file.name || 'unknown'}`;
              console.warn(`Warning: All extraction methods failed, using metadata-only content`);
            }
          }
        } catch (mammothError) {
          console.error(`Error extracting DOCX content with mammoth: ${mammothError instanceof Error ? mammothError.message : 'Unknown error'}`);
          
          // Fallback to raw buffer processing if mammoth fails
          try {
            // Create a string from the buffer, cleaning control characters
            fileContent = Buffer.from(response.data).toString('utf8')
              .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control chars
              .replace(/[^\x20-\x7E\n\r\t]/g, '') // Keep only printable ASCII
              .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
              .trim();
              
            if (fileContent.length < 100) {
              fileContent = `[Could not extract useful content from DOCX file. File ID: ${fileId}, Name: ${file.name || 'unknown'}]`;
            }
            
            if (debug) {
              console.log(`Fallback extraction produced ${fileContent.length} characters`);
            }
          } catch (fallbackError) {
            console.error(`Fallback extraction also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
            fileContent = `[Failed to extract content from DOCX file. File ID: ${fileId}, Name: ${file.name || 'unknown'}]`;
          }
        }
      } else if (mimeType === 'application/vnd.google-apps.document') {
        // For Google Docs
        // Use Google Drive API directly to export as plain text
        const response = await drive.files.export({
          fileId: fileId,
          mimeType: 'text/plain',
        }, { responseType: 'text' });
        
        fileContent = response.data;
      } else {
        // For regular text files
        // Use Google Drive API directly to get content
        const response = await drive.files.get({
          fileId: fileId,
          alt: 'media',
        }, { responseType: 'text' });
        
        fileContent = response.data;
      }
      
      if (debug) {
        console.log(`Successfully extracted ${fileContent.length} characters of content`);
      }
    } catch (error) {
      console.error(`Error getting file content: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
    
    // 2. Use the prompt service to load the classification prompt
    const promptResult = await promptService.loadPrompt(CLASSIFICATION_PROMPT, {
      includeDatabaseQueries: true,
      executeQueries: true,
      includeRelationships: true,
      includeRelatedFiles: true
    });
    
    if (debug) {
      console.log(`Loaded prompt with ${promptResult.combinedContent.length} characters of combined content`);
    }
    
    // 3. Send the file content for classification
    const userMessage = `Please classify this document:\n\n${fileContent}`;
    
    let classificationResult;
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        classificationResult = await promptService.usePromptWithClaude(
          CLASSIFICATION_PROMPT,
          userMessage,
          {
            expectJson: true,
            claudeOptions: {
              temperature: 0,
              maxTokens: 4000
            }
          }
        );
        
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
            // Create a fallback classification based on file metadata
            classificationResult = createFallbackClassification({
              name: fileName || 'Unknown Document'
            });
          }
        } else {
          // For other types of errors, don't retry
          console.error(`Non-retryable Claude API error: ${errorMessage}`);
          classificationResult = createFallbackClassification({
            name: fileName || 'Unknown Document'
          });
          break;
        }
      }
    }
    
    if (!classificationResult) {
      // Just in case we didn't set it in the error handlers
      classificationResult = createFallbackClassification({
        name: fileName || 'Unknown Document'
      });
    }
    
    if (debug) {
      console.log('Classification result:', classificationResult);
    }
    
    // Return both the classification result and the file content
    return { 
      classificationResult, 
      fileContent 
    };
  } catch (error) {
    console.error(`Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

// Main classification function
async function classifyMissingDocuments(
  limit: number,
  folderId?: string,
  outputPath?: string,
  includePdfs: boolean = false,
  debug: boolean = false,
  dryRun: boolean = false
): Promise<any[]> {
  try {
    // 1. Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // 2. Build query for unclassified files
    let query = supabase
      .from('sources_google')
      .select('*')
      .is('document_type_id', null)
      .is('is_deleted', false);
    
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
    
    // Build mime type filter
    let mimeTypeFilter = 'mime_type.eq.application/vnd.openxmlformats-officedocument.wordprocessingml.document,mime_type.eq.text/plain,mime_type.eq.application/vnd.google-apps.document';
    
    // Include PDFs if requested
    if (includePdfs) {
      mimeTypeFilter += ',mime_type.eq.application/pdf';
    }
    
    // Apply mime type filter, sort, and limit
    query = query
      .or(mimeTypeFilter)
      .order('modified_at', { ascending: false })
      .limit(limit);
    
    // 3. Execute the query
    const { data: files, error } = await query;
    
    if (error) {
      throw new Error(`Error fetching files: ${error.message}`);
    }
    
    if (debug) {
      console.log(`Found ${files?.length || 0} files missing document types`);
    }
    
    if (!files || files.length === 0) {
      return [];
    }
    
    // 4. Process each file
    const results = [];
    for (const file of files) {
      try {
        if (debug) {
          console.log(`Processing file: ${file.name} (${file.id})`);
        }
        
        // Process the file
        const { classificationResult, fileContent } = await processFile(
          file.drive_id,
          file.mime_type,
          file.name || '',
          debug
        );
        
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
          
          // Create expert document record - now including raw_content and processed_content
          try {
            // First try to sanitize raw_content that might have illegal Unicode escape sequences
            let sanitizedContent = fileContent;
            
            // If debug mode is enabled, log what we're about to insert
            if (debug) {
              console.log(`Inserting expert document for ${file.name} with document_type_id: ${classificationResult.document_type_id}`);
            }
            
            // Try to create minimal document first, then extend with content if needed
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
              
              // Now try to update with full content if minimal insert succeeded
              try {
                // Create a clean version of content with all problematic characters removed
                let cleanContent = '';
                try {
                  // Remove ALL non-ASCII printable characters to ensure database compatibility
                  cleanContent = fileContent
                    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')  // Control chars
                    .replace(/\\u[\dA-Fa-f]{4}/g, '')              // Unicode escapes
                    .replace(/\u0000/g, '')                        // Null bytes
                    .replace(/\n{3,}/g, '\n\n')                    // Multiple line breaks
                    .trim();
                    
                  // If that fails, try a more aggressive approach
                  if (!cleanContent || cleanContent.includes('\\u')) {
                    cleanContent = fileContent.replace(/[^\x20-\x7E\r\n\t]/g, '');
                  }
                } catch (sanitizeErr) {
                  console.warn(`Content sanitization error: ${sanitizeErr instanceof Error ? sanitizeErr.message : 'Unknown error'}`);
                  cleanContent = '[Content could not be sanitized for database storage]';
                }
                
                // Only attempt content update if there's actual content to add
                if (cleanContent && minimalData && minimalData.length > 0) {
                  const { error: contentUpdateError } = await supabase
                    .from('expert_documents')
                    .update({
                      classification_metadata: classificationResult,
                      processed_content: classificationResult,  // Also set processed_content to match classification result
                      raw_content: cleanContent
                    })
                    .eq('id', minimalDoc.id);
                  
                  if (contentUpdateError) {
                    if (debug) {
                      console.log(`Could not add full content data: ${contentUpdateError.message}`);
                    }
                    // This is fine, we already have the minimal record
                  } else if (debug) {
                    console.log(`Updated expert document with full content for ${file.name}`);
                  }
                }
              } catch (contentErr) {
                // Just log in debug mode, we already have the minimal document
                if (debug) {
                  console.log(`Could not add content: ${contentErr instanceof Error ? contentErr.message : 'Unknown error'}`);
                }
              }
            }
          } catch (err) {
            console.error(`Error in expert document creation process: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
        
        // Add to results
        results.push({
          file,
          result: classificationResult
        });
        
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
      } catch (error) {
        console.error(`Error processing file ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Add the error to results
        results.push({
          file,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
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
      
      // Parse limit
      const limit = parseInt(options.limit, 10);
      
      // Process files
      console.log(`Processing up to ${limit} files missing document types...`);
      
      const results = await classifyMissingDocuments(
        limit,
        options.folderId || '',
        options.output,
        options.includePdfs,
        debug,
        dryRun
      );
      
      // Show summary
      console.log('='.repeat(50));
      const successCount = results.filter(r => r.result).length;
      console.log(`SUMMARY: Processed ${results.length} files, ${successCount} successfully classified`);
      
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
export async function classifyMissingDocsWithService(options: {
  limit?: number;
  folderId?: string;
  outputPath?: string;
  includePdfs?: boolean;
  debug?: boolean;
  dryRun?: boolean;
}): Promise<any[]> {
  const {
    limit = 10,
    folderId = '',
    outputPath,
    includePdfs = false,
    debug = false,
    dryRun = false
  } = options;
  
  return classifyMissingDocuments(
    limit,
    folderId,
    outputPath,
    includePdfs,
    debug,
    dryRun
  );
}

// Run CLI if this module is executed directly
if (require.main === module) {
  program.parse();
}