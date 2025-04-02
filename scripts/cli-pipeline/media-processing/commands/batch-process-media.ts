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
  dryRun: false,
  forceDirectCopy: false // New option for emergency direct copy
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
    
    const tsNodePath = 'ts-node';
    
    // Make sure we pass the actual limit value - for debugging:
    Logger.info(`Using limit: ${options.limit} for find-missing-media command`);
    
    // Make sure to include the --deep flag to search recursively in subfolders
    const findCommand = `cd /Users/raybunnage/Documents/github/dhg-mono && ${tsNodePath} scripts/cli-pipeline/media-processing/index.ts find-missing-media --deep --limit ${options.limit} --source "${options.source}" --format commands | node scripts/cli-pipeline/media-processing/commands/filter-transcribed.js`;
    
    if (options.dryRun) {
      Logger.info(`Would execute: ${findCommand}`);
    } else {
      // Execute the find command and extract only the copy commands between the markers
      const findOutput = execSync(findCommand).toString();
      
      // First try to extract from the UNTRANSCRIBED FILES section if it exists
      let copyCommandsSection = findOutput.split('=== UNTRANSCRIBED FILES ===')[1];
      
      // Otherwise, use the MISSING FILES section
      if (!copyCommandsSection) {
        Logger.info('No UNTRANSCRIBED FILES section found in output, using MISSING FILES section instead');
        copyCommandsSection = findOutput.split('=== MISSING FILES ===')[1];
        
        if (!copyCommandsSection) {
          Logger.warn('No MISSING FILES section found in output');
          
          // Fallback for emergency cases: Directly search for specific files in the "Dynamic Healing Discussion Group" directory
          Logger.info('🔍 Attempting fallback direct file search in Dynamic Healing Discussion Group directory...');
          
          // Create base script with directory creation
          let fallbackScript = '#!/bin/bash\n# Auto-generated copy commands with fallback\n\n';
          fallbackScript += '# Create target directory if it doesn\'t exist\n';
          fallbackScript += 'mkdir -p /Users/raybunnage/Documents/github/dhg-mono/file_types/mp4\n\n';
          
          // Try to find specific files we commonly need
          const dhgDir = '/Users/raybunnage/Library/CloudStorage/GoogleDrive-bunnage.ray@gmail.com/My Drive/Dynamic Healing Discussion Group';
          
          if (fs.existsSync(dhgDir)) {
            Logger.info(`Found alternate source directory: ${dhgDir}`);
            
            // Search for any MP4 files up to our limit, recursive search
            try {
              const findResult = execSync(`find "${dhgDir}" -name "*.mp4" | head -n ${options.limit}`).toString().trim();
              
              if (findResult) {
                const mp4Files = findResult.split('\n');
                Logger.info(`Found ${mp4Files.length} files in fallback directory`);
                
                // Add copy commands for each found file
                mp4Files.forEach(sourcePath => {
                  if (sourcePath.trim()) {
                    const fileName = path.basename(sourcePath);
                    const targetPath = path.join(process.cwd(), 'file_types', 'mp4', fileName);
                    fallbackScript += `cp "${sourcePath}" "${targetPath}"\n`;
                  }
                });
                
                // Write and execute the fallback script
                fs.writeFileSync(scriptPath, fallbackScript);
                execSync(`chmod +x ${scriptPath}`);
                Logger.info('📂 Copying MP4 files from fallback directory...');
                execSync(`${scriptPath}`, { stdio: 'inherit' });
                return true;
              }
            } catch (err) {
              Logger.error(`Error in fallback file search: ${err}`);
            }
          }
          
          return false;
        }
      }
      
      // Extract just the copy commands (skip the instructions at the end)
      let copyCommands = copyCommandsSection.split('\nCopy and paste these commands')[0].trim();
      
      // Check if we have actual copy commands or just "File not found" messages
      if (!copyCommands.includes('cp "')) {
        // Extract filenames from "File not found" lines
        const missingFileMatches = copyCommands.match(/# File not found: (.+?)\.mp4/g);
        if (missingFileMatches && missingFileMatches.length > 0) {
          Logger.info(`Found ${missingFileMatches.length} missing files that need to be searched in alternate locations`);
          
          // Create a script with directory creation
          let alternateScript = '#!/bin/bash\n# Auto-generated copy commands with alternate locations\n\n';
          alternateScript += '# Create target directory if it doesn\'t exist\n';
          alternateScript += 'mkdir -p /Users/raybunnage/Documents/github/dhg-mono/file_types/mp4\n\n';
          
          // Try to find each missing file in the Dynamic Healing Discussion Group directory
          const dhgDir = '/Users/raybunnage/Library/CloudStorage/GoogleDrive-bunnage.ray@gmail.com/My Drive/Dynamic Healing Discussion Group';
          let foundFiles = 0;
          
          if (fs.existsSync(dhgDir)) {
            Logger.info(`Searching alternate directory: ${dhgDir}`);
            
            for (const missingFileMatch of missingFileMatches) {
              const filenameMatch = missingFileMatch.match(/# File not found: (.+?)\.mp4/);
              if (filenameMatch && filenameMatch[1]) {
                const filename = filenameMatch[1] + '.mp4';
                
                try {
                  // Use find command for a thorough search
                  const findResult = execSync(`find "${dhgDir}" -name "${filename}" | head -n 1`).toString().trim();
                  
                  if (findResult) {
                    Logger.info(`Found ${filename} at ${findResult}`);
                    alternateScript += `cp "${findResult}" "/Users/raybunnage/Documents/github/dhg-mono/file_types/mp4/${filename}"\n`;
                    foundFiles++;
                  } else {
                    // Try case-insensitive search as fallback
                    const findCaseInsensitive = execSync(`find "${dhgDir}" -iname "${filename}" | head -n 1`).toString().trim();
                    if (findCaseInsensitive) {
                      Logger.info(`Found ${filename} at ${findCaseInsensitive} (case-insensitive match)`);
                      alternateScript += `cp "${findCaseInsensitive}" "/Users/raybunnage/Documents/github/dhg-mono/file_types/mp4/${filename}"\n`;
                      foundFiles++;
                    }
                  }
                } catch (err) {
                  // Ignore find errors
                }
              }
            }
          }
          
          if (foundFiles > 0) {
            // Write and execute the alternate script
            fs.writeFileSync(scriptPath, alternateScript);
            execSync(`chmod +x ${scriptPath}`);
            Logger.info(`📂 Copying ${foundFiles} MP4 files from alternate location...`);
            execSync(`${scriptPath}`, { stdio: 'inherit' });
            return true;
          } else {
            Logger.warn('No files found in alternate locations either');
            return false;
          }
        }
        
        Logger.info('ℹ️ No untranscribed files found to copy');
        return false;
      }
      
      // Add directory creation to ensure the mp4 directory exists
      copyCommands = '# Create target directory if it doesn\'t exist\nmkdir -p /Users/raybunnage/Documents/github/dhg-mono/file_types/mp4\n\n' + copyCommands;
      
      // Write to the script file
      fs.writeFileSync(scriptPath, '#!/bin/bash\n# Auto-generated copy commands\n\n' + copyCommands);
      
      // Make the script executable
      execSync(`chmod +x ${scriptPath}`);
      
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
    
    // Ensure the M4A output directory exists
    const m4aDir = path.join(process.cwd(), 'file_types', 'm4a');
    if (!fs.existsSync(m4aDir)) {
      fs.mkdirSync(m4aDir, { recursive: true });
      Logger.info(`Created M4A output directory: ${m4aDir}`);
    }
    
    // First, get a list of all MP4 files to convert
    const mp4Dir = path.join(process.cwd(), 'file_types', 'mp4');
    let mp4Files: string[] = [];
    
    if (fs.existsSync(mp4Dir)) {
      try {
        mp4Files = fs.readdirSync(mp4Dir)
          .filter(file => file.toLowerCase().endsWith('.mp4'))
          .map(file => path.join(mp4Dir, file));
          
        Logger.info(`Found ${mp4Files.length} MP4 files in local directory`);
      } catch (err: any) {
        Logger.warn(`Error reading MP4 directory: ${err.message}`);
      }
    }
    
    // If there are MP4 files to process directly, we'll convert them first individually
    // This ensures we don't miss anything in case the batch command has issues
    if (mp4Files.length > 0) {
      Logger.info(`Processing ${Math.min(mp4Files.length, options.limit)} MP4 files directly...`);
      
      // Limit to the specified number of files
      const filesToProcess = mp4Files.slice(0, options.limit);
      let successCount = 0;
      
      // Process files in parallel if requested
      if (options.maxParallel > 1) {
        // Create chunks of files to process in parallel
        const chunkSize = options.maxParallel;
        const chunks: string[][] = [];
        
        for (let i = 0; i < filesToProcess.length; i += chunkSize) {
          chunks.push(filesToProcess.slice(i, i + chunkSize));
        }
        
        // Process each chunk
        for (const chunk of chunks) {
          const promises = chunk.map(async (filePath) => {
            const fileName = path.basename(filePath);
            Logger.info(`Converting ${fileName} to M4A...`);
            
            const scriptPath = path.join(__dirname, '..', 'media-processing-cli.sh');
            const fileConvertCommand = `${scriptPath} convert --file "${filePath}" --force`;
            
            try {
              execSync(fileConvertCommand, { stdio: 'inherit' });
              successCount++;
              return true;
            } catch (err) {
              Logger.error(`Error converting ${fileName}: ${err}`);
              return false;
            }
          });
          
          // Wait for all conversions in this chunk to complete
          await Promise.all(promises);
        }
      } else {
        // Process files sequentially
        for (const filePath of filesToProcess) {
          const fileName = path.basename(filePath);
          Logger.info(`Converting ${fileName} to M4A...`);
          
          const scriptPath = path.join(__dirname, '..', 'media-processing-cli.sh');
          const fileConvertCommand = `${scriptPath} convert --file "${filePath}" --force`;
          
          try {
            execSync(fileConvertCommand, { stdio: 'inherit' });
            successCount++;
          } catch (err) {
            Logger.error(`Error converting ${fileName}: ${err}`);
          }
        }
      }
      
      Logger.info(`Successfully converted ${successCount} out of ${filesToProcess.length} files directly`);
      
      // If all files were processed successfully, return here
      if (successCount === filesToProcess.length) {
        return true;
      }
    }
    
    // Then try the batch command as a fallback or to process additional files
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
        Logger.info('Running batch conversion command...');
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
    
    const tsNodePath = 'ts-node';
    const renameCommand = `cd /Users/raybunnage/Documents/github/dhg-mono && ${tsNodePath} scripts/cli-pipeline/media-processing/index.ts rename-mp4-files ${options.dryRun ? '--dry-run' : ''}`;
    
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
    
    const tsNodePath = 'ts-node';
    const registerCommand = `cd /Users/raybunnage/Documents/github/dhg-mono && ${tsNodePath} scripts/cli-pipeline/media-processing/index.ts register-local-mp4-files ${options.dryRun ? '--dry-run' : ''}`;
    
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
    
    const tsNodePath = 'ts-node';
    const updateCommand = `cd /Users/raybunnage/Documents/github/dhg-mono && ${tsNodePath} scripts/cli-pipeline/media-processing/index.ts update-disk-status ${options.dryRun ? '--dry-run' : ''}`;
    
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
    
    const tsNodePath = 'ts-node';
    const registerDocsCommand = `cd /Users/raybunnage/Documents/github/dhg-mono && ${tsNodePath} scripts/cli-pipeline/media-processing/index.ts register-expert-docs ${options.dryRun ? '--dry-run' : ''} --limit ${options.limit}`;
    
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
    
    const tsNodePath = 'ts-node';
    const syncCommand = `cd /Users/raybunnage/Documents/github/dhg-mono && ${tsNodePath} scripts/cli-pipeline/media-processing/index.ts sync-m4a-names --after-rename ${options.dryRun ? '--dry-run' : ''}`;
    
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
    // Force direct copy of Wilkinson and OpenDiscuss files for emergency fix
    if (options.forceDirectCopy) {
      Logger.info('🔄 Using force direct copy mode to copy MP4 files...');
      const wilkinsonSource = path.join(options.source, 'Wilkinson.9.15.24.mp4');
      const openDiscussSource = path.join(options.source, 'OpenDiscuss.PVT.CNS.6.24.20.mp4');
      const targetDir = path.join(process.cwd(), 'file_types', 'mp4');
      
      // Make sure the target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        Logger.info(`Created directory: ${targetDir}`);
      }
      
      // Copy the Wilkinson file
      if (fs.existsSync(wilkinsonSource)) {
        const targetPath = path.join(targetDir, 'Wilkinson.9.15.24.mp4');
        fs.copyFileSync(wilkinsonSource, targetPath);
        Logger.info(`Copied: ${wilkinsonSource} -> ${targetPath}`);
      } else {
        Logger.warn(`Source file not found: ${wilkinsonSource}`);
      }
      
      // Copy the OpenDiscuss file
      if (fs.existsSync(openDiscussSource)) {
        const targetPath = path.join(targetDir, 'OpenDiscuss.PVT.CNS.6.24.20.mp4');
        fs.copyFileSync(openDiscussSource, targetPath);
        Logger.info(`Copied: ${openDiscussSource} -> ${targetPath}`);
      } else {
        Logger.warn(`Source file not found: ${openDiscussSource}`);
      }
      
      completedSteps++;
    } else {
      const copySuccess = await findAndCopyMedia();
      if (copySuccess) {
        completedSteps++;
      }
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
    if (cliOptions.forceDirectCopy) options.forceDirectCopy = true;
  }
  
  // Set forceDirectCopy to true for emergency fix
  options.forceDirectCopy = true;
  
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