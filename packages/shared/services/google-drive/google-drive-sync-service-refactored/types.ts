/**
 * Types for Google Drive Sync Service
 */

// Sync options
export interface SyncOptions {
  recursive?: boolean;
  maxDepth?: number;
  batchSize?: number;
  concurrentRequests?: number;
  includeDeleted?: boolean;
  dryRun?: boolean;
  conflictStrategy?: ConflictStrategy;
  onProgress?: (progress: SyncProgress) => void;
}

// Sync statistics
export interface SyncStats {
  filesFound: number;
  filesInserted: number;
  filesUpdated: number;
  filesSkipped: number;
  filesDeleted: number;
  foldersFound: number;
  errors: any[];
  startTime: Date;
  endTime?: Date;
  totalSize: number;
  fileTypes: Record<string, number>;
}

// Sync result
export interface SyncResult {
  stats: SyncStats;
  files: any[];
  errors: any[];
}

// Sync progress
export interface SyncProgress {
  current: number;
  total: number;
  currentFolder: string;
  depth: number;
}

// Path resolution options
export interface PathResolutionOptions {
  includeRoot?: boolean;
  separator?: string;
  maxPathLength?: number;
}

// Batch options
export interface BatchOptions {
  batchSize?: number;
  concurrentBatches?: number;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
}

// Cleanup options
export interface CleanupOptions {
  dryRun?: boolean;
  batchSize?: number;
  forceDelete?: boolean;
  markAsDeleted?: boolean;
  permanentDelete?: boolean;
}

// Cleanup result
export interface CleanupResult {
  foldersCleaned: number;
  filesDeleted: number;
  filesMarkedAsDeleted: number;
  filesSkipped: number;
  errors: any[];
  startTime: Date;
  endTime: Date;
}

// Conflict resolution strategies
export type ConflictStrategy = 'skip' | 'overwrite' | 'merge' | 'newer';

// File change detection
export interface FileChange {
  fileId: string;
  changeType: 'added' | 'modified' | 'deleted';
  file?: any;
  previousVersion?: any;
}

// Sync state for resumption
export interface SyncState {
  currentFolder: string;
  processedFiles: Set<string>;
  depth: number;
  stats: Partial<SyncStats>;
}

// Sync history record
export interface SyncHistoryRecord {
  id: string;
  root_folder_id: string;
  started_at: string;
  ended_at?: string;
  status: 'running' | 'completed' | 'completed_with_errors' | 'failed';
  files_found: number;
  files_inserted: number;
  files_updated: number;
  files_deleted: number;
  files_skipped: number;
  errors?: any[];
  total_size_bytes?: number;
  options?: SyncOptions;
}