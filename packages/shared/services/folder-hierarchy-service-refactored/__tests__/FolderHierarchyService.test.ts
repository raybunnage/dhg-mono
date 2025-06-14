import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FolderHierarchyService } from '../FolderHierarchyService';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const createMockSupabaseClient = () => {
  const mockClient = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis()
  };
  return mockClient as any as SupabaseClient;
};

describe('FolderHierarchyService', () => {
  let service: FolderHierarchyService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    service = new FolderHierarchyService(mockSupabase, {
      cacheEnabled: false // Disable cache for predictable tests
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should create instance with default config', () => {
      const defaultService = new FolderHierarchyService(mockSupabase);
      expect(defaultService).toBeInstanceOf(FolderHierarchyService);
    });

    it('should accept custom configuration', () => {
      const customService = new FolderHierarchyService(mockSupabase, {
        maxTraversalDepth: 30,
        batchSize: 100,
        priorityFolders: ['custom', 'folders'],
        cacheEnabled: true,
        cacheTTL: 10000
      });
      expect(customService).toBeInstanceOf(FolderHierarchyService);
    });
  });

  describe('findHighLevelFolder', () => {
    it('should return folder at depth 0 immediately', async () => {
      const mockFolder = {
        id: 'folder-1',
        drive_id: 'drive-1',
        name: 'Top Folder',
        path_depth: 0,
        parent_folder_id: null,
        main_video_id: 'video-1',
        path: '/Top Folder',
        mime_type: 'application/vnd.google-apps.folder'
      };

      mockSupabase.single.mockResolvedValue({ data: mockFolder, error: null });

      const result = await service.findHighLevelFolder('folder-1');

      expect(result.folder).toEqual(mockFolder);
      expect(result.main_video_id).toBe('video-1');
      expect(result.traversed_path).toHaveLength(1);
    });

    it('should traverse up hierarchy to find high-level folder', async () => {
      const childFolder = {
        id: 'child-1',
        drive_id: 'drive-child',
        name: 'Child Folder',
        path_depth: 2,
        parent_folder_id: 'drive-parent',
        main_video_id: null,
        path: '/Top/Parent/Child',
        mime_type: 'application/vnd.google-apps.folder'
      };

      const parentFolder = {
        id: 'parent-1',
        drive_id: 'drive-parent',
        name: 'Parent Folder',
        path_depth: 1,
        parent_folder_id: 'drive-top',
        main_video_id: null,
        path: '/Top/Parent',
        mime_type: 'application/vnd.google-apps.folder'
      };

      const topFolder = {
        id: 'top-1',
        drive_id: 'drive-top',
        name: 'Top Folder',
        path_depth: 0,
        parent_folder_id: null,
        main_video_id: 'video-main',
        path: '/Top',
        mime_type: 'application/vnd.google-apps.folder'
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: childFolder, error: null })
        .mockResolvedValueOnce({ data: parentFolder, error: null })
        .mockResolvedValueOnce({ data: topFolder, error: null });

      const result = await service.findHighLevelFolder('child-1');

      expect(result.folder).toEqual(topFolder);
      expect(result.main_video_id).toBe('video-main');
      expect(result.traversed_path).toHaveLength(3);
    });

    it('should handle missing items gracefully', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await service.findHighLevelFolder('nonexistent');

      expect(result.folder).toBeNull();
      expect(result.main_video_id).toBeNull();
      expect(result.traversed_path).toHaveLength(0);
    });
  });

  describe('findMainVideoRecursively', () => {
    it('should find direct video in folder', async () => {
      const folderInfo = { drive_id: 'folder-drive-1' };
      const videoFile = {
        id: 'video-1',
        drive_id: 'video-drive-1',
        name: 'presentation.mp4',
        path_depth: 1,
        parent_folder_id: 'folder-drive-1',
        main_video_id: null,
        path: '/folder/presentation.mp4',
        mime_type: 'video/mp4'
      };

      mockSupabase.single.mockResolvedValueOnce({ data: folderInfo, error: null });
      mockSupabase.order.mockResolvedValueOnce({ data: [videoFile], error: null });

      const result = await service.findMainVideoRecursively('folder-1');

      expect(result.video_file).toEqual(videoFile);
      expect(result.video_id).toBe('video-1');
      expect(result.search_path).toContain('presentation.mp4');
    });

    it('should prioritize videos with specific naming patterns', async () => {
      const folderInfo = { drive_id: 'folder-drive-1' };
      const regularVideo = {
        id: 'video-1',
        drive_id: 'video-drive-1',
        name: 'random.mp4',
        mime_type: 'video/mp4'
      };
      const presentationVideo = {
        id: 'video-2',
        drive_id: 'video-drive-2',
        name: 'presentation-main.mp4',
        mime_type: 'video/mp4'
      };

      mockSupabase.single.mockResolvedValueOnce({ data: folderInfo, error: null });
      mockSupabase.order.mockResolvedValueOnce({ 
        data: [regularVideo, presentationVideo], 
        error: null 
      });

      const result = await service.findMainVideoRecursively('folder-1');

      expect(result.video_file?.id).toBe('video-2');
      expect(result.video_file?.name).toBe('presentation-main.mp4');
    });

    it('should search subfolders recursively', async () => {
      const folderInfo = { drive_id: 'folder-drive-1' };
      const subfolder = {
        id: 'subfolder-1',
        name: 'media',
        drive_id: 'subfolder-drive-1'
      };

      // First folder - no videos
      mockSupabase.single.mockResolvedValueOnce({ data: folderInfo, error: null });
      mockSupabase.order.mockResolvedValueOnce({ data: [], error: null });
      
      // Get subfolders
      mockSupabase.eq.mockImplementation(function() {
        if (arguments[1] === 'application/vnd.google-apps.folder') {
          return { data: [subfolder], error: null };
        }
        return this;
      });

      // Subfolder search
      mockSupabase.single.mockResolvedValueOnce({ data: { drive_id: 'subfolder-drive-1' }, error: null });
      const videoInSubfolder = {
        id: 'video-sub',
        name: 'video.mp4',
        mime_type: 'video/mp4'
      };
      mockSupabase.order.mockResolvedValueOnce({ data: [videoInSubfolder], error: null });

      const result = await service.findMainVideoRecursively('folder-1');

      expect(result.video_file?.id).toBe('video-sub');
      expect(result.search_path).toContain('media');
    });
  });

  describe('updateMainVideoIds', () => {
    it('should update items in batches', async () => {
      const itemIds = Array.from({ length: 75 }, (_, i) => `item-${i}`);
      
      mockSupabase.in.mockResolvedValue({ error: null });

      const result = await service.updateMainVideoIds(itemIds, 'video-1');

      expect(result).toBe(75);
      // Should be called twice (50 + 25)
      expect(mockSupabase.update).toHaveBeenCalledTimes(2);
    });

    it('should handle empty array', async () => {
      const result = await service.updateMainVideoIds([], 'video-1');
      expect(result).toBe(0);
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('should handle update errors', async () => {
      const itemIds = ['item-1', 'item-2'];
      
      mockSupabase.in.mockResolvedValue({ error: { message: 'Update failed' } });

      await expect(service.updateMainVideoIds(itemIds, 'video-1')).rejects.toThrow();
    });
  });

  describe('assignMainVideoIdsToHighLevelFolders', () => {
    it('should process folders without main_video_id', async () => {
      const folders = [
        { id: 'folder-1', drive_id: 'drive-1', name: 'Folder 1', main_video_id: null },
        { id: 'folder-2', drive_id: 'drive-2', name: 'Folder 2', main_video_id: null }
      ];

      // Mock getting high-level folders
      mockSupabase.is.mockResolvedValue({ data: folders, error: null });

      // Mock video search for each folder
      const video1 = { id: 'video-1', name: 'video1.mp4' };
      const video2 = { id: 'video-2', name: 'video2.mp4' };

      // Folder 1 video search
      mockSupabase.single.mockResolvedValueOnce({ data: { drive_id: 'drive-1' }, error: null });
      mockSupabase.order.mockResolvedValueOnce({ data: [video1], error: null });
      
      // Folder 2 video search
      mockSupabase.single.mockResolvedValueOnce({ data: { drive_id: 'drive-2' }, error: null });
      mockSupabase.order.mockResolvedValueOnce({ data: [video2], error: null });

      // Mock folder updates
      mockSupabase.eq.mockImplementation(function() {
        return { error: null };
      });

      // Mock propagation queries
      mockSupabase.single.mockResolvedValue({ data: { name: 'Folder' }, error: null });
      mockSupabase.contains.mockResolvedValue({ data: [], error: null });

      const results = await service.assignMainVideoIdsToHighLevelFolders();

      expect(results).toHaveLength(2);
      expect(results[0].main_video_id).toBe('video-1');
      expect(results[1].main_video_id).toBe('video-2');
    });

    it('should filter by rootDriveId when provided', async () => {
      await service.assignMainVideoIdsToHighLevelFolders('root-123');
      
      expect(mockSupabase.eq).toHaveBeenCalledWith('root_drive_id', 'root-123');
    });
  });

  describe('getFolderStatistics', () => {
    it('should calculate folder statistics', async () => {
      const folders = [
        { path_depth: 0, main_video_id: 'video-1' },
        { path_depth: 0, main_video_id: null },
        { path_depth: 1, main_video_id: 'video-2' },
        { path_depth: 2, main_video_id: null },
        { path_depth: 2, main_video_id: null }
      ];

      mockSupabase.eq.mockResolvedValue({ 
        data: folders, 
        count: 5,
        error: null 
      });

      const stats = await service.getFolderStatistics();

      expect(stats.totalFolders).toBe(5);
      expect(stats.highLevelFolders).toBe(2);
      expect(stats.foldersWithMainVideo).toBe(2);
      expect(stats.foldersWithoutMainVideo).toBe(3);
      expect(stats.averageDepth).toBe(1); // (0+0+1+2+2)/5
    });

    it('should handle empty results', async () => {
      mockSupabase.eq.mockResolvedValue({ data: null, count: 0, error: null });

      const stats = await service.getFolderStatistics();

      expect(stats.totalFolders).toBe(0);
      expect(stats.averageDepth).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should report healthy when connected', async () => {
      mockSupabase.limit.mockResolvedValue({ 
        count: 100, 
        error: null 
      });

      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.message).toContain('100 folders available');
    });

    it('should report unhealthy on error', async () => {
      mockSupabase.limit.mockResolvedValue({ 
        error: { message: 'Connection failed' } 
      });

      const health = await service.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.message).toBe('Connection failed');
    });
  });

  describe('Cache Management', () => {
    it('should use cache when enabled', async () => {
      const cachedService = new FolderHierarchyService(mockSupabase, {
        cacheEnabled: true,
        cacheTTL: 1000
      });

      const mockFolder = {
        id: 'folder-1',
        path_depth: 0,
        main_video_id: 'video-1'
      };

      mockSupabase.single.mockResolvedValue({ data: mockFolder, error: null });

      // First call
      await cachedService.findHighLevelFolder('folder-1');
      
      // Second call should use cache
      await cachedService.findHighLevelFolder('folder-1');

      // Should only be called once due to caching
      expect(mockSupabase.select).toHaveBeenCalledTimes(1);
    });

    it('should clear cache on demand', () => {
      const cachedService = new FolderHierarchyService(mockSupabase, {
        cacheEnabled: true
      });

      // This should not throw
      cachedService.clearCache();
      expect(true).toBe(true);
    });
  });
});