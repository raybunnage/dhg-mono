#!/usr/bin/env ts-node
/**
 * Script to classify PowerPoint documents from Google Drive
 * Downloads PowerPoint (.pptx) files locally, extracts content, and uses 
 * the prompt service with Claude to classify them
 */

import { program } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { Database } from '../../../supabase/types';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { promptService } from '../../../packages/shared/services/prompt-service';
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
import { GoogleDriveService } from '../../../packages/shared/services/google-drive';
import { BatchProcessingService } from '../../../packages/shared/services/batch-processing-service';
import { documentClassificationService } from '../../../packages/shared/services/document-classification-service';
import { pdfProcessorService } from '../../../packages/shared/services/pdf-processor-service';

// Define the prompt name to use for classification
const CLASSIFICATION_PROMPT = 'scientific-powerpoint';

// Define interfaces for typing
interface DocumentType {
  id: string;
  document_type: string;
}

interface ExpertDocument {
  id: string;
  source_id: string;
  document_processing_status: string;
  document_type_id?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // Allow for other properties
}

interface SourceFile {
  id: string;
  name: string;
  drive_id: string;
  document_type_id?: string;
  created_at?: string;
  modified_at?: string;
  size?: number;
  is_deleted: boolean;
  mime_type: string;
  expert_documents?: ExpertDocument[];
  [key: string]: any; // Allow for other properties
}

// Function to map document_type to document_type_id 
async function mapDocumentTypeToId(documentTypeStr: string, supabase: any): Promise<string> {
  // Fetch valid document types from the database
  const { data: documentTypes, error } = await supabase
    .from('document_types')
    .select('id, document_type')
    .order('document_type');

  if (error) {
    console.error(`Error fetching document types: ${error.message}`);
    return '';
  }

  if (!documentTypes || documentTypes.length === 0) {
    console.error('No document types found in database');
    return '';
  }

  // First try exact match
  const exactMatch = documentTypes.find((dt: DocumentType) => 
    dt.document_type.toLowerCase() === documentTypeStr.toLowerCase()
  );

  if (exactMatch) {
    return exactMatch.id;
  }

  // Try partial match if no exact match
  const partialMatch = documentTypes.find((dt: DocumentType) => 
    dt.document_type.toLowerCase().includes(documentTypeStr.toLowerCase()) ||
    documentTypeStr.toLowerCase().includes(dt.document_type.toLowerCase())
  );

  if (partialMatch) {
    return partialMatch.id;
  }

  // For PowerPoint specific matches
  if (documentTypeStr.toLowerCase().includes('presentation') || 
      documentTypeStr.toLowerCase().includes('powerpoint') ||
      documentTypeStr.toLowerCase().includes('slide')) {
    
    const presentationType = documentTypes.find((dt: DocumentType) => 
      dt.document_type.toLowerCase().includes('presentation') ||
      dt.document_type.toLowerCase().includes('powerpoint') ||
      dt.document_type.toLowerCase().includes('slide')
    );
    
    if (presentationType) {
      return presentationType.id;
    }
  }

  // If still no match, try to find a scientific document type as fallback
  const scientificType = documentTypes.find((dt: DocumentType) => 
    dt.document_type.toLowerCase().includes('scientific') ||
    dt.document_type.toLowerCase().includes('research') ||
    dt.document_type.toLowerCase().includes('academic')
  );
  
  if (scientificType) {
    return scientificType.id;
  }

  // Last resort - find the unknown document type
  const unknownType = documentTypes.find((dt: DocumentType) => 
    dt.document_type.toLowerCase() === 'unknown document type' ||
    dt.document_type.toLowerCase() === 'unknown' ||
    dt.document_type.toLowerCase().includes('unclassified')
  );

  if (unknownType) {
    return unknownType.id;
  }

  // If nothing matches, return first document type ID as absolute fallback
  return documentTypes[0].id;
}

// Function to create a fallback classification when extraction or Claude API fails
async function createFallbackClassification(file: SourceFile, supabase: any): Promise<any> {
  // Use the document classification service's createFallbackClassification method
  return documentClassificationService.createFallbackClassification({
    name: file.name || 'Unknown Document',
    mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    size: file.size
  });
}

