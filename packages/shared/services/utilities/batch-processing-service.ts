/**
 * Batch Processing Service
 * 
 * Provides utilities for batch processing operations with support for
 * progress tracking, concurrency, and error handling.
 */

// Progress callback type
export type ProgressCallback = (progress: ProgressInfo) => void;

// Progress information
export interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  completed?: boolean;
  message?: string;
}

// Batch processing options
export interface BatchOptions {
  batchSize?: number;
  concurrentBatches?: number;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
}

// Batch processing result
export interface BatchResult<T> {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: unknown[];
  results?: T[];
  startTime: Date;
  endTime: Date;
}

/**
 * Batch Processing Service
 * Manages batch operations with standardized progress tracking and error handling
 */
export class BatchProcessingService {
  private static instance: BatchProcessingService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): BatchProcessingService {
    if (!BatchProcessingService.instance) {
      BatchProcessingService.instance = new BatchProcessingService();
    }
    return BatchProcessingService.instance;
  }

  /**
   * Process an array of items in batches
   * 
   * @param items Array of items to process
   * @param processor Function to process each batch
   * @param options Batch processing options
   * @param onProgress Progress callback function
   * @returns Batch processing result
   */
  public async processBatches<T, R>(
    items: T[],
    processor: (batch: T[], batchIndex: number, totalBatches: number) => Promise<{
      succeeded: number;
      failed: number;
      errors: unknown[];
      results?: R[];
    }>,
    options: BatchOptions = {},
    onProgress?: ProgressCallback
  ): Promise<BatchResult<R>> {
    const {
      batchSize = 50,
      concurrentBatches = 1,
      retryAttempts = 0,
      retryDelay = 1000,
    } = options;

    // Initialize result
    const result: BatchResult<R> = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      results: [],
      startTime: new Date(),
      endTime: new Date(),
    };

    // If no items, return empty result
    if (!items || items.length === 0) {
      return result;
    }

    try {
      // Calculate total batches
      const totalItems = items.length;
      const totalBatches = Math.ceil(totalItems / batchSize);

      console.log(`Processing ${totalItems} items in ${totalBatches} batches of ${batchSize}`);

      // Update progress immediately
      this.updateProgress(onProgress, 0, totalItems, 'Starting batch processing');

      // Process sequentially if concurrentBatches is 1
      if (concurrentBatches <= 1) {
        // Sequential processing
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const start = batchIndex * batchSize;
          const end = Math.min(start + batchSize, totalItems);
          const batch = items.slice(start, end);

          console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} items)`);

          // Process the batch with retry logic
          const batchResult = await this.processWithRetry(
            () => processor(batch, batchIndex, totalBatches),
            retryAttempts,
            retryDelay
          );

          // Update result
          result.processed += batch.length;
          result.succeeded += batchResult.succeeded;
          result.failed += batchResult.failed;
          result.errors.push(...batchResult.errors);

          if (batchResult.results) {
            result.results = result.results || [];
            result.results.push(...batchResult.results);
          }

          // Update progress
          this.updateProgress(
            onProgress,
            end,
            totalItems,
            `Completed batch ${batchIndex + 1}/${totalBatches}`
          );
        }
      } else {
        // Concurrent processing
        for (let i = 0; i < totalBatches; i += concurrentBatches) {
          const batchPromises = [];

          // Create batch promises for concurrent execution
          for (let j = 0; j < concurrentBatches && i + j < totalBatches; j++) {
            const batchIndex = i + j;
            const start = batchIndex * batchSize;
            const end = Math.min(start + batchSize, totalItems);
            const batch = items.slice(start, end);

            console.log(`Preparing batch ${batchIndex + 1}/${totalBatches} (${batch.length} items)`);

            // Add promise for this batch with retry logic
            batchPromises.push(
              this.processWithRetry(
                () => processor(batch, batchIndex, totalBatches),
                retryAttempts,
                retryDelay
              ).then(batchResult => {
                // Track results for each batch
                return { 
                  batchIndex, 
                  batchSize: batch.length, 
                  ...batchResult 
                };
              })
            );
          }

          // Wait for concurrent batch promises to complete
          const batchResults = await Promise.all(batchPromises);

          // Process results from concurrent batches
          for (const batchResult of batchResults) {
            result.processed += batchResult.batchSize;
            result.succeeded += batchResult.succeeded;
            result.failed += batchResult.failed;
            result.errors.push(...batchResult.errors);

            if (batchResult.results) {
              result.results = result.results || [];
              result.results.push(...batchResult.results);
            }
          }

          // Calculate progress after this set of concurrent batches
          const processedSoFar = Math.min(
            (i + concurrentBatches) * batchSize,
            totalItems
          );

          // Update progress
          this.updateProgress(
            onProgress,
            processedSoFar,
            totalItems,
            `Completed batches ${i + 1}-${Math.min(i + concurrentBatches, totalBatches)}/${totalBatches}`
          );
        }
      }

      // Set end time and return result
      result.endTime = new Date();
      this.updateProgress(onProgress, totalItems, totalItems, 'Processing complete', true);
      
      return result;
    } catch (error) {
      console.error('Error in batch processing:', error);
      result.errors.push(error);
      result.endTime = new Date();
      return result;
    }
  }

  /**
   * Execute a function with retry logic
   * 
   * @param fn Function to execute
   * @param retryAttempts Number of retry attempts
   * @param retryDelay Delay between retries (ms)
   * @returns Result of the function
   */
  private async processWithRetry<T>(
    fn: () => Promise<T>,
    retryAttempts: number = 0,
    retryDelay: number = 1000
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retryAttempts <= 0) {
        // No more retry attempts, rethrow the error
        throw error;
      }

      console.log(`Retry attempt (${retryAttempts} remaining)...`);
      
      // Wait for the delay
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Recursive retry with one less attempt
      return this.processWithRetry(fn, retryAttempts - 1, retryDelay);
    }
  }

  /**
   * Update progress if a callback is provided
   * 
   * @param callback Progress callback function
   * @param current Current progress
   * @param total Total items
   * @param message Progress message
   * @param completed Whether processing is completed
   */
  private updateProgress(
    callback?: ProgressCallback,
    current: number = 0,
    total: number = 0,
    message?: string,
    completed: boolean = false
  ): void {
    if (!callback) return;
    
    const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    
    callback({
      current,
      total,
      percentage,
      message,
      completed
    });
  }
}

// Export default singleton instance
const batchProcessingService = BatchProcessingService.getInstance();
export default batchProcessingService;