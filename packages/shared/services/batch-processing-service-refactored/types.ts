/**
 * Types for Batch Processing Service
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