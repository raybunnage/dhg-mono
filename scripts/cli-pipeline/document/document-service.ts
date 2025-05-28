/**
 * Document Service
 * 
 * A TypeScript service implementation for document pipeline operations.
 * This service encapsulates all the functionality of the original
 * document-pipeline-manager.sh script in a maintainable, testable structure.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

/**
 * Log levels for the service
 */
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

/**
 * Types for documents and related entities
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

export interface FileMetadata {
  path: string;
  file_size: number;
  mtime: Date;
}

/**
 * Configuration options for the document service
 */
export interface DocumentServiceOptions {
  rootDir?: string;
  logLevel?: LogLevel;
  supabaseUrl?: string;
  supabaseKey?: string;
}

/**
 * Document Service implementation
 */
export class DocumentService {
  private supabase: SupabaseClient;
  private rootDir: string;
  private reportsDir: string;
  private logsDir: string;
  private logLevel: LogLevel;
  
  /**
   * Create a new document service instance
   */
  constructor(options?: DocumentServiceOptions) {
    // Set root directory
    this.rootDir = options?.rootDir || process.cwd();
    
    // Set log level
    this.logLevel = options?.logLevel || 
      (process.env.LOG_LEVEL as LogLevel) || 
      LogLevel.INFO;
    
    // Define directories
    this.reportsDir = path.resolve(this.rootDir, 'reports');
    this.logsDir = path.resolve(this.rootDir, 'document-analysis-results');
    
    // Ensure directories exist
    this.createDirectoriesIfNeeded();
    
    // Use SupabaseClientService singleton instead of creating a direct client
    this.supabase = SupabaseClientService.getInstance().getClient();
    this.log(LogLevel.INFO, 'Document Service initialized with SupabaseClientService singleton');
  }
  
