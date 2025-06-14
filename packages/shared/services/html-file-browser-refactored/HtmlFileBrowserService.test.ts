/**
 * HtmlFileBrowserService Tests
 */

import { HtmlFileBrowserService } from './HtmlFileBrowserService';
import * as fs from 'fs/promises';
import * as path from 'path';
import { jest } from '@jest/globals';

// Mock the fs module
jest.mock('fs/promises', () => ({
  access: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
}));

describe('HtmlFileBrowserService', () => {
  let service: HtmlFileBrowserService;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HtmlFileBrowserService({
      basePath: '/test/base',
      excludeDirs: ['node_modules', '.git'],
      maxFileSize: 1024 * 1024 // 1MB
    });
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully with valid base path', async () => {
      mockFs.access.mockResolvedValue(undefined);
      
      await service.start();
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.basePath).toBe(path.resolve('/test/base'));
    });

    it('should throw error on initialization with invalid base path', async () => {
      mockFs.access.mockRejectedValue(new Error('Path not found'));
      
      await expect(service.start()).rejects.toThrow('Cannot access base path');
    });

    it('should handle service shutdown gracefully', async () => {
      mockFs.access.mockResolvedValue(undefined);
      
      await service.start();
      await service.shutdown();
      
      expect(service.isStarted()).toBe(false);
    });
  });

  describe('Directory Listing', () => {
    beforeEach(async () => {
      mockFs.access.mockResolvedValue(undefined);
      await service.start();
    });

    it('should list directory contents successfully', async () => {
      const mockDirents = [
        { name: 'file1.txt', isDirectory: () => false },
        { name: 'folder1', isDirectory: () => true },
        { name: 'node_modules', isDirectory: () => true } // Should be excluded
      ];
      
      const mockStats = {
        size: 1024,
        mtime: new Date('2023-01-01'),
      };

      mockFs.readdir.mockResolvedValue(mockDirents as any);
      mockFs.stat.mockResolvedValue(mockStats as any);

      const result = await service.listDirectory();

      expect(result).toHaveLength(2);
      expect(result.find(item => item.name === 'file1.txt')).toBeDefined();
      expect(result.find(item => item.name === 'folder1')).toBeDefined();
      expect(result.find(item => item.name === 'node_modules')).toBeUndefined();
    });

    it('should prevent path traversal attacks', async () => {
      await expect(service.listDirectory('../../../etc')).rejects.toThrow('Access denied');
    });

    it('should handle file stat errors gracefully', async () => {
      const mockDirents = [
        { name: 'file1.txt', isDirectory: () => false },
        { name: 'broken-link', isDirectory: () => false }
      ];

      mockFs.readdir.mockResolvedValue(mockDirents as any);
      mockFs.stat
        .mockResolvedValueOnce({ size: 1024, mtime: new Date() } as any)
        .mockRejectedValueOnce(new Error('Broken symlink'));

      const result = await service.listDirectory();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('file1.txt');
    });
  });

  describe('Configuration', () => {
    beforeEach(async () => {
      mockFs.access.mockResolvedValue(undefined);
      await service.start();
    });

    it('should allow runtime configuration updates', () => {
      service.configure({
        basePath: '/new/base',
        excludeDirs: ['dist', 'build']
      });

      expect(service.getBasePath()).toBe(path.resolve('/new/base'));
    });

    it('should get current base path', () => {
      const basePath = service.getBasePath();
      expect(basePath).toBe(path.resolve('/test/base'));
    });
  });

  describe('Metrics', () => {
    beforeEach(async () => {
      mockFs.access.mockResolvedValue(undefined);
      await service.start();
    });

    it('should track directory listing metrics', async () => {
      mockFs.readdir.mockResolvedValue([]);

      await service.listDirectory();
      await service.listDirectory();

      const metrics = service.getMetrics();
      expect(metrics.directoryLists).toBe(2);
      expect(metrics.totalRequests).toBe(2);
    });

    it('should track error metrics', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Read error'));

      try {
        await service.listDirectory();
      } catch (error) {
        // Expected error
      }

      const metrics = service.getMetrics();
      expect(metrics.errors).toBe(1);
    });

    it('should reset metrics', async () => {
      mockFs.readdir.mockResolvedValue([]);
      
      await service.listDirectory();
      expect(service.getMetrics().totalRequests).toBe(1);
      
      service.resetMetrics();
      expect(service.getMetrics().totalRequests).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should report healthy when base path is accessible', async () => {
      mockFs.access.mockResolvedValue(undefined);
      await service.start();

      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.details.basePathAccess).toBe('accessible');
      expect(health.details.metrics).toBeDefined();
    });

    it('should report unhealthy when base path is not accessible', async () => {
      mockFs.access
        .mockResolvedValueOnce(undefined) // For start()
        .mockRejectedValueOnce(new Error('Access denied')); // For healthCheck()
      
      await service.start();
      const health = await service.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.details.basePathAccess).toBe('error');
      expect(health.details.error).toBe('Access denied');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      mockFs.access.mockResolvedValue(undefined);
      await service.start();
    });

    it('should handle empty directories', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const result = await service.listDirectory();

      expect(result).toEqual([]);
    });

    it('should handle relative paths correctly', async () => {
      const mockDirents = [
        { name: 'file.txt', isDirectory: () => false }
      ];
      
      mockFs.readdir.mockResolvedValue(mockDirents as any);
      mockFs.stat.mockResolvedValue({ size: 100, mtime: new Date() } as any);

      const result = await service.listDirectory('subdir');

      expect(result[0].path).toBe('subdir/file.txt');
    });
  });
});