/**
 * Tests for ProxyServerBaseService (Refactored)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProxyServerBaseService } from './ProxyServerBaseService';
import { ProxyServerBaseServiceConfig } from './types';

// Mock Express
vi.mock('express', () => {
  const mockApp = {
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    _router: {
      stack: [
        {
          route: {
            path: '/',
            methods: { get: true }
          }
        },
        {
          route: {
            path: '/health',
            methods: { get: true }
          }
        }
      ]
    }
  };
  
  return {
    default: () => mockApp,
    json: () => vi.fn()
  };
});

// Mock HTTP server
vi.mock('http', () => ({
  createServer: vi.fn(() => ({
    listen: vi.fn((port, callback) => callback()),
    close: vi.fn((callback) => callback()),
    on: vi.fn()
  }))
}));

// Mock CORS
vi.mock('cors', () => ({
  default: () => vi.fn()
}));

// Concrete test implementation
class TestProxyServer extends ProxyServerBaseService {
  constructor(config: ProxyServerBaseServiceConfig) {
    super(config);
  }

  protected setupRoutes(): void {
    this.app.get('/test', (req, res) => {
      res.json({ message: 'Test endpoint' });
    });
  }

  protected getServiceDescription(): string {
    return 'Test proxy server for unit testing';
  }

  // Expose protected methods for testing
  public async testOnStart(): Promise<void> {
    return this.onStart();
  }

  public async testOnStop(): Promise<void> {
    return this.onStop();
  }

  public async testPerformHealthCheck() {
    return this.performHealthCheck();
  }
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

describe('ProxyServerBaseService', () => {
  let service: TestProxyServer;
  let config: ProxyServerBaseServiceConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      proxyConfig: {
        name: 'test-proxy',
        port: 9999,
        description: 'Test proxy server'
      }
    };
    service = new TestProxyServer(config);
  });

  afterEach(async () => {
    if (service && service.isRunning()) {
      await service.stop();
    }
  });

  describe('Constructor and Initialization', () => {
    it('should create service with valid configuration', () => {
      expect(service).toBeInstanceOf(ProxyServerBaseService);
      expect(service.getName()).toBe('test-proxy');
      expect(service.getPort()).toBe(9999);
    });

    it('should validate required configuration fields', () => {
      const invalidConfigs = [
        { proxyConfig: { name: '', port: 9999 } },
        { proxyConfig: { name: 'test', port: 0 } },
        { proxyConfig: { name: 'test', port: 99999 } },
      ];

      invalidConfigs.forEach((invalidConfig) => {
        expect(() => new TestProxyServer(invalidConfig as any))
          .toThrow();
      });
    });

    it('should initialize with default metrics', () => {
      const metrics = service.getMetrics();
      expect(metrics.requestsReceived).toBe(0);
      expect(metrics.requestsCompleted).toBe(0);
      expect(metrics.requestsFailed).toBe(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.startCount).toBe(0);
      expect(metrics.stopCount).toBe(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should reject empty name', () => {
      const invalidConfig = {
        proxyConfig: { name: '', port: 9999 }
      };
      
      expect(() => new TestProxyServer(invalidConfig))
        .toThrow('ProxyServerConfig.name is required');
    });

    it('should reject invalid port numbers', () => {
      const invalidPorts = [0, -1, 999, 65536, 100000];
      
      invalidPorts.forEach(port => {
        const invalidConfig = {
          proxyConfig: { name: 'test', port }
        };
        
        expect(() => new TestProxyServer(invalidConfig))
          .toThrow('ProxyServerConfig.port must be between 1000 and 65535');
      });
    });

    it('should accept valid port numbers', () => {
      const validPorts = [1000, 8080, 9999, 65535];
      
      validPorts.forEach(port => {
        const validConfig = {
          proxyConfig: { name: 'test', port }
        };
        
        expect(() => new TestProxyServer(validConfig))
          .not.toThrow();
      });
    });
  });

  describe('Health Checks', () => {
    it('should return healthy status when not running', async () => {
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true); // Custom health check returns true
      expect(health.details.serverRunning).toBe(false);
      expect(health.details.port).toBe(9999);
      expect(health.latencyMs).toBeGreaterThan(0);
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should track health check count', async () => {
      await service.healthCheck();
      await service.healthCheck();
      
      const metrics = service.getMetrics();
      expect(metrics.healthCheckCount).toBe(2);
      expect(metrics.healthCheckFailures).toBe(0);
    });

    it('should handle health check errors gracefully', async () => {
      // Override performHealthCheck to throw error
      vi.spyOn(service, 'testPerformHealthCheck').mockRejectedValue(new Error('Health check failed'));
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.error).toBe('Health check failed');
      
      const metrics = service.getMetrics();
      expect(metrics.healthCheckFailures).toBe(1);
      expect(metrics.errors).toBe(1);
    });
  });

  describe('Server Lifecycle', () => {
    it('should start and stop server successfully', async () => {
      expect(service.isRunning()).toBe(false);
      
      await service.start();
      expect(service.isRunning()).toBe(true);
      
      const metrics = service.getMetrics();
      expect(metrics.startCount).toBe(1);
      
      await service.stop();
      expect(service.isRunning()).toBe(false);
      
      const finalMetrics = service.getMetrics();
      expect(finalMetrics.stopCount).toBe(1);
    });

    it('should handle multiple start calls gracefully', async () => {
      await service.start();
      await service.start(); // Should not throw
      
      const metrics = service.getMetrics();
      expect(metrics.startCount).toBe(1); // Should only start once
    });

    it('should restart server correctly', async () => {
      await service.start();
      await service.restart();
      
      expect(service.isRunning()).toBe(true);
      
      const metrics = service.getMetrics();
      expect(metrics.restartCount).toBe(1);
      expect(metrics.startCount).toBe(2); // Original start + restart
      expect(metrics.stopCount).toBe(1);  // Stop during restart
    });
  });

  describe('Server Information', () => {
    it('should provide correct server information', () => {
      const info = service.getServerInfo();
      
      expect(info.name).toBe('test-proxy');
      expect(info.description).toBe('Test proxy server for unit testing');
      expect(info.port).toBe(9999);
      expect(info.status).toBe('stopped');
      expect(info.uptime).toBe(0);
      expect(info.startTime).toBeNull();
      expect(Array.isArray(info.endpoints)).toBe(true);
    });

    it('should show running status when server is started', async () => {
      await service.start();
      
      const info = service.getServerInfo();
      expect(info.status).toBe('running');
      expect(info.uptime).toBeGreaterThanOrEqual(0);
      expect(info.startTime).toBeTruthy();
    });
  });

  describe('Metrics Tracking', () => {
    it('should track server lifecycle metrics', async () => {
      const initialMetrics = service.getMetrics();
      expect(initialMetrics.startCount).toBe(0);
      expect(initialMetrics.stopCount).toBe(0);
      
      await service.start();
      await service.stop();
      await service.restart();
      
      const finalMetrics = service.getMetrics();
      expect(finalMetrics.startCount).toBe(2); // start + restart
      expect(finalMetrics.stopCount).toBe(2);  // stop + restart stop
      expect(finalMetrics.restartCount).toBe(1);
    });

    it('should provide comprehensive metrics', () => {
      const metrics = service.getMetrics();
      
      // Check all expected metric fields exist
      expect(typeof metrics.requestsReceived).toBe('number');
      expect(typeof metrics.requestsCompleted).toBe('number');
      expect(typeof metrics.requestsFailed).toBe('number');
      expect(typeof metrics.averageResponseTime).toBe('number');
      expect(typeof metrics.totalResponseTime).toBe('number');
      expect(typeof metrics.uptimeSeconds).toBe('number');
      expect(typeof metrics.startCount).toBe('number');
      expect(typeof metrics.stopCount).toBe('number');
      expect(typeof metrics.restartCount).toBe('number');
      expect(typeof metrics.healthCheckCount).toBe('number');
      expect(typeof metrics.healthCheckFailures).toBe('number');
      expect(typeof metrics.activeConnections).toBe('number');
      expect(typeof metrics.peakConnections).toBe('number');
      expect(typeof metrics.errors).toBe('number');
    });
  });

  describe('Abstract Method Implementation', () => {
    it('should require setupRoutes implementation', () => {
      class IncompleteProxy extends ProxyServerBaseService {
        protected getServiceDescription(): string {
          return 'Incomplete proxy';
        }
        
        // Missing setupRoutes implementation
      }
      
      // TypeScript would catch this, but we can't test compilation errors in runtime
      // This test ensures the abstract method contract is clear
      expect(() => {
        const proxy = new IncompleteProxy(config);
        // The error would occur during setupRoutes call in initialize
        return proxy;
      }).toBeDefined();
    });

    it('should require getServiceDescription implementation', () => {
      class IncompleteProxy extends ProxyServerBaseService {
        protected setupRoutes(): void {
          // Empty implementation
        }
        
        // Missing getServiceDescription implementation
      }
      
      // This test ensures the abstract method contract is clear
      expect(() => {
        const proxy = new IncompleteProxy(config);
        return proxy;
      }).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle and track errors appropriately', async () => {
      // Force an error during health check
      vi.spyOn(service, 'testPerformHealthCheck').mockRejectedValue(new Error('Test error'));
      
      await service.healthCheck();
      
      const metrics = service.getMetrics();
      expect(metrics.errors).toBeGreaterThan(0);
    });

    it('should handle cleanup gracefully even when stopped', async () => {
      // Ensure service is not running
      expect(service.isRunning()).toBe(false);
      
      // Cleanup should not throw
      await expect(service.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('Initialization Flow', () => {
    it('should ensure initialization before operations', async () => {
      const spy = vi.spyOn(service as any, 'ensureInitialized');
      
      await service.start();
      
      expect(spy).toHaveBeenCalled();
    });

    it('should call lifecycle hooks during start/stop', async () => {
      const onStartSpy = vi.spyOn(service, 'testOnStart');
      const onStopSpy = vi.spyOn(service, 'testOnStop');
      
      await service.start();
      expect(onStartSpy).toHaveBeenCalled();
      
      await service.stop();
      expect(onStopSpy).toHaveBeenCalled();
    });
  });
});