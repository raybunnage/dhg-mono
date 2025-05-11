#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import { GoogleDriveService, defaultGoogleAuth } from '../../../packages/shared/services/google-drive';
import * as mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const supabase = SupabaseClientService.getInstance().getClient();
const googleDriveService = GoogleDriveService.getInstance(defaultGoogleAuth, supabase);

/**
 * Process unprocessed expert documents based on their mime type and steps defined in mime_types_processing.
 * Currently supports DOCX files only.
 * 
 * For DOCX files:
 * 1. Finds expert documents with "unprocessed" status and DOCX mime type
 * 2. Updates status to "extraction_in_progress"
 * 3. Downloads the DOCX from Google Drive
 * 4. Extracts content using Mammoth
 * 5. Updates expert document with extracted content
 * 6. Sets pipeline_status to "needs_classification"
 */
async function processUnprocessed(options: {
  limit?: number;
  dryRun?: boolean;
  verbose?: boolean;
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

    // 1. Get the processing configuration for DOCX from mime_types_processing
    const docxMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    console.log(`Looking up processing configuration for DOCX mime type...`);
    
    const { data: mimeTypeData, error: mimeTypeError } = await supabase
      .from('mime_types')
      .select('id')
      .eq('mime_type', docxMimeType)
      .single();
      
    if (mimeTypeError) {
      console.error(`Error finding mime_type entry: ${mimeTypeError.message}`);
      if (trackingId !== 'tracking-unavailable') {
        await commandTrackingService.failTracking(trackingId, `Error finding mime_type entry: ${mimeTypeError.message}`);
      }
      return;
    }
    
    if (!mimeTypeData) {
      console.error(`Could not find mime type for DOCX`);
      if (trackingId !== 'tracking-unavailable') {
        await commandTrackingService.failTracking(trackingId, `Could not find mime type for DOCX`);
      }
      return;
    }
    
    const docxMimeTypeId = mimeTypeData.id;
    
    const { data: processingConfig, error: processingConfigError } = await supabase
      .from('mime_type_processing')
      .select('*')
      .eq('mime_type_id', docxMimeTypeId)
      .single();
      
    if (processingConfigError) {
      console.error(`Error finding processing configuration: ${processingConfigError.message}`);
      if (trackingId !== 'tracking-unavailable') {
        await commandTrackingService.failTracking(trackingId, `Error finding processing configuration: ${processingConfigError.message}`);
      }
      return;
    }
    
    if (!processingConfig) {
      console.error(`No processing configuration found for DOCX mime type`);
      if (trackingId !== 'tracking-unavailable') {
        await commandTrackingService.failTracking(trackingId, `No processing configuration found for DOCX mime type`);
      }
      return;
    }
    
    if (verbose) {
      console.log(`Found processing configuration for DOCX:`, processingConfig);
    }
    
    // 2. Find unprocessed DOCX files
    console.log(`Finding unprocessed DOCX files...`);
    
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
      .eq('sources_google.mime_type', docxMimeType)
      .limit(limit);
      
    if (unprocessedFilesError) {
      console.error(`Error finding unprocessed files: ${unprocessedFilesError.message}`);
      if (trackingId !== 'tracking-unavailable') {
        await commandTrackingService.failTracking(trackingId, `Error finding unprocessed files: ${unprocessedFilesError.message}`);
      }
      return;
    }
    
    if (!unprocessedFiles || unprocessedFiles.length === 0) {
      console.log(`No unprocessed DOCX files found`);
      if (trackingId !== 'tracking-unavailable') {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: 0,
          summary: 'No unprocessed DOCX files found'
        });
      }
      return;
    }
    
    console.log(`Found ${unprocessedFiles.length} unprocessed DOCX files`);
    
    // Process each file
    let successCount = 0;
    let errorCount = 0;
    
    for (const file of unprocessedFiles) {
      try {
        // The sources_google field contains the joined record
        const expertDocId = file.id;
        const sourceId = file.source_id;
        
        // In expert_documents with nested select, sources_google is the joined record
        const sourceGoogle = file.sources_google as any; // Type assertion to bypass TypeScript checks
        const driveId = sourceGoogle.drive_id;
        const fileName = sourceGoogle.name;
        
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
        
        // 4. Download DOCX from Google Drive using the GoogleDriveService
        console.log(`Downloading file from Google Drive...`);
        
        try {
          // Create temporary directory for file operations
          const tempDir = path.join(process.cwd(), 'document-analysis-results');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          // Temporary file path for the downloaded DOCX
          const tempFilePath = path.join(tempDir, `temp-${driveId}.docx`);
          
          try {
            // Use Google Drive API directly for downloading
            const { google } = require('googleapis');
            const { JWT } = require('google-auth-library');
            
            // Get service account key file path - using the same approach as sync-and-update-metadata
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
      } catch (googleApiError) {
        // Error with Google Drive API or file processing
        console.error(`Error with Google Drive API or file processing: ${googleApiError instanceof Error ? googleApiError.message : String(googleApiError)}`);
        
        const { error: updateFailStatusError } = await supabase
          .from('expert_documents')
          .update({ 
            pipeline_status: 'extraction_failed',
            processing_error: `Google Drive API error: ${googleApiError instanceof Error ? googleApiError.message : String(googleApiError)}`
          })
          .eq('id', expertDocId);
          
        errorCount++;
        continue;
      }
      } catch (extractionError) {
        // Outer catch block for any errors in the extraction process
        console.error(`Error during extraction: ${extractionError instanceof Error ? extractionError.message : String(extractionError)}`);
        
        const { error: updateFailStatusError } = await supabase
          .from('expert_documents')
          .update({ 
            pipeline_status: 'extraction_failed',
            processing_error: `Error during extraction: ${extractionError instanceof Error ? extractionError.message : String(extractionError)}`
          })
          .eq('id', expertDocId);
          
        errorCount++;
      }
      } catch (fileError) {
        console.error(`Error processing file: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
        errorCount++;
      }
    }
    
    // Print summary
    console.log(`\nProcessing Summary:`);
    console.log(`------------------`);
    console.log(`Total files: ${unprocessedFiles.length}`);
    console.log(`Successfully processed: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    
    if (trackingId !== 'tracking-unavailable') {
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: successCount,
        summary: `Processed ${successCount} DOCX files with ${errorCount} errors`
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
  .description('Process unprocessed expert documents by mime type according to their processing configuration. Currently supports DOCX files only.')
  .option('-l, --limit <number>', 'Maximum number of files to process', '10')
  .option('-d, --dry-run', 'Show what would be processed without making changes', false)
  .option('-v, --verbose', 'Show detailed processing information', false)
  .action((options) => {
    processUnprocessed({
      limit: parseInt(options.limit),
      dryRun: options.dryRun,
      verbose: options.verbose
    });
  });

// If this script is executed directly
if (require.main === module) {
  program.parse(process.argv);
}