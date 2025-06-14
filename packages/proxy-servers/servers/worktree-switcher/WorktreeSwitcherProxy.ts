import { Request, Response, NextFunction } from 'express';
import { BaseProxyServer } from '../../BaseProxyServer';
import { WorktreeSwitcherService } from '../../../shared/services/worktree-switcher/WorktreeSwitcherService';

export class WorktreeSwitcherProxy extends BaseProxyServer {
  private worktreeService: WorktreeSwitcherService;

  constructor() {
    super('WorktreeSwitcherProxy', 9887);
    this.worktreeService = WorktreeSwitcherService.getInstance();
  }

  protected setupRoutes(): void {
    // Main UI route
    this.app.get('/', (req: Request, res: Response) => {
      const worktrees = this.worktreeService.getWorktrees();
      const html = this.worktreeService.generateHTML(worktrees);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    });

    // API to get worktrees as JSON
    this.app.get('/api/worktrees', (req: Request, res: Response) => {
      const worktrees = this.worktreeService.getWorktrees();
      res.json({ worktrees });
    });

    // Open worktree in Cursor
    this.app.post('/open', this.handleError(async (req: Request, res: Response) => {
      const { path } = req.body;
      
      if (!path) {
        res.status(400).json({ error: 'Path is required' });
        return;
      }
      
      try {
        const result = await this.worktreeService.openInCursor(path);
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    }));

    // Create new worktree
    this.app.post('/api/worktrees', this.handleError(async (req: Request, res: Response) => {
      const { branchName, baseBranch = 'main' } = req.body;
      
      if (!branchName) {
        res.status(400).json({ error: 'Branch name is required' });
        return;
      }
      
      try {
        const result = await this.worktreeService.createWorktree(branchName, baseBranch);
        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    }));

    // Remove worktree
    this.app.delete('/api/worktrees/:path', this.handleError(async (req: Request, res: Response) => {
      const worktreePath = decodeURIComponent(req.params.path);
      
      try {
        const result = await this.worktreeService.removeWorktree(worktreePath);
        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    }));

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      const worktrees = this.worktreeService.getWorktrees();
      res.json({ 
        status: 'healthy', 
        proxy: this.name,
        port: this.port,
        worktreeCount: worktrees.length,
        platform: process.platform,
        uptime: process.uptime()
      });
    });

    // API info endpoint
    this.app.get('/api/info', (req: Request, res: Response) => {
      res.json({
        proxy: this.name,
        port: this.port,
        endpoints: [
          'GET / - Worktree switcher UI',
          'GET /api/worktrees - Get all worktrees as JSON',
          'POST /open - Open worktree in Cursor',
          'POST /api/worktrees - Create new worktree',
          'DELETE /api/worktrees/:path - Remove worktree',
          'GET /health - Health check',
          'GET /api/info - API information'
        ],
        features: [
          'Visual worktree switcher UI',
          'Keyboard shortcuts (1-9) for quick switching',
          'Peacock color integration',
          'Shows Cursor process status',
          'Create and remove worktrees',
          'macOS Cursor app integration'
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
export default WorktreeSwitcherProxy;