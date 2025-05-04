/**
 * Test Document Classification Types
 * 
 * This script tests the document classification process by:
 * 1. Fetching document types from the database
 * 2. Selecting a few sample document types
 * 3. Formatting them for Claude AI
 * 4. Sending them to Claude to verify they're properly received
 * 5. Testing on real documents to check Claude's classification
 */

import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { config, Logger } from '../../../packages/shared/utils';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabase = SupabaseClientService.getInstance();

interface DocumentType {
  id: string;
  document_type: string;
  description: string | null;
  category: string;
}

/**
 * Get document types from database
 */
async function getDocumentTypes(): Promise<DocumentType[]> {
  try {
    const client = supabase.getClient();
    const { data, error } = await client
      .from('document_types')
      .select('id, document_type, description, category')
      .order('document_type');
    
    if (error) {
      Logger.error('Error fetching document types:', error);
      return [];
    }
    
    Logger.info(`Fetched ${data.length} document types from the database`);
    return data as DocumentType[];
  } catch (error) {
    Logger.error('Error in getDocumentTypes:', error);
    return [];
  }
}

/**
 * Read a file
 */
async function readFile(filePath: string): Promise<string | null> {
  try {
    const rootDir = process.env.ROOT_DIR || '/Users/raybunnage/Documents/github/dhg-mono';
    Logger.info(`Reading file: ${filePath}`);
    Logger.info(`Full path: ${path.join(rootDir, filePath)}`);
    const fullPath = path.join(rootDir, filePath);
    return fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    Logger.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Get transcript files to test with
 */
async function getTestTranscripts(): Promise<string[]> {
  try {
    // Select 5 transcript files to test with
    const client = supabase.getClient();
    const { data, error } = await client
      .from('documentation_files')
      .select('file_path')
      .like('file_path', '%transcript.txt')
      .limit(5);
    
    if (error) {
      Logger.error('Error fetching transcripts:', error);
      return [];
    }
    
    return data.map((file: { file_path: string }) => file.file_path);
  } catch (error) {
    Logger.error('Error getting test transcripts:', error);
    return [];
  }
}

/**
 * Test Document Classification with Claude
 */
async function testClassification(documentTypes: DocumentType[], testFiles: string[]): Promise<void> {
  try {
    // Take 10 sample document types to display
    const sampleTypes = documentTypes.slice(0, 10);
    
    Logger.info('\n===== Sample Document Types =====');
    sampleTypes.forEach(type => {
      Logger.info(`ID: ${type.id}`);
      Logger.info(`Type: ${type.document_type}`);
      Logger.info(`Description: ${type.description}`);
      Logger.info(`Category: ${type.category}`);
      Logger.info('-------------------');
    });
    
    // Format document types for Claude prompt
    const documentTypesText = documentTypes.map(type => 
      `- ${type.document_type}: ${type.description || 'No description available'} (Category: ${type.category})`
    ).join('\n');
    
    // Create a simple prompt to test if Claude is receiving the document types
    const promptTestDocumentTypes = `
    You are a document classification system. I'm going to show you a list of document types.
    Just confirm you can see all these document types by responding with:
    1. The total count of document types you see
    2. A summary of the categories you notice (group them)
    3. 5 examples of document types that seem most distinctive
    
    Document Types:
    ${documentTypesText}
    
    Please provide your response in JSON format with fields: 
    totalCount, categories, and distinctiveTypes (array of 5 strings)
    `;
    
    Logger.info('\n===== Testing Document Types with Claude =====');
    const claudeResponse = await claudeService.getJsonResponse<any>(promptTestDocumentTypes);
    
    Logger.info('Claude Response:');
    Logger.info(`Total Document Types: ${claudeResponse.totalCount}`);
    Logger.info(`Categories: ${claudeResponse.categories}`);
    Logger.info('Distinctive Types:');
    claudeResponse.distinctiveTypes.forEach((type: string) => {
      Logger.info(`- ${type}`);
    });
    
    // Now test with actual files
    if (testFiles.length > 0) {
      Logger.info('\n===== Testing with Real Files =====');
      
      for (const filePath of testFiles) {
        const content = await readFile(filePath);
        
        if (!content) {
          Logger.error(`Could not read content for ${filePath}`);
          continue;
        }
        
        Logger.info(`\nTesting Classification for: ${filePath}`);
        
        // Create classification prompt
        const classificationPrompt = `
        You are a document classification system. Analyze the document content below and identify the most appropriate document type from the provided list.
        
        Document Types:
        ${documentTypesText}
        
        Document Details:
        - Title: ${path.basename(filePath)}
        - Path: ${filePath}
        
        The document content is between the triple hyphens:
        ---
        ${content.substring(0, 8000)} ${content.length > 8000 ? '... (content truncated)' : ''}
        ---
        
        Please provide your classification in the following JSON format:
        {
          "document_type": "Name of the most appropriate document type",
          "confidence": "High/Medium/Low",
          "reasoning": "Brief explanation of why this document type was selected"
        }
        `;
        
        // Classify with Claude
        const classification = await claudeService.getJsonResponse<any>(classificationPrompt);
        
        Logger.info('Classification Result:');
        Logger.info(`Document Type: ${classification.document_type}`);
        Logger.info(`Confidence: ${classification.confidence}`);
        Logger.info(`Reasoning: ${classification.reasoning}`);
      }
    }
    
  } catch (error) {
    Logger.error('Error testing classification:', error);
  }
}

/**
 * Run the test
 */
async function runTest(): Promise<void> {
  try {
    Logger.info('Starting document classification test');
    
    // Get document types
    const documentTypes = await getDocumentTypes();
    if (documentTypes.length === 0) {
      Logger.error('No document types found in the database.');
      process.exit(1);
    }
    
    // Get test files
    const testFiles = await getTestTranscripts();
    
    // Run test
    await testClassification(documentTypes, testFiles);
    
    Logger.info('Test completed');
    
  } catch (error) {
    Logger.error('Error in test:', error);
    process.exit(1);
  }
}

// Run the test
runTest();