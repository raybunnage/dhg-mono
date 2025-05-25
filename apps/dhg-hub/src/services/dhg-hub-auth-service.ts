import type { ProfileFormData as ComponentProfileFormData } from '../../../../packages/shared/components/profile/ProfileForm';
import type { User } from '@supabase/supabase-js';
import { dhgHubLightAuthService } from './dhg-hub-light-auth-service';
import type { Database } from '../../../../supabase/types';

// Re-export types for backward compatibility
export type LightAuthUser = User;
export type ProfileFormData = ComponentProfileFormData;

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
  user_profile_id?: string;
  profile?: any | null;
}

export interface AuthResponse {
  user: AuthUser | null;
  error: Error | null;
}

export interface LightAuthResult {
  success: boolean;
  user?: LightAuthUser;
  error?: string;
  needsProfile?: boolean;
}

/**
 * Map component learning pace to service learning pace
 */
function mapLearningPace(componentPace: 'slow' | 'moderate' | 'fast'): 'self-paced' | 'structured' | 'intensive' {
  switch (componentPace) {
    case 'slow':
      return 'self-paced';
    case 'moderate':
      return 'structured';
    case 'fast':
      return 'intensive';
    default:
      return 'structured';
  }
}

/**
 * Map component preferred depth to service preferred depth
 */
function mapPreferredDepth(depth: 'beginner' | 'intermediate' | 'advanced' | 'expert'): 'beginner' | 'intermediate' | 'advanced' {
  if (depth === 'expert') return 'advanced';
  return depth;
}

/**
 * Convert component ProfileFormData to service ProfileFormData
 */
function convertToServiceProfile(componentProfile: ComponentProfileFormData): any {
  return {
    // Required fields
    profession: componentProfile.profession,
    learning_goals: componentProfile.learning_goals,
    reason_for_learning: componentProfile.reason_for_learning,
    interested_topics: componentProfile.interested_topics,
    
    // Optional fields with proper mapping
    professional_title: componentProfile.professional_title || undefined,
    years_experience: componentProfile.years_experience || undefined,
    industry_sectors: componentProfile.industry_sectors.length > 0 ? componentProfile.industry_sectors : undefined,
    specialty_areas: componentProfile.specialty_areas.length > 0 ? componentProfile.specialty_areas : undefined,
    credentials: componentProfile.credentials.length > 0 ? componentProfile.credentials : undefined,
    preferred_formats: componentProfile.preferred_formats.length > 0 ? componentProfile.preferred_formats : undefined,
    learning_pace: mapLearningPace(componentProfile.learning_pace),
    time_commitment: componentProfile.time_commitment || undefined,
    preferred_depth: mapPreferredDepth(componentProfile.preferred_depth),
    preferred_session_length: componentProfile.preferred_session_length || undefined,
    interested_experts: componentProfile.interested_experts.length > 0 ? componentProfile.interested_experts : undefined,
    avoided_topics: componentProfile.avoided_topics.length > 0 ? componentProfile.avoided_topics : undefined,
    priority_subjects: componentProfile.priority_subjects,
    content_tags_following: componentProfile.content_tags_following,
    bio_summary: componentProfile.bio_summary,
    learning_background: componentProfile.learning_background,
    current_challenges: componentProfile.current_challenges || undefined,
    intended_application: componentProfile.intended_application || undefined,
    referral_source: componentProfile.referral_source
  };
}

class DhgHubAuthService {
  private static instance: DhgHubAuthService;
  private lightAuthService = dhgHubLightAuthService;
  
  private constructor() {}
  
  static getInstance(): DhgHubAuthService {
    if (!DhgHubAuthService.instance) {
      DhgHubAuthService.instance = new DhgHubAuthService();
    }
    return DhgHubAuthService.instance;
  }
  
  async loginWithEmail(email: string): Promise<AuthResponse> {
    try {
      const response = await this.lightAuthService.login(email);
      
      if (!response || !response.success) {
        return {
          user: null,
          error: new Error(response?.error || 'Login failed')
        };
      }
      
      if (response.user) {
        const mappedUser: AuthUser = {
          id: response.user.id,
          email: response.user.email,
          role: response.user.role || 'user',
          created_at: response.user.created_at,
          last_login_at: response.user.last_login_at || null,
          user_profile_id: response.user.user_profile_id,
          profile: response.user.profile || null
        };
        
        return {
          user: mappedUser,
          error: null
        };
      }
      
      return {
        user: null,
        error: new Error('No user returned')
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        user: null,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  async checkWhitelistStatus(email: string): Promise<{ isWhitelisted: boolean; error: Error | null }> {
    try {
      const result = await this.lightAuthService.checkWhitelistStatus(email);
      return result;
    } catch (error) {
      console.error('Whitelist check error:', error);
      return {
        isWhitelisted: false,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  async registerWithProfile(email: string, profileData: ComponentProfileFormData): Promise<AuthResponse> {
    try {
      // Convert component profile data to service format
      const response = await this.lightAuthService.registerWithProfile({
        email,
        name: profileData.profession, // Use profession as the name
        profile: convertToServiceProfile(profileData)
      });
      
      if (!response || !response.success) {
        return {
          user: null,
          error: new Error(response?.error || 'Registration failed')
        };
      }
      
      if (response.user) {
        const mappedUser: AuthUser = {
          id: response.user.id,
          email: response.user.email,
          role: response.user.role || 'user',
          created_at: response.user.created_at,
          last_login_at: response.user.last_login_at || null,
          user_profile_id: response.user.user_profile_id,
          profile: response.user.profile || null
        };
        
        return {
          user: mappedUser,
          error: null
        };
      }
      
      return {
        user: null,
        error: new Error('No user returned')
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        user: null,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  async createProfile(userId: string, profileData: ComponentProfileFormData): Promise<{ profile: any | null; error: Error | null }> {
    try {
      // Use the browser service with proper profile conversion
      const result = await this.lightAuthService.createProfile(userId, convertToServiceProfile(profileData));
      return result;
    } catch (error) {
      console.error('Profile creation error:', error);
      return {
        profile: null,
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }
  
  async completeProfile(userId: string, profileData: ComponentProfileFormData): Promise<LightAuthResult> {
    try {
      const result = await this.lightAuthService.completeProfile(userId, convertToServiceProfile(profileData));
      
      // Save updated user to localStorage
      if (result.success && result.user) {
        this.saveUser({
          id: result.user.id,
          email: result.user.email,
          role: result.user.role || 'user',
          created_at: result.user.created_at,
          last_login_at: result.user.last_login_at || null,
          user_profile_id: result.user.user_profile_id,
          profile: result.user.profile || null
        });
      }
      
      return {
        success: result.success,
        user: result.user,
        error: result.error,
        needsProfile: false
      };
    } catch (error) {
      console.error('Complete profile error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async logout(): Promise<void> {
    localStorage.removeItem('dhg_hub_auth_user');
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'dhg_hub_auth_user',
      newValue: null,
      storageArea: localStorage
    }));
  }
  
  getCurrentUser(): AuthUser | null {
    const userStr = localStorage.getItem('dhg_hub_auth_user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  
  saveUser(user: AuthUser): void {
    localStorage.setItem('dhg_hub_auth_user', JSON.stringify(user));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'dhg_hub_auth_user',
      newValue: JSON.stringify(user),
      storageArea: localStorage
    }));
  }
}

export const dhgHubAuthService = DhgHubAuthService.getInstance();