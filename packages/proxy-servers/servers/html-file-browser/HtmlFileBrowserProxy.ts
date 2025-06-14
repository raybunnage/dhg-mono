import { Request, Response, NextFunction } from 'express';
import * as path from 'path';
import { BaseProxyServer } from '../../BaseProxyServer';
import { HtmlFileBrowserService } from '../../../shared/services/html-file-browser/HtmlFileBrowserService';

export class HtmlFileBrowserProxy extends BaseProxyServer {
  private fileBrowserService: HtmlFileBrowserService;
  private htmlPath: string;

  constructor() {
    super('HtmlFileBrowserProxy', 8080);
    this.fileBrowserService = HtmlFileBrowserService.getInstance();
    
    // Configure to use project root as base path
    const projectRoot = path.resolve(__dirname, '../../../..');
    this.fileBrowserService.configure({ basePath: projectRoot });
    
    // Path to the HTML file
    this.htmlPath = path.join(projectRoot, 'html', 'file-browser.html');
  }

  protected setupMiddleware(): void {
    super.setupMiddleware();
    
    // Serve static files from the html directory
    const htmlDir = path.dirname(this.htmlPath);
    this.app.use(this.express.static(htmlDir));
  }

  protected setupRoutes(): void {
    // API endpoint to list directory contents
    this.app.post('/api/list-directory', this.handleError(async (req: Request, res: Response) => {
      const { dirPath = '' } = req.body;
      
      try {
        const items = await this.fileBrowserService.listDirectory(dirPath);
        res.json(items);
      } catch (error: any) {
        if (error.message.includes('Access denied')) {
          res.status(403).json({ error: error.message });
        } else if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    }));

    // API endpoint to get file content
    this.app.post('/api/read-file', this.handleError(async (req: Request, res: Response) => {
      const { filePath } = req.body;
      
      if (!filePath) {
        res.status(400).json({ error: 'filePath is required' });
        return;
      }
      
      try {
        const content = await this.fileBrowserService.readFile(filePath);
        res.json({ content });
      } catch (error: any) {
        if (error.message.includes('Access denied')) {
          res.status(403).json({ error: error.message });
        } else if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
        } else if (error.message.includes('Cannot read directory')) {
          res.status(400).json({ error: error.message });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    }));

    // API endpoint to search files
    this.app.post('/api/search-files', this.handleError(async (req: Request, res: Response) => {
      const { searchTerm, searchPath = '' } = req.body;
      
      if (!searchTerm) {
        res.status(400).json({ error: 'searchTerm is required' });
        return;
      }
      
      try {
        const results = await this.fileBrowserService.searchFiles(searchTerm, {
          searchPath,
          maxResults: 100
        });
        res.json(results);
      } catch (error: any) {
        if (error.message.includes('Access denied')) {
          res.status(403).json({ error: error.message });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    }));

    // API endpoint to get file stats
    this.app.post('/api/file-stats', this.handleError(async (req: Request, res: Response) => {
      const { filePath } = req.body;
      
      if (!filePath) {
        res.status(400).json({ error: 'filePath is required' });
        return;
      }
      
      try {
        const stats = await this.fileBrowserService.getStats(filePath);
        res.json(stats);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }));

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'healthy', 
        proxy: this.name,
        port: this.port,
        basePath: this.fileBrowserService.getBasePath(),
        uptime: process.uptime()
      });
    });

    // Info endpoint
    this.app.get('/api/info', (req: Request, res: Response) => {
      res.json({
        proxy: this.name,
        port: this.port,
        basePath: this.fileBrowserService.getBasePath(),
        endpoints: [
          'POST /api/list-directory - List directory contents',
          'POST /api/read-file - Read file content',
          'POST /api/search-files - Search for files',
          'POST /api/file-stats - Get file statistics',
          'GET /health - Health check',
          'GET /file-browser.html - Web UI'
        ],
        features: [
          'Web-based file browser UI',
          'Directory listing with sorting',
          'File content viewing',
          'File search functionality',
          'Security: Path validation',
          'Excludes node_modules and .git by default'
        ]
      });
    });

    // Redirect root to file browser
    this.app.get('/', (req: Request, res: Response) => {
      res.redirect('/file-browser.html');
    });
  }

  /**
   * Override start to show additional info
   */
  async start(): Promise<void> {
    await super.start();
    console.log(`Open http://localhost:${this.port}/file-browser.html in your browser`);
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
export default HtmlFileBrowserProxy;