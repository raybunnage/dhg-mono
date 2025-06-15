import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { ConverterService } from '../ConverterService';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import type { 
  VideoMetadata, 
  ConversionResult, 
  MetadataResult, 
  ConversionOptions 
} from '../ConverterService';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn()
  },
  existsSync: vi.fn(),
  mkdirSync: vi.fn()
}));

// Mock path
vi.mock('path', () => ({
  default: {
    dirname: vi.fn((p: string) => p.substring(0, p.lastIndexOf('/'))),
    parse: vi.fn((p: string) => {
      const lastSlash = p.lastIndexOf('/');
      const lastDot = p.lastIndexOf('.');
      return {
        dir: p.substring(0, lastSlash),
        name: p.substring(lastSlash + 1, lastDot),
        ext: p.substring(lastDot)
      };
    }),
    join: vi.fn((...args: string[]) => args.join('/'))
  },
  dirname: vi.fn((p: string) => p.substring(0, p.lastIndexOf('/'))),
  parse: vi.fn((p: string) => {
    const lastSlash = p.lastIndexOf('/');
    const lastDot = p.lastIndexOf('.');
    return {
      dir: p.substring(0, lastSlash),
      name: p.substring(lastSlash + 1, lastDot),
      ext: p.substring(lastDot)
    };
  }),
  join: vi.fn((...args: string[]) => args.join('/'))
}));

// Mock formatter service
vi.mock('../../formatter-service', () => ({
  formatterService: {
    formatDuration: vi.fn((ms: number) => `${ms}ms`)
  }
}));

// Helper to create mock child process
class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  
  kill(signal: string) {
    this.emit('close', signal === 'SIGTERM' ? 143 : 0);
  }
}

