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
 *   --limit [number]           Process a batch of pending transcriptions (same as --batch)
 *   --batch [number]           Process a batch of pending transcriptions (deprecated, use --limit)
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../../../packages/shared/utils';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { AudioTranscriptionService } from '../../../../packages/shared/services/audio-transcription/audio-transcription-service';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  model: 'base' as 'tiny' | 'base' | 'small' | 'medium' | 'large',
  outputDir: path.join(process.cwd(), 'file_types', 'transcripts'),
  batchSize: 0,
  fileId: '',
  accelerator: 'T4' as 'T4' | 'A10G' | 'A100' | 'CPU'
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
    options.model = modelArg as 'tiny' | 'base' | 'small' | 'medium' | 'large';
  }
}

// Get output directory if specified
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1 && args[outputIndex + 1]) {
  options.outputDir = args[outputIndex + 1];
}

// Get batch size if specified (from --batch or --limit)
const batchIndex = args.indexOf('--batch');
const limitIndex = args.indexOf('--limit');

if (batchIndex !== -1 && args[batchIndex + 1]) {
  const batchArg = parseInt(args[batchIndex + 1]);
  if (!isNaN(batchArg)) {
    options.batchSize = batchArg;
  }
}

// --limit takes precedence over --batch if both are specified
if (limitIndex !== -1 && args[limitIndex + 1]) {
  const limitArg = parseInt(args[limitIndex + 1]);
  if (!isNaN(limitArg)) {
    options.batchSize = limitArg;
  }
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
 * Transcribe an expert document from the database
 */
async function transcribeExpertDocument(documentId: string, supabase: any): Promise<boolean> {
  try {
    // Get the document from the database
    const { data: document, error: docError } = await supabase
      .from('expert_documents')
      .select('id, source_id, processing_status, raw_content, processed_content')
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
    if (document.raw_content && document.raw_content.length > 0 && !options.force) {
      Logger.warn(`⚠️ Document ${documentId} already has transcription content`);
      Logger.info(`   Use --force to re-transcribe anyway`);
      return true;
    }
    
    if (document.raw_content && document.raw_content.length > 0 && options.force) {
      Logger.warn(`⚠️ Document ${documentId} already has transcription content, but force mode is enabled`);
      Logger.info(`   Re-transcribing...`);
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
    
    // Get the source file information
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
    
    // Check for audio file in the m4a directory
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
    
    // Create output directory for transcripts
    const transcriptDir = path.join(options.outputDir);
    if (!fs.existsSync(transcriptDir)) {
      fs.mkdirSync(transcriptDir, { recursive: true });
    }
    
    // Get transcription service
    const transcriptionService = AudioTranscriptionService.getInstance();
    
    // Transcribe the file
    const result = await transcriptionService.transcribeFile(audioPath, {
      model: options.model,
      outputDir: transcriptDir,
      dryRun: options.dryRun,
      accelerator: options.accelerator
    });
    
    if (!result.success || !result.text) {
      Logger.error(`❌ Transcription failed: ${result.error}`);
      
      // Update status to error
      const { error: updateError } = await supabase
        .from('expert_documents')
        .update({ 
          processing_status: 'error', 
          processing_error: result.error 
        })
        .eq('id', documentId);
      
      if (updateError) {
        Logger.error(`❌ Error updating document status: ${updateError.message}`);
      }
      
      return false;
    }
    
    // Initialize processed_content if it doesn't exist
    const processedContent = document.processed_content || {};

    // Calculate word count
    const wordCount = result.text.split(/\s+/).length;
    
    // Generate processing stats
    const processingStats = {
      transcription_time_seconds: result.processingMetadata?.processingTime || 0,
      audio_duration_seconds: 0, // Would need ffprobe to get this accurately
      words_per_minute: 0,
      model_type: options.model,
      processing_date: new Date().toISOString()
    };
    
    // Calculate words per minute if we have a processing time
    if (processingStats.transcription_time_seconds > 0) {
      processingStats.words_per_minute = Math.round((wordCount / processingStats.transcription_time_seconds) * 60);
    }
    
    // Update the document with the transcription and all required fields
    // Store status fields in processed_content since those columns don't exist in the schema
    const { error: saveError } = await supabase
      .from('expert_documents')
      .update({
        raw_content: result.text,
        processing_status: 'completed',
        word_count: wordCount,
        document_type_id: 'c6c3969b-c5cd-4c9a-a0f8-6e508ab68a4c', // As requested
        content_type: 'presentation',
        whisper_model_used: options.model,
        processed_content: {
          ...processedContent,
          transcription: {
            model: options.model,
            audio_file: audioPath,
            transcription_timestamp: new Date().toISOString(),
            processing_time_seconds: result.processingMetadata?.processingTime || 0,
            word_count: wordCount
          },
          transcription_complete: true,
          summary_complete: false,
          processing_stats: processingStats,
          audio_metadata: {
            source_file: path.basename(audioPath),
            file_path: audioPath,
            file_size_bytes: fs.statSync(audioPath).size
          }
        },
        last_processed_at: new Date().toISOString()
      })
      .eq('id', documentId);
    
    if (saveError) {
      Logger.error(`❌ Error saving transcription: ${saveError.message}`);
      return false;
    }
    
    Logger.info(`📊 Transcription stats: ${wordCount} words, ${processingStats.words_per_minute} WPM, ${processingStats.transcription_time_seconds.toFixed(2)}s processing time`);
    
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
      .select('id, source_id, content_type, raw_content, processing_status')
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
      // Try to find documents with pending status
      const { data: pendingDocs2, error: queryError2 } = await supabase
        .from('expert_documents')
        .select('id, source_id, content_type, raw_content, processing_status')
        .eq('content_type', 'presentation')
        .eq('processing_status', 'pending')
        .is('raw_content', null)
        .order('created_at', { ascending: true })
        .limit(limit);
        
      if (queryError2) {
        Logger.error(`❌ Error fetching pending documents: ${queryError2.message}`);
        return { success: 0, failed: 0 };
      }
      
      if (!pendingDocs2 || pendingDocs2.length === 0) {
        Logger.info('ℹ️ No pending documents found for transcription');
        return { success: 0, failed: 0 };
      }
      
      // Use this set of documents
      Logger.info(`📋 Found ${pendingDocs2.length} documents pending transcription`);
      
      let success = 0;
      let failed = 0;
      
      for (const doc of pendingDocs2) {
        Logger.info(`📋 Processing document: ${doc.id}`);
        const result = await transcribeExpertDocument(doc.id, supabase);
        if (result) {
          success++;
        } else {
          failed++;
        }
      }
      
      return { success, failed };
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
    Logger.info(`Output directory: ${options.outputDir}`);
    if (options.force) {
      Logger.info(`Force mode: ENABLED (will overwrite existing transcriptions)`);
    }
    
    // Ensure output directory exists
    if (!fs.existsSync(options.outputDir)) {
      fs.mkdirSync(options.outputDir, { recursive: true });
      Logger.info(`✅ Created output directory: ${options.outputDir}`);
    }
    
    // Handle batch processing
    if (options.batchSize > 0) {
      Logger.info(`Processing batch of up to ${options.batchSize} documents`);
      const { success, failed } = await processBatch(supabase, options.batchSize);
      Logger.info(`✅ Batch processing complete: ${success} succeeded, ${failed} failed`);
    }
    // Handle single document or file
    else if (options.fileId) {
      // Check if the fileId is a UUID (expert document) or a file path
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (uuidPattern.test(options.fileId)) {
        Logger.info(`📋 Processing expert document: ${options.fileId}`);
        const result = await transcribeExpertDocument(options.fileId, supabase);
        if (result) {
          Logger.info(`✅ Successfully transcribed document ${options.fileId}`);
        } else {
          Logger.error(`❌ Failed to transcribe document ${options.fileId}`);
          process.exit(1);
        }
      } else {
        // Treat as file path
        if (!fs.existsSync(options.fileId)) {
          Logger.error(`❌ File not found: ${options.fileId}`);
          process.exit(1);
        }
        
        Logger.info(`📋 Processing file: ${options.fileId}`);
        
        // Use the transcription service
        const transcriptionService = AudioTranscriptionService.getInstance();
        const result = await transcriptionService.transcribeFile(options.fileId, {
          model: options.model,
          outputDir: options.outputDir,
          dryRun: options.dryRun,
          accelerator: options.accelerator
        });
        
        if (result.success) {
          if (result.text) {
            Logger.info(`✅ Transcription complete! First 100 characters: ${result.text.substring(0, 100)}...`);
          } else {
            Logger.warn(`⚠️ Transcription successful but no text found`);
          }
        } else {
          Logger.error(`❌ Transcription failed: ${result.error}`);
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

/**
 * Default export function for CLI integration
 */
export default async function(cliOptions?: any): Promise<void> {
  // Override default options with CLI options if provided
  if (cliOptions) {
    if (cliOptions.dryRun) options.dryRun = true;
    if (cliOptions.force) options.force = true;
    if (cliOptions.fileId || cliOptions.file) options.fileId = cliOptions.fileId || cliOptions.file;
    if (cliOptions.output) options.outputDir = cliOptions.output;
    if (cliOptions.model) options.model = cliOptions.model;
    if (cliOptions.accelerator) options.accelerator = cliOptions.accelerator as 'T4' | 'A10G' | 'A100' | 'CPU';
    if (cliOptions.batchSize) options.batchSize = parseInt(cliOptions.batchSize);
    if (cliOptions.batch) options.batchSize = parseInt(cliOptions.batch);
    if (cliOptions.limit) options.batchSize = parseInt(cliOptions.limit);
  }
  
  try {
    await main();
  } catch (error: any) {
    Logger.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  }
}

// If running directly (not imported), execute the main function
if (require.main === module) {
  main().catch((error: any) => {
    Logger.error('Unhandled error:', error);
    process.exit(1);
  });
}