/**
 * Shared service for Google Drive synchronization
 * Handles the synchronization between Google Drive and Supabase
 */

import GoogleDriveService, { 
  GoogleDriveFile, 
  SyncOptions, 
  SyncStats, 
  ProgressCallback 
} from './google-drive-service';

// Path resolution options
export interface PathResolutionOptions {
  includeRoot?: boolean;
  separator?: string;
  maxPathLength?: number;
}

// Sync result
export interface SyncResult {
  stats: SyncStats;
  files: GoogleDriveFile[];
  errors: unknown[]; // Changed from Error[] to unknown[] to fix type errors
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
  errors: unknown[]; // Changed from Error[] to unknown[] to fix type errors
  startTime: Date;
  endTime: Date;
}

// Fix for type errors in result objects
type ErrorsArray = unknown[];

/**
 * Shared Google Drive Sync Service
 * Responsible for synchronizing Google Drive with Supabase
 */
export class GoogleDriveSyncService {
  private static instance: GoogleDriveSyncService;
  private driveService: GoogleDriveService;
  private supabaseClient: any; // Will be the Supabase client

  private constructor(driveService: GoogleDriveService, supabaseClient: any) {
    this.driveService = driveService;
    this.supabaseClient = supabaseClient;
  }

  /**
   * Get singleton instance
   * @param driveService Google Drive service
   * @param supabaseClient Supabase client
   */
  public static getInstance(
    driveService: GoogleDriveService,
    supabaseClient: any
  ): GoogleDriveSyncService {
    if (!GoogleDriveSyncService.instance) {
      GoogleDriveSyncService.instance = new GoogleDriveSyncService(driveService, supabaseClient);
    }
    return GoogleDriveSyncService.instance;
  }

  /**
   * Resolve full path for a file
   * @param file File to resolve path for
   * @param options Path resolution options
   */
  public async resolvePath(
    file: { id: string; name: string; parent_folder_id?: string | null },
    options: PathResolutionOptions = {}
  ): Promise<string> {
    const { includeRoot = true, separator = '/' } = options;
    
    // If no parent folder, just return the file name
    if (!file.parent_folder_id) {
      return includeRoot ? `${separator}${file.name}` : file.name;
    }
    
    try {
      // Keep track of visited folders to prevent infinite loops
      const visitedFolders = new Set<string>();
      // Build the path segments starting with the file name
      const pathSegments: string[] = [file.name];
      
      // Start with the parent folder
      let currentFolderId = file.parent_folder_id;
      
      // Traverse up the folder hierarchy
      while (currentFolderId && !visitedFolders.has(currentFolderId)) {
        visitedFolders.add(currentFolderId);
        
        // Query the database for the parent folder
        const { data, error } = await this.supabaseClient
          .from('sources_google')
          .select('id, name, parent_folder_id, is_root')
          .eq('drive_id', currentFolderId)
          .eq('is_deleted', false)
          .single();
          
        if (error) {
          console.error(`Error resolving path for folder ${currentFolderId}:`, error);
          break;
        }
        
        if (!data) {
          console.warn(`Folder ${currentFolderId} not found in database`);
          break;
        }
        
        // Add folder name to path segments
        pathSegments.unshift(data.name);
        
        // If this is a root folder, we're done
        if (data.is_root) {
          break;
        }
        
        // Move up to the parent folder
        currentFolderId = data.parent_folder_id;
      }
      
      // Combine path segments with separator
      let path = pathSegments.join(separator);
      
      // Add leading separator for absolute paths if needed
      if (includeRoot && !path.startsWith(separator)) {
        path = `${separator}${path}`;
      }
      
      return path;
    } catch (error) {
      console.error('Error resolving file path:', error);
      // Fall back to just the file name if path resolution fails
      return file.name;
    }
  }

  /**
   * Sync files from Google Drive to Supabase
   * @param folderId Folder ID to sync
   * @param options Sync options
   * @param onProgress Progress callback
   */
  public async syncFolder(
    folderId: string,
    options: SyncOptions = {},
    onProgress?: ProgressCallback
  ): Promise<SyncResult> {
    // Initialize sync stats
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
    
    const files: GoogleDriveFile[] = [];
    const errors: Error[] = [];
    
    try {
      // Use drive service to get files
      const folderSync = await this.driveService.syncFolder(folderId, options, onProgress);
      
      // Update stats
      Object.assign(stats, folderSync);
      stats.endTime = new Date();
      
      return { stats, files, errors };
    } catch (error) {
      console.error('Sync folder error:', error);
      errors.push(error as Error);
      stats.endTime = new Date();
      return { stats, files, errors };
    }
  }

