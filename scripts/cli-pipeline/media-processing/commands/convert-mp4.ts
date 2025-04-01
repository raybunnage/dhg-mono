#!/usr/bin/env ts-node
/**
 * Convert MP4 Command
 * 
 * This command converts MP4 video files to M4A audio files using FFmpeg
 * for further processing like transcription.
 * 
 * Usage:
 *   convert-mp4.ts [fileId|path] [options]
 * 
 * Options:
 *   --dry-run                  Show what would be converted without actual processing
 *   --output [path]            Specify output directory
 *   --batch [number]           Process a batch of pending files
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { Logger } from '../../../../packages/shared/utils';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  outputDir: path.join(process.cwd(), 'file_types', 'm4a'),
  batchSize: 0,
  fileId: ''
};

// Get file ID (first non-option argument)
const fileIdArg = args.find(arg => !arg.startsWith('--'));
if (fileIdArg) {
  options.fileId = fileIdArg;
}

// Get output directory if specified
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1 && args[outputIndex + 1]) {
  options.outputDir = args[outputIndex + 1];
}

// Get batch size if specified
const batchIndex = args.indexOf('--batch');
if (batchIndex !== -1 && args[batchIndex + 1]) {
  const batchArg = parseInt(args[batchIndex + 1]);
  if (!isNaN(batchArg)) {
    options.batchSize = batchArg;
  }
}

/**
 * Convert MP4 file to M4A using FFmpeg
 */
async function convertFile(filePath: string, outputPath?: string): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  return new Promise((resolve) => {
    // Determine output path if not specified
    let finalOutputPath = outputPath;
    if (!finalOutputPath) {
      const baseName = path.basename(filePath).replace(/\.[^/.]+$/, "");
      finalOutputPath = path.join(options.outputDir, `${baseName}.m4a`);
    }
    
    // Check if output file already exists
    if (fs.existsSync(finalOutputPath) && !options.force) {
      Logger.info(`⚠️ Output file already exists: ${finalOutputPath}`);
      Logger.info(`⚠️ Skipping conversion - use --force to override`);
      resolve({ success: true, outputPath: finalOutputPath });
      return;
    }
    
    // Ensure output directory exists
    fs.mkdirSync(path.dirname(finalOutputPath), { recursive: true });
    
    Logger.info(`🔄 Converting ${filePath} to ${finalOutputPath}...`);
    
    if (options.dryRun) {
      Logger.info(`🔄 Would execute: ffmpeg -i "${filePath}" -vn -acodec copy "${finalOutputPath}"`);
      resolve({ success: true, outputPath: finalOutputPath });
      return;
    }
    
    // Execute FFmpeg
    const ffmpegProcess = spawn('ffmpeg', [
      '-i', filePath,
      '-vn',          // No video
      '-acodec', 'copy', // Copy audio codec without re-encoding
      finalOutputPath
    ]);
    
    let stderr = '';
    
    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      // FFmpeg outputs progress to stderr
      if (data.toString().includes('size=')) {
        process.stdout.write('.');
      }
    });
    
    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        Logger.info(`✅ Successfully converted to: ${finalOutputPath}`);
        
        // Get file size
        const stats = fs.statSync(finalOutputPath);
        const fileSizeMB = stats.size / (1024 * 1024);
        Logger.info(`📊 File size: ${fileSizeMB.toFixed(2)} MB`);
        
        resolve({ success: true, outputPath: finalOutputPath });
      } else {
        Logger.error(`❌ Conversion failed with code ${code}`);
        resolve({ success: false, error: stderr });
      }
    });
  });
}

/**
 * Process an expert document from the database
 */
