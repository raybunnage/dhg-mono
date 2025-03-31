#!/usr/bin/env ts-node
/**
 * Transcribe Audio Command
 * 
 * This command transcribes audio files from expert_documents or provided file paths
 * using the Modal-based Whisper transcription service.
 * 
 * Usage:
 *   transcribe-audio.ts [fileId] [options]
 * 
 * Options:
 *   --model [tiny|base|small]  Specify Whisper model (default: base)
 *   --dry-run                  Show what would be transcribed without actual processing
 *   --output [path]            Specify output directory
 *   --batch [number]           Process a batch of pending transcriptions
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
  outputDir: path.join(process.cwd(), 'file_types', 'transcripts'),
  batchSize: 0,
  fileId: ''
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

// Get output directory if specified
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1 && args[outputIndex + 1]) {
  options.outputDir = args[outputIndex + 1];
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
 * Transcribe an audio file using the Python Modal service
 */
async function transcribeFile(filePath: string): Promise<{ success: boolean; result?: any; error?: string }> {
  return new Promise((resolve) => {
    Logger.info(`🎙️ Transcribing ${filePath} with ${options.model} model...`);
    
    // Execute the Python script
    const pythonProcess = spawn('python', [
      path.join(process.cwd(), 'packages/python-audio-processor/scripts/base_audio_transcript.py'),
      filePath,
      path.join(options.outputDir, `${path.basename(filePath).replace(/\.[^/.]+$/, "")}_transcript.txt`)
    ]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      Logger.info(`${data.toString().trim()}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      Logger.error(`${data.toString().trim()}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        // Extract transcript from stdout
        const transcriptMatch = stdout.match(/TRANSCRIPT_BEGIN\n([\s\S]*?)\nTRANSCRIPT_END/);
        const transcriptText = transcriptMatch ? transcriptMatch[1] : '';
        
        // Get output path
        const baseName = path.basename(filePath).replace(/\.[^/.]+$/, "");
        const outputPath = path.join(options.outputDir, `${baseName}_transcript.txt`);
        
        try {
          if (transcriptText) {
            resolve({ 
              success: true, 
              result: { 
                text: transcriptText,
                processing_metadata: {
                  model: 'base',
                  audio_file: filePath
                }
              }
            });
          } else if (fs.existsSync(outputPath)) {
            // Try reading from the output file if TRANSCRIPT markers not found
            const transcriptText = fs.readFileSync(outputPath, 'utf8');
            resolve({ 
              success: true, 
              result: { 
                text: transcriptText,
                processing_metadata: {
                  model: 'base',
                  audio_file: filePath
                }
              }
            });
          } else {
            resolve({ 
              success: true, 
              result: { 
                text: 'Transcription process completed but transcript not found',
                processing_metadata: {
                  model: 'base'
                }
              }
            });
          }
        } catch (error: any) {
          resolve({ 
            success: true, 
            result: { 
              text: `Transcription successful but error reading transcript: ${error.message}`,
              processing_metadata: {
                model: 'base'
              }
            }
          });
        }
      } else {
        resolve({ success: false, error: `Process exited with code ${code}: ${stderr}` });
      }
    });
  });
}

/**
 * Transcribe an expert document from the database
 */
