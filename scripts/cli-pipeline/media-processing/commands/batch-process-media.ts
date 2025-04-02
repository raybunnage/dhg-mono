#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Logger } from '../../../../packages/shared/utils';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Default options
const options = {
  limit: 10,
  source: '/Users/raybunnage/Library/CloudStorage/GoogleDrive-bunnage.ray@gmail.com/My Drive/200_Research Experts',
  model: 'whisper-large-v3',
  accelerator: 'A10G',
  maxParallel: 2,
  skipCopy: false,
  skipRename: false,
  skipRegister: false,
  skipDiskStatus: false,
  skipExpertDocs: false,
  skipConversion: false,
  skipM4aSync: false,
  skipTranscription: false,
  dryRun: false
};

/**
 * Run the find-missing-media command to generate copy commands
 * only for files that haven't been transcribed yet
 */
async function findAndCopyMedia(): Promise<boolean> {
  try {
    const scriptPath = path.join(process.cwd(), 'copy-files.sh');
    
    // Step 1: Generate copy script using find-missing-media and filter-transcribed
    Logger.info('🔍 Generating copy commands for untranscribed media files...');
    
    const tsNodePath = './node_modules/.bin/ts-node';
    
    // Make sure we pass the actual limit value - for debugging:
    Logger.info(`Using limit: ${options.limit} for find-missing-media command`);
    
    const findCommand = `${tsNodePath} scripts/cli-pipeline/media-processing/index.ts find-missing-media --deep --limit ${options.limit} --source "${options.source}" --format commands | node scripts/cli-pipeline/media-processing/commands/filter-transcribed.js`;
    
    if (options.dryRun) {
      Logger.info(`Would execute: ${findCommand}`);
    } else {
      // Execute the find command and extract only the copy commands between the UNTRANSCRIBED FILES markers
      const findOutput = execSync(findCommand).toString();
      const untranscribedFilesSection = findOutput.split('=== UNTRANSCRIBED FILES ===')[1];
      
      if (!untranscribedFilesSection) {
        Logger.warn('No UNTRANSCRIBED FILES section found in output');
        return false;
      }
      
      // Extract just the copy commands (skip the instructions at the end)
      const copyCommands = untranscribedFilesSection.split('\nCopy and paste these commands')[0].trim();
      
      // Write to the script file
      fs.writeFileSync(scriptPath, '#!/bin/bash\n# Auto-generated copy commands\n\n' + copyCommands);
      
      // Make the script executable
      execSync(`chmod +x ${scriptPath}`);
      
      // Check if the script has copy commands
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      if (!scriptContent.includes('cp "')) {
        Logger.info('ℹ️ No untranscribed files found to copy');
        return false;
      }
      
      // Execute the copy script
      Logger.info('📂 Copying untranscribed MP4 files from Google Drive...');
      execSync(`${scriptPath}`, { stdio: 'inherit' });
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
    
    // Build the command with appropriate parameters
    const scriptPath = path.join(__dirname, '..', 'media-processing-cli.sh');
    let convertCommand = `${scriptPath} convert --limit ${options.limit} --force`;
    
    // Always use parallel processing with the max parallel option
    convertCommand += ' --parallel';
    convertCommand += ` --max-parallel ${options.maxParallel}`;
    
    if (options.dryRun) {
      Logger.info(`Would execute: ${convertCommand}`);
    } else {
      try {
        execSync(convertCommand, { 
          stdio: 'inherit',
          // Set a timeout to prevent hanging indefinitely
          timeout: 30 * 60 * 1000 // 30 minutes
        });
      } catch (execError: any) {
        // If the conversion failed but we want to continue with the pipeline
        if (execError.status !== 0) {
          Logger.error(`⚠️ Conversion process exited with code ${execError.status}`);
          Logger.error(`⚠️ Some files may have failed to convert but we will continue with the pipeline.`);
          // We return true to continue with the next steps, as some files may have converted successfully
          return true;
        }
        throw execError;
      }
    }
    
    return true;
  } catch (error: any) {
    Logger.error(`❌ Error in conversion step: ${error.message}`);
    if (error.message.includes('timeout')) {
      Logger.error('⚠️ The conversion process timed out after 30 minutes.');
    }
    
    // Ask the user if they want to continue despite the error
    Logger.warn('⚠️ The MP4 to M4A conversion step had errors.');
    Logger.warn('⚠️ You may want to skip the conversion step next time with --skip-conversion');
    Logger.warn('⚠️ To mark specific files to skip, use: mark-skip-processing "filename.mp4"');
    
    return false;
  }
}

/**
 * Run the transcribe-audio command to transcribe audio files
 */
async function transcribeAudio(): Promise<boolean> {
  try {
    Logger.info('🎙️ Transcribing audio files...');
    
    const scriptPath = path.join(__dirname, '..', 'media-processing-cli.sh');
    const transcribeCommand = `${scriptPath} transcribe --limit ${options.limit} --model ${options.model} --accelerator ${options.accelerator} --force`;
    
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
 * Rename MP4 files to match database conventions
 */
async function renameMP4Files(): Promise<boolean> {
  try {
    Logger.info('🏷️ Renaming MP4 files to match database conventions...');
    
    const tsNodePath = './node_modules/.bin/ts-node';
    const renameCommand = `${tsNodePath} scripts/cli-pipeline/media-processing/index.ts rename-mp4-files ${options.dryRun ? '--dry-run' : ''}`;
    
    if (options.dryRun) {
      Logger.info(`Would execute: ${renameCommand}`);
    } else {
      execSync(renameCommand, { stdio: 'inherit' });
    }
    
    return true;
  } catch (error: any) {
    Logger.error(`❌ Error in rename step: ${error.message}`);
    return false;
  }
}

/**
 * Register local MP4 files in the database
 */
async function registerLocalMP4Files(): Promise<boolean> {
  try {
    Logger.info('📋 Registering MP4 files in the database...');
    
    const tsNodePath = './node_modules/.bin/ts-node';
    const registerCommand = `${tsNodePath} scripts/cli-pipeline/media-processing/index.ts register-local-mp4-files ${options.dryRun ? '--dry-run' : ''}`;
    
    if (options.dryRun) {
      Logger.info(`Would execute: ${registerCommand}`);
    } else {
      execSync(registerCommand, { stdio: 'inherit' });
    }
    
    return true;
  } catch (error: any) {
    Logger.error(`❌ Error in register files step: ${error.message}`);
    return false;
  }
}

/**
 * Update disk status in the database
 */
async function updateDiskStatus(): Promise<boolean> {
  try {
    Logger.info('💾 Updating disk status in the database...');
    
    const tsNodePath = './node_modules/.bin/ts-node';
    const updateCommand = `${tsNodePath} scripts/cli-pipeline/media-processing/index.ts update-disk-status ${options.dryRun ? '--dry-run' : ''}`;
    
    if (options.dryRun) {
      Logger.info(`Would execute: ${updateCommand}`);
    } else {
      execSync(updateCommand, { stdio: 'inherit' });
    }
    
    return true;
  } catch (error: any) {
    Logger.error(`❌ Error in update disk status step: ${error.message}`);
    return false;
  }
}

/**
 * Register expert documents in the database
 */
async function registerExpertDocs(): Promise<boolean> {
  try {
    Logger.info('📝 Registering expert documents in the database...');
    
    const tsNodePath = './node_modules/.bin/ts-node';
    const registerDocsCommand = `${tsNodePath} scripts/cli-pipeline/media-processing/index.ts register-expert-docs ${options.dryRun ? '--dry-run' : ''} --limit ${options.limit}`;
    
    if (options.dryRun) {
      Logger.info(`Would execute: ${registerDocsCommand}`);
    } else {
      execSync(registerDocsCommand, { stdio: 'inherit' });
    }
    
    return true;
  } catch (error: any) {
    Logger.error(`❌ Error in register expert docs step: ${error.message}`);
    return false;
  }
}

/**
 * Synchronize M4A filenames with MP4 files
 */
async function syncM4aNames(): Promise<boolean> {
  try {
    Logger.info('🔄 Synchronizing M4A filenames with MP4 files...');
    
    const tsNodePath = './node_modules/.bin/ts-node';
    const syncCommand = `${tsNodePath} scripts/cli-pipeline/media-processing/index.ts sync-m4a-names --after-rename ${options.dryRun ? '--dry-run' : ''}`;
    
    if (options.dryRun) {
      Logger.info(`Would execute: ${syncCommand}`);
    } else {
      execSync(syncCommand, { stdio: 'inherit' });
    }
    
    return true;
  } catch (error: any) {
    Logger.error(`❌ Error in sync M4A names step: ${error.message}`);
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
  Logger.info(`Max parallel processes: ${options.maxParallel}`);
  
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
  
  // Step 2: Rename MP4 files
  if (options.skipRename) {
    Logger.info('⏩ Skipping rename step as requested');
    skippedSteps++;
  } else {
    const renameSuccess = await renameMP4Files();
    if (renameSuccess) {
      completedSteps++;
    }
  }
  
  // Step 3: Register local MP4 files
  if (options.skipRegister) {
    Logger.info('⏩ Skipping register files step as requested');
    skippedSteps++;
  } else {
    const registerSuccess = await registerLocalMP4Files();
    if (registerSuccess) {
      completedSteps++;
    }
  }
  
  // Step 4: Update disk status
  if (options.skipDiskStatus) {
    Logger.info('⏩ Skipping update disk status step as requested');
    skippedSteps++;
  } else {
    const updateDiskStatusSuccess = await updateDiskStatus();
    if (updateDiskStatusSuccess) {
      completedSteps++;
    }
  }
  
  // Step 5: Register expert documents
  if (options.skipExpertDocs) {
    Logger.info('⏩ Skipping register expert docs step as requested');
    skippedSteps++;
  } else {
    const registerExpertDocsSuccess = await registerExpertDocs();
    if (registerExpertDocsSuccess) {
      completedSteps++;
    }
  }
  
  // Step 6: Convert MP4 to M4A
  if (options.skipConversion) {
    Logger.info('⏩ Skipping conversion step as requested');
    skippedSteps++;
  } else {
    const conversionSuccess = await convertMp4ToM4a();
    if (conversionSuccess) {
      completedSteps++;
    }
  }
  
  // Step 7: Sync M4A Names
  if (options.skipM4aSync) {
    Logger.info('⏩ Skipping M4A sync step as requested');
    skippedSteps++;
  } else {
    const syncM4aSuccess = await syncM4aNames();
    if (syncM4aSuccess) {
      completedSteps++;
    }
  }
  
  // Step 8: Transcribe audio
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
    // Properly parse the limit as an integer
    if (cliOptions.limit) {
      options.limit = parseInt(cliOptions.limit);
      console.log(`Setting limit to ${options.limit} from CLI option ${cliOptions.limit}`);
    }
    
    if (cliOptions.source) options.source = cliOptions.source;
    if (cliOptions.model) options.model = cliOptions.model;
    if (cliOptions.accelerator) options.accelerator = cliOptions.accelerator;
    if (cliOptions.maxParallel) options.maxParallel = parseInt(cliOptions.maxParallel);
    if (cliOptions.skipCopy) options.skipCopy = true;
    if (cliOptions.skipRename) options.skipRename = true;
    if (cliOptions.skipRegister) options.skipRegister = true;
    if (cliOptions.skipDiskStatus) options.skipDiskStatus = true;
    if (cliOptions.skipExpertDocs) options.skipExpertDocs = true;
    if (cliOptions.skipConversion) options.skipConversion = true;
    if (cliOptions.skipM4aSync) options.skipM4aSync = true;
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