/**
 * Sources Google Update Service - Refactored with BusinessService base class
 * 
 * Updates Google Drive metadata in the sources_google table with proper
 * dependency injection, retry logic, and batch processing capabilities.
 */

import { BusinessService } from '../../base-classes/BusinessService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../../utils/logger';
import { GoogleDriveService } from '../google-drive-service';
import { 
  UpdateOptions, 
  UpdateResult, 
  BatchUpdateOptions,
  UpdateProgress,
  FieldUpdateStrategy,
  ConflictResolution
} from './types';

/**
 * SourcesGoogleUpdateService - Manages updates to Google Drive metadata
 * 
 * Features:
 * - Batch metadata updates
 * - Field-level update strategies
 * - Conflict resolution
 * - Progress tracking
 * - Dry run support
 * - Automatic retry logic
 * - Performance monitoring
 */
export class SourcesGoogleUpdateService extends BusinessService {
  private updateQueue: Map<string, any> = new Map();
  private isProcessing: boolean = false;

  constructor(
    supabaseClient: SupabaseClient,
    private googleDriveService: GoogleDriveService,
    logger?: Logger
  ) {
    super('SourcesGoogleUpdateService', { supabaseClient, googleDriveService }, logger);
  }

  protected validateDependencies(): void {
    if (!this.dependencies.supabaseClient) {
      throw new Error('Supabase client is required');
    }
    if (!this.dependencies.googleDriveService) {
      throw new Error('Google Drive service is required');
    }
  }

  protected async initialize(): Promise<void> {
    this.updateQueue.clear();
    this.isProcessing = false;
    this.logger?.info('SourcesGoogleUpdateService initialized');
  }

  protected async cleanup(): Promise<void> {
    // Process any pending updates
    if (this.updateQueue.size > 0) {
      this.logger?.warn(`Flushing ${this.updateQueue.size} pending updates`);
      await this.flushUpdateQueue();
    }
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
      const { error, count } = await this.dependencies.supabaseClient
        .from('google_sources')
        .select('*', { count: 'exact', head: true })
        .limit(1);

      // Check Google Drive service
      const driveHealthy = await this.googleDriveService
        .listFiles('root', { pageSize: 1 })
        .then(() => true)
        .catch(() => false);

      return {
        healthy: !error && driveHealthy,
        serviceName: this.serviceName,
        timestamp: new Date(),
        details: {
          queueSize: this.updateQueue.size,
          isProcessing: this.isProcessing,
          totalRecords: count || 0,
          supabaseConnected: !error,
          googleDriveConnected: driveHealthy
        },
        error: error?.message
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
   * Get records from sources_google table with filtering
   */
  async getSourcesGoogleRecords(
    folderId?: string,
    options: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      ascending?: boolean;
      filter?: string;
      includeDeleted?: boolean;
    } = {}
  ): Promise<any[]> {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'created_at',
      ascending = false,
      filter,
      includeDeleted = false
    } = options;

    return this.withRetry(async () => {
      let query = this.dependencies.supabaseClient
        .from('google_sources')
        .select('*');

      // Apply deletion filter
      if (!includeDeleted) {
        query = query.eq('is_deleted', false);
      }

      // Apply folder filter
      if (folderId) {
        query = query.or(
          `parent_folder_id.eq.${folderId},drive_id.eq.${folderId},path.like.%${folderId}%`
        );
      }

      // Apply custom filter
      if (filter) {
        query = query.or(filter);
      }

      // Apply pagination and ordering
      const { data, error } = await query
        .order(orderBy, { ascending })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      this.logger?.info(`Retrieved ${data?.length || 0} records from google_sources`);
      return data || [];
    }, { operationName: 'getSourcesGoogleRecords' });
  }

