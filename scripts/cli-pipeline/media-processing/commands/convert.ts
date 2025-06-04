#!/usr/bin/env ts-node
/**
 * Unified Convert Command
 * 
 * Converts MP4 files to M4A format using ffmpeg.
 * Works with both file paths and document IDs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

interface ConvertOptions {
  input: string;
  outputDir?: string;
  force: boolean;
  dryRun: boolean;
}

async function convertMedia(options: ConvertOptions): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient();

  try {
    let mp4Path: string;
    let documentId: string | null = null;

    // Determine if input is a file path or document ID
    if (fs.existsSync(options.input)) {
      // Direct file path
      mp4Path = options.input;
      Logger.info(`Converting local file: ${mp4Path}`);
    } else {
      // Assume it's a document ID
      documentId = options.input;
      
      // Fetch document info
      const { data, error } = await supabase
        .from('google_expert_documents')
        .select(`
          id,
          google_sources!inner(
            name,
            drive_id
          )
        `)
        .eq('id', documentId)
        .single();

      if (error || !data) {
        Logger.error(`Document not found: ${documentId}`);
        process.exit(1);
      }

      // Check for local file
      mp4Path = path.join('./file_types/mp4', data.google_sources.name);
      if (!fs.existsSync(mp4Path)) {
        Logger.error(`Local file not found: ${mp4Path}`);
        Logger.info('Please ensure the file is downloaded first');
        process.exit(1);
      }
    }

    // Determine output path
    const outputDir = options.outputDir || './file_types/m4a';
    const baseName = path.basename(mp4Path, path.extname(mp4Path));
    const m4aPath = path.join(outputDir, `${baseName}.m4a`);

    // Check if output already exists
    if (fs.existsSync(m4aPath) && !options.force) {
      Logger.info(`M4A already exists: ${m4aPath}`);
      Logger.info('Use --force to overwrite');
      return;
    }

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    if (options.dryRun) {
      Logger.info(`Would convert: ${mp4Path} → ${m4aPath}`);
      return;
    }

    // Perform conversion
    Logger.info(`Converting: ${baseName}.mp4 → ${baseName}.m4a`);
    
    const ffmpegCmd = `ffmpeg -i "${mp4Path}" -vn -acodec copy "${m4aPath}" -y`;
    
    try {
      execSync(ffmpegCmd, { stdio: 'pipe' });
      Logger.info(`✅ Successfully converted to: ${m4aPath}`);
      
      // Update status if we have a document ID
      if (documentId) {
        await updateConversionStatus(supabase, documentId, 'converting');
      }
      
    } catch (error: any) {
      Logger.error(`FFmpeg conversion failed: ${error.message}`);
      
      // Try alternative conversion with re-encoding
      Logger.info('Trying alternative conversion with re-encoding...');
      const altCmd = `ffmpeg -i "${mp4Path}" -vn -acodec aac -ab 192k "${m4aPath}" -y`;
      
      try {
        execSync(altCmd, { stdio: 'pipe' });
        Logger.info(`✅ Successfully converted (re-encoded) to: ${m4aPath}`);
        
        if (documentId) {
          await updateConversionStatus(supabase, documentId, 'converting');
        }
      } catch (altError: any) {
        Logger.error(`Alternative conversion also failed: ${altError.message}`);
        process.exit(1);
      }
    }

  } catch (error: any) {
    Logger.error(`Convert failed: ${error.message}`);
    process.exit(1);
  }
}

async function updateConversionStatus(supabase: any, documentId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('google_expert_documents')
    .update({ 
      processing_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', documentId);

  if (error) {
    Logger.warn(`Failed to update status: ${error.message}`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
Convert Command - Convert MP4 files to M4A format

Usage:
  convert.ts <input> [options]

Arguments:
  <input>          File path or document ID to convert

Options:
  --output-dir [dir]   Output directory (default: ./file_types/m4a)
  --force              Overwrite existing files
  --dry-run            Show what would happen without converting

Examples:
  # Convert by file path
  convert.ts ./file_types/mp4/video.mp4
  
  # Convert by document ID
  convert.ts 123e4567-e89b-12d3-a456-426614174000
  
  # Convert with custom output
  convert.ts video.mp4 --output-dir ./output
  `);
  process.exit(0);
}

const options: ConvertOptions = {
  input: args[0],
  force: false,
  dryRun: false
};

for (let i = 1; i < args.length; i++) {
  switch (args[i]) {
    case '--output-dir':
      options.outputDir = args[++i];
      break;
    case '--force':
      options.force = true;
      break;
    case '--dry-run':
      options.dryRun = true;
      break;
  }
}

// Run the conversion
convertMedia(options).catch(error => {
  Logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});