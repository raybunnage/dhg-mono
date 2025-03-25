import { SupabaseClient } from '../supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { normalizePath } from './path-normalizer';

/**
 * Interface for a discovered documentation file
 */
export interface DiscoveredFile {
  file_path: string;
  title?: string;
  summary?: string;
  file_hash?: string;
  metadata?: any;
}

/**
 * Result of the file discovery process
 */
export interface DiscoveryResult {
  newFiles: DiscoveredFile[];
  existingCount: number;
  totalScanned: number;
  errors: string[];
}

/**
 * Service to discover documentation files that aren't yet in the database
 */
export class FileDiscoveryService {
  private supabase: SupabaseClient;
  private rootDir: string;
  private existingFiles: Set<string> = new Set();
  private errors: string[] = [];
  
  /**
   * Directories to search in for documentation files
   */
  private searchDirs = [
    'docs',
    'packages',
    'apps'
  ];
  
  /**
   * File extensions to consider as documentation
   */
  private docExtensions = [
    '.md',
    '.mdx'
    // '.txt' files are excluded as per requirements
  ];
  
  /**
   * Directories to exclude from search
   */
  private excludeDirs = [
    'node_modules',
    'dist',
    '.git',
    'build',
    'coverage',
    'public',
    '.next',
    '.cache',
    '.vscode'
  ];
  
  constructor(supabase: SupabaseClient, rootDir: string = process.cwd()) {
    this.supabase = supabase;
    this.rootDir = rootDir;
  }
  
