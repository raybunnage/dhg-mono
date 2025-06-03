#!/usr/bin/env ts-node
/**
 * Unified Transcribe Command
 * 
 * Transcribes audio files using Modal and Whisper.
 * Replaces: transcribe-audio, transcribe-with-summary, batch-transcribe
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils';
import { LogLevel } from '../../../../packages/shared/utils/logger';
import * as yaml from 'js-yaml';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

interface TranscribeOptions {
  input: string;
  model?: string;
  accelerator?: string;
  withSummary: boolean;
  force: boolean;
  dryRun: boolean;
  batch?: boolean;
  limit?: number;
}

interface ProcessingConfig {
  processing: {
    default_model: string;
    default_accelerator: string;
  };
}

async function transcribeMedia(options: TranscribeOptions): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Load config for defaults
  const config = loadConfig();
  const model = options.model || config.processing.default_model;
  const accelerator = options.accelerator || config.processing.default_accelerator;

  try {
    if (options.batch) {
      await batchTranscribe(supabase, options, model, accelerator);
    } else {
      await singleTranscribe(supabase, options, model, accelerator);
    }
  } catch (error: any) {
    Logger.error(`Transcription failed: ${error.message}`);
    process.exit(1);
  }
}

async function singleTranscribe(
  supabase: any, 
  options: TranscribeOptions, 
  model: string, 
  accelerator: string
): Promise<void> {
  let documentId: string;
  let m4aPath: string;

  // Check if input is a document ID or file path
  if (fs.existsSync(options.input) && options.input.endsWith('.m4a')) {
    // Direct M4A file path
    m4aPath = options.input;
    Logger.info(`Transcribing local file: ${m4aPath}`);
    documentId = 'local-file';
  } else {
    // Assume it's a document ID
    documentId = options.input;
    
    // Fetch document info
    const { data, error } = await supabase
      .from('google_expert_documents')
      .select(`
        id,
        processing_status,
        raw_content,
        google_sources!inner(
          name,
          drive_id
        )
      `)
      .eq('id', documentId)
      .single();

    if (error || !data) {
      Logger.error(`Document not found: ${documentId}`);
      process.exit(1);
    }

    // Check if already transcribed
    if (data.raw_content && !options.force) {
      Logger.info(`Document already transcribed: ${data.google_sources.name}`);
      Logger.info('Use --force to re-transcribe');
      return;
    }

    // Find M4A file
    const baseName = data.google_sources.name.replace(/\.mp4$/i, '');
    m4aPath = path.join('./file_types/m4a', `${baseName}.m4a`);
    
    if (!fs.existsSync(m4aPath)) {
      Logger.error(`M4A file not found: ${m4aPath}`);
      Logger.info('Please convert the MP4 file first');
      process.exit(1);
    }
  }

  if (options.dryRun) {
    Logger.info(`Would transcribe: ${m4aPath}`);
    Logger.info(`Model: ${model}, Accelerator: ${accelerator}`);
    return;
  }

  // Run transcription
  Logger.info(`🎤 Transcribing: ${path.basename(m4aPath)}`);
  Logger.info(`Model: ${model}, Accelerator: ${accelerator}`);

  const scriptPath = path.join(process.cwd(), 'scripts/python/modal_process.py');
  const cmd = `python "${scriptPath}" "${m4aPath}" --model ${model} --accelerator ${accelerator}`;

  try {
    const output = execSync(cmd, { 
      stdio: 'pipe',
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    }).toString();

    Logger.info('✅ Transcription completed successfully');

    // Parse the output to get transcript
    const transcriptMatch = output.match(/Transcript saved to: (.+)/);
    if (transcriptMatch) {
      const transcriptPath = transcriptMatch[1].trim();
      
      // Read transcript
      const transcript = fs.readFileSync(transcriptPath, 'utf8');
      
      // Update database if not a local file
      if (documentId !== 'local-file') {
        await updateTranscript(supabase, documentId, transcript);
      }

      // Generate summary if requested
      if (options.withSummary) {
        Logger.info('📝 Generating AI summary...');
        await generateSummary(supabase, documentId, transcript);
      }
    }

  } catch (error: any) {
    Logger.error(`Transcription failed: ${error.message}`);
    
    if (documentId !== 'local-file') {
      await updateStatus(supabase, documentId, 'failed', error.message);
    }
    
    process.exit(1);
  }
}

async function batchTranscribe(
  supabase: any,
  options: TranscribeOptions,
  model: string,
  accelerator: string
): Promise<void> {
  Logger.info('🔄 Starting batch transcription...');

  // Find files needing transcription
  const { data, error } = await supabase
    .from('google_expert_documents')
    .select(`
      id,
      processing_status,
      google_sources!inner(
        name,
        drive_id
      )
    `)
    .eq('content_type', 'presentation')
    .is('raw_content', null)
    .limit(options.limit || 10);

  if (error || !data || data.length === 0) {
    Logger.info('No files need transcription');
    return;
  }

  Logger.info(`Found ${data.length} files to transcribe`);

  let successCount = 0;
  let failCount = 0;

  for (const doc of data) {
    try {
      await singleTranscribe(supabase, {
        ...options,
        input: doc.id,
        batch: false
      }, model, accelerator);
      
      successCount++;
    } catch (error: any) {
      Logger.error(`Failed to transcribe ${doc.google_sources.name}: ${error.message}`);
      failCount++;
    }
  }

  Logger.info(`\n✅ Batch transcription complete:`);
  Logger.info(`  Success: ${successCount}`);
  Logger.info(`  Failed: ${failCount}`);
}

async function updateTranscript(supabase: any, documentId: string, transcript: string): Promise<void> {
  const { error } = await supabase
    .from('google_expert_documents')
    .update({
      raw_content: transcript,
      processing_status: 'transcribed',
      updated_at: new Date().toISOString()
    })
    .eq('id', documentId);

  if (error) {
    Logger.error(`Failed to update transcript: ${error.message}`);
  }
}

async function updateStatus(
  supabase: any, 
  documentId: string, 
  status: string, 
  errorMessage?: string
): Promise<void> {
  const update: any = {
    processing_status: status,
    updated_at: new Date().toISOString()
  };

  if (errorMessage) {
    update.error_message = errorMessage;
  }

  const { error } = await supabase
    .from('google_expert_documents')
    .update(update)
    .eq('id', documentId);

  if (error) {
    Logger.error(`Failed to update status: ${error.message}`);
  }
}

async function generateSummary(supabase: any, documentId: string, transcript: string): Promise<void> {
  // This would integrate with the Claude service for summary generation
  Logger.info('Summary generation would happen here');
  // Implementation will use the existing summarization logic
}

function loadConfig(): ProcessingConfig {
  const configPath = path.join(process.cwd(), 'config', 'media-processing.yaml');
  
  const defaultConfig: ProcessingConfig = {
    processing: {
      default_model: 'whisper-large-v3',
      default_accelerator: 'A10G'
    }
  };

  if (fs.existsSync(configPath)) {
    try {
      const customConfig = yaml.load(fs.readFileSync(configPath, 'utf8')) as ProcessingConfig;
      return { ...defaultConfig, ...customConfig };
    } catch (error) {
      Logger.warn('Failed to load config, using defaults');
    }
  }

  return defaultConfig;
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
Transcribe Command - Transcribe audio files using Whisper

Usage:
  transcribe.ts <input> [options]

Arguments:
  <input>              Document ID or M4A file path

Options:
  --model [model]      Whisper model to use (default: from config)
  --accelerator [gpu]  GPU to use: T4|A10G|A100 (default: from config)
  --with-summary       Also generate AI summary
  --force              Re-transcribe even if already done
  --dry-run            Show what would happen
  --batch              Batch transcribe multiple files
  --limit [n]          Max files for batch mode (default: 10)

Examples:
  # Transcribe by document ID
  transcribe.ts 123e4567-e89b-12d3-a456-426614174000
  
  # Transcribe with summary
  transcribe.ts doc-id --with-summary
  
  # Batch transcribe
  transcribe.ts --batch --limit 5
  
  # Use specific model
  transcribe.ts doc-id --model whisper-large-v3 --accelerator A100
  `);
  process.exit(0);
}

const options: TranscribeOptions = {
  input: args[0] || '',
  withSummary: false,
  force: false,
  dryRun: false
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--model':
      options.model = args[++i];
      break;
    case '--accelerator':
      options.accelerator = args[++i];
      break;
    case '--with-summary':
      options.withSummary = true;
      break;
    case '--force':
      options.force = true;
      break;
    case '--dry-run':
      options.dryRun = true;
      break;
    case '--batch':
      options.batch = true;
      break;
    case '--limit':
      options.limit = parseInt(args[++i], 10);
      break;
  }
}

// If batch mode, we don't need an input argument
if (options.batch) {
  options.input = 'batch';
} else if (!options.input) {
  console.error('Error: Input file or document ID required');
  process.exit(1);
}

// Run transcription
transcribeMedia(options).catch(error => {
  Logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});