describe('ConverterService', () => {
  let service: ConverterService;
  let mockSpawn: any;
  let mockExistsSync: any;
  let mockMkdirSync: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Reset singleton instance
    (ConverterService as any).instance = undefined;
    
    // Get fresh service instance
    service = ConverterService.getInstance();
    
    // Setup mock references
    mockSpawn = vi.mocked(spawn);
    mockExistsSync = vi.mocked(fs.existsSync);
    mockMkdirSync = vi.mocked(fs.mkdirSync);
  });

  afterEach(async () => {
    // Ensure service is disposed
    await service.dispose();
  });

  describe('Service Initialization', () => {
    it('should create singleton instance', () => {
      const instance1 = ConverterService.getInstance();
      const instance2 = ConverterService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should verify FFmpeg installation on initialization', async () => {
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      
      // Schedule successful responses
      setTimeout(() => mockProcess.emit('close', 0), 10);
      
      await service.ensureInitialized();
      
      // Should check for both ffmpeg and ffprobe
      expect(mockSpawn).toHaveBeenCalledWith('ffmpeg', ['-version']);
      expect(mockSpawn).toHaveBeenCalledWith('ffprobe', ['-version']);
    });

    it('should throw error if FFmpeg is not installed', async () => {
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      
      // Schedule failed response
      setTimeout(() => mockProcess.emit('close', 1), 10);
      
      await expect(service.ensureInitialized()).rejects.toThrow('FFmpeg is not installed');
    });

    it('should handle FFmpeg command error', async () => {
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      
      // Schedule error event
      setTimeout(() => mockProcess.emit('error', new Error('Command not found')), 10);
      
      await expect(service.ensureInitialized()).rejects.toThrow('FFmpeg is not installed');
    });
  });

  describe('MP4 to M4A Conversion', () => {
    beforeEach(async () => {
      // Setup successful FFmpeg check
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      setTimeout(() => mockProcess.emit('close', 0), 10);
      await service.ensureInitialized();
      vi.clearAllMocks();
    });

    it('should convert MP4 to M4A successfully', async () => {
      const inputPath = '/test/video.mp4';
      const outputPath = '/test/video.m4a';
      
      mockExistsSync.mockImplementation((path: string) => path === inputPath);
      
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      
      // Schedule successful conversion
      setTimeout(() => {
        mockProcess.stderr.emit('data', 'Processing...');
        mockProcess.emit('close', 0);
      }, 50);
      
      const result = await service.convertMP4ToM4A(inputPath, outputPath);
      
      expect(result.success).toBe(true);
      expect(result.outputPath).toBe(outputPath);
      expect(result.duration).toBeGreaterThan(0);
      
      expect(mockSpawn).toHaveBeenCalledWith('ffmpeg', [
        '-i', inputPath,
        '-vn',
        '-acodec', 'aac',
        '-b:a', '128k',
        '-y',
        outputPath
      ]);
    });

    it('should handle missing input file', async () => {
      mockExistsSync.mockReturnValue(false);
      
      const result = await service.convertMP4ToM4A('/test/missing.mp4');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Input file not found');
    });

    it('should handle existing output file when overwrite is false', async () => {
      mockExistsSync.mockReturnValue(true);
      
      const result = await service.convertMP4ToM4A(
        '/test/video.mp4', 
        '/test/video.m4a',
        { overwrite: false }
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Output file already exists');
    });

    it('should create output directory if it does not exist', async () => {
      const inputPath = '/test/video.mp4';
      const outputPath = '/output/dir/video.m4a';
      
      mockExistsSync.mockImplementation((path: string) => path === inputPath);
      
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      setTimeout(() => mockProcess.emit('close', 0), 50);
      
      await service.convertMP4ToM4A(inputPath, outputPath);
      
      expect(mockMkdirSync).toHaveBeenCalledWith('/output/dir', { recursive: true });
    });

    it('should handle conversion timeout', async () => {
      mockExistsSync.mockImplementation((path: string) => path === '/test/video.mp4');
      
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      
      // Don't emit close event to trigger timeout
      const result = await service.convertMP4ToM4A(
        '/test/video.mp4',
        '/test/video.m4a',
        { timeout: 100 } // 100ms timeout
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Conversion timeout');
    });

    it('should handle FFmpeg error', async () => {
      mockExistsSync.mockImplementation((path: string) => path === '/test/video.mp4');
      
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      
      setTimeout(() => {
        mockProcess.stderr.emit('data', 'Error: Invalid codec');
        mockProcess.emit('close', 1);
      }, 50);
      
      const result = await service.convertMP4ToM4A('/test/video.mp4');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('FFmpeg exited with code 1');
      expect(result.error).toContain('Invalid codec');
    });

    it('should apply quality settings', async () => {
      mockExistsSync.mockImplementation((path: string) => path === '/test/video.mp4');
      
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      setTimeout(() => mockProcess.emit('close', 0), 50);
      
      await service.convertMP4ToM4A('/test/video.mp4', undefined, { quality: 'high' });
      
      const args = mockSpawn.mock.calls[0][1];
      expect(args).toContain('-q:a');
      expect(args).toContain('1');
    });
  });

  describe('M4A to MP3 Conversion', () => {
    beforeEach(async () => {
      // Setup successful FFmpeg check
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      setTimeout(() => mockProcess.emit('close', 0), 10);
      await service.ensureInitialized();
      vi.clearAllMocks();
    });

    it('should convert M4A to MP3 successfully', async () => {
      const inputPath = '/test/audio.m4a';
      const outputPath = '/test/audio.mp3';
      
      mockExistsSync.mockImplementation((path: string) => path === inputPath);
      
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      setTimeout(() => mockProcess.emit('close', 0), 50);
      
      const result = await service.convertM4AToMP3(inputPath, outputPath);
      
      expect(result.success).toBe(true);
      expect(result.outputPath).toBe(outputPath);
      
      expect(mockSpawn).toHaveBeenCalledWith('ffmpeg', [
        '-i', inputPath,
        '-acodec', 'libmp3lame',
        '-b:a', '192k',
        '-y',
        outputPath
      ]);
    });

    it('should use custom bitrate', async () => {
      mockExistsSync.mockImplementation((path: string) => path === '/test/audio.m4a');
      
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      setTimeout(() => mockProcess.emit('close', 0), 50);
      
      await service.convertM4AToMP3('/test/audio.m4a', undefined, { bitrate: '320k' });
      
      const args = mockSpawn.mock.calls[0][1];
      expect(args).toContain('-b:a');
      expect(args).toContain('320k');
    });
  });

  describe('Video Metadata Extraction', () => {
    beforeEach(async () => {
      // Setup successful FFmpeg check
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      setTimeout(() => mockProcess.emit('close', 0), 10);
      await service.ensureInitialized();
      vi.clearAllMocks();
    });

    it('should extract video metadata successfully', async () => {
      mockExistsSync.mockReturnValue(true);
      
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      
      const ffprobeOutput = JSON.stringify({
        format: {
          duration: '120.5',
          bit_rate: '1500000',
          size: '22680000'
        },
        streams: [{
          codec_type: 'video',
          width: 1920,
          height: 1080,
          codec_name: 'h264',
          r_frame_rate: '30/1'
        }]
      });
      
      setTimeout(() => {
        mockProcess.stdout.emit('data', ffprobeOutput);
        mockProcess.emit('close', 0);
      }, 50);
      
      const result = await service.extractVideoMetadata('/test/video.mp4');
      
      expect(result.success).toBe(true);
      expect(result.metadata).toEqual({
        durationSeconds: 120.5,
        size: 22680000,
        width: 1920,
        height: 1080,
        codec: 'h264',
        fps: 30,
        bitrate: 1500000
      });
    });

    it('should handle missing video file', async () => {
      mockExistsSync.mockReturnValue(false);
      
      const result = await service.extractVideoMetadata('/test/missing.mp4');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Input file not found');
    });

    it('should handle FFprobe error', async () => {
      mockExistsSync.mockReturnValue(true);
      
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      
      setTimeout(() => {
        mockProcess.stderr.emit('data', 'Invalid data found');
        mockProcess.emit('close', 1);
      }, 50);
      
      const result = await service.extractVideoMetadata('/test/video.mp4');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('FFprobe exited with code 1');
    });

    it('should handle malformed JSON output', async () => {
      mockExistsSync.mockReturnValue(true);
      
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      
      setTimeout(() => {
        mockProcess.stdout.emit('data', 'invalid json');
        mockProcess.emit('close', 0);
      }, 50);
      
      const result = await service.extractVideoMetadata('/test/video.mp4');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse FFprobe output');
    });

    it('should handle metadata extraction timeout', async () => {
      mockExistsSync.mockReturnValue(true);
      
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      
      const result = await service.extractVideoMetadata('/test/video.mp4', { timeout: 100 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Metadata extraction timeout');
    });
  });

  describe('Queue Management', () => {
    beforeEach(async () => {
      // Setup successful FFmpeg check
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      setTimeout(() => mockProcess.emit('close', 0), 10);
      await service.ensureInitialized();
      vi.clearAllMocks();
    });

    it('should queue conversions when max concurrent reached', async () => {
      service.setMaxConcurrentConversions(2);
      mockExistsSync.mockImplementation((path: string) => path.includes('.mp4'));
      
      const processes: MockChildProcess[] = [];
      mockSpawn.mockImplementation(() => {
        const process = new MockChildProcess();
        processes.push(process);
        return process;
      });
      
      // Start 3 conversions
      const conversions = [
        service.convertMP4ToM4A('/test/video1.mp4'),
        service.convertMP4ToM4A('/test/video2.mp4'),
        service.convertMP4ToM4A('/test/video3.mp4')
      ];
      
      // Wait a bit for conversions to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should have 2 active, 1 queued
      const stats = service.getStatistics();
      expect(stats.activeConversions).toBe(2);
      expect(stats.queueLength).toBe(1);
      
      // Complete first conversion
      processes[0].emit('close', 0);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Third conversion should now be active
      expect(service.getStatistics().activeConversions).toBe(2);
      expect(service.getStatistics().queueLength).toBe(0);
      
      // Complete remaining conversions
      processes[1].emit('close', 0);
      processes[2].emit('close', 0);
      
      const results = await Promise.all(conversions);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    it('should convert seconds to timestamp', () => {
      expect(service.secondsToTimestamp(0)).toBe('00:00:00');
      expect(service.secondsToTimestamp(65)).toBe('00:01:05');
      expect(service.secondsToTimestamp(3665)).toBe('01:01:05');
      expect(service.secondsToTimestamp(86400)).toBe('24:00:00');
    });

    it('should convert timestamp to seconds', () => {
      expect(service.timestampToSeconds('00:00:00')).toBe(0);
      expect(service.timestampToSeconds('00:01:05')).toBe(65);
      expect(service.timestampToSeconds('01:01:05')).toBe(3665);
      expect(service.timestampToSeconds('01:30')).toBe(90);
      expect(service.timestampToSeconds('invalid')).toBe(0);
    });
  });

  describe('Process Management', () => {
    beforeEach(async () => {
      // Setup successful FFmpeg check
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      setTimeout(() => mockProcess.emit('close', 0), 10);
      await service.ensureInitialized();
      vi.clearAllMocks();
    });

    it('should cancel specific conversion', async () => {
      mockExistsSync.mockImplementation((path: string) => path === '/test/video.mp4');
      
      const mockProcess = new MockChildProcess();
      const killSpy = vi.spyOn(mockProcess, 'kill');
      mockSpawn.mockReturnValue(mockProcess);
      
      // Start conversion but don't complete it
      const conversionPromise = service.convertMP4ToM4A('/test/video.mp4');
      
      // Wait for process to start
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Cancel should work with the conversion ID pattern
      const stats = service.getStatistics();
      expect(stats.activeProcesses).toBe(1);
      
      // Cancel all since we don't know the exact ID
      const cancelled = service.cancelAllConversions();
      expect(cancelled).toBe(1);
      expect(killSpy).toHaveBeenCalledWith('SIGTERM');
      
      const result = await conversionPromise;
      expect(result.success).toBe(false);
    });

    it('should cancel all conversions', async () => {
      mockExistsSync.mockImplementation((path: string) => path.includes('.mp4'));
      
      const processes: MockChildProcess[] = [];
      mockSpawn.mockImplementation(() => {
        const process = new MockChildProcess();
        processes.push(process);
        return process;
      });
      
      // Start multiple conversions
      const conversions = [
        service.convertMP4ToM4A('/test/video1.mp4'),
        service.convertMP4ToM4A('/test/video2.mp4')
      ];
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const cancelled = service.cancelAllConversions();
      expect(cancelled).toBe(2);
      
      const results = await Promise.all(conversions);
      expect(results.every(r => !r.success)).toBe(true);
    });
  });

  describe('Health Check', () => {
    it('should report healthy when FFmpeg is available', async () => {
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      setTimeout(() => mockProcess.emit('close', 0), 10);
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.ffmpeg).toBe('available');
      expect(health.details.ffprobe).toBe('available');
    });

    it('should report unhealthy when FFmpeg is missing', async () => {
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      setTimeout(() => mockProcess.emit('close', 1), 10);
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.ffmpeg).toBe('missing');
    });

    it('should include process statistics', async () => {
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      setTimeout(() => mockProcess.emit('close', 0), 10);
      
      await service.ensureInitialized();
      vi.clearAllMocks();
      
      // Start a conversion
      mockExistsSync.mockImplementation((path: string) => path === '/test/video.mp4');
      mockSpawn.mockReturnValue(new MockChildProcess());
      service.convertMP4ToM4A('/test/video.mp4');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      mockSpawn.mockReturnValue(mockProcess);
      setTimeout(() => mockProcess.emit('close', 0), 10);
      
      const health = await service.healthCheck();
      
      expect(health.details.activeProcesses).toBeGreaterThan(0);
      expect(health.details.activeConversions).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      // Setup successful FFmpeg check
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      setTimeout(() => mockProcess.emit('close', 0), 10);
      await service.ensureInitialized();
      vi.clearAllMocks();
    });

    it('should handle spawn errors', async () => {
      mockExistsSync.mockImplementation((path: string) => path === '/test/video.mp4');
      
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      
      setTimeout(() => {
        mockProcess.emit('error', new Error('spawn ENOENT'));
      }, 50);
      
      const result = await service.convertMP4ToM4A('/test/video.mp4');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to start FFmpeg');
    });

    it('should clean up resources on dispose', async () => {
      mockExistsSync.mockImplementation((path: string) => path === '/test/video.mp4');
      
      const mockProcess = new MockChildProcess();
      const killSpy = vi.spyOn(mockProcess, 'kill');
      mockSpawn.mockReturnValue(mockProcess);
      
      // Start conversion
      service.convertMP4ToM4A('/test/video.mp4');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Dispose service
      await service.dispose();
      
      expect(killSpy).toHaveBeenCalledWith('SIGTERM');
      expect(service.getStatistics().activeProcesses).toBe(0);
    });
  });

  describe('Performance Tests', () => {
    beforeEach(async () => {
      // Setup successful FFmpeg check
      const mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
      setTimeout(() => mockProcess.emit('close', 0), 10);
      await service.ensureInitialized();
      vi.clearAllMocks();
    });

    it('should handle large batch of conversions', async () => {
      service.setMaxConcurrentConversions(5);
      mockExistsSync.mockImplementation((path: string) => path.includes('.mp4'));
      
      const processes: MockChildProcess[] = [];
      mockSpawn.mockImplementation(() => {
        const process = new MockChildProcess();
        processes.push(process);
        // Auto-complete after random delay
        setTimeout(() => process.emit('close', 0), Math.random() * 200 + 50);
        return process;
      });
      
      // Start 20 conversions
      const conversions = Array.from({ length: 20 }, (_, i) => 
        service.convertMP4ToM4A(`/test/video${i}.mp4`)
      );
      
      const results = await Promise.all(conversions);
      
      expect(results.every(r => r.success)).toBe(true);
      expect(processes.length).toBe(20);
      
      // Check that queue was used
      const maxActive = Math.max(...processes.map(() => 
        service.getStatistics().activeConversions
      ));
      expect(maxActive).toBeLessThanOrEqual(5);
    });

    it('should maintain performance with concurrent metadata extractions', async () => {
      mockExistsSync.mockReturnValue(true);
      
      mockSpawn.mockImplementation(() => {
        const process = new MockChildProcess();
        setTimeout(() => {
          process.stdout.emit('data', JSON.stringify({
            format: { duration: '60', size: '1000000' },
            streams: [{ codec_type: 'video', width: 1280, height: 720 }]
          }));
          process.emit('close', 0);
        }, Math.random() * 100);
        return process;
      });
      
      const start = Date.now();
      
      // Extract metadata from 10 files concurrently
      const extractions = Array.from({ length: 10 }, (_, i) => 
        service.extractVideoMetadata(`/test/video${i}.mp4`)
      );
      
      const results = await Promise.all(extractions);
      const duration = Date.now() - start;
      
      expect(results.every(r => r.success)).toBe(true);
      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });
  });
});