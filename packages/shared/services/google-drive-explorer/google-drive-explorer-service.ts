/**
 * Google Drive Explorer Service
 * 
 * Provides recursive search and exploration functionality for Google Drive files
 * stored in the sources_google table. Designed to work in both browser and CLI environments.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/types';

export interface FileNode {
  id: string;
  name: string;
  mime_type: string;
  path: string | null;
  parent_path: string | null;
  parent_folder_id: string | null;
  drive_id: string | null;
  is_root: boolean | null;
  content_extracted: string | null;
  web_view_link: string | null;
  metadata: any;
  expertDocument?: any;
  path_depth?: number;
  created_at?: string;
  updated_at?: string;
}

export interface FileTreeStats {
  totalFiles: number;
  rootFolders: number;
  filesOnly: number;
  folders: number;
  orphanedFiles: number;
  filesWithContent: number;
}

export class GoogleDriveExplorerService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Fetch all files from sources_google with optional expert document data
   */
  async fetchAllFiles(includeExpertDocuments: boolean = false): Promise<FileNode[]> {
    try {
      let query = this.supabase
        .from('sources_google')
        .select(includeExpertDocuments ? `
          *,
          expert_documents(
            id, 
            processing_status, 
            processed_content, 
            batch_id, 
            error_message,
            queued_at, 
            processing_started_at, 
            processing_completed_at,
            processing_error, 
            retry_count
          )
        ` : '*')
        .order('name');

      const { data, error } = await query;
      
      if (error) throw error;

      // Transform to FileNode interface
      return (data || []).map(source => ({
        id: source.id,
        name: source.name,
        mime_type: source.mime_type || '',
        path: source.path,
        parent_path: source.parent_path,
        parent_folder_id: source.parent_folder_id,
        drive_id: source.drive_id,
        is_root: source.is_root,
        content_extracted: source.content_extracted,
        web_view_link: source.web_view_link,
        metadata: source.metadata,
        path_depth: source.path_depth,
        created_at: source.created_at,
        updated_at: source.updated_at,
        expertDocument: includeExpertDocuments && 'expert_documents' in source ? 
          source.expert_documents?.[0] : undefined
      }));
    } catch (error) {
      console.error('Error fetching files:', error);
      throw error;
    }
  }

  /**
   * Get files recursively starting from a specific folder
   * Uses the drive_id and parent_folder_id for navigation as per CLAUDE.md
   */
  async getFilesRecursively(folderId: string, maxDepth: number = 10): Promise<FileNode[]> {
    try {
      // Use recursive CTE to get all children
      const { data, error } = await this.supabase.rpc('get_folder_tree', {
        root_folder_id: folderId,
        max_depth: maxDepth
      });

      if (error) {
        // If RPC doesn't exist, fall back to manual recursive fetch
        console.warn('RPC function not found, using manual recursive fetch');
        return this.manualRecursiveFetch(folderId, maxDepth);
      }

      return data || [];
    } catch (error) {
      console.error('Error in recursive fetch:', error);
      // Fall back to manual recursive fetch
      return this.manualRecursiveFetch(folderId, maxDepth);
    }
  }

  /**
   * Manual recursive fetch when RPC is not available
   */
  private async manualRecursiveFetch(
    folderId: string, 
    maxDepth: number, 
    currentDepth: number = 0
  ): Promise<FileNode[]> {
    if (currentDepth >= maxDepth) return [];

    const files: FileNode[] = [];
    
    // Get direct children using drive_id
    const { data: children, error } = await this.supabase
      .from('sources_google')
      .select('*')
      .or(`parent_folder_id.eq.${folderId}`);

    if (error) {
      console.error('Error fetching children:', error);
      return files;
    }

    for (const child of children || []) {
      const fileNode: FileNode = {
        id: child.id,
        name: child.name,
        mime_type: child.mime_type || '',
        path: child.path,
        parent_path: child.parent_path,
        parent_folder_id: child.parent_folder_id,
        drive_id: child.drive_id,
        is_root: child.is_root,
        content_extracted: child.content_extracted,
        web_view_link: child.web_view_link,
        metadata: child.metadata,
        path_depth: child.path_depth
      };
      
      files.push(fileNode);

      // If it's a folder, recursively fetch its children
      if (child.mime_type === 'application/vnd.google-apps.folder' && child.drive_id) {
        const subFiles = await this.manualRecursiveFetch(
          child.drive_id, 
          maxDepth, 
          currentDepth + 1
        );
        files.push(...subFiles);
      }
    }

    return files;
  }

  /**
   * Search files by name or content
   */
  async searchFiles(searchTerm: string, searchContent: boolean = false): Promise<FileNode[]> {
    try {
      let query = this.supabase
        .from('sources_google')
        .select('*');

      if (searchContent) {
        query = query.or(`name.ilike.%${searchTerm}%,content_extracted.ilike.%${searchTerm}%`);
      } else {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query.order('name');
      
      if (error) throw error;

      return (data || []).map(source => ({
        id: source.id,
        name: source.name,
        mime_type: source.mime_type || '',
        path: source.path,
        parent_path: source.parent_path,
        parent_folder_id: source.parent_folder_id,
        drive_id: source.drive_id,
        is_root: source.is_root,
        content_extracted: source.content_extracted,
        web_view_link: source.web_view_link,
        metadata: source.metadata,
        path_depth: source.path_depth
      }));
    } catch (error) {
      console.error('Error searching files:', error);
      throw error;
    }
  }

  /**
   * Get file statistics
   */
  async getFileStats(files: FileNode[]): Promise<FileTreeStats> {
    const stats: FileTreeStats = {
      totalFiles: files.length,
      rootFolders: files.filter(f => 
        f.is_root === true && 
        f.mime_type === 'application/vnd.google-apps.folder'
      ).length,
      filesOnly: files.filter(f => 
        f.mime_type !== 'application/vnd.google-apps.folder'
      ).length,
      folders: files.filter(f => 
        f.mime_type === 'application/vnd.google-apps.folder'
      ).length,
      orphanedFiles: files.filter(f => 
        f.parent_path && 
        !files.some(parent => parent.path === f.parent_path)
      ).length,
      filesWithContent: files.filter(f => 
        f.content_extracted && f.content_extracted.length > 0
      ).length
    };

    return stats;
  }

  /**
   * Analyze file relationships for debugging
   */
  analyzeFileRelationships(files: FileNode[]) {
    const parentPathCounts = files.reduce((acc, file) => {
      if (file.parent_path) {
        acc[file.parent_path] = (acc[file.parent_path] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const parentFolderIdCounts = files.reduce((acc, file) => {
      if (file.parent_folder_id) {
        acc[file.parent_folder_id] = (acc[file.parent_folder_id] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const foldersWithoutChildren = files.filter(file => 
      file.mime_type === 'application/vnd.google-apps.folder' && 
      file.path &&
      !files.some(child => child.parent_path === file.path)
    );

    const orphanedFiles = files.filter(file => 
      file.parent_path && 
      !files.some(parent => parent.path === file.parent_path)
    );

    return {
      totalFiles: files.length,
      filesWithParentPath: files.filter(f => f.parent_path).length,
      filesWithParentFolderId: files.filter(f => f.parent_folder_id).length,
      topParentPaths: Object.entries(parentPathCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5),
      topParentFolderIds: Object.entries(parentFolderIdCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5),
      foldersWithoutChildren: foldersWithoutChildren.length,
      orphanedFiles: orphanedFiles.length,
      orphanedFilesList: orphanedFiles.slice(0, 10).map(f => ({
        name: f.name,
        parent_path: f.parent_path
      }))
    };
  }

  /**
   * Repair file paths (admin function)
   */
  async repairFilePaths(): Promise<{ fixed: number; errors: number }> {
    let fixedCount = 0;
    let errorCount = 0;

    try {
      const files = await this.fetchAllFiles(false);
      const rootFolders = files.filter(
        f => f.is_root === true && f.mime_type === 'application/vnd.google-apps.folder'
      );

      for (const rootFolder of rootFolders) {
        // Fix root folder path if needed
        if (!rootFolder.path) {
          const rootPath = `/${rootFolder.name}`;
          const { error } = await this.supabase
            .from('sources_google')
            .update({ path: rootPath })
            .eq('id', rootFolder.id);

          if (error) {
            errorCount++;
            continue;
          }
          fixedCount++;
          rootFolder.path = rootPath;
        }

        // Fix children paths
        if (rootFolder.drive_id) {
          const result = await this.repairChildrenPaths(
            rootFolder.drive_id, 
            rootFolder.path!
          );
          fixedCount += result.fixed;
          errorCount += result.errors;
        }
      }

      return { fixed: fixedCount, errors: errorCount };
    } catch (error) {
      console.error('Error in path repair:', error);
      throw error;
    }
  }

  /**
   * Recursively repair children paths
   */
  private async repairChildrenPaths(
    parentDriveId: string, 
    parentPath: string
  ): Promise<{ fixed: number; errors: number }> {
    let fixedCount = 0;
    let errorCount = 0;

    const { data: children, error: fetchError } = await this.supabase
      .from('sources_google')
      .select('*')
      .eq('parent_folder_id', parentDriveId);

    if (fetchError || !children) {
      errorCount++;
      return { fixed: fixedCount, errors: errorCount };
    }

    for (const child of children) {
      const correctPath = `${parentPath}/${child.name}`;
      
      if (child.path !== correctPath || child.parent_path !== parentPath) {
        const { error: updateError } = await this.supabase
          .from('sources_google')
          .update({
            path: correctPath,
            parent_path: parentPath
          })
          .eq('id', child.id);

        if (updateError) {
          errorCount++;
          continue;
        }
        fixedCount++;

        // If it's a folder, fix its children too
        if (child.mime_type === 'application/vnd.google-apps.folder' && child.drive_id) {
          const childResult = await this.repairChildrenPaths(child.drive_id, correctPath);
          fixedCount += childResult.fixed;
          errorCount += childResult.errors;
        }
      }
    }

    return { fixed: fixedCount, errors: errorCount };
  }
}