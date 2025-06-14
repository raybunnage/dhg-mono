/**
 * Converter Service
 * 
 * A singleton service for handling conversions between different file formats
 * and data structures. Provides standardized conversion methods for media files,
 * data formats, and encoding schemes.
 * 
 * Refactored to extend SingletonService for proper lifecycle management and resource control.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { SingletonService } from '../base-classes/SingletonService';
import { formatterService } from '../formatter-service';

// Interface for video metadata
export interface VideoMetadata {
  durationSeconds: number;
  width?: number;
  height?: number;
  bitrate?: number;
  codec?: string;
  fps?: number;
  size?: number;
}

// Interface for conversion result
export interface ConversionResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  duration?: number;
  metadata?: any;
}

// Interface for metadata extraction result
export interface MetadataResult {
  success: boolean;
  metadata?: VideoMetadata;
  error?: string;
}

// Interface for conversion options
export interface ConversionOptions {
  timeout?: number;
  quality?: string;
  bitrate?: string;
  outputDir?: string;
  overwrite?: boolean;
}

/**
 * ConverterService handles media file conversions and metadata extraction.
 * 
 * @example
 * ```typescript
 * const converter = ConverterService.getInstance();
 * await converter.ensureInitialized();
 * 
 * const result = await converter.convertMP4ToM4A('/path/to/video.mp4');
 * const metadata = await converter.extractVideoMetadata('/path/to/video.mp4');
 * ```
 */
export class ConverterService extends SingletonService {
  private static instance: ConverterService;
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private conversionQueue: Array<() => Promise<void>> = [];
  private maxConcurrentConversions = 3;
  private activeConversions = 0;
  private ffmpegPath: string = 'ffmpeg';
  private ffprobePath: string = 'ffprobe';
  
  protected constructor() {
    super('ConverterService', {
      info: (msg: string) => console.log(`[ConverterService] ${msg}`),
      error: (msg: string, error?: any) => console.error(`[ConverterService] ${msg}`, error || ''),
      debug: (msg: string) => console.debug(`[ConverterService] ${msg}`),
      warn: (msg: string) => console.warn(`[ConverterService] ${msg}`)
    });
  }

  /**
   * Get the singleton instance of ConverterService
   */
  public static getInstance(): ConverterService {
    if (!ConverterService.instance) {
      ConverterService.instance = new ConverterService();
    }
    return ConverterService.instance;
  }

  /**
   * Ensure the service is initialized (public wrapper for protected method)
   */
  public async ensureInitialized(): Promise<void> {
    await super.ensureInitialized();
  }

  /**
   * Initialize the service and verify FFmpeg availability
   */
  protected async initialize(): Promise<void> {
    this.logger?.info('Initializing ConverterService');
    
    // Verify FFmpeg is available
    try {
      await this.verifyFFmpegInstallation();
      this.logger?.info('FFmpeg and FFprobe verified');
    } catch (error) {
      this.logger?.error('FFmpeg verification failed', error);
      throw error;
    }
  }

  /**
   * Release resources managed by this service
   */
  protected async releaseResources(): Promise<void> {
    // Kill all active processes
    for (const [id, process] of this.activeProcesses) {
      this.logger?.warn(`Killing active process: ${id}`);
      process.kill('SIGTERM');
    }
    this.activeProcesses.clear();
    
    // Clear conversion queue
    this.conversionQueue = [];
    this.activeConversions = 0;
    
    this.logger?.info('ConverterService resources released');
  }

  /**
   * Health check for the service
   */
  public async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const ffmpegOk = await this.checkCommand(this.ffmpegPath, ['-version']);
      const ffprobeOk = await this.checkCommand(this.ffprobePath, ['-version']);
      
