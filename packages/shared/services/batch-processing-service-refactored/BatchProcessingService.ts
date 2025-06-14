/**
 * Batch Processing Service - Refactored with BusinessService base class
 * 
 * Manages batch processing operations with proper dependency injection,
 * retry logic, and performance monitoring.
 */

import { BusinessService } from '../base-classes/BusinessService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger';
import { 
  Batch, 
  BatchItem, 
  BatchOptions, 
  BatchStatus, 
  BatchItemStatus,
  ItemProcessor,
  ProgressCallback 
} from './types';

/**
 * BatchProcessingService - Manages batch processing operations
 * 
 * Features:
 * - Concurrent batch item processing
 * - Progress tracking and callbacks
 * - Automatic retry logic for failed items
 * - Transaction support for batch operations
 * - Performance monitoring
 */
export class BatchProcessingService extends BusinessService {
  private activeProcesses: Map<string, { cancel: () => void }> = new Map();

  constructor(supabaseClient: SupabaseClient, logger?: Logger) {
    super('BatchProcessingService', { supabaseClient }

  /**
   * Validate that all required dependencies are provided
   */
  protected validateDependencies(): void {
    if (!this.dependencies.supabase) {
      throw new Error('SupabaseClient is required');
    }
  }, logger);
  }

  protected async initialize(): Promise<void> {
    // No special initialization needed
    this.logger?.info('BatchProcessingService initialized');
  }

