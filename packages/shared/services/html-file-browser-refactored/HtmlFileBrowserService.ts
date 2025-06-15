/**
 * HTML File Browser Service - Refactored
 * 
 * Service for providing file browsing capabilities with security controls
 * Refactored to extend BusinessService with proper dependency injection
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BusinessService } from '../base-classes/BusinessService';

export interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  mtime: Date | null;
  path: string;
}

export interface SearchOptions {
  searchPath?: string;
  maxResults?: number;
  excludeDirs?: string[];
}

interface HtmlFileBrowserConfig {
  basePath?: string;
  excludeDirs?: string[];
  maxFileSize?: number;
}

interface HtmlFileBrowserMetrics {
  totalRequests: number;
  directoryLists: number;
  fileReads: number;
  searchOperations: number;
  errors: number;
  lastRequestTime?: Date;
}

export class HtmlFileBrowserService extends BusinessService {
  private basePath: string;
  private excludedDirs: Set<string>;
  private maxFileSize: number;
  private metrics: HtmlFileBrowserMetrics = {
    totalRequests: 0,
    directoryLists: 0,
    fileReads: 0,
    searchOperations: 0,
    errors: 0
  };

  constructor(config: HtmlFileBrowserConfig = {}, logger?: any) {
    super('HtmlFileBrowserService', logger);
    
    this.basePath = path.resolve(config.basePath || process.cwd());
    this.excludedDirs = new Set(config.excludeDirs || ['node_modules', '.git', '.next', 'dist', 'build']);
    this.maxFileSize = config.maxFileSize || 10 * 1024 * 1024; // 10MB default
  }

  protected async initialize(): Promise<void> {
    this.logger?.info('HtmlFileBrowserService initializing...');
    
    try {
      await fs.access(this.basePath);
      this.logger?.info(`HtmlFileBrowserService initialized with base path: ${this.basePath}`);
    } catch (error) {
      this.logger?.error('Failed to access base path:', error);
      throw new Error(`Cannot access base path: ${this.basePath}`);
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger?.info('HtmlFileBrowserService cleanup completed');
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    let healthy = true;
    const details: any = {
      metrics: { ...this.metrics },
      basePath: this.basePath,
      excludedDirs: Array.from(this.excludedDirs),
      basePathAccess: 'unknown'
    };

    try {
      await fs.access(this.basePath);
      details.basePathAccess = 'accessible';
    } catch (error) {
      healthy = false;
      details.basePathAccess = 'error';
      details.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return { healthy, details, timestamp: new Date() };
  }

  configure(options: { basePath?: string; excludeDirs?: string[] }): void {
    if (options.basePath) {
      this.basePath = path.resolve(options.basePath);
    }
    if (options.excludeDirs) {
      this.excludedDirs = new Set(options.excludeDirs);
    }
    this.logger?.info('Service reconfigured');
  }

  getBasePath(): string {
    return this.basePath;
  }

  private validatePath(requestedPath: string): string {
    const fullPath = path.join(this.basePath, requestedPath);
    
    if (!fullPath.startsWith(this.basePath)) {
      throw new Error('Access denied: Path outside of base directory');
    }
    
    return fullPath;
  }

  async listDirectory(dirPath: string = ''): Promise<FileItem[]> {
    this.metrics.totalRequests++;
    this.metrics.directoryLists++;
    this.metrics.lastRequestTime = new Date();

    try {
      const fullPath = this.validatePath(dirPath);
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      
      const result = await Promise.all(
        items
          .filter(item => !this.excludedDirs.has(item.name))
          .map(async (item) => {
            try {
              const itemPath = path.join(fullPath, item.name);
              const stats = await fs.stat(itemPath);
              
              return {
                name: item.name,
                type: item.isDirectory() ? 'directory' as const : 'file' as const,
                size: stats.size,
                mtime: stats.mtime,
                path: path.relative(this.basePath, itemPath)
              };
            } catch (error) {
              this.logger?.warn(`Error getting stats for ${item.name}:`, error);
              return null;
            }
          })
      );

      return result.filter(item => item !== null) as FileItem[];
    } catch (error) {
      this.metrics.errors++;
      this.logger?.error('Error listing directory:', error);
      throw error;
    }
  }

  getMetrics(): HtmlFileBrowserMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      directoryLists: 0,
      fileReads: 0,
      searchOperations: 0,
      errors: 0
    };
  }
}

export default HtmlFileBrowserService;