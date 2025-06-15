/**
 * Batch Database Service - Refactored
 * 
 * Optimized batch operations for Supabase with progress tracking and retry logic
 * Refactored to extend SingletonService with proper resource management
 * 
 * @module BatchDatabaseService
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { SingletonService } from '../base-classes/SingletonService';

// Types
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

interface BatchDatabaseServiceConfig {
  defaultBatchSize?: number;
  defaultRetryAttempts?: number;
  defaultRetryDelay?: number;
}

interface BatchDatabaseServiceMetrics {
  totalBatches: number;
  totalOperations: number;
  totalInserts: number;
  totalUpdates: number;
  totalDeletes: number;
  totalUpserts: number;
  totalErrors: number;
  averageRate: number;
  lastOperationTime?: Date;
}

export class BatchDatabaseService extends SingletonService {
  private static instance: BatchDatabaseService;
  private supabase: SupabaseClient;
  private config: Required<BatchDatabaseServiceConfig>;
  private metrics: BatchDatabaseServiceMetrics = {
    totalBatches: 0,
    totalOperations: 0,
    totalInserts: 0,
    totalUpdates: 0,
    totalDeletes: 0,
    totalUpserts: 0,
    totalErrors: 0,
    averageRate: 0
  };
  private activeOperations = new Set<string>();

  protected constructor(
    supabase: SupabaseClient,
    config: BatchDatabaseServiceConfig = {}
  ) {
    super('BatchDatabaseService');
    this.supabase = supabase;
    this.config = {
      defaultBatchSize: config.defaultBatchSize || 100,
      defaultRetryAttempts: config.defaultRetryAttempts || 3,
      defaultRetryDelay: config.defaultRetryDelay || 1000
    };
  }

  public static getInstance(
    supabase: SupabaseClient,
    config?: BatchDatabaseServiceConfig
  ): BatchDatabaseService {
    if (!BatchDatabaseService.instance) {
      BatchDatabaseService.instance = new BatchDatabaseService(supabase, config);
    }
    return BatchDatabaseService.instance;
  }

  // BaseService requirements
  protected async initialize(): Promise<void> {
    this.logger?.info('BatchDatabaseService initializing...');
    
    // Test database connection
    try {
      const { error } = await this.supabase
        .from('sys_shared_services')
        .select('count')
        .limit(1);
      
      if (error) {
        throw new Error(`Database connection test failed: ${error.message}`);
      }
      
      this.logger?.info('BatchDatabaseService initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize BatchDatabaseService:', error);
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger?.info('BatchDatabaseService cleaning up...');
    
    // Wait for active operations to complete
    if (this.activeOperations.size > 0) {
      this.logger?.warn(`Waiting for ${this.activeOperations.size} active operations to complete...`);
      
      // Give operations a chance to complete (max 30 seconds)
      const timeout = 30000;
      const start = Date.now();
      
      while (this.activeOperations.size > 0 && Date.now() - start < timeout) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (this.activeOperations.size > 0) {
        this.logger?.error(`${this.activeOperations.size} operations did not complete within timeout`);
      }
    }
    
    this.logger?.info('BatchDatabaseService cleanup completed');
  }

  // SingletonService requirement
  protected async releaseResources(): Promise<void> {
    // Clear active operations tracking
    this.activeOperations.clear();
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    const startTime = Date.now();
    let healthy = true;
    const details: any = {
      metrics: { ...this.metrics },
      activeOperations: this.activeOperations.size,
      database: 'unknown',
      config: this.config
    };

    try {
      // Test database connection
      const { error } = await this.supabase
        .from('sys_shared_services')
        .select('count')
        .limit(1);

      if (error) {
        healthy = false;
        details.database = `error: ${error.message}`;
      } else {
        details.database = 'connected';
      }

      details.responseTime = `${Date.now() - startTime}ms`;
    } catch (error) {
      healthy = false;
      details.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return {
      healthy,
      details,
      timestamp: new Date()
    };
  }

  // Public API methods

  /**
   * Batch insert with progress tracking
   * Replaces patterns from google_sync, scripts pipelines
   */
  async batchInsert<T extends Record<string, any>>(
    table: string,
    data: T[],
    options: BatchOptions = {}
  ): Promise<BatchResult> {
    const operationId = `insert_${table}_${Date.now()}`;
    this.activeOperations.add(operationId);
    
    try {
      const {
        batchSize = this.config.defaultBatchSize,
        onProgress,
        onError,
        continueOnError = true,
        retryAttempts = this.config.defaultRetryAttempts,
        retryDelay = this.config.defaultRetryDelay
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
      
      this.metrics.totalBatches++;
      this.metrics.totalOperations++;
      this.metrics.totalInserts += total;
      this.metrics.lastOperationTime = new Date();

      this.logger?.info(`Starting batch insert: ${total} items in table ${table}`);

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
            this.logger?.debug(`Inserted batch ${i / batchSize + 1}: ${batch.length} items`);
          } catch (error: any) {
            attempts++;
            
            if (attempts >= retryAttempts) {
              result.failed += batch.length;
              this.metrics.totalErrors += batch.length;
              
              // Record individual errors
              batch.forEach((item, index) => {
                const actualIndex = i + index;
                result.errors.push({ item, error, index: actualIndex });
                
                if (onError) {
                  onError(error, item, actualIndex);
                }
              });

              this.logger?.error(`Batch insert failed after ${retryAttempts} attempts:`, error);

              if (!continueOnError) {
                throw new Error(`Batch insert failed after ${retryAttempts} attempts: ${error.message}`);
              }
            } else {
              this.logger?.warn(`Batch insert attempt ${attempts} failed, retrying...`);
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
      
      // Update metrics
      const rate = total / result.duration;
      this.metrics.averageRate = (this.metrics.averageRate + rate) / 2;

      this.logger?.info(
        `Batch insert completed: ${result.successful} successful, ${result.failed} failed, ${result.duration.toFixed(2)}s`
      );

      return result;
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Batch update with progress tracking
   */
  async batchUpdate<T extends Record<string, any>>(
    table: string,
    updates: Array<{ id: string; data: Partial<T> }>,
    options: BatchOptions = {}
  ): Promise<BatchResult> {
    const operationId = `update_${table}_${Date.now()}`;
    this.activeOperations.add(operationId);
    
    try {
      const {
        batchSize = Math.min(50, this.config.defaultBatchSize), // Smaller batch size for updates
        onProgress,
        onError,
        continueOnError = true,
        retryAttempts = this.config.defaultRetryAttempts,
        retryDelay = this.config.defaultRetryDelay
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
      
      this.metrics.totalBatches++;
      this.metrics.totalOperations++;
      this.metrics.totalUpdates += total;
      this.metrics.lastOperationTime = new Date();

      this.logger?.info(`Starting batch update: ${total} items in table ${table}`);

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
                this.metrics.totalErrors++;
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
      
      // Update metrics
      const rate = total / result.duration;
      this.metrics.averageRate = (this.metrics.averageRate + rate) / 2;

      this.logger?.info(
        `Batch update completed: ${result.successful} successful, ${result.failed} failed, ${result.duration.toFixed(2)}s`
      );

      return result;
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Batch delete with progress tracking
   */
  async batchDelete(
    table: string,
    ids: string[],
    options: BatchOptions = {}
  ): Promise<BatchResult> {
    const operationId = `delete_${table}_${Date.now()}`;
    this.activeOperations.add(operationId);
    
    try {
      const {
        batchSize = this.config.defaultBatchSize,
        onProgress,
        onError,
        continueOnError = true,
        retryAttempts = this.config.defaultRetryAttempts,
        retryDelay = this.config.defaultRetryDelay
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
      
      this.metrics.totalBatches++;
      this.metrics.totalOperations++;
      this.metrics.totalDeletes += total;
      this.metrics.lastOperationTime = new Date();

      this.logger?.info(`Starting batch delete: ${total} items from table ${table}`);

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
            this.logger?.debug(`Deleted batch ${i / batchSize + 1}: ${batch.length} items`);
          } catch (error: any) {
            attempts++;
            
            if (attempts >= retryAttempts) {
              result.failed += batch.length;
              this.metrics.totalErrors += batch.length;
              
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

              this.logger?.error(`Batch delete failed after ${retryAttempts} attempts:`, error);

              if (!continueOnError) {
                throw new Error(`Batch delete failed after ${retryAttempts} attempts: ${error.message}`);
              }
            } else {
              this.logger?.warn(`Batch delete attempt ${attempts} failed, retrying...`);
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
      
      // Update metrics
      const rate = total / result.duration;
      this.metrics.averageRate = (this.metrics.averageRate + rate) / 2;

      this.logger?.info(
        `Batch delete completed: ${result.successful} successful, ${result.failed} failed, ${result.duration.toFixed(2)}s`
      );

      return result;
    } finally {
      this.activeOperations.delete(operationId);
    }
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
    const operationId = `upsert_${table}_${Date.now()}`;
    this.activeOperations.add(operationId);
    
    try {
      const {
        batchSize = this.config.defaultBatchSize,
        onProgress,
        onError,
        continueOnError = true,
        retryAttempts = this.config.defaultRetryAttempts,
        retryDelay = this.config.defaultRetryDelay,
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
      
      this.metrics.totalBatches++;
      this.metrics.totalOperations++;
      this.metrics.totalUpserts += total;
      this.metrics.lastOperationTime = new Date();

      this.logger?.info(`Starting batch upsert: ${total} items in table ${table} (conflict: ${onConflict})`);

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
            this.logger?.debug(`Upserted batch ${i / batchSize + 1}: ${batch.length} items`);
          } catch (error: any) {
            attempts++;
            
            if (attempts >= retryAttempts) {
              result.failed += batch.length;
              this.metrics.totalErrors += batch.length;
              
              // Record individual errors
              batch.forEach((item, index) => {
                const actualIndex = i + index;
                result.errors.push({ item, error, index: actualIndex });
                
                if (onError) {
                  onError(error, item, actualIndex);
                }
              });

              this.logger?.error(`Batch upsert failed after ${retryAttempts} attempts:`, error);

              if (!continueOnError) {
                throw new Error(`Batch upsert failed after ${retryAttempts} attempts: ${error.message}`);
              }
            } else {
              this.logger?.warn(`Batch upsert attempt ${attempts} failed, retrying...`);
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
      
      // Update metrics
      const rate = total / result.duration;
      this.metrics.averageRate = (this.metrics.averageRate + rate) / 2;

      this.logger?.info(
        `Batch upsert completed: ${result.successful} successful, ${result.failed} failed, ${result.duration.toFixed(2)}s`
      );

      return result;
    } finally {
      this.activeOperations.delete(operationId);
    }
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
   * Get service metrics
   */
  getMetrics(): BatchDatabaseServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalBatches: 0,
      totalOperations: 0,
      totalInserts: 0,
      totalUpdates: 0,
      totalDeletes: 0,
      totalUpserts: 0,
      totalErrors: 0,
      averageRate: 0
    };
    this.logger?.info('BatchDatabaseService metrics reset');
  }

  /**
   * Get active operation count
   */
  getActiveOperationCount(): number {
    return this.activeOperations.size;
  }

  // Private methods

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

export default BatchDatabaseService;