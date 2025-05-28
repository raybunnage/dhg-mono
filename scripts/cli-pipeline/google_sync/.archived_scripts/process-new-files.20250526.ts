#!/usr/bin/env ts-node
/**
 * Process newly added files from sources_google
 * 
 * This command handles files that are in sources_google but don't yet have expert_documents:
 * - Finds sources_google files (excluding folders) without expert_documents records
 * - Assigns main_video_id using the folder hierarchy service
 * - Creates expert_documents records for actual files only
 * - Sets appropriate processing status based on file type
 * - Queues files for classification
 * 
 * NOTE: This script explicitly excludes folders (mime_type = 'application/vnd.google-apps.folder')
 * from expert_documents creation as folders do not contain extractable content.
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
import { getActiveFilterProfile } from './get-active-filter-profile';
import { createFolderHierarchyService } from '../../../packages/shared/services/folder-hierarchy-service';

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
  newSourcesGoogle: string[]; // Track newly found sources_google IDs
  newExpertDocuments: Array<{
    id: string;
    source_id: string;
    created_at: string;
  }>; // Track newly created expert_documents
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
    duration: 0,
    newSourcesGoogle: [],
    newExpertDocuments: []
  };
  
  try {
    // Build query for files needing processing
    // Note: processing_status doesn't exist in sources_google, we need to check
    // which files don't have expert_documents records yet
    let query = supabase
      .from('google_sources')
      .select('id, drive_id, name, mime_type, document_type_id, main_video_id, path_depth')
      .eq('is_deleted', false)
      // IMPORTANT: Exclude folders - we only want actual files
      .neq('mime_type', 'application/vnd.google-apps.folder')
      .order('path_depth', { ascending: false }) // Get files from deeper folders first
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
    
    console.log(`📋 Found ${pendingFiles.length} files (excluding folders) to check`);
    
    // Check which files already have expert_documents
    const sourceIds = pendingFiles.map(f => f.id);
    const { data: existingExpDocs } = await supabase
      .from('expert_documents')
      .select('source_id')
      .in('source_id', sourceIds);
    
    const existingSourceIds = new Set((existingExpDocs || []).map(e => e.source_id));
    
    // Filter to only files without expert_documents
    const filesToProcess = pendingFiles.filter(f => !existingSourceIds.has(f.id));
    
    // Track the sources_google IDs being processed
    result.newSourcesGoogle = filesToProcess.map(f => f.id);
    
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
    
    // Create folder hierarchy service
    const folderService = createFolderHierarchyService(supabase);
    
    // PHASE 1: Ensure high-level folders have main_video_id assigned
    console.log('\n🔍 Phase 1: Assigning main_video_id to high-level folders...');
    const assignmentResults = await folderService.assignMainVideoIdsToHighLevelFolders(rootDriveId);
    
    let totalItemsUpdated = 0;
    let foldersWithVideo = 0;
    
    for (const result of assignmentResults) {
      totalItemsUpdated += result.items_updated;
      if (result.main_video_id) {
        foldersWithVideo++;
      }
      
      if (result.errors.length > 0) {
        result.errors.forEach(error => result.errors.push(error));
      }
    }
    
    if (foldersWithVideo > 0) {
      console.log(`✅ Assigned main_video_id to ${foldersWithVideo} high-level folders`);
      console.log(`✅ Updated main_video_id for ${totalItemsUpdated} total items`);
    } else {
      console.log('ℹ️  All high-level folders already have main_video_id assigned');
    }
    
    console.log('\n📝 Phase 2: Processing new files...');
    
    // Process files in batches
    const BATCH_SIZE = 50;
    const batches = Math.ceil(filesToProcess.length / BATCH_SIZE);
    
    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, filesToProcess.length);
      const batch = filesToProcess.slice(start, end);
      
      const expertDocsToInsert = [];
      
      for (const file of batch) {
        const { status, skipReason } = determineProcessingStatus(file.name, file.mime_type);
        
        // Get the current main_video_id for this file
        // It may have been updated during Phase 1
        let currentMainVideoId = file.main_video_id;
        
        // If file doesn't have main_video_id yet, try to find it from its parent hierarchy
        if (!currentMainVideoId && file.path_depth > 0) {
          const highLevelResult = await folderService.findHighLevelFolder(file.id);
          if (highLevelResult.main_video_id) {
            currentMainVideoId = highLevelResult.main_video_id;
            
            // Update the sources_google record with the found main_video_id
            const { error: updateError } = await supabase
              .from('google_sources')
              .update({ main_video_id: currentMainVideoId })
              .eq('id', file.id);
            
            if (!updateError && isVerbose) {
              console.log(`Updated file ${file.name} with main_video_id: ${currentMainVideoId}`);
            }
          }
        }
        
        if (isVerbose && currentMainVideoId) {
          console.log(`File ${file.name} has main_video_id: ${currentMainVideoId}`);
        }
        
        // Prepare expert_documents record
        expertDocsToInsert.push({
          id: uuidv4(),
          source_id: file.id,
          reprocessing_status: status === 'needs_reprocessing' ? 'needs_reprocessing' : 
                              status === 'skip_processing' ? 'skip_processing' : 'not_set',
          reprocessing_status_updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          document_type_id: null, // Will be set by classification
          processing_skip_reason: skipReason
        });
        
        result.filesProcessed++;
      }
      
      // Insert expert_documents records
      if (expertDocsToInsert.length > 0) {
        const { data: insertedRecords, error: insertError } = await supabase
          .from('expert_documents')
          .insert(expertDocsToInsert)
          .select('id, source_id, created_at');
        
        if (insertError) {
          result.errors.push(`Batch ${i + 1} insert error: ${insertError.message}`);
          result.filesSkipped += expertDocsToInsert.length;
        } else {
          result.expertDocsCreated += expertDocsToInsert.length;
          console.log(`✓ Created ${expertDocsToInsert.length} expert_documents in batch ${i + 1}/${batches}`);
          
          // Track newly created expert_documents
          if (insertedRecords) {
            insertedRecords.forEach(record => {
              result.newExpertDocuments.push({
                id: record.id,
                source_id: record.source_id,
                created_at: record.created_at
              });
            });
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
 * Display recently created expert documents
 */
