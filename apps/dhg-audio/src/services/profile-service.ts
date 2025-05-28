/**
 * Profile Service for dhg-audio
 * 
 * Direct profile management using browser-specific Supabase client
 * Bypasses the shared service complexity for reliable profile operations
 */

import { supabaseBrowserClient } from './supabase-browser';
import type { ProfileFormData } from '@shared/components/profile/ProfileForm';

interface ProfileServiceResult {
  success: boolean;
  data?: any;
  error?: string;
}

class ProfileService {
  private static instance: ProfileService;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): ProfileService {
    if (!ProfileService.instance) {
      ProfileService.instance = new ProfileService();
    }
    return ProfileService.instance;
  }

  /**
   * Save or update user profile
   */
  async saveProfile(userId: string, profileData: ProfileFormData): Promise<ProfileServiceResult> {
    console.log('[ProfileService] Saving profile for user:', userId);
    console.log('[ProfileService] Profile data:', profileData);

    try {
      const supabase = supabaseBrowserClient.getClient();

      // Map the component data to database format
      const dbProfile = {
        id: userId,
        // Required fields
        profession: profileData.profession,
        learning_goals: profileData.learning_goals,
        reason_for_learning: profileData.reason_for_learning,
        interested_topics: profileData.interested_topics,
        
        // Optional fields
        professional_title: profileData.professional_title || null,
        years_experience: profileData.years_experience || null,
        industry_sectors: profileData.industry_sectors?.length > 0 ? profileData.industry_sectors : null,
        specialty_areas: profileData.specialty_areas?.length > 0 ? profileData.specialty_areas : null,
        credentials: profileData.credentials?.length > 0 ? profileData.credentials : null,
        preferred_formats: profileData.preferred_formats?.length > 0 ? profileData.preferred_formats : null,
        learning_pace: this.mapLearningPace(profileData.learning_pace),
        time_commitment: profileData.time_commitment || null,
        preferred_depth: this.mapPreferredDepth(profileData.preferred_depth),
        preferred_session_length: profileData.preferred_session_length || null,
        interested_experts: profileData.interested_experts?.length > 0 ? profileData.interested_experts : null,
        avoided_topics: profileData.avoided_topics?.length > 0 ? profileData.avoided_topics : null,
        priority_subjects: profileData.priority_subjects || null,
        content_tags_following: profileData.content_tags_following || null,
        bio_summary: profileData.bio_summary || null,
        learning_background: profileData.learning_background || null,
        current_challenges: profileData.current_challenges || null,
        intended_application: profileData.intended_application || null,
        referral_source: profileData.referral_source || null,
        
        // Metadata
        profile_completeness: this.calculateCompleteness(profileData),
        onboarding_completed: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('[ProfileService] Saving to database:', dbProfile);

      const { data, error } = await supabase
        .from('auth_user_profiles')
        .upsert(dbProfile, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (error) {
        console.error('[ProfileService] Save error:', error);
        return { success: false, error: error.message };
      }

      console.log('[ProfileService] Save successful:', data);
      return { success: true, data };
    } catch (error) {
      console.error('[ProfileService] Unexpected error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save profile' 
      };
    }
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<ProfileServiceResult> {
    try {
      const supabase = supabaseBrowserClient.getClient();

      const { data, error } = await supabase
        .from('auth_user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile exists yet
          return { success: true, data: null };
        }
        console.error('[ProfileService] Get profile error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('[ProfileService] Unexpected error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get profile' 
      };
    }
  }

  /**
   * Map component learning pace to database format
   */
  private mapLearningPace(pace: 'slow' | 'moderate' | 'fast'): 'self-paced' | 'structured' | 'intensive' {
    switch (pace) {
      case 'slow': return 'self-paced';
      case 'moderate': return 'structured';
      case 'fast': return 'intensive';
      default: return 'structured';
    }
  }

  /**
   * Map component depth to database format
   */
  private mapPreferredDepth(depth: 'beginner' | 'intermediate' | 'advanced' | 'expert'): 'beginner' | 'intermediate' | 'advanced' {
    return depth === 'expert' ? 'advanced' : depth;
  }

  /**
   * Calculate profile completeness
   */
  private calculateCompleteness(profile: ProfileFormData): number {
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
}

// Export singleton instance
export const profileService = ProfileService.getInstance();