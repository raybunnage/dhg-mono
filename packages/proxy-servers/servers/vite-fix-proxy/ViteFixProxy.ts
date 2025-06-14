import { Request, Response } from 'express';
import { ProxyServerBase } from '../../base/ProxyServerBase';
import { ProxyServerConfig } from '../../types';
import { ViteFixService } from './ViteFixService';

export class ViteFixProxy extends ProxyServerBase {
  private viteFixService: ViteFixService;

  constructor(config?: Partial<ProxyServerConfig>) {
    super({
      name: 'vite-fix-proxy',
      port: 9876,
      ...config
    });
    
    this.viteFixService = new ViteFixService();
  }

  protected getServiceDescription(): string {
    return 'Vite environment fix commands proxy';
  }

  protected setupRoutes(): void {
    // Fix endpoint
    this.app.post('/fix', this.handleFix.bind(this));
    
    // List available apps
    this.app.get('/apps', this.handleListApps.bind(this));
    
    // Check specific app
    this.app.get('/apps/:appName', this.handleCheckApp.bind(this));
  }

  private async handleFix(req: Request, res: Response): Promise<void> {
    const { appName, action } = req.body;
    
    if (!appName || !action) {
      res.status(400).json({
        success: false,
        error: 'Missing appName or action'
      });
      return;
    }

    try {
      let result;
      
      switch (action) {
        case 'diagnose':
          result = await this.viteFixService.diagnoseApp(appName);
          break;
          
        case 'fix':
          result = await this.viteFixService.fixApp(appName, false);
          break;
          
        case 'nuclear-fix':
          result = await this.viteFixService.fixApp(appName, true);
          break;
          
        case 'check-env':
          result = await this.viteFixService.checkEnvFiles(appName);
          break;
          
        default:
          result = {
            success: false,
            message: 'Unknown action',
            error: `Action '${action}' not supported`
          };
      }

      const status = result.success ? 200 : 400;
      res.status(status).json(result);
      
    } catch (error) {
      console.error('[ViteFixProxy] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleListApps(req: Request, res: Response): Promise<void> {
    try {
      const apps = await this.viteFixService.listApps();
      res.json({ apps });
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to list apps',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleCheckApp(req: Request, res: Response): Promise<void> {
    const { appName } = req.params;
    
    try {
      const result = await this.viteFixService.checkEnvFiles(appName);
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to check app',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}