async function displayRecentExpertDocuments(rootDriveId?: string) {
  try {
    // Query for recent expert_documents
    let query = supabase
      .from('expert_documents')
      .select(`
        id,
        created_at,
        sources_google!inner(
          id,
          name,
          modified_at,
          root_drive_id,
          main_video_id,
          mime_type
        ),
        document_types(
          id,
          name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    
    // Apply root drive filter if provided
    if (rootDriveId) {
      query = query.eq('sources_google.root_drive_id', rootDriveId);
    }
    
    const { data: records, error } = await query;
    
    if (error) {
      console.error('Could not fetch recent records:', error.message);
      return;
    }
    
    if (!records || records.length === 0) {
      console.log('No recent expert_documents found.');
      return;
    }
    
    // Display table
    console.log('─'.repeat(155));
    console.log(
      '│ ' + 
      'File Name'.padEnd(60) + ' │ ' +
      'ID'.padEnd(36) + ' │ ' +
      'MIME Type'.padEnd(25) + ' │ ' +
      'Modified'.padEnd(10) + ' │ ' +
      'Video'.padEnd(5) + ' │'
    );
    console.log('─'.repeat(155));
    
    records.forEach((record: any) => {
      const fileName = record.sources_google.name.length > 60 
        ? record.sources_google.name.substring(0, 57) + '...' 
        : record.sources_google.name;
      
      const mimeType = record.sources_google.mime_type || 'Unknown';
      const mimeTypeTruncated = mimeType.length > 25
        ? mimeType.substring(0, 22) + '...'
        : mimeType;
      
      const modifiedDate = record.sources_google.modified_at 
        ? new Date(record.sources_google.modified_at).toLocaleDateString()
        : 'Unknown';
      
      const hasVideo = record.sources_google.main_video_id ? '✓' : '✗';
      
      console.log(
        '│ ' + 
        fileName.padEnd(60) + ' │ ' +
        record.sources_google.id.padEnd(36) + ' │ ' +
        mimeTypeTruncated.padEnd(25) + ' │ ' +
        modifiedDate.padEnd(10) + ' │ ' +
        hasVideo.padEnd(5) + ' │'
      );
    });
    
    console.log('─'.repeat(155));
    
  } catch (error: any) {
    console.error('Error displaying table:', error.message);
  }
}

/**
 * Display newly processed sources_google files
 */
async function displayNewSourcesGoogleTable(sourceIds: string[]) {
  if (!sourceIds || sourceIds.length === 0) return;
  
  try {
    const { data: records, error } = await supabase
      .from('google_sources')
      .select('id, name, mime_type, modified_at, main_video_id, path_depth')
      .in('id', sourceIds)
      .order('path_depth')
      .order('name');
    
    if (error) {
      console.error('Could not fetch sources_google records:', error.message);
      return;
    }
    
    if (!records || records.length === 0) return;
    
    // Display table header
    console.log('\n📁 Newly Processed Sources Google Files:');
    console.log('─'.repeat(185));
    console.log(
      '│ ' + 
      'File Name'.padEnd(50) + ' │ ' +
      'ID'.padEnd(36) + ' │ ' +
      'MIME Type'.padEnd(40) + ' │ ' +
      'Modified'.padEnd(10) + ' │ ' +
      'Video'.padEnd(5) + ' │ ' +
      'Depth'.padEnd(5) + ' │'
    );
    console.log('─'.repeat(185));
    
    // Display each record
    records.forEach((record: any) => {
      const fileName = record.name.length > 50 
        ? record.name.substring(0, 47) + '...' 
        : record.name;
      
      const mimeType = record.mime_type || 'Unknown';
      const mimeTypeTruncated = mimeType.length > 40
        ? mimeType.substring(0, 37) + '...'
        : mimeType;
      
      const modifiedDate = record.modified_at 
        ? new Date(record.modified_at).toLocaleDateString()
        : 'Unknown';
      
      const hasVideo = record.main_video_id ? '✓' : '✗';
      const depth = record.path_depth !== null ? record.path_depth.toString() : '-';
      
      console.log(
        '│ ' + 
        fileName.padEnd(50) + ' │ ' +
        record.id.padEnd(36) + ' │ ' +
        mimeTypeTruncated.padEnd(40) + ' │ ' +
        modifiedDate.padEnd(10) + ' │ ' +
        hasVideo.padEnd(5) + ' │ ' +
        depth.padEnd(5) + ' │'
      );
    });
    
    console.log('─'.repeat(185));
    
  } catch (error: any) {
    console.error('Error displaying sources_google table:', error.message);
  }
}

/**
 * Display newly created expert_documents
 */
async function displayNewExpertDocumentsTable(expertDocuments: Array<{id: string; source_id: string; created_at: string}>) {
  if (!expertDocuments || expertDocuments.length === 0) return;
  
  try {
    // Get source_ids for the query
    const sourceIds = expertDocuments.map(ed => ed.source_id);
    
    const { data: records, error } = await supabase
      .from('expert_documents')
      .select(`
        id,
        source_id,
        created_at,
        sources_google!inner(
          mime_type,
          path_depth
        )
      `)
      .in('source_id', sourceIds)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Could not fetch expert_documents records:', error.message);
      return;
    }
    
    if (!records || records.length === 0) return;
    
    // Display table header
    console.log('\n📄 Newly Created Expert Documents:');
    console.log('─'.repeat(165));
    console.log(
      '│ ' + 
      'Expert Doc ID'.padEnd(36) + ' │ ' +
      'Source ID'.padEnd(36) + ' │ ' +
      'MIME Type'.padEnd(40) + ' │ ' +
      'Created'.padEnd(19) + ' │ ' +
      'Depth'.padEnd(5) + ' │'
    );
    console.log('─'.repeat(165));
    
    // Display each record
    records.forEach((record: any) => {
      const mimeType = record.sources_google?.mime_type || 'Unknown';
      const mimeTypeTruncated = mimeType.length > 40
        ? mimeType.substring(0, 37) + '...'
        : mimeType;
      
      const createdDate = record.created_at 
        ? new Date(record.created_at).toLocaleString()
        : 'Unknown';
      
      const depth = record.sources_google?.path_depth !== null 
        ? record.sources_google.path_depth.toString() 
        : '-';
      
      console.log(
        '│ ' + 
        record.id.padEnd(36) + ' │ ' +
        record.source_id.padEnd(36) + ' │ ' +
        mimeTypeTruncated.padEnd(40) + ' │ ' +
        createdDate.padEnd(19) + ' │ ' +
        depth.padEnd(5) + ' │'
      );
    });
    
    console.log('─'.repeat(165));
    
  } catch (error: any) {
    console.error('Error displaying expert_documents table:', error.message);
  }
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
    
    // Display the newly processed records tables after all processing is complete
    if (!isDryRun) {
      // Display newly processed sources_google files
      if (result.newSourcesGoogle.length > 0) {
        await displayNewSourcesGoogleTable(result.newSourcesGoogle);
      }
      
      // Display newly created expert_documents
      if (result.newExpertDocuments.length > 0) {
        await displayNewExpertDocumentsTable(result.newExpertDocuments);
      }
      
      // If no new processing, show recent records as examples
      if (result.filesProcessed === 0) {
        console.log('\n📊 Recently created expert_documents (for demonstration):');
        await displayRecentExpertDocuments(rootDriveId);
      }
    }
    
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