#!/usr/bin/env ts-node
/**
 * Process newly added files
 * 
 * This command handles files that were recently added:
 * - Creates expert_documents records
 * - Sets appropriate processing status based on file type
 * - Queues files for classification
 * 
 * Usage:
 *   ts-node process-new-files.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be processed without making changes
 *   --limit <n>        Limit number of files to process (default: 100)
 *   --verbose          Show detailed logs
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import type { Database } from '../../../supabase/types';
import { getActiveFilterProfile } from './get-active-filter-profile';

// Load environment files
function loadEnvFiles() {
  const envFiles = ['.env', '.env.local', '.env.development'];
  
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`Loading environment variables from ${file}`);
      dotenv.config({ path: filePath });
    }
  }
}

loadEnvFiles();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 && args[limitIndex + 1] 
  ? parseInt(args[limitIndex + 1], 10) 
  : 100;

// Create Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

interface ProcessResult {
  filesProcessed: number;
  expertDocsCreated: number;
  filesSkipped: number;
  errors: string[];
  duration: number;
}

// Supported file types for processing
const PROCESSABLE_EXTENSIONS = [
  '.txt', '.docx', '.pdf', '.pptx', '.mp4', '.webm', 
  '.mov', '.avi', '.mkv', '.m4v', '.mp3', '.wav', 
  '.aac', '.m4a', '.flac', '.wma'
];

// Skip processing file types
const SKIP_PROCESSING_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg',
  '.ico', '.webp', '.tiff', '.zip', '.rar', '.tar',
  '.gz', '.7z', '.exe', '.dmg', '.pkg', '.deb',
  '.rpm', '.iso', '.bin', '.dat'
];

/**
 * Determine processing status based on file type
 */
function determineProcessingStatus(filename: string, mimeType: string): {
  status: string;
  skipReason?: string;
} {
  const ext = path.extname(filename).toLowerCase();
  
  // Check if it's a processable type
  if (PROCESSABLE_EXTENSIONS.includes(ext)) {
    return { status: 'needs_reprocessing' };
  }
  
  // Check if it should be skipped
  if (SKIP_PROCESSING_EXTENSIONS.includes(ext)) {
    return {
      status: 'skip_processing',
      skipReason: `File type ${ext} is not suitable for content extraction`
    };
  }
  
  // Google-specific types
  if (mimeType?.startsWith('application/vnd.google-apps.')) {
    const googleType = mimeType.replace('application/vnd.google-apps.', '');
    switch (googleType) {
      case 'document':
      case 'spreadsheet':
      case 'presentation':
        return { status: 'needs_reprocessing' };
      case 'folder':
        return {
          status: 'skip_processing',
          skipReason: 'Folders do not contain extractable content'
        };
      default:
        return {
          status: 'skip_processing',
          skipReason: `Google ${googleType} type not supported for extraction`
        };
    }
  }
  
  // Default for unknown types
  return {
    status: 'skip_processing',
    skipReason: `Unknown file type: ${ext || 'no extension'}`
  };
}

/**
 * Process new files that need expert_documents records
 */
