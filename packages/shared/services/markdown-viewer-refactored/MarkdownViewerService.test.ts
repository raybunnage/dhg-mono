/**
 * MarkdownViewerService Tests
 */

import { MarkdownViewerService } from './MarkdownViewerService';
import * as fs from 'fs';
import * as path from 'path';
import { jest } from '@jest/globals';

// Mock the fs module
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn(),
    mkdir: jest.fn(),
    rename: jest.fn(),
    unlink: jest.fn(),
  },
}));

describe('MarkdownViewerService', () => {
  let service: MarkdownViewerService;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarkdownViewerService({
      projectRoot: '/test/project',
      archivedFolder: '.archive_test',
      allowedExtensions: ['.md', '.mdx']
    });
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully with valid project root', async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      
      await service.start();
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.projectRoot).toBe(path.resolve('/test/project'));
    });

    it('should throw error on initialization with invalid project root', async () => {
      mockFs.promises.access.mockRejectedValue(new Error('Path not found'));
      
      await expect(service.start()).rejects.toThrow('Cannot access project root');
    });

    it('should handle service shutdown gracefully', async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      
      await service.start();
      await service.shutdown();
      
      expect(service.isStarted()).toBe(false);
    });
  });

  describe('File Viewing', () => {
    beforeEach(async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      await service.start();
    });

    it('should read markdown file successfully', async () => {
      const mockStats = {
        size: 1024,
        birthtime: new Date('2023-01-01'),
        mtime: new Date('2023-01-02'),
      };
      const mockContent = '# Test Markdown\n\nContent here.';

      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockFs.promises.readFile.mockResolvedValue(mockContent);

      const result = await service.viewMarkdownFile('test.md');

      expect(result).toEqual({
        file_path: 'test.md',
        title: 'test',
        content: mockContent,
        size: 1024,
        created_at: mockStats.birthtime,
        updated_at: mockStats.mtime
      });
    });

    it('should reject files with invalid extensions', async () => {
      const result = await service.viewMarkdownFile('test.txt');
      
      expect(result).toBeNull();
      expect(service.getMetrics().errors).toBe(1);
    });

    it('should handle file read errors gracefully', async () => {
      mockFs.promises.stat.mockRejectedValue(new Error('File not found'));

      const result = await service.viewMarkdownFile('missing.md');

      expect(result).toBeNull();
      expect(service.getMetrics().errors).toBe(1);
    });

    it('should accept different markdown extensions', async () => {
      const mockStats = {
        size: 512,
        birthtime: new Date(),
        mtime: new Date(),
      };

      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockFs.promises.readFile.mockResolvedValue('# MDX Content');

      const result = await service.viewMarkdownFile('component.mdx');

      expect(result).not.toBeNull();
      expect(result?.title).toBe('component');
    });
  });

  describe('Configuration', () => {
    beforeEach(async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      await service.start();
    });

    it('should allow runtime configuration updates', () => {
      service.configure({
        projectRoot: '/new/project'
      });

      // Configuration change should be logged
      // We can't directly test the internal state, but we can verify no errors
      expect(() => service.configure({ projectRoot: '/new/project' })).not.toThrow();
    });
  });

  describe('Metrics', () => {
    beforeEach(async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      await service.start();
    });

    it('should track file view metrics', async () => {
      const mockStats = { size: 100, birthtime: new Date(), mtime: new Date() };
      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockFs.promises.readFile.mockResolvedValue('content');

      await service.viewMarkdownFile('test1.md');
      await service.viewMarkdownFile('test2.md');

      const metrics = service.getMetrics();
      expect(metrics.totalViews).toBe(2);
      expect(metrics.lastOperationTime).toBeDefined();
    });

    it('should track error metrics', async () => {
      mockFs.promises.stat.mockRejectedValue(new Error('Read error'));

      await service.viewMarkdownFile('error.md');

      const metrics = service.getMetrics();
      expect(metrics.errors).toBe(1);
    });

    it('should reset metrics', async () => {
      const mockStats = { size: 100, birthtime: new Date(), mtime: new Date() };
      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockFs.promises.readFile.mockResolvedValue('content');
      
      await service.viewMarkdownFile('test.md');
      expect(service.getMetrics().totalViews).toBe(1);
      
      service.resetMetrics();
      expect(service.getMetrics().totalViews).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should report healthy when project root is accessible', async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      await service.start();

      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.details.rootAccess).toBe('accessible');
      expect(health.details.metrics).toBeDefined();
      expect(health.details.allowedExtensions).toEqual(['.md', '.mdx']);
    });

    it('should report unhealthy when project root is not accessible', async () => {
      mockFs.promises.access
        .mockResolvedValueOnce(undefined) // For start()
        .mockRejectedValueOnce(new Error('Access denied')); // For healthCheck()
      
      await service.start();
      const health = await service.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.details.rootAccess).toBe('error');
      expect(health.details.error).toBe('Access denied');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      await service.start();
    });

    it('should handle empty markdown files', async () => {
      const mockStats = { size: 0, birthtime: new Date(), mtime: new Date() };
      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockFs.promises.readFile.mockResolvedValue('');

      const result = await service.viewMarkdownFile('empty.md');

      expect(result).not.toBeNull();
      expect(result?.content).toBe('');
      expect(result?.size).toBe(0);
    });

    it('should handle files with complex paths', async () => {
      const mockStats = { size: 100, birthtime: new Date(), mtime: new Date() };
      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockFs.promises.readFile.mockResolvedValue('content');

      const result = await service.viewMarkdownFile('docs/advanced/guide.md');

      expect(result).not.toBeNull();
      expect(result?.file_path).toBe('docs/advanced/guide.md');
      expect(result?.title).toBe('guide');
    });

    it('should validate file extensions properly', async () => {
      const testCases = [
        { file: 'test.md', valid: true },
        { file: 'test.mdx', valid: true },
        { file: 'test.txt', valid: false },
        { file: 'test.MD', valid: false }, // Case sensitive
        { file: 'test.md.bak', valid: false }
      ];

      for (const testCase of testCases) {
        const result = await service.viewMarkdownFile(testCase.file);
        
        if (testCase.valid) {
          // For valid files, mock the fs calls
          const mockStats = { size: 100, birthtime: new Date(), mtime: new Date() };
          mockFs.promises.stat.mockResolvedValue(mockStats as any);
          mockFs.promises.readFile.mockResolvedValue('content');
        }
        
        expect(result === null).toBe(!testCase.valid);
      }
    });
  });
});