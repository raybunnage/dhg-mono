import { Request, Response, NextFunction } from 'express';
import { BaseProxyServer } from '../../BaseProxyServer';
import { DocsArchiveService } from '../../../shared/services/docs-archive/DocsArchiveService';

export class DocsArchiveProxy extends BaseProxyServer {
  private docsService: DocsArchiveService;

  constructor() {
    super('DocsArchiveProxy', 9886);
    this.docsService = DocsArchiveService.getInstance();
  }

  protected setupRoutes(): void {
    // Get document file content
    this.app.get('/api/doc-file', this.handleError(async (req: Request, res: Response) => {
      const filePath = req.query.path as string;
      
      if (!filePath) {
        res.status(400).json({ error: 'File path required' });
        return;
      }
      
      try {
        const docFile = await this.docsService.getDocFile(filePath);
        res.json(docFile);
      } catch (error: any) {
        if (error.message.includes('not found')) {
          res.status(404).json({ 
            error: error.message,
            file_path: filePath
          });
        } else if (error.message.includes('Only document files allowed')) {
          res.status(400).json({ 
            error: error.message,
            extensions: ['.md', '.txt', '.markdown']
          });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    }));

    // List all document files
    this.app.get('/api/doc-files', this.handleError(async (req: Request, res: Response) => {
      try {
        const result = await this.docsService.listDocFiles();
        res.json(result);
      } catch (error: any) {
        console.error('Error listing document files:', error);
        res.status(500).json({ 
          error: 'Error listing document files',
          details: error.message
        });
      }
    }));

    // Archive a document file
    this.app.post('/api/doc-file/archive', this.handleError(async (req: Request, res: Response) => {
      const { path: filePath } = req.body;
      
      if (!filePath) {
        res.status(400).json({ error: 'File path required in request body' });
        return;
      }
      
      try {
        const result = await this.docsService.archiveDocFile(filePath);
        res.json(result);
      } catch (error: any) {
        if (error.message.includes('not found')) {
          res.status(404).json({ 
            error: error.message,
            file_path: filePath
          });
        } else if (error.message.includes('Only document files allowed')) {
          res.status(400).json({ 
            error: error.message,
            extensions: ['.md', '.txt', '.markdown']
          });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    }));

    // Delete a document file (permanent)
    this.app.delete('/api/doc-file', this.handleError(async (req: Request, res: Response) => {
      const { path: filePath } = req.body;
      
      if (!filePath) {
        res.status(400).json({ error: 'File path required in request body' });
        return;
      }
      
      try {
        const result = await this.docsService.deleteDocFile(filePath);
        res.json(result);
      } catch (error: any) {
        if (error.message.includes('not found')) {
          res.status(404).json({ 
            error: error.message,
            file_path: filePath
          });
        } else if (error.message.includes('Only document files allowed')) {
          res.status(400).json({ 
            error: error.message,
            extensions: ['.md', '.txt', '.markdown']
          });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    }));

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'healthy', 
        proxy: this.name,
        port: this.port,
        allowedExtensions: ['.md', '.txt', '.markdown'],
        searchScope: 'entire project',
        uptime: process.uptime()
      });
    });

    // Info endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        proxy: this.name,
        port: this.port,
        endpoints: [
          'GET /api/doc-file?path=<path> - Get document file content',
          'GET /api/doc-files - List all document files',
          'POST /api/doc-file/archive - Archive a document file',
          'DELETE /api/doc-file - Delete a document file permanently',
          'GET /health - Health check'
        ],
        features: [
          'View document files (.md, .txt, .markdown)',
          'List all documents in the project',
          'Archive documents to .archive_docs folders',
          'Delete documents permanently',
          'Searches entire project tree',
          'Excludes node_modules, .git, dist, and build directories'
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
export default DocsArchiveProxy;