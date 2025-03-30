/**
 * Shared service for Google Drive operations
 * Used by both UI components and CLI tools
 */

import GoogleAuthService, { GoogleAuthToken } from './google-auth-service';

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
  last_indexed: string | null;
  metadata: Record<string, any>;
  expert_id: string | null;
  sync_status: string | null;
  sync_error: string | null;
  document_type_id: string | null;
  content_extracted: boolean;
  extraction_error: string | null;
  extracted_content: string | null;
  deleted: boolean;
  parent_path: string | null;
  size_bytes: number | null;
  thumbnail_link: string | null;
  audio_duration_seconds: number | null;
  audio_extracted: boolean;
  audio_extraction_path: string | null;
  audio_channels: number | null;
  audio_bitrate: number | null;
  audio_quality_metrics: Record<string, any> | null;
  sync_id: string | null;
  parent_id: string | null;
  modified_time: string | null;
  size: number | null;
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
  errors: unknown[]; // Changed from Error[] to unknown[] to fix type errors
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

/**
 * Shared Google Drive Service
 * Can be used by both UI and CLI
 */
export class GoogleDriveService {
  private static instance: GoogleDriveService;
  private authService: GoogleAuthService;
  private apiBaseUrl = 'https://www.googleapis.com/drive/v3';
  private supabaseClient: any; // Will be the Supabase client

  private constructor(authService: GoogleAuthService, supabaseClient: any) {
    this.authService = authService;
    this.supabaseClient = supabaseClient;
  }

  /**
   * Get singleton instance
   * @param authService Authentication service
   * @param supabaseClient Supabase client
   */
  public static getInstance(
    authService: GoogleAuthService,
    supabaseClient: any
  ): GoogleDriveService {
    if (!GoogleDriveService.instance) {
      GoogleDriveService.instance = new GoogleDriveService(authService, supabaseClient);
    }
    return GoogleDriveService.instance;
  }

