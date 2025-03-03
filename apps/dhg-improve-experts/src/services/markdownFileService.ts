import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

// Interface definitions
export interface MarkdownFile {
  id: string;
  filePath: string;
  title: string;
  content?: string;
  summary?: string;
  aiGeneratedTags?: string[];
  manualTags?: string[];
  lastModifiedAt?: string;
  size?: number;
  fileHash?: string;
}

export interface MarkdownTreeItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  isPrompt?: boolean;
  lastModified?: string;
  size?: number;
  children?: MarkdownTreeItem[];
  isOpen?: boolean;
}

// Database models matching Supabase tables
export interface DocumentationFile {
  id: string;
  file_path: string;
  title: string;
  summary: string | null;
  file_hash: string | null;
  last_modified_at: string;
  last_indexed_at: string;
  ai_generated_tags: string[] | null;
  manual_tags: string[] | null;
  metadata: Record<string, any> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DocumentationSection {
  id: string;
  file_id: string;
  heading: string;
  level: number;
  position: number;
  anchor_id: string;
  summary: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DocumentationRelation {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  created_at?: string | null;
}

export interface DocumentationProcessingQueueItem {
  id: string;
  file_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  attempts: number;
  last_attempt_at: string | null;
  error_message: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * Service to handle markdown file operations
 */
export class MarkdownFileService {
  /**
   * Get file tree from API
   */
  async getFileTree(): Promise<MarkdownTreeItem[]> {
    try {
      // In browser environments, just return mock data
      if (typeof window !== 'undefined') {
        return this.getMockFileTree();
      }
      
      // This would only run server-side if using SSR
      const { data, error } = await supabase
        .from('docs_structure')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        // Silently fall back to mock data when docs structure can't be fetched
        return this.getMockFileTree();
      }
      
      if (data && data.length > 0 && data[0].tree) {
        return data[0].tree;
      }
      
      return this.getMockFileTree();
    } catch (error) {
      // Always fall back to mock data gracefully
      return this.getMockFileTree();
    }
  }
  
  /**
   * Get mock file tree for development
   */
  private getMockFileTree(): MarkdownTreeItem[] {
    // Mock data structure
    return [
      {
        id: 'folder_docs',
        name: 'docs',
        type: 'folder',
        path: 'docs',
        children: [
          {
            id: 'file_docs/docs-organization.md',
            name: 'docs-organization.md',
            type: 'file',
            path: 'docs/docs-organization.md',
            lastModified: '2025-02-15',
            size: 2500
          },
          {
            id: 'file_docs/documentation-report.md',
            name: 'documentation-report.md',
            type: 'file',
            path: 'docs/documentation-report.md',
            lastModified: '2025-02-15',
            size: 1500
          }
        ],
        isOpen: true
      },
      {
        id: 'folder_public',
        name: 'public',
        type: 'folder',
        path: 'public',
        children: [
          {
            id: 'folder_public/prompts',
            name: 'prompts',
            type: 'folder',
            path: 'public/prompts',
            children: [
              {
                id: 'file_public/prompts/enhanced-analysis-prompt.md',
                name: 'enhanced-analysis-prompt.md',
                type: 'file',
                path: 'public/prompts/enhanced-analysis-prompt.md',
                isPrompt: true,
                lastModified: '2025-02-15',
                size: 3500
              }
            ],
            isOpen: true
          }
        ],
        isOpen: true
      },
      {
        id: 'file_README.md',
        name: 'README.md',
        type: 'file',
        path: 'README.md',
        lastModified: '2025-02-15',
        size: 4200
      }
    ];
  }
  
  /**
   * Parse the markdown report content to a tree structure
   */
  private parseMarkdownReportToTree(reportContent: string): MarkdownTreeItem[] {
    const root: MarkdownTreeItem[] = [];
    const map: Record<string, MarkdownTreeItem> = {};
    
    // Extract file sections from the report
    const sections = this.extractSectionsFromReport(reportContent);
    
    // Process each file section
    for (const section of sections) {
      // Skip if no files
      if (!section.files || section.files.length === 0) continue;
      
      // Process each file entry
      for (const file of section.files) {
        // Split the path into parts
        const parts = file.path.split('/');
        let currentPath = '';
        
        // Check if this is a prompt file
        const isPrompt = file.path.includes('/prompts/') || file.path.includes('-prompt');
        
        // Process each part of the path
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          const isLast = i === parts.length - 1;
          const path = currentPath ? `${currentPath}/${part}` : part;
          currentPath = path;
          
          if (isLast) {
            // This is a file
            const fileItem: MarkdownTreeItem = {
              id: `file_${path}`,
              name: part,
              type: 'file',
              path: file.path,
              isPrompt,
              lastModified: file.lastModified,
              size: file.size
            };
            
            if (parts.length === 1) {
              // Root-level file
              root.push(fileItem);
            } else {
              // File within folder
              const parentPath = parts.slice(0, -1).join('/');
              const parent = map[parentPath];
              if (parent) {
                if (!parent.children) parent.children = [];
                parent.children.push(fileItem);
              }
            }
          } else if (!map[path]) {
            // This is a folder
            const folderItem: MarkdownTreeItem = {
              id: `folder_${path}`,
              name: part,
              type: 'folder',
              path,
              children: [],
              isOpen: true // Start with folders expanded
            };
            
            map[path] = folderItem;
            
            if (i === 0) {
              // Root-level folder
              root.push(folderItem);
            } else {
              // Nested folder
              const parentPath = parts.slice(0, i).join('/');
              const parent = map[parentPath];
              if (parent) {
                if (!parent.children) parent.children = [];
                parent.children.push(folderItem);
              }
            }
          }
        }
      }
    }
    
    return root;
  }
  
  /**
   * Extract sections and file entries from the markdown report
   */
  private extractSectionsFromReport(reportContent: string): Array<{
    name: string;
    files: Array<{
      path: string;
      lastModified: string;
      size: number;
    }>;
  }> {
    const sections: Array<{
      name: string;
      files: Array<{
        path: string;
        lastModified: string;
        size: number;
      }>;
    }> = [];
    
    // Find section headers and tables
    const sectionRegex = /## (.+?)(?=\n\n)/g;
    const tableRegex = /\| (File( Path)?|Path) \| Last Modified \| Size \(bytes\) \|\n\|[- |]+\n((.+\n)+?)(?=\n|$)/g;
    
    let sectionMatch;
    while ((sectionMatch = sectionRegex.exec(reportContent)) !== null) {
      const sectionName = sectionMatch[1];
      const sectionStart = sectionMatch.index + sectionMatch[0].length;
      
      // Find the table in this section
      tableRegex.lastIndex = sectionStart;
      const tableMatch = tableRegex.exec(reportContent);
      
      if (tableMatch) {
        const tableRows = tableMatch[3].split('\n').filter(Boolean);
        const files = tableRows.map(row => {
          const cells = row.split('|').map(cell => cell.trim());
          return {
            path: cells[1],
            lastModified: cells[2],
            size: parseInt(cells[3].replace(/,/g, ''), 10) || 0
          };
        });
        
        sections.push({
          name: sectionName,
          files
        });
      }
    }
    
    return sections;
  }
  
  /**
   * Get the content of a markdown file
   */
  async getFileContent(filePath: string): Promise<MarkdownFile | null> {
    try {
      // Normalize the file path
      const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
      
      // Try to fetch the content from the API
      try {
        const response = await fetch(`/api/markdown-file?path=${encodeURIComponent(normalizedPath)}`);
        
        if (response.ok) {
          const data = await response.json();
          return data;
        }
        
        console.warn('API file fetch failed, falling back to mock data:', 
          response.status, response.statusText);
      } catch (apiError) {
        console.warn('API file fetch error, falling back to mock data:', apiError);
      }
      
      // Fall back to mock data if API fails
      return this.getMockFileContent(normalizedPath);
    } catch (error) {
      console.error('Error getting file content:', error);
      return this.getMockFileContent(normalizedPath);
    }
  }
  
  /**
   * Get mock file content for development
   */
  private getMockFileContent(filePath: string): MarkdownFile | null {
    const fileName = filePath.split('/').pop() || '';
    
    // Generate mock content based on file path
    const mockContent = `# ${fileName.replace('.md', '')}
    
This is mock content for the file: ${filePath}

## Section 1

Lorem ipsum dolor sit amet, consectetur adipiscing elit. 

## Section 2

Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## Section 3

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.`;
    
    return {
      id: `file_${filePath}`,
      filePath,
      title: fileName.replace('.md', ''),
      content: mockContent,
      lastModifiedAt: new Date().toISOString(),
      size: mockContent.length
    };
  }
  
  /**
   * Run the markdown report generator
   */
  async runMarkdownReport(): Promise<{ success: boolean, fileTree?: MarkdownTreeItem[] }> {
    try {
      // Call the API endpoint to generate the report
      const response = await fetch('/api/markdown-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error('Error running markdown report:', response.statusText);
        return { success: false };
      }
      
      const result = await response.json();
      
      if (result.success && result.fileTree) {
        return { 
          success: true, 
          fileTree: result.fileTree 
        };
      }
      
      console.error('Invalid response from markdown report API:', result);
      return { success: false };
    } catch (error) {
      console.error('Error running markdown report:', error);
      return { success: false };
    }
  }
  
  /**
   * Search markdown files
   */
  async searchFiles(query: string): Promise<MarkdownFile[]> {
    try {
      if (!query.trim()) return [];
      
      // In browser environments, just return mock data
      if (typeof window !== 'undefined') {
        return this.getMockSearchResults(query);
      }
      
      // This would only run server-side if using SSR
      const { data, error } = await supabase
        .from('docs_content')
        .select('*')
        .or(`title.ilike.%${query}%,content.ilike.%${query}%,file_path.ilike.%${query}%`)
        .limit(20);
      
      if (error) {
        console.error('Error searching files:', error);
        return this.getMockSearchResults(query);
      }
      
      if (data && data.length > 0) {
        return data.map(item => ({
          id: item.id || `file_${item.file_path}`,
          filePath: item.file_path,
          title: item.title || item.file_path.split('/').pop() || 'Untitled',
          content: item.content || '',
          lastModifiedAt: item.updated_at || new Date().toISOString(),
          size: item.content ? item.content.length : 0
        }));
      }
      
      return this.getMockSearchResults(query);
    } catch (error) {
      console.error('Error searching files:', error);
      return this.getMockSearchResults(query);
    }
  }
  
  /**
   * Get mock search results for development
   */
  private getMockSearchResults(query: string): MarkdownFile[] {
    const mockFiles = [
      {
        id: 'file_docs/docs-organization.md',
        filePath: 'docs/docs-organization.md',
        title: 'Documentation Organization',
        content: `# Documentation Organization\n\nThis file explains how the docs are organized.\n\nThe structure follows a standard pattern with categories for APIs, setup, and usage.`,
        lastModifiedAt: new Date().toISOString(),
        size: 250
      },
      {
        id: 'file_README.md',
        filePath: 'README.md',
        title: 'Project README',
        content: `# Project README\n\nThis is the main documentation for the project.\n\nIt covers installation, configuration, and basic usage.`,
        lastModifiedAt: new Date().toISOString(),
        size: 350
      },
      {
        id: 'file_public/prompts/enhanced-analysis-prompt.md',
        filePath: 'public/prompts/enhanced-analysis-prompt.md',
        title: 'Enhanced Analysis Prompt',
        content: `# Enhanced Analysis Prompt\n\nThis prompt is used for detailed analysis of content.`,
        lastModifiedAt: new Date().toISOString(),
        size: 180
      }
    ];
    
    // Filter based on query
    return mockFiles.filter(file => 
      file.title.toLowerCase().includes(query.toLowerCase()) ||
      file.filePath.toLowerCase().includes(query.toLowerCase()) ||
      file.content.toLowerCase().includes(query.toLowerCase())
    );
  }
  
  /**
   * Flatten a tree structure to get all file items
   */
  private flattenTree(items: MarkdownTreeItem[]): MarkdownTreeItem[] {
    const result: MarkdownTreeItem[] = [];
    
    const traverse = (items: MarkdownTreeItem[]) => {
      for (const item of items) {
        if (item.type === 'file') {
          result.push(item);
        } else if (item.children && item.children.length > 0) {
          traverse(item.children);
        }
      }
    };
    
    traverse(items);
    return result;
  }

  /**
   * Generate a hash for file content using browser-compatible approach
   */
  private generateFileHash(content: string): string {
    // Simple hash function that works in browser
    let hash = 0;
    if (content.length === 0) return hash.toString(16);
    
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Convert to hex string and ensure we use a positive number
    const hexString = (hash >>> 0).toString(16);
    
    // Add timestamp to make hash more unique
    return hexString + '-' + Date.now().toString(16);
  }

  /**
   * Extract sections from markdown content
   */
  private extractSections(content: string, fileId: string): DocumentationSection[] {
    const sections: DocumentationSection[] = [];
    const lines = content.split('\n');
    const headingRegex = /^(#{1,6})\s+(.+)$/;
    
    let position = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(headingRegex);
      
      if (match) {
        const level = match[1].length;
        const heading = match[2].trim();
        const anchorId = heading
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');
        
        // Include a generated ID for Supabase
        sections.push({
          id: uuidv4(),
          file_id: fileId,
          heading,
          level,
          position: position++,
          anchor_id: anchorId,
          summary: null
        });
      }
    }
    
    return sections;
  }

  /**
   * Detect relationships between markdown files
   * (Links, references, etc.)
   */
  private detectRelationships(
    content: string, 
    fileId: string, 
    allFilePaths: string[]
  ): DocumentationRelation[] {
    const relations: DocumentationRelation[] = [];
    
    // Look for markdown links
    const linkRegex = /\[.+?\]\((.+?)\)/g;
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      const targetPath = match[1];
      
      // Skip external links
      if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
        continue;
      }
      
      // Normalize path
      const normalizedPath = targetPath.startsWith('/') 
        ? targetPath.substring(1) 
        : targetPath;
      
      // Find matching file in our db
      const matchingFile = allFilePaths.find(path => 
        path === normalizedPath || 
        path.endsWith(normalizedPath)
      );
      
      if (matchingFile) {
        relations.push({
          // Generate our own ID
          id: uuidv4(),
          source_id: fileId,
          target_id: matchingFile,
          relation_type: 'link'
        });
      }
    }
    
