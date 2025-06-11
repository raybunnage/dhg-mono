/**
 * Server Registry Service
 * 
 * Provides dynamic server port discovery for frontend applications.
 * Replaces hardcoded server URLs with runtime lookup from database.
 */

import { createSupabaseAdapter } from '../adapters/supabase-adapter';
import type { Database } from '../../../supabase/types';

type ServerInfo = {
  service_name: string;
  display_name: string;
  base_url: string;
  port: number;
  status: string;
  last_health_check: string | null;
  last_health_status: string | null;
};

export class ServerRegistryService {
  private static instance: ServerRegistryService;
  private servers: Map<string, ServerInfo> = new Map();
  private lastFetch: number = 0;
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private supabase: any;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionListeners: Map<string, ((status: boolean) => void)[]> = new Map();

  private constructor() {
    // Initialize with env for browser apps
    if (typeof window !== 'undefined') {
      this.supabase = createSupabaseAdapter({
        env: import.meta.env as any
      });
    }
  }

  static getInstance(): ServerRegistryService {
    if (!ServerRegistryService.instance) {
      ServerRegistryService.instance = new ServerRegistryService();
    }
    return ServerRegistryService.instance;
  }

  /**
   * Get server URL by service name
   * Falls back to hardcoded defaults if registry unavailable
   */
  async getServerUrl(serviceName: string): Promise<string> {
    // Check cache first
    const cached = this.servers.get(serviceName);
    if (cached && Date.now() - this.lastFetch < this.cacheTimeout) {
      return cached.base_url;
    }

    // Refresh cache
    await this.refreshRegistry();

    // Try again after refresh
    const server = this.servers.get(serviceName);
    if (server) {
      return server.base_url;
    }

    // Fallback to hardcoded defaults for backward compatibility
    return this.getDefaultUrl(serviceName);
  }

  /**
   * Get server port by service name
   */
  async getServerPort(serviceName: string): Promise<number> {
    const server = this.servers.get(serviceName);
    if (server) {
      return server.port;
    }

    await this.refreshRegistry();
    const refreshedServer = this.servers.get(serviceName);
    
    return refreshedServer?.port || this.getDefaultPort(serviceName);
  }

  /**
   * Refresh the server registry from database
   */
  private async refreshRegistry(): Promise<void> {
    try {
      if (!this.supabase) {
        console.warn('Supabase not initialized, using defaults');
        return;
      }

      const { data, error } = await this.supabase
        .from('sys_active_servers_view')
        .select('*');

      if (error) {
        console.error('Failed to fetch server registry:', error);
        return;
      }

      // Update cache
      this.servers.clear();
      data?.forEach((server: ServerInfo) => {
        this.servers.set(server.service_name, server);
      });
      
      this.lastFetch = Date.now();
      console.log(`Server registry refreshed with ${this.servers.size} servers`);
    } catch (err) {
      console.error('Error refreshing server registry:', err);
    }
  }

  /**
   * Get all active servers
   */
  async getAllServers(): Promise<ServerInfo[]> {
    await this.refreshRegistry();
    return Array.from(this.servers.values());
  }

  /**
   * Hardcoded defaults for backward compatibility
   */
  private getDefaultUrl(serviceName: string): string {
    const defaults: Record<string, string> = {
      'md-server': 'http://localhost:3001',
      'script-server': 'http://localhost:3002',
      'docs-archive-server': 'http://localhost:3003',
      'git-server': 'http://localhost:3005',
      'living-docs-server': 'http://localhost:3008',
      'git-api-server': 'http://localhost:3009',
    };
    
    return defaults[serviceName] || 'http://localhost:3000';
  }

  private getDefaultPort(serviceName: string): number {
    const defaults: Record<string, number> = {
      'md-server': 3001,
      'script-server': 3002,
      'docs-archive-server': 3003,
      'git-server': 3005,
      'living-docs-server': 3008,
      'git-api-server': 3009,
    };
    
    return defaults[serviceName] || 3000;
  }

  /**
   * Clear the cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.servers.clear();
    this.lastFetch = 0;
  }

  /**
   * Subscribe to connection status changes for a specific server
   */
  onConnectionChange(serviceName: string, callback: (isConnected: boolean) => void): () => void {
    if (!this.connectionListeners.has(serviceName)) {
      this.connectionListeners.set(serviceName, []);
    }
    
    const listeners = this.connectionListeners.get(serviceName)!;
    listeners.push(callback);
    
    // Start monitoring if not already started
    if (!this.healthCheckInterval) {
      this.startHealthMonitoring();
    }
    
    // Return unsubscribe function
    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) return;
    
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      await this.checkAllServersHealth();
    }, 30000);
    
    // Initial check
    this.checkAllServersHealth();
  }

  /**
   * Check health status of all servers
   */
  private async checkAllServersHealth(): Promise<void> {
    await this.refreshRegistry();
    
    for (const [serviceName, server] of this.servers) {
      const isHealthy = server.last_health_status === 'healthy' && 
                       server.status === 'active';
      
      // Notify listeners
      const listeners = this.connectionListeners.get(serviceName);
      if (listeners) {
        listeners.forEach(callback => callback(isHealthy));
      }
    }
  }

  /**
   * Check if a specific server is connected
   */
  async isServerConnected(serviceName: string): Promise<boolean> {
    const server = this.servers.get(serviceName);
    if (!server) {
      await this.refreshRegistry();
      const refreshedServer = this.servers.get(serviceName);
      if (!refreshedServer) return false;
      return refreshedServer.last_health_status === 'healthy' && 
             refreshedServer.status === 'active';
    }
    
    return server.last_health_status === 'healthy' && 
           server.status === 'active';
  }

  /**
   * Get connection status for all servers
   */
  async getAllConnectionStatuses(): Promise<Map<string, boolean>> {
    await this.refreshRegistry();
    const statuses = new Map<string, boolean>();
    
    for (const [serviceName, server] of this.servers) {
      const isConnected = server.last_health_status === 'healthy' && 
                         server.status === 'active';
      statuses.set(serviceName, isConnected);
    }
    
    return statuses;
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// Export singleton instance for convenience
export const serverRegistry = ServerRegistryService.getInstance();