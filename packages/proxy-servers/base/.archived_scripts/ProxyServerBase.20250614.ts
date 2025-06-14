import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer, Server } from 'http';
import { ProxyServerConfig, ProxyServerInfo, HealthCheckResult } from '../types';

/**
 * Base class for all proxy servers
 * Provides common functionality and enforces consistent patterns
 */
export abstract class ProxyServerBase {
  protected app: Express;
  protected server: Server | null = null;
  protected port: number;
  protected name: string;
  protected startTime: Date | null = null;
  protected isShuttingDown: boolean = false;

  constructor(config: ProxyServerConfig) {
    this.name = config.name;
    this.port = config.port;
    this.app = express();
    
    // Apply common middleware
    this.setupCommonMiddleware();
    
    // Setup common routes
    this.setupCommonRoutes();
    
    // Let subclass setup specific routes
    this.setupRoutes();
    
    // Error handling
    this.setupErrorHandling();
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
    
    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${this.name}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
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
        const health = await this.performHealthCheck();
        const status = health.healthy ? 200 : 503;
        
        res.status(status).json({
          name: this.name,
          status: health.healthy ? 'healthy' : 'unhealthy',
          uptime: this.getUptime(),
          port: this.port,
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
        method: req.method
      });
    });
    
    // General error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error(`[${this.name}] Error:`, err);
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred'
      });
    });
  }

  /**
   * Start the proxy server
   */
  async start(): Promise<void> {
    if (this.server) {
      console.log(`[${this.name}] Already running on port ${this.port}`);
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
          console.log(`
🚀 ${this.name}
   ${this.getServiceDescription()}
   Running at: http://localhost:${this.port}
   Started at: ${this.startTime.toLocaleString()}
          `);
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
      console.error(`[${this.name}] Failed to start:`, error);
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
    console.log(`[${this.name}] Shutting down...`);

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
      
      console.log(`[${this.name}] Stopped successfully`);
      
    } catch (error) {
      console.error(`[${this.name}] Error during shutdown:`, error);
      throw error;
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`[${this.name}] Received ${signal}, shutting down gracefully...`);
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
    
    // Extract routes from Express app
    this.app._router.stack.forEach((middleware: any) => {
      if (middleware.route) {
        const path = middleware.route.path;
        const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
        endpoints.push(`${methods} ${path}`);
      }
    });
    
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
}