      return {
        healthy: ffmpegOk && ffprobeOk,
        details: {
          ffmpeg: ffmpegOk ? 'available' : 'missing',
          ffprobe: ffprobeOk ? 'available' : 'missing',
          activeProcesses: this.activeProcesses.size,
          queueLength: this.conversionQueue.length,
          activeConversions: this.activeConversions
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Verify FFmpeg and FFprobe are installed
   */
  private async verifyFFmpegInstallation(): Promise<void> {
    const ffmpegOk = await this.checkCommand(this.ffmpegPath, ['-version']);
    const ffprobeOk = await this.checkCommand(this.ffprobePath, ['-version']);
    
    if (!ffmpegOk) {
      throw new Error('FFmpeg is not installed or not in PATH');
    }
    
    if (!ffprobeOk) {
      throw new Error('FFprobe is not installed or not in PATH');
    }
  }

  /**
   * Check if a command is available
   */
  private async checkCommand(command: string, args: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn(command, args);
      process.on('close', (code) => resolve(code === 0));
      process.on('error', () => resolve(false));
    });
  }

  /**
   * Convert MP4 video file to M4A audio file
   */
  public async convertMP4ToM4A(
    inputPath: string, 
    outputPath?: string,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    await this.ensureInitialized();
    
    // Validate input
    if (!fs.existsSync(inputPath)) {
      return { success: false, error: `Input file not found: ${inputPath}` };
    }

    // Generate output path if not provided
    const finalOutputPath = outputPath || this.generateOutputPath(inputPath, 'm4a', options.outputDir);
    
    // Check if output already exists and overwrite is false
    if (!options.overwrite && fs.existsSync(finalOutputPath)) {
      return { success: false, error: `Output file already exists: ${finalOutputPath}` };
    }
    
    // Ensure output directory exists
    const outputDir = path.dirname(finalOutputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Set default options
    const timeout = options.timeout || 5 * 60 * 1000; // 5 minutes default timeout
    const quality = options.quality || 'medium';
    const bitrate = options.bitrate || '128k';

    // Build FFmpeg command arguments
    const ffmpegArgs = [
      '-i', inputPath,
      '-vn', // No video
      '-acodec', 'aac',
      '-b:a', bitrate,
      '-y' // Overwrite output file
    ];

    // Add quality settings
    if (quality === 'high') {
      ffmpegArgs.push('-q:a', '1');
    } else if (quality === 'low') {
      ffmpegArgs.push('-q:a', '5');
    }

    // Add output file
    ffmpegArgs.push(finalOutputPath);

    return this.executeConversion('mp4-to-m4a', ffmpegArgs, finalOutputPath, timeout);
  }

  /**
   * Convert M4A audio file to MP3 format
   */
  public async convertM4AToMP3(
    inputPath: string,
    outputPath?: string,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    await this.ensureInitialized();
    
    // Validate input
    if (!fs.existsSync(inputPath)) {
      return { success: false, error: `Input file not found: ${inputPath}` };
    }

    // Generate output path if not provided
    const finalOutputPath = outputPath || this.generateOutputPath(inputPath, 'mp3', options.outputDir);
    
    // Check if output already exists and overwrite is false
    if (!options.overwrite && fs.existsSync(finalOutputPath)) {
      return { success: false, error: `Output file already exists: ${finalOutputPath}` };
    }
    
    // Ensure output directory exists
    const outputDir = path.dirname(finalOutputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Set default options
    const timeout = options.timeout || 5 * 60 * 1000; // 5 minutes default timeout
    const bitrate = options.bitrate || '192k';

    // Build FFmpeg command arguments
    const ffmpegArgs = [
      '-i', inputPath,
      '-acodec', 'libmp3lame',
      '-b:a', bitrate,
      '-y', // Overwrite output file
      finalOutputPath
    ];

    return this.executeConversion('m4a-to-mp3', ffmpegArgs, finalOutputPath, timeout);
  }

  /**
   * Execute a conversion with queue management
   */
  private async executeConversion(
    conversionId: string,
    ffmpegArgs: string[],
    outputPath: string,
    timeout: number
  ): Promise<ConversionResult> {
    // Check if we can run immediately or need to queue
    if (this.activeConversions >= this.maxConcurrentConversions) {
      this.logger?.info(`Queueing conversion ${conversionId} (${this.conversionQueue.length} in queue)`);
      
      return new Promise((resolve) => {
        this.conversionQueue.push(async () => {
          const result = await this.runFFmpegCommand(conversionId, ffmpegArgs, outputPath, timeout);
          resolve(result);
        });
      });
    }
    
    return this.runFFmpegCommand(conversionId, ffmpegArgs, outputPath, timeout);
  }

  /**
   * Run FFmpeg command with proper process management
   */
  private async runFFmpegCommand(
    conversionId: string,
    ffmpegArgs: string[],
    outputPath: string,
    timeout: number
  ): Promise<ConversionResult> {
    this.activeConversions++;
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let timeoutId: NodeJS.Timeout;
      let stdoutData = '';
      let stderrData = '';
      
      // Spawn FFmpeg process
      const ffmpeg = spawn(this.ffmpegPath, ffmpegArgs);
      this.activeProcesses.set(conversionId, ffmpeg);
      
      ffmpeg.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      ffmpeg.stderr.on('data', (data) => {
        stderrData += data.toString();
      });
      
      // Set timeout
      timeoutId = setTimeout(() => {
        ffmpeg.kill('SIGTERM');
        this.activeProcesses.delete(conversionId);
        this.activeConversions--;
        this.processQueue();
        
        resolve({
          success: false,
          error: `Conversion timeout after ${formatterService.formatDuration(timeout)}`
        });
      }, timeout);
      
      ffmpeg.on('close', (code) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(conversionId);
        this.activeConversions--;
        
        const duration = Date.now() - startTime;
        
        if (code === 0) {
          this.logger?.info(`Conversion ${conversionId} completed in ${duration}ms`);
          resolve({
            success: true,
            outputPath,
            duration
          });
        } else {
          this.logger?.error(`Conversion ${conversionId} failed with code ${code}`);
          resolve({
            success: false,
            error: `FFmpeg exited with code ${code}: ${stderrData}`,
            duration
          });
        }
        
        this.processQueue();
      });
      
      ffmpeg.on('error', (err) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(conversionId);
        this.activeConversions--;
        this.processQueue();
        
        resolve({
          success: false,
          error: `Failed to start FFmpeg: ${err.message}`
        });
      });
    });
  }

  /**
   * Process queued conversions
   */
  private processQueue(): void {
    if (this.conversionQueue.length > 0 && this.activeConversions < this.maxConcurrentConversions) {
      const nextConversion = this.conversionQueue.shift();
      if (nextConversion) {
        nextConversion();
      }
    }
  }

  /**
   * Convert timestamp in seconds to HH:MM:SS format
   */
  public secondsToTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  }

  /**
   * Convert timestamp in HH:MM:SS format to seconds
   */
  public timestampToSeconds(timestamp: string): number {
    const parts = timestamp.split(':').map(Number);
    
    if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // MM:SS
      return parts[0] * 60 + parts[1];
    }
    
    return 0;
  }

  /**
   * Extract metadata from MP4 video file using FFprobe
   */
  public async extractVideoMetadata(
    filePath: string,
    options: { timeout?: number } = {}
  ): Promise<MetadataResult> {
    await this.ensureInitialized();
    
    // Handle missing input file
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `Input file not found: ${filePath}` };
    }

    // Set default options
    const timeout = options.timeout || 30 * 1000; // 30 seconds default timeout

    return new Promise((resolve) => {
      let timeoutId: NodeJS.Timeout;
      let stdoutData = '';
      let stderrData = '';
      
      // Spawn FFprobe process to get duration and other metadata
      const ffprobe = spawn(this.ffprobePath, [
        '-v', 'error',
        '-show_entries', 'format=duration,bit_rate,size:stream=width,height,codec_name,r_frame_rate',
        '-of', 'json',
        filePath
      ]);
      
      const probeId = `probe-${Date.now()}`;
      this.activeProcesses.set(probeId, ffprobe);
      
      ffprobe.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      ffprobe.stderr.on('data', (data) => {
        stderrData += data.toString();
      });
      
      // Set timeout
      timeoutId = setTimeout(() => {
        ffprobe.kill();
        this.activeProcesses.delete(probeId);
        resolve({
          success: false,
          error: `Metadata extraction timeout after ${formatterService.formatDuration(timeout)}`
        });
      }, timeout);
      
      ffprobe.on('close', (code) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(probeId);
        
        if (code === 0) {
          try {
            const ffprobeData = JSON.parse(stdoutData);
            
            // Extract relevant metadata
            const metadata: VideoMetadata = {
              durationSeconds: parseFloat(ffprobeData.format?.duration) || 0,
              size: parseInt(ffprobeData.format?.size) || 0
            };
            
            // Add video stream info if available
            if (ffprobeData.streams && ffprobeData.streams.length > 0) {
              const videoStream = ffprobeData.streams.find((s: any) => s.codec_type === 'video');
              if (videoStream) {
                metadata.width = videoStream.width;
                metadata.height = videoStream.height;
                metadata.codec = videoStream.codec_name;
                
                // Parse framerate (can be in format "24/1")
                if (videoStream.r_frame_rate) {
                  const frParts = videoStream.r_frame_rate.split('/');
                  if (frParts.length === 2) {
                    metadata.fps = parseInt(frParts[0]) / parseInt(frParts[1]);
                  }
                }
              }
            }
            
            // Add bitrate if available
            if (ffprobeData.format?.bit_rate) {
              metadata.bitrate = parseInt(ffprobeData.format.bit_rate);
            }
            
            resolve({
              success: true,
              metadata
            });
          } catch (err: any) {
            resolve({
              success: false,
              error: `Failed to parse FFprobe output: ${err.message}`
            });
          }
        } else {
          resolve({
            success: false,
            error: `FFprobe exited with code ${code}: ${stderrData}`
          });
        }
      });
      
      ffprobe.on('error', (err) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(probeId);
        resolve({
          success: false,
          error: `Failed to start FFprobe: ${err.message}`
        });
      });
    });
  }

  /**
   * Generate an output path based on the input path and desired extension
   */
  private generateOutputPath(inputPath: string, extension: string, outputDir?: string): string {
    const parsedPath = path.parse(inputPath);
    const outputFileName = `${parsedPath.name}.${extension}`;
    
    if (outputDir) {
      return path.join(outputDir, outputFileName);
    }
    
    return path.join(parsedPath.dir, outputFileName);
  }

  /**
   * Get conversion statistics
   */
  public getStatistics(): {
    activeProcesses: number;
    queueLength: number;
    activeConversions: number;
    maxConcurrentConversions: number;
  } {
    return {
      activeProcesses: this.activeProcesses.size,
      queueLength: this.conversionQueue.length,
      activeConversions: this.activeConversions,
      maxConcurrentConversions: this.maxConcurrentConversions
    };
  }

  /**
   * Set maximum concurrent conversions
   */
  public setMaxConcurrentConversions(max: number): void {
    if (max > 0) {
      this.maxConcurrentConversions = max;
      this.logger?.info(`Max concurrent conversions set to ${max}`);
    }
  }

  /**
   * Cancel a specific conversion
   */
  public cancelConversion(conversionId: string): boolean {
    const process = this.activeProcesses.get(conversionId);
    if (process) {
      process.kill('SIGTERM');
      this.activeProcesses.delete(conversionId);
      this.logger?.info(`Cancelled conversion ${conversionId}`);
      return true;
    }
    return false;
  }

  /**
   * Cancel all active conversions
   */
  public cancelAllConversions(): number {
    const count = this.activeProcesses.size;
    for (const [id, process] of this.activeProcesses) {
      process.kill('SIGTERM');
      this.logger?.info(`Cancelled conversion ${id}`);
    }
    this.activeProcesses.clear();
    this.activeConversions = 0;
    return count;
  }
}

// Export a singleton instance for backwards compatibility
export const converterService = ConverterService.getInstance();