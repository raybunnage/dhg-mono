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
 * 3. File extensions vs document types (e.g. .pdf files should have PDF document types)
 * 4. MIME types vs document types
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import * as fs from 'fs';
import * as path from 'path';

interface IntegrityCheckOptions {
  dryRun?: boolean;
  verbose?: boolean;
  limit?: number;
  fix?: boolean;
  output?: string;
  folderCheck?: boolean;
  extensionCheck?: boolean;
  mimeTypeCheck?: boolean;
}

// Get document types from database
async function getDocumentTypes() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  const { data, error } = await supabase
    .from('document_types')
    .select('id, document_type, document_category');
    
  if (error) {
    throw new Error(`Error fetching document types: ${error.message}`);
  }
  
  return data || [];
}

// Check for files with folder document types
async function checkFilesWithFolderTypes(options: IntegrityCheckOptions) {
  console.log('\n=== Checking for files with folder document types ===');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // First, get document types in the "folder" category
  const { data: documentTypes, error: documentTypesError } = await supabase
    .from('document_types')
    .select('id, document_type')
    .eq('document_category', 'folder');
    
  if (documentTypesError) {
    throw new Error(`Error fetching folder document types: ${documentTypesError.message}`);
  }
  
  if (!documentTypes || documentTypes.length === 0) {
    console.log('No folder document types found in the database.');
    return { errorRecords: [], count: 0 };
  }
  
  const folderTypeIds = documentTypes.map(type => type.id);
  console.log(`Found ${folderTypeIds.length} folder document types.`);
  
  // Query for files (non-folders) that have folder document types
  let query = supabase
    .from('sources_google')
    .select('id, name, mime_type, document_type_id, document_types(document_type)')
    .not('mime_type', 'eq', 'application/vnd.google-apps.folder')
    .in('document_type_id', folderTypeIds)
    .eq('is_deleted', false);
    
  if (options.limit) {
    query = query.limit(options.limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Error querying files with folder types: ${error.message}`);
  }
  
  const count = data?.length || 0;
  
  console.log(`Found ${count} files incorrectly marked with folder document types.`);
  
  if (count > 0 && options.verbose) {
    console.log('\nSample of incorrect records:');
    console.log('----------------------------------------------------------------------------------');
    console.log('| ID                                   | Name                  | Document Type   |');
    console.log('----------------------------------------------------------------------------------');
    
    const showLimit = Math.min(count, 10);
    for (let i = 0; i < showLimit; i++) {
      const record = data![i];
      const id = record.id.substring(0, 36).padEnd(38);
      const name = (record.name || 'Unknown').substring(0, 20).padEnd(20);
      const docType = record.document_types?.document_type || 'Unknown';
      const docTypeStr = docType.substring(0, 15).padEnd(15);
      
      console.log(`| ${id} | ${name} | ${docTypeStr} |`);
    }
    
    if (count > 10) {
      console.log(`... and ${count - 10} more records.`);
    }
    
    console.log('----------------------------------------------------------------------------------');
  }
  
  // If fix option is enabled, update these records
  if (options.fix && count > 0) {
    console.log(`\nFixing ${count} records...`);
    
    // For fixing, we need to determine an appropriate document type based on the file extension
    // First, get non-folder document types
    const { data: nonFolderTypes, error: nonFolderTypesError } = await supabase
      .from('document_types')
      .select('id, document_type')
      .not('document_category', 'eq', 'folder');
      
    if (nonFolderTypesError) {
      throw new Error(`Error fetching non-folder document types: ${nonFolderTypesError.message}`);
    }
    
    // Find a generic document type to use
    let genericDocumentTypeId = nonFolderTypes?.find(type => 
      type.document_type.toLowerCase().includes('document') || 
      type.document_type.toLowerCase().includes('file'))?.id;
      
    if (!genericDocumentTypeId) {
      console.log('No generic document type found. Cannot fix the records.');
      return { errorRecords: data || [], count };
    }
    
    // For each incorrect record, update it to the generic document type
    let updatedCount = 0;
    
    for (const record of data || []) {
      const { error: updateError } = await supabase
        .from('sources_google')
        .update({ document_type_id: genericDocumentTypeId })
        .eq('id', record.id);
        
      if (updateError) {
        console.error(`Error updating record ${record.id}: ${updateError.message}`);
      } else {
        updatedCount++;
      }
    }
    
    console.log(`Updated ${updatedCount} records to generic document type.`);
  }
  
  return { errorRecords: data || [], count };
}

// Check for folders with non-folder document types
async function checkFoldersWithNonFolderTypes(options: IntegrityCheckOptions) {
  console.log('\n=== Checking for folders with non-folder document types ===');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // First, get document types NOT in the "folder" category
  const { data: documentTypes, error: documentTypesError } = await supabase
    .from('document_types')
    .select('id, document_type, document_category')
    .not('document_category', 'eq', 'folder');
    
  if (documentTypesError) {
    throw new Error(`Error fetching non-folder document types: ${documentTypesError.message}`);
  }
  
  if (!documentTypes || documentTypes.length === 0) {
    console.log('No non-folder document types found in the database.');
    return { errorRecords: [], count: 0 };
  }
  
  const nonFolderTypeIds = documentTypes.map(type => type.id);
  
  // Query for folders that have non-folder document types
  let query = supabase
    .from('sources_google')
    .select('id, name, mime_type, document_type_id, document_types(document_type, document_category)')
    .eq('mime_type', 'application/vnd.google-apps.folder')
    .in('document_type_id', nonFolderTypeIds)
    .eq('is_deleted', false);
    
  if (options.limit) {
    query = query.limit(options.limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Error querying folders with non-folder types: ${error.message}`);
  }
  
  const count = data?.length || 0;
  
  console.log(`Found ${count} folders incorrectly marked with non-folder document types.`);
  
  if (count > 0 && options.verbose) {
    console.log('\nSample of incorrect records:');
    console.log('----------------------------------------------------------------------------------');
    console.log('| ID                                   | Name                  | Document Type   |');
    console.log('----------------------------------------------------------------------------------');
    
    const showLimit = Math.min(count, 10);
    for (let i = 0; i < showLimit; i++) {
      const record = data![i];
      const id = record.id.substring(0, 36).padEnd(38);
      const name = (record.name || 'Unknown').substring(0, 20).padEnd(20);
      const docType = record.document_types?.document_type || 'Unknown';
      const docTypeStr = docType.substring(0, 15).padEnd(15);
      
      console.log(`| ${id} | ${name} | ${docTypeStr} |`);
    }
    
    if (count > 10) {
      console.log(`... and ${count - 10} more records.`);
    }
    
    console.log('----------------------------------------------------------------------------------');
  }
  
  // If fix option is enabled, update these records
  if (options.fix && count > 0) {
    console.log(`\nFixing ${count} records...`);
    
    // Find a generic folder document type
    const { data: folderTypes, error: folderTypesError } = await supabase
      .from('document_types')
      .select('id, document_type')
      .eq('document_category', 'folder');
      
    if (folderTypesError) {
      throw new Error(`Error fetching folder document types: ${folderTypesError.message}`);
    }
    
    const genericFolderTypeId = folderTypes?.find(type => 
      type.document_type.toLowerCase().includes('folder'))?.id;
      
    if (!genericFolderTypeId) {
      console.log('No generic folder type found. Cannot fix the records.');
      return { errorRecords: data || [], count };
    }
    
    // For each incorrect record, update it to the generic folder type
    let updatedCount = 0;
    
    for (const record of data || []) {
      const { error: updateError } = await supabase
        .from('sources_google')
        .update({ document_type_id: genericFolderTypeId })
        .eq('id', record.id);
        
      if (updateError) {
        console.error(`Error updating record ${record.id}: ${updateError.message}`);
      } else {
        updatedCount++;
      }
    }
    
    console.log(`Updated ${updatedCount} records to generic folder type.`);
  }
  
  return { errorRecords: data || [], count };
}

