# Archived on 2025-04-11 - Original file used with sources_google table
#!/usr/bin/env ts-node
/**
 * Create Presentations from Expert Documents
 * 
 * This script creates presentations for MP4 files that have expert documents
 * but don't have associated presentations.
 * 
 * Usage:
 *   ts-node create-presentations-from-expert-docs.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be created without making changes
 *   --folder-id <id>   Specify a folder ID (default: Dynamic Healing Discussion Group)
 *   --verbose          Show detailed logs
 *   --limit <n>        Limit processing to n records (default: no limit)
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
const isDryRun = args.includes('--dry-run');
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

// Get limit if specified
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 && args[limitIndex + 1] ? parseInt(args[limitIndex + 1], 10) : undefined;

/**
 * Main function to create presentations from expert documents
 */
async function createPresentationsFromExpertDocs(): Promise<void> {
  console.log('=== Create Presentations from Expert Documents ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL CREATE'}`);
  console.log(`Folder ID: ${folderId}`);
  if (limit) console.log(`Limit: ${limit} records`);
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
    
    // Step 2: Get document type ID for "Video Summary Transcript"
    const { data: docTypeInfo, error: docTypeError } = await supabase
      .from('document_types')
      .select('id, document_type')
      .eq('document_type', 'Video Summary Transcript')
      .single();
    
    if (docTypeError) {
      Logger.error(`Error fetching document type: ${docTypeError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Document type "Video Summary Transcript" has ID: ${docTypeInfo.id}`);
    
    // Step 3: Get expert documents of type "Video Summary Transcript"
    let expertDocQuery = supabase
      .from('expert_documents')
      .select(`
        id, 
        source_id,
        status,
        created_at,
        updated_at,
        sources_google:source_id(
          id, 
          name, 
          parent_path, 
          mime_type, 
          modified_time
        )
      `)
      .eq('document_type_id', docTypeInfo.id);
    
    // Add limit if specified
    if (limit) {
      expertDocQuery = expertDocQuery.limit(limit);
    }
    
    const { data: expertDocuments, error: expertDocError } = await expertDocQuery;
    
    if (expertDocError) {
      Logger.error(`Error fetching expert documents: ${expertDocError.message}`);
      process.exit(1);
    }
    
    Logger.info(`Found ${expertDocuments?.length || 0} completed expert documents of type "Video Summary Transcript"`);
    
    // Step 4: Filter to only include expert documents for MP4 files in the specified folder
    const expertDocsInFolder = expertDocuments.filter(doc => {
      const source = doc.sources_google as any;
      if (!source) return false;
      
      // Check if parent_path contains the folder name
      if (source.parent_path && (
        source.parent_path.includes(folderInfo.name) || 
        source.parent_path.startsWith(folderInfo.name)
      )) {
        return true;
      }
      
      return false;
    });
    
    Logger.info(`${expertDocsInFolder.length} expert documents are for MP4 files in folder "${folderInfo.name}"`);
    
    // Step 5: Get existing presentations to check which MP4 files already have presentations
    const { data: existingPresentations, error: presentationError } = await supabase
      .from('presentations')
      .select('id, title, main_video_id')
      .not('main_video_id', 'is', null);
    
    if (presentationError) {
      Logger.error(`Error fetching existing presentations: ${presentationError.message}`);
      process.exit(1);
    }
    
    // Create a set of MP4 file IDs that already have presentations
    const existingVideoIds = new Set();
    if (existingPresentations) {
      existingPresentations.forEach(p => {
        if (p.main_video_id) {
          existingVideoIds.add(p.main_video_id);
        }
      });
    }
    
    Logger.info(`Found ${existingVideoIds.size} MP4 files that already have presentations`);
    
    // Step 6: Filter to only include expert documents for MP4 files that don't have presentations
    const expertDocsToProcess = expertDocsInFolder.filter(doc => 
      !existingVideoIds.has(doc.source_id)
    );
    
    Logger.info(`${expertDocsToProcess.length} expert documents are for MP4 files without presentations`);
    
    if (expertDocsToProcess.length === 0) {
      Logger.info('No expert documents to process. Exiting.');
      return;
    }
    
    // Step 7: Create presentations for these MP4 files
    if (isDryRun) {
      Logger.info('\nDRY RUN: Would create the following presentations:');
      expertDocsToProcess.forEach((doc, index) => {
        const source = doc.sources_google as any;
        if (!source) return;
        
        Logger.info(`${index + 1}. ${source.name} (${source.id})`);
        Logger.info(`   Expert Document: ${doc.id} (Created: ${new Date(doc.created_at).toLocaleDateString()})`);
      });
    } else {
      Logger.info('\nCreating presentations...');
      const createdCount = await createPresentations(supabase, expertDocsToProcess);
      Logger.info(`Successfully created ${createdCount} presentations with links to expert documents`);
    }
    
    // Final summary
    Logger.info('\n=== Summary ===');
    Logger.info(`Expert documents in folder: ${expertDocsInFolder.length}`);
    Logger.info(`Expert documents for MP4 files without presentations: ${expertDocsToProcess.length}`);
    if (!isDryRun) {
      Logger.info(`Presentations created: ${expertDocsToProcess.length}`);
    } else {
      Logger.info(`Would create ${expertDocsToProcess.length} presentations`);
    }
    
  } catch (error: any) {
    Logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Create presentations for MP4 files and link them to expert documents
 */
async function createPresentations(
  supabase: any, 
  expertDocs: any[]
): Promise<number> {
  let successCount = 0;
  
  for (let i = 0; i < expertDocs.length; i++) {
    const doc = expertDocs[i];
    const source = doc.sources_google as any;
    
    if (!source) {
      Logger.warn(`Skipping expert document ${doc.id} - No source information`);
      continue;
    }
    
    try {
      Logger.debug(`Processing expert document ${i + 1}/${expertDocs.length}: ${doc.id}`);
      
      // Extract useful metadata for the presentation
      const filePathParts = source.parent_path?.split('/') || [];
      const folderPath = filePathParts.join('/') || source.parent_path || '/';
      
      // Try to parse a date from the filename or path
      let recordedDate = null;
      const datePattern = /\d{1,2}[-\._]\d{1,2}[-\._]\d{2,4}|\d{4}[-\._]\d{1,2}[-\._]\d{1,2}/;
      const dateMatch = source.name.match(datePattern) || source.parent_path?.match(datePattern);
      
      if (dateMatch) {
        // Attempt to parse the date
        try {
          const dateStr = dateMatch[0].replace(/[-\._]/g, '-');
          recordedDate = new Date(dateStr).toISOString();
        } catch (e) {
          // If we can't parse the date, just use the file's modified time
          recordedDate = source.modified_time;
        }
      } else {
        // Use modified time as fallback
        recordedDate = source.modified_time;
      }
      
      // Try to extract a presenter name from the filename
      let presenterName = null;
      // Look for patterns like "Name.Topic" or similar
      const namePattern = /^([\w\s]+?)\./;
      const nameMatch = source.name.match(namePattern);
      
      if (nameMatch && nameMatch[1]) {
        presenterName = nameMatch[1].trim();
      }
      
      // Create presentation record
      const newPresentation = {
        main_video_id: source.id,
        filename: source.name,
        folder_path: folderPath,
        title: source.name.replace(/\.[^.]+$/, ''), // Remove file extension
        recorded_date: recordedDate,
        presenter_name: presenterName,
        is_public: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        transcript_status: 'completed' // Since we have a expert document
      };
      
      // Insert the presentation
      const { data: presentationData, error: presentationError } = await supabase
        .from('presentations')
        .insert(newPresentation)
        .select();
      
      if (presentationError) {
        Logger.error(`Error creating presentation for ${source.name}: ${presentationError.message}`);
        continue;
      }
      
      if (!presentationData || presentationData.length === 0) {
        Logger.error(`No presentation data returned for ${source.name}`);
        continue;
      }
      
      const presentationId = presentationData[0].id;
      Logger.info(`Created presentation for ${source.name} (ID: ${presentationId})`);
      
      // Create presentation_asset record linking to the expert document
      const newAsset = {
        presentation_id: presentationId,
        expert_document_id: doc.id,
        source_id: source.id,
        asset_type: 'transcript',
        asset_role: 'primary',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data: assetData, error: assetError } = await supabase
        .from('presentation_assets')
        .insert(newAsset)
        .select();
      
      if (assetError) {
        Logger.error(`Error creating presentation asset for ${source.name}: ${assetError.message}`);
        continue;
      }
      
      Logger.debug(`Created presentation asset linking presentation ${presentationId} to expert document ${doc.id}`);
      
      successCount++;
    } catch (error: any) {
      Logger.error(`Error processing expert document ${doc.id}: ${error.message}`);
    }
  }
  
  return successCount;
}

// Execute main function
createPresentationsFromExpertDocs().catch(error => {
  Logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});