#!/usr/bin/env ts-node
/**
 * Batch Transcribe Command
 * 
 * This command finds and processes multiple documents that are ready for transcription.
 * It can process files either sequentially or in parallel.
 * 
 * Usage:
 *   batch-transcribe.ts [options]
 * 
 * Options:
 *   --limit [number]           Number of files to process (default: 5)
 *   --model [tiny|base|small]  Specify Whisper model (default: base)
 *   --dry-run                  Show what would be transcribed without actual processing
 *   --parallel                 Process files in parallel instead of sequentially
 *   --max-parallel [number]    Maximum number of parallel processes (default: 3)
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { Logger } from '../../../../packages/shared/utils';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  limit: 5,
  model: 'base' as 'tiny' | 'base' | 'small' | 'medium' | 'large',
  parallel: args.includes('--parallel'),
  maxParallel: 3,
  outputDir: path.join(process.cwd(), 'file_types', 'transcripts'),
  accelerator: 'T4' as 'T4' | 'A10G' | 'A100' | 'CPU'
};

// Get limit if specified
const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1 && args[limitIndex + 1]) {
  const limitArg = parseInt(args[limitIndex + 1]);
  if (!isNaN(limitArg)) {
    options.limit = limitArg;
  }
}

// Get model if specified
const modelIndex = args.indexOf('--model');
if (modelIndex !== -1 && args[modelIndex + 1]) {
  const modelArg = args[modelIndex + 1];
  if (['tiny', 'base', 'small', 'medium', 'large'].includes(modelArg)) {
    options.model = modelArg as 'tiny' | 'base' | 'small' | 'medium' | 'large';
  }
}

// Get max parallel if specified
const maxParallelIndex = args.indexOf('--max-parallel');
if (maxParallelIndex !== -1 && args[maxParallelIndex + 1]) {
  const maxParallelArg = parseInt(args[maxParallelIndex + 1]);
  if (!isNaN(maxParallelArg)) {
    options.maxParallel = maxParallelArg;
  }
}

// Get output directory if specified
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1 && args[outputIndex + 1]) {
  options.outputDir = args[outputIndex + 1];
}

// Get accelerator if specified
const acceleratorIndex = args.indexOf('--accelerator');
if (acceleratorIndex !== -1 && args[acceleratorIndex + 1]) {
  const acceleratorArg = args[acceleratorIndex + 1];
  if (['T4', 'A10G', 'A100', 'CPU'].includes(acceleratorArg)) {
    options.accelerator = acceleratorArg as 'T4' | 'A10G' | 'A100' | 'CPU';
  }
}

/**
 * Run a transcription command for a document
 */
async function transcribeDocument(documentId: string): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const command = 'ts-node';
    const args = [
      path.join(__dirname, 'transcribe-audio.ts'),
      documentId,
      `--model`, options.model,
      `--accelerator`, options.accelerator
    ];
    
    if (options.dryRun) {
      args.push('--dry-run');
    }
    
    Logger.info(`🎙️ Running: ${command} ${args.join(' ')}`);
    
    const process = spawn(command, args);
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
      Logger.info(`[${documentId}] ${data.toString().trim()}`);
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
      Logger.error(`[${documentId}] ${data.toString().trim()}`);
    });
    
    process.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout,
        stderr
      });
    });
  });
}

/**
 * Find documents ready for transcription
 */
async function findDocumentsToTranscribe(supabase: any, limit: number): Promise<string[]> {
  try {
    // First, check for documents marked as pending or processing
    const { data: pendingDocs, error: queryError } = await supabase
      .from('expert_documents')
      .select('id, source_id, content_type, raw_content, processing_status')
      .eq('content_type', 'presentation')
      .in('processing_status', ['pending', 'processing']) // Check both statuses
      .is('raw_content', null)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (queryError) {
      Logger.error(`❌ Error fetching pending documents: ${queryError.message}`);
      return [];
    }
    
    if (pendingDocs && pendingDocs.length > 0) {
      Logger.info(`Found ${pendingDocs.length} documents with pending/processing status`);
      return pendingDocs.map((doc: any) => doc.id);
    }
    
    // If no pending docs found, check for any presentation documents with null raw_content
    // regardless of processing_status (may have been incorrectly set)
    Logger.info('No pending documents found, checking for any unprocessed documents...');
    const { data: unprocessedDocs, error: unprocessedError } = await supabase
      .from('expert_documents')
      .select('id, source_id, content_type, raw_content, processing_status')
      .eq('content_type', 'presentation')
      .is('raw_content', null)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (unprocessedError) {
      Logger.error(`❌ Error fetching unprocessed documents: ${unprocessedError.message}`);
      return [];
    }
    
    if (!unprocessedDocs || unprocessedDocs.length === 0) {
      Logger.info('ℹ️ No documents found for transcription');
      return [];
    }
    
    Logger.info(`Found ${unprocessedDocs.length} documents with null raw_content`);
    return unprocessedDocs.map((doc: any) => doc.id);
  } catch (error: any) {
    Logger.error(`❌ Exception in findDocumentsToTranscribe: ${error.message}`);
    return [];
  }
}

/**
 * Process documents sequentially
 */
async function processSequentially(documentIds: string[]): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  
  for (const docId of documentIds) {
    Logger.info(`📋 Processing document ${docId} (${documentIds.indexOf(docId) + 1}/${documentIds.length})`);
    
    const result = await transcribeDocument(docId);
    
    if (result.success) {
      success++;
      Logger.info(`✅ Successfully transcribed document ${docId}`);
    } else {
      failed++;
      Logger.error(`❌ Failed to transcribe document ${docId}`);
    }
  }
  
  return { success, failed };
}

