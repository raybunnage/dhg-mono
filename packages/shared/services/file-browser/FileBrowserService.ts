import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  mtime: Date | null;
  path: string;
}

export interface DirectoryListingOptions {
  dirPath?: string;
  sortByDate?: boolean;
}

export interface FileSearchOptions {
  searchTerm: string;
  searchPath?: string;
  maxResults?: number;
}

export class FileBrowserService {
  private basePath: string;

  constructor(basePath?: string) {
    // Default to repository root
    this.basePath = basePath || path.resolve(__dirname, '../../../../..');
  }

  /**
   * List directory contents with security checks
   */
  async listDirectory(options: DirectoryListingOptions = {}): Promise<FileItem[]> {
    const { dirPath = '', sortByDate = true } = options;
    const fullPath = path.join(this.basePath, dirPath);
    
    // Security check - ensure we're within the base path
    if (!fullPath.startsWith(this.basePath)) {
      throw new Error('Access denied: Path outside base directory');
    }

    const items = await fs.readdir(fullPath, { withFileTypes: true });
    
    const result = await Promise.all(
      items.map(async (item) => {
        const itemPath = path.join(fullPath, item.name);
        let type: 'file' | 'directory' = item.isDirectory() ? 'directory' : 'file';
        let size = 0;
        let mtime: Date | null = null;
        
        try {
          const stats = await fs.stat(itemPath);
          size = stats.size;
          mtime = stats.mtime;
        } catch (e) {
          // Ignore stat errors (permissions, broken links, etc.)
        }
        
        return {
          name: item.name,
          type,
          size,
          mtime,
          path: path.relative(this.basePath, itemPath)
        };
      })
    );
    
    if (sortByDate) {
      // Sort by modification time (most recent first)
      result.sort((a, b) => {
        // Directories first, then files
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        
        // Within same type, sort by modification time (most recent first)
        if (a.mtime && b.mtime) {
          return b.mtime.getTime() - a.mtime.getTime();
        }
        
        // Fallback to alphabetical if no mtime
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
    }

    return result;
  }

  /**
   * Read file content with security checks
   */
  async readFile(filePath: string): Promise<string> {
    const fullPath = path.join(this.basePath, filePath);
    
    // Security check
    if (!fullPath.startsWith(this.basePath)) {
      throw new Error('Access denied: Path outside base directory');
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  }

  /**
   * Search for files by name
   */
  async searchFiles(options: FileSearchOptions): Promise<FileItem[]> {
    const { searchTerm, searchPath = '', maxResults = 100 } = options;
    const fullPath = path.join(this.basePath, searchPath);
    
    if (!fullPath.startsWith(this.basePath)) {
      throw new Error('Access denied: Path outside base directory');
    }

    const results: FileItem[] = [];
    await this.searchFilesRecursive(fullPath, searchTerm.toLowerCase(), results, maxResults);
    
    return results.slice(0, maxResults);
  }

  /**
   * Recursive file search helper
   */
  private async searchFilesRecursive(
    dir: string, 
    searchTerm: string, 
    results: FileItem[], 
    maxResults: number
  ): Promise<void> {
    if (results.length >= maxResults) return;

    try {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        // Skip node_modules, .git, and other common large directories
        if (['node_modules', '.git', '.next', 'dist', 'build'].includes(item.name)) {
          continue;
        }
        
        if (item.name.toLowerCase().includes(searchTerm)) {
          results.push({
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            size: 0,
            mtime: null,
            path: path.relative(this.basePath, fullPath)
          });
        }
        
        if (item.isDirectory() && results.length < maxResults) {
          await this.searchFilesRecursive(fullPath, searchTerm, results, maxResults);
        }
      }
    } catch (error) {
      // Ignore errors (e.g., permission denied)
    }
  }

  /**
   * Get statistics about a path
   */
  async getPathStats(filePath: string): Promise<fs.Stats> {
    const fullPath = path.join(this.basePath, filePath);
    
    if (!fullPath.startsWith(this.basePath)) {
      throw new Error('Access denied: Path outside base directory');
    }

    return await fs.stat(fullPath);
  }

  /**
   * Check if a path exists
   */
  async pathExists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, filePath);
    
    if (!fullPath.startsWith(this.basePath)) {
      return false;
    }

    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}