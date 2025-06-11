/**
 * Ports Management Service
 * 
 * Central service for dynamic port allocation and server health monitoring.
 * Manages server registration, port assignment, and connection status.
 */

import { SupabaseClientService } from './supabase-client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as net from 'net';

const execAsync = promisify(exec);

interface ServerConfig {
  service_name: string;
  display_name: string;
  description: string;
  port?: number;
  protocol?: string;
  host?: string;
  base_path?: string;
  health_check_endpoint?: string;
  start_command?: string;
  process_name?: string;
}

interface ServerStatus {
  service_name: string;
  port: number;
  status: 'active' | 'inactive' | 'starting' | 'error';
  last_health_check?: Date;
  last_health_status?: 'healthy' | 'unhealthy' | 'unknown';
  error?: string;
}

export class PortsManagementService {
  private static instance: PortsManagementService;
  private serverConfigs: Map<string, ServerConfig> = new Map();
  private allocatedPorts: Set<number> = new Set();
  private startPort = 3000;
  private endPort = 3100;

  private constructor() {
    this.initializeServerConfigs();
  }

  static getInstance(): PortsManagementService {
    if (!PortsManagementService.instance) {
      PortsManagementService.instance = new PortsManagementService();
    }
    return PortsManagementService.instance;
  }

  /**
   * Initialize default server configurations
   */
  private initializeServerConfigs() {
    const configs: ServerConfig[] = [
      {
        service_name: 'md-server',
        display_name: 'Markdown Server',
        description: 'Serves markdown documentation files',
        port: 3001,
        start_command: 'node scripts/cli-pipeline/viewers/simple-md-server.js',
        health_check_endpoint: '/health',
        process_name: 'simple-md-server'
      },
      {
        service_name: 'script-server',
        display_name: 'Script Server',
        description: 'Serves script files for viewing',
        port: 3002,
        start_command: 'node scripts/cli-pipeline/viewers/simple-script-server.js',
        health_check_endpoint: '/health',
        process_name: 'simple-script-server'
      },
      {
        service_name: 'docs-archive-server',
        display_name: 'Docs Archive Server',
        description: 'Serves archived documentation',
        port: 3003,
        start_command: 'node scripts/cli-pipeline/viewers/docs-archive-server.js',
        health_check_endpoint: '/health',
        process_name: 'docs-archive-server'
      },
      {
        service_name: 'git-server',
        display_name: 'Git Server',
        description: 'Provides git repository information',
        port: 3005,
        start_command: 'node apps/dhg-admin-code/git-server.cjs',
        health_check_endpoint: '/api/git/health',
        process_name: 'git-server'
      },
      {
        service_name: 'continuous-docs-server',
        display_name: 'Continuous Docs Server',
        description: 'Manages continuous documentation updates',
        port: 3008,
        start_command: 'node apps/dhg-admin-code/continuous-docs-server.cjs',
        health_check_endpoint: '/health',
        process_name: 'continuous-docs-server'
      },
      {
        service_name: 'git-api-server',
        display_name: 'Git API Server',
        description: 'Executes git-related CLI commands',
        port: 3009,
        start_command: 'node apps/dhg-admin-code/git-api-server.cjs',
        health_check_endpoint: '/health',
        process_name: 'git-api-server'
      },
      {
        service_name: 'audio-proxy-server',
        display_name: 'Audio Proxy Server',
        description: 'Proxies audio streaming from Google Drive',
        port: 3006,
        start_command: 'cd apps/dhg-audio && node server.js',
        health_check_endpoint: '/health',
        process_name: 'audio-proxy'
      }
    ];

    configs.forEach(config => {
      this.serverConfigs.set(config.service_name, config);
    });
  }

  /**
   * Find an available port
   */
  async findAvailablePort(preferredPort?: number): Promise<number> {
    if (preferredPort && await this.isPortAvailable(preferredPort)) {
      return preferredPort;
    }

    for (let port = this.startPort; port <= this.endPort; port++) {
      if (!this.allocatedPorts.has(port) && await this.isPortAvailable(port)) {
        return port;
      }
    }

    throw new Error('No available ports in range');
  }

