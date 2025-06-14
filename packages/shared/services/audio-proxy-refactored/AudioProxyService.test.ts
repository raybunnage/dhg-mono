import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioProxyService } from './AudioProxyService';
import { Readable } from 'stream';

// Mock Node.js modules
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    createReadStream: vi.fn(),
    promises: {
      readFile: vi.fn(),
      stat: vi.fn(),
      access: vi.fn()
    },
    constants: {
      R_OK: 4
    }
  },
  existsSync: vi.fn(),
  createReadStream: vi.fn(),
  promises: {
    readFile: vi.fn(),
    stat: vi.fn(),
    access: vi.fn()
  },
  constants: {
    R_OK: 4
  }
}));

vi.mock('googleapis', () => ({
  google: {
    drive: vi.fn(() => ({
      files: {
        get: vi.fn()
      },
      about: {
        get: vi.fn()
      }
    }))
  }
}));

vi.mock('google-auth-library', () => ({
  JWT: vi.fn().mockImplementation(() => ({
    authorize: vi.fn().mockResolvedValue(undefined)
  }))
}));

import * as fs from 'fs';
import { google } from 'googleapis';

describe('AudioProxyService', () => {
  let service: AudioProxyService;
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear singleton instance
    AudioProxyService['instance'] = undefined as any;
  });
  
  afterEach(async () => {
    if (service && service['initialized']) {
      await service['shutdown']();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AudioProxyService.getInstance();
      const instance2 = AudioProxyService.getInstance();
      expect(instance1).toBe(instance2);
    });
    
    it('should accept config on first instantiation', () => {
      const config = {
        serviceAccountPath: '/custom/path',
        cacheEnabled: false
      };
      service = AudioProxyService.getInstance(config);
      expect(service['config'].cacheEnabled).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize without Google auth if no key file found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      expect(service['authClient']).toBeNull();
      expect(service['drive']).toBeNull();
      expect(service['initialized']).toBe(true);
    });
    
    it('should initialize with Google auth if key file exists', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => 
        path === '.service-account.json'
      );
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
        client_email: 'test@example.com',
        private_key: 'test-key'
      }));
      
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      expect(service['authClient']).not.toBeNull();
      expect(service['drive']).not.toBeNull();
    });
    
    it('should find local Google Drive path', async () => {
      const homePath = '/home/user/Google Drive';
      vi.mocked(fs.existsSync).mockImplementation((path) => 
        path === homePath
      );
      
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      const status = service.getStatus();
      expect(status.localDriveFound).toBe(true);
      expect(status.localDrivePath).toBe(homePath);
    });
  });

  describe('File Metadata', () => {
    it('should get file metadata from Google Drive', async () => {
      const mockMetadata = {
        name: 'audio.mp3',
        mimeType: 'audio/mpeg',
        size: '1024000'
      };
      
      const mockDrive = {
        files: {
          get: vi.fn().mockResolvedValue({ data: mockMetadata })
        },
        about: { get: vi.fn() }
      };
      
      vi.mocked(google.drive).mockReturnValue(mockDrive as any);
      vi.mocked(fs.existsSync).mockImplementation((path) => 
        path === '.service-account.json'
      );
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
        client_email: 'test@example.com',
        private_key: 'test-key'
      }));
      
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      const metadata = await service.getFileMetadata('file123');
      
      expect(metadata).toEqual({
        fileId: 'file123',
        name: 'audio.mp3',
        mimeType: 'audio/mpeg',
        size: '1024000'
      });
    });
    
    it('should cache metadata', async () => {
      const mockDrive = {
        files: {
          get: vi.fn().mockResolvedValue({
            data: {
              name: 'audio.mp3',
              mimeType: 'audio/mpeg',
              size: '1024000'
            }
          })
        },
        about: { get: vi.fn() }
      };
      
      vi.mocked(google.drive).mockReturnValue(mockDrive as any);
      vi.mocked(fs.existsSync).mockImplementation((path) => 
        path === '.service-account.json'
      );
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
        client_email: 'test@example.com',
        private_key: 'test-key'
      }));
      
      service = AudioProxyService.getInstance({ cacheEnabled: true });
      await service.ensureInitialized();
      
      // First call
      await service.getFileMetadata('file123');
      expect(mockDrive.files.get).toHaveBeenCalledTimes(1);
      
      // Second call - should use cache
      await service.getFileMetadata('file123');
      expect(mockDrive.files.get).toHaveBeenCalledTimes(1);
    });
    
    it('should throw error if Google Drive not initialized', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      await expect(service.getFileMetadata('file123'))
        .rejects.toThrow('Google Drive API not initialized');
    });
  });

  describe('Audio Streaming', () => {
    it('should stream audio file from Google Drive', async () => {
      const mockStream = new Readable();
      const mockDrive = {
        files: {
          get: vi.fn()
            .mockResolvedValueOnce({ 
              data: {
                name: 'audio.mp3',
                mimeType: 'audio/mpeg',
                size: '1024000'
              }
            })
            .mockResolvedValueOnce({ data: mockStream })
        },
        about: { get: vi.fn() }
      };
      
      vi.mocked(google.drive).mockReturnValue(mockDrive as any);
      vi.mocked(fs.existsSync).mockImplementation((path) => 
        path === '.service-account.json'
      );
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
        client_email: 'test@example.com',
        private_key: 'test-key'
      }));
      
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      const result = await service.streamAudioFile('file123');
      
      expect(result.stream).toBe(mockStream);
      expect(result.headers['Content-Type']).toBe('audio/mpeg');
      expect(result.headers['X-Served-From']).toBe('google-drive-api');
    });
    
    it('should handle range requests', async () => {
      const mockStream = new Readable();
      const mockDrive = {
        files: {
          get: vi.fn()
            .mockResolvedValueOnce({ 
              data: {
                name: 'audio.mp3',
                mimeType: 'audio/mpeg',
                size: '1024000'
              }
            })
            .mockResolvedValueOnce({ data: mockStream })
        },
        about: { get: vi.fn() }
      };
      
      vi.mocked(google.drive).mockReturnValue(mockDrive as any);
      vi.mocked(fs.existsSync).mockImplementation((path) => 
        path === '.service-account.json'
      );
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
        client_email: 'test@example.com',
        private_key: 'test-key'
      }));
      
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      const result = await service.streamAudioFile('file123', { 
        start: 0, 
        end: 999 
      });
      
      expect(result.headers['Accept-Ranges']).toBe('bytes');
      expect(result.headers['Content-Range']).toBe('bytes 0-999/1024000');
      expect(result.headers['Content-Length']).toBe('1000');
    });
  });

  describe('Local File Operations', () => {
    it('should check if local file exists', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => 
        path === '/home/user/Google Drive'
      );
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);
      
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      const path = await service.checkLocalFile('Music/song.mp3');
      expect(path).toBe('/home/user/Google Drive/Music/song.mp3');
    });
    
    it('should stream local file', async () => {
      const mockStream = new Readable();
      vi.mocked(fs.createReadStream).mockReturnValue(mockStream as any);
      vi.mocked(fs.promises.stat).mockResolvedValue({
        size: 1024000
      } as any);
      
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      const result = await service.streamLocalFile('/path/to/audio.mp3');
      
      expect(result.stream).toBe(mockStream);
      expect(result.headers['Content-Type']).toBe('audio/mpeg');
      expect(result.headers['X-Served-From']).toBe('local-file');
      expect(result.metadata.size).toBe(1024000);
    });
    
    it('should handle local file range requests', async () => {
      const mockStream = new Readable();
      vi.mocked(fs.createReadStream).mockReturnValue(mockStream as any);
      vi.mocked(fs.promises.stat).mockResolvedValue({
        size: 1024000
      } as any);
      
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      const result = await service.streamLocalFile('/path/to/audio.mp3', {
        start: 1000,
        end: 1999
      });
      
      expect(result.headers['Content-Range']).toBe('bytes 1000-1999/1024000');
      expect(result.headers['Content-Length']).toBe('1000');
      expect(vi.mocked(fs.createReadStream)).toHaveBeenCalledWith(
        '/path/to/audio.mp3',
        { start: 1000, end: 1999 }
      );
    });
  });

  describe('MIME Type Detection', () => {
    it('should detect correct MIME types', async () => {
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      const testCases = [
        { file: 'song.mp3', expected: 'audio/mpeg' },
        { file: 'audio.m4a', expected: 'audio/mp4' },
        { file: 'sound.wav', expected: 'audio/wav' },
        { file: 'music.ogg', expected: 'audio/ogg' },
        { file: 'track.flac', expected: 'audio/flac' },
        { file: 'unknown.xyz', expected: 'audio/mpeg' } // default
      ];
      
      for (const { file, expected } of testCases) {
        const mockStream = new Readable();
        vi.mocked(fs.createReadStream).mockReturnValue(mockStream as any);
        vi.mocked(fs.promises.stat).mockResolvedValue({ size: 1000 } as any);
        
        const result = await service.streamLocalFile(`/path/${file}`);
        expect(result.headers['Content-Type']).toBe(expected);
      }
    });
  });

  describe('Service Status', () => {
    it('should report configuration status', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      const status = service.getStatus();
      
      expect(status.googleApiConfigured).toBe(false);
      expect(status.localDriveFound).toBe(false);
      expect(status.activeStreams).toBe(0);
      expect(status.totalStreamsServed).toBe(0);
    });
    
    it('should track active streams', async () => {
      const mockStream = new Readable();
      vi.mocked(fs.createReadStream).mockReturnValue(mockStream as any);
      vi.mocked(fs.promises.stat).mockResolvedValue({ size: 1000 } as any);
      
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      await service.streamLocalFile('/path/audio.mp3');
      
      const status = service.getStatus();
      expect(status.activeStreams).toBe(1);
      
      // Simulate stream end
      mockStream.emit('end');
      
      const statusAfter = service.getStatus();
      expect(statusAfter.activeStreams).toBe(0);
      expect(statusAfter.totalStreamsServed).toBe(1);
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.initialized).toBe(true);
      expect(health.details.googleApiConfigured).toBe(false);
    });
    
    it('should check Google Drive API health', async () => {
      const mockDrive = {
        files: { get: vi.fn() },
        about: {
          get: vi.fn().mockResolvedValue({ data: { user: {} } })
        }
      };
      
      vi.mocked(google.drive).mockReturnValue(mockDrive as any);
      vi.mocked(fs.existsSync).mockImplementation((path) => 
        path === '.service-account.json'
      );
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
        client_email: 'test@example.com',
        private_key: 'test-key'
      }));
      
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.apiHealthy).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should clean up expired cache entries', async () => {
      service = AudioProxyService.getInstance({ cacheEnabled: true });
      await service.ensureInitialized();
      
      // Add cache entries manually
      service['metadataCache'].set('old', {
        data: { fileId: 'old', name: 'old.mp3', mimeType: 'audio/mpeg', size: '1000' },
        timestamp: Date.now() - 4000000 // Old entry
      });
      
      service['metadataCache'].set('new', {
        data: { fileId: 'new', name: 'new.mp3', mimeType: 'audio/mpeg', size: '2000' },
        timestamp: Date.now() // Recent entry
      });
      
      // Run cleanup
      service['cleanupCache']();
      
      expect(service['metadataCache'].size).toBe(1);
      expect(service['metadataCache'].has('new')).toBe(true);
      expect(service['metadataCache'].has('old')).toBe(false);
    });
  });

  describe('Shutdown', () => {
    it('should wait for active streams before shutdown', async () => {
      const mockStream = new Readable();
      vi.mocked(fs.createReadStream).mockReturnValue(mockStream as any);
      vi.mocked(fs.promises.stat).mockResolvedValue({ size: 1000 } as any);
      
      service = AudioProxyService.getInstance();
      await service.ensureInitialized();
      
      // Start a stream
      await service.streamLocalFile('/path/audio.mp3');
      expect(service['activeStreams'].size).toBe(1);
      
      // Start shutdown
      const shutdownPromise = service['shutdown']();
      
      // Simulate stream completion after a delay
      setTimeout(() => mockStream.emit('end'), 100);
      
      await shutdownPromise;
      
      expect(service['activeStreams'].size).toBe(0);
    });
  });
});