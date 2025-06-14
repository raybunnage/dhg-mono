import { Request, Response } from 'express';
import { ProxyServerBase } from '../../base/ProxyServerBase';
import { ProxyServerConfig, HealthCheckResult } from '../../types';
import { SystemMonitor } from './SystemMonitor';

export class ContinuousMonitoringProxy extends ProxyServerBase {
  private monitor: SystemMonitor;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ProxyServerConfig>) {
    super({
      name: 'continuous-monitoring-proxy',
      port: 9877,
      ...config
    });
    
    this.monitor = new SystemMonitor();
  }

  protected getServiceDescription(): string {
    return 'System health and performance monitoring';
  }

  protected async onStart(): Promise<void> {
    // Start continuous monitoring
    this.startMonitoring();
  }

  protected async onStop(): Promise<void> {
    // Stop continuous monitoring
    this.stopMonitoring();
  }

  protected async performHealthCheck(): Promise<HealthCheckResult> {
    const metrics = await this.monitor.getCurrentMetrics();
    const healthy = metrics.overall.healthy;
    
    return {
      healthy,
      details: {
        metrics: metrics.overall,
        lastCheck: new Date().toISOString()
      }
    };
  }

  protected setupRoutes(): void {
    // Current metrics
    this.app.get('/metrics', this.handleGetMetrics.bind(this));
    
    // Historical metrics
    this.app.get('/metrics/history', this.handleGetHistory.bind(this));
    
    // Service-specific metrics
    this.app.get('/metrics/services', this.handleGetServiceMetrics.bind(this));
    this.app.get('/metrics/services/:serviceName', this.handleGetServiceDetail.bind(this));
    
    // Database metrics
    this.app.get('/metrics/database', this.handleGetDatabaseMetrics.bind(this));
    
    // Alerts
    this.app.get('/alerts', this.handleGetAlerts.bind(this));
    this.app.post('/alerts/acknowledge/:alertId', this.handleAcknowledgeAlert.bind(this));
    
    // Dashboard
    this.app.get('/dashboard', this.handleDashboard.bind(this));
  }

  private startMonitoring(): void {
    console.log('[ContinuousMonitoring] Starting monitoring cycle...');
    
    // Run checks every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitor.runHealthChecks();
      } catch (error) {
        console.error('[ContinuousMonitoring] Error during health check:', error);
      }
    }, 30000);

    // Run initial check
    this.monitor.runHealthChecks().catch(console.error);
  }

  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[ContinuousMonitoring] Monitoring stopped');
    }
  }

  private async handleGetMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.monitor.getCurrentMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleGetHistory(req: Request, res: Response): Promise<void> {
    try {
      const { hours = 24 } = req.query;
      const history = await this.monitor.getMetricsHistory(Number(hours));
      res.json(history);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleGetServiceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.monitor.getServiceMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get service metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleGetServiceDetail(req: Request, res: Response): Promise<void> {
    const { serviceName } = req.params;
    
    try {
      const detail = await this.monitor.getServiceDetail(serviceName);
      if (detail) {
        res.json(detail);
      } else {
        res.status(404).json({
          error: `Service '${serviceName}' not found`
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get service detail',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleGetDatabaseMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.monitor.getDatabaseMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get database metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleGetAlerts(req: Request, res: Response): Promise<void> {
    try {
      const alerts = await this.monitor.getActiveAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get alerts',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleAcknowledgeAlert(req: Request, res: Response): Promise<void> {
    const { alertId } = req.params;
    
    try {
      await this.monitor.acknowledgeAlert(alertId);
      res.json({ success: true, message: 'Alert acknowledged' });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to acknowledge alert',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleDashboard(req: Request, res: Response): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>System Monitoring Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        h1 { color: #333; margin: 0; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .card h2 { color: #666; margin: 0 0 15px 0; font-size: 18px; }
        .metric { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 10px; background: #f9f9f9; border-radius: 4px; }
        .metric-label { color: #666; }
        .metric-value { font-weight: bold; }
        .status-healthy { color: #4caf50; }
        .status-warning { color: #ff9800; }
        .status-error { color: #f44336; }
        .alert { padding: 12px; margin-bottom: 10px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }
        .alert-error { background: #ffebee; color: #c62828; }
        .alert-warning { background: #fff8e1; color: #f57c00; }
        .alert button { background: none; border: 1px solid currentColor; color: inherit; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .chart { height: 200px; background: #fafafa; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #999; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 System Monitoring Dashboard</h1>
        </div>
        
        <div class="grid">
            <div class="card">
                <h2>System Health</h2>
                <div id="system-health">Loading...</div>
            </div>
            
            <div class="card">
                <h2>Service Status</h2>
                <div id="service-status">Loading...</div>
            </div>
            
            <div class="card">
                <h2>Database Metrics</h2>
                <div id="database-metrics">Loading...</div>
            </div>
            
            <div class="card">
                <h2>Active Alerts</h2>
                <div id="alerts">Loading...</div>
            </div>
        </div>
        
        <div class="card" style="margin-top: 20px;">
            <h2>Performance History (24h)</h2>
            <div class="chart">Chart visualization would go here</div>
        </div>
    </div>

    <script>
        const API_BASE = '';

        async function fetchMetrics() {
            try {
                const response = await fetch(API_BASE + '/metrics');
                return await response.json();
            } catch (error) {
                console.error('Failed to fetch metrics:', error);
                return null;
            }
        }

        async function fetchAlerts() {
            try {
                const response = await fetch(API_BASE + '/alerts');
                return await response.json();
            } catch (error) {
                console.error('Failed to fetch alerts:', error);
                return [];
            }
        }

        async function acknowledgeAlert(alertId) {
            try {
                await fetch(API_BASE + '/alerts/acknowledge/' + alertId, { method: 'POST' });
                refreshDashboard();
            } catch (error) {
                console.error('Failed to acknowledge alert:', error);
            }
        }

        function renderSystemHealth(metrics) {
            const overall = metrics.overall;
            let html = '';
            
            html += '<div class="metric">';
            html += '<span class="metric-label">Overall Status</span>';
            html += '<span class="metric-value status-' + (overall.healthy ? 'healthy' : 'error') + '">';
            html += overall.healthy ? '✅ Healthy' : '❌ Issues Detected';
            html += '</span>';
            html += '</div>';
            
            html += '<div class="metric">';
            html += '<span class="metric-label">CPU Usage</span>';
            html += '<span class="metric-value">' + overall.cpuUsage.toFixed(1) + '%</span>';
            html += '</div>';
            
            html += '<div class="metric">';
            html += '<span class="metric-label">Memory Usage</span>';
            html += '<span class="metric-value">' + overall.memoryUsage.toFixed(1) + '%</span>';
            html += '</div>';
            
            html += '<div class="metric">';
            html += '<span class="metric-label">Uptime</span>';
            html += '<span class="metric-value">' + formatUptime(overall.uptime) + '</span>';
            html += '</div>';
            
            document.getElementById('system-health').innerHTML = html;
        }

        function renderServiceStatus(metrics) {
            const services = metrics.services || {};
            let html = '';
            
            for (const [name, service] of Object.entries(services)) {
                const statusClass = service.healthy ? 'healthy' : 'error';
                html += '<div class="metric">';
                html += '<span class="metric-label">' + name + '</span>';
                html += '<span class="metric-value status-' + statusClass + '">';
                html += service.healthy ? '✅ Running' : '❌ Down';
                html += '</span>';
                html += '</div>';
            }
            
            if (html === '') {
                html = '<p style="color: #999;">No services monitored</p>';
            }
            
            document.getElementById('service-status').innerHTML = html;
        }

        function renderDatabaseMetrics(metrics) {
            const db = metrics.database || {};
            let html = '';
            
            if (db.connected) {
                html += '<div class="metric">';
                html += '<span class="metric-label">Connection Status</span>';
                html += '<span class="metric-value status-healthy">✅ Connected</span>';
                html += '</div>';
                
                html += '<div class="metric">';
                html += '<span class="metric-label">Active Connections</span>';
                html += '<span class="metric-value">' + (db.activeConnections || 0) + '</span>';
                html += '</div>';
                
                html += '<div class="metric">';
                html += '<span class="metric-label">Query Performance</span>';
                html += '<span class="metric-value">' + (db.avgQueryTime || 0).toFixed(0) + 'ms</span>';
                html += '</div>';
            } else {
                html = '<p style="color: #f44336;">Database connection failed</p>';
            }
            
            document.getElementById('database-metrics').innerHTML = html;
        }

        function renderAlerts(alerts) {
            let html = '';
            
            if (alerts.length === 0) {
                html = '<p style="color: #4caf50;">✅ No active alerts</p>';
            } else {
                for (const alert of alerts) {
                    const alertClass = alert.level === 'error' ? 'alert-error' : 'alert-warning';
                    html += '<div class="alert ' + alertClass + '">';
                    html += '<span>' + alert.message + '</span>';
                    html += '<button onclick="acknowledgeAlert(\\'' + alert.id + '\\')">Dismiss</button>';
                    html += '</div>';
                }
            }
            
            document.getElementById('alerts').innerHTML = html;
        }

        function formatUptime(seconds) {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            
            if (days > 0) {
                return days + 'd ' + hours + 'h';
            } else if (hours > 0) {
                return hours + 'h ' + minutes + 'm';
            } else {
                return minutes + 'm';
            }
        }

        async function refreshDashboard() {
            const metrics = await fetchMetrics();
            if (metrics) {
                renderSystemHealth(metrics);
                renderServiceStatus(metrics);
                renderDatabaseMetrics(metrics);
            }
            
            const alerts = await fetchAlerts();
            renderAlerts(alerts);
        }

        // Initial load
        refreshDashboard();
        
        // Auto-refresh every 10 seconds
        setInterval(refreshDashboard, 10000);
    </script>
</body>
</html>
    `;
    
    res.type('html').send(html);
  }
}