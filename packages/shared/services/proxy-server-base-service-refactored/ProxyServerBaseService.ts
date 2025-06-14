/**
 * Proxy Server Base Service (Refactored)
 * 
 * Base class for all proxy servers providing common functionality.
 * Refactored from standalone class to SingletonService with proper lifecycle management.
 */

import * as express from 'express';
import { Express, Request, Response, NextFunction } from 'express';
// @ts-ignore - CORS types not needed for base class
import * as cors from 'cors';
import { createServer, Server } from 'http';
import { SingletonService } from '../base-classes/SingletonService';
import { Logger } from '../base-classes/BaseService';
import { 
  ProxyServerConfig, 
  ProxyServerInfo, 
  HealthCheckResult,
  ProxyServerBaseMetrics,
  ProxyServerBaseServiceConfig 
} from './types';

export abstract class ProxyServerBaseService extends SingletonService {
  protected app: Express;
  protected server: Server | null = null;
  protected port: number;
  protected name: string;
  protected startTime: Date | null = null;
  protected isShuttingDown: boolean = false;
  protected config: ProxyServerConfig;

  private metrics: ProxyServerBaseMetrics = {
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
  };

  private responseTimeHistory: number[] = [];
  private readonly maxHistoryLength = 100;

  constructor(
    config: ProxyServerBaseServiceConfig,
    logger?: Logger
  ) {
    super('ProxyServerBase', logger);
    this.config = config.proxyConfig;
    this.name = this.config.name;
    this.port = this.config.port;
    
    this.app = express();
    
    // Apply common middleware
    this.setupCommonMiddleware();
    
    // Setup common routes
    this.setupCommonRoutes();
  }

  protected validateConfig(): void {
    if (!this.config.name) {
      throw new Error('ProxyServerConfig.name is required');
    }
    if (!this.config.port || this.config.port < 1000 || this.config.port > 65535) {
      throw new Error('ProxyServerConfig.port must be between 1000 and 65535');
    }
  }

  protected async initialize(): Promise<void> {
    this.validateConfig();
    
    // Setup routes (subclass implementation)
    this.setupRoutes();
    
    // Error handling
    this.setupErrorHandling();
    
    this.logger?.info('ProxyServerBaseService initialized', {
      name: this.name,
      port: this.port
    });
  }

  async healthCheck(): Promise<{ 
    healthy: boolean; 
    details: Record<string, any>; 
    timestamp: Date; 
    latencyMs?: number 
  }> {
    const startTime = Date.now();
    this.metrics.healthCheckCount++;
    
    const checks = {
      serverRunning: this.isRunning(),
      port: this.port,
      uptime: this.getUptime(),
      requestsReceived: this.metrics.requestsReceived,
      averageResponseTime: this.metrics.averageResponseTime,
      errorRate: this.getErrorRate(),
      activeConnections: this.metrics.activeConnections
    };

    try {
      // Perform custom health check
      const customHealth = await this.performHealthCheck();
      
      const healthy = checks.serverRunning && customHealth.healthy;
      
      if (!healthy) {
        this.metrics.healthCheckFailures++;
      }

      const latencyMs = Date.now() - startTime;

      return {
        healthy,
        details: { 
          ...checks, 
          customHealth: customHealth.details,
          metrics: this.metrics 
        },
        timestamp: new Date(),
        latencyMs
      };

    } catch (error) {
      this.metrics.healthCheckFailures++;
      this.metrics.errors++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error('Health check failed', { error: errorMessage });

      return {
        healthy: false,
        details: { 
          ...checks, 
          error: errorMessage,
          metrics: this.metrics 
        },
        timestamp: new Date(),
        latencyMs: Date.now() - startTime
      };
    }
  }

  protected async cleanup(): Promise<void> {
    if (this.isRunning()) {
      await this.stop();
    }
    this.logger?.info('ProxyServerBaseService cleaned up');
  }

  getMetrics(): ProxyServerBaseMetrics {
    return { 
      ...this.metrics,
      uptimeSeconds: this.getUptime()
    };
  }

  /**
   * Abstract methods that subclasses must implement
   */
  protected abstract setupRoutes(): void;
  protected abstract getServiceDescription(): string;
  
  /**
   * Optional methods that subclasses can override
   */
  protected async onStart(): Promise<void> {
    // Override in subclass if needed
  }
  
  protected async onStop(): Promise<void> {
    // Override in subclass if needed
  }
  
  protected async performHealthCheck(): Promise<HealthCheckResult> {
    // Override in subclass for custom health checks
    return {
      healthy: true,
      details: {}
    };
  }