async function convertExpertDocument(documentId: string, supabase: any): Promise<boolean> {
  try {
    // Get the document from the database
    const { data: document, error: docError } = await supabase
      .from('expert_documents')
      .select('id, source_id, content_type, processing_status, processed_content, raw_content')
      .eq('id', documentId)
      .single();
    
    if (docError) {
      Logger.error(`❌ Error fetching expert document: ${docError.message}`);
      return false;
    }
    
    if (!document) {
      Logger.error(`❌ Document with ID ${documentId} not found`);
      return false;
    }
    
    // Check if already completed or has raw content (which implies audio extraction is done)
    if (document.processing_status === 'completed' || document.raw_content) {
      Logger.warn(`⚠️ Document ${documentId} is already fully processed`);
      return true;
    }
    
    // Get the source file
    const { data: sourceFile, error: sourceError } = await supabase
      .from('sources_google')
      .select('id, name, mime_type, metadata')
      .eq('id', document.source_id)
      .single();
    
    if (sourceError || !sourceFile) {
      Logger.error(`❌ Error fetching source file: ${sourceError?.message || 'Source not found'}`);
      return false;
    }
    
    if (sourceFile.mime_type !== 'video/mp4') {
      Logger.error(`❌ Source file is not an MP4 video (mime type: ${sourceFile.mime_type})`);
      return false;
    }
    
    // Find the MP4 file in the local directory
    const sourceFilename = sourceFile.name.replace(/\.[^/.]+$/, "");
    const videoDir = path.join(process.cwd(), 'file_types', 'mp4');
    
    let videoPath = '';
    try {
      const files = fs.readdirSync(videoDir);
      const matchingFile = files.find(file => 
        file.toLowerCase().includes(sourceFilename.toLowerCase()) && 
        file.endsWith('.mp4')
      );
      
      if (matchingFile) {
        videoPath = path.join(videoDir, matchingFile);
      }
    } catch (error: any) {
      Logger.error(`❌ Error reading video directory: ${error.message}`);
      return false;
    }
    
    if (!videoPath) {
      Logger.error(`❌ MP4 file for source ${sourceFilename} not found in ${videoDir}`);
      return false;
    }
    
    Logger.info(`📋 Found MP4 file: ${videoPath}`);
    
    // Define output path
    const outputFilename = `INGESTED_${path.basename(videoPath).replace(/\.mp4$/, ".m4a")}`;
    const outputPath = path.join(options.outputDir, outputFilename);
    
    // Check if M4A file already exists
    if (fs.existsSync(outputPath)) {
      Logger.info(`⚠️ M4A file already exists: ${outputPath}`);
      Logger.info(`⚠️ Skipping conversion for document ${documentId}`);
      
      // Update the document with the extraction info if needed
      if (!document.processed_content?.audio_extraction) {
        // Get file size
        const stats = fs.statSync(outputPath);
        const fileSizeMB = stats.size / (1024 * 1024);
        
        // Update processed_content
        const processedContent = document.processed_content || {};
        
        if (!options.dryRun) {
          const { error: saveError } = await supabase
            .from('expert_documents')
            .update({
              processing_status: 'processing',
              processed_content: {
                ...processedContent,
                audio_extraction: {
                  output_path: outputPath,
                  file_size_mb: fileSizeMB,
                  extraction_timestamp: new Date().toISOString()
                }
              }
            })
            .eq('id', documentId);
          
          if (saveError) {
            Logger.warn(`⚠️ Error updating document with existing M4A info: ${saveError.message}`);
          } else {
            Logger.info(`✅ Updated document with existing M4A file information`);
          }
        }
      }
      
      return true;
    }
    
    // Update status to processing
    if (!options.dryRun) {
      const { error: updateError } = await supabase
        .from('expert_documents')
        .update({ 
          processing_status: 'processing' 
        })
        .eq('id', documentId);
      
      if (updateError) {
        Logger.error(`❌ Error updating document status: ${updateError.message}`);
      }
    }
    
    if (options.dryRun) {
      Logger.info(`🔄 Would convert ${videoPath} to ${outputPath}`);
      return true;
    }
    
    // Convert the file
    const { success, error } = await convertFile(videoPath, outputPath);
    
    if (!success) {
      Logger.error(`❌ Conversion failed: ${error}`);
      
      // Update status to error
      const { error: updateError } = await supabase
        .from('expert_documents')
        .update({ 
          processing_status: 'error', 
          processing_error: error 
        })
        .eq('id', documentId);
      
      if (updateError) {
        Logger.error(`❌ Error updating document status: ${updateError.message}`);
      }
      
      return false;
    }
    
    // Get file size
    const stats = fs.statSync(outputPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    // Create or update processed_content field
    const processedContent = document.processed_content || {};
    
    // Update the document with the extraction info
    const { error: saveError } = await supabase
      .from('expert_documents')
      .update({
        processing_status: 'processing',
        processed_content: {
          ...processedContent,
          audio_extraction: {
            output_path: outputPath,
            file_size_mb: fileSizeMB,
            extraction_timestamp: new Date().toISOString()
          }
        }
      })
      .eq('id', documentId);
    
    if (saveError) {
      Logger.error(`❌ Error saving extraction details: ${saveError.message}`);
      return false;
    }
    
    // Update the corresponding presentation_asset if exists
    try {
      const { data: assets, error: assetQueryError } = await supabase
        .from('presentation_assets')
        .select('id, expert_document_id, source_id, metadata')
        .eq('expert_document_id', documentId)
        .limit(1);
      
      if (!assetQueryError && assets && assets.length > 0) {
        const assetId = assets[0].id;
        
        const { error: assetUpdateError } = await supabase
          .from('presentation_assets')
          .update({
            metadata: {
              ...assets[0].metadata,
              audio_extracted: true,
              audio_path: outputPath,
              audio_size_mb: fileSizeMB,
              audio_extraction_date: new Date().toISOString()
            }
          })
          .eq('id', assetId);
        
        if (assetUpdateError) {
          Logger.warn(`⚠️ Error updating presentation asset: ${assetUpdateError.message}`);
        } else {
          Logger.info(`✅ Updated presentation asset metadata`);
        }
      }
    } catch (error: any) {
      Logger.warn(`⚠️ Error updating presentation asset: ${error.message}`);
    }
    
    Logger.info(`✅ Successfully extracted audio for document ${documentId}`);
    return true;
  } catch (error: any) {
    Logger.error(`❌ Exception in convertExpertDocument: ${error.message}`);
    return false;
  }
}

/**
 * Process a batch of pending conversions
 */
async function processBatch(supabase: any, limit: number): Promise<{ success: number; failed: number }> {
  try {
    // Get documents pending audio extraction - using processing_status instead of content_extraction_status
    const { data: pendingDocs, error: queryError } = await supabase
      .from('expert_documents')
      .select('id, source_id, content_type, processing_status')
      .eq('content_type', 'presentation')
      .eq('processing_status', 'pending')
      .is('raw_content', null)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (queryError) {
      Logger.error(`❌ Error fetching pending documents: ${queryError.message}`);
      return { success: 0, failed: 0 };
    }
    
    if (!pendingDocs || pendingDocs.length === 0) {
      // Try with documents that don't have raw_content yet (unprocessed)
      const { data: pendingDocs2, error: queryError2 } = await supabase
        .from('expert_documents')
        .select('id, source_id, content_type, processing_status')
        .eq('content_type', 'presentation')
        .is('raw_content', null)
        .order('created_at', { ascending: true })
        .limit(limit);
      
      if (queryError2) {
        Logger.error(`❌ Error fetching pending documents: ${queryError2.message}`);
        return { success: 0, failed: 0 };
      }
      
      if (!pendingDocs2 || pendingDocs2.length === 0) {
        Logger.info('ℹ️ No pending documents found for audio extraction');
        return { success: 0, failed: 0 };
      }
      
      // Use this set of documents
      let success = 0;
      let failed = 0;
      
      Logger.info(`📋 Found ${pendingDocs2.length} documents pending audio extraction`);
      
      for (const doc of pendingDocs2) {
        Logger.info(`📋 Processing document: ${doc.id}`);
        const result = await convertExpertDocument(doc.id, supabase);
        if (result) {
          success++;
        } else {
          failed++;
        }
      }
      
      return { success, failed };
    }
    
    Logger.info(`📋 Found ${pendingDocs.length} documents pending audio extraction`);
    
    let success = 0;
    let failed = 0;
    
    // Process each document
    for (const doc of pendingDocs) {
      Logger.info(`📋 Processing document: ${doc.id}`);
      const result = await convertExpertDocument(doc.id, supabase);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }
    
    return { success, failed };
  } catch (error: any) {
    Logger.error(`❌ Exception in processBatch: ${error.message}`);
    return { success: 0, failed: 0 };
  }
}

async function main() {
  try {
    // Get the Supabase client using singleton pattern
    const supabaseClientService = SupabaseClientService.getInstance();
    let supabase: any;
    
    try {
      supabase = supabaseClientService.getClient();
      Logger.info('✅ Successfully connected to Supabase');
    } catch (error: any) {
      Logger.error('❌ Error getting Supabase client', error);
      process.exit(1);
    }
    
    // Display configuration
    Logger.info('🎬 MP4 to M4A Conversion');
    Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
    Logger.info(`Output directory: ${options.outputDir}`);
    
    // Ensure output directory exists
    if (!fs.existsSync(options.outputDir)) {
      if (options.dryRun) {
        Logger.info(`🔄 Would create directory: ${options.outputDir}`);
      } else {
        fs.mkdirSync(options.outputDir, { recursive: true });
        Logger.info(`✅ Created output directory: ${options.outputDir}`);
      }
    }
    
    // Handle batch processing
    if (options.batchSize > 0) {
      Logger.info(`Processing batch of up to ${options.batchSize} documents`);
      const { success, failed } = await processBatch(supabase, options.batchSize);
      Logger.info(`✅ Batch processing complete: ${success} succeeded, ${failed} failed`);
    }
    // Handle single document or file
    else if (options.fileId) {
      // Check if the fileId is a UUID (expert document) or a file path
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (uuidPattern.test(options.fileId)) {
        Logger.info(`📋 Processing expert document: ${options.fileId}`);
        await convertExpertDocument(options.fileId, supabase);
      } else {
        // Treat as file path
        if (!fs.existsSync(options.fileId)) {
          Logger.error(`❌ File not found: ${options.fileId}`);
          process.exit(1);
        }
        
        Logger.info(`📋 Processing file: ${options.fileId}`);
        const { success, outputPath, error } = await convertFile(options.fileId);
        
        if (success) {
          Logger.info(`✅ Conversion complete: ${outputPath}`);
        } else {
          Logger.error(`❌ Conversion failed: ${error}`);
          process.exit(1);
        }
      }
    } else {
      Logger.error('❌ No file ID or batch size specified');
      Logger.info('Usage: convert-mp4.ts [fileId|path] [options]');
      Logger.info('   or: convert-mp4.ts --batch [number]');
      process.exit(1);
    }
  } catch (error: any) {
    Logger.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Execute the main function
main().catch((error: any) => {
  Logger.error('Unhandled error:', error);
  process.exit(1);
});