  /**
   * Update metadata for a single file
   */
  async updateFileMetadata(
    fileId: string,
    updates: Record<string, any>,
    options: UpdateOptions = {}
  ): Promise<boolean> {
    this.validateInput({ fileId, updates }, (data) => {
      if (!data.fileId || !data.fileId.trim()) {
        throw new Error('File ID is required');
      }
      if (!data.updates || Object.keys(data.updates).length === 0) {
        throw new Error('Updates object cannot be empty');
      }
      return data;
    });
    
    return this.withTransaction(async () => {
      const { dryRun = false, conflictResolution = 'merge' } = options;

      if (dryRun) {
        this.logger?.info(`[DRY RUN] Would update file ${fileId} with:`, updates);
        return true;
      }

      // Handle conflict resolution
      if (conflictResolution !== 'overwrite') {
        const existing = await this.getFileById(fileId);
        if (existing && conflictResolution === 'merge') {
          updates = this.mergeUpdates(existing, updates);
        } else if (existing && conflictResolution === 'skip') {
          this.logger?.info(`Skipping update for ${fileId} due to conflict resolution strategy`);
          return false;
        }
      }

      return this.withRetry(async () => {
        const { error } = await this.dependencies.supabaseClient
          .from('google_sources')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('drive_id', fileId);

        if (error) throw error;

        this.logger?.debug(`Updated metadata for file ${fileId}`);
        return true;
      }, { operationName: 'updateFileMetadata' });
    });
  }

  /**
   * Batch update metadata for multiple files
   */
  async batchUpdateMetadata(
    fileIds: string[],
    updates: Record<string, any> | ((file: any) => Record<string, any>),
    options: BatchUpdateOptions = {}
  ): Promise<UpdateResult> {
    // Validate input
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      throw new Error('File IDs array cannot be empty');
    }
    