// Check for extension mismatches with document types
async function checkExtensionDocTypeConsistency(options: IntegrityCheckOptions) {
  console.log('\n=== Checking file extensions vs document types ===');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Define expected document type categories for common extensions
  const extensionToCategory: Record<string, string[]> = {
    'pdf': ['pdf'],
    'docx': ['document'],
    'doc': ['document'],
    'txt': ['document', 'text'],
    'mp4': ['video'],
    'mp3': ['audio'],
    'jpg': ['image', 'photo'],
    'jpeg': ['image', 'photo'],
    'png': ['image', 'photo'],
    'pptx': ['presentation'],
    'ppt': ['presentation'],
    'xlsx': ['spreadsheet'],
    'xls': ['spreadsheet']
  };
  
  // Get all document types with their categories
  const { data: documentTypes, error: documentTypesError } = await supabase
    .from('document_types')
    .select('id, document_type, document_category');
    
  if (documentTypesError) {
    throw new Error(`Error fetching document types: ${documentTypesError.message}`);
  }
  
  // Create maps for lookup
  const docTypeIdToType = new Map();
  const docTypeIdToCategory = new Map();
  
  for (const type of documentTypes || []) {
    docTypeIdToType.set(type.id, type.document_type);
    docTypeIdToCategory.set(type.id, type.document_category);
  }
  
  // Query for files with extensions we can check
  const extensionList = Object.keys(extensionToCategory);
  const extensionClause = extensionList.map(ext => `name.ilike.%.${ext}`).join(',');
  
  let query = supabase
    .from('sources_google')
    .select('id, name, document_type_id, mime_type')
    .or(extensionClause)
    .eq('is_deleted', false);
    
  if (options.limit) {
    query = query.limit(options.limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Error querying files with extensions: ${error.message}`);
  }
  
  console.log(`Checking ${data?.length || 0} files with known extensions.`);
  
  // Check each file for consistency
  const inconsistentRecords = [];
  
  for (const record of data || []) {
    // Extract extension from filename
    const parts = record.name.split('.');
    if (parts.length < 2) continue;
    
    const extension = parts[parts.length - 1].toLowerCase();
    if (!extensionToCategory[extension]) continue;
    
    const expectedCategories = extensionToCategory[extension];
    const actualCategory = docTypeIdToCategory.get(record.document_type_id)?.toLowerCase();
    
    if (!actualCategory) {
      // No document type assigned
      inconsistentRecords.push({
        ...record,
        issue: 'Missing document type',
        expectedCategories,
        actualCategory: null
      });
      continue;
    }
    
    // Check if the actual category matches any of the expected categories
    const isConsistent = expectedCategories.some(cat => 
      actualCategory.includes(cat) || cat.includes(actualCategory));
      
    if (!isConsistent) {
      inconsistentRecords.push({
        ...record,
        issue: 'Inconsistent document type',
        expectedCategories,
        actualCategory,
        actualDocType: docTypeIdToType.get(record.document_type_id)
      });
    }
  }
  
  console.log(`Found ${inconsistentRecords.length} files with inconsistent document types.`);
  
  if (inconsistentRecords.length > 0 && options.verbose) {
    console.log('\nSample of inconsistent records:');
    console.log('-------------------------------------------------------------------------------------------------------------------');
    console.log('| Name                         | Extension | Actual Doc Type              | Expected Categories         | Issue    |');
    console.log('-------------------------------------------------------------------------------------------------------------------');
    
    const showLimit = Math.min(inconsistentRecords.length, 10);
    for (let i = 0; i < showLimit; i++) {
      const record = inconsistentRecords[i];
      const parts = record.name.split('.');
      const extension = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'unknown';
      
      const name = (record.name || 'Unknown').substring(0, 28).padEnd(28);
      const ext = extension.padEnd(9);
      const actualType = (record.actualDocType || 'Unknown').substring(0, 30).padEnd(30);
      const expectedCats = record.expectedCategories.join(', ').substring(0, 28).padEnd(28);
      const issue = record.issue.substring(0, 9).padEnd(9);
      
      console.log(`| ${name} | ${ext} | ${actualType} | ${expectedCats} | ${issue} |`);
    }
    
    if (inconsistentRecords.length > 10) {
      console.log(`... and ${inconsistentRecords.length - 10} more records.`);
    }
    
    console.log('-------------------------------------------------------------------------------------------------------------------');
  }
  
  return { errorRecords: inconsistentRecords, count: inconsistentRecords.length };
}

// Check for MIME type mismatches with document types
async function checkMimeTypeDocTypeConsistency(options: IntegrityCheckOptions) {
  console.log('\n=== Checking MIME types vs document types ===');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Define expected document type categories for common MIME types
  const mimeTypeToCategory: Record<string, string[]> = {
    'application/pdf': ['pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['document'],
    'application/msword': ['document'],
    'text/plain': ['document', 'text'],
    'video/mp4': ['video'],
    'audio/mpeg': ['audio'],
    'audio/mp3': ['audio'],
    'image/jpeg': ['image', 'photo'],
    'image/png': ['image', 'photo'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['presentation'],
    'application/vnd.ms-powerpoint': ['presentation'],
    'application/vnd.google-apps.document': ['document'],
    'application/vnd.google-apps.spreadsheet': ['spreadsheet'],
    'application/vnd.google-apps.presentation': ['presentation'],
    'application/vnd.google-apps.folder': ['folder']
  };
  
  // Get all document types with their categories
  const { data: documentTypes, error: documentTypesError } = await supabase
    .from('document_types')
    .select('id, document_type, document_category');
    
  if (documentTypesError) {
    throw new Error(`Error fetching document types: ${documentTypesError.message}`);
  }
  
  // Create maps for lookup
  const docTypeIdToType = new Map();
  const docTypeIdToCategory = new Map();
  
  for (const type of documentTypes || []) {
    docTypeIdToType.set(type.id, type.document_type);
    docTypeIdToCategory.set(type.id, type.document_category);
  }
  
  // Query for files with MIME types we can check
  const mimeTypeList = Object.keys(mimeTypeToCategory);
  
  let query = supabase
    .from('sources_google')
    .select('id, name, document_type_id, mime_type')
    .in('mime_type', mimeTypeList)
    .eq('is_deleted', false);
    
  if (options.limit) {
    query = query.limit(options.limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Error querying files with MIME types: ${error.message}`);
  }
  
  console.log(`Checking ${data?.length || 0} files with known MIME types.`);
  
  // Check each file for consistency
  const inconsistentRecords = [];
  
  for (const record of data || []) {
    const mimeType = record.mime_type;
    if (!mimeTypeToCategory[mimeType]) continue;
    
    const expectedCategories = mimeTypeToCategory[mimeType];
    const actualCategory = docTypeIdToCategory.get(record.document_type_id)?.toLowerCase();
    
    if (!actualCategory) {
      // No document type assigned
      inconsistentRecords.push({
        ...record,
        issue: 'Missing document type',
        expectedCategories,
        actualCategory: null
      });
      continue;
    }
    
    // Check if the actual category matches any of the expected categories
    const isConsistent = expectedCategories.some(cat => 
      actualCategory.includes(cat) || cat.includes(actualCategory));
      
    if (!isConsistent) {
      inconsistentRecords.push({
        ...record,
        issue: 'Inconsistent document type',
        expectedCategories,
        actualCategory,
        actualDocType: docTypeIdToType.get(record.document_type_id)
      });
    }
  }
  
  console.log(`Found ${inconsistentRecords.length} files with MIME types inconsistent with document types.`);
  
  if (inconsistentRecords.length > 0 && options.verbose) {
    console.log('\nSample of inconsistent records:');
    console.log('-------------------------------------------------------------------------------------------------------------------');
    console.log('| Name                         | MIME Type                    | Actual Doc Type              | Expected Categories    |');
    console.log('-------------------------------------------------------------------------------------------------------------------');
    
    const showLimit = Math.min(inconsistentRecords.length, 10);
    for (let i = 0; i < showLimit; i++) {
      const record = inconsistentRecords[i];
      
      const name = (record.name || 'Unknown').substring(0, 28).padEnd(28);
      const mimeType = (record.mime_type || 'Unknown').substring(0, 28).padEnd(28);
      const actualType = (record.actualDocType || 'Unknown').substring(0, 30).padEnd(30);
      const expectedCats = record.expectedCategories.join(', ').substring(0, 22).padEnd(22);
      
      console.log(`| ${name} | ${mimeType} | ${actualType} | ${expectedCats} |`);
    }
    
    if (inconsistentRecords.length > 10) {
      console.log(`... and ${inconsistentRecords.length - 10} more records.`);
    }
    
    console.log('-------------------------------------------------------------------------------------------------------------------');
  }
  
  return { errorRecords: inconsistentRecords, count: inconsistentRecords.length };
}

