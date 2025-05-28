#!/usr/bin/env ts-node
/**
 * Mark Videos to Skip Processing Command
 * 
 * This command marks specific MP4 files to be skipped during batch processing.
 * Use this for exceptionally large or problematic files that you want to process later.
 * 
 * Usage:
 *   mark-skip-processing.ts [fileId|filename] [options]
 * 
 * Options:
 *   --dry-run                  Show what would be updated without changes
 *   --resume                   Remove the skip_processing status (make available for processing again)
 *   --help                     Display this help message
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../../../packages/shared/utils';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  fileIdentifier: '',
  dryRun: args.includes('--dry-run'),
  resume: args.includes('--resume'),
  help: args.includes('--help')
};

// Display help if requested
if (options.help) {
  console.log(`
Mark Videos to Skip Processing
=============================

This command marks specific MP4 files to be skipped during batch processing.
Use this for exceptionally large or problematic files that you want to process later.

Usage:
  mark-skip-processing.ts [fileId|filename] [options]

Options:
  --dry-run                  Show what would be updated without changes
  --resume                   Remove the skip_processing status (make available for processing again)
  --help                     Display this help message

Examples:
  mark-skip-processing.ts big_lecture.mp4              # Mark a file by name
  mark-skip-processing.ts f9f1e470-3b07-4aee-b134-5a7  # Mark a file by ID
  mark-skip-processing.ts large_video.mp4 --resume     # Resume processing for previously skipped file
  `);
  process.exit(0);
}

// Get file identifier (first non-option argument)
const fileIdentifierArg = args.find(arg => !arg.startsWith('--'));
if (fileIdentifierArg) {
  options.fileIdentifier = fileIdentifierArg;
}

/**
 * Find document ID from filename
 */
async function findDocumentIdFromFilename(filename: string, supabase: any): Promise<string | null> {
  try {
    // Strip extension if present
    const baseFilename = filename.replace(/\.[^/.]+$/, "");
    
    // Find corresponding documents in database
    const { data: matchingDocs, error: queryError } = await supabase
      .from('google_expert_documents')
      .select(`
        id, 
        sources_google!inner(id, name, mime_type)
      `)
      .eq('content_type', 'presentation')
      .eq('sources_google.mime_type', 'video/mp4')
      .ilike('sources_google.name', `%${baseFilename}%`);
    
    if (queryError) {
      Logger.error(`❌ Error querying documents for ${filename}: ${queryError.message}`);
      return null;
    }
    
    if (!matchingDocs || matchingDocs.length === 0) {
      // Try to find files with the extension
      const { data: matchingDocsWithExt } = await supabase
        .from('google_expert_documents')
        .select(`
          id, 
          sources_google!inner(id, name, mime_type)
        `)
        .eq('content_type', 'presentation')
        .eq('sources_google.mime_type', 'video/mp4')
        .ilike('sources_google.name', `%${filename}%`);
      
      if (!matchingDocsWithExt || matchingDocsWithExt.length === 0) {
        Logger.error(`❌ No matching document found for file: ${filename}`);
        return null;
      } else {
        if (matchingDocsWithExt.length > 1) {
          Logger.warn(`⚠️ Multiple matches found for ${filename}. Using first match.`);
          
          // Display all matches
          matchingDocsWithExt.forEach((doc: any, index: number) => {
            Logger.info(`   ${index + 1}. ID: ${doc.id}, Name: ${doc.sources_google.name}`);
          });
        }
        
        return matchingDocsWithExt[0].id;
      }
    }
    
    if (matchingDocs.length > 1) {
      Logger.warn(`⚠️ Multiple matches found for ${filename}. Using first match.`);
      
      // Display all matches
      matchingDocs.forEach((doc: any, index: number) => {
        Logger.info(`   ${index + 1}. ID: ${doc.id}, Name: ${doc.sources_google.name}`);
      });
    }
    
    return matchingDocs[0].id;
  } catch (error: any) {
    Logger.error(`❌ Exception in findDocumentIdFromFilename: ${error.message}`);
    return null;
  }
}

/**
 * Update document processing status
 */
async function updateDocumentStatus(documentId: string, supabase: any, resume: boolean): Promise<boolean> {
  try {
    // Get the document from the database
    const { data: document, error: docError } = await supabase
      .from('google_expert_documents')
      .select('id, content_type, processing_status, sources_google!inner(name)')
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
    
    // Build the update data
    const updateData: any = {};
    const status = resume ? 'pending' : 'error';
    updateData.processing_status = status;
    
    // Add message for error status to indicate it's a skip
    if (status === 'error') {
      updateData.processing_error = 'Skipped processing - file marked to skip due to size or complexity';
    }
    
    // Display what we're about to do
    Logger.info(`📋 Document: ${document.id}`);
    Logger.info(`📋 Filename: ${document.sources_google.name}`);
    Logger.info(`📋 Current status: ${document.processing_status}`);
    Logger.info(`📋 New status: ${status}`);
    if (status === 'error') {
      Logger.info(`📋 Reason: Skipped processing - file marked to skip due to size or complexity`);
    }
    
    if (options.dryRun) {
      Logger.info(`🔄 DRY RUN: Would ${resume ? 'resume' : 'skip'} processing for document ${documentId}`);
      return true;
    }
    
    // Update the document
    const { error: updateError } = await supabase
      .from('google_expert_documents')
      .update(updateData)
      .eq('id', documentId);
    
    if (updateError) {
      Logger.error(`❌ Error updating document status: ${updateError.message}`);
      return false;
    }
    
    Logger.info(`✅ Successfully ${resume ? 'resumed' : 'skipped'} document ${documentId}`);
    return true;
  } catch (error: any) {
    Logger.error(`❌ Exception in updateDocumentStatus: ${error.message}`);
    return false;
  }
}

async function main() {
  try {
    // Validate required options
    if (!options.fileIdentifier) {
      Logger.error('❌ Missing required file identifier (UUID or filename)');
      Logger.info('Usage: mark-skip-processing.ts [fileId|filename] [options]');
      Logger.info('Run with --help for more information');
      process.exit(1);
    }
    
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
    Logger.info(`🔄 Mark ${options.resume ? 'Resume' : 'Skip'} Processing`);
    Logger.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL UPDATE'}`);
    Logger.info(`File: ${options.fileIdentifier}`);
    
    // Check if the fileId is a UUID (expert document)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let documentId: string | null = null;
    
    if (uuidPattern.test(options.fileIdentifier)) {
      // It's a document ID
      documentId = options.fileIdentifier;
      Logger.info(`📋 Processing expert document: ${documentId}`);
    } else {
      // It's a filename - need to look up the document ID
      Logger.info(`📋 Finding document for filename: ${options.fileIdentifier}`);
      documentId = await findDocumentIdFromFilename(options.fileIdentifier, supabase);
      
      if (!documentId) {
        Logger.error('❌ No document found matching the provided filename');
        process.exit(1);
      }
    }
    
    // Update the document status
    const success = await updateDocumentStatus(documentId, supabase, options.resume);
    
    if (!success) {
      Logger.error('❌ Failed to update document status');
      process.exit(1);
    }
    
    if (options.resume) {
      Logger.info('✅ Successfully marked file to resume processing');
    } else {
      Logger.info('✅ Successfully marked file to skip processing');
    }
    
    Logger.info('📋 This file will now be excluded from batch processing');
    Logger.info('📋 You can process it individually later if needed');
    
    // Provide command to resume processing if we just marked to skip
    if (!options.resume && !options.dryRun) {
      Logger.info(`📋 To resume processing later, run: mark-skip-processing.ts ${documentId} --resume`);
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