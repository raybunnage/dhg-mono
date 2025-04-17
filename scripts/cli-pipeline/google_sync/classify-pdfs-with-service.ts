#!/usr/bin/env ts-node
/**
 * Script to classify PDF documents from Google Drive
 * Uses the document classification service with the PromptService
 * and Claude's PDF reading capability
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

// Define the prompt name to use for classification
const CLASSIFICATION_PROMPT = 'scientific-document-analysis-prompt';

// Function to create a fallback classification when Claude API fails
function createFallbackClassification(file: any): any {
  const fileName = file.name || 'Unknown Document';
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Determine document type based on file extension and name
  let documentType = 'unknown document type';
  let documentTypeId = '9dbe32ff-5e82-4586-be63-1445e5bcc548'; // ID for unknown document type
  
  // Basic file type detection from extension and name patterns
  if (extension === 'pdf') {
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

// Process a single PDF file using the prompt service and Claude
// Returns classification result
async function processPdfFile(
  fileId: string,
  fileName: string,
  debug: boolean = false
): Promise<{ classificationResult: any, tempFilePath: string | null }> {
  let tempFilePath: string | null = null;
  
  try {
    if (debug) {
      console.log(`Processing PDF file: ${fileName} (ID: ${fileId})`);
    }
    
    // Get Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Import auth service
    const { GoogleAuthService } = require('../../../packages/shared/services/google-drive/google-auth-service');
    const auth = GoogleAuthService.getInstance();
    
    // Get Google Drive service instance
    const googleDriveService = GoogleDriveService.getInstance(auth, supabase);
    
    // Use the Google Drive API directly to get PDF binary content
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
    
    // 1. Get file metadata first to confirm it's a PDF
    const file = await googleDriveService.getFile(fileId);
    if (debug) {
      console.log(`PDF file details: ${JSON.stringify(file, null, 2)}`);
    }
    
    // 2. Download the PDF file
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media',
    }, { responseType: 'arraybuffer' });
    
    if (debug) {
      console.log(`Downloaded PDF, size: ${response.data.byteLength} bytes`);
    }
    
    // 3. Save the PDF to a temporary location
    const tempDir = path.join(process.cwd(), 'file_types', 'pdf');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create a safe filename for the temporary file
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    tempFilePath = path.join(tempDir, `temp-${safeName}-${fileId.substring(0, 8)}.pdf`);
    
    // Write the file to disk
    fs.writeFileSync(tempFilePath, Buffer.from(response.data));
    
    if (debug) {
      console.log(`Saved temporary PDF file to ${tempFilePath}`);
    }
    
    // 4. Read a few lines of the PDF content to check if it seems valid
    // Note: For PDFs, we can only check the file size since it's a binary format
    const stats = fs.statSync(tempFilePath);
    if (stats.size < 100) {
      throw new Error("PDF file appears to be empty or corrupt");
    }
    
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
    
    // 6. Use Claude's direct PDF analysis capability
    // This will allow Claude to read and understand the full content of the PDF
    if (fs.existsSync(tempFilePath)) {
      if (debug) {
        console.log(`Using Claude's binary PDF analysis capability to read PDF content directly`);
      }
      
      // Prepare the classification prompt with document types information
      const userMessage = `${promptResult.combinedContent}

      Please read and analyze this PDF document carefully.
      1. Examine its content, structure, and purpose.
      2. Determine which document_type from the document_types table best describes it.
      3. Create a detailed summary (at least 3 paragraphs) that captures the key concepts.
      4. Return your analysis in the requested JSON format with document_type, document_type_id, etc.
      
      IMPORTANT: 
      - Select the most appropriate document_type_id from the available options in the document_types table
      - Base your classification on the actual content of the PDF, not just the filename
      - Provide detailed reasoning for your classification choice
      `;
      
      // 7. Get classification from Claude using direct PDF reading capability
      let classificationResult;
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          if (debug) {
            console.log(`Using direct PDF analysis with Claude (attempt ${retries + 1}/${maxRetries})`);
          }
          
          // Use Claude's direct PDF analysis capability
          classificationResult = await claudeService.analyzePdfToJson(
            tempFilePath,
            userMessage,
            {
              temperature: 0,
              maxTokens: 4000
            }
          );
          
          if (debug) {
            console.log(`Successfully analyzed PDF content directly with Claude`);
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
              
              // Try using the traditional method as a fallback since direct PDF analysis failed
              try {
                console.log(`Falling back to metadata-based classification...`);
                
                // Create a descriptive message about the PDF metadata
                const stats = fs.statSync(tempFilePath);
                const fileMetadata = `
                File Name: ${fileName}
                File Size: ${stats.size} bytes
                Last Modified: ${stats.mtime.toISOString()}
                MIME Type: application/pdf
                `;
                
                const fallbackMessage = `${promptResult.combinedContent}
                
                Please classify this PDF document based on the following information:
                
                Document Title: "${fileName}"
                
                PDF Metadata:
                ${fileMetadata}
                
                Context clues:
                1. The filename itself may contain important classification clues
                2. Look for patterns in the file name (e.g., transcript, report, presentation)
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
                classificationResult = createFallbackClassification({
                  name: fileName || 'Unknown Document'
                });
              }
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
      
      // Return both the classification result and the temp file path
      return { 
        classificationResult, 
        tempFilePath 
      };
    } else {
      throw new Error(`Temporary PDF file not found at ${tempFilePath}`);
    }
  } catch (error) {
    console.error(`Error processing PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // If we failed but have a temporary file, return it for cleanup
    return {
      classificationResult: createFallbackClassification({
        name: fileName || 'Unknown Document'
      }),
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

// Main classification function
async function classifyPdfDocuments(
  limit: number,
  folderId?: string,
  outputPath?: string,
  debug: boolean = false,
  dryRun: boolean = false
): Promise<any[]> {
  const tempFiles: string[] = [];
  
  try {
    // 1. Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // 2. Build query for unclassified PDF files
    let query = supabase
      .from('sources_google')
      .select('*')
      .is('document_type_id', null)
      .is('is_deleted', false)
      .eq('mime_type', 'application/pdf')
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
      throw new Error(`Error fetching PDF files: ${error.message}`);
    }
    
    if (debug) {
      console.log(`Found ${files?.length || 0} PDF files missing document types`);
    }
    
    if (!files || files.length === 0) {
      return [];
    }
    
    // 4. Process each file
    const results = [];
    for (const file of files) {
      try {
        if (debug) {
          console.log(`Processing PDF file: ${file.name} (${file.id})`);
        }
        
        // Process the file
        const { classificationResult, tempFilePath } = await processPdfFile(
          file.drive_id,
          file.name || '',
          debug
        );
        
        // Add any temporary files to cleanup list
        if (tempFilePath) {
          tempFiles.push(tempFilePath);
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
    console.error(`Error classifying PDF documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Clean up temporary files even if there was an error
    cleanupTempFiles(tempFiles);
    return [];
  }
}

// Define CLI program
program
  .name('classify-pdfs-with-service')
  .description('Classify PDF files missing document types using the PromptService')
  .option('-l, --limit <number>', 'Limit the number of files to process', '10')
  .option('-o, --output <path>', 'Output file path for classification results')
  .option('-d, --debug', 'Enable debug logging', false)
  .option('-v, --verbose', 'Enable verbose logging (includes debug)', false)
  .option('--dry-run', 'Process files but do not update database', false)
  .option('--folder-id <id>', 'Filter by Google Drive folder ID or folder name', '')
  .action(async (options) => {
    try {
      // Set debug mode if verbose is enabled
      const debug = options.debug || options.verbose;
      const dryRun = options.dryRun;
      
      // Show header
      console.log('='.repeat(50));
      console.log('PDF DOCUMENT CLASSIFICATION WITH PROMPT SERVICE');
      console.log('='.repeat(50));
      console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
      console.log(`Debug: ${debug ? 'ON' : 'OFF'}`);
      
      // Parse limit
      const limit = parseInt(options.limit, 10);
      
      // Process files
      console.log(`Processing up to ${limit} PDF files missing document types...`);
      
      const results = await classifyPdfDocuments(
        limit,
        options.folderId || '',
        options.output,
        debug,
        dryRun
      );
      
      // Show summary
      console.log('='.repeat(50));
      const successCount = results.filter(r => r.result).length;
      console.log(`SUMMARY: Processed ${results.length} PDF files, ${successCount} successfully classified`);
      
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
export async function classifyPdfsWithService(options: {
  limit?: number;
  folderId?: string;
  outputPath?: string;
  debug?: boolean;
  dryRun?: boolean;
}): Promise<any[]> {
  const {
    limit = 10,
    folderId = '',
    outputPath,
    debug = false,
    dryRun = false
  } = options;
  
  return classifyPdfDocuments(
    limit,
    folderId,
    outputPath,
    debug,
    dryRun
  );
}

// Run CLI if this module is executed directly
if (require.main === module) {
  program.parse();
}