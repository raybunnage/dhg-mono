#!/usr/bin/env ts-node
/**
 * Unified Media Processing Command
 * 
 * This is the main entry point for all media processing operations.
 * It automatically detects what needs to be done based on file status.
 * 
 * Usage:
 *   process.ts [options]
 * 
 * Options:
 *   --source [path]        Source directory or file to process
 *   --limit [n]           Maximum number of files to process
 *   --stage [stage]       Specific stage to run (find|convert|transcribe|upload)
 *   --dry-run            Show what would happen without making changes
 *   --force              Process even if already processed
 *   --config [path]      Path to configuration file
 */

import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { M4AUploadService } from '../../../../packages/shared/services/m4a-upload-service';
import { MediaFileManager } from '../../../../packages/shared/services/media-file-manager';
import { Logger } from '../../../../packages/shared/utils';
import { LogLevel } from '../../../../packages/shared/utils/logger';
import { execSync } from 'child_process';
import * as yaml from 'js-yaml';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

interface ProcessingConfig {
  sources: {
    google_drive: {
      root: string;
      folders: string[];
    };
  };
  processing: {
    temp_dir: string;
    max_parallel: number;
    default_model: string;
    default_accelerator: string;
  };
  storage: {
    auto_cleanup: boolean;
    max_cache_size: string;
    retention_days: number;
  };
}

interface ProcessingOptions {
  source?: string;
  limit: number;
  stage?: 'find' | 'convert' | 'transcribe' | 'upload' | 'all';
  dryRun: boolean;
  force: boolean;
  config?: string;
}

class UnifiedMediaProcessor {
  private supabase: any;
  private config: ProcessingConfig;
  private options: ProcessingOptions;
  private m4aUploadService: M4AUploadService;
  private fileManager: MediaFileManager;

  constructor(options: ProcessingOptions) {
    this.supabase = SupabaseClientService.getInstance().getClient();
    this.options = options;
    this.config = this.loadConfig();
    this.m4aUploadService = new M4AUploadService(this.supabase);
    this.fileManager = new MediaFileManager(this.supabase, {
      tempDir: this.config.processing.temp_dir,
      maxCacheSize: this.config.storage.max_cache_size,
      retentionDays: this.config.storage.retention_days,
      autoCleanup: this.config.storage.auto_cleanup
    });
  }

  private loadConfig(): ProcessingConfig {
    const configPath = this.options.config || path.join(process.cwd(), 'config', 'media-processing.yaml');
    
    // Default configuration
    const defaultConfig: ProcessingConfig = {
      sources: {
        google_drive: {
          root: '/Users/raybunnage/Library/CloudStorage/GoogleDrive-bunnage.ray@gmail.com/My Drive',
          folders: ['200_Research Experts', 'Dynamic Healing Discussion Group']
        }
      },
      processing: {
        temp_dir: './file_types',
        max_parallel: 3,
        default_model: 'whisper-large-v3',
        default_accelerator: 'A10G'
      },
      storage: {
        auto_cleanup: true,
        max_cache_size: '50GB',
        retention_days: 7
      }
    };

    // Try to load custom config
    if (fs.existsSync(configPath)) {
      try {
        const customConfig = yaml.load(fs.readFileSync(configPath, 'utf8')) as ProcessingConfig;
        return { ...defaultConfig, ...customConfig };
      } catch (error) {
        Logger.warn(`Failed to load config from ${configPath}, using defaults`);
      }
    }

    return defaultConfig;
  }

  public async run(): Promise<void> {
    Logger.info('🚀 Starting Unified Media Processing');
    Logger.info(`Configuration: ${JSON.stringify(this.config.processing, null, 2)}`);

    try {
      // Determine what stage to run
      const stage = this.options.stage || 'all';

      switch (stage) {
        case 'find':
          await this.findMedia();
          break;
        case 'convert':
          await this.convertMedia();
          break;
        case 'transcribe':
          await this.transcribeMedia();
          break;
        case 'upload':
          await this.uploadMedia();
          break;
        case 'all':
        default:
          await this.runFullPipeline();
          break;
      }

      Logger.info('✅ Media processing completed successfully');
    } catch (error: any) {
      Logger.error(`❌ Media processing failed: ${error.message}`);
      process.exit(1);
    }
  }

