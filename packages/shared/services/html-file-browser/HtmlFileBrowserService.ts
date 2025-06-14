import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  mtime: Date | null;
  path: string;
}

export interface SearchOptions {
  searchPath?: string;
  maxResults?: number;
  excludeDirs?: string[];
}

export class HtmlFileBrowserService {
  private static instance: HtmlFileBrowserService;
  private basePath: string;
  private excludedDirs: Set<string>;

  private constructor() {
    // Default to project root
    this.basePath = path.resolve(process.cwd());
    this.excludedDirs = new Set(['node_modules', '.git', '.next', 'dist', 'build']);
  }

  static getInstance(): HtmlFileBrowserService {
    if (!HtmlFileBrowserService.instance) {
      HtmlFileBrowserService.instance = new HtmlFileBrowserService();
    }
    return HtmlFileBrowserService.instance;
  }

  /**
   * Configure the service
   */
  configure(options: { basePath?: string; excludeDirs?: string[] }) {
    if (options.basePath) {
      this.basePath = path.resolve(options.basePath);
    }
    if (options.excludeDirs) {
      this.excludedDirs = new Set(options.excludeDirs);
    }
  }

  /**
   * Get the base path
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Validate that a path is within the base path
   */
  private validatePath(requestedPath: string): string {
    const fullPath = path.join(this.basePath, requestedPath);
    
    // Ensure the resolved path is within the base path
    if (!fullPath.startsWith(this.basePath)) {
      throw new Error('Access denied: Path outside of base directory');
    }
    
    return fullPath;
  }

  /**
   * List directory contents
   */
  async listDirectory(dirPath: string = ''): Promise<FileItem[]> {
    const fullPath = this.validatePath(dirPath);
    
    try {
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
            // Ignore stat errors (e.g., broken symlinks)
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
      
      // Sort by modification time (most recent first)
      return this.sortFileItems(result);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory not found: ${dirPath}`);
      }
      if (error.code === 'ENOTDIR') {
        throw new Error(`Not a directory: ${dirPath}`);
      }
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${dirPath}`);
      }
      throw error;
    }
  }

  /**
   * Read file content
   */
  async readFile(filePath: string): Promise<string> {
    const fullPath = this.validatePath(filePath);
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      if (error.code === 'EISDIR') {
        throw new Error(`Cannot read directory: ${filePath}`);
      }
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * Search for files
   */
  async searchFiles(searchTerm: string, options: SearchOptions = {}): Promise<FileItem[]> {
    const {
      searchPath = '',
      maxResults = 100,
      excludeDirs = Array.from(this.excludedDirs)
    } = options;

    const fullPath = this.validatePath(searchPath);
    const results: FileItem[] = [];
    const searchTermLower = searchTerm.toLowerCase();
    
    await this.searchRecursive(fullPath, searchTermLower, results, maxResults, new Set(excludeDirs));
    
    return results;
  }

  /**
   * Recursive search implementation
   */
  private async searchRecursive(
    dir: string,
    searchTerm: string,
    results: FileItem[],
    maxResults: number,
    excludeDirs: Set<string>
  ): Promise<void> {
    if (results.length >= maxResults) {
      return;
    }

    try {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        if (results.length >= maxResults) {
          break;
        }

        const fullPath = path.join(dir, item.name);
        
        // Skip excluded directories
        if (item.isDirectory() && excludeDirs.has(item.name)) {
          continue;
        }
        
        // Check if name matches search term
        if (item.name.toLowerCase().includes(searchTerm)) {
          let size = 0;
          let mtime: Date | null = null;
          
          try {
            const stats = await fs.stat(fullPath);
            size = stats.size;
            mtime = stats.mtime;
          } catch (e) {
            // Ignore stat errors
          }
          
          results.push({
            name: item.name,
            type: item.isDirectory() ? 'directory' : 'file',
            size,
            mtime,
            path: path.relative(this.basePath, fullPath)
          });
        }
        
        // Recurse into directories
        if (item.isDirectory() && results.length < maxResults) {
          await this.searchRecursive(fullPath, searchTerm, results, maxResults, excludeDirs);
        }
      }
    } catch (error) {
      // Ignore errors (e.g., permission denied)
      console.debug(`Search error in ${dir}:`, error);
    }
  }

  /**
   * Sort file items
   */
  private sortFileItems(items: FileItem[]): FileItem[] {
    return items.sort((a, b) => {
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

  /**
   * Get file/directory stats
   */
  async getStats(filePath: string): Promise<{
    exists: boolean;
    isDirectory: boolean;
    isFile: boolean;
    size: number;
    mtime: Date | null;
  }> {
    const fullPath = this.validatePath(filePath);
    
    try {
      const stats = await fs.stat(fullPath);
      return {
        exists: true,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.size,
        mtime: stats.mtime
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {
          exists: false,
          isDirectory: false,
          isFile: false,
          size: 0,
          mtime: null
        };
      }
      throw error;
    }
  }
}