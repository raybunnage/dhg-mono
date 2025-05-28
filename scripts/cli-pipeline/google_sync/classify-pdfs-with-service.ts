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
import { BatchProcessingService } from '../../../packages/shared/services/batch-processing-service';
import { documentClassificationService } from '../../../packages/shared/services/document-classification-service';
import { pdfProcessorService } from '../../../packages/shared/services/pdf-processor-service';

// Define the prompt name to use for classification
const CLASSIFICATION_PROMPT = 'scientific-document-analysis-prompt';

// Function to create a fallback classification when Claude API fails
async function createFallbackClassification(file: any, supabase: any): Promise<any> {
  // Use the document classification service's createFallbackClassification method
  return documentClassificationService.createFallbackClassification({
    name: file.name || 'Unknown Document',
    mime_type: file.mime_type || 'application/pdf'
    // Removed size property as it's not supported in the parameter type
  });
}

// Process a single PDF file using the prompt service and Claude
// Returns classification result
async function processPdfFile(
  fileId: string,
  fileName: string,
  debug: boolean = false,
  supabase: any = null
): Promise<{ classificationResult: any, tempFilePath: string | null }> {
  let tempFilePath: string | null = null;
  // Array to collect temporary files for cleanup later
  const tempFiles: string[] = [];
  
  try {
    if (debug) {
      console.log(`Processing PDF file: ${fileName} (ID: ${fileId})`);
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
    
    // 1. Get file metadata first to confirm it's a PDF and check size
    const file = await googleDriveService.getFile(fileId);
    if (debug) {
      console.log(`PDF file details: ${JSON.stringify(file, null, 2)}`);
    }
    
    // Check file size before downloading
    let isLargeFile = false;
    let fileSizeMB = 0;
    
    if (file && file.size) {
      const fileSizeBytes = parseInt(file.size, 10);
      fileSizeMB = fileSizeBytes / (1024 * 1024);
      
      // Check if the file exceeds Claude's 10MB limit for PDFs
      if (fileSizeBytes > 10 * 1024 * 1024) {
        isLargeFile = true;
        
        // Use a more noticeable warning for large files
        console.log('');
        console.log('⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️');
        console.log(`⚠️  PDF file is too large (${fileSizeMB.toFixed(2)}MB). Claude has a 10MB limit for PDF files.`);
        console.log('⚠️  Will extract and analyze the first 99 pages instead of using metadata.');
        console.log('⚠️  This partial analysis will provide better results than metadata alone.');
        console.log('⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️');
        console.log('');
        
        // Continue as normal and let the file be downloaded
        // We'll try to extract pages from it after download
      }
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
    
    // Check if this is a large file and we need to extract pages
    if (isLargeFile && tempFilePath) {
      console.log(`Processing large PDF (${fileSizeMB.toFixed(2)}MB) - extracting first 50 pages to stay under Claude's size limit...`);
      
      try {
        // Create a path for the extracted PDF
        const extractedPdfPath = tempFilePath.replace('.pdf', '_first50pages.pdf');
        
        // Try to use pdf-lib to extract the first 50 pages
        try {
          // Use pdf-lib to extract pages
          const { PDFDocument } = require('pdf-lib');
          
          // Read the PDF bytes
          const pdfBytes = fs.readFileSync(tempFilePath);
          
          // Load the document
          const pdfDoc = await PDFDocument.load(pdfBytes);
          
          // Get page count and calculate how many to extract - limiting to 50 instead of 99
          // to ensure we stay under Claude's size limit
          const pageCount = pdfDoc.getPageCount();
          const pagesToExtract = Math.min(pageCount, 50);
          
          console.log(`PDF has ${pageCount} pages. Extracting first ${pagesToExtract} pages...`);
          
          // Create a new document for the extracted pages
          const extractedPdf = await PDFDocument.create();
          
          // Copy the first 50 pages (or less if the document has fewer)
          const copiedPages = await extractedPdf.copyPages(
            pdfDoc, 
            Array.from({ length: pagesToExtract }, (_, i) => i)
          );
          
          // Add all copied pages to the new document
          copiedPages.forEach((page: any) => {
            extractedPdf.addPage(page);
          });
          
          // Save the new PDF with extracted pages and compression
          // Using the most compact PDFlib settings to reduce file size
          const extractedPdfBytes = await extractedPdf.save({
            useObjectStreams: true,
            addDefaultPage: false,
            objectsPerTick: 100,
            updateFieldAppearances: false
          });
          
          fs.writeFileSync(extractedPdfPath, extractedPdfBytes);
          
          // Get file size of the extracted PDF
          const stats = fs.statSync(extractedPdfPath);
          const extractedSizeMB = stats.size / (1024 * 1024);
          
          console.log(`Successfully extracted ${pagesToExtract} pages to ${extractedPdfPath} (${extractedSizeMB.toFixed(2)}MB)`);
          
          // If still too large, reduce to even fewer pages
          if (extractedSizeMB > 9.5) {
            console.log(`Extracted PDF is still large (${extractedSizeMB.toFixed(2)}MB), reducing to first 25 pages...`);
            
            // Create a further reduced PDF
            const reducedPdfPath = tempFilePath.replace('.pdf', '_first25pages.pdf');
            
            // Load the already extracted PDF
            const reducedPdfDoc = await PDFDocument.load(extractedPdfBytes);
            
            // Create a new document for fewer pages
            const veryReducedPdf = await PDFDocument.create();
            
            // Copy an even smaller number of pages
            const pagesToKeep = Math.min(reducedPdfDoc.getPageCount(), 25);
            const furtherReducedPages = await veryReducedPdf.copyPages(
              reducedPdfDoc,
              Array.from({ length: pagesToKeep }, (_, i) => i)
            );
            
            // Add the reduced pages
            furtherReducedPages.forEach((page: any) => {
              veryReducedPdf.addPage(page);
            });
            
            // Save with maximum compression settings
            const reducedPdfBytes = await veryReducedPdf.save({
              useObjectStreams: true,
              addDefaultPage: false,
              objectsPerTick: 100,
              updateFieldAppearances: false
            });
            
            fs.writeFileSync(reducedPdfPath, reducedPdfBytes);
            
            // Check size again
            const reducedStats = fs.statSync(reducedPdfPath);
            const reducedSizeMB = reducedStats.size / (1024 * 1024);
            
            console.log(`Created smaller PDF with ${pagesToKeep} pages: ${reducedPdfPath} (${reducedSizeMB.toFixed(2)}MB)`);
            
            // Use the further reduced PDF
            const originalTempFilePath = tempFilePath;
            tempFilePath = reducedPdfPath;
            
            // Add all files to cleanup
            tempFiles.push(originalTempFilePath);
            tempFiles.push(extractedPdfPath);
            tempFiles.push(reducedPdfPath);
          } else {
            // Update the tempFilePath to use our extracted file
            const originalTempFilePath = tempFilePath;
            tempFilePath = extractedPdfPath;
            
            // Add both files to cleanup list at the end
            tempFiles.push(originalTempFilePath);
            tempFiles.push(extractedPdfPath);
          }
        } catch (pdfLibError) {
          console.error(`Error using pdf-lib to extract pages: ${pdfLibError}`);
          
          // Try a more aggressive approach - take just the first 10 pages as a last resort
          try {
            console.log(`Attempting one last extraction with only 10 pages...`);
            const lastResortPath = tempFilePath.replace('.pdf', '_first10pages.pdf');
            
            const { PDFDocument } = require('pdf-lib');
            const pdfBytes = fs.readFileSync(tempFilePath);
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const minimalPdf = await PDFDocument.create();
            
            // Only take 10 pages max
            const pagesToKeep = Math.min(pdfDoc.getPageCount(), 10);
            const minimalPages = await minimalPdf.copyPages(
              pdfDoc,
              Array.from({ length: pagesToKeep }, (_, i) => i)
            );
            
            minimalPages.forEach((page: any) => {
              minimalPdf.addPage(page);
            });
            
            // Maximum compression
            const minimalBytes = await minimalPdf.save({
              useObjectStreams: true,
              addDefaultPage: false,
              objectsPerTick: 50,
              updateFieldAppearances: false
            });
            
            fs.writeFileSync(lastResortPath, minimalBytes);
            
            // Update the path and add to cleanup
            const originalPath = tempFilePath;
            tempFilePath = lastResortPath;
            tempFiles.push(originalPath);
            tempFiles.push(lastResortPath);
            
            console.log(`Created minimal 10-page PDF as last resort: ${lastResortPath}`);
          } catch (minimalError) {
            console.error(`Final extraction attempt failed: ${minimalError}`);
            console.log(`Will try to continue with full PDF, but may encounter size issues.`);
          }
        }
      } catch (extractionError) {
        console.error(`Error during page extraction: ${extractionError}`);
        
        // Try a very minimal approach with just 5 pages
        try {
          console.log(`Attempting emergency extraction with only 5 pages...`);
          const emergencyPath = tempFilePath.replace('.pdf', '_first5pages.pdf');
          
          const { PDFDocument } = require('pdf-lib');
          const pdfBytes = fs.readFileSync(tempFilePath);
          const pdfDoc = await PDFDocument.load(pdfBytes);
          const emergencyPdf = await PDFDocument.create();
          
          // Only take 5 pages max
          const pagesToKeep = Math.min(pdfDoc.getPageCount(), 5);
          const emergencyPages = await emergencyPdf.copyPages(
            pdfDoc,
            Array.from({ length: pagesToKeep }, (_, i) => i)
          );
          
          emergencyPages.forEach((page: any) => {
            emergencyPdf.addPage(page);
          });
          
          // Maximum compression
          const emergencyBytes = await emergencyPdf.save({
            useObjectStreams: true,
            addDefaultPage: false,
            objectsPerTick: 20,
            updateFieldAppearances: false
          });
          
          fs.writeFileSync(emergencyPath, emergencyBytes);
          
          // Update the path and add to cleanup
          const originalPath = tempFilePath;
          tempFilePath = emergencyPath;
          tempFiles.push(originalPath);
          tempFiles.push(emergencyPath);
          
          console.log(`Created emergency 5-page PDF: ${emergencyPath}`);
        } catch (emergencyError) {
          console.error(`Emergency extraction failed: ${emergencyError}`);
          console.log(`All extraction attempts failed. Will try with full PDF but may encounter size issues.`);
        }
      }
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
      // Add a note if this is an extracted partial PDF
      const is50PagesPdf = tempFilePath && tempFilePath.includes('_first50pages.pdf');
      const is25PagesPdf = tempFilePath && tempFilePath.includes('_first25pages.pdf');
      const is10PagesPdf = tempFilePath && tempFilePath.includes('_first10pages.pdf');
      const is5PagesPdf = tempFilePath && tempFilePath.includes('_first5pages.pdf');
      const isPartialPdf = is50PagesPdf || is25PagesPdf || is10PagesPdf || is5PagesPdf;
      
      // Determine how many pages were extracted
      let pageCount = "partial";
      if (is5PagesPdf) {
        pageCount = "first 5";
      } else if (is10PagesPdf) {
        pageCount = "first 10";
      } else if (is25PagesPdf) {
        pageCount = "first 25";
      } else if (is50PagesPdf) {
        pageCount = "first 50";
      }
      
      const userMessage = `${promptResult.combinedContent}

      Please read and analyze this PDF document carefully.
      ${isPartialPdf ? `NOTE: This is ONLY the ${pageCount} pages of a larger document that was too large for complete analysis.` : ""}
      ${isPartialPdf ? "Your classification and summary should be based on this partial content." : ""}
      
      1. Examine its content, structure, and purpose.
      2. Determine which document_type from the document_types table best describes it.
      3. Create a detailed summary (at least 3 paragraphs) that captures the key concepts.
      4. Return your analysis in the requested JSON format with document_type, document_type_id, etc.
      
      IMPORTANT: 
      - Select the most appropriate document_type_id from the available options in the document_types table
      - Base your classification on the actual content of the PDF, not just the filename
      - Provide detailed reasoning for your classification choice
      ${isPartialPdf ? `- Acknowledge in your summary that you've only analyzed the ${pageCount} pages of the document` : ""}
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
          
          // Always show that we're sending to Claude, regardless of debug mode
          console.log(`Sending PDF to Claude API for analysis...`);
          
          // Use the prompt service to analyze the PDF content with Claude
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
          
          // Always show success message
          console.log(`✅ Successfully analyzed PDF content with Claude`);
          
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
                                 errorMessage.includes('529') ||
                                 errorMessage.includes('too many requests') ||
                                 errorMessage.includes('rate limit') ||
                                 errorMessage.includes('Overloaded') ||
                                 errorMessage.includes('overloaded');
                                 
          // Check if it's a connection or rate-limiting error
          if (isConnectionError || isRateLimitError) {
            // These errors are retryable
            console.warn(`Claude API connection error (retry ${retries}/${maxRetries}): ${errorMessage}`);
            
            if (retries < maxRetries) {
              // Increase backoff time and add jitter
              const baseBackoff = Math.pow(2, retries) * 2000; // Start with 4s, then 8s, then 16s
              const jitter = Math.random() * 0.3 * baseBackoff; // Add up to 30% random jitter
              const backoffTime = Math.round(baseBackoff + jitter);
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
    } else {
      throw new Error(`Temporary PDF file not found at ${tempFilePath}`);
    }
  } catch (error) {
    console.error(`Error processing PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Clean up any temporary files we created
    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (cleanupError) {
          console.warn(`Could not clean up temporary file ${file}: ${cleanupError}`);
        }
      }
    }
    
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
async function classifyPdfDocuments(
  limit: number,
  folderId?: string,
  outputPath?: string,
  debug: boolean = false,
  dryRun: boolean = false,
  concurrency: number = 3 // Default concurrency of 3
): Promise<any[]> {
  const tempFiles: string[] = [];
  
  try {
    // 1. Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // 2. Use a direct approach to find PDF files needing reprocessing
    console.log("Using direct approach to find PDFs marked as needs_reprocessing...");
    
    // First find expert_documents with needs_reprocessing status
    const { data: docsToReprocess, error: docsError } = await supabase
      .from('expert_documents')
      .select('id, source_id, document_processing_status')
      .eq('document_processing_status', 'needs_reprocessing')
      .limit(limit * 2);
      
    if (docsError) {
      console.error(`Error fetching documents to reprocess: ${docsError.message}`);
      throw new Error(`Error fetching documents to reprocess: ${docsError.message}`);
    }
    
    if (!docsToReprocess || docsToReprocess.length === 0) {
      console.log('No documents found with needs_reprocessing status.');
      // Fall back to finding unclassified PDF files
      console.log('Falling back to looking for unclassified PDF files...');
      // Execute the query and return empty array if nothing found
      const { data: fallbackFiles, error: fallbackError } = await supabase
        .from('google_sources')
        .select('*')
        .is('is_deleted', false)
        .eq('mime_type', 'application/pdf')
        .is('document_type_id', null)
        .order('modified_at', { ascending: false })
        .limit(limit);
      
      if (fallbackError) {
        console.error(`Error in fallback query: ${fallbackError.message}`);
        return [];
      }
      
      console.log(`Found ${fallbackFiles?.length || 0} unclassified PDF files in fallback query`);
      return fallbackFiles || [];
    }
    
    console.log(`Found ${docsToReprocess.length} documents with needs_reprocessing status.`);
    
    // Get the corresponding sources_google records for PDF files
    const sourceIds = docsToReprocess.map(doc => doc.source_id);
    
    let query = supabase
      .from('google_sources')
      .select('*')
      .in('id', sourceIds)
      .eq('mime_type', 'application/pdf')
      .is('is_deleted', false)
      .order('modified_at', { ascending: false }); // Get the most recently modified first
    
    // Filter by folder if provided
    if (folderId) {
      if (folderId.length < 36) {
        // It's likely a folder name, look it up
        if (debug) {
          console.log(`Looking up folder ID for name: ${folderId}`);
        }
        
        const { data: folders } = await supabase
          .from('google_sources')
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
    const { data: allFiles, error } = await query;
    
    if (error) {
      throw new Error(`Error fetching PDF files: ${error.message}`);
    }
    
    // 4. Manually fetch expert documents for these files
    if (allFiles && allFiles.length > 0) {
      const sourceIds = allFiles.map(file => file.id);
      
      // Get all expert documents for these sources, not just those needing reprocessing
      const { data: expertDocuments, error: expertError } = await supabase
        .from('expert_documents')
        .select('*')
        .in('source_id', sourceIds);
        
      if (expertError) {
        console.warn(`Warning: Could not fetch expert documents: ${expertError.message}`);
      } else if (expertDocuments && expertDocuments.length > 0) {
        // Attach expert documents to their source files
        for (const file of allFiles) {
          file.expert_documents = expertDocuments.filter(doc => doc.source_id === file.id);
          // Add debug information for each file
          const needsReprocessingDocs = file.expert_documents.filter(
            (doc: { document_processing_status?: string }) => doc.document_processing_status === 'needs_reprocessing'
          );
          if (needsReprocessingDocs.length > 0) {
            console.log(`File ${file.name} has ${needsReprocessingDocs.length} document(s) marked as needs_reprocessing`);
          }
        }
        console.log(`Attached ${expertDocuments.length} expert documents to ${allFiles.length} PDF files`);
      } else {
        console.log(`No expert documents found for the ${allFiles.length} PDF files`);
        // Initialize empty expert_documents array for each file
        allFiles.forEach(file => { file.expert_documents = []; });
      }
    }
    
    if (!allFiles || allFiles.length === 0) {
      console.log('No PDF files found that need processing');
      return [];
    }
    
    // If no files need processing so far, let's also directly check for files with needs_reprocessing status
    // This is a more direct approach to ensure we don't miss any files
    const { data: directReprocessingDocs, error: directError } = await supabase
      .from('expert_documents')
      .select('id, source_id, document_processing_status')
      .eq('document_processing_status', 'needs_reprocessing')
      .limit(limit);
      
    if (directError) {
      console.warn(`Warning: Could not directly check for files needing reprocessing: ${directError.message}`);
    } else if (directReprocessingDocs && directReprocessingDocs.length > 0) {
      console.log(`Directly found ${directReprocessingDocs.length} expert documents with needs_reprocessing status`);
      
      // Get the source_ids from these documents
      const reprocessingSourceIds = directReprocessingDocs.map(doc => doc.source_id);
      
      // Fetch the source files for these expert documents
      const { data: reprocessingFiles, error: reprocessingError } = await supabase
        .from('google_sources')
        .select('*')
        .in('id', reprocessingSourceIds)
        .eq('mime_type', 'application/pdf')
        .is('is_deleted', false);
        
      if (reprocessingError) {
        console.warn(`Warning: Could not fetch source files for reprocessing: ${reprocessingError.message}`);
      } else if (reprocessingFiles && reprocessingFiles.length > 0) {
        console.log(`Found ${reprocessingFiles.length} PDF files that need reprocessing via direct check`);
        
        // For each of these files, ensure they have their expert_documents attached
        for (const file of reprocessingFiles) {
          file.expert_documents = directReprocessingDocs.filter(doc => doc.source_id === file.id);
        }
        
        // Add these to allFiles if they're not already there
        const existingIds = new Set(allFiles.map(file => file.id));
        const newFiles = reprocessingFiles.filter(file => !existingIds.has(file.id));
        if (newFiles.length > 0) {
          console.log(`Adding ${newFiles.length} additional files for processing`);
          allFiles.push(...newFiles);
        }
      }
    }
    
    // Now do the additional filtering for files that need reprocessing
    // This is done in memory since the query syntax for this is complex
    const files = allFiles.filter(file => {
      // If we started with needs_reprocessing expert documents, always include the file
      // This is the key change to ensure we process all files with needs_reprocessing status
      if (docsToReprocess && docsToReprocess.some(doc => doc.source_id === file.id)) {
        console.log(`Including file ${file.name} because it has a needs_reprocessing document`);
        return true;
      }
      
      // Include files with no document_type_id
      if (!file.document_type_id) {
        if (debug) {
          console.log(`Including file with no document_type_id: ${file.name}`);
        }
        return true;
      }
      
      // Include files where at least one expert document has status 'needs_reprocessing'
      if (file.expert_documents && file.expert_documents.length > 0) {
        const needsReprocessing = file.expert_documents.some((doc: { document_processing_status?: string }) => 
          doc.document_processing_status === 'needs_reprocessing'
        );
        
        if (needsReprocessing) {
          console.log(`Including file with needs_reprocessing status: ${file.name}`);
          return true;
        }
      }
      
      return false;
    });
    
    console.log(`Found ${files.length} PDF files that need processing out of ${allFiles.length} total PDF files`);
    
    if (files.length === 0) {
      return [];
    }
    
    // Process files with concurrency
    console.log(`Processing ${files.length} PDF files with concurrency of ${concurrency}`);
    
    // Validate concurrency value
    if (isNaN(concurrency) || concurrency < 1) {
      console.warn(`Invalid concurrency value: ${concurrency}, defaulting to 1`);
      concurrency = 1;
    } else if (concurrency > 5) {
      console.log(`Note: High concurrency (${concurrency}) may lead to rate limiting with Claude API`);
    }
    
    // Process a single file
    const processFile = async (file: any, index: number): Promise<any> => {
      // Always show progress, regardless of debug mode
      console.log(`Processing PDF file ${index+1}/${files.length}: ${file.name}`);
      
      try {
        if (debug) {
          console.log(`File details: ${file.name} (${file.id}, Drive ID: ${file.drive_id})`);
        }
        
        // Process the file
        console.log(`[${index+1}/${files.length}] ⏳ Reading PDF content...`);
        const { classificationResult, tempFilePath } = await processPdfFile(
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
        if (!dryRun) {
          // For PDF files, we always set the document_type_id to the PDF document type
          // This is the ID specified in the requirements: 2fa04116-04ed-4828-b091-ca6840eb8863
          const pdfDocumentTypeId = '2fa04116-04ed-4828-b091-ca6840eb8863';
          
          // Update document type in sources_google - always use PDF document type ID for .pdf files
          const { error: updateError } = await supabase
            .from('google_sources')
            .update({ document_type_id: pdfDocumentTypeId })
            .eq('id', file.id);
          
          if (updateError) {
            console.error(`Error updating document type: ${updateError.message}`);
          } else if (debug) {
            console.log(`Updated document type for ${file.name} to ${pdfDocumentTypeId} (PDF document type)`);
          }
          
          // Create expert document record
          try {
            // If debug mode is enabled, log what we're about to insert
            if (debug) {
              console.log(`Inserting expert document for ${file.name} with document_type_id: ${classificationResult.document_type_id}`);
            }
            
            // Create minimal document with proper typing
            const minimalDoc: {
              id: string;
              source_id: string;
              document_type_id: string;
              classification_confidence: number;
              created_at: string;
              updated_at: string;
              document_processing_status?: string;
              document_processing_status_updated_at?: string;
            } = {
              id: uuidv4(),
              source_id: file.id,
              document_type_id: "2f5af574-9053-49b1-908d-c35001ce9680", // Fixed document_type_id for Json pdf summary (type with "pdf" classifier)
              classification_confidence: classificationResult.classification_confidence || 0.75,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            
            // If this file needed reprocessing, mark it as "reprocessing_done"
            const needsReprocessingDocs = file.expert_documents ? 
              file.expert_documents.filter((d: { document_processing_status?: string }) => d.document_processing_status === 'needs_reprocessing') : [];
              
            if (needsReprocessingDocs.length > 0) {
              minimalDoc.document_processing_status = 'reprocessing_done';
              minimalDoc.document_processing_status_updated_at = new Date().toISOString();
              console.log(`Marking file ${file.name} as "reprocessing_done"`);
              
              // Also update the original expert document that needed reprocessing
              for (const doc of needsReprocessingDocs) {
                if (doc.id) {
                  console.log(`Updating existing document ${doc.id} to reprocessing_done status`);
                  try {
                    await supabase
                      .from('expert_documents')
                      .update({
                        document_processing_status: 'reprocessing_done',
                        document_processing_status_updated_at: new Date().toISOString()
                      })
                      .eq('id', doc.id);
                  } catch (updateErr) {
                    console.warn(`Could not update existing document status: ${updateErr}`);
                  }
                }
              }
            }
            
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
                  // Prepare proper document summary JSON structure for processed_content
                  const documentSummary = {
                    document_summary: classificationResult.document_summary || "",
                    key_topics: classificationResult.key_topics || [],
                    target_audience: classificationResult.target_audience || "",
                    unique_insights: classificationResult.unique_insights || [],
                    document_type: classificationResult.document_type || "",
                    classification_confidence: classificationResult.classification_confidence || 0.75,
                    classification_reasoning: classificationResult.classification_reasoning || ""
                  };
                  
                  const { error: contentUpdateError } = await supabase
                    .from('expert_documents')
                    .update({
                      classification_metadata: classificationResult,
                      processed_content: documentSummary  // Set processed_content with proper document summary structure
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
    console.error(`Error classifying PDF documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Clean up temporary files even if there was an error
    cleanupTempFiles(tempFiles);
    return [];
  }
}

// Function definition removed since it's now integrated into the main classifyPdfDocuments function

// Define CLI program
program
  .name('classify-pdfs-with-service')
  .description('Classify PDF files missing document types or marked as needs_reprocessing using Claude AI')
  .option('-l, --limit <number>', 'Limit the number of files to process', '10')
  .option('-o, --output <path>', 'Output file path for classification results')
  .option('-d, --debug', 'Enable debug logging', false)
  .option('-v, --verbose', 'Enable verbose logging (includes debug)', false)
  .option('--dry-run', 'Process files but do not update database', false)
  .option('--folder-id <id>', 'Filter by Google Drive folder ID or folder name', '')
  .option('-c, --concurrency <number>', 'Number of files to process concurrently (1-5, default: 3)', '3')
  .action(async (options) => {
    try {
      // Set debug mode if verbose is enabled
      const debug = options.debug || options.verbose;
      const dryRun = options.dryRun;
      
      // Show header
      console.log('='.repeat(70));
      console.log('PDF DOCUMENT CLASSIFICATION WITH PROMPT SERVICE');
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
      console.log(`Using Claude API to analyze PDF content directly`);
      console.log(`Processing:        PDF files with missing document types or marked as 'needs_reprocessing'`);
      console.log(`PDF document type: sources_google files will be set to document type ID 2fa04116-04ed-4828-b091-ca6840eb8863`);
      console.log(`expert_documents:  Will be set to document type ID 2f5af574-9053-49b1-908d-c35001ce9680 (with 'pdf' classifier)`);
      console.log(`This may take some time, especially for large PDF files`);
      console.log('='.repeat(70));
      
      const results = await classifyPdfDocuments(
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
  concurrency?: number;
}): Promise<any[]> {
  const {
    limit = 10,
    folderId = '',
    outputPath,
    debug = false,
    dryRun = false,
    concurrency = 3
  } = options;
  
  return classifyPdfDocuments(
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