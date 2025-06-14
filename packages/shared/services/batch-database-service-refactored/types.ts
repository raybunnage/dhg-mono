/**
 * Batch Database Service Types
 */

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

export interface BatchDatabaseServiceConfig {
  defaultBatchSize?: number;
  defaultRetryAttempts?: number;
  defaultRetryDelay?: number;
}

export interface BatchDatabaseServiceMetrics {
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