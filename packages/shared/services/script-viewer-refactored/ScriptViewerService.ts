/**
 * Script Viewer Service - Refactored
 * 
 * Service for viewing, archiving, and deleting script files
 * Refactored to extend BusinessService with proper patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import { BusinessService } from '../base-classes/BusinessService';

export interface ScriptFile {
  file_path: string;
  title: string;
  content: string;
  size: number;
  created_at: Date;
  updated_at: Date;
}

export interface ScriptListResult {
  total: number;
  files: string[];
}

interface ScriptViewerConfig {
  projectRoot?: string;
  archivedFolder?: string;
  allowedExtensions?: string[];
}

interface ScriptViewerMetrics {
  totalViews: number;
  totalArchives: number;
  totalDeletes: number;
  errors: number;
  lastOperationTime?: Date;
}

export class ScriptViewerService extends BusinessService {
  private projectRoot: string;
  private archivedFolder: string;
  private allowedExtensions: string[];
  private metrics: ScriptViewerMetrics = {
    totalViews: 0,
    totalArchives: 0,
    totalDeletes: 0,
    errors: 0
  };

  constructor(config: ScriptViewerConfig = {}, logger?: any) {
    super('ScriptViewerService', logger);
    
    this.projectRoot = path.resolve(config.projectRoot || process.cwd());
    this.archivedFolder = config.archivedFolder || '.archived_scripts';
    this.allowedExtensions = config.allowedExtensions || ['.sh', '.js', '.ts', '.py'];
  }

  protected async initialize(): Promise<void> {
    this.logger?.info('ScriptViewerService initializing...');
    
    try {
      await fs.promises.access(this.projectRoot);
      this.logger?.info(`ScriptViewerService initialized with root: ${this.projectRoot}`);
    } catch (error) {
      this.logger?.error('Failed to access project root:', error);
      throw new Error(`Cannot access project root: ${this.projectRoot}`);
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger?.info('ScriptViewerService cleanup completed');
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

  private validateExtension(filePath: string): boolean {
    return this.allowedExtensions.some(ext => filePath.endsWith(ext));
  }

  async viewScriptFile(filePath: string): Promise<ScriptFile | null> {
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
      this.logger?.error('Error viewing script file:', error);
      return null;
    }
  }

  getMetrics(): ScriptViewerMetrics {
    return { ...this.metrics };
  }
}

export default ScriptViewerService;