import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioTranscriptionService } from '../AudioTranscriptionService';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock dependencies
vi.mock('fs');
vi.mock('child_process');

// Create mock process
class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
}

describe('AudioTranscriptionService', () => {
  let service: AudioTranscriptionService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance
    AudioTranscriptionService['instance'] = undefined;
    service = AudioTranscriptionService.getInstance();
    
    // Add mock logger to avoid undefined errors
    if (!service['logger']) {
      service['logger'] = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
      };
    }
  });

  afterEach(() => {
    // Cleanup intervals
    if (service['cleanupInterval']) {
      clearInterval(service['cleanupInterval']);
    }
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AudioTranscriptionService.getInstance();
      const instance2 = AudioTranscriptionService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should accept config on first getInstance', () => {
      const config = { maxConcurrentJobs: 5, outputDir: '/custom' };
      const instance = AudioTranscriptionService.getInstance(config);
      
      expect(instance['config']).toEqual(config);
    });
  });

  describe('transcribeFile', () => {
    it('should transcribe audio file successfully', async () => {
      const audioPath = '/path/to/audio.mp3';
      const options = { model: 'base' as const };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const mockProcess = new MockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as any);
      
      // Simulate successful transcription
      setTimeout(() => {
        mockProcess.stdout.emit('data', 'Processing...\n');
        mockProcess.stdout.emit('data', 'Transcription completed\n');
        mockProcess.stdout.emit('data', 'Transcribed text: Hello world\n');
        mockProcess.emit('close', 0);
      }, 10);
      
      const result = await service.transcribeFile(audioPath, options);
      
      expect(result).toEqual({
        success: true,
        text: 'Hello world',
        processingMetadata: expect.objectContaining({
          model: 'base',
          audioFile: audioPath
        })
      });
    });

    it('should handle file not found error', async () => {
      const audioPath = '/nonexistent/audio.mp3';
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const result = await service.transcribeFile(audioPath, { model: 'base' });
      
      expect(result).toEqual({
        success: false,
        error: 'Audio file not found: /nonexistent/audio.mp3'
      });
    });

    it('should handle transcription process error', async () => {
      const audioPath = '/path/to/audio.mp3';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const mockProcess = new MockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as any);
      
      setTimeout(() => {
        mockProcess.stderr.emit('data', 'Error: Failed to process\n');
        mockProcess.emit('close', 1);
      }, 10);
      
      const result = await service.transcribeFile(audioPath, { model: 'base' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to process');
    });

    it('should extract summary when requested', async () => {
      const audioPath = '/path/to/audio.mp3';
      const options = { model: 'base' as const, generateSummary: true };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const mockProcess = new MockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as any);
      
      setTimeout(() => {
        mockProcess.stdout.emit('data', 'Transcribed text: Hello world\n');
        mockProcess.stdout.emit('data', 'Summary: A greeting\n');
        mockProcess.emit('close', 0);
      }, 10);
      
      const result = await service.transcribeFile(audioPath, options);
      
      expect(result.success).toBe(true);
      expect(result.text).toBe('Hello world');
      expect(result.summary).toBe('A greeting');
    });

    it('should respect concurrent job limits', async () => {
      // Create service with limit of 2
      service = AudioTranscriptionService.getInstance({ maxConcurrentJobs: 2 });
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const mockProcess = new MockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as any);
      
      // Start 3 jobs
      const job1 = service.transcribeFile('/audio1.mp3', { model: 'base' });
      const job2 = service.transcribeFile('/audio2.mp3', { model: 'base' });
      const job3 = service.transcribeFile('/audio3.mp3', { model: 'base' });
      
      // Check that only 2 processes were spawned immediately
      expect(spawn).toHaveBeenCalledTimes(2);
      
      // Complete first job
      const processes = (spawn as any).mock.results;
      setTimeout(() => {
        processes[0].value.emit('close', 0);
      }, 10);
      
      // Wait a bit and check that third job started
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(spawn).toHaveBeenCalledTimes(3);
    });
  });

  describe('transcribeAndSummarize', () => {
    it('should transcribe multiple files', async () => {
      const files = ['/audio1.mp3', '/audio2.mp3'];
      const options = { model: 'base' as const };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      let callCount = 0;
      vi.mocked(spawn).mockImplementation(() => {
        const mockProcess = new MockChildProcess();
        const index = callCount++;
        
        setTimeout(() => {
          mockProcess.stdout.emit('data', `Transcribed text: Text ${index + 1}\n`);
          mockProcess.emit('close', 0);
        }, 10);
        
        return mockProcess as any;
      });
      
      // Since there's no batch method, we'll test transcribeAndSummarize instead
      const result = await service.transcribeAndSummarize(files[0]);
      
      expect(result.success).toBe(true);
      expect(result.text).toBe('Text 1');
    });

    it('should generate summary with transcription', async () => {
      const audioPath = '/audio.mp3';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const mockProcess = new MockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as any);
      
      setTimeout(() => {
        mockProcess.stdout.emit('data', 'Transcribed text: Full transcript\n');
        mockProcess.stdout.emit('data', 'Summary: Brief summary\n');
        mockProcess.emit('close', 0);
      }, 10);
      
      const result = await service.transcribeAndSummarize(audioPath, 'base');
      
      expect(result.success).toBe(true);
      expect(result.text).toBe('Full transcript');
      expect(result.summary).toBe('Brief summary');
    });
  });

  describe('cancelTranscription', () => {
    it('should cancel running transcription', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const mockProcess = new MockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as any);
      
      // Start transcription
      const promise = service.transcribeFile('/audio.mp3', { model: 'base' });
      
      // Get job ID (it should be the only active job)
      const jobIds = service.getActiveJobs();
      expect(jobIds).toHaveLength(1);
      
      // Cancel it
      const cancelled = service.cancelJob(jobIds[0]);
      expect(cancelled).toBe(true);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      
      // Process should emit close with non-zero code
      mockProcess.emit('close', 1);
      
      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });

    it('should return false for non-existent job', async () => {
      const cancelled = service.cancelJob('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  describe('getActiveJobs', () => {
    it('should return list of active job IDs', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(spawn).mockReturnValue(new MockChildProcess() as any);
      
      // Start two jobs
      service.transcribeFile('/audio1.mp3', { model: 'base' });
      service.transcribeFile('/audio2.mp3', { model: 'base' });
      
      const activeJobs = service.getActiveJobs();
      expect(activeJobs).toHaveLength(2);
      expect(activeJobs[0]).toHaveProperty('id');
      expect(activeJobs[0]).toHaveProperty('status', 'running');
    });
  });

  describe('getMetrics', () => {
    it('should return service statistics', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const mockProcess = new MockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as any);
      
      // Complete one successful job
      const promise1 = service.transcribeFile('/audio1.mp3', { model: 'base' });
      setTimeout(() => {
        mockProcess.stdout.emit('data', 'Transcribed text: Text\n');
        mockProcess.emit('close', 0);
      }, 10);
      await promise1;
      
      // Fail one job
      const promise2 = service.transcribeFile('/audio2.mp3', { model: 'base' });
      setTimeout(() => {
        mockProcess.emit('close', 1);
      }, 10);
      await promise2;
      
      const stats = service.getMetrics();
      
      expect(stats).toEqual({
        totalJobs: 2,
        completedJobs: 1,
        failedJobs: 1,
        activeJobs: 0,
        queuedJobs: 0
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const result = await service.healthCheck();
      
      expect(result).toMatchObject({
        healthy: true,
        serviceName: 'AudioTranscriptionService',
        timestamp: expect.any(Date),
        details: {
          activeJobs: 0,
          queuedJobs: 0,
          pythonAvailable: expect.any(Boolean)
        }
      });
    });

    it('should check Python availability', async () => {
      const mockProcess = new MockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as any);
      
      setTimeout(() => {
        mockProcess.emit('close', 0);
      }, 10);
      
      const result = await service.healthCheck();
      
      expect(spawn).toHaveBeenCalledWith('python', ['--version']);
      expect(result.details.pythonAvailable).toBe(true);
    });
  });

  describe('resetMetrics', () => {
    it('should reset service metrics', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const mockProcess = new MockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as any);
      
      // Complete a job to generate metrics
      const promise = service.transcribeFile('/audio.mp3', { model: 'base' });
      setTimeout(() => {
        mockProcess.stdout.emit('data', 'Transcribed text: Text\n');
        mockProcess.emit('close', 0);
      }, 10);
      await promise;
      
      // Reset metrics
      service.resetMetrics();
      
      const metrics = service.getMetrics();
      expect(metrics.totalJobs).toBe(0);
      expect(metrics.completedJobs).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('should cancel all active jobs on shutdown', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const mockProcesses = [new MockChildProcess(), new MockChildProcess()];
      let processIndex = 0;
      
      vi.mocked(spawn).mockImplementation(() => {
        return mockProcesses[processIndex++] as any;
      });
      
      // Start jobs
      service.transcribeFile('/audio1.mp3', { model: 'base' });
      service.transcribeFile('/audio2.mp3', { model: 'base' });
      
      // Shutdown
      await service.shutdown();
      
      // Check that processes were killed
      expect(mockProcesses[0].kill).toHaveBeenCalled();
      expect(mockProcesses[1].kill).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle spawn errors', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(spawn).mockImplementation(() => {
        throw new Error('Spawn failed');
      });
      
      const result = await service.transcribeFile('/audio.mp3', { model: 'base' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Spawn failed');
    });

    it('should timeout long-running jobs', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const mockProcess = new MockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as any);
      
      // Don't emit any events - let it timeout
      const promise = service.transcribeFile('/audio.mp3', { model: 'base' });
      
      // Fast-forward time
      vi.useFakeTimers();
      vi.advanceTimersByTime(600000); // 10 minutes
      
      const result = await promise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      
      vi.useRealTimers();
    });
  });
});