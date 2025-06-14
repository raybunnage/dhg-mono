import { Request, Response, NextFunction } from 'express';
import { BaseProxyServer } from '../../BaseProxyServer';
import { MarkdownViewerService } from '../../../shared/services/markdown-viewer/MarkdownViewerService';

export class MarkdownViewerProxy extends BaseProxyServer {
  private markdownService: MarkdownViewerService;

  constructor() {
    super('MarkdownViewerProxy', 9885);
    this.markdownService = MarkdownViewerService.getInstance();
  }

  protected setupRoutes(): void {
    // Get markdown file content
    this.app.get('/api/markdown-file', this.handleError(async (req: Request, res: Response) => {
      const filePath = req.query.path as string;
      
      if (!filePath) {
        res.status(400).json({ error: 'File path required' });
        return;
      }
      
      try {
        const markdownFile = await this.markdownService.getMarkdownFile(filePath);
        res.json(markdownFile);
      } catch (error: any) {
        if (error.message.includes('not found')) {
          res.status(404).json({ 
            error: error.message,
            file_path: filePath
          });
        } else if (error.message.includes('Only markdown files allowed')) {
          res.status(400).json({ 
            error: error.message,
            extensions: ['.md', '.mdx']
          });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    }));

    // List all markdown files
    this.app.get('/api/markdown-files', this.handleError(async (req: Request, res: Response) => {
      try {
        const result = await this.markdownService.listMarkdownFiles();
        res.json(result);
      } catch (error: any) {
        console.error('Error listing markdown files:', error);
        res.status(500).json({ 
          error: 'Error listing markdown files',
          details: error.message
        });
      }
    }));

    // Archive a markdown file
    this.app.post('/api/markdown-file/archive', this.handleError(async (req: Request, res: Response) => {
      const { path: filePath } = req.body;
      
      if (!filePath) {
        res.status(400).json({ error: 'File path required in request body' });
        return;
      }
      
      try {
        const result = await this.markdownService.archiveMarkdownFile(filePath);
        res.json(result);
      } catch (error: any) {
        if (error.message.includes('not found')) {
          res.status(404).json({ 
            error: error.message,
            file_path: filePath
          });
        } else if (error.message.includes('Only markdown files allowed')) {
          res.status(400).json({ 
            error: error.message,
            extensions: ['.md', '.mdx']
          });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    }));

    // Delete a markdown file (permanent)
    this.app.delete('/api/markdown-file', this.handleError(async (req: Request, res: Response) => {
      const filePath = req.query.path as string;
      
      if (!filePath) {
        res.status(400).json({ error: 'File path required' });
        return;
      }
      
      try {
        const result = await this.markdownService.deleteMarkdownFile(filePath);
        res.json(result);
      } catch (error: any) {
        if (error.message.includes('not found')) {
          res.status(404).json({ 
            error: error.message,
            file_path: filePath
          });
        } else if (error.message.includes('Only markdown files allowed')) {
          res.status(400).json({ 
            error: error.message,
            extensions: ['.md', '.mdx']
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
        allowedExtensions: ['.md', '.mdx'],
        docsPath: 'docs/',
        uptime: process.uptime()
      });
    });

    // Info endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        proxy: this.name,
        port: this.port,
        endpoints: [
          'GET /api/markdown-file?path=<path> - Get markdown file content',
          'GET /api/markdown-files - List all markdown files',
          'POST /api/markdown-file/archive - Archive a markdown file',
          'DELETE /api/markdown-file?path=<path> - Delete a markdown file permanently',
          'GET /health - Health check'
        ],
        features: [
          'View markdown files (.md, .mdx)',
          'List all markdown files in docs/',
          'Archive markdown to .archive_docs folders',
          'Delete markdown files permanently',
          'Searches multiple doc subdirectories',
          'Excludes node_modules and .git directories'
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
export default MarkdownViewerProxy;