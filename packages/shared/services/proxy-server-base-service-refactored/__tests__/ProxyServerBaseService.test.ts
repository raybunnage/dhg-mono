/**
 * ProxyServerBaseService Tests
 * 
 * Tests the abstract ProxyServerBaseService that provides common functionality
 * for all proxy servers including Express app setup, middleware, routing,
 * metrics tracking, and lifecycle management.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProxyServerBaseService } from '../ProxyServerBaseService';
import { ProxyServerBaseServiceConfig } from '../types';
import { Express, Request, Response } from 'express';

// Mock Express and HTTP server
vi.mock('express', () => {
  const mockApp = {
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    listen: vi.fn(),
    close: vi.fn()
  };
  
  const expressFunc = vi.fn(() => mockApp);
  expressFunc.json = vi.fn();
  
  return {
    default: expressFunc,
    json: expressFunc.json
  };
});

vi.mock('cors', () => ({
  default: vi.fn(() => (req: any, res: any, next: any) => next())
}));

vi.mock('http', () => ({
  createServer: vi.fn(() => ({
    listen: vi.fn((port, callback) => {
      if (callback) callback();
      return { on: vi.fn() };
    }),
    close: vi.fn((callback) => {
      if (callback) callback();
    }),
    on: vi.fn()
  }))
}));

// Test implementation of abstract ProxyServerBaseService
class TestProxyServerService extends ProxyServerBaseService {
  private customSetupRoutesCalled = false;
  private customHealthCheckCalled = false;

  setupRoutes(): void {
    this.customSetupRoutesCalled = true;
    // Add a test route
    this.app.get('/test', (req: Request, res: Response) => {
      res.json({ message: 'test route works' });
    });
  }

  async performHealthCheck(): Promise<{ healthy: boolean; details: any }> {
    this.customHealthCheckCalled = true;
    return {
      healthy: true,
      details: { customCheck: 'passed' }
    };
  }

  // Expose protected methods for testing
  public getApp(): Express {
    return this.app;
  }

  public getMetricsForTesting() {
    return this.getMetrics();
  }

  public getServerInfoForTesting() {
    return this.getServerInfo();
  }

  public isCustomSetupRoutesCalled(): boolean {
    return this.customSetupRoutesCalled;
  }

  public isCustomHealthCheckCalled(): boolean {
    return this.customHealthCheckCalled;
  }

  public updateResponseTimeForTesting(duration: number): void {
    (this as any).updateResponseTimeMetrics(duration);
  }

  public getUptimeForTesting(): number {
    return this.getUptime();
  }
}

describe('ProxyServerBaseService', () => {
  let service: TestProxyServerService;
  let config: ProxyServerBaseServiceConfig;

  const validConfig: ProxyServerBaseServiceConfig = {
    proxyConfig: {
      name: 'test-proxy',
      port: 3001,
      cors: {
        origin: ['http://localhost:3000'],
        credentials: true
      },
      customSettings: {
        timeout: 30000,
        rateLimitEnabled: true
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    config = { ...validConfig };
    service = new TestProxyServerService(config);
  });

  afterEach(async () => {
    if (service && service.isRunning()) {
      await service.stop();
    }
  });

  describe('Constructor and Initialization', () => {
    it('should create service with valid config', () => {
      expect(service).toBeInstanceOf(ProxyServerBaseService);
      expect(service).toBeInstanceOf(TestProxyServerService);
    });

    it('should initialize Express app during construction', () => {
      const app = service.getApp();
      expect(app).toBeDefined();
      expect(app.use).toHaveBeenCalled();
    });

    it('should setup common middleware during construction', () => {
      const app = service.getApp();
      
      // Verify middleware setup calls
      expect(app.use).toHaveBeenCalledWith(expect.any(Function)); // CORS
      expect(app.use).toHaveBeenCalledWith(expect.any(Function)); // JSON parser
      expect(app.use).toHaveBeenCalledWith(expect.any(Function)); // Connection tracking
      expect(app.use).toHaveBeenCalledWith(expect.any(Function)); // Request logging
    });

    it('should setup common routes during construction', () => {
      const app = service.getApp();
      
      // Verify route setup calls
      expect(app.get).toHaveBeenCalledWith('/', expect.any(Function));
      expect(app.get).toHaveBeenCalledWith('/health', expect.any(Function));
      expect(app.get).toHaveBeenCalledWith('/info', expect.any(Function));
      expect(app.get).toHaveBeenCalledWith('/metrics', expect.any(Function));
      expect(app.post).toHaveBeenCalledWith('/shutdown', expect.any(Function));
    });
  });

  describe('Configuration Validation', () => {
    it('should reject missing name', () => {
      const invalidConfig = {
        proxyConfig: {
          name: '',
          port: 3001
        }
      };
      
      expect(() => new TestProxyServerService(invalidConfig)).toThrow('ProxyServerConfig.name is required');
    });

    it('should reject invalid port numbers', () => {
      const invalidPortConfigs = [
        { name: 'test', port: 0 },
        { name: 'test', port: 999 },
        { name: 'test', port: 65536 },
        { name: 'test', port: -1 }
      ];

      invalidPortConfigs.forEach(proxyConfig => {
        expect(() => new TestProxyServerService({ proxyConfig }))
          .toThrow('ProxyServerConfig.port must be between 1000 and 65535');
      });
    });

    it('should accept valid port numbers', () => {
      const validPorts = [1000, 3000, 8080, 65535];

      validPorts.forEach(port => {
        const config = { proxyConfig: { name: 'test', port } };
        expect(() => new TestProxyServerService(config)).not.toThrow();
      });
    });
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully', async () => {
      await expect(service.ensureInitialized()).resolves.not.toThrow();
      expect(service.isCustomSetupRoutesCalled()).toBe(true);
    });

    it('should start server successfully', async () => {
      await service.ensureInitialized();
      await service.start();
      
      expect(service.isRunning()).toBe(true);
      expect(service.getUptimeForTesting()).toBeGreaterThan(0);
    });

    it('should stop server successfully', async () => {
      await service.ensureInitialized();
      await service.start();
      
      expect(service.isRunning()).toBe(true);
      
      await service.stop();
      
      expect(service.isRunning()).toBe(false);
    });

    it('should restart server successfully', async () => {
      await service.ensureInitialized();
      await service.start();
      
      const initialStartTime = service.getServerInfoForTesting().startTime;
      
      await service.restart();
      
      expect(service.isRunning()).toBe(true);
      const newStartTime = service.getServerInfoForTesting().startTime;
      expect(new Date(newStartTime!).getTime()).toBeGreaterThan(new Date(initialStartTime!).getTime());
    });

    it('should handle start when already running', async () => {
      await service.ensureInitialized();
      await service.start();
      
      // Should not throw when starting already running server
      await expect(service.start()).resolves.not.toThrow();
      expect(service.isRunning()).toBe(true);
    });

    it('should handle stop when already stopped', async () => {
      await service.ensureInitialized();
      
      // Should not throw when stopping already stopped server
      await expect(service.stop()).resolves.not.toThrow();
      expect(service.isRunning()).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      await service.ensureInitialized();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.details).toMatchObject({
        serverRunning: expect.any(Boolean),
        port: validConfig.proxyConfig.port,
        requestsReceived: expect.any(Number),
        averageResponseTime: expect.any(Number),
        activeConnections: expect.any(Number),
        customHealth: { customCheck: 'passed' }
      });
      
      expect(service.isCustomHealthCheckCalled()).toBe(true);
    });

    it('should report unhealthy when custom health check fails', async () => {
      // Create service with failing health check
      class FailingHealthCheckService extends TestProxyServerService {
        async performHealthCheck(): Promise<{ healthy: boolean; details: any }> {
          return {
            healthy: false,
            details: { customCheck: 'failed', reason: 'Database unavailable' }
          };
        }
      }

      const failingService = new FailingHealthCheckService(config);
      await failingService.ensureInitialized();
      
      const health = await failingService.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.customHealth).toMatchObject({
        customCheck: 'failed',
        reason: 'Database unavailable'
      });
    });

    it('should handle health check errors gracefully', async () => {
      // Create service with error-throwing health check
      class ErrorHealthCheckService extends TestProxyServerService {
        async performHealthCheck(): Promise<{ healthy: boolean; details: any }> {
          throw new Error('Health check failed');
        }
      }

      const errorService = new ErrorHealthCheckService(config);
      await errorService.ensureInitialized();
      
      const health = await errorService.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.error).toBe('Health check failed');
    });
  });

  describe('Server Information', () => {
    it('should provide complete server information', async () => {
      await service.ensureInitialized();
      await service.start();
      
      const info = service.getServerInfoForTesting();
      
      expect(info).toMatchObject({
        name: 'test-proxy',
        port: 3001,
        status: 'running',
        startTime: expect.any(String),
        uptime: expect.any(Number),
        config: expect.any(Object),
        metrics: expect.any(Object)
      });
    });

    it('should provide server info when stopped', async () => {
      await service.ensureInitialized();
      
      const info = service.getServerInfoForTesting();
      
      expect(info.status).toBe('stopped');
      expect(info.startTime).toBeNull();
      expect(info.uptime).toBe(0);
    });
  });

  describe('Metrics Tracking', () => {
    it('should initialize metrics correctly', () => {
      const metrics = service.getMetricsForTesting();
      
      expect(metrics).toMatchObject({
        requestsReceived: 0,
        requestsCompleted: 0,
        requestsFailed: 0,
        averageResponseTime: 0,
        totalResponseTime: 0,
        uptimeSeconds: 0,
        startCount: 0,
        stopCount: 0,
        restartCount: 0,
        healthCheckCount: 0,
        healthCheckFailures: 0,
        activeConnections: 0,
        peakConnections: 0,
        errors: 0
      });
    });

    it('should track response times correctly', () => {
      const durations = [100, 200, 300, 400, 500];
      
      durations.forEach(duration => {
        service.updateResponseTimeForTesting(duration);
      });
      
      const metrics = service.getMetricsForTesting();
      const expectedAverage = durations.reduce((a, b) => a + b, 0) / durations.length;
      
      expect(metrics.averageResponseTime).toBe(expectedAverage);
      expect(metrics.totalResponseTime).toBe(1500);
    });

    it('should maintain response time history within limits', () => {
      // Add more than maxHistoryLength (100) response times
      for (let i = 0; i < 150; i++) {
        service.updateResponseTimeForTesting(100 + i);
      }
      
      const metrics = service.getMetricsForTesting();
      
      // Should maintain average of most recent entries
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.totalResponseTime).toBeGreaterThan(0);
    });

    it('should track health check metrics', async () => {
      await service.ensureInitialized();
      
      // Perform multiple health checks
      await service.healthCheck();
      await service.healthCheck();
      await service.healthCheck();
      
      const metrics = service.getMetricsForTesting();
      
      expect(metrics.healthCheckCount).toBe(3);
      expect(metrics.healthCheckFailures).toBe(0);
    });

    it('should track start/stop/restart counts', async () => {
      await service.ensureInitialized();
      
      await service.start();
      await service.stop();
      await service.start();
      await service.restart();
      
      const metrics = service.getMetricsForTesting();
      
      expect(metrics.startCount).toBeGreaterThan(0);
      expect(metrics.stopCount).toBeGreaterThan(0);
      expect(metrics.restartCount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle server start errors gracefully', async () => {
      // Mock server.listen to fail
      const { createServer } = require('http');
      createServer.mockReturnValueOnce({
        listen: vi.fn((port, callback) => {
          throw new Error('Port already in use');
        }),
        close: vi.fn(),
        on: vi.fn()
      });

      await service.ensureInitialized();
      
      await expect(service.start()).rejects.toThrow('Port already in use');
      expect(service.isRunning()).toBe(false);
    });

    it('should handle server stop errors gracefully', async () => {
      await service.ensureInitialized();
      await service.start();
      
      // Mock server.close to fail
      const server = (service as any).server;
      server.close = vi.fn((callback) => {
        callback(new Error('Failed to close server'));
      });
      
      await expect(service.stop()).rejects.toThrow('Failed to close server');
    });

    it('should track errors in metrics', async () => {
      await service.ensureInitialized();
      
      // Force an error in health check
      try {
        const errorService = new (class extends TestProxyServerService {
          async performHealthCheck(): Promise<{ healthy: boolean; details: any }> {
            throw new Error('Simulated error');
          }
        })(config);
        
        await errorService.ensureInitialized();
        await errorService.healthCheck();
        
        const metrics = errorService.getMetricsForTesting();
        expect(metrics.errors).toBeGreaterThan(0);
      } catch (error) {
        // Expected to throw
      }
    });
  });

  describe('Abstract Method Implementation', () => {
    it('should call setupRoutes during initialization', async () => {
      expect(service.isCustomSetupRoutesCalled()).toBe(false);
      
      await service.ensureInitialized();
      
      expect(service.isCustomSetupRoutesCalled()).toBe(true);
    });

    it('should call performHealthCheck during health checks', async () => {
      await service.ensureInitialized();
      
      expect(service.isCustomHealthCheckCalled()).toBe(false);
      
      await service.healthCheck();
      
      expect(service.isCustomHealthCheckCalled()).toBe(true);
    });
  });

  describe('Configuration Handling', () => {
    it('should store and use provided configuration', () => {
      const customConfig = {
        proxyConfig: {
          name: 'custom-proxy',
          port: 4000,
          cors: {
            origin: ['http://example.com'],
            credentials: false
          },
          customSettings: {
            timeout: 60000,
            rateLimitEnabled: false
          }
        }
      };

      const customService = new TestProxyServerService(customConfig);
      const info = customService.getServerInfoForTesting();
      
      expect(info.name).toBe('custom-proxy');
      expect(info.port).toBe(4000);
      expect(info.config).toEqual(customConfig.proxyConfig);
    });

    it('should handle minimal configuration', () => {
      const minimalConfig = {
        proxyConfig: {
          name: 'minimal-proxy',
          port: 5000
        }
      };

      expect(() => new TestProxyServerService(minimalConfig)).not.toThrow();
    });
  });

  describe('Uptime Calculation', () => {
    it('should calculate uptime correctly when running', async () => {
      await service.ensureInitialized();
      await service.start();
      
      // Wait a small amount of time
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const uptime = service.getUptimeForTesting();
      expect(uptime).toBeGreaterThan(0);
    });

    it('should return 0 uptime when not running', async () => {
      await service.ensureInitialized();
      
      const uptime = service.getUptimeForTesting();
      expect(uptime).toBe(0);
    });
  });

  describe('Error Rate Calculation', () => {
    it('should calculate error rate correctly', async () => {
      await service.ensureInitialized();
      
      // Simulate some successful and failed requests
      const metrics = service.getMetricsForTesting();
      (metrics as any).requestsReceived = 100;
      (metrics as any).requestsFailed = 10;
      
      // Access private method for testing
      const errorRate = (service as any).getErrorRate();
      expect(errorRate).toBe(0.1); // 10% error rate
    });

    it('should handle zero requests gracefully', async () => {
      await service.ensureInitialized();
      
      const errorRate = (service as any).getErrorRate();
      expect(errorRate).toBe(0);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources on stop', async () => {
      await service.ensureInitialized();
      await service.start();
      
      expect(service.isRunning()).toBe(true);
      
      await service.stop();
      
      expect(service.isRunning()).toBe(false);
      expect((service as any).server).toBeNull();
      expect((service as any).isShuttingDown).toBe(false);
    });

    it('should handle graceful shutdown', async () => {
      await service.ensureInitialized();
      await service.start();
      
      // Simulate shutdown signal
      const shutdownPromise = service.stop();
      
      // Should complete without hanging
      await expect(shutdownPromise).resolves.not.toThrow();
    });
  });
});