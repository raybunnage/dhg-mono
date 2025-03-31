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
  outputDir: path.join(process.cwd(), 'file_types', 'transcripts')
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

/**
 * Run a transcription command for a document
 */
async function transcribeDocument(documentId: string): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const command = 'ts-node';
    const args = [
      path.join(__dirname, 'transcribe-audio.ts'),
      documentId,
      `--model`, options.model
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
    // Find docs that are ready for transcription (have been processed but don't have raw_content yet)
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
    
    if (!pendingDocs || pendingDocs.length === 0) {
      Logger.info('ℹ️ No pending documents found for transcription');
      return [];
    }
    
    return pendingDocs.map(doc => doc.id);
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
    
    Logger.info(`📋 Found ${documentIds.length} documents ready for transcription`);
    
    // Start timestamp for timing
    const startTime = Date.now();
    
    // Process documents
    let results;
    if (options.parallel) {
      Logger.info(`🔄 Processing ${documentIds.length} documents in parallel (max ${options.maxParallel} at a time)`);
      results = await processInParallel(documentIds, options.maxParallel);
    } else {
      Logger.info(`🔄 Processing ${documentIds.length} documents sequentially`);
      results = await processSequentially(documentIds);
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