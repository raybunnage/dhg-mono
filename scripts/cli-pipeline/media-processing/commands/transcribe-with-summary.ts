#!/usr/bin/env ts-node
/**
 * Transcribe Audio with Summary Command
 * 
 * This command transcribes audio files and generates summaries using the advanced
 * transcription script with both Whisper and a summarization model.
 * 
 * Usage:
 *   transcribe-with-summary.ts [fileId] [options]
 * 
 * Options:
 *   --model [tiny|base|small]  Specify Whisper model (default: base)
 *   --dry-run                  Show what would be transcribed without actual processing
 *   --output [path]            Specify output directory
 *   --batch [number]           Process a batch of pending transcriptions
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
  model: 'base' as 'tiny' | 'base' | 'small' | 'medium' | 'large',
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
    options.model = modelArg as 'tiny' | 'base' | 'small' | 'medium' | 'large';
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
 * Transcribe and summarize an expert document from the database
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
    
    // Check if the document is already transcribed and summarized
    if (document.raw_content && document.processed_content?.summary?.text) {
      Logger.warn(`⚠️ Document ${documentId} already has transcription and summary content`);
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
    
    // Get the source file information
    const { data: sourceFile, error: sourceError } = await supabase
      .from('google_sources')
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
      Logger.info(`🔄 Would transcribe and summarize ${audioPath} using ${options.model} model`);
      return true;
    }
    
    // Create output directory for transcripts and summaries
    const transcriptDir = path.join(options.outputDir);
    if (!fs.existsSync(transcriptDir)) {
      fs.mkdirSync(transcriptDir, { recursive: true });
    }
    
    // Get transcription service
    const transcriptionService = AudioTranscriptionService.getInstance();
    
    // Transcribe and summarize the file
    const result = await transcriptionService.transcribeAndSummarize(audioPath, {
      model: options.model,
      outputDir: transcriptDir,
      dryRun: options.dryRun
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
    const wordCount = result.processingMetadata?.wordCount || result.text.split(/\s+/).length;
    
    // Generate processing stats
    const processingStats = {
      transcription_time_seconds: result.processingMetadata?.processingTime || 0,
      summary_time_seconds: result.processingMetadata?.summaryTime || 0,
      audio_duration_seconds: 0, // Would need ffprobe to get this accurately
      words_per_minute: 0,
      model_type: options.model,
      processing_date: new Date().toISOString()
    };
    
    // Calculate words per minute if we have a processing time
    if (processingStats.transcription_time_seconds > 0) {
      processingStats.words_per_minute = Math.round((wordCount / processingStats.transcription_time_seconds) * 60);
    }
    
    // Update the document with the transcription and summary
    // Store summary in processed_content only since summary column doesn't exist
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
            processing_time_seconds: processingStats.transcription_time_seconds,
            word_count: wordCount
          },
          summary: {
            text: result.summary,
            processing_time_seconds: processingStats.summary_time_seconds,
            timestamp: new Date().toISOString()
          },
          transcription_complete: true,
          summary_complete: true,
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
      Logger.error(`❌ Error saving transcription and summary: ${saveError.message}`);
      return false;
    }
    
    Logger.info(`📊 Transcription stats: ${wordCount} words, ${processingStats.words_per_minute} WPM, ${processingStats.transcription_time_seconds.toFixed(2)}s processing time`);
    if (result.summary) {
      Logger.info(`📝 Generated summary (${result.summary.length} characters) in ${processingStats.summary_time_seconds.toFixed(2)}s`);
    }
    
    Logger.info(`✅ Successfully transcribed and summarized document ${documentId}`);
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
    // Find docs that need transcription and don't have summaries
    const { data: pendingDocs, error: queryError } = await supabase
      .from('expert_documents')
      .select('id, source_id, content_type, raw_content, processed_content, summary_complete')
      .eq('content_type', 'presentation')
      .eq('summary_complete', false)
      .is('summary', null)
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
        .select('id, source_id, content_type, raw_content, processed_content, summary_complete')
        .eq('content_type', 'presentation')
        .eq('processing_status', 'pending')
        .is('summary', null)
        .order('created_at', { ascending: true })
        .limit(limit);
        
      if (queryError2) {
        Logger.error(`❌ Error fetching pending documents: ${queryError2.message}`);
        return { success: 0, failed: 0 };
      }
      
      if (!pendingDocs2 || pendingDocs2.length === 0) {
        Logger.info('ℹ️ No pending documents found for transcription and summarization');
        return { success: 0, failed: 0 };
      }
      
      // Use this set of documents
      Logger.info(`📋 Found ${pendingDocs2.length} documents pending transcription and summarization`);
      
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
    
    Logger.info(`📋 Found ${pendingDocs.length} documents pending transcription and summarization`);
    
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
    Logger.info('🎙️ Audio Transcription with Summary');
    Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
    Logger.info(`Model: ${options.model}`);
    Logger.info(`Output directory: ${options.outputDir}`);
    
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
          Logger.info(`✅ Successfully transcribed and summarized document ${options.fileId}`);
        } else {
          Logger.error(`❌ Failed to transcribe and summarize document ${options.fileId}`);
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
        const result = await transcriptionService.transcribeAndSummarize(options.fileId, {
          model: options.model,
          outputDir: options.outputDir,
          dryRun: options.dryRun
        });
        
        if (result.success) {
          if (result.text) {
            Logger.info(`✅ Transcription complete! First 100 characters: ${result.text.substring(0, 100)}...`);
            if (result.summary) {
              Logger.info(`📝 Summary generated! First 100 characters: ${result.summary.substring(0, 100)}...`);
            }
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
      Logger.info('Usage: transcribe-with-summary.ts [fileId] [options]');
      Logger.info('   or: transcribe-with-summary.ts --batch [number]');
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