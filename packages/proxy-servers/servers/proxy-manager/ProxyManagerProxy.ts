import { Request, Response } from 'express';
import { ProxyServerBase } from '../../base/ProxyServerBase';
import { ProxyManager } from '../../base/ProxyManager';
import { ProxyServerConfig } from '../../types';

export class ProxyManagerProxy extends ProxyServerBase {
  private manager: ProxyManager;

  constructor(config?: Partial<ProxyServerConfig>) {
    super({
      name: 'proxy-manager-proxy',
      port: 9878,
      ...config
    });
    
    this.manager = new ProxyManager();
  }

  protected getServiceDescription(): string {
    return 'Proxy server management and control';
  }

  protected setupRoutes(): void {
    // Status endpoints
    this.app.get('/proxies', this.handleListProxies.bind(this));
    this.app.get('/proxies/:name', this.handleGetProxy.bind(this));
    
    // Control endpoints
    this.app.post('/proxies/:name/start', this.handleStartProxy.bind(this));
    this.app.post('/proxies/:name/stop', this.handleStopProxy.bind(this));
    this.app.post('/proxies/:name/restart', this.handleRestartProxy.bind(this));
    
    // Batch operations
    this.app.post('/proxies/start-all', this.handleStartAll.bind(this));
    this.app.post('/proxies/stop-all', this.handleStopAll.bind(this));
    this.app.post('/proxies/category/:category/start', this.handleStartCategory.bind(this));
    this.app.post('/proxies/category/:category/stop', this.handleStopCategory.bind(this));
    
    // Dashboard endpoint
    this.app.get('/dashboard', this.handleDashboard.bind(this));
  }

  private async handleListProxies(req: Request, res: Response): Promise<void> {
    const status = this.manager.getStatus();
    res.json(status);
  }

  private async handleGetProxy(req: Request, res: Response): Promise<void> {
    const { name } = req.params;
    const allInfo = this.manager.getAllInfo();
    
    if (allInfo[name]) {
      res.json(allInfo[name]);
    } else {
      res.status(404).json({
        error: `Proxy server '${name}' not found`
      });
    }
  }

  private async handleStartProxy(req: Request, res: Response): Promise<void> {
    const { name } = req.params;
    const result = await this.manager.startProxy(name);
    
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  }

  private async handleStopProxy(req: Request, res: Response): Promise<void> {
    const { name } = req.params;
    const result = await this.manager.stopProxy(name);
    
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  }

  private async handleRestartProxy(req: Request, res: Response): Promise<void> {
    const { name } = req.params;
    const result = await this.manager.restartProxy(name);
    
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  }

  private async handleStartAll(req: Request, res: Response): Promise<void> {
    const result = await this.manager.startAll();
    
    const status = result.success ? 200 : 207; // 207 for partial success
    res.status(status).json(result);
  }

  private async handleStopAll(req: Request, res: Response): Promise<void> {
    const result = await this.manager.stopAll();
    
    const status = result.success ? 200 : 207;
    res.status(status).json(result);
  }

