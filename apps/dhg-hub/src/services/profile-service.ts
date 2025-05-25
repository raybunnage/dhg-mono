import { supabase } from './supabase-browser';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileData {
  display_name: string;
  bio?: string;
  avatar_url?: string;
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
  
  async getProfile(userId: string): Promise<{ profile: UserProfile | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('user_profiles_v2')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return { profile: null, error: null };
        }
        throw error;
      }
      
      return { profile: data as UserProfile, error: null };
    } catch (error) {
      console.error('Profile fetch error:', error);
      return {
        profile: null,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  async createProfile(userId: string, email: string, profileData: ProfileData): Promise<{ profile: UserProfile | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('user_profiles_v2')
        .insert({
          id: userId,
          email: email,
          display_name: profileData.display_name,
          bio: profileData.bio || null,
          avatar_url: profileData.avatar_url || null
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return { profile: data as UserProfile, error: null };
    } catch (error) {
      console.error('Profile creation error:', error);
      return {
        profile: null,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  async updateProfile(userId: string, profileData: Partial<ProfileData>): Promise<{ profile: UserProfile | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('user_profiles_v2')
        .update({
          display_name: profileData.display_name,
          bio: profileData.bio,
          avatar_url: profileData.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      
      return { profile: data as UserProfile, error: null };
    } catch (error) {
      console.error('Profile update error:', error);
      return {
        profile: null,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
}

export const profileService = ProfileService.getInstance();