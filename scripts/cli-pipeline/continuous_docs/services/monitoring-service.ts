import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { glob } from 'glob';

interface MonitoredDocument {
  id: string;
  file_path: string;
  doc_type: string;
  last_checked: string;
  last_modified: string;
  content_hash: string;
  dependencies: string[];
  check_frequency_hours: number;
  auto_update_enabled: boolean;
  status: 'active' | 'paused' | 'error';
  metadata: any;
}

interface UpdateCheck {
  documentId: string;
  filePath: string;
  hasChanges: boolean;
  changeType: 'content' | 'dependencies' | 'none';
  currentHash: string;
  storedHash: string;
  dependencies: string[];
}

export class DocumentMonitoringService {
  private supabase;

  constructor() {
    this.supabase = SupabaseClientService.getInstance().getClient();
  }

  /**
   * Get file content hash
   */
  private getFileHash(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return createHash('md5').update(content).digest('hex');
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Check if a document has been updated
   */
  async checkForUpdates(doc: MonitoredDocument): Promise<UpdateCheck> {
    const currentHash = this.getFileHash(doc.file_path);
    const dependencies = await this.checkDependencies(doc.file_path, doc.dependencies);
    
    let hasChanges = false;
    let changeType: 'content' | 'dependencies' | 'none' = 'none';

    if (currentHash !== doc.content_hash) {
      hasChanges = true;
      changeType = 'content';
    } else if (dependencies.some(dep => !doc.dependencies.includes(dep)) || 
               doc.dependencies.some(dep => !dependencies.includes(dep))) {
      hasChanges = true;
      changeType = 'dependencies';
    }

    return {
      documentId: doc.id,
      filePath: doc.file_path,
      hasChanges,
      changeType,
      currentHash,
      storedHash: doc.content_hash,
      dependencies
    };
  }

  /**
   * Check dependencies for a document
   */
  private async checkDependencies(filePath: string, currentDeps: string[]): Promise<string[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const dependencies: string[] = [];

    // Check for imports/references to other docs
    const importMatches = content.matchAll(/(?:import|include|reference).*?['"]([^'"]+\.md)['"]|!!include\(([^)]+\.md)\)|See:\s*\[.*?\]\(([^)]+\.md)\)/g);
    for (const match of importMatches) {
      const dep = match[1] || match[2] || match[3];
      if (dep && fs.existsSync(path.resolve(path.dirname(filePath), dep))) {
        dependencies.push(dep);
      }
    }

    // Check for references to code files
    const codeRefs = content.matchAll(/(?:```|`)([^`\n]+\.[tj]sx?)(?:```|`)|from\s+['"]([^'"]+\.[tj]sx?)['"]|require\(['"]([^'"]+\.[tj]sx?)['"]\)/g);
    for (const match of codeRefs) {
      const codeFile = match[1] || match[2] || match[3];
      if (codeFile && fs.existsSync(path.resolve(path.dirname(filePath), codeFile))) {
        dependencies.push(codeFile);
      }
    }

    return [...new Set(dependencies)];
  }

  /**
   * Get all documents that need checking
   */
  async getDocumentsToCheck(): Promise<MonitoredDocument[]> {
    const { data, error } = await this.supabase
      .from('doc_continuous_monitoring')
      .select('*')
      .eq('status', 'active')
      .or(`last_checked.is.null,last_checked.lt.${new Date(Date.now() - 3600000).toISOString()}`);

    if (error) {
      console.error('Error fetching documents:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Update document monitoring record
   */
  async updateMonitoringRecord(documentId: string, updates: Partial<MonitoredDocument>) {
    const { error } = await this.supabase
      .from('doc_continuous_monitoring')
      .update({
        ...updates,
        last_checked: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (error) {
      console.error('Error updating monitoring record:', error);
      throw error;
    }
  }

  /**
   * Add new document to monitoring
   */
  async addDocumentToMonitoring(filePath: string, options: {
    docType: string;
    checkFrequencyHours?: number;
    autoUpdateEnabled?: boolean;
    metadata?: any;
  }) {
    const absolutePath = path.resolve(filePath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const contentHash = this.getFileHash(absolutePath);
    const dependencies = await this.checkDependencies(absolutePath, []);

    const { data, error } = await this.supabase
      .from('doc_continuous_monitoring')
      .insert({
        file_path: absolutePath,
        doc_type: options.docType,
        content_hash: contentHash,
        dependencies,
        check_frequency_hours: options.checkFrequencyHours || 24,
        auto_update_enabled: options.autoUpdateEnabled || false,
        status: 'active',
        metadata: options.metadata || {},
        last_modified: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding document to monitoring:', error);
      throw error;
    }

    return data;
  }

  /**
   * Remove document from monitoring
   */
  async removeDocumentFromMonitoring(documentId: string) {
    const { error } = await this.supabase
      .from('doc_continuous_monitoring')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (error) {
      console.error('Error removing document:', error);
      throw error;
    }
  }

  /**
   * Get monitoring statistics
   */
  async getMonitoringStats() {
    const { data, error } = await this.supabase
      .from('doc_continuous_monitoring')
      .select('status, doc_type');

    if (error) {
      console.error('Error fetching stats:', error);
      return null;
    }

    const stats = {
      total: data?.length || 0,
      active: data?.filter(d => d.status === 'active').length || 0,
      paused: data?.filter(d => d.status === 'paused').length || 0,
      error: data?.filter(d => d.status === 'error').length || 0,
      byType: {} as Record<string, number>
    };

    data?.forEach(doc => {
      stats.byType[doc.doc_type] = (stats.byType[doc.doc_type] || 0) + 1;
    });

    return stats;
  }
}