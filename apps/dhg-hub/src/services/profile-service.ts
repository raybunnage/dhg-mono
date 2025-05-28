import { supabaseBrowser } from './supabase-browser-adapter';

export interface UserProfile {
  id: string;
  email?: string;
  display_name?: string;
  bio?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
  // Full profile data from auth_user_profiles
  profession?: string;
  professional_title?: string;
  years_experience?: number;
  industry_sectors?: string[];
  specialty_areas?: string[];
  credentials?: string[];
  learning_goals?: string[];
  reason_for_learning?: string;
  preferred_formats?: string[];
  learning_pace?: string;
  time_commitment?: string;
  preferred_depth?: string;
  preferred_session_length?: number;
  interested_topics?: string[];
  interested_experts?: string[];
  avoided_topics?: string[];
  priority_subjects?: string[];
  content_tags_following?: string[];
  bio_summary?: string;
  learning_background?: string;
  current_challenges?: string;
  intended_application?: string;
  referral_source?: string;
  onboarding_completed?: boolean;
  profile_completeness?: number;
}

export interface ProfileServiceResult {
  success: boolean;
  data?: UserProfile | null;
  error?: string;
}

class ProfileService {
  private static instance: ProfileService;
  
  private constructor() {}
  
  static getInstance(): ProfileService {
    if (!ProfileService.instance) {
      ProfileService.instance = new ProfileService();
    }
    return ProfileService.instance;
  }
  
  async getProfile(userId: string): Promise<ProfileServiceResult> {
    try {
      const { data, error } = await supabaseBrowser.getClient()
        .from('auth_user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No profile exists yet
          return { success: true, data: null };
        }
        console.error('Profile fetch error:', error);
        return { success: false, error: error.message };
      }
      
      return { success: true, data: data as UserProfile };
    } catch (error) {
      console.error('Profile fetch error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
}

export const profileService = ProfileService.getInstance();