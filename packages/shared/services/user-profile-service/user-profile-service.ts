/**
 * User Profile Service - Shared Service
 * 
 * Manages user profiles in the user_profiles_v2 table
 * Uses allowed_emails.id as the universal user identifier
 * 
 * Following CLAUDE.md:
 * - Singleton pattern
 * - Uses SupabaseClientService
 * - No hardcoded credentials
 * - Proper TypeScript types
 */

import { SupabaseClientService } from '../supabase-client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/types';

type UserProfile = Database['public']['Tables']['user_profiles_v2']['Row'];
type UserProfileInsert = Database['public']['Tables']['user_profiles_v2']['Insert'];
type UserProfileUpdate = Database['public']['Tables']['user_profiles_v2']['Update'];

export interface ProfileFormData {
  // Professional Background
  profession: string;
  professional_title?: string;
  years_experience?: number;
  industry_sectors?: string[];
  specialty_areas?: string[];
  credentials?: string[];
  
  // Learning Preferences
  learning_goals: string[];
  reason_for_learning: string;
  preferred_formats?: string[];
  learning_pace?: 'self-paced' | 'structured' | 'intensive';
  time_commitment?: string;
  preferred_depth?: 'beginner' | 'intermediate' | 'advanced';
  preferred_session_length?: number;
  
  // Content Interests
  interested_topics: string[];
  interested_experts?: string[];
  avoided_topics?: string[];
  priority_subjects?: string[];
  content_tags_following?: string[];
  
  // Bio & Context
  bio_summary?: string;
  learning_background?: string;
  current_challenges?: string;
  intended_application?: string;
  referral_source?: string;
}

export interface ProfileResult {
  success: boolean;
  profile?: UserProfile;
  error?: string;
}

/**
 * User Profile Service
 * Manages comprehensive user profiles linked to allowed_emails
 */
class UserProfileService {
  private static instance: UserProfileService;
  private supabase: SupabaseClient;

  private constructor() {
    this.supabase = SupabaseClientService.getInstance().getClient();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): UserProfileService {
    if (!UserProfileService.instance) {
      UserProfileService.instance = new UserProfileService();
    }
    return UserProfileService.instance;
  }

  /**
   * Get profile by allowed_emails.id
   */
  async getProfile(allowedEmailId: string): Promise<ProfileResult> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles_v2')
        .select('*')
        .eq('id', allowedEmailId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile exists yet
          return { success: true, profile: undefined };
        }
        console.error('Error fetching profile:', error);
        return { success: false, error: error.message };
      }

      return { success: true, profile: data };
    } catch (error) {
      console.error('Error fetching profile:', error);
      return { success: false, error: 'Failed to fetch profile' };
    }
  }

  /**
   * Create or update user profile
   */
  async saveProfile(allowedEmailId: string, profileData: ProfileFormData): Promise<ProfileResult> {
    try {
      // Calculate profile completeness
      const completeness = this.calculateProfileCompleteness(profileData);

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

      // Use upsert to handle both create and update
      const { data, error } = await this.supabase
        .from('user_profiles_v2')
        .upsert(profileRecord, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving profile:', error);
        return { success: false, error: error.message };
      }

      return { success: true, profile: data };
    } catch (error) {
      console.error('Error saving profile:', error);
      return { success: false, error: 'Failed to save profile' };
    }
  }

  /**
   * Update specific profile fields
   */
  async updateProfile(allowedEmailId: string, updates: UserProfileUpdate): Promise<ProfileResult> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles_v2')
        .update({
          ...updates,
          last_activity: new Date().toISOString()
        })
        .eq('id', allowedEmailId)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile:', error);
        return { success: false, error: error.message };
      }

      return { success: true, profile: data };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: 'Failed to update profile' };
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
    const result = await this.getProfile(allowedEmailId);
    if (!result.success || !result.profile) {
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

    return Array.from(topics);
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
   * Get profile statistics
   */
  async getProfileStats(allowedEmailId: string): Promise<{
    completeness: number;
    topicsCount: number;
    goalsCount: number;
    lastActivity: string | null;
  }> {
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
}

// Export singleton instance
export const userProfileService = UserProfileService.getInstance();