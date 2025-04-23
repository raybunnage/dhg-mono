#!/usr/bin/env ts-node
/**
 * Sources Google Integrity Checker
 * 
 * This script checks the integrity of records in the sources_google table by
 * verifying that document_type_id assignments are consistent with file
 * attributes such as extension and mime_type.
 * 
 * Main checks:
 * 1. Files marked with folder document types that are not actually folders
 * 2. Folders marked with non-folder document types
 * 3. Files with document types that don't match their extension
 * 4. Files with document types that don't match their MIME type
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import * as fs from 'fs';
import * as path from 'path';
import type { Database } from '../../../supabase/types';

interface IntegrityCheckOptions {
  dryRun?: boolean;
  verbose?: boolean;
  limit?: number;
  fix?: boolean;
  output?: string;
  folderCheck?: boolean;
  extensionCheck?: boolean;
  mimeTypeCheck?: boolean;
  classifierCheck?: boolean;
  allChecks?: boolean;
  markForReprocessing?: boolean;
  docType?: 'docx' | 'pdf' | 'powerpoint';
}

// Type for document type metadata
interface DocumentTypeInfo {
  id: string;
  document_type: string;
  category: string;
  file_extension: string | null;
  mime_type: string | null;
}

// Type for file extension check results
interface FileExtensionCheckResult {
  total: number;
  docxCount: number;
  pdfCount: number;
  pptxCount: number;
}

// Extend the source_google record with expert_documents data
interface SourceRecord {
  id: string;
  name: string;
  document_type_id: string;
  mime_type?: string;
  expert_documents?: Array<{
    document_processing_status?: string;
  }>;
}

// Interface for mismatched file extension records
interface MismatchedExtensionFile {
  id: any;
  name: any;
  extension: string;
  docTypeId: any;
  docType: string;
  expectedExtensions: string[];
}

// Interface for mismatched MIME type records
interface MismatchedMimeTypeFile {
  id: any;
  name: any;
  mimeType: any;
  docTypeId: any;
  docType: string;
  expectedMimeTypes: string[];
}

// Type for integrity check results
interface IntegrityCheckResults {
  filesWithFolderTypes?: number;
  foldersWithNonFolderTypes?: number;
  filesWithIncorrectExtension?: number;
  filesWithIncorrectMimeType?: number;
  filesWithIncorrectClassifier?: FileExtensionCheckResult;
}

// Main function to check for files with folder document types
async function checkFilesWithFolderTypes(options: IntegrityCheckOptions = {}) {
  console.log('\n=== Checking for files with folder document types ===');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // First, get all folder document types to identify them
  const { data: folderDocTypes, error: folderTypesError } = await supabase
    .from('document_types')
    .select('id, document_type')
    .eq('category', 'folder');
    
  if (folderTypesError) {
    throw new Error(`Error fetching folder document types: ${folderTypesError.message}`);
  }
  
  if (!folderDocTypes || folderDocTypes.length === 0) {
    console.log('No folder document types found in database.');
    return 0;
  }
  
  console.log(`Found ${folderDocTypes.length} folder document types in database.`);
  
  // Extract the IDs and create a lookup map
  const folderTypeIds = folderDocTypes.map(t => t.id);
  const folderTypeMap = new Map(folderDocTypes.map(t => [t.id, t.document_type]));
  
  if (options.verbose) {
    console.log('Folder document types:');
    folderDocTypes.forEach(t => console.log(`- ${t.document_type} (${t.id})`));
  }
  
  // Find files (not folders) that have folder document types
  const { data, error } = await supabase
    .from('sources_google')
    .select('id, name, mime_type, document_type_id')
    .not('mime_type', 'eq', 'application/vnd.google-apps.folder')
    .in('document_type_id', folderTypeIds)
    .eq('is_deleted', false)
    .limit(options.limit || 1000);
    
  if (error) {
    throw new Error(`Error querying files with folder types: ${error.message}`);
  }
  
  const count = data?.length || 0;
  console.log(`Found ${count} files incorrectly marked with folder document types.`);
  
  if (count > 0 && options.verbose) {
    console.log('\nSample of incorrect records:');
    console.log('--------------------------------------------------------------------------------------------------------------------------------------');
    console.log('| ID                                   | Name                                                            | Document Type   | Processing Status  |');
    console.log('--------------------------------------------------------------------------------------------------------------------------------------');
    
    const showLimit = Math.min(count, 10);
    for (let i = 0; i < showLimit; i++) {
      const record = data![i];
      const id = record.id.padEnd(38);
      const name = (record.name || 'Unknown').substring(0, 60).padEnd(60);  // Increased from 55 to 60
      const docType = folderTypeMap.get(record.document_type_id) || 'Unknown folder type';
      const docTypeStr = docType.substring(0, 15).padEnd(15);
      
      // Get processing status from expert_documents separately
      let processingStatus = 'none'.padEnd(18);
      try {
        const { data: docStatus } = await supabase
          .from('expert_documents')
          .select('document_processing_status')
          .eq('source_id', record.id)
          .limit(1);
        
        if (docStatus && docStatus.length > 0 && docStatus[0].document_processing_status) {
          processingStatus = docStatus[0].document_processing_status.substring(0, 18).padEnd(18);
        }
      } catch (error) {
        // If there's an error fetching processing status, just use the default
        console.log(`Error fetching processing status for ${record.id}: ${error}`);
      }
      
      console.log(`| ${id} | ${name} | ${docTypeStr} | ${processingStatus} |`);
    }
    
    if (count > 10) {
      console.log(`... and ${count - 10} more records.`);
    }
    
    console.log('----------------------------------------------------------------------------------');
  }
  
  // Fix records if requested
  if (options.fix && count > 0) {
    console.log(`Fixing ${count} incorrectly marked files...`);
    
    // Find a generic document type to use instead
    const { data: genericTypes } = await supabase
      .from('document_types')
      .select('id, document_type')
      .not('category', 'eq', 'folder')
      .or('document_type.ilike.%document%,document_type.ilike.%file%')
      .limit(1);
    
    if (!genericTypes || genericTypes.length === 0) {
      console.log('No suitable generic document type found. Cannot fix records.');
      return count;
    }
    
    const genericTypeId = genericTypes[0].id;
    console.log(`Will use "${genericTypes[0].document_type}" as replacement document type.`);
    
    if (!options.dryRun) {
      // Update the records in batches
      const batchSize = 50;
      let updatedCount = 0;
      
      for (let i = 0; i < data!.length; i += batchSize) {
        const batch = data!.slice(i, i + batchSize);
        const batchIds = batch.map(r => r.id);
        
        const { error: updateError } = await supabase
          .from('sources_google')
          .update({ document_type_id: genericTypeId })
          .in('id', batchIds);
          
        if (updateError) {
          console.error(`Error updating batch ${i}-${i + batch.length}: ${updateError.message}`);
        } else {
          updatedCount += batch.length;
          console.log(`Updated ${batch.length} records (total: ${updatedCount}/${count})`);
        }
      }
      
      console.log(`✅ Fixed ${updatedCount} records with incorrect folder type`);
    } else {
      console.log(`[DRY RUN] Would fix ${count} records with incorrect folder type`);
    }
  }
  
  return count;
}

// Main function to check for folders with non-folder document types
async function checkFoldersWithNonFolderTypes(options: IntegrityCheckOptions = {}) {
  console.log('\n=== Checking for folders with non-folder document types ===');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // First, get all folder document types
  const { data: folderDocTypes, error: folderTypesError } = await supabase
    .from('document_types')
    .select('id')
    .eq('category', 'folder');
    
  if (folderTypesError) {
    throw new Error(`Error fetching folder document types: ${folderTypesError.message}`);
  }
  
  // Extract the folder type IDs
  const folderTypeIds = (folderDocTypes || []).map(t => t.id);
  
  // Get all document types for lookup
  const { data: allDocTypes, error: allTypesError } = await supabase
    .from('document_types')
    .select('id, document_type');
    
  if (allTypesError) {
    throw new Error(`Error fetching all document types: ${allTypesError.message}`);
  }
  
  // Create a lookup map for document type names
  const docTypeMap = new Map((allDocTypes || []).map(t => [t.id, t.document_type]));
  
  // Find folders with non-folder document types
  const { data, error } = await supabase
    .from('sources_google')
    .select('id, name, document_type_id')
    .eq('mime_type', 'application/vnd.google-apps.folder')
    .not('document_type_id', 'in', `(${folderTypeIds.join(',')})`)
    .eq('is_deleted', false)
    .limit(options.limit || 1000);
    
  if (error) {
    throw new Error(`Error querying folders with non-folder types: ${error.message}`);
  }
  
  const count = data?.length || 0;
  console.log(`Found ${count} folders incorrectly marked with non-folder document types.`);
  
  if (count > 0 && options.verbose) {
    console.log('\nSample of incorrect records:');
    console.log('--------------------------------------------------------------------------------------------------------------------------------------');
    console.log('| ID                                   | Folder Name                                                      | Document Type   | Processing Status  |');
    console.log('--------------------------------------------------------------------------------------------------------------------------------------');
    
    const showLimit = Math.min(count, 10);
    for (let i = 0; i < showLimit; i++) {
      const record = data![i];
      const id = record.id.substring(0, 36).padEnd(38);
      const name = (record.name || 'Unknown').substring(0, 60).padEnd(60);
      const docType = docTypeMap.get(record.document_type_id) || 'Unknown';
      const docTypeStr = docType.substring(0, 15).padEnd(15);
      
      // Get processing status from expert_documents separately
      let processingStatus = 'none'.padEnd(18);
      try {
        const { data: docStatus } = await supabase
          .from('expert_documents')
          .select('document_processing_status')
          .eq('source_id', record.id)
          .limit(1);
        
        if (docStatus && docStatus.length > 0 && docStatus[0].document_processing_status) {
          processingStatus = docStatus[0].document_processing_status.substring(0, 18).padEnd(18);
        }
      } catch (error) {
        // If there's an error fetching processing status, just use the default
        console.log(`Error fetching processing status for ${record.id}: ${error}`);
      }
      
      console.log(`| ${id} | ${name} | ${docTypeStr} | ${processingStatus} |`);
    }
    
    if (count > 10) {
      console.log(`... and ${count - 10} more records.`);
    }
    
    console.log('----------------------------------------------------------------------------------');
  }
  
  // Fix records if requested
  if (options.fix && count > 0) {
    console.log(`Fixing ${count} incorrectly marked folders...`);
    
    // Check if we have at least one folder type to use
    if (folderTypeIds.length === 0) {
      console.log('No folder document types found. Cannot fix records.');
      return count;
    }
    
    // Use the first folder type as the generic folder type
    const genericFolderTypeId = folderTypeIds[0];
    console.log(`Will use "${docTypeMap.get(genericFolderTypeId) || 'Unknown folder type'}" as replacement.`);
    
    if (!options.dryRun) {
      // Update the records in batches
      const batchSize = 50;
      let updatedCount = 0;
      
      for (let i = 0; i < data!.length; i += batchSize) {
        const batch = data!.slice(i, i + batchSize);
        const batchIds = batch.map(r => r.id);
        
        const { error: updateError } = await supabase
          .from('sources_google')
          .update({ document_type_id: genericFolderTypeId })
          .in('id', batchIds);
          
        if (updateError) {
          console.error(`Error updating batch ${i}-${i + batch.length}: ${updateError.message}`);
        } else {
          updatedCount += batch.length;
          console.log(`Updated ${batch.length} records (total: ${updatedCount}/${count})`);
        }
      }
      
      console.log(`✅ Fixed ${updatedCount} folders with incorrect document type`);
    } else {
      console.log(`[DRY RUN] Would fix ${count} folders with incorrect document type`);
    }
  }
  
  return count;
}

// Function to extract file extension from name
function getFileExtension(fileName: string): string | null {
  if (!fileName) return null;
  
  const match = fileName.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : null;
}

// Function to check files with document types that don't match their extension
async function checkFileExtensionConsistency(options: IntegrityCheckOptions = {}) {
  console.log('\n=== Checking for files with document types that don\'t match their extension ===');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get all document types with their file_extension field
  const { data: docTypes, error: docTypesError } = await supabase
    .from('document_types')
    .select('id, document_type, category, file_extension, mime_type')
    .not('file_extension', 'is', null)
    .order('document_type');
    
  if (docTypesError) {
    throw new Error(`Error fetching document types: ${docTypesError.message}`);
  }
  
  if (!docTypes || docTypes.length === 0) {
    console.log('No document types with file extension information found in database.');
    return 0;
  }
  
  // Create extension to document type mappings
  const extensionToDocTypes = new Map<string, DocumentTypeInfo[]>();
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
    
    // Skip document types without file_extension
    if (!dt.file_extension) return;
    
    // Split extensions if multiple are specified (comma-separated)
    const extensions = dt.file_extension.split(',').map((ext: string) => ext.trim().toLowerCase());
    
    // Map each extension to this document type
    extensions.forEach((ext: string) => {
      if (!extensionToDocTypes.has(ext)) {
        extensionToDocTypes.set(ext, []);
      }
      extensionToDocTypes.get(ext)!.push(docTypeInfo);
    });
  });
  
  if (options.verbose) {
    console.log(`Found ${docTypes.length} document types with extension information.`);
    console.log(`Mapped ${extensionToDocTypes.size} unique file extensions to document types.`);
  }
  
  // Get files from sources_google that have document_type_id
  const { data, error } = await supabase
    .from('sources_google')
    .select('id, name, document_type_id')
    .not('document_type_id', 'is', null)
    .not('mime_type', 'eq', 'application/vnd.google-apps.folder') // Exclude folders
    .eq('is_deleted', false)
    .limit(options.limit || 1000);
    
  if (error) {
    throw new Error(`Error querying files: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    console.log('No files with document types found in database.');
    return 0;
  }
  
  // Check each file if its extension matches the expected extensions for its document type
  const mismatchedFiles = data
    .map(file => {
      const extension = getFileExtension(file.name || '');
      const docType = docTypeMap.get(file.document_type_id);
      
      // Skip files without extension or document type
      if (!extension || !docType || !docType.file_extension) return null;
      
      // Check if document type has multiple extensions
      const expectedExtensions = docType.file_extension.split(',').map(ext => ext.trim().toLowerCase());
      
      // If extension doesn't match, report it
      if (!expectedExtensions.includes(extension)) {
        return {
          id: file.id,
          name: file.name,
          extension,
          docTypeId: file.document_type_id,
          docType: docType.document_type,
          expectedExtensions
        } as MismatchedExtensionFile;
      }
      
      return null;
    })
    .filter(Boolean) as MismatchedExtensionFile[];
  
  const count = mismatchedFiles.length;
  console.log(`Found ${count} files with document types that don't match their file extension.`);
  
  if (count > 0 && options.verbose) {
    console.log('\nSample of files with mismatched extensions:');
    console.log('---------------------------------------------------------------------------------------------------------------------------------------------------');
    console.log('| ID                                   | Name                                                            | Extension | Document Type   | Expected Ext  | Processing Status  |');
    console.log('---------------------------------------------------------------------------------------------------------------------------------------------------');
    
    const showLimit = Math.min(count, 10);
    for (let i = 0; i < showLimit; i++) {
      const record = mismatchedFiles[i]!;
      const id = record.id.padEnd(38);
      const name = (record.name || 'Unknown').substring(0, 60).padEnd(60);
      const extension = (record.extension || '').padEnd(9);
      const docType = record.docType.substring(0, 15).padEnd(15);
      const expected = record.expectedExtensions.join(',').substring(0, 12).padEnd(12);
      
      // Get processing status from expert_documents separately
      let processingStatus = 'none'.padEnd(18);
      try {
        const { data: docStatus } = await supabase
          .from('expert_documents')
          .select('document_processing_status')
          .eq('source_id', record.id)
          .limit(1);
        
        if (docStatus && docStatus.length > 0 && docStatus[0].document_processing_status) {
          processingStatus = docStatus[0].document_processing_status.substring(0, 18).padEnd(18);
        }
      } catch (error) {
        // If there's an error fetching processing status, just use the default
        console.log(`Error fetching processing status for ${record.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      console.log(`| ${id} | ${name} | ${extension} | ${docType} | ${expected} | ${processingStatus} |`);
    }
    
    if (count > 10) {
      console.log(`... and ${count - 10} more records.`);
    }
    
    console.log('-------------------------------------------------------------------------------------------------------');
  }
  
  // Fix records if requested
  if (options.fix && count > 0) {
    console.log(`Fixing ${count} files with mismatched document types...`);
    
    if (!options.dryRun) {
      // Update the records in batches
      const batchSize = 50;
      let updatedCount = 0;
      
      for (let i = 0; i < mismatchedFiles.length; i += batchSize) {
        const batch = mismatchedFiles.slice(i, i + batchSize);
        
        // Process each file in the batch individually to assign the appropriate document type
        for (const file of batch) {
          if (!file) continue;
          
          // Find the appropriate document type for this file's extension
          const matchingDocTypes = extensionToDocTypes.get(file.extension) || [];
          if (matchingDocTypes.length === 0) {
            console.log(`No document type found for extension ${file.extension} - skipping ${file.name}`);
            continue;
          }
          
          // Choose the first non-folder document type as the replacement
          const newDocType = matchingDocTypes.find(dt => dt.category !== 'folder') || matchingDocTypes[0];
          
          // Update the record
          const { error: updateError } = await supabase
            .from('sources_google')
            .update({ document_type_id: newDocType.id })
            .eq('id', file.id);
            
          if (updateError) {
            console.error(`Error updating ${file.name}: ${updateError.message}`);
          } else {
            updatedCount++;
            if (options.verbose) {
              console.log(`Updated ${file.name} from "${file.docType}" to "${newDocType.document_type}"`);
            }
          }
        }
        
        console.log(`Updated ${updatedCount}/${count} files`);
      }
      
      console.log(`✅ Fixed ${updatedCount} files with mismatched document types`);
    } else {
      console.log(`[DRY RUN] Would fix ${count} files with mismatched document types`);
    }
  }
  
  return count;
}

// Function to check files with document types that don't match their MIME type
async function checkMimeTypeConsistency(options: IntegrityCheckOptions = {}) {
  console.log('\n=== Checking for files with document types that don\'t match their MIME type ===');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get all document types with their mime_type field
  const { data: docTypes, error: docTypesError } = await supabase
    .from('document_types')
    .select('id, document_type, category, file_extension, mime_type')
    .not('mime_type', 'is', null)
    .order('document_type');
    
  if (docTypesError) {
    throw new Error(`Error fetching document types: ${docTypesError.message}`);
  }
  
  if (!docTypes || docTypes.length === 0) {
    console.log('No document types with MIME type information found in database.');
    return 0;
  }
  
  // Create MIME type to document type mappings
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
    
    // Skip document types without mime_type
    if (!dt.mime_type) return;
    
    // Split MIME types if multiple are specified (comma-separated)
    const mimeTypes = dt.mime_type.split(',').map((mime: string) => mime.trim().toLowerCase());
    
    // Map each MIME type to this document type
    mimeTypes.forEach((mime: string) => {
      if (!mimeToDocTypes.has(mime)) {
        mimeToDocTypes.set(mime, []);
      }
      mimeToDocTypes.get(mime)!.push(docTypeInfo);
    });
  });
  
  if (options.verbose) {
    console.log(`Found ${docTypes.length} document types with MIME type information.`);
    console.log(`Mapped ${mimeToDocTypes.size} unique MIME types to document types.`);
  }
  
  // Get files from sources_google that have document_type_id and mime_type
  const { data, error } = await supabase
    .from('sources_google')
    .select('id, name, mime_type, document_type_id')
    .not('document_type_id', 'is', null)
    .not('mime_type', 'is', null)
    .eq('is_deleted', false)
    .limit(options.limit || 1000);
    
  if (error) {
    throw new Error(`Error querying files: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    console.log('No files with document types and MIME types found in database.');
    return 0;
  }
  
  // Check each file if its MIME type matches the expected MIME types for its document type
  const mismatchedFiles = data
    .map(file => {
      const docType = docTypeMap.get(file.document_type_id);
      
      // Skip files without MIME type or document type
      if (!file.mime_type || !docType || !docType.mime_type) return null;
      
      // Check if document type has multiple MIME types
      const expectedMimeTypes = docType.mime_type.split(',').map(mime => mime.trim().toLowerCase());
      
      // If MIME type doesn't match, report it
      if (!expectedMimeTypes.includes(file.mime_type.toLowerCase())) {
        return {
          id: file.id,
          name: file.name,
          mimeType: file.mime_type,
          docTypeId: file.document_type_id,
          docType: docType.document_type,
          expectedMimeTypes
        } as MismatchedMimeTypeFile;
      }
      
      return null;
    })
    .filter(Boolean) as MismatchedMimeTypeFile[];
  
  const count = mismatchedFiles.length;
  console.log(`Found ${count} files with document types that don't match their MIME type.`);
  
  if (count > 0 && options.verbose) {
    console.log('\nSample of files with mismatched MIME types:');
    console.log('-----------------------------------------------------------------------------------------------------------------------------------------------------------');
    console.log('| ID                                   | Name                                                            | MIME Type              | Document Type   | Expected MIME  | Processing Status  |');
    console.log('-----------------------------------------------------------------------------------------------------------------------------------------------------------');
    
    const showLimit = Math.min(count, 10);
    for (let i = 0; i < showLimit; i++) {
      const record = mismatchedFiles[i]!;
      const id = record.id.padEnd(38);
      const name = (record.name || 'Unknown').substring(0, 60).padEnd(60);
      const mimeType = (record.mimeType || '').substring(0, 22).padEnd(22);
      const docType = record.docType.substring(0, 15).padEnd(15);
      const expected = record.expectedMimeTypes.join(',').substring(0, 12).padEnd(12);
      
      // Get processing status from expert_documents separately
      let processingStatus = 'none'.padEnd(18);
      try {
        const { data: docStatus } = await supabase
          .from('expert_documents')
          .select('document_processing_status')
          .eq('source_id', record.id)
          .limit(1);
        
        if (docStatus && docStatus.length > 0 && docStatus[0].document_processing_status) {
          processingStatus = docStatus[0].document_processing_status.substring(0, 18).padEnd(18);
        }
      } catch (error) {
        // If there's an error fetching processing status, just use the default
        console.log(`Error fetching processing status for ${record.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      console.log(`| ${id} | ${name} | ${mimeType} | ${docType} | ${expected} | ${processingStatus} |`);
    }
    
    if (count > 10) {
      console.log(`... and ${count - 10} more records.`);
    }
    
    console.log('--------------------------------------------------------------------------------------------------------------');
  }
  
  // Fix records if requested
  if (options.fix && count > 0) {
    console.log(`Fixing ${count} files with mismatched MIME types...`);
    
    if (!options.dryRun) {
      // Update the records in batches
      const batchSize = 50;
      let updatedCount = 0;
      
      for (let i = 0; i < mismatchedFiles.length; i += batchSize) {
        const batch = mismatchedFiles.slice(i, i + batchSize);
        
        // Process each file in the batch individually to assign the appropriate document type
        for (const file of batch) {
          if (!file) continue;
          
          // Find the appropriate document type for this file's MIME type
          const matchingDocTypes = mimeToDocTypes.get(file.mimeType.toLowerCase()) || [];
          if (matchingDocTypes.length === 0) {
            console.log(`No document type found for MIME type ${file.mimeType} - skipping ${file.name}`);
            continue;
          }
          
          // Choose the first non-folder document type as the replacement
          const newDocType = matchingDocTypes.find(dt => dt.category !== 'folder') || matchingDocTypes[0];
          
          // Update the record
          const { error: updateError } = await supabase
            .from('sources_google')
            .update({ document_type_id: newDocType.id })
            .eq('id', file.id);
            
          if (updateError) {
            console.error(`Error updating ${file.name}: ${updateError.message}`);
          } else {
            updatedCount++;
            if (options.verbose) {
              console.log(`Updated ${file.name} from "${file.docType}" to "${newDocType.document_type}"`);
            }
          }
        }
        
        console.log(`Updated ${updatedCount}/${count} files`);
      }
      
      console.log(`✅ Fixed ${updatedCount} files with mismatched MIME types`);
    } else {
      console.log(`[DRY RUN] Would fix ${count} files with mismatched MIME types`);
    }
  }
  
  return count;
}

// Function to check if files with specific extensions have proper document types
async function checkFileExtensionTypeMatching(options: IntegrityCheckOptions = {}) {
  console.log('\n=== Checking file extensions against document type classifiers ===');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get document types matching each classifier
  console.log('Fetching document type classifiers...');
  
  // Get document types for DOCX/TXT files
  const { data: docxTypes, error: docxError } = await supabase
    .from('document_types')
    .select('id, category, document_type, description, mime_type, file_extension')
    .eq('classifier', 'docx');
    
  if (docxError) {
    throw new Error(`Error fetching DOCX document types: ${docxError.message}`);
  }
  
  // Get document types for PDF files
  const { data: pdfTypes, error: pdfError } = await supabase
    .from('document_types')
    .select('id, category, document_type, description, mime_type, file_extension')
    .eq('classifier', 'pdf');
    
  if (pdfError) {
    throw new Error(`Error fetching PDF document types: ${pdfError.message}`);
  }
  
  // Get document types for PowerPoint files
  const { data: powerPointTypes, error: powerPointError } = await supabase
    .from('document_types')
    .select('id, category, document_type, description, mime_type, file_extension')
    .eq('classifier', 'powerpoint');
    
  if (powerPointError) {
    throw new Error(`Error fetching PowerPoint document types: ${powerPointError.message}`);
  }
  
  if (options.verbose) {
    console.log(`Found ${docxTypes?.length || 0} DOCX/TXT document types`);
    console.log(`Found ${pdfTypes?.length || 0} PDF document types`);
    console.log(`Found ${powerPointTypes?.length || 0} PowerPoint document types`);
  }
  
  // Create sets of document type IDs for each classifier
  const docxTypeIds = new Set((docxTypes || []).map(dt => dt.id));
  const pdfTypeIds = new Set((pdfTypes || []).map(dt => dt.id));
  const powerPointTypeIds = new Set((powerPointTypes || []).map(dt => dt.id));
  
  // Get document type lookup maps for later use
  const docTypeMap = new Map<string, DocumentTypeInfo>();
  [...(docxTypes || []), ...(pdfTypes || []), ...(powerPointTypes || [])].forEach(dt => {
    docTypeMap.set(dt.id, {
      id: dt.id,
      document_type: dt.document_type,
      category: dt.category,
      file_extension: dt.file_extension,
      mime_type: dt.mime_type
    });
  });
  
  // Fetch sources_google records with document types and file extensions
  console.log('Checking sources_google records for file extension mismatches...');
  
  // Get files that end with .txt or .docx
  const { data: docxFiles, error: docxFilesError } = await supabase
    .from('sources_google')
    .select('id, name, document_type_id')
    .not('document_type_id', 'is', null)
    .not('is_deleted', 'eq', true)
    .or('name.ilike.%.txt,name.ilike.%.docx')
    .limit(options.limit || 1000);
    
  if (docxFilesError) {
    throw new Error(`Error fetching .txt/.docx files: ${docxFilesError.message}`);
  }
  
  // Get files that end with .pdf
  const { data: pdfFiles, error: pdfFilesError } = await supabase
    .from('sources_google')
    .select('id, name, document_type_id')
    .not('document_type_id', 'is', null)
    .not('is_deleted', 'eq', true)
    .ilike('name', '%.pdf')
    .limit(options.limit || 1000);
    
  if (pdfFilesError) {
    throw new Error(`Error fetching .pdf files: ${pdfFilesError.message}`);
  }
  
  // Get files that end with .pptx
  const { data: pptxFiles, error: pptxFilesError } = await supabase
    .from('sources_google')
    .select('id, name, document_type_id')
    .not('document_type_id', 'is', null)
    .not('is_deleted', 'eq', true)
    .ilike('name', '%.pptx')
    .limit(options.limit || 1000);
    
  if (pptxFilesError) {
    throw new Error(`Error fetching .pptx files: ${pptxFilesError.message}`);
  }
  
  // Check each file type against its appropriate document type
  const mismatchedDocxFiles = (docxFiles || []).filter(file => 
    !docxTypeIds.has(file.document_type_id)
  );
  
  const mismatchedPdfFiles = (pdfFiles || []).filter(file => 
    !pdfTypeIds.has(file.document_type_id)
  );
  
  const mismatchedPptxFiles = (pptxFiles || []).filter(file => 
    !powerPointTypeIds.has(file.document_type_id)
  );
  
  // Combine all mismatched files
  const allMismatchedFiles = [
    ...mismatchedDocxFiles.map(file => ({ ...file, expectedType: 'docx' })),
    ...mismatchedPdfFiles.map(file => ({ ...file, expectedType: 'pdf' })),
    ...mismatchedPptxFiles.map(file => ({ ...file, expectedType: 'powerpoint' }))
  ];
  
  const count = allMismatchedFiles.length;
  console.log(`Found ${count} files with document types that don't match their file extension.`);
  
  // Mark files for reprocessing if requested
  if (count > 0 && options.markForReprocessing) {
    // Filter mismatched files by docType if specified
    let filesToReprocess = [...allMismatchedFiles];
    if (options.docType) {
      switch (options.docType) {
        case 'docx':
          filesToReprocess = mismatchedDocxFiles.map(file => ({...file, expectedType: 'docx'}));
          console.log(`\nFiltering to only reprocess DOCX/TXT files...`);
          break;
        case 'pdf':
          filesToReprocess = mismatchedPdfFiles.map(file => ({...file, expectedType: 'pdf'}));
          console.log(`\nFiltering to only reprocess PDF files...`);
          break;
        case 'powerpoint':
          filesToReprocess = mismatchedPptxFiles.map(file => ({...file, expectedType: 'powerpoint'}));
          console.log(`\nFiltering to only reprocess PowerPoint files...`);
          break;
      }
    }
    
    console.log(`\nMarking ${filesToReprocess.length} files for reprocessing...`);
    
    if (!options.dryRun) {
      // Get all file IDs
      const fileIds = filesToReprocess.map(file => file.id);
      
      // Update records in batches
      const batchSize = 50;
      let updatedCount = 0;
      const now = new Date().toISOString();
      
      for (let i = 0; i < fileIds.length; i += batchSize) {
        const batchIds = fileIds.slice(i, i + batchSize);
        
        // First, find the corresponding expert_documents records for these sources_google entries
        const { data: expertDocuments, error: expertDocsError } = await supabase
          .from('expert_documents')
          .select('id, source_id')
          .in('source_id', batchIds);
          
        if (expertDocsError) {
          console.error(`Error finding expert_documents: ${expertDocsError.message}`);
          continue;
        }
        
        if (!expertDocuments || expertDocuments.length === 0) {
          console.log(`No expert_documents found for these sources - skipping batch`);
          continue;
        }
        
        const expertDocIds = expertDocuments.map(doc => doc.id);
        
        // Update the expert_documents records
        const { error: updateError, count: batchUpdated } = await supabase
          .from('expert_documents')
          .update({ 
            document_processing_status: 'needs_reprocessing',
            document_processing_status_updated_at: now
          })
          .in('id', expertDocIds);
          
        if (updateError) {
          console.error(`Error updating batch ${i}-${i + batchIds.length}: ${updateError.message}`);
        } else {
          updatedCount += expertDocIds.length;
          console.log(`Updated ${expertDocIds.length} expert documents (total: ${updatedCount}/${filesToReprocess.length})`);
        }
      }
      
      console.log(`✅ Marked ${updatedCount} files for reprocessing`);
    } else {
      console.log(`[DRY RUN] Would mark ${filesToReprocess.length} files for reprocessing`);
    }
  }
  
  if (count > 0 && options.verbose) {
    // Display separate tables for each file type
    
    // Table for DOCX/TXT files
    const docxMismatches = mismatchedDocxFiles.map(file => ({
      ...file,
      expectedType: 'docx'
    }));
    
    if (docxMismatches.length > 0) {
      console.log('\nDOCX/TXT files with mismatched document types:');
      console.log('-----------------------------------------------------------------------------------------------------------------------------------------');
      console.log('| ID                                   | Name                                                            | Current Doc Type    | Processing Status  |');
      console.log('-----------------------------------------------------------------------------------------------------------------------------------------');
      
      // Show all records without limit
      for (let i = 0; i < docxMismatches.length; i++) {
        const record = docxMismatches[i];
        const id = record.id.padEnd(38);
        const name = (record.name || 'Unknown').substring(0, 60).padEnd(60);
        const docType = docTypeMap.get(record.document_type_id)?.document_type || 'Unknown';
        const currentDocType = docType.substring(0, 20).padEnd(20);
        
        // Get processing status from expert_documents separately
        let processingStatus = 'none'.padEnd(18);
        try {
          const { data: docStatus } = await supabase
            .from('expert_documents')
            .select('document_processing_status')
            .eq('source_id', record.id)
            .limit(1);
          
          if (docStatus && docStatus.length > 0 && docStatus[0].document_processing_status) {
            processingStatus = docStatus[0].document_processing_status.substring(0, 18).padEnd(18);
          }
        } catch (error) {
          // If there's an error fetching processing status, just use the default
          if (options.verbose) {
            console.log(`Error fetching processing status for ${record.id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        console.log(`| ${id} | ${name} | ${currentDocType} | ${processingStatus} |`);
      }
      
      console.log('-------------------------------------------------------------------------------------------------------------------');
    } else {
      console.log('\nNo DOCX/TXT files with mismatched document types found.');
    }
    
    // Table for PDF files
    const pdfMismatches = mismatchedPdfFiles.map(file => ({
      ...file,
      expectedType: 'pdf'
    }));
    
    if (pdfMismatches.length > 0) {
      console.log('\nPDF files with mismatched document types:');
      console.log('-----------------------------------------------------------------------------------------------------------------------------------------');
      console.log('| ID                                   | Name                                                            | Current Doc Type    | Processing Status  |');
      console.log('-----------------------------------------------------------------------------------------------------------------------------------------');
      
      // Show all records without limit
      for (let i = 0; i < pdfMismatches.length; i++) {
        const record = pdfMismatches[i];
        const id = record.id.padEnd(38);
        const name = (record.name || 'Unknown').substring(0, 60).padEnd(60);
        const docType = docTypeMap.get(record.document_type_id)?.document_type || 'Unknown';
        const currentDocType = docType.substring(0, 20).padEnd(20);
        
        // Get processing status from expert_documents separately
        let processingStatus = 'none'.padEnd(18);
        try {
          const { data: docStatus } = await supabase
            .from('expert_documents')
            .select('document_processing_status')
            .eq('source_id', record.id)
            .limit(1);
          
          if (docStatus && docStatus.length > 0 && docStatus[0].document_processing_status) {
            processingStatus = docStatus[0].document_processing_status.substring(0, 18).padEnd(18);
          }
        } catch (error) {
          // If there's an error fetching processing status, just use the default
          if (options.verbose) {
            console.log(`Error fetching processing status for ${record.id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        console.log(`| ${id} | ${name} | ${currentDocType} | ${processingStatus} |`);
      }
      
      console.log('-------------------------------------------------------------------------------------------------------------------');
    } else {
      console.log('\nNo PDF files with mismatched document types found.');
    }
    
    // Table for PPTX files
    const pptxMismatches = mismatchedPptxFiles.map(file => ({
      ...file,
      expectedType: 'powerpoint'
    }));
    
    if (pptxMismatches.length > 0) {
      console.log('\nPowerPoint files with mismatched document types:');
      console.log('-----------------------------------------------------------------------------------------------------------------------------------------');
      console.log('| ID                                   | Name                                                            | Current Doc Type    | Processing Status  |');
      console.log('-----------------------------------------------------------------------------------------------------------------------------------------');
      
      // Show all records without limit
      for (let i = 0; i < pptxMismatches.length; i++) {
        const record = pptxMismatches[i];
        const id = record.id.padEnd(38);
        const name = (record.name || 'Unknown').substring(0, 60).padEnd(60);
        const docType = docTypeMap.get(record.document_type_id)?.document_type || 'Unknown';
        const currentDocType = docType.substring(0, 20).padEnd(20);
        
        // Get processing status from expert_documents separately
        let processingStatus = 'none'.padEnd(18);
        try {
          const { data: docStatus } = await supabase
            .from('expert_documents')
            .select('document_processing_status')
            .eq('source_id', record.id)
            .limit(1);
          
          if (docStatus && docStatus.length > 0 && docStatus[0].document_processing_status) {
            processingStatus = docStatus[0].document_processing_status.substring(0, 18).padEnd(18);
          }
        } catch (error) {
          // If there's an error fetching processing status, just use the default
          if (options.verbose) {
            console.log(`Error fetching processing status for ${record.id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        console.log(`| ${id} | ${name} | ${currentDocType} | ${processingStatus} |`);
      }
      
      console.log('-------------------------------------------------------------------------------------------------------------------');
    } else {
      console.log('\nNo PowerPoint files with mismatched document types found.');
    }
    
    // Combined summary for all file types
    console.log('\nSummary of all mismatched files:');
    console.log(`- DOCX/TXT files: ${docxMismatches.length}`);
    console.log(`- PDF files: ${pdfMismatches.length}`);
    console.log(`- PowerPoint files: ${pptxMismatches.length}`);
    console.log(`- Total: ${count} files`);
  }
  
  // Fix records if requested
  if (options.fix && count > 0) {
    console.log(`Fixing ${count} files with mismatched document types...`);
    
    if (!options.dryRun) {
      // Update the records in batches
      const batchSize = 50;
      let updatedCount = 0;
      
      // Process each mismatched file type separately
      // DOCX/TXT files
      if (mismatchedDocxFiles.length > 0) {
        // Find a suitable replacement document type
        const replacementType = docxTypes?.[0];
        if (!replacementType) {
          console.log('No suitable DOCX document type found. Cannot fix DOCX records.');
        } else {
          console.log(`Will use "${replacementType.document_type}" for DOCX/TXT files.`);
          
          // Process in batches
          for (let i = 0; i < mismatchedDocxFiles.length; i += batchSize) {
            const batch = mismatchedDocxFiles.slice(i, i + batchSize);
            const batchIds = batch.map(r => r.id);
            
            const { error: updateError } = await supabase
              .from('sources_google')
              .update({ document_type_id: replacementType.id })
              .in('id', batchIds);
              
            if (updateError) {
              console.error(`Error updating DOCX batch ${i}-${i + batch.length}: ${updateError.message}`);
            } else {
              updatedCount += batch.length;
              console.log(`Updated ${batch.length} DOCX/TXT files`);
            }
          }
        }
      }
      
      // PDF files
      if (mismatchedPdfFiles.length > 0) {
        // Find a suitable replacement document type
        const replacementType = pdfTypes?.[0];
        if (!replacementType) {
          console.log('No suitable PDF document type found. Cannot fix PDF records.');
        } else {
          console.log(`Will use "${replacementType.document_type}" for PDF files.`);
          
          // Process in batches
          for (let i = 0; i < mismatchedPdfFiles.length; i += batchSize) {
            const batch = mismatchedPdfFiles.slice(i, i + batchSize);
            const batchIds = batch.map(r => r.id);
            
            const { error: updateError } = await supabase
              .from('sources_google')
              .update({ document_type_id: replacementType.id })
              .in('id', batchIds);
              
            if (updateError) {
              console.error(`Error updating PDF batch ${i}-${i + batch.length}: ${updateError.message}`);
            } else {
              updatedCount += batch.length;
              console.log(`Updated ${batch.length} PDF files`);
            }
          }
        }
      }
      
      // PPTX files
      if (mismatchedPptxFiles.length > 0) {
        // Find a suitable replacement document type
        const replacementType = powerPointTypes?.[0];
        if (!replacementType) {
          console.log('No suitable PowerPoint document type found. Cannot fix PPTX records.');
        } else {
          console.log(`Will use "${replacementType.document_type}" for PPTX files.`);
          
          // Process in batches
          for (let i = 0; i < mismatchedPptxFiles.length; i += batchSize) {
            const batch = mismatchedPptxFiles.slice(i, i + batchSize);
            const batchIds = batch.map(r => r.id);
            
            const { error: updateError } = await supabase
              .from('sources_google')
              .update({ document_type_id: replacementType.id })
              .in('id', batchIds);
              
            if (updateError) {
              console.error(`Error updating PPTX batch ${i}-${i + batch.length}: ${updateError.message}`);
            } else {
              updatedCount += batch.length;
              console.log(`Updated ${batch.length} PPTX files`);
            }
          }
        }
      }
      
      console.log(`✅ Fixed ${updatedCount} files with mismatched document types`);
    } else {
      console.log(`[DRY RUN] Would fix ${count} files with mismatched document types`);
    }
  }
  
  return {
    total: count,
    docxCount: mismatchedDocxFiles.length,
    pdfCount: mismatchedPdfFiles.length,
    pptxCount: mismatchedPptxFiles.length
  } as FileExtensionCheckResult;
}

// Main function to run integrity checks
async function checkSourcesGoogleIntegrity(options: IntegrityCheckOptions = {}) {
  console.log('=== Sources Google Integrity Check ===');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (options.limit) {
    console.log(`Limit: ${options.limit} records per check`);
  }
  
  // Process allChecks option
  if (options.allChecks) {
    options.folderCheck = true;
    options.extensionCheck = true;
    options.mimeTypeCheck = true;
    options.classifierCheck = true;
  }
  
  let trackingId: string | undefined;
  try {
    // Start command tracking
    trackingId = await commandTrackingService.startTracking('google_sync', 'sources-google-integrity');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  try {
    // Test Supabase connection
    console.log('\nTesting Supabase connection...');
    const connectionTest = await SupabaseClientService.getInstance().testConnection();
    
    if (!connectionTest.success) {
      throw new Error(`Supabase connection test failed: ${connectionTest.error}`);
    }
    
    console.log('✅ Supabase connection test successful');
    
    // Initialize results
    const results: IntegrityCheckResults = {};
    
    // Run folder-related checks
    if (options.folderCheck !== false) {
      // Check files with folder document types
      results.filesWithFolderTypes = await checkFilesWithFolderTypes(options);
      
      // Check folders with non-folder document types
      results.foldersWithNonFolderTypes = await checkFoldersWithNonFolderTypes(options);
    }
    
    // Run extension check if requested
    if (options.extensionCheck) {
      results.filesWithIncorrectExtension = await checkFileExtensionConsistency(options);
    }
    
    // Run MIME type check if requested
    if (options.mimeTypeCheck) {
      results.filesWithIncorrectMimeType = await checkMimeTypeConsistency(options);
    }
    
    // Check file extensions against document type classifiers
    // This is a new check that specifically verifies that .txt/.docx, .pdf, and .pptx files
    // have document types with the correct classifier
    if (options.classifierCheck !== false) {
      const checkResult = await checkFileExtensionTypeMatching(options);
      results.filesWithIncorrectClassifier = checkResult;
    }
    
    // Print summary
    console.log('\n=== Integrity Check Summary ===');
    console.log('-----------------------------------------------------');
    
    if ('filesWithFolderTypes' in results) {
      console.log(`Files with folder document types: ${results.filesWithFolderTypes}`);
    }
    
    if ('foldersWithNonFolderTypes' in results) {
      console.log(`Folders with non-folder document types: ${results.foldersWithNonFolderTypes}`);
    }
    
    if ('filesWithIncorrectExtension' in results) {
      console.log(`Files with incorrect extensions: ${results.filesWithIncorrectExtension}`);
    }
    
    if ('filesWithIncorrectMimeType' in results) {
      console.log(`Files with incorrect MIME types: ${results.filesWithIncorrectMimeType}`);
    }
    
    if ('filesWithIncorrectClassifier' in results && results.filesWithIncorrectClassifier) {
      console.log(`Files with incorrect classifier: ${results.filesWithIncorrectClassifier.total}`);
      
      if (options.markForReprocessing) {
        // Get the count of files marked for reprocessing based on docType filter
        let reprocessCount = results.filesWithIncorrectClassifier.total;
        
        if (options.docType) {
          console.log(`Files with incorrect ${options.docType} classifier: ${
            options.docType === 'docx' ? results.filesWithIncorrectClassifier.docxCount : 
            options.docType === 'pdf' ? results.filesWithIncorrectClassifier.pdfCount : 
            options.docType === 'powerpoint' ? results.filesWithIncorrectClassifier.pptxCount : 0
          }`);
          
          reprocessCount = 
            options.docType === 'docx' ? results.filesWithIncorrectClassifier.docxCount : 
            options.docType === 'pdf' ? results.filesWithIncorrectClassifier.pdfCount : 
            options.docType === 'powerpoint' ? results.filesWithIncorrectClassifier.pptxCount : 0;
        }
        
        if (options.dryRun) {
          console.log(`[DRY RUN] Would mark ${reprocessCount} files for reprocessing`);
        } else {
          console.log(`Marked ${reprocessCount} files for reprocessing`);
        }
      }
    }
    
    console.log('-----------------------------------------------------');
    
    // Generate output file if requested
    if (options.output) {
      const outputData = {
        timestamp: new Date().toISOString(),
        results
      };
      
      fs.writeFileSync(options.output, JSON.stringify(outputData, null, 2));
      console.log(`\nResults written to ${options.output}`);
    }
    
    // Complete tracking
    if (trackingId) {
      // Calculate total issues, handling both number values and nested objects
      let totalIssues = 0;
      
      if (results.filesWithFolderTypes) totalIssues += results.filesWithFolderTypes;
      if (results.foldersWithNonFolderTypes) totalIssues += results.foldersWithNonFolderTypes;
      if (results.filesWithIncorrectExtension) totalIssues += results.filesWithIncorrectExtension;
      if (results.filesWithIncorrectMimeType) totalIssues += results.filesWithIncorrectMimeType;
      if (results.filesWithIncorrectClassifier) totalIssues += results.filesWithIncorrectClassifier.total;
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: totalIssues,
        summary: `Found ${totalIssues} integrity issues in sources_google`
      });
    }
    
    console.log('\nIntegrity check complete!');
  } catch (error) {
    // Log error and complete tracking with failure
    console.error(`Error during integrity check: ${error instanceof Error ? error.message : String(error)}`);
    
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
  .name('sources-google-integrity')
  .description('Check integrity of sources_google records')
  .option('--dry-run', 'Show only results without making changes', true)
  .option('--execute', 'Actually execute changes (opposite of --dry-run)', false)
  .option('--fix', 'Fix issues automatically when possible', false)
  .option('--verbose', 'Show detailed information', false)
  .option('--limit <number>', 'Limit number of records to check per test', '1000')
  .option('--output <path>', 'Path to write JSON results')
  .option('--folder-check', 'Check folder-related issues', true)
  .option('--extension-check', 'Check file extension vs document type consistency', false)
  .option('--mime-type-check', 'Check MIME type vs document type consistency', false)
  .option('--classifier-check', 'Check file extensions (.docx, .pdf, .pptx) against proper document type classifiers', true)
  .option('--all-checks', 'Run all available checks', false)
  .option('--mark-for-reprocessing', 'Set document_processing_status to "needs_reprocessing" for mismatched files', false)
  .option('--doc-type <type>', 'Filter by document type (docx, pdf, or powerpoint)')
  .action(async (options) => {
    // Validate doc-type if provided
    if (options.docType && !['docx', 'pdf', 'powerpoint'].includes(options.docType)) {
      console.error(`Error: --doc-type must be one of: docx, pdf, powerpoint`);
      process.exit(1);
    }
    
    await checkSourcesGoogleIntegrity({
      dryRun: options.execute ? false : options.dryRun !== false,
      verbose: options.verbose,
      limit: options.limit ? parseInt(options.limit, 10) : undefined,
      fix: options.fix,
      output: options.output,
      folderCheck: options.folderCheck,
      extensionCheck: options.extensionCheck,
      mimeTypeCheck: options.mimeTypeCheck,
      classifierCheck: options.classifierCheck,
      allChecks: options.allChecks,
      markForReprocessing: options.markForReprocessing,
      docType: options.docType
    });
  });

// Execute directly if this script is run directly (not imported)
if (require.main === module) {
  program.parse(process.argv);
}

// Export for module usage
export { checkSourcesGoogleIntegrity };