  private async handleStartCategory(req: Request, res: Response): Promise<void> {
    const { category } = req.params;
    const validCategories = ['development', 'media', 'testing', 'infrastructure'];
    
    if (!validCategories.includes(category)) {
      res.status(400).json({
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
      return;
    }
    
    const result = await this.manager.startCategory(category as any);
    const status = result.success ? 200 : 207;
    res.status(status).json(result);
  }

  private async handleStopCategory(req: Request, res: Response): Promise<void> {
    const { category } = req.params;
    const validCategories = ['development', 'media', 'testing', 'infrastructure'];
    
    if (!validCategories.includes(category)) {
      res.status(400).json({
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
      return;
    }
    
    const result = await this.manager.stopCategory(category as any);
    const status = result.success ? 200 : 207;
    res.status(status).json(result);
  }

  private async handleDashboard(req: Request, res: Response): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Proxy Server Manager</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 20px; }
        .category { margin-bottom: 30px; }
        .category h2 { color: #666; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .proxy-list { display: grid; gap: 10px; margin-top: 15px; }
        .proxy-item { display: flex; align-items: center; justify-content: space-between; padding: 15px; background: #f9f9f9; border-radius: 6px; border: 1px solid #e0e0e0; }
        .proxy-info { display: flex; align-items: center; gap: 15px; }
        .status-indicator { width: 12px; height: 12px; border-radius: 50%; }
        .status-running { background: #4caf50; }
        .status-stopped { background: #f44336; }
        .proxy-name { font-weight: bold; color: #333; }
        .proxy-port { color: #666; font-size: 14px; }
        .proxy-actions { display: flex; gap: 8px; }
        button { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
        button:hover { opacity: 0.8; }
        .btn-start { background: #4caf50; color: white; }
        .btn-stop { background: #f44336; color: white; }
        .btn-restart { background: #ff9800; color: white; }
        .batch-actions { margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-radius: 6px; }
        .loading { opacity: 0.5; pointer-events: none; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Proxy Server Manager</h1>
        
        <div class="batch-actions">
            <button class="btn-start" onclick="startAll()">Start All</button>
            <button class="btn-stop" onclick="stopAll()">Stop All</button>
            <button onclick="refreshStatus()">🔄 Refresh</button>
        </div>
        
        <div id="proxy-status">Loading...</div>
    </div>

    <script>
        const API_BASE = '';

        async function fetchStatus() {
            try {
                const response = await fetch(API_BASE + '/proxies');
                return await response.json();
            } catch (error) {
                console.error('Failed to fetch status:', error);
                return null;
            }
        }

        async function controlProxy(name, action) {
            try {
                const response = await fetch(API_BASE + '/proxies/' + name + '/' + action, {
                    method: 'POST'
                });
                const result = await response.json();
                if (result.success) {
                    refreshStatus();
                } else {
                    alert('Failed: ' + result.message);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }

        async function startAll() {
            if (confirm('Start all proxy servers?')) {
                try {
                    const response = await fetch(API_BASE + '/proxies/start-all', { method: 'POST' });
                    const result = await response.json();
                    alert(result.message);
                    refreshStatus();
                } catch (error) {
                    alert('Error: ' + error.message);
                }
            }
        }

        async function stopAll() {
            if (confirm('Stop all proxy servers?')) {
                try {
                    const response = await fetch(API_BASE + '/proxies/stop-all', { method: 'POST' });
                    const result = await response.json();
                    alert(result.message);
                    refreshStatus();
                } catch (error) {
                    alert('Error: ' + error.message);
                }
            }
        }

        function renderStatus(status) {
            let html = '';
            
            for (const [category, proxies] of Object.entries(status)) {
                html += '<div class="category">';
                html += '<h2>' + category.charAt(0).toUpperCase() + category.slice(1) + ' Proxies</h2>';
                html += '<div class="proxy-list">';
                
                if (proxies.length === 0) {
                    html += '<p style="color: #999;">No proxies in this category</p>';
                } else {
                    for (const proxy of proxies) {
                        const isRunning = proxy.status === 'running';
                        html += '<div class="proxy-item">';
                        html += '<div class="proxy-info">';
                        html += '<div class="status-indicator status-' + proxy.status + '"></div>';
                        html += '<div>';
                        html += '<div class="proxy-name">' + proxy.name + '</div>';
                        html += '<div class="proxy-port">Port: ' + proxy.port + '</div>';
                        html += '</div>';
                        html += '</div>';
                        html += '<div class="proxy-actions">';
                        
                        if (isRunning) {
                            html += '<button class="btn-stop" onclick="controlProxy(\\'' + proxy.name + '\\', \\'stop\\')">Stop</button>';
                            html += '<button class="btn-restart" onclick="controlProxy(\\'' + proxy.name + '\\', \\'restart\\')">Restart</button>';
                        } else {
                            html += '<button class="btn-start" onclick="controlProxy(\\'' + proxy.name + '\\', \\'start\\')">Start</button>';
                        }
                        
                        html += '</div>';
                        html += '</div>';
                    }
                }
                
                html += '</div>';
                html += '</div>';
            }
            
            document.getElementById('proxy-status').innerHTML = html;
        }

        async function refreshStatus() {
            document.getElementById('proxy-status').classList.add('loading');
            const status = await fetchStatus();
            if (status) {
                renderStatus(status);
            } else {
                document.getElementById('proxy-status').innerHTML = '<p style="color: red;">Failed to load proxy status</p>';
            }
            document.getElementById('proxy-status').classList.remove('loading');
        }

        // Initial load
        refreshStatus();
        
        // Auto-refresh every 5 seconds
        setInterval(refreshStatus, 5000);
    </script>
</body>
</html>
    `;
    
    res.type('html').send(html);
  }
}