// Process a single PowerPoint file using the prompt service and Claude
// Returns classification result and extracted text
async function processPowerPointFile(
  fileId: string,
  fileName: string,
  debug: boolean = false,
  supabase: any = null
): Promise<{ classificationResult: any, tempFilePath: string | null, extractedText?: string }> {
  let tempFilePath: string | null = null;
  
  try {
    if (debug) {
      console.log(`Processing PowerPoint file: ${fileName} (ID: ${fileId})`);
    }
    
    // Get Supabase client if not provided
    if (!supabase) {
      supabase = SupabaseClientService.getInstance().getClient();
    }
    
    // Import auth service
    const { GoogleAuthService } = require('../../../packages/shared/services/google-drive/google-auth-service');
    const auth = GoogleAuthService.getInstance();
    
    // Get Google Drive service instance
    const googleDriveService = GoogleDriveService.getInstance(auth, supabase);
    
    // Use the Google Drive API directly to get the PowerPoint binary content
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
    
    // 1. Get file metadata first to confirm it's a PowerPoint file
    const file = await googleDriveService.getFile(fileId);
    if (debug) {
      console.log(`PowerPoint file details: ${JSON.stringify(file, null, 2)}`);
    }
    
    // 2. Download the PowerPoint file
    console.log(`📥 Downloading PowerPoint file from Google Drive...`);
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media',
    }, { responseType: 'arraybuffer' });
    
    if (debug) {
      console.log(`Downloaded PowerPoint, size: ${response.data.byteLength} bytes`);
    } else {
      console.log(`Downloaded PowerPoint file: ${(response.data.byteLength / 1024).toFixed(1)} KB`);
    }
    
    // 3. Save the PowerPoint to a temporary location
    const tempDir = path.join(process.cwd(), 'file_types', 'powerpoints');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create a safe filename for the temporary file
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    tempFilePath = path.join(tempDir, `temp-${safeName}-${fileId.substring(0, 8)}.pptx`);
    
    // Write the file to disk
    fs.writeFileSync(tempFilePath, Buffer.from(response.data));
    
    if (debug) {
      console.log(`Saved temporary PowerPoint file to ${tempFilePath}`);
    }
    
    // 4. Extract text content from the PowerPoint file using multiple methods
    console.log(`🔍 Extracting content from PowerPoint file using multiple extraction methods...`);
    let extractedText = '';
    let extractionSuccess = false;

    // We'll use multiple extraction methods, prioritizing the ones that give better results
    const extractionMethods = [
      // Method 1: office-text-extractor - newest library with dedicated PowerPoint support
      async () => {
        console.log(`Trying extraction method 1: office-text-extractor`);
        const officeTextExtractor = require('office-text-extractor');
        const textExtractor = new officeTextExtractor();
        const extractedContent = await textExtractor.extract(tempFilePath);
        
        if (extractedContent && extractedContent.length > 50) {
          console.log(`✅ office-text-extractor successfully extracted ${extractedContent.length} characters`);
          return `PowerPoint Content (Extracted with office-text-extractor):\n\n${extractedContent}\n\n` +
                 `File Metadata:\nFilename: ${fileName}\nLast Modified: ${file.modifiedTime || 'Unknown'}\n`;
        } else {
          throw new Error("office-text-extractor returned insufficient content");
        }
      },
      
      // Method 2: pptx-text-parser - specialized for PowerPoint extraction
      async () => {
        console.log(`Trying extraction method 2: pptx-text-parser`);
        const pptxTextParser = require('pptx-text-parser');
        const extractedContent = await pptxTextParser.parseFile(tempFilePath, { withJson: true });
        
        if (extractedContent && (
            (typeof extractedContent === 'string' && extractedContent.length > 50) ||
            (typeof extractedContent === 'object' && extractedContent.text && extractedContent.text.length > 50)
        )) {
          const textContent = typeof extractedContent === 'string' ? 
                               extractedContent : 
                               JSON.stringify(extractedContent, null, 2);
                               
          console.log(`✅ pptx-text-parser successfully extracted ${textContent.length} characters`);
          return `PowerPoint Content (Extracted with pptx-text-parser):\n\n${textContent}\n\n` +
                 `File Metadata:\nFilename: ${fileName}\nLast Modified: ${file.modifiedTime || 'Unknown'}\n`;
        } else {
          throw new Error("pptx-text-parser returned insufficient content");
        }
      },
      
      // Method 3: pptx-parser - used in the original implementation
      async () => {
        console.log(`Trying extraction method 3: pptx-parser`);
        const pptxParser = require('pptx-parser');
        const parsedPptx = await pptxParser.parse(tempFilePath);
        
        let content = 'PowerPoint Content (Extracted with pptx-parser):\n\n';
        
        // Extract text from slides
        if (parsedPptx && parsedPptx.slides && parsedPptx.slides.length > 0) {
          // Loop through slides
          parsedPptx.slides.forEach((slide: any, index: number) => {
            content += `Slide ${index + 1}:\n`;
            
            // Add slide title if available
            if (slide.title) {
              content += `Title: ${slide.title}\n`;
            }
            
            // Extract text from slide elements
            if (slide.elements) {
              slide.elements.forEach((element: any) => {
                if (element.type === 'text' && element.text) {
                  content += `- ${element.text}\n`;
                }
              });
            }
            
            content += '\n';
          });
          
          // If the content is longer than 100 characters, consider it valid
          if (content.length > 100) {
            console.log(`✅ pptx-parser successfully extracted ${content.length} characters`);
            return content;
          }
        }
        
        throw new Error("pptx-parser returned insufficient content");
      },
      
      // Method 4: officeparser - general Office file parser
      async () => {
        console.log(`Trying extraction method 4: officeparser`);
        const officeParser = require('officeparser');
        
        // Parse the PowerPoint file
        const officeContent = await new Promise((resolve, reject) => {
          officeParser.parseFile(tempFilePath, (err: any, data: any) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        
        if (officeContent && typeof officeContent === 'string' && officeContent.length > 50) {
          console.log(`✅ officeparser successfully extracted ${officeContent.length} characters`);
          return `PowerPoint Content (Extracted with officeparser):\n\n${officeContent}\n\n` +
                 `File Metadata:\nFilename: ${fileName}\nLast Modified: ${file.modifiedTime || 'Unknown'}\n`;
        } else {
          throw new Error("officeparser returned insufficient content");
        }
      },
      
      // Method 5: Custom ZIP extraction (PowerPoint files are ZIP archives with XML files)
      async () => {
        console.log(`Trying extraction method 5: custom ZIP extraction`);
        const extractZip = require('extract-zip');
        const path = require('path');
        const { v4: uuidv4 } = require('uuid');
        const { readdir, readFile, rm } = require('fs/promises');
        
        // Create a temp directory for extraction
        const extractDir = path.join(tempDir, `extract-${uuidv4()}`);
        if (!fs.existsSync(extractDir)) {
          fs.mkdirSync(extractDir, { recursive: true });
        }
        
        try {
          // Extract the PPTX (which is a ZIP file) to the temp directory
          await extractZip(tempFilePath, { dir: extractDir });
          
          // Look for slide XML files which contain the text content
          const slidesDir = path.join(extractDir, 'ppt', 'slides');
          let slideContent = '';
          
          if (fs.existsSync(slidesDir)) {
            const slideFiles = await readdir(slidesDir);
            
            // Sort files to process slides in order
            slideFiles.sort();
            
            // Process each slide XML file
            for (const slideFile of slideFiles) {
              if (slideFile.startsWith('slide') && slideFile.endsWith('.xml')) {
                const slideFilePath = path.join(slidesDir, slideFile);
                const slideXml = await readFile(slideFilePath, 'utf8');
                
                // Extract text from XML using regex (simple but effective for this purpose)
                const textMatches = slideXml.match(/<a:t>([^<]+)<\/a:t>/g);
                if (textMatches) {
                  slideContent += `Slide ${slideFile.replace(/[^0-9]/g, '')}:\n`;
                  
                  textMatches.forEach((match: string) => {
                    // Extract just the text content between the tags
                    const textContent = match.replace(/<a:t>|<\/a:t>/g, '');
                    if (textContent.trim().length > 0) {
                      slideContent += `- ${textContent.trim()}\n`;
                    }
                  });
                  
                  slideContent += '\n';
                }
              }
            }
          }
          
          // Also check for presentation metadata
          let metadataContent = '';
          const corePropsPath = path.join(extractDir, 'docProps', 'core.xml');
          if (fs.existsSync(corePropsPath)) {
            const coreXml = await readFile(corePropsPath, 'utf8');
            
            // Extract presentation title, subject, creator and other metadata
            const titleMatch = coreXml.match(/<dc:title>([^<]+)<\/dc:title>/);
            const subjectMatch = coreXml.match(/<dc:subject>([^<]+)<\/dc:subject>/);
            const creatorMatch = coreXml.match(/<dc:creator>([^<]+)<\/dc:creator>/);
            const descriptionMatch = coreXml.match(/<dc:description>([^<]+)<\/dc:description>/);
            
            metadataContent += 'PowerPoint Metadata:\n';
            if (titleMatch && titleMatch[1]) metadataContent += `Title: ${titleMatch[1]}\n`;
            if (subjectMatch && subjectMatch[1]) metadataContent += `Subject: ${subjectMatch[1]}\n`;
            if (creatorMatch && creatorMatch[1]) metadataContent += `Creator: ${creatorMatch[1]}\n`;
            if (descriptionMatch && descriptionMatch[1]) metadataContent += `Description: ${descriptionMatch[1]}\n`;
            metadataContent += '\n';
          }
          
          // Check if we extracted enough content
          if (slideContent.length > 100 || (slideContent.length > 50 && metadataContent.length > 0)) {
            console.log(`✅ Custom ZIP extraction successfully extracted ${slideContent.length + metadataContent.length} characters`);
            
            // Cleanup temp directory
            await rm(extractDir, { recursive: true, force: true });
            
            return `PowerPoint Content (Extracted with custom XML parser):\n\n${metadataContent}${slideContent}\n` +
                   `File Metadata:\nFilename: ${fileName}\nLast Modified: ${file.modifiedTime || 'Unknown'}\n`;
          } else {
            // Cleanup temp directory
            await rm(extractDir, { recursive: true, force: true });
            throw new Error("Custom ZIP extraction returned insufficient content");
          }
        } catch (error) {
          // Cleanup temp directory even if there was an error
          try {
            await rm(extractDir, { recursive: true, force: true });
          } catch (cleanupError) {
            console.warn('Error cleaning up temp directory:', cleanupError);
          }
          throw error;
        }
      }
    ];
    
    // Try each extraction method in sequence until one succeeds
    for (const extractionMethod of extractionMethods) {
      try {
        extractedText = await extractionMethod();
        extractionSuccess = true;
        break; // Exit the loop if extraction succeeded
      } catch (error) {
        console.warn(`Extraction method failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Continue to the next method
      }
    }
    
    // If all extraction methods failed, throw an error
    if (!extractionSuccess) {
      throw new Error("All PowerPoint extraction methods failed. Unable to extract content from this file.");
    }
    
    // Display a sample of the extracted content
    console.log('\n📄 Sample of extracted PowerPoint content:');
    console.log('----------------------------------------');
    
    // Show just the first few lines of extracted content
    const contentSample = extractedText.split('\n').slice(0, 20).join('\n');
    console.log(contentSample);
    console.log('----------------------------------------');
    
    // Print the total number of characters extracted
    console.log(`📊 Total extracted content: ${extractedText.length} characters`);
    console.log('----------------------------------------\n');
    
    // 5. Use the prompt service to load the scientific document analysis prompt
    console.log(`🧠 Loading scientific PowerPoint classification prompt...`);
    const promptResult = await promptService.loadPrompt(CLASSIFICATION_PROMPT, {
      includeDatabaseQueries: true,  // Include the SQL query to fetch document types
      executeQueries: true,          // Actually execute the query to get document types
      includeRelationships: true,    // Include related database relationships
      includeRelatedFiles: true      // Include any related files
    });
    
    // Log a sample of the document types that were loaded with the prompt
    if (debug) {
      try {
        const promptLines = promptResult.combinedContent.split('\n');
        const documentTypesLineIndex = promptLines.findIndex(line => 
          line.includes('select id, category, document_type, description') || 
          line.includes('AVAILABLE DOCUMENT TYPES')
        );
        
        if (documentTypesLineIndex >= 0) {
          // Show 5 lines after document types are mentioned
          console.log('Document types query or listing included in prompt:');
          for (let i = documentTypesLineIndex; i < documentTypesLineIndex + 6 && i < promptLines.length; i++) {
            console.log(`  ${promptLines[i]}`);
          }
          console.log('  ...');
        }
      } catch (err) {
        // Just log the error but continue with classification
        console.warn('Error extracting document types from prompt (non-critical):', err);
      }
    }
    
    if (debug) {
      console.log(`Loaded prompt with ${promptResult.combinedContent.length} characters of combined content`);
    }
    
    // 6. Prepare the user message for Claude with the extracted PowerPoint content
    const userMessage = `${promptResult.combinedContent}

    Please analyze this PowerPoint presentation content:
    
    ${extractedText}
    
    1. Examine the content, structure, and purpose of this PowerPoint presentation.
    2. Determine which document_type from the document_types table best describes it.
    3. Create a detailed summary that captures the key concepts.
    4. Suggest a clear PowerPoint slide organization to effectively present this content.
    5. Return your analysis in the requested JSON format with document_type, document_type_id, etc.
    
    IMPORTANT: 
    - Select the most appropriate document_type_id from the available options in the document_types table
    - Base your classification on the extracted content, not just the filename
    - The document_type should be a string (e.g., "scientific presentation") 
    - Leave the document_type_id field empty (""), it will be filled by the system
    - Provide detailed reasoning for your classification choice in the classification_reasoning field
    - Include clinical implications and unique insights as specified in the output format
    `;
    
    // 7. Get classification from Claude
    console.log(`🤖 Sending PowerPoint content to Claude API for analysis...`);
    let classificationResult;
    let retries = 0;
    const maxRetries = 5; // Increased from 3 to 5 to handle more retries for rate limiting
    
    // Function to add random jitter to backoff time to prevent all concurrent jobs
    // from retrying at the same time after rate limiting
    const getBackoffTimeWithJitter = (retryCount: number) => {
      // Base backoff time with exponential increase: 2^n seconds
      const baseBackoff = Math.pow(2, retryCount) * 1000;
      // Add random jitter (±30% of the base time)
      const jitter = baseBackoff * 0.3 * (Math.random() * 2 - 1);
      return baseBackoff + jitter;
    };
    
    while (retries < maxRetries) {
      try {
        if (debug) {
          console.log(`Using Claude to classify PowerPoint content (attempt ${retries + 1}/${maxRetries})`);
        }
        
        // For concurrent jobs, it's good to add a small random delay before making API calls
        // This helps distribute the calls and reduce likelihood of hitting rate limits
        if (retries === 0) {
          const initialDelay = Math.floor(Math.random() * 2000); // Random delay 0-2 seconds
          if (initialDelay > 100) {
            if (debug) {
              console.log(`Adding initial delay of ${initialDelay}ms to stagger API calls`);
            }
            await new Promise(resolve => setTimeout(resolve, initialDelay));
          }
        }
        
        // Use document classification service to classify the content
        classificationResult = await documentClassificationService.classifyDocument(
          extractedText,
          file.name,
          CLASSIFICATION_PROMPT
        );
        
        // Always show success message
        console.log(`✅ Successfully analyzed PowerPoint content with Claude`);
        
        if (debug) {
          console.log(`Document type assigned: ${classificationResult.document_type || 'Unknown'}`);
        }
        
        // If we got here, the API call succeeded
        break;
      } catch (claudeError) {
        retries++;
        const errorMessage = claudeError instanceof Error ? claudeError.message : 'Unknown error';
        
        // Check if this is a connection error (ECONNRESET)
        const isConnectionError = errorMessage.includes('ECONNRESET') || 
                                errorMessage.includes('timeout') ||
                                errorMessage.includes('network') ||
                                errorMessage.includes('socket');
        
        // Check if it's a rate-limiting or overload error
        const isRateLimitError = errorMessage.includes('429') || 
                               errorMessage.includes('too many requests') ||
                               errorMessage.includes('rate limit') ||
                               errorMessage.includes('Overloaded') ||
                               errorMessage.includes('quota exceeded');
                               
        // Check if it's a connection or rate-limiting error
        if (isConnectionError || isRateLimitError) {
          // Better error messages for rate limiting specifically
          if (isRateLimitError) {
            console.warn(`⚠️ Claude API rate limit reached (retry ${retries}/${maxRetries}): ${errorMessage}`);
          } else {
            console.warn(`⚠️ Claude API connection error (retry ${retries}/${maxRetries}): ${errorMessage}`);
          }
          
          if (retries < maxRetries) {
            // Add exponential backoff with jitter between retries
            // This helps avoid "thundering herd" problem when multiple processes hit rate limits
            const backoffTime = getBackoffTimeWithJitter(retries);
            
            console.log(`Waiting ${Math.round(backoffTime/1000)} seconds before retrying...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
          } else {
            console.error(`Maximum retries (${maxRetries}) reached. Aborting classification.`);
            throw new Error(`Claude API failed after ${maxRetries} attempts. Please try again later.`);
          }
        } else {
          // For other types of errors, don't retry
          console.error(`Non-retryable Claude API error: ${errorMessage}`);
          throw new Error(`Claude API error: ${errorMessage}`);
        }
      }
    }
    
    // Validate that we have a usable classification result
    if (!classificationResult || !classificationResult.document_type) {
      throw new Error("Failed to get a valid classification result from Claude");
    }
    
    if (debug) {
      console.log('Classification result:', classificationResult);
    }
    
    // Return the classification result, temp file path, and extracted text
    return { 
      classificationResult, 
      tempFilePath,
      extractedText 
    };
  } catch (error) {
    console.error(`❌ Error processing PowerPoint file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('This is a critical error. Aborting this file processing.');
    
    // Clean up any temporary files before re-throwing the error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Cleaned up temporary file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.warn(`Warning: Failed to clean up temporary file: ${cleanupError}`);
      }
    }
    
    // Re-throw the error to handle it at a higher level
    throw new Error(`PowerPoint extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Function to clean up temporary files
function cleanupTempFiles(filePaths: string[]): void {
  for (const filePath of filePaths) {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.warn(`Failed to delete temporary file ${filePath}: ${err}`);
      }
    }
  }
}

// Simple helper for running promises with concurrency control
async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<R>,
  progressCallback?: (current: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];
  let currentIndex = 0;
  const total = items.length;

  // Process the next item in the queue
  async function processNext(): Promise<void> {
    const index = currentIndex++;
    if (index >= total) return;

    try {
      const result = await processor(items[index], index);
      results[index] = result; // Store the result at the correct index
      
      if (progressCallback) {
        progressCallback(index + 1, total);
      }

      // Process the next item
      await processNext();
    } catch (error) {
      console.error(`Error processing item at index ${index}:`, error);
      // Even if there's an error, try to process the next item
      await processNext();
    }
  }

  // Start processing up to 'concurrency' items in parallel
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, total); i++) {
    workers.push(processNext());
  }

  // Wait for all workers to complete
  await Promise.all(workers);
  
  return results;
}

