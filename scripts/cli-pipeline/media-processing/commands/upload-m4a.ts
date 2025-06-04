#!/usr/bin/env ts-node
/**
 * Upload M4A Command
 * 
 * Uploads M4A files back to Google Drive alongside their MP4 counterparts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { M4AUploadService, M4AUploadConfig } from '../../../../packages/shared/services/m4a-upload-service';
import { Logger } from '../../../../packages/shared/utils';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

interface UploadOptions {
  documentId?: string;
  m4aPath?: string;
  batch: boolean;
  limit: number;
  dryRun: boolean;
  force: boolean;
}

async function uploadM4A(options: UploadOptions): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient();
  const uploadService = new M4AUploadService(supabase);

  try {
    if (options.batch) {
      await batchUpload(supabase, uploadService, options);
    } else if (options.documentId || options.m4aPath) {
      await singleUpload(supabase, uploadService, options);
    } else {
      Logger.error('Please provide either --document-id, --m4a-path, or use --batch mode');
      process.exit(1);
    }
  } catch (error: any) {
    Logger.error(`Upload failed: ${error.message}`);
    process.exit(1);
  }
}

async function singleUpload(
  supabase: any,
  uploadService: M4AUploadService,
  options: UploadOptions
): Promise<void> {
  let uploadConfig: M4AUploadConfig;

  if (options.m4aPath) {
    // Upload by direct M4A file path
    if (!fs.existsSync(options.m4aPath)) {
      Logger.error(`M4A file not found: ${options.m4aPath}`);
      process.exit(1);
    }

    // Try to find the corresponding MP4 in the database
    const m4aName = path.basename(options.m4aPath);
    const mp4Name = m4aName.replace(/\.m4a$/i, '.mp4');

    const { data, error } = await supabase
      .from('google_sources')
      .select('id, drive_id, parent_folder_id')
      .eq('name', mp4Name)
      .eq('mime_type', 'video/mp4')
      .single();

    if (error || !data) {
      Logger.error(`Could not find MP4 source for: ${mp4Name}`);
      process.exit(1);
    }

    uploadConfig = {
      sourceMP4DriveId: data.drive_id,
      localM4APath: options.m4aPath,
      parentFolderId: data.parent_folder_id,
      sourceId: data.id
    };

  } else if (options.documentId) {
    // Upload by document ID
    const { data, error } = await supabase
      .from('google_expert_documents')
      .select(`
        id,
        google_sources!inner(
          id,
          name,
          drive_id,
          parent_folder_id
        )
      `)
      .eq('id', options.documentId)
      .single();

    if (error || !data) {
      Logger.error(`Document not found: ${options.documentId}`);
      process.exit(1);
    }

    // Find M4A file
    const baseName = data.google_sources.name.replace(/\.mp4$/i, '');
    const m4aPath = path.join('./file_types/m4a', `${baseName}.m4a`);

    if (!fs.existsSync(m4aPath)) {
      Logger.error(`M4A file not found: ${m4aPath}`);
      Logger.info('Please convert the file first');
      process.exit(1);
    }

    uploadConfig = {
      sourceMP4DriveId: data.google_sources.drive_id,
      localM4APath: m4aPath,
      parentFolderId: data.google_sources.parent_folder_id,
      sourceId: data.google_sources.id
    };
  } else {
    Logger.error('No input specified');
    process.exit(1);
  }

  if (options.dryRun) {
    Logger.info('🔍 Dry run - would upload:');
    Logger.info(`  M4A: ${uploadConfig.localM4APath}`);
    Logger.info(`  To folder: ${uploadConfig.parentFolderId}`);
    Logger.info(`  Linked to MP4: ${uploadConfig.sourceMP4DriveId}`);
    return;
  }

  // Perform upload
  Logger.info(`☁️ Uploading: ${path.basename(uploadConfig.localM4APath)}`);
  const driveId = await uploadService.upload(uploadConfig);
  Logger.info(`✅ Successfully uploaded with Drive ID: ${driveId}`);
}

async function batchUpload(
  supabase: any,
  uploadService: M4AUploadService,
  options: UploadOptions
): Promise<void> {
  Logger.info('🔄 Starting batch M4A upload...');

  // Find documents with M4A files ready to upload
  const { data, error } = await supabase
    .from('media_processing_status')
    .select(`
      source_id,
      m4a_path,
      m4a_drive_id,
      google_sources!inner(
        id,
        name,
        drive_id,
        parent_folder_id
      )
    `)
    .eq('status', 'completed')
    .is('m4a_drive_id', null)
    .not('m4a_path', 'is', null)
    .limit(options.limit);

  if (error || !data || data.length === 0) {
    // Fallback: look for M4A files in the directory
    Logger.info('No records in media_processing_status, checking file system...');
    
    const m4aDir = './file_types/m4a';
    if (!fs.existsSync(m4aDir)) {
      Logger.info('No M4A directory found');
      return;
    }

    const m4aFiles = fs.readdirSync(m4aDir)
      .filter(f => f.endsWith('.m4a'))
      .slice(0, options.limit);

    if (m4aFiles.length === 0) {
      Logger.info('No M4A files found to upload');
      return;
    }

    Logger.info(`Found ${m4aFiles.length} M4A files to check`);

    const configs: M4AUploadConfig[] = [];
    
    for (const m4aFile of m4aFiles) {
      const mp4Name = m4aFile.replace(/\.m4a$/i, '.mp4');
      
      // Find corresponding MP4 in database
      const { data: source, error: sourceError } = await supabase
        .from('google_sources')
        .select('id, drive_id, parent_folder_id')
        .eq('name', mp4Name)
        .eq('mime_type', 'video/mp4')
        .single();

      if (!sourceError && source) {
        // Check if M4A already exists in Drive
        const { data: existingM4A } = await supabase
          .from('google_sources')
          .select('id')
          .eq('name', m4aFile)
          .eq('parent_folder_id', source.parent_folder_id)
          .single();

        if (!existingM4A) {
          configs.push({
            sourceMP4DriveId: source.drive_id,
            localM4APath: path.join(m4aDir, m4aFile),
            parentFolderId: source.parent_folder_id,
            sourceId: source.id
          });
        }
      }
    }

    if (configs.length === 0) {
      Logger.info('All M4A files are already uploaded');
      return;
    }

    if (options.dryRun) {
      Logger.info(`Would upload ${configs.length} M4A files`);
      configs.forEach(config => {
        Logger.info(`  - ${path.basename(config.localM4APath)}`);
      });
      return;
    }

    await uploadService.batchUpload(configs);
    return;
  }

  // Process records from media_processing_status
  Logger.info(`Found ${data.length} M4A files ready to upload`);

  const configs: M4AUploadConfig[] = data.map(record => ({
    sourceMP4DriveId: record.google_sources.drive_id,
    localM4APath: record.m4a_path,
    parentFolderId: record.google_sources.parent_folder_id,
    sourceId: record.google_sources.id
  }));

  if (options.dryRun) {
    Logger.info('🔍 Dry run - would upload:');
    configs.forEach(config => {
      Logger.info(`  - ${path.basename(config.localM4APath)}`);
    });
    return;
  }

  await uploadService.batchUpload(configs);
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
Upload M4A Command - Upload M4A files to Google Drive

Usage:
  upload-m4a.ts [options]

Options:
  --document-id [id]   Upload M4A for specific document
  --m4a-path [path]    Upload specific M4A file
  --batch              Upload all pending M4A files
  --limit [n]          Max files for batch mode (default: 10)
  --dry-run            Show what would be uploaded
  --force              Force re-upload even if exists

Examples:
  # Upload for specific document
  upload-m4a.ts --document-id 123e4567-e89b-12d3-a456-426614174000
  
  # Upload specific M4A file
  upload-m4a.ts --m4a-path ./file_types/m4a/video.m4a
  
  # Batch upload all ready files
  upload-m4a.ts --batch --limit 20
  
  # Dry run to see what would be uploaded
  upload-m4a.ts --batch --dry-run
  `);
  process.exit(0);
}

const options: UploadOptions = {
  batch: false,
  limit: 10,
  dryRun: false,
  force: false
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--document-id':
      options.documentId = args[++i];
      break;
    case '--m4a-path':
      options.m4aPath = args[++i];
      break;
    case '--batch':
      options.batch = true;
      break;
    case '--limit':
      options.limit = parseInt(args[++i], 10);
      break;
    case '--dry-run':
      options.dryRun = true;
      break;
    case '--force':
      options.force = true;
      break;
  }
}

// Run upload
uploadM4A(options).catch(error => {
  Logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});