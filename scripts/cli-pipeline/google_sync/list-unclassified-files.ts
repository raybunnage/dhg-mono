#!/usr/bin/env ts-node
/**
 * List Unclassified Document Files
 * 
 * This script lists PDF, PowerPoint, TXT, and DOCX files in the sources_google table that
 * don't have a document_type_id set, to identify files that need classification.
 * 
 * Usage:
 *   ts-node list-unclassified-files.ts [options]
 * 
 * Options:
 *   --output <path>     Path to write markdown output to (default: docs/cli-pipeline/unclassified_files.md)
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
let outputFile = '/Users/raybunnage/Documents/github/dhg-mono/docs/cli-pipeline/unclassified_files.md'; // Default output location
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
 * Main function to list unclassified PDF and PowerPoint files
 */
export async function listUnclassifiedFiles(
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
  
  console.log('=== List Unclassified PDF and PowerPoint Files ===');
  console.log('=================================================');

  // Initialize Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Get all document files (PDF, PowerPoint, TXT, DOCX)
    Logger.info('Querying for PDF, PowerPoint, TXT, and DOCX files...');
    
    // Build query for PDF, PowerPoint, TXT, and DOCX files
    const query = supabase
      .from('sources_google')
      .select('id, name, mime_type, path, drive_id, document_type_id')
      .eq('is_deleted', false)
      .or(
        'mime_type.eq.application/pdf,' + 
        'mime_type.eq.application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
        'mime_type.eq.application/vnd.ms-powerpoint,' +
        'mime_type.eq.text/plain,' +
        'mime_type.eq.application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
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
      Logger.info('No document files (PDF, PowerPoint, TXT, DOCX) found in the database.');
      return;
    }
    
    // Group files by file type and whether they have a document_type_id
    const pdfWithType: FileInfo[] = [];
    const pdfWithoutType: FileInfo[] = [];
    const pptWithType: FileInfo[] = [];
    const pptWithoutType: FileInfo[] = [];
    const txtWithType: FileInfo[] = [];
    const txtWithoutType: FileInfo[] = [];
    const docxWithType: FileInfo[] = [];
    const docxWithoutType: FileInfo[] = [];
    
    for (const file of files) {
      const fileInfo: FileInfo = {
        id: file.id,
        name: file.name,
        mime_type: file.mime_type,
        drive_id: file.drive_id,
        path: file.path,
        has_document_type: file.document_type_id !== null
      };
      
      const isPdf = file.mime_type === 'application/pdf';
      const isPpt = file.mime_type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
                   file.mime_type === 'application/vnd.ms-powerpoint';
      const isTxt = file.mime_type === 'text/plain';
      const isDocx = file.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      
      if (isPdf) {
        if (file.document_type_id) {
          pdfWithType.push(fileInfo);
        } else {
          pdfWithoutType.push(fileInfo);
        }
      } else if (isPpt) {
        if (file.document_type_id) {
          pptWithType.push(fileInfo);
        } else {
          pptWithoutType.push(fileInfo);
        }
      } else if (isTxt) {
        if (file.document_type_id) {
          txtWithType.push(fileInfo);
        } else {
          txtWithoutType.push(fileInfo);
        }
      } else if (isDocx) {
        if (file.document_type_id) {
          docxWithType.push(fileInfo);
        } else {
          docxWithoutType.push(fileInfo);
        }
      }
    }
    
    const totalPdf = pdfWithType.length + pdfWithoutType.length;
    const totalPpt = pptWithType.length + pptWithoutType.length;
    const totalTxt = txtWithType.length + txtWithoutType.length;
    const totalDocx = docxWithType.length + docxWithoutType.length;
    const totalFiles = totalPdf + totalPpt + totalTxt + totalDocx;
    const totalUnclassified = pdfWithoutType.length + pptWithoutType.length + txtWithoutType.length + docxWithoutType.length;
    
    Logger.info(`Found ${totalFiles} total files (${totalPdf} PDFs, ${totalPpt} PowerPoint files, ${totalTxt} TXT files, ${totalDocx} DOCX files)`);
    Logger.info(`${totalUnclassified} files need classification (${pdfWithoutType.length} PDFs, ${pptWithoutType.length} PowerPoint files, ${txtWithoutType.length} TXT files, ${docxWithoutType.length} DOCX files)`);
    
    // Create markdown content
    let reportContent = '# Unclassified Files Report\n\n';
    reportContent += `Report generated on ${new Date().toISOString()}\n\n`;
    reportContent += `This report shows PDF, PowerPoint, TXT, and DOCX files that need classification (missing document_type_id values).\n\n`;
    
    // Summary section
    reportContent += `## Summary\n\n`;
    reportContent += `- Total document files: ${totalFiles}\n`;
    reportContent += `- Files already classified: ${totalFiles - totalUnclassified} (${Math.round((totalFiles - totalUnclassified) / totalFiles * 100)}%)\n`;
    reportContent += `- Files needing classification: ${totalUnclassified} (${Math.round(totalUnclassified / totalFiles * 100)}%)\n\n`;
    
    reportContent += `### PDF Files\n`;
    reportContent += `- Total PDF files: ${totalPdf}\n`;
    reportContent += `- Classified PDF files: ${pdfWithType.length} (${totalPdf > 0 ? Math.round(pdfWithType.length / totalPdf * 100) : 0}%)\n`;
    reportContent += `- Unclassified PDF files: ${pdfWithoutType.length} (${totalPdf > 0 ? Math.round(pdfWithoutType.length / totalPdf * 100) : 0}%)\n\n`;
    
    reportContent += `### PowerPoint Files\n`;
    reportContent += `- Total PowerPoint files: ${totalPpt}\n`;
    reportContent += `- Classified PowerPoint files: ${pptWithType.length} (${totalPpt > 0 ? Math.round(pptWithType.length / totalPpt * 100) : 0}%)\n`;
    reportContent += `- Unclassified PowerPoint files: ${pptWithoutType.length} (${totalPpt > 0 ? Math.round(pptWithoutType.length / totalPpt * 100) : 0}%)\n\n`;
    
    reportContent += `### TXT Files\n`;
    reportContent += `- Total TXT files: ${totalTxt}\n`;
    reportContent += `- Classified TXT files: ${txtWithType.length} (${totalTxt > 0 ? Math.round(txtWithType.length / totalTxt * 100) : 0}%)\n`;
    reportContent += `- Unclassified TXT files: ${txtWithoutType.length} (${totalTxt > 0 ? Math.round(txtWithoutType.length / totalTxt * 100) : 0}%)\n\n`;
    
    reportContent += `### DOCX Files\n`;
    reportContent += `- Total DOCX files: ${totalDocx}\n`;
    reportContent += `- Classified DOCX files: ${docxWithType.length} (${totalDocx > 0 ? Math.round(docxWithType.length / totalDocx * 100) : 0}%)\n`;
    reportContent += `- Unclassified DOCX files: ${docxWithoutType.length} (${totalDocx > 0 ? Math.round(docxWithoutType.length / totalDocx * 100) : 0}%)\n\n`;
    
    // Unclassified PDF section
    reportContent += `## Unclassified PDF Files (${pdfWithoutType.length})\n\n`;
    
    if (pdfWithoutType.length === 0) {
      reportContent += `No unclassified PDF files found.\n\n`;
    } else {
      // Create table
      reportContent += `| File Name | File Path | Google Drive ID |\n`;
      reportContent += `|-----------|-----------|----------------|\n`;
      
      for (const file of pdfWithoutType) {
        reportContent += `| ${file.name} | ${file.path} | ${file.drive_id} |\n`;
      }
      
      reportContent += `\n`;
    }
    
    // Unclassified PowerPoint section
    reportContent += `## Unclassified PowerPoint Files (${pptWithoutType.length})\n\n`;
    
    if (pptWithoutType.length === 0) {
      reportContent += `No unclassified PowerPoint files found.\n\n`;
    } else {
      // Create table
      reportContent += `| File Name | File Path | Google Drive ID |\n`;
      reportContent += `|-----------|-----------|----------------|\n`;
      
      for (const file of pptWithoutType) {
        reportContent += `| ${file.name} | ${file.path} | ${file.drive_id} |\n`;
      }
      
      reportContent += `\n`;
    }
    
    // Unclassified TXT section
    reportContent += `## Unclassified TXT Files (${txtWithoutType.length})\n\n`;
    
    if (txtWithoutType.length === 0) {
      reportContent += `No unclassified TXT files found.\n\n`;
    } else {
      // Create table
      reportContent += `| File Name | File Path | Google Drive ID |\n`;
      reportContent += `|-----------|-----------|----------------|\n`;
      
      for (const file of txtWithoutType) {
        reportContent += `| ${file.name} | ${file.path} | ${file.drive_id} |\n`;
      }
      
      reportContent += `\n`;
    }
    
    // Unclassified DOCX section
    reportContent += `## Unclassified DOCX Files (${docxWithoutType.length})\n\n`;
    
    if (docxWithoutType.length === 0) {
      reportContent += `No unclassified DOCX files found.\n\n`;
    } else {
      // Create table
      reportContent += `| File Name | File Path | Google Drive ID |\n`;
      reportContent += `|-----------|-----------|----------------|\n`;
      
      for (const file of docxWithoutType) {
        reportContent += `| ${file.name} | ${file.path} | ${file.drive_id} |\n`;
      }
      
      reportContent += `\n`;
    }
    
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
    
    // Print summary to console
    console.log('\nUnclassified Files Summary:');
    console.log('-------------------------');
    console.log(`Total PDF files: ${totalPdf} (${pdfWithoutType.length} unclassified)`);
    console.log(`Total PowerPoint files: ${totalPpt} (${pptWithoutType.length} unclassified)`);
    console.log(`Total TXT files: ${totalTxt} (${txtWithoutType.length} unclassified)`);
    console.log(`Total DOCX files: ${totalDocx} (${docxWithoutType.length} unclassified)`);
    console.log(`Total unclassified files: ${totalUnclassified} out of ${totalFiles} (${Math.round(totalUnclassified / totalFiles * 100)}%)`);
    
  } catch (error: any) {
    Logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Execute main function if run directly
if (require.main === module) {
  listUnclassifiedFiles().catch(error => {
    Logger.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  });
}