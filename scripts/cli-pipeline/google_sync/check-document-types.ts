#!/usr/bin/env ts-node
/**
 * Check Document Types
 * 
 * This script checks for .docx and .txt files in the sources_google table that
 * don't have a document_type_id set, and generates a report of these files.
 * 
 * Usage:
 *   ts-node check-document-types.ts [options]
 * 
 * Options:
 *   --output <path>     Path to write markdown output to (default: docs/cli-pipeline/missing_document_types.md)
 *   --verbose           Show detailed logs
 *   --limit <number>    Limit the number of files to process
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

// Set default output file
const outputIndex = args.indexOf('--output');
let outputFile = '/Users/raybunnage/Documents/github/dhg-mono/docs/cli-pipeline/missing_document_types.md'; // Default output location
if (outputIndex !== -1 && args[outputIndex + 1]) {
  outputFile = args[outputIndex + 1];
}

// Limit number of files to process
const limitIndex = args.indexOf('--limit');
let fileLimit = 0; // Default: process all files
if (limitIndex !== -1 && args[limitIndex + 1]) {
  fileLimit = parseInt(args[limitIndex + 1], 10);
}

interface FileInfo {
  id: string;
  name: string;
  mime_type: string;
  drive_id: string;
  path: string;
  has_document_type: boolean;
}

/**
 * Main function to check document types for .docx and .txt files
 */
export async function checkDocumentTypes(
  verboseParam?: boolean,
  outputFileParam?: string,
  limitParam?: number
): Promise<void> {
  // Override the global parameters if provided
  const actualOutputFile = outputFileParam || outputFile;
  const actualLimit = limitParam || fileLimit;
  
  if (verboseParam) {
    Logger.setLevel(LogLevel.DEBUG);
  }
  
  console.log('=== Check Document Types for .docx and .txt Files ===');
  console.log('===================================================');

  // Initialize Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Build query for .docx and .txt files
    const query = supabase
      .from('sources_google')
      .select('id, name, mime_type, path, drive_id, document_type_id')
      .eq('is_deleted', false)
      .or('mime_type.eq.application/vnd.openxmlformats-officedocument.wordprocessingml.document,mime_type.eq.text/plain')
      .order('path');
      
    // Apply limit if specified
    if (actualLimit > 0) {
      query.limit(actualLimit);
    }
    
    // Execute query
    const { data: files, error: filesError } = await query;
    
    if (filesError) {
      Logger.error(`Error fetching files: ${filesError.message}`);
      process.exit(1);
    }
    
    if (!files || files.length === 0) {
      Logger.info('No .docx or .txt files found in the database.');
      return;
    }
    
    // Group files by whether they have a document_type_id
    const withDocumentType: FileInfo[] = [];
    const withoutDocumentType: FileInfo[] = [];
    
    for (const file of files) {
      const fileInfo: FileInfo = {
        id: file.id,
        name: file.name,
        mime_type: file.mime_type,
        drive_id: file.drive_id,
        path: file.path,
        has_document_type: file.document_type_id !== null
      };
      
      if (file.document_type_id) {
        withDocumentType.push(fileInfo);
      } else {
        withoutDocumentType.push(fileInfo);
      }
    }
    
    Logger.info(`Found ${files.length} .docx and .txt files in total.`);
    Logger.info(`${withDocumentType.length} files have a document_type_id set.`);
    Logger.info(`${withoutDocumentType.length} files are missing a document_type_id.`);
    
    // Create markdown content
    let reportContent = '# Document Type Check Report\n\n';
    reportContent += `Report generated on ${new Date().toISOString()}\n\n`;
    reportContent += `This report shows .docx and .txt files that are missing document_type_id values.\n\n`;
    
    // Files without document type section
    reportContent += `## Files Missing Document Type (${withoutDocumentType.length})\n\n`;
    
    if (withoutDocumentType.length === 0) {
      reportContent += `All .docx and .txt files have document_type_id values set.\n\n`;
    } else {
      // Create table
      reportContent += `| File Path | MIME Type | Google Drive ID |\n`;
      reportContent += `|-----------|-----------|----------------|\n`;
      
      for (const file of withoutDocumentType) {
        reportContent += `| ${file.path} | ${file.mime_type} | ${file.drive_id} |\n`;
      }
      
      reportContent += `\n`;
    }
    
    // Files with document type section (summary only)
    reportContent += `## Files With Document Type (${withDocumentType.length})\n\n`;
    reportContent += `${withDocumentType.length} files already have document_type_id values set.\n\n`;
    
    // Add summary
    reportContent += `## Summary\n\n`;
    reportContent += `- Total .docx and .txt files: ${files.length}\n`;
    reportContent += `- Files with document_type_id: ${withDocumentType.length} (${Math.round(withDocumentType.length / files.length * 100)}%)\n`;
    reportContent += `- Files missing document_type_id: ${withoutDocumentType.length} (${Math.round(withoutDocumentType.length / files.length * 100)}%)\n`;
    
    // Write to output file if specified
    if (actualOutputFile) {
      try {
        // Create directory if it doesn't exist
        const dir = path.dirname(actualOutputFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // Write to file
        fs.writeFileSync(actualOutputFile, reportContent);
        Logger.info(`Report written to ${actualOutputFile}`);
      } catch (writeError: any) {
        Logger.error(`Error writing to output file: ${writeError.message}`);
      }
    }
    
    // Display confirmation
    console.log(`Report generation complete. Found ${withoutDocumentType.length} .docx and .txt files missing document_type_id.`);
    
  } catch (error: any) {
    Logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Execute main function if run directly
if (require.main === module) {
  checkDocumentTypes().catch(error => {
    Logger.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  });
}