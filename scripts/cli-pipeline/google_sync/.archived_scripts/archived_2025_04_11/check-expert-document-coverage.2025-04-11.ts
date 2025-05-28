# Archived on 2025-04-11 - Original file used with sources_google table
#!/usr/bin/env ts-node
/**
 * Check Expert Document Coverage
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

// Process command line arguments
const args = process.argv.slice(2);
const isVerbose = args.includes('--verbose');

if (isVerbose) {
  Logger.setLevel(LogLevel.DEBUG);
} else {
  Logger.setLevel(LogLevel.INFO);
}

// Get folder ID from command line or use default
const folderIdIndex = args.indexOf('--folder-id');
let folderId = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'; // Default: Dynamic Healing Discussion Group
if (folderIdIndex !== -1 && args[folderIdIndex + 1]) {
  folderId = args[folderIdIndex + 1];
}

// Get document type from command line or use default
const docTypeIndex = args.indexOf('--doc-type');
let documentType = 'Video Summary Transcript'; // Default document type
if (docTypeIndex !== -1 && args[docTypeIndex + 1]) {
  documentType = args[docTypeIndex + 1];
}

/**
 * Main function to check expert document coverage
 */
async function checkExpertDocumentCoverage(): Promise<void> {
  console.log('=== Check Expert Document Coverage ===');
  console.log(`Folder ID: ${folderId}`);
  console.log(`Document Type: ${documentType}`);
  console.log('=========================================');

  // Initialize Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Step 1: Get folder info to verify it exists
    const { data: folderInfo, error: folderError } = await supabase
      .from('google_sources')
      .select('id, name, path')
      .eq('drive_id', folderId)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .single();
    
    if (folderError) {
      Logger.error(`Error fetching folder info: ${folderError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Working with folder: "${folderInfo.name}" (${folderId})`);
    
    // Step 2: Get all MP4 files in the folder
    const { data: mp4Files, error: mp4Error } = await supabase
      .from('google_sources')
      .select('id, name, path, parent_path, parent_folder_id, drive_id')
      .eq('deleted', false)
      .eq('mime_type', 'video/mp4');
    
    if (mp4Error) {
      Logger.error(`Error fetching MP4 files: ${mp4Error.message}`);
      process.exit(1);
    }
    
    // Filter to get MP4 files in the specified folder
    const folderPath = folderInfo.path;
    const folderName = folderInfo.name;
    
    const mp4FilesInFolder = mp4Files.filter(file => {
      // Check if parent_folder_id matches
      if (file.parent_folder_id === folderId) {
        return true;
      }
      
      // Check if path or parent_path includes the folder name or path
      if (file.path && (file.path.includes(folderName) || file.path.includes(folderPath))) {
        return true;
      }
      
      if (file.parent_path && (
        file.parent_path.includes(folderName) || 
        file.parent_path.startsWith(folderName) ||
        file.parent_path.includes(folderPath.substring(1)) // Remove leading slash
      )) {
        return true;
      }
      
      return false;
    });
    
    Logger.info(`Found ${mp4FilesInFolder.length} MP4 files in folder "${folderInfo.name}"`);
    
    // Step 3: Get the document type ID
    const { data: docTypeInfo, error: docTypeError } = await supabase
      .from('document_types')
      .select('id, document_type')
      .eq('document_type', documentType)
      .single();
    
    if (docTypeError) {
      Logger.error(`Error fetching document type: ${docTypeError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Document type "${documentType}" has ID: ${docTypeInfo.id}`);
    
    // Step 4: Get expert documents for these MP4 files
    const mp4FileIds = mp4FilesInFolder.map(file => file.id);
    
    const { data: expertDocuments, error: expertDocError } = await supabase
      .from('expert_documents')
      .select(`
        id, 
        document_type_id, 
        source_id, 
        status,
        created_at,
        updated_at,
        document_types(document_type),
        sources_google:source_id(id, name, mime_type)
      `)
      .eq('document_type_id', docTypeInfo.id)
      .in('source_id', mp4FileIds);
    
    if (expertDocError) {
      Logger.error(`Error fetching expert documents: ${expertDocError.message}`);
      process.exit(1);
    }
    
    // Step 5: Check which MP4 files have associated expert documents
    const mp4FilesWithExpertDocs = expertDocuments.map(doc => doc.source_id);
    const mp4FilesWithExpertDocsSet = new Set(mp4FilesWithExpertDocs);
    
    // Count by status
    const statusCounts: Record<string, number> = {};
    expertDocuments.forEach(doc => {
      const status = doc.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    // Print status counts
    Logger.info(`Expert documents by status:`);
    Object.entries(statusCounts).forEach(([status, count]) => {
      Logger.info(`- ${status}: ${count}`);
    });
    
    Logger.info(`Found ${expertDocuments.length} expert documents of type "${documentType}" for these MP4 files`);
    Logger.info(`${mp4FilesWithExpertDocsSet.size} unique MP4 files have expert documents`);
    
    // Calculate coverage percentage
    const coveragePercentage = (mp4FilesWithExpertDocsSet.size / mp4FilesInFolder.length) * 100;
    Logger.info(`Coverage: ${coveragePercentage.toFixed(2)}% of MP4 files have expert documents`);
    
    // Step 6: Check which MP4 files don't have expert documents
    const mp4FilesWithoutExpertDocs = mp4FilesInFolder.filter(
      file => !mp4FilesWithExpertDocsSet.has(file.id)
    );
    
    Logger.info(`${mp4FilesWithoutExpertDocs.length} MP4 files don't have expert documents`);
    
    if (mp4FilesWithoutExpertDocs.length > 0 && isVerbose) {
      Logger.debug('\nSample MP4 files without expert documents:');
      const sampleSize = Math.min(10, mp4FilesWithoutExpertDocs.length);
      for (let i = 0; i < sampleSize; i++) {
        Logger.debug(`- ${mp4FilesWithoutExpertDocs[i].name} (${mp4FilesWithoutExpertDocs[i].id})`);
      }
    }
    
    // Step 7: Check which expert documents don't have presentations
    const { data: presentationsData, error: presentationsError } = await supabase
      .from('presentations')
      .select('id, main_video_id')
      .not('main_video_id', 'is', null);
    
    if (presentationsError) {
      Logger.error(`Error fetching presentations: ${presentationsError.message}`);
      process.exit(1);
    }
    
    const videoIdsWithPresentations = new Set(presentationsData.map(p => p.main_video_id));
    
    const expertDocsWithoutPresentations = expertDocuments.filter(
      doc => !videoIdsWithPresentations.has(doc.source_id)
    );
    
    Logger.info(`${expertDocsWithoutPresentations.length} expert documents have MP4 files without presentations`);
    
    if (expertDocsWithoutPresentations.length > 0) {
      Logger.info('\nSample expert documents for MP4 files without presentations:');
      const sampleSize = Math.min(10, expertDocsWithoutPresentations.length);
      for (let i = 0; i < sampleSize; i++) {
        const doc = expertDocsWithoutPresentations[i];
        const sourceName = doc.sources_google ? doc.sources_google.name : 'Unknown';
        Logger.info(`- ${sourceName} (doc ID: ${doc.id}, source ID: ${doc.source_id})`);
        Logger.info(`  Status: ${doc.status}, Created: ${new Date(doc.created_at).toLocaleString()}`);
      }
    }
    
    // Step 8: Check which MP4 files have completed expert documents but no presentations
    const expertDocsCompleted = expertDocuments.filter(doc => doc.status === 'completed');
    const completedExpertDocSourceIds = expertDocsCompleted.map(doc => doc.source_id);
    
    const mp4FilesWithCompletedDocsButNoPresentations = completedExpertDocSourceIds.filter(
      sourceId => !videoIdsWithPresentations.has(sourceId)
    );
    
    Logger.info(`\n${mp4FilesWithCompletedDocsButNoPresentations.length} MP4 files have completed expert documents but no presentations`);
    
    // Step 9: Check if these expert documents are associated with presentations via presentation_assets
    if (mp4FilesWithCompletedDocsButNoPresentations.length > 0) {
      // Get the expert document IDs for these MP4 files
      const expertDocIds = expertDocsCompleted
        .filter(doc => mp4FilesWithCompletedDocsButNoPresentations.includes(doc.source_id))
        .map(doc => doc.id);
      
      const { data: presentationAssets, error: assetsError } = await supabase
        .from('presentation_assets')
        .select('id, presentation_id, expert_document_id')
        .in('expert_document_id', expertDocIds);
      
      if (assetsError) {
        Logger.error(`Error fetching presentation assets: ${assetsError.message}`);
        process.exit(1);
      }
      
      Logger.info(`${presentationAssets?.length || 0} presentation_assets reference these expert documents`);
      
      if (presentationAssets && presentationAssets.length > 0) {
        // Get unique presentation IDs
        const presentationIds = [...new Set(presentationAssets.map(asset => asset.presentation_id))];
        
        Logger.info(`These assets are associated with ${presentationIds.length} unique presentations`);
        
        // Get these presentations to check if they have main_video_id
        const { data: linkedPresentations, error: linkedError } = await supabase
          .from('presentations')
          .select('id, title, main_video_id')
          .in('id', presentationIds);
        
        if (linkedError) {
          Logger.error(`Error fetching linked presentations: ${linkedError.message}`);
        } else if (linkedPresentations) {
          const presentationsWithoutMainVideoId = linkedPresentations.filter(p => !p.main_video_id);
          
          Logger.info(`${presentationsWithoutMainVideoId.length} of these presentations have NULL main_video_id`);
          
          if (presentationsWithoutMainVideoId.length > 0 && isVerbose) {
            Logger.debug('\nSample presentations with NULL main_video_id that have these expert documents:');
            const sampleSize = Math.min(5, presentationsWithoutMainVideoId.length);
            for (let i = 0; i < sampleSize; i++) {
              Logger.debug(`- ${presentationsWithoutMainVideoId[i].title} (${presentationsWithoutMainVideoId[i].id})`);
            }
          }
        }
      }
    }
    
    // Final summary
    Logger.info('\n=== Summary ===');
    Logger.info(`Total MP4 files in folder "${folderInfo.name}": ${mp4FilesInFolder.length}`);
    Logger.info(`MP4 files with expert documents: ${mp4FilesWithExpertDocsSet.size} (${coveragePercentage.toFixed(2)}%)`);
    Logger.info(`MP4 files without expert documents: ${mp4FilesWithoutExpertDocs.length}`);
    Logger.info(`Expert documents for MP4 files without presentations: ${expertDocsWithoutPresentations.length}`);
    Logger.info(`MP4 files with completed expert documents but no presentations: ${mp4FilesWithCompletedDocsButNoPresentations.length}`);
    
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