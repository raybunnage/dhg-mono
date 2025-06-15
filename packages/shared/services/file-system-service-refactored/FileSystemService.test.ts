/**
 * FileSystemService Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileSystemService } from './FileSystemService';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

// Mock fs module
vi.mock('fs');
vi.mock('util', () => ({
  promisify: vi.fn((fn) => fn)
}));

// Mock crypto for hash tests
vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn(),
    digest: vi.fn(() => 'mockedhash123456')
  }))
}));

describe('FileSystemService', () => {
  let service: FileSystemService;
  let mockStat: any;
  let mockReaddir: any;
  let mockMkdir: any;
  let mockAccess: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton instance
    (FileSystemService as any).instance = undefined;

    // Setup mocks
    mockStat = vi.fn();
    mockReaddir = vi.fn();
    mockMkdir = vi.fn();
    mockAccess = vi.fn();

    // Mock promisify to return our mock functions
    (promisify as any).mockImplementation((fn: any) => {
      if (fn === fs.stat) return mockStat;
      if (fn === fs.readdir) return mockReaddir;
      if (fn === fs.mkdir) return mockMkdir;
      if (fn === fs.access) return mockAccess;
      return fn;
    });

    // Default mock implementations
    mockAccess.mockResolvedValue(undefined);
    mockStat.mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1024,
      mtime: new Date('2024-01-01')
    });
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = FileSystemService.getInstance();
      const instance2 = FileSystemService.getInstance();
      expect(instance1).toBe(instance2);
      service = instance1;
    });

    it('should accept configuration on first instantiation', () => {
      const config = { defaultMaxDepth: 10, defaultParallelism: 3 };
      service = FileSystemService.getInstance(config);
      expect(service).toBeInstanceOf(FileSystemService);
    });
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully with file system access', async () => {
      service = FileSystemService.getInstance();
      await service['initialize']();
      
      expect(mockAccess).toHaveBeenCalledWith(process.cwd(), fs.constants.R_OK);
    });

    it('should handle initialization errors', async () => {
      mockAccess.mockRejectedValue(new Error('Access denied'));
      service = FileSystemService.getInstance();
      
      await expect(service['initialize']()).rejects.toThrow('Cannot access file system');
    });

    it('should cleanup active streams on shutdown', async () => {
      service = FileSystemService.getInstance();
      
      // Mock an active stream
      const mockStream = { destroy: vi.fn() };
      (service as any).activeStreams.add(mockStream);
      
      await service['cleanup']();
      
      expect(mockStream.destroy).toHaveBeenCalled();
      expect((service as any).activeStreams.size).toBe(0);
    });
  });

  describe('Health Check', () => {
    beforeEach(() => {
      service = FileSystemService.getInstance();
    });

    it('should return healthy status with file system access', async () => {
      mockMkdir.mockResolvedValue(undefined);
      (fs.promises as any) = { rmdir: vi.fn().mockResolvedValue(undefined) };
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.fileSystemAccess).toBe('read-write');
      expect(health.details.tempDirectoryTest).toBe('passed');
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should return unhealthy on access errors', async () => {
      mockAccess.mockRejectedValue(new Error('Permission denied'));
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.fileSystemAccess).toBe('error');
    });
  });

  describe('calculateFileHash', () => {
    beforeEach(() => {
      service = FileSystemService.getInstance();
    });

    it('should calculate file hash successfully', async () => {
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
          return mockStream;
        })
      };
      
      (fs.createReadStream as any).mockReturnValue(mockStream);
      
      const hash = await service.calculateFileHash('/test/file.txt');
      
      expect(hash).toBe('mockedhash123456');
      expect((service as any).metrics.filesHashed).toBe(1);
    });

    it('should return null for directories', async () => {
      mockStat.mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true
      });
      
      const hash = await service.calculateFileHash('/test/dir');
      
      expect(hash).toBeNull();
    });

    it('should handle stream errors', async () => {
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Read error')), 0);
          }
          return mockStream;
        })
      };
      
      (fs.createReadStream as any).mockReturnValue(mockStream);
      
      const hash = await service.calculateFileHash('/test/file.txt');
      
      expect(hash).toBeNull();
      expect((service as any).metrics.errors).toBe(1);
    });

    it('should support different algorithms', async () => {
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'end') {
            setTimeout(() => callback(), 0);
          }
          return mockStream;
        })
      };
      
      (fs.createReadStream as any).mockReturnValue(mockStream);
      
      const hash = await service.calculateFileHash('/test/file.txt', {
        algorithm: 'md5',
        encoding: 'base64'
      });
      
      expect(hash).toBe('mockedhash123456');
    });
  });

  describe('walkDir', () => {
    beforeEach(() => {
      service = FileSystemService.getInstance();
    });

    it('should walk directory and return file metadata', async () => {
      mockReaddir.mockResolvedValue([
        { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        { name: 'file2.md', isFile: () => true, isDirectory: () => false },
        { name: 'subdir', isFile: () => false, isDirectory: () => true }
      ]);
      
      const results = await service.walkDir('/test/dir');
      
      expect(results).toHaveLength(2); // Only files by default
      expect(results[0]).toMatchObject({
        name: 'file1.txt',
        isDirectory: false,
        size: 1024
      });
      expect((service as any).metrics.directoriesWalked).toBe(1);
    });

    it('should include directories when requested', async () => {
      mockReaddir.mockResolvedValue([
        { name: 'file.txt', isFile: () => true, isDirectory: () => false },
        { name: 'subdir', isFile: () => false, isDirectory: () => true }
      ]);
      
      const results = await service.walkDir('/test/dir', {
        includeDirectories: true
      });
      
      expect(results).toHaveLength(2);
      expect(results.some(r => r.isDirectory)).toBe(true);
    });

    it('should respect exclusion patterns', async () => {
      mockReaddir.mockResolvedValue([
        { name: 'file.txt', isFile: () => true, isDirectory: () => false },
        { name: 'node_modules', isFile: () => false, isDirectory: () => true },
        { name: '.git', isFile: () => false, isDirectory: () => true }
      ]);
      
      const results = await service.walkDir('/test/dir', {
        excludePatterns: [/node_modules/, /\.git/]
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('file.txt');
    });

    it('should respect max depth', async () => {
      let depth = 0;
      mockReaddir.mockImplementation(() => {
        depth++;
        if (depth > 3) return [];
        return [
          { name: 'file.txt', isFile: () => true, isDirectory: () => false },
          { name: 'subdir', isFile: () => false, isDirectory: () => true }
        ];
      });
      
      await service.walkDir('/test/dir', { maxDepth: 2 });
      
      expect(depth).toBeLessThanOrEqual(3);
    });

    it('should call progress callback', async () => {
      const mockProgress = vi.fn();
      mockReaddir.mockResolvedValue([
        { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        { name: 'file2.txt', isFile: () => true, isDirectory: () => false }
      ]);
      
      await service.walkDir('/test/dir', {
        onProgress: mockProgress
      });
      
      expect(mockProgress).toHaveBeenCalledWith('/test/dir', 2);
    });
  });

  describe('File Operations', () => {
    beforeEach(() => {
      service = FileSystemService.getInstance();
    });

    it('should check if file exists', async () => {
      mockStat.mockResolvedValue({ isFile: () => true });
      
      const exists = await service.fileExists('/test/file.txt');
      
      expect(exists).toBe(true);
      expect(mockStat).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should return false for non-existent file', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT'));
      
      const exists = await service.fileExists('/test/missing.txt');
      
      expect(exists).toBe(false);
    });

    it('should check if directory exists', async () => {
      mockStat.mockResolvedValue({ isDirectory: () => true });
      
      const exists = await service.directoryExists('/test/dir');
      
      expect(exists).toBe(true);
    });

    it('should get file size', async () => {
      mockStat.mockResolvedValue({ size: 2048 });
      
      const size = await service.getFileSize('/test/file.txt');
      
      expect(size).toBe(2048);
    });

    it('should ensure directory exists', async () => {
      mockMkdir.mockResolvedValue(undefined);
      
      await service.ensureDirectoryExists('/test/new/dir');
      
      expect(mockMkdir).toHaveBeenCalledWith('/test/new/dir', { recursive: true });
    });

    it('should get file metadata', async () => {
      const metadata = await service.getFileMetadata('/test/file.txt');
      
      expect(metadata).toMatchObject({
        path: '/test/file.txt',
        name: 'file.txt',
        size: 1024,
        isDirectory: false
      });
    });
  });

  describe('Path Operations', () => {
    beforeEach(() => {
      service = FileSystemService.getInstance();
    });

    it('should get file extension', () => {
      expect(service.getFileExtension('file.txt')).toBe('.txt');
      expect(service.getFileExtension('file.TAR.GZ')).toBe('.gz');
      expect(service.getFileExtension('noext')).toBe('');
    });

    it('should check absolute paths', () => {
      expect(service.isAbsolutePath('/absolute/path')).toBe(true);
      expect(service.isAbsolutePath('relative/path')).toBe(false);
    });

    it('should join paths', () => {
      const joined = service.joinPath('dir', 'subdir', 'file.txt');
      expect(joined).toBe(path.join('dir', 'subdir', 'file.txt'));
    });

    it('should get dirname and basename', () => {
      expect(service.getDirname('/path/to/file.txt')).toBe('/path/to');
      expect(service.getBasename('/path/to/file.txt')).toBe('file.txt');
      expect(service.getBasename('/path/to/file.txt', '.txt')).toBe('file');
    });

    it('should get relative paths', () => {
      const rel = service.getRelativePath('/base/dir', '/base/dir/sub/file.txt');
      expect(rel).toBe(path.join('sub', 'file.txt'));
    });
  });

  describe('Convenience Methods', () => {
    beforeEach(() => {
      service = FileSystemService.getInstance();
      
      // Mock walkDir
      vi.spyOn(service, 'walkDir').mockResolvedValue([
        { path: '/test/doc.md', name: 'doc.md', size: 100, mtime: new Date(), isDirectory: false },
        { path: '/test/file.txt', name: 'file.txt', size: 200, mtime: new Date(), isDirectory: false },
        { path: '/test/script.js', name: 'script.js', size: 300, mtime: new Date(), isDirectory: false },
        { path: '/test/other.png', name: 'other.png', size: 400, mtime: new Date(), isDirectory: false }
      ]);
    });

    it('should find files by extension', async () => {
      const files = await service.findFiles(['.md', '.txt']);
      
      expect(files).toHaveLength(2);
      expect(files.map(f => f.name)).toContain('doc.md');
      expect(files.map(f => f.name)).toContain('file.txt');
    });

    it('should find documentation files', async () => {
      const files = await service.findDocumentationFiles();
      
      expect(service.walkDir).toHaveBeenCalledWith(process.cwd(), {
        excludePatterns: expect.any(Array),
        includeDirectories: false
      });
    });

    it('should find script files', async () => {
      const files = await service.findScriptFiles();
      
      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('script.js');
    });

    it('should add hashes when requested', async () => {
      vi.spyOn(service, 'calculateFileHash').mockResolvedValue('hash123');
      
      const files = await service.findFiles(['.md'], [], true);
      
      expect(files[0].hash).toBe('hash123');
      expect(service.calculateFileHash).toHaveBeenCalled();
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(() => {
      service = FileSystemService.getInstance();
    });

    it('should create progress tracker', () => {
      const tracker = service.createProgressTracker('Test');
      expect(tracker).toBeInstanceOf(Function);
      
      // Mock stdout
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      
      tracker('/test/path', 5);
      
      // Progress update should be throttled by default
      expect(writeSpy).not.toHaveBeenCalled();
      
      writeSpy.mockRestore();
    });
  });

  describe('Metrics', () => {
    beforeEach(() => {
      service = FileSystemService.getInstance();
    });

    it('should track metrics', async () => {
      await service.fileExists('/test');
      await service.getFileSize('/test');
      mockStat.mockRejectedValueOnce(new Error('Error'));
      await service.fileExists('/error');
      
      const metrics = service.getMetrics();
      expect(metrics.totalOperations).toBe(3);
      expect(metrics.errors).toBe(0); // fileExists returns false on error
    });

    it('should reset metrics', () => {
      service.resetMetrics();
      
      const metrics = service.getMetrics();
      expect(metrics.totalOperations).toBe(0);
      expect(metrics.filesHashed).toBe(0);
      expect(metrics.errors).toBe(0);
    });
  });
});