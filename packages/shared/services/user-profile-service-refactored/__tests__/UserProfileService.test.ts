import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { UserProfileService } from '../UserProfileService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../base-classes/BaseService';
import { 
  ProfileFormData, 
  ProfileResult, 
  UserProfileServiceMetrics, 
  ProfileStats 
} from '../types';
import { Database } from '../../../../../supabase/types';

type UserProfile = Database['public']['Tables']['auth_user_profiles']['Row'];

// Mock Supabase client factory
const createMockSupabase = () => {
  const mockFrom = vi.fn();
  
  return {
    from: mockFrom
  } as unknown as SupabaseClient;
};

// Mock logger factory
const createMockLogger = () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}) as unknown as Logger;

// Mock data fixtures
const createMockProfile = (overrides?: Partial<UserProfile>): UserProfile => ({
  id: 'test-email-id',
  profession: 'Software Engineer',
  professional_title: 'Senior Developer',
  years_experience: 5,
  industry_sectors: ['Technology'],
  specialty_areas: ['Frontend', 'Backend'],
  credentials: ['BSc Computer Science'],
  learning_goals: ['Master TypeScript', 'Learn AI/ML'],
  reason_for_learning: 'Career advancement',
  preferred_formats: ['video', 'audio'],
  learning_pace: 'self-paced',
  time_commitment: '5 hours/week',
  preferred_depth: 'intermediate',
  preferred_session_length: 30,
  interested_topics: ['AI', 'Machine Learning', 'TypeScript'],
  interested_experts: ['Expert 1', 'Expert 2'],
  avoided_topics: ['Legacy systems'],
  priority_subjects: ['AI', 'Cloud Computing'],
  content_tags_following: ['ai', 'ml', 'typescript'],
  bio_summary: 'Experienced developer looking to expand skills',
  learning_background: 'Self-taught and bootcamp graduate',
  current_challenges: 'Keeping up with rapid tech changes',
  intended_application: 'Build AI-powered applications',
  referral_source: 'Google search',
  profile_completeness: 85,
  onboarding_completed: true,
  last_activity: '2025-01-01T00:00:00Z',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides
});

const createMockProfileFormData = (overrides?: Partial<ProfileFormData>): ProfileFormData => ({
  profession: 'Software Engineer',
  professional_title: 'Senior Developer',
  years_experience: 5,
  industry_sectors: ['Technology'],
  specialty_areas: ['Frontend', 'Backend'],
  credentials: ['BSc Computer Science'],
  learning_goals: ['Master TypeScript', 'Learn AI/ML'],
  reason_for_learning: 'Career advancement',
  preferred_formats: ['video', 'audio'],
  learning_pace: 'self-paced',
  time_commitment: '5 hours/week',
  preferred_depth: 'intermediate',
  preferred_session_length: 30,
  interested_topics: ['AI', 'Machine Learning', 'TypeScript'],
  interested_experts: ['Expert 1', 'Expert 2'],
  avoided_topics: ['Legacy systems'],
  priority_subjects: ['AI', 'Cloud Computing'],
  content_tags_following: ['ai', 'ml', 'typescript'],
  bio_summary: 'Experienced developer looking to expand skills',
  learning_background: 'Self-taught and bootcamp graduate',
  current_challenges: 'Keeping up with rapid tech changes',
  intended_application: 'Build AI-powered applications',
  referral_source: 'Google search',
  ...overrides
});

