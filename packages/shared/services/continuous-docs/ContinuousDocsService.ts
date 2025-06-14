import * as fs from 'fs/promises';
import * as path from 'path';

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

export class ContinuousDocsService {
  private static instance: ContinuousDocsService;
  private trackingFile: string;
  private projectRoot: string;
  private docsDir: string;
  private continuouslyUpdatedDir: string;

  private constructor() {
    // Initialize with default paths - can be overridden with configure()
    this.projectRoot = path.join(__dirname, '../../../..');
    this.docsDir = path.join(this.projectRoot, 'docs');
    this.continuouslyUpdatedDir = path.join(this.docsDir, 'continuously-updated');
    this.trackingFile = path.join(this.continuouslyUpdatedDir, '.tracking.json');
  }

  static getInstance(): ContinuousDocsService {
    if (!ContinuousDocsService.instance) {
      ContinuousDocsService.instance = new ContinuousDocsService();
    }
    return ContinuousDocsService.instance;
  }

  /**
   * Configure paths for the service
   */
  configure(options: { projectRoot?: string; docsDir?: string; trackingFile?: string }) {
    if (options.projectRoot) {
      this.projectRoot = options.projectRoot;
      this.docsDir = path.join(this.projectRoot, 'docs');
      this.continuouslyUpdatedDir = path.join(this.docsDir, 'continuously-updated');
      this.trackingFile = path.join(this.continuouslyUpdatedDir, '.tracking.json');
    }
    if (options.docsDir) {
      this.docsDir = options.docsDir;
      this.continuouslyUpdatedDir = path.join(this.docsDir, 'continuously-updated');
      this.trackingFile = path.join(this.continuouslyUpdatedDir, '.tracking.json');
    }
    if (options.trackingFile) {
      this.trackingFile = options.trackingFile;
    }
  }

  /**
   * Load tracking data from file
   */
  async loadTrackingData(): Promise<TrackingData> {
    try {
      const data = await fs.readFile(this.trackingFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.log('No tracking file found, returning empty data');
      return { documents: [] };
    }
  }

  /**
   * Save tracking data to file
   */
  async saveTrackingData(data: TrackingData): Promise<void> {
    await fs.mkdir(this.continuouslyUpdatedDir, { recursive: true });
    await fs.writeFile(this.trackingFile, JSON.stringify(data, null, 2));
  }

  /**
   * Get all tracked documents
   */
  async getAllDocuments(): Promise<ContinuousDocument[]> {
    const data = await this.loadTrackingData();
    return data.documents;
  }

  /**
   * Find a document by path
   */
  async findDocument(docPath: string): Promise<ContinuousDocument | null> {
    const data = await this.loadTrackingData();
    return data.documents.find(doc => doc.originalPath === docPath) || null;
  }

  /**
   * Update document frequency
   */
  async updateFrequency(docPath: string, frequency: ContinuousDocument['updateFrequency']): Promise<ContinuousDocument> {
    const data = await this.loadTrackingData();
    const docIndex = data.documents.findIndex(doc => doc.originalPath === docPath);
    
    if (docIndex === -1) {
      throw new Error('Document not found');
    }
    
    data.documents[docIndex].updateFrequency = frequency;
    await this.saveTrackingData(data);
    
    return data.documents[docIndex];
  }

  /**
   * Manually trigger document update
   */
  async triggerUpdate(docPath: string): Promise<ContinuousDocument> {
    const data = await this.loadTrackingData();
    const docIndex = data.documents.findIndex(doc => doc.originalPath === docPath);
    
    if (docIndex === -1) {
      throw new Error('Document not found');
    }
    
    // Update the lastUpdated timestamp
    data.documents[docIndex].lastUpdated = new Date().toISOString();
    await this.saveTrackingData(data);
    
    // In a real implementation, this would also trigger the actual document update
    // For now, we just update the timestamp
    
    return data.documents[docIndex];
  }

  /**
   * Add new document to tracking
   */
  async addDocument(document: {
    originalPath: string;
    category?: string;
    frequency?: ContinuousDocument['updateFrequency'];
    description?: string;
  }): Promise<ContinuousDocument> {
    const data = await this.loadTrackingData();
    
    // Check if already tracked
    const exists = data.documents.some(doc => doc.originalPath === document.originalPath);
    if (exists) {
      throw new Error('Document already tracked');
    }
    
    const newDoc: ContinuousDocument = {
      originalPath: document.originalPath,
      fileName: path.basename(document.originalPath),
      category: document.category || 'general',
      addedDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      updateFrequency: document.frequency || 'weekly',
      description: document.description
    };
    
    data.documents.push(newDoc);
    await this.saveTrackingData(data);
    
    return newDoc;
  }

  /**
   * Remove document from tracking
   */
  async removeDocument(docPath: string): Promise<void> {
    const data = await this.loadTrackingData();
    const docIndex = data.documents.findIndex(doc => doc.originalPath === docPath);
    
    if (docIndex === -1) {
      throw new Error('Document not found');
    }
    
    data.documents.splice(docIndex, 1);
    await this.saveTrackingData(data);
  }

  /**
   * Get documents by category
   */
  async getDocumentsByCategory(category: string): Promise<ContinuousDocument[]> {
    const data = await this.loadTrackingData();
    return data.documents.filter(doc => doc.category === category);
  }

  /**
   * Get documents that need updating based on their frequency
   */
  async getDocumentsNeedingUpdate(): Promise<ContinuousDocument[]> {
    const data = await this.loadTrackingData();
    const now = new Date();
    
    return data.documents.filter(doc => {
      const lastUpdated = new Date(doc.lastUpdated);
      const daysSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      
      switch (doc.updateFrequency) {
        case 'daily':
          return daysSinceUpdate >= 1;
        case 'weekly':
          return daysSinceUpdate >= 7;
        case 'monthly':
          return daysSinceUpdate >= 30;
        case 'on-demand':
          return false;
        default:
          return false;
      }
    });
  }
}