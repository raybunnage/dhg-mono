import { ProxyRegistry } from './ProxyRegistry';
import { ProxyServerBase } from './ProxyServerBase';
import { ProxyServerCategory } from '../types';

/**
 * Manages lifecycle of proxy servers
 * Used by the proxy-manager-proxy to control other proxies
 */
export class ProxyManager {
  private registry: ProxyRegistry;

  constructor() {
    this.registry = ProxyRegistry.getInstance();
  }

  /**
   * Start a specific proxy server
   */
  async startProxy(name: string): Promise<{ success: boolean; message: string }> {
    const proxy = this.registry.get(name);
    
    if (!proxy) {
      return {
        success: false,
        message: `Proxy server '${name}' not found`
      };
    }

    if (proxy.isRunning()) {
      return {
        success: true,
        message: `Proxy server '${name}' is already running`
      };
    }

    try {
      await proxy.start();
      return {
        success: true,
        message: `Proxy server '${name}' started successfully`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to start '${name}': ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Stop a specific proxy server
   */
  async stopProxy(name: string): Promise<{ success: boolean; message: string }> {
    const proxy = this.registry.get(name);
    
    if (!proxy) {
      return {
        success: false,
        message: `Proxy server '${name}' not found`
      };
    }

    if (!proxy.isRunning()) {
      return {
        success: true,
        message: `Proxy server '${name}' is already stopped`
      };
    }

    try {
      await proxy.stop();
      return {
        success: true,
        message: `Proxy server '${name}' stopped successfully`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to stop '${name}': ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Restart a specific proxy server
   */
  async restartProxy(name: string): Promise<{ success: boolean; message: string }> {
    const stopResult = await this.stopProxy(name);
    if (!stopResult.success) {
      return stopResult;
    }

    // Wait a moment before restarting
    await new Promise(resolve => setTimeout(resolve, 1000));

    return this.startProxy(name);
  }

  /**
   * Start all proxies in a category
   */
  async startCategory(category: ProxyServerCategory): Promise<{ success: boolean; message: string; details: any[] }> {
    const proxies = this.registry.getByCategory(category);
    const results = [];

    for (const proxyInstance of proxies) {
      const result = await this.startProxy(proxyInstance.name);
      results.push({ name: proxyInstance.name, ...result });
    }

    const allSuccess = results.every(r => r.success);
    return {
      success: allSuccess,
      message: allSuccess 
        ? `All ${category} proxies started successfully`
        : `Some ${category} proxies failed to start`,
      details: results
    };
  }

  /**
   * Stop all proxies in a category
   */
  async stopCategory(category: ProxyServerCategory): Promise<{ success: boolean; message: string; details: any[] }> {
    const proxies = this.registry.getByCategory(category);
    const results = [];

    for (const proxyInstance of proxies) {
      const result = await this.stopProxy(proxyInstance.name);
      results.push({ name: proxyInstance.name, ...result });
    }

    const allSuccess = results.every(r => r.success);
    return {
      success: allSuccess,
      message: allSuccess 
        ? `All ${category} proxies stopped successfully`
        : `Some ${category} proxies failed to stop`,
      details: results
    };
  }

  /**
   * Start all registered proxy servers
   */
  async startAll(): Promise<{ success: boolean; message: string; details: any[] }> {
    const allProxies = this.registry.getAll();
    const results = [];

    for (const proxyInstance of allProxies) {
      const result = await this.startProxy(proxyInstance.name);
      results.push({ name: proxyInstance.name, ...result });
    }

    const allSuccess = results.every(r => r.success);
    return {
      success: allSuccess,
      message: allSuccess 
        ? 'All proxy servers started successfully'
        : 'Some proxy servers failed to start',
      details: results
    };
  }

  /**
   * Stop all registered proxy servers
   */
  async stopAll(): Promise<{ success: boolean; message: string; details: any[] }> {
    const allProxies = this.registry.getAll();
    const results = [];

    for (const proxyInstance of allProxies) {
      const result = await this.stopProxy(proxyInstance.name);
      results.push({ name: proxyInstance.name, ...result });
    }

    const allSuccess = results.every(r => r.success);
    return {
      success: allSuccess,
      message: allSuccess 
        ? 'All proxy servers stopped successfully'
        : 'Some proxy servers failed to stop',
      details: results
    };
  }

  /**
   * Get status of all proxy servers
   */
  getStatus() {
    return this.registry.getStatus();
  }

  /**
   * Get detailed info for all proxy servers
   */
  getAllInfo() {
    return this.registry.getAllInfo();
  }

  /**
   * Register a new proxy server
   */
  registerProxy(proxy: ProxyServerBase, category: ProxyServerCategory = 'development') {
    this.registry.register(proxy, category);
  }

  /**
   * Unregister a proxy server
   */
  unregisterProxy(name: string) {
    this.registry.unregister(name);
  }
}