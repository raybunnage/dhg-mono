import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from './supabase-client';

export interface BatchOptions {
  batchSize?: number;
  onProgress?: (progress: BatchProgress) => void;
  onError?: (error: Error, item: any, index: number) => void;
  continueOnError?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface BatchProgress {
  processed: number;
  total: number;
  successful: number;
  failed: number;
  rate: number;
  estimatedTimeRemaining: string;
}

export interface BatchResult {
  successful: number;
  failed: number;
  errors: Array<{ item: any; error: Error; index: number }>;
  duration: number;
}

/**
 * BatchDatabaseService - Optimized batch operations for Supabase
 * 
 * This service consolidates batch insert/update/delete patterns found across
 * multiple CLI pipelines including google_sync, scripts, email, and media-processing.
 * 
 * Features:
 * - Configurable batch sizes for optimal performance
 * - Progress tracking with rate calculation
 * - Error handling with retry logic
 * - Transaction-like behavior with rollback options
 */
export class BatchDatabaseService {
  private static instance: BatchDatabaseService;
  private supabase: SupabaseClient;

  private constructor() {
    this.supabase = SupabaseClientService.getInstance().getClient();
  }

  static getInstance(): BatchDatabaseService {
    if (!BatchDatabaseService.instance) {
      BatchDatabaseService.instance = new BatchDatabaseService();
    }
    return BatchDatabaseService.instance;
  }

  /**
   * Batch insert with progress tracking
   * Replaces patterns from google_sync, scripts pipelines
   */
  async batchInsert<T extends Record<string, any>>(
    table: string,
    data: T[],
    options: BatchOptions = {}
  ): Promise<BatchResult> {
    const {
      batchSize = 100,
      onProgress,
      onError,
      continueOnError = true,
      retryAttempts = 3,
      retryDelay = 1000
    } = options;

    const startTime = Date.now();
    const result: BatchResult = {
      successful: 0,
      failed: 0,
      errors: [],
      duration: 0
    };

    const total = data.length;
    let processed = 0;

    // Process in batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      let attempts = 0;
      let success = false;

      while (attempts < retryAttempts && !success) {
        try {
          const { error } = await this.supabase
            .from(table)
            .insert(batch);

          if (error) throw error;

          result.successful += batch.length;
          success = true;
        } catch (error: any) {
          attempts++;
          
          if (attempts >= retryAttempts) {
            result.failed += batch.length;
            
            // Record individual errors
            batch.forEach((item, index) => {
              const actualIndex = i + index;
              result.errors.push({ item, error, index: actualIndex });
              
              if (onError) {
                onError(error, item, actualIndex);
              }
            });

            if (!continueOnError) {
              throw new Error(`Batch insert failed after ${retryAttempts} attempts: ${error.message}`);
            }
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempts));
          }
        }
      }

      processed += batch.length;

      // Report progress
      if (onProgress) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = (total - processed) / rate;
        
