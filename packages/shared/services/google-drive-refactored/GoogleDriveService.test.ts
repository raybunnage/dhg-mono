import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GoogleDriveService } from './GoogleDriveService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../logger-service/LoggerService';
import GoogleAuthService from '../google-drive/google-auth-service';

// Mock Google Auth Service
const mockAuthService = {
  getAccessToken: vi.fn(),
  hasValidToken: vi.fn()
} as unknown as GoogleAuthService;

// Mock Supabase client
const mockSupabase = {
  from: vi.fn()
} as unknown as SupabaseClient;

// Mock logger
const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
} as unknown as Logger;

// Mock fetch
global.fetch = vi.fn();

describe('GoogleDriveService', () => {
  let service: GoogleDriveService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance
    (GoogleDriveService as any).instance = null;
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const config = {
        authService: mockAuthService,
        supabaseClient: mockSupabase,
        logger: mockLogger
      };
      
      const instance1 = GoogleDriveService.getInstance(config);
      const instance2 = GoogleDriveService.getInstance(config);
      
      expect(instance1).toBe(instance2);
      service = instance1; // For cleanup
    });

    it('should accept configuration on first call', () => {
      const config = {
        authService: mockAuthService,
        supabaseClient: mockSupabase,
        logger: mockLogger
      };
      
      service = GoogleDriveService.getInstance(config);
      expect(service).toBeInstanceOf(GoogleDriveService);
    });
  });

  describe('Service Lifecycle', () => {
    beforeEach(() => {
      const config = {
        authService: mockAuthService,
        supabaseClient: mockSupabase,
        logger: mockLogger
      };
      service = GoogleDriveService.getInstance(config);
    });

    it('should handle health check when healthy', async () => {
      // Mock auth service response
      mockAuthService.hasValidToken.mockResolvedValue(true);
      mockAuthService.getAccessToken.mockResolvedValue('test-token');
      
      // Mock API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { emailAddress: 'test@example.com' } })
      });
      
      // Mock database response
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          count: 100,
          error: null
        })
      });
      (mockSupabase.from as any).mockReturnValue(mockFrom());

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.details.authService).toBe('healthy');
      expect(health.details.apiConnection).toBe('healthy');
      expect(health.details.database).toBe('healthy');
      expect(health.details.metrics).toBeDefined();
    });

    it('should handle health check when unhealthy', async () => {
      // Mock auth service failure
      mockAuthService.hasValidToken.mockResolvedValue(false);
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.authService).toBe('unhealthy');
    });
  });

  describe('API Operations', () => {
    beforeEach(() => {
      const config = {
        authService: mockAuthService,
        supabaseClient: mockSupabase,
        logger: mockLogger
      };
      service = GoogleDriveService.getInstance(config);
      mockAuthService.getAccessToken.mockResolvedValue('test-token');
    });

    describe('listFiles', () => {
      it('should list files in a folder', async () => {
        const mockFiles = {
          files: [
            { id: '1', name: 'file1.txt', mimeType: 'text/plain' },
            { id: '2', name: 'file2.pdf', mimeType: 'application/pdf' }
          ],
          nextPageToken: 'next-token'
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockFiles
        });

        const result = await service.listFiles('folder-id');
        
        expect(result.files).toEqual(mockFiles.files);
        expect(result.nextPageToken).toBe('next-token');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'GoogleDriveService: Listing files',
          expect.any(Object)
        );
      });

      it('should handle API errors', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: async () => 'Forbidden'
        });

        await expect(service.listFiles('folder-id')).rejects.toThrow('Google Drive API error: 403 Forbidden');
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should support pagination', async () => {
        const mockFiles = {
          files: [{ id: '3', name: 'file3.doc' }]
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockFiles
        });

        await service.listFiles('folder-id', { pageToken: 'page-2' });
        
        const fetchCall = (global.fetch as any).mock.calls[0];
        expect(fetchCall[0]).toContain('pageToken=page-2');
      });
    });

    describe('listFolders', () => {
      it('should list only folders', async () => {
        const mockFolders = {
          files: [
            { id: '1', name: 'folder1', mimeType: 'application/vnd.google-apps.folder' },
            { id: '2', name: 'folder2', mimeType: 'application/vnd.google-apps.folder' }
          ]
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockFolders
        });

        const folders = await service.listFolders('parent-folder-id');
        
        expect(folders).toEqual(mockFolders.files);
        const fetchCall = (global.fetch as any).mock.calls[0];
        expect(fetchCall[0]).toContain('mimeType%20%3D%20%27application%2Fvnd.google-apps.folder%27');
      });
    });

    describe('getFile', () => {
      it('should get file metadata', async () => {
        const mockFile = {
          id: 'file-id',
          name: 'test.txt',
          mimeType: 'text/plain',
          size: 1024
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockFile
        });

        const file = await service.getFile('file-id');
        
        expect(file).toEqual(mockFile);
      });

      it('should use cache for repeated requests', async () => {
        const mockFile = {
          id: 'file-id',
          name: 'cached.txt'
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockFile
        });

        // First call - should hit API
        const file1 = await service.getFile('file-id');
        expect(file1).toEqual(mockFile);
        
        // Second call - should use cache
        const file2 = await service.getFile('file-id');
        expect(file2).toEqual(mockFile);
        
        // Fetch should only be called once
        expect(global.fetch).toHaveBeenCalledTimes(1);
        
        const metrics = service.getMetrics();
        expect(metrics.cacheHits).toBe(1);
        expect(metrics.cacheMisses).toBe(1);
      });
    });

    describe('downloadFile', () => {
      it('should download file content', async () => {
        const mockContent = new ArrayBuffer(1024);
        
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => mockContent
        });

        const content = await service.downloadFile('file-id');
        
        expect(content).toBe(mockContent);
        expect(content.byteLength).toBe(1024);
        
        const metrics = service.getMetrics();
        expect(metrics.bytesProcessed).toBe(1024);
      });

      it('should handle download errors', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 404
        });

        await expect(service.downloadFile('file-id')).rejects.toThrow('Failed to download file: 404');
      });
    });

    describe('exportFile', () => {
      it('should export Google Docs files', async () => {
        const mockPdfContent = new ArrayBuffer(2048);
        
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => mockPdfContent
        });

        const content = await service.exportFile('doc-id', 'application/pdf');
        
        expect(content).toBe(mockPdfContent);
        expect(content.byteLength).toBe(2048);
        
        const fetchCall = (global.fetch as any).mock.calls[0];
        expect(fetchCall[0]).toContain('/export?mimeType=application%2Fpdf');
      });
    });
  });

  describe('Database Operations', () => {
    beforeEach(() => {
      const config = {
        authService: mockAuthService,
        supabaseClient: mockSupabase,
        logger: mockLogger
      };
      service = GoogleDriveService.getInstance(config);
    });

    describe('getRootFolders', () => {
      it('should get root folders from database', async () => {
        const mockFolders = [
          { id: '1', folder_id: 'folder-1', name: 'Root 1' },
          { id: '2', folder_id: 'folder-2', name: 'Root 2' }
        ];

        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockFolders,
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const folders = await service.getRootFolders();
        
        expect(folders).toEqual(mockFolders);
        expect(mockSupabase.from).toHaveBeenCalledWith('google_root_folders');
      });

      it('should handle database errors', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        await expect(service.getRootFolders()).rejects.toThrow();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('addRootFolder', () => {
      it('should add a root folder', async () => {
        const newFolder = {
          id: 'new-id',
          folder_id: 'folder-3',
          name: 'New Root'
        };

        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: newFolder,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const folder = await service.addRootFolder('folder-3', 'New Root');
        
        expect(folder).toEqual(newFolder);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'GoogleDriveService: Adding root folder',
          expect.any(Object)
        );
      });
    });

    describe('removeRootFolder', () => {
      it('should remove a root folder', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        await service.removeRootFolder('folder-id');
        
        expect(mockSupabase.from).toHaveBeenCalledWith('google_root_folders');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'GoogleDriveService: Removing root folder',
          expect.objectContaining({ id: 'folder-id' })
        );
      });
    });
  });

  describe('Sync Operations', () => {
    beforeEach(() => {
      const config = {
        authService: mockAuthService,
        supabaseClient: mockSupabase,
        logger: mockLogger
      };
      service = GoogleDriveService.getInstance(config);
    });

    it('should return sync statistics', async () => {
      const stats = await service.syncFolder('folder-id');
      
      expect(stats).toMatchObject({
        filesFound: 0,
        filesInserted: 0,
        filesUpdated: 0,
        filesSkipped: 0,
        filesDeleted: 0,
        foldersFound: 0,
        startTime: expect.any(Date),
        endTime: expect.any(Date)
      });
    });

    it('should handle sync errors gracefully', async () => {
      // Force an error by mocking something in the sync process
      const stats = await service.syncFolder('folder-id');
      
      expect(stats.endTime).toBeDefined();
      expect(Array.isArray(stats.errors)).toBe(true);
    });
  });

  describe('Metrics', () => {
    beforeEach(() => {
      const config = {
        authService: mockAuthService,
        supabaseClient: mockSupabase,
        logger: mockLogger
      };
      service = GoogleDriveService.getInstance(config);
      mockAuthService.getAccessToken.mockResolvedValue('test-token');
    });

    it('should track API calls', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ files: [] })
      });

      await service.listFiles('folder-id');
      await service.listFiles('folder-id');
      
      const metrics = service.getMetrics();
      expect(metrics.apiCalls).toBe(2);
    });

    it('should track errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error'
      });

      try {
        await service.listFiles('folder-id');
      } catch (e) {
        // Expected
      }
      
      const metrics = service.getMetrics();
      expect(metrics.errorsEncountered).toBeGreaterThan(0);
    });

    it('should track bytes processed', async () => {
      const mockContent = new ArrayBuffer(1024);
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        arrayBuffer: async () => mockContent
      });

      await service.downloadFile('file-1');
      await service.downloadFile('file-2');
      
      const metrics = service.getMetrics();
      expect(metrics.bytesProcessed).toBe(2048);
    });
  });

  describe('Cache Management', () => {
    beforeEach(() => {
      const config = {
        authService: mockAuthService,
        supabaseClient: mockSupabase,
        logger: mockLogger
      };
      service = GoogleDriveService.getInstance(config);
    });

    it('should clear cache manually', async () => {
      mockAuthService.getAccessToken.mockResolvedValue('test-token');
      
      // Add something to cache
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-1', name: 'cached.txt' })
      });
      
      await service.getFile('file-1');
      
      // Clear cache
      service.clearCache();
      
      // Next call should hit API again
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-1', name: 'cached.txt' })
      });
      
      await service.getFile('file-1');
      
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      const config = {
        authService: mockAuthService,
        supabaseClient: mockSupabase,
        logger: mockLogger
      };
      service = GoogleDriveService.getInstance(config);
    });

    it('should handle missing access token', async () => {
      mockAuthService.getAccessToken.mockResolvedValue(null);
      
      await expect(service.listFiles('folder-id')).rejects.toThrow('No valid access token available');
    });

    it('should handle network errors', async () => {
      mockAuthService.getAccessToken.mockResolvedValue('test-token');
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      
      await expect(service.listFiles('folder-id')).rejects.toThrow('Network error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});