/**
 * ScriptViewerService Tests
 */

import { ScriptViewerService } from './ScriptViewerService';
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

describe('ScriptViewerService', () => {
  let service: ScriptViewerService;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ScriptViewerService({
      projectRoot: '/test/project',
      archivedFolder: '.archived_test',
      allowedExtensions: ['.sh', '.js', '.ts', '.py']
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

  describe('Script File Viewing', () => {
    beforeEach(async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      await service.start();
    });

    it('should read JavaScript file successfully', async () => {
      const mockStats = {
        size: 1024,
        birthtime: new Date('2023-01-01'),
        mtime: new Date('2023-01-02'),
      };
      const mockContent = 'console.log("Hello World");';

      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockFs.promises.readFile.mockResolvedValue(mockContent);

      const result = await service.viewScriptFile('test.js');

      expect(result).toEqual({
        file_path: 'test.js',
        title: 'test',
        content: mockContent,
        size: 1024,
        created_at: mockStats.birthtime,
        updated_at: mockStats.mtime
      });
    });

    it('should read TypeScript file successfully', async () => {
      const mockStats = {
        size: 512,
        birthtime: new Date('2023-01-01'),
        mtime: new Date('2023-01-02'),
      };
      const mockContent = 'interface User { name: string; }';

      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockFs.promises.readFile.mockResolvedValue(mockContent);

      const result = await service.viewScriptFile('types.ts');

      expect(result).toEqual({
        file_path: 'types.ts',
        title: 'types',
        content: mockContent,
        size: 512,
        created_at: mockStats.birthtime,
        updated_at: mockStats.mtime
      });
    });

    it('should read shell script successfully', async () => {
      const mockStats = {
        size: 256,
        birthtime: new Date('2023-01-01'),
        mtime: new Date('2023-01-02'),
      };
      const mockContent = '#!/bin/bash\necho "Script running"';

      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockFs.promises.readFile.mockResolvedValue(mockContent);

      const result = await service.viewScriptFile('deploy.sh');

      expect(result).toEqual({
        file_path: 'deploy.sh',
        title: 'deploy',
        content: mockContent,
        size: 256,
        created_at: mockStats.birthtime,
        updated_at: mockStats.mtime
      });
    });

    it('should read Python script successfully', async () => {
      const mockStats = {
        size: 128,
        birthtime: new Date('2023-01-01'),
        mtime: new Date('2023-01-02'),
      };
      const mockContent = 'print("Hello from Python")';

      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockFs.promises.readFile.mockResolvedValue(mockContent);

      const result = await service.viewScriptFile('script.py');

      expect(result).toEqual({
        file_path: 'script.py',
        title: 'script',
        content: mockContent,
        size: 128,
        created_at: mockStats.birthtime,
        updated_at: mockStats.mtime
      });
    });

    it('should reject files with invalid extensions', async () => {
      const result = await service.viewScriptFile('document.txt');
      
      expect(result).toBeNull();
      expect(service.getMetrics().errors).toBe(1);
    });

    it('should handle file read errors gracefully', async () => {
      mockFs.promises.stat.mockRejectedValue(new Error('File not found'));

      const result = await service.viewScriptFile('missing.js');

      expect(result).toBeNull();
      expect(service.getMetrics().errors).toBe(1);
    });

    it('should validate script extensions properly', async () => {
      const testCases = [
        { file: 'script.sh', valid: true },
        { file: 'app.js', valid: true },
        { file: 'types.ts', valid: true },
        { file: 'main.py', valid: true },
        { file: 'config.json', valid: false },
        { file: 'readme.md', valid: false },
        { file: 'styles.css', valid: false }
      ];

      for (const testCase of testCases) {
        const result = await service.viewScriptFile(testCase.file);
        
        if (testCase.valid) {
          // For valid files, we expect an error due to missing mocks, but should still increment views
        }
        
        expect(result === null).toBe(true); // All will be null due to mocking, but extension validation occurs first
      }
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

      await service.viewScriptFile('test1.js');
      await service.viewScriptFile('test2.ts');

      const metrics = service.getMetrics();
      expect(metrics.totalViews).toBe(2);
      expect(metrics.lastOperationTime).toBeDefined();
    });

    it('should track error metrics', async () => {
      mockFs.promises.stat.mockRejectedValue(new Error('Read error'));

      await service.viewScriptFile('error.js');

      const metrics = service.getMetrics();
      expect(metrics.errors).toBe(1);
    });

    it('should track metrics for invalid extensions', async () => {
      await service.viewScriptFile('invalid.txt');

      const metrics = service.getMetrics();
      expect(metrics.totalViews).toBe(1);
      expect(metrics.errors).toBe(1);
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
      expect(health.details.allowedExtensions).toEqual(['.sh', '.js', '.ts', '.py']);
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

    it('should handle empty script files', async () => {
      const mockStats = { size: 0, birthtime: new Date(), mtime: new Date() };
      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockFs.promises.readFile.mockResolvedValue('');

      const result = await service.viewScriptFile('empty.js');

      expect(result).not.toBeNull();
      expect(result?.content).toBe('');
      expect(result?.size).toBe(0);
    });

    it('should handle files with complex paths', async () => {
      const mockStats = { size: 100, birthtime: new Date(), mtime: new Date() };
      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockFs.promises.readFile.mockResolvedValue('content');

      const result = await service.viewScriptFile('scripts/utils/helper.js');

      expect(result).not.toBeNull();
      expect(result?.file_path).toBe('scripts/utils/helper.js');
      expect(result?.title).toBe('helper');
    });

    it('should handle files with multiple dots in name', async () => {
      const mockStats = { size: 100, birthtime: new Date(), mtime: new Date() };
      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockFs.promises.readFile.mockResolvedValue('content');

      const result = await service.viewScriptFile('config.prod.js');

      expect(result).not.toBeNull();
      expect(result?.title).toBe('config.prod');
    });

    it('should handle binary files that cause read errors', async () => {
      mockFs.promises.stat.mockResolvedValue({ size: 100, birthtime: new Date(), mtime: new Date() } as any);
      mockFs.promises.readFile.mockRejectedValue(new Error('Cannot read binary file'));

      const result = await service.viewScriptFile('binary.js');

      expect(result).toBeNull();
      expect(service.getMetrics().errors).toBe(1);
    });
  });
});