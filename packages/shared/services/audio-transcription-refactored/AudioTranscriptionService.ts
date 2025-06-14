/**
 * Audio Transcription Service - Refactored
 * 
 * A singleton service for transcribing audio files using the Modal-based Whisper service.
 * This service provides a TypeScript interface to Python-based Whisper transcription
 * functionality, handling process spawning, output parsing, and resource management.
 * 
 * Refactored to extend SingletonService for proper lifecycle management.
 */

import { SingletonService } from '../base-classes/SingletonService';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

// Re-export types for backward compatibility
export interface TranscriptionOptions {
  model: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  outputDir?: string;
  dryRun?: boolean;
  generateSummary?: boolean;
  accelerator?: 'T4' | 'A10G' | 'A100' | 'CPU';
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  summary?: string;
  processingMetadata?: {
    model: string;
    audioFile: string;
    processingTime?: number;
    wordCount?: number;
    summaryTime?: number;
  };
  error?: string;
}

// Enhanced types for refactored service
export interface TranscriptionJob {
  id: string;
  filePath: string;
  options: TranscriptionOptions;
  startTime: number;
  process?: ChildProcess;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

export interface TranscriptionServiceConfig {
  maxConcurrentJobs?: number;
  defaultOutputDir?: string;
  pythonCommand?: string;
  scriptBasePath?: string;
  jobTimeout?: number;
}

export interface ServiceMetrics {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  activeJobs: number;
  averageProcessingTime: number;
  totalProcessingTime: number;
}

/**
 * AudioTranscriptionService - Enhanced singleton service for handling audio transcriptions
 */
export class AudioTranscriptionService extends SingletonService {
  private static instance: AudioTranscriptionService;
  private config: TranscriptionServiceConfig;
  
  // Job management
  private activeJobs = new Map<string, TranscriptionJob>();
  private jobCounter = 0;
  
  // Metrics tracking
  private metrics: ServiceMetrics = {
    totalJobs: 0,
    successfulJobs: 0,
    failedJobs: 0,
    cancelledJobs: 0,
    activeJobs: 0,
    averageProcessingTime: 0,
    totalProcessingTime: 0
  };
  
  // Default configuration
  private readonly defaultConfig: TranscriptionServiceConfig = {
    maxConcurrentJobs: 3,
    pythonCommand: 'python',
    scriptBasePath: 'packages/python-audio-processor/scripts',
    jobTimeout: 600000 // 10 minutes
  };

  private constructor(config: TranscriptionServiceConfig = {}) {
    super('AudioTranscriptionService');
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: TranscriptionServiceConfig): AudioTranscriptionService {
    if (!AudioTranscriptionService.instance) {
      AudioTranscriptionService.instance = new AudioTranscriptionService(config);
    }
    return AudioTranscriptionService.instance;
  }

  /**
   * Initialize the service
   */
  protected async initialize(): Promise<void> {
    // Validate Python script paths
    await this.validatePythonScripts();
    
    // Start cleanup interval for completed jobs
    setInterval(() => this.cleanupCompletedJobs(), 60000); // Clean every minute
    
    this.logger.info('AudioTranscriptionService initialized successfully', {
      maxConcurrentJobs: this.config.maxConcurrentJobs,
      scriptBasePath: this.config.scriptBasePath
    });
  }

