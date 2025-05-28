#!/usr/bin/env ts-node
/**
 * Process Video Command
 * 
 * This command orchestrates the full processing pipeline for video files:
 * 1. Converts MP4 to M4A (audio extraction)
 * 2. Transcribes the audio using Whisper
 * 
 * Usage:
 *   process-video.ts [fileId] [options]
 * 
 * Options:
 *   --dry-run                  Show what would be processed without actual changes
 *   --model [tiny|base|small]  Specify Whisper model (default: base)
 *   --batch [number]           Process a batch of pending files
 *   --skip-conversion          Skip the MP4 to M4A conversion step
 *   --skip-transcription       Skip the transcription step
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
  model: 'base',
  batchSize: 0,
  fileId: '',
  skipConversion: args.includes('--skip-conversion'),
  skipTranscription: args.includes('--skip-transcription')
};

// Get file ID (first non-option argument)
const fileIdArg = args.find(arg => !arg.startsWith('--'));
if (fileIdArg) {
  options.fileId = fileIdArg;
}

// Get model if specified
const modelIndex = args.indexOf('--model');
if (modelIndex !== -1 && args[modelIndex + 1]) {
  const modelArg = args[modelIndex + 1];
  if (['tiny', 'base', 'small', 'medium', 'large'].includes(modelArg)) {
    options.model = modelArg;
  }
}

// Get batch size if specified
const batchIndex = args.indexOf('--batch');
if (batchIndex !== -1 && args[batchIndex + 1]) {
  const batchArg = parseInt(args[batchIndex + 1]);
  if (!isNaN(batchArg)) {
    options.batchSize = batchArg;
  }
}

/**
 * Run a command in the same directory
 */
async function runCommand(command: string, args: string[]): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const process = spawn(command, args);
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
      Logger.info(data.toString().trim());
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
      // Skip printing stderr as it's redundant with stdout for our logging
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
 * Process a single expert document through the full pipeline
 */
async function processExpertDocument(documentId: string): Promise<boolean> {
  // Check steps to run
  const runConversion = !options.skipConversion;
  const runTranscription = !options.skipTranscription;
  
  // Skip both steps?
  if (!runConversion && !runTranscription) {
    Logger.warn('⚠️ Both conversion and transcription steps are skipped, nothing to do');
    return false;
  }
  
  // Build common args
  const commonArgs = options.dryRun ? ['--dry-run'] : [];
  
  // Run conversion step
  if (runConversion) {
    Logger.info('Step 1: Converting MP4 to M4A');
    
    const conversionArgs = [
      ...commonArgs,
      documentId
    ];
    
    if (options.dryRun) {
      Logger.info(`🔄 Would run: convert-mp4.ts ${conversionArgs.join(' ')}`);
    } else {
      const { success, stderr } = await runCommand('ts-node', [
        path.join(__dirname, 'convert-mp4.ts'),
        ...conversionArgs
      ]);
      
      if (!success) {
        Logger.error('❌ Conversion step failed, aborting pipeline');
        return false;
      }
      
      Logger.info('✅ Conversion step completed successfully');
    }
  } else {
    Logger.info('ℹ️ Skipping conversion step');
  }
  
  // Run transcription step
  if (runTranscription) {
    Logger.info('Step 2: Transcribing audio');
    
    const transcriptionArgs = [
      ...commonArgs,
      '--model', options.model,
      documentId
    ];
    
    if (options.dryRun) {
      Logger.info(`🔄 Would run: transcribe-audio.ts ${transcriptionArgs.join(' ')}`);
    } else {
      const { success, stderr } = await runCommand('ts-node', [
        path.join(__dirname, 'transcribe-audio.ts'),
        ...transcriptionArgs
      ]);
      
      if (!success) {
        Logger.error('❌ Transcription step failed');
        return false;
      }
      
      Logger.info('✅ Transcription step completed successfully');
    }
  } else {
    Logger.info('ℹ️ Skipping transcription step');
  }
  
  return true;
}

/**
 * Process a batch of files through the full pipeline
 */
async function processBatch(supabase: any, limit: number): Promise<{ success: number; failed: number }> {
  try {
    // Get documents ready for processing
    const { data: pendingDocs, error: queryError } = await supabase
      .from('google_expert_documents')
      .select('id, source_id, content_type, content_extraction_status, transcription_status')
      .eq('content_type', 'presentation')
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (queryError) {
      Logger.error(`❌ Error fetching documents: ${queryError.message}`);
      return { success: 0, failed: 0 };
    }
    
    if (!pendingDocs || pendingDocs.length === 0) {
      Logger.info('ℹ️ No documents found for processing');
      return { success: 0, failed: 0 };
    }
    
    // Filter documents based on processing needs
    const docsToProcess = pendingDocs.filter(doc => {
      // If skipping conversion, only include docs with extracted audio
      if (options.skipConversion && doc.content_extraction_status !== 'extracted') {
        return false;
      }
      
      // If skipping transcription, only include docs without transcription
      if (options.skipTranscription && doc.transcription_status === 'transcribed') {
        return false;
      }
      
      return true;
    });
    
    if (docsToProcess.length === 0) {
      Logger.info('ℹ️ No documents found that need the selected processing steps');
      return { success: 0, failed: 0 };
    }
    
    Logger.info(`📋 Found ${docsToProcess.length} documents to process`);
    
    let success = 0;
    let failed = 0;
    
    // Process each document
    for (const doc of docsToProcess) {
      Logger.info(`📋 Processing document: ${doc.id}`);
      const result = await processExpertDocument(doc.id);
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
    Logger.info('🎬 Video Processing Pipeline');
    Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
    Logger.info(`Whisper model: ${options.model}`);
    Logger.info(`Steps: ${!options.skipConversion ? 'Conversion' : ''} ${(!options.skipConversion && !options.skipTranscription) ? '+' : ''} ${!options.skipTranscription ? 'Transcription' : ''}`);
    
    // Handle batch processing
    if (options.batchSize > 0) {
      Logger.info(`Processing batch of up to ${options.batchSize} documents`);
      const { success, failed } = await processBatch(supabase, options.batchSize);
      Logger.info(`✅ Batch processing complete: ${success} succeeded, ${failed} failed`);
    }
    // Handle single document
    else if (options.fileId) {
      // Check if the fileId is a UUID (expert document)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (uuidPattern.test(options.fileId)) {
        Logger.info(`📋 Processing expert document: ${options.fileId}`);
        const result = await processExpertDocument(options.fileId);
        if (result) {
          Logger.info('✅ Processing completed successfully');
        } else {
          Logger.error('❌ Processing failed');
          process.exit(1);
        }
      } else {
        Logger.error('❌ File ID must be a valid UUID for an expert document');
        process.exit(1);
      }
    } else {
      Logger.error('❌ No file ID or batch size specified');
      Logger.info('Usage: process-video.ts [fileId] [options]');
      Logger.info('   or: process-video.ts --batch [number] [options]');
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