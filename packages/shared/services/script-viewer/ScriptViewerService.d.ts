export interface ScriptFile {
    file_path: string;
    title: string;
    content: string;
    size: number;
    created_at: Date;
    updated_at: Date;
}
export interface ScriptListResult {
    total: number;
    files: string[];
}
export declare class ScriptViewerService {
    private static instance;
    private projectRoot;
    private archivedFolder;
    private allowedExtensions;
    private constructor();
    static getInstance(): ScriptViewerService;
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
     * Get script file content
     */
    getScriptFile(filePath: string): Promise<ScriptFile>;
    /**
     * List all script files
     */
    listScriptFiles(): Promise<ScriptListResult>;
    /**
     * Archive a script file
     */
    archiveScriptFile(filePath: string): Promise<{
        success: boolean;
        originalPath: string;
        archivedPath: string;
    }>;
    /**
     * Delete a script file (permanent deletion)
     */
    deleteScriptFile(filePath: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=ScriptViewerService.d.ts.map