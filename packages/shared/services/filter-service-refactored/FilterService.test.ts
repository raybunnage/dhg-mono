import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FilterService } from './FilterService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../logger-service/LoggerService';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn()
} as unknown as SupabaseClient;

// Mock logger
const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
} as unknown as Logger;

// Mock data
const mockProfile = {
  id: 'test-profile-id',
  name: 'Test Profile',
  description: 'Test description',
  is_active: true,
  created_at: '2025-01-01T00:00:00Z'
};

const mockDrives = [
  { root_drive_id: 'drive-1' },
  { root_drive_id: 'drive-2' },
  { root_drive_id: 'drive-3' }
];

describe('FilterService', () => {
  let service: FilterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FilterService(mockSupabase, mockLogger);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Service Lifecycle', () => {
    it('should create an instance with supabase client', () => {
      expect(service).toBeInstanceOf(FilterService);
    });

    it('should create an instance without logger', () => {
      const serviceNoLogger = new FilterService(mockSupabase);
      expect(serviceNoLogger).toBeInstanceOf(FilterService);
    });

    it('should handle health check when healthy', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          count: 5,
          error: null
        })
      });
      (mockSupabase.from as any).mockReturnValue(mockFrom());

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.details.profileCount).toBe(5);
      expect(health.details.metrics).toBeDefined();
    });

    it('should handle health check when unhealthy', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          count: null,
          error: new Error('Database error')
        })
      });
      (mockSupabase.from as any).mockReturnValue(mockFrom());

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.error).toBe('Database error');
    });
  });

  describe('Profile Management', () => {
    describe('loadProfile', () => {
      it('should load a profile by ID', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockProfile,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation((table: string) => {
          if (table === 'filter_user_profiles') {
            return mockFrom();
          }
          // For profile drives
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: mockDrives,
                error: null
              })
            })
          };
        });

        const profile = await service.loadProfile('test-profile-id');
        
        expect(profile).toEqual(mockProfile);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'FilterService: Profile loaded successfully',
          expect.objectContaining({ profileId: 'test-profile-id' })
        );
      });

      it('should handle profile not found', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' }
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const profile = await service.loadProfile('non-existent');
        
        expect(profile).toBeNull();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('createProfile', () => {
      it('should create a new profile', async () => {
        const newProfile = {
          name: 'New Profile',
          description: 'New description',
          is_active: false
        };

        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...newProfile, id: 'new-id' },
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const created = await service.createProfile(newProfile);
        
        expect(created).toMatchObject(newProfile);
        expect(created?.id).toBe('new-id');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'FilterService: Profile created successfully',
          expect.any(Object)
        );
      });

      it('should handle creation error', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Creation failed' }
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const created = await service.createProfile({
          name: 'Failed Profile',
          is_active: false
        });
        
        expect(created).toBeNull();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('updateProfile', () => {
      it('should update a profile', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const updated = await service.updateProfile('test-id', {
          name: 'Updated Name'
        });
        
        expect(updated).toBe(true);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'FilterService: Profile updated successfully',
          expect.objectContaining({ profileId: 'test-id' })
        );
      });
    });

    describe('deleteProfile', () => {
      it('should delete a profile and its drives', async () => {
        const mockFromDrives = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null
            })
          })
        });
        
        const mockFromProfiles = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null
            })
          })
        });

        (mockSupabase.from as any).mockImplementation((table: string) => {
          if (table === 'filter_user_profile_drives') {
            return mockFromDrives();
          }
          return mockFromProfiles();
        });

        const deleted = await service.deleteProfile('test-id');
        
        expect(deleted).toBe(true);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'FilterService: Profile deleted successfully',
          expect.objectContaining({ profileId: 'test-id' })
        );
      });
    });
  });

  describe('Drive Management', () => {
    describe('getProfileDriveIds', () => {
      it('should fetch and cache drive IDs', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: mockDrives,
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const driveIds = await service.getProfileDriveIds('test-profile-id');
        
        expect(driveIds).toEqual(['drive-1', 'drive-2', 'drive-3']);
        
        // Second call should use cache
        const cachedDriveIds = await service.getProfileDriveIds('test-profile-id');
        expect(cachedDriveIds).toEqual(['drive-1', 'drive-2', 'drive-3']);
        expect(mockSupabase.from).toHaveBeenCalledTimes(1); // Only one DB call
      });

      it('should handle empty drive list', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const driveIds = await service.getProfileDriveIds('test-profile-id');
        
        expect(driveIds).toEqual([]);
      });
    });

    describe('addDrivesToProfile', () => {
      it('should add drives to a profile', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockResolvedValue({
            error: null
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const added = await service.addDrivesToProfile('test-profile-id', ['drive-4', 'drive-5']);
        
        expect(added).toBe(true);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'FilterService: Drives added successfully',
          expect.objectContaining({ driveCount: 2 })
        );
      });
    });

    describe('removeDrivesFromProfile', () => {
      it('should remove drives from a profile', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const removed = await service.removeDrivesFromProfile('test-profile-id', ['drive-1', 'drive-2']);
        
        expect(removed).toBe(true);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'FilterService: Drives removed successfully',
          expect.objectContaining({ driveCount: 2 })
        );
      });
    });
  });

  describe('Filter Application', () => {
    it('should apply filter to a query', async () => {
      // Mock profile loading
      const mockFromProfiles = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [mockProfile],
              error: null
            })
          })
        })
      });

      // Mock drive loading
      const mockFromDrives = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockDrives,
            error: null
          })
        })
      });

      // Mock sources loading
      const mockFromSources = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'source-1' }, { id: 'source-2' }],
            error: null
          })
        })
      });

      (mockSupabase.from as any).mockImplementation((table: string) => {
        if (table === 'filter_user_profiles') return mockFromProfiles();
        if (table === 'filter_user_profile_drives') return mockFromDrives();
        if (table === 'google_sources') return mockFromSources();
        return { select: vi.fn() };
      });

      const mockQuery = {
        in: vi.fn().mockReturnThis()
      };

      const filteredQuery = await service.applyFilterToQuery(mockQuery);
      
      expect(mockQuery.in).toHaveBeenCalledWith('id', ['source-1', 'source-2']);
      expect(filteredQuery).toBe(mockQuery);
    });

    it('should return unfiltered query when no active profile', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });
      (mockSupabase.from as any).mockReturnValue(mockFrom());

      const mockQuery = { in: vi.fn() };
      const result = await service.applyFilterToQuery(mockQuery);
      
      expect(result).toBe(mockQuery);
      expect(mockQuery.in).not.toHaveBeenCalled();
    });
  });

  describe('Metrics', () => {
    it('should track metrics correctly', async () => {
      // Create a profile
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      });
      (mockSupabase.from as any).mockReturnValue(mockFrom());

      await service.createProfile({
        name: 'Test Profile',
        is_active: false
      });

      const metrics = service.getMetrics();
      
      expect(metrics.profilesCreated).toBe(1);
      expect(metrics.errors).toBe(0);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache for specific profile', () => {
      // Add something to cache first
      (service as any).profileDrivesCache.set('profile-1', ['drive-1']);
      (service as any).profileDrivesCache.set('profile-2', ['drive-2']);
      
      service.clearDrivesCache('profile-1');
      
      expect((service as any).profileDrivesCache.has('profile-1')).toBe(false);
      expect((service as any).profileDrivesCache.has('profile-2')).toBe(true);
    });

    it('should clear all cache', () => {
      // Add something to cache first
      (service as any).profileDrivesCache.set('profile-1', ['drive-1']);
      (service as any).profileDrivesCache.set('profile-2', ['drive-2']);
      
      service.clearDrivesCache();
      
      expect((service as any).profileDrivesCache.size).toBe(0);
    });
  });

  describe('Active Profile Management', () => {
    it('should set a profile as active', async () => {
      const mockFrom = vi.fn();
      const mockUpdate = vi.fn();
      const mockNot = vi.fn();
      const mockEq = vi.fn();
      const mockSelect = vi.fn();
      const mockSingle = vi.fn();

      // Setup chain for deactivating all profiles
      mockNot.mockResolvedValue({ error: null });
      mockUpdate.mockReturnValue({ not: mockNot });
      
      // Setup chain for activating specific profile
      mockEq.mockResolvedValue({ error: null });
      const mockUpdateActive = vi.fn().mockReturnValue({ eq: mockEq });
      
      // Setup chain for loading profile
      mockSingle.mockResolvedValue({ data: mockProfile, error: null });
      mockEq.mockReturnValue({ single: mockSingle });
      mockSelect.mockReturnValue({ eq: mockEq });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          // First two calls are for updates
          return { update: callCount === 1 ? mockUpdate : mockUpdateActive };
        } else {
          // Subsequent calls are for selects
          return { select: mockSelect };
        }
      });

      (mockSupabase.from as any).mockImplementation(mockFrom);

      const result = await service.setActiveProfile('test-profile-id');
      
      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'FilterService: Active profile set successfully',
        expect.objectContaining({ profileId: 'test-profile-id' })
      );
    });

    it('should get the active profile', () => {
      // Set active profile directly
      (service as any).activeProfile = mockProfile;
      
      const active = service.getActiveProfile();
      
      expect(active).toEqual(mockProfile);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' }
          })
        })
      });
      (mockSupabase.from as any).mockReturnValue(mockFrom());

      const profiles = await service.listProfiles();
      
      expect(profiles).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
      
      const metrics = service.getMetrics();
      expect(metrics.errors).toBeGreaterThan(0);
    });

    it('should handle unexpected errors', async () => {
      const mockFrom = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const profiles = await service.listProfiles();
      
      expect(profiles).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'FilterService: Unexpected error in listProfiles',
        expect.any(Error)
      );
    });
  });

  describe('SQL Generation', () => {
    it('should generate migration SQL', () => {
      const sql = FilterService.generateMigrationSQL();
      
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS filter_user_profiles');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS filter_user_profile_drives');
      expect(sql).toContain('CREATE INDEX');
    });
  });
});