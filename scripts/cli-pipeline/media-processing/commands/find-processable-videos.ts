#!/usr/bin/env ts-node
/**
 * Find Processable Videos Command
 * 
 * This command scans the file_types/mp4 directory for MP4 files
 * and identifies which ones are ready for processing through the
 * media pipeline. It can optionally auto-process them.
 * 
 * Usage:
 *   find-processable-videos.ts [options]
 * 
 * Options:
 *   --dry-run                  Show what would be processed without changes
 *   --limit [number]           Limit the number of files to process (default: 10)
 *   --auto-process             Automatically extract audio and queue for transcription
 *   --format [format]          Output format (table, json, simple)
 * 
 * Note:
 *   Files with 'skip_processing' status are automatically excluded from processing.
 *   Use update-status.ts to mark large files with this status:
 *     update-status.ts [fileId] --stage extraction --status skip_processing
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
  limit: 200,
  autoProcess: args.includes('--auto-process'),
  format: 'table',
  outputDir: path.join(process.cwd(), 'file_types', 'm4a')
};

// Get limit if specified
const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1 && args[limitIndex + 1]) {
  const limitArg = parseInt(args[limitIndex + 1]);
  if (!isNaN(limitArg)) {
    options.limit = limitArg;
  }
}

// Get format if specified
const formatIndex = args.indexOf('--format');
if (formatIndex !== -1 && args[formatIndex + 1]) {
  const formatArg = args[formatIndex + 1].toLowerCase();
  if (['table', 'json', 'simple'].includes(formatArg)) {
    options.format = formatArg;
  }
}

// Get output directory if specified  
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1 && args[outputIndex + 1]) {
  options.outputDir = args[outputIndex + 1];
}

/**
 * Format list of files for display
 */
function formatFiles(files: any[], format: string): string {
  if (format === 'json') {
    return JSON.stringify(files, null, 2);
  }
  
  if (format === 'simple') {
    return files.map(file => file.path).join('\n');
  }
  
  // Default: table format
  if (files.length === 0) {
    return 'No processable files found.';
  }
  
  // Create a nice table
  const headers = [
    'Filename', 
    'Size (MB)', 
    'Status', 
    'Document ID',
    'Action'
  ];
  
  // Calculate column widths
  const columnWidths = [
    Math.max(headers[0].length, ...files.map(file => (file.filename || '').length)),
    Math.max(headers[1].length, ...files.map(file => (file.sizeFormatted || '').length)),
    Math.max(headers[2].length, ...files.map(file => (file.status || '').length)),
    Math.max(headers[3].length, ...files.map(file => (file.documentId || '').length)),
    Math.max(headers[4].length, ...files.map(file => (file.action || '').length))
  ];
  
  // Create header row
  let output = headers.map((header, i) => header.padEnd(columnWidths[i])).join(' | ') + '\n';
  
  // Create separator row
  output += columnWidths.map(width => '-'.repeat(width)).join('-+-') + '\n';
  
  // Create data rows
  files.forEach(file => {
    output += [
      (file.filename || '').padEnd(columnWidths[0]),
      (file.sizeFormatted || '').padEnd(columnWidths[1]),
      (file.status || '').padEnd(columnWidths[2]),
      (file.documentId || '').padEnd(columnWidths[3]),
      (file.action || '').padEnd(columnWidths[4])
    ].join(' | ') + '\n';
  });
  
  return output;
}

/**
 * Run a command on an expert document
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
 * Process a single file
 */
async function processFile(filePath: string, documentId: string | null): Promise<boolean> {
  try {
    // Build common args
    const commonArgs = options.dryRun ? ['--dry-run'] : [];
    
    // If we have a document ID, process that
    if (documentId) {
      Logger.info(`Processing document: ${documentId}`);
      
      const { success } = await runCommand('ts-node', [
        path.join(__dirname, 'convert-mp4.ts'),
        ...commonArgs,
        documentId
      ]);
      
      return success;
    } 
    // Otherwise process the direct file path
    else {
      Logger.info(`Processing file: ${filePath}`);
      
      const { success } = await runCommand('ts-node', [
        path.join(__dirname, 'convert-mp4.ts'),
        ...commonArgs,
        filePath
      ]);
      
      return success;
    }
  } catch (error: any) {
    Logger.error(`❌ Exception in processFile: ${error.message}`);
    return false;
  }
}

