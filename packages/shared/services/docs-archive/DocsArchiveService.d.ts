export interface DocFile {
    file_path: string;
    title: string;
    content: string;
    size: number;
    created_at: Date;
    updated_at: Date;
}
export interface DocListResult {
    total: number;
    files: string[];
}
export declare class DocsArchiveService {
    private static instance;
    private projectRoot;
    private archivedFolder;
    private allowedExtensions;
    private constructor();
    static getInstance(): DocsArchiveService;
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
     * Get document file content
     */
    getDocFile(filePath: string): Promise<DocFile>;
    /**
     * List all document files
     */
    listDocFiles(): Promise<DocListResult>;
    /**
     * Archive a document file
     */
    archiveDocFile(filePath: string): Promise<{
        success: boolean;
        originalPath: string;
        archivedPath: string;
    }>;
    /**
     * Delete a document file (permanent deletion)
     */
    deleteDocFile(filePath: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=DocsArchiveService.d.ts.map