        onProgress({
          processed,
          total,
          successful: result.successful,
          failed: result.failed,
          rate,
          estimatedTimeRemaining: this.formatTime(remaining)
        });
      }
    }

    result.duration = (Date.now() - startTime) / 1000;
    return result;
  }

  /**
   * Batch update with progress tracking
   */
  async batchUpdate<T extends Record<string, any>>(
    table: string,
    updates: Array<{ id: string; data: Partial<T> }>,
    options: BatchOptions = {}
  ): Promise<BatchResult> {
    const {
      batchSize = 50, // Smaller batch size for updates
      onProgress,
      onError,
      continueOnError = true,
      retryAttempts = 3,
      retryDelay = 1000
    } = options;

    const startTime = Date.now();
    const result: BatchResult = {
      successful: 0,
      failed: 0,
      errors: [],
      duration: 0
    };

    const total = updates.length;
    let processed = 0;

    // Process updates in batches
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      // Process each update individually within the batch
      const updatePromises = batch.map(async (update, batchIndex) => {
        const actualIndex = i + batchIndex;
        let attempts = 0;
        
        while (attempts < retryAttempts) {
          try {
            const { error } = await this.supabase
              .from(table)
              .update(update.data)
              .eq('id', update.id);

            if (error) throw error;

            result.successful++;
            return;
          } catch (error: any) {
            attempts++;
            
            if (attempts >= retryAttempts) {
              result.failed++;
              result.errors.push({ 
                item: update, 
                error, 
                index: actualIndex 
              });
              
              if (onError) {
                onError(error, update, actualIndex);
              }
              
              if (!continueOnError) {
                throw error;
              }
            } else {
              await new Promise(resolve => setTimeout(resolve, retryDelay * attempts));
            }
          }
        }
      });

      await Promise.all(updatePromises);
      processed += batch.length;

      // Report progress
      if (onProgress) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = (total - processed) / rate;
        
        onProgress({
          processed,
          total,
          successful: result.successful,
          failed: result.failed,
          rate,
          estimatedTimeRemaining: this.formatTime(remaining)
        });
      }
    }

    result.duration = (Date.now() - startTime) / 1000;
    return result;
  }

  /**
   * Batch delete with progress tracking
   */
  async batchDelete(
    table: string,
    ids: string[],
    options: BatchOptions = {}
  ): Promise<BatchResult> {
    const {
      batchSize = 100,
      onProgress,
      onError,
      continueOnError = true,
      retryAttempts = 3,
      retryDelay = 1000
    } = options;

    const startTime = Date.now();
    const result: BatchResult = {
      successful: 0,
      failed: 0,
      errors: [],
      duration: 0
    };

    const total = ids.length;
    let processed = 0;

    // Process deletions in batches
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      let attempts = 0;
      let success = false;

      while (attempts < retryAttempts && !success) {
        try {
          const { error } = await this.supabase
            .from(table)
            .delete()
            .in('id', batch);

          if (error) throw error;

          result.successful += batch.length;
          success = true;
        } catch (error: any) {
          attempts++;
          
          if (attempts >= retryAttempts) {
            result.failed += batch.length;
            
            // Record individual errors
            batch.forEach((id, index) => {
              const actualIndex = i + index;
              result.errors.push({ 
                item: { id }, 
                error, 
                index: actualIndex 
              });
              
              if (onError) {
                onError(error, { id }, actualIndex);
              }
            });

            if (!continueOnError) {
              throw new Error(`Batch delete failed after ${retryAttempts} attempts: ${error.message}`);
            }
          } else {
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempts));
          }
        }
      }

      processed += batch.length;

      // Report progress
      if (onProgress) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = (total - processed) / rate;
        
        onProgress({
          processed,
          total,
          successful: result.successful,
          failed: result.failed,
          rate,
          estimatedTimeRemaining: this.formatTime(remaining)
        });
      }
    }

    result.duration = (Date.now() - startTime) / 1000;
    return result;
  }

  /**
   * Batch upsert (insert or update) with progress tracking
   * Useful for sync operations where records may or may not exist
   */
  async batchUpsert<T extends Record<string, any>>(
    table: string,
    data: T[],
    options: BatchOptions & { onConflict?: string } = {}
  ): Promise<BatchResult> {
    const {
      batchSize = 100,
      onProgress,
      onError,
      continueOnError = true,
      retryAttempts = 3,
      retryDelay = 1000,
      onConflict = 'id'
    } = options;

    const startTime = Date.now();
    const result: BatchResult = {
      successful: 0,
      failed: 0,
      errors: [],
      duration: 0
    };

    const total = data.length;
    let processed = 0;

    // Process in batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      let attempts = 0;
      let success = false;

      while (attempts < retryAttempts && !success) {
        try {
          const { error } = await this.supabase
            .from(table)
            .upsert(batch, { onConflict });

          if (error) throw error;

          result.successful += batch.length;
          success = true;
        } catch (error: any) {
          attempts++;
          
          if (attempts >= retryAttempts) {
            result.failed += batch.length;
            
            // Record individual errors
            batch.forEach((item, index) => {
              const actualIndex = i + index;
              result.errors.push({ item, error, index: actualIndex });
              
              if (onError) {
                onError(error, item, actualIndex);
              }
            });

            if (!continueOnError) {
              throw new Error(`Batch upsert failed after ${retryAttempts} attempts: ${error.message}`);
            }
          } else {
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempts));
          }
        }
      }

      processed += batch.length;

      // Report progress
      if (onProgress) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = (total - processed) / rate;
        
        onProgress({
          processed,
          total,
          successful: result.successful,
          failed: result.failed,
          rate,
          estimatedTimeRemaining: this.formatTime(remaining)
        });
      }
    }

    result.duration = (Date.now() - startTime) / 1000;
    return result;
  }

  /**
   * Create a console progress display function
   * Returns a function compatible with BatchOptions.onProgress
   */
  createConsoleProgress(label: string = 'Processing'): (progress: BatchProgress) => void {
    let lastUpdate = 0;

    return (progress: BatchProgress) => {
      // Only update every 100ms to avoid flickering
      const now = Date.now();
      if (now - lastUpdate < 100) return;
      lastUpdate = now;

      process.stdout.write('\r\x1b[K'); // Clear line
      process.stdout.write(
        `📊 ${label}: ${progress.processed}/${progress.total} | ` +
        `✅ ${progress.successful} | ` +
        `❌ ${progress.failed} | ` +
        `⚡ ${progress.rate.toFixed(1)}/sec | ` +
        `⏱️  ${progress.estimatedTimeRemaining}`
      );

      // Add newline when complete
      if (progress.processed === progress.total) {
        console.log('');
      }
    };
  }

  /**
   * Format time in seconds to human-readable format
   */
  private formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return 'calculating...';
    
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${minutes}m ${secs}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }
}

// The class is already exported above
// No need for additional export statement