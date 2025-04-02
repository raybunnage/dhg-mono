#!/usr/bin/env ts-node
/**
 * Batch Process Media Command
 * 
 * This command runs a complete media processing workflow:
 * 1. Finds missing MP4 files in Google Drive
 * 2. Copies them to the local file_types/mp4 directory
 * 3. Converts MP4 files to M4A for audio extraction
 * 4. Transcribes the audio files using Whisper
 * 
 * Usage:
 *   batch-process-media.ts [options]
 * 
 * Options:
 *   --limit [number]          Limit the number of files to process (default: 25)
 *   --source [path]           Source directory to look for files (default: ~/Google Drive)
 *   --model [model]           Whisper model to use (default: base)
 *   --accelerator [type]      Hardware accelerator to use (default: T4)
 *   --skip-copy               Skip the copy step (use if files are already copied)
 *   --skip-conversion         Skip the MP4 to M4A conversion step
 *   --skip-transcription      Skip the transcription step
 *   --dry-run                 Show what would be done without actually doing it
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

// Import using require to avoid TypeScript issues with winston
const { Logger } = require('../../../../packages/shared/utils');
const { LogLevel } = require('../../../../packages/shared/utils/logger');

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  limit: 25,
  source: path.join(os.homedir(), 'Google Drive'),
  model: 'base',
  accelerator: 'T4',
  skipCopy: args.includes('--skip-copy'),
  skipConversion: args.includes('--skip-conversion'),
  skipTranscription: args.includes('--skip-transcription'),
  dryRun: args.includes('--dry-run')
};

// Get limit if specified
const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1 && args[limitIndex + 1]) {
  const limitArg = parseInt(args[limitIndex + 1]);
  if (!isNaN(limitArg)) {
    options.limit = limitArg;
  }
}

// Get source directory if specified
const sourceIndex = args.indexOf('--source');
if (sourceIndex !== -1 && args[sourceIndex + 1]) {
  options.source = args[sourceIndex + 1];
}

// Get model if specified
const modelIndex = args.indexOf('--model');
if (modelIndex !== -1 && args[modelIndex + 1]) {
  const modelArg = args[modelIndex + 1];
  if (['tiny', 'base', 'small', 'medium', 'large'].includes(modelArg)) {
    options.model = modelArg;
  }
}

// Get accelerator if specified
const acceleratorIndex = args.indexOf('--accelerator');
if (acceleratorIndex !== -1 && args[acceleratorIndex + 1]) {
  const acceleratorArg = args[acceleratorIndex + 1];
  if (['T4', 'A10G', 'A100', 'CPU'].includes(acceleratorArg)) {
    options.accelerator = acceleratorArg;
  }
}

/**
 * Run the find-missing-media command to generate copy commands
 */
async function findAndCopyMedia(): Promise<boolean> {
  try {
    const scriptPath = path.join(process.cwd(), 'copy-files.sh');
    
    // Step 1: Generate copy script using find-missing-media
    Logger.info('🔍 Generating copy commands for missing media files...');
    
    const tsNodePath = './node_modules/.bin/ts-node';
    const findCommand = `${tsNodePath} scripts/cli-pipeline/media-processing/index.ts find-missing-media --deep --limit ${options.limit} --source "${options.source}" > ${scriptPath}`;
    
    if (options.dryRun) {
      Logger.info(`Would execute: ${findCommand}`);
    } else {
      execSync(findCommand, { stdio: 'inherit' });
      
      // Make the script executable
      execSync(`chmod +x ${scriptPath}`);
      
      // Check if the script has copy commands
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      if (!scriptContent.includes('cp "')) {
        Logger.info('ℹ️ No files found to copy');
        return false;
      }
      
      // Execute the copy script
      Logger.info('📂 Copying MP4 files from Google Drive...');
      execSync(`./${scriptPath}`, { stdio: 'inherit' });
    }
    
    return true;
  } catch (error: any) {
    Logger.error(`❌ Error in find and copy step: ${error.message}`);
    return false;
  }
}