  private async runFullPipeline(): Promise<void> {
    Logger.info('Running full media processing pipeline...');

    // Step 1: Find media files that need processing
    const filesToProcess = await this.findMedia();
    if (filesToProcess.length === 0) {
      Logger.info('No files need processing');
      return;
    }

    // Step 2: Convert MP4 to M4A if needed
    const convertedFiles = await this.convertMedia(filesToProcess);

    // Step 3: Transcribe audio files
    const transcribedFiles = await this.transcribeMedia(convertedFiles);

    // Step 4: Upload M4A files back to Google Drive
    await this.uploadMedia(transcribedFiles);

    // Step 5: Cleanup if configured
    if (this.config.storage.auto_cleanup) {
      await this.cleanupOldFiles();
    }
  }

  private async findMedia(files?: any[]): Promise<any[]> {
    Logger.info('🔍 Finding media files to process...');

    if (files) return files;

    // Query for files that need processing
    const { data, error } = await this.supabase
      .from('google_expert_documents')
      .select(`
        id,
        source_id,
        pipeline_status,
        google_sources!inner(
          id,
          name,
          drive_id,
          mime_type,
          parent_folder_id
        )
      `)
      .eq('google_sources.mime_type', 'video/mp4')
      .or('pipeline_status.is.null,pipeline_status.eq.unprocessed')
      .limit(this.options.limit);

    if (error) {
      Logger.error(`Failed to find media files: ${error.message}`);
      return [];
    }

    Logger.info(`Found ${data?.length || 0} files to process`);
    return data || [];
  }

  private async convertMedia(files?: any[]): Promise<any[]> {
    Logger.info('🔄 Converting MP4 files to M4A...');

    const filesToConvert = files || await this.findMedia();
    const converted: any[] = [];

    for (const file of filesToConvert) {
      try {
        // Check if M4A already exists
        const m4aPath = await this.getM4APath(file);
        if (m4aPath && fs.existsSync(m4aPath)) {
          Logger.info(`M4A already exists for ${file.google_sources.name}`);
          converted.push({ ...file, m4aPath });
          continue;
        }

        // Get MP4 file path
        const mp4Path = await this.getLocalFilePath(file);
        if (!mp4Path) {
          Logger.error(`Could not find local file for ${file.google_sources.name}`);
          continue;
        }

        // Convert using existing convert-mp4.ts command
        if (!this.options.dryRun) {
          const convertCmd = `ts-node ${path.join(__dirname, 'convert-mp4.ts')} "${mp4Path}"`;
          Logger.info(`Converting: ${file.google_sources.name}`);
          execSync(convertCmd, { stdio: 'inherit' });
        } else {
          Logger.info(`Would convert: ${file.google_sources.name}`);
        }

        converted.push({ ...file, m4aPath });
      } catch (error: any) {
        Logger.error(`Failed to convert ${file.google_sources.name}: ${error.message}`);
      }
    }

    return converted;
  }

  private async transcribeMedia(files?: any[]): Promise<any[]> {
    Logger.info('📝 Transcribing audio files...');

    const filesToTranscribe = files || await this.findMedia();
    const transcribed: any[] = [];

    for (const file of filesToTranscribe) {
      try {
        // Check if already transcribed
        if (file.pipeline_status === 'processed') {
          Logger.info(`Already transcribed: ${file.google_sources.name}`);
          transcribed.push(file);
          continue;
        }

        // Use existing transcribe-with-summary command
        if (!this.options.dryRun) {
          const transcribeCmd = `ts-node ${path.join(__dirname, 'transcribe-with-summary.ts')} ${file.id} --model ${this.config.processing.default_model} --accelerator ${this.config.processing.default_accelerator}`;
          Logger.info(`Transcribing: ${file.google_sources.name}`);
          execSync(transcribeCmd, { stdio: 'inherit' });
        } else {
          Logger.info(`Would transcribe: ${file.google_sources.name}`);
        }

        transcribed.push(file);
      } catch (error: any) {
        Logger.error(`Failed to transcribe ${file.google_sources.name}: ${error.message}`);
      }
    }

    return transcribed;
  }

