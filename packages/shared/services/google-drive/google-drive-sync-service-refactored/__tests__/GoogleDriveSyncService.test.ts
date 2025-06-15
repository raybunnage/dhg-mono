/**
 * GoogleDriveSyncService Tests
 * 
 * Tests the Google Drive sync service that handles synchronization between
 * Google Drive and Supabase with batch processing, conflict resolution,
 * and comprehensive error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { GoogleDriveSyncService } from '../GoogleDriveSyncService';
import { GoogleDriveService } from '../../google-drive-service';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../../../utils/logger';
import { ConflictStrategy, SyncOptions } from '../types';

// Mock Google Drive service
const mockGoogleDriveService = {
  listFiles: vi.fn(),
  getFile: vi.fn(),
  downloadFile: vi.fn(),
  getFileMetadata: vi.fn(),
  listFolderContents: vi.fn(),
  getChanges: vi.fn(),
  ensureInitialized: vi.fn()
} as unknown as GoogleDriveService;

// Mock Supabase client
const createMockSupabaseClient = () => {
  const mockClient = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ 
        data: { user: { id: 'user-123' } }, 
        error: null 
      })
    }
  };
  
  // Set up default responses
  mockClient.single.mockResolvedValue({ data: null, error: null });
  mockClient.limit.mockResolvedValue({ data: [], error: null, count: 0 });
  
  return mockClient as unknown as SupabaseClient;
};

describe('GoogleDriveSyncService', () => {
  let service: GoogleDriveSyncService;
  let mockSupabaseClient: SupabaseClient;
  let mockLogger: Partial<Logger>;

  // Sample test data
  const sampleDriveFiles = [
    {
      id: 'file-1',
      name: 'Document.pdf',
      mimeType: 'application/pdf',
      parents: ['folder-1'],
      modifiedTime: '2024-01-01T10:00:00Z',
      size: '1024',
      webViewLink: 'https://drive.google.com/file/1',
      trashed: false
    },
    {
      id: 'folder-2',
      name: 'Subfolder',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['folder-1'],
      modifiedTime: '2024-01-01T09:00:00Z',
      webViewLink: 'https://drive.google.com/folder/2',
      trashed: false
    }
  ];

  const sampleDbFiles = [
    {
      id: 'db-1',
      drive_id: 'file-1',
      name: 'Document.pdf',
      mime_type: 'application/pdf',
      parent_folder_id: 'folder-1',
      modified_time: '2024-01-01T09:00:00Z',
      is_deleted: false
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabaseClient = createMockSupabaseClient();
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };
    
    // Reset Google Drive service mocks
    (mockGoogleDriveService.listFiles as MockedFunction<any>).mockResolvedValue(sampleDriveFiles);
    (mockGoogleDriveService.listFolderContents as MockedFunction<any>).mockResolvedValue(sampleDriveFiles);
    
    service = new GoogleDriveSyncService(
      mockSupabaseClient,
      mockGoogleDriveService,
      mockLogger as Logger
    );
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(service.ensureInitialized()).resolves.not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith('GoogleDriveSyncService initialized');
    });

    it('should clear state on initialization', async () => {
      await service.ensureInitialized();
      
      // State should be cleared
      const health = await service.healthCheck();
      expect(health.details?.pathCacheSize).toBe(0);
      expect(health.details?.activeSyncId).toBeNull();
      expect(health.details?.syncInProgress).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when all tables are accessible', async () => {
      (mockSupabaseClient as any).limit.mockResolvedValue({
        data: null,
        error: null,
        count: 100
      });

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.serviceName).toBe('GoogleDriveSyncService');
      expect(health.details).toMatchObject({
        pathCacheSize: 0,
        activeSyncId: null,
        syncInProgress: false,
        totalFiles: 100,
        tablesHealthy: {
          google_sources: true,
          google_sync_history: true
        }
      });
    });

    it('should return unhealthy status when database error occurs', async () => {
      const dbError = new Error('Database connection failed');
      (mockSupabaseClient as any).limit.mockResolvedValue({
        data: null,
        error: dbError,
        count: null
      });

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Database connection failed');
    });

    it('should report sync progress in health check', async () => {
      await service.ensureInitialized();
      
      // Start a sync to create active state
      const syncPromise = service.syncFiles('folder-1', { dryRun: true });
      
      // Check health while sync is in progress
      const health = await service.healthCheck();
      expect(health.details?.syncInProgress).toBe(true);
      
      await syncPromise;
    });
  });

  describe('File Synchronization', () => {
    beforeEach(() => {
      // Mock sync history creation
      (mockSupabaseClient as any).single.mockResolvedValue({
        data: { id: 'sync-123', folder_id: 'folder-1' },
        error: null
      });
      
      // Mock existing files query
      (mockSupabaseClient as any).select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          data: sampleDbFiles,
          error: null
        })
      });
    });

    it('should sync files from Google Drive successfully', async () => {
      const result = await service.syncFiles('folder-1');
      
      expect(result.success).toBe(true);
      expect(result.stats.filesFound).toBe(1); // Only Document.pdf is a file
      expect(result.stats.foldersFound).toBe(1); // Subfolder
      expect(mockGoogleDriveService.listFiles).toHaveBeenCalledWith({
        q: "'folder-1' in parents and trashed = false",
        fields: expect.any(String)
      });
    });

    it('should handle dry run mode', async () => {
      const result = await service.syncFiles('folder-1', { dryRun: true });
      
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      
      // Should not perform actual database updates
      expect(mockSupabaseClient.insert).not.toHaveBeenCalled();
      expect(mockSupabaseClient.update).not.toHaveBeenCalled();
    });

    it('should sync recursively when enabled', async () => {
      const result = await service.syncFiles('folder-1', { 
        recursive: true,
        maxDepth: 3
      });
      
      expect(result.success).toBe(true);
      
      // Should process subfolders
      expect(mockGoogleDriveService.listFiles).toHaveBeenCalledTimes(2); // Root + subfolder
    });

    it('should respect max depth limit', async () => {
      const deepFolderStructure = [
        { id: 'f1', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] },
        { id: 'f2', mimeType: 'application/vnd.google-apps.folder', parents: ['f1'] },
        { id: 'f3', mimeType: 'application/vnd.google-apps.folder', parents: ['f2'] }
      ];

      (mockGoogleDriveService.listFiles as MockedFunction<any>)
        .mockImplementation(async ({ q }) => {
          const parentMatch = q.match(/'([^']+)' in parents/);
          if (parentMatch) {
            const parentId = parentMatch[1];
            return deepFolderStructure.filter(f => f.parents.includes(parentId));
          }
          return [];
        });

      const result = await service.syncFiles('root', { 
        recursive: true,
        maxDepth: 2 
      });
      
      expect(result.success).toBe(true);
      // Should stop at maxDepth
      expect(mockGoogleDriveService.listFiles).toHaveBeenCalledTimes(2);
    });

    it('should handle progress callbacks', async () => {
      const onProgress = vi.fn();
      
      await service.syncFiles('folder-1', { 
        onProgress,
        batchSize: 1 // Process one at a time to ensure multiple callbacks
      });
      
      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        phase: expect.any(String),
        current: expect.any(Number),
        total: expect.any(Number),
        percentage: expect.any(Number)
      }));
    });

    it('should validate folder ID', async () => {
      await expect(service.syncFiles('')).rejects.toThrow('Folder ID is required');
      await expect(service.syncFiles('  ')).rejects.toThrow('Folder ID is required');
    });
  });

  describe('Conflict Resolution', () => {
    beforeEach(() => {
      // Mock sync history
      (mockSupabaseClient as any).single.mockResolvedValue({
        data: { id: 'sync-123' },
        error: null
      });
    });

    it('should merge conflicts by default', async () => {
      const existingFile = {
        ...sampleDbFiles[0],
        modified_time: '2023-12-01T10:00:00Z' // Older than Drive version
      };

      (mockSupabaseClient as any).select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          data: [existingFile],
          error: null
        })
      });

      const result = await service.syncFiles('folder-1', {
        conflictStrategy: 'merge'
      });
      
      expect(result.stats.filesUpdated).toBe(1);
      expect(mockSupabaseClient.update).toHaveBeenCalled();
    });

    it('should skip conflicts when strategy is skip', async () => {
      (mockSupabaseClient as any).select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          data: sampleDbFiles,
          error: null
        })
      });

      const result = await service.syncFiles('folder-1', {
        conflictStrategy: 'skip'
      });
      
      expect(result.stats.filesSkipped).toBe(1);
      expect(mockSupabaseClient.update).not.toHaveBeenCalled();
    });

    it('should overwrite on conflicts when strategy is overwrite', async () => {
      (mockSupabaseClient as any).select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          data: sampleDbFiles,
          error: null
        })
      });

      const result = await service.syncFiles('folder-1', {
        conflictStrategy: 'overwrite'
      });
      
      expect(result.stats.filesUpdated).toBe(1);
      expect(mockSupabaseClient.update).toHaveBeenCalled();
    });
  });

  describe('Batch Processing', () => {
    it('should process files in batches', async () => {
      const manyFiles = Array.from({ length: 250 }, (_, i) => ({
        id: `file-${i}`,
        name: `File ${i}.txt`,
        mimeType: 'text/plain',
        parents: ['folder-1'],
        modifiedTime: '2024-01-01T10:00:00Z',
        trashed: false
      }));

      (mockGoogleDriveService.listFiles as MockedFunction<any>).mockResolvedValue(manyFiles);
      
      // Mock empty existing files
      (mockSupabaseClient as any).select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          data: [],
          error: null
        })
      });

      const result = await service.syncFiles('folder-1', {
        batchSize: 50
      });
      
      expect(result.success).toBe(true);
      expect(result.stats.filesFound).toBe(250);
      
      // Should have processed in batches
      expect(mockSupabaseClient.insert).toHaveBeenCalledTimes(Math.ceil(250 / 50));
    });

    it('should handle batch processing errors gracefully', async () => {
      (mockSupabaseClient as any).insert.mockResolvedValueOnce({
        data: null,
        error: new Error('Batch insert failed')
      });

      const result = await service.syncFiles('folder-1');
      
      expect(result.success).toBe(true); // Should continue despite error
      expect(result.stats.errors.length).toBeGreaterThan(0);
      expect(result.stats.errors[0]).toContain('Batch insert failed');
    });
  });

  describe('Path Resolution', () => {
    it('should build and cache file paths', async () => {
      await service.syncFiles('folder-1');
      
      // Path resolution should have been called
      const health = await service.healthCheck();
      expect(health.details?.pathCacheSize).toBeGreaterThan(0);
    });

    it('should resolve paths recursively', async () => {
      const nestedFile = {
        id: 'nested-file',
        name: 'Nested.txt',
        mimeType: 'text/plain',
        parents: ['folder-2'], // Parent is subfolder
        modifiedTime: '2024-01-01T11:00:00Z',
        trashed: false
      };

      (mockGoogleDriveService.listFiles as MockedFunction<any>)
        .mockResolvedValueOnce(sampleDriveFiles) // Root folder
        .mockResolvedValueOnce([nestedFile]); // Subfolder contents

      const result = await service.syncFiles('folder-1', { recursive: true });
      
      expect(result.success).toBe(true);
      expect(result.stats.filesFound).toBe(2); // Document.pdf + Nested.txt
    });
  });

  describe('Cleanup Operations', () => {
    it('should clean up deleted files', async () => {
      const deletedFiles = [
        { ...sampleDbFiles[0], is_deleted: false, drive_id: 'deleted-file' }
      ];

      (mockSupabaseClient as any).select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            data: deletedFiles,
            error: null
          })
        })
      });

      // Mock no files from Drive (all deleted)
      (mockGoogleDriveService.listFiles as MockedFunction<any>).mockResolvedValue([]);

      const result = await service.cleanupDeletedFiles('folder-1');
      
      expect(result.success).toBe(true);
      expect(result.filesMarkedDeleted).toBe(1);
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        is_deleted: true,
        deleted_at: expect.any(String)
      });
    });

    it('should handle cleanup options', async () => {
      const oldDeletedFiles = [
        {
          id: 'old-1',
          drive_id: 'old-file',
          is_deleted: true,
          deleted_at: '2023-01-01T00:00:00Z'
        }
      ];

      (mockSupabaseClient as any).select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            data: oldDeletedFiles,
            error: null
          })
        })
      });

      const result = await service.cleanupDeletedFiles('folder-1', {
        permanentlyDelete: true,
        deletedBefore: new Date('2024-01-01')
      });
      
      expect(result.filesDeleted).toBe(1);
      expect(mockSupabaseClient.delete).toHaveBeenCalled();
    });

    it('should handle dry run for cleanup', async () => {
      const result = await service.cleanupDeletedFiles('folder-1', {
        permanentlyDelete: true,
        dryRun: true
      });
      
      expect(result.dryRun).toBe(true);
      expect(mockSupabaseClient.delete).not.toHaveBeenCalled();
    });
  });

  describe('Change Detection', () => {
    it('should sync only changed files when using changeToken', async () => {
      const changes = {
        files: [sampleDriveFiles[0]],
        nextPageToken: 'next-token-123',
        newStartPageToken: 'new-start-token'
      };

      (mockGoogleDriveService.getChanges as MockedFunction<any>).mockResolvedValue(changes);

      const result = await service.syncChanges('existing-token');
      
      expect(result.success).toBe(true);
      expect(result.nextChangeToken).toBe('new-start-token');
      expect(mockGoogleDriveService.getChanges).toHaveBeenCalledWith('existing-token');
    });

    it('should get initial change token', async () => {
      (mockGoogleDriveService.getChanges as MockedFunction<any>).mockResolvedValue({
        startPageToken: 'initial-token'
      });

      const token = await service.getInitialChangeToken();
      
      expect(token).toBe('initial-token');
    });
  });

  describe('Error Handling', () => {
    it('should handle Google Drive API errors', async () => {
      (mockGoogleDriveService.listFiles as MockedFunction<any>).mockRejectedValue(
        new Error('API quota exceeded')
      );

      const result = await service.syncFiles('folder-1');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('API quota exceeded');
    });

    it('should handle database errors gracefully', async () => {
      (mockSupabaseClient as any).insert.mockResolvedValue({
        data: null,
        error: new Error('Database connection lost')
      });

      const result = await service.syncFiles('folder-1');
      
      expect(result.success).toBe(true); // Should continue
      expect(result.stats.errors.length).toBeGreaterThan(0);
    });

    it('should retry transient errors', async () => {
      let attempts = 0;
      (mockSupabaseClient as any).single.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({
            data: null,
            error: new Error('Transient error')
          });
        }
        return Promise.resolve({
          data: { id: 'sync-123' },
          error: null
        });
      });

      const result = await service.syncFiles('folder-1');
      
      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });
  });

  describe('Resume Capability', () => {
    it('should save sync state periodically', async () => {
      // Create many files to ensure state saving
      const manyFiles = Array.from({ length: 100 }, (_, i) => ({
        id: `file-${i}`,
        name: `File ${i}.txt`,
        mimeType: 'text/plain',
        parents: ['folder-1'],
        trashed: false
      }));

      (mockGoogleDriveService.listFiles as MockedFunction<any>).mockResolvedValue(manyFiles);

      await service.syncFiles('folder-1', { batchSize: 10 });
      
      // Should have saved state during processing
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          state: expect.any(Object),
          last_activity: expect.any(String)
        })
      );
    });

    it('should resume from saved state', async () => {
      const savedState = {
        processedFiles: ['file-1', 'file-2'],
        currentPhase: 'syncing',
        stats: { filesFound: 2, filesInserted: 2 }
      };

      // Mock existing sync with state
      (mockSupabaseClient as any).single.mockResolvedValueOnce({
        data: {
          id: 'sync-123',
          state: savedState,
          folder_id: 'folder-1'
        },
        error: null
      });

      const result = await service.resumeSync('sync-123');
      
      expect(result.success).toBe(true);
      expect(result.resumed).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should handle large file sets efficiently', async () => {
      const largeFileSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `file-${i}`,
        name: `File ${i}.txt`,
        mimeType: 'text/plain',
        parents: ['folder-1'],
        modifiedTime: new Date().toISOString(),
        trashed: false
      }));

      (mockGoogleDriveService.listFiles as MockedFunction<any>).mockResolvedValue(largeFileSet);
      
      const startTime = Date.now();
      const result = await service.syncFiles('folder-1', { batchSize: 100 });
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.stats.filesFound).toBe(1000);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should use path cache for performance', async () => {
      // First sync to populate cache
      await service.syncFiles('folder-1');
      
      // Second sync should use cache
      const startTime = Date.now();
      await service.syncFiles('folder-1');
      const duration = Date.now() - startTime;
      
      // Second sync should be faster due to caching
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Cleanup on Shutdown', () => {
    it('should save state on shutdown if sync is active', async () => {
      // Start a sync
      const syncPromise = service.syncFiles('folder-1');
      
      // Shutdown while sync is in progress
      await service.shutdown();
      
      // Should have saved state
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          state: expect.any(Object)
        })
      );
      
      await syncPromise.catch(() => {}); // Ignore any errors from interrupted sync
    });

    it('should clear caches on shutdown', async () => {
      await service.syncFiles('folder-1');
      
      const healthBefore = await service.healthCheck();
      expect(healthBefore.details?.pathCacheSize).toBeGreaterThan(0);
      
      await service.shutdown();
      await service.ensureInitialized();
      
      const healthAfter = await service.healthCheck();
      expect(healthAfter.details?.pathCacheSize).toBe(0);
    });
  });
});