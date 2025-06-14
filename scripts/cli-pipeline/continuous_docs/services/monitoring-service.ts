import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

interface MonitoredDocument {
  id: string;
  file_path: string;
  title: string;
  area: string;
  description: string | null;
  review_frequency_days: number | null;
  next_review_date: string;
  last_updated: string | null;
  last_checked?: string | null;
  priority: string | null;
  status: string | null;
  owner: string | null;
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
    const storedHash = (doc.metadata as any)?.content_hash || '';
    const storedDeps = (doc.metadata as any)?.dependencies || [];
    const dependencies = await this.checkDependencies(doc.file_path, storedDeps);
    
    let hasChanges = false;
    let changeType: 'content' | 'dependencies' | 'none' = 'none';

    if (currentHash !== storedHash) {
      hasChanges = true;
      changeType = 'content';
    } else if (dependencies.some(dep => !storedDeps.includes(dep)) || 
               storedDeps.some(dep => !dependencies.includes(dep))) {
      hasChanges = true;
      changeType = 'dependencies';
    }

    return {
      documentId: doc.id,
      filePath: doc.file_path,
      hasChanges,
      changeType,
      currentHash,
      storedHash,
      dependencies
    };
  }

  /**
   * Check dependencies for a document
   */
  private async checkDependencies(filePath: string, _currentDeps: string[]): Promise<string[]> {
    try {
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
    } catch (error) {
      console.error(`Error checking dependencies for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Get all documents that need checking
   */
  async getDocumentsToCheck(): Promise<MonitoredDocument[]> {
    const { data, error } = await this.supabase
      .from('doc_continuous_monitoring')
      .select('*')
      .eq('status', 'active')
      .order('next_review_date', { ascending: true });

    if (error) {
      console.error('Error fetching documents:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get documents that need updating
   */
  async getDocumentsToUpdate(): Promise<MonitoredDocument[]> {
    const today = new Date();
    
    const { data, error } = await this.supabase
      .from('doc_continuous_monitoring')
      .select('*')
      .eq('status', 'active')
      .lte('next_review_date', today.toISOString())
      .order('priority', { ascending: false })
      .order('next_review_date', { ascending: true });

    if (error) {
      console.error('Error fetching documents to update:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Update document monitoring record
   */
  async updateMonitoringRecord(documentId: string, updates: any) {
    const { error } = await this.supabase
      .from('doc_continuous_monitoring')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (error) {
      console.error('Error updating monitoring record:', error);
      throw error;
    }
  }

  /**
   * Process document update
   */
  async processDocumentUpdate(doc: MonitoredDocument) {
    try {
      // Update the last_updated timestamp and calculate next review date
      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + (doc.review_frequency_days || 7));

      await this.updateMonitoringRecord(doc.id, {
        last_updated: new Date().toISOString(),
        last_checked: new Date().toISOString(),
        next_review_date: nextReviewDate.toISOString(),
        metadata: {
          ...(doc.metadata || {}),
          content_hash: this.getFileHash(doc.file_path),
          dependencies: await this.checkDependencies(doc.file_path, (doc.metadata as any)?.dependencies || [])
        }
      });

      // In a real implementation, this would:
      // 1. Load document template or current content
      // 2. Check for updates from various sources (code changes, database changes, etc.)
      // 3. Regenerate the document with updated information
      // 4. Save the updated document to disk
      // 5. Possibly commit changes to git
      
      console.log(`Document ${doc.title} processed successfully`);
    } catch (error) {
      console.error(`Error processing document ${doc.title}:`, error);
      throw error;
    }
  }

  /**
   * Add new document to monitoring
   */
  async addDocumentToMonitoring(filePath: string, options: {
    title: string;
    area: string;
    description?: string;
    reviewFrequencyDays?: number;
    priority?: string;
    owner?: string;
    metadata?: any;
  }) {
    const absolutePath = path.resolve(filePath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const contentHash = this.getFileHash(absolutePath);
    const dependencies = await this.checkDependencies(absolutePath, []);
    
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + (options.reviewFrequencyDays || 7));

    const { data, error } = await this.supabase
      .from('doc_continuous_monitoring')
      .insert({
        file_path: absolutePath,
        title: options.title,
        area: options.area,
        description: options.description,
        review_frequency_days: options.reviewFrequencyDays || 7,
        next_review_date: nextReviewDate.toISOString(),
        priority: options.priority || 'medium',
        status: 'active',
        owner: options.owner,
        metadata: {
          ...options.metadata,
          content_hash: contentHash,
          dependencies
        },
        last_updated: new Date().toISOString(),
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
        status: 'deprecated',
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
      .select('status, area, priority');

    if (error) {
      console.error('Error fetching stats:', error);
      return null;
    }

    const stats = {
      total: data?.length || 0,
      active: data?.filter((d: any) => d.status === 'active').length || 0,
      needsReview: 0,
      byArea: {} as Record<string, number>,
      byPriority: {} as Record<string, number>
    };

    // Count documents needing review
    const today = new Date();
    const { data: needsReviewData } = await this.supabase
      .from('doc_continuous_monitoring')
      .select('id')
      .eq('status', 'active')
      .lte('next_review_date', today.toISOString());
    
    stats.needsReview = needsReviewData?.length || 0;

    data?.forEach((doc: any) => {
      stats.byArea[doc.area] = (stats.byArea[doc.area] || 0) + 1;
      if (doc.priority) {
        stats.byPriority[doc.priority] = (stats.byPriority[doc.priority] || 0) + 1;
      }
    });

    return stats;
  }
}