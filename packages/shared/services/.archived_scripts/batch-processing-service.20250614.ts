/**
 * Shared service for batch processing operations
 * Used by both UI components and CLI tools
 */

// Batch status
export enum BatchStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused',
}

// Batch item status
export enum BatchItemStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

// Batch definition
export interface Batch {
  id: string;
  name: string;
  description?: string;
  status: BatchStatus;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  total_items: number;
  processed_items: number;
  failed_items: number;
  skipped_items: number;
  progress_percentage: number;
  user_id?: string;
  metadata?: Record<string, any>;
  error?: string;
}

// Batch item definition
export interface BatchItem {
  id: string;
  batch_id: string;
  item_id: string;
  status: BatchItemStatus;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  metadata?: Record<string, any>;
  error?: string;
  result?: Record<string, any>;
}

// Batch creation options
export interface BatchOptions {
  name: string;
  description?: string;
  user_id?: string;
  metadata?: Record<string, any>;
  concurrency?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

// Item processor function
export type ItemProcessor<T, R> = (item: T, index: number, batchId: string) => Promise<R>;

// Progress callback
export type ProgressCallback = (
  progress: {
    batchId: string;
    current: number;
    total: number;
    percentage: number;
    completed: number;
    failed: number;
    skipped: number;
  }
) => void;

/**
 * Shared Batch Processing Service
 * Can be used by both UI and CLI
 */
export class BatchProcessingService {
  private static instance: BatchProcessingService;
  private supabaseClient: any; // Will be the Supabase client
  private activeProcesses: Map<string, { cancel: () => void }> = new Map();

  private constructor(supabaseClient: any) {
    this.supabaseClient = supabaseClient;
  }

  /**
   * Get singleton instance
   * @param supabaseClient Supabase client
   */
  public static getInstance(supabaseClient: any): BatchProcessingService {
    if (!BatchProcessingService.instance) {
      BatchProcessingService.instance = new BatchProcessingService(supabaseClient);
    }
    return BatchProcessingService.instance;
  }

  /**
   * Create a new batch
   * @param options Batch options
   */
  public async createBatch(options: BatchOptions): Promise<Batch | null> {
    try {
      // This would involve creating a record in Supabase
      console.log(`Creating batch: ${options.name}`);
      
      // Mock batch
      const batch: Batch = {
        id: `batch_${Date.now()}`,
        name: options.name,
        description: options.description,
        status: BatchStatus.QUEUED,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_items: 0,
        processed_items: 0,
        failed_items: 0,
        skipped_items: 0,
        progress_percentage: 0,
        user_id: options.user_id,
        metadata: options.metadata,
      };
      
      return batch;
    } catch (error) {
      console.error('Failed to create batch:', error);
      return null;
    }
  }

  /**
   * Get batch by ID
   * @param batchId Batch ID
   */
  public async getBatch(batchId: string): Promise<Batch | null> {
    try {
      // This would involve querying Supabase
      console.log(`Getting batch ${batchId}`);
      return null;
    } catch (error) {
      console.error('Failed to get batch:', error);
      return null;
    }
  }

  /**
   * Update batch status
   * @param batchId Batch ID
   * @param status New status
   * @param metadata Optional metadata
   */
  public async updateBatchStatus(
    batchId: string,
    status: BatchStatus,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      // This would involve updating a record in Supabase
      console.log(`Updating batch ${batchId} status to ${status}`);
      return true;
    } catch (error) {
      console.error('Failed to update batch status:', error);
      return false;
    }
  }

  /**
   * Add items to a batch
   * @param batchId Batch ID
   * @param items Items to add
   */
  public async addBatchItems<T>(
    batchId: string,
    items: T[]
  ): Promise<{ success: boolean; count: number }> {
    try {
      // This would involve creating records in Supabase
      console.log(`Adding ${items.length} items to batch ${batchId}`);
      
      // Also update the batch's total items
      
      return { success: true, count: items.length };
    } catch (error) {
      console.error('Failed to add batch items:', error);
      return { success: false, count: 0 };
    }
  }

