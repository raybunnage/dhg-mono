import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FilterService, FilterProfile, FilterProfileDrive } from '../FilterService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../base-classes/BaseService';

// Mock Supabase client factory
const createMockSupabase = () => {
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockEq = vi.fn();
  const mockIn = vi.fn();
  const mockNot = vi.fn();
  const mockLimit = vi.fn();
  const mockSingle = vi.fn();
  const mockOrder = vi.fn();

  // Chain-able API mock
  const queryBuilder = {
    select: mockSelect.mockReturnThis(),
    insert: mockInsert.mockReturnThis(),
    update: mockUpdate.mockReturnThis(),
    delete: mockDelete.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    in: mockIn.mockReturnThis(),
    not: mockNot.mockReturnThis(),
    limit: mockLimit.mockReturnThis(),
    single: mockSingle.mockReturnThis(),
    order: mockOrder.mockReturnThis()
  };

  // Reset all methods to return queryBuilder
  Object.keys(queryBuilder).forEach(key => {
    queryBuilder[key as keyof typeof queryBuilder].mockReturnValue(queryBuilder);
  });

  mockFrom.mockReturnValue(queryBuilder);

  return {
    from: mockFrom,
    queryBuilder,
    mocks: {
      mockFrom,
      mockSelect,
      mockInsert,
      mockUpdate,
      mockDelete,
      mockEq,
      mockIn,
      mockNot,
      mockLimit,
      mockSingle,
      mockOrder
    }
  } as any;
};

// Mock data fixtures
const createMockProfile = (overrides?: Partial<FilterProfile>): FilterProfile => ({
  id: 'test-profile-id',
  name: 'Test Profile',
  description: 'Test description',
  is_active: false,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides
});

const createMockProfileDrive = (overrides?: Partial<FilterProfileDrive>): FilterProfileDrive => ({
  id: 'test-drive-id',
  profile_id: 'test-profile-id',
  root_drive_id: 'test-root-drive-id',
  include_children: true,
  ...overrides
});

