/**
 * Types for Google Drive Explorer Service
 */

export interface FileNode {
  id: string;
  name: string;
  mime_type: string;
  path: string | null;
  parent_path: string | null;
  parent_folder_id: string | null;
  drive_id: string | null;
  is_root: boolean | null;
  content_extracted: string | null;
  web_view_link: string | null;
  metadata: any;
  expertDocument?: any;
  path_depth?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FileTreeStats {
  totalFiles: number;
  rootFolders: number;
  filesOnly: number;
  folders: number;
  orphanedFiles: number;
  filesWithContent: number;
}

export interface SearchOptions {
  searchContent?: boolean;
  searchNames?: boolean;
  mimeTypes?: string[];
  parentFolderId?: string;
  limit?: number;
}

export interface SearchResult {
  file: FileNode;
  relevance: number;
  matchedIn: string[];
}

export interface TreeBuildOptions {
  rootFolderId?: string;
  maxDepth?: number;
  includeOrphans?: boolean;
}

export interface FileTree extends FileNode {
  children?: FileTree[];
  orphans?: FileNode[];
}

// Common Google Drive MIME types
export const GoogleDriveMimeTypes = {
  FOLDER: 'application/vnd.google-apps.folder',
  DOCUMENT: 'application/vnd.google-apps.document',
  SPREADSHEET: 'application/vnd.google-apps.spreadsheet',
  PRESENTATION: 'application/vnd.google-apps.presentation',
  FORM: 'application/vnd.google-apps.form',
  DRAWING: 'application/vnd.google-apps.drawing',
  VIDEO: 'application/vnd.google-apps.video',
  AUDIO: 'application/vnd.google-apps.audio',
  PHOTO: 'application/vnd.google-apps.photo',
  PDF: 'application/pdf',
  TEXT: 'text/plain',
  HTML: 'text/html',
  CSV: 'text/csv',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  MP4: 'video/mp4',
  MP3: 'audio/mpeg'
} as const;

export type GoogleDriveMimeType = typeof GoogleDriveMimeTypes[keyof typeof GoogleDriveMimeTypes];