/**
 * Google Drive Sync Service - Refactored with BusinessService base class
 * 
 * Handles synchronization between Google Drive and Supabase with proper
 * dependency injection, batch processing, and comprehensive error handling.
 */

import { BusinessService } from '../../base-classes/BusinessService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../../utils/logger';
import { GoogleDriveService } from '../google-drive-service';
import {
  SyncOptions,
  SyncResult,
  SyncStats,
  BatchOptions,
  CleanupOptions,
  CleanupResult,
  PathResolutionOptions,
  SyncProgress,
  ConflictStrategy,
  FileChange,
  SyncState
} from './types';

/**
 * GoogleDriveSyncService - Manages synchronization between Google Drive and database
 * 
 * Features:
 * - Incremental sync with change detection
 * - Batch processing for large file sets
 * - Path resolution and caching
 * - Conflict resolution strategies
 * - Cleanup of deleted files
 * - Progress tracking and resumable sync
 * - Automatic retry logic
 * - Performance monitoring
 */
export class GoogleDriveSyncService extends BusinessService {
  private pathCache: Map<string, string> = new Map();
  private syncState: SyncState | null = null;
  private activeSyncId: string | null = null;

  constructor(
    supabaseClient: SupabaseClient,
    private googleDriveService: GoogleDriveService,
    logger?: Logger
  ) {
    super('GoogleDriveSyncService', { supabaseClient }, logger);
  }

  protected async initialize(): Promise<void> {
    this.pathCache.clear();
    this.syncState = null;
    this.activeSyncId = null;
    this.logger?.info('GoogleDriveSyncService initialized');
  }

  protected async cleanup(): Promise<void> {
    // Save sync state if active
    if (this.syncState && this.activeSyncId) {
      await this.saveSyncState();
    }
    this.pathCache.clear();
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    serviceName: string;
    timestamp: Date;
    details?: Record<string, any>;
    error?: string;
  }> {
    try {
      // Check database connection
      const { error: dbError, count } = await this.dependencies.supabaseClient
        .from('google_sources')
        .select('*', { count: 'exact', head: true })
        .limit(1);

      // Check sync history table
      const { error: syncError } = await this.dependencies.supabaseClient
        .from('google_sync_history')
        .select('id')
        .limit(1);

      const healthy = !dbError && !syncError;

      return {
        healthy,
        serviceName: this.serviceName,
        timestamp: new Date(),
        details: {
          pathCacheSize: this.pathCache.size,
          activeSyncId: this.activeSyncId,
          syncInProgress: this.syncState !== null,
          totalFiles: count || 0,
          tablesHealthy: {
            google_sources: !dbError,
            google_sync_history: !syncError
          }
        },
        error: dbError?.message || syncError?.message
      };
    } catch (error: any) {
      return {
        healthy: false,
        serviceName: this.serviceName,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Sync files from Google Drive with comprehensive options
   */
  async syncFiles(
    folderId: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    return this.validateInput({ folderId }, () => {
      if (!folderId || !folderId.trim()) {
        throw new Error('Folder ID is required');
      }
    })
    .then(() => this.timeOperation('syncFiles', async () => {
      const {
        recursive = true,
        maxDepth = 10,
        batchSize = 100,
        dryRun = false,
        includeDeleted = false,
        conflictStrategy = 'merge',
        onProgress
      } = options;

      // Initialize or resume sync
      const syncId = await this.initializeSync(folderId, options);
      this.activeSyncId = syncId;

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
        fileTypes: {}
      };

      const allFiles: any[] = [];

      try {
        // Get existing files for comparison
        const existingFiles = await this.getExistingFiles(folderId);
        const existingMap = new Map(existingFiles.map(f => [f.drive_id, f]));

        // Sync files from Google Drive
        await this.syncFolderRecursively(
          folderId,
          existingMap,
          stats,
          allFiles,
          {
            currentDepth: 0,
            maxDepth,
            batchSize,
            dryRun,
            conflictStrategy,
            onProgress
          }
        );

        // Handle deleted files
        if (includeDeleted) {
          await this.handleDeletedFiles(existingMap, stats, { dryRun });
        }

        stats.endTime = new Date();

        // Save sync history
        if (!dryRun) {
          await this.saveSyncHistory(syncId, stats);
        }

        this.logger?.info(
          `Sync completed: ${stats.filesInserted} inserted, ${stats.filesUpdated} updated, ` +
          `${stats.filesSkipped} skipped, ${stats.filesDeleted} deleted, ${stats.errors.length} errors`
        );

        return {
          stats,
          files: allFiles,
          errors: stats.errors
        };
      } catch (error: any) {
        stats.errors.push({ message: error.message, folder: folderId });
        throw error;
      } finally {
        this.activeSyncId = null;
        this.syncState = null;
      }
    }));
  }

  /**
   * Clean up orphaned or deleted files
   */
  async cleanupDeletedFiles(
    folderId: string,
    options: CleanupOptions = {}
  ): Promise<CleanupResult> {
    return this.validateInput({ folderId }, () => {
      if (!folderId || !folderId.trim()) {
        throw new Error('Folder ID is required');
      }
    })
    .then(() => this.timeOperation('cleanupDeletedFiles', async () => {
      const {
        dryRun = false,
        batchSize = 100,
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
        // Get all files in the folder from database
        const dbFiles = await this.getExistingFiles(folderId, { includeDeleted: false });
        
        // Check each file against Google Drive
        for (let i = 0; i < dbFiles.length; i += batchSize) {
          const batch = dbFiles.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async (dbFile) => {
            try {
              // Check if file exists in Google Drive
              const exists = await this.googleDriveService
                .getFile(dbFile.drive_id)
                .then(() => true)
                .catch(() => false);

              if (!exists) {
                if (dryRun) {
                  this.logger?.info(`[DRY RUN] Would clean up file: ${dbFile.name}`);
                  result.filesDeleted++;
                } else if (permanentDelete && forceDelete) {
                  await this.permanentDeleteFile(dbFile.drive_id);
                  result.filesDeleted++;
                } else if (markAsDeleted) {
                  await this.markFileAsDeleted(dbFile.drive_id);
                  result.filesMarkedAsDeleted++;
                } else {
                  result.filesSkipped++;
                }
              }
            } catch (error: any) {
              result.errors.push({ fileId: dbFile.drive_id, error: error.message });
            }
          }));
        }

        result.foldersCleaned = 1; // TODO: Implement recursive folder counting
        result.endTime = new Date();

        this.logger?.info(
          `Cleanup completed: ${result.filesDeleted} deleted, ` +
          `${result.filesMarkedAsDeleted} marked as deleted, ` +
          `${result.filesSkipped} skipped`
        );

        return result;
      } catch (error: any) {
        result.errors.push({ message: error.message });
        throw error;
      }
    }));
  }