  /**
   * Transcribe an audio file using the Python Modal-based Whisper service
   */
  public async transcribeFile(
    filePath: string,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    await this.ensureInitialized();
    
    // Validate inputs
    if (!filePath) {
      throw new Error('File path is required');
    }
    
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`
      };
    }
    
    // Check concurrent job limit
    if (this.activeJobs.size >= this.config.maxConcurrentJobs!) {
      return {
        success: false,
        error: `Maximum concurrent jobs (${this.config.maxConcurrentJobs}) exceeded`
      };
    }
    
    // Create job
    const job = this.createJob(filePath, options);
    
    try {
      // Execute transcription
      const result = await this.executeTranscription(job);
      
      // Update metrics
      this.updateMetrics(job, result.success);
      
      return result;
    } catch (error) {
      this.updateMetrics(job, false);
      throw error;
    } finally {
      // Cleanup job
      this.activeJobs.delete(job.id);
      this.metrics.activeJobs = this.activeJobs.size;
    }
  }

  /**
   * Transcribe an audio file and generate a summary
   */
  public async transcribeAndSummarize(
    filePath: string,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    return this.transcribeFile(filePath, { ...options, generateSummary: true });
  }

  /**
   * Cancel a running transcription job
   */
  public cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status !== 'running') {
      return false;
    }
    
    if (job.process) {
      job.process.kill('SIGTERM');
      job.status = 'cancelled';
      this.metrics.cancelledJobs++;
      this.logger.info(`Cancelled transcription job: ${jobId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Get list of active jobs
   */
  public getActiveJobs(): TranscriptionJob[] {
    return Array.from(this.activeJobs.values()).map(job => ({
      ...job,
      process: undefined // Don't expose process object
    }));
  }

  /**
   * Get service metrics
   */
  public getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      cancelledJobs: 0,
      activeJobs: this.activeJobs.size,
      averageProcessingTime: 0,
      totalProcessingTime: 0
    };
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    details: Record<string, any>;
  }> {
    const pythonScriptsExist = await this.validatePythonScripts();
    
    return {
      healthy: this.initialized && pythonScriptsExist,
      details: {
        initialized: this.initialized,
        pythonScriptsAvailable: pythonScriptsExist,
        activeJobs: this.activeJobs.size,
        maxConcurrentJobs: this.config.maxConcurrentJobs,
        metrics: this.getMetrics(),
        config: {
          pythonCommand: this.config.pythonCommand,
          scriptBasePath: this.config.scriptBasePath
        }
      }
    };
  }

  /**
   * Shutdown the service
   */
  protected async shutdown(): Promise<void> {
    // Cancel all active jobs
    for (const [jobId, job] of this.activeJobs) {
      if (job.process && job.status === 'running') {
        this.logger.info(`Terminating job ${jobId} during shutdown`);
        job.process.kill('SIGTERM');
      }
    }
    
    // Wait a moment for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Force kill any remaining processes
    for (const [jobId, job] of this.activeJobs) {
      if (job.process) {
        this.logger.warn(`Force killing job ${jobId}`);
        job.process.kill('SIGKILL');
      }
    }
    
    this.activeJobs.clear();
    this.logger.info('AudioTranscriptionService shut down successfully');
  }

  // Private helper methods

  private createJob(filePath: string, options: TranscriptionOptions): TranscriptionJob {
    const jobId = `transcription-${++this.jobCounter}-${Date.now()}`;
    
    const job: TranscriptionJob = {
      id: jobId,
      filePath,
      options,
      startTime: Date.now(),
      status: 'pending'
    };
    
    this.activeJobs.set(jobId, job);
    this.metrics.totalJobs++;
    this.metrics.activeJobs = this.activeJobs.size;
    
    return job;
  }

  private async executeTranscription(job: TranscriptionJob): Promise<TranscriptionResult> {
    const { filePath, options } = job;
    const { model = 'base', outputDir, dryRun = false, generateSummary = false, accelerator = 'T4' } = options;
    
    // Generate output path if not specified
    let outputPath: string | undefined;
    if (outputDir || this.config.defaultOutputDir) {
      const dir = outputDir || this.config.defaultOutputDir!;
      const baseName = path.basename(filePath).replace(/\.[^/.]+$/, "");
      outputPath = path.join(dir, `${baseName}_transcript.txt`);
      
      // Ensure output directory exists
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    }

    // Handle dry run
    if (dryRun) {
      this.logger.info(`🔄 Would transcribe ${filePath} using ${model} model`);
      return {
        success: true,
        text: 'DRY-RUN: Transcription would be performed here',
        processingMetadata: {
          model,
          audioFile: filePath
        }
      };
    }

    // Choose the appropriate script
    const scriptName = generateSummary 
      ? 'advanced_audio_transcript.py'
      : 'base_audio_transcript.py';
    const scriptPath = path.join(process.cwd(), this.config.scriptBasePath!, scriptName);
    
    this.logger.info(`🎙️ Transcribing ${filePath} with ${model} model on ${accelerator} accelerator${generateSummary ? ' and generating summary' : ''}...`);
    
    return new Promise((resolve) => {
      // Build script arguments
      const scriptArgs = [scriptPath, filePath];
      
      if (outputPath) {
        scriptArgs.push(outputPath);
      }
      
      if (generateSummary) {
        scriptArgs.push(model);
      }
      
      scriptArgs.push('--accelerator', accelerator);
      
      // Spawn Python process
      const pythonProcess = spawn(this.config.pythonCommand!, scriptArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      job.process = pythonProcess;
      job.status = 'running';
      
      let stdout = '';
      let stderr = '';
      
      // Set up timeout
      const timeout = setTimeout(() => {
        this.logger.warn(`Transcription job ${job.id} timed out, terminating...`);
        pythonProcess.kill('SIGTERM');
      }, this.config.jobTimeout!);
      
      pythonProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
        this.logger.info(`[${job.id}] ${data.toString().trim()}`);
      });
      
      pythonProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
        this.logger.error(`[${job.id}] ${data.toString().trim()}`);
      });
      
      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        const processingTime = (Date.now() - job.startTime) / 1000;
        job.status = code === 0 ? 'completed' : 'failed';
        
