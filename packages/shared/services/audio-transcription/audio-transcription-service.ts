/**
 * Audio Transcription Service
 * 
 * A singleton service for transcribing audio files using the Modal-based Whisper service
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { Logger } from '../../utils';
import { LogLevel } from '../../utils/logger';

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

/**
 * AudioTranscriptionService - Singleton service for handling audio transcriptions
 */
export class AudioTranscriptionService {
  private static instance: AudioTranscriptionService;
  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): AudioTranscriptionService {
    if (!AudioTranscriptionService.instance) {
      AudioTranscriptionService.instance = new AudioTranscriptionService();
    }
    return AudioTranscriptionService.instance;
  }

  /**
   * Transcribe an audio file using the Python Modal-based Whisper service
   */
  public async transcribeFile(
    filePath: string,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const { model = 'base', outputDir, dryRun = false, generateSummary = false, accelerator = 'T4' } = options;
    const startTime = Date.now();
    
    // Validate the file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`
      };
    }

    // Generate output path if not specified
    let outputPath: string | undefined;
    if (outputDir) {
      const baseName = path.basename(filePath).replace(/\.[^/.]+$/, "");
      outputPath = path.join(outputDir, `${baseName}_transcript.txt`);
      
      // Ensure output directory exists
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }

    // Skip actual processing in dry run mode
    if (dryRun) {
      Logger.info(`🔄 Would transcribe ${filePath} using ${model} model`);
      return {
        success: true,
        text: 'DRY-RUN: Transcription would be performed here',
        processingMetadata: {
          model,
          audioFile: filePath
        }
      };
    }

    // Choose the appropriate script based on whether we need summarization
    const scriptPath = generateSummary 
      ? path.join(process.cwd(), 'packages/python-audio-processor/scripts/advanced_audio_transcript.py')
      : path.join(process.cwd(), 'packages/python-audio-processor/scripts/base_audio_transcript.py');
    
    Logger.info(`🎙️ Transcribing ${filePath} with ${model} model on ${accelerator} accelerator${generateSummary ? ' and generating summary' : ''}...`);
    
    // Execute the Python script
    return new Promise((resolve) => {
      // Check what args to pass to script
      const scriptArgs = [
        scriptPath,
        filePath
      ];
      
      // Add output path if specified
      if (outputPath) {
        scriptArgs.push(outputPath);
      }
      
      // Add model if using advanced script or accelerator for all cases
      if (generateSummary) {
        scriptArgs.push(model);
      }
      
      // Add accelerator type for all scripts
      scriptArgs.push('--accelerator');
      scriptArgs.push(accelerator);
      
      const pythonProcess = spawn('python', scriptArgs);
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        Logger.info(`${data.toString().trim()}`);
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        Logger.error(`${data.toString().trim()}`);
      });
      
      pythonProcess.on('close', (code) => {
        const processingTime = (Date.now() - startTime) / 1000;
        
        if (code === 0) {
          if (generateSummary) {
            // For advanced script, parse the JSON result
            const jsonMatch = stdout.match(/JSON_RESULT_BEGIN\n([\s\S]*?)\nJSON_RESULT_END/);
            if (jsonMatch && jsonMatch[1]) {
              try {
                const result = JSON.parse(jsonMatch[1]);
                resolve({
                  success: true,
                  text: result.transcript,
                  summary: result.summary,
                  processingMetadata: {
                    model,
                    audioFile: filePath,
                    processingTime: result.stats.total_time,
                    wordCount: result.stats.word_count,
                    summaryTime: result.stats.summary_time
                  }
                });
                return;
              } catch (error: any) {
                Logger.error(`Error parsing JSON result: ${error.message}`);
              }
            }
          } else {
            // For base script, extract transcript using markers
            const transcriptMatch = stdout.match(/TRANSCRIPT_BEGIN\n([\s\S]*?)\nTRANSCRIPT_END/);
            let transcriptText = transcriptMatch ? transcriptMatch[1] : '';
            
            // If no markers, try reading from the output file
            if (!transcriptText && outputPath && fs.existsSync(outputPath)) {
              try {
                transcriptText = fs.readFileSync(outputPath, 'utf8');
              } catch (error: any) {
                Logger.error(`Error reading transcript file: ${error.message}`);
              }
            }
            
            if (transcriptText) {
              resolve({
                success: true,
                text: transcriptText,
                processingMetadata: {
                  model,
                  audioFile: filePath,
                  processingTime,
                  wordCount: transcriptText.split(/\s+/).length
                }
              });
              return;
            }
          }
          
          // If we get here, something went wrong with parsing but the process succeeded
          resolve({
            success: true,
            text: 'Transcription process completed but transcript could not be parsed',
            processingMetadata: {
              model,
              audioFile: filePath,
              processingTime
            }
          });
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
    });
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
}

// Export a convenient getter function
export const getAudioTranscriptionService = () => AudioTranscriptionService.getInstance();