  /**
   * Load existing files from the database
   */
  private async loadExistingFiles(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('documentation_files')
        .select('file_path')
        .order('file_path');
        
      if (error) {
        throw new Error(`Failed to fetch existing files: ${error.message}`);
      }
      
      // Store normalized paths in our set for quick lookup
      this.existingFiles = new Set(
        (data || []).map(file => file.file_path.toLowerCase())
      );
      
      console.log(`Loaded ${this.existingFiles.size} existing documentation files from database`);
    } catch (error) {
      this.errors.push(`Error loading existing files: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Calculate a hash of the file contents
   */
  private calculateFileHash(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
      this.errors.push(`Error calculating hash for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }
  
  /**
   * Extract a title from the file contents
   * For markdown files, tries to find the first heading
   */
  private extractFileTitle(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const extension = path.extname(filePath).toLowerCase();
      
      if (extension === '.md' || extension === '.mdx') {
        // Try to find the first markdown heading
        const headingMatch = content.match(/^#\s+(.+)$/m) || content.match(/^(.+)\n=+\s*$/m);
        if (headingMatch && headingMatch[1]) {
          return headingMatch[1].trim();
        }
      }
      
      // Default to the filename without extension
      return path.basename(filePath, path.extname(filePath))
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    } catch (error) {
      this.errors.push(`Error extracting title for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      return path.basename(filePath, path.extname(filePath));
    }
  }
  
  /**
   * Extract a brief summary from the file contents
   */
  private extractFileSummary(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const extension = path.extname(filePath).toLowerCase();
      
      if (extension === '.md' || extension === '.mdx') {
        // For markdown, skip the title and get the first paragraph
        const lines = content.split('\n');
        
        // Skip the title heading and empty lines
        let startIndex = 0;
        
        // Skip any frontmatter if present
        if (content.startsWith('---')) {
          const frontmatterEnd = content.indexOf('---', 3);
          if (frontmatterEnd > 0) {
            startIndex = content.substring(0, frontmatterEnd).split('\n').length;
          }
        }
        
        // Skip heading lines
        while (startIndex < lines.length && 
               (lines[startIndex].trim() === '' || 
                lines[startIndex].startsWith('#') || 
                lines[startIndex].match(/^=+$/) || 
                lines[startIndex].match(/^-+$/))) {
          startIndex++;
        }
        
        // Collect non-empty lines until we hit another heading or 5 lines
        const summaryLines = [];
        let lineCount = 0;
        
        for (let i = startIndex; i < lines.length && lineCount < 5; i++) {
          const line = lines[i].trim();
          if (line === '' || line.startsWith('#') || line.startsWith('![')) {
            // Stop at empty lines, headings, or images
            if (summaryLines.length > 0) break;
            continue;
          }
          
          summaryLines.push(line);
          lineCount++;
        }
        
        if (summaryLines.length > 0) {
          return summaryLines.join(' ').substring(0, 250) + (summaryLines.join(' ').length > 250 ? '...' : '');
        }
      }
      
      // Default to first 250 chars of content
      const summary = content.replace(/\s+/g, ' ').trim().substring(0, 250);
      return summary + (content.length > 250 ? '...' : '');
    } catch (error) {
      this.errors.push(`Error extracting summary for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }
  
  /**
   * Gather metadata for the file
   */
  private gatherFileMetadata(filePath: string): any {
    try {
      const stats = fs.statSync(filePath);
      
      return {
        file_size: stats.size,
        created_at: stats.birthtime.toISOString(),
        modified_at: stats.mtime.toISOString(),
        extension: path.extname(filePath).replace('.', ''),
        is_markdown: path.extname(filePath).toLowerCase() === '.md'
      };
    } catch (error) {
      this.errors.push(`Error gathering metadata for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    }
  }
  
  /**
   * Check if a file is already in the database
   */
  private isFileInDatabase(normalizedPath: string): boolean {
    return this.existingFiles.has(normalizedPath.toLowerCase());
  }
  
  /**
   * Recursively scan directories for documentation files
   */
  private scanDirectory(dirPath: string, discoveredFiles: DiscoveredFile[] = [], fileCount = { count: 0 }): void {
    try {
      // Skip excluded directories
      const dirName = path.basename(dirPath);
      if (this.excludeDirs.includes(dirName)) {
        return;
      }
      
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          this.scanDirectory(fullPath, discoveredFiles, fileCount);
        } else if (entry.isFile()) {
          fileCount.count++;
          
          // Check if the file extension is in our documentation types
          const fileExt = path.extname(entry.name).toLowerCase();
          if (this.docExtensions.includes(fileExt)) {
            // Normalize the path relative to the root directory
            const relativePath = path.relative(this.rootDir, fullPath);
            const normalizedPath = normalizePath(relativePath);
            
            // Skip if the file is already in the database
            if (this.isFileInDatabase(normalizedPath)) {
              continue;
            }
            
            // Process the file
            const fileHash = this.calculateFileHash(fullPath);
            const title = this.extractFileTitle(fullPath);
            const summary = this.extractFileSummary(fullPath);
            const metadata = this.gatherFileMetadata(fullPath);
            
            // Add to our discoveries
            discoveredFiles.push({
              file_path: normalizedPath,
              title,
              summary,
              file_hash: fileHash,
              metadata
            });
          }
        }
      }
    } catch (error) {
      this.errors.push(`Error scanning directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Insert new files into the database
   */
  private async insertNewFiles(newFiles: DiscoveredFile[]): Promise<number> {
    if (newFiles.length === 0) {
      return 0;
    }
    
    try {
      // First, check if we can access the table
      const { data: tableTest, error: tableError } = await this.supabase
        .from('documentation_files')
        .select('count', { count: 'exact', head: true });
        
      if (tableError) {
        console.error('Cannot access documentation_files table:', tableError);
        this.errors.push(`Cannot access documentation_files table: ${tableError.message}`);
        return 0;
      }
      
      const now = new Date().toISOString();
      // Get a default document type ID for documentation
      let defaultDocTypeId = null;
      try {
        const { data: docTypes, error: docTypeError } = await this.supabase
          .from('document_types')
          .select('id, document_type')
          .eq('document_type', 'Documentation')
          .limit(1);
          
        if (docTypeError) {
          console.error('Error fetching default document type:', docTypeError);
        } else if (docTypes && docTypes.length > 0) {
          defaultDocTypeId = docTypes[0].id;
          console.log(`Found default document type ID: ${defaultDocTypeId} (${docTypes[0].document_type})`);
        } else {
          // Try to find any document type to use
          const { data: anyDocType, error: anyError } = await this.supabase
            .from('document_types')
            .select('id, document_type')
            .limit(1);
            
          if (anyError) {
            console.error('Error fetching any document type:', anyError);
          } else if (anyDocType && anyDocType.length > 0) {
            defaultDocTypeId = anyDocType[0].id;
            console.log(`Using fallback document type ID: ${defaultDocTypeId} (${anyDocType[0].document_type})`);
          } else {
            console.log('No document types found, will use null');
          }
        }
      } catch (docTypeError) {
        console.error('Exception fetching document types:', docTypeError);
      }
      
      const filesToInsert = newFiles.map(file => ({
        file_path: file.file_path,
        title: file.title || path.basename(file.file_path, path.extname(file.file_path)),
        summary: file.summary || '',
        file_hash: file.file_hash || '',
        metadata: file.metadata || {},
        last_modified_at: file.metadata?.modified_at || now,
        last_indexed_at: now,
        created_at: now,
        updated_at: now,
        ai_generated_tags: [],
        manual_tags: [],
        document_type_id: defaultDocTypeId,
        assessment_quality_score: 80  // default score
      }));
      
      // Log a sample record for debugging
      console.log('\nSample record for insertion:');
      console.log(JSON.stringify(filesToInsert[0], null, 2));
      
      // Check the database table structure to ensure we're matching required fields
      try {
        const { data: columns, error: columnsError } = await this.supabase
          .from('information_schema.columns')
          .select('column_name, is_nullable, data_type')
          .eq('table_schema', 'public')
          .eq('table_name', 'documentation_files');
          
        if (columnsError) {
          console.error('Error fetching table structure:', columnsError);
        } else if (columns) {
          console.log('\nDocumentation_files table structure:');
          const requiredColumns = columns.filter(col => col.is_nullable === 'NO');
          console.log('Required columns:', requiredColumns.map(c => c.column_name).join(', '));
          
          // Check if any required columns are missing from our insert data
          const missingColumns = requiredColumns.filter(col => 
            !Object.keys(filesToInsert[0]).includes(col.column_name) && 
            col.column_name !== 'id'  // Skip ID as it's auto-generated
          );
          
          if (missingColumns.length > 0) {
            console.warn('WARNING: Missing required columns in insert data:');
            console.warn(missingColumns.map(c => `${c.column_name} (${c.data_type})`).join(', '));
            
            // Add default values for missing required columns
            for (const file of filesToInsert) {
              for (const col of missingColumns) {
                const colName = col.column_name as string;
                
                if (col.data_type === 'text' || col.data_type.includes('char')) {
                  (file as any)[colName] = '';
                } else if (col.data_type.includes('int') || col.data_type.includes('double') || col.data_type.includes('float')) {
                  (file as any)[colName] = 0;
                } else if (col.data_type.includes('bool')) {
                  (file as any)[colName] = false;
                } else if (col.data_type.includes('json')) {
                  (file as any)[colName] = {};
                } else if (col.data_type.includes('timestamp')) {
                  (file as any)[colName] = now;
                }
              }
            }
            
            // Log the updated record
            console.log('\nUpdated sample record for insertion:');
            console.log(JSON.stringify(filesToInsert[0], null, 2));
          }
        }
      } catch (schemaError) {
        console.error('Error checking table schema:', schemaError);
      }
      
      // Insert one at a time for maximum reliability
      console.log('\nInserting files one by one...');
      let insertedCount = 0;
      
      for (let i = 0; i < filesToInsert.length; i++) {
        const file = filesToInsert[i];
        
        try {
          console.log(`\nInserting file ${i + 1}/${filesToInsert.length}: ${file.file_path}...`);
          
          const { data, error, status, statusText } = await this.supabase
            .from('documentation_files')
            .insert(file);
          
          console.log(`Status: ${status} ${statusText || ''}`);
            
          if (error) {
            console.error('Insert error:', error);
            this.errors.push(`Error inserting file ${file.file_path}: ${error.message}`);
          } else {
            insertedCount++;
            console.log(`Successfully inserted: ${file.file_path}`);
          }
        } catch (insertError) {
          console.error(`Exception inserting file ${file.file_path}:`, insertError);
          this.errors.push(`Exception inserting file ${file.file_path}: ${insertError instanceof Error ? insertError.message : String(insertError)}`);
        }
        
        // Short pause between insertions to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      return insertedCount;
    } catch (error) {
      console.error('Error inserting new files:', error);
      this.errors.push(`Error inserting new files: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
  
  /**
   * Discover new documentation files
   */
  public async discoverNewFiles(insertIntoDatabase: boolean = false): Promise<DiscoveryResult> {
    try {
      // Reset errors
      this.errors = [];
      
      // Load existing files from the database
      await this.loadExistingFiles();
      
      // Discover new files
      const discoveredFiles: DiscoveredFile[] = [];
      const fileCount = { count: 0 };
      
      // Scan each search directory
      for (const dir of this.searchDirs) {
        const searchPath = path.join(this.rootDir, dir);
        if (fs.existsSync(searchPath)) {
          console.log(`Scanning ${searchPath}...`);
          this.scanDirectory(searchPath, discoveredFiles, fileCount);
        }
      }
      
      console.log(`Found ${discoveredFiles.length} new documentation files out of ${fileCount.count} total files scanned`);
      
      // Insert new files if requested
      let insertedCount = 0;
      if (insertIntoDatabase && discoveredFiles.length > 0) {
        insertedCount = await this.insertNewFiles(discoveredFiles);
        console.log(`Successfully inserted ${insertedCount} of ${discoveredFiles.length} files into the database`);
      }
      
      return {
        newFiles: discoveredFiles,
        existingCount: this.existingFiles.size,
        totalScanned: fileCount.count,
        errors: this.errors
      };
    } catch (error) {
      this.errors.push(`Unexpected error in discovery process: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        newFiles: [],
        existingCount: this.existingFiles.size,
        totalScanned: 0,
        errors: this.errors
      };
    }
  }
}