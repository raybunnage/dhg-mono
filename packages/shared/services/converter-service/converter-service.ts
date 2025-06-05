/**
 * Converter Service
 * 
 * A singleton service for handling conversions between different file formats
 * and data structures. Provides standardized conversion methods for media files,
 * data formats, and encoding schemes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
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

export class ConverterService {
  private static instance: ConverterService;
  
  private constructor() {
    // Private constructor to enforce singleton pattern
  }
  
  public static getInstance(): ConverterService {
    if (!ConverterService.instance) {
      ConverterService.instance = new ConverterService();
    }
    return ConverterService.instance;
  }

  /**
   * Convert MP4 video file to M4A audio file
   * 
   * @param inputPath Path to the input MP4 file
   * @param outputPath Optional path for the output M4A file
   * @param options Additional conversion options
   * @returns Promise resolving to the result with success flag and output path
   */
  public async convertMP4ToM4A(
    inputPath: string, 
    outputPath?: string,
    options: {
      timeout?: number, 
      quality?: string,
      bitrate?: string
    } = {}
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    // Handle missing input file
    if (!fs.existsSync(inputPath)) {
      return { success: false, error: `Input file not found: ${inputPath}` };
    }

    // Generate output path if not provided
    const finalOutputPath = outputPath || this.generateOutputPath(inputPath, 'm4a');
    
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
      '-b:a', bitrate
    ];

    // Add quality settings
    if (quality === 'high') {
      ffmpegArgs.push('-q:a', '1');
    } else if (quality === 'low') {
      ffmpegArgs.push('-q:a', '5');
    }

    // Add output file
    ffmpegArgs.push(finalOutputPath);

    return new Promise((resolve) => {
      let timeoutId: NodeJS.Timeout;
      let stdoutData = '';
      let stderrData = '';
      
      // Spawn FFmpeg process
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      ffmpeg.stderr.on('data', (data) => {
        stderrData += data.toString();
      });
      
      // Set timeout
      timeoutId = setTimeout(() => {
        ffmpeg.kill();
        resolve({
          success: false,
          error: `Conversion timeout after ${formatterService.formatDuration(timeout)}`
        });
      }, timeout);
      
      ffmpeg.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code === 0) {
          resolve({
            success: true,
            outputPath: finalOutputPath
          });
        } else {
          resolve({
            success: false,
            error: `FFmpeg exited with code ${code}: ${stderrData}`
          });
        }
      });
      
      ffmpeg.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: `Failed to start FFmpeg: ${err.message}`
        });
      });
    });
  }

  /**
   * Convert M4A audio file to MP3 format
   * 
   * @param inputPath Path to the input M4A file
   * @param outputPath Optional path for the output MP3 file
   * @param options Additional conversion options
   * @returns Promise resolving to the result with success flag and output path
   */
  public async convertM4AToMP3(
    inputPath: string,
    outputPath?: string,
    options: {
      timeout?: number,
      bitrate?: string
    } = {}
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    // Handle missing input file
    if (!fs.existsSync(inputPath)) {
      return { success: false, error: `Input file not found: ${inputPath}` };
    }

    // Generate output path if not provided
    const finalOutputPath = outputPath || this.generateOutputPath(inputPath, 'mp3');
    
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
      finalOutputPath
    ];

    return new Promise((resolve) => {
      let timeoutId: NodeJS.Timeout;
      let stdoutData = '';
      let stderrData = '';
      
      // Spawn FFmpeg process
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      ffmpeg.stderr.on('data', (data) => {
        stderrData += data.toString();
      });
      
      // Set timeout
      timeoutId = setTimeout(() => {
        ffmpeg.kill();
        resolve({
          success: false,
          error: `Conversion timeout after ${formatterService.formatDuration(timeout)}`
        });
      }, timeout);
      
      ffmpeg.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code === 0) {
          resolve({
            success: true,
            outputPath: finalOutputPath
          });
        } else {
          resolve({
            success: false,
            error: `FFmpeg exited with code ${code}: ${stderrData}`
          });
        }
      });
      
      ffmpeg.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: `Failed to start FFmpeg: ${err.message}`
        });
      });
    });
  }

  /**
   * Convert timestamp in seconds to HH:MM:SS format
   * 
   * @param seconds Number of seconds
   * @returns Formatted timestamp string
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
   * 
   * @param timestamp Timestamp string in HH:MM:SS format
   * @returns Number of seconds
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
   * 
   * @param filePath Path to the MP4 file
   * @param options Additional options for extraction
   * @returns Promise resolving to the metadata
   */
  public async extractVideoMetadata(
    filePath: string,
    options: {
      timeout?: number
    } = {}
  ): Promise<{ success: boolean; metadata?: VideoMetadata; error?: string }> {
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
      const ffprobe = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration,bit_rate,size:stream=width,height,codec_name,r_frame_rate',
        '-of', 'json',
        filePath
      ]);
      
      ffprobe.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      ffprobe.stderr.on('data', (data) => {
        stderrData += data.toString();
      });
      
      // Set timeout
      timeoutId = setTimeout(() => {
        ffprobe.kill();
        resolve({
          success: false,
          error: `Metadata extraction timeout after ${formatterService.formatDuration(timeout)}`
        });
      }, timeout);
      
      ffprobe.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code === 0) {
          try {
            const ffprobeData = JSON.parse(stdoutData);
            
            // Extract relevant metadata
            const metadata: VideoMetadata = {
              durationSeconds: parseFloat(ffprobeData.format.duration) || 0,
              size: parseInt(ffprobeData.format.size) || 0
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
            if (ffprobeData.format.bit_rate) {
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
        resolve({
          success: false,
          error: `Failed to start FFprobe: ${err.message}`
        });
      });
    });
  }

  /**
   * Generate an output path based on the input path and desired extension
   * 
   * @param inputPath Original file path
   * @param extension New file extension (without dot)
   * @param outputDir Optional output directory
   * @returns Generated output path
   */
  private generateOutputPath(inputPath: string, extension: string, outputDir?: string): string {
    const parsedPath = path.parse(inputPath);
    const outputFileName = `${parsedPath.name}.${extension}`;
    
    if (outputDir) {
      return path.join(outputDir, outputFileName);
    }
    
    return path.join(parsedPath.dir, outputFileName);
  }
}

// Export a singleton instance for use throughout the application
export const converterService = ConverterService.getInstance();