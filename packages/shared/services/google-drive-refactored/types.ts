/**
 * Google Drive Service Types
 */

// File types from the sources_google table
export interface GoogleDriveFile {
  id?: string;
  drive_id: string;
  name: string;
  mime_type: string;
  web_view_link: string;
  parent_folder_id: string | null;
  is_root: boolean;
  path: string | null;
  path_array: string[] | null;
  path_depth: number | null;
  last_indexed: string | null;
  metadata: Record<string, any>;
  document_type_id: string | null;
  file_signature: string | null;
  is_deleted: boolean | null;
  main_video_id: string | null;
  modified_at: string | null;
  root_drive_id: string | null;
  size: number | null;
  thumbnail_link: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Root folder definition
export interface RootFolder {
  id: string;
  folder_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  last_synced: string | null;
}

// Options for syncing
export interface SyncOptions {
  recursive?: boolean;
  maxDepth?: number;
  batchSize?: number;
  concurrentRequests?: number;
  includeDeleted?: boolean;
  dryRun?: boolean;
}

// Sync statistics
export interface SyncStats {
  filesFound: number;
  filesInserted: number;
  filesUpdated: number;
  filesSkipped: number;
  filesDeleted: number;
  foldersFound: number;
  errors: unknown[];
  startTime: Date;
  endTime?: Date;
  totalSize: number;
  fileTypes: Record<string, number>;
}

// Progress callback for sync operations
export type ProgressCallback = (progress: {
  current: number;
  total: number;
  percentage: number;
  file?: GoogleDriveFile;
}) => void;

// Service configuration
export interface GoogleDriveServiceConfig {
  authService: any; // GoogleAuthService
  supabaseClient: any; // SupabaseClient
  logger?: any; // Logger
}

// List files options
export interface ListFilesOptions {
  pageSize?: number;
  pageToken?: string;
  fields?: string;
  orderBy?: string;
  q?: string;
}

// List files result
export interface ListFilesResult {
  files: any[];
  nextPageToken?: string;
}

// Common Google Drive MIME types
export const GOOGLE_DRIVE_MIME_TYPES = {
  FOLDER: 'application/vnd.google-apps.folder',
  DOCUMENT: 'application/vnd.google-apps.document',
  SPREADSHEET: 'application/vnd.google-apps.spreadsheet',
  PRESENTATION: 'application/vnd.google-apps.presentation',
  FORM: 'application/vnd.google-apps.form',
  DRAWING: 'application/vnd.google-apps.drawing',
  SCRIPT: 'application/vnd.google-apps.script',
  SITE: 'application/vnd.google-apps.site',
  SHORTCUT: 'application/vnd.google-apps.shortcut',
} as const;

// Export MIME types
export const EXPORT_MIME_TYPES = {
  DOCUMENT: {
    PDF: 'application/pdf',
    DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    RTF: 'application/rtf',
    TXT: 'text/plain',
    HTML: 'text/html',
    EPUB: 'application/epub+zip',
  },
  SPREADSHEET: {
    XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    CSV: 'text/csv',
    PDF: 'application/pdf',
    TSV: 'text/tab-separated-values',
  },
  PRESENTATION: {
    PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    PDF: 'application/pdf',
  },
} as const;