describe('FilterService', () => {
  let service: FilterService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockLogger: Logger;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    service = new FilterService(mockSupabase as any, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should create service instance with required dependencies', () => {
      expect(service).toBeDefined();
      expect(service.getActiveProfile()).toBeNull();
      expect(service.getMetrics()).toMatchObject({
        profilesLoaded: 0,
        profilesCreated: 0,
        profilesUpdated: 0,
        profilesDeleted: 0,
        drivesAdded: 0,
        drivesRemoved: 0,
        queriesFiltered: 0,
        cacheHits: 0,
        cacheMisses: 0,
        errors: 0
      });
    });

    it('should throw error when supabase client is not provided', () => {
      expect(() => new FilterService(null as any)).toThrow('SupabaseClient is required');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when database is accessible', async () => {
      mockSupabase.mocks.mockSelect.mockResolvedValueOnce({ count: 5, error: null });

      const result = await service.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.details.profileCount).toBe(5);
      expect(result.details.activeProfile).toBe('none');
      expect(result.details.cacheSize).toBe(0);
      expect(mockSupabase.from).toHaveBeenCalledWith('filter_user_profiles');
    });

    it('should return unhealthy status when database error occurs', async () => {
      const mockError = new Error('Database connection failed');
      mockSupabase.mocks.mockSelect.mockResolvedValueOnce({ count: null, error: mockError });

      const result = await service.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.details.error).toBe('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('FilterService: Health check failed', mockError);
    });
  });

  describe('loadProfile', () => {
    it('should load a profile by ID successfully', async () => {
      const mockProfile = createMockProfile();
      mockSupabase.mocks.mockSingle.mockResolvedValueOnce({ data: mockProfile, error: null });
      
      // Mock getProfileDriveIds
      mockSupabase.mocks.mockEq.mockImplementation(function(this: any) {
        if (arguments[0] === 'profile_id') {
          mockSupabase.mocks.mockSelect.mockResolvedValueOnce({ 
            data: [{ root_drive_id: 'drive-1' }, { root_drive_id: 'drive-2' }], 
            error: null 
          });
        }
        return this;
      });

      const result = await service.loadProfile('test-profile-id');

      expect(result).toEqual(mockProfile);
      expect(service.getActiveProfile()).toEqual(mockProfile);
      expect(service.getMetrics().profilesLoaded).toBe(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'FilterService: Profile loaded successfully',
        { profileId: 'test-profile-id', profileName: 'Test Profile' }
      );
    });

    it('should return null when profile not found', async () => {
      mockSupabase.mocks.mockSingle.mockResolvedValueOnce({ 
        data: null, 
        error: { message: 'Profile not found' } 
      });

      const result = await service.loadProfile('non-existent-id');

      expect(result).toBeNull();
      expect(service.getMetrics().errors).toBe(1);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('loadActiveProfile', () => {
    it('should load the active profile successfully', async () => {
      const mockProfile = createMockProfile({ is_active: true });
      mockSupabase.mocks.mockLimit.mockResolvedValueOnce({ 
        data: [mockProfile], 
        error: null 
      });
      
      // Mock getProfileDriveIds
      mockSupabase.mocks.mockEq.mockImplementation(function(this: any) {
        if (arguments[0] === 'profile_id') {
          mockSupabase.mocks.mockSelect.mockResolvedValueOnce({ 
            data: [{ root_drive_id: 'drive-1' }], 
            error: null 
          });
        }
        return this;
      });

      const result = await service.loadActiveProfile();

      expect(result).toEqual(mockProfile);
      expect(service.getActiveProfile()).toEqual(mockProfile);
      expect(mockSupabase.mocks.mockEq).toHaveBeenCalledWith('is_active', true);
    });

    it('should return null when no active profile exists', async () => {
      mockSupabase.mocks.mockLimit.mockResolvedValueOnce({ data: [], error: null });

      const result = await service.loadActiveProfile();

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('FilterService: No active profile found');
    });
  });

  describe('setActiveProfile', () => {
    it('should set a profile as active and deactivate others', async () => {
      const mockProfile = createMockProfile();
      
      // Mock deactivation of all profiles
      mockSupabase.mocks.mockNot.mockResolvedValueOnce({ error: null });
      
      // Mock activation of specific profile
      mockSupabase.mocks.mockEq.mockImplementation(function(this: any) {
        if (arguments[0] === 'id' && arguments[1] === 'test-profile-id') {
          return { error: null };
        }
        return this;
      });
      
      // Mock profile loading
      mockSupabase.mocks.mockSingle.mockResolvedValueOnce({ data: mockProfile, error: null });
      
      // Mock getProfileDriveIds
      mockSupabase.mocks.mockEq.mockImplementation(function(this: any) {
        if (arguments[0] === 'profile_id') {
          mockSupabase.mocks.mockSelect.mockResolvedValueOnce({ 
            data: [], 
            error: null 
          });
        }
        return this;
      });

      const result = await service.setActiveProfile('test-profile-id');

      expect(result).toBe(true);
      expect(mockSupabase.mocks.mockUpdate).toHaveBeenCalledWith({ is_active: false });
      expect(mockSupabase.mocks.mockUpdate).toHaveBeenCalledWith({ is_active: true });
    });

    it('should return false when deactivation fails', async () => {
      mockSupabase.mocks.mockNot.mockResolvedValueOnce({ 
        error: { message: 'Deactivation failed' } 
      });

      const result = await service.setActiveProfile('test-profile-id');

      expect(result).toBe(false);
      expect(service.getMetrics().errors).toBe(1);
    });
  });

  describe('Profile CRUD operations', () => {
    describe('createProfile', () => {
      it('should create a new profile successfully', async () => {
        const newProfile = { name: 'New Profile', description: 'New description', is_active: false };
        const createdProfile = createMockProfile({ ...newProfile, id: 'new-profile-id' });
        
        mockSupabase.mocks.mockSingle.mockResolvedValueOnce({ 
          data: createdProfile, 
          error: null 
        });

        const result = await service.createProfile(newProfile);

        expect(result).toEqual(createdProfile);
        expect(service.getMetrics().profilesCreated).toBe(1);
        expect(mockSupabase.mocks.mockInsert).toHaveBeenCalledWith(newProfile);
      });

      it('should return null when creation fails', async () => {
        mockSupabase.mocks.mockSingle.mockResolvedValueOnce({ 
          data: null, 
          error: { message: 'Creation failed' } 
        });

        const result = await service.createProfile({ 
          name: 'Test', 
          description: null, 
          is_active: false 
        });

        expect(result).toBeNull();
        expect(service.getMetrics().errors).toBe(1);
      });
    });

    describe('updateProfile', () => {
      it('should update a profile successfully', async () => {
        mockSupabase.mocks.mockEq.mockResolvedValueOnce({ error: null });

        const updates = { name: 'Updated Name', description: 'Updated description' };
        const result = await service.updateProfile('test-profile-id', updates);

        expect(result).toBe(true);
        expect(service.getMetrics().profilesUpdated).toBe(1);
        expect(mockSupabase.mocks.mockUpdate).toHaveBeenCalledWith(updates);
      });

      it('should reload active profile after update', async () => {
        const mockProfile = createMockProfile();
        
        // Set active profile
        mockSupabase.mocks.mockSingle.mockResolvedValueOnce({ data: mockProfile, error: null });
        mockSupabase.mocks.mockEq.mockImplementation(() => mockSupabase.queryBuilder);
        mockSupabase.mocks.mockSelect.mockResolvedValueOnce({ data: [], error: null });
        
        await service.loadProfile('test-profile-id');
        
        // Mock update
        mockSupabase.mocks.mockEq.mockResolvedValueOnce({ error: null });
        
        // Mock reload
        mockSupabase.mocks.mockSingle.mockResolvedValueOnce({ 
          data: { ...mockProfile, name: 'Updated Name' }, 
          error: null 
        });
        mockSupabase.mocks.mockSelect.mockResolvedValueOnce({ data: [], error: null });

        const result = await service.updateProfile('test-profile-id', { name: 'Updated Name' });

        expect(result).toBe(true);
        expect(service.getActiveProfile()?.name).toBe('Updated Name');
      });
    });

    describe('deleteProfile', () => {
      it('should delete a profile and associated drives', async () => {
        // Mock drive deletion
        mockSupabase.mocks.mockEq.mockResolvedValueOnce({ error: null });
        
        // Mock profile deletion
        mockSupabase.mocks.mockEq.mockResolvedValueOnce({ error: null });

        const result = await service.deleteProfile('test-profile-id');

        expect(result).toBe(true);
        expect(service.getMetrics().profilesDeleted).toBe(1);
        expect(mockSupabase.from).toHaveBeenCalledWith('filter_user_profile_drives');
        expect(mockSupabase.from).toHaveBeenCalledWith('filter_user_profiles');
      });

      it('should clear active profile if deleted', async () => {
        const mockProfile = createMockProfile();
        
        // Load profile first
        mockSupabase.mocks.mockSingle.mockResolvedValueOnce({ data: mockProfile, error: null });
        mockSupabase.mocks.mockSelect.mockResolvedValueOnce({ data: [], error: null });
        await service.loadProfile('test-profile-id');
        
        // Mock successful deletion
        mockSupabase.mocks.mockEq.mockResolvedValueOnce({ error: null });
        mockSupabase.mocks.mockEq.mockResolvedValueOnce({ error: null });

        const result = await service.deleteProfile('test-profile-id');

        expect(result).toBe(true);
        expect(service.getActiveProfile()).toBeNull();
      });
    });

    describe('listProfiles', () => {
      it('should list all profiles successfully', async () => {
        const mockProfiles = [
          createMockProfile({ id: '1', name: 'Profile 1' }),
          createMockProfile({ id: '2', name: 'Profile 2' })
        ];
        
        mockSupabase.mocks.mockOrder.mockResolvedValueOnce({ 
          data: mockProfiles, 
          error: null 
        });

        const result = await service.listProfiles();

        expect(result).toEqual(mockProfiles);
        expect(mockSupabase.mocks.mockOrder).toHaveBeenCalledWith('name');
      });

      it('should return empty array on error', async () => {
        mockSupabase.mocks.mockOrder.mockResolvedValueOnce({ 
          data: null, 
          error: { message: 'List failed' } 
        });

        const result = await service.listProfiles();

        expect(result).toEqual([]);
        expect(service.getMetrics().errors).toBe(1);
      });
    });
  });

  describe('Drive management', () => {
    describe('getProfileDriveIds', () => {
      it('should return cached drive IDs when available', async () => {
        // First call - fetch from database
        mockSupabase.mocks.mockEq.mockResolvedValueOnce({ 
          data: [
            { root_drive_id: 'drive-1' },
            { root_drive_id: 'drive-2' }
          ], 
          error: null 
        });

        const result1 = await service.getProfileDriveIds('test-profile-id');
        expect(result1).toEqual(['drive-1', 'drive-2']);
        expect(service.getMetrics().cacheMisses).toBe(1);

        // Second call - should use cache
        const result2 = await service.getProfileDriveIds('test-profile-id');
        expect(result2).toEqual(['drive-1', 'drive-2']);
        expect(service.getMetrics().cacheHits).toBe(1);
        expect(mockSupabase.from).toHaveBeenCalledTimes(1); // Not called again
      });

      it('should filter out null drive IDs', async () => {
        mockSupabase.mocks.mockEq.mockResolvedValueOnce({ 
          data: [
            { root_drive_id: 'drive-1' },
            { root_drive_id: null },
            { root_drive_id: 'drive-2' },
            { root_drive_id: undefined }
          ], 
          error: null 
        });

        const result = await service.getProfileDriveIds('test-profile-id');

        expect(result).toEqual(['drive-1', 'drive-2']);
      });
    });

    describe('addDrivesToProfile', () => {
      it('should add drives to profile successfully', async () => {
        mockSupabase.mocks.mockInsert.mockResolvedValueOnce({ error: null });

        const driveIds = ['drive-1', 'drive-2', 'drive-3'];
        const result = await service.addDrivesToProfile('test-profile-id', driveIds);

        expect(result).toBe(true);
        expect(service.getMetrics().drivesAdded).toBe(3);
        expect(mockSupabase.mocks.mockInsert).toHaveBeenCalledWith([
          { profile_id: 'test-profile-id', root_drive_id: 'drive-1', include_children: true },
          { profile_id: 'test-profile-id', root_drive_id: 'drive-2', include_children: true },
          { profile_id: 'test-profile-id', root_drive_id: 'drive-3', include_children: true }
        ]);
      });

      it('should clear cache after adding drives', async () => {
        // Populate cache first
        mockSupabase.mocks.mockEq.mockResolvedValueOnce({ 
          data: [{ root_drive_id: 'old-drive' }], 
          error: null 
        });
        await service.getProfileDriveIds('test-profile-id');
        
        // Add new drives
        mockSupabase.mocks.mockInsert.mockResolvedValueOnce({ error: null });
        await service.addDrivesToProfile('test-profile-id', ['new-drive']);
        
        // Next call should miss cache
        mockSupabase.mocks.mockEq.mockResolvedValueOnce({ 
          data: [{ root_drive_id: 'old-drive' }, { root_drive_id: 'new-drive' }], 
          error: null 
        });
        const result = await service.getProfileDriveIds('test-profile-id');
        
        expect(result).toEqual(['old-drive', 'new-drive']);
        expect(service.getMetrics().cacheMisses).toBe(2); // First call + this call
      });
    });

    describe('removeDrivesFromProfile', () => {
      it('should remove drives from profile successfully', async () => {
        mockSupabase.mocks.mockIn.mockResolvedValueOnce({ error: null });

        const driveIds = ['drive-1', 'drive-2'];
        const result = await service.removeDrivesFromProfile('test-profile-id', driveIds);

        expect(result).toBe(true);
        expect(service.getMetrics().drivesRemoved).toBe(2);
        expect(mockSupabase.mocks.mockIn).toHaveBeenCalledWith('root_drive_id', driveIds);
      });
    });

    describe('clearDrivesCache', () => {
      it('should clear cache for specific profile', async () => {
        // Populate cache for multiple profiles
        mockSupabase.mocks.mockEq.mockResolvedValueOnce({ 
          data: [{ root_drive_id: 'drive-1' }], 
          error: null 
        });
        await service.getProfileDriveIds('profile-1');
        
        mockSupabase.mocks.mockEq.mockResolvedValueOnce({ 
          data: [{ root_drive_id: 'drive-2' }], 
          error: null 
        });
        await service.getProfileDriveIds('profile-2');
        
        // Clear cache for profile-1 only
        service.clearDrivesCache('profile-1');
        
        // Profile-1 should miss cache
        mockSupabase.mocks.mockEq.mockResolvedValueOnce({ 
          data: [{ root_drive_id: 'drive-1' }], 
          error: null 
        });
        await service.getProfileDriveIds('profile-1');
        expect(service.getMetrics().cacheMisses).toBe(3);
        
        // Profile-2 should hit cache
        await service.getProfileDriveIds('profile-2');
        expect(service.getMetrics().cacheHits).toBe(1);
      });

      it('should clear all cache when no profile ID provided', () => {
        service.clearDrivesCache();
        expect(mockLogger.debug).toHaveBeenCalledWith('FilterService: Cleared all drives cache');
      });
    });
  });

  describe('applyFilterToQuery', () => {
    it('should apply filter based on active profile', async () => {
      const mockQuery = { in: vi.fn().mockReturnThis() };
      
      // Mock active profile loading
      mockSupabase.mocks.mockLimit.mockResolvedValueOnce({ 
        data: [createMockProfile({ is_active: true })], 
        error: null 
      });
      
      // Mock getProfileDriveIds
      mockSupabase.mocks.mockEq.mockResolvedValueOnce({ 
        data: [{ root_drive_id: 'drive-1' }, { root_drive_id: 'drive-2' }], 
        error: null 
      });
      
      // Mock google_sources query
      mockSupabase.mocks.mockIn.mockResolvedValueOnce({ 
        data: [{ id: 'source-1' }, { id: 'source-2' }, { id: 'source-3' }], 
        error: null 
      });

      const result = await service.applyFilterToQuery(mockQuery);

      expect(result).toBe(mockQuery);
      expect(mockQuery.in).toHaveBeenCalledWith('id', ['source-1', 'source-2', 'source-3']);
      expect(service.getMetrics().queriesFiltered).toBe(1);
    });

    it('should use provided profile ID instead of loading active', async () => {
      const mockQuery = { in: vi.fn().mockReturnThis() };
      
      // Mock getProfileDriveIds
      mockSupabase.mocks.mockEq.mockResolvedValueOnce({ 
        data: [{ root_drive_id: 'drive-1' }], 
        error: null 
      });
      
      // Mock google_sources query
      mockSupabase.mocks.mockIn.mockResolvedValueOnce({ 
        data: [{ id: 'source-1' }], 
        error: null 
      });

      const result = await service.applyFilterToQuery(mockQuery, 'specific-profile-id');

      expect(result).toBe(mockQuery);
      expect(mockQuery.in).toHaveBeenCalledWith('id', ['source-1']);
      // Should not have loaded active profile
      expect(mockSupabase.mocks.mockLimit).not.toHaveBeenCalled();
    });

    it('should return unmodified query when no active profile', async () => {
      const mockQuery = { in: vi.fn().mockReturnThis() };
      
      // Mock no active profile
      mockSupabase.mocks.mockLimit.mockResolvedValueOnce({ 
        data: [], 
        error: null 
      });

      const result = await service.applyFilterToQuery(mockQuery);

      expect(result).toBe(mockQuery);
      expect(mockQuery.in).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('FilterService: No active profile found for filtering');
    });

    it('should return unmodified query when no drive IDs found', async () => {
      const mockQuery = { in: vi.fn().mockReturnThis() };
      
      // Mock active profile
      mockSupabase.mocks.mockLimit.mockResolvedValueOnce({ 
        data: [createMockProfile({ is_active: true })], 
        error: null 
      });
      
      // Mock no drive IDs
      mockSupabase.mocks.mockEq.mockResolvedValueOnce({ 
        data: [], 
        error: null 
      });

      const result = await service.applyFilterToQuery(mockQuery);

      expect(result).toBe(mockQuery);
      expect(mockQuery.in).not.toHaveBeenCalled();
    });

    it('should limit source IDs to avoid URL length issues', async () => {
      const mockQuery = { in: vi.fn().mockReturnThis() };
      
      // Create more than 1500 source IDs
      const manySources = Array.from({ length: 2000 }, (_, i) => ({ id: `source-${i}` }));
      
      // Mock active profile
      mockSupabase.mocks.mockLimit.mockResolvedValueOnce({ 
        data: [createMockProfile({ is_active: true })], 
        error: null 
      });
      
      // Mock drive IDs
      mockSupabase.mocks.mockEq.mockResolvedValueOnce({ 
        data: [{ root_drive_id: 'drive-1' }], 
        error: null 
      });
      
      // Mock many sources
      mockSupabase.mocks.mockIn.mockResolvedValueOnce({ 
        data: manySources, 
        error: null 
      });

      const result = await service.applyFilterToQuery(mockQuery);

      expect(result).toBe(mockQuery);
      expect(mockQuery.in).toHaveBeenCalled();
      const calledSourceIds = mockQuery.in.mock.calls[0][1];
      expect(calledSourceIds.length).toBe(1500);
      expect(calledSourceIds[0]).toBe('source-0');
      expect(calledSourceIds[1499]).toBe('source-1499');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'FilterService: Limiting source IDs due to URL length constraints',
        { total: 2000, limit: 1500 }
      );
    });

    it('should handle errors gracefully and return unmodified query', async () => {
      const mockQuery = { in: vi.fn().mockReturnThis() };
      const mockError = new Error('Database error');
      
      // Mock active profile
      mockSupabase.mocks.mockLimit.mockResolvedValueOnce({ 
        data: [createMockProfile({ is_active: true })], 
        error: null 
      });
      
      // Mock drive IDs
      mockSupabase.mocks.mockEq.mockResolvedValueOnce({ 
        data: [{ root_drive_id: 'drive-1' }], 
        error: null 
      });
      
      // Mock error in sources query
      mockSupabase.mocks.mockIn.mockResolvedValueOnce({ 
        data: null, 
        error: mockError 
      });

      const result = await service.applyFilterToQuery(mockQuery);

      expect(result).toBe(mockQuery);
      expect(mockQuery.in).not.toHaveBeenCalled();
      expect(service.getMetrics().errors).toBe(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'FilterService: Error querying sources with root_drive_id',
        mockError
      );
    });
  });

  describe('getMetrics', () => {
    it('should return a copy of metrics', async () => {
      // Perform some operations to update metrics
      mockSupabase.mocks.mockOrder.mockResolvedValueOnce({ 
        data: [createMockProfile()], 
        error: null 
      });
      await service.listProfiles();
      
      const metrics1 = service.getMetrics();
      const metrics2 = service.getMetrics();
      
      expect(metrics1).not.toBe(metrics2); // Different objects
      expect(metrics1).toEqual(metrics2); // Same values
    });
  });

  describe('generateMigrationSQL', () => {
    it('should generate correct SQL migration', () => {
      const sql = FilterService.generateMigrationSQL();
      
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS filter_user_profiles');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS filter_user_profile_drives');
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_filter_profiles_active');
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_filter_profile_drives_profile_id');
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_filter_profile_drives_root_drive_id');
    });
  });
});