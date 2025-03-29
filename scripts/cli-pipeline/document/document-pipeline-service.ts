/**
 * Document Pipeline Service
 * 
 * This service provides a TypeScript implementation of the document pipeline manager
 * using shared services from the packages/shared directory.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { Logger } from '../../packages/shared/utils/logger';
import config from '../../packages/shared/utils/config';
import { SupabaseClientService } from '../../packages/shared/services/supabase-client';
import { ClaudeService } from '../../packages/shared/services/claude-service';

// Define types for documents
interface DocumentFile {
  id: string;
  file_path: string;
  title: string;
  file_hash?: string;
  file_size?: number;
  language?: string;
  document_type_id?: string;
  is_deleted?: boolean;
  created_at: Date;
  updated_at: Date;
  last_modified_at?: Date;
}

interface DocumentType {
  id: string;
  name: string;
  description?: string;
}

export class DocumentPipelineService {
  private rootDir: string;
  private reportsDir: string;
  private logsDir: string;
  private supabase: SupabaseClientService;
  private claude: ClaudeService;

  constructor() {
    // Define paths and directories
    this.rootDir = process.cwd();
    this.reportsDir = path.resolve(this.rootDir, 'reports');
    this.logsDir = path.resolve(this.rootDir, 'document-analysis-results');

    // Ensure directories exist
    this.createDirectoriesIfNeeded();

    // Initialize services
    this.supabase = SupabaseClientService.getInstance();
    this.claude = new ClaudeService();

    Logger.info('Document Pipeline Service initialized');
  }

  /**
   * Create necessary directories
   */
  private createDirectoriesIfNeeded(): void {
    try {
      if (!fs.existsSync(this.reportsDir)) {
        fs.mkdirSync(this.reportsDir, { recursive: true });
      }
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (error) {
      Logger.error('Error creating directories:', error);
      throw new Error('Failed to create required directories');
    }
  }

  /**
   * Calculate file hash
   */
  private calculateFileHash(filePath: string): string | null {
    try {
      const fileContent = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(fileContent).digest('hex');
    } catch (error) {
      Logger.error(`Error calculating hash for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Synchronize database with files on disk
   */
  public async syncFiles(): Promise<boolean> {
    Logger.info('🔄 Syncing documentation files database with files on disk...');
    
    try {
      // Get Supabase client
      const client = this.supabase.getClient();
      
      // First, get all files from the database with their hashes
      const { data: dbFiles, error: fetchError } = await client
        .from('documentation_files')
        .select('id, file_path, file_hash');
      
      if (fetchError) {
        Logger.error('Error fetching files:', fetchError);
        return false;
      }
      
      if (!dbFiles || dbFiles.length === 0) {
        Logger.info('No files found in the database.');
        return true;
      }
      
      Logger.info(`Found ${dbFiles.length} files in the database`);
      
      // Process files in batches
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < dbFiles.length; i += batchSize) {
        batches.push(dbFiles.slice(i, i + batchSize));
      }
      
      let existCount = 0;
      let notExistCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      
      // Process each batch
      for (const [batchIndex, batch] of batches.entries()) {
        Logger.info(`Processing batch ${batchIndex + 1}/${batches.length}...`);
        
        // Process each file in the batch
        for (const file of batch) {
          const filePath = path.join(this.rootDir, file.file_path);
          
          // Check if file exists
          if (fs.existsSync(filePath)) {
            existCount++;
            
            try {
              // Get file stats
              const stats = fs.statSync(filePath);
              const fileSize = stats.size;
              const mtime = stats.mtime;
              
              // Calculate hash
              const newHash = this.calculateFileHash(filePath);
              
              // Check if hash changed
              if (newHash !== file.file_hash) {
                // Hash changed, update record with new hash and metadata
                const { error } = await client
                  .from('documentation_files')
                  .update({
                    file_hash: newHash,
                    file_size: fileSize,
                    last_modified_at: mtime,
                    updated_at: new Date()
                  })
                  .eq('id', file.id);
                
                if (error) {
                  Logger.error(`Error updating ${file.file_path}:`, error);
                  errorCount++;
                } else {
                  Logger.info(`Updated ${file.file_path} with new hash and metadata`);
                  updatedCount++;
                }
              }
            } catch (error) {
              Logger.error(`Error processing ${file.file_path}:`, error);
              errorCount++;
            }
          } else {
            // File doesn't exist, mark for deletion
            notExistCount++;
            Logger.info(`File ${file.file_path} no longer exists on disk`);
            
            // Hard delete from the database
            const { error } = await client
              .from('documentation_files')
              .delete()
              .eq('id', file.id);
            
            if (error) {
              Logger.error(`Error deleting ${file.file_path}:`, error);
              errorCount++;
            } else {
              Logger.info(`Deleted ${file.file_path} from database`);
            }
          }
        }
      }
      
      Logger.info(`\nSync Results:`);
      Logger.info(`- ${existCount} files exist on disk`);
      Logger.info(`- ${notExistCount} files no longer exist and were removed from database`);
      Logger.info(`- ${updatedCount} files had their metadata updated`);
      Logger.info(`- ${errorCount} errors occurred during processing`);
      
      return errorCount === 0;
    } catch (error) {
      Logger.error('Error in syncFiles:', error);
      return false;
    }
  }

  /**
   * Find and insert new files on disk into the database
   */
  public async findNewFiles(): Promise<{ added: number; errors: number }> {
    Logger.info('🔍 Finding new document files...');
    
    try {
      // Get Supabase client
      const client = this.supabase.getClient();
      
      // First, get all existing file paths from the database
      const { data: existingFiles, error: fetchError } = await client
        .from('documentation_files')
        .select('file_path');
      
      if (fetchError) {
        throw new Error(`Error fetching existing files: ${fetchError.message}`);
      }
      
      // Create a Set of existing file paths for faster lookup
      const existingPaths = new Set(existingFiles.map(file => file.file_path));
      
      // Find all documentation files on disk
      Logger.info('Scanning directories for documentation files...');
      const allFiles = this.walkDir(this.rootDir);
      Logger.info(`Found ${allFiles.length} potential documentation files on disk`);
      
      // Filter for only new files
      const newFiles = allFiles.filter(file => !existingPaths.has(file.path));
      Logger.info(`Found ${newFiles.length} new documentation files to add to the database`);
      
      if (newFiles.length === 0) {
        Logger.info('No new files to add.');
        return { added: 0, errors: 0 };
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
        Logger.info(`Processing batch ${batchIndex + 1}/${batches.length}...`);
        
        // Process files in this batch
        for (const file of batch) {
          const fullPath = path.join(this.rootDir, file.path);
          
          try {
            // Calculate file hash
            const fileHash = this.calculateFileHash(fullPath);
            
            if (!fileHash) {
              Logger.error(`Could not calculate hash for ${file.path}, skipping`);
              errorCount++;
              continue;
            }
            
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
            
            // Add new file to the database
            const { error: insertError } = await client
              .from('documentation_files')
              .insert({
                id: fileId,
                file_path: file.path,
                title: title,
                file_hash: fileHash,
                file_size: file.file_size,
                language: language,
                created_at: new Date(),
                updated_at: new Date(),
                last_modified_at: file.mtime
              });
            
            if (insertError) {
              Logger.error(`Error inserting ${file.path}:`, insertError);
              errorCount++;
            } else {
              Logger.info(`Added ${file.path} to the database`);
              addedCount++;
            }
          } catch (error) {
            Logger.error(`Error processing ${file.path}:`, error);
            errorCount++;
          }
        }
      }
      
      return { added: addedCount, errors: errorCount };
    } catch (error) {
      Logger.error('Error in findNewFiles:', error);
      return { added: 0, errors: 1 };
    }
  }

  /**
   * Walk directory recursively and find all markdown/documentation files
   */
  private walkDir(dir: string, fileList: any[] = []): any[] {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      // Skip node_modules, git, archive, backup, and other non-documentation directories
      if (stat.isDirectory()) {
        // List of directories to exclude
        const excludedDirs = [
          'node_modules', 'dist', 'build', '.git',
          'file_types', 'backup', 'archive', '_archive',
          'script-analysis-results', 'reports'
        ];
        
        if (
          !file.startsWith('.') &&
          !excludedDirs.includes(file) &&
          !filePath.includes('backup') &&
          !filePath.includes('archive')
        ) {
          this.walkDir(filePath, fileList);
        }
      } else if (stat.isFile()) {
        // Include markdown, txt, and common documentation formats
        const ext = path.extname(file).toLowerCase();
        if (['.md', '.txt', '.pdf', '.docx', '.doc', '.rtf'].includes(ext)) {
          // Get relative path from root directory
          const relativePath = path.relative(this.rootDir, filePath);
          fileList.push({
            path: relativePath,
            file_size: stat.size,
            mtime: stat.mtime
          });
        }
      }
    }
    
    return fileList;
  }

  /**
   * Show document files without a document type
   */
  public async showUntypedFiles(): Promise<boolean> {
    Logger.info('📋 Showing untyped document files...');
    
    try {
      // Get Supabase client
      const client = this.supabase.getClient();
      
      // Query for files without a document type
      const { data, error } = await client
        .from('documentation_files')
        .select('id, file_path, title, language, created_at, updated_at')
        .is('document_type_id', null)
        .order('updated_at', { ascending: false })
        .limit(20);
      
      if (error) {
        Logger.error('Error fetching untyped files:', error);
        return false;
      }
      
      if (!data || data.length === 0) {
        Logger.info('No untyped files found.');
        return true;
      }
      
      Logger.info(`Found ${data.length} untyped document files:`);
      Logger.info('----------------------------------------------');
      
      // Format the data as a table
      Logger.info('ID                                      | Title                    | Path                                    | Updated At');
      Logger.info('----------------------------------------|--------------------------|----------------------------------------|------------------');
      
      data.forEach((file) => {
        const id = file.id ? file.id.substring(0, 8) + '...' : 'No ID'; // Show only first 8 chars of UUID
        const title = (file.title || 'No title').padEnd(24).substring(0, 24);
        const path = (file.file_path || 'No path').padEnd(39).substring(0, 39);
        const updated = file.updated_at ? new Date(file.updated_at).toISOString().split('T')[0] : 'No date';
        
        Logger.info(`${id} | ${title} | ${path} | ${updated}`);
      });
      
      Logger.info('----------------------------------------------');
      Logger.info(`Total: ${data.length} untyped documents`);
      
      return true;
    } catch (error) {
      Logger.error('Error in showUntypedFiles:', error);
      return false;
    }
  }

  /**
   * Show recent document files
   */
  public async showRecentFiles(): Promise<boolean> {
    Logger.info('📋 Showing recent document files...');
    
    try {
      // Get Supabase client
      const client = this.supabase.getClient();
      
      // Query for recent files
      const { data, error } = await client
        .from('documentation_files')
        .select(`
          id, 
          file_path, 
          title, 
          language, 
          document_type:document_type_id(name),
          created_at, 
          updated_at
        `)
        .order('updated_at', { ascending: false })
        .limit(20);
      
      if (error) {
        Logger.error('Error fetching recent files:', error);
        return false;
      }
      
      if (!data || data.length === 0) {
        Logger.info('No recent files found.');
        return true;
      }
      
      Logger.info(`Found ${data.length} recent document files:`);
      Logger.info('----------------------------------------------');
      
      // Format the data as a table
      Logger.info('ID         | Title                    | Type                     | Path                                    | Updated At');
      Logger.info('-----------|--------------------------|--------------------------|----------------------------------------|------------------');
      
      data.forEach((file) => {
        const id = file.id ? file.id.substring(0, 8) + '...' : 'No ID'; // Show only first 8 chars of UUID
        const title = (file.title || 'No title').padEnd(24).substring(0, 24);
        const type = ((file.document_type && file.document_type.name) || 'Untyped').padEnd(24).substring(0, 24);
        const path = (file.file_path || 'No path').padEnd(39).substring(0, 39);
        const updated = file.updated_at ? new Date(file.updated_at).toISOString().split('T')[0] : 'No date';
        
        Logger.info(`${id} | ${title} | ${type} | ${path} | ${updated}`);
      });
      
      Logger.info('----------------------------------------------');
      Logger.info(`Total: ${data.length} recent documents`);
      
      return true;
    } catch (error) {
      Logger.error('Error in showRecentFiles:', error);
      return false;
    }
  }

  /**
   * Classify document files using Claude API
   */
  public async classifyDocuments(count: number = 10, onlyUntyped: boolean = false): Promise<boolean> {
    Logger.info(`🧠 Classifying ${count} ${onlyUntyped ? 'untyped' : 'recent'} document files...`);
    
    try {
      // Check if Claude API key is available
      if (!config.claudeApiKey) {
        Logger.error('Claude API key is not set. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.');
        return false;
      }
      
      // Get Supabase client
      const client = this.supabase.getClient();
      
      // Build query based on whether we want untyped only
      let query = client
        .from('documentation_files')
        .select(`
          id, 
          file_path, 
          title, 
          language, 
          content
        `);
      
      if (onlyUntyped) {
        query = query.is('document_type_id', null);
      }
      
      const { data: documents, error } = await query
        .order('updated_at', { ascending: false })
        .limit(count);
      
      if (error) {
        Logger.error('Error fetching documents to classify:', error);
        return false;
      }
      
      if (!documents || documents.length === 0) {
        Logger.info(`No ${onlyUntyped ? 'untyped' : 'recent'} documents found to classify.`);
        return true;
      }
      
      Logger.info(`Found ${documents.length} documents to classify.`);
      
      // Get document types for reference
      const { data: documentTypes } = await client
        .from('document_types')
        .select('id, name, description');
      
      if (!documentTypes || documentTypes.length === 0) {
        Logger.error('No document types found in the database. Cannot classify without types.');
        return false;
      }
      
      // Process each document
      let classifiedCount = 0;
      
      for (const document of documents) {
        Logger.info(`Classifying document: ${document.file_path}`);
        
        // Read the file content if needed
        let content = document.content;
        if (!content) {
          const filePath = path.join(this.rootDir, document.file_path);
          
          if (fs.existsSync(filePath)) {
            content = fs.readFileSync(filePath, 'utf8');
          } else {
            Logger.error(`File not found: ${filePath}`);
            continue;
          }
        }
        
        // Create the prompt
        const prompt = this.createClassificationPrompt(document, documentTypes, content);
        
        // Send to Claude
        try {
          const response = await this.claude.getJsonResponse(prompt);
          
          if (response && response.document_type_id) {
            // Update the document with the new type
            const { error: updateError } = await client
              .from('documentation_files')
              .update({
                document_type_id: response.document_type_id,
                updated_at: new Date()
              })
              .eq('id', document.id);
            
            if (updateError) {
              Logger.error(`Error updating document type for ${document.file_path}:`, updateError);
            } else {
              Logger.info(`✅ Classified ${document.file_path} as ${response.document_type_name || response.document_type_id}`);
              classifiedCount++;
            }
          } else {
            Logger.warn(`⚠️ Claude didn't provide a valid document_type_id for ${document.file_path}`);
          }
        } catch (error) {
          Logger.error(`Error classifying document ${document.file_path}:`, error);
        }
      }
      
      Logger.info(`Successfully classified ${classifiedCount} out of ${documents.length} documents.`);
      
      return classifiedCount > 0;
    } catch (error) {
      Logger.error('Error in classifyDocuments:', error);
      return false;
    }
  }

  /**
   * Create classification prompt for Claude
   */
  private createClassificationPrompt(document: any, documentTypes: DocumentType[], content: string): string {
    // Create the type options list
    const typeOptions = documentTypes.map(type => 
      `${type.id}: ${type.name}${type.description ? ` - ${type.description}` : ''}`
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
- document_type_name: The name of the selected document type
- confidence: A number between 0-1 indicating your confidence in this classification
- rationale: A brief explanation of why you chose this classification

Think step by step about the following:
1. What is the overall purpose of this document?
2. What category does it fit into?
3. Which document type best matches this content?
`;
  }

  /**
   * Generate a summary report of documents
   */
  public async generateSummary(count: number = 50): Promise<boolean> {
    Logger.info(`📊 Generating summary report for ${count} documents...`);
    
    try {
      // Get Supabase client
      const client = this.supabase.getClient();
      
      // Query the database for documents
      let query = client
        .from('documentation_files')
        .select(`
          id,
          file_path,
          title,
          language,
          document_type:document_type_id(id, name, description),
          created_at,
          updated_at,
          last_modified_at,
          file_size
        `);
      
      // Apply limit (only if not -1, which means all documents)
      if (count !== -1) {
        query = query.limit(count);
      }
      
      // Execute the query
      const { data: documents, error } = await query.order('updated_at', { ascending: false });
      
      if (error) {
        Logger.error('Error fetching documents:', error);
        return false;
      }
      
      if (!documents || documents.length === 0) {
        Logger.info('No documents found in the database.');
        return false;
      }
      
      // Categorize documents
      const categorizedDocuments: Record<string, any[]> = {
        'Technical': [],
        'Guides': [],
        'READMEs': [],
        'Environment': [],
        'General': []
      };
      
      // Process each document
      documents.forEach(document => {
        // Categorize the document
        const category = this.categorizeDocument(document);
        categorizedDocuments[category].push(document);
      });
      
      // Generate the report
      const reportPath = path.join(this.reportsDir, `document-summary-${new Date().toISOString().split('T')[0]}.md`);
      let report = `# Document Analysis Summary Report\n\n`;
      report += `Generated: ${new Date().toISOString()}\n`;
      report += `Total Documents: ${documents.length}\n\n`;
      
      // Summary statistics
      report += `## Summary Statistics\n\n`;
      report += `| Category | Count | Percentage |\n`;
      report += `| --- | --- | --- |\n`;
      
      for (const [category, categoryDocuments] of Object.entries(categorizedDocuments)) {
        const percentage = ((categoryDocuments.length / documents.length) * 100).toFixed(1);
        report += `| ${category} | ${categoryDocuments.length} | ${percentage}% |\n`;
      }
      
      report += `\n`;
      
      // Add a file path table for quick reference
      report += `## File Path Overview\n\n`;
      report += `| ID | File Path | Type | Category | Last Updated |\n`;
      report += `| --- | --- | --- | --- | --- |\n`;
      
      documents.slice(0, 20).forEach(document => {
        const id = document.id.substring(0, 8) + '...';
        const type = document.document_type ? document.document_type.name : 'Untyped';
        const updatedAt = document.updated_at ? new Date(document.updated_at).toISOString().split('T')[0] : 'N/A';
        const category = this.categorizeDocument(document);
        report += `| ${id} | \`${document.file_path}\` | ${type} | ${category} | ${updatedAt} |\n`;
      });
      
      if (documents.length > 20) {
        report += `| ... | ... | ... | ... | ... |\n`;
      }
      
      report += `\n\n`;
      
      // Write the report to a file
      fs.writeFileSync(reportPath, report);
      Logger.info(`Report successfully written to: ${reportPath}`);
      
      return true;
    } catch (error) {
      Logger.error('Error generating summary report:', error);
      return false;
    }
  }

  /**
   * Categorize a document based on its type and path
   */
  private categorizeDocument(document: any): string {
    // Default to 'General' if no category is found
    let category = 'General';
    
    const docType = document.document_type ? document.document_type.name : '';
    const filePath = document.file_path || '';
    
    // Check for technical documentation
    if (
      docType.includes('Technical') || 
      docType.includes('API') || 
      docType.includes('Code') ||
      filePath.includes('technical-specs') ||
      filePath.includes('code-documentation')
    ) {
      category = 'Technical';
    }
    // Check for guides/tutorials
    else if (
      docType.includes('Guide') || 
      docType.includes('Tutorial') || 
      docType.includes('How-to') ||
      filePath.includes('solution-guides') ||
      filePath.includes('guide')
    ) {
      category = 'Guides';
    }
    // Check for readmes/project documentation
    else if (
      docType.includes('README') || 
      docType.includes('Project') ||
      filePath.includes('readmes') ||
      filePath.match(/README\.(md|txt)$/i)
    ) {
      category = 'READMEs';
    }
    // Check for deployment/environment documentation
    else if (
      docType.includes('Deployment') || 
      docType.includes('Environment') ||
      filePath.includes('deployment-environment')
    ) {
      category = 'Environment';
    }
    
    return category;
  }
}

// Create singleton instance
export const documentPipelineService = new DocumentPipelineService();