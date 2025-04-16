/**
 * Test Google Doc Classification
 * 
 * This script tests the document classification process for Google Drive files by:
 * 1. Fetching document types from the database
 * 2. Getting 6 files from sources_google table with null document_type_id
 * 3. Downloading the files from Google Drive
 * 4. Sending them to Claude to classify
 * 5. Showing the classification results (without updating the database)
 */

import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { config, Logger } from '../../../packages/shared/utils';
import { GoogleDriveService } from '../../../packages/shared/services/google-drive/google-drive-service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';

// Initialize services
const supabase = SupabaseClientService.getInstance();
import GoogleAuthService from '../../../packages/shared/services/google-drive/google-auth-service';
import { getGoogleDriveService } from '../../../packages/shared/services/google-drive';

// Create auth service
const googleAuth = GoogleAuthService.getDefaultInstance();
// Get Google Drive service
const googleDrive = getGoogleDriveService(supabase.getClient());

interface DocumentType {
  id: string;
  document_type: string;
  description: string | null;
  category: string;
}

interface GoogleSourceFile {
  id: string;
  name: string;
  drive_id: string;
  mime_type: string;
  path: string | null;
  web_view_link: string | null;
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
 * Get untyped Google Drive files
 */
async function getUntypedGoogleFiles(limit: number = 6): Promise<GoogleSourceFile[]> {
  try {
    Logger.info(`Fetching ${limit} untyped Google Drive files...`);
    
    const client = supabase.getClient();
    const { data, error } = await client
      .from('sources_google')
      .select('id, name, drive_id, mime_type, path, web_view_link')
      .is('document_type_id', null)
      .not('mime_type', 'eq', 'application/vnd.google-apps.folder') // Exclude folders
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      Logger.error('Error fetching untyped Google files:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      Logger.info('No untyped Google files found.');
      return [];
    }
    
    Logger.info(`Found ${data.length} untyped Google files.`);
    
    return data as GoogleSourceFile[];
  } catch (error) {
    Logger.error('Error in getUntypedGoogleFiles:', error);
    return [];
  }
}

/**
 * Download file from Google Drive
 */
async function downloadGoogleFile(file: GoogleSourceFile): Promise<string | null> {
  try {
    if (!file.drive_id) {
      Logger.error(`No drive_id found for file ${file.name}`);
      return null;
    }
    
    Logger.info(`Downloading file: ${file.name} (${file.drive_id})`);
    
    // Create a temporary directory
    const tempDir = path.join(os.tmpdir(), 'google-doc-classification');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Generate a random file name based on the original name
    const fileExtension = path.extname(file.name || '') || '.tmp';
    const randomName = crypto.randomBytes(8).toString('hex');
    const tempFilePath = path.join(tempDir, `${randomName}${fileExtension}`);
    
    // Download the file
    const success = await googleDrive.downloadFileById(file.drive_id, tempFilePath);
    
    if (!success) {
      Logger.error(`Failed to download file ${file.name}`);
      return null;
    }
    
    // Read the file content
    try {
      const content = fs.readFileSync(tempFilePath, 'utf8');
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      
      return content;
    } catch (readError) {
      Logger.error(`Error reading file ${tempFilePath}:`, readError);
      
      // For binary files, just indicate that it's binary content
      Logger.info('File appears to be binary content, extracting plain text...');
      
      // Use simple text extraction for binary files
      const textContent = await extractTextFromBinaryFile(tempFilePath, file.mime_type);
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      
      return textContent || "Binary content could not be extracted";
    }
  } catch (error) {
    Logger.error(`Error downloading file ${file.name}:`, error);
    return null;
  }
}

/**
 * Extract text from binary file
 */
async function extractTextFromBinaryFile(filePath: string, mimeType: string): Promise<string | null> {
  try {
    // Check if the file exists and has content
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return "Empty file";
    }
    
    // For PDF files, we might implement PDF extraction here
    // For now, just read as binary and return a placeholder
    
    return `[Binary content type: ${mimeType}] - Size: ${stats.size} bytes`;
  } catch (error) {
    Logger.error(`Error extracting text from binary file ${filePath}:`, error);
    return null;
  }
}

/**
 * Create classification prompt for Claude
 */
