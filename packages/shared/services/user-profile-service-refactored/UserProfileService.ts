/**
 * User Profile Service (Refactored)
 * 
 * Manages user profiles in the auth_user_profiles table.
 * Refactored from singleton to BusinessService with dependency injection.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BusinessService } from '../base-classes/BusinessService';
import { Logger } from '../base-classes/BaseService';
import { Database } from '../../../../supabase/types';
import {
  ProfileFormData,
  ProfileResult,
  UserProfileServiceMetrics,
  ProfileStats
} from './types';

type UserProfile = Database['public']['Tables']['auth_user_profiles']['Row'];
type UserProfileInsert = Database['public']['Tables']['auth_user_profiles']['Insert'];
type UserProfileUpdate = Database['public']['Tables']['auth_user_profiles']['Update'];

export class UserProfileService extends BusinessService {
  private metrics: UserProfileServiceMetrics = {
    profilesCreated: 0,
    profilesUpdated: 0,
    profilesRetrieved: 0,
    profileLookupsFailed: 0,
    profileSavesFailed: 0,
    onboardingCompletions: 0,
    recommendationsGenerated: 0,
    averageProfileCompleteness: 0,
    totalProfileCompleteness: 0,
    profileCompletenessCount: 0,
    errors: 0
  };

  private lastOperationTime: Date = new Date();

  constructor(
    private supabase: SupabaseClient<any>,
    logger?: Logger
  ) {
    super('UserProfileService', { supabase }, logger);
  }

  protected validateDependencies(): void {
    if (!this.dependencies.supabase) {
      throw new Error('UserProfileService requires a SupabaseClient');
    }
  }

  protected async initialize(): Promise<void> {
    // Service is ready to use immediately after dependency validation
    this.logger?.info('UserProfileService initialized');
  }

  async healthCheck(): Promise<{ 
    healthy: boolean; 
    details: Record<string, any>; 
    timestamp: Date; 
    latencyMs?: number 
  }> {
    const startTime = Date.now();
    const checks = {
      databaseConnected: false,
      profileTableAccessible: false,
      lastOperationTime: this.lastOperationTime.toISOString()
    };

    try {
      // Check database connection
      const { error: dbError } = await this.supabase
        .from('auth_user_profiles')
        .select('id')
        .limit(1);
      checks.databaseConnected = !dbError;
      checks.profileTableAccessible = !dbError;

    } catch (error) {
      this.logger?.error('Health check failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }

    const healthy = checks.databaseConnected && checks.profileTableAccessible;
    const latencyMs = Date.now() - startTime;

    return { 
      healthy, 
      details: { ...checks, metrics: this.metrics }, 
      timestamp: new Date(),
      latencyMs
    };
  }

  protected async cleanup(): Promise<void> {
    // No specific cleanup needed for this service
    this.logger?.info('UserProfileService cleaned up');
  }

  getMetrics(): UserProfileServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get profile by allowed_emails.id
   */
  async getProfile(allowedEmailId: string): Promise<ProfileResult> {
    this.lastOperationTime = new Date();
    
    try {
      this.logger?.debug('Retrieving profile', { allowedEmailId });

      const { data, error } = await this.supabase
        .from('auth_user_profiles')
        .select('*')
        .eq('id', allowedEmailId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile exists yet
          this.metrics.profilesRetrieved++;
          this.logger?.debug('Profile not found (no profile exists)', { allowedEmailId });
          return { success: true, profile: undefined };
        }
        
        this.metrics.profileLookupsFailed++;
        this.metrics.errors++;
        this.logger?.error('Error fetching profile', { error: error.message, allowedEmailId });
        return { success: false, error: error.message };
      }

      this.metrics.profilesRetrieved++;
      this.logger?.debug('Profile retrieved successfully', { 
        allowedEmailId, 
        completeness: data.profile_completeness 
      });
      
      return { success: true, profile: data };

    } catch (error) {
      this.metrics.profileLookupsFailed++;
      this.metrics.errors++;
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch profile';
      this.logger?.error('Error fetching profile', { error: errorMessage, allowedEmailId });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Create or update user profile
   */
  async saveProfile(allowedEmailId: string, profileData: ProfileFormData): Promise<ProfileResult> {
    this.lastOperationTime = new Date();
    
    try {
      this.logger?.info('Saving profile', { 
        allowedEmailId, 
        dataKeys: Object.keys(profileData) 
      });
      
      // Calculate profile completeness
      const completeness = this.calculateProfileCompleteness(profileData);
      
      // Track average completeness
      this.updateCompletenessMetrics(completeness);

      const profileRecord: UserProfileInsert = {
        id: allowedEmailId,
        profession: profileData.profession,
        professional_title: profileData.professional_title,
        years_experience: profileData.years_experience,
        industry_sectors: profileData.industry_sectors,
        specialty_areas: profileData.specialty_areas,
        credentials: profileData.credentials,
        learning_goals: profileData.learning_goals,
        reason_for_learning: profileData.reason_for_learning,
        preferred_formats: profileData.preferred_formats || ['video', 'audio'],
        learning_pace: profileData.learning_pace,
        time_commitment: profileData.time_commitment,
        preferred_depth: profileData.preferred_depth,
        preferred_session_length: profileData.preferred_session_length,
        interested_topics: profileData.interested_topics,
        interested_experts: profileData.interested_experts,
        avoided_topics: profileData.avoided_topics,
        priority_subjects: profileData.priority_subjects,
        content_tags_following: profileData.content_tags_following,
        bio_summary: profileData.bio_summary,
        learning_background: profileData.learning_background,
        current_challenges: profileData.current_challenges,
        intended_application: profileData.intended_application,
        referral_source: profileData.referral_source,
        profile_completeness: completeness,
        onboarding_completed: completeness >= 80,
        last_activity: new Date().toISOString()
      };

      this.logger?.debug('Profile record prepared', { 
        allowedEmailId, 
        completeness, 
        onboardingCompleted: profileRecord.onboarding_completed 
      });
      
      // Check if this will complete onboarding
      const wasOnboardingCompleted = profileRecord.onboarding_completed;
      
      // Use upsert to handle both create and update
      const { data, error } = await this.supabase
        .from('auth_user_profiles')
        .upsert(profileRecord, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        this.metrics.profileSavesFailed++;
        this.metrics.errors++;
        this.logger?.error('Error saving profile', { error: error.message, allowedEmailId });
        return { success: false, error: error.message };
      }

      // Track metrics
      if (data.id === allowedEmailId && !data.created_at) {
        // This was an update
        this.metrics.profilesUpdated++;
      } else {
        // This was a create
        this.metrics.profilesCreated++;
      }

      if (wasOnboardingCompleted) {
        this.metrics.onboardingCompletions++;
      }

      this.logger?.info('Profile saved successfully', { 
        allowedEmailId, 
        completeness, 
        wasNewProfile: data.created_at === data.updated_at 
      });
      
      return { success: true, profile: data };

    } catch (error) {
      this.metrics.profileSavesFailed++;
      this.metrics.errors++;
      const errorMessage = error instanceof Error ? error.message : 'Failed to save profile';
      this.logger?.error('Error saving profile', { error: errorMessage, allowedEmailId });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update specific profile fields
   */
  async updateProfile(allowedEmailId: string, updates: UserProfileUpdate): Promise<ProfileResult> {
    this.lastOperationTime = new Date();
    
    try {
      this.logger?.debug('Updating profile', { 
        allowedEmailId, 
        updateKeys: Object.keys(updates) 
      });

      const { data, error } = await this.supabase
        .from('auth_user_profiles')
        .update({
          ...updates,
          last_activity: new Date().toISOString()
        })
        .eq('id', allowedEmailId)
        .select()
        .single();

      if (error) {
        this.metrics.profileSavesFailed++;
        this.metrics.errors++;
        this.logger?.error('Error updating profile', { error: error.message, allowedEmailId });
        return { success: false, error: error.message };
      }

      this.metrics.profilesUpdated++;
      this.logger?.debug('Profile updated successfully', { allowedEmailId });
      
      return { success: true, profile: data };

    } catch (error) {
      this.metrics.profileSavesFailed++;
      this.metrics.errors++;
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      this.logger?.error('Error updating profile', { error: errorMessage, allowedEmailId });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if user has completed onboarding
   */
  async hasCompletedOnboarding(allowedEmailId: string): Promise<boolean> {
    const result = await this.getProfile(allowedEmailId);
    return result.success && result.profile?.onboarding_completed === true;
  }

  /**
   * Get recommended topics based on user interests
   */
  async getRecommendedTopics(allowedEmailId: string): Promise<string[]> {
    this.lastOperationTime = new Date();
    
    try {
      const result = await this.getProfile(allowedEmailId);
      if (!result.success || !result.profile) {
        this.logger?.debug('No profile found for recommendations', { allowedEmailId });
        return [];
      }

      // This would be enhanced with AI recommendations later
      // For now, return topics related to their interests
      const topics = new Set<string>();
      
      if (result.profile.interested_topics) {
        result.profile.interested_topics.forEach(topic => topics.add(topic));
      }
      
      if (result.profile.priority_subjects) {
        result.profile.priority_subjects.forEach(subject => topics.add(subject));
      }

      const recommendations = Array.from(topics);
      this.metrics.recommendationsGenerated++;
      
      this.logger?.debug('Generated topic recommendations', { 
        allowedEmailId, 
        recommendationCount: recommendations.length 
      });
      
      return recommendations;

    } catch (error) {
      this.metrics.errors++;
      this.logger?.error('Error generating recommendations', { 
        error: error instanceof Error ? error.message : String(error),
        allowedEmailId 
      });
      return [];
    }
  }

  /**
   * Get profile statistics
   */
  async getProfileStats(allowedEmailId: string): Promise<ProfileStats> {
    const result = await this.getProfile(allowedEmailId);
    
    if (!result.success || !result.profile) {
      return {
        completeness: 0,
        topicsCount: 0,
        goalsCount: 0,
        lastActivity: null
      };
    }

    return {
      completeness: result.profile.profile_completeness || 0,
      topicsCount: result.profile.interested_topics?.length || 0,
      goalsCount: result.profile.learning_goals?.length || 0,
      lastActivity: result.profile.last_activity
    };
  }

  /**
   * Calculate profile completeness percentage
   */
  private calculateProfileCompleteness(profile: ProfileFormData): number {
    const requiredFields = [
      'profession',
      'learning_goals',
      'reason_for_learning',
      'interested_topics'
    ];

    const optionalFields = [
      'professional_title',
      'years_experience',
      'industry_sectors',
      'specialty_areas',
      'credentials',
      'preferred_formats',
      'learning_pace',
      'time_commitment',
      'preferred_depth',
      'preferred_session_length',
      'interested_experts',
      'priority_subjects',
      'bio_summary',
      'learning_background',
      'current_challenges',
      'intended_application',
      'referral_source'
    ];

    let score = 0;
    let maxScore = 0;

    // Required fields worth 10 points each
    requiredFields.forEach(field => {
      maxScore += 10;
      const value = profile[field as keyof ProfileFormData];
      if (value && (Array.isArray(value) ? value.length > 0 : value !== '')) {
        score += 10;
      }
    });

    // Optional fields worth 3 points each
    optionalFields.forEach(field => {
      maxScore += 3;
      const value = profile[field as keyof ProfileFormData];
      if (value && (Array.isArray(value) ? value.length > 0 : value !== '')) {
        score += 3;
      }
    });

    return Math.round((score / maxScore) * 100);
  }

  /**
   * Update average completeness metrics
   */
  private updateCompletenessMetrics(completeness: number): void {
    this.metrics.totalProfileCompleteness += completeness;
    this.metrics.profileCompletenessCount++;
    this.metrics.averageProfileCompleteness = 
      this.metrics.totalProfileCompleteness / this.metrics.profileCompletenessCount;
  }
}