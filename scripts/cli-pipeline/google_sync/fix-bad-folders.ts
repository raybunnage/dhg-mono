#!/usr/bin/env ts-node
/**
 * Fix Bad Folders Command
 * 
 * This script fixes files incorrectly marked with folder document types by
 * analyzing their extension and mime type to determine the correct document type.
 * 
 * It addresses issues identified by the sources-google-integrity check.
 * 
 * It also checks expert_documents with folder document types and updates them
 * based on the corresponding sources_google document_type_id.
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import { v4 as uuidv4 } from 'uuid';
import type { Database } from '../../../supabase/types';

interface FixBadFoldersOptions {
  dryRun?: boolean;
  verbose?: boolean;
  limit?: number;
}

// Define folder document type IDs (based on sources-google-integrity output)
const FOLDER_DOCUMENT_TYPE_IDS = [
  '0d61a685-10e0-4c82-b964-60b88b02ac15', // root folder
  'bd903d99-64a1-4297-ba76-1094ab235dac', // high level folder
  'dd6a2cea-c74a-4c6d-8d30-eb20d2c70ddd', // low level folder
  '82e32985-c8f9-418e-9687-cbd2617af308'  // drive
];

// IDs that need to be fixed in expert_documents
const EXPERT_DOCS_FOLDER_IDS = [
  'bd903d99-64a1-4297-ba76-1094ab235dac', // high level folder
  'dd6a2cea-c74a-4c6d-8d30-eb20d2c70ddd', // low level folder
  '0d61a685-10e0-4c82-b964-60b88b02ac15'  // root folder
];

// Type for document type metadata
interface DocumentTypeInfo {
  id: string;
  document_type: string;
  category: string;
  file_extension: string | null;
  mime_type: string | null;
}

// Function to extract file extension from name
function getFileExtension(fileName: string): string | null {
  if (!fileName) return null;
  
  const match = fileName.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : null;
}

// Main function to fix files incorrectly marked with folder document types
async function fixFilesWithFolderTypes(options: FixBadFoldersOptions = {}): Promise<number> {
  console.log('\n=== Fixing files incorrectly marked with folder document types ===');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Test Supabase connection
  console.log('Testing Supabase connection...');
  const connectionTest = await SupabaseClientService.getInstance().testConnection();
  
  if (!connectionTest.success) {
    throw new Error(`Supabase connection test failed: ${connectionTest.error}`);
  }
  
  console.log('✅ Supabase connection test successful');
  
  // 1. First, find files that are incorrectly marked with folder document types
  const { data: badFiles, error: badFilesError } = await supabase
    .from('google_sources')
    .select('id, name, mime_type, document_type_id')
    .not('mime_type', 'eq', 'application/vnd.google-apps.folder')
    .in('document_type_id', FOLDER_DOCUMENT_TYPE_IDS)
    .eq('is_deleted', false)
    .limit(options.limit || 1000);
    
  if (badFilesError) {
    throw new Error(`Error querying files with folder types: ${badFilesError.message}`);
  }
  
  const fileCount = badFiles?.length || 0;
  console.log(`Found ${fileCount} files incorrectly marked with folder document types.`);
  
  if (fileCount === 0) {
    console.log('No files to fix in sources_google. Checking expert_documents...');
  }
  
  // 2. Get all document types with their file_extension and mime_type fields
  const { data: docTypes, error: docTypesError } = await supabase
    .from('document_types')
    .select('id, document_type, category, file_extension, mime_type')
    .not('category', 'eq', 'folder')
    .order('document_type');
    
  if (docTypesError) {
    throw new Error(`Error fetching document types: ${docTypesError.message}`);
  }
  
  if (!docTypes || docTypes.length === 0) {
    console.log('No document types found in database. Unable to fix files.');
    return 0;
  }
  
  console.log(`Found ${docTypes.length} document types to use for classification.`);
  
  // 3. Create extension and mime type mappings
  const extensionToDocTypes = new Map<string, DocumentTypeInfo[]>();
  const mimeToDocTypes = new Map<string, DocumentTypeInfo[]>();
  const docTypeMap = new Map<string, DocumentTypeInfo>();
  
  docTypes.forEach(dt => {
    const docTypeInfo: DocumentTypeInfo = {
      id: dt.id,
      document_type: dt.document_type,
      category: dt.category,
      file_extension: dt.file_extension,
      mime_type: dt.mime_type
    };
    
    // Store document type by ID for lookup
    docTypeMap.set(dt.id, docTypeInfo);
    
    // Map extensions if available
    if (dt.file_extension) {
      const extensions = dt.file_extension.split(',').map((ext: string) => ext.trim().toLowerCase());
      
      extensions.forEach((ext: string) => {
        if (!extensionToDocTypes.has(ext)) {
          extensionToDocTypes.set(ext, []);
        }
        extensionToDocTypes.get(ext)!.push(docTypeInfo);
      });
    }
    
    // Map mime types if available
    if (dt.mime_type) {
      const mimeTypes = dt.mime_type.split(',').map((mime: string) => mime.trim().toLowerCase());
      
      mimeTypes.forEach((mime: string) => {
        if (!mimeToDocTypes.has(mime)) {
          mimeToDocTypes.set(mime, []);
        }
        mimeToDocTypes.get(mime)!.push(docTypeInfo);
      });
    }
  });
  
  if (options.verbose) {
    console.log(`Created mappings for ${extensionToDocTypes.size} file extensions and ${mimeToDocTypes.size} MIME types.`);
  }
  
  // 4. Process each bad file and determine the best document type
  let fixedCount = 0;
  let skippedCount = 0;
  const results = [];
  
  for (const file of badFiles!) {
    const fileName = file.name || '';
    const mimeType = (file.mime_type || '').toLowerCase();
    const extension = getFileExtension(fileName);
    const currentDocTypeId = file.document_type_id;
    let newDocTypeId: string | null = null;
    let matchMethod = '';
    
    // Try to find a matching document type based on extension first
    if (extension && extensionToDocTypes.has(extension)) {
      const matchingTypes = extensionToDocTypes.get(extension)!;
      // Prefer non-folder document types
      const nonFolderType = matchingTypes.find(dt => dt.category !== 'folder');
      if (nonFolderType) {
        newDocTypeId = nonFolderType.id;
        matchMethod = 'extension';
      } else if (matchingTypes.length > 0) {
        newDocTypeId = matchingTypes[0].id;
        matchMethod = 'extension';
      }
    }
    
    // If no match by extension, try mime type
    if (!newDocTypeId && mimeType && mimeToDocTypes.has(mimeType)) {
      const matchingTypes = mimeToDocTypes.get(mimeType)!;
      // Prefer non-folder document types
      const nonFolderType = matchingTypes.find(dt => dt.category !== 'folder');
      if (nonFolderType) {
        newDocTypeId = nonFolderType.id;
        matchMethod = 'mime_type';
      } else if (matchingTypes.length > 0) {
        newDocTypeId = matchingTypes[0].id;
        matchMethod = 'mime_type';
      }
    }
    
    // If still no match, find a generic document type
    if (!newDocTypeId) {
      // Find a generic document type like "document" or "file"
      const genericType = docTypes.find(dt => 
        ['document', 'file'].includes(dt.document_type.toLowerCase()) &&
        dt.category !== 'folder'
      );
      
      if (genericType) {
        newDocTypeId = genericType.id;
        matchMethod = 'generic';
      } else {
        // If all else fails, use the first non-folder document type
        const firstNonFolder = docTypes.find(dt => dt.category !== 'folder');
        if (firstNonFolder) {
          newDocTypeId = firstNonFolder.id;
          matchMethod = 'fallback';
        }
      }
    }
    
    if (!newDocTypeId) {
      console.log(`⚠️ Could not find a suitable document type for: ${fileName}`);
      skippedCount++;
      continue;
    }
    
    // Store result for verbose output and updates
    const result = {
      id: file.id,
      name: fileName,
      extension: extension || 'none',
      mime_type: mimeType || 'unknown',
      old_document_type_id: currentDocTypeId,
      old_document_type: docTypeMap.get(currentDocTypeId!)?.document_type || 'Unknown',
      new_document_type_id: newDocTypeId,
      new_document_type: docTypeMap.get(newDocTypeId)?.document_type || 'Unknown',
      match_method: matchMethod
    };
    
    results.push(result);
    
    // Update the record if not in dry-run mode
    if (!options.dryRun) {
      const { error: updateError } = await supabase
        .from('google_sources')
        .update({ document_type_id: newDocTypeId })
        .eq('id', file.id);
        
      if (updateError) {
        console.error(`Error updating ${fileName}: ${updateError.message}`);
        skippedCount++;
      } else {
        fixedCount++;
        if (options.verbose) {
          console.log(`✅ Updated ${fileName} from "${result.old_document_type}" to "${result.new_document_type}" (matched by ${matchMethod})`);
        }
      }
    } else {
      fixedCount++; // Count as fixed in dry-run mode
    }
  }
  
  // 5. Print summary
  if (options.verbose && results.length > 0) {
    console.log('\nDetailed results:');
    console.log('-----------------------------------------------------------------------------------');
    console.log('| File Name              | Extension | Old Document Type | New Document Type | Method  |');
    console.log('-----------------------------------------------------------------------------------');
    
    const showLimit = Math.min(results.length, 10);
    for (let i = 0; i < showLimit; i++) {
      const r = results[i];
      const name = r.name.substring(0, 20).padEnd(22);
      const ext = r.extension.substring(0, 8).padEnd(10);
      const oldType = r.old_document_type.substring(0, 16).padEnd(18);
      const newType = r.new_document_type.substring(0, 16).padEnd(18);
      const method = r.match_method.substring(0, 7).padEnd(7);
      
      console.log(`| ${name} | ${ext} | ${oldType} | ${newType} | ${method} |`);
    }
    
    if (results.length > 10) {
      console.log(`... and ${results.length - 10} more files`);
    }
    
    console.log('-----------------------------------------------------------------------------------');
  }
  
  if (options.dryRun) {
    console.log(`[DRY RUN] Would update ${fixedCount} files with correct document types (${skippedCount} would be skipped).`);
  } else {
    console.log(`✅ Fixed ${fixedCount} files with correct document types (${skippedCount} skipped).`);
  }
  
  return fixedCount;
}

// Function to fix expert_documents with folder document types
async function fixExpertDocumentsWithFolderTypes(options: FixBadFoldersOptions = {}): Promise<number> {
  console.log('\n=== Checking expert_documents with folder document types ===');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get expert_documents with folder document types
  const { data: expertDocsWithFolderTypes, error: expertDocsError } = await supabase
    .from('google_expert_documents')
    .select('id, document_type_id, source_id')
    .in('document_type_id', EXPERT_DOCS_FOLDER_IDS)
    .limit(options.limit || 1000);
  
  if (expertDocsError) {
    throw new Error(`Error querying expert_documents with folder types: ${expertDocsError.message}`);
  }
  
  const expertDocsCount = expertDocsWithFolderTypes?.length || 0;
  console.log(`Found ${expertDocsCount} expert_documents with folder document types.`);
  
  if (expertDocsCount === 0) {
    console.log('No expert_documents to fix. Exiting.');
    return 0;
  }
  
  let updatedCount = 0;
  let skippedCount = 0;
  const results = [];
  
  // Process each expert_document
  for (const expertDoc of expertDocsWithFolderTypes!) {
    // Get the corresponding sources_google record document_type_id
    const { data: sourceData, error: sourceError } = await supabase
      .from('google_sources')
      .select('id, document_type_id, name')
      .eq('id', expertDoc.source_id)
      .single();
    
    if (sourceError || !sourceData) {
      console.log(`⚠️ Could not find sources_google record for expert_document ${expertDoc.id} with source_id ${expertDoc.source_id}`);
      skippedCount++;
      continue;
    }
    
    // Skip if sources_google also has a folder document type or same document type
    if (
      FOLDER_DOCUMENT_TYPE_IDS.includes(sourceData.document_type_id) || 
      sourceData.document_type_id === expertDoc.document_type_id
    ) {
      if (options.verbose) {
        console.log(`⚠️ Skipping expert_document ${expertDoc.id} because sources_google record also has a folder document type or same document type`);
      }
      skippedCount++;
      continue;
    }
    
    // Store result for tracking
    const result = {
      id: expertDoc.id,
      source_id: expertDoc.source_id,
      source_name: sourceData.name,
      old_document_type_id: expertDoc.document_type_id,
      new_document_type_id: sourceData.document_type_id
    };
    
    results.push(result);
    
    // Update the expert_document
    if (!options.dryRun) {
      const now = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from('google_expert_documents')
        .update({
          document_type_id: sourceData.document_type_id,
          document_processing_status: 'needs_reprocessing',
          document_processing_status_updated_at: now
        })
        .eq('id', expertDoc.id);
      
      if (updateError) {
        console.error(`Error updating expert_document ${expertDoc.id}: ${updateError.message}`);
        skippedCount++;
      } else {
        updatedCount++;
        if (options.verbose) {
          console.log(`✅ Updated expert_document ${expertDoc.id} from folder document type to correct document type from sources_google`);
        }
      }
    } else {
      updatedCount++; // Count as updated in dry-run mode
    }
  }
  
  // Print summary of expert_documents updates
  if (options.verbose && results.length > 0) {
    console.log('\nDetailed expert_documents results:');
    console.log('----------------------------------------------------------------------');
    console.log('| Expert Document ID                     | Source Name                |');
    console.log('----------------------------------------------------------------------');
    
    const showLimit = Math.min(results.length, 10);
    for (let i = 0; i < showLimit; i++) {
      const r = results[i];
      const id = r.id.padEnd(40);
      const name = (r.source_name || '').substring(0, 25).padEnd(26);
      
      console.log(`| ${id} | ${name} |`);
    }
    
    if (results.length > 10) {
      console.log(`... and ${results.length - 10} more expert documents`);
    }
    
    console.log('----------------------------------------------------------------------');
  }
  
  if (options.dryRun) {
    console.log(`[DRY RUN] Would update ${updatedCount} expert_documents (${skippedCount} would be skipped).`);
  } else {
    console.log(`✅ Updated ${updatedCount} expert_documents with correct document types (${skippedCount} skipped).`);
  }
  
  return updatedCount;
}

// Main function to run the command
async function runFixBadFolders(options: FixBadFoldersOptions = {}): Promise<void> {
  console.log('=== Fix Bad Folders Command ===');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (options.limit) {
    console.log(`Limit: ${options.limit} records`);
  }
  
  let trackingId: string | undefined;
  try {
    // Start command tracking
    trackingId = await commandTrackingService.startTracking('google_sync', 'fix-bad-folders');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  try {
    // Fix files with folder document types in sources_google
    const fixedCount = await fixFilesWithFolderTypes(options);
    
    // Fix expert_documents with folder document types
    const expertDocsFixedCount = await fixExpertDocumentsWithFolderTypes(options);
    
    // Complete tracking
    if (trackingId) {
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: fixedCount + expertDocsFixedCount,
        summary: `Fixed ${fixedCount} files in sources_google and ${expertDocsFixedCount} expert_documents with incorrect folder document types`
      });
    }
    
    console.log('\nFix bad folders command complete!');
  } catch (error) {
    // Log error and complete tracking with failure
    console.error(`Error during fix bad folders operation: ${error instanceof Error ? error.message : String(error)}`);
    
    if (trackingId) {
      await commandTrackingService.failTracking(
        trackingId,
        `Command failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    
    process.exit(1);
  }
}

// Set up CLI
const program = new Command();

program
  .name('fix-bad-folders')
  .description('Fix files incorrectly marked with folder document types by assigning appropriate document types based on file extension and MIME type')
  .option('--dry-run', 'Show only results without making changes', false)
  .option('--verbose', 'Show detailed information', false)
  .option('--limit <number>', 'Limit number of records to process', '1000')
  .action(async (options) => {
    await runFixBadFolders({
      dryRun: options.dryRun,
      verbose: options.verbose,
      limit: options.limit ? parseInt(options.limit, 10) : undefined,
    });
  });

// Execute directly if this script is run directly (not imported)
if (require.main === module) {
  program.parse(process.argv);
}

// Export for module usage
export { runFixBadFolders };