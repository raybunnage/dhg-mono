import * as fs from 'fs/promises';
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
export declare class FileBrowserService {
    private basePath;
    constructor(basePath?: string);
    /**
     * List directory contents with security checks
     */
    listDirectory(options?: DirectoryListingOptions): Promise<FileItem[]>;
    /**
     * Read file content with security checks
     */
    readFile(filePath: string): Promise<string>;
    /**
     * Search for files by name
     */
    searchFiles(options: FileSearchOptions): Promise<FileItem[]>;
    /**
     * Recursive file search helper
     */
    private searchFilesRecursive;
    /**
     * Get statistics about a path
     */
    getPathStats(filePath: string): Promise<fs.Stats>;
    /**
     * Check if a path exists
     */
    pathExists(filePath: string): Promise<boolean>;
}
//# sourceMappingURL=FileBrowserService.d.ts.map