  /**
   * Sync files recursively from Google Drive to Supabase
   * @param folderId Folder ID to sync
   * @param options Sync options
   * @param onProgress Progress callback
   * @returns Detailed sync result
   */
  public async syncFolderRecursive(
    folderId: string,
    options: SyncOptions = {},
    onProgress?: ProgressCallback
  ): Promise<SyncResult> {
    const { 
      recursive = true, 
      maxDepth = 10, 
      batchSize = 50, 
      dryRun = false 
    } = options;
    
    // Initialize sync stats and results
    const stats: SyncStats = {
      filesFound: 0,
      filesInserted: 0,
      filesUpdated: 0,
      filesSkipped: 0,
      filesDeleted: 0,
      foldersFound: 1, // Count the root folder
      errors: [],
      startTime: new Date(),
      totalSize: 0,
      fileTypes: {},
    };
    
    const files: GoogleDriveFile[] = [];
    const errors: Error[] = [];
    
    try {
      console.log(`Starting recursive sync for folder ${folderId} (max depth: ${maxDepth})`);
      
      // Get folder details from Google Drive
      const folder = await this.driveService.getFile(folderId);
      console.log(`Syncing folder: ${folder.name} (${folderId})`);
      
      // List files recursively
      const allFiles = await this.listFilesRecursively(folderId, maxDepth, onProgress);
      
      stats.filesFound = allFiles.length;
      console.log(`Found ${allFiles.length} files`);
      
      // Organize files by type for statistics
      allFiles.forEach(file => {
        const type = file.mime_type || 'unknown';
        stats.fileTypes[type] = (stats.fileTypes[type] || 0) + 1;
        if (file.size) {
          stats.totalSize += file.size;
        }
        
        // Add files to result
        files.push(file);
      });
      
      // Display file types
      console.log('\nFile types:');
      Object.entries(stats.fileTypes).forEach(([type, count]) => {
        console.log(`- ${type}: ${count} files`);
      });
      
      if (dryRun) {
        console.log(`DRY RUN: Would process ${allFiles.length} files`);
        stats.endTime = new Date();
        return { stats, files, errors };
      }
      
      // Get existing files to avoid duplicates
      // This will be implementation-specific to the client using this service
      const existingDriveIds = await this.getExistingDriveIds();
      
      // Process files in batches
      const batches = Math.ceil(allFiles.length / batchSize);
      console.log(`Processing ${allFiles.length} files in ${batches} batches of ${batchSize}`);
      
      for (let i = 0; i < batches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, allFiles.length);
        const batch = allFiles.slice(start, end);
        
        console.log(`Processing batch ${i + 1}/${batches} (${batch.length} files)`);
        
        // Split into new and existing files
        const newFilesInBatch = batch.filter(file => !existingDriveIds.has(file.drive_id));
        const existingFilesInBatch = batch.filter(file => existingDriveIds.has(file.drive_id));
        
        stats.filesSkipped += existingFilesInBatch.length;
        
        if (newFilesInBatch.length > 0) {
          try {
            // Insert new files into database
            const { inserted, errors: insertErrors } = await this.insertBatch(newFilesInBatch);
            stats.filesInserted += inserted;
            
            if (insertErrors.length > 0) {
              stats.errors.push(...insertErrors);
              console.error(`Errors inserting batch ${i + 1}:`, insertErrors);
            }
          } catch (error) {
            console.error(`Error processing batch ${i + 1}:`, error);
            stats.errors.push(error as Error);
          }
        }
        
        // Update progress
        if (onProgress) {
          onProgress({
            current: end,
            total: allFiles.length,
            percentage: Math.min(100, Math.round((end / allFiles.length) * 100))
          });
        }
      }
      
      stats.endTime = new Date();
      return { stats, files, errors };
    } catch (error) {
      console.error('Recursive sync error:', error);
      errors.push(error as Error);
      stats.endTime = new Date();
      return { stats, files, errors };
    }
  }
  
  /**
   * List files recursively from a folder
   * Private helper method for syncFolderRecursive
   */
  private async listFilesRecursively(
    folderId: string,
    maxDepth: number = 10,
    onProgress?: ProgressCallback,
    currentDepth: number = 0,
    parentPath: string = '/'
  ): Promise<GoogleDriveFile[]> {
    let allFiles: GoogleDriveFile[] = [];
    
    if (currentDepth > maxDepth) {
      console.log(`Reached max depth (${maxDepth}) at ${parentPath}`);
      return [];
    }
    
    try {
      // List files in the current folder
      let pageToken: string | undefined;
      do {
        const result = await this.driveService.listFiles(folderId, {
          pageToken: pageToken
        });
        
        // Process files
        const enhancedFiles = result.files.map(file => {
          const filePath = `${parentPath}${file.name}`;
          // Add fields needed for GoogleDriveFile type
          return {
            drive_id: file.id,
            name: file.name,
            mime_type: file.mimeType,
            web_view_link: file.webViewLink,
            parent_folder_id: folderId,
            is_root: currentDepth === 0,
            path: filePath,
            path_array: filePath.split('/').filter(p => p),
            path_depth: filePath.split('/').filter(p => p).length,
            last_indexed: new Date().toISOString(),
            modified_at: file.modifiedTime,
            thumbnail_link: file.thumbnailLink,
            metadata: {
              modifiedTime: file.modifiedTime,
              size: file.size,
              thumbnailLink: file.thumbnailLink,
              mimeType: file.mimeType
            },
            is_deleted: false,
            // Required fields for GoogleDriveFile type
            file_signature: '',  // Will be generated during insert
            main_video_id: null,
            root_drive_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // Additional fields with null values
            document_type_id: null,
            sync_status: null,
            sync_error: null,
            extraction_error: null,
            extracted_content: null,
            audio_duration_seconds: null,
            audio_extracted: false,
            audio_extraction_path: null,
            audio_channels: null,
            audio_bitrate: null,
            audio_quality_metrics: null,
            sync_id: null,
            parent_id: null,
            // Force to GoogleDriveFile type
            size: file.size ? parseInt(file.size, 10) : null
          } as GoogleDriveFile;
        });
        
        // Add files to collection
        allFiles = [...allFiles, ...enhancedFiles];
        
        // Process subfolders recursively if there are any
        const folders = result.files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
        
        for (const folder of folders) {
          console.log(`Processing subfolder: ${folder.name} (depth ${currentDepth + 1})`);
          
          const folderPath = `${parentPath}${folder.name}/`;
          const subFiles = await this.listFilesRecursively(
            folder.id,
            maxDepth,
            onProgress,
            currentDepth + 1,
            folderPath
          );
          
          allFiles = [...allFiles, ...subFiles];
        }
        
        pageToken = result.nextPageToken;
      } while (pageToken);
      
      return allFiles;
    } catch (error) {
      console.error(`Error listing files in folder ${folderId}:`, error);
      return [];
    }
  }
  
  /**
   * Get existing drive IDs from database
   * @param rootFolderId Optional root folder ID to filter by
   * @param includeDeleted Whether to include files marked as deleted
   * @returns Set of existing drive IDs
   */
  private async getExistingDriveIds(
    rootFolderId?: string,
    includeDeleted: boolean = false
  ): Promise<Set<string>> {
    try {
      // Build query for sources_google table
      let query = this.supabaseClient
        .from('sources_google')
        .select('drive_id');
        
      // Add filters based on parameters
      if (!includeDeleted) {
        query = query.eq('is_deleted', false);
      }
      
      if (rootFolderId) {
        query = query.eq('root_drive_id', rootFolderId);
      }
      
      // Execute query
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching existing drive IDs:', error);
        return new Set<string>();
      }
      
      // Create a Set from the drive_id values
      return new Set(
        (data || []).map(record => record.drive_id).filter(Boolean)
      );
    } catch (error) {
      console.error('Unexpected error getting existing drive IDs:', error);
      return new Set<string>();
    }
  }
  
  /**
   * Insert a batch of files into the database
   * @param files Array of Google Drive files to insert
   * @returns Result with count of inserted files and any errors
   */
  private async insertBatch(
    files: GoogleDriveFile[]
  ): Promise<{ inserted: number; errors: ErrorsArray }> {
    const result = { inserted: 0, errors: [] as ErrorsArray };
    
    if (!files || files.length === 0) {
      return result;
    }
    
    try {
      // Prepare files for insertion
      const filesToInsert = files.map(file => {
        // Use our file metadata service to generate file signatures and handle paths
        const fileMetadataService = require('./file-metadata-service').default;
        
        // Generate a file signature
        const fileSignature = fileMetadataService.generateFileSignature(
          file.name, 
          file.modified_at
        );
        
        // Prepare metadata object
        const metadata: Record<string, any> = {
          ...(file.metadata || {}),
          modifiedTime: file.modified_at,
          webViewLink: file.web_view_link,
          thumbnailLink: file.thumbnail_link,
          mimeType: file.mime_type
        };
        
        // Create the insert data
        return {
          ...file,
          file_signature: fileSignature,
          metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false
        };
      });
      
      // Insert the files
      const { data, error } = await this.supabaseClient
        .from('sources_google')
        .insert(filesToInsert);
        
      if (error) {
        console.error('Error inserting batch:', error);
        result.errors.push(error);
        return result;
      }
      
      // Update the result
      result.inserted = filesToInsert.length;
      return result;
    } catch (error) {
      console.error('Error in insertBatch:', error);
      result.errors.push(error as Error);
      return result;
    }
  }

  /**
   * Insert Google Drive files into Supabase
   * @param files Files to insert
   * @param options Batch options
   * @param onProgress Progress callback
   */
  public async insertGoogleFiles(
    files: GoogleDriveFile[],
    options: BatchOptions = {},
    onProgress?: ProgressCallback
  ): Promise<{ inserted: number; updated: number; errors: ErrorsArray }> {
    const { batchSize = 50 } = options;
    const result = { inserted: 0, updated: 0, errors: [] as ErrorsArray };
    
    console.log(`Inserting ${files.length} files in batches of ${batchSize}`);
    
    // Process in batches
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      try {
        // This would involve inserting records into Supabase
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(files.length / batchSize)}`);
        
        // Simulate progress
        if (onProgress) {
          onProgress({
            current: i + batch.length,
            total: files.length,
            percentage: Math.min(100, Math.round(((i + batch.length) / files.length) * 100))
          });
        }
        
        // Increment counts
        result.inserted += batch.length;
      } catch (error) {
        console.error('Batch insert error:', error);
        result.errors.push(error);
      }
    }
    
    return result;
  }

  /**
   * Extract content from Google Drive files
   * @param files Files to extract content from
   * @param options Batch options
   * @param onProgress Progress callback
   */
  public async extractFileContents(
    files: GoogleDriveFile[],
    options: BatchOptions = {},
    onProgress?: ProgressCallback
  ): Promise<{ processed: number; failed: number; errors: unknown[] }> {
    const { batchSize = 10, concurrentBatches = 2 } = options;
    const result = { processed: 0, failed: 0, errors: [] as unknown[] };
    
    console.log(`Extracting content from ${files.length} files in batches of ${batchSize}`);
    
    // Process in batches
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      try {
        // This would involve extracting content from files
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(files.length / batchSize)}`);
        
        // Simulate progress
        if (onProgress) {
          onProgress({
            current: i + batch.length,
            total: files.length,
            percentage: Math.min(100, Math.round(((i + batch.length) / files.length) * 100))
          });
        }
        
        // Increment counts
        result.processed += batch.length;
      } catch (error) {
        console.error('Batch extract error:', error);
        result.failed += batch.length;
        result.errors.push(error);
      }
    }
    
    return result;
  }

  /**
   * Process audio extraction for media files
   * @param files Files to extract audio from
   * @param options Batch options
   * @param onProgress Progress callback
   */
  public async extractAudio(
    files: GoogleDriveFile[],
    options: BatchOptions = {},
    onProgress?: ProgressCallback
  ): Promise<{ processed: number; failed: number; errors: unknown[] }> {
    const { batchSize = 5, concurrentBatches = 1 } = options;
    const result = { processed: 0, failed: 0, errors: [] as unknown[] };
    
    console.log(`Extracting audio from ${files.length} files in batches of ${batchSize}`);
    
    // Process in batches
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      try {
        // This would involve extracting audio from media files
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(files.length / batchSize)}`);
        
        // Simulate progress
        if (onProgress) {
          onProgress({
            current: i + batch.length,
            total: files.length,
            percentage: Math.min(100, Math.round(((i + batch.length) / files.length) * 100))
          });
        }
        
        // Increment counts
        result.processed += batch.length;
      } catch (error) {
        console.error('Audio extract error:', error);
        result.failed += batch.length;
        result.errors.push(error);
      }
    }
    
    return result;
  }

  /**
   * Clean files associated with a specific root folder in the database
   * @param rootFolderId Root folder ID to clean
   * @param options Cleanup options
   * @param onProgress Progress callback
   * @returns Cleanup result
   */
  public async cleanFolder(
    rootFolderId: string,
    options: CleanupOptions = {},
    onProgress?: ProgressCallback
  ): Promise<CleanupResult> {
    const { 
      dryRun = true, 
      batchSize = 50, 
      forceDelete = false,
      markAsDeleted = true,
      permanentDelete = false 
    } = options;
    
    const result: CleanupResult = {
      foldersCleaned: 0,
      filesDeleted: 0,
      filesMarkedAsDeleted: 0,
      filesSkipped: 0,
      errors: [],
      startTime: new Date(),
      endTime: new Date()
    };
    
    try {
      console.log(`Starting cleanup for folder ${rootFolderId} (dry run: ${dryRun})`);
      
      if (!rootFolderId) {
        throw new Error('Root folder ID is required');
      }
      
      // Get all files associated with this root folder
      const files = await this.getFilesForCleanup(rootFolderId);
      
      if (files.length === 0) {
        console.log('No files found for cleanup');
        result.endTime = new Date();
        return result;
      }
      
      console.log(`Found ${files.length} files to process`);
      
      // Safety check (unless forced)
      if (!forceDelete && files.length > 1000) {
        throw new Error(`Too many files to clean (${files.length}). Use forceDelete option to override.`);
      }
      
      // Process in batches
      const batches = Math.ceil(files.length / batchSize);
      console.log(`Processing ${files.length} files in ${batches} batches of ${batchSize}`);
      
      for (let i = 0; i < batches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, files.length);
        const batch = files.slice(start, end);
        
        console.log(`Processing batch ${i + 1}/${batches} (${batch.length} files)`);
        
        try {
          if (!dryRun) {
            if (permanentDelete) {
              // Permanently delete from database
              const { deleted, errors: deleteErrors } = await this.permanentlyDeleteFiles(
                batch.map(file => file.id)
              );
              result.filesDeleted += deleted;
              result.errors.push(...deleteErrors);
            } else if (markAsDeleted) {
              // Mark as deleted
              const { marked, errors: markErrors } = await this.markFilesAsDeleted(
                batch.map(file => file.id)
              );
              result.filesMarkedAsDeleted += marked;
              result.errors.push(...markErrors);
            }
          } else {
            console.log(`DRY RUN: Would ${permanentDelete ? 'permanently delete' : 'mark as deleted'} ${batch.length} files`);
          }
        } catch (error) {
          console.error(`Error processing batch ${i + 1}:`, error);
          result.errors.push(error as Error);
          result.filesSkipped += batch.length;
        }
        
        // Update progress
        if (onProgress) {
          onProgress({
            current: end,
            total: files.length,
            percentage: Math.min(100, Math.round((end / files.length) * 100))
          });
        }
      }
      
      // Update result
      result.foldersCleaned = 1;
      result.endTime = new Date();
      
      return result;
    } catch (error) {
      console.error('Error cleaning folder:', error);
      result.errors.push(error as Error);
      result.endTime = new Date();
      return result;
    }
  }
  
  /**
   * Get files associated with a root folder for cleanup
   * This would be implemented by the client using this service
   */
  private async getFilesForCleanup(rootFolderId: string): Promise<{ id: string; drive_id: string }[]> {
    // This would be implemented by the specific client to query their database
    // Mock implementation for now
    console.log(`Would get files for cleanup from root folder ${rootFolderId}`);
    return [];
  }
  
  /**
   * Permanently delete files from the database
   * This would be implemented by the client using this service
   */
  private async permanentlyDeleteFiles(
    fileIds: string[]
  ): Promise<{ deleted: number; errors: Error[] }> {
    // This would be implemented by the specific client to delete records
    // Mock implementation for now
    console.log(`Would permanently delete ${fileIds.length} files`);
    return { deleted: fileIds.length, errors: [] };
  }
  
  /**
   * Mark files as deleted in the database
   * This would be implemented by the client using this service
   */
  private async markFilesAsDeleted(
    fileIds: string[]
  ): Promise<{ marked: number; errors: Error[] }> {
    // This would be implemented by the specific client to mark records as deleted
    // Mock implementation for now
    console.log(`Would mark ${fileIds.length} files as deleted`);
    return { marked: fileIds.length, errors: [] };
  }

  /**
   * Fix missing parent paths in the database
   * @param dryRun Only show what would be fixed
   */
  public async fixParentPaths(dryRun = false): Promise<{ fixed: number; errors: Error[] }> {
    return this.driveService.fixParentPaths(dryRun);
  }

  /**
   * Get sync statistics
   * @param folderId Optional folder ID to filter stats
   */
  public async getSyncStats(folderId?: string): Promise<any> {
    return this.driveService.getSyncStats(folderId);
  }
}

export default GoogleDriveSyncService;