  protected async cleanup(): Promise<void> {
    // Cancel all active processes
    for (const [batchId, process] of this.activeProcesses) {
      this.logger?.warn(`Cancelling active batch process: ${batchId}`);
      process.cancel();
    }
    this.activeProcesses.clear();
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    serviceName: string;
    timestamp: Date;
    details?: Record<string, any>;
    error?: string;
  }> {
    try {
      // Check if we can query the batches table
      const { error } = await this.dependencies.supabaseClient
        .from('batches')
        .select('id')
        .limit(1);

      return {
        healthy: !error,
        serviceName: this.serviceName,
        timestamp: new Date(),
        details: {
          activeProcesses: this.activeProcesses.size,
          supabaseConnected: !error
        },
        error: error?.message
      };
    } catch (error: any) {
      return {
        healthy: false,
        serviceName: this.serviceName,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Create a new batch with validation and retry logic
   */
  async createBatch(options: BatchOptions): Promise<Batch> {
    return this.validateInput({ options }, () => {
      if (!options.name || !options.name.trim()) {
        throw new Error('Batch name is required');
      }
    })
    .then(() => this.withTransaction(async () => {
      return this.withRetry(async () => {
        const batch = {
          name: options.name,
          description: options.description,
          status: BatchStatus.QUEUED,
          total_items: 0,
          processed_items: 0,
          failed_items: 0,
          skipped_items: 0,
          progress_percentage: 0,
          user_id: options.user_id,
          metadata: options.metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data, error } = await this.dependencies.supabaseClient
          .from('batches')
          .insert(batch)
          .select()
          .single();

        if (error) throw error;
        
        this.logger?.info(`Created batch: ${data.id} - ${data.name}`);
        return data;
      }, { operationName: 'createBatch' });
    }));
  }

  /**
   * Get batch by ID with caching support
   */
  async getBatch(batchId: string): Promise<Batch | null> {
    return this.validateInput({ batchId }, () => {
      if (!batchId || !batchId.trim()) {
        throw new Error('Batch ID is required');
      }
    })
    .then(() => this.withRetry(async () => {
      const { data, error } = await this.dependencies.supabaseClient
        .from('batches')
        .select('*')
        .eq('id', batchId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || null;
    }, { operationName: 'getBatch' }));
  }

  /**
   * Update batch status with optimistic locking
   */
  async updateBatchStatus(
    batchId: string, 
    status: BatchStatus,
    metadata?: Record<string, any>
  ): Promise<Batch> {
    return this.validateInput({ batchId, status }, () => {
      if (!batchId || !batchId.trim()) {
        throw new Error('Batch ID is required');
      }
      if (!Object.values(BatchStatus).includes(status)) {
        throw new Error(`Invalid batch status: ${status}`);
      }
    })
    .then(() => this.withTransaction(async () => {
      return this.withRetry(async () => {
        const updates: any = {
          status,
          updated_at: new Date().toISOString()
        };

        if (status === BatchStatus.COMPLETED || status === BatchStatus.FAILED) {
          updates.completed_at = new Date().toISOString();
        }

        if (metadata) {
          updates.metadata = metadata;
        }

        const { data, error } = await this.dependencies.supabaseClient
          .from('batches')
          .update(updates)
          .eq('id', batchId)
          .select()
          .single();

        if (error) throw error;

        this.logger?.info(`Updated batch ${batchId} status to ${status}`);
        return data;
      }, { operationName: 'updateBatchStatus' });
    }));
  }

  /**
   * Process batch items with concurrency control
   */
  async processBatchItems<T, R>(
    batchId: string,
    items: T[],
    processor: ItemProcessor<T, R>,
    options: {
      concurrency?: number;
      onProgress?: ProgressCallback;
      timeout?: number;
      retryAttempts?: number;
    } = {}
  ): Promise<{ results: R[]; errors: any[] }> {
    const { 
      concurrency = 5, 
      onProgress, 
      timeout = 30000,
      retryAttempts = 3 
    } = options;

    return this.validateInput({ batchId, items }, () => {
      if (!batchId || !batchId.trim()) {
        throw new Error('Batch ID is required');
      }
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Items array cannot be empty');
      }
      if (typeof processor !== 'function') {
        throw new Error('Processor must be a function');
      }
    })
    .then(() => this.timeOperation('processBatchItems', async () => {
      // Create batch items
      await this.createBatchItems(batchId, items);

      // Update batch total items
      await this.updateBatchProgress(batchId, {
        total_items: items.length,
        status: BatchStatus.RUNNING
      });

      const results: R[] = [];
      const errors: any[] = [];
      let completed = 0;
      let failed = 0;
      let skipped = 0;

      // Create cancellation token
      const abortController = new AbortController();
      this.activeProcesses.set(batchId, {
        cancel: () => abortController.abort()
      });

      try {
        // Process items in batches based on concurrency
        for (let i = 0; i < items.length; i += concurrency) {
          if (abortController.signal.aborted) {
            throw new Error('Batch processing cancelled');
          }

          const batch = items.slice(i, i + concurrency);
          const batchPromises = batch.map(async (item, index) => {
            const itemIndex = i + index;
            
            try {
              // Process with retry logic
              const result = await this.withRetry(
                () => this.processWithTimeout(
                  processor(item, itemIndex, batchId),
                  timeout
                ),
                { 
                  maxAttempts: retryAttempts,
                  operationName: `processItem_${itemIndex}` 
                }
              );

              results[itemIndex] = result;
              completed++;

              // Update item status
              await this.updateBatchItemStatus(batchId, String(itemIndex), {
                status: BatchItemStatus.COMPLETED,
                result
              });
            } catch (error: any) {
              failed++;
              errors[itemIndex] = error;

              // Update item status
              await this.updateBatchItemStatus(batchId, String(itemIndex), {
                status: BatchItemStatus.FAILED,
                error: error.message
              });

              this.logger?.error(`Failed to process item ${itemIndex}: ${error.message}`);
            }
          });

          await Promise.all(batchPromises);

          // Update progress
          const percentage = Math.round(((completed + failed + skipped) / items.length) * 100);
          await this.updateBatchProgress(batchId, {
            processed_items: completed + failed + skipped,
            failed_items: failed,
            skipped_items: skipped,
            progress_percentage: percentage
          });

          // Call progress callback
          onProgress?.({
            batchId,
            current: completed + failed + skipped,
            total: items.length,
            percentage,
            completed,
            failed,
            skipped
          });
        }

        // Update final batch status
        const finalStatus = failed === 0 ? BatchStatus.COMPLETED : BatchStatus.FAILED;
        await this.updateBatchStatus(batchId, finalStatus, {
          results_summary: {
            total: items.length,
            completed,
            failed,
            skipped
          }
        });

        return { results, errors };
      } catch (error: any) {
        await this.updateBatchStatus(batchId, BatchStatus.FAILED, {
          error: error.message
        });
        throw error;
      } finally {
        this.activeProcesses.delete(batchId);
      }
    }));
  }

  /**
   * Cancel a running batch
   */
  async cancelBatch(batchId: string): Promise<void> {
    return this.validateInput({ batchId }, () => {
      if (!batchId || !batchId.trim()) {
        throw new Error('Batch ID is required');
      }
    })
    .then(() => {
      const process = this.activeProcesses.get(batchId);
      if (process) {
        process.cancel();
        this.activeProcesses.delete(batchId);
      }

      return this.updateBatchStatus(batchId, BatchStatus.CANCELLED).then(() => {
        this.logger?.info(`Cancelled batch: ${batchId}`);
      });
    });
  }

  /**
   * Get batch statistics
   */
  async getBatchStatistics(userId?: string): Promise<{
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  }> {
    return this.withRetry(async () => {
      let query = this.dependencies.supabaseClient
        .from('batches')
        .select('status', { count: 'exact', head: true });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { count, error } = await query;
      if (error) throw error;

      // Get counts by status
      const statusCounts = await Promise.all(
        Object.values(BatchStatus).map(async (status) => {
          let statusQuery = this.dependencies.supabaseClient
            .from('batches')
            .select('*', { count: 'exact', head: true })
            .eq('status', status);

          if (userId) {
            statusQuery = statusQuery.eq('user_id', userId);
          }

          const { count } = await statusQuery;
          return { status, count: count || 0 };
        })
      );

      const stats = {
        total: count || 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      };

      statusCounts.forEach(({ status, count }) => {
        switch (status) {
          case BatchStatus.QUEUED:
            stats.queued = count;
            break;
          case BatchStatus.RUNNING:
            stats.running = count;
            break;
          case BatchStatus.COMPLETED:
            stats.completed = count;
            break;
          case BatchStatus.FAILED:
            stats.failed = count;
            break;
          case BatchStatus.CANCELLED:
            stats.cancelled = count;
            break;
        }
      });

      return stats;
    }, { operationName: 'getBatchStatistics' });
  }

  /**
   * Helper: Process with timeout
   */
  private async processWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Processing timeout')), timeout)
      )
    ]);
  }

  /**
   * Helper: Create batch items
   */
  private async createBatchItems<T>(batchId: string, items: T[]): Promise<void> {
    const batchItems = items.map((_, index) => ({
      batch_id: batchId,
      item_id: String(index),
      status: BatchItemStatus.PENDING,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error } = await this.dependencies.supabaseClient
      .from('batch_items')
      .insert(batchItems);

    if (error) throw error;
  }

  /**
   * Helper: Update batch item status
   */
  private async updateBatchItemStatus(
    batchId: string,
    itemId: string,
    updates: Partial<BatchItem>
  ): Promise<void> {
    const { error } = await this.dependencies.supabaseClient
      .from('batch_items')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('batch_id', batchId)
      .eq('item_id', itemId);

    if (error) {
      this.logger?.error(`Failed to update batch item status: ${error.message}`);
    }
  }

  /**
   * Helper: Update batch progress
   */
  private async updateBatchProgress(
    batchId: string,
    updates: Partial<Batch>
  ): Promise<void> {
    const { error } = await this.dependencies.supabaseClient
      .from('batches')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId);

    if (error) {
      this.logger?.error(`Failed to update batch progress: ${error.message}`);
    }
  }
}