// Main function to run all integrity checks
async function checkSourcesGoogleIntegrity(options: IntegrityCheckOptions = {}) {
  console.log('=== Sources Google Integrity Check ===');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (options.limit) {
    console.log(`Limit: ${options.limit} records per check`);
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
    const results: Record<string, any> = {};
    
    // Run checks based on options
    if (options.folderCheck !== false) {
      // Check files with folder document types
      results.filesWithFolderTypes = await checkFilesWithFolderTypes(options);
      
      // Check folders with non-folder document types
      results.foldersWithNonFolderTypes = await checkFoldersWithNonFolderTypes(options);
    }
    
    if (options.extensionCheck) {
      // Check extension mismatches
      results.extensionMismatches = await checkExtensionDocTypeConsistency(options);
    }
    
    if (options.mimeTypeCheck) {
      // Check MIME type mismatches
      results.mimeTypeMismatches = await checkMimeTypeDocTypeConsistency(options);
    }
    
    // Print summary
    console.log('\n=== Integrity Check Summary ===');
    console.log('-----------------------------------------------------');
    if (results.filesWithFolderTypes) {
      console.log(`Files with folder document types: ${results.filesWithFolderTypes.count}`);
    }
    if (results.foldersWithNonFolderTypes) {
      console.log(`Folders with non-folder document types: ${results.foldersWithNonFolderTypes.count}`);
    }
    if (results.extensionMismatches) {
      console.log(`Files with extension/document type mismatches: ${results.extensionMismatches.count}`);
    }
    if (results.mimeTypeMismatches) {
      console.log(`Files with MIME type/document type mismatches: ${results.mimeTypeMismatches.count}`);
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
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: 
          (results.filesWithFolderTypes?.count || 0) +
          (results.foldersWithNonFolderTypes?.count || 0) +
          (results.extensionMismatches?.count || 0) +
          (results.mimeTypeMismatches?.count || 0),
        summary: 'Completed sources_google integrity check'
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
  .option('--fix', 'Fix issues automatically when possible', false)
  .option('--verbose', 'Show detailed information', false)
  .option('--limit <number>', 'Limit number of records to check per test', '1000')
  .option('--output <path>', 'Path to write JSON results')
  .option('--folder-check', 'Check folder-related issues', true)
  .option('--extension-check', 'Check file extension vs document type issues', false)
  .option('--mime-type-check', 'Check MIME type vs document type issues', false)
  .option('--all-checks', 'Run all available checks', false)
  .action(async (options) => {
    // If all-checks is specified, enable all checks
    if (options.allChecks) {
      options.folderCheck = true;
      options.extensionCheck = true;
      options.mimeTypeCheck = true;
    }
    
    await checkSourcesGoogleIntegrity({
      dryRun: options.dryRun !== false,
      verbose: options.verbose,
      limit: options.limit ? parseInt(options.limit, 10) : undefined,
      fix: options.fix,
      output: options.output,
      folderCheck: options.folderCheck,
      extensionCheck: options.extensionCheck,
      mimeTypeCheck: options.mimeTypeCheck
    });
  });

// Execute directly if this script is run directly (not imported)
if (require.main === module) {
  program.parse(process.argv);
}

// Export for module usage
export { checkSourcesGoogleIntegrity };