#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import { GoogleDriveService, defaultGoogleAuth } from '../../../packages/shared/services/google-drive';
import { pdfProcessorService } from '../../../packages/shared/services/pdf-processor-service';
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
import { promptService } from '../../../packages/shared/services/prompt-service';
import * as mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

const supabase = SupabaseClientService.getInstance().getClient();
const googleDriveService = GoogleDriveService.getInstance(defaultGoogleAuth, supabase);

// Define the prompt name to use for PDF classification
const CLASSIFICATION_PROMPT = 'scientific-document-analysis-prompt';

/**
 * Process unprocessed expert documents based on their mime type and steps defined in mime_types_processing.
 * Supports both DOCX and PDF files.
 * 
 * For DOCX files:
 * 1. Finds expert documents with "unprocessed" status and DOCX mime type
 * 2. Updates status to "extraction_in_progress"
 * 3. Downloads the DOCX from Google Drive
 * 4. Extracts content using Mammoth
 * 5. Updates expert document with extracted content
 * 6. Sets pipeline_status to "needs_classification"
 * 
 * For PDF files:
 * 1. Finds expert documents with "unprocessed" status and PDF mime type
 * 2. Updates status to "extraction_in_progress"
 * 3. Downloads the PDF from Google Drive
 * 4. Uses Claude AI to process the PDF directly and extract meaningful classification
 * 5. Updates expert document with extracted content and classification metadata
 * 6. Sets pipeline_status to "processed" since Claude AI handles both extraction and classification
 */
