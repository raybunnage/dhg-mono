/**
 * Classify batch from file command
 * 
 * Reads source IDs from the need_classification.md file and processes them in batches.
 * Uses the classify-source mechanism to classify each source in the batch.
 */
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
import { classifySourceCommand } from './classify-source';
import * as fs from 'fs';

interface ClassifyBatchFromFileOptions {
  inputFile?: string;
  batchSize?: number;
  verbose?: boolean;
  dryRun?: boolean;
  force?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  concurrency?: number;
  limit?: number; // Optional limit on number of sources to process
}

/**
 * Extract source IDs from the markdown file
 */
function extractSourceIdsFromMarkdown(content: string): string[] {
  const sourceIds: string[] = [];
  
  // Match UUIDs that are at the beginning of a line inside a code block
  const uuidRegex = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gm;
  
  // Find all code blocks
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  
  for (const block of codeBlocks) {
    // Extract the content inside the code block
    const blockContent = block.replace(/```\s*\n?|\s*\n?```/g, '');
    
    // Extract UUIDs from each line
    let match;
    const lineRegex = new RegExp(uuidRegex);
    while ((match = lineRegex.exec(blockContent)) !== null) {
      sourceIds.push(match[1]);
    }
  }
  
  return sourceIds;
}

/**
 * Process sources with improved memory management and concurrency control
 */
async function processWithConcurrency<T, R>(
  items: T[],
  processItem: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  
  // Process items in batches to manage memory better
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map(item => 
      processItem(item)
        .then(result => {
          results.push(result);
          return result;
        })
        .catch(error => {
          // Still count this item but mark it as failed
          return { success: false, error } as unknown as R;
        })
    );
    
    // Wait for all promises in this batch to complete before moving to next batch
    await Promise.all(batchPromises);
    
    // Force garbage collection if possible (Node might ignore this, but worth trying)
    if (global.gc) {
      try {
        global.gc();
      } catch (e) {
        // Ignore if gc is not available
      }
    }
  }
  
  return results;
}

export async function classifyBatchFromFileCommand(options: ClassifyBatchFromFileOptions): Promise<void> {
  const {
    inputFile = 'docs/cli-pipeline/need_classification.md',
    batchSize = 10,
    verbose = false,
    dryRun = false,
    force = false,
    maxRetries = 3,
    retryDelayMs = 2000,
    concurrency = 1,
    limit = 0 // 0 means process all
  } = options;

  try {
    Logger.info(`Starting batch classification from file: ${inputFile}`);
    
    // Check if the input file exists
    if (!fs.existsSync(inputFile)) {
      Logger.error(`Input file not found: ${inputFile}`);
      return;
    }
    
    // Read the input file
    const fileContent = fs.readFileSync(inputFile, 'utf8');
    Logger.info(`Successfully read input file (${fileContent.length} bytes)`);
    
    // Extract source IDs from the markdown file
    const sourceIds = extractSourceIdsFromMarkdown(fileContent);
    Logger.info(`Found ${sourceIds.length} source IDs in the input file`);
    
    if (sourceIds.length === 0) {
      Logger.error(`No source IDs found in the input file. Make sure the file contains UUIDs.`);
      return;
    }
    
    // Limit the number of sources if specified
    const sourcesToProcess = limit > 0 ? sourceIds.slice(0, limit) : sourceIds;
    
    // Process in batches
    Logger.info(`Will process ${sourcesToProcess.length} sources in batches of ${batchSize} with concurrency ${concurrency}`);
    
    let currentBatch = 1;
    let processedCount = 0;
    let failedCount = 0;
    
    // Periodically force garbage collection to release memory
    const forceGC = async (): Promise<void> => {
      if (global.gc) {
        try {
          global.gc();
          Logger.debug('Forced garbage collection');
        } catch (e) {
          // Ignore if gc is not available
        }
      }
    };
    
    for (let i = 0; i < sourcesToProcess.length; i += batchSize) {
      const batchIds = sourcesToProcess.slice(i, i + batchSize);
      Logger.info(`Processing batch ${currentBatch} with ${batchIds.length} sources...`);
      
      if (dryRun) {
        Logger.info(`[DRY RUN] Would process these source IDs: ${batchIds.join(', ')}`);
        processedCount += batchIds.length;
        currentBatch++;
        continue;
      }
      
      // Define an interface for process results
      interface ProcessResult {
        success: boolean;
        sourceId: string;
        error?: string;
      }
      
      // Process the batch with concurrency
      const startTime = Date.now();
      
      if (concurrency > 1) {
        // Process concurrently
        Logger.info(`Using concurrent processing with ${concurrency} parallel operations`);
        
        const results = await processWithConcurrency<string, ProcessResult>(
          batchIds,
          async (sourceId) => {
            try {
              Logger.info(`Starting processing for source ID: ${sourceId}`);
              
              // Use the existing classify-source command for each source
              await classifySourceCommand({
                sourceId,
                verbose,
                dryRun,
                force,
                maxRetries,
                retryDelayMs
              });
              
              Logger.info(`Successfully processed source ID: ${sourceId}`);
              return { success: true, sourceId };
            } catch (error) {
              Logger.error(`Error processing source ID ${sourceId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              return { 
                success: false, 
                sourceId,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          },
          concurrency
        );
        
        // Count successes and failures
        const successes = results.filter(r => r.success).length;
        const failures = results.filter(r => !r.success).length;
        
        processedCount += successes;
        failedCount += failures;
        
        if (failures > 0 && verbose) {
          Logger.warn(`Failed source IDs in this batch:`);
          results.filter(r => !r.success).forEach(result => {
            Logger.warn(`- Source ID ${result.sourceId}: ${result.error}`);
          });
        }
      } else {
        // Process sequentially
        for (const sourceId of batchIds) {
          Logger.info(`Processing source ID: ${sourceId} (${processedCount + 1} of ${sourceIds.length})`);
          
          try {
            // Use the existing classify-source command for each source
            await classifySourceCommand({
              sourceId,
              verbose,
              dryRun,
              force,
              maxRetries,
              retryDelayMs
            });
            
            processedCount++;
          } catch (error) {
            Logger.error(`Error processing source ID ${sourceId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            failedCount++;
          }
        }
      }
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      currentBatch++;
      
      // Log progress
      Logger.info(`Completed batch ${currentBatch - 1} in ${duration.toFixed(2)} seconds (${processedCount} sources processed, ${failedCount} failed)`);
      Logger.info(`Progress: ${((processedCount / sourcesToProcess.length) * 100).toFixed(2)}% complete`);
      
      // Force garbage collection between batches to free memory
      await forceGC();
      
      // Brief pause between batches to reduce memory pressure
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    Logger.info(`Batch classification complete. Processed ${processedCount} sources, ${failedCount} failed.`);
    
  } catch (error) {
    Logger.error(`Error in classify-batch-from-file command: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}