import { Request, Response, NextFunction } from 'express';
import { BaseProxyServer } from '../../BaseProxyServer';
import { ContinuousDocsService } from '../../../shared/services/continuous-docs/ContinuousDocsService';
import * as path from 'path';

export class ContinuousDocsProxy extends BaseProxyServer {
  private continuousDocsService: ContinuousDocsService;

  constructor() {
    super('ContinuousDocsProxy', 9882);
    this.continuousDocsService = ContinuousDocsService.getInstance();
  }

  protected setupMiddleware(): void {
    super.setupMiddleware();
    
    // Configure the service with the correct project root
    const projectRoot = path.join(__dirname, '../../../..');
    this.continuousDocsService.configure({ projectRoot });
  }

  protected setupRoutes(): void {
    // Get all tracked documents
    this.app.get('/api/continuous-docs', this.handleError(async (req: Request, res: Response) => {
      const documents = await this.continuousDocsService.getAllDocuments();
      res.json({ documents });
    }));

    // Update document frequency
    this.app.patch('/api/continuous-docs/:path/frequency', this.handleError(async (req: Request, res: Response) => {
      const { path: docPath } = req.params;
      const { frequency } = req.body;
      
      if (!frequency || !['daily', 'weekly', 'monthly', 'on-demand'].includes(frequency)) {
        return res.status(400).json({ 
          error: 'Invalid frequency. Must be daily, weekly, monthly, or on-demand' 
        });
      }
      
      const document = await this.continuousDocsService.updateFrequency(
        decodeURIComponent(docPath), 
        frequency
      );
      res.json({ success: true, document });
    }));

    // Manually trigger update
    this.app.post('/api/continuous-docs/:path/update', this.handleError(async (req: Request, res: Response) => {
      const { path: docPath } = req.params;
      const document = await this.continuousDocsService.triggerUpdate(decodeURIComponent(docPath));
      res.json({ success: true, document });
    }));

    // Add new document to tracking
    this.app.post('/api/continuous-docs', this.handleError(async (req: Request, res: Response) => {
      const { originalPath, category, frequency, description } = req.body;
      
      if (!originalPath) {
        return res.status(400).json({ error: 'originalPath is required' });
      }
      
      const document = await this.continuousDocsService.addDocument({
        originalPath,
        category,
        frequency,
        description
      });
      res.json({ success: true, document });
    }));

    // Remove document from tracking
    this.app.delete('/api/continuous-docs/:path', this.handleError(async (req: Request, res: Response) => {
      const { path: docPath } = req.params;
      await this.continuousDocsService.removeDocument(decodeURIComponent(docPath));
      res.json({ success: true });
    }));

    // Get documents by category
    this.app.get('/api/continuous-docs/category/:category', this.handleError(async (req: Request, res: Response) => {
      const { category } = req.params;
      const documents = await this.continuousDocsService.getDocumentsByCategory(category);
      res.json({ documents });
    }));

    // Get documents needing update
    this.app.get('/api/continuous-docs/needs-update', this.handleError(async (req: Request, res: Response) => {
      const documents = await this.continuousDocsService.getDocumentsNeedingUpdate();
      res.json({ documents });
    }));

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'healthy', 
        proxy: this.name,
        port: this.port,
        uptime: process.uptime()
      });
    });

    // Info endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        proxy: this.name,
        port: this.port,
        endpoints: [
          'GET /api/continuous-docs - Get all tracked documents',
          'GET /api/continuous-docs/category/:category - Get documents by category',
          'GET /api/continuous-docs/needs-update - Get documents needing update',
          'PATCH /api/continuous-docs/:path/frequency - Update document frequency',
          'POST /api/continuous-docs/:path/update - Manually trigger update',
          'POST /api/continuous-docs - Add new document to tracking',
          'DELETE /api/continuous-docs/:path - Remove document from tracking',
          'GET /health - Health check'
        ]
      });
    });
  }

  /**
   * Helper to wrap async route handlers
   */
  private handleError(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

// Export for use
export default ContinuousDocsProxy;