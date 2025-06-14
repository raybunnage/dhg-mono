/**
 * Type definitions for FileService
 */

export interface FileResult {
  success: boolean;
  content?: string;
  error?: string;
  path: string;
  stats?: {
    size: number;
    modified: Date;
    lines: number;
  };
}

// Google Drive specific interfaces
export interface GoogleDriveItem {
  id: string;                          // Supabase UUID
  drive_id: string;                    // Google Drive ID
  name: string | null;
  path_depth: number | null;
  document_type_id: string | null;
  parent_folder_id: string | null;     // Parent's Google Drive ID
  main_video_id: string | null;
  mime_type: string | null;
}

export interface FolderTraversalResult {
  folders: GoogleDriveItem[];
  files: GoogleDriveItem[];
  totalItems: number;
}

export interface RecursiveTraversalOptions {
  includeFiles?: boolean;
  includeFolders?: boolean;
  maxDepth?: number;
  onItemProcessed?: (item: GoogleDriveItem, depth: number) => void;
}