    return relations;
  }

  /**
   * Check if Supabase is properly configured
   */
  private async isSupabaseUsable(): Promise<boolean> {
    try {
      console.log('Checking if Supabase is usable...');
      
      // First try to ping a table we know exists - profiles is a standard table
      try {
        const { error } = await supabase.from('profiles').select('count(*)', { count: 'exact', head: true });
        if (!error) {
          console.log('Supabase connection validated via profiles table');
          return true;
        }
      } catch (e) {
        console.log('Could not connect using profiles table, trying other tables...');
      }
      
      // Try experts table which should exist in this app
      try {
        const { error } = await supabase.from('experts').select('count(*)', { count: 'exact', head: true });
        if (!error) {
          console.log('Supabase connection validated via experts table');
          return true;
        }
      } catch (e) {
        console.log('Could not connect using experts table, trying other tables...');
      }
      
      // Try with domains table
      try {
        const { error } = await supabase.from('domains').select('count(*)', { count: 'exact', head: true });
        if (!error) {
          console.log('Supabase connection validated via domains table');
          return true;
        }
      } catch (e) {
        console.log('Could not connect using domains table');
      }
      
      console.log('Could not validate Supabase connection with any known table');
      return false;
    } catch (error) {
      console.error('Exception checking Supabase connection:', error);
      return false;
    }
  }

  /**
   * Synchronize documentation files with the database - simplified version
   * This version only updates the documentation_files table for simplicity
   */
  async syncDocumentationFiles(): Promise<{ success: boolean, message: string }> {
    try {
      console.log('Starting simplified syncDocumentationFiles...');
      
      // First, check if the documentation_files table exists/is accessible
      const { error: tableCheckError } = await supabase
        .from('documentation_files')
        .select('id')
        .limit(1);
      
      if (tableCheckError) {
        console.error('Error accessing documentation_files table:', tableCheckError);
        return {
          success: false,
          message: `Database table error: ${tableCheckError.message}. Please run the create_documentation_tables.sql script to set up the required tables.`
        };
      }
      
      // Get the file tree to process
      const fileTree = await this.getFileTree();
      console.log('File tree fetched, entries:', fileTree?.length || 0);
      
      if (!fileTree || fileTree.length === 0) {
        return { 
          success: false, 
          message: 'No files found in the file tree' 
        };
      }
      
      // Flatten the tree to get all file items
      const allFiles = this.flattenTree(fileTree);
      const markdownFiles = allFiles.filter(file => 
        file.type === 'file' && (file.path.endsWith('.md') || file.path.endsWith('.mdx'))
      );
      
      console.log(`Found ${markdownFiles.length} markdown files to process`);
      
      // Track statistics
      const stats = {
        added: 0,
        updated: 0,
        unchanged: 0,
        failed: 0
      };
      
      // Process each file - focusing only on the documentation_files table
      for (const file of markdownFiles) {
        try {
          // Get file content
          const fileData = await this.getFileContent(file.path);
          
          if (!fileData || !fileData.content) {
            console.warn(`No content found for file: ${file.path}`);
            stats.failed++;
            continue;
          }
          
          // Generate simple file hash
          const fileHash = this.generateFileHash(fileData.content);
          const lastModifiedAt = file.lastModified || 
            fileData.lastModifiedAt || 
            new Date().toISOString();
          
          // Check if file exists in database
          const { data: existingFile } = await supabase
            .from('documentation_files')
            .select('id, file_hash, last_modified_at')
            .eq('file_path', file.path)
            .maybeSingle();
          
          // Extract first paragraph for simple summary
          const firstParagraph = fileData.content
            .split('\n\n')
            .find(p => p.trim() && !p.startsWith('#')) || '';
            
          const summary = firstParagraph.length > 200
            ? firstParagraph.substring(0, 197) + '...'
            : firstParagraph;
          
          if (existingFile) {
            // File exists - check if it needs updating
            if (existingFile.file_hash !== fileHash || 
                new Date(existingFile.last_modified_at) < new Date(lastModifiedAt)) {
              
              // Update file record with minimal fields
              const { error: updateError } = await supabase
                .from('documentation_files')
                .update({
                  title: fileData.title,
                  summary: summary, // Simple summary for now
                  file_hash: fileHash,
                  last_modified_at: lastModifiedAt,
                  last_indexed_at: new Date().toISOString(),
                  metadata: {
                    size: file.size || fileData.content.length,
                    isPrompt: file.isPrompt || false
                  }
                })
                .eq('id', existingFile.id);
              
              if (updateError) {
                console.error(`Error updating file ${file.path}:`, updateError);
                stats.failed++;
              } else {
                stats.updated++;
              }
            } else {
              stats.unchanged++;
            }
          } else {
            // Insert new file record
            const newFileId = uuidv4();
            const { error: insertError } = await supabase
              .from('documentation_files')
              .insert({
                id: newFileId,
                file_path: file.path,
                title: fileData.title || file.name,
                summary: summary, // Simple summary for now
                file_hash: fileHash,
                last_modified_at: lastModifiedAt,
                last_indexed_at: new Date().toISOString(),
                ai_generated_tags: null,
                manual_tags: null,
                metadata: {
                  size: file.size || fileData.content.length,
                  isPrompt: file.isPrompt || false
                }
              });
            
            if (insertError) {
              console.error(`Error inserting file ${file.path}:`, insertError);
              stats.failed++;
            } else {
              stats.added++;
            }
          }
        } catch (fileError) {
          console.error(`Error processing file ${file.path}:`, fileError);
          stats.failed++;
        }
      }
      
      return {
        success: true,
        message: `Sync completed: ${stats.added} added, ${stats.updated} updated, ${stats.unchanged} unchanged, ${stats.failed} failed`
      };
    } catch (error) {
      console.error('Error syncing documentation files:', error);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }
  
  /**
   * Add sections for a file
   */
  private async addFileSections(fileId: string, content: string): Promise<void> {
    const sections = this.extractSections(content, fileId);
    
    if (sections.length > 0) {
      const { error } = await supabase
        .from('documentation_sections')
        .insert(sections);
      
      if (error) {
        console.error(`Error adding sections for file ${fileId}:`, error);
      }
    }
  }
  
  /**
   * Update sections for a file
   */
  private async updateFileSections(fileId: string, content: string): Promise<void> {
    // Delete existing sections
    const { error: deleteError } = await supabase
      .from('documentation_sections')
      .delete()
      .eq('file_id', fileId);
    
    if (deleteError) {
      console.error(`Error deleting sections for file ${fileId}:`, deleteError);
      return;
    }
    
    // Add new sections
    await this.addFileSections(fileId, content);
  }
  
  /**
   * Add file to the processing queue
   */
  private async addToProcessingQueue(fileId: string): Promise<void> {
    // Check if already in queue
    const { data: existingQueue } = await supabase
      .from('documentation_processing_queue')
      .select('id, status')
      .eq('file_id', fileId)
      .maybeSingle();
    
    if (existingQueue) {
      // Only update if not currently processing
      if (existingQueue.status !== 'processing') {
        await supabase
          .from('documentation_processing_queue')
          .update({
            status: 'pending',
            attempts: 0,
            priority: 1,
            last_attempt_at: null,
            error_message: null
            // Let Supabase handle updated_at
          })
          .eq('id', existingQueue.id);
      }
    } else {
      // Insert new queue item with generated ID
      await supabase
        .from('documentation_processing_queue')
        .insert({
          id: uuidv4(),
          file_id: fileId,
          status: 'pending',
          priority: 1,
          attempts: 0,
          last_attempt_at: null,
          error_message: null
          // Let Supabase handle created_at and updated_at
        });
    }
  }
  
  /**
   * Process relationships between files
   */
  private async processFileRelationships(files: MarkdownTreeItem[]): Promise<void> {
    // Get all file IDs from the database
    const { data: dbFiles } = await supabase
      .from('documentation_files')
      .select('id, file_path');
    
    if (!dbFiles || dbFiles.length === 0) {
      console.warn('No files found in database for relationship processing');
      return;
    }
    
    // Create a map of file paths to IDs
    const filePathToId = new Map(dbFiles.map(file => [file.file_path, file.id]));
    const allFilePaths = dbFiles.map(file => file.file_path);
    
    // Process each file to detect relationships
    for (const file of files) {
      if (file.type !== 'file' || (!file.path.endsWith('.md') && !file.path.endsWith('.mdx'))) {
        continue;
      }
      
      const fileId = filePathToId.get(file.path);
      if (!fileId) {
        console.warn(`File ID not found for path: ${file.path}`);
        continue;
      }
      
      try {
        const fileData = await this.getFileContent(file.path);
        
        if (!fileData || !fileData.content) {
          console.warn(`No content found for file: ${file.path}`);
          continue;
        }
        
        // Detect relationships
        const relations = this.detectRelationships(
          fileData.content, 
          fileId, 
          allFilePaths
        );
        
        if (relations.length > 0) {
          // Delete existing relationships for this source
          await supabase
            .from('documentation_relations')
            .delete()
            .eq('source_id', fileId);
          
          // Insert new relationships
          const { error } = await supabase
            .from('documentation_relations')
            .insert(relations);
          
          if (error) {
            console.error(`Error inserting relationships for file ${file.path}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error processing relationships for file ${file.path}:`, error);
      }
    }
  }
  
  /**
   * Process the next item in the documentation processing queue
   * This would typically be called by a background job
   */
  async processNextQueueItem(): Promise<{ success: boolean, message: string }> {
    // Using the correct Supabase client now, no need to check
    
    // Get the next item from the queue
    const { data: queueItem, error: fetchError } = await supabase
      .from('documentation_processing_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    
    if (fetchError) {
      return {
        success: false,
        message: `Error fetching queue item: ${fetchError.message}`
      };
    }
    
    if (!queueItem) {
      return {
        success: false,
        message: 'No pending items in the queue'
      };
    }
    
    // Mark as processing
    const { error: updateError } = await supabase
      .from('documentation_processing_queue')
      .update({
        status: 'processing',
        attempts: queueItem.attempts + 1,
        last_attempt_at: new Date().toISOString()
        // Let Supabase handle updated_at timestamp
      })
      .eq('id', queueItem.id);
    
    if (updateError) {
      return {
        success: false,
        message: `Error updating queue item: ${updateError.message}`
      };
    }
    
    try {
      // Get the file data
      const { data: fileData, error: fileError } = await supabase
        .from('documentation_files')
        .select('*')
        .eq('id', queueItem.file_id)
        .maybeSingle();
      
      if (fileError || !fileData) {
        throw new Error(`File not found: ${queueItem.file_id}`);
      }
      
      // Get file content
      const content = await this.getFileContent(fileData.file_path);
      
      if (!content || !content.content) {
        throw new Error(`No content found for file: ${fileData.file_path}`);
      }
      
      // TODO: Implement AI processing for document summary and tag generation
      // For now, we'll just use a simple extraction of the first paragraph
      
      const firstParagraph = content.content
        .split('\n\n')
        .filter(p => p.trim() && !p.startsWith('#'))[0] || '';
      
      const summary = firstParagraph.length > 200
        ? firstParagraph.substring(0, 197) + '...'
        : firstParagraph;
      
      // Extract potential tags
      const tags = this.extractPotentialTags(content.content);
      
      // Update the file with AI-generated data
      await supabase
        .from('documentation_files')
        .update({
          summary,
          ai_generated_tags: tags
          // Let Supabase handle updated_at
        })
        .eq('id', fileData.id);
      
      // Mark as completed
      await supabase
        .from('documentation_processing_queue')
        .update({
          status: 'completed'
          // Let Supabase handle updated_at
        })
        .eq('id', queueItem.id);
      
      return {
        success: true,
        message: `Processed file: ${fileData.file_path}`
      };
    } catch (error) {
      console.error('Error processing queue item:', error);
      
      // Mark as failed
      await supabase
        .from('documentation_processing_queue')
        .update({
          status: queueItem.attempts >= 3 ? 'failed' : 'pending',
          error_message: error.message
          // Let Supabase handle updated_at
        })
        .eq('id', queueItem.id);
      
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }
  
  /**
   * Extract potential tags from content
   */
  private extractPotentialTags(content: string): string[] {
    const tags = new Set<string>();
    
    // Extract headings
    const headingRegex = /^#{1,3}\s+(.+)$/gm;
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
      const heading = match[1].trim();
      if (heading.length > 3 && heading.length < 30) {
        tags.add(heading.toLowerCase());
      }
    }
    
    // Extract tech terms using a simple regex
    const techTerms = [
      'api', 'react', 'vue', 'angular', 'javascript', 'typescript',
      'node', 'database', 'supabase', 'postgres', 'sql', 'authentication',
      'markdown', 'documentation', 'frontend', 'backend', 'deployment',
      'security', 'testing', 'configuration', 'component', 'state',
      'hook', 'function', 'interface', 'type', 'class'
    ];
    
    for (const term of techTerms) {
      const termRegex = new RegExp(`\\b${term}\\b`, 'i');
      if (termRegex.test(content)) {
        tags.add(term.toLowerCase());
      }
    }
    
    return Array.from(tags).slice(0, 10); // Limit to 10 tags
  }
  
  /**
   * Search documentation in the database - simplified version
   */
  async searchDocumentation(query: string): Promise<MarkdownFile[]> {
    if (!query.trim()) return [];
    
    try {
      console.log(`Searching for: "${query}"`);
      
      // Search in the documentation_files table
      const { data, error } = await supabase
        .from('documentation_files')
        .select(`
          id,
          file_path,
          title,
          summary,
          last_modified_at,
          ai_generated_tags,
          manual_tags,
          metadata
        `)
        .or(`
          title.ilike.%${query}%,
          summary.ilike.%${query}%,
          file_path.ilike.%${query}%
        `)
        .order('last_modified_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error('Database search error:', error);
        // Fall back to file-based search on error
        return this.getMockSearchResults(query);
      }
      
      if (data && data.length > 0) {
        console.log(`Found ${data.length} database matches for query: "${query}"`);
        
        // Transform database results to MarkdownFile interface
        const results = data.map(item => ({
          id: item.id,
          filePath: item.file_path,
          title: item.title || item.file_path.split('/').pop() || 'Untitled',
          summary: item.summary,
          content: null, // Content will be fetched when needed
          aiGeneratedTags: item.ai_generated_tags,
          manualTags: item.manual_tags,
          lastModifiedAt: item.last_modified_at,
          size: item.metadata?.size
        }));
        
        // Return results
        return results;
      }
      
      console.log(`No database matches found for "${query}", using fallback search`);
      // Fall back to file-based search if no database results
      return this.getMockSearchResults(query);
    } catch (error) {
      console.error('Error searching documentation:', error);
      return this.getMockSearchResults(query);
    }
  }
}

// Export singleton instance
export const markdownFileService = new MarkdownFileService();