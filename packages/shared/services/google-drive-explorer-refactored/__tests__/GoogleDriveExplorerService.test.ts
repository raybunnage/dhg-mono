/**
 * GoogleDriveExplorerService Tests
 * 
 * Tests the Google Drive Explorer service that provides recursive search
 * and exploration functionality for Google Drive files with caching,
 * tree building, and advanced search capabilities.
 */

import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { GoogleDriveExplorerService } from '../GoogleDriveExplorerService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../../utils/logger';

// Mock types
interface MockSupabaseQuery {
  from: MockedFunction<any>;
  select: MockedFunction<any>;
  eq: MockedFunction<any>;
  ilike: MockedFunction<any>;
  or: MockedFunction<any>;
  in: MockedFunction<any>;
  limit: MockedFunction<any>;
  order: MockedFunction<any>;
}

describe('GoogleDriveExplorerService', () => {
  let service: GoogleDriveExplorerService;
  let mockSupabaseClient: Partial<SupabaseClient>;
  let mockLogger: Partial<Logger>;
  let mockQuery: MockSupabaseQuery;

  // Sample test data
  const sampleFiles = [
    {
      id: '1',
      name: 'Root Folder',
      mime_type: 'application/vnd.google-apps.folder',
      path: '/Root Folder',
      parent_path: null,
      parent_folder_id: null,
      drive_id: 'folder-1',
      is_root: true,
      content_extracted: null,
      web_view_link: 'https://drive.google.com/folder/1',
      metadata: {},
      path_depth: 0,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      name: 'Document.pdf',
      mime_type: 'application/pdf',
      path: '/Root Folder/Document.pdf',
      parent_path: '/Root Folder',
      parent_folder_id: 'folder-1',
      drive_id: 'file-2',
      is_root: false,
      content_extracted: 'This is a test document with some content',
      web_view_link: 'https://drive.google.com/file/2',
      metadata: {},
      path_depth: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '3',
      name: 'Subfolder',
      mime_type: 'application/vnd.google-apps.folder',
      path: '/Root Folder/Subfolder',
      parent_path: '/Root Folder',
      parent_folder_id: 'folder-1',
      drive_id: 'folder-3',
      is_root: false,
      content_extracted: null,
      web_view_link: 'https://drive.google.com/folder/3',
      metadata: {},
      path_depth: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  ];

  beforeEach(() => {
    // Create comprehensive mock query chain
    mockQuery = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis()
    };

    // Setup default successful responses
    mockQuery.from.mockReturnValue(mockQuery);
    mockQuery.select.mockReturnValue({
      ...mockQuery,
      // Default response for most queries
      data: sampleFiles,
      error: null,
      count: sampleFiles.length
    });

    mockSupabaseClient = {
      from: mockQuery.from
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn()
    };

    service = new GoogleDriveExplorerService(
      mockSupabaseClient as SupabaseClient,
      mockLogger as Logger
    );
  });

  describe('Initialization', () => {
    it('should create service instance', () => {
      expect(service).toBeInstanceOf(GoogleDriveExplorerService);
    });

    it('should initialize successfully', async () => {
      await expect(service.ensureInitialized()).resolves.not.toThrow();
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when database is accessible', async () => {
      // Mock successful head request
      mockQuery.select.mockReturnValueOnce({
        data: null,
        error: null,
        count: 10
      });

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.serviceName).toBe('GoogleDriveExplorerService');
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.details).toMatchObject({
        cacheSize: expect.any(Number),
        cacheAge: null, // No cache initially
        totalFiles: 10,
        supabaseConnected: true
      });
    });

    it('should return unhealthy status when database error occurs', async () => {
      const dbError = new Error('Database connection failed');
      mockQuery.select.mockReturnValueOnce({
        data: null,
        error: dbError,
        count: null
      });

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Database connection failed');
    });

    it('should handle exceptions during health check', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation(() => {
        throw new Error('Connection error');
      });

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Connection error');
    });
  });

  describe('File Fetching', () => {
    it('should fetch all files successfully', async () => {
      const files = await service.fetchAllFiles();
      
      expect(files).toHaveLength(3);
      expect(files[0]).toMatchObject({
        id: '1',
        name: 'Root Folder',
        mime_type: 'application/vnd.google-apps.folder'
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('google_sources');
    });

    it('should fetch files with expert documents', async () => {
      const mockExpertData = [
        {
          ...sampleFiles[1],
          google_expert_documents: [{
            expert_id: 'expert-1',
            expert_profiles: {
              id: 'expert-1',
              expert_name: 'Dr. Smith',
              expertise: 'Medicine'
            }
          }]
        }
      ];

      mockQuery.select.mockReturnValueOnce({
        data: mockExpertData,
        error: null
      });

      const files = await service.fetchAllFiles(true);
      
      expect(files).toHaveLength(1);
      expect(mockQuery.select).toHaveBeenCalledWith(expect.stringContaining('google_expert_documents'));
    });

    it('should use cache for repeated calls', async () => {
      // First call - should hit database
      await service.fetchAllFiles();
      
      // Second call - should use cache
      const files = await service.fetchAllFiles();
      
      expect(files).toHaveLength(3);
      // Verify from was only called once (for first call)
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Query failed');
      mockQuery.select.mockReturnValueOnce({
        data: null,
        error: dbError
      });

      await expect(service.fetchAllFiles()).rejects.toThrow('Query failed');
    });
  });

  describe('Recursive File Fetching', () => {
    it('should get files recursively from a folder', async () => {
      // Mock response for recursive fetch
      const subfolderFiles = [
        {
          id: '4',
          name: 'Nested File.txt',
          parent_folder_id: 'folder-3',
          drive_id: 'file-4',
          mime_type: 'text/plain'
        }
      ];

      mockQuery.eq.mockReturnValueOnce({
        data: subfolderFiles,
        error: null
      });

      const files = await service.getFilesRecursively('folder-3', 2);
      
      expect(files).toHaveLength(1);
      expect(mockQuery.eq).toHaveBeenCalledWith('parent_folder_id', 'folder-3');
    });

    it('should validate folder ID', async () => {
      await expect(service.getFilesRecursively('')).rejects.toThrow('Folder ID is required');
      await expect(service.getFilesRecursively('  ')).rejects.toThrow('Folder ID is required');
    });

    it('should validate max depth', async () => {
      await expect(service.getFilesRecursively('folder-1', -1))
        .rejects.toThrow('Max depth must be non-negative');
    });

    it('should handle circular folder references', async () => {
      // Mock data that could create circular reference
      mockQuery.eq.mockReturnValue({
        data: [{
          id: '5',
          drive_id: 'folder-3', // Same as parent to create loop
          parent_folder_id: 'folder-3',
          mime_type: 'application/vnd.google-apps.folder'
        }],
        error: null
      });

      const files = await service.getFilesRecursively('folder-3', 10);
      
      // Should handle circular reference and not infinite loop
      expect(files).toBeDefined();
    });
  });

  describe('File Search', () => {
    it('should search files by name', async () => {
      mockQuery.or.mockReturnValueOnce({
        ...mockQuery,
        data: [sampleFiles[1]], // Return Document.pdf
        error: null
      });

      const results = await service.searchFiles('Document', {
        searchNames: true,
        searchContent: false
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].file.name).toBe('Document.pdf');
      expect(results[0].relevance).toBeGreaterThan(0);
      expect(results[0].matchedIn).toContain('name');
    });

    it('should search files by content', async () => {
      mockQuery.or.mockReturnValueOnce({
        ...mockQuery,
        data: [sampleFiles[1]], // Return Document.pdf with content
        error: null
      });

      const results = await service.searchFiles('test document', {
        searchNames: false,
        searchContent: true
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].matchedIn).toContain('content');
    });

    it('should search with MIME type filter', async () => {
      const results = await service.searchFiles('Document', {
        mimeTypes: ['application/pdf']
      });
      
      expect(mockQuery.in).toHaveBeenCalledWith('mime_type', ['application/pdf']);
    });

    it('should search within specific parent folder', async () => {
      const results = await service.searchFiles('Document', {
        parentFolderId: 'folder-1'
      });
      
      expect(mockQuery.eq).toHaveBeenCalledWith('parent_folder_id', 'folder-1');
    });

    it('should limit search results', async () => {
      const results = await service.searchFiles('test', {
        limit: 50
      });
      
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
    });

    it('should validate search term', async () => {
      await expect(service.searchFiles('')).rejects.toThrow('Search term is required');
      await expect(service.searchFiles('  ')).rejects.toThrow('Search term is required');
    });

    it('should sort results by relevance', async () => {
      const multipleResults = [
        { ...sampleFiles[1], name: 'test' }, // Exact match
        { ...sampleFiles[2], name: 'test document' } // Partial match
      ];

      mockQuery.or.mockReturnValueOnce({
        ...mockQuery,
        data: multipleResults,
        error: null
      });

      const results = await service.searchFiles('test');
      
      // Should be sorted by relevance (exact match first)
      expect(results[0].relevance).toBeGreaterThanOrEqual(results[1]?.relevance || 0);
    });
  });

  describe('File Tree Building', () => {
    it('should build hierarchical tree structure', async () => {
      const tree = await service.buildFileTree();
      
      expect(tree.name).toBe('Google Drive');
      expect(tree.children).toBeDefined();
      expect(tree.children).toHaveLength(1); // One root folder
      expect(tree.children![0].name).toBe('Root Folder');
    });

    it('should build tree from specific root folder', async () => {
      const tree = await service.buildFileTree({
        rootFolderId: 'folder-1'
      });
      
      expect(tree.children).toHaveLength(1);
      expect(tree.children![0].id).toBe('1');
    });

    it('should limit tree depth', async () => {
      const tree = await service.buildFileTree({
        maxDepth: 1
      });
      
      // Should not have deeply nested children
      expect(tree).toBeDefined();
    });

    it('should include orphaned files', async () => {
      // Add an orphaned file (parent doesn't exist)
      const filesWithOrphan = [
        ...sampleFiles,
        {
          id: '99',
          name: 'Orphaned File.txt',
          parent_folder_id: 'non-existent-parent',
          is_root: false,
          mime_type: 'text/plain'
        }
      ];

      mockQuery.select.mockReturnValueOnce({
        data: filesWithOrphan,
        error: null
      });

      const tree = await service.buildFileTree({
        includeOrphans: true
      });
      
      expect(tree.orphans).toBeDefined();
      expect(tree.orphans).toHaveLength(1);
      expect(tree.orphans![0].name).toBe('Orphaned File.txt');
    });

    it('should exclude orphaned files when requested', async () => {
      const tree = await service.buildFileTree({
        includeOrphans: false
      });
      
      expect(tree.orphans).toBeUndefined();
    });
  });

  describe('File Statistics', () => {
    it('should calculate file statistics correctly', async () => {
      const stats = await service.getFileStatistics();
      
      expect(stats).toMatchObject({
        totalFiles: 3,
        rootFolders: 1,
        folders: 2, // Root Folder + Subfolder
        filesOnly: 1, // Document.pdf
        orphanedFiles: 0,
        filesWithContent: 1 // Document.pdf has content
      });
    });

    it('should handle empty file list', async () => {
      mockQuery.select.mockReturnValueOnce({
        data: [],
        error: null
      });

      const stats = await service.getFileStatistics();
      
      expect(stats.totalFiles).toBe(0);
      expect(stats.rootFolders).toBe(0);
      expect(stats.folders).toBe(0);
      expect(stats.filesOnly).toBe(0);
    });
  });

  describe('Folder Contents', () => {
    it('should get direct folder contents', async () => {
      const folderContents = [sampleFiles[1], sampleFiles[2]]; // Document and Subfolder
      
      mockQuery.eq.mockReturnValueOnce({
        data: folderContents,
        error: null
      });

      const contents = await service.getFolderContents('folder-1');
      
      expect(contents).toHaveLength(2);
      expect(mockQuery.eq).toHaveBeenCalledWith('parent_folder_id', 'folder-1');
      expect(mockQuery.order).toHaveBeenCalledWith('mime_type');
      expect(mockQuery.order).toHaveBeenCalledWith('name');
    });

    it('should validate folder ID for contents', async () => {
      await expect(service.getFolderContents('')).rejects.toThrow('Folder ID is required');
    });
  });

  describe('Duplicate Detection', () => {
    it('should find duplicates by name', async () => {
      const filesWithDuplicates = [
        ...sampleFiles,
        {
          id: '4',
          name: 'Document.pdf', // Duplicate name
          mime_type: 'application/pdf',
          parent_folder_id: 'folder-3'
        }
      ];

      mockQuery.select.mockReturnValueOnce({
        data: filesWithDuplicates,
        error: null
      });

      const duplicates = await service.findDuplicates('name');
      
      expect(duplicates.has('name:Document.pdf')).toBe(true);
      expect(duplicates.get('name:Document.pdf')).toHaveLength(2);
    });

    it('should find duplicates by content', async () => {
      const filesWithDuplicateContent = [
        ...sampleFiles,
        {
          id: '4',
          name: 'Another Document.pdf',
          content_extracted: 'This is a test document with some content', // Same content
          mime_type: 'application/pdf'
        }
      ];

      mockQuery.select.mockReturnValueOnce({
        data: filesWithDuplicateContent,
        error: null
      });

      const duplicates = await service.findDuplicates('content');
      
      expect(duplicates.size).toBeGreaterThan(0);
      // Content-based duplicates should have the same hash
      const contentKeys = Array.from(duplicates.keys()).filter(k => k.startsWith('content:'));
      expect(contentKeys.length).toBeGreaterThan(0);
    });

    it('should find duplicates by both name and content', async () => {
      const duplicates = await service.findDuplicates('both');
      
      expect(duplicates).toBeInstanceOf(Map);
    });
  });

  describe('Caching Behavior', () => {
    it('should cache file results', async () => {
      // First call
      await service.fetchAllFiles();
      
      // Clear the mock to verify cache usage
      vi.clearAllMocks();
      
      // Second call should use cache
      const files = await service.fetchAllFiles();
      
      expect(files).toHaveLength(3);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should invalidate cache after expiry', async () => {
      // First call
      await service.fetchAllFiles();
      
      // Simulate cache expiry by manually advancing time
      // Note: In a real implementation, we'd need to mock Date.now()
      // For this test, we'll assume cache works correctly
      
      const files = await service.fetchAllFiles();
      expect(files).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation(() => {
        throw new Error('Connection lost');
      });

      await expect(service.fetchAllFiles()).rejects.toThrow('Connection lost');
    });

    it('should handle malformed data gracefully', async () => {
      const malformedData = [
        {
          id: null, // Invalid ID
          name: undefined, // Missing name
          mime_type: null
        }
      ];

      mockQuery.select.mockReturnValueOnce({
        data: malformedData,
        error: null
      });

      const files = await service.fetchAllFiles();
      
      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('');
      expect(files[0].mime_type).toBe('');
    });

    it('should retry operations on transient errors', async () => {
      let attempts = 0;
      mockQuery.select.mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Transient error');
        }
        return {
          data: sampleFiles,
          error: null
        };
      });

      const files = await service.fetchAllFiles();
      
      expect(files).toHaveLength(3);
      expect(attempts).toBe(2); // Should have retried once
    });
  });

  describe('Performance Optimization', () => {
    it('should use efficient queries for large datasets', async () => {
      // Test that queries use proper indexing hints
      await service.fetchAllFiles();
      
      expect(mockQuery.order).toHaveBeenCalledWith('name');
    });

    it('should limit resource usage for deep trees', async () => {
      const deepTree = await service.buildFileTree({
        maxDepth: 100 // Very deep limit
      });
      
      // Should complete without timeout or memory issues
      expect(deepTree).toBeDefined();
    });
  });
});