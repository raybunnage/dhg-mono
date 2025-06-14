/**
 * Google Drive Explorer Service - Refactored with BusinessService base class
 * 
 * Provides recursive search and exploration functionality for Google Drive files
 * with proper dependency injection, retry logic, and performance monitoring.
 */

import { BusinessService } from '../base-classes/BusinessService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger';
import { 
  FileNode, 
  FileTreeStats, 
  SearchOptions, 
  TreeBuildOptions,
  FileTree,
  SearchResult 
} from './types';

/**
 * GoogleDriveExplorerService - Explores and searches Google Drive file structures
 * 
 * Features:
 * - Recursive file tree traversal
 * - Content-based search
 * - File statistics generation
 * - Tree structure building
 * - Orphaned file detection
 * - Performance optimized queries
 * - Automatic retry logic
 */
export class GoogleDriveExplorerService extends BusinessService {
  private fileCache: Map<string, FileNode> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate: Date | null = null;

  constructor(supabaseClient: SupabaseClient, logger?: Logger) {
    super('GoogleDriveExplorerService', { supabaseClient }, logger);
  }

  protected async initialize(): Promise<void> {
    // Clear cache on initialization
    this.fileCache.clear();
    this.lastCacheUpdate = null;
    this.logger?.info('GoogleDriveExplorerService initialized');
  }