async function main() {
  try {
    const MP4_DIR = path.join(process.cwd(), 'file_types', 'mp4');
    const M4A_DIR = options.outputDir;
    
    // Display configuration
    Logger.info('🔍 Finding Processable Videos');
    Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
    Logger.info(`Auto-process: ${options.autoProcess ? 'Yes' : 'No'}`);
    Logger.info(`Limit: ${options.limit}`);
    
    // Ensure directories exist
    if (!fs.existsSync(MP4_DIR)) {
      Logger.error(`❌ MP4 directory not found: ${MP4_DIR}`);
      process.exit(1);
    }
    
    if (!fs.existsSync(M4A_DIR) && !options.dryRun) {
      try {
        fs.mkdirSync(M4A_DIR, { recursive: true });
        Logger.info(`✅ Created M4A directory: ${M4A_DIR}`);
      } catch (error: any) {
        Logger.error(`❌ Error creating M4A directory: ${error.message}`);
        process.exit(1);
      }
    }
    
    // Get all MP4 files in the directory
    const mp4Files = fs.readdirSync(MP4_DIR)
      .filter(file => file.toLowerCase().endsWith('.mp4'))
      .map(file => ({
        filename: file,
        path: path.join(MP4_DIR, file),
        size: fs.statSync(path.join(MP4_DIR, file)).size,
        sizeFormatted: (fs.statSync(path.join(MP4_DIR, file)).size / (1024 * 1024)).toFixed(2) + ' MB'
      }));
    
    if (mp4Files.length === 0) {
      Logger.info('ℹ️ No MP4 files found in directory');
      process.exit(0);
    }
    
    Logger.info(`📋 Found ${mp4Files.length} MP4 files in directory`);
    
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
    
    // Get matching document info for files
    const processableFiles = [];
  const successfullyProcessedFiles = [];
    
    for (const file of mp4Files) {
      // Check if there's a corresponding M4A file already
      const m4aFilename = file.filename.replace(/\.mp4$/i, '.m4a');
      const ingestedM4aFilename = `INGESTED_${file.filename.replace(/\.mp4$/i, '.m4a')}`;
      const m4aExists = fs.existsSync(path.join(M4A_DIR, m4aFilename)) || 
                        fs.existsSync(path.join(M4A_DIR, ingestedM4aFilename));
      
      // Find corresponding documents in database
      const { data: matchingDocs, error: queryError } = await supabase
        .from('expert_documents')
        .select(`
          id, 
          content_type, 
          raw_content,
          processing_status,
          processing_error,
          source_id, 
          sources_google!inner(id, name, mime_type)
        `)
        .eq('content_type', 'presentation')
        .eq('sources_google.mime_type', 'video/mp4')
        .not('processing_status', 'eq', 'error')  // Skip files that have error status
        .ilike('sources_google.name', `%${file.filename.replace(/\.[^/.]+$/, "")}%`);
      
      if (queryError) {
        Logger.warn(`⚠️ Error querying documents for ${file.filename}: ${queryError.message}`);
        continue;
      }
      
      let status: string;
      let documentId: string | null = null;
      let action: string;
      
      if (!matchingDocs || matchingDocs.length === 0) {
        // Also query to check if the file is marked with error status for skipping
        const { data: skippedDocs } = await supabase
          .from('expert_documents')
          .select(`id, processing_status, processing_error, sources_google!inner(id, name)`)
          .eq('processing_status', 'error')
          .ilike('sources_google.name', `%${file.filename.replace(/\.[^/.]+$/, "")}%`);
        
        if (skippedDocs && skippedDocs.length > 0) {
          // Check if this is actually a skipped file by checking the error message
          const isSkipped = skippedDocs.some(doc => 
            doc.processing_error && doc.processing_error.includes('Skipped processing'));
          
          if (isSkipped) {
            status = 'Marked to skip';
            documentId = skippedDocs[0].id;
            action = 'Skip';
          } else {
            status = 'Failed processing';
            documentId = skippedDocs[0].id;
            action = 'Skip';
          }
        } else {
          status = 'No document record';
          action = 'Create document';
        }
      } else {
        documentId = matchingDocs[0].id;
        
        // Check if audio has already been extracted based on raw_content
        const hasRawContent = matchingDocs[0].raw_content && matchingDocs[0].raw_content.length > 0;
        
        if (hasRawContent) {
          status = 'Already processed';
          action = 'Skip';
        } else if (matchingDocs[0].processing_status === 'error' && 
                  matchingDocs[0].processing_error && 
                  matchingDocs[0].processing_error.includes('Skipped processing')) {
          status = 'Marked to skip';
          action = 'Skip';
        } else if (m4aExists) {
          status = 'M4A exists but not processed';
          action = 'Process audio';
        } else {
          status = 'Needs processing';
          action = 'Convert to M4A';
        }
      }
      
      processableFiles.push({
        ...file,
        status,
        documentId,
        action,
        processed: false
      });
    }
    
    // Sort files by status to prioritize those that need conversion
    processableFiles.sort((a, b) => {
      // Prioritize "Convert to M4A" action
      if (a.action === 'Convert to M4A' && b.action !== 'Convert to M4A') return -1;
      if (a.action !== 'Convert to M4A' && b.action === 'Convert to M4A') return 1;
      
      // Then prioritize "Process audio" action
      if (a.action === 'Process audio' && b.action !== 'Process audio' && b.action !== 'Convert to M4A') return -1;
      if (a.action !== 'Process audio' && a.action !== 'Convert to M4A' && b.action === 'Process audio') return 1;
      
      // Then sort by filename
      return a.filename.localeCompare(b.filename);
    });
    
    // Apply limit
    const filesToProcess = processableFiles.slice(0, options.limit);
    
    // Output the results
    const output = formatFiles(filesToProcess, options.format);
    console.log(output);
    
    Logger.info(`ℹ️ Found ${filesToProcess.length} files ready for processing`);
    
    // Auto-process if requested
    if (options.autoProcess && filesToProcess.length > 0) {
      Logger.info('🔄 Auto-processing files...');
      
      let processedCount = 0;
      let successCount = 0;
      
      for (const file of filesToProcess) {
        if (file.action === 'Skip') {
          Logger.info(`⏭️ Skipping ${file.filename}: already processed`);
          continue;
        }
        
        if (file.action === 'Convert to M4A' || file.action === 'Update status') {
          processedCount++;
          
          Logger.info(`📋 Processing ${file.filename}`);
          
          const filePath = file.path;
          const success = await processFile(filePath, file.documentId);
          
          if (success) {
            successCount++;
            file.processed = true;
            
            if (options.dryRun) {
              Logger.info(`🔄 Would process ${file.filename}`);
            } else {
              const outputFilename = `INGESTED_${file.filename.replace(/\.mp4$/i, ".m4a")}`;
              const outputPath = path.join(options.outputDir, outputFilename);
              const relativeOutputPath = path.relative(process.cwd(), outputPath);
              Logger.info(`✅ Successfully processed ${file.filename}`);
              Logger.info(`📂 Created M4A file: ${relativeOutputPath}`);
              Logger.info(`📊 File size: ${(fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2)} MB`);
              
              // Add to summary for final output
              successfullyProcessedFiles.push({
                sourceFile: file.filename,
                outputFile: relativeOutputPath,
                sizeInMB: (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2)
              });
            }
          } else {
            Logger.error(`❌ Failed to process ${file.filename}`);
          }
        }
      }
      
      Logger.info(`✅ Processing complete: ${successCount}/${processedCount} successful`);
      
      // Show summary of all created files if any
      if (successfullyProcessedFiles.length > 0) {
        console.log('\n============== SUCCESSFULLY CREATED M4A FILES ==============');
        console.log('| SOURCE FILE               | OUTPUT FILE                       | SIZE (MB) |');
        console.log('|---------------------------|-----------------------------------|-----------|');
        successfullyProcessedFiles.forEach(file => {
          const sourceCol = file.sourceFile.padEnd(25).substring(0, 25);
          const outputCol = file.outputFile.padEnd(35).substring(0, 35);
          const sizeCol = file.sizeInMB.toString().padStart(9);
          console.log(`| ${sourceCol} | ${outputCol} | ${sizeCol} |`);
        });
        console.log('=========================================================');
        
        // For easy copying in shell
        console.log('\nReady for transcription (copy-paste paths):');
        successfullyProcessedFiles.forEach(file => {
          console.log(file.outputFile);
        });
      }
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