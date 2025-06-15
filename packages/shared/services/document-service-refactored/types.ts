/**
 * Document Service Types
 */

export interface DocumentFile {
  id: string;
  file_path: string;
  title: string;
  language?: string;
  document_type_id?: string | null;
  created_at: string;
  updated_at: string;
  metadata?: any;
  document_type?: DocumentType | null;
}

export interface DocumentType {
  id: string;
  name: string;
  description?: string;
}

export interface DocumentServiceConfig {
  defaultLimit?: number;
}

export interface DocumentServiceMetrics {
  totalQueries: number;
  totalUpdates: number;
  errorCount: number;
  lastQueryTime?: Date;
  lastUpdateTime?: Date;
}