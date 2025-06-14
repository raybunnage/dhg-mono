/**
 * Base class for adapter services that integrate with external systems
 * Handles environment-specific configuration, retries, and error normalization
 */

import { BaseService, Logger } from './BaseService';

export interface AdapterConfig {
  [key: string]: any;
}

export interface RetryConfig {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

export abstract class AdapterService<TConfig extends AdapterConfig, TClient> extends BaseService {
  protected client?: TClient;
  protected config: TConfig;
  private defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    shouldRetry: (error) => {
      // Default: retry on network errors and 5xx status codes
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
      if (error.status >= 500 && error.status < 600) return true;
      return false;
    }
  };

  constructor(serviceName: string, config: TConfig, logger?: Logger) {
    super(serviceName, logger);
    this.config = config;
    
    // Validate configuration immediately
    try {
      this.validateConfig(config);
    } catch (error) {
      this.logger?.error(`Configuration validation failed for ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Create the client instance for this adapter
   */
  protected abstract createClient(config: TConfig): TClient | Promise<TClient>;

  /**
   * Validate the configuration
   */
  protected abstract validateConfig(config: TConfig): void;

  /**
   * Initialize the adapter
   */
  protected async initialize(): Promise<void> {
    this.logger?.debug(`Creating client for ${this.serviceName}`);
    const client = await this.createClient(this.config);
    this.client = client;
    this.initialized = true;
  }

  /**
   * Get the client, ensuring it's initialized
   */
  protected async getClient(): Promise<TClient> {
    await this.ensureInitialized();
    if (!this.client) {
      throw new Error(`Client not available for ${this.serviceName}`);
    }
    return this.client;
  }

  /**
   * Clean up the adapter
   */
  protected async cleanup(): Promise<void> {
    this.client = undefined;
    this.initialized = false;
  }

  /**
   * Execute an operation with retry logic
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    customConfig?: RetryConfig
  ): Promise<T> {
    const config = { ...this.defaultRetryConfig, ...customConfig };
    const {
      maxAttempts = 3,
      initialDelayMs = 1000,
      maxDelayMs = 30000,
      backoffMultiplier = 2,
      shouldRetry = () => true
    } = config;

    let lastError: any;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts || !shouldRetry(error)) {
          throw this.normalizeError(error);
        }
        
        const delay = Math.min(
          initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
          maxDelayMs
        );
        
        this.logger?.warn(
          `${this.serviceName}: Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`,
          error
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw this.normalizeError(lastError);
  }

  /**
   * Normalize errors from external services
   */
  protected normalizeError(error: any): Error {
    // Default implementation - subclasses can override
    if (error instanceof Error) {
      return error;
    }
    
    const normalizedError = new Error(
      error.message || error.msg || 'Unknown error from external service'
    );
    
    // Preserve useful properties
    if (error.code) (normalizedError as any).code = error.code;
    if (error.status) (normalizedError as any).status = error.status;
    if (error.statusCode) (normalizedError as any).statusCode = error.statusCode;
    
    return normalizedError;
  }

  /**
   * Transform request data before sending to external service
   */
  protected transformRequest(data: any): any {
    // Default: no transformation
    // Subclasses can override for service-specific transformations
    return data;
  }

  /**
   * Transform response data from external service
   */
  protected transformResponse(data: any): any {
    // Default: no transformation
    // Subclasses can override for service-specific transformations
    return data;
  }

  /**
   * Get environment-specific configuration value
   */
  protected getConfigValue<T>(key: keyof TConfig, defaultValue?: T): T {
    const value = this.config[key];
    if (value === undefined && defaultValue === undefined) {
      throw new Error(`Missing required configuration: ${String(key)}`);
    }
    return (value !== undefined ? value : defaultValue) as T;
  }
}