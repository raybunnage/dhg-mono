/**
 * Base class for business logic services using dependency injection
 * Supports transactions, validation, and easy testing
 */

import { BaseService, Logger } from './BaseService';

export interface ServiceDependencies {
  [key: string]: any;
}

export interface TransactionContext {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export abstract class BusinessService extends BaseService {
  protected readonly dependencies: ServiceDependencies;

  constructor(
    serviceName: string,
    dependencies: ServiceDependencies,
    logger?: Logger
  ) {
    super(serviceName, logger);
    this.dependencies = dependencies;
    
    // Validate dependencies immediately
    try {
      this.validateDependencies();
    } catch (error) {
      this.logger?.error(`Dependency validation failed for ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Validate that all required dependencies are provided
   * Subclasses must implement this to check their specific dependencies
   */
  protected abstract validateDependencies(): void;

  /**
   * Execute an operation within a transaction context
   * Provides automatic rollback on failure
   */
  protected async withTransaction<T>(
    operation: (context?: TransactionContext) => Promise<T>
  ): Promise<T> {
    // Default implementation without real transaction
    // Subclasses can override for database-specific transactions
    try {
      const result = await operation();
      return result;
    } catch (error) {
      this.logger?.error(`Transaction failed in ${this.serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Execute an operation with retry logic
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      delayMs?: number;
      backoffMultiplier?: number;
      shouldRetry?: (error: any) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      delayMs = 1000,
      backoffMultiplier = 2,
      shouldRetry = () => true
    } = options;

    let lastError: any;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts || !shouldRetry(error)) {
          throw error;
        }
        
        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        this.logger?.warn(
          `${this.serviceName}: Attempt ${attempt} failed, retrying in ${delay}ms...`,
          error
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Validate input data using a schema or custom validation
   */
  protected validateInput<T>(
    data: any,
    validator: (data: any) => T | never
  ): T {
    try {
      return validator(data);
    } catch (error) {
      this.logger?.error(`Input validation failed in ${this.serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Get a dependency with type safety
   */
  protected getDependency<T>(key: string): T {
    const dependency = this.dependencies[key];
    if (!dependency) {
      throw new Error(`Missing dependency '${key}' in ${this.serviceName}`);
    }
    return dependency as T;
  }

  /**
   * Check if a dependency exists
   */
  protected hasDependency(key: string): boolean {
    return key in this.dependencies && this.dependencies[key] !== undefined;
  }

  /**
   * Default cleanup implementation for business services
   */
  protected async cleanup(): Promise<void> {
    // Most business services don't need cleanup
    // Override if needed
  }
}