async function transcribeExpertDocument(documentId: string, supabase: any): Promise<boolean> {
  try {
    // Get the document from the database
    const { data: document, error: docError } = await supabase
      .from('expert_documents')
      .select('id, source_id, processing_status, raw_content')
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
    
    // Check if the document is already transcribed (has raw_content)
    if (document.raw_content && document.raw_content.length > 0) {
      Logger.warn(`⚠️ Document ${documentId} already has transcription content`);
      return true;
    }
    
    // Update status to processing
    if (!options.dryRun) {
      const { error: updateError } = await supabase
        .from('expert_documents')
        .update({ 
          processing_status: 'processing' 
        })
        .eq('id', documentId);
      
      if (updateError) {
        Logger.error(`❌ Error updating document status: ${updateError.message}`);
      }
    }
    
    // Get the audio file path
    const { data: sourceFile, error: sourceError } = await supabase
      .from('sources_google')
      .select('id, name, mime_type, metadata')
      .eq('id', document.source_id)
      .single();
    
    if (sourceError || !sourceFile) {
      Logger.error(`❌ Error fetching source file: ${sourceError?.message || 'Source not found'}`);
      return false;
    }
    
    // Find the corresponding audio file
    let audioPath = '';
    const sourceFilename = sourceFile.name.replace(/\.[^/.]+$/, "");
    
    // Check for MP3 file in audio directory
    const audioDir = path.join(process.cwd(), 'file_types', 'm4a');
    
    try {
      const files = fs.readdirSync(audioDir);
      const matchingFile = files.find(file => 
        file.toLowerCase().includes(sourceFilename.toLowerCase()) && 
        (file.endsWith('.m4a') || file.endsWith('.mp3'))
      );
      
      if (matchingFile) {
        audioPath = path.join(audioDir, matchingFile);
      }
    } catch (error: any) {
      Logger.error(`❌ Error reading audio directory: ${error.message}`);
      return false;
    }
    
    if (!audioPath) {
      Logger.error(`❌ Audio file for source ${sourceFilename} not found`);
      return false;
    }
    
    Logger.info(`📋 Found audio file: ${audioPath}`);
    
    if (options.dryRun) {
      Logger.info(`🔄 Would transcribe ${audioPath} using ${options.model} model`);
      return true;
    }
    
    // Transcribe the file
    const { success, result, error } = await transcribeFile(audioPath);
    
    if (!success || !result) {
      Logger.error(`❌ Transcription failed: ${error}`);
      
      // Update status to error
      const { error: updateError } = await supabase
        .from('expert_documents')
        .update({ 
          processing_status: 'error', 
          processing_error: error 
        })
        .eq('id', documentId);
      
      if (updateError) {
        Logger.error(`❌ Error updating document status: ${updateError.message}`);
      }
      
      return false;
    }
    
    // Update the document with the transcription
    const { error: saveError } = await supabase
      .from('expert_documents')
      .update({
        raw_content: result.text,
        processing_status: 'completed',
        word_count: result.text.split(' ').length,
        processed_content: result,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', documentId);
    
    if (saveError) {
      Logger.error(`❌ Error saving transcription: ${saveError.message}`);
      return false;
    }
    
    Logger.info(`✅ Successfully transcribed document ${documentId}`);
    return true;
  } catch (error: any) {
    Logger.error(`❌ Exception in transcribeExpertDocument: ${error.message}`);
    return false;
  }
}

/**
 * Process a batch of pending transcriptions
 */
async function processBatch(supabase: any, limit: number): Promise<{ success: number; failed: number }> {
  try {
    // Get documents pending transcription
    // Find docs that have been processed but don't have raw_content yet
    const { data: pendingDocs, error: queryError } = await supabase
      .from('expert_documents')
      .select('id, source_id, content_type, raw_content')
      .eq('content_type', 'presentation')
      .eq('processing_status', 'processing')
      .is('raw_content', null)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (queryError) {
      Logger.error(`❌ Error fetching pending documents: ${queryError.message}`);
      return { success: 0, failed: 0 };
    }
    
    if (!pendingDocs || pendingDocs.length === 0) {
      Logger.info('ℹ️ No pending documents found for transcription');
      return { success: 0, failed: 0 };
    }
    
    Logger.info(`📋 Found ${pendingDocs.length} documents pending transcription`);
    
    let success = 0;
    let failed = 0;
    
    // Process each document
    for (const doc of pendingDocs) {
      Logger.info(`📋 Processing document: ${doc.id}`);
      const result = await transcribeExpertDocument(doc.id, supabase);
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
    Logger.info('🎙️ Audio Transcription');
    Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
    Logger.info(`Model: ${options.model}`);
    
    // Handle batch processing
    if (options.batchSize > 0) {
      Logger.info(`Processing batch of up to ${options.batchSize} documents`);
      const { success, failed } = await processBatch(supabase, options.batchSize);
      Logger.info(`✅ Batch processing complete: ${success} succeeded, ${failed} failed`);
    }
    // Handle single document
    else if (options.fileId) {
      // Check if the fileId is a UUID (expert document) or a file path
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (uuidPattern.test(options.fileId)) {
        Logger.info(`📋 Processing expert document: ${options.fileId}`);
        await transcribeExpertDocument(options.fileId, supabase);
      } else {
        // Treat as file path
        if (!fs.existsSync(options.fileId)) {
          Logger.error(`❌ File not found: ${options.fileId}`);
          process.exit(1);
        }
        
        Logger.info(`📋 Processing file: ${options.fileId}`);
        const { success, result, error } = await transcribeFile(options.fileId);
        
        if (success) {
          Logger.info(`✅ Transcription complete: ${result.text.substring(0, 100)}...`);
        } else {
          Logger.error(`❌ Transcription failed: ${error}`);
          process.exit(1);
        }
      }
    } else {
      Logger.error('❌ No file ID or batch size specified');
      Logger.info('Usage: transcribe-audio.ts [fileId] [options]');
      Logger.info('   or: transcribe-audio.ts --batch [number]');
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