/**
 * Test suite for FileService
 */

import { describe, it, expect, beforeEach, afterEach, vi, afterAll } from 'vitest';
import { FileService } from './FileService';
import { SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs');

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn()
} as unknown as SupabaseClient;

// Mock query builder
const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis()
};

describe('FileService', () => {
  let service: FileService;
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    // Setup default mock behavior
    (mockSupabaseClient.from as any).mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.eq.mockReturnThis();
    mockQueryBuilder.order.mockReturnThis();

    // Clear singleton instance for testing
    (FileService as any).clearInstance('FileService');
    service = FileService.getInstance(mockLogger);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  afterAll(async () => {
    // Clean up all singleton instances
    await (FileService as any).shutdownAll();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = FileService.getInstance();
      const instance2 = FileService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create instance with logger', () => {
      const instance = FileService.getInstance(mockLogger);
      expect(instance).toBeInstanceOf(FileService);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when file system is accessible', async () => {
      (fs.promises as any) = {
        access: vi.fn().mockResolvedValue(undefined)
      };
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.details.fileSystemAccess).toBe(true);
    });

    it('should return unhealthy status when file system is not accessible', async () => {
      (fs.promises as any) = {
        access: vi.fn().mockRejectedValue(new Error('Access denied'))
      };
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
    });
  });

  describe('Google Drive Operations', () => {
    describe('traverseGoogleDriveFolder', () => {
      const mockFolders = [
        {
          id: 'f1',
          drive_id: 'drive_f1',
          name: 'Folder 1',
          mime_type: 'application/vnd.google-apps.folder'
        }
      ];

      const mockFiles = [
        {
          id: 'file1',
          drive_id: 'drive_file1',
          name: 'File 1.mp4',
          mime_type: 'video/mp4'
        }
      ];

      it('should traverse folders recursively', async () => {
        mockQueryBuilder.order.mockResolvedValueOnce({ 
          data: [...mockFolders, ...mockFiles], 
          error: null 
        });

        // Mock subfolder query
        mockQueryBuilder.order.mockResolvedValueOnce({ 
          data: [], 
          error: null 
        });
        
        const result = await service.traverseGoogleDriveFolder(
          mockSupabaseClient, 
          'root_drive_id'
        );
        
        expect(result.folders).toHaveLength(1);
        expect(result.files).toHaveLength(1);
        expect(result.totalItems).toBe(2);
        expect(service.getMetrics().totalGoogleDriveTraversals).toBe(2); // Root + subfolder
      });

      it('should respect maxDepth option', async () => {
        mockQueryBuilder.order.mockResolvedValue({ 
          data: mockFolders, 
          error: null 
        });
        
        const result = await service.traverseGoogleDriveFolder(
          mockSupabaseClient, 
          'root_drive_id',
          { maxDepth: 0 }
        );
        
        expect(result.folders).toHaveLength(1);
        expect(service.getMetrics().totalGoogleDriveTraversals).toBe(1);
      });

      it('should call onItemProcessed callback', async () => {
        const onItemProcessed = vi.fn();
        mockQueryBuilder.order.mockResolvedValue({ 
          data: mockFiles, 
          error: null 
        });
        
        await service.traverseGoogleDriveFolder(
          mockSupabaseClient, 
          'root_drive_id',
          { onItemProcessed }
        );
        
        expect(onItemProcessed).toHaveBeenCalledWith(mockFiles[0], 0);
      });

      it('should handle errors gracefully', async () => {
        mockQueryBuilder.order.mockResolvedValue({ 
          data: null, 
          error: { message: 'Database error' } 
        });
        
        const result = await service.traverseGoogleDriveFolder(
          mockSupabaseClient, 
          'root_drive_id'
        );
        
        expect(result.totalItems).toBe(0);
        expect(service.getMetrics().totalErrors).toBe(1);
      });
    });

    describe('getHighLevelFolders', () => {
      it('should fetch high-level folders', async () => {
        const mockHighLevelFolders = [
          { id: '1', name: 'Top Folder 1', path_depth: 0 },
          { id: '2', name: 'Top Folder 2', path_depth: 0 }
        ];
        
        mockQueryBuilder.order.mockResolvedValue({ 
          data: mockHighLevelFolders, 
          error: null 
        });
        
        const folders = await service.getHighLevelFolders(mockSupabaseClient);
        
        expect(folders).toEqual(mockHighLevelFolders);
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('path_depth', 0);
      });

      it('should filter by main video when requested', async () => {
        mockQueryBuilder.order.mockResolvedValue({ 
          data: [], 
          error: null 
        });
        
        await service.getHighLevelFolders(mockSupabaseClient, true);
        
        expect(mockQueryBuilder.not).toHaveBeenCalledWith('main_video_id', 'is', null);
      });

      it('should filter by root drive ID', async () => {
        mockQueryBuilder.order.mockResolvedValue({ 
          data: [], 
          error: null 
        });
        
        await service.getHighLevelFolders(mockSupabaseClient, false, 'root_123');
        
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('root_drive_id', 'root_123');
      });
    });

    describe('findMp4FilesRecursively', () => {
      it('should find all MP4 files recursively', async () => {
        const mockMp4Files = [
          { id: '1', name: 'video1.mp4', mime_type: 'video/mp4' },
          { id: '2', name: 'video2.mp4', mime_type: 'video/mp4' }
        ];
        
        // First call returns MP4 files and subfolders
        mockQueryBuilder.eq.mockResolvedValueOnce({ 
          data: mockMp4Files, 
          error: null 
        });
        
        // Second call returns subfolders
        mockQueryBuilder.eq.mockResolvedValueOnce({ 
          data: [{ drive_id: 'subfolder1' }], 
          error: null 
        });
        
        // Recursive calls
        mockQueryBuilder.eq.mockResolvedValueOnce({ data: [], error: null });
        mockQueryBuilder.eq.mockResolvedValueOnce({ data: [], error: null });
        
        const files = await service.findMp4FilesRecursively(
          mockSupabaseClient, 
          'folder_id'
        );
        
        expect(files).toEqual(mockMp4Files);
      });

      it('should prevent infinite loops', async () => {
        const visitedFolders = new Set(['folder_id']);
        
        const files = await service.findMp4FilesRecursively(
          mockSupabaseClient, 
          'folder_id',
          visitedFolders
        );
        
        expect(files).toEqual([]);
        expect(mockLogger.debug).toHaveBeenCalled();
      });
    });
  });

  describe('File System Operations', () => {
    describe('fileExists', () => {
      it('should return true when file exists', () => {
        (fs.existsSync as any).mockReturnValue(true);
        
        const exists = service.fileExists('/path/to/file.txt');
        
        expect(exists).toBe(true);
      });

      it('should return false when file does not exist', () => {
        (fs.existsSync as any).mockReturnValue(false);
        
        const exists = service.fileExists('/path/to/file.txt');
        
        expect(exists).toBe(false);
      });

      it('should handle errors', () => {
        (fs.existsSync as any).mockImplementation(() => {
          throw new Error('Permission denied');
        });
        
        const exists = service.fileExists('/path/to/file.txt');
        
        expect(exists).toBe(false);
        expect(service.getMetrics().totalErrors).toBe(1);
      });
    });

    describe('readFile', () => {
      it('should read file successfully', () => {
        (fs.existsSync as any).mockReturnValue(true);
        (fs.readFileSync as any).mockReturnValue('file content');
        (fs.statSync as any).mockReturnValue({
          size: 12,
          mtime: new Date()
        });
        
        const result = service.readFile('/path/to/file.txt');
        
        expect(result.success).toBe(true);
        expect(result.content).toBe('file content');
        expect(result.stats?.size).toBe(12);
        expect(service.getMetrics().totalFilesRead).toBe(1);
        expect(service.getMetrics().totalBytesRead).toBe(12);
      });

      it('should handle file not found', () => {
        (fs.existsSync as any).mockReturnValue(false);
        
        const result = service.readFile('/path/to/nonexistent.txt');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('File not found');
      });

      it('should handle read errors', () => {
        (fs.existsSync as any).mockReturnValue(true);
        (fs.readFileSync as any).mockImplementation(() => {
          throw new Error('Permission denied');
        });
        
        const result = service.readFile('/path/to/file.txt');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Permission denied');
        expect(service.getMetrics().totalErrors).toBe(1);
      });
    });

    describe('writeFile', () => {
      it('should write file successfully', () => {
        (fs.existsSync as any).mockReturnValue(true);
        (fs.writeFileSync as any).mockImplementation(() => {});
        (fs.statSync as any).mockReturnValue({
          size: 20,
          mtime: new Date()
        });
        
        const result = service.writeFile('/path/to/file.txt', 'new content');
        
        expect(result.success).toBe(true);
        expect(result.stats?.size).toBe(20);
        expect(service.getMetrics().totalFilesWritten).toBe(1);
        expect(service.getMetrics().totalBytesWritten).toBe(20);
      });

      it('should create directory if needed', () => {
        (fs.existsSync as any).mockReturnValue(false);
        (fs.mkdirSync as any).mockImplementation(() => {});
        (fs.writeFileSync as any).mockImplementation(() => {});
        (fs.statSync as any).mockReturnValue({ size: 10, mtime: new Date() });
        
        const result = service.writeFile('/new/path/file.txt', 'content');
        
        expect(result.success).toBe(true);
        expect(fs.mkdirSync).toHaveBeenCalledWith('/new/path', { recursive: true });
        expect(service.getMetrics().totalDirectoriesCreated).toBe(1);
      });
    });

    describe('findFilesLegacy', () => {
      it('should find files matching pattern', () => {
        (fs.existsSync as any).mockReturnValue(true);
        (fs.readdirSync as any).mockReturnValue([
          { name: 'test.js', isFile: () => true, isDirectory: () => false },
          { name: 'test.ts', isFile: () => true, isDirectory: () => false },
          { name: 'readme.md', isFile: () => true, isDirectory: () => false }
        ]);
        
        const files = service.findFilesLegacy('/path', /\.ts$/);
        
        expect(files).toEqual([path.join('/path', 'test.ts')]);
      });

      it('should search recursively when requested', () => {
        (fs.existsSync as any).mockReturnValue(true);
        (fs.readdirSync as any)
          .mockReturnValueOnce([
            { name: 'subdir', isFile: () => false, isDirectory: () => true },
            { name: 'file1.ts', isFile: () => true, isDirectory: () => false }
          ])
          .mockReturnValueOnce([
            { name: 'file2.ts', isFile: () => true, isDirectory: () => false }
          ]);
        
        const files = service.findFilesLegacy('/path', /\.ts$/, { recursive: true });
        
        expect(files).toHaveLength(2);
      });
    });
  });

  describe('Metrics', () => {
    it('should track all operations', () => {
      // Setup mocks
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('content');
      (fs.writeFileSync as any).mockImplementation(() => {});
      (fs.statSync as any).mockReturnValue({ size: 100, mtime: new Date() });
      mockQueryBuilder.order.mockResolvedValue({ data: [], error: null });

      // Perform operations
      service.readFile('/test.txt');
      service.writeFile('/output.txt', 'data');
      service.traverseGoogleDriveFolder(mockSupabaseClient, 'drive_id');

      const metrics = service.getMetrics();
      
      expect(metrics.totalFilesRead).toBe(1);
      expect(metrics.totalFilesWritten).toBe(1);
      expect(metrics.totalGoogleDriveTraversals).toBe(1);
      expect(metrics.totalBytesRead).toBe(100);
      expect(metrics.totalBytesWritten).toBe(100);
      expect(metrics.lastOperationTime).toBeInstanceOf(Date);
    });

    it('should track errors', () => {
      mockQueryBuilder.order.mockResolvedValue({ 
        data: null, 
        error: { message: 'Test error' } 
      });

      service.traverseGoogleDriveFolder(mockSupabaseClient, 'drive_id');
      
      const metrics = service.getMetrics();
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.lastError).toBe('Test error');
    });
  });

  describe('Resource Management', () => {
    it('should clear processed items on reset', () => {
      // Add some items
      service['processedDriveIds'].add('item1');
      service['processedDriveIds'].add('item2');
      
      service.resetProcessedItems();
      
      expect(service['processedDriveIds'].size).toBe(0);
    });

    it('should release resources on shutdown', async () => {
      service['processedDriveIds'].add('item1');
      
      await service.shutdown();
      
      expect(service['processedDriveIds'].size).toBe(0);
    });
  });
});