  /**
   * Log messages with appropriate level
   */
  private log(level: LogLevel, message: string, error?: any): void {
    // Only log messages at or above the configured level
    const levels = Object.values(LogLevel);
    if (levels.indexOf(level) > levels.indexOf(this.logLevel)) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${level}] ${message}`;
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(`${timestamp} ${logMessage}`, error || '');
        break;
      case LogLevel.WARN:
        console.warn(`${timestamp} ${logMessage}`);
        break;
      case LogLevel.INFO:
        console.log(`${timestamp} ${logMessage}`);
        break;
      case LogLevel.DEBUG:
        console.debug(`${timestamp} ${logMessage}`);
        break;
    }
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
      this.log(LogLevel.ERROR, 'Error creating directories:', error);
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
      this.log(LogLevel.ERROR, `Error calculating hash for ${filePath}:`, error);
      return null;
    }
  }
  
  /**
   * Test connection to Supabase
   */
  public async testConnection(): Promise<boolean> {
    try {
      this.log(LogLevel.INFO, 'Testing connection to Supabase...');
      
      // Try a simple query to verify connection
      const { data, error } = await this.supabase
        .from('doc_files')
        .select('count(*)', { count: 'exact', head: true });
      
      if (error) {
        this.log(LogLevel.ERROR, 'Failed to connect to doc_files table', error);
        return false;
      }
      
      this.log(LogLevel.INFO, '✅ Successfully connected to Supabase');
      return true;
    } catch (error) {
      this.log(LogLevel.ERROR, 'Error connecting to Supabase', error);
      return false;
    }
  }
  
  /**
   * Synchronize database with files on disk
   * Updates file metadata in the database and removes entries for files that no longer exist
   */
  public async syncFiles(): Promise<{ 
    success: boolean; 
    existCount: number; 
    notExistCount: number; 
    updatedCount: number; 
    errorCount: number 
  }> {
    this.log(LogLevel.INFO, '🔄 Syncing documentation files database with files on disk...');
    
    // Initialize counters
    let existCount = 0;
    let notExistCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    try {
      // First, get all files from the database with their hashes
      const { data: dbFiles, error: fetchError } = await this.supabase
        .from('doc_files')
        .select('id, file_path, file_hash, file_size');
      
      if (fetchError) {
        this.log(LogLevel.ERROR, 'Error fetching files:', fetchError);
        return { 
          success: false, 
          existCount, 
          notExistCount, 
          updatedCount, 
          errorCount: errorCount + 1 
        };
      }
      
      if (!dbFiles || dbFiles.length === 0) {
        this.log(LogLevel.INFO, 'No files found in the database.');
        return { 
          success: true, 
          existCount, 
          notExistCount, 
          updatedCount, 
          errorCount 
        };
      }
      
      this.log(LogLevel.INFO, `Found ${dbFiles.length} files in the database`);
      
      // Process files in batches for better performance
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < dbFiles.length; i += batchSize) {
        batches.push(dbFiles.slice(i, i + batchSize));
      }
      
      // Process each batch
      for (const [batchIndex, batch] of batches.entries()) {
        this.log(LogLevel.INFO, `Processing batch ${batchIndex + 1}/${batches.length}...`);
        
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
                const { error } = await this.supabase
                  .from('doc_files')
                  .update({
                    file_hash: newHash,
                    file_size: fileSize,
                    last_modified_at: mtime,
                    updated_at: new Date()
                  })
                  .eq('id', file.id);
                
                if (error) {
                  this.log(LogLevel.ERROR, `Error updating ${file.file_path}:`, error);
                  errorCount++;
                } else {
                  this.log(LogLevel.INFO, `Updated ${file.file_path} with new hash and metadata`);
                  updatedCount++;
                }
              } else if (!file.file_size) {
                // Ensure metadata is standardized
                const { error } = await this.supabase
                  .from('doc_files')
                  .update({
                    file_size: fileSize,
                    last_modified_at: mtime
                  })
                  .eq('id', file.id);
                
                if (error) {
                  this.log(LogLevel.ERROR, `Error standardizing metadata for ${file.file_path}:`, error);
                  errorCount++;
                } else {
                  this.log(LogLevel.INFO, `Standardized metadata for ${file.file_path}`);
                  updatedCount++;
                }
              }
            } catch (error) {
              this.log(LogLevel.ERROR, `Error processing ${file.file_path}:`, error);
              errorCount++;
            }
          } else {
            // File doesn't exist, mark for deletion
            notExistCount++;
            this.log(LogLevel.INFO, `File ${file.file_path} no longer exists on disk`);
            
            // Hard delete from the database
            const { error } = await this.supabase
              .from('doc_files')
              .delete()
              .eq('id', file.id);
            
            if (error) {
              this.log(LogLevel.ERROR, `Error deleting ${file.file_path}:`, error);
              errorCount++;
            } else {
              this.log(LogLevel.INFO, `Deleted ${file.file_path} from database`);
            }
          }
        }
      }
      
      this.log(LogLevel.INFO, `\nSync Results:`);
      this.log(LogLevel.INFO, `- ${existCount} files exist on disk`);
      this.log(LogLevel.INFO, `- ${notExistCount} files no longer exist and were removed from database`);
      this.log(LogLevel.INFO, `- ${updatedCount} files had their metadata updated`);
      this.log(LogLevel.INFO, `- ${errorCount} errors occurred during processing`);
      
      return { 
        success: errorCount === 0, 
        existCount, 
        notExistCount, 
        updatedCount, 
        errorCount 
      };
    } catch (error) {
      this.log(LogLevel.ERROR, 'Error in syncFiles:', error);
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
  public async findNewFiles(): Promise<{ 
    success: boolean; 
    added: number; 
    errors: number;
    total: number;
  }> {
    this.log(LogLevel.INFO, '🔍 Finding new document files...');
    
    try {
      // First, get all existing file paths from the database
      const { data: existingFiles, error: fetchError } = await this.supabase
        .from('doc_files')
        .select('file_path');
      
      if (fetchError) {
        throw new Error(`Error fetching existing files: ${fetchError.message}`);
      }
      
      // Create a Set of existing file paths for faster lookup
      const existingPaths = new Set(existingFiles.map(file => file.file_path));
      
      // Find all documentation files on disk
      this.log(LogLevel.INFO, 'Scanning directories for documentation files...');
      const allFiles = this.walkDir(this.rootDir);
      this.log(LogLevel.INFO, `Found ${allFiles.length} potential documentation files on disk`);
      
      // Filter for only new files
      const newFiles = allFiles.filter(file => !existingPaths.has(file.path));
      this.log(LogLevel.INFO, `Found ${newFiles.length} new documentation files to add to the database`);
      
      if (newFiles.length === 0) {
        this.log(LogLevel.INFO, 'No new files to add.');
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
        this.log(LogLevel.INFO, `Processing batch ${batchIndex + 1}/${batches.length}...`);
        
        // Process files in this batch
        for (const file of batch) {
          const fullPath = path.join(this.rootDir, file.path);
          
          try {
            // Calculate file hash
            const fileHash = this.calculateFileHash(fullPath);
            
            if (!fileHash) {
              this.log(LogLevel.ERROR, `Could not calculate hash for ${file.path}, skipping`);
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
            const { error: insertError } = await this.supabase
              .from('doc_files')
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
              this.log(LogLevel.ERROR, `Error inserting ${file.path}:`, insertError);
              errorCount++;
            } else {
              this.log(LogLevel.INFO, `Added ${file.path} to the database`);
              addedCount++;
            }
          } catch (error) {
            this.log(LogLevel.ERROR, `Error processing ${file.path}:`, error);
            errorCount++;
          }
        }
      }
      
      this.log(LogLevel.INFO, `\nFind New Files Results:`);
      this.log(LogLevel.INFO, `- ${addedCount} new files added to the database`);
      this.log(LogLevel.INFO, `- ${errorCount} errors occurred during processing`);
      
      return { 
        success: errorCount === 0, 
        added: addedCount, 
        errors: errorCount,
        total: allFiles.length 
      };
    } catch (error) {
      this.log(LogLevel.ERROR, 'Error in findNewFiles:', error);
      return { success: false, added: 0, errors: 1, total: 0 };
    }
  }
  
  /**
   * Walk directory recursively and find all markdown/documentation files
   */
  private walkDir(dir: string): FileMetadata[] {
    try {
      const result: FileMetadata[] = [];
      
      // Check if directory exists and is accessible
      if (!fs.existsSync(dir)) {
        this.log(LogLevel.ERROR, `Directory does not exist: ${dir}`);
        return result;
      }
      
      // Read directory contents
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        
        try {
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
              // Recursively walk subdirectories
              const subDirFiles = this.walkDir(filePath);
              result.push(...subDirFiles);
            }
          } else if (stat.isFile()) {
            // Include markdown, txt, and common documentation formats
            const ext = path.extname(file).toLowerCase();
            if (['.md', '.txt', '.pdf', '.docx', '.doc', '.rtf'].includes(ext)) {
              // Get relative path from root directory
              const relativePath = path.relative(this.rootDir, filePath);
              result.push({
                path: relativePath,
                file_size: stat.size,
                mtime: stat.mtime
              });
            }
          }
        } catch (error) {
          this.log(LogLevel.ERROR, `Error processing file ${filePath}:`, error);
          // Continue with other files
        }
      }
      
      return result;
    } catch (error) {
      this.log(LogLevel.ERROR, `Error walking directory ${dir}:`, error);
      return [];
    }
  }
  
  /**
   * Show document files without a document type
   */
  public async showUntypedFiles(limit: number = 20): Promise<boolean> {
    this.log(LogLevel.INFO, '📋 Showing untyped document files...');
    
    try {
      // Query for files without a document type
      const { data, error } = await this.supabase
        .from('doc_files')
        .select('id, file_path, title, language, created_at, updated_at')
        .is('document_type_id', null)
        .order('updated_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        this.log(LogLevel.ERROR, 'Error fetching untyped files:', error);
        return false;
      }
      
      if (!data || data.length === 0) {
        this.log(LogLevel.INFO, 'No untyped files found.');
        return true;
      }
      
      this.log(LogLevel.INFO, `Found ${data.length} untyped document files:`);
      this.log(LogLevel.INFO, '----------------------------------------------');
      
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
      
      this.log(LogLevel.INFO, '----------------------------------------------');
      this.log(LogLevel.INFO, `Total: ${data.length} untyped documents`);
      
      return true;
    } catch (error) {
      this.log(LogLevel.ERROR, 'Error in showUntypedFiles:', error);
      return false;
    }
  }
  
  /**
   * Show recent document files
   */
  public async showRecentFiles(limit: number = 20): Promise<boolean> {
    this.log(LogLevel.INFO, `Fetching ${limit} recent files...`);
    
    try {
      const { data, error } = await this.supabase
        .from('doc_files')
        .select(`
          id, 
          file_path, 
          title, 
          language, 
          document_type_id,
          created_at, 
          updated_at
        `)
        .order('updated_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        this.log(LogLevel.ERROR, 'Error fetching recent files:', error);
        return false;
      }
      
      if (!data || data.length === 0) {
        this.log(LogLevel.INFO, 'No recent files found.');
        return true;
      }
      
      this.log(LogLevel.INFO, `Found ${data.length} recent document files:`);
      this.log(LogLevel.INFO, '----------------------------------------------');
      
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
      
      this.log(LogLevel.INFO, '----------------------------------------------');
      this.log(LogLevel.INFO, `Total: ${data.length} recent documents`);
      
      return true;
    } catch (error) {
      this.log(LogLevel.ERROR, 'Error in showRecentFiles:', error);
      return false;
    }
  }
}

// Create singleton instance
export const documentService = new DocumentService();