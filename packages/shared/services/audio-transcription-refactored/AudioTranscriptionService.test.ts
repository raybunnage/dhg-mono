import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioTranscriptionService } from './AudioTranscriptionService';
import { ChildProcess } from 'child_process';

// Mock Node.js modules
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    promises: {
      mkdir: vi.fn()
    }
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  promises: {
    mkdir: vi.fn()
  }
}));

vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

import * as fs from 'fs';
import { spawn } from 'child_process';

describe('AudioTranscriptionService', () => {
  let service: AudioTranscriptionService;
  let mockProcess: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Clear singleton instance
    AudioTranscriptionService['instance'] = undefined as any;
    
    // Mock successful file existence checks
    vi.mocked(fs.existsSync).mockReturnValue(true);
    
    // Mock process
    mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn()
    };
    
    vi.mocked(spawn).mockReturnValue(mockProcess as any);
  });

  afterEach(async () => {
    if (service && service['initialized']) {
      await service['shutdown']();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AudioTranscriptionService.getInstance();
      const instance2 = AudioTranscriptionService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should accept config on first instantiation', () => {
      const config = {
        maxConcurrentJobs: 5,
        defaultOutputDir: '/custom/output'
      };
      service = AudioTranscriptionService.getInstance(config);
      expect(service['config'].maxConcurrentJobs).toBe(5);
      expect(service['config'].defaultOutputDir).toBe('/custom/output');
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid Python scripts', async () => {
      service = AudioTranscriptionService.getInstance();
      await service.ensureInitialized();
      
      expect(service['initialized']).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('base_audio_transcript.py')
      );
      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('advanced_audio_transcript.py')
      );
    });

    it('should handle missing Python scripts gracefully', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => 
        !path.toString().includes('.py')
      );
      
      service = AudioTranscriptionService.getInstance();
      await service.ensureInitialized();
      
      const health = await service.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.details.pythonScriptsAvailable).toBe(false);
    });
  });

  describe('Transcription', () => {
    beforeEach(async () => {
      service = AudioTranscriptionService.getInstance();
      await service.ensureInitialized();
    });

    it('should transcribe file successfully', async () => {
      // Mock successful process
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10); // Success code
        }
      });

      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('TRANSCRIPT_BEGIN\nHello world\nTRANSCRIPT_END')), 5);
        }
      });

      const result = await service.transcribeFile('/test/audio.mp3', {
        model: 'base'
      });

      expect(result.success).toBe(true);
      expect(result.text).toBe('Hello world');
      expect(result.processingMetadata?.model).toBe('base');
      expect(result.processingMetadata?.audioFile).toBe('/test/audio.mp3');
    });

    it('should handle file not found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await service.transcribeFile('/nonexistent/file.mp3', {
        model: 'base'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should handle dry run mode', async () => {
      const result = await service.transcribeFile('/test/audio.mp3', {
        model: 'base',
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.text).toContain('DRY-RUN');
      expect(spawn).not.toHaveBeenCalled();
    });

    it('should respect concurrent job limits', async () => {
      // Set max jobs to 1
      service = AudioTranscriptionService.getInstance({ maxConcurrentJobs: 1 });
      await service.ensureInitialized();

      // Start first job (don't resolve it)
      mockProcess.on.mockImplementation(() => {}); // Keep running
      
      const promise1 = service.transcribeFile('/test/audio1.mp3', { model: 'base' });
      
      // Try to start second job immediately
      const result2 = await service.transcribeFile('/test/audio2.mp3', { model: 'base' });
      
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Maximum concurrent jobs');
    });

    it('should handle transcription with summary', async () => {
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          const jsonResult = {
            transcript: 'Hello world',
            summary: 'Brief greeting',
            stats: {
              total_time: 5.2,
              word_count: 2,
              summary_time: 1.1
            }
          };
          const output = `JSON_RESULT_BEGIN\n${JSON.stringify(jsonResult)}\nJSON_RESULT_END`;
          setTimeout(() => callback(Buffer.from(output)), 5);
        }
      });

      const result = await service.transcribeAndSummarize('/test/audio.mp3', {
        model: 'large'
      });

      expect(result.success).toBe(true);
      expect(result.text).toBe('Hello world');
      expect(result.summary).toBe('Brief greeting');
      expect(result.processingMetadata?.wordCount).toBe(2);
      expect(result.processingMetadata?.summaryTime).toBe(1.1);
    });

    it('should handle process failure', async () => {
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10); // Error code
        }
      });

      mockProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('Python error message')), 5);
        }
      });

      const result = await service.transcribeFile('/test/audio.mp3', {
        model: 'base'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Process exited with code 1');
      expect(result.error).toContain('Python error message');
    });

    it('should parse fallback from output file', async () => {
      // Mock process without stdout markers
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('No transcript markers')), 5);
        }
      });

      // Mock reading from output file
      vi.mocked(fs.readFileSync).mockReturnValue('Transcript from file');

      const result = await service.transcribeFile('/test/audio.mp3', {
        model: 'base',
        outputDir: '/output'
      });

      expect(result.success).toBe(true);
      expect(result.text).toBe('Transcript from file');
    });
  });

  describe('Job Management', () => {
    beforeEach(async () => {
      service = AudioTranscriptionService.getInstance();
      await service.ensureInitialized();
    });

    it('should track active jobs', async () => {
      // Keep process running
      mockProcess.on.mockImplementation(() => {});
      
      const promise = service.transcribeFile('/test/audio.mp3', { model: 'base' });
      
      // Check active jobs
      const activeJobs = service.getActiveJobs();
      expect(activeJobs).toHaveLength(1);
      expect(activeJobs[0].filePath).toBe('/test/audio.mp3');
      expect(activeJobs[0].status).toBe('running');
      expect(activeJobs[0].process).toBeUndefined(); // Should not expose process
    });

    it('should cancel running jobs', async () => {
      // Keep process running
      mockProcess.on.mockImplementation(() => {});
      
      const promise = service.transcribeFile('/test/audio.mp3', { model: 'base' });
      
      const activeJobs = service.getActiveJobs();
      const jobId = activeJobs[0].id;
      
      const cancelled = service.cancelJob(jobId);
      expect(cancelled).toBe(true);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should not cancel non-existent jobs', () => {
      const cancelled = service.cancelJob('non-existent-job');
      expect(cancelled).toBe(false);
    });
  });

  describe('Metrics', () => {
    beforeEach(async () => {
      service = AudioTranscriptionService.getInstance();
      await service.ensureInitialized();
    });

    it('should track job metrics', async () => {
      // Mock successful job
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('TRANSCRIPT_BEGIN\nTest\nTRANSCRIPT_END')), 5);
        }
      });

      await service.transcribeFile('/test/audio.mp3', { model: 'base' });

      const metrics = service.getMetrics();
      expect(metrics.totalJobs).toBe(1);
      expect(metrics.successfulJobs).toBe(1);
      expect(metrics.failedJobs).toBe(0);
      expect(metrics.averageProcessingTime).toBeGreaterThan(0);
    });

    it('should track failed jobs', async () => {
      // Mock failed job
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10); // Error code
        }
      });

      await service.transcribeFile('/test/audio.mp3', { model: 'base' });

      const metrics = service.getMetrics();
      expect(metrics.totalJobs).toBe(1);
      expect(metrics.successfulJobs).toBe(0);
      expect(metrics.failedJobs).toBe(1);
    });

    it('should reset metrics', async () => {
      // Add some metrics
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      await service.transcribeFile('/test/audio.mp3', { model: 'base' });
      
      service.resetMetrics();
      const metrics = service.getMetrics();
      
      expect(metrics.totalJobs).toBe(0);
      expect(metrics.successfulJobs).toBe(0);
      expect(metrics.failedJobs).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should report healthy status', async () => {
      service = AudioTranscriptionService.getInstance();
      await service.ensureInitialized();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.initialized).toBe(true);
      expect(health.details.pythonScriptsAvailable).toBe(true);
      expect(health.details.activeJobs).toBe(0);
      expect(health.details.metrics).toBeDefined();
    });

    it('should report unhealthy when scripts missing', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => 
        !path.toString().includes('.py')
      );
      
      service = AudioTranscriptionService.getInstance();
      await service.ensureInitialized();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.pythonScriptsAvailable).toBe(false);
    });
  });

  describe('Shutdown', () => {
    it('should terminate running processes on shutdown', async () => {
      service = AudioTranscriptionService.getInstance();
      await service.ensureInitialized();
      
      // Start a job
      mockProcess.on.mockImplementation(() => {}); // Keep running
      const promise = service.transcribeFile('/test/audio.mp3', { model: 'base' });
      
      // Shutdown
      await service['shutdown']();
      
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('Configuration', () => {
    it('should use custom Python command', async () => {
      service = AudioTranscriptionService.getInstance({
        pythonCommand: 'python3'
      });
      await service.ensureInitialized();
      
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      await service.transcribeFile('/test/audio.mp3', { model: 'base' });
      
      expect(spawn).toHaveBeenCalledWith('python3', expect.any(Array), expect.any(Object));
    });

    it('should use custom script base path', async () => {
      service = AudioTranscriptionService.getInstance({
        scriptBasePath: 'custom/scripts'
      });
      await service.ensureInitialized();
      
      // Check that validation looks in custom path
      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('custom/scripts/base_audio_transcript.py')
      );
    });
  });
});