describe('UserProfileService', () => {
  let service: UserProfileService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockLogger = createMockLogger();
    service = new UserProfileService(mockSupabase, mockLogger);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Constructor and Initialization', () => {
    it('should create an instance with required dependencies', () => {
      expect(service).toBeInstanceOf(UserProfileService);
      expect(service.getName()).toBe('UserProfileService');
    });

    it('should create an instance without optional logger', () => {
      const serviceNoLogger = new UserProfileService(mockSupabase);
      expect(serviceNoLogger).toBeInstanceOf(UserProfileService);
    });

    it('should throw error when supabase client is not provided', () => {
      expect(() => new UserProfileService(null as any)).toThrow('UserProfileService requires a SupabaseClient');
    });

    it('should validate dependencies on construction', () => {
      expect(() => new UserProfileService(undefined as any)).toThrow();
    });
  });

  describe('Service Pattern', () => {
    it('should follow business service pattern with dependency injection', () => {
      const service1 = new UserProfileService(mockSupabase);
      const service2 = new UserProfileService(mockSupabase);
      
      expect(service1).not.toBe(service2);
      expect(service1).toBeInstanceOf(UserProfileService);
      expect(service2).toBeInstanceOf(UserProfileService);
    });

    it('should accept different supabase instances', () => {
      const mockSupabase2 = createMockSupabase();
      const service2 = new UserProfileService(mockSupabase2, mockLogger);
      
      expect(service).not.toBe(service2);
      expect(service2).toBeInstanceOf(UserProfileService);
    });
  });

  describe('Health Check', () => {
    it('should report healthy when database is accessible', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ id: 'test-id' }],
            error: null
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.databaseConnected).toBe(true);
      expect(health.details.profileTableAccessible).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should report unhealthy when database is not accessible', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Database connection failed')
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.databaseConnected).toBe(false);
      expect(health.details.profileTableAccessible).toBe(false);
    });

    it('should include metrics in health check details', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ id: 'test-id' }],
            error: null
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const health = await service.healthCheck();
      
      expect(health.details.metrics).toBeDefined();
      expect(health.details.metrics).toHaveProperty('profilesCreated');
      expect(health.details.metrics).toHaveProperty('profilesUpdated');
      expect(health.details.metrics).toHaveProperty('profilesRetrieved');
    });

    it('should handle exceptions during health check', async () => {
      const mockFrom = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Health check failed', expect.any(Object));
    });
  });

  describe('getProfile', () => {
    it('should retrieve existing profile successfully', async () => {
      const mockProfile = createMockProfile();
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
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const result = await service.getProfile('test-email-id');

      expect(result.success).toBe(true);
      expect(result.profile).toEqual(mockProfile);
      expect(result.error).toBeUndefined();
      expect(mockFrom).toHaveBeenCalledWith('auth_user_profiles');
    });

    it('should handle non-existent profile gracefully', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Row not found' }
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const result = await service.getProfile('non-existent-id');

      expect(result.success).toBe(true);
      expect(result.profile).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('should handle database errors', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const result = await service.getProfile('test-email-id');

      expect(result.success).toBe(false);
      expect(result.profile).toBeUndefined();
      expect(result.error).toBe('Database error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should track metrics for successful retrieval', async () => {
      const mockProfile = createMockProfile();
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
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await service.getProfile('test-email-id');
      const metrics = service.getMetrics();

      expect(metrics.profilesRetrieved).toBe(1);
      expect(metrics.profileLookupsFailed).toBe(0);
    });

    it('should handle exceptions during profile retrieval', async () => {
      const mockFrom = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const result = await service.getProfile('test-email-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('saveProfile', () => {
    it('should create new profile successfully', async () => {
      const profileData = createMockProfileFormData();
      const savedProfile = createMockProfile();
      
      const mockFrom = vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: savedProfile,
              error: null
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const result = await service.saveProfile('test-email-id', profileData);

      expect(result.success).toBe(true);
      expect(result.profile).toEqual(savedProfile);
      expect(result.error).toBeUndefined();
    });

    it('should update existing profile successfully', async () => {
      const profileData = createMockProfileFormData({ profession: 'Data Scientist' });
      const updatedProfile = createMockProfile({ 
        profession: 'Data Scientist',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z'
      });
      
      const mockFrom = vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: updatedProfile,
              error: null
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const result = await service.saveProfile('test-email-id', profileData);

      expect(result.success).toBe(true);
      expect(result.profile?.profession).toBe('Data Scientist');
    });

    it('should calculate profile completeness correctly', async () => {
      const minimalProfile = createMockProfileFormData({
        profession: 'Developer',
        learning_goals: ['Learn'],
        reason_for_learning: 'Growth',
        interested_topics: ['Tech'],
        // All optional fields omitted
        professional_title: undefined,
        years_experience: undefined,
        industry_sectors: undefined,
        specialty_areas: undefined,
        credentials: undefined,
        preferred_formats: undefined,
        learning_pace: undefined,
        time_commitment: undefined,
        preferred_depth: undefined,
        preferred_session_length: undefined,
        interested_experts: undefined,
        priority_subjects: undefined,
        bio_summary: undefined,
        learning_background: undefined,
        current_challenges: undefined,
        intended_application: undefined,
        referral_source: undefined
      });

      const mockFrom = vi.fn().mockReturnValue({
        upsert: vi.fn((data) => ({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...createMockProfile(), profile_completeness: data[0].profile_completeness },
              error: null
            })
          })
        }))
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await service.saveProfile('test-email-id', minimalProfile);

      const upsertCall = (mockSupabase.from as any).mock.results[0].value.upsert.mock.calls[0];
      const savedData = upsertCall[0];
      
      // Required fields (4 * 10 = 40) out of total (40 + 17*3 = 91) ≈ 44%
      expect(savedData.profile_completeness).toBeLessThan(50);
      expect(savedData.onboarding_completed).toBe(false);
    });

    it('should mark onboarding as completed when completeness >= 80%', async () => {
      const completeProfile = createMockProfileFormData();
      
      const mockFrom = vi.fn().mockReturnValue({
        upsert: vi.fn((data) => ({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...createMockProfile(), ...data[0] },
              error: null
            })
          })
        }))
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await service.saveProfile('test-email-id', completeProfile);

      const upsertCall = (mockSupabase.from as any).mock.results[0].value.upsert.mock.calls[0];
      const savedData = upsertCall[0];
      
      expect(savedData.profile_completeness).toBeGreaterThanOrEqual(80);
      expect(savedData.onboarding_completed).toBe(true);
    });

    it('should handle save errors', async () => {
      const profileData = createMockProfileFormData();
      
      const mockFrom = vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Save failed' }
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const result = await service.saveProfile('test-email-id', profileData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Save failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should track metrics for profile saves', async () => {
      const profileData = createMockProfileFormData();
      const savedProfile = createMockProfile();
      
      const mockFrom = vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: savedProfile,
              error: null
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await service.saveProfile('test-email-id', profileData);
      const metrics = service.getMetrics();

      expect(metrics.profilesCreated).toBe(1);
      expect(metrics.onboardingCompletions).toBe(1);
    });
  });

  describe('updateProfile', () => {
    it('should update specific fields successfully', async () => {
      const updates = { profession: 'AI Engineer', years_experience: 7 };
      const updatedProfile = createMockProfile(updates);
      
      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: updatedProfile,
                error: null
              })
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const result = await service.updateProfile('test-email-id', updates);

      expect(result.success).toBe(true);
      expect(result.profile?.profession).toBe('AI Engineer');
      expect(result.profile?.years_experience).toBe(7);
    });

    it('should update last_activity timestamp', async () => {
      const updates = { profession: 'AI Engineer' };
      
      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn((data) => ({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: createMockProfile({ ...updates, last_activity: data.last_activity }),
                error: null
              })
            })
          })
        }))
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await service.updateProfile('test-email-id', updates);

      const updateCall = (mockSupabase.from as any).mock.results[0].value.update.mock.calls[0];
      expect(updateCall[0].last_activity).toBeDefined();
      expect(new Date(updateCall[0].last_activity)).toBeInstanceOf(Date);
    });

    it('should handle update errors', async () => {
      const updates = { profession: 'AI Engineer' };
      
      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Update failed' }
              })
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const result = await service.updateProfile('test-email-id', updates);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('hasCompletedOnboarding', () => {
    it('should return true for completed onboarding', async () => {
      const mockProfile = createMockProfile({ onboarding_completed: true });
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
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const result = await service.hasCompletedOnboarding('test-email-id');

      expect(result).toBe(true);
    });

    it('should return false for incomplete onboarding', async () => {
      const mockProfile = createMockProfile({ onboarding_completed: false });
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
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const result = await service.hasCompletedOnboarding('test-email-id');

      expect(result).toBe(false);
    });

    it('should return false when profile does not exist', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Row not found' }
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const result = await service.hasCompletedOnboarding('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('getRecommendedTopics', () => {
    it('should return topics from interested_topics and priority_subjects', async () => {
      const mockProfile = createMockProfile({
        interested_topics: ['AI', 'Machine Learning', 'TypeScript'],
        priority_subjects: ['Cloud Computing', 'AI'] // Note: AI is duplicate
      });
      
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
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const topics = await service.getRecommendedTopics('test-email-id');

      expect(topics).toContain('AI');
      expect(topics).toContain('Machine Learning');
      expect(topics).toContain('TypeScript');
      expect(topics).toContain('Cloud Computing');
      expect(topics.length).toBe(4); // Duplicates removed
    });

    it('should return empty array when no profile exists', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Row not found' }
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const topics = await service.getRecommendedTopics('non-existent-id');

      expect(topics).toEqual([]);
    });

    it('should track recommendation generation in metrics', async () => {
      const mockProfile = createMockProfile();
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
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await service.getRecommendedTopics('test-email-id');
      const metrics = service.getMetrics();

      expect(metrics.recommendationsGenerated).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      const mockFrom = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const topics = await service.getRecommendedTopics('test-email-id');

      expect(topics).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getProfileStats', () => {
    it('should return profile statistics', async () => {
      const mockProfile = createMockProfile({
        profile_completeness: 85,
        interested_topics: ['AI', 'ML', 'Cloud'],
        learning_goals: ['Master AI', 'Build ML models'],
        last_activity: '2025-01-15T10:00:00Z'
      });
      
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
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const stats = await service.getProfileStats('test-email-id');

      expect(stats.completeness).toBe(85);
      expect(stats.topicsCount).toBe(3);
      expect(stats.goalsCount).toBe(2);
      expect(stats.lastActivity).toBe('2025-01-15T10:00:00Z');
    });

    it('should return zero stats for non-existent profile', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Row not found' }
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const stats = await service.getProfileStats('non-existent-id');

      expect(stats.completeness).toBe(0);
      expect(stats.topicsCount).toBe(0);
      expect(stats.goalsCount).toBe(0);
      expect(stats.lastActivity).toBeNull();
    });
  });

  describe('Metrics', () => {
    it('should track all operations in metrics', async () => {
      const mockProfile = createMockProfile();
      const profileData = createMockProfileFormData();
      
      // Setup mock for various operations
      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === 'auth_user_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockProfile,
                  error: null
                })
              }),
              limit: vi.fn().mockResolvedValue({
                data: [{ id: 'test' }],
                error: null
              })
            }),
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockProfile,
                  error: null
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockProfile,
                    error: null
                  })
                })
              })
            })
          };
        }
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      // Perform various operations
      await service.getProfile('test-email-id');
      await service.saveProfile('test-email-id', profileData);
      await service.updateProfile('test-email-id', { profession: 'Updated' });
      await service.getRecommendedTopics('test-email-id');

      const metrics = service.getMetrics();

      expect(metrics.profilesRetrieved).toBeGreaterThan(0);
      expect(metrics.profilesCreated).toBeGreaterThan(0);
      expect(metrics.profilesUpdated).toBeGreaterThan(0);
      expect(metrics.recommendationsGenerated).toBeGreaterThan(0);
      expect(metrics.errors).toBe(0);
    });

    it('should calculate average profile completeness', async () => {
      const profileData1 = createMockProfileFormData();
      const profileData2 = createMockProfileFormData({
        // Minimal profile
        profession: 'Dev',
        learning_goals: ['Learn'],
        reason_for_learning: 'Growth',
        interested_topics: ['Tech'],
        professional_title: undefined,
        years_experience: undefined,
        industry_sectors: undefined,
        specialty_areas: undefined,
        credentials: undefined,
        bio_summary: undefined
      });

      const mockFrom = vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: createMockProfile(),
              error: null
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await service.saveProfile('test-email-id-1', profileData1);
      await service.saveProfile('test-email-id-2', profileData2);

      const metrics = service.getMetrics();

      expect(metrics.profileCompletenessCount).toBe(2);
      expect(metrics.averageProfileCompleteness).toBeGreaterThan(0);
      expect(metrics.averageProfileCompleteness).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle exceptions in all methods gracefully', async () => {
      const mockFrom = vi.fn().mockImplementation(() => {
        throw new Error('Database connection lost');
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      // Test each method
      const profileResult = await service.getProfile('test-id');
      expect(profileResult.success).toBe(false);
      expect(profileResult.error).toContain('Database connection lost');

      const saveResult = await service.saveProfile('test-id', createMockProfileFormData());
      expect(saveResult.success).toBe(false);

      const updateResult = await service.updateProfile('test-id', { profession: 'New' });
      expect(updateResult.success).toBe(false);

      const topics = await service.getRecommendedTopics('test-id');
      expect(topics).toEqual([]);

      // Check that errors were logged
      expect(mockLogger.error).toHaveBeenCalledTimes(4);
    });
  });

  describe('Integration Tests', () => {
    it('should handle full user onboarding flow', async () => {
      // Start with no profile
      let profileExists = false;
      let savedProfile: UserProfile | null = null;

      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === 'auth_user_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(() => {
                  if (!profileExists) {
                    return Promise.resolve({
                      data: null,
                      error: { code: 'PGRST116', message: 'Row not found' }
                    });
                  }
                  return Promise.resolve({
                    data: savedProfile,
                    error: null
                  });
                })
              })
            }),
            upsert: vi.fn((data) => {
              profileExists = true;
              savedProfile = { ...createMockProfile(), ...data[0] };
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: savedProfile,
                    error: null
                  })
                })
              };
            })
          };
        }
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      // Check initial state - no profile
      const hasOnboarded = await service.hasCompletedOnboarding('new-user-id');
      expect(hasOnboarded).toBe(false);

      // Create minimal profile
      const minimalProfile = createMockProfileFormData({
        profession: 'Student',
        learning_goals: ['Learn programming'],
        reason_for_learning: 'Career change',
        interested_topics: ['JavaScript'],
        // Leave most fields empty
        professional_title: undefined,
        years_experience: undefined,
        bio_summary: undefined
      });

      const saveResult1 = await service.saveProfile('new-user-id', minimalProfile);
      expect(saveResult1.success).toBe(true);
      expect(saveResult1.profile?.onboarding_completed).toBe(false);

      // Complete profile
      const completeProfile = createMockProfileFormData();
      const saveResult2 = await service.saveProfile('new-user-id', completeProfile);
      expect(saveResult2.success).toBe(true);
      expect(saveResult2.profile?.onboarding_completed).toBe(true);

      // Verify recommendations are available
      const topics = await service.getRecommendedTopics('new-user-id');
      expect(topics.length).toBeGreaterThan(0);
    });
  });
});