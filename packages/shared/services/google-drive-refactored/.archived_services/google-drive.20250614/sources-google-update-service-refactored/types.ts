/**
 * Types for Sources Google Update Service
 */

// Update options
export interface UpdateOptions {
  limit?: number;
  dryRun?: boolean;
  updateFields?: string[];
  verbose?: boolean;
  conflictResolution?: ConflictResolution;
}

// Batch update options
export interface BatchUpdateOptions extends UpdateOptions {
  batchSize?: number;
  onProgress?: (progress: UpdateProgress) => void;
  continueOnError?: boolean;
}

// Update result
export interface UpdateResult {
  records: number;
  updated: number;
  skipped: number;
  errors: Array<{
    fileId: string;
    error: string;
  }>;
  startTime: Date;
  endTime: Date;
}

// Update progress tracking
export interface UpdateProgress {
  current: number;
  total: number;
  updated: number;
  skipped: number;
  errors: number;
}

// Conflict resolution strategies
export type ConflictResolution = 'overwrite' | 'merge' | 'skip';

// Field update strategies
export type FieldUpdateStrategy = 'overwrite' | 'merge' | 'fillEmpty';

// Google Drive file structure (from API)
export interface GoogleDriveApiFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
  webViewLink?: string;
  [key: string]: any;
}

// Sources Google record structure
export interface SourcesGoogleRecord {
  id: string;
  drive_id: string;
  name: string;
  mime_type: string;
  parent_folder_id?: string;
  web_view_link?: string;
  size?: number;
  modified_at?: string;
  metadata?: Record<string, any>;
  is_deleted?: boolean;
  path?: string;
  path_array?: string[];
  path_depth?: number;
  content_extracted?: string;
  created_at: string;
  updated_at: string;
}