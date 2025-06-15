import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { GoogleDriveService, GoogleDriveFile, RootFolder, SyncOptions, SyncStats } from '../GoogleDriveService';
import { GoogleAuthService } from '../../google-auth-refactored/GoogleAuthService';
import { SingletonService } from '../../base-classes/SingletonService';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock fetch globally
global.fetch = vi.fn();

// Mock GoogleAuthService
vi.mock('../../google-auth-refactored/GoogleAuthService', () => ({
  GoogleAuthService: vi.fn().mockImplementation(() => ({
    getAccessToken: vi.fn(),
    hasValidToken: vi.fn()
  }))
}));

describe('GoogleDriveService', () => {
  let service: GoogleDriveService;
  let mockAuthService: any;
  let mockSupabaseClient: any;
  let mockLogger: any;
  
  // Helper to create mock responses
  const createMockResponse = (data: any, ok = true, status = 200) => ({
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
  });

  beforeEach(() => {
    // Clear singleton instances
    (SingletonService as any).instances.clear();
    (GoogleDriveService as any).instance = null;
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    };
    
    // Setup mock auth service
    mockAuthService = {
      getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
      hasValidToken: vi.fn().mockResolvedValue(true)
    };
    
    // Setup mock Supabase client
    mockSupabaseClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis()
    };
  });

  afterEach(async () => {
    // Cleanup singleton instances
    await SingletonService.shutdownAll();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const config = {
        authService: mockAuthService,
        supabaseClient: mockSupabaseClient,
        logger: mockLogger
      };
      
      const instance1 = GoogleDriveService.getInstance(config);
      const instance2 = GoogleDriveService.getInstance(config);
      
      expect(instance1).toBe(instance2);
    });

    it('should extend SingletonService', () => {
      service = GoogleDriveService.getInstance({
        authService: mockAuthService,
        supabaseClient: mockSupabaseClient,
        logger: mockLogger
      });
      
      expect(service).toBeInstanceOf(SingletonService);
    });
  });

  describe('Initialization', () => {
    beforeEach(() => {
      service = GoogleDriveService.getInstance({
        authService: mockAuthService,
        supabaseClient: mockSupabaseClient,
        logger: mockLogger
      });
    });

    it('should initialize successfully with required dependencies', async () => {
      await (service as any).ensureInitialized();
      
      expect(mockLogger.info).toHaveBeenCalledWith('GoogleDriveService: Initializing service');
      expect((service as any).initialized).toBe(true);
    });

    it('should throw error if auth service is missing', async () => {
      service = GoogleDriveService.getInstance({
        authService: null as any,
        supabaseClient: mockSupabaseClient,
        logger: mockLogger
      });
      
      await expect((service as any).ensureInitialized()).rejects.toThrow('GoogleDriveService: AuthService is required');
    });
  });

  describe('File Operations', () => {
    beforeEach(async () => {
      service = GoogleDriveService.getInstance({
        authService: mockAuthService,
        supabaseClient: mockSupabaseClient,
        logger: mockLogger
      });
      await (service as any).ensureInitialized();
    });

    describe('listFiles', () => {
      it('should list files successfully', async () => {
        const mockFiles = {
          files: [
            { id: 'file1', name: 'test.txt', mimeType: 'text/plain' },
            { id: 'file2', name: 'image.png', mimeType: 'image/png' }
          ],
          nextPageToken: 'next-token'
        };
        
        (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
          createMockResponse(mockFiles) as any
        );
        
        const result = await service.listFiles('folder123');
        
        expect(result.files).toHaveLength(2);
        expect(result.nextPageToken).toBe('next-token');
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/files?'),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer mock-access-token'
            })
          })
        );
      });

      it('should handle API errors', async () => {
        (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
          createMockResponse({ error: 'Not found' }, false, 404) as any
        );
        
        await expect(service.listFiles('folder123')).rejects.toThrow('Google Drive API error: 404');
      });

      it('should use custom options', async () => {
        const mockFiles = { files: [], nextPageToken: null };
        (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
          createMockResponse(mockFiles) as any
        );
        
        await service.listFiles('folder123', {
          pageSize: 50,
          pageToken: 'token123',
          orderBy: 'modifiedTime desc',
          q: 'name contains "test"'
        });
        
        const url = (global.fetch as MockedFunction<typeof fetch>).mock.calls[0][0] as string;
        expect(url).toContain('pageSize=50');
        expect(url).toContain('pageToken=token123');
        expect(url).toContain('orderBy=modifiedTime%20desc');
        expect(url).toContain('q=name%20contains%20%22test%22');
      });
    });

    describe('listFolders', () => {
      it('should list only folders', async () => {
        const mockFolders = {
          files: [
            { id: 'folder1', name: 'Documents', mimeType: 'application/vnd.google-apps.folder' },
            { id: 'folder2', name: 'Images', mimeType: 'application/vnd.google-apps.folder' }
          ]
        };
        
        (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
          createMockResponse(mockFolders) as any
        );
        
        const result = await service.listFolders('root');
        
        expect(result).toHaveLength(2);
        expect(result[0].mimeType).toBe('application/vnd.google-apps.folder');
        
        const url = (global.fetch as MockedFunction<typeof fetch>).mock.calls[0][0] as string;
        expect(url).toContain('mimeType%20%3D%20%27application%2Fvnd.google-apps.folder%27');
      });
    });

    describe('getFile', () => {
      it('should get file metadata', async () => {
        const mockFile = {
          id: 'file123',
          name: 'test.txt',
          mimeType: 'text/plain',
          size: 1024
        };
        
        (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
          createMockResponse(mockFile) as any
        );
        
        const result = await service.getFile('file123');
        
        expect(result).toEqual(mockFile);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/files/file123?'),
          expect.any(Object)
        );
      });

      it('should use cache for repeated requests', async () => {
        const mockFile = { id: 'file123', name: 'test.txt' };
        
        (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
          createMockResponse(mockFile) as any
        );
        
        // First call - should hit API
        await service.getFile('file123');
        expect(global.fetch).toHaveBeenCalledTimes(1);
        
        // Second call - should use cache
        const cached = await service.getFile('file123');
        expect(cached).toEqual(mockFile);
        expect(global.fetch).toHaveBeenCalledTimes(1); // No additional API call
        
        // Verify metrics
        const metrics = service.getMetrics();
        expect(metrics.cacheHits).toBe(1);
        expect(metrics.cacheMisses).toBe(1);
      });
    });

    describe('downloadFile', () => {
      it('should download file content', async () => {
        const mockArrayBuffer = new ArrayBuffer(1024);
        (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer)
        } as any);
        
        const result = await service.downloadFile('file123');
        
        expect(result).toBe(mockArrayBuffer);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/files/file123?alt=media'),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer mock-access-token'
            })
          })
        );
        
        const metrics = service.getMetrics();
        expect(metrics.bytesProcessed).toBe(1024);
      });

      it('should handle download errors', async () => {
        (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: false,
          status: 403
        } as any);
        
        await expect(service.downloadFile('file123')).rejects.toThrow('Failed to download file: 403');
      });
    });

    describe('exportFile', () => {
      it('should export Google Docs files', async () => {
        const mockArrayBuffer = new ArrayBuffer(2048);
        (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer)
        } as any);
        
        const result = await service.exportFile('doc123', 'application/pdf');
        
        expect(result).toBe(mockArrayBuffer);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/files/doc123/export?mimeType=application%2Fpdf'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Folder Operations', () => {
    beforeEach(async () => {
      service = GoogleDriveService.getInstance({
        authService: mockAuthService,
        supabaseClient: mockSupabaseClient,
        logger: mockLogger
      });
      await (service as any).ensureInitialized();
    });

    describe('getRootFolders', () => {
      it('should get root folders from database', async () => {
        const mockRootFolders: RootFolder[] = [
          {
            id: 'uuid1',
            folder_id: 'folder1',
            name: 'Main Drive',
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
            last_synced: null
          }
        ];
        
        mockSupabaseClient.select.mockResolvedValueOnce({
          data: mockRootFolders,
          error: null
        });
        
        const result = await service.getRootFolders();
        
        expect(result).toEqual(mockRootFolders);
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('google_root_folders');
        expect(mockSupabaseClient.order).toHaveBeenCalledWith('name');
      });

      it('should handle database errors', async () => {
        mockSupabaseClient.select.mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' }
        });
        
        await expect(service.getRootFolders()).rejects.toThrow();
      });
    });

    describe('addRootFolder', () => {
      it('should add root folder to database', async () => {
        const newFolder: RootFolder = {
          id: 'uuid1',
          folder_id: 'folder123',
          name: 'New Folder',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          last_synced: null
        };
        
        mockSupabaseClient.single.mockResolvedValueOnce({
          data: newFolder,
          error: null
        });
        
        const result = await service.addRootFolder('folder123', 'New Folder');
        
        expect(result).toEqual(newFolder);
        expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
          folder_id: 'folder123',
          name: 'New Folder'
        });
      });
    });

    describe('removeRootFolder', () => {
      it('should remove root folder from database', async () => {
        mockSupabaseClient.eq.mockResolvedValueOnce({
          data: null,
          error: null
        });
        
        await service.removeRootFolder('uuid1');
        
        expect(mockSupabaseClient.delete).toHaveBeenCalled();
        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'uuid1');
      });
    });
  });

  describe('Sync Operations', () => {
    beforeEach(async () => {
      service = GoogleDriveService.getInstance({
        authService: mockAuthService,
        supabaseClient: mockSupabaseClient,
        logger: mockLogger
      });
      await (service as any).ensureInitialized();
    });

    it('should sync folder with basic stats', async () => {
      const options: SyncOptions = {
        recursive: true,
        maxDepth: 3,
        batchSize: 100
      };
      
      const progressCallback = vi.fn();
      
      const stats = await service.syncFolder('folder123', options, progressCallback);
      
      expect(stats).toMatchObject({
        filesFound: 0,
        filesInserted: 0,
        filesUpdated: 0,
        filesSkipped: 0,
        filesDeleted: 0,
        foldersFound: 0,
        errors: [],
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        totalSize: 0,
        fileTypes: {}
      });
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      service = GoogleDriveService.getInstance({
        authService: mockAuthService,
        supabaseClient: mockSupabaseClient,
        logger: mockLogger
      });
      await (service as any).ensureInitialized();
    });

    it('should report healthy when all checks pass', async () => {
      // Mock successful API call
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        createMockResponse({ user: { emailAddress: 'test@example.com' } }) as any
      );
      
      // Mock successful database query
      mockSupabaseClient.select.mockResolvedValueOnce({
        count: 10,
        error: null
      });
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details).toMatchObject({
        authService: 'healthy',
        apiConnection: 'healthy',
        database: 'healthy',
        cacheSize: 0,
        metrics: expect.any(Object)
      });
    });

    it('should report unhealthy when auth fails', async () => {
      mockAuthService.hasValidToken.mockResolvedValueOnce(false);
      
      // API call will fail due to no auth
      mockAuthService.getAccessToken.mockResolvedValueOnce(null);
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.authService).toBe('unhealthy');
    });

    it('should report unhealthy when API fails', async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Network error')
      );
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.apiConnection).toBe('unhealthy');
    });

    it('should report unhealthy when database fails', async () => {
      // API succeeds
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        createMockResponse({ user: {} }) as any
      );
      
      // Database fails
      mockSupabaseClient.select.mockResolvedValueOnce({
        count: null,
        error: { message: 'Connection error' }
      });
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.database).toBe('unhealthy');
    });
  });

  describe('Error Handling and Metrics', () => {
    beforeEach(async () => {
      service = GoogleDriveService.getInstance({
        authService: mockAuthService,
        supabaseClient: mockSupabaseClient,
        logger: mockLogger
      });
      await (service as any).ensureInitialized();
    });

    it('should track API call metrics', async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        createMockResponse({ files: [] }) as any
      );
      
      await service.listFiles('folder123');
      
      const metrics = service.getMetrics();
      expect(metrics.apiCalls).toBe(1);
    });

    it('should track error metrics', async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('API Error')
      );
      
      try {
        await service.listFiles('folder123');
      } catch (e) {
        // Expected error
      }
      
      const metrics = service.getMetrics();
      expect(metrics.errorsEncountered).toBe(1);
    });

    it('should handle missing access token', async () => {
      mockAuthService.getAccessToken.mockResolvedValueOnce(null);
      
      await expect(service.listFiles('folder123')).rejects.toThrow('No valid access token available');
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      service = GoogleDriveService.getInstance({
        authService: mockAuthService,
        supabaseClient: mockSupabaseClient,
        logger: mockLogger
      });
      await (service as any).ensureInitialized();
    });

    it('should clear cache', async () => {
      // Add item to cache
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        createMockResponse({ id: 'file123', name: 'test.txt' }) as any
      );
      
      await service.getFile('file123');
      let metrics = service.getMetrics();
      expect(metrics.cacheMisses).toBe(1);
      
      // Clear cache
      service.clearCache();
      
      // Next request should miss cache
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        createMockResponse({ id: 'file123', name: 'test.txt' }) as any
      );
      
      await service.getFile('file123');
      metrics = service.getMetrics();
      expect(metrics.cacheMisses).toBe(2); // Two misses total
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources on shutdown', async () => {
      service = GoogleDriveService.getInstance({
        authService: mockAuthService,
        supabaseClient: mockSupabaseClient,
        logger: mockLogger
      });
      
      await (service as any).ensureInitialized();
      
      // Add some cache data
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        createMockResponse({ id: 'file123' }) as any
      );
      await service.getFile('file123');
      
      // Shutdown
      await (service as any).shutdown();
      
      expect(mockLogger.info).toHaveBeenCalledWith('GoogleDriveService: Cleaning up resources');
      expect(mockLogger.info).toHaveBeenCalledWith('GoogleDriveService: Releasing resources');
      
      // Verify cache is cleared
      const metrics = service.getMetrics();
      expect((service as any).folderCache.size).toBe(0);
    });
  });

  describe('Rate Limiting and Retries', () => {
    beforeEach(async () => {
      service = GoogleDriveService.getInstance({
        authService: mockAuthService,
        supabaseClient: mockSupabaseClient,
        logger: mockLogger
      });
      await (service as any).ensureInitialized();
    });

    it('should handle rate limit errors gracefully', async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        createMockResponse({ error: { code: 429, message: 'Rate limit exceeded' } }, false, 429) as any
      );
      
      await expect(service.listFiles('folder123')).rejects.toThrow('Google Drive API error: 429');
      
      const metrics = service.getMetrics();
      expect(metrics.errorsEncountered).toBe(1);
    });
  });

  describe('Field Formatting', () => {
    beforeEach(async () => {
      service = GoogleDriveService.getInstance({
        authService: mockAuthService,
        supabaseClient: mockSupabaseClient,
        logger: mockLogger
      });
      await (service as any).ensureInitialized();
    });

    it('should properly format fields parameter for API', async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce(
        createMockResponse({ files: [] }) as any
      );
      
      await service.listFiles('folder123', {
        fields: 'files(id,name,mimeType),nextPageToken'
      });
      
      const url = (global.fetch as MockedFunction<typeof fetch>).mock.calls[0][0] as string;
      // Should have spaces after commas for proper API formatting
      expect(url).toContain('fields=files(id%2C%20name%2C%20mimeType)%2C%20nextPageToken');
    });
  });
});