// Main classification function with batch processing and concurrency
async function classifyPowerPointDocuments(
  limit: number,
  folderId?: string,
  outputPath?: string,
  debug: boolean = false,
  dryRun: boolean = false,
  concurrency: number = 2, // Default concurrency of 2 (PowerPoint extraction can be resource-intensive)
  force: boolean = false // Force reprocessing even if files already have content
): Promise<SourceFile[]> {
  const tempFiles: string[] = [];
  
  try {
    // 1. Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // 2. Build query for PowerPoint files that need processing or reprocessing
    // Find all PowerPoint files in the database
    // We're selecting all fields explicitly to avoid TypeScript issues
    let query = supabase
      .from('google_sources')
      .select('id, name, drive_id, document_type_id, created_at, modified_at, size, is_deleted, mime_type')
      .is('is_deleted', false)
      .eq('mime_type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
      .order('modified_at', { ascending: false });
      
    // No limit here - we'll get all PowerPoint files first, then filter those that need processing
      
    if (debug) {
      console.log('Querying PowerPoint files from sources_google...');
    }
    
    // Filter by folder if provided
    if (folderId) {
      if (folderId.length < 36) {
        // It's likely a folder name, look it up
        if (debug) {
          console.log(`Looking up folder ID for name: ${folderId}`);
        }
        
        const { data: folders } = await supabase
          .from('google_sources')
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
    
    // 3. Execute the query
    const { data: files, error } = await query;
    
    if (error) {
      throw new Error(`Error fetching PowerPoint files: ${error.message}`);
    }
    
    // Cast the files to our SourceFile type
    const sourceFiles: SourceFile[] = files || [];
    
    // 4. Manually fetch expert documents for these files
    if (sourceFiles && sourceFiles.length > 0) {
      const sourceIds = sourceFiles.map(file => file.id);
      const { data: expertDocuments, error: expertError } = await supabase
        .from('google_expert_documents')
        .select('*')
        .in('source_id', sourceIds);
        
      if (expertError) {
        console.warn(`Warning: Could not fetch expert documents: ${expertError.message}`);
      } else if (expertDocuments && expertDocuments.length > 0) {
        // Attach expert documents to their source files
        for (const file of sourceFiles) {
          file.expert_documents = expertDocuments.filter(doc => doc.source_id === file.id);
        }
        console.log(`Attached ${expertDocuments.length} expert documents to ${sourceFiles.length} PowerPoint files`);
      } else {
        console.log(`No expert documents found for the ${sourceFiles.length} PowerPoint files`);
        // Initialize empty expert_documents array for each file
        sourceFiles.forEach(file => { file.expert_documents = []; });
      }
    }
    
    if (!sourceFiles || sourceFiles.length === 0) {
      console.log('No PowerPoint files found in sources_google');
      return [];
    }
    
    if (debug) {
      console.log(`Found ${sourceFiles.length} PowerPoint files in sources_google`);
    }
    
    // Process PowerPoint files that need classification or are missing expert document content
    let filesToProcess: SourceFile[] = [];
    
    if ((dryRun && debug) || force) {
      // Force mode - process all files regardless of their current status
      if (force) {
        console.log(`FORCE MODE: Processing files regardless of existing content`);
      } else {
        console.log(`TESTING MODE: Processing first PowerPoint file regardless of content status`);
      }
      // Use the specified limit
      filesToProcess = sourceFiles.slice(0, limit);
    } else {
      // Normal mode: check which files need processing
      console.log(`Checking which PowerPoint files need content extraction and classification...`);
      
      // For simplicity, we'll use a simpler approach that doesn't involve concurrent locking
    // This is more straightforward and reliable, especially for TS type issues
      
    // Get PowerPoint files that need processing
    for (const file of sourceFiles) {
      // Check if file has needs_reprocessing status
      if (file.expert_documents && file.expert_documents.length > 0 && 
          file.expert_documents[0].document_processing_status === 'needs_reprocessing') {
        if (debug) {
          console.log(`File ${file.name} (${file.id}) has needs_reprocessing status, will reprocess`);
        }
        filesToProcess.push(file);
        if (filesToProcess.length >= limit) break; // Stop once we have enough files
        continue;
      }
      
      // Check if file has document_type_id first
      if (!file.document_type_id) {
        if (debug) {
          console.log(`File ${file.name} (${file.id}) has no document_type_id, needs processing`);
        }
        filesToProcess.push(file);
        if (filesToProcess.length >= limit) break; // Stop once we have enough files
        continue;
      }
        
        // Check for corresponding expert_documents with content
        const { data: expertDocs, error: expertError } = await supabase
          .from('google_expert_documents')
          .select('id, raw_content, processed_content, classification_confidence')
          .eq('source_id', file.id);
          
        if (expertError) {
          console.error(`Error fetching expert_documents for file ${file.id}: ${expertError.message}`);
          // If we can't check, assume it needs processing
          filesToProcess.push(file);
          if (filesToProcess.length >= limit) break; // Stop once we have enough files
          continue;
        }
        
        // No expert documents found - file needs processing
        if (!expertDocs || expertDocs.length === 0) {
          if (debug) {
            console.log(`File ${file.name} (${file.id}) has no expert_documents, needs processing`);
          }
          filesToProcess.push(file);
          if (filesToProcess.length >= limit) break; // Stop once we have enough files
          continue;
        }
        
        // Check if any expert document has proper content
        let hasGoodContent = false;
        
        for (const doc of expertDocs) {
          // Check for meaningful content - not just error messages
          const hasRawContent = doc.raw_content && 
                               doc.raw_content.length > 200 && 
                               !doc.raw_content.includes("Failed to extract content");
                               
          const hasProcessedContent = doc.processed_content && 
                                     typeof doc.processed_content === 'object' &&
                                     doc.processed_content.document_summary;
                                     
          // Check if confidence is high enough (above 0.7)
          const hasGoodConfidence = doc.classification_confidence && 
                                   doc.classification_confidence > 0.7;
                                   
          if (hasRawContent && hasProcessedContent && hasGoodConfidence) {
            hasGoodContent = true;
            break;
          }
        }
        
        // If no good content found, file needs processing
        if (!hasGoodContent) {
          if (debug) {
            console.log(`File ${file.name} (${file.id}) has expert_documents but needs better content, will process`);
          }
          filesToProcess.push(file);
          if (filesToProcess.length >= limit) break; // Stop once we have enough files
        } else if (debug) {
          console.log(`File ${file.name} (${file.id}) already has good expert_documents content, skipping`);
          
          // Clear the processing status for files we won't process
          await supabase
            .from('google_sources')
            .update({ processing_status: null, processing_started_at: null })
            .eq('id', file.id);
        }
      }
      
      // We'll skip the stuck files check for simplicity
      // If we need more files, just get more from the standard query
      if (filesToProcess.length < limit) {
        if (debug) {
          console.log(`Need more files to process (have ${filesToProcess.length}, need ${limit})`);
        }
      }
    }
    
    console.log(`Found ${filesToProcess.length || 0} PowerPoint files that need content processing`);
    
    if (!filesToProcess || filesToProcess.length === 0) {
      return [];
    }
    
    // Apply the limit to the files we'll actually process
    if (limit > 0 && filesToProcess.length > limit) {
      console.log(`Limiting processing to the first ${limit} files`);
      filesToProcess = filesToProcess.slice(0, limit);
    }
    
    // Process files with concurrency
    console.log(`Processing ${filesToProcess.length} PowerPoint files with concurrency of ${concurrency}`);
    
    // Process a single file
    const processFile = async (file: any, index: number): Promise<any> => {
      // Always show progress, regardless of debug mode
      console.log(`\n===============================================`);
      console.log(`🔄 Processing file ${index+1}/${filesToProcess.length}: ${file.name}`);
      console.log(`📋 File ID: ${file.id}, Drive ID: ${file.drive_id}`);
      
      // Display file date information
      console.log(`📅 File created: ${new Date(file.created_at).toLocaleString()}`);
      console.log(`📅 File modified: ${new Date(file.modified_at).toLocaleString()}`);
      if (file.size) {
        console.log(`📊 File size: ${(file.size / 1024).toFixed(2)} KB`);
      }
      console.log(`===============================================\n`);
      
      try {
        // Process the file
        console.log(`[${index+1}/${filesToProcess.length}] ⏳ Processing PowerPoint file...`);
        
        const result = await processPowerPointFile(
          file.drive_id,
          file.name || '',
          debug,
          supabase
        );
        
        const { classificationResult, tempFilePath, extractedText } = result;
        
        // Add any temporary files to cleanup list
        if (tempFilePath) {
          tempFiles.push(tempFilePath);
        }
        
        // Show classification result
        console.log(`\n[${index+1}/${filesToProcess.length}] ✅ Classification successful:`);
        console.log(`   Type: ${classificationResult.document_type}`);
        const confidence = classificationResult.classification_confidence || 0.85;
        console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);
        
        // Only update the database if not in dry run mode
        if (!dryRun) {
          console.log(`\n📝 Updating database with classification results...`);
          
          // First, map the document_type string to a document_type_id
          if (!classificationResult.document_type_id && classificationResult.document_type) {
            console.log(`➡️ Mapping document_type "${classificationResult.document_type}" to a document_type_id...`);
            classificationResult.document_type_id = await mapDocumentTypeToId(
              classificationResult.document_type,
              supabase
            );
            console.log(`✅ Mapped to document_type_id: ${classificationResult.document_type_id}`);
          }
          
          if (!classificationResult.document_type_id) {
            throw new Error(`No valid document_type_id could be determined for ${file.name}`);
          }
          
          // Update document type in sources_google
          console.log(`➡️ Updating document_type_id in sources_google table...`);
          const { error: updateError } = await supabase
            .from('google_sources')
            .update({ document_type_id: classificationResult.document_type_id })
            .eq('id', file.id);
          
          if (updateError) {
            throw new Error(`Error updating document type: ${updateError.message}`);
          }
          
          console.log(`✅ Successfully updated document_type_id in sources_google`);
          
          // Create expert document record
          console.log(`➡️ Creating expert_document record with extracted content...`);
          
          // Define an interface for the expert document that includes all fields
          interface ExpertDocument {
            id: string;
            source_id: string;
            document_type_id: string;
            classification_confidence: number;
            created_at: string;
            updated_at: string;
            raw_content?: string;
            processed_content: any;
            classification_metadata: any;
            document_processing_status?: string;
            document_processing_status_updated_at?: string;
          }
          
          // Create expert document with extracted content
          const expertDoc: ExpertDocument = {
            id: uuidv4(),
            source_id: file.id,
            document_type_id: "957d8720-473e-4820-b115-88d6a931a7d8", // Expert document document_type_id
            classification_confidence: classificationResult.classification_confidence || 0.85,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            raw_content: extractedText, // Use the already extracted content
            processed_content: classificationResult, // Store the full classification result
            classification_metadata: classificationResult // Also store in classification_metadata
          };
          
          // If this file needed reprocessing, mark it as "reprocessing_done"
          if (file.expert_documents && file.expert_documents.length > 0 && 
              file.expert_documents[0].document_processing_status === 'needs_reprocessing') {
            expertDoc.document_processing_status = 'reprocessing_done';
            expertDoc.document_processing_status_updated_at = new Date().toISOString();
            console.log(`Marking file ${file.name} as "reprocessing_done"`);
          }
          
          if (debug) {
            console.log(`Raw content length: ${(expertDoc.raw_content as string).length} characters`);
            console.log(`Document type ID: ${expertDoc.document_type_id}`);
          }
          
          // Insert the expert document
          const { error: insertError } = await supabase
            .from('google_expert_documents')
            .insert(expertDoc)
            .select();
            
          if (insertError) {
            throw new Error(`Error creating expert document: ${insertError.message}`);
          }
          
          console.log(`✅ Successfully created expert_document record`);
        } else {
          console.log(`\n🔍 DRY RUN: No database updates performed`);
          console.log(`   Would have updated sources_google.document_type_id`);
          console.log(`   Would have created an expert_documents record with ${extractedText ? extractedText.length : 0} characters`);
        }
        
        // Save individual result to output directory if specified
        if (outputPath) {
          const outputDir = path.dirname(outputPath);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // Write individual result to file
          const filePath = path.join(outputDir, `${file.id}.json`);
          fs.writeFileSync(filePath, JSON.stringify(classificationResult, null, 2));
          
          console.log(`💾 Saved classification result to ${filePath}`);
        }
        
        console.log(`\n[${index+1}/${filesToProcess.length}] ✅ Processing complete for ${file.name}`);
        
        // Return successful result
        return {
          file,
          result: classificationResult,
          extractedTextLength: extractedText ? extractedText.length : 0,
          status: 'completed'
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`\n❌ [${index+1}/${filesToProcess.length}] Error processing file ${file.name}:`);
        console.error(`   ${errorMessage}`);
        
        if (debug && error instanceof Error && error.stack) {
          console.error(`\nStack trace:\n${error.stack}`);
        }
        
        console.log(`\n[${index+1}/${filesToProcess.length}] ⚠️ Skipping to next file due to error`);
        
        // Return error result
        return {
          file,
          result: null,
          status: 'failed',
          error: errorMessage
        };
      }
    };
    
    // Process all files with concurrency
    const results = await processWithConcurrency(
      filesToProcess,
      concurrency,
      processFile,
      (current, total) => {
        if (debug) {
          const percentage = Math.round((current / total) * 100);
          console.log(`Progress: ${percentage}% (${current}/${total})`);
        }
      }
    );
    
    // We're not using processing status anymore, so no need to clean up
    
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
        dry_run: dryRun,
        total_files: results.length,
        results
      };
      
      // Write to file
      fs.writeFileSync(outputPath, JSON.stringify(combined, null, 2));
      console.log(`Results saved to ${outputPath}`);
    }
    
    // Clean up temporary files
    cleanupTempFiles(tempFiles);
    
    return results;
  } catch (error) {
    console.error(`Error classifying PowerPoint documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Clean up temporary files even if there was an error
    cleanupTempFiles(tempFiles);
    
    // We're not using processing status anymore, so no cleanup needed
    
    return [];
  }
}

// Define CLI program
program
  .name('classify-powerpoints')
  .description('Classify PowerPoint (.pptx) files missing document types using content extraction and the PromptService')
  .option('-l, --limit <number>', 'Limit the number of files to process', '5')
  .option('-o, --output <path>', 'Output file path for classification results')
  .option('-d, --debug', 'Enable debug logging', false)
  .option('-v, --verbose', 'Enable verbose logging (includes debug)', false)
  .option('--dry-run', 'Process files but do not update database', false)
  .option('--folder-id <id>', 'Filter by Google Drive folder ID or folder name', '')
  .option('-c, --concurrency <number>', 'Number of files to process concurrently (default: 2)', '2')
  .option('-f, --force', 'Force reprocessing even if files already have content', false)
  .action(async (options) => {
    try {
      // Set debug mode if verbose is enabled
      const debug = options.debug || options.verbose;
      const dryRun = options.dryRun;
      
      // Show header
      console.log('='.repeat(70));
      console.log('POWERPOINT DOCUMENT CLASSIFICATION');
      console.log('='.repeat(70));
      
      // Parse limit and concurrency
      const limit = parseInt(options.limit, 10);
      const concurrency = parseInt(options.concurrency, 10);
      
      // Show detailed configuration
      console.log(`Mode:              ${dryRun ? '🔍 DRY RUN (no database changes)' : '💾 LIVE (updating database)'}`);
      console.log(`Debug logs:        ${debug ? '✅ ON' : '❌ OFF'}`);
      console.log(`Force reprocess:   ${options.force ? '✅ ON' : '❌ OFF'}`);
      console.log(`Concurrency:       ${concurrency} files at a time`);
      console.log(`Max files:         ${limit}`);
      console.log(`Folder filter:     ${options.folderId ? options.folderId : 'All folders'}`);
      console.log(`Output file:       ${options.output ? options.output : 'None specified'}`);
      console.log('-'.repeat(70));
      console.log(`Using local content extraction and Claude API to analyze PowerPoint content`);
      console.log(`This may take some time, especially for large PowerPoint files`);
      console.log(`Each PowerPoint will be processed one by one, with progress updates`);
      console.log('='.repeat(70));
      
      const results = await classifyPowerPointDocuments(
        limit,
        options.folderId || '',
        options.output,
        debug,
        dryRun,
        concurrency,
        options.force
      );
      
      // Show summary
      console.log('\n' + '='.repeat(80));
      console.log('POWERPOINT CLASSIFICATION SUMMARY');
      console.log('='.repeat(80));
      const successCount = results.filter(r => r.result).length;
      console.log(`✅ Successfully processed: ${successCount} / ${results.length} PowerPoint files`);
      
      if (successCount < results.length) {
        console.log(`❌ Failed to process: ${results.length - successCount} files`);
      }
      
      // Calculate total extracted text
      const totalExtractedChars = results.reduce((total, r) => 
        total + (r.extractedTextLength || 0), 0);
      
      console.log(`📊 Total extracted content: ${totalExtractedChars} characters`);
      console.log(`💾 Average content per file: ${Math.round(totalExtractedChars / successCount)} characters`);
      
      if (dryRun) {
        console.log(`\n🔍 DRY RUN: No database changes were made`);
      } else {
        console.log(`\n💾 Database updates: ${successCount} files updated with classifications`);
        console.log(`📋 Expert documents: ${successCount} expert_documents records created or updated`);
      }
      
      // Show results table
      console.log('\n📋 DETAILED RESULTS:');
      console.log('-'.repeat(100));
      console.log('| File ID                               | File Name                  | Status    | Document Type               |');
      console.log('-'.repeat(100));
      
      results.forEach(r => {
        const id = r.file.id.substring(0, 36).padEnd(36);
        const name = (r.file.name || 'Unknown').substring(0, 25).padEnd(25);
        const status = r.result ? '✅ Success' : '❌ Failed';
        const docType = r.result?.document_type ? r.result.document_type.substring(0, 28).padEnd(28) : 'N/A'.padEnd(28);
        console.log(`| ${id} | ${name} | ${status.padEnd(9)} | ${docType} |`);
      });
      
      console.log('-'.repeat(100));
      
      // Show error details if any
      const failedResults = results.filter(r => !r.result);
      if (failedResults.length > 0) {
        console.log('\n⚠️ ERROR DETAILS:');
        failedResults.forEach((r, i) => {
          console.log(`\n${i+1}. File: ${r.file.name}`);
          console.log(`   Error: ${r.error || 'Unknown error'}`);
        });
      }
      
      if (options.output) {
        console.log(`\n💾 Full results saved to: ${options.output}`);
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (options.verbose) {
        console.error('Stack trace:', (error as Error).stack);
      }
      process.exit(1);
    }
  });

// Export for module usage
export async function classifyPowerpointsWithService(options: {
  limit?: number;
  folderId?: string;
  outputPath?: string;
  debug?: boolean;
  dryRun?: boolean;
  concurrency?: number;
  force?: boolean;
}): Promise<any[]> {
  const {
    limit = 5,
    folderId = '',
    outputPath,
    debug = false,
    dryRun = false,
    concurrency = 2,
    force = false
  } = options;
  
  return classifyPowerPointDocuments(
    limit,
    folderId,
    outputPath,
    debug,
    dryRun,
    concurrency,
    force
  );
}

// Run CLI if this module is executed directly
if (require.main === module) {
  program.parse();
}