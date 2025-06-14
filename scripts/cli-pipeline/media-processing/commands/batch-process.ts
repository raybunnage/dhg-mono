/**
 * Batch Process command for the Media Processing CLI Pipeline
 * Processes multiple summary files in batch
 */

import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import { Logger } from '../../../../packages/shared/utils';
import { fileService } from '../../../../packages/shared/services/file-service/file-service';
import { BatchProcessingService, BatchStatus } from '../../../../packages/shared/services/batch-processing-service';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

// Import the process-summary command module
import processSummaryCommand from './process-summary';

// Define interfaces
interface BatchProcessOptions {
  directory?: string;
  pattern?: string;
  writeToDb?: boolean;
  outputDir?: string;
  summaryType?: 'short' | 'medium' | 'detailed';
  limit?: string | number;
  dryRun?: boolean;
}

interface BatchProcessResult {
  totalFiles: number;
  processedFiles: number;
  successfulFiles: number;
  failedFiles: number;
  skippedFiles: number;
  errors: Array<{ file: string; error: string }>;
  results: Array<{ file: string; success: boolean; outputPath?: string }>;
}

/**
 * Find files to process in the directory
 */
async function findFiles(
  directory: string,
  pattern: string,
  limit: number
): Promise<string[]> {
  Logger.info(`🔍 Finding files in ${directory} with pattern: ${pattern}`);
  
  try {
    // Use glob to find matching files
    const fullPath = path.resolve(directory);
    
    if (!fs.existsSync(fullPath)) {
      Logger.error(`❌ Directory does not exist: ${fullPath}`);
      return [];
    }
    
    const files = await glob(pattern, {
      cwd: fullPath,
      absolute: true,
      nodir: true,
    });
    
    Logger.info(`✅ Found ${files.length} matching files`);
    
    // Sort files by modification time (newest first)
    const sortedFiles = await Promise.all(
      files.map(async (file) => {
        const stats = fs.statSync(file);
        return { path: file, mtime: stats.mtime.getTime() };
      })
    );
    
    sortedFiles.sort((a, b) => b.mtime - a.mtime);
    
    // Apply limit
    const limitedFiles = sortedFiles.slice(0, limit).map((file) => file.path);
    
    if (limitedFiles.length < files.length) {
      Logger.info(`ℹ️ Processing only the newest ${limitedFiles.length} of ${files.length} files due to limit`);
    }
    
    return limitedFiles;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error finding files: ${errorMessage}`);
    return [];
  }
}

/**
 * Process files in batch
 */
async function processBatch(
  files: string[],
  options: BatchProcessOptions
): Promise<BatchProcessResult> {
  Logger.info(`🚀 Processing ${files.length} files in batch`);
  
  const result: BatchProcessResult = {
    totalFiles: files.length,
    processedFiles: 0,
    successfulFiles: 0,
    failedFiles: 0,
    skippedFiles: 0,
    errors: [],
    results: [],
  };
  
  // Setup batch processing
  const supabaseService = SupabaseClientService.getInstance().getClient();
  const logger = new Logger('BatchProcess', 'INFO');
  const batchService = new BatchProcessingService(supabaseService, logger);
  
  // Create a batch record
  const batch = await batchService.createBatch({
    name: `Summary Batch Processing - ${new Date().toISOString()}`,
    description: `Processing ${files.length} summary files with ${options.summaryType} summary type`,
    metadata: {
      directory: options.directory,
      pattern: options.pattern,
      summaryType: options.summaryType,
      outputDir: options.outputDir,
      writeToDb: options.writeToDb,
      dryRun: options.dryRun,
    },
  });
  
  // If dry run, just list the files that would be processed
  if (options.dryRun) {
    Logger.info('🔄 [DRY RUN] Would process the following files:');
    for (let i = 0; i < files.length; i++) {
      Logger.info(`   ${i + 1}. ${files[i]}`);
    }
    
    return {
      ...result,
      skippedFiles: files.length,
    };
  }
  
  // Process each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileBaseName = path.basename(file, path.extname(file));
    let outputFile: string | undefined;
    
    Logger.info(`⏳ Processing file ${i + 1}/${files.length}: ${file}`);
    
    // Set up output file path if directory is specified
    if (options.outputDir) {
      const outputFileName = `${fileBaseName}_summary_${options.summaryType}.txt`;
      outputFile = path.join(options.outputDir, outputFileName);
      
      // Ensure output directory exists
      fileService.ensureDirectoryExists(options.outputDir);
    }
    
    try {
      // Process the summary using the process-summary command
      await processSummaryCommand({
        file,
        writeToDb: options.writeToDb,
        outputFile,
        summaryType: options.summaryType as any,
        dryRun: false, // We've already handled dry run at the batch level
      });
      
      // Update result
      result.processedFiles++;
      result.successfulFiles++;
      result.results.push({
        file,
        success: true,
        outputPath: outputFile,
      });
      
      Logger.info(`✅ Successfully processed file ${i + 1}/${files.length}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      Logger.error(`❌ Error processing file ${file}: ${errorMessage}`);
      
      // Update result
      result.processedFiles++;
      result.failedFiles++;
      result.errors.push({
        file,
        error: errorMessage,
      });
      result.results.push({
        file,
        success: false,
      });
    }
    
    // Update batch progress
    if (batch) {
      await batchService.updateBatchStatus(
        batch.id,
        BatchStatus.RUNNING,
        {
          total_items: files.length,
          processed_items: result.processedFiles,
          failed_items: result.failedFiles,
          skipped_items: result.skippedFiles,
          progress_percentage: Math.round((result.processedFiles / files.length) * 100),
        }
      );
    }
  }
  
  // Update batch status to completed
  if (batch) {
    await batchService.updateBatchStatus(
      batch.id,
      BatchStatus.COMPLETED,
      {
        total_items: files.length,
        processed_items: result.processedFiles,
        failed_items: result.failedFiles,
        skipped_items: result.skippedFiles,
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
      }
    );
  }
  
  return result;
}

/**
 * Format the batch processing results
 */
function formatResults(result: BatchProcessResult): string {
  return `
Batch Processing Summary
------------------------
Total files:       ${result.totalFiles}
Processed files:   ${result.processedFiles}
Successful files:  ${result.successfulFiles}
Failed files:      ${result.failedFiles}
Skipped files:     ${result.skippedFiles}

${result.errors.length > 0 ? `Errors:
${result.errors.map((error) => `- ${error.file}: ${error.error}`).join('\n')}
` : ''}
`;
}

/**
 * Main command implementation
 */
export default async function command(options: BatchProcessOptions): Promise<void> {
  Logger.info('🚀 Starting batch-process command');
  Logger.debug('Options:', options);
  
  try {
    // Set defaults
    const directory = options.directory || process.cwd();
    const pattern = options.pattern || '*.txt';
    const limit = typeof options.limit === 'string' ? parseInt(options.limit, 10) : options.limit || 10;
    
    // Find files to process
    const files = await findFiles(directory, pattern, limit);
    
    if (files.length === 0) {
      Logger.warn('⚠️ No files found matching the pattern. Nothing to process.');
      return;
    }
    
    // Process the files
    const result = await processBatch(files, options);
    
    // Print the results
    Logger.info(formatResults(result));
    
    if (result.failedFiles > 0) {
      Logger.warn(`⚠️ ${result.failedFiles} files failed to process. Check the error log for details.`);
    } else {
      Logger.info('✅ Batch processing completed successfully');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Command execution failed: ${errorMessage}`);
  }
}