#!/usr/bin/env ts-node
/**
 * Script to classify missing document types from Google Drive files
 * Uses the document classification service with the new PromptService
 */

import { program } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { Database } from '../../../supabase/types';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { promptService } from '../../../packages/shared/services/prompt-service';
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
import { GoogleDriveService } from '../../../packages/shared/services/google-drive';

// Define the prompt name to use for classification
const CLASSIFICATION_PROMPT = 'document-classification-prompt-new';

// Process a single file using the prompt service and Claude
async function processFile(
  fileId: string,
  mimeType: string,
  fileName: string,
  debug: boolean = false
): Promise<any> {
  try {
    if (debug) {
      console.log(`Processing file: ${fileName} (ID: ${fileId}, type: ${mimeType})`);
    }
    
    // Get Google Drive service
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Import auth service
    const { GoogleAuthService } = require('../../../packages/shared/services/google-drive/google-auth-service');
    const auth = GoogleAuthService.getInstance();
    
    // Get Google Drive service instance
    const googleDriveService = GoogleDriveService.getInstance(auth, supabase);
    
    // 1. Get the file content
    let fileContent = '';
    try {
      // Use the Google Drive API directly since the service methods aren't implemented
      const { google } = require('googleapis');
      const drive = google.drive({ version: 'v3', auth: auth.getAuthClient() });
      
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // For DOCX files
        // Get file metadata
        const file = await googleDriveService.getFile(fileId);
        if (debug) {
          console.log(`DOCX file details: ${JSON.stringify(file, null, 2)}`);
        }
        
        // Use Google Drive API directly to get content
        const response = await drive.files.get({
          fileId: fileId,
          alt: 'media',
        }, { responseType: 'text' });
        
        fileContent = response.data;
      } else if (mimeType === 'application/vnd.google-apps.document') {
        // For Google Docs
        // Use Google Drive API directly to export as plain text
        const response = await drive.files.export({
          fileId: fileId,
          mimeType: 'text/plain',
        }, { responseType: 'text' });
        
        fileContent = response.data;
      } else {
        // For regular text files
        // Use Google Drive API directly to get content
        const response = await drive.files.get({
          fileId: fileId,
          alt: 'media',
        }, { responseType: 'text' });
        
        fileContent = response.data;
      }
      
      if (debug) {
        console.log(`Successfully extracted ${fileContent.length} characters of content`);
      }
    } catch (error) {
      console.error(`Error getting file content: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
    
    // 2. Use the prompt service to load the classification prompt
    const promptResult = await promptService.loadPrompt(CLASSIFICATION_PROMPT, {
      includeDatabaseQueries: true,
      executeQueries: true,
      includeRelationships: true,
      includeRelatedFiles: true
    });
    
    if (debug) {
      console.log(`Loaded prompt with ${promptResult.combinedContent.length} characters of combined content`);
    }
    
    // 3. Send the file content for classification
    const userMessage = `Please classify this document:\n\n${fileContent}`;
    
    const classificationResult = await promptService.usePromptWithClaude(
      CLASSIFICATION_PROMPT,
      userMessage,
      {
        expectJson: true,
        claudeOptions: {
          temperature: 0.2,
          maxTokens: 4000
        }
      }
    );
    
    if (debug) {
      console.log('Classification result:', classificationResult);
    }
    
    return classificationResult;
  } catch (error) {
    console.error(`Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

// Main classification function
async function classifyMissingDocuments(
  limit: number,
  folderId?: string,
  outputPath?: string,
  includePdfs: boolean = false,
  debug: boolean = false,
  dryRun: boolean = false
): Promise<any[]> {
  try {
    // 1. Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // 2. Build query for unclassified files
    let query = supabase
      .from('sources_google')
      .select('*')
      .is('document_type_id', null)
      .is('is_deleted', false);
    
    // Filter by folder if provided
    if (folderId) {
      if (folderId.length < 36) {
        // It's likely a folder name, look it up
        if (debug) {
          console.log(`Looking up folder ID for name: ${folderId}`);
        }
        
        const { data: folders } = await supabase
          .from('sources_google')
          .select('id, drive_id, name, root_drive_id')
          .or(`name.ilike.%${folderId}%,path.ilike.%${folderId}%`)
          .is('is_folder', true)
          .limit(1);
          
        if (folders && folders.length > 0) {
          const folder = folders[0];
          if (debug) {
            console.log(`Found folder: ${folder.name || 'unnamed'} with ID: ${folder.drive_id}`);
          }
          
          if (folder.root_drive_id) {
            query = query.eq('root_drive_id', folder.root_drive_id);
          } else {
            query = query.eq('parent_id', folder.drive_id);
          }
        } else {
          console.log(`No folders found matching '${folderId}'`);
        }
      } else {
        // It's a UUID or Drive ID
        query = query.eq('parent_id', folderId);
      }
    }
    
    // Build mime type filter
    let mimeTypeFilter = 'mime_type.eq.application/vnd.openxmlformats-officedocument.wordprocessingml.document,mime_type.eq.text/plain,mime_type.eq.application/vnd.google-apps.document';
    
    // Include PDFs if requested
    if (includePdfs) {
      mimeTypeFilter += ',mime_type.eq.application/pdf';
    }
    
    // Apply mime type filter, sort, and limit
    query = query
      .or(mimeTypeFilter)
      .order('modified_at', { ascending: false })
      .limit(limit);
    
    // 3. Execute the query
    const { data: files, error } = await query;
    
    if (error) {
      throw new Error(`Error fetching files: ${error.message}`);
    }
    
    if (debug) {
      console.log(`Found ${files?.length || 0} files missing document types`);
    }
    
    if (!files || files.length === 0) {
      return [];
    }
    
    // 4. Process each file
    const results = [];
    for (const file of files) {
      try {
        if (debug) {
          console.log(`Processing file: ${file.name} (${file.id})`);
        }
        
        // Process the file
        const classificationResult = await processFile(
          file.drive_id,
          file.mime_type,
          file.name || '',
          debug
        );
        
        // Only update the database if not in dry run mode
        if (!dryRun && classificationResult.document_type_id) {
          // Update document type in sources_google
          const { error: updateError } = await supabase
            .from('sources_google')
            .update({ document_type_id: classificationResult.document_type_id })
            .eq('id', file.id);
          
          if (updateError) {
            console.error(`Error updating document type: ${updateError.message}`);
          } else if (debug) {
            console.log(`Updated document type for ${file.name} to ${classificationResult.document_type_id}`);
          }
          
          // Create expert document record
          const expertDoc = {
            id: uuidv4(),
            source_id: file.id,
            document_type_id: classificationResult.document_type_id,
            classification_confidence: classificationResult.classification_confidence || 0.75,
            classification_metadata: classificationResult,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const { error: expertError } = await supabase
            .from('expert_documents')
            .insert(expertDoc);
          
          if (expertError) {
            console.error(`Error creating expert document: ${expertError.message}`);
          } else if (debug) {
            console.log(`Created expert document for ${file.name}`);
          }
        }
        
        // Add to results
        results.push({
          file,
          result: classificationResult
        });
        
        // Save results to output directory if specified
        if (outputPath && classificationResult) {
          const outputDir = path.dirname(outputPath);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // Write individual result to file
          const filePath = path.join(outputDir, `${file.id}.json`);
          fs.writeFileSync(filePath, JSON.stringify(classificationResult, null, 2));
          
          if (debug) {
            console.log(`Saved classification result to ${filePath}`);
          }
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Add the error to results
        results.push({
          file,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Save combined results if output path specified
    if (outputPath && results.length > 0) {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Format results
      const combined = {
        timestamp: new Date().toISOString(),
        folder_id: folderId || 'all folders',
        include_pdfs: includePdfs,
        dry_run: dryRun,
        total_files: results.length,
        results
      };
      
      // Write to file
      fs.writeFileSync(outputPath, JSON.stringify(combined, null, 2));
      console.log(`Results saved to ${outputPath}`);
    }
    
    return results;
  } catch (error) {
    console.error(`Error classifying documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

// Define CLI program
program
  .name('classify-missing-docs-with-service')
  .description('Classify Google Drive files missing document types using the PromptService')
  .option('-l, --limit <number>', 'Limit the number of files to process', '10')
  .option('-o, --output <path>', 'Output file path for classification results')
  .option('-d, --debug', 'Enable debug logging', false)
  .option('-v, --verbose', 'Enable verbose logging (includes debug)', false)
  .option('--dry-run', 'Process files but do not update database', false)
  .option('--include-pdfs', 'Include PDF files in classification (by default only .docx and .txt files are processed)', false)
  .option('--folder-id <id>', 'Filter by Google Drive folder ID or folder name', '')
  .action(async (options) => {
    try {
      // Set debug mode if verbose is enabled
      const debug = options.debug || options.verbose;
      const dryRun = options.dryRun;
      
      // Show header
      console.log('='.repeat(50));
      console.log('DOCUMENT CLASSIFICATION WITH PROMPT SERVICE');
      console.log('='.repeat(50));
      console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
      console.log(`Debug: ${debug ? 'ON' : 'OFF'}`);
      
      // Parse limit
      const limit = parseInt(options.limit, 10);
      
      // Process files
      console.log(`Processing up to ${limit} files missing document types...`);
      
      const results = await classifyMissingDocuments(
        limit,
        options.folderId || '',
        options.output,
        options.includePdfs,
        debug,
        dryRun
      );
      
      // Show summary
      console.log('='.repeat(50));
      const successCount = results.filter(r => r.result).length;
      console.log(`SUMMARY: Processed ${results.length} files, ${successCount} successfully classified`);
      
      // Show results table
      console.log('\nResults:');
      console.log('-'.repeat(80));
      console.log('| File ID                               | File Name                  | Status    |');
      console.log('-'.repeat(80));
      
      results.forEach(r => {
        const id = r.file.id.substring(0, 36).padEnd(36);
        const name = (r.file.name || 'Unknown').substring(0, 25).padEnd(25);
        const status = r.result ? 'Success' : 'Failed';
        console.log(`| ${id} | ${name} | ${status.padEnd(9)} |`);
      });
      
      console.log('-'.repeat(80));
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (options.verbose) {
        console.error('Stack trace:', (error as Error).stack);
      }
      process.exit(1);
    }
  });

// Export for module usage
export async function classifyMissingDocsWithService(options: {
  limit?: number;
  folderId?: string;
  outputPath?: string;
  includePdfs?: boolean;
  debug?: boolean;
  dryRun?: boolean;
}): Promise<any[]> {
  const {
    limit = 10,
    folderId = '',
    outputPath,
    includePdfs = false,
    debug = false,
    dryRun = false
  } = options;
  
  return classifyMissingDocuments(
    limit,
    folderId,
    outputPath,
    includePdfs,
    debug,
    dryRun
  );
}

// Run CLI if this module is executed directly
if (require.main === module) {
  program.parse();
}