import express, { Express, Request, Response, NextFunction } from 'express';
// @ts-ignore - CORS types not needed for base class
import cors from 'cors';
import { createServer, Server } from 'http';
import { ProxyServerConfig, ProxyServerInfo, HealthCheckResult } from '../types';

/**
 * Base class for all proxy servers in the monorepo
 * Provides common functionality like health checks, graceful shutdown, etc.
 */
export abstract class ProxyServerBase {
  protected app: Express;
  protected server: Server | null = null;
  protected port: number;
  protected name: string;
  protected startTime: Date | null = null;
  protected isShuttingDown: boolean = false;
  protected config: ProxyServerConfig;

  constructor(config: ProxyServerConfig) {
    this.config = config;
    this.name = config.name;
    this.port = config.port;
    this.app = express();
    
    this.setupMiddleware();
    this.setupBaseRoutes();
    this.setupRoutes();
  }

  /**
   * Get the service description for this proxy
   */
  protected abstract getServiceDescription(): string;

  /**
   * Setup custom routes for this proxy
   */
  protected abstract setupRoutes(): void;

  /**
   * Setup common middleware
   */
  private setupMiddleware(): void {
    // CORS for local development
    this.app.use(cors());
    
    // JSON parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[${this.name}] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup base routes common to all proxies
   */
  private setupBaseRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      const health = this.performHealthCheck();
      res.status(health.healthy ? 200 : 503).json(health);
    });

    // Server info
    this.app.get('/info', (_req: Request, res: Response) => {
      res.json(this.getInfo());
    });

    // Root endpoint
    this.app.get('/', (_req: Request, res: Response) => {
      res.json({
        service: this.name,
        description: this.getServiceDescription(),
        version: '1.0.0',
        uptime: this.getUptime(),
        endpoints: this.getEndpoints()
      });
    });
  }

  /**
   * Start the proxy server
   */
  public async start(): Promise<void> {
    if (this.server) {
      console.log(`[${this.name}] Server already running on port ${this.port}`);
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app);
        
        this.server.listen(this.port, () => {
          this.startTime = new Date();
          console.log(`[${this.name}] Server started on http://localhost:${this.port}`);
          this.onStart();
          resolve();
        });

        this.server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            console.error(`[${this.name}] Port ${this.port} is already in use`);
          } else {
            console.error(`[${this.name}] Server error:`, error);
          }
          reject(error);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => this.stop());
        process.on('SIGINT', () => this.stop());
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the proxy server
   */
  public async stop(): Promise<void> {
    if (!this.server || this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log(`[${this.name}] Shutting down server...`);

    return new Promise((resolve) => {
      this.server!.close(() => {
        console.log(`[${this.name}] Server stopped`);
        this.onStop();
        this.server = null;
        this.isShuttingDown = false;
        resolve();
      });
    });
  }

  /**
   * Restart the server
   */
  public async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * Get server information
   */
  public getInfo(): ProxyServerInfo {
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
   * Perform health check
   */
  protected performHealthCheck(): HealthCheckResult {
    return {
      healthy: true,
      details: {
        service: this.name,
        uptime: this.getUptime(),
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Get server uptime in seconds
   */
  protected getUptime(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Get list of available endpoints
   */
  protected getEndpoints(): string[] {
    const endpoints: string[] = [
      'GET /',
      'GET /health',
      'GET /info'
    ];
    
    // Override this in subclasses to add custom endpoints
    return endpoints;
  }

  /**
   * Hook called when server starts
   */
  protected onStart(): void {
    // Override in subclasses if needed
  }

  /**
   * Hook called when server stops
   */
  protected onStop(): void {
    // Override in subclasses if needed
  }
}