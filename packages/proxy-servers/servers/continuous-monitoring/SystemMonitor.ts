import * as os from 'os';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

export interface SystemMetrics {
  overall: {
    healthy: boolean;
    cpuUsage: number;
    memoryUsage: number;
    uptime: number;
    timestamp: Date;
  };
  services: Record<string, ServiceHealth>;
  database: DatabaseHealth;
  filesystem: FilesystemHealth;
}

export interface ServiceHealth {
  name: string;
  healthy: boolean;
  responseTime?: number;
  lastError?: string;
  lastCheck: Date;
}

export interface DatabaseHealth {
  connected: boolean;
  activeConnections?: number;
  avgQueryTime?: number;
  lastError?: string;
}

export interface FilesystemHealth {
  diskUsage: number;
  tempFiles: number;
  logsSize: number;
}

export interface Alert {
  id: string;
  level: 'error' | 'warning';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export class SystemMonitor {
  private metrics: SystemMetrics[] = [];
  private alerts: Alert[] = [];
  private supabase = SupabaseClientService.getInstance().getClient();
  private startTime = Date.now();

  async runHealthChecks(): Promise<SystemMetrics> {
    const metrics: SystemMetrics = {
      overall: await this.getOverallHealth(),
      services: await this.checkServices(),
      database: await this.checkDatabase(),
      filesystem: await this.checkFilesystem()
    };

    // Store metrics
    this.metrics.push(metrics);
    
    // Keep only last 24 hours
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.overall.timestamp.getTime() > dayAgo);

    // Check for issues and create alerts
    this.checkForAlerts(metrics);

    // Store in database (optional)
    await this.storeMetrics(metrics);

    return metrics;
  }

  private async getOverallHealth(): Promise<SystemMetrics['overall']> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    
    // Calculate CPU usage (simple average)
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    
    const cpuUsage = 100 - ~~(100 * totalIdle / totalTick);
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    return {
      healthy: cpuUsage < 80 && memoryUsage < 90,
      cpuUsage,
      memoryUsage,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date()
    };
  }

  private async checkServices(): Promise<Record<string, ServiceHealth>> {
    const services: Record<string, ServiceHealth> = {};
    
    // Check proxy servers
    const proxyChecks = [
      { name: 'vite-fix-proxy', url: 'http://localhost:9876/health' },
      { name: 'proxy-manager', url: 'http://localhost:9878/health' },
      { name: 'continuous-monitoring', url: 'http://localhost:9877/health' },
    ];

    for (const check of proxyChecks) {
      const start = Date.now();
      try {
        const response = await fetch(check.url);
        const responseTime = Date.now() - start;
        
        services[check.name] = {
          name: check.name,
          healthy: response.ok,
          responseTime,
          lastCheck: new Date()
        };
      } catch (error) {
        services[check.name] = {
          name: check.name,
          healthy: false,
          lastError: error instanceof Error ? error.message : 'Unknown error',
          lastCheck: new Date()
        };
      }
    }

    return services;
  }

  private async checkDatabase(): Promise<DatabaseHealth> {
    try {
      const start = Date.now();
      const { data, error } = await this.supabase
        .from('sys_shared_services')
        .select('count')
        .limit(1);
      
      const queryTime = Date.now() - start;

      if (error) {
        return {
          connected: false,
          lastError: error.message
        };
      }

      return {
        connected: true,
        avgQueryTime: queryTime,
        activeConnections: 1 // Would need real connection pool info
      };
    } catch (error) {
      return {
        connected: false,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkFilesystem(): Promise<FilesystemHealth> {
    // Simple implementation - would expand for real monitoring
    return {
      diskUsage: 0, // Would calculate actual disk usage
      tempFiles: 0, // Would count temp files
      logsSize: 0   // Would calculate log sizes
    };
  }

  private checkForAlerts(metrics: SystemMetrics): void {
    // Check CPU
    if (metrics.overall.cpuUsage > 90) {
      this.createAlert('error', `High CPU usage: ${metrics.overall.cpuUsage.toFixed(1)}%`);
    } else if (metrics.overall.cpuUsage > 80) {
      this.createAlert('warning', `Elevated CPU usage: ${metrics.overall.cpuUsage.toFixed(1)}%`);
    }

    // Check Memory
    if (metrics.overall.memoryUsage > 90) {
      this.createAlert('error', `High memory usage: ${metrics.overall.memoryUsage.toFixed(1)}%`);
    }

    // Check Services
    for (const [name, service] of Object.entries(metrics.services)) {
      if (!service.healthy) {
        this.createAlert('error', `Service ${name} is down`);
      }
    }

    // Check Database
    if (!metrics.database.connected) {
      this.createAlert('error', 'Database connection lost');
    }
  }

  private createAlert(level: 'error' | 'warning', message: string): void {
    // Check if similar alert already exists
    const existing = this.alerts.find(a => 
      a.message === message && 
      !a.acknowledged &&
      Date.now() - a.timestamp.getTime() < 300000 // 5 minutes
    );

    if (!existing) {
      this.alerts.push({
        id: Math.random().toString(36).substr(2, 9),
        level,
        message,
        timestamp: new Date(),
        acknowledged: false
      });
    }
  }

  private async storeMetrics(metrics: SystemMetrics): Promise<void> {
    // Store in database for historical analysis
    try {
      await this.supabase
        .from('sys_monitoring_metrics')
        .insert({
          timestamp: metrics.overall.timestamp,
          cpu_usage: metrics.overall.cpuUsage,
          memory_usage: metrics.overall.memoryUsage,
          overall_health: metrics.overall.healthy,
          service_health: metrics.services,
          database_health: metrics.database,
          filesystem_health: metrics.filesystem
        });
    } catch (error) {
      // Don't fail if storage fails
      console.error('[SystemMonitor] Failed to store metrics:', error);
    }
  }

  async getCurrentMetrics(): Promise<SystemMetrics> {
    if (this.metrics.length === 0) {
      return await this.runHealthChecks();
    }
    return this.metrics[this.metrics.length - 1];
  }

  async getMetricsHistory(hours: number): Promise<SystemMetrics[]> {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    return this.metrics.filter(m => m.overall.timestamp.getTime() > since);
  }

  async getServiceMetrics(): Promise<Record<string, ServiceHealth>> {
    const current = await this.getCurrentMetrics();
    return current.services;
  }

  async getServiceDetail(serviceName: string): Promise<ServiceHealth | null> {
    const services = await this.getServiceMetrics();
    return services[serviceName] || null;
  }

  async getDatabaseMetrics(): Promise<DatabaseHealth> {
    const current = await this.getCurrentMetrics();
    return current.database;
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return this.alerts.filter(a => !a.acknowledged);
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }
}