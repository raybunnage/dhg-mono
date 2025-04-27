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
 * Process sources in batches
 */
/**
 * Process sources with concurrency control
 */
async function processWithConcurrency<T, R>(
  items: T[],
  processItem: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const runningPromises: Promise<void>[] = [];
  const itemsToProcess = [...items]; // Create a copy of the items array
  
  // Process items concurrently but limited to the concurrency setting
  while (itemsToProcess.length > 0 || runningPromises.length > 0) {
    // Fill up to concurrency limit
    while (runningPromises.length < concurrency && itemsToProcess.length > 0) {
      const item = itemsToProcess.shift()!;
      const promise = (async () => {
        const result = await processItem(item);
        results.push(result);
      })();
      runningPromises.push(promise);
    }
    
    // Wait for at least one promise to complete
    if (runningPromises.length > 0) {
      await Promise.race(runningPromises.map(p => p.catch(e => e)));
      // Check which promises are still pending
      const pendingPromises: Promise<void>[] = [];
      for (const promise of runningPromises) {
        // Create a flag to track if this promise is still pending
        let isResolved = false;
        
        // Set up a race between the promise and a flag-setter
        // This will only set the flag if the promise is already resolved
        await Promise.race([
          promise.then(() => { isResolved = true; }, () => { isResolved = true; }),
          Promise.resolve()
        ]);
        
        if (!isResolved) {
          pendingPromises.push(promise);
        }
      }
      
      // Replace the list with only pending promises
      runningPromises.length = 0;
      runningPromises.push(...pendingPromises);
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
    concurrency = 1
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
    
    // Process in batches
    Logger.info(`Will process sources in batches of ${batchSize} with concurrency ${concurrency}`);
    
    let currentBatch = 1;
    let processedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < sourceIds.length; i += batchSize) {
      const batchIds = sourceIds.slice(i, i + batchSize);
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
      Logger.info(`Progress: ${((processedCount / sourceIds.length) * 100).toFixed(2)}% complete`);
    }
    
    Logger.info(`Batch classification complete. Processed ${processedCount} sources, ${failedCount} failed.`);
    
  } catch (error) {
    Logger.error(`Error in classify-batch-from-file command: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}