  /**
   * Check if a port is available
   */
  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', () => {
        resolve(false);
      });
      
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      
      server.listen(port);
    });
  }

  /**
   * Register a server in the database
   */
  async registerServer(serviceName: string, port: number): Promise<void> {
    const supabase = SupabaseClientService.getInstance().getClient();
    const config = this.serverConfigs.get(serviceName);
    
    if (!config) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    const { error } = await supabase
      .from('sys_server_ports_registry')
      .upsert({
        service_name: serviceName,
        display_name: config.display_name,
        description: config.description,
        port: port,
        protocol: config.protocol || 'http',
        host: config.host || 'localhost',
        base_path: config.base_path || '',
        environment: process.env.NODE_ENV || 'development',
        status: 'active',
        health_check_endpoint: config.health_check_endpoint || '/health',
        last_health_check: new Date().toISOString(),
        last_health_status: 'unknown'
      }, {
        onConflict: 'service_name'
      });

    if (error) {
      console.error(`Failed to register ${serviceName}:`, error);
      throw error;
    }

    this.allocatedPorts.add(port);
    console.log(`✅ Registered ${serviceName} on port ${port}`);
  }

  /**
   * Start a server with dynamic port allocation
   */
  async startServer(serviceName: string): Promise<ServerStatus> {
    const config = this.serverConfigs.get(serviceName);
    
    if (!config) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    try {
      // Find available port
      const port = await this.findAvailablePort(config.port);
      
      // Set environment variable for the server
      const envVar = this.getPortEnvVar(serviceName);
      process.env[envVar] = port.toString();

      // Register in database
      await this.registerServer(serviceName, port);

      // Start the server
      if (config.start_command) {
        console.log(`🚀 Starting ${config.display_name} on port ${port}...`);
        
        // Start server in background
        const { stdout, stderr } = await execAsync(
          `${config.start_command} &`,
          { 
            env: { ...process.env, [envVar]: port.toString() },
            shell: true
          }
        );

        if (stderr && !stderr.includes('Debugger listening')) {
          console.error(`Error starting ${serviceName}:`, stderr);
        }
      }

      return {
        service_name: serviceName,
        port,
        status: 'starting',
        last_health_check: new Date()
      };
    } catch (error) {
      console.error(`Failed to start ${serviceName}:`, error);
      return {
        service_name: serviceName,
        port: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get environment variable name for a service
   */
  private getPortEnvVar(serviceName: string): string {
    const varMap: Record<string, string> = {
      'md-server': 'MD_SERVER_PORT',
      'script-server': 'SCRIPT_SERVER_PORT',
      'docs-archive-server': 'DOCS_ARCHIVE_SERVER_PORT',
      'git-server': 'GIT_SERVER_PORT',
      'continuous-docs-server': 'CONTINUOUS_DOCS_PORT',
      'git-api-server': 'GIT_API_SERVER_PORT',
      'audio-proxy-server': 'AUDIO_PROXY_PORT'
    };
    
    return varMap[serviceName] || 'PORT';
  }

  /**
   * Start all registered servers
   */
  async startAllServers(): Promise<ServerStatus[]> {
    const results: ServerStatus[] = [];
    
    for (const [serviceName] of this.serverConfigs) {
      const status = await this.startServer(serviceName);
      results.push(status);
      
      // Small delay between starts
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results;
  }

  /**
   * Check health of a server
   */
  async checkServerHealth(serviceName: string): Promise<boolean> {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    try {
      const { data } = await supabase
        .from('sys_server_ports_registry')
        .select('port, health_check_endpoint')
        .eq('service_name', serviceName)
        .single();

      if (!data) return false;

      const healthUrl = `http://localhost:${data.port}${data.health_check_endpoint || '/health'}`;
      
      try {
        const response = await fetch(healthUrl, { 
          method: 'GET',
          signal: AbortSignal.timeout(5000) 
        });
        
        const isHealthy = response.ok;
        
        // Update health status in database
        await supabase
          .from('sys_server_ports_registry')
          .update({
            last_health_check: new Date().toISOString(),
            last_health_status: isHealthy ? 'healthy' : 'unhealthy'
          })
          .eq('service_name', serviceName);
          
        return isHealthy;
      } catch (error) {
        // Server not responding
        await supabase
          .from('sys_server_ports_registry')
          .update({
            last_health_check: new Date().toISOString(),
            last_health_status: 'unhealthy',
            status: 'inactive'
          })
          .eq('service_name', serviceName);
          
        return false;
      }
    } catch (error) {
      console.error(`Health check failed for ${serviceName}:`, error);
      return false;
    }
  }

  /**
   * Monitor all servers health
   */
  async monitorAllServers(): Promise<Map<string, boolean>> {
    const healthStatus = new Map<string, boolean>();
    
    for (const [serviceName] of this.serverConfigs) {
      const isHealthy = await this.checkServerHealth(serviceName);
      healthStatus.set(serviceName, isHealthy);
    }
    
    return healthStatus;
  }

  /**
   * Stop a server
   */
  async stopServer(serviceName: string): Promise<void> {
    const config = this.serverConfigs.get(serviceName);
    if (!config || !config.process_name) return;

    try {
      // Find and kill the process
      const { stdout } = await execAsync(`pgrep -f "${config.process_name}"`);
      const pids = stdout.trim().split('\n').filter(Boolean);
      
      for (const pid of pids) {
        await execAsync(`kill ${pid}`);
      }
      
      // Update database
      const supabase = SupabaseClientService.getInstance().getClient();
      await supabase
        .from('sys_server_ports_registry')
        .update({ status: 'inactive' })
        .eq('service_name', serviceName);
        
      console.log(`🛑 Stopped ${config.display_name}`);
    } catch (error) {
      // Process might not be running
      console.log(`${config.display_name} not running or already stopped`);
    }
  }

  /**
   * Stop all servers
   */
  async stopAllServers(): Promise<void> {
    for (const [serviceName] of this.serverConfigs) {
      await this.stopServer(serviceName);
    }
  }
}

// Export singleton instance
export const portsManager = PortsManagementService.getInstance();