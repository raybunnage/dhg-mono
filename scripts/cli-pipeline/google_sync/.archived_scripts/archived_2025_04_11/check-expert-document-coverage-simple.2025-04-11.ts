# Archived on 2025-04-11 - Original file used with sources_google table
#!/usr/bin/env ts-node
/**
 * Check Expert Document Coverage - Simple Version
 * 
 * This script analyzes expert_documents to see how many MP4 files in the 
 * Dynamic Healing Discussion Group already have associated expert documents.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger, LogLevel } from '../../../packages/shared/utils/logger';

// Load environment variables
const envFiles = ['.env', '.env.development', '.env.local'];
for (const file of envFiles) {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`Loading environment variables from ${filePath}`);
    dotenv.config({ path: filePath });
  }
}

// Set log level
Logger.setLevel(LogLevel.INFO);

/**
 * Main function to check expert document coverage
 */
async function checkExpertDocumentCoverage(): Promise<void> {
  console.log('\n=== Check Expert Document Coverage ===\n');

  try {
    // Initialize Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Folder ID for Dynamic Healing Discussion Group
    const folderId = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';
    const docType = 'Video Summary Transcript';
    
    // 1. Get folder info
    const { data: folderInfo, error: folderError } = await supabase
      .from('google_sources')
      .select('id, name, path')
      .eq('drive_id', folderId)
      .single();
    
    if (folderError) {
      Logger.error(`Error fetching folder info: ${folderError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Working with folder: "${folderInfo.name}" (${folderId})`);
    
    // 2. Get document type info
    const { data: docTypeInfo, error: docTypeError } = await supabase
      .from('document_types')
      .select('id, document_type')
      .eq('document_type', docType)
      .single();
    
    if (docTypeError) {
      Logger.error(`Error fetching document type: ${docTypeError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Document type "${docType}" has ID: ${docTypeInfo.id}`);
    
    // 3. Count MP4 files in the folder
    const { count: mp4Count, error: mp4Error } = await supabase
      .from('google_sources')
      .select('id', { count: 'exact' })
      .eq('mime_type', 'video/mp4')
      .eq('parent_folder_id', folderId);
    
    if (mp4Error) {
      Logger.error(`Error counting MP4 files: ${mp4Error.message}`);
      process.exit(1);
    }
    
    const mp4CountNumber = mp4Count || 0;
    Logger.info(`MP4 files in folder with exact parent_folder_id match: ${mp4CountNumber}`);
    
    // 4. Count MP4 files with parent_path containing folder name
    const { count: mp4PathCount, error: mp4PathError } = await supabase
      .from('google_sources')
      .select('id', { count: 'exact' })
      .eq('mime_type', 'video/mp4')
      .ilike('parent_path', `%${folderInfo.name}%`);
    
    if (mp4PathError) {
      Logger.error(`Error counting MP4 files by path: ${mp4PathError.message}`);
      process.exit(1);
    }
    
    const mp4PathCountNumber = mp4PathCount || 0;
    Logger.info(`MP4 files with parent_path containing folder name: ${mp4PathCountNumber}`);
    
    // 5. Get MP4 files that have expert documents of the specified type
    const { data: mp4WithExpertDocs, error: expertsError } = await supabase
      .from('google_expert_documents')
      .select(`
        id,
        source_id,
        status
      `)
      .eq('document_type_id', docTypeInfo.id);
    
    if (expertsError) {
      Logger.error(`Error fetching expert documents: ${expertsError.message}`);
      process.exit(1);
    }
    
    // Get unique source IDs
    const sourceIdsWithExpertDocs = new Set();
    if (mp4WithExpertDocs) {
      mp4WithExpertDocs.forEach(doc => {
        if (doc.source_id) {
          sourceIdsWithExpertDocs.add(doc.source_id);
        }
      });
    }
    
    Logger.info(`\nTotal expert documents of type "${docType}": ${mp4WithExpertDocs?.length || 0}`);
    Logger.info(`Unique MP4 files with expert documents: ${sourceIdsWithExpertDocs.size}`);
    
    // 6. Get source names for these expert documents
    if (sourceIdsWithExpertDocs.size > 0) {
      const sourceIdsArray = Array.from(sourceIdsWithExpertDocs);
      const { data: sourceNames, error: namesError } = await supabase
        .from('google_sources')
        .select('id, name, parent_path, parent_folder_id')
        .in('id', sourceIdsArray.slice(0, 100)); // Limit to first 100
      
      if (namesError) {
        Logger.error(`Error fetching source names: ${namesError.message}`);
        process.exit(1);
      }
      
      // Count sources that are in the target folder
      let inFolderCount = 0;
      if (sourceNames) {
        for (const source of sourceNames) {
          if (
            source.parent_folder_id === folderId ||
            (source.parent_path && source.parent_path.includes(folderInfo.name))
          ) {
            inFolderCount++;
          }
        }
      }
      
      Logger.info(`\nSampled ${sourceNames?.length || 0} sources with expert documents`);
      Logger.info(`Of these, ${inFolderCount} are in the target folder`);
      
      if (sourceNames && sourceNames.length > 0) {
        const estimatedInFolderPercentage = (inFolderCount / sourceNames.length) * 100;
        const estimatedTotalInFolder = Math.round((sourceIdsWithExpertDocs.size * estimatedInFolderPercentage) / 100);
        
        Logger.info(`\nEstimated expert document coverage:`);
        Logger.info(`- Estimated ${estimatedTotalInFolder} MP4 files in the target folder have expert documents`);
        Logger.info(`- This is approximately ${Math.round((estimatedTotalInFolder / mp4PathCountNumber) * 100)}% coverage`);
      }
    }
    
    // 7. Count presentations with main_video_id
    const { count: presentationsCount, error: presentationsError } = await supabase
      .from('presentations')
      .select('id', { count: 'exact' })
      .not('main_video_id', 'is', null);
    
    if (presentationsError) {
      Logger.error(`Error counting presentations: ${presentationsError.message}`);
      process.exit(1);
    }
    
    Logger.info(`\nPresentations with main_video_id: ${presentationsCount || 0}`);
    
    // 8. Count presentation_assets that reference expert documents
    const { count: assetsCount, error: assetsError } = await supabase
      .from('presentation_assets')
      .select('id', { count: 'exact' })
      .not('expert_document_id', 'is', null);
    
    if (assetsError) {
      Logger.error(`Error counting presentation assets: ${assetsError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Presentation assets with expert_document_id: ${assetsCount || 0}`);
    
    console.log('\n=== Analysis Complete ===\n');
    
  } catch (error: any) {
    Logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Execute main function
checkExpertDocumentCoverage().catch(error => {
  Logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});