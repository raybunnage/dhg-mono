import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioProxyService } from '../AudioProxyService';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Readable } from 'stream';

// Mock dependencies
vi.mock('googleapis');
vi.mock('fs');
vi.mock('path');
vi.mock('os');

// Mock Google Drive API
const createMockDrive = () => ({
  files: {
    get: vi.fn(),
    list: vi.fn()
  }
});

// Mock JWT client
const createMockJWT = () => ({
  authorize: vi.fn().mockResolvedValue(undefined),
  email: 'test@service.account'
});

describe('AudioProxyService', () => {
  let service: AudioProxyService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton
    AudioProxyService['instance'] = undefined;
    
    // Mock file system
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      type: 'service_account',
      client_email: 'test@service.account',
      private_key: 'mock-private-key'
    }));
    
    // Mock OS
    vi.mocked(os.homedir).mockReturnValue('/mock/home');
    
    // Mock path
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
    vi.mocked(path.extname).mockImplementation((p) => {
      const ext = p.split('.').pop();
      return ext ? `.${ext}` : '';
    });
    
    // Mock Google APIs
    const mockDrive = createMockDrive();
    vi.mocked(google.drive).mockReturnValue(mockDrive as any);
    
    service = AudioProxyService.getInstance();
    
    // Mock logger is already set in BaseService
  });

  afterEach(() => {
    // Clean up any intervals
    if (service['cacheCleanupInterval']) {
      clearInterval(service['cacheCleanupInterval']);
    }
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AudioProxyService.getInstance();
      const instance2 = AudioProxyService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should accept config on first getInstance', () => {
      AudioProxyService['instance'] = undefined;
      const config = { 
        cacheEnabled: false,
        maxCacheSize: 100
      };
      
      const instance = AudioProxyService.getInstance(config);
      expect(instance['config'].cacheEnabled).toBe(false);
      expect(instance['config'].maxCacheSize).toBe(100);
    });
  });

  describe('getAudioStreamFromDrive', () => {
    it('should stream audio file from Google Drive', async () => {
      const fileId = 'test-file-id';
      const mockStream = new Readable({
        read() {
          this.push('audio data');
          this.push(null);
        }
      });
      
      const mockGet = vi.fn().mockResolvedValue({
        data: mockStream,
        headers: {
          'content-type': 'audio/mpeg',
          'content-length': '1000'
        }
      });
      
      const mockDrive = {
        files: {
          get: mockGet
        }
      };
      
      vi.mocked(google.drive).mockReturnValue(mockDrive as any);
      
      // Re-initialize to use new mock
      await service['ensureInitialized']();
      
      const result = await service.streamAudioFile(fileId);
      
      expect(result.stream).toBeDefined();
      expect(result.metadata.fileId).toBe(fileId);
      expect(result.headers['content-type']).toBe('audio/mpeg');
    });

    it('should handle range requests', async () => {
      const fileId = 'test-file-id';
      const options = { start: 100, end: 500 };
      
      const mockGet = vi.fn();
      const mockDrive = {
        files: {
          get: mockGet
        }
      };
      
      vi.mocked(google.drive).mockReturnValue(mockDrive as any);
      await service['ensureInitialized']();
      
      await service.streamAudioFile(fileId, options);
      
      expect(mockGet).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Range': 'bytes=100-500'
          })
        })
      );
    });

    it('should handle Drive API errors', async () => {
      const fileId = 'test-file-id';
      
      const mockDrive = {
        files: {
          get: vi.fn().mockRejectedValue(new Error('Drive API error'))
        }
      };
      
      vi.mocked(google.drive).mockReturnValue(mockDrive as any);
      await service['ensureInitialized']();
      
      await expect(service.streamAudioFile(fileId))
        .rejects.toThrow('Drive API error');
    });
  });

  describe('streamLocalFile', () => {
    it('should stream audio file from local Google Drive folder', async () => {
      const relativePath = 'Audio/test.mp3';
      const fullPath = '/mock/home/Google Drive/My Drive/Audio/test.mp3';
      
      vi.mocked(path.join).mockReturnValue(fullPath);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        size: 1000,
        isFile: () => true,
        mtime: new Date()
      } as any);
      
      const mockStream = new Readable();
      vi.mocked(fs.createReadStream).mockReturnValue(mockStream as any);
      
      const result = await service.streamLocalFile(relativePath);
      
      expect(result.stream).toBe(mockStream);
      expect(result.metadata.name).toBe('test.mp3');
      expect(result.metadata.size).toBe(1000);
    });

    it('should handle range requests for local files', async () => {
      const relativePath = 'Audio/test.mp3';
      const options = { start: 100, end: 500 };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        size: 1000,
        isFile: () => true
      } as any);
      
      await service.streamLocalFile(relativePath, options);
      
      expect(fs.createReadStream).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          start: 100,
          end: 500
        })
      );
    });

    it('should throw error for non-existent file', async () => {
      const relativePath = 'Audio/missing.mp3';
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      await expect(service.streamLocalFile(relativePath))
        .rejects.toThrow('not found');
    });

    it('should validate file is within Google Drive path', async () => {
      const maliciousPath = '../../etc/passwd';
      
      await expect(service.streamLocalFile(maliciousPath))
        .rejects.toThrow('Invalid file path');
    });
  });

  describe('getFileMetadata', () => {
    it('should fetch file metadata from Google Drive', async () => {
      const fileId = 'test-file-id';
      const mockMetadata = {
        data: {
          id: fileId,
          name: 'audio.mp3',
          mimeType: 'audio/mpeg',
          size: '1000'
        }
      };
      
      const mockDrive = {
        files: {
          get: vi.fn().mockResolvedValue(mockMetadata)
        }
      };
      
      vi.mocked(google.drive).mockReturnValue(mockDrive as any);
      await service['ensureInitialized']();
      
      const metadata = await service.getFileMetadata(fileId);
      
      expect(metadata).toEqual({
        fileId,
        name: 'audio.mp3',
        mimeType: 'audio/mpeg',
        size: '1000'
      });
    });

    it('should use cache for repeated metadata requests', async () => {
      const fileId = 'test-file-id';
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          id: fileId,
          name: 'cached.mp3',
          mimeType: 'audio/mpeg',
          size: '1000'
        }
      });
      
      const mockDrive = {
        files: {
          get: mockGet
        }
      };
      
      vi.mocked(google.drive).mockReturnValue(mockDrive as any);
      await service['ensureInitialized']();
      
      // First call
      await service.getFileMetadata(fileId);
      
      // Second call should use cache
      await service.getFileMetadata(fileId);
      
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkLocalFile', () => {
    it('should check if local file exists', async () => {
      const relativePath = 'Audio/test.mp3';
      const expectedPath = '/mock/home/Google Drive/My Drive/Audio/test.mp3';
      
      vi.mocked(path.join).mockReturnValue(expectedPath);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const result = await service.checkLocalFile(relativePath);
      
      expect(result).toBe(expectedPath);
    });

    it('should return null for non-existent file', async () => {
      const relativePath = 'Audio/missing.mp3';
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const result = await service.checkLocalFile(relativePath);
      
      expect(result).toBeNull();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when Drive is accessible', async () => {
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({ data: { files: [] } })
        }
      };
      
      vi.mocked(google.drive).mockReturnValue(mockDrive as any);
      await service['ensureInitialized']();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.driveAccessible).toBe(true);
      expect(health.details.localDriveAvailable).toBe(true);
    });

    it('should return unhealthy when Drive is not accessible', async () => {
      const mockDrive = {
        files: {
          list: vi.fn().mockRejectedValue(new Error('Auth failed'))
        }
      };
      
      vi.mocked(google.drive).mockReturnValue(mockDrive as any);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      await service['ensureInitialized']();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.driveAccessible).toBe(false);
      expect(health.details.localDriveAvailable).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should cache metadata', async () => {
      const fileId = 'test-file-id';
      const metadata = {
        fileId,
        name: 'test.mp3',
        mimeType: 'audio/mpeg',
        size: '1000'
      };
      
      service['cacheMetadata'](fileId, metadata);
      const cached = service['getCachedMetadata'](fileId);
      
      expect(cached).toEqual(metadata);
    });

    it('should respect cache size limits', async () => {
      // Create service with small cache
      AudioProxyService['instance'] = undefined;
      service = AudioProxyService.getInstance({ maxCacheSize: 2 });
      
      // Logger already set
      
      // Cache 3 items
      service['cacheMetadata']('1', { fileId: '1', name: '1.mp3', mimeType: 'audio/mpeg', size: '1' });
      service['cacheMetadata']('2', { fileId: '2', name: '2.mp3', mimeType: 'audio/mpeg', size: '2' });
      service['cacheMetadata']('3', { fileId: '3', name: '3.mp3', mimeType: 'audio/mpeg', size: '3' });
      
      // First item should be evicted
      expect(service['getCachedMetadata']('1')).toBeUndefined();
      expect(service['getCachedMetadata']('2')).toBeDefined();
      expect(service['getCachedMetadata']('3')).toBeDefined();
    });

    it('should clear expired cache entries', async () => {
      // Use fake timers
      vi.useFakeTimers();
      
      const fileId = 'test-file-id';
      const metadata = {
        fileId,
        name: 'test.mp3',
        mimeType: 'audio/mpeg',
        size: '1000'
      };
      
      service['cacheMetadata'](fileId, metadata);
      
      // Advance time past cache TTL (1 hour)
      vi.advanceTimersByTime(3700000);
      
      // Trigger cleanup
      service['cleanupCache']();
      
      expect(service['getCachedMetadata'](fileId)).toBeUndefined();
      
      vi.useRealTimers();
    });
  });

  describe('error handling', () => {
    it('should handle missing service account file', async () => {
      AudioProxyService['instance'] = undefined;
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const instance = AudioProxyService.getInstance();
      await instance['ensureInitialized']();
      
      // Should log warning but not throw
      expect(instance['driveService']).toBeUndefined();
    });

    it('should handle invalid service account JSON', async () => {
      AudioProxyService['instance'] = undefined;
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');
      
      const instance = AudioProxyService.getInstance();
      await instance['ensureInitialized']();
      
      expect(instance['driveService']).toBeUndefined();
    });
  });

  describe('shutdown', () => {
    it('should clean up resources on shutdown', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      await service['shutdown']();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(service['metadataCache'].size).toBe(0);
    });
  });
});