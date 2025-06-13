import { ProxyServerBase } from './ProxyServerBase';
import { ProxyServerInstance, ProxyServerCategory, ProxyServerInfo } from '../types';

/**
 * Central registry for all proxy servers
 * Manages lifecycle and provides discovery
 */
export class ProxyRegistry {
  private static instance: ProxyRegistry;
  private servers: Map<string, ProxyServerInstance> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ProxyRegistry {
    if (!ProxyRegistry.instance) {
      ProxyRegistry.instance = new ProxyRegistry();
    }
    return ProxyRegistry.instance;
  }

  /**
   * Register a proxy server
   */
  register(
    server: ProxyServerBase,
    category: ProxyServerCategory = 'development'
  ): void {
    const name = server.getName();
    
    if (this.servers.has(name)) {
      throw new Error(`Proxy server '${name}' is already registered`);
    }

    this.servers.set(name, {
      name,
      port: server.getPort(),
      server,
      category
    });

    console.log(`[ProxyRegistry] Registered ${name} on port ${server.getPort()}`);
  }

  /**
   * Unregister a proxy server
   */
  unregister(name: string): void {
    if (this.servers.delete(name)) {
      console.log(`[ProxyRegistry] Unregistered ${name}`);
    }
  }

  /**
   * Get a specific proxy server
   */
  get(name: string): ProxyServerBase | undefined {
    return this.servers.get(name)?.server;
  }

  /**
   * Get all proxy servers
   */
  getAll(): ProxyServerInstance[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get proxy servers by category
   */
  getByCategory(category: ProxyServerCategory): ProxyServerInstance[] {
    return Array.from(this.servers.values()).filter(
      instance => instance.category === category
    );
  }

  /**
   * Get info for all registered servers
   */
  getAllInfo(): Record<string, ProxyServerInfo> {
    const info: Record<string, ProxyServerInfo> = {};
    
    for (const [name, instance] of this.servers) {
      info[name] = instance.server.getServerInfo();
    }
    
    return info;
  }

  /**
   * Start all registered servers
   */
  async startAll(): Promise<void> {
    console.log('[ProxyRegistry] Starting all proxy servers...');
    
    const promises = Array.from(this.servers.values()).map(async instance => {
      try {
        if (!instance.server.isRunning()) {
          await instance.server.start();
        }
      } catch (error) {
        console.error(`[ProxyRegistry] Failed to start ${instance.name}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Stop all registered servers
   */
  async stopAll(): Promise<void> {
    console.log('[ProxyRegistry] Stopping all proxy servers...');
    
    const promises = Array.from(this.servers.values()).map(async instance => {
      try {
        if (instance.server.isRunning()) {
          await instance.server.stop();
        }
      } catch (error) {
        console.error(`[ProxyRegistry] Failed to stop ${instance.name}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Get status of all servers
   */
  getStatus(): Record<ProxyServerCategory, ProxyServerInfo[]> {
    const status: Record<ProxyServerCategory, ProxyServerInfo[]> = {
      development: [],
      media: [],
      testing: [],
      infrastructure: []
    };

    for (const instance of this.servers.values()) {
      status[instance.category].push(instance.server.getServerInfo());
    }

    return status;
  }

  /**
   * Check if a port is in use by a registered server
   */
  isPortInUse(port: number): boolean {
    for (const instance of this.servers.values()) {
      if (instance.port === port && instance.server.isRunning()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find an available port in the proxy server range
   */
  findAvailablePort(start: number = 9876, end: number = 9899): number | null {
    for (let port = start; port <= end; port++) {
      if (!this.isPortInUse(port)) {
        return port;
      }
    }
    return null;
  }
}