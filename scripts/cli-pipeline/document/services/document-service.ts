/**
 * Document Service
 * 
 * Main service for document pipeline operations.
 * Uses shared services for file operations, database access, and Claude integration.
 */
import * as path from 'path';
import * as crypto from 'crypto';

// Import shared services
import { fileService } from '../../shared/file-service';
import { databaseService } from '../../shared/services/database-service';
import { logger } from '../../shared/services/logger-service';
import { environmentService } from '../../shared/services/environment-service';
import { claudeService } from '../../shared/services/claude-service';

// Import types
import { FileMetadata } from '../../shared/interfaces/types';

/**
 * Document file interface
 */
export interface DocumentFile {
  id: string;
  file_path: string;
  title: string;
  file_hash?: string;
  file_size?: number;
  language?: string;
  document_type_id?: string;
  is_deleted?: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  last_modified_at?: Date | string;
}

/**
 * Document type interface
 */
export interface DocumentType {
  id: string;
  document_type: string;
  description?: string;
}

/**
 * Sync files result interface
 */
export interface SyncFilesResult {
  success: boolean;
  existCount: number;
  notExistCount: number;
  updatedCount: number;
  errorCount: number;
}

/**
 * Find new files result interface
 */
export interface FindNewFilesResult {
  success: boolean;
  added: number;
  errors: number;
  total: number;
}

/**
 * Document Service implementation
 */
export class DocumentService {
  private static instance: DocumentService;
  private rootDir: string;
  private reportsDir: string;
  private logsDir: string;
  
  /**
   * Create a new document service
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    const config = environmentService.getConfig();
    
    // Set root directory
    this.rootDir = config.rootDir;
    
    // Define directories
    this.reportsDir = path.resolve(this.rootDir, 'reports');
    
    // Ensure reports directory exists
    fileService.createDirectoryIfNeeded(this.reportsDir);
    
    logger.info('Document Service initialized', { rootDir: this.rootDir });
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): DocumentService {
    if (!DocumentService.instance) {
      DocumentService.instance = new DocumentService();
    }
    return DocumentService.instance;
  }
  
  /**
   * Test connection to Supabase
   */
  public async testConnection(): Promise<boolean> {
    const result = await databaseService.testConnection();
    return result.success;
  }
  