/**
 * Process documents in parallel
 */
async function processInParallel(documentIds: string[], maxParallel: number): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  
  // Process in batches based on maxParallel
  for (let i = 0; i < documentIds.length; i += maxParallel) {
    const batch = documentIds.slice(i, i + maxParallel);
    
    Logger.info(`📋 Processing batch ${Math.floor(i / maxParallel) + 1}/${Math.ceil(documentIds.length / maxParallel)} with ${batch.length} documents`);
    
    const results = await Promise.all(batch.map(docId => transcribeDocument(docId)));
    
    for (let j = 0; j < results.length; j++) {
      const docId = batch[j];
      const result = results[j];
      
      if (result.success) {
        success++;
        Logger.info(`✅ Successfully transcribed document ${docId}`);
      } else {
        failed++;
        Logger.error(`❌ Failed to transcribe document ${docId}`);
      }
    }
  }
  
  return { success, failed };
}

async function main() {
  try {
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
    Logger.info('🔄 Batch Transcription');
    Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
    Logger.info(`Model: ${options.model}`);
    Logger.info(`Accelerator: ${options.accelerator}`);
    Logger.info(`Limit: ${options.limit}`);
    Logger.info(`Processing: ${options.parallel ? 'Parallel' : 'Sequential'}`);
    if (options.parallel) {
      Logger.info(`Max parallel: ${options.maxParallel}`);
    }
    
    // Ensure output directory exists
    if (!fs.existsSync(options.outputDir)) {
      fs.mkdirSync(options.outputDir, { recursive: true });
      Logger.info(`✅ Created output directory: ${options.outputDir}`);
    }
    
    // Find documents to transcribe
    const documentIds = await findDocumentsToTranscribe(supabase, options.limit);
    
    if (documentIds.length === 0) {
      Logger.info('ℹ️ No documents found for transcription');
      process.exit(0);
    }
    
    // Verify that each document has a corresponding audio file before processing
    Logger.info(`📋 Found ${documentIds.length} documents ready for transcription - verifying audio files`);
    const verifiedDocumentIds: string[] = [];
    
    for (const docId of documentIds) {
      // Get the document source info
      const { data: document, error: docError } = await supabase
        .from('expert_documents')
        .select('id, source_id')
        .eq('id', docId)
        .single();
        
      if (docError || !document) {
        Logger.warn(`⚠️ Could not verify document ${docId}: ${docError?.message || 'Not found'}`);
        continue;
      }
      
      // Get the source file information
      const { data: sourceFile, error: sourceError } = await supabase
        .from('google_sources')
        .select('id, name')
        .eq('id', document.source_id)
        .single();
        
      if (sourceError || !sourceFile) {
        Logger.warn(`⚠️ Could not verify source for document ${docId}: ${sourceError?.message || 'Source not found'}`);
        continue;
      }
      
      // Check if we have the corresponding audio file
      const sourceFilename = sourceFile.name.replace(/\.[^/.]+$/, "");
      const audioDir = path.join(process.cwd(), 'file_types', 'm4a');
      let audioFileExists = false;
      
      try {
        const files = fs.readdirSync(audioDir);
        const matchingFile = files.find(file => 
          (file === sourceFilename + '.m4a' || 
          file === 'INGESTED_' + sourceFilename + '.m4a' ||
          file.toLowerCase().includes(sourceFilename.toLowerCase()))
        );
        
        if (matchingFile) {
          audioFileExists = true;
          verifiedDocumentIds.push(docId);
          Logger.info(`✅ Verified audio file exists for document ${docId} (${sourceFile.name})`);
        } else {
          Logger.warn(`⚠️ No audio file found for document ${docId} (${sourceFile.name}) - skipping`);
          
          // Update document status to error
          const { error: updateError } = await supabase
            .from('expert_documents')
            .update({ 
              processing_status: 'error',
              processing_error: `Audio file not found for ${sourceFilename}`
            })
            .eq('id', docId);
            
          if (updateError) {
            Logger.error(`❌ Error updating document status: ${updateError.message}`);
          }
        }
      } catch (error: any) {
        Logger.warn(`⚠️ Error checking audio for document ${docId}: ${error.message}`);
      }
    }
    
    if (verifiedDocumentIds.length === 0) {
      Logger.info('ℹ️ No documents with verified audio files found for transcription');
      process.exit(0);
    }
    
    Logger.info(`📋 Processing ${verifiedDocumentIds.length} verified documents`);
    
    // Start timestamp for timing
    const startTime = Date.now();
    
    // Process documents
    let results;
    if (options.parallel) {
      Logger.info(`🔄 Processing ${verifiedDocumentIds.length} documents in parallel (max ${options.maxParallel} at a time)`);
      results = await processInParallel(verifiedDocumentIds, options.maxParallel);
    } else {
      Logger.info(`🔄 Processing ${verifiedDocumentIds.length} documents sequentially`);
      results = await processSequentially(verifiedDocumentIds);
    }
    
    // Calculate processing time
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    
    // Output final statistics
    Logger.info(`✅ Batch processing complete: ${results.success} succeeded, ${results.failed} failed`);
    Logger.info(`⏱️ Total processing time: ${processingTime.toFixed(2)} seconds`);
    Logger.info(`⏱️ Average time per document: ${(processingTime / documentIds.length).toFixed(2)} seconds`);
    
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