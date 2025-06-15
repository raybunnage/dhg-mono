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
export declare class HtmlFileBrowserService {
    private static instance;
    private basePath;
    private excludedDirs;
    private constructor();
    static getInstance(): HtmlFileBrowserService;
    /**
     * Configure the service
     */
    configure(options: {
        basePath?: string;
        excludeDirs?: string[];
    }): void;
    /**
     * Get the base path
     */
    getBasePath(): string;
    /**
     * Validate that a path is within the base path
     */
    private validatePath;
    /**
     * List directory contents
     */
    listDirectory(dirPath?: string): Promise<FileItem[]>;
    /**
     * Read file content
     */
    readFile(filePath: string): Promise<string>;
    /**
     * Search for files
     */
    searchFiles(searchTerm: string, options?: SearchOptions): Promise<FileItem[]>;
    /**
     * Recursive search implementation
     */
    private searchRecursive;
    /**
     * Sort file items
     */
    private sortFileItems;
    /**
     * Get file/directory stats
     */
    getStats(filePath: string): Promise<{
        exists: boolean;
        isDirectory: boolean;
        isFile: boolean;
        size: number;
        mtime: Date | null;
    }>;
}
//# sourceMappingURL=HtmlFileBrowserService.d.ts.map