function createClassificationPrompt(
  file: GoogleSourceFile,
  documentTypes: DocumentType[],
  content: string
): string {
  // Create the type options list
  const typeOptions = documentTypes.map(type => 
    `${type.id}: ${type.document_type}${type.description ? ` - ${type.description}` : ''} (Category: ${type.category})`
  ).join('\n');
  
  // Create a truncated version of the content to avoid token limits
  const truncatedContent = content.length > 10000 
    ? content.substring(0, 5000) + '\n...[content truncated]...\n' + content.substring(content.length - 5000)
    : content;
  
  return `
You are a document classification expert. Please analyze the document provided and classify it 
into the most appropriate document type from the options below.

# Document Information
- Name: ${file.name || 'Unnamed'}
- Path: ${file.path || 'Unknown path'}
- MIME Type: ${file.mime_type || 'Unknown type'}
- Web Link: ${file.web_view_link || 'No link available'}

# Document Types (ID: Name - Description)
${typeOptions}

# Document Content:
\`\`\`
${truncatedContent}
\`\`\`

Based on the content and document information, please classify this document 
by selecting the most appropriate document type from the list.

Respond with a valid JSON object containing these fields:
- document_type_id: The ID of the selected document type (required)
- document_type: The name of the selected document type
- confidence: A number between 0-1 indicating your confidence in this classification
- reasoning: A brief explanation of why you chose this classification

Think step by step about the following:
1. What is the overall purpose of this document?
2. What category does it fit into?
3. Which document type best matches this content?
`;
}

/**
 * Test Google Doc Classification with Claude
 */
async function testGoogleDocClassification(): Promise<void> {
  try {
    Logger.info('Starting Google Doc Classification test');
    
    // First, get document types
    const documentTypes = await getDocumentTypes();
    if (documentTypes.length === 0) {
      Logger.error('No document types found in the database.');
      return;
    }
    
    // Sample some document types
    const sampleTypes = documentTypes.slice(0, 5);
    Logger.info('\n===== Sample Document Types =====');
    sampleTypes.forEach(type => {
      Logger.info(`ID: ${type.id}`);
      Logger.info(`Type: ${type.document_type}`);
      Logger.info(`Description: ${type.description}`);
      Logger.info(`Category: ${type.category}`);
      Logger.info('-------------------');
    });
    
    // Get untyped Google files
    const googleFiles = await getUntypedGoogleFiles(6);
    
    if (googleFiles.length === 0) {
      Logger.info('No untyped Google files to test.');
      return;
    }
    
    Logger.info('\n===== Testing Google File Classification =====');
    
    // Process each file
    for (const file of googleFiles) {
      Logger.info(`\nProcessing file: ${file.name} (ID: ${file.id}, Drive ID: ${file.drive_id})`);
      Logger.info(`MIME Type: ${file.mime_type}`);
      Logger.info(`Path: ${file.path || 'No path available'}`);
      Logger.info(`Web View Link: ${file.web_view_link || 'No web link available'}`);
      
      // Download the file
      const content = await downloadGoogleFile(file);
      
      if (!content) {
        Logger.error(`Could not download or extract content for ${file.name}`);
        continue;
      }
      
      // Create prompt and classify
      const prompt = createClassificationPrompt(file, documentTypes, content);
      
      // Classify with Claude
      Logger.info(`Classifying document: ${file.name}...`);
      const classification = await claudeService.getJsonResponse<{
        document_type_id: string;
        document_type: string;
        confidence: number;
        reasoning: string;
      }>(prompt, { temperature: 0.2 });
      
      // Display results
      Logger.info('Classification Result:');
      Logger.info(`Document Type ID: ${classification.document_type_id}`);
      Logger.info(`Document Type: ${classification.document_type}`);
      Logger.info(`Confidence: ${classification.confidence}`);
      Logger.info(`Reasoning: ${classification.reasoning}`);
      
      // Find the document type name from ID for verification
      const matchingType = documentTypes.find(type => type.id === classification.document_type_id);
      if (matchingType && matchingType.document_type !== classification.document_type) {
        Logger.warn(`Warning: Document type name mismatch. ID ${classification.document_type_id} should be "${matchingType.document_type}" but Claude returned "${classification.document_type}"`);
      }
    }
    
    Logger.info('\nTest completed');
    
  } catch (error) {
    Logger.error('Error in test:', error);
  }
}

// Run the test
testGoogleDocClassification();