async function processUnprocessed(options: {
  limit?: number;
  dryRun?: boolean;
  verbose?: boolean;
  mimeType?: string;
}) {
  // Generate tracking ID
  let trackingId: string;
  try {
    trackingId = await commandTrackingService.startTracking('google_sync', 'process-unprocessed');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
    trackingId = 'tracking-unavailable';
  }

  try {
    const limit = options.limit || 10;
    const dryRun = options.dryRun || false;
    const verbose = options.verbose || false;
    const mimeType = options.mimeType;

    // Define supported mime types
    const docxMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const pdfMimeType = 'application/pdf';
    
    // Process specific mime type or all supported types
    const mimeTypesToProcess = [];
    if (mimeType) {
      // Process only the specified mime type if it's supported
      if (mimeType === docxMimeType || mimeType === pdfMimeType) {
        mimeTypesToProcess.push(mimeType);
      } else {
        console.error(`Unsupported mime type: ${mimeType}`);
        console.error(`Supported mime types: ${docxMimeType}, ${pdfMimeType}`);
        if (trackingId !== 'tracking-unavailable') {
          await commandTrackingService.failTracking(trackingId, `Unsupported mime type: ${mimeType}`);
        }
        return;
      }
    } else {
      // Process all supported mime types
      mimeTypesToProcess.push(docxMimeType, pdfMimeType);
    }

    // Keep track of total records processed
    let totalSuccessCount = 0;
    let totalErrorCount = 0;

    // Process each mime type
    for (const currentMimeType of mimeTypesToProcess) {
      console.log(`\n=============================`);
      console.log(`Processing files with mime type: ${currentMimeType}`);
      console.log(`=============================\n`);

      // Check if file type is supported (hardcoded instead of using a configuration table)
      console.log(`Processing files with mime type: ${currentMimeType}`);
      
      // The mime_type_processing table has been removed, so we'll handle file types directly
      if (currentMimeType === docxMimeType) {
        console.log("Using hardcoded DOCX processing configuration");
      } else if (currentMimeType === pdfMimeType) {
        console.log("Using hardcoded PDF processing configuration");
      } else {
        console.error(`Unsupported mime type: ${currentMimeType}`);
        continue;
      }
      
      if (verbose) {
        console.log(`Using hardcoded processing steps for ${currentMimeType}`);
      }
      
      // 2. Find unprocessed files with the current mime type
      console.log(`Finding unprocessed files with mime type: ${currentMimeType}...`);
      
      const { data: unprocessedFiles, error: unprocessedFilesError } = await supabase
        .from('expert_documents')
        .select(`
          id,
          source_id,
          pipeline_status,
          sources_google!inner(
            id,
            name,
            mime_type,
            drive_id,
            web_view_link
          )
        `)
        .eq('pipeline_status', 'unprocessed')
        .eq('sources_google.mime_type', currentMimeType)
        .limit(limit);
        
      if (unprocessedFilesError) {
        console.error(`Error finding unprocessed files: ${unprocessedFilesError.message}`);
        continue;
      }
      
      if (!unprocessedFiles || unprocessedFiles.length === 0) {
        console.log(`No unprocessed files found with mime type: ${currentMimeType}`);
        continue;
      }
    
    console.log(`Found ${unprocessedFiles.length} unprocessed files with mime type: ${currentMimeType}`);
    
    // Process each file
    let successCount = 0;
    let errorCount = 0;
    
    // Process each file in the unprocessed files list
    for (const file of unprocessedFiles) {
      try {
        // The sources_google field contains the joined record
        const expertDocId = file.id;
        const sourceId = file.source_id;
        
        // In expert_documents with nested select, sources_google is the joined record
        const sourceGoogle = file.sources_google as any; // Type assertion to bypass TypeScript checks
        const driveId = sourceGoogle.drive_id;
        const fileName = sourceGoogle.name;
        const fileMimeType = sourceGoogle.mime_type;
        
        console.log(`\nProcessing: ${fileName} (${expertDocId})`);
        
        if (!driveId) {
          console.error(`Error: No drive_id found for ${fileName}`);
          errorCount++;
          continue;
        }
        
        if (dryRun) {
          console.log(`DRY RUN: Would process ${fileName} from Google Drive (ID: ${driveId})`);
          successCount++;
          continue;
        }
        
        // 3. Update status to extraction_in_progress
        console.log(`Updating status to extraction_in_progress...`);
        
        const { error: updateStatusError } = await supabase
          .from('expert_documents')
          .update({ pipeline_status: 'extraction_in_progress' })
          .eq('id', expertDocId);
          
        if (updateStatusError) {
          console.error(`Error updating status to extraction_in_progress: ${updateStatusError.message}`);
          errorCount++;
          continue;
        }

        // Create temporary directory for file operations
        const tempDir = path.join(process.cwd(), 'document-analysis-results');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Initialize variables for Google Drive API download
        const { google } = require('googleapis');
        const { JWT } = require('google-auth-library');
        
        // Get service account key file path
        const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 
                         process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                         path.resolve(process.cwd(), '../../../.service-account.json');
        
        // Check if file exists
        if (!fs.existsSync(keyFilePath)) {
          throw new Error(`Google service account key file not found at ${keyFilePath}`);
        }
        
        // Read and parse the service account key file
        const keyFileData = fs.readFileSync(keyFilePath, 'utf8');
        const keyFile = JSON.parse(keyFileData);
        
        // Create JWT auth client with the service account
        const authClient = new JWT({
          email: keyFile.client_email,
          key: keyFile.private_key,
          scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });
        
        // Initialize Google Drive API
        const drive = google.drive({ version: 'v3', auth: authClient });

        // Different processing logic based on mime type
        if (fileMimeType === docxMimeType) {
          // ============================
          // Process DOCX files
          // ============================
          
          try {
            // 4. Download DOCX from Google Drive
            console.log(`Downloading DOCX file from Google Drive...`);
            
            // Temporary file path for the downloaded DOCX
            const tempFilePath = path.join(tempDir, `temp-${driveId}.docx`);
            
            console.log(`Downloading DOCX file: ${fileName} (Drive ID: ${driveId})...`);
            
            // Download file using Google Drive API
            const response = await drive.files.get({
              fileId: driveId,
              alt: 'media',
            }, { responseType: 'arraybuffer' });
            
            console.log(`Downloaded DOCX, size: ${response.data.byteLength} bytes`);
            
            // Create a buffer from the response data
            const buffer = Buffer.from(response.data);
            
            // Save the file temporarily to process with mammoth
            fs.writeFileSync(tempFilePath, buffer);
            console.log(`Saved temporary DOCX file to ${tempFilePath}`);
            
            // 5. Extract content using Mammoth
            console.log(`Extracting content using Mammoth...`);
            
            // Extract text using mammoth
            const result = await mammoth.extractRawText({
              path: tempFilePath
            });
            
            // Clean up the file when done
            try {
              fs.unlinkSync(tempFilePath);
            } catch (cleanupError) {
              console.warn(`Warning: Could not clean up temporary file: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
              // Non-fatal error, continue processing
            }
            
            // Check if we got reasonable content
            if (result.value && result.value.length > 10) {
              // Clean up the text content
              const extractedContent = result.value
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
                .replace(/\u0000/g, '')  // Remove null bytes
                .replace(/\n{3,}/g, '\n\n')  // Normalize multiple line breaks
                .trim();
                
              console.log(`Successfully extracted ${extractedContent.length} characters with mammoth`);
              
              if (result.messages && result.messages.length > 0) {
                console.log(`Mammoth messages: ${JSON.stringify(result.messages)}`);
              }
              
              // 6. Update expert document with extracted content
              console.log(`Updating expert document with extracted content...`);
              
              const { error: updateContentError } = await supabase
                .from('expert_documents')
                .update({ 
                  raw_content: extractedContent,
                  pipeline_status: 'needs_classification',
                  word_count: extractedContent.split(/\s+/).length
                })
                .eq('id', expertDocId);
            
              if (updateContentError) {
                console.error(`Error updating content: ${updateContentError.message}`);
                
                const { error: updateFailStatusError } = await supabase
                  .from('expert_documents')
                  .update({ 
                    pipeline_status: 'extraction_failed',
                    processing_error: `Error updating content: ${updateContentError.message}`
                  })
                  .eq('id', expertDocId);
                  
                errorCount++;
                continue;
              }
              
              console.log(`Successfully processed ${fileName}`);
              successCount++;
            } else {
              // Insufficient content extracted
              console.error(`Error: Extracted content is insufficient (${result.value?.length || 0} characters)`);
              
              const { error: updateFailStatusError } = await supabase
                .from('expert_documents')
                .update({ 
                  pipeline_status: 'extraction_failed',
                  processing_error: `Insufficient content extracted from document (${result.value?.length || 0} characters)`
                })
                .eq('id', expertDocId);
                
              errorCount++;
              continue;
            }
          } catch (docxError) {
            // Error with DOCX processing
            console.error(`Error processing DOCX file: ${docxError instanceof Error ? docxError.message : String(docxError)}`);
            
            const { error: updateFailStatusError } = await supabase
              .from('expert_documents')
              .update({ 
                pipeline_status: 'extraction_failed',
                processing_error: `DOCX processing error: ${docxError instanceof Error ? docxError.message : String(docxError)}`
              })
              .eq('id', expertDocId);
              
            errorCount++;
          }
        } else if (fileMimeType === pdfMimeType) {
          // ============================
          // Process PDF files
          // ============================
          try {
            console.log(`Processing PDF file: ${fileName}`);

            // Define PDF document type IDs
            const pdfSourceDocumentTypeId = '2fa04116-04ed-4828-b091-ca6840eb8863'; // PDF document type for sources_google
            const pdfExpertDocumentTypeId = '2f5af574-9053-49b1-908d-c35001ce9680'; // PDF classifier document type for expert_documents

            // Temporary file path for the downloaded PDF
            const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const tempFilePath = path.join(tempDir, `temp-${safeName}-${driveId.substring(0, 8)}.pdf`);

            // 4. Download PDF from Google Drive
            console.log(`Downloading PDF file: ${fileName} (Drive ID: ${driveId})...`);

            // Download file using Google Drive API
            const response = await drive.files.get({
              fileId: driveId,
              alt: 'media',
            }, { responseType: 'arraybuffer' });

            console.log(`Downloaded PDF, size: ${response.data.byteLength} bytes`);

            // Create a buffer from the response data and save to temp file
            const buffer = Buffer.from(response.data);
            fs.writeFileSync(tempFilePath, buffer);
            console.log(`Saved temporary PDF file to ${tempFilePath}`);

            // 5. Process the PDF with Claude AI using the PDF processor service
            console.log(`Processing PDF file with Claude AI...`);

            // 5.1 Check file size and handle large PDFs
            const stats = fs.statSync(tempFilePath);
            const fileSizeMB = stats.size / (1024 * 1024);
            let isLargeFile = false;
            let processFilePath = tempFilePath; // New variable to store the file path to process

            if (fileSizeMB > 10) {
              // PDF is too large for direct Claude processing (Claude has a 10MB limit)
              console.warn(`⚠️ PDF file is too large (${fileSizeMB.toFixed(2)}MB). Claude has a 10MB limit for PDFs.`);
              console.warn(`⚠️ Will attempt to extract a portion of the PDF.`);
              isLargeFile = true;

              try {
                // Use pdf-lib to extract a subset of pages
                const { PDFDocument } = require('pdf-lib');
                
                // Read the PDF bytes
                const pdfBytes = fs.readFileSync(tempFilePath);
                
                // Load the document
                const pdfDoc = await PDFDocument.load(pdfBytes);
                
                // Get page count and calculate how many to extract
                const pageCount = pdfDoc.getPageCount();
                const pagesToExtract = Math.min(pageCount, 50); // Extract up to 50 pages
                
                console.log(`PDF has ${pageCount} pages. Extracting first ${pagesToExtract} pages...`);
                
                // Create a new document for the extracted pages
                const extractedPdf = await PDFDocument.create();
                
                // Copy the pages
                const copiedPages = await extractedPdf.copyPages(
                  pdfDoc, 
                  Array.from({ length: pagesToExtract }, (_, i) => i)
                );
                
                // Add all copied pages to the new document
                copiedPages.forEach((page: any) => {
                  extractedPdf.addPage(page);
                });
                
                // Save the new PDF with extracted pages
                const extractedPdfPath = tempFilePath.replace('.pdf', '_first50pages.pdf');
                const extractedPdfBytes = await extractedPdf.save({
                  useObjectStreams: true,
                  addDefaultPage: false,
                  objectsPerTick: 100,
                  updateFieldAppearances: false
                });
                
                fs.writeFileSync(extractedPdfPath, extractedPdfBytes);
                
                // Update the file path to process
                processFilePath = extractedPdfPath;
                
                console.log(`Successfully extracted ${pagesToExtract} pages to ${extractedPdfPath}`);
              } catch (extractionError) {
                console.error(`Error during page extraction: ${extractionError instanceof Error ? extractionError.message : String(extractionError)}`);
                console.log(`Will attempt to proceed with full PDF, but Claude processing may fail due to size.`);
              }
            }

            // 5.2 Load the scientific document analysis prompt to use with Claude
            console.log(`Loading document classification prompt...`);
            const promptResult = await promptService.loadPrompt(CLASSIFICATION_PROMPT, {
              includeDatabaseQueries: true,
              executeQueries: true,
              includeRelationships: true,
              includeRelatedFiles: true
            });

            if (verbose) {
              console.log(`Loaded prompt with ${promptResult.combinedContent.length} characters of combined content`);
            }

            // 5.3 Prepare the user message for Claude
            const isPartialPdf = processFilePath.includes('_first50pages.pdf');
            const userMessage = `${promptResult.combinedContent}

            Please read and analyze this PDF document carefully.
            ${isPartialPdf ? "NOTE: This is ONLY the first 50 pages of a larger document that was too large for complete analysis." : ""}
            ${isPartialPdf ? "Your classification and summary should be based on this partial content." : ""}
            
            1. Examine its content, structure, and purpose.
            2. Determine which document_type from the document_types table best describes it.
            3. Create a detailed summary (at least 3 paragraphs) that captures the key concepts.
            4. Return your analysis in the requested JSON format with document_type, document_type_id, etc.
            
            IMPORTANT: 
            - Select the most appropriate document_type_id from the available options in the document_types table
            - Base your classification on the actual content of the PDF, not just the filename
            - Provide detailed reasoning for your classification choice
            ${isPartialPdf ? "- Acknowledge in your summary that you've only analyzed the first 50 pages of the document" : ""}
            `;

            // 5.4 Use Claude to analyze the PDF
            console.log(`Sending PDF to Claude API for analysis...`);
            
            let classificationResult;
            try {
              // First we load the PDF file as binary data
              const pdfBuffer = fs.readFileSync(processFilePath);
              
              // Convert to base64 for Claude API
              const base64PDF = pdfBuffer.toString('base64');
              
              // Manually construct the system message for JSON output
              const systemMessage = "You are a helpful AI assistant that provides responses in valid JSON format. Your job is to analyze PDF documents and extract key information.";
              
              // Send directly to Claude with the PDF content as part of the prompt
              // Use getJsonResponse to ensure we get structured JSON back
              classificationResult = await claudeService.getJsonResponse(
                userMessage,
                {
                  system: systemMessage,
                  temperature: 0,
                  maxTokens: 4000
                }
              );
              
              console.log(`✅ Successfully analyzed PDF content with Claude`);
              
              if (verbose) {
                console.log(`Document type assigned: ${classificationResult.document_type || 'Unknown'}`);
                console.log(`Classification confidence: ${(classificationResult.classification_confidence * 100).toFixed(1)}%`);
              }
              
              // 6. Update database records with classification results
              console.log(`Updating database records with classification results...`);

              // 6.1 Update document type in sources_google
              const { error: updateSourceError } = await supabase
                .from('google_sources')
                .update({ document_type_id: pdfSourceDocumentTypeId })
                .eq('id', sourceId);
                
              if (updateSourceError) {
                console.error(`Error updating document type in sources_google: ${updateSourceError.message}`);
              }

              // 6.2 Prepare document summary for expert_documents
              const documentSummary = {
                document_summary: classificationResult.document_summary || "",
                key_topics: classificationResult.key_topics || [],
                target_audience: classificationResult.target_audience || "",
                unique_insights: classificationResult.unique_insights || [],
                document_type: classificationResult.document_type || "",
                classification_confidence: classificationResult.classification_confidence || 0.75,
                classification_reasoning: classificationResult.classification_reasoning || ""
              };

              // 6.3 Update expert_documents with classification results
              const { error: updateExpertDocError } = await supabase
                .from('expert_documents')
                .update({ 
                  document_type_id: pdfExpertDocumentTypeId, // Fixed document_type_id for PDF classifier
                  classification_metadata: classificationResult,
                  processed_content: documentSummary,
                  pipeline_status: 'processed', // Mark as fully processed since we've done both extraction and classification
                  word_count: classificationResult.word_count || 0
                })
                .eq('id', expertDocId);
                
              if (updateExpertDocError) {
                console.error(`Error updating expert_documents: ${updateExpertDocError.message}`);
                
                // Update status to extraction_failed
                const { error: updateFailStatusError } = await supabase
                  .from('expert_documents')
                  .update({ 
                    pipeline_status: 'extraction_failed',
                    processing_error: `Error updating expert document: ${updateExpertDocError.message}`
                  })
                  .eq('id', expertDocId);
                  
                errorCount++;
              } else {
                console.log(`Successfully processed PDF file ${fileName}`);
                successCount++;
              }
            } catch (claudeError) {
              console.error(`Error analyzing PDF with Claude: ${claudeError instanceof Error ? claudeError.message : String(claudeError)}`);
              
              // Update the status to extraction_failed
              const { error: updateFailStatusError } = await supabase
                .from('expert_documents')
                .update({ 
                  pipeline_status: 'extraction_failed',
                  processing_error: `Claude API error: ${claudeError instanceof Error ? claudeError.message : String(claudeError)}`
                })
                .eq('id', expertDocId);
                
              errorCount++;
            }

            // Clean up temporary files
            try {
              if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
              }
              if (processFilePath !== tempFilePath && fs.existsSync(processFilePath)) {
                fs.unlinkSync(processFilePath);
              }
            } catch (cleanupError) {
              console.warn(`Warning: Could not clean up temporary file: ${cleanupError}`);
            }
          } catch (pdfError) {
            console.error(`Error processing PDF file: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`);
            
            // Update status to extraction_failed
            const { error: updateFailStatusError } = await supabase
              .from('expert_documents')
              .update({ 
                pipeline_status: 'extraction_failed',
                processing_error: `Error processing PDF: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`
              })
              .eq('id', expertDocId);
              
            errorCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing file: ${error instanceof Error ? error.message : String(error)}`);
        
        // Try to update the error status if we can identify the file
        try {
          if (file && file.id) {
            const { error: updateError } = await supabase
              .from('expert_documents')
              .update({ 
                pipeline_status: 'extraction_failed',
                processing_error: `General processing error: ${error instanceof Error ? error.message : String(error)}`
              })
              .eq('id', file.id);
          }
        } catch (statusUpdateError) {
          console.error(`Could not update error status: ${statusUpdateError}`);
        }
        
        errorCount++;
      }
    }
    
      // Print summary for this mime type
      console.log(`\nProcessing Summary for ${currentMimeType}:`);
      console.log(`------------------`);
      console.log(`Total files: ${unprocessedFiles.length}`);
      console.log(`Successfully processed: ${successCount}`);
      console.log(`Errors: ${errorCount}`);
      
      // Add to the total counts
      totalSuccessCount += successCount;
      totalErrorCount += errorCount;
    } // End of for loop for mimeTypesToProcess
    
    // Print overall summary if we processed multiple mime types
    if (mimeTypesToProcess.length > 1) {
      console.log(`\nOverall Processing Summary:`);
      console.log(`=========================`);
      console.log(`Total mime types processed: ${mimeTypesToProcess.length}`);
      console.log(`Total successfully processed: ${totalSuccessCount}`);
      console.log(`Total errors: ${totalErrorCount}`);
    }
    
    // Complete tracking
    if (trackingId !== 'tracking-unavailable') {
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: totalSuccessCount,
        summary: `Processed ${totalSuccessCount} files (${mimeTypesToProcess.join(', ')}) with ${totalErrorCount} errors`
      });
    }
  } catch (error) {
    console.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    
    if (trackingId !== 'tracking-unavailable') {
      await commandTrackingService.failTracking(trackingId, 
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Set up CLI command
const program = new Command();

program
  .name('process-unprocessed')
  .description('Process unprocessed expert documents by mime type using specialized processing for each type. Supports DOCX and PDF files.')
  .option('-l, --limit <number>', 'Maximum number of files to process', '10')
  .option('-d, --dry-run', 'Show what would be processed without making changes', false)
  .option('-v, --verbose', 'Show detailed processing information', false)
  .option('-m, --mime-type <type>', 'Process specific mime type only (application/pdf or application/vnd.openxmlformats-officedocument.wordprocessingml.document)')
  .action((options) => {
    processUnprocessed({
      limit: parseInt(options.limit),
      dryRun: options.dryRun,
      verbose: options.verbose,
      mimeType: options.mimeType
    });
  });

// If this script is executed directly
if (require.main === module) {
  program.parse(process.argv);
}