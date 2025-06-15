"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContinuousDocsService = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class ContinuousDocsService {
    static instance;
    trackingFile;
    projectRoot;
    docsDir;
    continuouslyUpdatedDir;
    constructor() {
        // Initialize with default paths - can be overridden with configure()
        this.projectRoot = path.join(__dirname, '../../../..');
        this.docsDir = path.join(this.projectRoot, 'docs');
        this.continuouslyUpdatedDir = path.join(this.docsDir, 'continuously-updated');
        this.trackingFile = path.join(this.continuouslyUpdatedDir, '.tracking.json');
    }
    static getInstance() {
        if (!ContinuousDocsService.instance) {
            ContinuousDocsService.instance = new ContinuousDocsService();
        }
        return ContinuousDocsService.instance;
    }
    /**
     * Configure paths for the service
     */
    configure(options) {
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
    async loadTrackingData() {
        try {
            const data = await fs.readFile(this.trackingFile, 'utf-8');
            return JSON.parse(data);
        }
        catch (error) {
            console.log('No tracking file found, returning empty data');
            return { documents: [] };
        }
    }
    /**
     * Save tracking data to file
     */
    async saveTrackingData(data) {
        await fs.mkdir(this.continuouslyUpdatedDir, { recursive: true });
        await fs.writeFile(this.trackingFile, JSON.stringify(data, null, 2));
    }
    /**
     * Get all tracked documents
     */
    async getAllDocuments() {
        const data = await this.loadTrackingData();
        return data.documents;
    }
    /**
     * Find a document by path
     */
    async findDocument(docPath) {
        const data = await this.loadTrackingData();
        return data.documents.find(doc => doc.originalPath === docPath) || null;
    }
    /**
     * Update document frequency
     */
    async updateFrequency(docPath, frequency) {
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
    async triggerUpdate(docPath) {
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
    async addDocument(document) {
        const data = await this.loadTrackingData();
        // Check if already tracked
        const exists = data.documents.some(doc => doc.originalPath === document.originalPath);
        if (exists) {
            throw new Error('Document already tracked');
        }
        const newDoc = {
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
    async removeDocument(docPath) {
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
    async getDocumentsByCategory(category) {
        const data = await this.loadTrackingData();
        return data.documents.filter(doc => doc.category === category);
    }
    /**
     * Get documents that need updating based on their frequency
     */
    async getDocumentsNeedingUpdate() {
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
exports.ContinuousDocsService = ContinuousDocsService;
//# sourceMappingURL=ContinuousDocsService.js.map