  /**
   * Common middleware setup
   */
  private setupCommonMiddleware(): void {
    // CORS for all origins (since these are local dev servers)
    this.app.use(cors());
    
    // JSON body parsing
    this.app.use(express.json());
    
    // Connection tracking
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.metrics.activeConnections++;
      this.metrics.peakConnections = Math.max(this.metrics.peakConnections, this.metrics.activeConnections);
      
      res.on('finish', () => {
        this.metrics.activeConnections--;
      });
      
      next();
    });
    
    // Request logging and metrics
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      this.metrics.requestsReceived++;
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.updateResponseTimeMetrics(duration);
        
        if (res.statusCode >= 400) {
          this.metrics.requestsFailed++;
          this.metrics.errors++;
        } else {
          this.metrics.requestsCompleted++;
        }
        
        this.logger?.debug('Request completed', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration
        });
      });
      
      next();
    });
  }

  /**
   * Common routes available on all proxy servers
   */
  private setupCommonRoutes(): void {
    // Root endpoint - server info
    this.app.get('/', (req: Request, res: Response) => {
      res.json(this.getServerInfo());
    });
    
    // Health check endpoint
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const health = await this.healthCheck();
        const status = health.healthy ? 200 : 503;
        
        res.status(status).json({
          name: this.name,
          status: health.healthy ? 'healthy' : 'unhealthy',
          uptime: this.getUptime(),
          port: this.port,
          timestamp: health.timestamp,
          latency: health.latencyMs,
          ...health.details
        });
      } catch (error) {
        res.status(503).json({
          name: this.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // Server info endpoint
    this.app.get('/info', (req: Request, res: Response) => {
      res.json(this.getServerInfo());
    });

    // Metrics endpoint
    this.app.get('/metrics', (req: Request, res: Response) => {
      res.json(this.getMetrics());
    });
    
    // Shutdown endpoint (for proxy manager)
    this.app.post('/shutdown', async (req: Request, res: Response) => {
      res.json({ message: 'Shutting down...' });
      setTimeout(() => this.stop(), 100);
    });
  }

  /**
   * Error handling middleware
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
        method: req.method,
        server: this.name
      });
    });
    
    // General error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.metrics.errors++;
      this.logger?.error('Unhandled error', { 
        error: err.message,
        path: req.path,
        method: req.method
      });
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred',
        server: this.name
      });
    });
  }

  /**
   * Start the proxy server
   */
  async start(): Promise<void> {
    await this.ensureInitialized();
    
    if (this.server) {
      this.logger?.info('Server already running', { name: this.name, port: this.port });
      return;
    }

    try {
      // Call subclass startup hook
      await this.onStart();
      
      // Create and start server
      this.server = createServer(this.app);
      
      await new Promise<void>((resolve, reject) => {
        this.server!.listen(this.port, () => {
          this.startTime = new Date();
          this.metrics.startCount++;
          
          this.logger?.info('Proxy server started', {
            name: this.name,
            description: this.getServiceDescription(),
            port: this.port,
            url: `http://localhost:${this.port}`,
            startTime: this.startTime.toISOString()
          });
          
          resolve();
        });
        
        this.server!.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            reject(new Error(`Port ${this.port} is already in use`));
          } else {
            reject(error);
          }
        });
      });
      
      // Handle graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      this.metrics.errors++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error('Failed to start proxy server', { 
        name: this.name, 
        error: errorMessage 
      });
      throw error;
    }
  }

  /**
   * Stop the proxy server
   */
  async stop(): Promise<void> {
    if (!this.server || this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger?.info('Shutting down proxy server', { name: this.name });

    try {
      // Call subclass cleanup hook
      await this.onStop();
      
      // Close server
      await new Promise<void>((resolve, reject) => {
        this.server!.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      this.server = null;
      this.startTime = null;
      this.isShuttingDown = false;
      this.metrics.stopCount++;
      
      this.logger?.info('Proxy server stopped successfully', { name: this.name });
      
    } catch (error) {
      this.metrics.errors++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error('Error during proxy server shutdown', { 
        name: this.name, 
        error: errorMessage 
      });
      throw error;
    }
  }

  /**
   * Restart the proxy server
   */
  async restart(): Promise<void> {
    this.logger?.info('Restarting proxy server', { name: this.name });
    
    if (this.isRunning()) {
      await this.stop();
    }
    
    await this.start();
    this.metrics.restartCount++;
    
    this.logger?.info('Proxy server restarted successfully', { name: this.name });
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger?.info('Received shutdown signal', { name: this.name, signal });
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Get server information
   */
  getServerInfo(): ProxyServerInfo {
    return {
      name: this.name,
      description: this.getServiceDescription(),
      port: this.port,
      status: this.server ? 'running' : 'stopped',
      uptime: this.getUptime(),
      startTime: this.startTime?.toISOString() || null,
      endpoints: this.getEndpoints()
    };
  }

  /**
   * Get server uptime in seconds
   */
  private getUptime(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Get list of available endpoints
   */
  private getEndpoints(): string[] {
    const endpoints: string[] = [];
    
    try {
      // Extract routes from Express app
      this.app._router?.stack?.forEach((middleware: any) => {
        if (middleware.route) {
          const path = middleware.route.path;
          const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
          endpoints.push(`${methods} ${path}`);
        }
      });
    } catch (error) {
      this.logger?.warn('Failed to extract endpoints', { error: error instanceof Error ? error.message : String(error) });
    }
    
    return endpoints;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null && !this.isShuttingDown;
  }

  /**
   * Get the port number
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get the server name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Update response time metrics
   */
  private updateResponseTimeMetrics(duration: number): void {
    this.responseTimeHistory.push(duration);
    
    // Keep only recent history
    if (this.responseTimeHistory.length > this.maxHistoryLength) {
      this.responseTimeHistory.shift();
    }
    
    // Update total and average
    this.metrics.totalResponseTime += duration;
    this.metrics.averageResponseTime = 
      this.responseTimeHistory.reduce((sum, time) => sum + time, 0) / this.responseTimeHistory.length;
  }

  /**
   * Calculate error rate
   */
  private getErrorRate(): number {
    const totalRequests = this.metrics.requestsCompleted + this.metrics.requestsFailed;
    return totalRequests > 0 ? (this.metrics.requestsFailed / totalRequests) * 100 : 0;
  }
}