  protected async cleanup(): Promise<void> {
    // Clear cache on cleanup
    this.fileCache.clear();
    this.lastCacheUpdate = null;
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    serviceName: string;
    timestamp: Date;
    details?: Record<string, any>;
    error?: string;
  }> {
    try {
      // Check if we can query the google_sources table
      const { error, count } = await this.dependencies.supabaseClient
        .from('google_sources')
        .select('*', { count: 'exact', head: true })
        .limit(1);

      return {
        healthy: !error,
        serviceName: this.serviceName,
        timestamp: new Date(),
        details: {
          cacheSize: this.fileCache.size,
          cacheAge: this.lastCacheUpdate 
            ? Date.now() - this.lastCacheUpdate.getTime() 
            : null,
          totalFiles: count || 0,
          supabaseConnected: !error
        },
        error: error?.message
      };
    } catch (error: any) {
      return {
        healthy: false,
        serviceName: this.serviceName,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Fetch all files with caching and retry logic
   */
  async fetchAllFiles(includeExpertDocuments: boolean = false): Promise<FileNode[]> {
    // Check cache first
    if (this.isCacheValid() && !includeExpertDocuments) {
      this.logger?.debug('Returning cached files');
      return Array.from(this.fileCache.values());
    }

    return this.withRetry(async () => {
      let query = this.dependencies.supabaseClient
        .from('google_sources')
        .select('*');

      if (includeExpertDocuments) {
        query = query.select(`
          *,
          google_expert_documents!inner(
            expert_id,
            expert_profiles!inner(
              id,
              expert_name,
              expertise
            )
          )
        `);
      }

      const { data, error } = await query.order('name');
      
      if (error) throw error;

      // Transform and cache results
      const files = (data || []).map(source => this.transformToFileNode(source));
      
      // Update cache if not including expert documents
      if (!includeExpertDocuments) {
        this.updateCache(files);
      }

      this.logger?.info(`Fetched ${files.length} files from Google Drive`);
      return files;
    }, { operationName: 'fetchAllFiles' });
  }

  /**
   * Get files recursively with depth control
   */
  async getFilesRecursively(
    folderId: string, 
    maxDepth: number = 10
  ): Promise<FileNode[]> {
    return this.validateInput({ folderId, maxDepth }, () => {
      if (!folderId || !folderId.trim()) {
        throw new Error('Folder ID is required');
      }
      if (maxDepth < 0) {
        throw new Error('Max depth must be non-negative');
      }
    })
    .then(() => this.timeOperation('getFilesRecursively', async () => {
      const files = await this.recursiveFetch(folderId, maxDepth);
      this.logger?.info(`Found ${files.length} files recursively from folder ${folderId}`);
      return files;
    }));
  }

  /**
   * Search files by content or metadata
   */
  async searchFiles(
    searchTerm: string, 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    return this.validateInput({ searchTerm }, () => {
      if (!searchTerm || !searchTerm.trim()) {
        throw new Error('Search term is required');
      }
    })
    .then(() => this.withRetry(async () => {
      const { 
        searchContent = true, 
        searchNames = true, 
        mimeTypes,
        parentFolderId,
        limit = 100 
      } = options;

      let query = this.dependencies.supabaseClient
        .from('google_sources')
        .select('*');

      // Build search conditions
      const conditions: string[] = [];
      
      if (searchNames) {
        conditions.push(`name.ilike.%${searchTerm}%`);
      }
      
      if (searchContent) {
        conditions.push(`content_extracted.ilike.%${searchTerm}%`);
      }

      if (conditions.length > 0) {
        query = query.or(conditions.join(','));
      }

      // Apply filters
      if (mimeTypes && mimeTypes.length > 0) {
        query = query.in('mime_type', mimeTypes);
      }

      if (parentFolderId) {
        query = query.eq('parent_folder_id', parentFolderId);
      }

      // Execute query
      const { data, error } = await query
        .limit(limit)
        .order('name');

      if (error) throw error;

      // Transform results with relevance scoring
      const results = (data || []).map(source => {
        const file = this.transformToFileNode(source);
        const relevance = this.calculateRelevance(file, searchTerm, searchContent, searchNames);
        
        return {
          file,
          relevance,
          matchedIn: this.getMatchLocations(file, searchTerm, searchContent, searchNames)
        };
      });

      // Sort by relevance
      results.sort((a, b) => b.relevance - a.relevance);

      this.logger?.info(`Found ${results.length} files matching "${searchTerm}"`);
      return results;
    }, { operationName: 'searchFiles' }));
  }

  /**
   * Build hierarchical tree structure
   */
  async buildFileTree(options: TreeBuildOptions = {}): Promise<FileTree> {
    const { 
      rootFolderId, 
      maxDepth = 10,
      includeOrphans = true 
    } = options;

    return this.timeOperation('buildFileTree', async () => {
      // Fetch all files once
      const allFiles = await this.fetchAllFiles();
      
      // Create lookup maps for performance
      const fileById = new Map<string, FileNode>();
      const childrenByParent = new Map<string, FileNode[]>();
      
      allFiles.forEach(file => {
        fileById.set(file.drive_id || file.id, file);
        
        const parentId = file.parent_folder_id;
        if (parentId) {
          if (!childrenByParent.has(parentId)) {
            childrenByParent.set(parentId, []);
          }
          childrenByParent.get(parentId)!.push(file);
        }
      });

      // Build tree recursively
      const buildNode = (file: FileNode, depth: number = 0): FileTree => {
        const children: FileTree[] = [];
        
        if (depth < maxDepth && file.mime_type === 'application/vnd.google-apps.folder') {
          const fileChildren = childrenByParent.get(file.drive_id || file.id) || [];
          fileChildren.forEach(child => {
            children.push(buildNode(child, depth + 1));
          });
        }

        return {
          ...file,
          children: children.length > 0 ? children : undefined
        };
      };

      // Find root nodes
      let roots: FileTree[] = [];
      
      if (rootFolderId) {
        const rootFile = fileById.get(rootFolderId);
        if (rootFile) {
          roots = [buildNode(rootFile)];
        }
      } else {
        // Find all root folders (is_root = true or no parent)
        roots = allFiles
          .filter(file => file.is_root || !file.parent_folder_id)
          .map(file => buildNode(file));
      }

      // Handle orphaned files if requested
      let orphans: FileNode[] = [];
      if (includeOrphans) {
        orphans = allFiles.filter(file => {
          const hasParent = file.parent_folder_id && fileById.has(file.parent_folder_id);
          const isRoot = file.is_root || roots.some(r => r.id === file.id);
          return !hasParent && !isRoot;
        });
      }

      const tree: FileTree = {
        id: 'root',
        name: 'Google Drive',
        mime_type: 'application/vnd.google-apps.folder',
        path: '/',
        parent_path: null,
        parent_folder_id: null,
        drive_id: null,
        is_root: true,
        content_extracted: null,
        web_view_link: null,
        metadata: {},
        children: roots,
        orphans: orphans.length > 0 ? orphans : undefined
      };

      this.logger?.info(`Built file tree with ${roots.length} roots and ${orphans.length} orphans`);
      return tree;
    });
  }

  /**
   * Get file statistics
   */
  async getFileStatistics(): Promise<FileTreeStats> {
    return this.withRetry(async () => {
      const { data, error } = await this.dependencies.supabaseClient
        .from('google_sources')
        .select('mime_type, is_root, parent_folder_id, content_extracted');

      if (error) throw error;

      const stats: FileTreeStats = {
        totalFiles: data?.length || 0,
        rootFolders: 0,
        filesOnly: 0,
        folders: 0,
        orphanedFiles: 0,
        filesWithContent: 0
      };

      const parentIds = new Set<string>();
      
      data?.forEach(file => {
        if (file.parent_folder_id) {
          parentIds.add(file.parent_folder_id);
        }
        
        if (file.is_root) {
          stats.rootFolders++;
        }
        
        if (file.mime_type === 'application/vnd.google-apps.folder') {
          stats.folders++;
        } else {
          stats.filesOnly++;
        }
        
        if (file.content_extracted) {
          stats.filesWithContent++;
        }
      });

      // Count orphans (files whose parent doesn't exist)
      data?.forEach(file => {
        if (file.parent_folder_id && !parentIds.has(file.parent_folder_id) && !file.is_root) {
          stats.orphanedFiles++;
        }
      });

      this.logger?.info('File statistics calculated', stats);
      return stats;
    }, { operationName: 'getFileStatistics' });
  }

  /**
   * Get folder contents (direct children only)
   */
  async getFolderContents(folderId: string): Promise<FileNode[]> {
    return this.validateInput({ folderId }, () => {
      if (!folderId || !folderId.trim()) {
        throw new Error('Folder ID is required');
      }
    })
    .then(() => this.withRetry(async () => {
      const { data, error } = await this.dependencies.supabaseClient
        .from('google_sources')
        .select('*')
        .eq('parent_folder_id', folderId)
        .order('mime_type')
        .order('name');

      if (error) throw error;

      const files = (data || []).map(source => this.transformToFileNode(source));
      this.logger?.info(`Found ${files.length} items in folder ${folderId}`);
      
      return files;
    }, { operationName: 'getFolderContents' }));
  }

  /**
   * Find duplicate files by name or content
   */
  async findDuplicates(
    criteria: 'name' | 'content' | 'both' = 'name'
  ): Promise<Map<string, FileNode[]>> {
    const allFiles = await this.fetchAllFiles();
    const duplicates = new Map<string, FileNode[]>();

    if (criteria === 'name' || criteria === 'both') {
      const byName = new Map<string, FileNode[]>();
      
      allFiles.forEach(file => {
        if (!byName.has(file.name)) {
          byName.set(file.name, []);
        }
        byName.get(file.name)!.push(file);
      });

      byName.forEach((files, name) => {
        if (files.length > 1) {
          duplicates.set(`name:${name}`, files);
        }
      });
    }

    if (criteria === 'content' || criteria === 'both') {
      const byContent = new Map<string, FileNode[]>();
      
      allFiles
        .filter(file => file.content_extracted)
        .forEach(file => {
          const contentHash = this.simpleHash(file.content_extracted!);
          if (!byContent.has(contentHash)) {
            byContent.set(contentHash, []);
          }
          byContent.get(contentHash)!.push(file);
        });

      byContent.forEach((files, hash) => {
        if (files.length > 1) {
          duplicates.set(`content:${hash}`, files);
        }
      });
    }

    this.logger?.info(`Found ${duplicates.size} sets of duplicates`);
    return duplicates;
  }

  /**
   * Helper: Recursive fetch implementation
   */
  private async recursiveFetch(
    folderId: string,
    maxDepth: number,
    currentDepth: number = 0,
    visited: Set<string> = new Set()
  ): Promise<FileNode[]> {
    if (currentDepth >= maxDepth || visited.has(folderId)) {
      return [];
    }

    visited.add(folderId);
    const files: FileNode[] = [];

    const { data: children, error } = await this.dependencies.supabaseClient
      .from('google_sources')
      .select('*')
      .eq('parent_folder_id', folderId);

    if (error) {
      this.logger?.error(`Error fetching children of ${folderId}: ${error.message}`);
      return files;
    }

    for (const child of children || []) {
      const fileNode = this.transformToFileNode(child);
      files.push(fileNode);

      // Recursively fetch folder contents
      if (child.mime_type === 'application/vnd.google-apps.folder' && child.drive_id) {
        const subFiles = await this.recursiveFetch(
          child.drive_id,
          maxDepth,
          currentDepth + 1,
          visited
        );
        files.push(...subFiles);
      }
    }

    return files;
  }

  /**
   * Helper: Transform database record to FileNode
   */
  private transformToFileNode(source: any): FileNode {
    return {
      id: source.id,
      name: source.name || '',
      mime_type: source.mime_type || '',
      path: source.path,
      parent_path: source.parent_path || null,
      parent_folder_id: source.parent_folder_id,
      drive_id: source.drive_id,
      is_root: source.is_root,
      content_extracted: source.content_extracted || null,
      web_view_link: source.web_view_link,
      metadata: source.metadata || {},
      expertDocument: source.google_expert_documents?.[0] || null,
      path_depth: source.path_depth,
      created_at: source.created_at,
      updated_at: source.updated_at
    };
  }

  /**
   * Helper: Calculate search relevance
   */
  private calculateRelevance(
    file: FileNode,
    searchTerm: string,
    searchContent: boolean,
    searchNames: boolean
  ): number {
    let relevance = 0;
    const term = searchTerm.toLowerCase();

    if (searchNames && file.name.toLowerCase().includes(term)) {
      // Exact name match scores higher
      if (file.name.toLowerCase() === term) {
        relevance += 10;
      } else if (file.name.toLowerCase().startsWith(term)) {
        relevance += 5;
      } else {
        relevance += 2;
      }
    }

    if (searchContent && file.content_extracted?.toLowerCase().includes(term)) {
      // Count occurrences in content
      const matches = (file.content_extracted.toLowerCase().match(new RegExp(term, 'g')) || []).length;
      relevance += Math.min(matches, 5); // Cap at 5 to prevent overwhelming
    }

    return relevance;
  }

  /**
   * Helper: Get match locations
   */
  private getMatchLocations(
    file: FileNode,
    searchTerm: string,
    searchContent: boolean,
    searchNames: boolean
  ): string[] {
    const locations: string[] = [];
    const term = searchTerm.toLowerCase();

    if (searchNames && file.name.toLowerCase().includes(term)) {
      locations.push('name');
    }

    if (searchContent && file.content_extracted?.toLowerCase().includes(term)) {
      locations.push('content');
    }

    return locations;
  }

  /**
   * Helper: Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Helper: Check if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.lastCacheUpdate || this.fileCache.size === 0) {
      return false;
    }
    
    const age = Date.now() - this.lastCacheUpdate.getTime();
    return age < this.cacheExpiry;
  }

  /**
   * Helper: Update cache
   */
  private updateCache(files: FileNode[]): void {
    this.fileCache.clear();
    files.forEach(file => {
      this.fileCache.set(file.id, file);
    });
    this.lastCacheUpdate = new Date();
  }
}