async function processNewFiles(rootDriveId?: string): Promise<ProcessResult> {
  const startTime = Date.now();
  const result: ProcessResult = {
    filesProcessed: 0,
    expertDocsCreated: 0,
    filesSkipped: 0,
    errors: [],
    duration: 0
  };
  
  try {
    // Build query for files needing processing
    let query = supabase
      .from('sources_google')
      .select('id, drive_id, name, mime_type, document_type_id, processing_status')
      .eq('is_deleted', false)
      .or('processing_status.eq.pending,processing_status.is.null')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    // Apply root drive filter if provided
    if (rootDriveId) {
      query = query.eq('root_drive_id', rootDriveId);
    }
    
    const { data: pendingFiles, error: queryError } = await query;
    
    if (queryError) throw queryError;
    
    if (!pendingFiles || pendingFiles.length === 0) {
      console.log('✓ No new files to process');
      result.duration = (Date.now() - startTime) / 1000;
      return result;
    }
    
    console.log(`📋 Found ${pendingFiles.length} files to process`);
    
    // Check which files already have expert_documents
    const sourceIds = pendingFiles.map(f => f.id);
    const { data: existingExpDocs } = await supabase
      .from('expert_documents')
      .select('source_id')
      .in('source_id', sourceIds);
    
    const existingSourceIds = new Set((existingExpDocs || []).map(e => e.source_id));
    
    // Filter to only files without expert_documents
    const filesToProcess = pendingFiles.filter(f => !existingSourceIds.has(f.id));
    
    console.log(`📝 ${filesToProcess.length} files need expert_documents records`);
    
    if (isDryRun) {
      console.log('DRY RUN: Would process these files:');
      filesToProcess.slice(0, 10).forEach(f => {
        const { status, skipReason } = determineProcessingStatus(f.name, f.mime_type);
        console.log(`  - ${f.name} → ${status}${skipReason ? ` (${skipReason})` : ''}`);
      });
      if (filesToProcess.length > 10) {
        console.log(`  ... and ${filesToProcess.length - 10} more files`);
      }
      result.filesProcessed = filesToProcess.length;
      result.duration = (Date.now() - startTime) / 1000;
      return result;
    }
    
    // Process files in batches
    const BATCH_SIZE = 50;
    const batches = Math.ceil(filesToProcess.length / BATCH_SIZE);
    
    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, filesToProcess.length);
      const batch = filesToProcess.slice(start, end);
      
      const expertDocsToInsert = [];
      const sourceUpdates = [];
      
      for (const file of batch) {
        const { status, skipReason } = determineProcessingStatus(file.name, file.mime_type);
        
        // Prepare expert_documents record
        expertDocsToInsert.push({
          id: uuidv4(),
          source_id: file.id,
          document_processing_status: status,
          document_processing_status_updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          document_type_id: file.document_type_id,
          source_type: 'google_drive',
          processing_skip_reason: skipReason,
          metadata: {
            created_from_sync: true,
            file_name: file.name,
            mime_type: file.mime_type,
            processing_determined_by: 'file_type_analysis'
          }
        });
        
        // Update processing status on sources_google
        sourceUpdates.push({
          id: file.id,
          processing_status: status === 'needs_reprocessing' ? 'queued' : 'skipped'
        });
        
        result.filesProcessed++;
      }
      
      // Insert expert_documents records
      if (expertDocsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('expert_documents')
          .insert(expertDocsToInsert);
        
        if (insertError) {
          result.errors.push(`Batch ${i + 1} insert error: ${insertError.message}`);
          result.filesSkipped += expertDocsToInsert.length;
        } else {
          result.expertDocsCreated += expertDocsToInsert.length;
          console.log(`✓ Created ${expertDocsToInsert.length} expert_documents in batch ${i + 1}/${batches}`);
        }
        
        // Update source processing status
        for (const update of sourceUpdates) {
          const { error: updateError } = await supabase
            .from('sources_google')
            .update({ processing_status: update.processing_status })
            .eq('id', update.id);
          
          if (updateError && isVerbose) {
            console.log(`Warning: Could not update processing status for ${update.id}`);
          }
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ Processing error:', error.message);
    result.errors.push(error.message);
  }
  
  result.duration = (Date.now() - startTime) / 1000;
  return result;
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Process New Files ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit} files`);
  console.log('=========================\n');
  
  try {
    // Check for active filter profile
    const activeFilter = await getActiveFilterProfile();
    let rootDriveId: string | undefined;
    
    if (activeFilter && activeFilter.rootDriveId) {
      console.log(`🔍 Active filter: "${activeFilter.profile.name}"`);
      console.log(`📁 Using root_drive_id: ${activeFilter.rootDriveId}\n`);
      rootDriveId = activeFilter.rootDriveId;
    }
    
    // Process new files
    const result = await processNewFiles(rootDriveId);
    
    // Display results
    console.log('\n=== Processing Complete ===');
    console.log(`✓ Files processed: ${result.filesProcessed}`);
    console.log(`✓ Expert docs created: ${result.expertDocsCreated}`);
    console.log(`✓ Files skipped: ${result.filesSkipped}`);
    console.log(`✓ Errors: ${result.errors.length}`);
    console.log(`✓ Duration: ${result.duration.toFixed(1)}s`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    if (result.expertDocsCreated > 0) {
      console.log('\n💡 Next steps:');
      console.log('  - Run classify-docs-service for .docx/.txt files');
      console.log('  - Run classify-pdfs for PDF files');
      console.log('  - Run classify-powerpoints for PowerPoint files');
    }
    
    process.exit(result.errors.length > 0 ? 1 : 0);
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Export for use as module
export { processNewFiles };

// Run if called directly
if (require.main === module) {
  main();
}