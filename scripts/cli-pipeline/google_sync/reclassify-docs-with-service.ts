#!/usr/bin/env ts-node
/**
 * Script to re-classify already processed documents from Google Drive
 * Uses the document classification service with temperature 0 to ensure deterministic output
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
  } else if (extension === 'pdf') {
    documentType = 'pdf document';
    documentTypeId = 'e3e10835-61f5-4734-a088-cfe2a9a0b1d7'; // ID for PDF document type
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
  originalExpertDocId: string | null,
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
      } else if (mimeType === 'application/pdf') {
        // For PDF files
        // Get file metadata
        const file = await googleDriveService.getFile(fileId);
        if (debug) {
          console.log(`PDF file details: ${JSON.stringify(file, null, 2)}`);
        }
        
        // Download the PDF file
        const response = await drive.files.get({
          fileId: fileId,
          alt: 'media',
        }, { responseType: 'arraybuffer' });
        
        if (debug) {
          console.log(`Downloaded PDF, size: ${response.data.byteLength} bytes`);
        }
        
        // Save the PDF to a temporary location
        const tempDir = path.join(process.cwd(), 'file_types', 'pdf');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Create a safe filename for the temporary file
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const tempFilePath = path.join(tempDir, `temp-${safeName}-${fileId.substring(0, 8)}.pdf`);
        
        // Write the file to disk
        fs.writeFileSync(tempFilePath, Buffer.from(response.data));
        
        if (debug) {
          console.log(`Saved temporary PDF file to ${tempFilePath}`);
        }
        
        // For PDFs we're currently just handling them by passing information
        // about the file, not the actual content
        fileContent = `PDF Document: ${fileName}\nThis is a PDF file which would be processed directly by Claude in a more advanced implementation.\nMetadata: ${file.name}, ${file.mimeType}, ${file.webViewLink || ''}`;
        
        // Clean up the temp file
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {
          // Ignore cleanup errors
        }
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
      
      // If originalExpertDocId is provided, try to retrieve the raw_content from the existing record
      if (originalExpertDocId) {
        try {
          if (debug) {
            console.log(`Trying to retrieve raw_content from expert document ${originalExpertDocId}`);
          }
          
          const { data, error } = await supabase
            .from('expert_documents')
            .select('raw_content')
            .eq('id', originalExpertDocId)
            .single();
          
          if (error) {
            throw new Error(`Error fetching expert document: ${error.message}`);
          }
          
          if (data && data.raw_content) {
            fileContent = data.raw_content;
            if (debug) {
              console.log(`Retrieved ${fileContent.length} characters from existing expert document`);
            }
          } else {
            throw new Error('Expert document has no raw_content');
          }
        } catch (expertDocError) {
          console.error(`Failed to get raw_content from expert document: ${expertDocError instanceof Error ? expertDocError.message : 'Unknown error'}`);
          throw error; // Rethrow the original error since fallback failed
        }
      } else {
        throw error;
      }
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
              temperature: 0, // Ensure temperature is 0 for deterministic output
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
async function reclassifyDocuments(
  limit: number,
  folderId?: string,
  outputPath?: string,
  includePdfs: boolean = true,
  debug: boolean = false,
  dryRun: boolean = false,
  startDate?: string
): Promise<any[]> {
  try {
    // 1. Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // 2. Build query for already classified files that need reclassification
    let query = supabase
      .from('sources_google')
      .select(`
        *,
        expert_documents(id, document_processing_status)
      `)
      .not('document_type_id', 'is', null)  // Only include documents that have been classified
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
    
    // Apply mime type filter
    query = query.or(mimeTypeFilter);
    
    // If startDate is provided, filter by creation date
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    // Apply sort and limit
    query = query
      .order('modified_at', { ascending: false })
      .limit(limit);
    
    // 3. Execute the query
    const { data: files, error } = await query;
    
    if (error) {
      throw new Error(`Error fetching classified files: ${error.message}`);
    }
    
    if (debug) {
      console.log(`Found ${files?.length || 0} files for reclassification`);
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
        
        // Get the expert_document id if available
        const expertDocId = file.expert_documents && file.expert_documents.length > 0 
          ? file.expert_documents[0].id 
          : null;
        
        // Process the file
        const { classificationResult, fileContent } = await processFile(
          file.drive_id,
          file.mime_type,
          file.name || '',
          expertDocId,
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
          
          // Update or create expert document record
          try {
            // If debug mode is enabled, log what we're about to insert/update
            if (debug) {
              if (expertDocId) {
                console.log(`Updating expert document ${expertDocId} for ${file.name}`);
              } else {
                console.log(`Creating new expert document for ${file.name}`);
              }
            }
            
            // Sanitize raw content to remove problematic characters
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
            
            if (expertDocId) {
              // Check if this document needed reprocessing
              const needsReprocessing = file.expert_documents && 
                                        file.expert_documents.length > 0 && 
                                        file.expert_documents[0].document_processing_status === 'needs_reprocessing';
              
              // Update existing expert document
              const updateData = {
                document_type_id: classificationResult.document_type_id,
                classification_confidence: classificationResult.classification_confidence || 0.75,
                classification_metadata: classificationResult,
                processed_content: classificationResult,
                updated_at: new Date().toISOString()
              };
              
              // If this file needed reprocessing, mark it as "reprocessing_done"
              if (needsReprocessing) {
                updateData['document_processing_status'] = 'reprocessing_done';
                updateData['document_processing_status_updated_at'] = new Date().toISOString();
                console.log(`Marking file ${file.name} as "reprocessing_done"`);
              }
              
              const { error: updateError } = await supabase
                .from('expert_documents')
                .update(updateData)
                .eq('id', expertDocId);
                
              if (updateError) {
                console.error(`Error updating expert document: ${updateError.message}`);
              } else if (debug) {
                console.log(`Updated expert document for ${file.name}`);
              }
            } else {
              // Create new expert document
              const expertDoc = {
                id: uuidv4(),
                source_id: file.id,
                document_type_id: classificationResult.document_type_id,
                classification_confidence: classificationResult.classification_confidence || 0.75,
                classification_metadata: classificationResult,
                processed_content: classificationResult,
                raw_content: cleanContent,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              
              const { error: insertError } = await supabase
                .from('expert_documents')
                .insert(expertDoc);
                
              if (insertError) {
                console.error(`Error creating expert document: ${insertError.message}`);
              } else if (debug) {
                console.log(`Created expert document for ${file.name}`);
              }
            }
          } catch (err) {
            console.error(`Error in expert document update/creation: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
        
        // Add to results
        results.push({
          file,
          result: classificationResult,
          expertDocId
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
        start_date: startDate || 'all time',
        total_files: results.length,
        results
      };
      
      // Write to file
      fs.writeFileSync(outputPath, JSON.stringify(combined, null, 2));
      console.log(`Results saved to ${outputPath}`);
    }
    
    return results;
  } catch (error) {
    console.error(`Error reclassifying documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

// Define CLI program
program
  .name('reclassify-docs-with-service')
  .description('Re-classify documents that were previously classified using temperature 0 for deterministic results')
  .option('-l, --limit <number>', 'Limit the number of files to process', '10')
  .option('-o, --output <path>', 'Output file path for classification results')
  .option('-d, --debug', 'Enable debug logging', false)
  .option('-v, --verbose', 'Enable verbose logging (includes debug)', false)
  .option('--dry-run', 'Process files but do not update database', false)
  .option('--folder-id <id>', 'Filter by Google Drive folder ID or folder name', '')
  .option('--include-pdfs', 'Include PDF files in classification (default: true)', true)
  .option('--exclude-pdfs', 'Exclude PDF files from classification', false)
  .option('--start-date <date>', 'Only process files created after this date (YYYY-MM-DD)', '')
  .action(async (options) => {
    try {
      // Set debug mode if verbose is enabled
      const debug = options.debug || options.verbose;
      const dryRun = options.dryRun;
      
      // Show header
      console.log('='.repeat(50));
      console.log('DOCUMENT RE-CLASSIFICATION WITH PROMPT SERVICE');
      console.log('='.repeat(50));
      console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
      console.log(`Debug: ${debug ? 'ON' : 'OFF'}`);
      
      // Parse limit
      const limit = parseInt(options.limit, 10);
      
      // Handle PDF inclusion/exclusion
      const includePdfs = options.excludePdfs ? false : options.includePdfs;
      
      // Process files
      console.log(`Processing up to ${limit} files for re-classification...`);
      console.log(`File types included: ${includePdfs ? '.docx, .txt, and .pdf files' : '.docx and .txt files only (PDFs excluded)'}`);
      
      const results = await reclassifyDocuments(
        limit,
        options.folderId || '',
        options.output,
        includePdfs, 
        debug,
        dryRun,
        options.startDate || undefined
      );
      
      // Show summary
      console.log('='.repeat(50));
      const successCount = results.filter(r => r.result).length;
      console.log(`SUMMARY: Processed ${results.length} files, ${successCount} successfully re-classified`);
      
      // Show results table
      console.log('\nResults:');
      console.log('-'.repeat(100));
      console.log('| File ID                               | File Name                  | Status    | Previous Doc Type ID            |');
      console.log('-'.repeat(100));
      
      results.forEach(r => {
        const id = r.file.id.substring(0, 36).padEnd(36);
        const name = (r.file.name || 'Unknown').substring(0, 25).padEnd(25);
        const status = r.result ? 'Success' : 'Failed';
        const prevDocType = r.file.document_type_id ? r.file.document_type_id.padEnd(36) : 'None'.padEnd(36);
        console.log(`| ${id} | ${name} | ${status.padEnd(9)} | ${prevDocType} |`);
      });
      
      console.log('-'.repeat(100));
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (options.verbose) {
        console.error('Stack trace:', (error as Error).stack);
      }
      process.exit(1);
    }
  });

// Export for module usage
export async function reclassifyDocsWithService(options: {
  limit?: number;
  folderId?: string;
  outputPath?: string;
  includePdfs?: boolean;
  debug?: boolean;
  dryRun?: boolean;
  startDate?: string;
}): Promise<any[]> {
  const {
    limit = 10,
    folderId = '',
    outputPath,
    includePdfs = true,
    debug = false,
    dryRun = false,
    startDate
  } = options;
  
  return reclassifyDocuments(
    limit,
    folderId,
    outputPath,
    includePdfs,
    debug,
    dryRun,
    startDate
  );
}

// Run CLI if this module is executed directly
if (require.main === module) {
  program.parse();
}