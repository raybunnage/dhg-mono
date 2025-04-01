#!/usr/bin/env ts-node
/**
 * Update Processing Status Command
 * 
 * This command updates the processing status of expert documents
 * in the media processing pipeline (MP4 → M4A → Transcript).
 * 
 * Usage:
 *   update-status.ts [fileId] [options]
 * 
 * Options:
 *   --stage [stage]            Stage to update (extraction, transcription)
 *   --status [status]          New status (pending, processing, completed, failed, skip_processing)
 *   --error [message]          Error message (for failed status)
 *   --batch [file]             Process a batch of files from a file (one ID per line)
 * 
 * Note:
 *   The 'skip_processing' status marks large files to be excluded from batch processing.
 *   Files with this status will be skipped by processing commands.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../../../packages/shared/utils';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  fileId: '',
  stage: '',
  status: '',
  error: '',
  batchFile: ''
};

// Get file ID (first non-option argument)
const fileIdArg = args.find(arg => !arg.startsWith('--'));
if (fileIdArg) {
  options.fileId = fileIdArg;
}

// Get stage if specified
const stageIndex = args.indexOf('--stage');
if (stageIndex !== -1 && args[stageIndex + 1]) {
  const stageArg = args[stageIndex + 1].toLowerCase();
  if (['extraction', 'transcription'].includes(stageArg)) {
    options.stage = stageArg;
  }
}

// Get status if specified
const statusIndex = args.indexOf('--status');
if (statusIndex !== -1 && args[statusIndex + 1]) {
  const statusArg = args[statusIndex + 1].toLowerCase();
  if (['pending', 'processing', 'completed', 'failed', 'extracted', 'transcribed', 'skip_processing'].includes(statusArg)) {
    options.status = statusArg;
  }
}

// Get error if specified
const errorIndex = args.indexOf('--error');
if (errorIndex !== -1 && args[errorIndex + 1]) {
  options.error = args[errorIndex + 1];
}

// Get batch file if specified
const batchIndex = args.indexOf('--batch');
if (batchIndex !== -1 && args[batchIndex + 1]) {
  options.batchFile = args[batchIndex + 1];
}

/**
 * Update the status of a single document
 */
async function updateDocumentStatus(documentId: string, supabase: any): Promise<boolean> {
  try {
    // Get the document from the database
    const { data: document, error: docError } = await supabase
      .from('expert_documents')
      .select('id, content_type, processing_status, transcription_complete')
      .eq('id', documentId)
      .single();
    
    if (docError) {
      Logger.error(`❌ Error fetching expert document: ${docError.message}`);
      return false;
    }
    
    if (!document) {
      Logger.error(`❌ Document with ID ${documentId} not found`);
      return false;
    }
    
    // Validate the stage and status combinations
    if (options.stage === 'extraction' || options.stage === 'transcription') {
      if (!['pending', 'processing', 'completed', 'failed'].includes(options.status)) {
        Logger.error(`❌ Invalid status '${options.status}' for ${options.stage} stage`);
        return false;
      }
    } else {
      Logger.error(`❌ Invalid or missing stage: ${options.stage}`);
      return false;
    }
    
    // Build the update data
    const updateData: any = {};
    
    // Both stages update the processing_status field
    updateData.processing_status = options.status;
    
    // For transcription stage, also update transcription_complete if completed
    if (options.stage === 'transcription' && options.status === 'completed') {
      updateData.transcription_complete = true;
    } else if (options.stage === 'transcription' && options.status === 'pending') {
      updateData.transcription_complete = false;
    }
    
    // Add error message if applicable
    if (options.status === 'failed' && options.error) {
      updateData.processing_error = options.error;
    }
    
    // Update the document
    const { error: updateError } = await supabase
      .from('expert_documents')
      .update(updateData)
      .eq('id', documentId);
    
    if (updateError) {
      Logger.error(`❌ Error updating document status: ${updateError.message}`);
      return false;
    }
    
    Logger.info(`✅ Successfully updated document ${documentId}`);
    Logger.info(`   ${options.stage} status -> ${options.status}`);
    
    return true;
  } catch (error: any) {
    Logger.error(`❌ Exception in updateDocumentStatus: ${error.message}`);
    return false;
  }
}

/**
 * Process a batch of documents from file
 */
async function processBatch(supabase: any, filePath: string): Promise<{ success: number; failed: number }> {
  try {
    // Read the batch file
    if (!fs.existsSync(filePath)) {
      Logger.error(`❌ Batch file not found: ${filePath}`);
      return { success: 0, failed: 0 };
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const documentIds = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (documentIds.length === 0) {
      Logger.error('❌ No document IDs found in batch file');
      return { success: 0, failed: 0 };
    }
    
    Logger.info(`📋 Found ${documentIds.length} document IDs in batch file`);
    
    let success = 0;
    let failed = 0;
    
    // Process each document ID
    for (const documentId of documentIds) {
      Logger.info(`📋 Processing document: ${documentId}`);
      const result = await updateDocumentStatus(documentId, supabase);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }
    
    return { success, failed };
  } catch (error: any) {
    Logger.error(`❌ Exception in processBatch: ${error.message}`);
    return { success: 0, failed: 0 };
  }
}

async function main() {
  try {
    // Validate required options
    if (!options.stage) {
      Logger.error('❌ Missing required option: --stage');
      Logger.info('Usage: update-status.ts [fileId] --stage [extraction|transcription] --status [status]');
      process.exit(1);
    }
    
    if (!options.status) {
      Logger.error('❌ Missing required option: --status');
      Logger.info('Usage: update-status.ts [fileId] --stage [extraction|transcription] --status [status]');
      process.exit(1);
    }
    
    // Get the Supabase client using singleton pattern
    const supabaseClientService = SupabaseClientService.getInstance();
    let supabase: any;
    
    try {
      supabase = supabaseClientService.getClient();
      Logger.info('✅ Successfully connected to Supabase');
    } catch (error: any) {
      Logger.error('❌ Error getting Supabase client', error);
      process.exit(1);
    }
    
    // Display configuration
    Logger.info('🔄 Updating Processing Status');
    Logger.info(`Stage: ${options.stage}`);
    Logger.info(`Status: ${options.status}`);
    
    // Handle batch processing
    if (options.batchFile) {
      Logger.info(`Processing batch from file: ${options.batchFile}`);
      const { success, failed } = await processBatch(supabase, options.batchFile);
      Logger.info(`✅ Batch processing complete: ${success} succeeded, ${failed} failed`);
    }
    // Handle single document
    else if (options.fileId) {
      // Check if the fileId is a UUID (expert document)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (uuidPattern.test(options.fileId)) {
        Logger.info(`📋 Processing expert document: ${options.fileId}`);
        await updateDocumentStatus(options.fileId, supabase);
      } else {
        Logger.error('❌ File ID must be a valid UUID for an expert document');
        process.exit(1);
      }
    } else {
      Logger.error('❌ No file ID or batch file specified');
      Logger.info('Usage: update-status.ts [fileId] --stage [extraction|transcription] --status [status]');
      Logger.info('   or: update-status.ts --batch [file] --stage [extraction|transcription] --status [status]');
      process.exit(1);
    }
  } catch (error: any) {
    Logger.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Execute the main function
main().catch((error: any) => {
  Logger.error('Unhandled error:', error);
  process.exit(1);
});