/**
 * Run the convert-mp4 command to extract audio
 */
async function convertMp4ToM4a(): Promise<boolean> {
  try {
    Logger.info('🔄 Converting MP4 files to M4A...');
    
    const tsNodePath = './node_modules/.bin/ts-node';
    const convertCommand = `${tsNodePath} scripts/cli-pipeline/media-processing/index.ts convert-mp4 --batch ${options.limit}`;
    
    if (options.dryRun) {
      Logger.info(`Would execute: ${convertCommand}`);
    } else {
      execSync(convertCommand, { stdio: 'inherit' });
    }
    
    return true;
  } catch (error: any) {
    Logger.error(`❌ Error in conversion step: ${error.message}`);
    return false;
  }
}

/**
 * Run the transcribe-audio command to transcribe audio files
 */
async function transcribeAudio(): Promise<boolean> {
  try {
    Logger.info('🎙️ Transcribing audio files...');
    
    const tsNodePath = './node_modules/.bin/ts-node';
    const transcribeCommand = `${tsNodePath} scripts/cli-pipeline/media-processing/index.ts transcribe-audio --batch ${options.limit} --model ${options.model} --accelerator ${options.accelerator}`;
    
    if (options.dryRun) {
      Logger.info(`Would execute: ${transcribeCommand}`);
    } else {
      execSync(transcribeCommand, { stdio: 'inherit' });
    }
    
    return true;
  } catch (error: any) {
    Logger.error(`❌ Error in transcription step: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  Logger.info('🚀 Starting Batch Media Processing Workflow');
  Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
  Logger.info(`Limit: ${options.limit} files`);
  Logger.info(`Source directory: ${options.source}`);
  Logger.info(`Transcription model: ${options.model}`);
  Logger.info(`Hardware accelerator: ${options.accelerator}`);
  
  let completedSteps = 0;
  let skippedSteps = 0;
  
  // Step 1: Find and copy MP4 files
  if (options.skipCopy) {
    Logger.info('⏩ Skipping copy step as requested');
    skippedSteps++;
  } else {
    const copySuccess = await findAndCopyMedia();
    if (copySuccess) {
      completedSteps++;
    }
  }
  
  // Step 2: Convert MP4 to M4A
  if (options.skipConversion) {
    Logger.info('⏩ Skipping conversion step as requested');
    skippedSteps++;
  } else {
    const conversionSuccess = await convertMp4ToM4a();
    if (conversionSuccess) {
      completedSteps++;
    }
  }
  
  // Step 3: Transcribe audio
  if (options.skipTranscription) {
    Logger.info('⏩ Skipping transcription step as requested');
    skippedSteps++;
  } else {
    const transcriptionSuccess = await transcribeAudio();
    if (transcriptionSuccess) {
      completedSteps++;
    }
  }
  
  // Summary
  Logger.info(`✅ Batch processing complete: ${completedSteps} steps completed, ${skippedSteps} steps skipped`);
}

/**
 * Default export function for CLI integration
 */
export default async function(cliOptions?: any): Promise<void> {
  // Override default options with CLI options if provided
  if (cliOptions) {
    if (cliOptions.limit) options.limit = parseInt(cliOptions.limit);
    if (cliOptions.source) options.source = cliOptions.source;
    if (cliOptions.model) options.model = cliOptions.model;
    if (cliOptions.accelerator) options.accelerator = cliOptions.accelerator;
    if (cliOptions.skipCopy) options.skipCopy = true;
    if (cliOptions.skipConversion) options.skipConversion = true;
    if (cliOptions.skipTranscription) options.skipTranscription = true;
    if (cliOptions.dryRun) options.dryRun = true;
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
  main().catch(error => {
    Logger.error(`Unhandled error: ${error}`);
    process.exit(1);
  });
}