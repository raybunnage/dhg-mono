/**
 * Markdown Viewer Service - Refactored
 * 
 * Service for viewing, archiving, and deleting markdown files
 * Refactored to extend BusinessService with proper patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import { BusinessService } from '../base-classes/BusinessService';

export interface MarkdownFile {
  file_path: string;
  title: string;
  content: string;
  size: number;
  created_at: Date;
  updated_at: Date;
}

export interface MarkdownListResult {
  total: number;
  files: string[];
}

interface MarkdownViewerConfig {
  projectRoot?: string;
  archivedFolder?: string;
  allowedExtensions?: string[];
}

interface MarkdownViewerMetrics {
  totalViews: number;
  totalArchives: number;
  totalDeletes: number;
  errors: number;
  lastOperationTime?: Date;
}

export class MarkdownViewerService extends BusinessService {
  private projectRoot: string;
  private archivedFolder: string;
  private allowedExtensions: string[];
  private metrics: MarkdownViewerMetrics = {
    totalViews: 0,
    totalArchives: 0,
    totalDeletes: 0,
    errors: 0
  };

  constructor(config: MarkdownViewerConfig = {}, logger?: any) {
    super('MarkdownViewerService', logger);
    
    this.projectRoot = path.resolve(config.projectRoot || process.cwd());
    this.archivedFolder = config.archivedFolder || '.archive_docs';
    this.allowedExtensions = config.allowedExtensions || ['.md', '.mdx'];
  }

  protected async initialize(): Promise<void> {
    this.logger?.info('MarkdownViewerService initializing...');
    
    try {
      await fs.promises.access(this.projectRoot);
      this.logger?.info(`MarkdownViewerService initialized with root: ${this.projectRoot}`);
    } catch (error) {
      this.logger?.error('Failed to access project root:', error);
      throw new Error(`Cannot access project root: ${this.projectRoot}`);
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger?.info('MarkdownViewerService cleanup completed');
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    let healthy = true;
    const details: any = {
      metrics: { ...this.metrics },
      projectRoot: this.projectRoot,
      allowedExtensions: this.allowedExtensions,
      rootAccess: 'unknown'
    };

    try {
      await fs.promises.access(this.projectRoot);
      details.rootAccess = 'accessible';
    } catch (error) {
      healthy = false;
      details.rootAccess = 'error';
      details.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return { healthy, details, timestamp: new Date() };
  }

  configure(options: { projectRoot?: string }): void {
    if (options.projectRoot) {
      this.projectRoot = path.resolve(options.projectRoot);
    }
    this.logger?.info('Service reconfigured');
  }

  private validateExtension(filePath: string): boolean {
    return this.allowedExtensions.some(ext => filePath.endsWith(ext));
  }

  async viewMarkdownFile(filePath: string): Promise<MarkdownFile | null> {
    this.metrics.totalViews++;
    this.metrics.lastOperationTime = new Date();

    try {
      if (!this.validateExtension(filePath)) {
        throw new Error('Invalid file extension');
      }

      const fullPath = path.resolve(this.projectRoot, filePath);
      const stats = await fs.promises.stat(fullPath);
      const content = await fs.promises.readFile(fullPath, 'utf-8');

      return {
        file_path: filePath,
        title: path.basename(filePath, path.extname(filePath)),
        content,
        size: stats.size,
        created_at: stats.birthtime,
        updated_at: stats.mtime
      };
    } catch (error) {
      this.metrics.errors++;
      this.logger?.error('Error viewing markdown file:', error);
      return null;
    }
  }

  getMetrics(): MarkdownViewerMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      totalViews: 0,
      totalArchives: 0,
      totalDeletes: 0,
      errors: 0
    };
  }
}

export default MarkdownViewerService;