export interface ContinuousDocument {
    originalPath: string;
    fileName: string;
    category: string;
    addedDate: string;
    lastUpdated: string;
    updateFrequency: 'daily' | 'weekly' | 'monthly' | 'on-demand';
    description?: string;
}
export interface TrackingData {
    documents: ContinuousDocument[];
}
export declare class ContinuousDocsService {
    private static instance;
    private trackingFile;
    private projectRoot;
    private docsDir;
    private continuouslyUpdatedDir;
    private constructor();
    static getInstance(): ContinuousDocsService;
    /**
     * Configure paths for the service
     */
    configure(options: {
        projectRoot?: string;
        docsDir?: string;
        trackingFile?: string;
    }): void;
    /**
     * Load tracking data from file
     */
    loadTrackingData(): Promise<TrackingData>;
    /**
     * Save tracking data to file
     */
    saveTrackingData(data: TrackingData): Promise<void>;
    /**
     * Get all tracked documents
     */
    getAllDocuments(): Promise<ContinuousDocument[]>;
    /**
     * Find a document by path
     */
    findDocument(docPath: string): Promise<ContinuousDocument | null>;
    /**
     * Update document frequency
     */
    updateFrequency(docPath: string, frequency: ContinuousDocument['updateFrequency']): Promise<ContinuousDocument>;
    /**
     * Manually trigger document update
     */
    triggerUpdate(docPath: string): Promise<ContinuousDocument>;
    /**
     * Add new document to tracking
     */
    addDocument(document: {
        originalPath: string;
        category?: string;
        frequency?: ContinuousDocument['updateFrequency'];
        description?: string;
    }): Promise<ContinuousDocument>;
    /**
     * Remove document from tracking
     */
    removeDocument(docPath: string): Promise<void>;
    /**
     * Get documents by category
     */
    getDocumentsByCategory(category: string): Promise<ContinuousDocument[]>;
    /**
     * Get documents that need updating based on their frequency
     */
    getDocumentsNeedingUpdate(): Promise<ContinuousDocument[]>;
}
//# sourceMappingURL=ContinuousDocsService.d.ts.map