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
 *   --limit [number]           Process a batch of pending files (same as --batch)
 *   --batch [number]           Process a batch of pending files (deprecated, use --limit)
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, execSync } from 'child_process';
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

// Get batch size if specified (from --batch or --limit)
const batchIndex = args.indexOf('--batch');
const limitIndex = args.indexOf('--limit');

if (batchIndex !== -1 && args[batchIndex + 1]) {
  const batchArg = parseInt(args[batchIndex + 1]);
  if (!isNaN(batchArg)) {
    options.batchSize = batchArg;
  }
}

// --limit takes precedence over --batch if both are specified
if (limitIndex !== -1 && args[limitIndex + 1]) {
  const limitArg = parseInt(args[limitIndex + 1]);
  if (!isNaN(limitArg)) {
    options.batchSize = limitArg;
  }
}

/**
 * Convert MP4 file to M4A using FFmpeg
 */
async function convertFile(filePath: string, outputPath?: string): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  return new Promise((resolve) => {
    // Set a 5 minute timeout for the conversion
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    let timeoutId: NodeJS.Timeout;
    
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
    
    // Execute FFmpeg with timeout and error handling
    let ffmpegProcess: ReturnType<typeof spawn> | null = null;
    try {
      // Add explicit timeout to FFmpeg command
      ffmpegProcess = spawn('ffmpeg', [
        '-i', filePath,
        '-vn',          // No video
        '-acodec', 'copy', // Copy audio codec without re-encoding
        '-y',           // Overwrite output file
        '-t', '7200',   // Set a 2-hour max duration (avoid infinite processing)
        finalOutputPath
      ]);
      
      // Set timeout to prevent hanging
      timeoutId = setTimeout(() => {
        Logger.warn(`⚠️ Conversion timed out after ${TIMEOUT_MS/1000} seconds, killing process...`);
        if (ffmpegProcess && !ffmpegProcess.killed) {
          ffmpegProcess.kill('SIGTERM');
        }
        resolve({ success: false, error: 'Conversion timed out' });
      }, TIMEOUT_MS);
    } catch (err: any) {
      Logger.error(`❌ Failed to spawn FFmpeg: ${err.message}`);
      resolve({ success: false, error: err.message });
      return;
    }
    
    let stderr = '';
    let lastProgressTime = Date.now();
    
    if (ffmpegProcess && ffmpegProcess.stderr) {
      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // FFmpeg outputs progress to stderr
        if (data.toString().includes('size=')) {
          process.stdout.write('.');
          lastProgressTime = Date.now(); // Update last progress time
        }
      });
    }
    
    if (ffmpegProcess) {
      ffmpegProcess.on('error', (err) => {
        clearTimeout(timeoutId);
        Logger.error(`❌ FFmpeg error: ${err.message}`);
        resolve({ success: false, error: err.message });
      });
    }
    
    ffmpegProcess.on('close', (code) => {
      clearTimeout(timeoutId);
      
      if (code === 0) {
        // Verify the output file exists and has a reasonable size
        if (fs.existsSync(finalOutputPath)) {
          try {
            const stats = fs.statSync(finalOutputPath);
            const fileSizeMB = stats.size / (1024 * 1024);
            
            if (fileSizeMB < 0.1) { // Less than 100KB
              Logger.warn(`⚠️ Warning: Output file is very small (${fileSizeMB.toFixed(2)} MB)`);
              resolve({ success: false, error: 'Output file is too small', outputPath: finalOutputPath });
              return;
            }
            
            Logger.info(`✅ Successfully converted to: ${finalOutputPath}`);
            Logger.info(`📊 File size: ${fileSizeMB.toFixed(2)} MB`);
            resolve({ success: true, outputPath: finalOutputPath });
          } catch (err: any) {
            Logger.error(`❌ Error checking output file: ${err.message}`);
            resolve({ success: false, error: err.message });
          }
        } else {
          Logger.error(`❌ Output file not found: ${finalOutputPath}`);
          resolve({ success: false, error: 'Output file not found' });
        }
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
    
    // Ensure the MP4 directory exists
    if (!fs.existsSync(videoDir)) {
      try {
        fs.mkdirSync(videoDir, { recursive: true });
        Logger.info(`✅ Created MP4 directory: ${videoDir}`);
      } catch (err: any) {
        Logger.warn(`⚠️ Could not create MP4 directory: ${err.message}`);
      }
    }
    
    // Look for exact match first
    const exactVideoPath = path.join(videoDir, sourceFile.name);
    let videoPath = '';
    
    if (fs.existsSync(exactVideoPath)) {
      videoPath = exactVideoPath;
    } else {
      try {
        // Search in the mp4 directory with more flexible matching
        const files = fs.readdirSync(videoDir);
        
        // First try exact match ignoring case
        let matchingFile = files.find(file => 
          file.toLowerCase() === sourceFile.name.toLowerCase()
        );
        
        if (!matchingFile) {
          // Then try a few common variants
          matchingFile = files.find(file => 
            file === sourceFilename + '.mp4' ||
            file === 'INGESTED_' + sourceFile.name ||
            file.toLowerCase().includes(sourceFilename.toLowerCase()) || // Partial match
            sourceFilename.toLowerCase().includes(file.toLowerCase().replace(/\.mp4$/i, '')) // Reverse partial match
          );
        }
        
        if (matchingFile) {
          videoPath = path.join(videoDir, matchingFile);
        }
      } catch (error: any) {
        Logger.error(`❌ Error reading video directory: ${error.message}`);
        return false;
      }
      
      // If still not found, try to copy from the Google Drive locations
      if (!videoPath) {
        Logger.info(`MP4 file for source ${sourceFilename} not found in local directory, attempting to find in Google Drive...`);
        
        try {
          // First try to find in the usual Google Drive location
          const googleDrivePath = '/Users/raybunnage/Library/CloudStorage/GoogleDrive-bunnage.ray@gmail.com/My Drive/200_Research Experts';
          
          // Then try in the Dynamic Healing Discussion Group directory as fallback
          const dhgDir = '/Users/raybunnage/Library/CloudStorage/GoogleDrive-bunnage.ray@gmail.com/My Drive/Dynamic Healing Discussion Group';
          
          let foundInGDrive = false;
          
          if (fs.existsSync(dhgDir)) {
            // Use find command for a thorough search in DHG directory
            try {
              // Try exact filename first
              const findResult = execSync(`find "${dhgDir}" -name "${sourceFile.name}" | head -n 1`).toString().trim();
              
              if (findResult) {
                Logger.info(`Found ${sourceFile.name} in DHG directory at ${findResult}`);
                // Copy the file to our local MP4 directory
                const targetPath = path.join(videoDir, sourceFile.name);
                execSync(`cp "${findResult}" "${targetPath}"`);
                Logger.info(`Copied MP4 file to ${targetPath}`);
                videoPath = targetPath;
                foundInGDrive = true;
              } else {
                // Try case-insensitive search
                const findInsensitive = execSync(`find "${dhgDir}" -iname "${sourceFile.name}" | head -n 1`).toString().trim();
                if (findInsensitive) {
                  Logger.info(`Found ${sourceFile.name} in DHG directory at ${findInsensitive} (case-insensitive match)`);
                  // Copy the file to our local MP4 directory
                  const targetPath = path.join(videoDir, sourceFile.name);
                  execSync(`cp "${findInsensitive}" "${targetPath}"`);
                  Logger.info(`Copied MP4 file to ${targetPath}`);
                  videoPath = targetPath;
                  foundInGDrive = true;
                }
              }
            } catch (err) {
              // Ignore find errors
            }
          }
          
          // If not found in DHG, try the 200_Research Experts folder
          if (!foundInGDrive && fs.existsSync(googleDrivePath)) {
            try {
              const findResult = execSync(`find "${googleDrivePath}" -name "${sourceFile.name}" | head -n 1`).toString().trim();
              
              if (findResult) {
                Logger.info(`Found ${sourceFile.name} in Google Drive at ${findResult}`);
                // Copy the file to our local MP4 directory
                const targetPath = path.join(videoDir, sourceFile.name);
                execSync(`cp "${findResult}" "${targetPath}"`);
                Logger.info(`Copied MP4 file to ${targetPath}`);
                videoPath = targetPath;
              }
            } catch (err) {
              // Ignore find errors
            }
          }
        } catch (err: any) {
          Logger.warn(`⚠️ Error searching Google Drive: ${err.message}`);
        }
      }
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
    // EMERGENCY FIX: Directly look for the Wilkinson and OpenDiscuss files in Google Drive
    const googleDrivePath = '/Users/raybunnage/Library/CloudStorage/GoogleDrive-bunnage.ray@gmail.com/My Drive/200_Research Experts';
    const mp4Dir = path.join(process.cwd(), 'file_types', 'mp4');
    
    // Ensure MP4 directory exists
    if (!fs.existsSync(mp4Dir)) {
      fs.mkdirSync(mp4Dir, { recursive: true });
      Logger.info(`Created directory: ${mp4Dir}`);
    }
    
    const filesToFind = [
      'Wilkinson.9.15.24.mp4',
      'OpenDiscuss.PVT.CNS.6.24.20.mp4'
    ];
    
    let directConversionCount = 0;
    
    for (const fileToFind of filesToFind) {
      const sourcePath = path.join(googleDrivePath, fileToFind);
      const targetPath = path.join(mp4Dir, fileToFind);
      
      if (fs.existsSync(sourcePath)) {
        Logger.info(`📋 EMERGENCY FIX: Found ${fileToFind} in Google Drive`);
        
        // Copy the file
        if (!fs.existsSync(targetPath)) {
          fs.copyFileSync(sourcePath, targetPath);
          Logger.info(`✅ Copied ${fileToFind} to local MP4 directory`);
        } else {
          Logger.info(`ℹ️ File ${fileToFind} already exists in local MP4 directory`);
        }
        
        // Convert the file directly
        const outputFilename = fileToFind.replace(/\.mp4$/, ".m4a");
        const outputPath = path.join(options.outputDir, outputFilename);
        
        Logger.info(`🔄 EMERGENCY FIX: Converting ${fileToFind} to M4A`);
        const result = await convertFile(targetPath, outputPath);
        
        if (result.success) {
          Logger.info(`✅ EMERGENCY FIX: Successfully converted ${fileToFind}`);
          directConversionCount++;
        } else {
          Logger.error(`❌ EMERGENCY FIX: Failed to convert ${fileToFind}: ${result.error}`);
        }
      } else {
        Logger.warn(`⚠️ EMERGENCY FIX: Could not find ${fileToFind} in Google Drive`);
      }
    }
    
    if (directConversionCount > 0) {
      return { success: directConversionCount, failed: filesToFind.length - directConversionCount };
    }
    
    // Only continue with normal processing if emergency fix didn't work
    
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
        
        // If no pending documents found, look for local MP4 files and convert them directly
        Logger.info('📋 Looking for local MP4 files to convert directly...');
        
        const mp4Dir = path.join(process.cwd(), 'file_types', 'mp4');
        if (!fs.existsSync(mp4Dir)) {
          Logger.error(`❌ MP4 directory not found: ${mp4Dir}`);
          return { success: 0, failed: 0 };
        }
        
        // Get all MP4 files in the directory
        const mp4Files = fs.readdirSync(mp4Dir)
          .filter(file => file.toLowerCase().endsWith('.mp4'))
          .map(file => path.join(mp4Dir, file))
          .slice(0, limit); // Limit to the specified number of files
        
        if (mp4Files.length === 0) {
          Logger.info('ℹ️ No MP4 files found for direct conversion');
          return { success: 0, failed: 0 };
        }
        
        Logger.info(`📋 Found ${mp4Files.length} MP4 files for direct conversion`);
        
        // Check if parallel processing is enabled
        const parallelArg = args.includes('--parallel');
        const maxParallelIndex = args.indexOf('--max-parallel');
        const maxParallel = maxParallelIndex !== -1 && args[maxParallelIndex + 1] 
          ? parseInt(args[maxParallelIndex + 1]) 
          : parallelArg ? 3 : 1; // Default to 3 if parallel is enabled, 1 otherwise
        
        let success = 0;
        let failed = 0;
        
        if (parallelArg && maxParallel > 1) {
          // Process files in parallel with concurrency limit
          Logger.info(`🔄 Processing ${mp4Files.length} files with max ${maxParallel} parallel conversions`);
          
          // Create chunks to process in parallel
          const chunks: string[][] = [];
          for (let i = 0; i < mp4Files.length; i += maxParallel) {
            chunks.push(mp4Files.slice(i, i + maxParallel));
          }
          
          // Process each chunk in parallel
          for (const chunk of chunks) {
            Logger.info(`🔄 Processing batch of ${chunk.length} files in parallel`);
            
            // Create an array of conversion promises
            const conversionPromises = chunk.map(filePath => {
              Logger.info(`📋 Starting conversion: ${path.basename(filePath)}`);
              return convertFile(filePath).then(result => {
                if (result.success) {
                  success++;
                  Logger.info(`✅ Successfully converted ${path.basename(filePath)}`);
                } else {
                  failed++;
                  Logger.warn(`⚠️ Failed to convert ${path.basename(filePath)}: ${result.error}`);
                }
                return result;
              });
            });
            
            // Wait for all conversions in this chunk to complete
            await Promise.all(conversionPromises);
            Logger.info(`✅ Completed batch of ${chunk.length} conversions`);
          }
        } else {
          // Process files sequentially
          Logger.info(`🔄 Processing ${mp4Files.length} files sequentially`);
          
          for (const filePath of mp4Files) {
            Logger.info(`📋 Processing file: ${path.basename(filePath)}`);
            const result = await convertFile(filePath);
            if (result.success) {
              success++;
            } else {
              failed++;
            }
          }
        }
        
        return { success, failed };
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

/**
 * Default export function for CLI integration
 */
export default async function(cliOptions?: any): Promise<void> {
  // Override default options with CLI options if provided
  if (cliOptions) {
    if (cliOptions.dryRun) options.dryRun = true;
    if (cliOptions.force) options.force = true;
    if (cliOptions.fileId || cliOptions.file) options.fileId = cliOptions.fileId || cliOptions.file;
    if (cliOptions.output) options.outputDir = cliOptions.output;
    if (cliOptions.batchSize) options.batchSize = parseInt(cliOptions.batchSize);
    if (cliOptions.batch) options.batchSize = parseInt(cliOptions.batch);
    if (cliOptions.limit) options.batchSize = parseInt(cliOptions.limit);
  }
  
  try {
    await main();
  } catch (error: any) {
    Logger.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  }
}

// If running directly (not imported), execute the main function
if (require.main === module) {
  main().catch((error: any) => {
    Logger.error('Unhandled error:', error);
    process.exit(1);
  });
}