  /**
   * Synchronize database with files on disk
   */
  public async syncFiles(): Promise<SyncFilesResult> {
    logger.info('🔄 Syncing documentation files database with files on disk...');
    
    // Initialize counters
    let existCount = 0;
    let notExistCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    try {
      // First, get all files from the database
      const { data: dbFiles, error } = await databaseService.getRecords<DocumentFile>(
        'documentation_files',
        'id, file_path, file_hash, file_size'
      );
      
      if (error) {
        logger.error('Error fetching files from database:', error);
        return {
          success: false,
          existCount,
          notExistCount,
          updatedCount,
          errorCount: errorCount + 1
        };
      }
      
      if (!dbFiles || dbFiles.length === 0) {
        logger.info('No files found in the database.');
        return {
          success: true,
          existCount,
          notExistCount,
          updatedCount,
          errorCount
        };
      }
      
      logger.info(`Found ${dbFiles.length} files in the database`);
      
      // Process files in batches for better performance
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < dbFiles.length; i += batchSize) {
        batches.push(dbFiles.slice(i, i + batchSize));
      }
      
      // Process each batch
      for (const [batchIndex, batch] of batches.entries()) {
        logger.info(`Processing batch ${batchIndex + 1}/${batches.length}...`);
        
        // Process each file in the batch
        for (const file of batch) {
          const filePath = path.join(this.rootDir, file.file_path);
          
          // Get file metadata
          const metadata = fileService.getFileMetadata(filePath, true);
          
          if (metadata) {
            existCount++;
            
            // Check if hash changed
            if (metadata.hash !== file.file_hash) {
              // Hash changed, update record with new hash and metadata
              const { error } = await databaseService.updateRecords<DocumentFile>(
                'documentation_files',
                {
                  file_hash: metadata.hash,
                  file_size: metadata.file_size,
                  last_modified_at: metadata.mtime,
                  updated_at: new Date()
                },
                q => q.eq('id', file.id)
              );
              
              if (error) {
                logger.error(`Error updating ${file.file_path}:`, error);
                errorCount++;
              } else {
                logger.info(`Updated ${file.file_path} with new hash and metadata`);
                updatedCount++;
              }
            } else if (!file.file_size) {
              // Ensure metadata is standardized
              const { error } = await databaseService.updateRecords<DocumentFile>(
                'documentation_files',
                {
                  file_size: metadata.file_size,
                  last_modified_at: metadata.mtime
                },
                q => q.eq('id', file.id)
              );
              
              if (error) {
                logger.error(`Error standardizing metadata for ${file.file_path}:`, error);
                errorCount++;
              } else {
                logger.info(`Standardized metadata for ${file.file_path}`);
                updatedCount++;
              }
            }
          } else {
            // File doesn't exist, delete from database
            notExistCount++;
            logger.info(`File ${file.file_path} no longer exists on disk`);
            
            // Hard delete from the database
            const { error } = await databaseService.deleteRecords<DocumentFile>(
              'documentation_files',
              q => q.eq('id', file.id)
            );
            
            if (error) {
              logger.error(`Error deleting ${file.file_path}:`, error);
              errorCount++;
            } else {
              logger.info(`Deleted ${file.file_path} from database`);
            }
          }
        }
      }
      
      logger.info(`\nSync Results:`);
      logger.info(`- ${existCount} files exist on disk`);
      logger.info(`- ${notExistCount} files no longer exist and were removed from database`);
      logger.info(`- ${updatedCount} files had their metadata updated`);
      logger.info(`- ${errorCount} errors occurred during processing`);
      
      return {
        success: errorCount === 0,
        existCount,
        notExistCount,
        updatedCount,
        errorCount
      };
    } catch (error) {
      logger.error('Error in syncFiles:', error);
      return {
        success: false,
        existCount,
        notExistCount,
        updatedCount,
        errorCount: errorCount + 1
      };
    }
  }
  
  /**
   * Find and insert new files on disk into the database
   */
  public async findNewFiles(): Promise<FindNewFilesResult> {
    logger.info('🔍 Finding new document files...');
    
    try {
      // First, get all existing file paths from the database
      const { data: existingFiles, error: fetchError } = await databaseService.getRecords<DocumentFile>(
        'documentation_files',
        'file_path'
      );
      
      if (fetchError) {
        throw new Error(`Error fetching existing files: ${fetchError}`);
      }
      
      // Create a Set of existing file paths for faster lookup
      const existingPaths = new Set(existingFiles?.map(file => file.file_path) || []);
      
      // Find all documentation files on disk
      logger.info('Scanning directories for documentation files...');
      const allFiles = fileService.findDocumentationFiles(true);
      logger.info(`Found ${allFiles.length} potential documentation files on disk`);
      
      // Filter for only new files
      const newFiles = allFiles.filter(file => !existingPaths.has(file.path));
      logger.info(`Found ${newFiles.length} new documentation files to add to the database`);
      
      if (newFiles.length === 0) {
        logger.info('No new files to add.');
        return { success: true, added: 0, errors: 0, total: allFiles.length };
      }
      
      // Process new files in batches
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < newFiles.length; i += batchSize) {
        batches.push(newFiles.slice(i, i + batchSize));
      }
      
      let addedCount = 0;
      let errorCount = 0;
      
      // Process each batch
      for (const [batchIndex, batch] of batches.entries()) {
        logger.info(`Processing batch ${batchIndex + 1}/${batches.length}...`);
        
        // Prepare records for insertion
        const records = batch.map(file => {
          // Get file extension and try to determine language/type
          const ext = path.extname(file.path).toLowerCase();
          let language = 'unknown';
          
          switch (ext) {
            case '.md':
              language = 'markdown';
              break;
            case '.txt':
              language = 'text';
              break;
            case '.pdf':
              language = 'pdf';
              break;
            case '.docx':
            case '.doc':
              language = 'msword';
              break;
            case '.rtf':
              language = 'rtf';
              break;
          }
          
          // Extract filename without extension for title
          const title = path.basename(file.path, ext);
          
          // Generate a UUID for the new file
          const fileId = crypto.randomUUID();
          
          return {
            id: fileId,
            file_path: file.path,
            title: title,
            file_hash: file.hash,
            file_size: file.file_size,
            language: language,
            created_at: new Date(),
            updated_at: new Date(),
            last_modified_at: file.mtime
          };
        });
        
        // Insert records
        const { data, error } = await databaseService.insertRecords<DocumentFile>(
          'documentation_files',
          records
        );
        
        if (error) {
          logger.error(`Error inserting batch ${batchIndex + 1}:`, error);
          errorCount++;
        } else {
          logger.info(`Added ${records.length} files to the database`);
          addedCount += records.length;
        }
      }
      
      logger.info(`\nFind New Files Results:`);
      logger.info(`- ${addedCount} new files added to the database`);
      logger.info(`- ${errorCount} errors occurred during processing`);
      
      return {
        success: errorCount === 0,
        added: addedCount,
        errors: errorCount,
        total: allFiles.length
      };
    } catch (error) {
      logger.error('Error in findNewFiles:', error);
      return { success: false, added: 0, errors: 1, total: 0 };
    }
  }
  
  /**
   * Show document files without a document type
   */
  public async showUntypedFiles(limit: number = 20): Promise<boolean> {
    logger.info('📋 Showing untyped document files...');
    
    try {
      // Query for files without a document type
      const { data, error } = await databaseService.getRecords<DocumentFile>(
        'documentation_files',
        'id, file_path, title, language, created_at, updated_at',
        q => q.is('document_type_id', null).order('updated_at', { ascending: false }).limit(limit)
      );
      
      if (error) {
        logger.error('Error fetching untyped files:', error);
        return false;
      }
      
      if (!data || data.length === 0) {
        logger.info('No untyped files found.');
        return true;
      }
      
      logger.info(`Found ${data.length} untyped document files:`);
      logger.info('----------------------------------------------');
      
      // Format the data as a table
      console.log('ID                                      | Title                    | Path                                    | Updated At');
      console.log('----------------------------------------|--------------------------|----------------------------------------|------------------');
      
      data.forEach((file) => {
        const id = file.id ? file.id.substring(0, 8) + '...' : 'No ID'; // Show only first 8 chars of UUID
        const title = (file.title || 'No title').padEnd(24).substring(0, 24);
        const path = (file.file_path || 'No path').padEnd(39).substring(0, 39);
        const updated = file.updated_at ? new Date(file.updated_at).toISOString().split('T')[0] : 'No date';
        
        console.log(`${id} | ${title} | ${path} | ${updated}`);
      });
      
      logger.info('----------------------------------------------');
      logger.info(`Total: ${data.length} untyped documents`);
      
      return true;
    } catch (error) {
      logger.error('Error in showUntypedFiles:', error);
      return false;
    }
  }
  
  /**
   * Show recent document files
   */
  public async showRecentFiles(limit: number = 20): Promise<boolean> {
    logger.info(`Fetching ${limit} recent files...`);
    
    try {
      const { data, error } = await databaseService.getRecords<DocumentFile>(
        'documentation_files',
        `
          id, 
          file_path, 
          title, 
          language, 
          document_type_id,
          created_at, 
          updated_at
        `,
        q => q.order('updated_at', { ascending: false }).limit(limit)
      );
      
      if (error) {
        logger.error('Error fetching recent files:', error);
        return false;
      }
      
      if (!data || data.length === 0) {
        logger.info('No recent files found.');
        return true;
      }
      
      logger.info(`Found ${data.length} recent document files:`);
      logger.info('----------------------------------------------');
      
      // Format the data as a table
      console.log('ID         | Title                    | Type                     | Path                                    | Updated At');
      console.log('-----------|--------------------------|--------------------------|----------------------------------------|------------------');
      
      data.forEach((file) => {
        const id = file.id ? file.id.substring(0, 8) + '...' : 'No ID';
        const title = (file.title || 'No title').padEnd(24).substring(0, 24);
        const type = (file.document_type_id || 'Untyped').padEnd(24).substring(0, 24);
        const path = (file.file_path || 'No path').padEnd(39).substring(0, 39);
        const updated = file.updated_at ? new Date(file.updated_at).toISOString().split('T')[0] : 'No date';
        
        console.log(`${id} | ${title} | ${type} | ${path} | ${updated}`);
      });
      
      logger.info('----------------------------------------------');
      logger.info(`Total: ${data.length} recent documents`);
      
      return true;
    } catch (error) {
      logger.error('Error in showRecentFiles:', error);
      return false;
    }
  }
  
  /**
   * Classify document files using Claude
   */
  public async classifyDocuments(count: number = 10, onlyUntyped: boolean = false): Promise<boolean> {
    logger.info(`🧠 Classifying ${count} ${onlyUntyped ? 'untyped' : 'recent'} document files...`);
    
    try {
      // Make sure Claude API key is available
      if (!claudeService.validateApiKey()) {
        return false;
      }
      
      // Get document types for classification
      const { data: documentTypes, error: typesError } = await databaseService.getRecords<DocumentType>(
        'document_types',
        'id, document_type, description'
      );
      
      if (typesError || !documentTypes || documentTypes.length === 0) {
        logger.error('Error fetching document types:', typesError);
        return false;
      }
      
      // Query for files to classify
      let query = (q: any) => {
        if (onlyUntyped) {
          q = q.is('document_type_id', null);
        }
        return q.order('updated_at', { ascending: false }).limit(count);
      };
      
      const { data: documents, error } = await databaseService.getRecords<DocumentFile>(
        'documentation_files',
        'id, file_path, title, language, created_at, updated_at',
        query
      );
      
      if (error) {
        logger.error('Error fetching documents to classify:', error);
        return false;
      }
      
      if (!documents || documents.length === 0) {
        logger.info(`No ${onlyUntyped ? 'untyped' : 'recent'} documents found to classify.`);
        return true;
      }
      
      logger.info(`Found ${documents.length} documents to classify.`);
      
      // Process each document
      let classifiedCount = 0;
      
      for (const document of documents) {
        logger.info(`Classifying document: ${document.file_path}`);
        
        // Read the file content
        const filePath = path.join(this.rootDir, document.file_path);
        const content = fileService.readFileContent(filePath);
        
        if (!content) {
          logger.error(`Could not read file: ${filePath}`);
          continue;
        }
        
        // Create the classification prompt
        const classificationPrompt = this.createClassificationPrompt(document, documentTypes, content);
        
        try {
          // Send to Claude
          const response = await claudeService.getJsonResponse<{
            document_type_id: string;
            document_type: string; // Changed from document_type_name to match schema
            confidence: number;
            rationale: string;
          }>(classificationPrompt, { temperature: 0.2 });
          
          if (response && response.document_type_id) {
            // Update the document with the new type
            const { error: updateError } = await databaseService.updateRecords<DocumentFile>(
              'documentation_files',
              {
                document_type_id: response.document_type_id,
                updated_at: new Date()
              },
              q => q.eq('id', document.id)
            );
            
            if (updateError) {
              logger.error(`Error updating document type for ${document.file_path}:`, updateError);
            } else {
              logger.info(`✅ Classified ${document.file_path} as ${response.document_type || response.document_type_id} (confidence: ${response.confidence})`);
              classifiedCount++;
            }
          } else {
            logger.warn(`⚠️ Claude didn't provide a valid document_type_id for ${document.file_path}`);
          }
        } catch (error) {
          logger.error(`Error classifying document ${document.file_path}:`, error);
        }
      }
      
      logger.info(`Successfully classified ${classifiedCount} out of ${documents.length} documents.`);
      
      return classifiedCount > 0;
    } catch (error) {
      logger.error('Error in classifyDocuments:', error);
      return false;
    }
  }
  
  /**
   * Create classification prompt for Claude
   */
  private createClassificationPrompt(
    document: DocumentFile,
    documentTypes: DocumentType[],
    content: string
  ): string {
    // Create the type options list
    const typeOptions = documentTypes.map(type => 
      `${type.id}: ${type.document_type}${type.description ? ` - ${type.description}` : ''}`
    ).join('\n');
    
    // Create a truncated version of the content to avoid token limits
    const truncatedContent = content.length > 10000 
      ? content.substring(0, 5000) + '\n...[content truncated]...\n' + content.substring(content.length - 5000)
      : content;
    
    return `
You are a document classification expert. Please analyze the document provided and classify it 
into the most appropriate document type from the options below.

# Document Information
- Path: ${document.file_path}
- Title: ${document.title || 'Untitled'}
- Language: ${document.language || 'Unknown'}

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
- document_type: The type of the selected document
- confidence: A number between 0-1 indicating your confidence in this classification
- rationale: A brief explanation of why you chose this classification

Think step by step about the following:
1. What is the overall purpose of this document?
2. What category does it fit into?
3. Which document type best matches this content?
`;
  }
}

// Export singleton instance
export const documentService = DocumentService.getInstance();