  private async uploadMedia(files?: any[]): Promise<void> {
    Logger.info('☁️ Uploading M4A files to Google Drive...');

    const filesToUpload = files || await this.findMedia();

    for (const file of filesToUpload) {
      try {
        const m4aPath = await this.getM4APath(file);
        if (!m4aPath || !fs.existsSync(m4aPath)) {
          Logger.warn(`No M4A file found for ${file.google_sources.name}`);
          continue;
        }

        // Check if M4A already exists in Google Drive
        const m4aName = path.basename(m4aPath);
        const { data: existingM4A } = await this.supabase
          .from('google_sources')
          .select('id, drive_id')
          .eq('name', m4aName)
          .eq('parent_folder_id', file.google_sources.parent_folder_id)
          .single();

        if (existingM4A) {
          Logger.info(`M4A already exists in Drive: ${m4aName}`);
          continue;
        }

        if (!this.options.dryRun) {
          // Upload using the M4A upload service
          const uploadConfig = {
            sourceMP4DriveId: file.google_sources.drive_id,
            localM4APath: m4aPath,
            parentFolderId: file.google_sources.parent_folder_id,
            sourceId: file.google_sources.id
          };
          
          const m4aDriveId = await this.m4aUploadService.upload(uploadConfig);
          Logger.info(`✅ Uploaded ${m4aName} with Drive ID: ${m4aDriveId}`);
          
          // Update media_processing_status
          await this.updateProcessingStatus(file.id, 'completed', { m4aDriveId });
        } else {
          Logger.info(`Would upload: ${m4aName}`);
        }
      } catch (error: any) {
        Logger.error(`Failed to upload M4A for ${file.google_sources.name}: ${error.message}`);
        await this.updateProcessingStatus(file.id, 'failed', { error: error.message });
      }
    }
  }

  private async getLocalFilePath(file: any): Promise<string | null> {
    try {
      const location = await this.fileManager.getFile(
        file.google_sources.drive_id,
        file.google_sources.name
      );
      
      if (location.path) {
        return location.path;
      }
      
      Logger.warn(`File not found locally: ${file.google_sources.name}`);
      return null;
    } catch (error: any) {
      Logger.error(`Error getting file path: ${error.message}`);
      return null;
    }
  }


  private async getM4APath(file: any): Promise<string | null> {
    const baseName = file.google_sources.name.replace(/\.mp4$/i, '');
    const m4aName = `${baseName}.m4a`;
    const m4aPath = path.join(this.config.processing.temp_dir, 'm4a', m4aName);
    return fs.existsSync(m4aPath) ? m4aPath : null;
  }

  private async updateProcessingStatus(documentId: string, status: string, extra?: any): Promise<void> {
    try {
      // First check if record exists in media_processing_status
      const { data: existing } = await this.supabase
        .from('media_processing_status')
        .select('id')
        .eq('expert_document_id', documentId)
        .single();

      if (existing) {
        // Update existing record
        const update: any = {
          status,
          updated_at: new Date().toISOString()
        };

        if (status === 'completed') {
          update.completed_at = new Date().toISOString();
        }

        if (extra?.m4aDriveId) {
          update.m4a_drive_id = extra.m4aDriveId;
          update.m4a_uploaded_at = new Date().toISOString();
        }

        if (extra?.error) {
          update.error_message = extra.error;
          update.last_error_at = new Date().toISOString();
        }

        await this.supabase
          .from('media_processing_status')
          .update(update)
          .eq('expert_document_id', documentId);
      } else {
        // Create new record
        const { data: doc } = await this.supabase
          .from('google_expert_documents')
          .select('source_id, google_sources!inner(drive_id, name, mime_type)')
          .eq('id', documentId)
          .single();

        if (doc) {
          await this.supabase
            .from('media_processing_status')
            .insert({
              expert_document_id: documentId,
              source_id: doc.source_id,
              drive_id: doc.google_sources.drive_id,
              filename: doc.google_sources.name,
              mime_type: doc.google_sources.mime_type,
              status,
              ...extra
            });
        }
      }
    } catch (error: any) {
      Logger.error(`Failed to update processing status: ${error.message}`);
    }
  }

  private async cleanupOldFiles(): Promise<void> {
    Logger.info('🧹 Cleaning up old processed files...');
    
    if (this.options.dryRun) {
      const stats = await this.fileManager.getCacheStats();
      Logger.info(`Would clean up ${stats.oldFiles} old files (${stats.processedFiles} processed)`);
      return;
    }
    
    await this.fileManager.cleanup();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: ProcessingOptions = {
  limit: 10,
  dryRun: false,
  force: false
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--source':
      options.source = args[++i];
      break;
    case '--limit':
      options.limit = parseInt(args[++i], 10);
      break;
    case '--stage':
      options.stage = args[++i] as any;
      break;
    case '--dry-run':
      options.dryRun = true;
      break;
    case '--force':
      options.force = true;
      break;
    case '--config':
      options.config = args[++i];
      break;
  }
}

// Run the processor
const processor = new UnifiedMediaProcessor(options);
processor.run().catch(error => {
  Logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});