  /**
   * Make authenticated request to Google Drive API
   * @param endpoint API endpoint
   * @param options Fetch options
   */
  private async fetchWithAuth(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const accessToken = await this.authService.getAccessToken();
    if (!accessToken) {
      throw new Error('No valid access token available');
    }

    const url = `${this.apiBaseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Drive API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  /**
   * List files in a folder
   * @param folderId Folder ID
   * @param options Options for listing
   */
  public async listFiles(
    folderId: string,
    options: {
      pageSize?: number;
      pageToken?: string;
      fields?: string;
      orderBy?: string;
      q?: string;
    } = {}
  ): Promise<{
    files: any[];
    nextPageToken?: string;
  }> {
    const params = new URLSearchParams({
      pageSize: (options.pageSize || 100).toString(),
      fields: options.fields || 'nextPageToken, files(id, name, mimeType, webViewLink, parents, modifiedTime, size, thumbnailLink)',
      orderBy: options.orderBy || 'name',
      q: options.q || `'${folderId}' in parents and trashed = false`,
    });

    if (options.pageToken) {
      params.append('pageToken', options.pageToken);
    }

    const result = await this.fetchWithAuth(`/files?${params.toString()}`);
    return result;
  }

  /**
   * Get file metadata
   * @param fileId File ID
   * @param fields Fields to retrieve
   */
  public async getFile(
    fileId: string,
    fields = 'id, name, mimeType, webViewLink, parents, modifiedTime, size, thumbnailLink'
  ): Promise<any> {
    const params = new URLSearchParams({
      fields,
    });

    return this.fetchWithAuth(`/files/${fileId}?${params.toString()}`);
  }

  /**
   * Get file content
   * @param fileId File ID
   * @param mimeType Optional mime type for export
   */
  public async getFileContent(fileId: string, mimeType?: string): Promise<any> {
    // This is a stub - implementations will handle various file types differently
    console.log(`Getting file content for ${fileId}`);
    return { content: 'File content would be here' };
  }

  /**
   * Get root folders
   */
  public async getRootFolders(): Promise<RootFolder[]> {
    try {
      // This should be implemented by the specific clients using Supabase
      console.log('Getting root folders from database');
      return [];
    } catch (error) {
      console.error('Failed to get root folders:', error);
      return [];
    }
  }

  /**
   * Add root folder
   * @param folderId Folder ID
   * @param name Optional custom name
   */
  public async addRootFolder(folderId: string, name?: string): Promise<RootFolder | null> {
    try {
      if (!name) {
        // Get folder details from Google Drive
        const folder = await this.getFile(folderId);
        name = folder.name;
      }

      // This should be implemented by the specific clients using Supabase
      console.log(`Adding root folder ${folderId} with name ${name}`);
      return null;
    } catch (error) {
      console.error('Failed to add root folder:', error);
      return null;
    }
  }

  /**
   * Remove root folder
   * @param id Root folder ID
   */
  public async removeRootFolder(id: string): Promise<boolean> {
    try {
      // This should be implemented by the specific clients using Supabase
      console.log(`Removing root folder ${id}`);
      return true;
    } catch (error) {
      console.error('Failed to remove root folder:', error);
      return false;
    }
  }

  /**
   * Sync folder with Google Drive
   * @param folderId Folder ID
   * @param options Sync options
   * @param onProgress Progress callback
   */
  public async syncFolder(
    folderId: string,
    options: SyncOptions = {},
    onProgress?: ProgressCallback
  ): Promise<SyncStats> {
    const stats: SyncStats = {
      filesFound: 0,
      filesInserted: 0,
      filesUpdated: 0,
      filesSkipped: 0,
      filesDeleted: 0,
      foldersFound: 0,
      errors: [],
      startTime: new Date(),
      totalSize: 0,
      fileTypes: {},
    };

    try {
      // Get folder details
      const folder = await this.getFile(folderId);
      
      // This is where the recursive sync would happen
      // For now, just list files in the folder
      const result = await this.listFiles(folderId);
      stats.filesFound = result.files.length;
      
      // Process files
      // This would involve inserting or updating records in Supabase
      console.log(`Found ${result.files.length} files in folder ${folder.name}`);
      
      // Update stats
      stats.endTime = new Date();
      return stats;
    } catch (error) {
      console.error('Sync error:', error);
      stats.errors.push(error as Error);
      stats.endTime = new Date();
      return stats;
    }
  }

  /**
   * Sync all root folders
   * @param options Sync options
   * @param onProgress Progress callback
   */
  public async syncRootFolders(
    options: SyncOptions = {},
    onProgress?: ProgressCallback
  ): Promise<SyncStats> {
    const stats: SyncStats = {
      filesFound: 0,
      filesInserted: 0,
      filesUpdated: 0,
      filesSkipped: 0,
      filesDeleted: 0,
      foldersFound: 0,
      errors: [],
      startTime: new Date(),
      totalSize: 0,
      fileTypes: {},
    };

    try {
      // Get all root folders
      const rootFolders = await this.getRootFolders();
      stats.foldersFound = rootFolders.length;
      
      console.log(`Found ${rootFolders.length} root folders`);
      
      // For each root folder, sync it
      for (const rootFolder of rootFolders) {
        try {
          console.log(`Syncing root folder ${rootFolder.name}`);
          const folderStats = await this.syncFolder(rootFolder.folder_id, options);
          
          // Merge stats
          stats.filesFound += folderStats.filesFound;
          stats.filesInserted += folderStats.filesInserted;
          stats.filesUpdated += folderStats.filesUpdated;
          stats.filesSkipped += folderStats.filesSkipped;
          stats.filesDeleted += folderStats.filesDeleted;
          stats.foldersFound += folderStats.foldersFound;
          stats.totalSize += folderStats.totalSize;
          
          // Merge file types
          Object.entries(folderStats.fileTypes).forEach(([type, count]) => {
            stats.fileTypes[type] = (stats.fileTypes[type] || 0) + count;
          });
          
          // Merge errors
          stats.errors.push(...folderStats.errors);
        } catch (error) {
          console.error(`Error syncing root folder ${rootFolder.name}:`, error);
          stats.errors.push(error as Error);
        }
      }
      
      stats.endTime = new Date();
      return stats;
    } catch (error) {
      console.error('Root folder sync error:', error);
      stats.errors.push(error as Error);
      stats.endTime = new Date();
      return stats;
    }
  }

  /**
   * Fix missing parent paths
   * @param dryRun Only show what would be fixed
   */
  public async fixParentPaths(dryRun = false): Promise<{ fixed: number; errors: Error[] }> {
    try {
      // This would involve querying the database and updating records
      console.log(`Fixing parent paths (dry run: ${dryRun})`);
      return { fixed: 0, errors: [] };
    } catch (error) {
      console.error('Fix parent paths error:', error);
      return { fixed: 0, errors: [error as Error] };
    }
  }

  /**
   * Get sync statistics
   * @param folderId Optional folder ID to filter stats
   */
  public async getSyncStats(folderId?: string): Promise<any> {
    try {
      // This would involve querying the database for statistics
      console.log(`Getting sync statistics${folderId ? ` for folder ${folderId}` : ''}`);
      return {
        totalFiles: 0,
        totalFolders: 0,
        totalSize: 0,
        syncedFiles: 0,
        failedFiles: 0,
        fileTypes: {}
      };
    } catch (error) {
      console.error('Get sync stats error:', error);
      throw error;
    }
  }
}

export default GoogleDriveService;