        if (code === 0) {
          const result = this.parseTranscriptionOutput(stdout, outputPath, {
            model,
            audioFile: filePath,
            processingTime,
            generateSummary
          });
          resolve(result);
        } else {
          resolve({
            success: false,
            error: `Process exited with code ${code}: ${stderr}`,
            processingMetadata: {
              model,
              audioFile: filePath,
              processingTime
            }
          });
        }
      });
      
      pythonProcess.on('error', (error) => {
        clearTimeout(timeout);
        job.status = 'failed';
        resolve({
          success: false,
          error: `Failed to spawn process: ${error.message}`,
          processingMetadata: {
            model,
            audioFile: filePath,
            processingTime: (Date.now() - job.startTime) / 1000
          }
        });
      });
    });
  }

  private parseTranscriptionOutput(
    stdout: string,
    outputPath: string | undefined,
    metadata: any
  ): TranscriptionResult {
    const { generateSummary } = metadata;
    
    if (generateSummary) {
      // Parse JSON result for advanced script
      const jsonMatch = stdout.match(/JSON_RESULT_BEGIN\n([\s\S]*?)\nJSON_RESULT_END/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const result = JSON.parse(jsonMatch[1]);
          return {
            success: true,
            text: result.transcript,
            summary: result.summary,
            processingMetadata: {
              ...metadata,
              processingTime: result.stats?.total_time || metadata.processingTime,
              wordCount: result.stats?.word_count,
              summaryTime: result.stats?.summary_time
            }
          };
        } catch (error: any) {
          this.logger.error(`Error parsing JSON result: ${error.message}`);
        }
      }
    } else {
      // Parse text result for base script
      const transcriptMatch = stdout.match(/TRANSCRIPT_BEGIN\n([\s\S]*?)\nTRANSCRIPT_END/);
      let transcriptText = transcriptMatch ? transcriptMatch[1] : '';
      
      // Fallback to reading output file
      if (!transcriptText && outputPath && fs.existsSync(outputPath)) {
        try {
          transcriptText = fs.readFileSync(outputPath, 'utf8');
        } catch (error: any) {
          this.logger.error(`Error reading transcript file: ${error.message}`);
        }
      }
      
      if (transcriptText) {
        return {
          success: true,
          text: transcriptText,
          processingMetadata: {
            ...metadata,
            wordCount: transcriptText.split(/\s+/).length
          }
        };
      }
    }
    
    // Fallback result
    return {
      success: true,
      text: 'Transcription process completed but transcript could not be parsed',
      processingMetadata: metadata
    };
  }

  private async validatePythonScripts(): Promise<boolean> {
    const scriptNames = ['base_audio_transcript.py', 'advanced_audio_transcript.py'];
    
    for (const scriptName of scriptNames) {
      const scriptPath = path.join(process.cwd(), this.config.scriptBasePath!, scriptName);
      if (!fs.existsSync(scriptPath)) {
        this.logger.warn(`Python script not found: ${scriptPath}`);
        return false;
      }
    }
    
    return true;
  }

  private cleanupCompletedJobs(): void {
    const now = Date.now();
    const jobRetentionTime = 300000; // 5 minutes
    
    for (const [jobId, job] of this.activeJobs) {
      if ((job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
          (now - job.startTime) > jobRetentionTime) {
        this.activeJobs.delete(jobId);
      }
    }
    
    this.metrics.activeJobs = this.activeJobs.size;
  }

  private updateMetrics(job: TranscriptionJob, success: boolean): void {
    const processingTime = Date.now() - job.startTime;
    
    if (success) {
      this.metrics.successfulJobs++;
    } else {
      this.metrics.failedJobs++;
    }
    
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.averageProcessingTime = 
      this.metrics.totalProcessingTime / (this.metrics.successfulJobs + this.metrics.failedJobs);
  }
}