  /**
   * Resolve full path for a file with caching
   */
  async resolvePath(
    file: { id: string; name: string; parent_folder_id?: string | null },
    options: PathResolutionOptions = {}
  ): Promise<string> {
    const { includeRoot = true, separator = '/', maxPathLength = 1000 } = options;

    // Check cache first
    const cacheKey = `${file.id}:${includeRoot}:${separator}`;
    if (this.pathCache.has(cacheKey)) {
      return this.pathCache.get(cacheKey)!;
    }

    const pathParts: string[] = [file.name];
    let currentId = file.parent_folder_id;
    const visited = new Set<string>([file.id]);

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);

      const parent = await this.getFileById(currentId);
      if (!parent) break;

      pathParts.unshift(parent.name);
      currentId = parent.parent_folder_id;

      // Prevent infinite loops
      if (pathParts.join(separator).length > maxPathLength) {
        this.logger?.warn(`Path too long for file ${file.id}, truncating`);
        break;
      }
    }

    if (!includeRoot && pathParts.length > 0) {
      const firstPart = pathParts[0];
      if (firstPart === 'My Drive' || firstPart === 'Shared drives') {
        pathParts.shift();
      }
    }

    const path = pathParts.join(separator) || separator;
    
    // Cache the result
    this.pathCache.set(cacheKey, path);
    
    return path;
  }

  /**
   * Get change detection for incremental sync
   */
  async detectChanges(
    folderId: string,
    since?: Date
  ): Promise<FileChange[]> {
    return this.withRetry(async () => {
      const changes: FileChange[] = [];

      // Get files from Google Drive with changes
      const driveFiles = await this.googleDriveService.listFiles(folderId, {
        pageSize: 1000,
        fields: 'files(id,name,mimeType,modifiedTime,size,parents)',
        orderBy: 'modifiedTime desc'
      });

      // Get existing files from database
      const existingFiles = await this.getExistingFiles(folderId);
      const existingMap = new Map(existingFiles.map(f => [f.drive_id, f]));

      // Detect changes
      for (const driveFile of driveFiles.files || []) {
        const existing = existingMap.get(driveFile.id);
        
        if (!existing) {
          changes.push({
            fileId: driveFile.id,
            changeType: 'added',
            file: driveFile
          });
        } else if (driveFile.modifiedTime !== existing.modified_at) {
          changes.push({
            fileId: driveFile.id,
            changeType: 'modified',
            file: driveFile,
            previousVersion: existing
          });
        }
        
        // Remove from map to track deletions
        existingMap.delete(driveFile.id);
      }

      // Remaining files in map are deleted
      for (const [fileId, file] of existingMap) {
        changes.push({
          fileId,
          changeType: 'deleted',
          previousVersion: file
        });
      }

      return changes;
    }, { operationName: 'detectChanges' });
  }

  /**
   * Get sync history
   */
  async getSyncHistory(
    limit: number = 10,
    folderId?: string
  ): Promise<any[]> {
    let query = this.dependencies.supabaseClient
      .from('google_sync_history')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (folderId) {
      query = query.eq('root_folder_id', folderId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  }

  /**
   * Helper: Sync folder recursively
   */
  private async syncFolderRecursively(
    folderId: string,
    existingMap: Map<string, any>,
    stats: SyncStats,
    allFiles: any[],
    options: {
      currentDepth: number;
      maxDepth: number;
      batchSize: number;
      dryRun: boolean;
      conflictStrategy: ConflictStrategy;
      onProgress?: (progress: SyncProgress) => void;
    }
  ): Promise<void> {
    if (options.currentDepth >= options.maxDepth) {
      return;
    }

    try {
      // List files in the folder
      const result = await this.googleDriveService.listFiles(folderId, {
        pageSize: 1000,
        fields: 'files(id,name,mimeType,modifiedTime,size,parents,webViewLink)'
      });

      const files = result.files || [];
      stats.filesFound += files.length;

      // Process files in batches
      for (let i = 0; i < files.length; i += options.batchSize) {
        const batch = files.slice(i, i + options.batchSize);
        
        await this.processBatch(batch, existingMap, stats, allFiles, {
          folderId,
          ...options
        });

        // Report progress
        if (options.onProgress) {
          const progress: SyncProgress = {
            current: stats.filesInserted + stats.filesUpdated + stats.filesSkipped,
            total: stats.filesFound,
            currentFolder: folderId,
            depth: options.currentDepth
          };
          options.onProgress(progress);
        }
      }

      // Recursively sync subfolders
      const folders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
      stats.foldersFound += folders.length;

      for (const folder of folders) {
        await this.syncFolderRecursively(
          folder.id,
          existingMap,
          stats,
          allFiles,
          {
            ...options,
            currentDepth: options.currentDepth + 1
          }
        );
      }
    } catch (error: any) {
      stats.errors.push({ message: error.message, folder: folderId });
      this.logger?.error(`Error syncing folder ${folderId}: ${error.message}`);
    }
  }

  /**
   * Helper: Process a batch of files
   */
  private async processBatch(
    files: any[],
    existingMap: Map<string, any>,
    stats: SyncStats,
    allFiles: any[],
    options: any
  ): Promise<void> {
    const upsertData: any[] = [];

    for (const file of files) {
      try {
        const existing = existingMap.get(file.id);
        const path = await this.resolvePath({
          id: file.id,
          name: file.name,
          parent_folder_id: file.parents?.[0]
        });

        const fileData = {
          drive_id: file.id,
          name: file.name,
          mime_type: file.mimeType,
          path,
          parent_folder_id: file.parents?.[0] || null,
          is_root: !file.parents || file.parents.length === 0,
          web_view_link: file.webViewLink,
          size: parseInt(file.size || '0'),
          modified_at: file.modifiedTime,
          metadata: file,
          is_deleted: false,
          updated_at: new Date().toISOString()
        };

        // Handle conflicts
        if (existing) {
          const shouldUpdate = this.shouldUpdateFile(existing, fileData, options.conflictStrategy);
          if (shouldUpdate) {
            upsertData.push(fileData);
            stats.filesUpdated++;
          } else {
            stats.filesSkipped++;
          }
        } else {
          fileData.created_at = new Date().toISOString();
          upsertData.push(fileData);
          stats.filesInserted++;
        }

        // Update stats
        stats.totalSize += parseInt(file.size || '0');
        stats.fileTypes[file.mimeType] = (stats.fileTypes[file.mimeType] || 0) + 1;

        allFiles.push(fileData);
        existingMap.delete(file.id);
      } catch (error: any) {
        stats.errors.push({ fileId: file.id, error: error.message });
      }
    }

    // Batch upsert to database
    if (upsertData.length > 0 && !options.dryRun) {
      const { error } = await this.dependencies.supabaseClient
        .from('google_sources')
        .upsert(upsertData, { onConflict: 'drive_id' });

      if (error) {
        throw error;
      }
    }
  }

  /**
   * Helper: Should update file based on conflict strategy
   */
  private shouldUpdateFile(
    existing: any,
    newData: any,
    strategy: ConflictStrategy
  ): boolean {
    switch (strategy) {
      case 'skip':
        return false;
      case 'overwrite':
        return true;
      case 'merge':
        // Update if modified time is different
        return existing.modified_at !== newData.modified_at;
      case 'newer':
        // Update if new file is newer
        return new Date(newData.modified_at) > new Date(existing.modified_at);
      default:
        return true;
    }
  }

  /**
   * Helper: Get existing files from database
   */
  private async getExistingFiles(
    folderId: string,
    options: { includeDeleted?: boolean } = {}
  ): Promise<any[]> {
    let query = this.dependencies.supabaseClient
      .from('google_sources')
      .select('*');

    if (!options.includeDeleted) {
      query = query.eq('is_deleted', false);
    }

    // Get files in folder and subfolders
    const { data, error } = await query;
    if (error) throw error;

    // Filter by folder path if needed
    return data || [];
  }

  /**
   * Helper: Get file by ID
   */
  private async getFileById(fileId: string): Promise<any | null> {
    const { data, error } = await this.dependencies.supabaseClient
      .from('google_sources')
      .select('*')
      .eq('drive_id', fileId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  /**
   * Helper: Handle deleted files
   */
  private async handleDeletedFiles(
    remainingMap: Map<string, any>,
    stats: SyncStats,
    options: { dryRun?: boolean }
  ): Promise<void> {
    const deletedIds = Array.from(remainingMap.keys());
    
    if (deletedIds.length === 0) return;

    if (options.dryRun) {
      stats.filesDeleted = deletedIds.length;
      this.logger?.info(`[DRY RUN] Would mark ${deletedIds.length} files as deleted`);
      return;
    }

    const { error } = await this.dependencies.supabaseClient
      .from('google_sources')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .in('drive_id', deletedIds);

    if (error) {
      throw error;
    }

    stats.filesDeleted = deletedIds.length;
  }

  /**
   * Helper: Mark file as deleted
   */
  private async markFileAsDeleted(fileId: string): Promise<void> {
    const { error } = await this.dependencies.supabaseClient
      .from('google_sources')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('drive_id', fileId);

    if (error) throw error;
  }

  /**
   * Helper: Permanently delete file
   */
  private async permanentDeleteFile(fileId: string): Promise<void> {
    const { error } = await this.dependencies.supabaseClient
      .from('google_sources')
      .delete()
      .eq('drive_id', fileId);

    if (error) throw error;
  }

  /**
   * Helper: Initialize sync session
   */
  private async initializeSync(folderId: string, options: SyncOptions): Promise<string> {
    const { data, error } = await this.dependencies.supabaseClient
      .from('google_sync_history')
      .insert({
        root_folder_id: folderId,
        started_at: new Date().toISOString(),
        status: 'running',
        options: options
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Helper: Save sync history
   */
  private async saveSyncHistory(syncId: string, stats: SyncStats): Promise<void> {
    const { error } = await this.dependencies.supabaseClient
      .from('google_sync_history')
      .update({
        ended_at: new Date().toISOString(),
        status: stats.errors.length > 0 ? 'completed_with_errors' : 'completed',
        files_found: stats.filesFound,
        files_inserted: stats.filesInserted,
        files_updated: stats.filesUpdated,
        files_deleted: stats.filesDeleted,
        files_skipped: stats.filesSkipped,
        errors: stats.errors,
        total_size_bytes: stats.totalSize
      })
      .eq('id', syncId);

    if (error) {
      this.logger?.error(`Failed to save sync history: ${error.message}`);
    }
  }

  /**
   * Helper: Save sync state for resumption
   */
  private async saveSyncState(): Promise<void> {
    if (!this.syncState || !this.activeSyncId) return;

    const { error } = await this.dependencies.supabaseClient
      .from('google_sync_state')
      .upsert({
        sync_id: this.activeSyncId,
        state: this.syncState,
        updated_at: new Date().toISOString()
      });

    if (error) {
      this.logger?.error(`Failed to save sync state: ${error.message}`);
    }
  }
}