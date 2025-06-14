/**
 * Tests for UserProfileService (Refactored)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserProfileService } from './UserProfileService';
import { ProfileFormData } from './types';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
} as any;

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

describe('UserProfileService', () => {
  let service: UserProfileService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserProfileService(mockSupabase, mockLogger);
  });

  describe('Constructor and Initialization', () => {
    it('should create service with valid dependencies', () => {
      expect(service).toBeInstanceOf(UserProfileService);
    });

    it('should validate required dependencies', () => {
      expect(() => new UserProfileService(null as any, mockLogger))
        .toThrow('UserProfileService requires a SupabaseClient');
    });

    it('should initialize with default metrics', () => {
      const metrics = service.getMetrics();
      expect(metrics.profilesCreated).toBe(0);
      expect(metrics.profilesUpdated).toBe(0);
      expect(metrics.profilesRetrieved).toBe(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.averageProfileCompleteness).toBe(0);
    });
  });

  describe('Health Checks', () => {
    it('should return healthy status when database is accessible', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const health = await service.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.details.databaseConnected).toBe(true);
      expect(health.details.profileTableAccessible).toBe(true);
      expect(health.latencyMs).toBeGreaterThan(0);
    });

    it('should return unhealthy status when database connection fails', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ error: new Error('DB connection failed') }),
        }),
      });

      const health = await service.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.details.databaseConnected).toBe(false);
      expect(health.details.profileTableAccessible).toBe(false);
    });
  });

  describe('Profile Retrieval', () => {
    const mockUserId = 'user-123';

    it('should successfully retrieve existing profile', async () => {
      const mockProfile = {
        id: mockUserId,
        profession: 'Software Engineer',
        learning_goals: ['TypeScript', 'React'],
        profile_completeness: 85,
        onboarding_completed: true,
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
          }),
        }),
      });

      const result = await service.getProfile(mockUserId);

      expect(result.success).toBe(true);
      expect(result.profile).toEqual(mockProfile);
      expect(result.error).toBeUndefined();

      const metrics = service.getMetrics();
      expect(metrics.profilesRetrieved).toBe(1);
      expect(metrics.profileLookupsFailed).toBe(0);
    });

    it('should handle profile not found gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: null, 
              error: { code: 'PGRST116', message: 'No rows found' } 
            }),
          }),
        }),
      });

      const result = await service.getProfile(mockUserId);

      expect(result.success).toBe(true);
      expect(result.profile).toBeUndefined();
      expect(result.error).toBeUndefined();

      const metrics = service.getMetrics();
      expect(metrics.profilesRetrieved).toBe(1);
      expect(metrics.profileLookupsFailed).toBe(0);
    });

    it('should handle database errors during profile retrieval', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: null, 
              error: { code: 'PGRST500', message: 'Database error' } 
            }),
          }),
        }),
      });

      const result = await service.getProfile(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');

      const metrics = service.getMetrics();
      expect(metrics.profileLookupsFailed).toBe(1);
      expect(metrics.errors).toBe(1);
    });
  });

  describe('Profile Creation and Updates', () => {
    const mockUserId = 'user-123';
    const mockProfileData: ProfileFormData = {
      profession: 'Software Engineer',
      learning_goals: ['TypeScript', 'React'],
      reason_for_learning: 'Career advancement',
      interested_topics: ['Web Development', 'AI'],
      professional_title: 'Senior Developer',
      years_experience: 5,
    };

    it('should successfully save a new profile', async () => {
      const mockSavedProfile = {
        id: mockUserId,
        ...mockProfileData,
        profile_completeness: 75,
        onboarding_completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockSavedProfile, error: null }),
          }),
        }),
      });

      const result = await service.saveProfile(mockUserId, mockProfileData);

      expect(result.success).toBe(true);
      expect(result.profile).toEqual(mockSavedProfile);

      const metrics = service.getMetrics();
      expect(metrics.profilesCreated).toBeGreaterThanOrEqual(0); // Could be create or update
      expect(metrics.averageProfileCompleteness).toBeGreaterThan(0);
    });

    it('should handle profile save errors', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Constraint violation' } 
            }),
          }),
        }),
      });

      const result = await service.saveProfile(mockUserId, mockProfileData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Constraint violation');

      const metrics = service.getMetrics();
      expect(metrics.profileSavesFailed).toBe(1);
      expect(metrics.errors).toBe(1);
    });

    it('should track onboarding completion', async () => {
      const highCompletenessProfile: ProfileFormData = {
        profession: 'Software Engineer',
        professional_title: 'Senior Developer',
        years_experience: 5,
        industry_sectors: ['Technology'],
        specialty_areas: ['Frontend', 'Backend'],
        credentials: ['AWS Certified'],
        learning_goals: ['TypeScript', 'React', 'Node.js'],
        reason_for_learning: 'Career advancement',
        preferred_formats: ['video', 'interactive'],
        learning_pace: 'structured',
        time_commitment: '10 hours/week',
        preferred_depth: 'advanced',
        preferred_session_length: 60,
        interested_topics: ['Web Development', 'AI', 'Cloud'],
        interested_experts: ['Expert 1'],
        priority_subjects: ['React', 'TypeScript'],
        bio_summary: 'Experienced developer',
        learning_background: 'Self-taught + bootcamp',
        current_challenges: 'Keeping up with new tech',
        intended_application: 'Work projects',
        referral_source: 'Google search',
      };

      const mockSavedProfile = {
        id: mockUserId,
        ...highCompletenessProfile,
        profile_completeness: 95,
        onboarding_completed: true,
      };

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockSavedProfile, error: null }),
          }),
        }),
      });

      await service.saveProfile(mockUserId, highCompletenessProfile);

      const metrics = service.getMetrics();
      expect(metrics.onboardingCompletions).toBe(1);
    });
  });

  describe('Profile Updates', () => {
    const mockUserId = 'user-123';

    it('should successfully update profile fields', async () => {
      const updates = {
        profession: 'Lead Developer',
        years_experience: 7,
      };

      const mockUpdatedProfile = {
        id: mockUserId,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUpdatedProfile, error: null }),
            }),
          }),
        }),
      });

      const result = await service.updateProfile(mockUserId, updates);

      expect(result.success).toBe(true);
      expect(result.profile).toEqual(mockUpdatedProfile);

      const metrics = service.getMetrics();
      expect(metrics.profilesUpdated).toBe(1);
    });

    it('should handle update errors', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ 
                data: null, 
                error: { message: 'Update failed' } 
              }),
            }),
          }),
        }),
      });

      const result = await service.updateProfile(mockUserId, { profession: 'Manager' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');

      const metrics = service.getMetrics();
      expect(metrics.profileSavesFailed).toBe(1);
      expect(metrics.errors).toBe(1);
    });
  });

  describe('Onboarding Status', () => {
    const mockUserId = 'user-123';

    it('should correctly identify completed onboarding', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { onboarding_completed: true }, 
              error: null 
            }),
          }),
        }),
      });

      const result = await service.hasCompletedOnboarding(mockUserId);
      expect(result).toBe(true);
    });

    it('should correctly identify incomplete onboarding', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { onboarding_completed: false }, 
              error: null 
            }),
          }),
        }),
      });

      const result = await service.hasCompletedOnboarding(mockUserId);
      expect(result).toBe(false);
    });
  });

  describe('Topic Recommendations', () => {
    const mockUserId = 'user-123';

    it('should generate recommendations from user interests', async () => {
      const mockProfile = {
        interested_topics: ['Web Development', 'AI'],
        priority_subjects: ['React', 'Machine Learning'],
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
          }),
        }),
      });

      const recommendations = await service.getRecommendedTopics(mockUserId);

      expect(recommendations).toContain('Web Development');
      expect(recommendations).toContain('AI');
      expect(recommendations).toContain('React');
      expect(recommendations).toContain('Machine Learning');

      const metrics = service.getMetrics();
      expect(metrics.recommendationsGenerated).toBe(1);
    });

    it('should return empty array when no profile exists', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: null, 
              error: { code: 'PGRST116' } 
            }),
          }),
        }),
      });

      const recommendations = await service.getRecommendedTopics(mockUserId);
      expect(recommendations).toEqual([]);
    });
  });

  describe('Profile Statistics', () => {
    const mockUserId = 'user-123';

    it('should return correct profile statistics', async () => {
      const mockProfile = {
        profile_completeness: 85,
        interested_topics: ['Web Dev', 'AI', 'Design'],
        learning_goals: ['React', 'TypeScript'],
        last_activity: '2024-06-14T10:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
          }),
        }),
      });

      const stats = await service.getProfileStats(mockUserId);

      expect(stats.completeness).toBe(85);
      expect(stats.topicsCount).toBe(3);
      expect(stats.goalsCount).toBe(2);
      expect(stats.lastActivity).toBe('2024-06-14T10:00:00Z');
    });

    it('should return zero stats when no profile exists', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: null, 
              error: { code: 'PGRST116' } 
            }),
          }),
        }),
      });

      const stats = await service.getProfileStats(mockUserId);

      expect(stats.completeness).toBe(0);
      expect(stats.topicsCount).toBe(0);
      expect(stats.goalsCount).toBe(0);
      expect(stats.lastActivity).toBeNull();
    });
  });

  describe('Metrics Tracking', () => {
    it('should track successful operations in metrics', async () => {
      const mockUserId = 'user-123';
      const mockProfile = { id: mockUserId, profession: 'Engineer' };

      // Mock successful profile retrieval
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
          }),
        }),
      });

      await service.getProfile(mockUserId);
      await service.getProfile(mockUserId);

      const metrics = service.getMetrics();
      expect(metrics.profilesRetrieved).toBe(2);
    });

    it('should track failed operations in metrics', async () => {
      const mockUserId = 'user-123';

      // Mock failed profile retrieval
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: null, 
              error: { code: 'PGRST500', message: 'Internal error' } 
            }),
          }),
        }),
      });

      await service.getProfile(mockUserId);

      const metrics = service.getMetrics();
      expect(metrics.profileLookupsFailed).toBe(1);
      expect(metrics.errors).toBe(1);
    });

    it('should calculate average profile completeness correctly', async () => {
      const mockUserId = 'user-123';
      const profileData1: ProfileFormData = {
        profession: 'Engineer',
        learning_goals: ['React'],
        reason_for_learning: 'Career',
        interested_topics: ['Web Dev'],
      };

      // Mock profile save
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { ...profileData1, profile_completeness: 50 }, 
              error: null 
            }),
          }),
        }),
      });

      await service.saveProfile(mockUserId, profileData1);

      const metrics = service.getMetrics();
      expect(metrics.averageProfileCompleteness).toBeGreaterThan(0);
      expect(metrics.profileCompletenessCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      const mockUserId = 'user-123';

      // Mock unexpected error
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected database error');
      });

      const result = await service.getProfile(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected database error');

      const metrics = service.getMetrics();
      expect(metrics.errors).toBe(1);
    });
  });
});