  /**
   * Process a batch of items
   * @param batchId Batch ID
   * @param processor Item processor function
   * @param options Processing options
   * @param onProgress Progress callback
   */
  public async processBatch<T, R>(
    batchId: string,
    processor: ItemProcessor<T, R>,
    options: {
      concurrency?: number;
      retryAttempts?: number;
      retryDelay?: number;
      timeout?: number;
    } = {},
    onProgress?: ProgressCallback
  ): Promise<{
    success: boolean;
    completed: number;
    failed: number;
    skipped: number;
    total: number;
    errors: Error[];
  }> {
    const { concurrency = 5, retryAttempts = 3, retryDelay = 1000, timeout = 30000 } = options;
    
    try {
      // Get batch
      const batch = await this.getBatch(batchId);
      if (!batch) {
        throw new Error(`Batch ${batchId} not found`);
      }
      
      // Update batch status
      await this.updateBatchStatus(batchId, BatchStatus.RUNNING);
      
      // Get batch items
      // This would involve querying Supabase
      console.log(`Processing batch ${batchId}`);
      
      // Mock items for now
      const items: BatchItem[] = [];
      
      // Set up cancel handler
      let isCancelled = false;
      const cancelHandler = { cancel: () => { isCancelled = true; } };
      this.activeProcesses.set(batchId, cancelHandler);
      
      // Track results
      const result = {
        success: true,
        completed: 0,
        failed: 0,
        skipped: 0,
        total: items.length,
        errors: [] as Error[],
      };
      
      // Process items
      // This would involve processing items in batches with concurrency
      
      // Clean up
      this.activeProcesses.delete(batchId);
      
      // Update batch status
      await this.updateBatchStatus(
        batchId,
        isCancelled ? BatchStatus.CANCELLED : BatchStatus.COMPLETED
      );
      
      return result;
    } catch (error) {
      console.error('Failed to process batch:', error);
      
      // Update batch status
      await this.updateBatchStatus(batchId, BatchStatus.FAILED, {
        error: (error as Error).message,
      });
      
      // Clean up
      this.activeProcesses.delete(batchId);
      
      return {
        success: false,
        completed: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        errors: [error as Error],
      };
    }
  }

  /**
   * Cancel a batch
   * @param batchId Batch ID
   */
  public async cancelBatch(batchId: string): Promise<boolean> {
    const process = this.activeProcesses.get(batchId);
    if (process) {
      process.cancel();
      this.activeProcesses.delete(batchId);
      
      // Update batch status
      await this.updateBatchStatus(batchId, BatchStatus.CANCELLED);
      
      return true;
    }
    
    return false;
  }

  /**
   * Get batches with filters
   * @param filters Optional filters
   * @param limit Optional limit
   * @param offset Optional offset
   */
  public async getBatches(
    filters?: Partial<{ status: BatchStatus; user_id: string }>,
    limit?: number,
    offset?: number
  ): Promise<Batch[]> {
    try {
      // This would involve querying Supabase
      console.log(`Getting batches with filters:`, filters);
      return [];
    } catch (error) {
      console.error('Failed to get batches:', error);
      return [];
    }
  }

  /**
   * Get batch items with filters
   * @param batchId Batch ID
   * @param filters Optional filters
   * @param limit Optional limit
   * @param offset Optional offset
   */
  public async getBatchItems(
    batchId: string,
    filters?: Partial<{ status: BatchItemStatus }>,
    limit?: number,
    offset?: number
  ): Promise<BatchItem[]> {
    try {
      // This would involve querying Supabase
      console.log(`Getting batch ${batchId} items with filters:`, filters);
      return [];
    } catch (error) {
      console.error('Failed to get batch items:', error);
      return [];
    }
  }
}

export default BatchProcessingService;