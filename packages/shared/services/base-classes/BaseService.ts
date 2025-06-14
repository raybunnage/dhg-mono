/**
 * Abstract base class for all services in the application
 * Provides common functionality and enforces consistent patterns
 */

export interface ServiceMetadata {
  name: string;
  initialized: boolean;
  type: string;
  version?: string;
  dependencies?: string[];
}

export interface HealthCheckResult {
  healthy: boolean;
  details?: Record<string, any>;
  timestamp: Date;
  latencyMs?: number;
}

export interface Logger {
  info(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
}

export abstract class BaseService {
  protected readonly serviceName: string;
  protected readonly logger?: Logger;
  protected initialized: boolean = false;
  private initializationPromise?: Promise<void>;

  constructor(serviceName: string, logger?: Logger) {
    this.serviceName = serviceName;
    this.logger = logger;
    this.logger?.debug(`Initializing ${serviceName}`);
  }

  /**
   * Initialize the service. Called automatically on first use.
   * Subclasses must implement initialization logic.
   */
  protected abstract initialize(): Promise<void>;

  /**
   * Clean up resources used by the service
   */
  protected abstract cleanup(): Promise<void>;

  /**
   * Check the health of the service
   */
  abstract healthCheck(): Promise<HealthCheckResult>;

  /**
   * Ensure service is initialized before use
   */
  protected async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this.performInitialization();
    await this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    const startTime = Date.now();
    try {
      this.logger?.info(`Starting initialization of ${this.serviceName}`);
      await this.initialize();
      this.initialized = true;
      const duration = Date.now() - startTime;
      this.logger?.info(`${this.serviceName} initialized successfully in ${duration}ms`);
    } catch (error) {
      this.logger?.error(`Failed to initialize ${this.serviceName}:`, error);
      throw error;
    } finally {
      this.initializationPromise = undefined;
    }
  }

  /**
   * Get metadata about this service
   */
  getMetadata(): ServiceMetadata {
    return {
      name: this.serviceName,
      initialized: this.initialized,
      type: this.constructor.name,
      version: '1.0.0'
    };
  }

  /**
   * Perform a graceful shutdown of the service
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    const startTime = Date.now();
    try {
      this.logger?.info(`Starting shutdown of ${this.serviceName}`);
      await this.cleanup();
      this.initialized = false;
      const duration = Date.now() - startTime;
      this.logger?.info(`${this.serviceName} shut down successfully in ${duration}ms`);
    } catch (error) {
      this.logger?.error(`Error during shutdown of ${this.serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Helper for timing operations
   */
  protected async timeOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.logger?.debug(`${this.serviceName}.${operationName} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger?.error(`${this.serviceName}.${operationName} failed after ${duration}ms:`, error);
      throw error;
    }
  }
}