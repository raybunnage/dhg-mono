export interface MarkdownFile {
    file_path: string;
    title: string;
    content: string;
    size: number;
    created_at: Date;
    updated_at: Date;
}
export interface MarkdownListResult {
    total: number;
    files: string[];
}
export declare class MarkdownViewerService {
    private static instance;
    private projectRoot;
    private archivedFolder;
    private allowedExtensions;
    private constructor();
    static getInstance(): MarkdownViewerService;
    /**
     * Configure the service
     */
    configure(options: {
        projectRoot?: string;
    }): void;
    /**
     * Validate file extension
     */
    private validateExtension;
    /**
     * Get markdown file content
     */
    getMarkdownFile(filePath: string): Promise<MarkdownFile>;
    /**
     * List all markdown files
     */
    listMarkdownFiles(): Promise<MarkdownListResult>;
    /**
     * Archive a markdown file
     */
    archiveMarkdownFile(filePath: string): Promise<{
        success: boolean;
        originalPath: string;
        archivedPath: string;
    }>;
    /**
     * Delete a markdown file (permanent deletion)
     */
    deleteMarkdownFile(filePath: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=MarkdownViewerService.d.ts.map