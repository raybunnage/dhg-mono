import { supabase } from '@/lib/supabase';

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
        console.error('Error fetching docs structure:', error);
        return this.getMockFileTree();
      }
      
      if (data && data.length > 0 && data[0].tree) {
        return data[0].tree;
      }
      
      return this.getMockFileTree();
    } catch (error) {
      console.error('Error getting file tree:', error);
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
}

// Export singleton instance
export const markdownFileService = new MarkdownFileService();