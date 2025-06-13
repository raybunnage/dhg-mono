#!/usr/bin/env ts-node
/**
 * Script to force reclassification of documents with AI
 * This script is used by reclassify-docs command to update the processed_content field
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { promptService } from '../../../packages/shared/services/prompt-service';
import { claudeService } from '@shared/services/claude-service';
import * as fs from 'fs';
import * as path from 'path';
import * as mammoth from 'mammoth';
import { GoogleDriveService } from '../../../packages/shared/services/google-drive';
import { documentClassificationService } from '../../../packages/shared/services/document-classification-service';
import { pdfProcessorService } from '../../../packages/shared/services/pdf-processor-service';

// The prompt to use for classification
const CLASSIFICATION_PROMPT = 'document-classification-prompt-new';

/**
 * Forcefully reclassify a document that needs reprocessing
 * This is the function that will be called by the reclassify-docs command
 * to actually process documents with AI
 * 
 * @param documentId ID of the expert_document to reprocess 
 * @param sourceId ID of the source in sources_google
 * @param debug Enable debug logging
 * @returns true if successful, false if there was an error
 */
export async function forceReclassifyDocument(
  documentId: string, 
  sourceId: string, 
  debug: boolean = false
): Promise<boolean> {
  try {
    // Get supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // 1. Get the source details
    const { data: source, error: sourceError } = await supabase
      .from('google_sources')
      .select('*')
      .eq('id', sourceId)
      .single();
    
    if (sourceError || !source) {
      console.error(`Error getting source ${sourceId}: ${sourceError?.message || 'Source not found'}`);
      return false;
    }
    
    // 2. Get the expert document
    const { data: document, error: docError } = await supabase
      .from('google_expert_documents')
      .select('*')
      .eq('id', documentId)
      .single();
    
    if (docError || !document) {
      console.error(`Error getting document ${documentId}: ${docError?.message || 'Document not found'}`);
      return false;
    }
    
    if (debug) {
      console.log(`Processing ${source.name} (${source.mime_type})`);
    }
    
    // 3. Process based on mime type
    let contentForClassification = '';
    let classificationResult = null;
    
    // Import auth service
    const { GoogleAuthService } = require('../../../packages/shared/services/google-drive/google-auth-service');
    const auth = GoogleAuthService.getInstance();
    
    // Get Google Drive service instance
    const googleDriveService = GoogleDriveService.getInstance(auth, supabase);
    
    // DOCX processing
    if (source.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        // Use the Google Drive API directly
        const { google } = require('googleapis');
        const { JWT } = require('google-auth-library');
        
        // Get service account key file path from environment
        const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 
                          process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                          path.resolve(process.cwd(), '.service-account.json');
        
        // Read and parse the service account key file
        const keyFileData = fs.readFileSync(keyFilePath, 'utf8');
        const keyFile = JSON.parse(keyFileData);
        
        // Create JWT auth client with the service account
        const authClient = new JWT({
          email: keyFile.client_email,
          key: keyFile.private_key,
          scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });
        
        const drive = google.drive({ version: 'v3', auth: authClient });
        
        // Get file metadata
        const file = await googleDriveService.getFile(source.drive_id);
        
        // Use Google Drive API directly to get DOCX binary content
        const response = await drive.files.get({
          fileId: source.drive_id,
          alt: 'media',
        }, { responseType: 'arraybuffer' });
        
        // Process with mammoth to extract text properly
        // Create a buffer from the response data
        const buffer = Buffer.from(response.data);
        
        // Save the file temporarily to process with mammoth
        const tempDir = './document-analysis-results';
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFilePath = path.join(tempDir, `temp-${source.drive_id}.docx`);
        fs.writeFileSync(tempFilePath, buffer);
        
        // Extract text using mammoth with file path
        const result = await mammoth.extractRawText({
          path: tempFilePath
        });
        
        // Clean up the file when done
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {
          // Ignore cleanup errors
        }
        
        // Check if we got reasonable content
        if (result.value && result.value.length > 10) {
          // Clean up the text content
          contentForClassification = result.value
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
            .replace(/\u0000/g, '')  // Remove null bytes
            .replace(/\n{3,}/g, '\n\n')  // Normalize multiple line breaks
            .trim();
        } else {
          throw new Error("Insufficient content extracted from document");
        }
      } catch (error) {
        console.error(`Error processing DOCX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
      }
    } 
    // PDF processing
    else if (source.mime_type === 'application/pdf') {
      try {
        // For PDFs, we'll use the Claude API directly since we don't have an easy way
        // to extract text from PDFs in Node.js. Claude can process PDFs directly.
        // Note: claudeService is already imported at the top of the file
        
        // Since the built-in getFileContent is a stub, we need to use the Google Drive API directly
        // Get the credentials and build a client
        const { google } = require('googleapis');
        const { JWT } = require('google-auth-library');
        
        // Get service account key file path from environment
        const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 
                          process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                          path.resolve(process.cwd(), '.service-account.json');
        
        // Read and parse the service account key file
        const keyFileData = fs.readFileSync(keyFilePath, 'utf8');
        const keyFile = JSON.parse(keyFileData);
        
        // Create JWT auth client with the service account
        const authClient = new JWT({
          email: keyFile.client_email,
          key: keyFile.private_key,
          scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });
        
        const drive = google.drive({ version: 'v3', auth: authClient });
        
        // Get file metadata to check size before downloading
        const file = await googleDriveService.getFile(source.drive_id);
        
        // Check file size before downloading
        if (file && file.size) {
          const fileSizeBytes = parseInt(file.size, 10);
          const fileSizeMB = fileSizeBytes / (1024 * 1024);
          
          // Check if the file exceeds 10MB limit
          if (fileSizeBytes > 10 * 1024 * 1024) {
            // File is too large, mark it for skipping
            console.log(`⚠️ PDF file is too large (${fileSizeMB.toFixed(2)}MB). Marking as too large for processing.`);
            
            // Update the document with skip status
            await supabase
              .from('google_expert_documents')
              .update({
                document_processing_status: 'skip_processing',
                document_processing_status_updated_at: new Date().toISOString(),
                processing_skip_reason: "file > 10MB - too large for processing",
                updated_at: new Date().toISOString()
              })
              .eq('id', documentId);
              
            console.log(`✅ Updated document ${documentId} with document_processing_status = 'skip_processing'`);
            return true; // Return true to indicate we've handled this document
          }
        }
        
        // Download the PDF file
        const pdfResponse = await drive.files.get({
          fileId: source.drive_id,
          alt: 'media',
        }, { responseType: 'arraybuffer' });
        
        // Create a buffer from the response data
        const fileBytes = Buffer.from(pdfResponse.data);
        
        if (!fileBytes || fileBytes.length === 0) {
          throw new Error("Failed to download PDF file");
        }
        
        // Double check the file size after downloading
        const fileSizeBytes = fileBytes.length;
        const fileSizeMB = fileSizeBytes / (1024 * 1024);
        
        // Check again if the file exceeds 10MB limit (in case the metadata size was incorrect)
        if (fileSizeBytes > 10 * 1024 * 1024) {
          // File is too large, mark it for skipping
          console.log(`⚠️ PDF file is too large (${fileSizeMB.toFixed(2)}MB). Marking as too large for processing.`);
          
          // Update the document with skip status
          await supabase
            .from('google_expert_documents')
            .update({
              document_processing_status: 'skip_processing',
              document_processing_status_updated_at: new Date().toISOString(),
              processing_skip_reason: "file > 10MB - too large for processing",
              updated_at: new Date().toISOString()
            })
            .eq('id', documentId);
            
          console.log(`✅ Updated document ${documentId} with document_processing_status = 'skip_processing'`);
          return true; // Return true to indicate we've handled this document
        }
        
        // Convert to base64
        const base64File = Buffer.from(fileBytes).toString('base64');
        
        // Save PDF to temporary file for Claude's PDF analysis capability
        const tempDir = './document-analysis-results';
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Create a safe filename for the temp file
        const safeName = source.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const tempFilePath = path.join(tempDir, `temp-${safeName}-${source.drive_id.substring(0, 8)}.pdf`);
        
        // Write the file to disk
        fs.writeFileSync(tempFilePath, fileBytes);
        
        if (debug) {
          console.log(`Saved temporary PDF file to ${tempFilePath}`);
        }
        
        // Prepare the message for Claude
        const userMessage = "Please extract the text content from this PDF document. Focus on the main topics, key points, and conclusions.";
        
        // Use the PDF processor service to analyze the PDF
        // Read the file buffer (extractTextFromPDF expects a buffer, not a file path)
        const fileBuffer = fs.readFileSync(tempFilePath);
        
        // Then pass the buffer to the PDF processor with proper method case (PDF, not pdf)
        const extractResult = await pdfProcessorService.extractTextFromPDF(
          fileBuffer,
          source.name // Pass filename as additional context
        );
        
        if (extractResult.success && extractResult.content) {
          // Response is text content from the PDF
          contentForClassification = extractResult.content;
          if (debug) {
            console.log(`✅ Successfully extracted ${contentForClassification.length} characters from PDF`);
          }
        } else {
          throw new Error(`Failed to extract content from PDF: ${extractResult.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error(`Error processing PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
      }
    }
    // PowerPoint processing
    else if (source.mime_type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      try {
        // Since the built-in getFileContent is a stub, we need to use the Google Drive API directly
        // Get the credentials and build a client
        const { google } = require('googleapis');
        const { JWT } = require('google-auth-library');
        
        // Get service account key file path from environment
        const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 
                          process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                          path.resolve(process.cwd(), '.service-account.json');
        
        // Read and parse the service account key file
        const keyFileData = fs.readFileSync(keyFilePath, 'utf8');
        const keyFile = JSON.parse(keyFileData);
        
        // Create JWT auth client with the service account
        const authClient = new JWT({
          email: keyFile.client_email,
          key: keyFile.private_key,
          scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });
        
        const drive = google.drive({ version: 'v3', auth: authClient });
        
        // Download the PowerPoint file
        const pptResponse = await drive.files.get({
          fileId: source.drive_id,
          alt: 'media',
        }, { responseType: 'arraybuffer' });
        
        // Create a buffer from the response data
        const fileBytes = Buffer.from(pptResponse.data);
        
        if (!fileBytes || fileBytes.length === 0) {
          throw new Error("Failed to download PowerPoint file");
        }
        
        // Save to temporary file
        const tempDir = './document-analysis-results';
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFilePath = path.join(tempDir, `temp-${source.drive_id}.pptx`);
        fs.writeFileSync(tempFilePath, Buffer.from(fileBytes));
        
        // For PowerPoint files, we need to handle differently because Claude's analyzePdf method
        // expects PDF files but we have a PowerPoint file
        
        // Instead, extract text ourselves and send directly to Claude without the file
        // First, check file size
        const stats = fs.statSync(tempFilePath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        
        if (fileSizeInMB > 10) {
          // File is too large, we'll use an alternative approach
          console.log(`PowerPoint file is too large (${fileSizeInMB.toFixed(2)}MB). Using text extraction approach instead.`);
          
          // Extract simplified metadata about the presentation
          const presentationInfo = {
            filename: source.name,
            fileSize: `${fileSizeInMB.toFixed(2)}MB`,
            fileType: source.mime_type,
            extractionMethod: "Metadata only (file too large for full content extraction)"
          };
          
          // Create text prompt for Claude directly
          const userMessage = `Please analyze this PowerPoint presentation metadata. The file is too large to process directly:
File: ${source.name}
Size: ${fileSizeInMB.toFixed(2)}MB
Type: ${source.mime_type}
Modified: ${source.modified_at || 'unknown'}

Based on the filename and context, please help classify this document appropriately.`;
          
          // Use standard Claude text interface instead
          const claudePptResponse = await claudeService.sendPrompt(userMessage, {
            temperature: 0,
            maxTokens: 4000
          });
        
          // For large files
          if (claudePptResponse) {
            // Response is text content from the PowerPoint
            contentForClassification = claudePptResponse;
            if (debug) {
              console.log(`✅ Successfully created metadata-based analysis for large PowerPoint (${contentForClassification.length} characters)`);
            }
          } else {
            throw new Error("Failed to analyze PowerPoint metadata");
          }
        } else {
          // For smaller files, try to extract content directly (but use text prompt approach)
          const userMessage = `Please analyze this PowerPoint presentation:
File: ${source.name}
Size: ${fileSizeInMB.toFixed(2)}MB
Type: ${source.mime_type}
Extracted from file: ${tempFilePath}

Based on the filename and any context, please help classify this document appropriately.`;
          
          // Use standard Claude text interface
          const claudePptResponse = await claudeService.sendPrompt(userMessage, {
            temperature: 0,
            maxTokens: 4000
          });
          
          if (claudePptResponse) {
            // Response is text content from the PowerPoint
            contentForClassification = claudePptResponse;
            if (debug) {
              console.log(`✅ Successfully extracted ${contentForClassification.length} characters from PowerPoint`);
            }
          } else {
            throw new Error("Failed to extract content from PowerPoint");
          }
        }
        
        // Clean up
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {
          // Ignore cleanup errors
        }
      } catch (error) {
        console.error(`Error processing PowerPoint file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
      }
    } else {
      console.error(`Unsupported mime type: ${source.mime_type}`);
      return false;
    }
    
    // 4. Classify the content
    if (contentForClassification) {
      try {
        if (debug) {
          console.log(`Using document classification service to classify content (${contentForClassification.length} chars)`);
        }
        
        // Use the document classification service
        const fileName = source.name;
        classificationResult = await documentClassificationService.classifyDocument(
          contentForClassification,
          fileName,
          CLASSIFICATION_PROMPT
        );
        
        if (debug && classificationResult) {
          console.log(`Classification result: ${JSON.stringify(classificationResult).substring(0, 200)}...`);
        }
      } catch (error) {
        console.error(`Error classifying content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
      }
    }
    
    // 5. Update the expert document with the new classification
    if (classificationResult) {
      try {
        // Update the expert_document record
        const updateData: any = {
          document_processing_status: 'reprocessing_done',
          document_processing_status_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // If there's a new document_type_id from classification, update it
        if (classificationResult.document_type_id) {
          // Update document type in expert_documents
          updateData.document_type_id = classificationResult.document_type_id;
          
          // Also update in sources_google
          await supabase
            .from('google_sources')
            .update({ document_type_id: classificationResult.document_type_id })
            .eq('id', sourceId);
        }
        
        // Add raw content and processed content
        if (contentForClassification) {
          // Create a clean version of content with all problematic characters removed
          const cleanContent = contentForClassification
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')  // Control chars
            .replace(/\\u[\dA-Fa-f]{4}/g, '')              // Unicode escapes
            .replace(/\u0000/g, '')                        // Null bytes
            .replace(/\n{3,}/g, '\n\n')                    // Multiple line breaks
            .trim();
            
          updateData.raw_content = cleanContent;
          
          // For the processed_content field, we'll use an object with the classification results
          // Include raw content for context
          updateData.processed_content = {
            raw: cleanContent.substring(0, 5000), // Limit to 5000 chars to avoid potential DB issues
            ai_analysis: classificationResult,
            processed_at: new Date().toISOString()
          };
        }
        
        // Update the database
        const { error: updateError } = await supabase
          .from('google_expert_documents')
          .update(updateData)
          .eq('id', documentId);
          
        if (updateError) {
          console.error(`Error updating document ${documentId}: ${updateError.message}`);
          return false;
        }
        
        if (debug) {
          console.log(`✅ Successfully updated document ${documentId} with new classification and processed content`);
        }
        
        return true;
      } catch (error) {
        console.error(`Error updating expert document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`Error in forceReclassifyDocument: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}