import { Request, Response, NextFunction } from 'express';
import { BaseProxyServer } from '../../BaseProxyServer';
import { ScriptViewerService } from '../../../shared/services/script-viewer/ScriptViewerService';

export class ScriptViewerProxy extends BaseProxyServer {
  private scriptService: ScriptViewerService;

  constructor() {
    super('ScriptViewerProxy', 9884);
    this.scriptService = ScriptViewerService.getInstance();
  }

  protected setupRoutes(): void {
    // Get script file content
    this.app.get('/api/script-file', this.handleError(async (req: Request, res: Response) => {
      const filePath = req.query.path as string;
      
      if (!filePath) {
        res.status(400).json({ error: 'File path required' });
        return;
      }
      
      try {
        const scriptFile = await this.scriptService.getScriptFile(filePath);
        res.json(scriptFile);
      } catch (error: any) {
        if (error.message.includes('not found')) {
          res.status(404).json({ 
            error: error.message,
            file_path: filePath
          });
        } else if (error.message.includes('Only script files allowed')) {
          res.status(400).json({ 
            error: error.message,
            extensions: ['.sh', '.js', '.ts', '.py']
          });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    }));

    // List all script files
    this.app.get('/api/script-files', this.handleError(async (req: Request, res: Response) => {
      try {
        const result = await this.scriptService.listScriptFiles();
        res.json(result);
      } catch (error: any) {
        console.error('Error listing script files:', error);
        res.status(500).json({ 
          error: 'Error listing script files',
          details: error.message
        });
      }
    }));

    // Archive a script file
    this.app.post('/api/script-file/archive', this.handleError(async (req: Request, res: Response) => {
      const { path: filePath } = req.body;
      
      if (!filePath) {
        res.status(400).json({ error: 'File path required in request body' });
        return;
      }
      
      try {
        const result = await this.scriptService.archiveScriptFile(filePath);
        res.json(result);
      } catch (error: any) {
        if (error.message.includes('not found')) {
          res.status(404).json({ 
            error: error.message,
            file_path: filePath
          });
        } else if (error.message.includes('Only script files allowed')) {
          res.status(400).json({ 
            error: error.message,
            extensions: ['.sh', '.js', '.ts', '.py']
          });
        } else {
          res.status(500).json({ error: error.message });
        }
      }
    }));

    // Delete a script file (permanent)
    this.app.delete('/api/script-file', this.handleError(async (req: Request, res: Response) => {
      const { path: filePath } = req.body;
      
      if (!filePath) {
        res.status(400).json({ error: 'File path required in request body' });
        return;
      }
      
      try {
        const result = await this.scriptService.deleteScriptFile(filePath);
        res.json(result);
      } catch (error: any) {
        if (error.message.includes('not found')) {
          res.status(404).json({ 
            error: error.message,
            file_path: filePath
          });
        } else if (error.message.includes('Only script files allowed')) {
          res.status(400).json({ 
            error: error.message,
            extensions: ['.sh', '.js', '.ts', '.py']
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
        allowedExtensions: ['.sh', '.js', '.ts', '.py'],
        uptime: process.uptime()
      });
    });

    // Info endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        proxy: this.name,
        port: this.port,
        endpoints: [
          'GET /api/script-file?path=<path> - Get script file content',
          'GET /api/script-files - List all script files',
          'POST /api/script-file/archive - Archive a script file',
          'DELETE /api/script-file - Delete a script file permanently',
          'GET /health - Health check'
        ],
        features: [
          'View script files (.sh, .js, .ts, .py)',
          'List all scripts in the project',
          'Archive scripts to .archived_scripts folders',
          'Delete scripts permanently',
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
export default ScriptViewerProxy;