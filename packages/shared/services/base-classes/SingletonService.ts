/**
 * Base class for singleton services that manage expensive resources
 * Examples: Database connections, API clients, loggers
 */

import { BaseService, Logger } from './BaseService';

export abstract class SingletonService extends BaseService {
  private static instances: Map<string, SingletonService> = new Map();
  private static shuttingDown: boolean = false;

  protected constructor(serviceName: string, logger?: Logger) {
    super(serviceName, logger);
  }

  /**
   * Get or create a singleton instance of this service
   */
  protected static getSingletonInstance<T extends SingletonService>(
    serviceName: string,
    factory: () => T
  ): T {
    if (this.shuttingDown) {
      throw new Error(`Cannot create new instances during shutdown`);
    }

    if (!SingletonService.instances.has(serviceName)) {
      const instance = factory();
      SingletonService.instances.set(serviceName, instance);
    }
    
    return SingletonService.instances.get(serviceName) as T;
  }

  /**
   * Release resources managed by this service
   * Called during cleanup
   */
  protected abstract releaseResources(): Promise<void>;

  /**
   * Override cleanup to include resource release
   */
  protected async cleanup(): Promise<void> {
    await this.releaseResources();
  }

  /**
   * Clear a specific instance (useful for testing)
   */
  protected static clearInstance(serviceName: string): void {
    const instance = SingletonService.instances.get(serviceName);
    if (instance) {
      SingletonService.instances.delete(serviceName);
    }
  }

  /**
   * Shutdown all singleton services
   */
  static async shutdownAll(): Promise<void> {
    SingletonService.shuttingDown = true;
    
    const shutdownPromises: Promise<void>[] = [];
    
    for (const [name, instance] of SingletonService.instances) {
      console.log(`Shutting down singleton service: ${name}`);
      shutdownPromises.push(instance.shutdown());
    }
    
    await Promise.all(shutdownPromises);
    SingletonService.instances.clear();
    SingletonService.shuttingDown = false;
  }

  /**
   * Get all active singleton instances (useful for monitoring)
   */
  static getAllInstances(): Map<string, SingletonService> {
    return new Map(SingletonService.instances);
  }

  /**
   * Check if a service instance exists
   */
  static hasInstance(serviceName: string): boolean {
    return SingletonService.instances.has(serviceName);
  }
}