    return this.timeOperation('batchUpdateMetadata', async () => {
      const {
        batchSize = 50,
        dryRun = false,
        onProgress,
        conflictResolution = 'merge',
        continueOnError = true
      } = options;

      const result: UpdateResult = {
        records: fileIds.length,
        updated: 0,
        skipped: 0,
        errors: [],
        startTime: new Date(),
        endTime: new Date()
      };

      for (let i = 0; i < fileIds.length; i += batchSize) {
        const batch = fileIds.slice(i, i + batchSize);
        
        for (const fileId of batch) {
          try {
            // Get file-specific updates if function provided
            const fileUpdates = typeof updates === 'function'
              ? await updates(await this.getFileById(fileId))
              : updates;

            const success = await this.updateFileMetadata(
              fileId,
              fileUpdates,
              { dryRun, conflictResolution }
            );

            if (success) {
              result.updated++;
            } else {
              result.skipped++;
            }
          } catch (error: any) {
            result.errors.push({ fileId, error: error.message });
            
            if (!continueOnError) {
              throw error;
            }
          }
        }

        // Report progress
        const progress: UpdateProgress = {
          current: Math.min(i + batchSize, fileIds.length),
          total: fileIds.length,
          updated: result.updated,
          skipped: result.skipped,
          errors: result.errors.length
        };
        
        onProgress?.(progress);
      }

      result.endTime = new Date();
      this.logger?.info(
        `Batch update completed: ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`
      );
      
      return result;
    });
  }

  /**
   * Sync metadata from Google Drive API
   */
  async syncFromGoogleDrive(
    folderId: string,
    options: {
      recursive?: boolean;
      updateStrategy?: FieldUpdateStrategy;
      dryRun?: boolean;
      limit?: number;
    } = {}
  ): Promise<UpdateResult> {
    return this.validateInput({ folderId }, () => {
      if (!folderId || !folderId.trim()) {
        throw new Error('Folder ID is required');
      }
    })
    .then(() => this.timeOperation('syncFromGoogleDrive', async () => {
      const {
        recursive = false,
        updateStrategy = 'merge',
        dryRun = false,
        limit
      } = options;

      const result: UpdateResult = {
        records: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        startTime: new Date(),
        endTime: new Date()
      };

      try {
        // Get files from Google Drive
        const driveFiles = await this.googleDriveService.listFiles(folderId, {
          pageSize: limit || 1000,
          fields: 'files(id,name,mimeType,modifiedTime,size,parents,webViewLink)'
        });

        result.records = driveFiles.files?.length || 0;

        // Get existing records
        const existingRecords = await this.getSourcesGoogleRecords(folderId);
        const existingMap = new Map(
          existingRecords.map(r => [r.drive_id, r])
        );

        // Process each file
        for (const driveFile of driveFiles.files || []) {
          try {
            const existing = existingMap.get(driveFile.id);
            
            if (!existing) {
              // Insert new record
              await this.insertNewFile(driveFile, { dryRun });
              result.updated++;
            } else {
              // Update existing record
              const updates = this.buildUpdatesFromDriveFile(driveFile, existing, updateStrategy);
              
              if (Object.keys(updates).length > 0) {
                await this.updateFileMetadata(driveFile.id, updates, { dryRun });
                result.updated++;
              } else {
                result.skipped++;
              }
            }
          } catch (error: any) {
            result.errors.push({ fileId: driveFile.id, error: error.message });
          }
        }

        // Handle recursive sync
        if (recursive) {
          const folders = driveFiles.files?.filter(
            f => f.mimeType === 'application/vnd.google-apps.folder'
          ) || [];
          
          for (const folder of folders) {
            const subResult = await this.syncFromGoogleDrive(folder.id, options);
            result.records += subResult.records;
            result.updated += subResult.updated;
            result.skipped += subResult.skipped;
            result.errors.push(...subResult.errors);
          }
        }
      } catch (error: any) {
        this.logger?.error(`Failed to sync from Google Drive: ${error.message}`);
        throw error;
      }

      result.endTime = new Date();
      return result;
    }));
  }

  /**
   * Update specific fields across all records
   */
  async updateFieldsGlobally(
    fieldUpdates: Record<string, any>,
    filter?: string,
    options: UpdateOptions = {}
  ): Promise<UpdateResult> {
    return this.validateInput({ fieldUpdates }, () => {
      if (!fieldUpdates || Object.keys(fieldUpdates).length === 0) {
        throw new Error('Field updates cannot be empty');
      }
    })
    .then(() => this.withRetry(async () => {
      const { dryRun = false } = options;
      
      // Get all matching records
      const records = await this.getSourcesGoogleRecords(undefined, {
        filter,
        limit: 10000 // High limit for global updates
      });

      // Extract IDs for batch update
      const fileIds = records.map(r => r.drive_id).filter(Boolean);
      
      return this.batchUpdateMetadata(fileIds, fieldUpdates, {
        ...options,
        batchSize: 100 // Larger batches for global updates
      });
    }, { operationName: 'updateFieldsGlobally' }));
  }

  /**
   * Queue updates for batch processing
   */
  async queueUpdate(fileId: string, updates: Record<string, any>): Promise<void> {
    this.updateQueue.set(fileId, {
      ...this.updateQueue.get(fileId),
      ...updates
    });

    // Auto-flush if queue is large
    if (this.updateQueue.size >= 100 && !this.isProcessing) {
      await this.flushUpdateQueue();
    }
  }

  /**
   * Flush all queued updates
   */
  async flushUpdateQueue(): Promise<UpdateResult> {
    if (this.updateQueue.size === 0) {
      return {
        records: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        startTime: new Date(),
        endTime: new Date()
      };
    }

    this.isProcessing = true;
    
    try {
      const fileIds = Array.from(this.updateQueue.keys());
      const updates = Array.from(this.updateQueue.entries());
      
      const result = await this.batchUpdateMetadata(
        fileIds,
        (file) => {
          const fileId = file.drive_id;
          return this.updateQueue.get(fileId) || {};
        }
      );

      this.updateQueue.clear();
      return result;
    } finally {
      this.isProcessing = false;
    }
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
   * Helper: Insert new file
   */
  private async insertNewFile(
    driveFile: any,
    options: { dryRun?: boolean } = {}
  ): Promise<void> {
    if (options.dryRun) {
      this.logger?.info(`[DRY RUN] Would insert new file: ${driveFile.name}`);
      return;
    }

    const { error } = await this.dependencies.supabaseClient
      .from('google_sources')
      .insert({
        drive_id: driveFile.id,
        name: driveFile.name,
        mime_type: driveFile.mimeType,
        parent_folder_id: driveFile.parents?.[0],
        web_view_link: driveFile.webViewLink,
        size: parseInt(driveFile.size || '0'),
        modified_at: driveFile.modifiedTime,
        metadata: driveFile,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  /**
   * Helper: Build updates from Drive file
   */
  private buildUpdatesFromDriveFile(
    driveFile: any,
    existing: any,
    strategy: FieldUpdateStrategy
  ): Record<string, any> {
    const updates: Record<string, any> = {};

    // Always update modified time if changed
    if (driveFile.modifiedTime !== existing.modified_at) {
      updates.modified_at = driveFile.modifiedTime;
    }

    // Handle different update strategies
    switch (strategy) {
      case 'overwrite':
        // Update all fields
        updates.name = driveFile.name;
        updates.mime_type = driveFile.mimeType;
        updates.size = parseInt(driveFile.size || '0');
        updates.web_view_link = driveFile.webViewLink;
        updates.metadata = driveFile;
        break;
        
      case 'merge':
        // Update only if different
        if (driveFile.name !== existing.name) updates.name = driveFile.name;
        if (driveFile.mimeType !== existing.mime_type) updates.mime_type = driveFile.mimeType;
        if (parseInt(driveFile.size || '0') !== existing.size) updates.size = parseInt(driveFile.size || '0');
        if (driveFile.webViewLink !== existing.web_view_link) updates.web_view_link = driveFile.webViewLink;
        updates.metadata = { ...existing.metadata, ...driveFile };
        break;
        
      case 'fillEmpty':
        // Only update empty fields
        if (!existing.name) updates.name = driveFile.name;
        if (!existing.mime_type) updates.mime_type = driveFile.mimeType;
        if (!existing.size) updates.size = parseInt(driveFile.size || '0');
        if (!existing.web_view_link) updates.web_view_link = driveFile.webViewLink;
        if (!existing.metadata) updates.metadata = driveFile;
        break;
    }

    return updates;
  }

  /**
   * Helper: Merge updates with existing data
   */
  private mergeUpdates(existing: any, updates: Record<string, any>): Record<string, any> {
    const merged: Record<string, any> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        // Deep merge objects
        merged[key] = { ...(existing[key] || {}), ...value };
      } else {
        // Simple replacement
        merged[key] = value;
      }
    }

    return merged;
  }

  /**
   * Update a single source record (wrapper for test compatibility)
   */
  async updateSource(
    fileId: string,
    options: UpdateOptions = {}
  ): Promise<UpdateResult> {
    const result: UpdateResult = {
      success: false,
      fileId,
      filesUpdated: 0,
      filesInserted: 0,
      filesSkipped: 0,
      errors: [],
      totalProcessed: 1
    };

    try {
      // Get metadata from Google Drive if fields specified
      const metadata = await this.dependencies.googleDriveService.getFileMetadata(fileId);
      
      // Update the file metadata
      const updated = await this.updateFileMetadata(fileId, metadata, options);
      
      if (updated) {
        result.filesUpdated = 1;
        result.success = true;
      } else {
        result.filesSkipped = 1;
        result.success = true;
      }
    } catch (error: any) {
      result.errors.push({ fileId, error: error.message });
    }

    return result;
  }

  /**
   * Batch update wrapper for test compatibility
   */
  async batchUpdate(
    updates: Array<{ fileId: string; data: Record<string, any> }>,
    options: BatchUpdateOptions = {}
  ): Promise<UpdateResult> {
    return this.batchUpdateMetadata(updates, options);
  }
}