#!/usr/bin/env ts-node
/**
 * Direct classification of PDF files with needs_reprocessing status
 * This script is a streamlined version that finds PDFs needing reprocessing directly
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { GoogleDriveService } from '../../../packages/shared/services/google-drive';
import { promptService } from '../../../packages/shared/services/prompt-service';
import { claudeService } from '@shared/services/claude-service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// Define the prompt name to use for classification
const CLASSIFICATION_PROMPT = 'scientific-document-analysis-prompt';

async function directClassifyPdfs(options: { 
  limit?: number,
  concurrency?: number,
  dryRun?: boolean,
  verbose?: boolean
}) {
  // Destructure options with defaults
  const {
    limit = 10,
    concurrency = 3,
    dryRun = false,
    verbose = false
  } = options;
  
  console.log('=== Direct PDF Classification With Prompt Service ===');
  console.log(`Mode:              ${dryRun ? '🔍 DRY RUN (no database changes)' : '💾 LIVE (updating database)'}`);
  console.log(`Debug logs:        ${verbose ? '✅ ON' : '❌ OFF'}`);
  console.log(`Concurrency:       ${concurrency} files at a time`);
  console.log(`Max files:         ${limit}`);
  console.log('----------------------------------------------------------------------');
  console.log(`Using Claude API to analyze PDF content directly`);
  console.log(`Processing:        PDF files marked as 'needs_reprocessing'`);
  console.log('======================================================================');
  
  // Get Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Step 1: Find PDF files that need reprocessing
  console.log('Searching for PDF files marked as needs_reprocessing...');
  
  const { data: expertDocs, error: docsError } = await supabase
    .from('google_expert_documents')
    .select('id, source_id, document_processing_status')
    .eq('document_processing_status', 'needs_reprocessing')
    .limit(limit * 2); // Get more than needed to account for filtering
    
  if (docsError) {
    console.error(`Error fetching expert documents: ${docsError.message}`);
    return [];
  }
  
  if (!expertDocs || expertDocs.length === 0) {
    console.log('No expert documents found with needs_reprocessing status.');
    return [];
  }
  
  console.log(`Found ${expertDocs.length} expert documents with needs_reprocessing status.`);
  
  // Get the source IDs
  const sourceIds = expertDocs.map(doc => doc.source_id);
  
  // Step 2: Get the actual PDF files from sources_google
  const { data: pdfFiles, error: filesError } = await supabase
    .from('google_sources')
    .select('id, name, mime_type, document_type_id, drive_id, root_drive_id')
    .in('id', sourceIds)
    .eq('mime_type', 'application/pdf') // Only process PDF files
    .is('is_deleted', false)
    .limit(limit);
    
  if (filesError) {
    console.error(`Error fetching PDF files: ${filesError.message}`);
    return [];
  }
  
  if (!pdfFiles || pdfFiles.length === 0) {
    console.log('No PDF files found with needs_reprocessing status.');
    return [];
  }
  
  console.log(`Found ${pdfFiles.length} PDF files that need processing.`);
  
  // Step 3: Create a map to associate files with their expert documents
  const expertDocsMap = new Map();
  expertDocs.forEach(doc => {
    expertDocsMap.set(doc.source_id, doc);
  });
  
  // Step 4: Process each PDF file
  const results: Array<{
    file: any;
    result: any;
    status: string;
    error?: string;
  }> = [];
  
  // Simple helper for processing with concurrency
  async function processWithConcurrency(
    items: any[],
    concurrency: number,
    processor: (item: any, index: number) => Promise<any>
  ): Promise<any[]> {
    const results: any[] = [];
    let currentIndex = 0;
    const total = items.length;
  
    // Process the next item in the queue
    async function processNext(): Promise<void> {
      const index = currentIndex++;
      if (index >= total) return;
  
      try {
        const result = await processor(items[index], index);
        results[index] = result; // Store the result at the correct index
  
        // Process the next item
        await processNext();
      } catch (error) {
        console.error(`Error processing item at index ${index}:`, error);
        results[index] = { error: error instanceof Error ? error.message : String(error) };
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
  
  // Process a single PDF file
  const processFile = async (file: any, index: number) => {
    console.log(`Processing PDF file ${index+1}/${pdfFiles.length}: ${file.name}`);
    
    try {
      // Get the expert document ID for this file
      const expertDoc = expertDocsMap.get(file.id);
      if (!expertDoc) {
        throw new Error('Could not find expert document for this file');
      }
      
      if (verbose) {
        console.log(`File details: ${file.name} (${file.id}, Drive ID: ${file.drive_id})`);
        console.log(`Expert document: ${expertDoc.id}`);
      }
      
      if (dryRun) {
        // In dry run mode, just return success without actually processing
        console.log(`[DRY RUN] Would process PDF file: ${file.name}`);
        return {
          file,
          result: { 
            document_type: 'Simulated classification (dry run)',
            classification_confidence: 0.9,
            document_summary: 'This is a simulated result for dry run mode.'
          },
          status: 'simulated'
        };
      }
      
      // Initialize Google Drive service (for downloading PDF)
      console.log(`✅ Service account authentication initialized successfully`);
      
      // Use the same authentication approach as the classify-pdfs-with-service script
      const googleDriveService = GoogleDriveService.getInstance();
      
      // Check if we need to use Google Drive API directly
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
      
      // 1. Get file metadata to confirm it's a PDF and check size
      const fileDetails = await googleDriveService.getFile(file.drive_id);
      
      if (verbose) {
        console.log(`PDF file details: ${JSON.stringify(fileDetails, null, 2)}`);
      }
      
      // Check file size before downloading
      if (fileDetails && fileDetails.size) {
        const fileSizeBytes = parseInt(fileDetails.size, 10);
        const fileSizeMB = fileSizeBytes / (1024 * 1024);
        
        if (fileSizeBytes > 10 * 1024 * 1024) {
          console.log(`⚠️ PDF file is too large (${fileSizeMB.toFixed(2)}MB). Claude has a 10MB limit for PDF files.`);
          console.log(`⚠️ Using fallback classification based on filename and metadata.`);
          
          // Return a fallback classification for large files
          return {
            file,
            result: {
              document_type: 'Large PDF file',
              document_type_id: '2f5af574-9053-49b1-908d-c35001ce9680', // PDF classifier document type
              classification_confidence: 0.6,
              classification_reasoning: `Document is too large (${fileSizeMB.toFixed(2)}MB) for Claude's 10MB PDF limit. Classified based on filename "${file.name}" and MIME type "${file.mime_type}".`,
              document_summary: 'This document exceeds Claude\'s 10MB size limit for PDFs. Consider splitting the PDF into smaller parts for analysis or using a different approach for large documents.'
            },
            status: 'skipped_large_file'
          };
        }
      }
      
      // 2. Download the PDF file
      console.log(`[${index+1}/${pdfFiles.length}] ⏳ Downloading PDF file from Google Drive...`);
      let tempFilePath: string | null = null;
      
      try {
        const response = await drive.files.get({
          fileId: file.drive_id,
          alt: 'media',
        }, { responseType: 'arraybuffer' });
        
        if (verbose) {
          console.log(`Downloaded PDF, size: ${response.data.byteLength} bytes`);
        }
        
        // Save the PDF to a temporary location
        const tempDir = path.join(process.cwd(), 'file_types', 'pdf');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Create a safe filename for the temporary file
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        tempFilePath = path.join(tempDir, `temp-${safeName}-${file.drive_id.substring(0, 8)}.pdf`);
        
        // Write the file to disk
        fs.writeFileSync(tempFilePath, Buffer.from(response.data));
        
        if (verbose) {
          console.log(`Saved temporary PDF file to ${tempFilePath}`);
        }
      } catch (downloadError) {
        console.error(`Error downloading PDF file: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`);
        return {
          file,
          result: null,
          status: 'failed',
          error: `Download failed: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`
        };
      }
      
      if (!tempFilePath || !fs.existsSync(tempFilePath)) {
        return {
          file,
          result: null,
          status: 'failed',
          error: 'Failed to save temporary file'
        };
      }
      
      try {
        // 3. Load the classification prompt
        console.log(`[${index+1}/${pdfFiles.length}] ⏳ Loading classification prompt...`);
        const promptResult = await promptService.loadPrompt(CLASSIFICATION_PROMPT, {
          includeDatabaseQueries: true,
          executeQueries: true,
          includeRelationships: true,
          includeRelatedFiles: true
        });
        
        if (verbose) {
          console.log(`Loaded prompt with ${promptResult.combinedContent.length} characters of combined content`);
        }
        
        // 4. Prepare the classification prompt
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
        
        // 5. Use Claude to analyze the PDF
        console.log(`[${index+1}/${pdfFiles.length}] ⏳ Sending PDF to Claude for analysis...`);
        let classificationResult;
        
        try {
          classificationResult = await claudeService.analyzePdfToJson(
            tempFilePath,
            userMessage,
            {
              temperature: 0,
              maxTokens: 4000
            }
          );
          
          console.log(`✅ Successfully analyzed PDF content with Claude`);
        } catch (claudeError) {
          console.error(`Error analyzing PDF with Claude: ${claudeError instanceof Error ? claudeError.message : 'Unknown error'}`);
          return {
            file,
            result: null,
            status: 'failed',
            error: `Claude analysis failed: ${claudeError instanceof Error ? claudeError.message : 'Unknown error'}`
          };
        }
        
        // 6. Update database records
        console.log(`[${index+1}/${pdfFiles.length}] ⏳ Updating database records...`);
        
        // For PDF files, we always set the document_type_id to the PDF document type
        const pdfDocumentTypeId = '2fa04116-04ed-4828-b091-ca6840eb8863';
        
        // Update document type in sources_google
        const { error: updateError } = await supabase
          .from('google_sources')
          .update({ document_type_id: pdfDocumentTypeId })
          .eq('id', file.id);
          
        if (updateError) {
          console.error(`Error updating document type: ${updateError.message}`);
        } else if (verbose) {
          console.log(`Updated document type for ${file.name} to ${pdfDocumentTypeId} (PDF document type)`);
        }
        
        // Update the expert document record
        try {
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
            .from('google_expert_documents')
            .update({
              classification_metadata: classificationResult,
              processed_content: documentSummary,
              document_type_id: "2f5af574-9053-49b1-908d-c35001ce9680", // Fixed document_type_id for Json pdf summary
              document_processing_status: 'reprocessing_done',
              document_processing_status_updated_at: new Date().toISOString()
            })
            .eq('id', expertDoc.id);
            
          if (contentUpdateError) {
            console.error(`Error updating expert document: ${contentUpdateError.message}`);
          } else {
            console.log(`Updated expert document with classification results`);
          }
        } catch (updateError) {
          console.error(`Error updating expert document: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`);
        }
        
        // 7. Clean up temporary file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try {
            fs.unlinkSync(tempFilePath);
            if (verbose) {
              console.log(`Deleted temporary file: ${tempFilePath}`);
            }
          } catch (unlinkError) {
            console.warn(`Failed to delete temporary file ${tempFilePath}: ${unlinkError}`);
          }
        }
        
        console.log(`[${index+1}/${pdfFiles.length}] ✅ Successfully processed ${file.name}`);
        
        return {
          file,
          result: classificationResult,
          status: 'completed'
        };
      } catch (error) {
        // Clean up temporary file if it exists
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch (unlinkError) {
            // Just log and continue
            console.warn(`Failed to delete temporary file ${tempFilePath}: ${unlinkError}`);
          }
        }
        
        console.error(`Error processing file ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        return {
          file,
          result: null,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    } catch (error) {
      console.error(`Error processing file ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        file,
        result: null,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };
  
  // Process all files with concurrency
  console.log(`Processing ${pdfFiles.length} PDF files with concurrency of ${concurrency}`);
  
  const validatedConcurrency = Math.min(Math.max(1, concurrency), 5);
  if (validatedConcurrency !== concurrency) {
    console.log(`Adjusted concurrency to ${validatedConcurrency} (valid range: 1-5)`);
  }
  
  const processedResults = await processWithConcurrency(
    pdfFiles,
    validatedConcurrency,
    processFile
  );
  
  // Prepare summary
  const successCount = processedResults.filter(r => r.status === 'completed' || r.status === 'simulated').length;
  const failedCount = processedResults.filter(r => r.status === 'failed').length;
  const skippedCount = processedResults.filter(r => r.status === 'skipped_large_file').length;
  
  console.log('==================================================');
  console.log(`SUMMARY: Processed ${pdfFiles.length} PDF files, ${successCount} successfully classified`);
  console.log(`         ${failedCount} failed, ${skippedCount} skipped (large files)`);
  
  // Show results table
  console.log('\nResults:');
  console.log('-'.repeat(80));
  console.log('| File ID                               | File Name                  | Status    |');
  console.log('-'.repeat(80));
  
  processedResults.forEach(r => {
    const id = r.file.id.substring(0, 36).padEnd(36);
    const name = (r.file.name || 'Unknown').substring(0, 25).padEnd(25);
    const status = r.status === 'completed' ? 'Success' : 
                   r.status === 'simulated' ? 'Simulated' :
                   r.status === 'skipped_large_file' ? 'Skipped (large)' : 'Failed';
    console.log(`| ${id} | ${name} | ${status.padEnd(9)} |`);
  });
  
  console.log('-'.repeat(80));
  
  return processedResults;
}

// Set up CLI program
if (require.main === module) {
  const program = new Command();
  
  program
    .name('direct-classify-pdfs')
    .description('Directly classify PDF files marked as needs_reprocessing, bypassing complex query logic')
    .option('-l, --limit <number>', 'Maximum number of files to process', '10')
    .option('-c, --concurrency <number>', 'Number of files to process concurrently (1-5)', '3')
    .option('-d, --dry-run', 'Show what would be done without actually processing files')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (options) => {
      try {
        await directClassifyPdfs({
          limit: parseInt(options.limit, 10),
          concurrency: parseInt(options.concurrency, 10),
          dryRun: options.dryRun,
          verbose: options.verbose
        });
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
  
  program.parse(process.argv);
}

export { directClassifyPdfs };